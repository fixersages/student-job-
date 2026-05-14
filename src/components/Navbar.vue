<script setup>
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter, useRoute, RouterLink } from 'vue-router'
import { isPublisher } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import UserAvatar from '@/components/UserAvatar.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const { user, ready } = storeToRefs(authStore)
const mobileOpen = ref(false)

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
    ? 'border-b-2 border-brand-400 pb-3 text-sm font-semibold text-white'
    : 'border-b-2 border-transparent pb-3 text-sm font-medium text-white/75 transition duration-200 hover:text-white'
}

const logout = async () => {
  await authStore.signOutUser()
  mobileOpen.value = false
  router.push('/login')
}
</script>

<template>
  <header
    class="sticky top-0 z-50 border-b border-slate-900/20 bg-slate-950 text-white shadow-nav backdrop-blur-md supports-[backdrop-filter]:bg-slate-950/92"
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
          class="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white shadow-md shadow-brand-900/30 ring-1 ring-white/10"
          >校</span
        >
        <div class="leading-tight">
          <span class="block text-base font-bold tracking-tight text-white sm:text-lg">校兼</span>
          <span class="hidden text-[11px] font-medium text-slate-400 sm:block">校园兼职 · 合规招聘</span>
        </div>
      </RouterLink>

      <nav class="hidden h-[3.25rem] items-end gap-5 md:flex lg:gap-6">
        <RouterLink to="/list" :class="navClass('/list')"> 职位大厅 </RouterLink>
        <RouterLink
          v-if="ready && user"
          to="/chat"
          :class="navClass('/chat')"
        >
          我的聊天
        </RouterLink>
        <RouterLink to="/profile" :class="navClass('/profile')"> 个人中心 </RouterLink>
        <template v-if="!ready">
          <span class="inline-block min-w-[5.5rem] border-b-2 border-transparent pb-3 select-none" aria-hidden="true"
            >&nbsp;</span
          >
        </template>
        <RouterLink
          v-else-if="!user || isPublisherUser"
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
        <template v-if="!ready">
          <span class="h-9 w-24 animate-pulse rounded-md bg-white/10" aria-hidden="true" />
        </template>
        <template v-else-if="user">
          <UserAvatar :user="user" size-class="h-9 w-9" ring-class="ring-2 ring-white/25" />
          <span
            class="hidden max-w-[120px] truncate rounded-md bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-200 ring-1 ring-white/10 lg:inline-block lg:max-w-[140px]"
            >{{ displayName }}</span
          >
          <span
            class="rounded-md px-2.5 py-1 text-[11px] font-semibold tracking-wide ring-1 ring-white/10"
            :class="isPublisherUser ? 'bg-violet-500/15 text-violet-200' : 'bg-emerald-500/15 text-emerald-200'"
            >{{ roleLabel }}</span
          >
          <button
            type="button"
            class="rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-slate-100 transition duration-200 hover:bg-white/10"
            @click="logout"
          >
            退出
          </button>
        </template>
        <template v-else>
          <RouterLink
            to="/login"
            class="rounded-md border border-white/20 px-3 py-2 text-sm font-semibold text-white transition duration-200 hover:bg-white/10"
          >
            登入
          </RouterLink>
          <RouterLink
            to="/register"
            class="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-black/20 transition duration-200 hover:bg-brand-500"
          >
            免费注册
          </RouterLink>
        </template>
      </div>

      <button
        type="button"
        class="inline-flex items-center justify-center rounded-md border border-white/15 bg-white/5 p-2 text-white transition duration-200 hover:bg-white/10 md:hidden"
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
        class="border-t border-white/10 bg-slate-950/98 px-4 py-4 shadow-inner md:hidden"
      >
        <nav class="flex flex-col gap-1">
          <RouterLink
            to="/list"
            class="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-100 transition duration-200 hover:bg-white/10"
            @click="mobileOpen = false"
          >
            职位大厅
          </RouterLink>
          <RouterLink
            v-if="ready && user"
            to="/chat"
            class="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-100 transition duration-200 hover:bg-white/10"
            @click="mobileOpen = false"
          >
            我的聊天
          </RouterLink>
          <RouterLink
            to="/profile"
            class="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-100 transition duration-200 hover:bg-white/10"
            @click="mobileOpen = false"
          >
            个人中心
          </RouterLink>
          <template v-if="!ready">
            <div class="rounded-lg px-3 py-2.5">
              <span class="block h-5 animate-pulse rounded bg-white/10" aria-hidden="true" />
            </div>
          </template>
          <RouterLink
            v-else-if="!user || isPublisherUser"
            to="/publish"
            class="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-100 transition duration-200 hover:bg-white/10"
            @click="mobileOpen = false"
          >
            发布职位
          </RouterLink>
          <RouterLink
            v-else
            to="/register?role=publisher"
            class="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-100 transition duration-200 hover:bg-white/10"
            @click="mobileOpen = false"
          >
            招聘方入驻
          </RouterLink>
          <template v-if="!ready">
            <div class="px-3 py-2">
              <span class="block h-10 animate-pulse rounded-lg bg-white/10" aria-hidden="true" />
            </div>
          </template>
          <template v-else-if="user">
            <div class="flex items-center gap-2.5 px-3 py-2">
              <UserAvatar :user="user" size-class="h-10 w-10" ring-class="ring-2 ring-white/25" />
              <span class="text-xs text-white/80">当前：{{ displayName }}（{{ roleLabel }}）</span>
            </div>
            <button
              type="button"
              class="rounded-xl px-3 py-2.5 text-left text-sm font-medium text-rose-300 transition hover:bg-white/5"
              @click="logout"
            >
              退出登录
            </button>
          </template>
          <template v-else-if="ready">
            <RouterLink
              to="/login"
              class="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-100 transition duration-200 hover:bg-white/10"
              @click="mobileOpen = false"
              >登入</RouterLink
            >
            <RouterLink
              to="/register"
              class="mt-1 rounded-lg bg-brand-600 py-2.5 text-center text-sm font-semibold text-white shadow-md transition duration-200 hover:bg-brand-500"
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
