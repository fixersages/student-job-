import { supabase } from '@/lib/supabase'

export const AVATARS_BUCKET = 'avatars'

const MAX_BYTES = 2 * 1024 * 1024
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

/**
 * 上传当前用户头像（覆盖同 uid 下同一扩展名路径，便于公链稳定）。
 * @param {File} file
 * @returns {Promise<{ publicUrl: string, path: string }>}
 */
export async function uploadMyAvatar(file) {
  if (!file) {
    throw Object.assign(new Error('请选择图片文件'), { name: 'ValidationError' })
  }
  if (!ALLOWED.has(file.type)) {
    throw Object.assign(new Error('仅支持 JPG、PNG、WebP、GIF'), { name: 'ValidationError' })
  }
  if (file.size > MAX_BYTES) {
    throw Object.assign(new Error('图片大小不能超过 2MB'), { name: 'ValidationError' })
  }
  const {
    data: { user },
    error: guErr,
  } = await supabase.auth.getUser()
  if (guErr || !user?.id) {
    throw guErr ?? Object.assign(new Error('请先登录'), { name: 'AuthSessionMissingError' })
  }
  const ext =
    file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : file.type === 'image/gif' ? 'gif' : 'jpg'
  const path = `${user.id}/avatar.${ext}`
  const { error: upErr } = await supabase.storage.from(AVATARS_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type,
    cacheControl: '3600',
  })
  if (upErr) throw upErr
  const { data: pub } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path)
  const publicUrl = pub?.publicUrl
  if (!publicUrl) {
    throw Object.assign(new Error('无法生成头像访问地址'), { name: 'StorageUrlError' })
  }
  return { publicUrl, path }
}
