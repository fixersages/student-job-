<script setup>
import { computed } from 'vue'
import { routeNavigating } from '@/router/loadingState'

const active = computed(() => routeNavigating.value)
</script>

<template>
  <div
    aria-hidden="true"
    class="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px] overflow-hidden transition-opacity duration-200"
    :class="active ? 'opacity-100' : 'opacity-0'"
  >
    <div
      class="loading-bar-indeterminate h-full w-full bg-gradient-to-r from-brand-400 via-brand-600 to-indigo-500"
      :class="{ 'loading-bar-running': active }"
    />
  </div>
</template>

<style scoped>
.loading-bar-indeterminate {
  transform-origin: 0 50%;
  animation: route-bar 1.1s ease-in-out infinite;
  animation-play-state: paused;
}

.loading-bar-running {
  animation-play-state: running;
}

@keyframes route-bar {
  0% {
    transform: translateX(-70%) scaleX(0.35);
  }
  50% {
    transform: translateX(20%) scaleX(0.85);
  }
  100% {
    transform: translateX(120%) scaleX(0.35);
  }
}

@media (prefers-reduced-motion: reduce) {
  .loading-bar-indeterminate {
    animation: none;
    transform: none;
    opacity: 0.85;
  }
}
</style>
