<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Analytics } from '@vercel/analytics/vue'
import Navbar from '@/components/Navbar.vue'
import SiteFooter from '@/components/SiteFooter.vue'
import AppLoadingBar from '@/components/AppLoadingBar.vue'

const route = useRoute()
const isAuthShell = computed(() => route.meta.layout === 'auth')
</script>

<template>
  <div class="flex min-h-screen flex-col bg-slate-50">
    <AppLoadingBar />
    <Navbar v-if="!isAuthShell" />
    <main class="flex-1" :class="isAuthShell ? '' : 'pb-6 pt-0 sm:pb-10'">
      <router-view v-slot="{ Component }">
        <transition name="page" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
    <SiteFooter v-if="!isAuthShell" />
    <Analytics />
  </div>
</template>

<style>
.page-enter-active,
.page-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}
.page-enter-from,
.page-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

@media (prefers-reduced-motion: reduce) {
  .page-enter-active,
  .page-leave-active {
    transition: opacity 0.15s ease;
  }
  .page-enter-from,
  .page-leave-to {
    transform: none;
  }
}
</style>
