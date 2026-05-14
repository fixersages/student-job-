<template>
  <div class="min-h-[100dvh] bg-slate-100/95 bg-[length:32px_32px] bg-grid-slate">
    <div
      class="mx-auto flex min-h-[100dvh] max-w-6xl flex-col lg:flex-row lg:bg-white lg:shadow-card lg:ring-1 lg:ring-slate-900/[0.04]"
    >
      <div
        class="relative flex flex-1 flex-col justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-6 py-12 text-white sm:px-10 lg:max-w-md lg:px-8 lg:py-14 xl:max-w-lg"
      >
        <div
          class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_80%_at_30%_-10%,rgb(59_130_246/0.18),transparent_50%)]"
        />
        <div class="relative">
          <RouterLink
            to="/list"
            class="inline-flex items-center gap-2.5 rounded-[var(--app-radius)] text-white/90 transition duration-200 hover:text-white"
          >
            <span
              class="flex h-10 w-10 items-center justify-center rounded-[var(--app-radius)] bg-gradient-to-br from-brand-500 to-brand-700 text-lg font-bold text-white shadow-md shadow-black/25 ring-1 ring-white/10"
              >校</span
            >
            <span class="text-lg font-bold tracking-tight">校兼</span>
          </RouterLink>
          <p class="app-section-kicker mt-8 text-brand-200/90">Campus hiring</p>
          <h2 class="mt-2 text-balance text-2xl font-bold leading-snug tracking-tight sm:text-3xl">
            {{ headline }}
          </h2>
          <p class="mt-4 max-w-sm text-sm leading-relaxed text-slate-400">
            {{ subline }}
          </p>
          <ul class="mt-10 space-y-3.5 text-sm text-slate-300">
            <li class="flex gap-3">
              <span
                class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-[11px] font-bold text-emerald-300 ring-1 ring-emerald-400/25"
                >✓</span
              >
              <span>结构化职位信息与风险提示，降低信息不对称</span>
            </li>
            <li class="flex gap-3">
              <span
                class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-[11px] font-bold text-emerald-300 ring-1 ring-emerald-400/25"
                >✓</span
              >
              <span>学生与招聘方分端权限，发布与浏览路径清晰</span>
            </li>
            <li class="flex gap-3">
              <span
                class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-[11px] font-bold text-emerald-300 ring-1 ring-emerald-400/25"
                >✓</span
              >
              <span>响应式布局，手机与电脑端一致体验</span>
            </li>
          </ul>
        </div>
      </div>

      <div
        class="flex flex-1 items-center justify-center border-t border-slate-200/80 bg-slate-50/80 px-4 py-10 sm:px-8 lg:border-l lg:border-t-0 lg:bg-white lg:py-16"
      >
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
