<template>
  <div class="min-h-[calc(100vh-4rem)] bg-slate-50 bg-[length:48px_48px] bg-grid-slate">
    <div class="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col lg:flex-row">
      <div
        class="relative flex flex-1 flex-col justify-center overflow-hidden bg-gradient-to-br from-brand-700 via-brand-800 to-slate-900 px-8 py-14 text-white lg:max-w-md lg:py-0 xl:max-w-lg"
      >
        <div
          class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.12),transparent_45%)]"
        />
        <div class="relative">
          <div class="flex items-center gap-2">
            <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-lg font-bold backdrop-blur"
              >校</span
            >
            <span class="text-xl font-bold tracking-tight">校兼</span>
          </div>
          <p class="mt-6 text-sm font-medium uppercase tracking-widest text-brand-200/90">Trusted campus hiring</p>
          <h2 class="mt-2 text-2xl font-bold leading-tight text-balance xl:text-3xl">
            {{ headline }}
          </h2>
          <p class="mt-4 max-w-sm text-sm leading-relaxed text-slate-300">
            {{ subline }}
          </p>
          <ul class="mt-8 space-y-3 text-sm text-slate-200">
            <li class="flex items-center gap-2">
              <span class="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">✓</span>
              结构化职位卡片与联系方式展示
            </li>
            <li class="flex items-center gap-2">
              <span class="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">✓</span>
              面向学生群体的风险提示与合规话术
            </li>
            <li class="flex items-center gap-2">
              <span class="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">✓</span>
              支持雇主自助发布与列表曝光
            </li>
          </ul>
        </div>
      </div>

      <div class="flex flex-1 items-center justify-center px-4 py-12 sm:px-8 lg:py-16">
        <div class="w-full max-w-md">
          <slot />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  headline: { type: String, required: true },
  subline: { type: String, required: true },
})
</script>
