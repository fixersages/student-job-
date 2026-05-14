<script setup>
import { computed, defineAsyncComponent } from 'vue'
import { useRoute } from 'vue-router'
import { Analytics } from '@vercel/analytics/vue'
import { appToastMessage } from '@/lib/toastState'

const Navbar = defineAsyncComponent(() => import('@/components/Navbar.vue'))
const SiteFooter = defineAsyncComponent(() => import('@/components/SiteFooter.vue'))
const AppLoadingBar = defineAsyncComponent(() => import('@/components/AppLoadingBar.vue'))

const route = useRoute()
const isAuthShell = computed(() => route.meta.layout === 'auth')
</script>

<template>
  <div class="flex min-h-screen flex-col bg-slate-50">
    <AppLoadingBar />
    <Navbar v-if="!isAuthShell" />
    <main class="flex-1" :class="isAuthShell ? '' : 'pb-8 pt-0 sm:pb-12'">
      <!-- 不用 fullPath 作 key：query 微调（如大厅 ?job=）会整页卸载导致闪屏；无全页 transition 避免叠化露底 -->
      <router-view v-slot="{ Component }">
        <component :is="Component" :key="route.path" />
      </router-view>
    </main>
    <SiteFooter v-if="!isAuthShell" />
    <Analytics />
    <Teleport to="body">
      <div
        v-if="appToastMessage"
        class="fixed bottom-6 left-1/2 z-[300] max-w-[min(90vw,24rem)] -translate-x-1/2 rounded-[var(--app-radius-lg)] border border-slate-200/90 bg-white px-4 py-3 text-center text-sm font-medium text-slate-800 shadow-xl shadow-slate-900/10 ring-1 ring-slate-900/[0.04]"
        role="status"
      >
        {{ appToastMessage }}
      </div>
    </Teleport>
  </div>
</template>

