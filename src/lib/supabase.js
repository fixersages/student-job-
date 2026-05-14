import './authHashFix.js'
import { createClient } from '@supabase/supabase-js'
import { supabaseFetch } from '@/lib/supabaseFetch'

/** 注册时写入 auth.users.user_metadata.role，前端权限与发布入口均据此判断 */
export const USER_ROLE = {
  STUDENT: 'student',
  PUBLISHER: 'publisher',
}

/**
 * 规范化项目 URL：避免混合内容、尾部斜杠、以及误把 REST 路径写进根地址（会导致 Auth 请求失败 → Failed to fetch）
 */
function normalizeSupabaseUrl(url) {
  let u = String(url ?? '').trim().replace(/\/+$/, '')
  if (!u) return u
  // 常见误填：https://xxx.supabase.co/rest/v1 或 /rest/v1/ — 应只保留项目根域名
  u = u.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '')
  if (u.startsWith('http://') && u.includes('supabase.co')) {
    u = `https://${u.slice('http://'.length)}`
  }
  return u
}

const envUrl = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL)
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

if (!envUrl || !envKey) {
  const hint =
    '请复制 .env.example 为 .env 并填写 VITE_SUPABASE_URL、VITE_SUPABASE_ANON_KEY；在 Vercel 项目 Settings → Environment Variables 中也要配置（Production / Preview）。'
  throw new Error(`[Supabase] 缺少环境变量：${hint}`)
}

/**
 * 不在仓库中写死任何密钥；构建与运行均依赖环境变量，避免误连他人项目或泄露 anon key。
 * PKCE：OAuth 回调使用 ?code=，避免与 Vue Hash 路由的 #/ 冲突（隐式 #/access_token= 会白屏且无法建会话）。
 */
export const supabase = createClient(envUrl, envKey, {
  global: { fetch: supabaseFetch },
  auth: {
    flowType: 'pkce',
    detectSessionInUrl: true,
  },
})

/** 线上正式环境首页（OAuth 回调须与 Supabase Redirect URLs 中配置一致，且不要带 #/ 路径） */
const OAUTH_REDIRECT_PRODUCTION_ORIGIN = 'https://student-job-three.vercel.app'

/**
 * 第三方 OAuth 回调根地址（须加入 Supabase → Authentication → URL Configuration → Redirect URLs）
 * 优先级：VITE_AUTH_REDIRECT_URL → 开发环境当前 origin → 生产构建默认线上域名
 */
export function getOAuthRedirectTo() {
  const fromEnv = import.meta.env.VITE_AUTH_REDIRECT_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/+$/, '') || undefined
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    return window.location.origin.replace(/\/+$/, '') || undefined
  }
  return OAUTH_REDIRECT_PRODUCTION_ORIGIN
}

/**
 * @param {'google' | 'github'} provider
 * @returns {Promise<{ data: { provider: string; url: string } | null; error: import('@supabase/supabase-js').AuthError | null }>}
 */
export async function signInWithOAuthProvider(provider) {
  const redirectTo = getOAuthRedirectTo()
  return supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
    },
  })
}

/**
 * @param {string} role - USER_ROLE.STUDENT | USER_ROLE.PUBLISHER
 */
export const signUp = async (email, password, nickname, role = USER_ROLE.STUDENT) => {
  const safeRole =
    role === USER_ROLE.PUBLISHER ? USER_ROLE.PUBLISHER : USER_ROLE.STUDENT
  const emailRedirectTo =
    typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}#/login` : undefined
  const { data, error } = await supabase.auth.signUp({
    email: String(email).trim(),
    password,
    options: {
      data: { nickname, role: safeRole },
      emailRedirectTo,
    },
  })
  return { data, error }
}

/** 重发注册验证邮件（需在 Supabase 开启邮箱注册且未关闭「Confirm email」时才有意义） */
export const resendSignupEmail = async (email) => {
  return supabase.auth.resend({
    type: 'signup',
    email: String(email).trim(),
    options:
      typeof window !== 'undefined'
        ? { emailRedirectTo: `${window.location.origin}${window.location.pathname}#/login` }
        : undefined,
  })
}

/** @param {import('@supabase/supabase-js').User | null} user */
export function getUserRole(user) {
  if (!user) return null
  const r = user.user_metadata?.role
  if (r === USER_ROLE.PUBLISHER) return USER_ROLE.PUBLISHER
  if (r === USER_ROLE.STUDENT) return USER_ROLE.STUDENT
  // 历史账号未写 role 时，按学生处理（不可发布，避免误开放）
  return USER_ROLE.STUDENT
}

/** @param {import('@supabase/supabase-js').User | null} user */
export function isPublisher(user) {
  return getUserRole(user) === USER_ROLE.PUBLISHER
}

/** @param {import('@supabase/supabase-js').User | null} user */
export function isStudent(user) {
  return getUserRole(user) === USER_ROLE.STUDENT
}

export const signIn = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: String(email).trim(),
    password,
  })
  return { data, error }
}

export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  return { error }
}

export const getCurrentUser = async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

/**
 * 合并更新当前登录用户的 `user_metadata`。
 * 会忽略 patch 中的 `role`，并按当前账号实际身份写回 `role`，避免客户端越权改为招聘方。
 *
 * @param {Record<string, unknown>} patch
 * @returns {Promise<{ data: import('@supabase/supabase-js').UserResponse | null; error: import('@supabase/supabase-js').AuthError | null }>}
 */
export async function patchUserMetadata(patch) {
  const {
    data: { user },
    error: guErr,
  } = await supabase.auth.getUser()
  if (guErr || !user) {
    return { data: null, error: guErr ?? Object.assign(new Error('未登录'), { name: 'AuthSessionMissingError' }) }
  }
  const { role: _dropRole, ...rest } = patch && typeof patch === 'object' ? patch : {}
  const base = { ...(user.user_metadata || {}) }
  const merged = { ...base, ...rest }
  merged.role =
    getUserRole(user) === USER_ROLE.PUBLISHER ? USER_ROLE.PUBLISHER : USER_ROLE.STUDENT
  return supabase.auth.updateUser({ data: merged })
}

export const getCategoryList = async () => {
  const { data, error } = await supabase
    .from('job_category')
    .select('id,name,sort')
    .order('sort', { ascending: true })
  return { data, error }
}
