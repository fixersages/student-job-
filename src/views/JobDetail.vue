<script setup>
import { ref, watch, computed, onBeforeUnmount, onMounted } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { getJobDetail } from '@/api/job'
import { getOrCreateConversation } from '@/api/chat'
import { supabase } from '@/lib/supabase'
import UserAvatar from '@/components/UserAvatar.vue'
import { workArrangementLabel } from '@/utils/workArrangement'
import { resolveJobBanner } from '@/utils/jobBanner'

const route = useRoute()
const router = useRouter()
const info = ref(null)
const loading = ref(true)
const notFound = ref(false)
const toast = ref('')
const bannerFailed = ref(false)
const chatBusy = ref(false)
const authUid = ref(null)
let toastTimer = 0
let authSub = null

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
  const { data, error } = await getJobDetail(id)

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

const publisherAvatarUrl = computed(() => {
  const u = info.value?.publisher_public?.avatar_url
  return u != null && String(u).trim() && /^https?:\/\//i.test(String(u).trim()) ? String(u).trim() : ''
})

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
  authSub?.unsubscribe?.()
  authSub = null
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

const isOwnJob = computed(() => {
  const uid = authUid.value
  const owner = info.value?.user_id
  if (!uid || !owner) return false
  return uid === owner
})

onMounted(async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  let u = session?.user ?? null
  if (!u) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    u = user ?? null
  }
  authUid.value = u?.id ?? null
  const { data } = supabase.auth.onAuthStateChange(() => {
    void supabase.auth.getSession().then(({ data: { session: s } }) => {
      authUid.value = s?.user?.id ?? null
    })
  })
  authSub = data.subscription
})

async function startChat() {
  const job = info.value
  if (!job) return
  if (!job.user_id) {
    showToast('该职位暂不支持在线沟通')
    return
  }
  if (isOwnJob.value) {
    showToast('不能与自己发起会话')
    return
  }
  chatBusy.value = true
  const {
    data: { session },
  } = await supabase.auth.getSession()
  let user = session?.user ?? null
  if (!user) {
    const {
      data: { user: u },
    } = await supabase.auth.getUser()
    user = u ?? null
  }
  if (!user) {
    chatBusy.value = false
    router.push({ path: '/login', query: { redirect: route.fullPath } })
    return
  }
  authUid.value = user.id
  const { conversationId, error } = await getOrCreateConversation({
    jobId: job.id,
    recruiterId: job.user_id,
    employerDisplayName: job.nickname || '招聘方',
    seekerDisplayName: user.user_metadata?.nickname || user.email?.split('@')[0] || '',
    jobTitle: job.title,
  })
  chatBusy.value = false
  if (error) {
    if (error.code === 'NO_AUTH') {
      router.push({ path: '/login', query: { redirect: route.fullPath } })
      return
    }
    showToast(error.message || '无法发起沟通')
    return
  }
  if (conversationId) router.push(`/chat/${conversationId}`)
}
</script>

