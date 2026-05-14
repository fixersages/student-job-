-- 已读回执：会话双方需能读取对方的 last_read_at，才能在前端计算「对方已读」
-- 替换仅本人可见的 select 策略（保留 insert/update 仍为本人）
-- Supabase Dashboard → Database → Replication：为 chat_conversation_reads 开启 Realtime（与 chat_messages 类似），对方进房后本端「已读」才能即时更新

drop policy if exists "chat_conversation_reads_select_own" on public.chat_conversation_reads;
drop policy if exists "chat_conversation_reads_select_participants" on public.chat_conversation_reads;

create policy "chat_conversation_reads_select_participants"
  on public.chat_conversation_reads for select to authenticated
  using (
    exists (
      select 1 from public.chat_conversations c
      where c.id = conversation_id
        and (auth.uid() = c.seeker_id or auth.uid() = c.recruiter_id)
    )
  );
