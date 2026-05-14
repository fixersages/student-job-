import { supabase } from '@/lib/supabase'
import { attachPublisherPublicToJobs } from '@/api/publicProfile'

/** 与 Supabase 中存储岗位的主表名一致（勿再与 part_time 混用） */
export const JOBS_TABLE = 'jobs'

export const DEFAULT_PAGE_SIZE = 10

/** 大厅列表与列表卡片所需字段（禁止 select *） */
const JOB_LIST_FIELDS =
  'id,created_at,category_id,title,address,price,salary,work_time,work_arrangement,gender_req,user_id,nickname,status,cover_image,content,job_category(name)'

const JOB_DETAIL_BASE =
  'id,created_at,category_id,title,address,price,salary,work_time,work_arrangement,gender_req,phone,wechat,content,user_id,nickname,status,cover_image'

const JOB_DETAIL_SELECT = `${JOB_DETAIL_BASE},job_category(name)`

/**
 * 职位大厅列表：普通表查询 + 分页（range）+ 排序，避免全表扫描。
 *
 * @param {object} [opts]
 * @param {number} [opts.page] 从 0 起
 * @param {number} [opts.pageSize] 默认 10
 * @param {'new'|'old'|'title'} [opts.sort] 最新 | 最早 | 标题
 */
export async function fetchJobsPage({ page = 0, pageSize = DEFAULT_PAGE_SIZE, sort = 'new' } = {}) {
  const size = Math.min(Math.max(Number(pageSize) || DEFAULT_PAGE_SIZE, 1), 50)
  const p = Math.max(Number(page) || 0, 0)
  const from = p * size
  const to = from + size - 1

  let orderCol = 'created_at'
  let ascending = false
  if (sort === 'old') ascending = true
  if (sort === 'title') {
    orderCol = 'title'
    ascending = true
  }

  let { data, error, count } = await supabase
    .from(JOBS_TABLE)
    .select(JOB_LIST_FIELDS, { count: 'exact' })
    .eq('status', 1)
    .order(orderCol, { ascending })
    .range(from, to)

  if (error && isJobsCategoryEmbedError(error)) {
    const fallbackFields = JOB_LIST_FIELDS.replace(',job_category(name)', '')
    ;({ data, error, count } = await supabase
      .from(JOBS_TABLE)
      .select(fallbackFields, { count: 'exact' })
      .eq('status', 1)
      .order(orderCol, { ascending })
      .range(from, to))
  }

  if (error) return { data, error, count }
  const enriched = await attachPublisherPublicToJobs(data ?? [])
  return { data: enriched, error: null, count }
}

/** PostgREST 无法解析 jobs↔job_category 嵌入时（缺外键/关系）会 400 */
function isJobsCategoryEmbedError(err) {
  if (!err) return false
  const m = `${err.message || ''} ${err.details || ''} ${err.hint || ''}`.toLowerCase()
  return (
    err.code === 'PGRST200' ||
    /relationship|embedding|job_category|foreign key|schema cache|could not find.*hint/i.test(m)
  )
}

/** @deprecated 请使用 fetchJobsPage；保留兼容为分页第一页 */
export const getJobList = async (opts = {}) => fetchJobsPage({ page: 0, pageSize: DEFAULT_PAGE_SIZE, sort: 'new', ...opts })

export const getJobDetail = async (jobId) => {
  let { data, error } = await supabase.from(JOBS_TABLE).select(JOB_DETAIL_SELECT).eq('id', jobId).single()
  if (error && isJobsCategoryEmbedError(error)) {
    ;({ data, error } = await supabase.from(JOBS_TABLE).select(JOB_DETAIL_BASE).eq('id', jobId).single())
  }
  if (error || !data) return { data, error }
  const [one] = await attachPublisherPublicToJobs([data])
  return { data: one ?? data, error: null }
}

/** @param {unknown} v */
function salaryForInsert(v) {
  if (v === '' || v == null) return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export const createJob = async (jobInfo) => {
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()
  if (authErr || !user?.id) {
    return { data: null, error: authErr ?? Object.assign(new Error('未登录，无法发布'), { name: 'AuthSessionMissingError' }) }
  }
  const salary = salaryForInsert(jobInfo?.salary)
  const { data, error } = await supabase
    .from(JOBS_TABLE)
    .insert([{ ...jobInfo, user_id: user.id, salary }])
  return { data, error }
}

export const getMyJob = async (userId, { page = 0, pageSize = DEFAULT_PAGE_SIZE } = {}) => {
  const size = Math.min(Math.max(Number(pageSize) || DEFAULT_PAGE_SIZE, 1), 50)
  const p = Math.max(Number(page) || 0, 0)
  const from = p * size
  const to = from + size - 1
  return supabase
    .from(JOBS_TABLE)
    .select('id,created_at,title,status,address,price,salary', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(from, to)
}

export const deleteJobById = async (id) => {
  return supabase.from(JOBS_TABLE).delete().eq('id', id)
}

/**
 * 招聘方更新自己发布的职位（依赖 RLS jobs_update_own）。
 * @param {string|number} jobId
 * @param {Record<string, unknown>} patch 与发布表单一致的业务字段
 */
export async function updateJobById(jobId, patch) {
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()
  if (authErr || !user?.id) {
    return { data: null, error: authErr ?? Object.assign(new Error('未登录'), { name: 'AuthSessionMissingError' }) }
  }
  const jid = Number(jobId)
  if (!Number.isFinite(jid) || jid <= 0) {
    return { data: null, error: new Error('无效的职位 ID') }
  }

  const cid = Number(patch?.category_id)
  const row = {
    category_id: Number.isFinite(cid) && cid > 0 ? cid : null,
    title: String(patch?.title ?? '').trim(),
    address: patch?.address != null ? String(patch.address) : '',
    price: patch?.price != null ? String(patch.price) : '',
    salary: salaryForInsert(patch?.salary),
    work_time: patch?.work_time != null ? String(patch.work_time) : '',
    gender_req: patch?.gender_req != null ? String(patch.gender_req) : '不限',
    work_arrangement: String(patch?.work_arrangement ?? '').trim(),
    phone: String(patch?.phone ?? '').trim(),
    wechat: patch?.wechat != null ? String(patch.wechat) : '',
    content: patch?.content != null ? String(patch.content) : '',
    nickname: String(patch?.nickname ?? user.user_metadata?.nickname ?? '').trim(),
    status: 1,
  }
  const ci = patch?.cover_image != null ? String(patch.cover_image).trim() : ''
  row.cover_image = ci || null

  return supabase.from(JOBS_TABLE).update(row).eq('id', jid).eq('user_id', user.id).select('id').maybeSingle()
}
