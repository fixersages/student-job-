<script setup>
import { ref, computed } from 'vue'
import JobCard from '../components/JobCard.vue'
import { jobs } from '../data/jobs.js'

const keyword = ref('')
const typeFilter = ref('全部')

const types = ['全部', '线下', '线上', '实习', '短期', '灵活', '校内']

const filtered = computed(() => {
  return jobs.filter((j) => {
    const matchKw =
      !keyword.value.trim() ||
      j.title.includes(keyword.value.trim()) ||
      j.company.includes(keyword.value.trim()) ||
      j.city.includes(keyword.value.trim())
    const matchType = typeFilter.value === '全部' || j.type === typeFilter.value
    return matchKw && matchType
  })
})
</script>

<template>
  <div>
    <section
      class="rounded-3xl bg-gradient-to-br from-brand-600 via-brand-700 to-indigo-800 px-6 py-12 sm:py-14 text-white shadow-xl"
    >
      <div class="max-w-2xl">
        <p class="text-brand-100 text-sm font-medium tracking-wide">大学生兼职平台</p>
        <h1 class="mt-2 text-3xl sm:text-4xl font-bold leading-tight">
          找到适合课表的<br />靠谱兼职机会
        </h1>
        <p class="mt-4 text-brand-100/90 text-sm sm:text-base leading-relaxed">
          筛选周末、线上、实习类岗位，先看详情再联系。演示数据仅为前端样板。
        </p>
      </div>
      <div class="mt-8 flex flex-col sm:flex-row gap-3 max-w-xl">
        <input
          v-model="keyword"
          type="search"
          placeholder="搜索职位、公司或城市…"
          class="flex-1 rounded-xl border-0 bg-white/15 px-4 py-3 text-white placeholder:text-brand-200 ring-1 ring-white/20 focus:ring-2 focus:ring-white/40 outline-none"
        />
        <select
          v-model="typeFilter"
          class="rounded-xl border-0 bg-white text-slate-900 px-4 py-3 font-medium shadow-lg outline-none focus:ring-2 focus:ring-white/50"
        >
          <option v-for="t in types" :key="t" :value="t">{{ t }}</option>
        </select>
      </div>
    </section>

    <section class="mt-10">
      <div class="flex items-end justify-between gap-4 mb-6">
        <div>
          <h2 class="text-xl font-bold text-slate-900">热门兼职</h2>
          <p class="text-sm text-slate-500 mt-1">共 {{ filtered.length }} 条</p>
        </div>
      </div>

      <div v-if="filtered.length" class="grid gap-4 sm:grid-cols-2">
        <JobCard v-for="job in filtered" :key="job.id" :job="job" />
      </div>
      <div
        v-else
        class="rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-16 text-center text-slate-500"
      >
        没有匹配的职位，试试更换关键词或类型。
      </div>
    </section>
  </div>
</template>
