-- 前端统一调用 public.search_jobs；实现委托给 search_jobs_catalog（全库关键词、薪资、到岗/远程、分类、排序与分页）。
-- 须已执行 20260511183000_search_jobs_catalog_rpc.sql 与 20260511200000_jobs_work_arrangement.sql（或等效定义）。

create or replace function public.search_jobs(
  p_category_id bigint default null,
  p_keyword text default null,
  p_location text default null,
  p_salary text default 'all',
  p_work text default 'all',
  p_sort text default 'new',
  p_limit int default 30,
  p_offset int default 0
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select public.search_jobs_catalog(
    p_category_id,
    p_keyword,
    p_location,
    p_salary,
    p_work,
    p_sort,
    p_limit,
    p_offset
  );
$$;

comment on function public.search_jobs is
  '职位大厅全库检索 + 分页；与 search_jobs_catalog 一致，供前端 supabase.rpc(''search_jobs'') 调用。';

grant execute on function public.search_jobs(
  bigint, text, text, text, text, text, int, int
) to anon, authenticated;
