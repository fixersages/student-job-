-- 修复：若 chat_conversations 为早期手工建表，缺少 recruiter_id 等列，会导致前端 list / insert 报错
-- 可重复执行；从 jobs.user_id 回填 recruiter_id（需岗位已绑定发布者）

alter table public.chat_conversations add column if not exists recruiter_id uuid;

update public.chat_conversations c
set recruiter_id = j.user_id
from public.jobs j
where c.job_id = j.id
  and j.user_id is not null
  and (c.recruiter_id is null or c.recruiter_id is distinct from j.user_id);

alter table public.chat_conversations add column if not exists seeker_display_name text;
alter table public.chat_conversations add column if not exists employer_display_name text;
alter table public.chat_conversations add column if not exists last_message_at timestamptz;
alter table public.chat_conversations add column if not exists last_message_preview text;
alter table public.chat_conversations add column if not exists updated_at timestamptz not null default now();

-- 无法从岗位推断发布者的历史脏数据：删除或手工改 jobs.user_id 后再跑本段
delete from public.chat_conversations where recruiter_id is null;

alter table public.chat_conversations alter column recruiter_id set not null;

create index if not exists idx_chat_conversations_recruiter on public.chat_conversations (recruiter_id, last_message_at desc nulls last);

-- 参与者互斥与唯一约束（若已存在会报错，用例外处理略重；此处用 DO 检查）
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chat_conversations_distinct_participants'
      and conrelid = 'public.chat_conversations'::regclass
  ) then
    alter table public.chat_conversations
      add constraint chat_conversations_distinct_participants check (seeker_id <> recruiter_id);
  end if;
exception when duplicate_object then null;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chat_conversations_one_per_job_seeker'
      and conrelid = 'public.chat_conversations'::regclass
  ) then
    alter table public.chat_conversations
      add constraint chat_conversations_one_per_job_seeker unique (job_id, seeker_id);
  end if;
exception when duplicate_object then null;
end $$;

-- RLS 策略依赖 recruiter_id：若表曾无该列，策略可能不完整，这里幂等重建
drop policy if exists "chat_conversations_select_participant" on public.chat_conversations;
create policy "chat_conversations_select_participant"
  on public.chat_conversations for select to authenticated
  using (auth.uid() = seeker_id or auth.uid() = recruiter_id);

drop policy if exists "chat_conversations_insert_seeker" on public.chat_conversations;
create policy "chat_conversations_insert_seeker"
  on public.chat_conversations for insert to authenticated
  with check (
    auth.uid() = seeker_id
    and seeker_id <> recruiter_id
  );
