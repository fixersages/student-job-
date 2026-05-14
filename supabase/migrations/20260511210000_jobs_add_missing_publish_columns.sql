-- 对齐前端发布/列表所需列：若 jobs 表已存在但缺列（如 category_id），用本文件一次性补齐
-- 在 Supabase SQL Editor 执行后，到 Dashboard → Settings → API → 点「Reload schema」（或等待数分钟）刷新 schema cache

alter table public.jobs add column if not exists category_id bigint;
alter table public.jobs add column if not exists title text not null default '';
alter table public.jobs add column if not exists address text;
alter table public.jobs add column if not exists price text;
alter table public.jobs add column if not exists salary numeric not null default 0;
alter table public.jobs add column if not exists work_time text;
alter table public.jobs add column if not exists gender_req text default '不限';
alter table public.jobs add column if not exists phone text;
alter table public.jobs add column if not exists wechat text;
alter table public.jobs add column if not exists content text;
alter table public.jobs add column if not exists user_id uuid;
alter table public.jobs add column if not exists nickname text;
alter table public.jobs add column if not exists status integer default 1;
alter table public.jobs add column if not exists cover_image text;
alter table public.jobs add column if not exists work_arrangement text;
alter table public.jobs add column if not exists created_at timestamptz default now();

comment on column public.jobs.category_id is '关联 job_category.id，发布页必选';

-- 外键：仅当不存在同名约束且 job_category 表存在时添加（避免重复执行报错）
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'job_category') then
    if not exists (
      select 1 from pg_constraint c
      join pg_class t on c.conrelid = t.oid
      where t.relname = 'jobs' and c.conname = 'jobs_category_id_fkey'
    ) then
      alter table public.jobs
        add constraint jobs_category_id_fkey
        foreign key (category_id) references public.job_category (id);
    end if;
  end if;
end $$;

-- 若已有 category_id 列但无索引，补索引（与列表查询一致）
create index if not exists idx_jobs_category_status_created
  on public.jobs (category_id, status, created_at desc);

-- 尝试通知 PostgREST 重载 schema（无权限则忽略；仍建议到 Dashboard → API → Reload schema）
select pg_notify('pgrst', 'reload schema');
