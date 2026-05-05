<script setup>
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'

const route = useRoute()
const router = useRouter()
const info = ref(null)
const loading = ref(true)
const notFound = ref(false)

const getDetail = async () => {
  loading.value = true
  notFound.value = false
  const id = route.params.id
  const { data, error } = await supabase
    .from('part_time')
    .select('*, job_category(name)')
    .eq('id', id)
    .single()

  loading.value = false
  if (error || !data) {
    notFound.value = true
    info.value = null
    return
  }
  info.value = data
}

watch(
  () => route.params.id,
  () => {
    getDetail()
  },
)

const formatTime = (timeStr) => {
  if (!timeStr) return ''
  return new Date(timeStr).toLocaleString('zh-CN')
}

getDetail()
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
    <!-- Loading -->
    <div v-if="loading" class="animate-pulse space-y-6">
      <div class="h-8 w-2/3 max-w-md rounded-lg bg-slate-200" />
      <div class="grid gap-8 lg:grid-cols-3">
        <div class="lg:col-span-2 space-y-4">
          <div class="h-40 rounded-2xl bg-slate-200" />
          <div class="h-32 rounded-2xl bg-slate-200" />
        </div>
        <div class="h-64 rounded-2xl bg-slate-200" />
      </div>
    </div>

    <!-- Not found -->
    <div v-else-if="notFound" class="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-card">
      <p class="text-lg font-medium text-slate-700">未找到该职位或已被下架</p>
      <button
        type="button"
        class="mt-6 rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        @click="router.push('/list')"
      >
        返回职位大厅
      </button>
    </div>

    <!-- Content -->
    <div v-else-if="info" class="lg:grid lg:grid-cols-3 lg:gap-10">
      <article class="lg:col-span-2">
        <nav class="text-sm text-slate-500">
          <router-link to="/list" class="hover:text-brand-600">职位大厅</router-link>
          <span class="mx-2">/</span>
          <span class="text-slate-800">{{ info.title }}</span>
        </nav>

        <header class="mt-4 border-b border-slate-200 pb-6">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <h1 class="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl text-balance">
              {{ info.title }}
            </h1>
            <span
              class="shrink-0 rounded-xl bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-700"
              >{{ info.job_category?.name || '未分类' }}</span
            >
          </div>
          <p class="mt-3 text-sm text-slate-500">发布于 {{ formatTime(info.created_at) }}</p>
        </header>

        <section class="mt-8 rounded-2xl border border-slate-100 bg-white p-6 shadow-card sm:p-8">
          <h2 class="text-lg font-semibold text-slate-900">职位摘要</h2>
          <dl class="mt-4 grid gap-4 sm:grid-cols-2">
            <div class="rounded-xl bg-slate-50 p-4">
              <dt class="text-xs font-medium uppercase tracking-wide text-slate-400">薪资</dt>
              <dd class="mt-1 text-base font-semibold text-slate-900">{{ info.price || '面议' }}</dd>
            </div>
            <div class="rounded-xl bg-slate-50 p-4">
              <dt class="text-xs font-medium uppercase tracking-wide text-slate-400">地点</dt>
              <dd class="mt-1 text-base font-semibold text-slate-900">{{ info.address || '待定' }}</dd>
            </div>
            <div class="rounded-xl bg-slate-50 p-4">
              <dt class="text-xs font-medium uppercase tracking-wide text-slate-400">时间</dt>
              <dd class="mt-1 text-base font-semibold text-slate-900">{{ info.work_time || '协商' }}</dd>
            </div>
            <div class="rounded-xl bg-slate-50 p-4">
              <dt class="text-xs font-medium uppercase tracking-wide text-slate-400">性别</dt>
              <dd class="mt-1 text-base font-semibold text-slate-900">{{ info.gender_req || '不限' }}</dd>
            </div>
          </dl>
        </section>

        <section class="mt-8 rounded-2xl border border-slate-100 bg-white p-6 shadow-card sm:p-8">
          <h2 class="text-lg font-semibold text-slate-900">工作详情</h2>
          <div class="mt-4 whitespace-pre-wrap text-base leading-relaxed text-slate-600">
            {{ info.content || '雇主暂未填写详细描述，请通过电话或微信沟通。' }}
          </div>
        </section>
      </article>

      <aside class="mt-10 lg:mt-8">
        <div class="sticky top-24 space-y-6">
          <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
            <h3 class="text-sm font-semibold uppercase tracking-wide text-slate-400">联系招聘方</h3>
            <p class="mt-1 text-sm text-slate-500">发布者：{{ info.nickname }}</p>

            <a
              v-if="info.phone"
              :href="'tel:' + info.phone.replace(/\s/g, '')"
              class="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-700"
            >
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                />
              </svg>
              拨打电话
            </a>
            <p v-else class="mt-4 text-sm text-amber-700">暂未公开电话，请使用微信或其它方式。</p>

            <p v-if="info.wechat" class="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
              微信：<span class="font-mono font-medium">{{ info.wechat }}</span>
            </p>
          </div>

          <div class="rounded-2xl border border-amber-200 bg-amber-50/80 p-5 text-sm leading-relaxed text-amber-950">
            <p class="font-semibold text-amber-900">安全提示</p>
            <ul class="mt-2 list-inside list-disc space-y-1 text-amber-900/90">
              <li>凡要求预付费用、刷单返利等，极大概率为诈骗。</li>
              <li>建议首次沟通保留截图，正规用工应签署协议或保留凭证。</li>
            </ul>
          </div>

          <button
            type="button"
            class="w-full rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            @click="router.push('/list')"
          >
            ← 返回列表
          </button>
        </div>
      </aside>
    </div>
  </div>
</template>
