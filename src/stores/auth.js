import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase, signOut as supabaseSignOut } from '@/lib/supabase'

/**
 * 全局登录态：与 Supabase Auth 同步（会话由 Supabase 持久化到 localStorage，刷新后 hydrate 即可恢复）。
 */
export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const session = ref(null)
  /** 是否已完成首次从 Supabase 拉取会话（避免导航栏先闪「未登录」） */
  const ready = ref(false)

  const isLoggedIn = computed(() => !!user.value)

  function applySession(s) {
    session.value = s ?? null
    user.value = s?.user ?? null
  }

  /**
   * 首屏从 Supabase 恢复会话（刷新后保持登录态）。
   */
  async function hydrateFromSupabase() {
    const {
      data: { session: sess },
    } = await supabase.auth.getSession()
    applySession(sess)
    if (!user.value) {
      const {
        data: { user: u },
      } = await supabase.auth.getUser()
      user.value = u ?? null
    }
    ready.value = true
  }

  async function signOutUser() {
    await supabaseSignOut()
    applySession(null)
  }

  return {
    user,
    session,
    ready,
    isLoggedIn,
    applySession,
    hydrateFromSupabase,
    signOutUser,
  }
})
