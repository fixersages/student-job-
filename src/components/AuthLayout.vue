<template>
  <div class="min-h-[100dvh] bg-slate-50 bg-[length:40px_40px] bg-grid-slate">
    <div class="mx-auto flex min-h-[100dvh] max-w-6xl flex-col lg:flex-row">
      <div
        class="relative flex flex-1 flex-col justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-brand-900 to-indigo-950 px-6 py-12 text-white sm:px-10 lg:max-w-md lg:px-8 lg:py-0 xl:max-w-lg"
      >
        <div
          class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgb(59_130_246/0.22),transparent_55%)]"
        />
        <div class="relative">
          <RouterLink to="/list" class="inline-flex items-center gap-2 rounded-xl text-white/90 transition hover:text-white">
            <span
              class="flex h-10 w-10 items-center justify-center rounded-xl bg-white/12 text-lg font-bold backdrop-blur-sm ring-1 ring-white/15"
              >校</span
            >
            <span class="text-lg font-bold tracking-tight">校兼</span>
          </RouterLink>
          <p class="mt-8 text-xs font-medium uppercase tracking-[0.2em] text-brand-200/90">Campus hiring</p>
          <h2 class="mt-2 text-2xl font-bold leading-snug text-balance sm:text-3xl">
            {{ headline }}
          </h2>
          <p class="mt-4 max-w-sm text-sm leading-relaxed text-slate-300">
            {{ subline }}
          </p>
          <ul class="mt-10 space-y-3 text-sm text-slate-200">
            <li class="flex gap-3">
              <span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300">✓</span>
              <span>结构化职位信息与风险提示，降低信息不对称</span>
            </li>
            <li class="flex gap-3">
              <span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300">✓</span>
              <span>学生与招聘方分端权限，发布与浏览路径清晰</span>
            </li>
            <li class="flex gap-3">
              <span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300">✓</span>
              <span>响应式布局，手机与电脑端一致体验</span>
            </li>
          </ul>
        </div>
      </div>

      <div class="flex flex-1 items-center justify-center px-4 py-10 sm:px-8 lg:py-16">
        <div class="w-full max-w-md">
          <slot />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { RouterLink } from 'vue-router'

defineProps({
  headline: { type: String, required: true },
  subline: { type: String, required: true },
})
</script>
