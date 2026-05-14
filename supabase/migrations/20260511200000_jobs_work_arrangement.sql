-- 结构化「工作形式」：发布时由招聘方选择；列表筛选优先用该字段，未填写(null)的旧数据仍按正文关键词回退

alter table public.jobs
  add column if not exists work_arrangement text;

comment on column public.jobs.work_arrangement is
  'onsite=到岗为主, remote=可远程或线上为主, hybrid=混合；null 表示未标注，检索时按正文「远程|线上|在家」回退';

alter table public.jobs
  drop constraint if exists jobs_work_arrangement_chk;

alter table public.jobs
  add constraint jobs_work_arrangement_chk
  check (
    work_arrangement is null
    or work_arrangement in ('onsite', 'remote', 'hybrid')
  );

create index if not exists idx_jobs_work_arrangement_status
  on public.jobs (work_arrangement, status)
  where status = 1;

-- 替换检索函数：到岗/远程 条件优先使用 work_arrangement
create or replace function public.search_jobs_catalog(
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
  with params as (
    select
      least(greatest(coalesce(p_limit, 30), 1), 100) as lim,
      greatest(coalesce(p_offset, 0), 0) as off,
      case
        when p_sort in ('new', 'old', 'title') then p_sort
        else 'new'
      end as sort,
      case
        when p_salary in ('all', 'negotiable', 'specified') then p_salary
        else 'all'
      end as sal,
      case
        when p_work in ('all', 'remote', 'onsite') then p_work
        else 'all'
      end as wrk,
      nullif(btrim(coalesce(p_keyword, '')), '') as kw,
      nullif(btrim(coalesce(p_location, '')), '') as loc
  ),
  base as (
    select j.*
    from public.jobs j
    cross join params p
    where j.status = 1
      and (p_category_id is null or p_category_id = 0 or j.category_id = p_category_id)
      and (
        p.kw is null
        or j.title ilike '%' || p.kw || '%'
        or j.address ilike '%' || p.kw || '%'
        or j.content ilike '%' || p.kw || '%'
        or coalesce(j.nickname, '') ilike '%' || p.kw || '%'
      )
      and (p.loc is null or coalesce(j.address, '') ilike '%' || p.loc || '%')
      and (
        p.sal = 'all'
        or (
          p.sal = 'negotiable'
          and (
            j.price is null
            or btrim(coalesce(j.price, '')) = ''
            or j.price ilike '%面议%'
          )
        )
        or (
          p.sal = 'specified'
          and j.price is not null
          and btrim(j.price) <> ''
          and j.price not ilike '%面议%'
        )
      )
      and (
        p.wrk = 'all'
        or (
          p.wrk = 'remote'
          and (
            j.work_arrangement in ('remote', 'hybrid')
            or (
              j.work_arrangement is null
              and coalesce(j.title || j.address || j.content || j.work_time, '') ~* '(远程|线上|在家)'
            )
          )
        )
        or (
          p.wrk = 'onsite'
          and (
            j.work_arrangement = 'onsite'
            or (
              j.work_arrangement is null
              and not (coalesce(j.title || j.address || j.content || j.work_time, '') ~* '(远程|线上|在家)')
            )
          )
        )
      )
  ),
  ord as (
    select
      b.*,
      count(*) over () as __tot,
      row_number() over (
        order by
          case
            when (select sort from params) = 'title' then lower(b.title)
          end asc nulls last,
          case
            when (select sort from params) = 'old' then b.created_at
          end asc nulls last,
          case
            when (select sort from params) = 'new' then b.created_at
          end desc nulls last,
          b.id asc
      ) as __rn
    from base b
  ),
  page_rows as (
    select o.*
    from ord o
    cross join params p
    where o.__rn > p.off
      and o.__rn <= p.off + p.lim
  )
  select jsonb_build_object(
    'total',
    coalesce((select max(__tot) from ord), 0),
    'items',
    coalesce(
      (
        select
          jsonb_agg(
            (to_jsonb(pr) - '__tot' - '__rn')
            || jsonb_build_object('job_category', jsonb_build_object('name', jc.name))
            order by
              pr.__rn
          )
        from page_rows pr
        left join public.job_category jc on jc.id = pr.category_id
      ),
      '[]'::jsonb
    )
  );
$$;

comment on function public.search_jobs_catalog is
  '职位大厅全库筛选 + 分页；work_arrangement 优先，null 时按正文远程关键词回退。';

grant execute on function public.search_jobs_catalog(
  bigint, text, text, text, text, text, int, int
) to anon, authenticated;
