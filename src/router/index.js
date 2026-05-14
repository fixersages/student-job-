
import { createRouter, createWebHashHistory } from 'vue-router'
import { supabase, getUserRole, USER_ROLE } from '@/lib/supabase'
import { routeNavigating } from '@/router/loadingState'

/** 路由级 code-splitting：按业务块命名 chunk，便于缓存与排查体积 */
const routes = [
  { path: '/', redirect: '/list' },
  {
    path: '/list',
    name: 'job-list',
    component: () => import(/* webpackChunkName: "views-job-list" */ '@/views/JobList.vue'),
  },
  {
    path: '/publish',
    name: 'job-publish',
    component: () => import(/* webpackChunkName: "views-job-publish" */ '@/views/PublishJob.vue'),
    meta: { requiresPublisher: true },
  },
  {
    path: '/edit-job/:id',
    name: 'job-edit',
    component: () => import(/* webpackChunkName: "views-job-publish" */ '@/views/PublishJob.vue'),
    meta: { requiresPublisher: true },
  },
  {
    path: '/detail/:id',
    name: 'job-detail',
    component: () => import(/* webpackChunkName: "views-job-detail" */ '@/views/JobDetail.vue'),
  },
  {
    path: '/profile',
    name: 'profile',
    component: () => import(/* webpackChunkName: "views-profile" */ '@/views/Profile.vue'),
  },
  {
    path: '/chat',
    name: 'chat-list',
    component: () => import(/* webpackChunkName: "views-chat" */ '@/views/ChatList.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/chat/:conversationId',
    name: 'chat-room',
    component: () => import(/* webpackChunkName: "views-chat" */ '@/views/ChatRoom.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/login',
    name: 'login',
    component: () => import(/* webpackChunkName: "views-auth" */ '@/views/Login.vue'),
    meta: { layout: 'auth' },
  },
  {
    path: '/register',
    name: 'register',
    component: () => import(/* webpackChunkName: "views-auth" */ '@/views/Register.vue'),
    meta: { layout: 'auth' },
  },
  {
    path: '/test',
    name: 'supabase-test',
    component: () => import(/* webpackChunkName: "views-dev" */ '@/views/SupabaseTest.vue'),
  },
  /** OAuth 偶发把 token 写进 hash 导致被当成路由（如 /access_token=…）；兜底回首页 */
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    redirect: '/',
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
    const needsUser = to.meta.requiresAuth || to.meta.requiresPublisher
    if (!needsUser) {
      next()
      return
    }
    const {
      data: { session },
    } = await supabase.auth.getSession()
    let user = session?.user ?? null
    if (!user) {
      const {
        data: { user: u },
      } = await supabase.auth.getUser()
      user = u ?? null
    }
    if (!user) {
      next({
        path: '/login',
        query: { redirect: to.fullPath },
      })
      return
    }
    if (to.meta.requiresPublisher && getUserRole(user) !== USER_ROLE.PUBLISHER) {
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

/** 从编辑页/详情页回到大厅时，通知 JobList 用最新数据刷新对应卡片（见 JobList 内 `campus:patch-job`） */
router.afterEach((to, from) => {
  if (to.name !== 'job-list') return
  if (from?.name !== 'job-edit' && from?.name !== 'job-detail') return
  const id = from.params?.id
  if (id == null || String(id).trim() === '') return
  window.dispatchEvent(new CustomEvent('campus:patch-job', { detail: { id: String(id) } }))
})

export default router