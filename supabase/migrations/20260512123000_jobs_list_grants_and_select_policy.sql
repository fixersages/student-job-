-- 大厅列表：确保 anon / authenticated 可读取已发布岗位及分类（降低 RPC/REST 被权限拦截概率）
-- 在 Supabase SQL Editor 可整段执行；与既有 migrations 可重复执行

grant usage on schema public to anon, authenticated;

grant select on table public.jobs to anon, authenticated;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'job_category'
  ) then
    execute 'grant select on table public.job_category to anon, authenticated';
  end if;
end $$;

alter table public.jobs enable row level security;

drop policy if exists "jobs_select_visible" on public.jobs;
create policy "jobs_select_visible"
  on public.jobs
  for select
  to anon, authenticated
  using (
    coalesce(status, 1) = 1
    or (auth.uid() is not null and auth.uid() = user_id)
  );
