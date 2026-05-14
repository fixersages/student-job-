-- 求职者-招聘方聊天 + 简历文件（resumes 存储桶）
-- 执行后：Dashboard → Database → Replication → 确认 chat_messages 已加入 Realtime（若未自动出现，对本表开启 Replica identity full 或走官方「Enable Realtime」）

-- ---------------------------------------------------------------------------
-- 表：chat_conversations（每个「岗位 + 求职者」一条会话）
-- ---------------------------------------------------------------------------
create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  job_id bigint not null references public.jobs (id) on delete cascade,
  seeker_id uuid not null,
  recruiter_id uuid not null,
  seeker_display_name text,
  employer_display_name text,
  last_message_at timestamptz,
  last_message_preview text,
  constraint chat_conversations_distinct_participants check (seeker_id <> recruiter_id),
  constraint chat_conversations_one_per_job_seeker unique (job_id, seeker_id)
);

create index if not exists idx_chat_conversations_seeker on public.chat_conversations (seeker_id, last_message_at desc nulls last);
create index if not exists idx_chat_conversations_recruiter on public.chat_conversations (recruiter_id, last_message_at desc nulls last);

comment on table public.chat_conversations is '岗位沟通会话：seeker 为学生侧，recruiter_id 为岗位发布者 user_id';

-- ---------------------------------------------------------------------------
-- 表：chat_messages
-- ---------------------------------------------------------------------------
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  conversation_id uuid not null references public.chat_conversations (id) on delete cascade,
  sender_id uuid not null,
  message_type text not null default 'text' check (message_type in ('text', 'file')),
  body text,
  file_url text,
  file_name text,
  file_mime text
);

create index if not exists idx_chat_messages_conversation_created on public.chat_messages (conversation_id, created_at desc);

comment on table public.chat_messages is '会话消息：message_type=file 时 file_url 等为简历/附件';

-- ---------------------------------------------------------------------------
-- 更新会话摘要（最后一条）
-- ---------------------------------------------------------------------------
create or replace function public.chat_touch_conversation_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.chat_conversations
  set
    updated_at = new.created_at,
    last_message_at = new.created_at,
    last_message_preview = case
      when new.message_type = 'file' then coalesce('📎 ' || nullif(trim(new.file_name), ''), '📎 文件')
      else left(coalesce(nullif(trim(new.body), ''), '（空消息）'), 200)
    end
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists trg_chat_messages_touch_conversation on public.chat_messages;
create trigger trg_chat_messages_touch_conversation
  after insert on public.chat_messages
  for each row
  execute function public.chat_touch_conversation_on_message();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;

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

drop policy if exists "chat_messages_select_participant" on public.chat_messages;
create policy "chat_messages_select_participant"
  on public.chat_messages for select to authenticated
  using (
    exists (
      select 1 from public.chat_conversations c
      where c.id = conversation_id
        and (auth.uid() = c.seeker_id or auth.uid() = c.recruiter_id)
    )
  );

drop policy if exists "chat_messages_insert_participant" on public.chat_messages;
create policy "chat_messages_insert_participant"
  on public.chat_messages for insert to authenticated
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.chat_conversations c
      where c.id = conversation_id
        and (auth.uid() = c.seeker_id or auth.uid() = c.recruiter_id)
    )
  );

grant select, insert on public.chat_conversations to authenticated;
grant select, insert on public.chat_messages to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime：在 Supabase Dashboard → Database → Replication 中为 chat_messages 打开 Realtime
-- （不同项目 publication 名称可能不同，此处不自动 alter publication，避免迁移失败）
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Storage：resumes 桶（PDF / 图片简历，公开读链接便于聊天内下载）
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('resumes', 'resumes', true, 10485760)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;

drop policy if exists "resumes_insert_own_folder" on storage.objects;
create policy "resumes_insert_own_folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "resumes_select_authenticated" on storage.objects;
create policy "resumes_select_authenticated"
  on storage.objects for select to authenticated
  using (bucket_id = 'resumes');

drop policy if exists "resumes_delete_own_folder" on storage.objects;
create policy "resumes_delete_own_folder"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
