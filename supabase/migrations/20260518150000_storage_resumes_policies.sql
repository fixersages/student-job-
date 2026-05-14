-- 聊天简历桶 resumes：与 avatars 对齐，避免上传在部分环境下失败
-- 1) 公开读：匿名可经 public URL 拉取（桶本身为 public）
-- 2) 本人目录 update：部分 Storage 客户端路径会触达 update
-- 3) 路径校验用 split_part，与 foldername 等价且兼容性更好

insert into storage.buckets (id, name, public, file_size_limit)
values ('resumes', 'resumes', true, 10485760)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;

drop policy if exists "resumes_select_authenticated" on storage.objects;
drop policy if exists "resumes_select_public" on storage.objects;
create policy "resumes_select_public"
  on storage.objects for select
  using (bucket_id = 'resumes');

drop policy if exists "resumes_insert_own_folder" on storage.objects;
create policy "resumes_insert_own_folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'resumes'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "resumes_update_own_folder" on storage.objects;
create policy "resumes_update_own_folder"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'resumes'
    and split_part(name, '/', 1) = auth.uid()::text
  )
  with check (
    bucket_id = 'resumes'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "resumes_delete_own_folder" on storage.objects;
create policy "resumes_delete_own_folder"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'resumes'
    and split_part(name, '/', 1) = auth.uid()::text
  );
