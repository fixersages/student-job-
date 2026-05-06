<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter, useRoute, RouterLink } from 'vue-router'
import { supabase, getCategoryList, getCurrentUser, isPublisher } from '@/lib/supabase'
import AppEmptyState from '@/components/AppEmptyState.vue'
import { resolveJobBanner } from '@/utils/jobBanner'

const router = useRouter()
const route = useRoute()

const jobList = ref([])
const categoryList = ref([])
const cateId = ref(0)
const loginUserId = ref('')
const loginUser = ref(null)
const keyword = ref('')
const locationQ = ref('')
const loading = ref(true)
const loadError = ref('')
const showForbiddenPublish = ref(false)

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

const canPublish = computed(() => !loginUser.value || isPublisher(loginUser.value))

function goPublish() {
  if (canPublish.value) router.push('/publish')
  else router.push('/register?role=publisher')
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

const textBlob = (j) =>
  `${j.title || ''} ${j.address || ''} ${j.content || ''} ${j.work_time || ''}`.toLowerCase()

const displayJobs = computed(() => {
  let list = [...jobList.value]
  const kw = keyword.value.trim().toLowerCase()
  const loc = locationQ.value.trim().toLowerCase()
  if (kw) {
    list = list.filter(
      (j) =>
        j.title?.toLowerCase().includes(kw) ||
        j.address?.toLowerCase().includes(kw) ||
        j.nickname?.toLowerCase().includes(kw) ||
        j.content?.toLowerCase().includes(kw),
    )
  }
  if (loc) {
    list = list.filter((j) => j.address?.toLowerCase().includes(loc))
  }
  if (salaryFilter.value === 'negotiable') {
    list = list.filter((j) => !j.price || String(j.price).includes('面议'))
  }
  if (salaryFilter.value === 'specified') {
    list = list.filter((j) => j.price && !String(j.price).includes('面议'))
  }
  if (workMode.value === 'remote') {
    list = list.filter((j) => {
      const t = textBlob(j)
      return t.includes('远程') || t.includes('线上') || t.includes('在家')
    })
  }
  if (workMode.value === 'onsite') {
    list = list.filter((j) => {
      const t = textBlob(j)
      return !t.includes('远程') && !t.includes('线上') && !t.includes('在家')
    })
  }
  if (sortOrder.value === 'title') {
    list.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'zh-CN'))
  } else {
    list.sort((a, b) => {
      const ta = new Date(a.created_at).getTime()
      const tb = new Date(b.created_at).getTime()
      return sortOrder.value === 'new' ? tb - ta : ta - tb
    })
  }
  return list
})

const detailBannerUrl = computed(() => resolveJobBanner(detailInfo.value))

const hasActiveFilters = computed(
  () =>
    Boolean(keyword.value.trim()) ||
    Boolean(locationQ.value.trim()) ||
    salaryFilter.value !== 'all' ||
    workMode.value !== 'all',
)

function runSearch() {
  const el = document.getElementById('job-split')
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  if (isDesktop.value && displayJobs.value.length) {
    selectJob(displayJobs.value[0], { syncUrl: true })
  }
}

function clearClientFilters() {
  keyword.value = ''
  locationQ.value = ''
  salaryFilter.value = 'all'
  workMode.value = 'all'
}

const changeCategory = async (id) => {
  cateId.value = id
  await getJobList()
}

const getJobList = async () => {
  loading.value = true
  loadError.value = ''
  let query = supabase
    .from('part_time')
    .select('*, job_category(name)')
    .order('created_at', { ascending: false })

  if (cateId.value !== 0) {
    query = query.eq('category_id', cateId.value)
  }

  const { data, error } = await query
  loading.value = false
  if (error) {
    loadError.value = error.message || '加载失败，请稍后再试'
    console.error(error)
    return
  }
  jobList.value = data ?? []
  syncSelectionAfterLoad()
}

async function fetchDetail(id) {
  if (!id) {
    detailInfo.value = null
    return
  }
  detailLoading.value = true
  detailInfo.value = null
  const { data, error } = await supabase
    .from('part_time')
    .select('*, job_category(name)')
    .eq('id', id)
    .single()
  detailLoading.value = false
  if (error || !data) {
    detailInfo.value = null
    return
  }
  detailInfo.value = data
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
    router.push(`/detail/${job.id}`)
    return
  }
  selectedJobId.value = String(job.id)
  await fetchDetail(job.id)
  if (syncUrl) {
    router.replace({ query: mergeQuery({ job: String(job.id) }) })
  }
}

function syncSelectionAfterLoad() {
  if (!isDesktop.value) return
  const jobs = displayJobs.value
  if (!jobs.length) {
    selectedJobId.value = null
    detailInfo.value = null
    const q = { ...route.query }
    delete q.job
    router.replace({ query: q })
    return
  }
  const fromUrl = route.query.job
  if (fromUrl && jobs.some((j) => String(j.id) === String(fromUrl))) {
    selectedJobId.value = String(fromUrl)
    fetchDetail(fromUrl)
    return
  }
  selectJob(jobs[0], { syncUrl: true })
}

