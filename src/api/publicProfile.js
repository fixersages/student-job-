import { supabase } from '@/lib/supabase'

export const CAMPUS_PUBLIC_PROFILES = 'campus_public_profiles'

/**
 * 将当前登录用户的昵称、头像写入公开表，供他人在聊天/职位等场景读取。
 * @param {import('@supabase/supabase-js').User | null} user
 */
export async function syncCampusPublicProfileFromUser(user) {
  if (!user?.id) {
    return { data: null, error: Object.assign(new Error('未登录'), { name: 'AuthSessionMissingError' }) }
  }
  const m = user.user_metadata || {}
  const av = m.avatar_url != null ? String(m.avatar_url).trim() : ''
  const nick =
    (m.nickname != null && String(m.nickname).trim()) ||
    (m.full_name != null && String(m.full_name).trim()) ||
    (m.name != null && String(m.name).trim()) ||
    (m.preferred_username != null && String(m.preferred_username).trim()) ||
    (m.user_name != null && String(m.user_name).trim()) ||
    String(user.email || '').split('@')[0] ||
    null
  const row = {
    user_id: user.id,
    avatar_url: av || null,
    nickname: nick || null,
    updated_at: new Date().toISOString(),
  }
  return supabase.from(CAMPUS_PUBLIC_PROFILES).upsert(row, { onConflict: 'user_id' })
}

/**
 * @param {string[]} userIds
 */
export async function fetchCampusPublicProfilesByIds(userIds) {
  const ids = [...new Set((userIds ?? []).map(String).filter(Boolean))]
  if (!ids.length) return { data: [], error: null }
  return supabase.from(CAMPUS_PUBLIC_PROFILES).select('user_id, avatar_url, nickname').in('user_id', ids)
}

/**
 * 为职位列表/详情合并 `publisher_public`（发布者在 campus_public_profiles 中的公开信息），便于未登录用户也能读头像。
 * @param {Array<Record<string, unknown>>} jobs
 */
export async function attachPublisherPublicToJobs(jobs) {
  const list = Array.isArray(jobs) ? jobs : []
  if (!list.length) return list
  const uidSet = new Set()
  for (const j of list) {
    if (j?.user_id != null && String(j.user_id).trim()) uidSet.add(String(j.user_id).trim())
  }
  const ids = [...uidSet]
  if (!ids.length) return list.map((j) => ({ ...j, publisher_public: null }))
  const { data: profs, error } = await fetchCampusPublicProfilesByIds(ids)
  if (error) console.warn('[publicProfile] attachPublisherPublicToJobs', error.message || error)
  const map = {}
  for (const p of profs ?? []) {
    if (p?.user_id) map[String(p.user_id)] = p
  }
  return list.map((j) => ({
    ...j,
    publisher_public: j?.user_id != null ? map[String(j.user_id).trim()] ?? null : null,
  }))
}
