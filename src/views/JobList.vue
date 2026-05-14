<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick, defineAsyncComponent } from 'vue'
import { useRouter, useRoute, RouterLink } from 'vue-router'
import { getCategoryList, getCurrentUser, isPublisher } from '@/lib/supabase'
import { fetchJobsPage, deleteJobById, getJobDetail } from '@/api/job'
import { resolveJobBanner } from '@/utils/jobBanner'
import { workArrangementLabel } from '@/utils/workArrangement'
import UserAvatar from '@/components/UserAvatar.vue'

const AppEmptyState = defineAsyncComponent(() => import('@/components/AppEmptyState.vue'))

const router = useRouter()
const route = useRoute()

const jobList = ref([])
const categoryList = ref([])
const cateId = ref(0)
const loginUserId = ref('')
const loginUser = ref(null)
const keyword = ref('')
const locationQ = ref('')
/** 点击「寻找」后参与服务端查询，避免输入每个字都打接口 */
const appliedKeyword = ref('')
const appliedLocation = ref('')
const loading = ref(true)
const loadingMore = ref(false)
const loadError = ref('')
const showForbiddenPublish = ref(false)

const PAGE_SIZE = 10
const currentPage = ref(0)
const hasMore = ref(true)
const totalCount = ref(null)
const listScrollRoot = ref(null)
const loadMoreSentinel = ref(null)
let loadMoreObserver = null
/** 防止滚动哨兵在同一帧内重复触发「加载更多」 */
let loadMoreLock = false

/** 薪资筛选：全部 | 仅面议 | 已写薪资 */
const salaryFilter = ref('all')
/** 工作方式：全部 | 含远程/线上 | 不含远程 */
const workMode = ref('all')
/** 排序：new 最新 | old 最早 | title 标题 A-Z */
const sortOrder = ref('new')

const isDesktop = ref(false)
function updateMq() {
  isDesktop.value = typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
}

const selectedJobId = ref(null)
const detailInfo = ref(null)
const detailLoading = ref(false)
/** 防止快速切换职位时旧详情请求覆盖新内容 */
let fetchDetailSeq = 0

const canPublish = computed(() => !loginUser.value || isPublisher(loginUser.value))

function goPublish() {
  if (canPublish.value) void router.push('/publish')
  else void router.push('/register?role=publisher')
}

watch(
  () => route.query.forbidden,
  (v) => {
    if (v === 'publish') {
      showForbiddenPublish.value = true
      const q = { ...route.query }
      delete q.forbidden
      router.replace({ query: q })
    }
  },
  { immediate: true },
)

const isMine = (uid) => uid === loginUserId.value

/** 大厅列表/分栏详情：发布者公开头像 URL（来自 campus_public_profiles） */
function publisherAvatarUrlFromJob(job) {
  const u = job?.publisher_public?.avatar_url
  return u != null && String(u).trim() && /^https?:\/\//i.test(String(u).trim()) ? String(u).trim() : ''
}

const detailBannerUrl = computed(() => resolveJobBanner(detailInfo.value))

const hasActiveFilters = computed(
  () =>
    Boolean(keyword.value.trim()) ||
    Boolean(locationQ.value.trim()) ||
    Boolean(appliedKeyword.value.trim()) ||
    Boolean(appliedLocation.value.trim()) ||
    salaryFilter.value !== 'all' ||
    workMode.value !== 'all',
)

async function runSearch() {
  appliedKeyword.value = keyword.value
  appliedLocation.value = locationQ.value
  /** 简化模式：关键词/地点不参与服务端筛选；仅刷新列表并滚动到列表区域 */
  await loadJobs(false)
  const el = document.getElementById('job-split')
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  await nextTick()
  if (isDesktop.value && jobList.value.length) {
    selectJob(jobList.value[0], { syncUrl: true })
  }
}

function clearClientFilters() {
  keyword.value = ''
  locationQ.value = ''
  appliedKeyword.value = ''
  appliedLocation.value = ''
  salaryFilter.value = 'all'
  workMode.value = 'all'
}

const changeCategory = (id) => {
  cateId.value = id
  /** 简化模式：分类仅作展示，不触发列表重新请求 */
}

