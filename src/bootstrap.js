import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabase'
import { syncCampusPublicProfileFromUser } from '@/api/publicProfile'
import './style.css'

const pinia = createPinia()
const app = createApp(App)

app.use(pinia)
app.use(router)

const authStore = useAuthStore()

function registerAuthListener() {
  supabase.auth.onAuthStateChange(async (event, session) => {
    authStore.applySession(session)

    if (event === 'SIGNED_IN' && session?.user) {
      void syncCampusPublicProfileFromUser(session.user).then(({ error }) => {
        if (error) console.warn('[auth] campus profile sync', error.message ?? error)
      })
    }

    await router.isReady()

    if (!session?.user || (event !== 'SIGNED_IN' && event !== 'INITIAL_SESSION')) {
      return
    }

    const pending = sessionStorage.getItem('campus_oauth_redirect')
    if (
      pending &&
      typeof pending === 'string' &&
      pending.startsWith('/') &&
      !pending.startsWith('//')
    ) {
      sessionStorage.removeItem('campus_oauth_redirect')
      await router.replace(pending)
      return
    }

    const path = router.currentRoute.value.path
    if (path === '/login' || path === '/register') {
      const q = router.currentRoute.value.query.redirect
      const target =
        typeof q === 'string' && q.startsWith('/') && !q.startsWith('//') ? q : '/list'
      await router.replace(target)
    }
  })
}

void authStore.hydrateFromSupabase().then(() => {
  app.mount('#app')
  registerAuthListener()
})
