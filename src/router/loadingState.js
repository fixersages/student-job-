import { ref } from 'vue'

/** 路由切换时由 router 钩子驱动，供顶部进度条等 UI 使用 */
export const routeNavigating = ref(false)
