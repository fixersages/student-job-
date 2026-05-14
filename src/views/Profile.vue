<script setup>
/**
 * 登录态：以 Supabase auth 为准（与导航栏一致）；localStorage campus_pt_user 仅作本地演示兜底。
 */
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { RouterLink } from 'vue-router'
import UserAvatar from '@/components/UserAvatar.vue'
import { supabase, getUserRole, USER_ROLE, isPublisher, patchUserMetadata } from '@/lib/supabase'
import { describeAuthError } from '@/lib/authErrors'
import { uploadMyAvatar } from '@/api/avatar'
import { syncCampusPublicProfileFromUser } from '@/api/publicProfile'
import { fetchJobsPage } from '@/api/job'
import { jobs as demoJobs } from '../data/jobs.js'

/** 招聘类型（写入 user_metadata.recruitment_type） */
const RECRUITMENT_OPTIONS = [
  { value: 'campus_parttime', label: '校园兼职' },
  { value: 'intern', label: '实习招聘' },
  { value: 'social', label: '社会招聘' },
  { value: 'ambassador', label: '校园大使 / 推广' },
  { value: 'other', label: '其他' },
]

function recruitmentTypeLabel(value) {
  const v = String(value || '').trim()
  if (!v) return '未选择'
  return RECRUITMENT_OPTIONS.find((o) => o.value === v)?.label ?? v
}

/** 学生年级（写入 user_metadata.student_grade） */
const STUDENT_GRADE_OPTIONS = [
  { value: '', label: '未选择' },
  { value: 'freshman', label: '大一' },
  { value: 'sophomore', label: '大二' },
  { value: 'junior', label: '大三' },
  { value: 'senior', label: '大四' },
  { value: 'master', label: '硕士' },
  { value: 'doctor', label: '博士' },
  { value: 'other', label: '其他' },
]

/** 学生可勾选的兼职技能（user_metadata 布尔字段） */
const STUDENT_SKILL_OPTIONS = [
  { key: 'skill_tutoring', label: '家教' },
  { key: 'skill_editing', label: '剪辑' },
  { key: 'skill_copywriting', label: '文案' },
  { key: 'skill_errand', label: '跑腿' },
]

function readMetaBool(meta, key) {
  const v = meta?.[key]
  return v === true || v === 'true' || v === 1 || v === '1'
}

function studentGradeLabel(value) {
  const v = String(value || '').trim()
  if (!v) return '未选择'
  return STUDENT_GRADE_OPTIONS.find((o) => o.value === v)?.label ?? v
}

/** Supabase 当前用户（与 Navbar 同源） */
const authUser = ref(null)
/** 历史演示账号（无 Supabase 会话时可选展示） */
const legacyUser = ref(null)
let authSub = null
let authJobsTimer = 0

function scheduleAuthAndJobs() {
  window.clearTimeout(authJobsTimer)
  authJobsTimer = window.setTimeout(() => {
    authJobsTimer = 0
    void refreshAuth().then(() => loadRecommendedJobs())
  }, 280)
}

const isLoggedIn = computed(() => !!(authUser.value || legacyUser.value))

/** 无 Supabase 时用本地演示对象驱动默认头像 */
const legacyForAvatar = computed(() => (authUser.value ? null : legacyUser.value))

const avatarInputRef = ref(null)

const displayNickname = computed(() => {
  const a = authUser.value
  if (a) return a.user_metadata?.nickname || a.email?.split('@')[0] || '用户'
  return legacyUser.value?.nickname ?? '未设置昵称'
})

const displayEmail = computed(() => {
  const a = authUser.value
  if (a?.email) return a.email
  return legacyUser.value?.email ?? '—'
})

const displaySchool = computed(() => {
  const a = authUser.value
  const meta = a?.user_metadata
  if (meta?.school) return String(meta.school)
  return legacyUser.value?.school ?? '未填写学校'
})

const displayStudentGrade = computed(() => {
  const a = authUser.value
  if (!a || isPublisher(a)) return ''
  return studentGradeLabel(a.user_metadata?.student_grade)
})

const displayStudentMajor = computed(() => {
  const a = authUser.value
  if (!a || isPublisher(a)) return ''
  const v = a.user_metadata?.student_major
  return v != null && String(v).trim() ? String(v).trim() : ''
})

