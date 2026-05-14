import { supabase } from '@/lib/supabase'
import { fetchCampusPublicProfilesByIds } from '@/api/publicProfile'

/**
 * 与发往 PostgREST 的请求 JWT 一致：优先 session.user.id（对应 auth.uid()），避免仅 getUser 与本地会话不同步导致 RLS 拒绝。
 * @returns {Promise<{ uid: string|null, error: Error|null }>}
 */
async function resolveSendActor() {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const sid = session?.user?.id
  if (sid) return { uid: sid, error: null }

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser()
  if (user?.id) return { uid: user.id, error: null }

  return { uid: null, error: userErr || new Error('未登录') }
}

/**
 * 插入前校验：会话存在且当前用户为 seeker 或 recruiter（与 RLS 子查询一致）。
 * @param {string} conversationId
 * @param {string} uid
 */
async function assertConversationParticipant(conversationId, uid) {
  const cid = String(conversationId ?? '').trim()
  if (!cid) return { ok: false, conversationId: '', error: new Error('无效的会话') }

  const { data, error } = await supabase
    .from('chat_conversations')
    .select('id')
    .eq('id', cid)
    .or(`seeker_id.eq.${uid},recruiter_id.eq.${uid}`)
    .maybeSingle()

  if (error) return { ok: false, conversationId: cid, error }
  if (!data?.id) {
    return {
      ok: false,
      conversationId: cid,
      error: new Error('你不是此会话的参与者，无法发送消息'),
    }
  }
  return { ok: true, conversationId: cid, error: null }
}

/**
 * Storage 路径只允许安全 ASCII；中文、括号、空格等会触发「Invalid key」。
 * 下载链接旁展示名仍用原始 `file.name`（写入 chat_messages.file_name）。
 * @param {string} name
 */
function safeFileName(name) {
  const s = String(name || '').trim() || 'file'
  const lastDot = s.lastIndexOf('.')
  let ext = ''
  let base = s
  if (lastDot > 0 && lastDot < s.length - 1) {
    ext = s.slice(lastDot + 1).toLowerCase().replace(/[^a-z0-9]/g, '')
    if (ext.length > 12) ext = ext.slice(0, 12)
    base = s.slice(0, lastDot)
  }
  const stem = base
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '') || 'file'
  const shortStem = stem.slice(0, 160)
  const withExt = ext ? `${shortStem}.${ext}` : shortStem
  return withExt.slice(0, 180)
}

