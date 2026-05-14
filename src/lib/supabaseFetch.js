/**
 * Supabase 客户端使用的 fetch：弱网/偶发断连时自动重试几次。
 * 说明：若环境长期拦截 *.supabase.co（控制台常见 net::ERR_CONNECTION_CLOSED），重试无法根治，需换网络、VPN、手机热点，或在 Supabase 配置 Custom Domain。
 *
 * @param {RequestInfo|URL} url
 * @param {RequestInit} [init]
 */
export async function supabaseFetch(url, init) {
  const attempts = 3
  let lastErr
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetch(url, init)
    } catch (e) {
      lastErr = e
      const msg = String(e?.message || e || '').toLowerCase()
      if (/abort/i.test(msg)) throw e
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 400 * (i + 1)))
      }
    }
  }
  throw lastErr
}