const displayStudentSkillLabels = computed(() => {
  const a = authUser.value
  if (!a || isPublisher(a)) return []
  const m = a.user_metadata || {}
  return STUDENT_SKILL_OPTIONS.filter((o) => readMetaBool(m, o.key)).map((o) => o.label)
})

const displayStudentSelfIntro = computed(() => {
  const a = authUser.value
  if (!a || isPublisher(a)) return ''
  const v = a.user_metadata?.student_self_intro
  return v != null && String(v).trim() ? String(v).trim() : ''
})

const displayCompanyName = computed(() => {
  const a = authUser.value
  if (!a || !isPublisher(a)) return ''
  const v = a.user_metadata?.company_name
  return v != null && String(v).trim() ? String(v).trim() : '未填写'
})

const displayRecruitmentLabel = computed(() => {
  const a = authUser.value
  if (!a || !isPublisher(a)) return ''
  return recruitmentTypeLabel(a.user_metadata?.recruitment_type)
})

const displayPublisherPhone = computed(() => {
  const a = authUser.value
  if (!a || !isPublisher(a)) return ''
  const v = a.user_metadata?.contact_phone
  return v != null && String(v).trim() ? String(v).trim() : ''
})

const displayPublisherIntro = computed(() => {
  const a = authUser.value
  if (!a || !isPublisher(a)) return ''
  const v = a.user_metadata?.company_intro
  return v != null && String(v).trim() ? String(v).trim() : ''
})

const roleLabel = computed(() => {
  const a = authUser.value
  if (a) return isPublisher(a) ? '招聘方' : '学生'
  if (legacyUser.value) return '演示资料'
  return ''
})

const roleBadgeClass = computed(() => {
  const a = authUser.value
  if (!a) return 'bg-slate-100 text-slate-600 ring-slate-200/80'
  return isPublisher(a)
    ? 'bg-violet-500/10 text-violet-800 ring-violet-200/80'
    : 'bg-emerald-500/10 text-emerald-800 ring-emerald-200/80'
})

const accountCreatedAt = computed(() => {
  const t = authUser.value?.created_at
  if (!t) return null
  try {
    return new Date(t).toLocaleString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return null
  }
})

const userIdShort = computed(() => {
  const id = authUser.value?.id
  if (!id) return null
  return id.length > 12 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id
})

const recommended = ref([])
const jobsLoading = ref(false)
const jobsError = ref('')

/** 资料编辑区默认收起；保存或「收起」时从服务端状态回填表单 */
const profileEditOpen = ref(false)
const lastSavedHint = ref('')
let savedHintTimer = 0

function showSavedHint(text) {
  lastSavedHint.value = text
  window.clearTimeout(savedHintTimer)
  savedHintTimer = window.setTimeout(() => {
    lastSavedHint.value = ''
    savedHintTimer = 0
  }, 5000)
}

const collapsedProfileSummary = computed(() => {
  const u = authUser.value
  if (!u) return ''
  if (isPublisher(u)) {
    const m = u.user_metadata || {}
    const name = (m.company_name && String(m.company_name).trim()) || '未填写企业名称'
    return `${name} · ${recruitmentTypeLabel(m.recruitment_type)}`
  }
  const m = u.user_metadata || {}
  const nick = (m.nickname && String(m.nickname).trim()) || u.email?.split('@')[0] || '用户'
  const sch = (m.school && String(m.school).trim()) || '未填写学校'
  const major = (m.student_major && String(m.student_major).trim()) || ''
  const skills = STUDENT_SKILL_OPTIONS.filter((o) => readMetaBool(m, o.key))
    .map((o) => o.label)
    .join('、')
  const bits = [nick, sch]
  if (major) bits.push(major)
  if (skills) bits.push(skills)
  return bits.join(' · ')
})

/** 仅 Supabase 登录用户可编辑并写回 auth metadata */
const editNickname = ref('')
const editSchool = ref('')
const editStudentGrade = ref('')
const editStudentMajor = ref('')
const editSkillTutoring = ref(false)
const editSkillEditing = ref(false)
const editSkillCopywriting = ref(false)
const editSkillErrand = ref(false)
const editStudentSelfIntro = ref('')
const editCompanyName = ref('')
const editRecruitmentType = ref('')
const editContactPhone = ref('')
const editCompanyIntro = ref('')
const profileSaving = ref(false)
const profileErr = ref('')

