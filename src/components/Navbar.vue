<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute, RouterLink } from 'vue-router'
import { supabase, signOut } from '@/lib/supabase'

const router = useRouter()
const route = useRoute()
const user = ref(null)
const mobileOpen = ref(false)

const displayName = computed(() => {
  const u = user.value
  if (!u) return ''
  return u.user_metadata?.nickname || u.email?.split('@')[0] || '用户'
})

const navClass = (path) => {
  const active =
    route.path === path || (path !== '/' && route.path.startsWith(path))
  return active
    ? 'text-brand-600 font-semibold'
    : 'text-slate-600 hover:text-brand-600'
}

const getUser = async () => {
  const {
    data: { user: u },
  } = await supabase.auth.getUser()
  user.value = u
}

const logout = async () => {
  await signOut()
  user.value = null
  mobileOpen.value = false
  router.push('/login')
}

onMounted(() => {
  getUser()
  supabase.auth.onAuthStateChange(() => {
    getUser()
  })
})
</script>

<template>
  <header
    class="sticky top-0 z-50 border-b border-slate-200/80 bg-white/85 backdrop-blur-md supports-[backdrop-filter]:bg-white/70"
  >
    <div class="mx-auto flex min-h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:min-h-16 sm:px-6 lg:px-8">
      <RouterLink to="/list" class="flex shrink-0 items-center gap-2.5" @click="mobileOpen = false">
        <span
          class="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-indigo-700 text-sm font-bold text-white shadow-md shadow-brand-600/25"
          >校</span
        >
        <div class="leading-tight">
          <span class="block text-base font-bold tracking-tight text-slate-900 sm:text-lg">校兼</span>
          <span class="hidden text-[11px] font-medium text-slate-500 sm:block">大学生兼职平台</span>
        </div>
      </RouterLink>

      <nav class="hidden items-center gap-1 md:flex md:gap-2">
        <RouterLink to="/list" :class="['rounded-lg px-3 py-2 text-sm transition-colors', navClass('/list')]">
          职位大厅
        </RouterLink>
        <RouterLink
          to="/publish"
          :class="['rounded-lg px-3 py-2 text-sm transition-colors', navClass('/publish')]"
        >
          发布职位
        </RouterLink>
      </nav>

      <div class="hidden items-center gap-3 md:flex">
        <template v-if="user">
          <span
            class="max-w-[140px] truncate rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700"
            >{{ displayName }}</span
          >
          <button
            type="button"
            class="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
            @click="logout"
          >
            退出
          </button>
        </template>
        <template v-else>
          <RouterLink
            to="/login"
            class="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:text-brand-600"
          >
            登录
          </RouterLink>
          <RouterLink
            to="/register"
            class="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-brand-600/25 transition hover:bg-brand-700"
          >
            免费注册
          </RouterLink>
        </template>
      </div>

      <button
        type="button"
        class="inline-flex items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-700 md:hidden"
        aria-label="菜单"
        @click="mobileOpen = !mobileOpen"
      >
        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            v-if="!mobileOpen"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 6h16M4 12h16M4 18h16"
          />
          <path
            v-else
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>

    <div
      v-show="mobileOpen"
      class="border-t border-slate-100 bg-white px-4 py-4 md:hidden"
    >
      <nav class="flex flex-col gap-1">
        <RouterLink to="/list" class="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-800" @click="mobileOpen = false">
          职位大厅
        </RouterLink>
        <RouterLink to="/publish" class="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-800" @click="mobileOpen = false">
          发布职位
        </RouterLink>
        <template v-if="user">
          <span class="px-3 py-2 text-xs text-slate-500">当前：{{ displayName }}</span>
          <button type="button" class="rounded-lg px-3 py-2.5 text-left text-sm text-red-600" @click="logout">
            退出登录
          </button>
        </template>
        <template v-else>
          <RouterLink to="/login" class="rounded-lg px-3 py-2.5 text-sm" @click="mobileOpen = false">登录</RouterLink>
          <RouterLink
            to="/register"
            class="mt-1 rounded-lg bg-brand-600 py-2.5 text-center text-sm font-semibold text-white"
            @click="mobileOpen = false"
          >
            免费注册
          </RouterLink>
        </template>
      </nav>
    </div>
  </header>
</template>
