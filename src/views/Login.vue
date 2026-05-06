<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter, useRoute, RouterLink } from 'vue-router'
import { signIn, resendSignupEmail } from '@/lib/supabase'
import { describeAuthError } from '@/lib/authErrors'
import AuthLayout from '@/components/AuthLayout.vue'

const router = useRouter()
const route = useRoute()
const email = ref('')
const pwd = ref('')
const loading = ref(false)
const loginError = ref('')
const resendLoading = ref(false)
const resendHint = ref('')

const redirectAfterLogin = computed(() => {
  const r = route.query.redirect
  return typeof r === 'string' && r.startsWith('/') && !r.startsWith('//') ? r : null
})

watch(
  () => route.query.email,
  (e) => {
    if (typeof e === 'string' && e.trim()) email.value = e.trim()
  },
  { immediate: true },
)

const doLogin = async () => {
  loginError.value = ''
  resendHint.value = ''
  loading.value = true
  const { error } = await signIn(email.value, pwd.value)
  loading.value = false
  if (error) {
    loginError.value = describeAuthError(error)
    return
  }
  if (redirectAfterLogin.value) {
    router.replace(redirectAfterLogin.value)
  } else {
    router.push('/list')
  }
}

async function resendVerification() {
  const e = email.value.trim()
  if (!e) {
    resendHint.value = '请先填写注册时使用的邮箱。'
    return
  }
  resendLoading.value = true
  resendHint.value = ''
  const { error } = await resendSignupEmail(e)
  resendLoading.value = false
  if (error) {
    resendHint.value = error.message || '发送失败，请稍后再试。'
  } else {
    resendHint.value = '验证邮件已重新发送，请到邮箱（含垃圾箱）查收。'
  }
}
</script>

<template>
  <AuthLayout
    headline="欢迎回到校兼"
    subline="学生账号用于浏览职位、联系雇主；招聘方账号用于发布与管理岗位。若项目开启了邮箱验证，注册后需先点击邮件里的链接再登录。"
  >
    <div class="app-card p-6 shadow-card sm:p-8">
      <h1 class="text-xl font-bold text-slate-900">登录账号</h1>
      <p class="mt-1 text-sm text-slate-500">使用注册邮箱与密码登录，系统将自动识别学生或招聘方权限</p>

      <div
        v-if="loginError"
        class="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950"
        role="alert"
      >
        {{ loginError }}
      </div>

      <form class="mt-8 space-y-5" @submit.prevent="doLogin">
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
          <label class="block text-sm font-medium text-slate-700">密码</label>
          <input
            v-model="pwd"
            type="password"
            autocomplete="current-password"
            required
            class="app-input mt-2"
            placeholder="••••••••"
          />
        </div>
        <button
          type="submit"
          :disabled="loading"
          class="w-full rounded-xl bg-brand-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-700 disabled:opacity-60"
        >
          {{ loading ? '登录中…' : '登录' }}
        </button>
      </form>

      <div class="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-xs leading-relaxed text-slate-600">
        <p class="font-medium text-slate-800">收不到邮件或一直登录失败？</p>
        <ul class="mt-2 list-inside list-disc space-y-1">
          <li>在 Supabase 控制台：<strong>Authentication → Providers → Email</strong>，可暂时关闭「Confirm email」便于本地调试。</li>
          <li>QQ 邮箱请检查「垃圾箱」与「订阅邮件」。</li>
        </ul>
        <button
          type="button"
          class="mt-3 text-xs font-semibold text-brand-600 underline decoration-brand-400/60 underline-offset-2 hover:text-brand-800 disabled:opacity-50"
          :disabled="resendLoading"
          @click="resendVerification"
        >
          {{ resendLoading ? '发送中…' : '重发验证邮件到上方邮箱' }}
        </button>
        <p v-if="resendHint" class="mt-2 text-xs font-medium text-brand-800">{{ resendHint }}</p>
      </div>

      <p class="mt-8 text-center text-sm text-slate-600">
        还没有账号？
        <RouterLink to="/register" class="font-semibold text-brand-600 hover:text-brand-800">学生注册</RouterLink>
        <span class="mx-1 text-slate-400">·</span>
        <RouterLink
          to="/register?role=publisher"
          class="font-semibold text-brand-600 hover:text-brand-800"
          >招聘方注册</RouterLink
        >
      </p>
    </div>
  </AuthLayout>
</template>
