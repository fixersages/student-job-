<script setup>
import { computed } from 'vue'
import { useRoute, RouterLink } from 'vue-router'

const route = useRoute()

const isLoggedIn = computed(() => {
  return localStorage.getItem('campus_pt_user') !== null
})

const displayName = computed(() => {
  try {
    const raw = localStorage.getItem('campus_pt_user')
    if (!raw) return ''
    const u = JSON.parse(raw)
    return u.nickname || u.email?.split('@')[0] || '用户'
  } catch {
    return ''
  }
})

function logout() {
  localStorage.removeItem('campus_pt_user')
  window.location.href = '/'
}

const navLink =
  'text-slate-600 hover:text-brand-600 transition-colors text-sm font-medium'
const active = (path) =>
  route.path === path || (path !== '/' && route.path.startsWith(path))
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex h-16 items-center justify-between gap-4">
        <RouterLink to="/" class="flex items-center gap-2 shrink-0">
          <span
            class="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white font-bold text-sm"
            >校</span
          >
          <span class="font-semibold text-slate-900 hidden sm:inline">校兼</span>
        </RouterLink>

        <nav class="hidden md:flex items-center gap-8">
          <RouterLink :class="[navLink, active('/') && 'text-brand-600']" to="/"
            >兼职列表</RouterLink
          >
          <RouterLink
            :class="[navLink, active('/publish') && 'text-brand-600']"
            to="/publish"
            >发布兼职</RouterLink
          >
          <RouterLink
            :class="[navLink, active('/profile') && 'text-brand-600']"
            to="/profile"
            >个人中心</RouterLink
          >
        </nav>

        <div class="flex items-center gap-2 sm:gap-3">
          <template v-if="isLoggedIn">
            <span class="text-sm text-slate-600 hidden sm:inline max-w-[120px] truncate">{{
              displayName
            }}</span>
            <button
              type="button"
              class="text-sm text-slate-500 hover:text-slate-800 px-2 py-1.5 rounded-lg"
              @click="logout"
            >
              退出
            </button>
          </template>
          <template v-else>
            <RouterLink
              to="/login"
              class="text-sm font-medium text-slate-600 hover:text-brand-600 px-3 py-2"
              >登录</RouterLink
            >
            <RouterLink
              to="/register"
              class="text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 px-4 py-2 rounded-lg shadow-sm"
              >注册</RouterLink
            >
          </template>
        </div>
      </div>

      <nav
        class="md:hidden flex gap-4 pb-3 border-t border-slate-100 pt-3 -mx-4 px-4 text-xs"
      >
        <RouterLink :class="[navLink, active('/') && 'text-brand-600']" to="/">列表</RouterLink>
        <RouterLink
          :class="[navLink, active('/publish') && 'text-brand-600']"
          to="/publish"
          >发布</RouterLink
        >
        <RouterLink
          :class="[navLink, active('/profile') && 'text-brand-600']"
          to="/profile"
          >我的</RouterLink
        >
      </nav>
    </div>
  </header>
</template>
