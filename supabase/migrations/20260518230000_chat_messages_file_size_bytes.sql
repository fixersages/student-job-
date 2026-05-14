-- 文件消息卡片展示用：字节大小（与微信「441.2K」类似）
alter table public.chat_messages add column if not exists file_size_bytes bigint;

comment on column public.chat_messages.file_size_bytes is '附件大小（字节）；历史消息可为空';