function syncFormFromAuth(u) {
  if (!u) {
    editNickname.value = ''
    editSchool.value = ''
    editStudentGrade.value = ''
    editStudentMajor.value = ''
    editSkillTutoring.value = false
    editSkillEditing.value = false
    editSkillCopywriting.value = false
    editSkillErrand.value = false
    editStudentSelfIntro.value = ''
    editCompanyName.value = ''
    editRecruitmentType.value = ''
    editContactPhone.value = ''
    editCompanyIntro.value = ''
    return
  }
  const m = u.user_metadata || {}
  editNickname.value = m.nickname != null && m.nickname !== '' ? String(m.nickname) : ''
  editSchool.value = m.school != null && m.school !== '' ? String(m.school) : ''
  editStudentGrade.value =
    m.student_grade != null && String(m.student_grade).trim() !== '' ? String(m.student_grade) : ''
  editStudentMajor.value = m.student_major != null && m.student_major !== '' ? String(m.student_major) : ''
  editSkillTutoring.value = readMetaBool(m, 'skill_tutoring')
  editSkillEditing.value = readMetaBool(m, 'skill_editing')
  editSkillCopywriting.value = readMetaBool(m, 'skill_copywriting')
  editSkillErrand.value = readMetaBool(m, 'skill_errand')
  editStudentSelfIntro.value =
    m.student_self_intro != null && m.student_self_intro !== '' ? String(m.student_self_intro) : ''
  editCompanyName.value = m.company_name != null && m.company_name !== '' ? String(m.company_name) : ''
  editRecruitmentType.value =
    m.recruitment_type != null && String(m.recruitment_type).trim() !== '' ? String(m.recruitment_type) : ''
  editContactPhone.value = m.contact_phone != null && m.contact_phone !== '' ? String(m.contact_phone) : ''
  editCompanyIntro.value = m.company_intro != null && m.company_intro !== '' ? String(m.company_intro) : ''
}

watch(
  authUser,
  (u) => {
    if (!profileEditOpen.value) syncFormFromAuth(u)
  },
  { immediate: true },
)

function toggleProfileEdit() {
  profileErr.value = ''
  if (profileEditOpen.value) {
    syncFormFromAuth(authUser.value)
    profileEditOpen.value = false
  } else {
    syncFormFromAuth(authUser.value)
    profileEditOpen.value = true
  }
}

async function saveProfile() {
  profileErr.value = ''
  if (!authUser.value) return
  const u = authUser.value
  const nick = editNickname.value.trim()

  if (isPublisher(u)) {
    const company = editCompanyName.value.trim()
    if (!company) {
      profileErr.value = '请填写企业或团队名称。'
      return
    }
    if (!editRecruitmentType.value) {
      profileErr.value = '请选择招聘类型。'
      return
    }
    if (!nick) {
      profileErr.value = '请填写昵称（在职位与聊天中对外展示）。'
      return
    }
    profileSaving.value = true
    try {
      const { data, error } = await patchUserMetadata({
        nickname: nick,
        company_name: company,
        recruitment_type: editRecruitmentType.value,
        contact_phone: editContactPhone.value.trim(),
        company_intro: editCompanyIntro.value.trim(),
      })
      if (error) {
        profileErr.value = describeAuthError(error)
        return
      }
      if (data?.user) authUser.value = data.user
      await refreshAuth()
      profileEditOpen.value = false
      showSavedHint('招聘资料已保存。')
    } finally {
      profileSaving.value = false
    }
    return
  }

  if (!nick) {
    profileErr.value = '请填写昵称。'
    return
  }
  profileSaving.value = true
  try {
    const { data, error } = await patchUserMetadata({
      nickname: nick,
      school: editSchool.value.trim(),
      student_grade: editStudentGrade.value.trim() || '',
      student_major: editStudentMajor.value.trim(),
      skill_tutoring: !!editSkillTutoring.value,
      skill_editing: !!editSkillEditing.value,
      skill_copywriting: !!editSkillCopywriting.value,
      skill_errand: !!editSkillErrand.value,
      student_self_intro: editStudentSelfIntro.value.trim(),
    })
    if (error) {
      profileErr.value = describeAuthError(error)
      return
    }
    if (data?.user) authUser.value = data.user
    await refreshAuth()
    profileEditOpen.value = false
    showSavedHint('学生资料已保存。')
  } finally {
    profileSaving.value = false
  }
}