/**
 * @param {boolean} append 为 true 时追加下一页（滚动加载）；false 时重置列表
 */
async function loadJobs(append) {
  if (append) {
    if (!hasMore.value || loadingMore.value || loading.value) return
    loadingMore.value = true
  } else {
    loading.value = true
    currentPage.value = 0
    jobList.value = []
    hasMore.value = true
    totalCount.value = null
  }
  loadError.value = ''

  const page = append ? currentPage.value : 0
  const { data, error, count } = await fetchJobsPage({
    page,
    pageSize: PAGE_SIZE,
    sort: sortOrder.value,
  })

  if (append) loadingMore.value = false
  else loading.value = false

  if (error) {
    loadError.value = error.message || '加载失败，请稍后再试'
    console.error(error)
    return
  }

  const rows = data ?? []
  if (append) {
    const seen = new Set(jobList.value.map((j) => String(j.id)))
    for (const r of rows) {
      const sid = String(r.id)
      if (!seen.has(sid)) {
        jobList.value.push(r)
        seen.add(sid)
      }
    }
  } else {
    jobList.value = rows
  }

  if (typeof count === 'number') {
    totalCount.value = count
    hasMore.value = jobList.value.length < count
  } else {
    hasMore.value = rows.length >= PAGE_SIZE
  }
  if (rows.length === 0 && append) hasMore.value = false

  currentPage.value = page + 1
  if (!append) {
    await syncSelectionAfterLoad()
  }
  await nextTick()
  setupLoadMoreObserver()
}

async function loadMoreJobs() {
  if (loadMoreLock) return
  if (loading.value || loadingMore.value || !hasMore.value || loadError.value) return
  loadMoreLock = true
  try {
    await loadJobs(true)
  } finally {
    loadMoreLock = false
  }
}

function setupLoadMoreObserver() {
  loadMoreObserver?.disconnect()
  loadMoreObserver = null
  const root = listScrollRoot.value
  const target = loadMoreSentinel.value
  if (!root || !target || typeof IntersectionObserver === 'undefined') return
  loadMoreObserver = new IntersectionObserver(
    (entries) => {
      if (!entries[0]?.isIntersecting) return
      if (loading.value || loadingMore.value || !hasMore.value || loadError.value || loadMoreLock) return
      void loadMoreJobs()
    },
    { root, rootMargin: '100px', threshold: 0 },
  )
  loadMoreObserver.observe(target)
}

async function fetchDetail(id) {
  if (!id) {
    detailInfo.value = null
    detailLoading.value = false
    return
  }
  const seq = ++fetchDetailSeq
  detailLoading.value = true
  detailInfo.value = null
  try {
    const { data, error } = await getJobDetail(id)
    if (seq !== fetchDetailSeq) return
    if (error || !data) {
      detailInfo.value = null
      return
    }
    detailInfo.value = data
    /** 与右侧预览同源：更新左侧列表中对应卡片（编辑返回后列表接口与详情略差时也能对齐） */
    const idx = jobList.value.findIndex((x) => String(x.id) === String(id))
    if (idx >= 0) {
      jobList.value.splice(idx, 1, data)
    }
  } finally {
    if (seq === fetchDetailSeq) detailLoading.value = false
  }
}

function mergeQuery(partial) {
  const q = { ...route.query, ...partial }
  Object.keys(q).forEach((k) => {
    if (q[k] === undefined || q[k] === '') delete q[k]
  })
  return q
}

async function selectJob(job, { syncUrl = true } = {}) {
  if (!isDesktop.value) {
    void router.push(`/detail/${job.id}`)
    return
  }
  selectedJobId.value = String(job.id)
  await fetchDetail(job.id)
  if (syncUrl) {
    router.replace({ query: mergeQuery({ job: String(job.id) }) })
  }
}

