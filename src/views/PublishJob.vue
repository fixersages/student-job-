<script setup>
import { ref, onMounted, computed, nextTick, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { supabase, getCurrentUser, getCategoryList, isPublisher } from '@/lib/supabase'
import { showAppToast } from '@/lib/toastState'
import { getJobDetail, updateJobById } from '@/api/job'

/** DB `salary` NOT NULL：未传或非数字时用 0 */
function salaryForInsert(raw) {
  if (raw === '' || raw == null) return 0
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

/** insert 前必须用 auth.getUser() 拿到 user.id，与 RLS「auth.uid() = user_id」一致 */
async function getSessionUserForInsert() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user?.id) return { user: null, error }
  return { user, error: null }
}

const router = useRouter()
const route = useRoute()

const EMPTY_FORM = () => ({
  category_id: '',
  title: '',
  address: '',
  price: '',
  work_time: '',
  gender_req: '不限',
  work_arrangement: '',
  phone: '',
  wechat: '',
  content: '',
  cover_image: '',
  salary: '',
})

const form = ref(EMPTY_FORM())

/**
 * 从个人中心保存的招聘方资料带入表单（仅当对应项仍为空时写入，避免覆盖用户已填内容）。
 * @returns {{ phoneFilled: boolean, contentFilled: boolean }}
 */
function applyPublisherFormDefaults(user) {
  let phoneFilled = false
  let contentFilled = false
  if (!user || !isPublisher(user)) return { phoneFilled, contentFilled }
  const m = user.user_metadata || {}
  const cp = String(m.contact_phone ?? '').trim()
  if (cp && !String(form.value.phone ?? '').trim()) {
    form.value.phone = cp
    phoneFilled = true
  }
  const company = String(m.company_name ?? '').trim()
  const intro = String(m.company_intro ?? '').trim()
  if (!String(form.value.content ?? '').trim() && (company || intro)) {
    const lines = []
    if (company) lines.push(`招聘单位：${company}`)
    if (intro) lines.push(intro)
    form.value.content = lines.join('\n\n')
    contentFilled = true
  }
  return { phoneFilled, contentFilled }
}

const categoryList = ref([])
const submitting = ref(false)
/** null=检测中 true=可发布 false=数据库缺列或 API 未刷新 */
const jobsTableReady = ref(null)
/** 进入页面时是否从个人中心写入了默认值（用于提示） */
const profileDefaultsNote = ref('')
/** 编辑模式：拉取职位详情中 */
const editLoading = ref(false)

const isEditing = computed(() => route.name === 'job-edit')
const editingJobId = computed(() => {
  if (!isEditing.value) return null
  const n = Number(route.params.id)
  return Number.isFinite(n) && n > 0 ? n : null
})

const pageTitle = computed(() => (isEditing.value ? '编辑职位信息' : '发布兼职职位'))
const pageSubtitle = computed(() =>
  isEditing.value
    ? '修改后将立即在职位大厅与详情页生效（在招状态保持不变）。'
    : '信息将展示在职位大厅。请如实填写联系方式，并遵守平台与法律对兼职招用、个人信息保护的要求。',
)

const publishDisabled = computed(
  () =>
    submitting.value ||
    jobsTableReady.value === false ||
    jobsTableReady.value === null ||
    editLoading.value,
)

/** 与 insert 行字段一致：缺任意一列 PostgREST 都会在 schema cache 中报错 */
const JOBS_PUBLISH_COLUMNS =
  'id, category_id, title, address, price, salary, work_time, gender_req, work_arrangement, phone, wechat, content, user_id, nickname, status, cover_image, created_at'

