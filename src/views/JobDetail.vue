<script setup>
import { ref, watch, computed, onBeforeUnmount } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { resolveJobBanner } from '@/utils/jobBanner'

const route = useRoute()
const router = useRouter()
const info = ref(null)
const loading = ref(true)
const notFound = ref(false)
const toast = ref('')
const bannerFailed = ref(false)
let toastTimer = 0

const SITE_TITLE = '校兼 — 大学生兼职平台'

const getDetail = async () => {
  const id = route.params.id
  if (!id) {
    notFound.value = true
    info.value = null
    loading.value = false
    return
  }
  loading.value = true
  notFound.value = false
  bannerFailed.value = false
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
  { immediate: true },
)

const bannerUrl = computed(() => resolveJobBanner(info.value))

/** 当前页完整链接（Hash 路由，便于复制与微信打开） */
const shareUrl = computed(() => {
  if (typeof window === 'undefined') return ''
  return `${window.location.origin}${window.location.pathname}#${route.fullPath}`
})

watch(info, (v) => {
  if (v?.title) {
    document.title = `${v.title} · 校兼`
    let el = document.querySelector('meta[name="description"]')
    if (!el) {
      el = document.createElement('meta')
      el.setAttribute('name', 'description')
      document.head.appendChild(el)
    }
    const snippet = [v.title, v.price, v.address].filter(Boolean).join(' · ')
    el.setAttribute('content', String(snippet).slice(0, 160))
  } else {
    document.title = SITE_TITLE
  }
})

onBeforeUnmount(() => {
  document.title = SITE_TITLE
})

function showToast(msg) {
  toast.value = msg
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toast.value = ''
  }, 2200)
}

async function copyShareLink() {
  const url = shareUrl.value
  try {
    await navigator.clipboard.writeText(url)
    showToast('链接已复制，可粘贴到微信、备忘录等')
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = url
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      showToast('链接已复制')
    } catch {
      showToast('复制失败，请长按链接手动复制')
    }
  }
}

async function shareNative() {
  const url = shareUrl.value
  const title = info.value?.title || '校兼职位'
  const text = `${title} — 校园兼职`
  try {
    if (navigator.share) {
      await navigator.share({ title, text, url })
      showToast('已调起系统分享')
    } else {
      await copyShareLink()
    }
  } catch (e) {
    if (e?.name === 'AbortError') return
    await copyShareLink()
  }
}

const formatTime = (timeStr) => {
  if (!timeStr) return ''
  return new Date(timeStr).toLocaleString('zh-CN')
}

const telHref = (phone) => {
  if (!phone) return '#'
  return `tel:${String(phone).replace(/\s/g, '')}`
}

const backToListHref = computed(() => {
  const id = route.params.id
  return id ? { path: '/list', query: { job: String(id) } } : '/list'
})
</script>

