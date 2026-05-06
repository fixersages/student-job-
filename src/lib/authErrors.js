/**
 * 将 Supabase Auth 常见英文错误转为可操作的中文说明
 * @param {import('@supabase/supabase-js').AuthError | Error | null | undefined} error
 */
export function describeAuthError(error) {
  if (!error) return '登录失败，请稍后重试。'
  const raw = String(error.message || '')
  const m = raw.toLowerCase()

  if (m.includes('email not confirmed') || m.includes('email_not_confirmed')) {
    return '该邮箱尚未完成验证：请到邮箱（含垃圾箱）点击 Supabase 发来的验证链接后再登录；也可点击下方「重发验证邮件」。'
  }
  if (m.includes('invalid login credentials') || m.includes('invalid credentials')) {
    return '邮箱或密码不正确。若刚完成注册，请先完成邮箱验证；若已验证，请检查大小写与密码是否输入正确。'
  }
  if (m.includes('user already registered') || m.includes('already been registered')) {
    return '该邮箱已被注册，请直接登录或尝试找回密码。'
  }
  if (m.includes('password') && m.includes('least')) {
    return '密码长度不符合要求（通常至少 6 位）。'
  }
  if (m.includes('rate limit') || m.includes('too many requests')) {
    return '请求过于频繁，请稍后再试。'
  }
  return raw || '登录失败，请稍后重试。'
}
