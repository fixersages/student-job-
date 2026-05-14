-- 会话已读水位：用于「我的聊天」未读角标（与 chat_messages 统计）
-- 执行后无需改 listMyConversations；前端调用 RPC + upsert 本表

create table if not exists public.chat_conversation_reads (
  conversation_id uuid not null references public.chat_conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index if not exists idx_chat_conversation_reads_user on public.chat_conversation_reads (user_id);

alter table public.chat_conversation_reads enable row level security;

drop policy if exists "chat_conversation_reads_select_own" on public.chat_conversation_reads;
create policy "chat_conversation_reads_select_own"
  on public.chat_conversation_reads for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "chat_conversation_reads_insert_participant" on public.chat_conversation_reads;
create policy "chat_conversation_reads_insert_participant"
  on public.chat_conversation_reads for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.chat_conversations c
      where c.id = conversation_id
        and (auth.uid() = c.seeker_id or auth.uid() = c.recruiter_id)
    )
  );

drop policy if exists "chat_conversation_reads_update_own" on public.chat_conversation_reads;
create policy "chat_conversation_reads_update_own"
  on public.chat_conversation_reads for update to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.chat_conversations c
      where c.id = conversation_id
        and (auth.uid() = c.seeker_id or auth.uid() = c.recruiter_id)
    )
  );

grant select, insert, update on public.chat_conversation_reads to authenticated;

-- 批量未读：对方发送且 created_at 晚于本人 last_read_at（无记录视为从未读，用 -infinity）
create or replace function public.chat_unread_for_conversations(conv_ids uuid[])
returns table (conversation_id uuid, unread_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select x.conversation_id,
    (
      select count(*)::bigint
      from public.chat_messages m
      where m.conversation_id = x.conversation_id
        and m.sender_id is distinct from auth.uid()
        and m.created_at > coalesce(
          (
            select r.last_read_at
            from public.chat_conversation_reads r
            where r.conversation_id = x.conversation_id
              and r.user_id = auth.uid()
          ),
          '-infinity'::timestamptz
        )
    ) as unread_count
  from unnest(conv_ids) as x(conversation_id);
$$;

grant execute on function public.chat_unread_for_conversations(uuid[]) to authenticated;

comment on table public.chat_conversation_reads is '每用户每会话最后已读时间，用于未读条数统计';
