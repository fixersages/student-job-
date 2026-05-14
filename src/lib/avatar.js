/**
 * 头像工具（纯前端、零外网）：
 * - 自定义图：优先 `user_metadata.avatar_url`（Supabase Storage 等 https 链）。
 * - 默认图：用「用户 id → 邮箱 → 昵称」等解析出的**单一稳定种子**，经哈希展开为渐变角、色相与装饰，
 *   生成 **SVG data URL**；同一账号始终相同，不同种子在常见取值下外观区分度高。
 */

/** FNV-1a 32bit，适合将任意字符串映射为无符号整数 */
export function hashString(str) {
  let h = 2166136261 >>> 0
  const s = String(str ?? '')
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h >>> 0
}

/** 从同一种子派生多路哈希，避免仅靠一次取模导致配色过于接近 */
function expandHash(seed) {
  const s = String(seed || 'guest')
  return {
    h0: hashString(s),
    h1: hashString(`${s}\0a`),
    h2: hashString(`${s}\0b`),
    h3: hashString(`${s}\0c`),
  }
}

/** @param {string} ch */
function escapeXmlText(ch) {
  return String(ch)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * 展示在头像中央的一个字符（尽量用昵称/邮箱前缀；UUID 则用哈希映射到 A–Z）。
 * @param {string} seed 与配色使用同一稳定种子
 */
export function avatarDisplayChar(seed) {
  const s = String(seed || '').trim()
  if (!s) return '?'
  const at = s.indexOf('@')
  if (at > 0) {
    const pre = s.slice(0, at)
    const first = [...pre][0]
    if (first && /\p{L}|\p{N}/u.test(first)) {
      return first.toUpperCase()
    }
  }
  if (/^[0-9a-f-]{36}$/i.test(s)) {
    return String.fromCharCode(65 + (hashString(s) % 26))
  }
  const first = [...s][0]
  if (first && /\p{L}|\p{N}/u.test(first)) {
    return first.toUpperCase()
  }
  return '?'
}

/**
 * 解析默认头像用的**稳定种子**（不参与「改邮箱是否换头像」的歧义：有 id 则只绑 id）。
 *
 * 优先级：`seedUserId`（聊天里仅知对方 uid）→ `user.id` → `user.email` → `user.user_metadata.nickname`
 * → 演示用户 email / nickname → `'guest'`。
 *
 * @param {object} [opts]
 * @param {import('@supabase/supabase-js').User | null} [opts.user]
 * @param {{ avatar_url?: string, email?: string, nickname?: string } | null} [opts.legacyUser]
 * @param {string} [opts.seedUserId]
 */
export function resolveAvatarSeed({ user = null, legacyUser = null, seedUserId = '' } = {}) {
  const sid = String(seedUserId || '').trim()
  if (sid) return sid

  const uid = user?.id != null ? String(user.id).trim() : ''
  if (uid) return uid

  const em = user?.email != null ? String(user.email).trim() : ''
  if (em) return em

  const nick = user?.user_metadata?.nickname
  if (nick != null && String(nick).trim()) return String(nick).trim()

  if (legacyUser && typeof legacyUser === 'object') {
    const le = legacyUser.email != null ? String(legacyUser.email).trim() : ''
    if (le) return le
    const ln = legacyUser.nickname != null ? String(legacyUser.nickname).trim() : ''
    if (ln) return ln
  }

  return 'guest'
}

/**
 * 确定性渐变头像（`data:image/svg+xml,...`），仅依赖本文件算法，无外链。
 * 同一 `seed` 输出逐字节一致；不同 `seed` 通过多路哈希拉开色相、饱和度、渐变角与高光位置。
 *
 * @param {string} seed
 */
export function getGeneratedAvatarDataUrl(seed) {
  const s = String(seed || 'guest')
  const { h0, h1, h2, h3 } = expandHash(s)
  const letter = escapeXmlText(avatarDisplayChar(s))

  const hue1 = h0 % 360
  const hue2 = (h0 * 17 + h1 * 3 + 53) % 360
  const hue3 = (h2 * 11 + h3 + 101) % 360

  const sat1 = 52 + (h1 % 22)
  const sat2 = 44 + ((h1 >>> 7) % 24)
  const sat3 = Math.max(38, sat2 - 8 - (h3 % 6))

  const L1 = 40 + (h2 % 20)
  const L2 = 48 + ((h2 >>> 5) % 18)
  const L3 = 34 + ((h0 >>> 11) % 16)

  const c1 = `hsl(${hue1},${sat1}%,${L1}%)`
  const c2 = `hsl(${hue2},${sat2}%,${L2}%)`
  const c3 = `hsl(${hue3},${sat3}%,${L3}%)`

  const angle = h3 % 360
  const stopMid = 35 + (h1 % 30)

  const rx = 26 + (h2 % 5)

  const spotCx = 22 + (h0 % 44)
  const spotCy = 18 + (h1 % 40)
  const spotR = 20 + (h3 % 26)
  const spotOp = 0.08 + ((h2 >>> 3) % 12) / 100

  const arcOp = 0.06 + ((h1 >>> 2) % 10) / 100

  const gid = `g${(h0 ^ h1 ^ h2).toString(36)}`

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox" gradientTransform="rotate(${angle} 0.5 0.5)">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="${stopMid}%" stop-color="${c2}"/>
      <stop offset="100%" stop-color="${c3}"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="${rx}" fill="url(#${gid})"/>
  <circle cx="${spotCx}" cy="${spotCy}" r="${spotR}" fill="rgba(255,255,255,${spotOp.toFixed(3)})"/>
  <path d="M0 96 Q 64 ${72 + (h3 % 24)} 128 96 L 128 128 L 0 128 Z" fill="rgba(0,0,0,${arcOp.toFixed(3)})"/>
  <text x="64" y="80" text-anchor="middle" font-size="56" font-family="system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-weight="700" fill="rgba(255,255,255,0.94)">${letter}</text>
</svg>`

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/** @param {import('@supabase/supabase-js').User | null | undefined} user */
export function getCustomAvatarUrl(user) {
  const raw = user?.user_metadata?.avatar_url
  if (typeof raw !== 'string') return null
  const url = raw.trim()
  if (!url || !/^https?:\/\//i.test(url)) return null
  return url
}

/**
 * @param {object} opts
 * @param {import('@supabase/supabase-js').User | null} [opts.user]
 * @param {{ avatar_url?: string, email?: string, nickname?: string } | null} [opts.legacyUser]
 * @param {string} [opts.seedUserId] 仅有对方 user id 时用于生成默认头像
 * @param {boolean} [opts.generatedOnly] 忽略自定义图（例如外链加载失败后回退）
 */
export function getAvatarImageSrc({ user = null, legacyUser = null, seedUserId = '', generatedOnly = false } = {}) {
  if (!generatedOnly) {
    const custom = getCustomAvatarUrl(user)
    if (custom) return custom
    const legacyUrl = legacyUser?.avatar_url
    if (typeof legacyUrl === 'string' && /^https?:\/\//i.test(legacyUrl.trim())) {
      return legacyUrl.trim()
    }
  }
  const seed = resolveAvatarSeed({ user, legacyUser, seedUserId })
  return getGeneratedAvatarDataUrl(seed)
}