function pickAvatarFile() {
  avatarInputRef.value?.click()
}

const avatarBusy = ref(false)

async function onAvatarFileChange(ev) {
  const el = ev.target
  const file = el?.files?.[0]
  if (el) el.value = ''
  if (!file || !authUser.value) return
  profileErr.value = ''
  avatarBusy.value = true
  try {
    const { publicUrl } = await uploadMyAvatar(file)
    const { data, error } = await patchUserMetadata({ avatar_url: publicUrl })
    if (error) {
      profileErr.value = describeAuthError(error)
      return
    }
    if (data?.user) authUser.value = data.user
    await refreshAuth()
    showSavedHint('头像已更新。')
  } catch (e) {
    profileErr.value = describeAuthError(e)
  } finally {
    avatarBusy.value = false
  }
}

async function resetAvatarToGenerated() {
  if (!authUser.value) return
  const has = String(authUser.value.user_metadata?.avatar_url || '').trim()
  if (!has) return
  profileErr.value = ''
  avatarBusy.value = true
  try {
    const { data, error } = await patchUserMetadata({ avatar_url: '' })
    if (error) {
      profileErr.value = describeAuthError(error)
      return
    }
    if (data?.user) authUser.value = data.user
    await refreshAuth()
    showSavedHint('已恢复为系统生成头像。')
  } finally {
    avatarBusy.value = false
  }
}

async function loadRecommendedJobs() {
  if (!authUser.value) {
    recommended.value = demoJobs.slice(0, 5).map((j) => ({
      id: j.id,
      title: j.title,
      price: j.salary,
      source: 'demo',
    }))
    return
  }
  jobsLoading.value = true
  jobsError.value = ''
  try {
    const { data, error } = await fetchJobsPage({ page: 0, pageSize: 10 })
    if (error) throw error
    const rows = data ?? []
    recommended.value = rows.map((j) => ({
      id: j.id,
      title: j.title,
      price: j.price || j.salary || '面议',
      source: 'live',
    }))
    if (!recommended.value.length) {
      recommended.value = demoJobs.slice(0, 3).map((j) => ({
        id: j.id,
        title: j.title,
        price: j.salary,
        source: 'demo',
      }))
    }
  } catch (e) {
    console.warn('[Profile] fetchJobsPage', e)
    jobsError.value = '暂时无法加载在线职位，已为你展示演示数据'
    recommended.value = demoJobs.slice(0, 5).map((j) => ({
      id: j.id,
      title: j.title,
      price: j.salary,
      source: 'demo',
    }))
  } finally {
    jobsLoading.value = false
  }
}

async function refreshAuth() {
  try {
    const {
      data: { user: u },
    } = await supabase.auth.getUser()
    authUser.value = u
    if (u?.id) {
      const { error: syncErr } = await syncCampusPublicProfileFromUser(u)
      if (syncErr) console.warn('[Profile] syncCampusPublicProfileFromUser', syncErr)
    }
  } catch (e) {
    console.warn('[Profile] getUser', e)
    authUser.value = null
  }
}

onMounted(async () => {
  const raw = localStorage.getItem('campus_pt_user')
  if (raw) {
    try {
      legacyUser.value = JSON.parse(raw)
    } catch {
      legacyUser.value = null
    }
  }
  await refreshAuth()

  const idle = typeof requestIdleCallback === 'function' ? requestIdleCallback : (cb) => setTimeout(cb, 1)
  idle(() => {
    void loadRecommendedJobs()
  })

  const { data } = supabase.auth.onAuthStateChange(() => {
    scheduleAuthAndJobs()
  })
  authSub = data.subscription
})

onUnmounted(() => {
  window.clearTimeout(authJobsTimer)
  authJobsTimer = 0
  authSub?.unsubscribe?.()
  authSub = null
  window.clearTimeout(savedHintTimer)
  savedHintTimer = 0
})
</script>

