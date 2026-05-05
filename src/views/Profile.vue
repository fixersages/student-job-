<script setup>
import { computed, ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { jobs } from '../data/jobs.js'

const user = ref(null)

onMounted(() => {
  const raw = localStorage.getItem('campus_pt_user')
  if (raw) {
    try {
      user.value = JSON.parse(raw)
    } catch {
      user.value = null
    }
  }
})

const displayEmail = computed(() => user.value?.email ?? '—')
const displayNickname = computed(() => user.value?.nickname ?? '未设置昵称')
const displaySchool = computed(() => user.value?.school ?? '未填写学校')

const recommended = computed(() => jobs.slice(0, 3))
</script>

<template>
  <div class="max-w-3xl mx-auto">
    <h1 class="text-2xl font-bold text-slate-900">个人中心</h1>

    <div v-if="!user" class="mt-8 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <p class="text-slate-600">登录后可查看资料与推荐岗位。</p>
      <RouterLink
        to="/login"
        class="mt-4 inline-flex rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >去登录</RouterLink
      >
    </div>

    <template v-else>
      <div
        class="mt-8 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row gap-6 items-start"
      >
        <div
          class="h-20 w-20 rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold shrink-0"
        >
          {{ displayNickname.charAt(0) }}
        </div>
        <div class="flex-1 min-w-0">
          <h2 class="text-xl font-semibold text-slate-900">{{ displayNickname }}</h2>
          <p class="text-sm text-slate-500 mt-1">{{ displayEmail }}</p>
          <p class="text-sm text-slate-600 mt-2">{{ displaySchool }}</p>
          <div class="mt-4 flex flex-wrap gap-2">
            <span class="rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-600">学生认证 · 演示</span>
          </div>
        </div>
      </div>

      <section class="mt-10">
        <h3 class="text-lg font-semibold text-slate-900">为你推荐</h3>
        <ul class="mt-4 space-y-3">
          <li v-for="j in recommended" :key="j.id">
            <RouterLink
              :to="`/job/${j.id}`"
              class="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-brand-200 transition-colors"
            >
              <span class="font-medium text-slate-800 truncate pr-4">{{ j.title }}</span>
              <span class="text-sm text-brand-600 shrink-0">{{ j.salary }}</span>
            </RouterLink>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
