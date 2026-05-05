import { supabase } from '@/lib/supabase'

// 邮箱密码注册
export const register = async (email, password) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password
  })
  return { data, error }
}

// 邮箱密码登录
export const login = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })
  return { data, error }
}

// 退出登录
export const logout = async () => {
  const { error } = await supabase.auth.signOut()
  return { error }
}