<template>
  <div class="min-h-[calc(100dvh-8rem)] bg-slate-100/80 pb-12 pt-6 sm:pb-16 sm:pt-8">
    <div class="app-container max-w-3xl">
      <header class="border-b border-slate-200/80 pb-6">
        <p class="app-section-kicker text-brand-600">账户</p>
        <h1 class="mt-2 text-balance text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">个人中心</h1>
        <p class="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
          查看校兼账号资料、快捷入口与推荐岗位；登录状态与顶部导航一致。
        </p>
      </header>

      <!-- 未登录：无 Supabase 且无本地演示用户 -->
      <div
        v-if="!isLoggedIn"
        class="mt-8 rounded-[var(--app-radius-xl)] border border-slate-200/90 bg-white px-6 py-12 text-center shadow-card ring-1 ring-slate-900/[0.03] sm:px-10"
      >
        <div
          class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 ring-1 ring-slate-200/80"
        >
          <svg class="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </div>
        <p class="mt-5 text-sm font-medium text-slate-700">登录后可查看资料与推荐岗位</p>
        <p class="mt-1 text-xs text-slate-500">使用校兼账号登录后，个人中心将展示你的昵称、邮箱与角色。</p>
        <RouterLink to="/login" class="app-btn-primary mt-8 inline-flex px-8">前往登录</RouterLink>
      </div>

      <!-- 已登录：资料 + 入口 + 推荐 -->
      <template v-else>
        <div
          class="mt-8 overflow-hidden rounded-[var(--app-radius-xl)] border border-slate-200/90 bg-white shadow-card ring-1 ring-slate-900/[0.03]"
        >
          <div
            class="flex flex-col gap-6 bg-gradient-to-br from-slate-50 to-white p-6 sm:flex-row sm:items-center sm:gap-8 sm:p-8"
          >
            <div class="flex shrink-0 flex-col items-center gap-3 sm:items-start">
              <UserAvatar
                :user="authUser"
                :legacy-user="legacyForAvatar"
                size-class="h-20 w-20"
                ring-class="ring-2 ring-slate-300/90 shadow-md shadow-slate-900/10"
              />
              <div v-if="authUser" class="flex flex-col items-center gap-2 sm:items-start">
                <input
                  ref="avatarInputRef"
                  type="file"
                  class="hidden"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  @change="onAvatarFileChange"
                />
                <div class="flex flex-wrap justify-center gap-2 sm:justify-start">
                  <button
                    type="button"
                    class="rounded-[var(--app-radius)] border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-900/[0.04] transition hover:border-brand-200 hover:bg-brand-50/80 hover:text-brand-900 disabled:opacity-50"
                    :disabled="avatarBusy"
                    @click="pickAvatarFile"
                  >
                    {{ avatarBusy ? '处理中…' : '上传头像' }}
                  </button>
                  <button
                    v-if="authUser.user_metadata?.avatar_url"
                    type="button"
                    class="rounded-[var(--app-radius)] border border-transparent px-3 py-1.5 text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline disabled:opacity-50"
                    :disabled="avatarBusy"
                    @click="resetAvatarToGenerated"
                  >
                    恢复默认头像
                  </button>
                </div>
                <p class="max-w-[14rem] text-center text-[11px] leading-relaxed text-slate-500 sm:text-left">
                  支持 JPG / PNG / WebP / GIF，最大 2MB；不上传时使用系统根据账号生成的头像。
                </p>
              </div>
              <p v-else-if="legacyForAvatar" class="max-w-[12rem] text-center text-[11px] text-slate-500 sm:text-left">
                使用校兼账号登录后可上传自定义头像。
              </p>
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <h2 class="text-xl font-semibold tracking-tight text-slate-900">{{ displayNickname }}</h2>
                <span
                  v-if="roleLabel"
                  class="rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1"
                  :class="roleBadgeClass"
                >
                  {{ roleLabel }}
                </span>
              </div>
              <p class="mt-1 text-sm text-slate-600">{{ displayEmail }}</p>
              <template v-if="authUser && isPublisher(authUser)">
                <div class="mt-2 space-y-1.5 text-sm text-slate-600">
                  <p>
                    <span class="text-slate-400">企业名称</span>
                    {{ displayCompanyName }}
                  </p>
                  <p>
                    <span class="text-slate-400">招聘类型</span>
                    {{ displayRecruitmentLabel }}
                  </p>
                  <p v-if="displayPublisherPhone">
                    <span class="text-slate-400">联系电话</span>
                    {{ displayPublisherPhone }}
                  </p>
                  <p v-if="displayPublisherIntro" class="line-clamp-2 text-slate-700">
                    <span class="text-slate-400">简介</span>
                    {{ displayPublisherIntro }}
                  </p>
                </div>
              </template>
              <div v-else-if="authUser && !isPublisher(authUser)" class="mt-2 space-y-2 text-sm text-slate-600">
                <p>
                  <span class="text-slate-400">学校</span>
                  {{ displaySchool }}
                </p>
                <p v-if="displayStudentGrade && displayStudentGrade !== '未选择'">
                  <span class="text-slate-400">年级</span>
                  {{ displayStudentGrade }}
                </p>
                <p v-if="displayStudentMajor">
                  <span class="text-slate-400">专业</span>
                  {{ displayStudentMajor }}
                </p>
                <p v-if="displayStudentSkillLabels.length">
                  <span class="text-slate-400">技能</span>
                  <span class="inline-flex flex-wrap gap-1.5 align-middle">
                    <span
                      v-for="lab in displayStudentSkillLabels"
                      :key="lab"
                      class="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-900 ring-1 ring-emerald-200/70"
                    >
                      {{ lab }}
                    </span>
                  </span>
                </p>
                <div v-if="displayStudentSelfIntro" class="rounded-[var(--app-radius)] bg-slate-50/90 px-3 py-2 ring-1 ring-slate-200/70">
                  <p class="text-xs font-medium text-slate-400">自我介绍</p>
                  <p class="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{{ displayStudentSelfIntro }}</p>
                </div>
              </div>
              <p v-else class="mt-2 text-sm text-slate-600">
                <span class="text-slate-400">学校</span>
                {{ displaySchool }}
              </p>
              <dl v-if="authUser" class="mt-4 grid gap-2 text-xs text-slate-500 sm:max-w-md">
                <div v-if="userIdShort" class="flex flex-wrap gap-x-2">
                  <dt class="shrink-0 font-medium text-slate-400">用户 ID</dt>
                  <dd class="min-w-0 break-all font-mono text-slate-600">{{ userIdShort }}</dd>
                </div>
                <div v-if="accountCreatedAt" class="flex flex-wrap gap-x-2">
                  <dt class="shrink-0 font-medium text-slate-400">注册时间</dt>
                  <dd>{{ accountCreatedAt }}</dd>
                </div>
                <div class="flex flex-wrap gap-x-2">
                  <dt class="shrink-0 font-medium text-slate-400">权限角色</dt>
                  <dd class="text-slate-700">
                    {{ getUserRole(authUser) === USER_ROLE.PUBLISHER ? '可发布与管理岗位' : '可浏览职位与在线沟通' }}
                  </dd>
                </div>
              </dl>
              <p v-if="legacyUser && !authUser" class="mt-3 text-xs text-amber-800">
                当前为本地演示资料；使用校兼账号登录后将同步真实账户信息。
              </p>
            </div>
            <div class="flex shrink-0 flex-col gap-2 sm:items-end">
              <RouterLink
                v-if="authUser"
                to="/chat"
                class="app-btn-primary justify-center px-6 py-2.5 text-center text-sm sm:min-w-[8rem]"
              >
                我的聊天
              </RouterLink>
              <RouterLink
                to="/list"
                class="app-btn-secondary justify-center px-6 py-2.5 text-center text-sm sm:min-w-[8rem]"
              >
                职位大厅
              </RouterLink>
              <RouterLink
                v-if="authUser && isPublisher(authUser)"
                to="/publish"
                class="inline-flex justify-center rounded-[var(--app-radius)] border border-violet-200 bg-violet-50 px-6 py-2.5 text-center text-sm font-semibold text-violet-900 transition hover:bg-violet-100 sm:min-w-[8rem]"
              >
                发布职位
              </RouterLink>
            </div>
          </div>
        </div>

        <section
          v-if="authUser"
          class="mt-10 rounded-[var(--app-radius-xl)] border border-slate-200/90 bg-white p-5 shadow-card ring-1 ring-slate-900/[0.03] sm:p-6"
        >
          <div class="flex flex-wrap items-start justify-between gap-3 gap-y-2 border-b border-slate-100 pb-4">
            <div class="min-w-0 flex-1">
              <h3 class="text-sm font-semibold text-slate-900">资料与编辑</h3>
              <p v-if="!profileEditOpen" class="mt-1 text-xs leading-relaxed text-slate-600">
                {{ collapsedProfileSummary }}
              </p>
              <p v-else class="mt-1 text-xs leading-relaxed text-slate-500">
                {{
                  isPublisher(authUser)
                    ? '招聘方资料保存在账户元数据中，用于展示与沟通；保存后将自动收起本区域。'
                    : '学生资料（昵称、学校、年级、专业、技能与自我介绍）保存在账户元数据中；保存后将自动收起本区域。'
                }}
              </p>
              <p
                v-if="lastSavedHint"
                class="mt-2 text-xs font-medium text-emerald-700"
                role="status"
              >
                {{ lastSavedHint }}
              </p>
            </div>
            <button
              type="button"
              class="shrink-0 rounded-[var(--app-radius)] border border-slate-200/90 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm ring-1 ring-slate-900/[0.04] transition hover:border-brand-200 hover:bg-brand-50/70 hover:text-brand-900"
              @click="toggleProfileEdit"
            >
              {{ profileEditOpen ? '收起' : '编辑资料' }}
            </button>
          </div>

          <div
            v-if="profileErr"
            class="mt-4 rounded-[var(--app-radius-lg)] border border-amber-200/90 bg-amber-50/95 px-4 py-3 text-sm text-amber-950"
            role="alert"
          >
            {{ profileErr }}
          </div>

          <div v-show="profileEditOpen" class="mt-5">
            <template v-if="isPublisher(authUser)">
              <div class="grid gap-5 sm:max-w-lg">
                <label class="block">
                  <span class="text-xs font-medium text-slate-600">昵称（对外展示）</span>
                  <input
                    v-model="editNickname"
                    type="text"
                    class="app-input mt-2"
                    maxlength="40"
                    autocomplete="nickname"
                  />
                </label>
                <label class="block">
                  <span class="text-xs font-medium text-slate-600">企业 / 团队名称</span>
                  <input
                    v-model="editCompanyName"
                    type="text"
                    class="app-input mt-2"
                    maxlength="80"
                    placeholder="如：某某科技有限公司、校兼校园工作站"
                    autocomplete="organization"
                  />
                </label>
                <label class="block">
                  <span class="text-xs font-medium text-slate-600">招聘类型</span>
                  <select v-model="editRecruitmentType" class="app-input mt-2">
                    <option disabled value="">请选择</option>
                    <option v-for="opt in RECRUITMENT_OPTIONS" :key="opt.value" :value="opt.value">
                      {{ opt.label }}
                    </option>
                  </select>
                </label>
                <label class="block">
                  <span class="text-xs font-medium text-slate-600">常用联系电话（选填）</span>
                  <input
                    v-model="editContactPhone"
                    type="tel"
                    class="app-input mt-2"
                    maxlength="20"
                    placeholder="便于求职者与你联系"
                    autocomplete="tel"
                  />
                </label>
                <label class="block">
                  <span class="text-xs font-medium text-slate-600">企业简介（选填）</span>
                  <textarea
                    v-model="editCompanyIntro"
                    class="app-input mt-2 min-h-[88px] resize-y"
                    maxlength="200"
                    rows="3"
                    placeholder="一句话介绍业务、用工特点或合规说明（最多 200 字）"
                  />
                </label>
                <div class="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    class="app-btn-primary px-6 py-2.5 text-sm disabled:pointer-events-none disabled:opacity-60"
                    :disabled="profileSaving"
                    @click="saveProfile"
                  >
                    {{ profileSaving ? '保存中…' : '保存资料' }}
                  </button>
                </div>
              </div>
            </template>
            <template v-else>
              <div class="grid max-w-xl gap-5">
                <div class="grid gap-5 sm:grid-cols-2">
                  <label class="block sm:col-span-2">
                    <span class="text-xs font-medium text-slate-600">昵称（在职位与聊天中对外展示）</span>
                    <input
                      v-model="editNickname"
                      type="text"
                      class="app-input mt-2"
                      maxlength="40"
                      autocomplete="nickname"
                    />
                  </label>
                  <label class="block sm:col-span-2">
                    <span class="text-xs font-medium text-slate-600">学校（选填）</span>
                    <input
                      v-model="editSchool"
                      type="text"
                      class="app-input mt-2"
                      maxlength="80"
                      placeholder="如：某某大学"
                      autocomplete="organization"
                    />
                  </label>
                  <label class="block">
                    <span class="text-xs font-medium text-slate-600">年级（选填）</span>
                    <select v-model="editStudentGrade" class="app-input mt-2">
                      <option v-for="g in STUDENT_GRADE_OPTIONS" :key="g.value || 'none'" :value="g.value">
                        {{ g.label }}
                      </option>
                    </select>
                  </label>
                  <label class="block">
                    <span class="text-xs font-medium text-slate-600">专业（选填）</span>
                    <input
                      v-model="editStudentMajor"
                      type="text"
                      class="app-input mt-2"
                      maxlength="80"
                      placeholder="如：计算机科学与技术"
                    />
                  </label>
                </div>
                <fieldset class="rounded-[var(--app-radius-lg)] border border-slate-200/90 bg-slate-50/50 px-4 py-3">
                  <legend class="px-1 text-xs font-semibold text-slate-700">可接单技能（多选）</legend>
                  <div class="mt-2 flex flex-wrap gap-x-4 gap-y-2.5">
                    <label class="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-800">
                      <input v-model="editSkillTutoring" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                      家教
                    </label>
                    <label class="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-800">
                      <input v-model="editSkillEditing" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                      剪辑
                    </label>
                    <label class="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-800">
                      <input v-model="editSkillCopywriting" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                      文案
                    </label>
                    <label class="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-800">
                      <input v-model="editSkillErrand" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                      跑腿
                    </label>
                  </div>
                </fieldset>
                <label class="block">
                  <span class="text-xs font-medium text-slate-600">自我介绍（选填，最多 800 字）</span>
                  <textarea
                    v-model="editStudentSelfIntro"
                    class="app-input mt-2 min-h-[120px] resize-y"
                    maxlength="800"
                    rows="5"
                    placeholder="可写可兼职时间、相关经历、获奖或证书等，方便招聘方快速了解你。"
                  />
                  <span class="mt-1 block text-right text-[11px] text-slate-400">{{ editStudentSelfIntro.length }}/800</span>
                </label>
                <div class="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    class="app-btn-primary px-6 py-2.5 text-sm disabled:pointer-events-none disabled:opacity-60"
                    :disabled="profileSaving"
                    @click="saveProfile"
                  >
                    {{ profileSaving ? '保存中…' : '保存资料' }}
                  </button>
                </div>
              </div>
            </template>
          </div>
        </section>

        <section class="mt-10 rounded-[var(--app-radius-xl)] border border-slate-200/90 bg-white p-5 shadow-card ring-1 ring-slate-900/[0.03] sm:p-6">
          <h3 class="text-sm font-semibold text-slate-900">快捷说明</h3>
          <ul class="mt-3 list-inside list-disc space-y-1.5 text-sm text-slate-600">
            <li>在职位详情点击「立即沟通」可发起与招聘方的会话。</li>
            <li>学生账号无法发布岗位；需招聘请使用招聘方入驻流程。</li>
            <li>学生可在「编辑资料」中完善年级、专业、技能（家教 / 剪辑 / 文案 / 跑腿）与自我介绍，便于沟通时展示。</li>
            <li>招聘方点击「编辑资料」展开表单，保存成功或点击「收起」后区域会折叠；学生编辑规则相同。</li>
            <li>登录用户可在折叠栏摘要中快速核对资料；头像在个人中心上传后，全站导航与聊天等处会统一显示。</li>
          </ul>
        </section>

        <section class="mt-10">
          <div class="flex items-end justify-between gap-3 border-b border-slate-200/80 pb-3">
            <h3 class="text-sm font-semibold text-slate-900">推荐兼职</h3>
            <span class="text-[11px] font-medium text-slate-400">
              {{ authUser ? '来自职位大厅' : '演示数据' }}
            </span>
          </div>
          <p v-if="jobsError" class="mt-2 text-xs text-amber-800">{{ jobsError }}</p>
          <div v-if="jobsLoading" class="mt-4 space-y-2">
            <div v-for="n in 3" :key="'sk-' + n" class="h-14 animate-pulse rounded-xl bg-slate-100" />
          </div>
          <ul v-else class="mt-4 space-y-3">
            <li
              v-for="j in recommended"
              :key="String(j.id) + (j.source || '')"
              v-memo="[j.id, j.title, j.price, j.source]"
            >
              <RouterLink
                :to="`/detail/${j.id}`"
                class="app-card-interactive flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5"
              >
                <span class="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{{ j.title }}</span>
                <span class="shrink-0 text-sm font-semibold text-brand-600">{{ j.price }}</span>
              </RouterLink>
            </li>
          </ul>
        </section>
      </template>
    </div>
  </div>
</template>
