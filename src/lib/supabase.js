import { createClient } from '@supabase/supabase-js'

/** 注册时写入 auth.users.user_metadata.role，前端权限与发布入口均据此判断 */
export const USER_ROLE = {
  STUDENT: 'student',
  PUBLISHER: 'publisher',
}

const envUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

if (!envUrl || !envKey) {
  const hint =
    '请复制 .env.example 为 .env 并填写 VITE_SUPABASE_URL、VITE_SUPABASE_ANON_KEY；在 Vercel 项目 Settings → Environment Variables 中也要配置（Production / Preview）。'
  throw new Error(`[Supabase] 缺少环境变量：${hint}`)
}

/**
 * 不在仓库中写死任何密钥；构建与运行均依赖环境变量，避免误连他人项目或泄露 anon key。
 * 使用默认选项即可；若需持久会话可再传 auth: { persistSession, storage }。
 */
export const supabase = createClient(envUrl, envKey)

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

export const getCategoryList = async () => {
  const { data, error } = await supabase
    .from('job_category')
    .select('*')
    .order('sort', { ascending: true })
  return { data, error }
}
