<script setup>
import { RouterLink } from 'vue-router'

defineProps({
  job: {
    type: Object,
    required: true,
  },
})
</script>

<template>
  <RouterLink
    :to="`/job/${job.id}`"
    class="group block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-brand-200 hover:shadow-md"
  >
    <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
      <div>
        <h3 class="text-lg font-semibold text-slate-900 group-hover:text-brand-700">
          {{ job.title }}
        </h3>
        <p class="mt-1 text-sm text-slate-500">{{ job.company }} · {{ job.city }}</p>
      </div>
      <span
        class="inline-flex shrink-0 self-start rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-700"
        >{{ job.salary }}</span
      >
    </div>
    <div class="mt-3 flex flex-wrap gap-2">
      <span
        v-for="t in job.tags"
        :key="t"
        class="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
        >{{ t }}</span
      >
    </div>
    <div class="mt-4 flex items-center justify-between text-xs text-slate-400">
      <span>{{ job.type }}</span>
      <span>{{ job.postedAt }} 发布 · {{ job.views }} 浏览</span>
    </div>
  </RouterLink>
</template>
