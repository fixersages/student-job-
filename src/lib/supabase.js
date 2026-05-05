import { createClient } from '@supabase/supabase-js'

const envUrl = import.meta.env.VITE_SUPABASE_URL
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 未配置环境变量时 createClient(undefined, …) 会在模块加载时抛错，页面空白且无挂载。
// 使用占位 URL/key 仅用于通过客户端初始化；真实请求仍需在项目根目录配置 .env 并填入 Supabase 控制台中的值。
const fallbackUrl = 'https://placeholder.supabase.co'
const fallbackKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

if (import.meta.env.DEV && (!envUrl || !envKey)) {
  console.warn(
    '[Supabase] 未检测到 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY，已使用占位配置以便页面能渲染。请在项目根目录创建 .env 并填入真实值后重启 npm run dev。',
  )
}

export const supabase = createClient(envUrl || fallbackUrl, envKey || fallbackKey)

export const signUp = async (email, password, nickname) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { nickname },
    },
  })
  return { data, error }
}

export const signIn = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
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