/** 部分浏览器对所选文件不填 type，Storage 仍需要合理 Content-Type */
function guessMimeFromFileName(name) {
  const n = String(name || '').toLowerCase()
  if (n.endsWith('.pdf')) return 'application/pdf'
  if (n.endsWith('.png')) return 'image/png'
  if (n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg'
  if (n.endsWith('.webp')) return 'image/webp'
  if (n.endsWith('.gif')) return 'image/gif'
  return undefined
}

/**
 * 获取或创建「当前用户（作为求职者）↔ 岗位发布者」的会话。
 * @param {{ jobId: string|number, recruiterId?: string, employerId?: string, jobTitle?: string, employerDisplayName?: string, seekerDisplayName?: string }} p
 */
export async function getOrCreateConversation({
  jobId,
  recruiterId,
  employerId,
  jobTitle: _jobTitle,
  employerDisplayName = '',
  seekerDisplayName = '',
}) {
  const rid = recruiterId ?? employerId
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()
  if (authErr || !user?.id) {
    return { conversationId: null, error: Object.assign(new Error('请先登录'), { code: 'NO_AUTH' }) }
  }
  if (!rid || user.id === rid) {
    return { conversationId: null, error: new Error('无法与自己发起会话') }
  }

  const jid = Number(jobId)
  if (!Number.isFinite(jid)) {
    return { conversationId: null, error: new Error('岗位无效') }
  }

  const { data: existing, error: selErr } = await supabase
    .from('chat_conversations')
    .select('id')
    .eq('job_id', jid)
    .eq('seeker_id', user.id)
    .maybeSingle()

  if (selErr) return { conversationId: null, error: selErr }
  if (existing?.id) return { conversationId: existing.id, error: null }

  const { data: inserted, error: insErr } = await supabase
    .from('chat_conversations')
    .insert([
      {
        job_id: jid,
        seeker_id: user.id,
        recruiter_id: rid,
        seeker_display_name: seekerDisplayName || user.user_metadata?.nickname || user.email?.split('@')[0] || '求职者',
        employer_display_name: employerDisplayName || '招聘方',
      },
    ])
    .select('id')
    .single()

  if (insErr) return { conversationId: null, error: insErr }
  return { conversationId: inserted?.id ?? null, error: null }
}

/**
 * 为会话行附加 seeker_public / recruiter_public（头像等从 campus_public_profiles 读取）。
 * @param {unknown[]} rows
 */
async function attachConversationPublicProfiles(rows) {
  const list = Array.isArray(rows) ? rows : []
  if (!list.length) return list
  const ids = new Set()
  for (const r of list) {
    if (r?.seeker_id) ids.add(String(r.seeker_id))
    if (r?.recruiter_id) ids.add(String(r.recruiter_id))
  }
  const { data: profs, error } = await fetchCampusPublicProfilesByIds([...ids])
  if (error) console.warn('[chat] attachConversationPublicProfiles', error.message || error)
  const map = {}
  for (const p of profs ?? []) {
    if (p?.user_id) map[String(p.user_id)] = p
  }
  return list.map((r) => ({
    ...r,
    seeker_public: map[String(r.seeker_id)] || null,
    recruiter_public: map[String(r.recruiter_id)] || null,
  }))
}

const CHAT_CONV_LIST_FIELDS =
  'id,created_at,updated_at,job_id,seeker_id,recruiter_id,seeker_display_name,employer_display_name,last_message_at,last_message_preview,jobs(title)'

/** 我的会话列表（参与方任一侧）；分页 + range，默认每页 10 条 */
export async function listMyConversations({ page = 0, pageSize = 10 } = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  let user = session?.user ?? null
  if (!user) {
    const {
      data: { user: u },
    } = await supabase.auth.getUser()
    user = u ?? null
  }
  if (!user) return { data: [], error: null, count: 0 }

  const size = Math.min(Math.max(Number(pageSize) || 10, 1), 50)
  const p = Math.max(Number(page) || 0, 0)
  const from = p * size
  const to = from + size - 1

  const { data, error, count } = await supabase
    .from('chat_conversations')
    .select(CHAT_CONV_LIST_FIELDS, { count: 'exact' })
    .or(`seeker_id.eq.${user.id},recruiter_id.eq.${user.id}`)
    .order('updated_at', { ascending: false })
    .range(from, to)

  if (error) return { data: [], error, count: null }
  const enriched = await attachConversationPublicProfiles(data ?? [])
  return { data: enriched, error: null, count }
}

/**
 * 未读条数：优先 RPC（与迁移 chat_unread_for_conversations 一致）；
 * 若 RPC 不可用或结果不完整，则按会话逐条 count（与 RPC 语义一致，略多请求）。
 * @param {string[]} conversationIds
 */
export async function fetchUnreadCountsForConversations(conversationIds) {
  const ids = [...new Set((conversationIds ?? []).map(String).filter(Boolean))]
  if (!ids.length) return { data: [], error: null }

  const rpc = await supabase.rpc('chat_unread_for_conversations', { conv_ids: ids })
  if (!rpc.error && Array.isArray(rpc.data) && rpc.data.length) {
    const got = new Set(rpc.data.map((r) => String(r?.conversation_id ?? '')))
    const allIdsCovered = ids.every((id) => got.has(id))
    if (allIdsCovered) return rpc
  }
  if (rpc.error) {
    console.warn('[chat] chat_unread_for_conversations', rpc.error.message || rpc.error)
  }

  const fallback = await fetchUnreadCountsFallback(ids)
  return { data: fallback, error: null }
}

/**
 * @param {string[]} ids
 * @returns {Promise<{ conversation_id: string, unread_count: number }[]>}
 */
async function fetchUnreadCountsFallback(ids) {
  const { uid } = await resolveSendActor()
  if (!uid) return ids.map((conversation_id) => ({ conversation_id, unread_count: 0 }))

  return Promise.all(
    ids.map(async (convId) => {
      const { data: readRow } = await supabase
        .from('chat_conversation_reads')
        .select('last_read_at')
        .eq('conversation_id', convId)
        .eq('user_id', uid)
        .maybeSingle()

      const since = readRow?.last_read_at || '1970-01-01T00:00:00.000Z'
      const { count, error } = await supabase
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', convId)
        .neq('sender_id', uid)
        .gt('created_at', since)

      if (error) {
        console.warn('[chat] unread fallback count', convId, error.message || error)
        return { conversation_id: convId, unread_count: 0 }
      }
      return { conversation_id: convId, unread_count: Number(count) || 0 }
    }),
  )
}

/** 会话内各用户的已读水位（双方可读，用于对方已读回执） */
export async function fetchConversationReadStates(conversationId) {
  const cid = String(conversationId ?? '').trim()
  if (!cid) return { data: [], error: null }
  return supabase.from('chat_conversation_reads').select('user_id, last_read_at').eq('conversation_id', cid)
}

/** 进入会话或发送后更新已读水位，列表未读清零。
 * @param {string} conversationId
 * @param {{ lastReadAt?: string, skewFutureMs?: number }} [opts]
 *   lastReadAt：直接写入的 ISO 时间（优先）。
 *   skewFutureMs：在「当前客户端时间」基础上往后加多少毫秒再写入，用于缓解**本机时钟慢于数据库**时未读仍被计数的问题。
 */
export async function markConversationRead(conversationId, opts = {}) {
  const { uid, error: authErr } = await resolveSendActor()
  if (!uid) return { data: null, error: authErr || new Error('未登录') }
  const cid = String(conversationId ?? '').trim()
  if (!cid) return { data: null, error: new Error('无效的会话') }

  const explicit = typeof opts.lastReadAt === 'string' ? opts.lastReadAt.trim() : ''
  const skew = Math.max(0, Number(opts.skewFutureMs) || 0)
  const lastReadAt = explicit || new Date(Date.now() + skew).toISOString()

  return supabase
    .from('chat_conversation_reads')
    .upsert(
      {
        conversation_id: cid,
        user_id: uid,
        last_read_at: lastReadAt,
      },
      { onConflict: 'conversation_id,user_id' },
    )
    .select('conversation_id, last_read_at')
    .maybeSingle()
}

/**
 * 消息行返回字段：勿包含线上可能尚未迁移的列（如 file_size_bytes），否则 select 整段失败 → 无历史、发送后无返回体。
 * 附件大小仅影响展示，缺列时前端 formatStoredFileSize 会为空。
 */
const CHAT_MESSAGE_FIELDS =
  'id,created_at,conversation_id,sender_id,message_type,body,file_url,file_name,file_mime'

/**
 * @param {string} conversationId
 * @param {{ before?: string, limit?: number }} [opts] limit 默认 10，用 range 分页
 */
export async function fetchMessages(conversationId, { before = null, limit = 10 } = {}) {
  const lim = Math.min(Math.max(Number(limit) || 10, 1), 100)
  const from = 0
  const to = lim - 1

  let q = supabase
    .from('chat_messages')
    .select(CHAT_MESSAGE_FIELDS)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })

  if (before) {
    q = q.lt('created_at', before)
  }

  q = q.range(from, to)

  const { data, error } = await q
  const rows = (data ?? []).slice().reverse()
  return { data: rows, error }
}

