-- 对外可读的昵称与头像（与 auth user_metadata 同步），便于学生端聊天/职位等读取招聘方头像
-- auth.users 不可被他人 select，故用此表镜像公开字段

create table if not exists public.campus_public_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  avatar_url text,
  nickname text,
  updated_at timestamptz not null default now()
);

create index if not exists idx_campus_public_profiles_updated on public.campus_public_profiles (updated_at desc);

comment on table public.campus_public_profiles is '对外展示的头像与昵称；由前端在用户登录/保存资料时 upsert，供 anon/authenticated 读取';

alter table public.campus_public_profiles enable row level security;

grant select on public.campus_public_profiles to anon, authenticated;
grant insert, update on public.campus_public_profiles to authenticated;

drop policy if exists "campus_public_profiles_select_all" on public.campus_public_profiles;
create policy "campus_public_profiles_select_all"
  on public.campus_public_profiles for select
  to anon, authenticated
  using (true);

drop policy if exists "campus_public_profiles_insert_own" on public.campus_public_profiles;
create policy "campus_public_profiles_insert_own"
  on public.campus_public_profiles for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "campus_public_profiles_update_own" on public.campus_public_profiles;
create policy "campus_public_profiles_update_own"
  on public.campus_public_profiles for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
