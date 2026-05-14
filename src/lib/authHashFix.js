/**
 * Google 等 OAuth 隐式回调若落在 `#/access_token=...`：
 * - Vue Router 会把 `/access_token=…` 当成路由，页面空白；
 * - GoTrue 用 URLSearchParams 解析 `#/access_token` 会失败，会话无法写入。
 * 规范为 `#access_token=...` 后 replace，下一跳由 Supabase 正常解析并清空 hash。
 */
if (typeof window !== 'undefined') {
  const h = window.location.hash
  if (
    h.startsWith('#/') &&
    (h.includes('access_token=') || h.includes('refresh_token=') || h.includes('error='))
  ) {
    const fixed = '#' + h.slice(2)
    window.location.replace(
      `${window.location.origin}${window.location.pathname}${window.location.search}${fixed}`,
    )
  }
}
