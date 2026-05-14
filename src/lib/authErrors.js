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
  if (
    m.includes('provider is not enabled') ||
    m.includes('unsupported provider') ||
    (m.includes('provider') && m.includes('invalid'))
  ) {
    return '该第三方登录方式尚未在后台开启或配置不完整：请改用邮箱密码登录，或由管理员在 Supabase 的 Authentication → Providers 中启用并填写 Client ID / Secret。'
  }
  if (
    m.includes('authretryablefetcherror') ||
    m.includes('failed to fetch') ||
    m.includes('networkerror') ||
    m.includes('network request failed') ||
    m.includes('network request was') ||
    m.includes('load failed') ||
    m.includes('fetcherror') ||
    m.includes('net::err') ||
    m.includes('err_connection') ||
    m.includes('err_name_not_resolved') ||
    m.includes('blocked by client') ||
    m.includes('signal is aborted') ||
    m.includes('timeout') ||
    m.includes('cors') ||
    m.includes('access-control')
  ) {
    return (
      '无法连上 Supabase（请求未成功到达服务器）。若控制台有 net::ERR_CONNECTION_CLOSED 或 ERR_TIMED_OUT，多为网络或运营商拦截，应用代码无法替代「能连上」的网络。请按顺序排查：' +
      '① 换手机热点 / 家用 Wi‑Fi / 关闭代理或 VPN 对比（校园网常拦截海外域名）。' +
      '② 本地 .env 中 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 是否与 Supabase → Settings → API 一致；改后重启 npm run dev。' +
      '③ URL 只能是 https://你的ref.supabase.co 根地址，不要带 /rest/v1。' +
      '④ 确认 Supabase 项目未 Paused；长期需稳定访问可考虑 Supabase Custom Domain 或合规代理。' +
      '⑤ 线上环境在 Vercel 配好变量后需重新 Deploy。'
    )
  }
  return raw || '操作失败，请稍后重试。'
}
