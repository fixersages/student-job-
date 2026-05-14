import { ref } from 'vue'

/** 根组件挂载的全局 Toast 文案；空字符串表示不显示 */
export const appToastMessage = ref('')

let hideTimer = 0

/**
 * 非阻塞全局提示（不依赖当前页面是否卸载）
 * @param {string} text
 * @param {number} [durationMs]
 */
export function showAppToast(text, durationMs = 2800) {
  const t = String(text ?? '').trim() || '已完成'
  appToastMessage.value = t
  if (typeof window === 'undefined') return
  window.clearTimeout(hideTimer)
  hideTimer = window.setTimeout(() => {
    appToastMessage.value = ''
    hideTimer = 0
  }, Math.max(1200, durationMs))
}