const fixSqlSnippet = [
  'alter table public.jobs add column if not exists category_id bigint;',
  'alter table public.jobs add column if not exists title text not null default \'\';',
  'alter table public.jobs add column if not exists address text;',
  'alter table public.jobs add column if not exists price text;',
  'alter table public.jobs add column if not exists salary numeric not null default 0;',
  'alter table public.jobs add column if not exists work_time text;',
  'alter table public.jobs add column if not exists gender_req text default \'不限\';',
  'alter table public.jobs add column if not exists phone text;',
  'alter table public.jobs add column if not exists wechat text;',
  'alter table public.jobs add column if not exists content text;',
  'alter table public.jobs add column if not exists user_id uuid;',
  'alter table public.jobs add column if not exists nickname text;',
  'alter table public.jobs add column if not exists status integer default 1;',
  'alter table public.jobs add column if not exists cover_image text;',
  'alter table public.jobs add column if not exists work_arrangement text;',
  'alter table public.jobs add column if not exists created_at timestamptz default now();',
  'select pg_notify(\'pgrst\', \'reload schema\');',
].join('\n')

async function checkJobsSchema() {
  jobsTableReady.value = null
  const { error } = await supabase.from('jobs').select(JOBS_PUBLISH_COLUMNS).limit(1)
  if (!error) {
    jobsTableReady.value = true
    return
  }
  const msg = String(error.message || '')
  if (
    /schema cache/i.test(msg) ||
    /could not find the .+ column/i.test(msg) ||
    /relation ["']?public\.jobs["']? does not exist|relation ["']?jobs["']? does not exist/i.test(msg)
  ) {
    jobsTableReady.value = false
    return
  }
  jobsTableReady.value = true
}

const loadCategory = async () => {
  const { data } = await getCategoryList()
  categoryList.value = data ?? []
}

function setProfileIntroNote(user, { phoneFilled, contentFilled }) {
  const m = user.user_metadata || {}
  const company = String(m.company_name ?? '').trim()
  const nick = String(m.nickname ?? user.email?.split('@')[0] ?? '').trim()
  const bits = []
  if (company) bits.push(`当前以「${company}」身份发布`)
  if (nick) bits.push(`对外展示昵称：${nick}（与职位大厅一致）`)
  if (phoneFilled) bits.push('联系电话已从个人中心同步，可按岗位修改')
  if (contentFilled) bits.push('职位详情已预填企业简介，请补充岗位要求与报名方式')
  profileDefaultsNote.value = bits.length ? bits.join('；') + '。' : ''
}

async function loadJobForEdit(jobId, user) {
  editLoading.value = true
  profileDefaultsNote.value = ''
  try {
    const [catRes, jobRes] = await Promise.all([getCategoryList(), getJobDetail(jobId)])
    categoryList.value = catRes.data ?? []
    const { data, error } = jobRes
    if (error || !data) {
      alert('无法加载该职位，可能已删除或无权查看')
      await router.replace('/list')
      return
    }
    if (String(data.user_id) !== String(user.id)) {
      alert('只能编辑自己发布的职位')
      await router.replace('/list')
      return
    }
    const sal = data.salary
    const salaryStr =
      sal != null && sal !== '' && Number.isFinite(Number(sal)) && Number(sal) !== 0 ? String(sal) : ''
    form.value = {
      category_id: data.category_id != null ? String(data.category_id) : '',
      title: data.title != null ? String(data.title) : '',
      address: data.address != null ? String(data.address) : '',
      price: data.price != null ? String(data.price) : '',
      work_time: data.work_time != null ? String(data.work_time) : '',
      gender_req: data.gender_req != null && String(data.gender_req).trim() ? String(data.gender_req) : '不限',
      work_arrangement: data.work_arrangement != null ? String(data.work_arrangement) : '',
      phone: data.phone != null ? String(data.phone) : '',
      wechat: data.wechat != null ? String(data.wechat) : '',
      content: data.content != null ? String(data.content) : '',
      cover_image: data.cover_image != null ? String(data.cover_image) : '',
      salary: salaryStr,
    }
    profileDefaultsNote.value = '正在编辑已发布的职位，保存后立即生效。'
  } finally {
    editLoading.value = false
  }
}

async function syncRouteToForm() {
  const user = await getCurrentUser()
  if (!user) {
    await router.push({ path: '/login', query: { redirect: route.fullPath } })
    return
  }
  if (!isPublisher(user)) {
    await router.replace({ path: '/list', query: { forbidden: 'publish' } })
    return
  }

  if (route.name === 'job-edit') {
    const id = editingJobId.value
    if (id == null) {
      await router.replace('/list')
      return
    }
    await loadJobForEdit(id, user)
    return
  }

  form.value = EMPTY_FORM()
  const { phoneFilled, contentFilled } = applyPublisherFormDefaults(user)
  setProfileIntroNote(user, { phoneFilled, contentFilled })
}

watch(
  () => [route.name, route.params.id],
  () => {
    void syncRouteToForm()
  },
  { flush: 'post' },
)

const submitJob = async () => {
  if (!form.value.category_id || !form.value.title || !form.value.phone || !form.value.work_arrangement) {
    alert('请填写分类、标题、工作形式和联系电话')
    return
  }

  const { user, error: authErr } = await getSessionUserForInsert()
  if (authErr || !user) {
    router.push('/login')
    return
  }
  if (!isPublisher(user)) {
    alert('当前为学生账号，无法发布职位。请使用招聘方账号登录，或前往注册招聘方身份。')
    router.push({ path: '/list', query: { forbidden: 'publish' } })
    return
  }

  submitting.value = true
  try {
    if (isEditing.value && editingJobId.value != null) {
      const { error } = await updateJobById(editingJobId.value, {
        ...form.value,
        nickname: user.user_metadata?.nickname ?? '',
      })
      if (error) {
        const schemaBug =
          /schema cache/i.test(error.message || '') ||
          /Could not find the .+ column/i.test(error.message || '')
        const hint = schemaBug
          ? ' 请先在 Supabase → SQL Editor 执行补列脚本，并点 API → Reload schema。'
          : ''
        alert('保存失败：' + (error.message || '请检查表结构与权限') + hint)
        console.error(error)
        if (schemaBug) await checkJobsSchema()
        return
      }
      await nextTick()
      showAppToast('已保存修改')
      await router.push(`/detail/${editingJobId.value}`).catch(() => {
        window.location.hash = `#/detail/${editingJobId.value}`
      })
      return
    }

    const cid = Number(form.value.category_id)
    const row = {
      category_id: Number.isFinite(cid) && cid > 0 ? cid : null,
      title: form.value.title,
      address: form.value.address,
      price: form.value.price,
      salary: salaryForInsert(form.value.salary),
      work_time: form.value.work_time,
      gender_req: form.value.gender_req,
      work_arrangement: form.value.work_arrangement,
      phone: form.value.phone,
      wechat: form.value.wechat,
      content: form.value.content,
      user_id: user.id,
      nickname: user.user_metadata?.nickname ?? '',
      status: 1,
    }
    const ci = form.value.cover_image?.trim()
    if (ci) row.cover_image = ci

    const { error } = await supabase.from('jobs').insert([row])

    if (error) {
      const schemaBug =
        /schema cache/i.test(error.message || '') ||
        /Could not find the .+ column/i.test(error.message || '')
      const hint = schemaBug
        ? ' 请先在 Supabase → SQL Editor 执行补列脚本（见页面上方红框内的步骤），并点 API → Reload schema。'
        : ''
      alert('发布失败：' + (error.message || '请检查表结构与权限') + hint)
      console.error(error)
      if (schemaBug) await checkJobsSchema()
      return
    }

    form.value = EMPTY_FORM()
    profileDefaultsNote.value = ''

    await nextTick()
    showAppToast('发布成功，已为您跳转至职位大厅')
    await router.push('/list').catch((err) => {
      console.error('[publish] 跳转大厅失败:', err)
      window.location.hash = '#/list'
    })
  } catch (e) {
    console.error(e)
    alert(isEditing.value ? '保存异常：' + (e?.message || String(e)) : '发布异常：' + (e?.message || String(e)))
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  void syncRouteToForm()
  void checkJobsSchema()
  const idle = typeof requestIdleCallback === 'function' ? requestIdleCallback : (cb) => setTimeout(cb, 1)
  idle(() => {
    void loadCategory()
  })
})
</script>

<template>
  <div>
    <div
      class="border-b border-slate-200/80 bg-gradient-to-b from-white via-slate-50/90 to-slate-100/80"
    >
      <div class="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <p class="app-section-kicker text-brand-600">招聘方</p>
        <h1 class="mt-2 text-balance text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{{ pageTitle }}</h1>
        <p class="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-[0.9375rem]">
          {{ pageSubtitle }}
        </p>
      </div>
    </div>

    <div class="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
      <div class="app-card overflow-hidden shadow-card ring-1 ring-slate-900/[0.03]">
      <div
        v-if="editLoading"
        class="border-b border-slate-200 bg-slate-50 px-6 py-3 text-sm text-slate-600 sm:px-8"
        role="status"
      >
        正在加载职位数据…
      </div>

      <div
        v-if="jobsTableReady === false"
        class="border-b border-red-200 bg-red-50 px-6 py-4 text-sm leading-relaxed text-red-950 sm:px-8"
        role="alert"
      >
        <p class="font-bold">
          当前无法发布：云端 <code class="rounded bg-white/80 px-1">jobs</code> 表与前端不一致（缺少某一列，例如
          <code class="rounded bg-white/80 px-1">gender_req</code>、<code class="rounded bg-white/80 px-1">work_arrangement</code>
          等），或 PostgREST 的 schema 缓存未更新。
        </p>
        <p class="mt-2 text-xs text-red-900/95">
          若你之前只执行过「只加 category_id」的短脚本，请<strong>务必改用下方整段「一键补全」</strong>执行一次，再 Reload schema。
        </p>
        <ol class="mt-3 list-decimal space-y-2 pl-5">
          <li>打开 <strong>Supabase Dashboard</strong> → 选中<strong>与 .env 相同</strong>的项目。</li>
          <li><strong>SQL Editor</strong> → New query → 粘贴下面整段 → <strong>Run</strong>。</li>
          <li><strong>Settings → API</strong> → 点击 <strong>Reload schema</strong>。</li>
          <li>回到本页 <strong>刷新浏览器</strong>（F5）。</li>
        </ol>
        <pre
          class="mt-3 max-h-40 overflow-auto rounded-lg border border-red-200/80 bg-white p-3 text-xs text-slate-800"
        ><code>{{ fixSqlSnippet }}</code></pre>
        <p class="mt-2 text-xs text-red-900/90">
          仓库内与下面内容相同：
          <code class="rounded bg-white/70 px-1">supabase/SQL_EDITOR_一键补全_jobs_发布所需列.sql</code>
          （或 <code class="rounded bg-white/70 px-1">migrations/20260511210000_jobs_add_missing_publish_columns.sql</code>）。
        </p>
        <button
          type="button"
          class="mt-3 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-900 hover:bg-red-50"
          @click="checkJobsSchema"
        >
          我已在 Supabase 执行完毕，重新检测
        </button>
      </div>

      <div
        v-if="profileDefaultsNote"
        class="border-b border-emerald-200/90 bg-emerald-50/95 px-6 py-3 text-xs leading-relaxed text-emerald-950 sm:px-8"
        role="status"
      >
        {{ profileDefaultsNote }}
      </div>

      <div class="app-form-section-head">
        <h2 class="text-sm font-semibold text-slate-900">基础信息</h2>
        <p class="mt-0.5 text-xs text-slate-500">带 * 为建议必填，便于学生筛选与联系</p>
      </div>
      <div class="space-y-6 p-6 sm:p-8">
        <div>
          <label class="block text-sm font-medium text-slate-700"
            >兼职分类 <span class="text-red-500">*</span></label
          >
          <select v-model="form.category_id" class="app-input mt-2">
            <option disabled value="">请选择分类</option>
            <option v-for="item in categoryList" :key="item.id" :value="item.id">
              {{ item.name }}
            </option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700"
            >职位标题 <span class="text-red-500">*</span></label
          >
          <input
            v-model="form.title"
            type="text"
            class="app-input mt-2"
            placeholder="简洁说明岗位，如：周末咖啡店店员"
          />
        </div>

        <div class="grid gap-6 sm:grid-cols-2">
          <div>
            <label class="block text-sm font-medium text-slate-700">工作地址</label>
            <input v-model="form.address" type="text" class="app-input mt-2" placeholder="城市 / 商圈 / 校区" />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700">薪资待遇</label>
            <input v-model="form.price" type="text" class="app-input mt-2" placeholder="如：150 元/天、25 元/小时" />
          </div>
        </div>

        <div class="grid gap-6 sm:grid-cols-2">
          <div>
            <label class="block text-sm font-medium text-slate-700">工作时间</label>
            <input v-model="form.work_time" type="text" class="app-input mt-2" placeholder="周末 / 晚班 / 弹性" />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700">性别要求</label>
            <select v-model="form.gender_req" class="app-input mt-2">
              <option value="不限">不限</option>
              <option value="仅限男">仅限男</option>
              <option value="仅限女">仅限女</option>
            </select>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700"
            >工作形式 <span class="text-red-500">*</span></label
          >
          <select v-model="form.work_arrangement" class="app-input mt-2">
            <option disabled value="">请选择（用于大厅筛选，便于学生匹配）</option>
            <option value="onsite">到岗为主</option>
            <option value="remote">可远程 / 线上为主</option>
            <option value="hybrid">混合（部分到岗、部分线上）</option>
          </select>
          <p class="mt-1.5 text-xs leading-relaxed text-slate-500">
            未选时旧数据会按正文中「远程、线上、在家」等词推断；新发布请务必如实选择。
          </p>
        </div>
      </div>

      <div class="app-form-section-head border-t border-slate-100">
        <h2 class="text-sm font-semibold text-slate-900">联系方式（对学生可见）</h2>
      </div>
      <div class="space-y-6 p-6 sm:p-8">
        <div class="grid gap-6 sm:grid-cols-2">
          <div>
            <label class="block text-sm font-medium text-slate-700"
              >联系电话 <span class="text-red-500">*</span></label
            >
            <input v-model="form.phone" type="tel" class="app-input mt-2" placeholder="常用手机号" />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700">微信号</label>
            <input v-model="form.wechat" type="text" class="app-input mt-2" placeholder="可选" />
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700">职位详情</label>
          <textarea
            v-model="form.content"
            rows="5"
            class="app-input mt-2 min-h-[120px] resize-y"
            placeholder="工作内容、任职要求、面试方式等"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700">封面图 URL（可选）</label>
          <input
            v-model="form.cover_image"
            type="url"
            class="app-input mt-2"
            placeholder="https://… 横图更佳；需在数据库表 jobs 增加 cover_image 文本列"
          />
          <p class="mt-1.5 text-xs leading-relaxed text-slate-500">
            未配置数据库列时请留空，列表与详情仍会自动使用系统配图。若已添加 <code class="rounded bg-slate-100 px-1">cover_image</code> 列，此处链接将用作 Banner。
          </p>
        </div>

        <div
          class="rounded-[var(--app-radius-lg)] border border-slate-200/90 bg-slate-50/80 px-4 py-3 text-xs leading-relaxed text-slate-600"
        >
          提交即表示您确认信息真实合法，并同意在必要时配合平台进行合规核验。处理个人信息须遵守《个人信息保护法》及学校相关规定。
        </div>

        <button
          type="button"
          :disabled="publishDisabled"
          class="app-btn-primary w-full py-3.5 shadow-md disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:bg-brand-600"
          @click="submitJob"
        >
          {{
            submitting
              ? isEditing
                ? '保存中…'
                : '提交中…'
              : jobsTableReady === null
                ? '检测表结构中…'
                : isEditing
                  ? '保存修改'
                  : '提交发布'
          }}
        </button>
      </div>
    </div>
    </div>
  </div>
</template>
