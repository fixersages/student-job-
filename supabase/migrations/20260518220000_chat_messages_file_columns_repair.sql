-- 修复：旧表缺少附件列时，插入 file 消息会报
-- 「Could not find the 'file_mime' column … in the schema cache」
-- 与仓库 20260513120000_chat_conversations_messages_resumes.sql 及 sendFileMessage 对齐。

alter table public.chat_messages add column if not exists file_url text;
alter table public.chat_messages add column if not exists file_name text;
alter table public.chat_messages add column if not exists file_mime text;

comment on column public.chat_messages.file_url is '附件公开 URL（如 Storage public URL）';
comment on column public.chat_messages.file_name is '原始文件名（展示用）';
comment on column public.chat_messages.file_mime is 'MIME 类型，可为空';
