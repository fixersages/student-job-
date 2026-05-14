-- =============================================================================
-- 一键补全 public.jobs：与前端「发布职位」写入的字段一致（可重复执行）
-- 报错 Could not find the 'gender_req' / 'category_id' / … column in schema cache
-- → 在 Supabase SQL Editor 粘贴本文件全文 → Run → Settings → API → Reload schema → 刷新本站
-- =============================================================================

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

create index if not exists idx_jobs_category_status_created
  on public.jobs (category_id, status, created_at desc);

select pg_notify('pgrst', 'reload schema');