export async function sendTextMessage(conversationId, body) {
  const { uid, error: authErr } = await resolveSendActor()
  if (!uid) return { data: null, error: authErr || new Error('未登录') }

  const text = String(body ?? '').trim()
  if (!text) return { data: null, error: new Error('消息不能为空') }

  const { ok, conversationId: cid, error: partErr } = await assertConversationParticipant(
    conversationId,
    uid,
  )
  if (!ok) return { data: null, error: partErr || new Error('无权发送') }

  return await supabase
    .from('chat_messages')
    .insert([
      {
        conversation_id: cid,
        sender_id: uid,
        message_type: 'text',
        body: text,
      },
    ])
    .select(CHAT_MESSAGE_FIELDS)
    .single()
}

export async function sendFileMessage(conversationId, { fileUrl, fileName, fileMime, fileSizeBytes }) {
  const { uid, error: authErr } = await resolveSendActor()
  if (!uid) return { data: null, error: authErr || new Error('未登录') }

  const { ok, conversationId: cid, error: partErr } = await assertConversationParticipant(
    conversationId,
    uid,
  )
  if (!ok) return { data: null, error: partErr || new Error('无权发送') }

  const size =
    fileSizeBytes != null && Number.isFinite(Number(fileSizeBytes))
      ? Math.max(0, Math.floor(Number(fileSizeBytes)))
      : null

  return await supabase
    .from('chat_messages')
    .insert([
      {
        conversation_id: cid,
        sender_id: uid,
        message_type: 'file',
        body: null,
        file_url: fileUrl,
        file_name: fileName,
        file_mime: fileMime || null,
        file_size_bytes: size,
      },
    ])
    .select(CHAT_MESSAGE_FIELDS)
    .single()
}

/**
 * 上传到 resumes 桶，返回可公开访问的 URL（桶需为 public，与迁移一致）
 * @param {File} file
 */
export async function uploadResumeFile(file) {
  const { uid, error: authErr } = await resolveSendActor()
  if (!uid) return { publicUrl: null, path: null, error: authErr || new Error('未登录') }

  const max = 10 * 1024 * 1024
  if (file.size > max) {
    return { publicUrl: null, path: null, error: new Error('文件不能超过 10MB') }
  }

  const path = `${uid}/${Date.now()}_${safeFileName(file.name)}`
  const contentType = file.type || guessMimeFromFileName(file.name) || undefined
  const { error: upErr } = await supabase.storage.from('resumes').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType,
  })
  if (upErr) return { publicUrl: null, path: null, error: upErr }

  const { data: pub } = supabase.storage.from('resumes').getPublicUrl(path)
  return { publicUrl: pub?.publicUrl ?? null, path, error: null }
}

export async function fetchConversationById(conversationId) {
  const { data, error } = await supabase
    .from('chat_conversations')
    .select('id, job_id, seeker_id, recruiter_id, seeker_display_name, employer_display_name, jobs(title)')
    .eq('id', conversationId)
    .maybeSingle()
  if (error || !data) return { data, error }
  const [enriched] = await attachConversationPublicProfiles([data])
  return { data: enriched ?? data, error: null }
}
