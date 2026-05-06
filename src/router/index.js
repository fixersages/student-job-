import { createRouter, createWebHashHistory } from 'vue-router'
import { supabase, getUserRole, USER_ROLE } from '@/lib/supabase'
import { routeNavigating } from '@/router/loadingState'

const routes = [
  { path: '/', redirect: '/list' },
  { path: '/list', name: 'job-list', component: () => import('@/views/JobList.vue') },
  {
    path: '/publish',
    name: 'job-publish',
    component: () => import('@/views/PublishJob.vue'),
    meta: { requiresPublisher: true },
  },
  {
    path: '/detail/:id',
    name: 'job-detail',
    component: () => import('@/views/JobDetail.vue'),
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/Login.vue'),
    meta: { layout: 'auth' },
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/views/Register.vue'),
    meta: { layout: 'auth' },
  },
  {
    path: '/test',
    name: 'supabase-test',
    component: () => import('@/views/SupabaseTest.vue'),
  },
]

// Hash 路由：部署到 Vercel / 任意静态托管时无需服务端 rewrite，链接形态为 /#/list（最省事、最稳）
const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior(_to, _from, savedPosition) {
    if (savedPosition) return savedPosition
    return { top: 0, left: 0 }
  },
})

router.beforeEach(async (to, _from, next) => {
  routeNavigating.value = true
  try {
    if (!to.meta.requiresPublisher) {
      next()
      return
    }
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      next({
        path: '/login',
        query: { redirect: to.fullPath },
      })
      return
    }
    if (getUserRole(user) !== USER_ROLE.PUBLISHER) {
      next({
        path: '/list',
        query: { forbidden: 'publish' },
      })
      return
    }
    next()
  } catch (e) {
    console.error(e)
    next({ path: '/list' })
  }
})

router.afterEach(() => {
  requestAnimationFrame(() => {
    routeNavigating.value = false
  })
})

export default router