<template>
  <div>
    <!-- 轻量复制提示 -->
    <Teleport to="body">
      <div
        v-if="toast"
        class="fixed bottom-6 left-1/2 z-[200] max-w-sm -translate-x-1/2 rounded-[var(--app-radius-lg)] bg-slate-900 px-4 py-2.5 text-center text-sm text-white shadow-xl ring-1 ring-black/10"
        role="status"
      >
        {{ toast }}
      </div>
    </Teleport>

    <div class="app-container py-6 sm:py-9 lg:py-10">
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
      <div v-else-if="info" class="overflow-hidden rounded-[var(--app-radius-xl)] border border-slate-200/90 bg-white shadow-card ring-1 ring-slate-900/[0.03]">
        <!-- Banner -->
        <div class="relative h-48 sm:h-56 lg:h-64">
          <template v-if="!bannerFailed">
            <img
              :src="bannerUrl"
              alt=""
              width="1200"
              height="448"
              class="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
              decoding="async"
              @error="bannerFailed = true"
            />
          </template>
          <div
            v-else
            class="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-brand-900"
          />
          <div class="absolute inset-0 bg-gradient-to-t from-navy-950/90 via-navy-950/35 to-transparent" />
          <div class="absolute left-4 right-4 top-4 flex flex-wrap items-center justify-between gap-2 sm:left-6 sm:right-6">
            <RouterLink
              :to="backToListHref"
                class="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-white/20 backdrop-blur-md transition duration-200 hover:bg-white/20"
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
                class="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md transition duration-200 hover:bg-brand-500"
                @click="shareNative"
              >
                分享
              </button>
            </div>
          </div>
          <div class="absolute bottom-0 left-0 right-0 p-5 sm:p-8">
            <span
              class="inline-block rounded-md bg-white/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-100 ring-1 ring-white/15"
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
              <UserAvatar
                v-if="info.user_id"
                :custom-avatar-url="publisherAvatarUrl"
                :seed-user-id="String(info.user_id)"
                size-class="h-10 w-10"
                ring-class="ring-2 ring-slate-200/80"
              />
              <span class="font-semibold text-slate-800">发布者：{{ info.nickname || '匿名' }}</span>
              <RouterLink
                :to="`/list?job=${info.id}`"
                class="text-xs font-semibold text-brand-600 underline-offset-2 transition hover:text-brand-700 hover:underline"
              >
                在分栏列表中打开
              </RouterLink>
            </div>

            <section class="app-card mt-6 p-5 sm:p-6">
              <h2 class="text-base font-semibold text-slate-900">职位摘要</h2>
              <dl class="mt-4 grid gap-3 sm:grid-cols-2 sm:gap-4">
                <div class="rounded-xl bg-slate-50/90 p-4 ring-1 ring-slate-100">
                  <dt class="text-[11px] font-medium uppercase tracking-wide text-slate-400">薪资</dt>
                  <dd class="mt-1 text-base font-semibold text-slate-900">{{ info.price || '面议' }}</dd>
                </div>
                <div class="rounded-xl bg-slate-50/90 p-4 ring-1 ring-slate-100">
                  <dt class="text-[11px] font-medium uppercase tracking-wide text-slate-400">地点</dt>
                  <dd class="mt-1 text-base font-semibold text-slate-900">{{ info.address || '待定' }}</dd>
                </div>
                <div class="rounded-xl bg-slate-50/90 p-4 ring-1 ring-slate-100">
                  <dt class="text-[11px] font-medium uppercase tracking-wide text-slate-400">时间</dt>
                  <dd class="mt-1 text-base font-semibold text-slate-900">{{ info.work_time || '协商' }}</dd>
                </div>
                <div class="rounded-xl bg-slate-50/90 p-4 ring-1 ring-slate-100">
                  <dt class="text-[11px] font-medium uppercase tracking-wide text-slate-400">性别</dt>
                  <dd class="mt-1 text-base font-semibold text-slate-900">{{ info.gender_req || '不限' }}</dd>
                </div>
                <div class="rounded-xl bg-slate-50/90 p-4 ring-1 ring-slate-100 sm:col-span-2">
                  <dt class="text-[11px] font-medium uppercase tracking-wide text-slate-400">工作形式</dt>
                  <dd class="mt-1 text-base font-semibold text-slate-900">
                    {{ workArrangementLabel(info.work_arrangement) }}
                  </dd>
                </div>
              </dl>
            </section>

            <section class="app-card mt-6 p-5 sm:p-6">
              <h2 class="text-base font-semibold text-slate-900">工作详情</h2>
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
                  class="mt-4 flex w-full items-center justify-center gap-2 rounded-[var(--app-radius)] bg-brand-600 py-3.5 text-sm font-semibold text-white shadow-md transition duration-200 hover:bg-brand-500"
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

                <p v-if="info.wechat" class="mt-4 rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-900 ring-1 ring-slate-100">
                  微信：<span class="font-mono font-semibold">{{ info.wechat }}</span>
                </p>

              <RouterLink
                v-if="isOwnJob"
                :to="`/edit-job/${info.id}`"
                class="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-[var(--app-radius)] border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-800 shadow-sm transition duration-200 hover:border-brand-200 hover:bg-brand-50/80 hover:text-brand-900"
              >
                编辑此职位
              </RouterLink>
              <button
                type="button"
                class="mt-4 flex w-full items-center justify-center gap-2 rounded-[var(--app-radius)] border border-brand-200 bg-brand-50 py-3 text-sm font-semibold text-brand-800 shadow-sm transition duration-200 hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="chatBusy || !info.user_id || isOwnJob"
                @click="startChat"
              >
                  <svg class="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                  {{ chatBusy ? '请稍候…' : '立即沟通' }}
                </button>
                <p v-if="isOwnJob" class="mt-2 text-center text-[11px] text-slate-500">您是该职位的发布者</p>
                <p v-else-if="!info.user_id" class="mt-2 text-center text-[11px] text-slate-500">该职位未绑定发布者账号，无法发起站内信</p>
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
