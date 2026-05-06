<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute, RouterLink } from 'vue-router'
import { signUp, USER_ROLE } from '@/lib/supabase'
import AuthLayout from '@/components/AuthLayout.vue'

const router = useRouter()
const route = useRoute()
const nickname = ref('')
const email = ref('')
const pwd = ref('')
const loading = ref(false)
const role = ref(USER_ROLE.STUDENT)

function syncRoleFromRoute() {
  role.value = route.query.role === 'publisher' ? USER_ROLE.PUBLISHER : USER_ROLE.STUDENT
}

onMounted(syncRoleFromRoute)
watch(() => route.query.role, syncRoleFromRoute)

const headline = computed(() =>
  role.value === USER_ROLE.PUBLISHER ? '招聘方 · 发布与管理岗位' : '学生 · 求职与接单联系',
)

const subline = computed(() =>
  role.value === USER_ROLE.PUBLISHER
    ? '注册后可在「发布职位」中上架兼职信息；请如实填写，遵守用工与个人信息合规要求。'
    : '注册后可浏览职位大厅、查看详情并联系招聘方；学生账号无法发布岗位，如需招聘请单独注册招聘方账号。',
)

const formTitle = computed(() =>
  role.value === USER_ROLE.PUBLISHER ? '注册招聘方账号' : '注册学生账号',
)

const setRole = (r) => {
  role.value = r
  router.replace({
    query: { ...route.query, role: r === USER_ROLE.PUBLISHER ? 'publisher' : 'student' },
  })
}

const doReg = async () => {
  if (!nickname.value || !email.value || !pwd.value) {
    alert('请填写完整信息')
    return
  }
  if (pwd.value.length < 6) {
    alert('密码至少 6 位')
    return
  }
  loading.value = true
  const { data, error } = await signUp(email.value, pwd.value, nickname.value, role.value)
  loading.value = false
  if (error) {
    alert('注册失败：' + error.message)
    return
  }

  // 已开启「邮箱验证」时：有 user 但无 session，此时无法密码登录，必须先点邮件里的链接
  if (data?.session) {
    alert('注册成功，已自动登录。')
    router.push('/list')
    return
  }

  if (data?.user && !data.session) {
    alert(
      '账号已创建。你的项目开启了「邮箱验证」，请到邮箱（含垃圾箱）点击验证链接后再登录。\n\n' +
        '若收不到邮件：可在 Supabase → Authentication → Providers → Email 中暂时关闭 Confirm email；或使用登录页的「重发验证邮件」。',
    )
    router.push({ path: '/login', query: { email: email.value.trim() } })
    return
  }

  alert(
    role.value === USER_ROLE.PUBLISHER
      ? '注册成功，请登录后发布职位。'
      : '注册成功，请登录后浏览职位。',
  )
  router.push('/login')
}
</script>

<template>
  <AuthLayout :headline="headline" :subline="subline">
    <div class="app-card p-6 shadow-card sm:p-8">
      <h1 class="text-xl font-bold text-slate-900">{{ formTitle }}</h1>
      <p class="mt-1 text-sm text-slate-500">选择身份类型后填写资料；身份保存后不可在本演示内自助切换，需分别注册。</p>

      <div class="mt-6 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          class="rounded-xl border p-4 text-left transition"
          :class="
            role === USER_ROLE.STUDENT
              ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/30'
              : 'border-slate-200 hover:border-slate-300'
          "
          @click="setRole(USER_ROLE.STUDENT)"
        >
          <span class="text-sm font-semibold text-slate-900">我是学生</span>
          <span class="mt-1 block text-xs leading-relaxed text-slate-600">浏览职位、查看联系方式并对接雇主</span>
        </button>
        <button
          type="button"
          class="rounded-xl border p-4 text-left transition"
          :class="
            role === USER_ROLE.PUBLISHER
              ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/30'
              : 'border-slate-200 hover:border-slate-300'
          "
          @click="setRole(USER_ROLE.PUBLISHER)"
        >
          <span class="text-sm font-semibold text-slate-900">我是招聘方</span>
          <span class="mt-1 block text-xs leading-relaxed text-slate-600">发布兼职岗位、编辑与下架信息</span>
        </button>
      </div>

      <form class="mt-8 space-y-5" @submit.prevent="doReg">
        <div>
          <label class="block text-sm font-medium text-slate-700">昵称</label>
          <input
            v-model="nickname"
            type="text"
            autocomplete="nickname"
            required
            class="app-input mt-2"
            :placeholder="role === USER_ROLE.PUBLISHER ? '机构简称或联系人称呼' : '如何在平台上展示'"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700">邮箱</label>
          <input
            v-model="email"
            type="email"
            autocomplete="email"
            required
            class="app-input mt-2"
            placeholder="name@university.edu.cn"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700">密码（≥6 位）</label>
          <input
            v-model="pwd"
            type="password"
            autocomplete="new-password"
            required
            minlength="6"
            class="app-input mt-2"
            placeholder="••••••••"
          />
        </div>
        <button
          type="submit"
          :disabled="loading"
          class="w-full rounded-xl bg-brand-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-700 disabled:opacity-60"
        >
          {{ loading ? '提交中…' : role === USER_ROLE.PUBLISHER ? '注册招聘方并继续' : '注册学生账号并继续' }}
        </button>
      </form>

      <p class="mt-8 text-center text-sm text-slate-600">
        已有账号？
        <RouterLink to="/login" class="font-semibold text-brand-600 hover:text-brand-800">去登录</RouterLink>
      </p>
    </div>
  </AuthLayout>
</template>
