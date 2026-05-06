<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter, useRoute, RouterLink } from 'vue-router'
import { supabase, signOut, isPublisher } from '@/lib/supabase'

const router = useRouter()
const route = useRoute()
const user = ref(null)
const mobileOpen = ref(false)

let authSubscription = null

const displayName = computed(() => {
  const u = user.value
  if (!u) return ''
  return u.user_metadata?.nickname || u.email?.split('@')[0] || '用户'
})

const isPublisherUser = computed(() => !!(user.value && isPublisher(user.value)))

const roleLabel = computed(() => {
  if (!user.value) return ''
  return isPublisher(user.value) ? '招聘方' : '学生'
})

const navClass = (path) => {
  const active = route.path === path || (path !== '/' && route.path.startsWith(path))
  return active
    ? 'border-b-2 border-accent-400 pb-3 text-sm font-semibold text-white'
    : 'border-b-2 border-transparent pb-3 text-sm font-medium text-white/70 transition hover:text-white'
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
  const { data } = supabase.auth.onAuthStateChange(() => {
    getUser()
  })
  authSubscription = data.subscription
})

onUnmounted(() => {
  authSubscription?.unsubscribe()
  authSubscription = null
})
</script>

<template>
  <header
    class="sticky top-0 z-50 border-b border-navy-800 bg-navy-900 text-white shadow-nav backdrop-blur-md"
  >
    <div
      class="mx-auto flex min-h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:min-h-[3.25rem] sm:gap-4 sm:px-6 lg:px-8"
    >
      <RouterLink
        to="/list"
        class="group flex shrink-0 items-center gap-2.5 rounded-lg py-1 outline-none transition hover:opacity-90"
        @click="mobileOpen = false"
      >
        <span
          class="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-accent-500 to-accent-700 text-sm font-bold text-white shadow-lg shadow-accent-600/30"
          >校</span
        >
        <div class="leading-tight">
          <span class="block text-base font-bold tracking-tight text-white sm:text-lg">校兼</span>
          <span class="hidden text-[11px] font-medium text-sky-200/90 sm:block">JobsDB 风格 · 校园兼职</span>
        </div>
      </RouterLink>

      <nav class="hidden h-[3.25rem] items-end gap-6 md:flex">
        <RouterLink to="/list" :class="navClass('/list')"> 职位搜索 </RouterLink>
        <RouterLink
          v-if="!user || isPublisherUser"
          to="/publish"
          :class="navClass('/publish')"
        >
          发布职位
        </RouterLink>
        <RouterLink
          v-else
          to="/register?role=publisher"
          class="border-b-2 border-transparent pb-3 text-sm font-medium text-white/70 transition hover:text-white"
        >
          招聘方入驻
        </RouterLink>
      </nav>

      <div class="hidden items-center gap-2 md:flex md:gap-3">
        <template v-if="user">
          <span
            class="hidden max-w-[120px] truncate rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-white/90 lg:inline-block lg:max-w-[140px]"
            >{{ displayName }}</span
          >
          <span
            class="rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide"
            :class="isPublisherUser ? 'bg-violet-400/25 text-violet-100' : 'bg-emerald-400/20 text-emerald-100'"
            >{{ roleLabel }}</span
          >
          <button
            type="button"
            class="rounded-lg border border-white/25 bg-white/5 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/15"
            @click="logout"
          >
            退出
          </button>
        </template>
        <template v-else>
          <RouterLink
            to="/login"
            class="rounded-lg border border-white/40 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            登入
          </RouterLink>
          <RouterLink
            to="/register"
            class="rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-accent-600/30 transition hover:bg-accent-600"
          >
            免费注册
          </RouterLink>
        </template>
      </div>

      <button
        type="button"
        class="inline-flex items-center justify-center rounded-lg border border-white/20 bg-white/5 p-2 text-white transition hover:bg-white/10 md:hidden"
        aria-label="打开菜单"
        :aria-expanded="mobileOpen"
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

    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-1"
    >
      <div
        v-show="mobileOpen"
        class="border-t border-white/10 bg-navy-950 px-4 py-4 shadow-inner md:hidden"
      >
        <nav class="flex flex-col gap-1">
          <RouterLink
            to="/list"
            class="rounded-xl px-3 py-2.5 text-sm font-medium text-white/90 transition hover:bg-white/10"
            @click="mobileOpen = false"
          >
            职位搜索
          </RouterLink>
          <RouterLink
            v-if="!user || isPublisherUser"
            to="/publish"
            class="rounded-xl px-3 py-2.5 text-sm font-medium text-white/90 transition hover:bg-white/10"
            @click="mobileOpen = false"
          >
            发布职位
          </RouterLink>
          <RouterLink
            v-else
            to="/register?role=publisher"
            class="rounded-xl px-3 py-2.5 text-sm font-medium text-white/90 transition hover:bg-white/10"
            @click="mobileOpen = false"
          >
            招聘方入驻
          </RouterLink>
          <template v-if="user">
            <span class="px-3 py-2 text-xs text-white/60">当前：{{ displayName }}（{{ roleLabel }}）</span>
            <button
              type="button"
              class="rounded-xl px-3 py-2.5 text-left text-sm font-medium text-rose-300 transition hover:bg-white/5"
              @click="logout"
            >
              退出登录
            </button>
          </template>
          <template v-else>
            <RouterLink
              to="/login"
              class="rounded-xl px-3 py-2.5 text-sm text-white/90 transition hover:bg-white/10"
              @click="mobileOpen = false"
              >登入</RouterLink
            >
            <RouterLink
              to="/register"
              class="mt-1 rounded-xl bg-accent-500 py-2.5 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-accent-600"
              @click="mobileOpen = false"
            >
              免费注册
            </RouterLink>
          </template>
        </nav>
      </div>
    </Transition>
  </header>
</template>
