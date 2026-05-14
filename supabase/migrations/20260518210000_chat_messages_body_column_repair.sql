-- 修复：线上若 chat_messages 仅有旧列名 content、缺少 body，PostgREST 会报
-- 「Could not find the 'body' column … in the schema cache」
-- 与仓库 20260513120000_chat_conversations_messages_resumes.sql 及前端 chat.js 对齐。

alter table public.chat_messages add column if not exists body text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'chat_messages'
      and column_name = 'content'
  ) then
    execute $sync$
      update public.chat_messages
      set body = coalesce(nullif(trim(body), ''), nullif(trim(content), ''))
    $sync$;
  end if;
end $$;

comment on column public.chat_messages.body is '文本消息正文；message_type=file 时可为空';