function syncSelectionAfterLoad() {
  if (!isDesktop.value) return Promise.resolve()
  const jobs = jobList.value
  if (!jobs.length) {
    selectedJobId.value = null
    detailInfo.value = null
    if (route.query.job != null && String(route.query.job) !== '') {
      const q = { ...route.query }
      delete q.job
      router.replace({ query: q })
    }
    return Promise.resolve()
  }
  const fromUrl = route.query.job
  if (fromUrl && jobs.some((j) => String(j.id) === String(fromUrl))) {
    selectedJobId.value = String(fromUrl)
    return fetchDetail(fromUrl)
  }
  return selectJob(jobs[0], { syncUrl: true })
}

watch(
  () => route.query.job,
  (job) => {
    if (!isDesktop.value || loading.value) return
    if (!job) {
      void syncSelectionAfterLoad()
      return
    }
    const j = jobList.value.find((x) => String(x.id) === String(job))
    if (j) {
      selectedJobId.value = String(job)
      void fetchDetail(job)
    }
  },
)

const delJob = async (id) => {
  if (!confirm('确定删除这条兼职？')) return

  const { error } = await deleteJobById(id)

  if (error) {
    alert('删除失败')
  } else {
    if (String(selectedJobId.value) === String(id)) {
      selectedJobId.value = null
      detailInfo.value = null
    }
    await loadJobs(false)
  }
}