<template>
  <div>
    <!-- 轻量复制提示 -->
    <Teleport to="body">
      <div
        v-if="toast"
        class="fixed bottom-6 left-1/2 z-[200] max-w-sm -translate-x-1/2 rounded-xl bg-navy-900 px-4 py-2.5 text-center text-sm text-white shadow-xl"
        role="status"
      >
        {{ toast }}
      </div>
    </Teleport>

    <div class="app-container py-6 sm:py-8 lg:py-10">
      <!-- Loading -->
      <div v-if="loading" class="animate-pulse space-y-6">
        <div class="h-52 w-full rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 sm:h-64" />
        <div class="h-9 w-2/3 max-w-lg rounded-xl bg-slate-100" />
        <div class="grid gap-6 lg:grid-cols-3 lg:gap-8">
          <div class="lg:col-span-2 space-y-4">
            <div class="h-40 rounded-2xl bg-slate-100" />
            <div class="h-32 rounded-2xl bg-slate-100" />
          </div>
          <div class="h-64 rounded-2xl bg-slate-100" />
        </div>
      </div>

      <!-- Not found -->
      <div
        v-else-if="notFound"
        class="app-card mx-auto max-w-lg px-6 py-16 text-center"
      >
        <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
          <svg class="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <p class="mt-5 text-lg font-semibold text-slate-800">未找到该职位</p>
        <p class="mt-2 text-sm text-slate-500">链接可能过期或 ID 有误，可从列表重新进入。</p>
        <RouterLink to="/list" class="app-btn-primary mt-8 inline-flex"> 返回职位大厅 </RouterLink>
      </div>

      <!-- Content -->
      <div v-else-if="info" class="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-card">
        <!-- Banner -->
        <div class="relative h-48 sm:h-56 lg:h-64">
          <template v-if="!bannerFailed">
            <img
              :src="bannerUrl"
              alt=""
              class="absolute inset-0 h-full w-full object-cover"
              loading="eager"
              decoding="async"
              @error="bannerFailed = true"
            />
          </template>
          <div
            v-else
            class="absolute inset-0 bg-gradient-to-br from-navy-900 via-brand-800 to-accent-700"
          />
          <div class="absolute inset-0 bg-gradient-to-t from-navy-950/90 via-navy-950/35 to-transparent" />
          <div class="absolute left-4 right-4 top-4 flex flex-wrap items-center justify-between gap-2 sm:left-6 sm:right-6">
            <RouterLink
              :to="backToListHref"
              class="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-white/25 backdrop-blur transition hover:bg-white/25"
            >
              ← 返回列表
            </RouterLink>
            <div class="flex gap-2">
              <button
                type="button"
                class="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white ring-1 ring-white/25 backdrop-blur transition hover:bg-white/25"
                title="复制链接"
                aria-label="复制分享链接"
                @click="copyShareLink"
              >
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              </button>
              <button
                type="button"
                class="inline-flex items-center gap-1 rounded-full bg-accent-500 px-3 py-1.5 text-xs font-bold text-white shadow-lg shadow-black/20 transition hover:bg-accent-600"
                @click="shareNative"
              >
                分享
              </button>
            </div>
          </div>
          <div class="absolute bottom-0 left-0 right-0 p-5 sm:p-8">
            <span
              class="inline-block rounded-lg bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-100 ring-1 ring-white/20"
              >{{ info.job_category?.name || '未分类' }}</span
            >
            <h1 class="mt-2 text-2xl font-bold leading-tight text-white text-balance drop-shadow sm:text-3xl lg:text-4xl">
              {{ info.title }}
            </h1>
            <p class="mt-2 text-sm text-white/80">发布于 {{ formatTime(info.created_at) }}</p>
          </div>
        </div>

        <div class="lg:grid lg:grid-cols-3 lg:gap-8 lg:p-8">
          <article class="min-w-0 border-b border-slate-100 p-5 sm:p-6 lg:col-span-2 lg:border-b-0 lg:p-0">
            <div class="flex flex-wrap items-center gap-3 text-sm text-slate-600">
              <span class="font-semibold text-navy-900">发布者：{{ info.nickname || '匿名' }}</span>
              <RouterLink
                :to="`/list?job=${info.id}`"
                class="text-xs font-semibold text-accent-600 underline-offset-2 hover:underline"
              >
                在分栏列表中打开
              </RouterLink>
            </div>

            <section class="app-card mt-6 p-5 sm:p-6">
              <h2 class="text-base font-semibold text-navy-900">职位摘要</h2>
              <dl class="mt-4 grid gap-3 sm:grid-cols-2 sm:gap-4">
                <div class="rounded-xl bg-slate-50/90 p-4 ring-1 ring-slate-100">
                  <dt class="text-[11px] font-medium uppercase tracking-wide text-slate-400">薪资</dt>
                  <dd class="mt-1 text-base font-semibold text-navy-900">{{ info.price || '面议' }}</dd>
                </div>
                <div class="rounded-xl bg-slate-50/90 p-4 ring-1 ring-slate-100">
                  <dt class="text-[11px] font-medium uppercase tracking-wide text-slate-400">地点</dt>
                  <dd class="mt-1 text-base font-semibold text-navy-900">{{ info.address || '待定' }}</dd>
                </div>
                <div class="rounded-xl bg-slate-50/90 p-4 ring-1 ring-slate-100">
                  <dt class="text-[11px] font-medium uppercase tracking-wide text-slate-400">时间</dt>
                  <dd class="mt-1 text-base font-semibold text-navy-900">{{ info.work_time || '协商' }}</dd>
                </div>
                <div class="rounded-xl bg-slate-50/90 p-4 ring-1 ring-slate-100">
                  <dt class="text-[11px] font-medium uppercase tracking-wide text-slate-400">性别</dt>
                  <dd class="mt-1 text-base font-semibold text-navy-900">{{ info.gender_req || '不限' }}</dd>
                </div>
              </dl>
            </section>

            <section class="app-card mt-6 p-5 sm:p-6">
              <h2 class="text-base font-semibold text-navy-900">工作详情</h2>
              <div class="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed text-slate-600">
                {{ info.content || '雇主暂未填写详细描述，请通过电话或微信沟通。' }}
              </div>
            </section>

            <p class="mt-6 break-all rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500 ring-1 ring-slate-100">
              分享链接：<span class="font-mono text-slate-700">{{ shareUrl }}</span>
            </p>
          </article>

          <aside class="p-5 sm:p-6 lg:p-0">
            <div class="sticky top-24 space-y-4">
              <div class="app-card p-5">
                <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-400">联系招聘方</h3>
                <a
                  v-if="info.phone"
                  :href="telHref(info.phone)"
                  class="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent-500 py-3.5 text-sm font-bold text-white shadow-lg transition hover:bg-accent-600"
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
                <p v-else class="mt-4 text-sm text-amber-800">暂未公开电话，请使用微信或其它方式。</p>

                <p v-if="info.wechat" class="mt-4 rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-navy-900 ring-1 ring-slate-100">
                  微信：<span class="font-mono font-semibold">{{ info.wechat }}</span>
                </p>
              </div>

              <div class="rounded-2xl border border-amber-200/80 bg-amber-50/90 p-4 text-xs leading-relaxed text-amber-950">
                <p class="font-semibold text-amber-900">安全提示</p>
                <ul class="mt-2 list-inside list-disc space-y-1 text-amber-900/90">
                  <li>凡要求预付费用、刷单返利等，极大概率为诈骗。</li>
                  <li>建议保留沟通截图，薪资与工时尽量书面约定。</li>
                </ul>
              </div>

              <RouterLink
                :to="backToListHref"
                class="app-btn-secondary flex w-full justify-center py-3"
              >
                ← 返回职位大厅
              </RouterLink>
            </div>
          </aside>
        </div>
      </div>
    </div>
  </div>
</template>
