import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', redirect: '/list' },
  { path: '/list', component: () => import('@/views/JobList.vue') },
  { path: '/publish', component: () => import('@/views/PublishJob.vue') },
  { path: '/detail/:id', component: () => import('@/views/JobDetail.vue') },
  { path: '/login', component: () => import('@/views/Login.vue') },
  { path: '/register', component: () => import('@/views/Register.vue') },
  { path: '/test', component: () => import('@/views/SupabaseTest.vue') },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

export default router
