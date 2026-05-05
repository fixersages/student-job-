<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase, getCategoryList, getCurrentUser } from '@/lib/supabase'

const router = useRouter()
const jobList = ref([])
const categoryList = ref([])
const cateId = ref(0)
const loginUserId = ref('')
const keyword = ref('')
const loading = ref(true)
const loadError = ref('')

const isMine = (uid) => uid === loginUserId.value

const filteredJobs = computed(() => {
  const k = keyword.value.trim().toLowerCase()
  if (!k) return jobList.value
  return jobList.value.filter(
    (j) =>
      j.title?.toLowerCase().includes(k) ||
      j.address?.toLowerCase().includes(k) ||
      j.nickname?.toLowerCase().includes(k),
  )
})

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
}

const delJob = async (id) => {
  if (!confirm('确定删除这条兼职？')) return

  const { error } = await supabase.from('part_time').delete().eq('id', id)

  if (error) {
    alert('删除失败')
  } else {
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

function clearFilters() {
  keyword.value = ''
  cateId.value = 0
  getJobList()
}

onMounted(async () => {
  const user = await getCurrentUser()
  if (user) loginUserId.value = user.id

  const { data } = await getCategoryList()
  categoryList.value = data ?? []

  getJobList()
})
</script>

<template>
  <div>
    <!-- Hero -->
    <section
      class="relative overflow-hidden border-b border-slate-200/80 bg-gradient-to-br from-slate-900 via-brand-900 to-indigo-950"
    >
      <div
        class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-brand-500/20 via-transparent to-transparent"
      />
      <div class="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
        <div class="max-w-2xl">
          <p class="text-sm font-medium uppercase tracking-widest text-brand-200/90">Campus careers · 合规兼职</p>
          <h1 class="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl text-balance">
            把课余时间，换成可信的成长机会
          </h1>
          <p class="mt-4 text-base leading-relaxed text-slate-300 sm:text-lg">
            审核可见的岗位信息、结构化薪资与地点展示，降低信息不对称，适合学生与校园周边雇主快速撮合。
          </p>
        </div>
        <div class="mt-8 flex max-w-xl flex-col gap-3 sm:flex-row sm:items-center">
          <div class="relative flex-1">
            <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
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
              placeholder="搜索职位、地点或发布者…"
              class="w-full rounded-xl border-0 bg-white/10 py-3 pl-10 pr-4 text-white placeholder:text-slate-400 ring-1 ring-white/15 backdrop-blur-sm focus:ring-2 focus:ring-white/40"
            />
          </div>
          <button
            type="button"
            class="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-brand-900 shadow-lg shadow-black/10 transition hover:bg-slate-100"
            @click="router.push('/publish')"
          >
            发布职位
          </button>
        </div>
        <dl class="mt-10 grid grid-cols-3 gap-6 border-t border-white/10 pt-8 sm:max-w-lg">
          <div>
            <dt class="text-xs text-slate-400">在架职位</dt>
            <dd class="mt-1 text-2xl font-bold text-white">{{ jobList.length }}</dd>
          </div>
          <div>
            <dt class="text-xs text-slate-400">职位分类</dt>
            <dd class="mt-1 text-2xl font-bold text-white">{{ categoryList.length || '—' }}</dd>
          </div>
          <div>
            <dt class="text-xs text-slate-400">覆盖场景</dt>
            <dd class="mt-1 text-sm font-semibold leading-snug text-brand-100">校内 · 周末 · 实习</dd>
          </div>
        </dl>
      </div>
    </section>

    <div class="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 class="text-xl font-bold text-slate-900">职位大厅</h2>
          <p class="mt-1 text-sm text-slate-500">按分类筛选，支持关键词即时过滤</p>
        </div>
      </div>

      <!-- Categories -->
      <div class="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded-full border px-4 py-2 text-sm font-medium transition"
          :class="
            cateId === 0
              ? 'border-brand-600 bg-brand-600 text-white shadow-sm'
              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
          "
          @click="changeCategory(0)"
        >
          全部
        </button>
        <button
          v-for="item in categoryList"
          :key="item.id"
          type="button"
          class="rounded-full border px-4 py-2 text-sm font-medium transition"
          :class="
            cateId === item.id
              ? 'border-brand-600 bg-brand-600 text-white shadow-sm'
              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
          "
          @click="changeCategory(item.id)"
        >
          {{ item.name }}
        </button>
      </div>

      <!-- Error -->
      <div
        v-if="loadError"
        class="mt-8 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
      >
        {{ loadError }}
      </div>

      <!-- Loading -->
      <div v-if="loading" class="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="n in 6" :key="n" class="h-64 animate-pulse rounded-2xl bg-slate-200/80" />
      </div>

      <!-- Grid -->
      <div v-else class="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <article
          v-for="item in filteredJobs"
          :key="item.id"
          class="group flex flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card transition hover:border-brand-200/80 hover:shadow-card-hover"
        >
          <div class="flex items-start justify-between gap-3">
            <h3 class="line-clamp-2 text-lg font-semibold text-slate-900 group-hover:text-brand-700">
              {{ item.title }}
            </h3>
            <span
              class="shrink-0 rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700"
              >{{ item.job_category?.name || '未分类' }}</span
            >
          </div>

          <p class="mt-3 flex items-center gap-1.5 text-sm text-slate-500">
            <svg class="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            <span class="line-clamp-1">{{ item.address || '地点待定' }}</span>
          </p>

          <div class="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
            <span class="rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-700">{{ item.price || '面议' }}</span>
            <span v-if="item.work_time" class="rounded-md bg-slate-50 px-2 py-1">{{ item.work_time }}</span>
            <span class="rounded-md bg-slate-50 px-2 py-1">{{ item.gender_req || '不限' }}</span>
          </div>

          <div class="mt-auto flex items-center justify-between border-t border-slate-100 pt-4">
            <span class="text-xs text-slate-400">{{ formatTime(item.created_at) }}</span>
            <div class="flex gap-2">
              <button
                type="button"
                class="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700"
                @click="router.push(`/detail/${item.id}`)"
              >
                查看详情
              </button>
              <button
                v-if="isMine(item.user_id)"
                type="button"
                class="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                @click="delJob(item.id)"
              >
                删除
              </button>
            </div>
          </div>
        </article>
      </div>

      <div
        v-if="!loading && !filteredJobs.length"
        class="mt-16 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center"
      >
        <p class="text-slate-600">暂无符合条件的职位，试试更换关键词或分类。</p>
        <button
          type="button"
          class="mt-4 text-sm font-semibold text-brand-600 hover:text-brand-800"
          @click="clearFilters"
        >
          清除条件并重载
        </button>
      </div>
    </div>
  </div>
</template>
