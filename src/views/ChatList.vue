<script setup>
/**
 * 会话列表分页；focus/visibility 时防抖刷新。
 * 不展示未读角标、不展示「暂无消息」占位文案（无预览时留空）。
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { RouterLink } from 'vue-router'
import { supabase } from '@/lib/supabase'
import UserAvatar from '@/components/UserAvatar.vue'
import { listMyConversations } from '@/api/chat'

const PAGE_SIZE = 10

const rows = ref([])
const loading = ref(true)
const loadingMore = ref(false)
const loadError = ref('')
const myUid = ref('')
const currentPage = ref(0)
const hasMore = ref(true)
const totalCount = ref(null)

let authSub = null
let refreshTimer = 0
let authDebounceTimer = 0

/**
 * @param {boolean} reset true 重置列表；false 追加下一页
 */
async function load(reset = true) {
  if (reset) {
    loading.value = true
    loadError.value = ''
    currentPage.value = 0
    rows.value = []
    hasMore.value = true
    totalCount.value = null
  } else {
    if (!hasMore.value || loadingMore.value || loading.value) return
    loadingMore.value = true
  }

  try {
    const page = reset ? 0 : currentPage.value
    const { data, error, count } = await listMyConversations({ page, pageSize: PAGE_SIZE })
    if (error) throw error
    const incoming = data ?? []

    if (typeof count === 'number') {
      totalCount.value = count
    }

    if (reset) {
      rows.value = incoming
    } else {
      const seen = new Set(rows.value.map((r) => String(r.id)))
      for (const r of incoming) {
        const sid = String(r.id)
        if (!seen.has(sid)) {
          rows.value.push(r)
          seen.add(sid)
        }
      }
    }

    currentPage.value = page + 1

    if (typeof totalCount.value === 'number') {
      hasMore.value = rows.value.length < totalCount.value
    } else {
      hasMore.value = incoming.length >= PAGE_SIZE
    }
    if (!incoming.length && !reset) hasMore.value = false
  } catch (e) {
    loadError.value = e?.message || '加载失败'
    if (reset) {
      rows.value = []
    }
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

async function loadMore() {
  await load(false)
}

function scheduleRefresh() {
  window.clearTimeout(refreshTimer)
  refreshTimer = window.setTimeout(() => {
    refreshTimer = 0
    void load(true)
  }, 400)
}

function otherPartyUid(row) {
  const uid = myUid.value
  if (!row || !uid) return ''
  return uid === row.seeker_id ? String(row.recruiter_id || '') : String(row.seeker_id || '')
}

function otherPartyAvatarUrl(row) {
  const uid = myUid.value
  if (!row || !uid) return ''
  const pub = uid === row.seeker_id ? row.recruiter_public : row.seeker_public
  const u = pub?.avatar_url
  return u != null && String(u).trim() && /^https?:\/\//i.test(String(u).trim()) ? String(u).trim() : ''
}

function otherLabel(row) {
  const uid = myUid.value
  if (!row || !uid) return '对方'
  return uid === row.seeker_id ? row.employer_display_name || '招聘方' : row.seeker_display_name || '求职者'
}

function jobTitle(row) {
  const j = row?.jobs
  if (j && typeof j === 'object' && 'title' in j) return j.title || '兼职岗位'
  return '兼职岗位'
}

/** 仅在有最后一条预览时返回文案，否则空串（不显示「暂无消息」） */
function previewText(row) {
  const t = row?.last_message_preview
  if (t != null && String(t).trim() !== '') return String(t)
  return ''
}

/** 今天显示时间 / 昨天 / 年内月日 / 跨年 */
function formatListTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const sod = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  if (sod(d) === sod(now)) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  const yest = new Date(now)
  yest.setDate(now.getDate() - 1)
  if (sod(d) === sod(yest)) return '昨天'
  if (d.getFullYear() === now.getFullYear()) {
    return `${d.getMonth() + 1}月${d.getDate()}日`
  }
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

function rowTimestamp(r) {
  return new Date(r.last_message_at || r.updated_at || r.created_at || 0).getTime()
}

/** 按最新消息时间倒序 */
const sortedRows = computed(() => {
  const list = rows.value ?? []
  return [...list].sort((a, b) => rowTimestamp(b) - rowTimestamp(a))
})

function onWindowFocus() {
  scheduleRefresh()
}

function onVisibility() {
  if (document.visibilityState === 'visible') scheduleRefresh()
}

function onPageShow(ev) {
  if (ev && ev.persisted) scheduleRefresh()
}

function scheduleAuthReload() {
  window.clearTimeout(authDebounceTimer)
  authDebounceTimer = window.setTimeout(() => {
    authDebounceTimer = 0
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      myUid.value = session?.user?.id ?? ''
      if (!myUid.value) {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        myUid.value = user?.id ?? ''
      }
      await load(true)
    })()
  }, 300)
}

onMounted(async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  myUid.value = session?.user?.id ?? ''
  if (!myUid.value) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    myUid.value = user?.id ?? ''
  }
  await load(true)
  const { data } = supabase.auth.onAuthStateChange(() => {
    scheduleAuthReload()
  })
  authSub = data.subscription
  window.addEventListener('focus', onWindowFocus)
  window.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pageshow', onPageShow)
})

onUnmounted(() => {
  window.clearTimeout(refreshTimer)
  window.clearTimeout(authDebounceTimer)
  refreshTimer = 0
  authDebounceTimer = 0
  authSub?.unsubscribe?.()
  authSub = null
  window.removeEventListener('focus', onWindowFocus)
  window.removeEventListener('visibilitychange', onVisibility)
  window.removeEventListener('pageshow', onPageShow)
})
</script>