watch(
  () => route.query.job,
  (job) => {
    if (!isDesktop.value || loading.value) return
    if (!job) {
      syncSelectionAfterLoad()
      return
    }
    if (String(selectedJobId.value) === String(job)) return
    const j = displayJobs.value.find((x) => String(x.id) === String(job))
    if (j) {
      selectedJobId.value = String(job)
      fetchDetail(job)
    }
  },
)

watch([salaryFilter, workMode, sortOrder, keyword, locationQ], () => {
  if (!isDesktop.value || loading.value) return
  nextTick(() => {
    if (!displayJobs.value.length) {
      selectedJobId.value = null
      detailInfo.value = null
      return
    }
    const still = displayJobs.value.some((j) => String(j.id) === String(selectedJobId.value))
    if (!still) {
      selectJob(displayJobs.value[0], { syncUrl: true })
    }
  })
})

const delJob = async (id) => {
  if (!confirm('确定删除这条兼职？')) return

  const { error } = await supabase.from('part_time').delete().eq('id', id)

  if (error) {
    alert('删除失败')
  } else {
    if (String(selectedJobId.value) === String(id)) {
      selectedJobId.value = null
      detailInfo.value = null
    }
    getJobList()
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

function clearFilters() {
  clearClientFilters()
  cateId.value = 0
  getJobList()
}

const telHref = (phone) => {
  if (!phone) return '#'
  return `tel:${String(phone).replace(/\s/g, '')}`
}

onMounted(async () => {
  updateMq()
  window.addEventListener('resize', updateMq)

  const user = await getCurrentUser()
  if (user) {
    loginUserId.value = user.id
    loginUser.value = user
  }

  const { data } = await getCategoryList()
  categoryList.value = data ?? []

  await getJobList()
})

watch(isDesktop, (wide) => {
  if (wide) nextTick(() => syncSelectionAfterLoad())
})

onUnmounted(() => {
  window.removeEventListener('resize', updateMq)
})
</script>

<template>
  <div class="min-h-screen bg-panel pb-10">
    <!-- JobsDB 风格：深蓝搜索区 -->
    <section class="relative bg-navy-900 pb-5 pt-6 text-white shadow-lg lg:pt-8">
      <div
        class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_100%_0%,rgb(236_72_153/0.18),transparent)]"
      />
      <div class="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200/90">职位搜索</p>
        <h1 class="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">找到适合你的校园兼职</h1>
        <p class="mt-2 max-w-2xl text-sm text-white/70 sm:text-base">
          关键词 + 地点双栏搜索；下方筛选真实过滤列表。宽屏左侧选岗、右侧即时预览详情。
        </p>

        <div class="mt-6 flex flex-col gap-3 lg:flex-row lg:items-stretch">
          <div class="flex flex-1 flex-col gap-3 sm:flex-row">
            <div class="relative min-h-[3rem] flex-1">
              <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-navy-400">
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                placeholder="职位、公司关键词…"
                class="h-full min-h-[3rem] w-full rounded-xl border-0 bg-white pl-11 pr-4 text-navy-900 shadow-md placeholder:text-slate-400 focus:ring-2 focus:ring-accent-400"
                @keydown.enter.prevent="runSearch"
              />
            </div>
            <div class="relative min-h-[3rem] flex-1">
              <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-navy-400">
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                placeholder="城市、校区或地区…"
                class="h-full min-h-[3rem] w-full rounded-xl border-0 bg-white pl-11 pr-4 text-navy-900 shadow-md placeholder:text-slate-400 focus:ring-2 focus:ring-accent-400"
                @keydown.enter.prevent="runSearch"
              />
            </div>
          </div>
          <div class="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col lg:justify-stretch xl:flex-row">
            <button
              type="button"
              class="inline-flex min-h-[3rem] items-center justify-center rounded-xl bg-accent-500 px-8 text-sm font-bold text-white shadow-lg shadow-accent-600/35 transition hover:bg-accent-600 active:scale-[0.99] lg:min-w-[7.5rem]"
              @click="runSearch"
            >
              寻找
            </button>
            <button
              type="button"
              class="inline-flex min-h-[3rem] items-center justify-center rounded-xl border border-white/30 bg-white/10 px-5 text-sm font-semibold text-white transition hover:bg-white/20"
              @click="goPublish"
            >
              {{ canPublish ? '发布职位' : '招聘方' }}
            </button>
          </div>
        </div>

        <!-- 分类胶囊（服务端筛选） -->
        <div class="mt-5 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            class="shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition"
            :class="
              cateId === 0
                ? 'border-accent-400 bg-accent-500 text-white shadow-md'
                : 'border-white/25 bg-white/5 text-white/90 hover:bg-white/10'
            "
            @click="changeCategory(0)"
          >
            全部分类
          </button>
          <button
            v-for="item in categoryList"
            :key="item.id"
            type="button"
            class="shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition"
            :class="
              cateId === item.id
                ? 'border-accent-400 bg-accent-500 text-white shadow-md'
                : 'border-white/25 bg-white/5 text-white/90 hover:bg-white/10'
            "
            @click="changeCategory(item.id)"
          >
            {{ item.name }}
          </button>
        </div>

        <!-- 客户端筛选条 -->
        <div class="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
          <span class="mr-1 w-full text-[11px] font-semibold uppercase tracking-wide text-white/50 lg:w-auto lg:self-center">筛选</span>
          <button
            v-for="opt in [
              { k: 'all', l: '薪资：全部' },
              { k: 'negotiable', l: '面议为主' },
              { k: 'specified', l: '已写薪资' },
            ]"
            :key="opt.k"
            type="button"
            class="rounded-full border px-3 py-1.5 text-xs font-medium transition"
            :class="
              salaryFilter === opt.k
                ? 'border-amber-300 bg-amber-400/90 text-navy-950'
                : 'border-white/20 bg-navy-800/80 text-white/85 hover:bg-navy-800'
            "
            @click="salaryFilter = opt.k"
          >
            {{ opt.l }}
          </button>
          <button
            v-for="opt in [
              { k: 'all', l: '工作方式：全部' },
              { k: 'remote', l: '可远程/线上' },
              { k: 'onsite', l: '到岗为主' },
            ]"
            :key="'w-' + opt.k"
            type="button"
            class="rounded-full border px-3 py-1.5 text-xs font-medium transition"
            :class="
              workMode === opt.k
                ? 'border-cyan-300 bg-cyan-400/90 text-navy-950'
                : 'border-white/20 bg-navy-800/80 text-white/85 hover:bg-navy-800'
            "
            @click="workMode = opt.k"
          >
            {{ opt.l }}
          </button>
          <button
            v-if="hasActiveFilters || cateId !== 0"
            type="button"
            class="rounded-full border border-white/30 px-3 py-1.5 text-xs font-medium text-white/90 hover:bg-white/10"
            @click="clearFilters"
          >
            清除全部条件
          </button>
        </div>
      </div>
    </section>

    <div class="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
      <div
        v-if="showForbiddenPublish"
        class="mb-4 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between"
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

      <p class="mb-3 text-center text-xs text-slate-500 lg:hidden">↓ 点击卡片查看完整详情页</p>

      <div
        v-if="loading || displayJobs.length"
        id="job-split"
        class="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-card lg:flex lg:min-h-[calc(100dvh-13rem)]"
      >
        <!-- 左侧列表 -->
        <aside
          class="flex flex-col border-slate-200 lg:w-[38%] lg:min-w-[300px] lg:max-w-[440px] lg:border-r lg:bg-white"
        >
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/95 px-3 py-3">
            <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <span
                class="inline-flex items-center rounded-full bg-navy-900 px-3 py-1 text-xs font-bold text-white tabular-nums"
              >
                {{ displayJobs.length }} 个岗位
              </span>
              <span v-if="hasActiveFilters" class="text-[11px] font-medium text-accent-600">已筛选</span>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              <label for="job-sort-select" class="text-[11px] font-semibold text-slate-500">排序</label>
              <select
                id="job-sort-select"
                v-model="sortOrder"
                class="max-w-[10.5rem] cursor-pointer rounded-lg border border-slate-200 bg-white py-1.5 pl-2 pr-8 text-xs font-medium text-navy-900 shadow-sm outline-none transition hover:border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              >
                <option value="new">最新优先</option>
                <option value="old">最早发布</option>
                <option value="title">标题 A → Z</option>
              </select>
            </div>
          </div>

          <div v-if="loadError" class="border-b border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {{ loadError }}
            <button type="button" class="ml-2 font-semibold underline" @click="getJobList">重试</button>
          </div>

          <div class="flex-1 space-y-2 overflow-y-auto overscroll-contain p-2 lg:max-h-[calc(100dvh-13rem)]">
            <template v-if="loading">
              <div v-for="n in 5" :key="n" class="h-28 animate-pulse rounded-xl bg-slate-100" />
            </template>
            <template v-else>
              <button
                v-for="item in displayJobs"
                :key="item.id"
                type="button"
                class="w-full rounded-xl border bg-white p-4 text-left transition duration-200"
                :class="
                  isDesktop && String(selectedJobId) === String(item.id)
                    ? 'border-navy-600 shadow-card-active ring-1 ring-brand-500/30'
                    : 'border-slate-200/90 hover:border-slate-300 hover:shadow-md'
                "
                @click="selectJob(item)"
              >
                <div class="flex gap-3">
                  <div class="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200/80">
                    <img
                      :src="resolveJobBanner(item)"
                      alt=""
                      class="h-full w-full object-cover"
                      loading="lazy"
                      decoding="async"
                      @error="(e) => { e.target.style.opacity = '0' }"
                    />
                  </div>
                  <div class="min-w-0 flex-1">
                    <h3 class="line-clamp-2 text-[15px] font-bold leading-snug text-navy-800">
                      {{ item.title }}
                    </h3>
                    <p class="mt-1 text-xs font-medium text-slate-600">{{ item.nickname || '匿名发布' }}</p>
                    <ul class="mt-2 space-y-0.5 text-[11px] leading-relaxed text-slate-500">
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
                      class="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                      :class="
                        item.job_category?.name
                          ? 'bg-fuchsia-100 text-fuchsia-800'
                          : 'bg-slate-100 text-slate-600'
                      "
                      >{{ item.job_category?.name || '未分类' }}</span
                    >
                    <span class="text-[10px] text-slate-400">{{ formatRelative(item.created_at) }}</span>
                  </div>
                </div>
                <div class="mt-3 flex items-center justify-between border-t border-slate-100 pt-2">
                  <span class="text-[10px] text-slate-400">{{ isDesktop ? '预览右侧' : '进入详情' }}</span>
                  <button
                    v-if="isMine(item.user_id)"
                    type="button"
                    class="text-[10px] font-semibold text-red-600 hover:underline"
                    @click.stop.prevent="delJob(item.id)"
                  >
                    删除
                  </button>
                </div>
              </button>
            </template>
          </div>
        </aside>

        <!-- 右侧详情（仅宽屏） -->
        <section class="relative hidden min-h-[420px] flex-1 flex-col bg-panel lg:flex">
          <template v-if="!selectedJobId || (!detailLoading && !detailInfo)">
            <div class="flex flex-1 flex-col items-center justify-center p-10 text-center">
              <div
                class="flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-accent-200 to-accent-500 shadow-inner"
              >
                <svg class="h-14 w-14 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.25"
                    d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
                  />
                </svg>
              </div>
              <p class="mt-8 text-lg font-bold text-navy-900">← 选择一份工作</p>
              <p class="mt-2 max-w-sm text-sm text-slate-600">在左侧列表中点击任意岗位，此处将展示完整说明与招聘方联系方式。</p>
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
                class="absolute inset-0 h-full w-full object-cover"
                loading="eager"
                decoding="async"
              />
              <div class="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/55 to-navy-900/20" />
              <div class="absolute inset-0 opacity-25 bg-grid-slate bg-[length:20px_20px]" />
              <div class="relative flex h-full flex-col justify-end p-6 sm:p-8">
                <p class="text-xs font-bold uppercase tracking-widest text-accent-200">#JoinCampus</p>
                <h2 class="mt-1 line-clamp-2 text-xl font-bold text-white drop-shadow sm:text-2xl">
                  {{ detailInfo.title }}
                </h2>
              </div>
            </div>

            <div class="space-y-6 p-6 sm:p-8">
              <div class="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p class="text-sm font-semibold text-navy-800">
                    {{ detailInfo.nickname }}
                    <span class="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">已认证展示</span>
                  </p>
                  <RouterLink
                    :to="`/detail/${detailInfo.id}`"
                    class="mt-1 inline-block text-xs font-semibold text-accent-600 underline-offset-2 hover:underline"
                  >
                    打开独立详情页（分享链接）
                  </RouterLink>
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
                  class="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent-500 py-3.5 text-sm font-bold text-white shadow-lg transition hover:bg-accent-600"
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
        v-if="!loading && !displayJobs.length"
        class="mt-8"
        title="暂无岗位"
        description="调整分类、关键词、地点或筛选条件后再试；招聘方可发布新岗位。"
      >
        <template #actions>
          <button type="button" class="rounded-xl bg-navy-900 px-5 py-2.5 text-sm font-semibold text-white" @click="clearFilters">
            重置条件
          </button>
          <button type="button" class="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold" @click="goPublish">
            {{ canPublish ? '发布职位' : '招聘方入驻' }}
          </button>
        </template>
      </AppEmptyState>

      <section class="mt-8 rounded-2xl border border-slate-200/90 bg-white p-5 text-sm text-slate-600 shadow-sm sm:p-6">
        <h3 class="font-bold text-navy-900">投递提示</h3>
        <p class="mt-2 leading-relaxed">
          核对课表与通勤；保存岗位截图；薪资与工时尽量书面确认。手机端点左侧卡片将打开独立详情页，功能与右侧预览一致。
        </p>
      </section>
    </div>
  </div>
</template>
