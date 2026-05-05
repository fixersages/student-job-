<script setup>
import AppNav from './AppNav.vue'
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <AppNav />
    <main class="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <slot />
    </main>
    <footer class="border-t border-slate-200 bg-white mt-auto">
      <div
        class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-sm text-slate-500"
      >
        校兼 · 仅供学习演示 · 求职请注意甄别信息真伪
      </div>
    </footer>
  </div>
</template>