<template>
  <div class="min-h-[calc(100dvh-8rem)] bg-gradient-to-b from-slate-100 via-slate-50/90 to-slate-100 pb-14 pt-6 sm:pb-20 sm:pt-8">
    <div class="app-container max-w-3xl">
      <!-- 页头 -->
      <header
        class="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200/90 pb-6"
      >
        <div>
          <p class="app-section-kicker text-brand-600">消息</p>
          <h1 class="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">我的聊天</h1>
        </div>
        <RouterLink
          to="/list"
          class="inline-flex items-center justify-center rounded-[var(--app-radius)] border border-slate-200/90 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-900/[0.04] transition hover:border-brand-200 hover:bg-brand-50/60 hover:text-brand-800"
        >
          返回大厅
        </RouterLink>
      </header>

      <div v-if="loading" class="mt-8 space-y-3">
        <div
          v-for="n in 5"
          :key="n"
          class="h-[4.5rem] animate-pulse rounded-2xl bg-slate-200/60 ring-1 ring-slate-200/50"
        />
      </div>

      <div
        v-else-if="loadError"
        class="mt-8 rounded-2xl border border-amber-200/90 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm"
      >
        {{ loadError }}
        <button type="button" class="ml-2 font-semibold text-amber-900 underline" @click="load(true)">重试</button>
      </div>

      <template v-else-if="!loading && !loadError">
        <ul v-if="sortedRows.length" class="mt-6 space-y-3">
          <li
            v-for="row in sortedRows"
            :key="row.id"
            v-memo="[row.id, row.last_message_preview, row.last_message_at, row.updated_at, row.seeker_display_name, row.employer_display_name, jobTitle(row)]"
          >
            <RouterLink
              :to="`/chat/${row.id}`"
              class="group flex gap-3 overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 px-4 py-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.03] transition duration-200 hover:-translate-y-0.5 hover:border-brand-200/80 hover:bg-white hover:shadow-[0_8px_30px_rgba(15,23,42,0.08)] sm:gap-4 sm:px-5 sm:py-4"
            >
              <div class="relative h-14 w-14 shrink-0 sm:h-14 sm:w-14">
                <UserAvatar
                  :custom-avatar-url="otherPartyAvatarUrl(row)"
                  :seed-user-id="otherPartyUid(row)"
                  size-class="h-14 w-14 sm:h-14 sm:w-14"
                  ring-class="ring-2 ring-slate-200/90"
                />
              </div>

              <div class="min-w-0 flex-1">
                <div class="flex items-start justify-between gap-2">
                  <span class="truncate text-[15px] font-semibold tracking-tight text-slate-800">
                    {{ otherLabel(row) }}
                  </span>
                  <span class="shrink-0 text-[11px] tabular-nums text-slate-400">
                    {{ formatListTime(row.last_message_at) }}
                  </span>
                </div>
                <p
                  v-if="previewText(row)"
                  class="mt-1 line-clamp-2 text-sm leading-snug text-slate-500"
                >
                  {{ previewText(row) }}
                </p>
                <p
                  class="mt-2 inline-flex max-w-full items-center gap-1 truncate rounded-lg bg-slate-50/90 px-2 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-slate-100"
                  :class="previewText(row) ? '' : 'mt-1'"
                >
                  <span class="text-slate-400">岗位</span>
                  <span class="truncate text-slate-700">{{ jobTitle(row) }}</span>
                </p>
              </div>
            </RouterLink>
          </li>
        </ul>

        <div v-if="sortedRows.length && hasMore" class="mt-4 flex justify-center">
          <button
            type="button"
            class="rounded-[var(--app-radius)] border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
            :disabled="loadingMore"
            @click="void loadMore()"
          >
            {{ loadingMore ? '加载中…' : '加载更多' }}
          </button>
        </div>

        <div
          v-if="!sortedRows.length"
          class="mt-12 flex flex-col items-center rounded-[var(--app-radius-xl)] border border-slate-200/80 bg-white/90 px-6 py-16 text-center shadow-[0_12px_40px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.03] sm:px-10 sm:py-20"
        >
          <div
            class="flex h-36 w-36 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-50 via-white to-slate-50 ring-1 ring-brand-100/80"
            aria-hidden="true"
          >
            <svg class="h-24 w-24 text-brand-500/90" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="18" y="28" width="84" height="56" rx="12" fill="currentColor" fill-opacity="0.12" />
              <path
                d="M24 34h72v44H24V34zm0 0l36 22 36-22"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                fill="none"
              />
              <circle cx="88" cy="82" r="16" fill="currentColor" fill-opacity="0.2" />
              <path
                d="M82 82h12M88 76v12"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
              />
            </svg>
          </div>
          <h2 class="mt-8 text-lg font-semibold text-slate-900">还没有聊天</h2>
          <p class="mt-2 max-w-sm text-sm leading-relaxed text-slate-600">
            在职位详情页点击「立即沟通」，即可与招聘方开启会话；新消息会在这里聚合展示。
          </p>
          <RouterLink
            to="/list"
            class="app-btn-primary mt-10 inline-flex min-w-[10rem] justify-center px-8 py-3 text-sm font-semibold shadow-md shadow-brand-900/10"
          >
            去岗位大厅逛逛
          </RouterLink>
        </div>
      </template>
    </div>
  </div>
</template>
