/** 与 Supabase jobs.work_arrangement 及 RPC 筛选语义一致 */

export const WORK_ARRANGEMENT = {
  ONSITE: 'onsite',
  REMOTE: 'remote',
  HYBRID: 'hybrid',
}

/** @param {string | null | undefined} v */
export function workArrangementLabel(v) {
  switch (v) {
    case WORK_ARRANGEMENT.ONSITE:
      return '到岗为主'
    case WORK_ARRANGEMENT.REMOTE:
      return '可远程 / 线上为主'
    case WORK_ARRANGEMENT.HYBRID:
      return '混合（到岗 + 线上）'
    default:
      return '未标注（按正文关键词推断）'
  }
}

/** @param {Record<string, unknown>} job */
export function jobTextHasRemoteHint(job) {
  const t = `${job.title || ''} ${job.address || ''} ${job.content || ''} ${job.work_time || ''}`.toLowerCase()
  return t.includes('远程') || t.includes('线上') || t.includes('在家')
}

/**
 * 与降级 REST 列表的客户端筛选、以及 RPC 中「未标注」分支一致
 * @param {Record<string, unknown>} job
 * @param {'remote'|'onsite'} mode
 */
export function jobMatchesWorkFilter(job, mode) {
  const w = job.work_arrangement
  if (mode === 'remote') {
    if (w === WORK_ARRANGEMENT.REMOTE || w === WORK_ARRANGEMENT.HYBRID) return true
    if (w === WORK_ARRANGEMENT.ONSITE) return false
    return jobTextHasRemoteHint(job)
  }
  if (mode === 'onsite') {
    if (w === WORK_ARRANGEMENT.ONSITE) return true
    if (w === WORK_ARRANGEMENT.REMOTE || w === WORK_ARRANGEMENT.HYBRID) return false
    return !jobTextHasRemoteHint(job)
  }
  return true
}
