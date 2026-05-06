/**
 * 职位封面图：优先使用库表字段 cover_image / banner_url（https），否则按 id 轮换高质量占位图。
 * 在 Supabase 为 part_time 增加可空的 text 列 cover_image 后，发布页填写的链接会在此生效。
 */
const CURATED_BANNERS = [
  'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1400&q=80',
]

function isHttpUrl(s) {
  return typeof s === 'string' && /^https?:\/\//i.test(s.trim())
}

/**
 * @param {Record<string, unknown> | null | undefined} job
 * @returns {string}
 */
export function resolveJobBanner(job) {
  if (!job) return CURATED_BANNERS[0]
  const custom = job.cover_image || job.banner_url
  if (isHttpUrl(custom)) return String(custom).trim()
  const seed = Number(job.id ?? job.category_id ?? 0)
  return CURATED_BANNERS[Math.abs(seed) % CURATED_BANNERS.length]
}