const formatTime = (timeStr) => {
  if (!timeStr) return ''
  return new Date(timeStr).toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const formatRelative = (timeStr) => {
  if (!timeStr) return ''
  const diff = Date.now() - new Date(timeStr).getTime()
  const d = Math.floor(diff / 86400000)
  if (d <= 0) return '今天'
  if (d === 1) return '1 天前'
  if (d < 30) return `${d} 天前`
  return formatTime(timeStr)
}

async function clearFilters() {
  clearClientFilters()
  cateId.value = 0
  await loadJobs(false)
}

const telHref = (phone) => {
  if (!phone) return '#'
  return `tel:${String(phone).replace(/\s/g, '')}`
}

watch(sortOrder, () => {
  void loadJobs(false)
})

let stopListAfterEach = null

onMounted(async () => {
  updateMq()
  window.addEventListener('resize', updateMq)

  stopListAfterEach = router.afterEach((to, from) => {
    if (to.name !== 'job-list' || !isDesktop.value) return
    const prev = from?.name
    if (prev !== 'job-edit' && prev !== 'job-detail') return
    const rid = from?.params?.id
    if (rid == null || String(rid).trim() === '') return
    void (async () => {
      const { data, error } = await getJobDetail(rid)
      if (error || !data) return
      const sid = String(rid)
      const idx = jobList.value.findIndex((x) => String(x.id) === sid)
      if (idx >= 0) {
        jobList.value.splice(idx, 1, data)
      }
      if (String(selectedJobId.value) === sid) {
        detailInfo.value = data
      }
    })()
  })

  await loadJobs(false)

  queueMicrotask(() => {
    void getCurrentUser().then((user) => {
      if (user) {
        loginUserId.value = user.id
        loginUser.value = user
      }
    })
  })

  const runIdle = typeof requestIdleCallback === 'function' ? requestIdleCallback : (cb) => setTimeout(cb, 1)
  runIdle(() => {
    void getCategoryList().then((catRes) => {
      categoryList.value = catRes.data ?? []
    })
  })
})

watch(isDesktop, (wide) => {
  if (wide) nextTick(() => void syncSelectionAfterLoad())
})

onUnmounted(() => {
  stopListAfterEach?.()
  stopListAfterEach = null
  window.removeEventListener('resize', updateMq)
  loadMoreObserver?.disconnect()
  loadMoreObserver = null
})
</script>

<template>
  <div class="min-h-screen bg-slate-100/90 pb-10 sm:pb-12">
    <section
      class="relative overflow-hidden border-b border-slate-900/15 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 pb-6 pt-7 text-white shadow-sm sm:pb-7 sm:pt-8 lg:pb-9 lg:pt-10"
    >
      <div
        class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_90%_at_70%_-30%,rgb(59_130_246/0.14),transparent_55%)]"
      />
      <div class="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">职位大厅</p>
        <h1 class="mt-2 text-balance text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-[1.75rem]">
          找到适合你的校园兼职
        </h1>
        <p class="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400 sm:text-[0.9375rem]">
          在招岗位按发布时间展示；支持分栏预览与移动端详情。下方筛选项为界面预留，当前版本不参与过滤。
        </p>

        <div class="mt-7 flex flex-col gap-3 lg:mt-8 lg:flex-row lg:items-stretch lg:gap-4">
          <div class="flex flex-1 flex-col gap-3 sm:flex-row sm:gap-3">
            <div class="relative min-h-[2.875rem] flex-1">
              <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                <svg class="h-[1.125rem] w-[1.125rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </span>
              <input
                v-model="keyword"
                type="search"
                placeholder="职位、关键词…"
                class="app-hero-field pl-10"
                @keydown.enter.prevent="runSearch"
              />
            </div>
            <div class="relative min-h-[2.875rem] flex-1">
              <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                <svg class="h-[1.125rem] w-[1.125rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </span>
              <input
                v-model="locationQ"
                type="text"
                placeholder="城市、校区…"
                class="app-hero-field pl-10"
                @keydown.enter.prevent="runSearch"
              />
            </div>
          </div>
          <div class="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col lg:justify-stretch xl:flex-row xl:items-stretch">
            <button
              type="button"
              class="inline-flex min-h-[2.875rem] items-center justify-center rounded-[var(--app-radius)] bg-brand-600 px-7 text-sm font-semibold text-white shadow-md shadow-black/25 transition duration-200 hover:bg-brand-500 active:scale-[0.99] lg:min-w-[6.5rem]"
              @click="runSearch"
            >
              搜索
            </button>
            <button
              type="button"
              class="inline-flex min-h-[2.875rem] items-center justify-center rounded-[var(--app-radius)] border border-white/20 bg-white/5 px-5 text-sm font-semibold text-white transition duration-200 hover:border-white/30 hover:bg-white/10 active:scale-[0.99]"
              @click="goPublish"
            >
              {{ canPublish ? '发布职位' : '招聘方入驻' }}
            </button>
          </div>
        </div>

        <!-- 分类胶囊（展示用，当前不参与列表过滤） -->
        <div
          class="mt-6 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <button
            type="button"
            class="shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition duration-200"
            :class="cateId === 0 ? 'app-hero-chip-active border-transparent' : 'app-hero-chip'"
            @click="changeCategory(0)"
          >
            全部分类
          </button>
          <button
            v-for="item in categoryList"
            :key="item.id"
            v-memo="[item.id, item.name, cateId]"
            type="button"
            class="shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition duration-200"
            :class="cateId === item.id ? 'app-hero-chip-active border-transparent' : 'app-hero-chip'"
            @click="changeCategory(item.id)"
          >
            {{ item.name }}
          </button>
        </div>

        <!-- 筛选区（展示用，当前不参与列表过滤） -->
        <div class="mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-5">
          <span
            class="mr-1 w-full text-[10px] font-semibold uppercase tracking-wider text-slate-500 lg:w-auto lg:self-center"
            >筛选</span
          >
          <button
            v-for="opt in [
              { k: 'all', l: '薪资不限' },
              { k: 'negotiable', l: '面议 / 未写' },
              { k: 'specified', l: '已写金额' },
            ]"
            :key="opt.k"
            type="button"
            class="rounded-full border px-3 py-1.5 text-xs font-medium transition duration-200"
            :class="salaryFilter === opt.k ? 'app-hero-chip-active border-transparent' : 'app-hero-chip py-1.5'"
            @click="salaryFilter = opt.k"
          >
            {{ opt.l }}
          </button>
          <button
            v-for="opt in [
              { k: 'all', l: '地点形式不限' },
              { k: 'remote', l: '可远程 / 线上' },
              { k: 'onsite', l: '以到岗为主' },
            ]"
            :key="'w-' + opt.k"
            type="button"
            class="rounded-full border px-3 py-1.5 text-xs font-medium transition duration-200"
            :class="workMode === opt.k ? 'app-hero-chip-active border-transparent' : 'app-hero-chip py-1.5'"
            @click="workMode = opt.k"
          >
            {{ opt.l }}
          </button>
          <button
            v-if="hasActiveFilters || cateId !== 0"
            type="button"
            class="rounded-full border border-white/20 px-3 py-1.5 text-xs font-medium text-slate-200 transition duration-200 hover:bg-white/10"
            @click="clearFilters"
          >
            清除条件
          </button>
        </div>
      </div>
    </section>

    <div class="mx-auto max-w-7xl px-4 pt-5 sm:px-6 sm:pt-6 lg:px-8">
      <div
        v-if="showForbiddenPublish"
        class="mb-4 flex flex-col gap-3 rounded-[var(--app-radius-lg)] border border-amber-200/90 bg-amber-50/95 px-4 py-3.5 text-sm text-amber-950 shadow-sm sm:flex-row sm:items-center sm:justify-between"
        role="status"
      >
        <p>
          <span class="font-semibold">权限提示：</span>
          学生账号无法发布。
          <RouterLink to="/register?role=publisher" class="font-medium text-amber-900 underline">招聘方注册</RouterLink>
        </p>
        <button type="button" class="text-xs font-semibold text-amber-900 underline" @click="showForbiddenPublish = false">
          关闭
        </button>
      </div>

      <p class="mb-4 text-center text-xs text-slate-500 lg:hidden">轻触卡片查看完整职位详情</p>

      <div
        v-if="loading || jobList.length"
        id="job-split"
        class="overflow-hidden rounded-[var(--app-radius-xl)] border border-slate-200/90 bg-white shadow-card ring-1 ring-slate-900/[0.03] lg:flex lg:min-h-[calc(100dvh-12.5rem)]"
      >
        <!-- 左侧列表 -->
        <aside
          class="flex flex-col border-slate-200/90 lg:w-[38%] lg:min-w-[300px] lg:max-w-[440px] lg:border-r lg:bg-slate-50/40"
        >
          <div
            class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 bg-white px-3 py-3 sm:px-4"
          >
            <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <span
                class="inline-flex items-center rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold text-white tabular-nums shadow-sm"
              >
                <template v-if="totalCount != null && totalCount > jobList.length">
                  {{ jobList.length }} / {{ totalCount }} 条（已加载 / 共）
                </template>
                <template v-else> {{ jobList.length }} 个岗位 </template>
              </span>
              <span
                v-if="totalCount != null && totalCount > jobList.length"
                class="max-w-[14rem] text-[10px] leading-snug text-slate-500 lg:max-w-none"
                >上拉或点击加载更多获取其余岗位。</span
              >
            </div>
            <div class="flex shrink-0 items-center gap-2">
              <label for="job-sort-select" class="text-[10px] font-semibold uppercase tracking-wide text-slate-500"
                >排序</label
              >
              <select
                id="job-sort-select"
                v-model="sortOrder"
                class="max-w-[10.5rem] cursor-pointer rounded-md border border-slate-200 bg-white py-1.5 pl-2.5 pr-7 text-xs font-medium text-slate-800 shadow-sm outline-none transition duration-200 hover:border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
              >
                <option value="new">最新优先</option>
                <option value="old">最早发布</option>
                <option value="title">标题 A → Z</option>
              </select>
            </div>
          </div>

          <div v-if="loadError" class="border-b border-red-100 bg-red-50/90 px-3 py-2.5 text-xs text-red-900 sm:px-4">
            {{ loadError }}
            <button
              type="button"
              class="ml-2 font-semibold text-red-800 underline decoration-red-300 underline-offset-2 transition hover:text-red-950"
              @click="loadJobs(false)"
              >重试</button
            >
          </div>

          <div
            ref="listScrollRoot"
            class="flex-1 space-y-2 overflow-y-auto overscroll-contain p-2.5 sm:p-3 lg:max-h-[calc(100dvh-12.5rem)]"
          >
            <template v-if="loading">
              <div
                v-for="n in 5"
                :key="n"
                class="h-28 animate-pulse rounded-[var(--app-radius-lg)] bg-slate-200/60"
              />
            </template>
            <template v-else>
              <button
                v-for="item in jobList"
                :key="item.id"
                v-memo="[
                  item.id,
                  item.title,
                  item.created_at,
                  item.price,
                  item.work_time,
                  item.address,
                  item.content,
                  item.work_arrangement,
                  item.user_id,
                  item.nickname,
                  item.job_category?.name,
                  item.publisher_public?.avatar_url,
                  selectedJobId,
                  isDesktop,
                ]"
                type="button"
                class="app-job-row group"
                :class="isDesktop && String(selectedJobId) === String(item.id) ? 'app-job-row-selected' : ''"
                @click="selectJob(item)"
              >
                <div class="flex gap-3 sm:gap-3.5">
                  <div
                    class="relative h-[4.25rem] w-[4.25rem] shrink-0 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200/80 transition duration-200 group-hover:ring-slate-300/80"
                  >
                    <img
                      :src="resolveJobBanner(item)"
                      alt=""
                      width="68"
                      height="68"
                      class="h-full w-full object-cover"
                      loading="lazy"
                      decoding="async"
                      @error="(e) => { e.target.style.opacity = '0' }"
                    />
                  </div>
                  <div class="min-w-0 flex-1">
                    <h3 class="line-clamp-2 text-[0.9375rem] font-semibold leading-snug tracking-tight text-slate-900 sm:text-base">
                      {{ item.title }}
                    </h3>
                    <div class="mt-1 flex items-center gap-2">
                      <UserAvatar
                        v-if="item.user_id"
                        :custom-avatar-url="publisherAvatarUrlFromJob(item)"
                        :seed-user-id="String(item.user_id)"
                        size-class="h-7 w-7 shrink-0"
                        ring-class="ring-1 ring-slate-200/90"
                      />
                      <p class="text-xs font-medium text-slate-500">{{ item.nickname || '匿名发布' }}</p>
                    </div>
                    <ul class="mt-2 space-y-0.5 text-[11px] leading-relaxed text-slate-500">
                      <li>· {{ workArrangementLabel(item.work_arrangement) }}</li>
                      <li v-if="item.price">· {{ item.price }}</li>
                      <li v-if="item.work_time">· {{ item.work_time }}</li>
                      <li>· {{ item.address || '地点待定' }}</li>
                    </ul>
                    <p class="mt-2 line-clamp-2 text-[11px] text-slate-500">
                      {{ item.content || '点击查看详情与联系方式。' }}
                    </p>
                  </div>
                  <div class="flex shrink-0 flex-col items-end justify-between">
                    <span
                      class="rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                      :class="
                        item.job_category?.name
                          ? 'bg-slate-100 text-slate-700 ring-1 ring-slate-200/80'
                          : 'bg-slate-50 text-slate-500 ring-1 ring-slate-200/60'
                      "
                      >{{ item.job_category?.name || '未分类' }}</span
                    >
                    <span class="text-[10px] text-slate-400">{{ formatRelative(item.created_at) }}</span>
                  </div>
                </div>
                <div class="mt-3 flex items-center justify-end gap-2 border-t border-slate-100 pt-2.5">
                  <span class="text-[10px] font-medium text-slate-400">{{ isDesktop ? '右侧预览' : '查看详情' }}</span>
                  <template v-if="isMine(item.user_id)">
                    <RouterLink
                      :to="`/edit-job/${item.id}`"
                      class="text-[10px] font-semibold text-brand-600/90 transition hover:text-brand-700 hover:underline"
                      @click.stop
                    >
                      编辑
                    </RouterLink>
                    <button
                      type="button"
                      class="text-[10px] font-semibold text-red-600/90 transition hover:text-red-700 hover:underline"
                      @click.stop.prevent="delJob(item.id)"
                    >
                      删除
                    </button>
                  </template>
                </div>
              </button>
            </template>
            <div ref="loadMoreSentinel" class="h-2 w-full shrink-0" aria-hidden="true" />
            <p v-if="loadingMore" class="py-3 text-center text-xs text-slate-500">加载更多…</p>
            <button
              v-else-if="hasMore && !loading && jobList.length > 0"
              type="button"
              class="w-full rounded-[var(--app-radius)] border border-slate-200 bg-white py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition duration-200 hover:border-slate-300 hover:bg-slate-50"
              @click="loadMoreJobs"
            >
              加载更多
            </button>
            <p v-else-if="!hasMore && jobList.length > 0 && !loading" class="py-3 text-center text-[11px] text-slate-400">
              已加载全部岗位
            </p>
          </div>
        </aside>

        <!-- 右侧详情（仅宽屏） -->
        <section class="relative hidden min-h-[420px] flex-1 flex-col bg-slate-50/50 lg:flex">
          <template v-if="!selectedJobId || (!detailLoading && !detailInfo)">
            <div class="flex flex-1 flex-col items-center justify-center p-10 text-center">
              <div
                class="flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-200 to-slate-300 shadow-inner ring-1 ring-slate-400/20"
              >
                <svg class="h-11 w-11 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.25"
                    d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
                  />
                </svg>
              </div>
              <p class="mt-6 text-lg font-semibold text-slate-800">选择左侧职位</p>
              <p class="mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
                点击任意岗位后，将在此处展示完整说明与招聘方联系方式。
              </p>
            </div>
          </template>

          <div v-else-if="detailLoading" class="flex-1 space-y-4 p-6">
            <div class="h-40 animate-pulse rounded-2xl bg-slate-200/80" />
            <div class="h-24 animate-pulse rounded-xl bg-slate-200/60" />
            <div class="h-32 animate-pulse rounded-xl bg-slate-200/60" />
          </div>

          <div v-else-if="detailInfo" class="flex-1 overflow-y-auto overscroll-contain">
            <div class="relative h-48 overflow-hidden bg-navy-950 sm:h-56">
              <img
                :src="detailBannerUrl"
                alt=""
                width="1200"
                height="480"
                class="absolute inset-0 h-full w-full object-cover"
                loading="lazy"
                decoding="async"
              />
              <div class="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/55 to-navy-900/20" />
              <div class="absolute inset-0 opacity-25 bg-grid-slate bg-[length:20px_20px]" />
              <div class="relative flex h-full flex-col justify-end p-6 sm:p-8">
                <p class="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-200">校兼</p>
                <h2 class="mt-1 line-clamp-2 text-xl font-bold tracking-tight text-white drop-shadow-sm sm:text-2xl">
                  {{ detailInfo.title }}
                </h2>
              </div>
            </div>

            <div class="space-y-6 p-6 sm:p-8">
              <div class="flex flex-wrap items-start justify-between gap-4">
                <div class="flex min-w-0 items-start gap-3">
                  <UserAvatar
                    v-if="detailInfo.user_id"
                    :custom-avatar-url="publisherAvatarUrlFromJob(detailInfo)"
                    :seed-user-id="String(detailInfo.user_id)"
                    size-class="h-11 w-11 shrink-0"
                    ring-class="ring-2 ring-slate-200/80"
                  />
                  <div class="min-w-0">
                    <p class="text-sm font-semibold text-navy-800">
                      {{ detailInfo.nickname }}
                      <span class="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">已认证展示</span>
                    </p>
                    <RouterLink
                      :to="`/detail/${detailInfo.id}`"
                      class="mt-1 inline-block text-xs font-semibold text-brand-600 underline-offset-2 transition hover:text-brand-700 hover:underline"
                    >
                      打开独立详情页
                    </RouterLink>
                    <RouterLink
                      v-if="isMine(detailInfo.user_id)"
                      :to="`/edit-job/${detailInfo.id}`"
                      class="mt-1 ml-2 inline-block text-xs font-semibold text-slate-600 underline-offset-2 transition hover:text-slate-800 hover:underline"
                    >
                      编辑职位
                    </RouterLink>
                  </div>
                </div>
                <p class="text-xs text-slate-400">发布于 {{ formatRelative(detailInfo.created_at) }}</p>
              </div>

              <div class="grid gap-3 sm:grid-cols-2">
                <div class="flex gap-3 rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
                  <span class="text-navy-400">
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                    </svg>
                  </span>
                  <div>
                    <p class="text-[11px] font-semibold uppercase text-slate-400">地点</p>
                    <p class="text-sm font-medium text-navy-900">{{ detailInfo.address || '待定' }}</p>
                  </div>
                </div>
                <div class="flex gap-3 rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
                  <span class="text-navy-400">
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                      />
                    </svg>
                  </span>
                  <div>
                    <p class="text-[11px] font-semibold uppercase text-slate-400">分类</p>
                    <p class="text-sm font-medium text-navy-900">{{ detailInfo.job_category?.name || '未分类' }}</p>
                  </div>
                </div>
                <div class="flex gap-3 rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
                  <span class="text-navy-400">
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </span>
                  <div>
                    <p class="text-[11px] font-semibold uppercase text-slate-400">时间</p>
                    <p class="text-sm font-medium text-navy-900">{{ detailInfo.work_time || '协商' }}</p>
                  </div>
                </div>
                <div class="flex gap-3 rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
                  <span class="text-navy-400">
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </span>
                  <div>
                    <p class="text-[11px] font-semibold uppercase text-slate-400">薪资</p>
                    <p class="text-sm font-medium text-navy-900">{{ detailInfo.price || '面议' }}</p>
                  </div>
                </div>
                <div class="flex gap-3 rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm sm:col-span-2">
                  <div class="min-w-0 flex-1">
                    <p class="text-[11px] font-semibold uppercase text-slate-400">工作形式</p>
                    <p class="mt-1 text-sm font-medium text-navy-900">
                      {{ workArrangementLabel(detailInfo.work_arrangement) }}
                    </p>
                  </div>
                </div>
              </div>

              <div class="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
                <h3 class="text-sm font-bold text-navy-900">职位说明</h3>
                <p class="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                  {{ detailInfo.content || '雇主未填写详细说明，请使用下方方式联系。' }}
                </p>
              </div>

              <div class="rounded-2xl border border-navy-100 bg-navy-900/5 p-5">
                <h3 class="text-xs font-bold uppercase tracking-wider text-navy-700">联系招聘方</h3>
                <a
                  v-if="detailInfo.phone"
                  :href="telHref(detailInfo.phone)"
                  class="mt-4 flex w-full items-center justify-center gap-2 rounded-[var(--app-radius)] bg-brand-600 py-3.5 text-sm font-semibold text-white shadow-md transition duration-200 hover:bg-brand-500"
                >
                  拨打电话
                </a>
                <p v-else class="mt-3 text-sm text-amber-800">未公开电话，请使用微信等方式。</p>
                <p v-if="detailInfo.wechat" class="mt-3 rounded-lg bg-white px-3 py-2 text-sm text-navy-900 ring-1 ring-slate-200">
                  微信：<span class="font-mono font-semibold">{{ detailInfo.wechat }}</span>
                </p>
              </div>

              <div class="rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-950">
                凡索要押金、刷单返利等多为诈骗；首次沟通请保留记录并选择公共场所。
              </div>
            </div>
          </div>
        </section>
      </div>

      <AppEmptyState
        v-if="!loading && !jobList.length"
        class="mt-8"
        title="暂无岗位"
        description="当前暂无在招岗位；招聘方可发布新岗位，或稍后再试。"
      >
        <template #actions>
          <button
            type="button"
            class="rounded-[var(--app-radius)] bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition duration-200 hover:bg-slate-800"
            @click="clearFilters"
          >
            刷新列表
          </button>
          <button
            type="button"
            class="rounded-[var(--app-radius)] border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition duration-200 hover:border-slate-300 hover:bg-slate-50"
            @click="goPublish"
          >
            {{ canPublish ? '发布职位' : '招聘方入驻' }}
          </button>
        </template>
      </AppEmptyState>

      <section
        class="mt-8 rounded-[var(--app-radius-xl)] border border-slate-200/90 bg-white p-5 text-sm leading-relaxed text-slate-600 shadow-sm sm:p-6"
      >
        <h3 class="text-sm font-semibold text-slate-900">投递提示</h3>
        <p class="mt-2 leading-relaxed">
          核对课表与通勤；保存岗位截图；薪资与工时尽量书面确认。手机端点左侧卡片将打开独立详情页，功能与右侧预览一致。
        </p>
      </section>
    </div>
  </div>
</template>
