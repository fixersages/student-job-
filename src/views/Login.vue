<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter, useRoute, RouterLink } from 'vue-router'
import { signIn, resendSignupEmail, supabase } from '@/lib/supabase'
import { describeAuthError } from '@/lib/authErrors'
import { syncCampusPublicProfileFromUser } from '@/api/publicProfile'
import AuthLayout from '@/components/AuthLayout.vue'
import OAuthProviderButtons from '@/components/OAuthProviderButtons.vue'

const router = useRouter()
const route = useRoute()
const email = ref('')
const pwd = ref('')
const loading = ref(false)
const loginError = ref('')
const resendLoading = ref(false)
const resendHint = ref('')

function prepareOAuthRedirect() {
  const r = redirectAfterLogin.value
  if (r) sessionStorage.setItem('campus_oauth_redirect', r)
  else sessionStorage.removeItem('campus_oauth_redirect')
}

function onOAuthError(msg) {
  loginError.value = msg
  resendHint.value = ''
}

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
    if (import.meta.env.DEV) {
      const u = import.meta.env.VITE_SUPABASE_URL
      console.error('[login] auth error:', error, '\n当前 VITE_SUPABASE_URL 前缀:', u ? String(u).slice(0, 56) : '(未读取到)')
    }
    return
  }
  try {
    const {
      data: { user: u },
    } = await supabase.auth.getUser()
    if (u?.id) {
      const { error: syncErr } = await syncCampusPublicProfileFromUser(u)
      if (syncErr) console.warn('[login] syncCampusPublicProfileFromUser', syncErr)
    }
  } catch (e) {
    console.warn('[login] post-login sync', e)
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
    resendHint.value = describeAuthError(error)
  } else {
    resendHint.value = '验证邮件已重新发送，请到邮箱（含垃圾箱）查收。'
  }
}
</script>

<template>
  <AuthLayout
    headline="欢迎回到校兼"
    subline="学生账号用于浏览职位、联系雇主；招聘方账号用于发布与管理岗位。可使用邮箱密码或下方 Google / GitHub；首次第三方登录默认为学生。若开启邮箱验证，邮箱注册后需先点击邮件里的链接再登录。"
  >
    <div class="app-card overflow-hidden p-6 shadow-card ring-1 ring-slate-900/[0.03] sm:p-8">
      <h1 class="text-balance text-xl font-bold tracking-tight text-slate-900">登录账号</h1>
      <p class="mt-2 text-sm leading-relaxed text-slate-600">
        使用注册邮箱与密码登录，系统将自动识别学生或招聘方权限
      </p>

      <div
        v-if="loginError"
        class="mt-6 rounded-[var(--app-radius-lg)] border border-amber-200/90 bg-amber-50/95 px-4 py-3 text-sm leading-relaxed text-amber-950 shadow-sm"
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
        <button type="submit" :disabled="loading" class="app-btn-primary w-full py-3.5 disabled:opacity-55">
          {{ loading ? '登录中…' : '登录' }}
        </button>
      </form>

      <div class="relative my-8">
        <div class="absolute inset-0 flex items-center" aria-hidden="true">
          <div class="w-full border-t border-slate-200" />
        </div>
        <div class="relative flex justify-center text-xs font-medium">
          <span class="bg-white px-3 text-slate-500">或使用以下方式登录</span>
        </div>
      </div>
      <OAuthProviderButtons :before-redirect="prepareOAuthRedirect" @error="onOAuthError" />
      <p class="mt-3 text-center text-xs leading-relaxed text-slate-500">
        首次使用 Google / GitHub 将创建账号并默认为<strong class="font-medium text-slate-700">学生</strong>；需要发布职位请用邮箱注册<strong class="font-medium text-slate-700">招聘方</strong>账号。
      </p>

      <div
        class="mt-5 rounded-[var(--app-radius-lg)] border border-slate-200/90 bg-slate-50/90 px-4 py-3 text-xs leading-relaxed text-slate-600 ring-1 ring-slate-900/[0.02]"
      >
        <p class="font-medium text-slate-800">收不到邮件或一直登录失败？</p>
        <ul class="mt-2 list-inside list-disc space-y-1">
          <li>
            <strong>邮箱验证</strong>：若注册后提示需验证，请到邮箱中打开我们发送的邮件，点击其中的「确认邮箱」或验证链接，完成后再用本页邮箱与密码登录。
          </li>
          <li>
            <strong>漏收邮件</strong>：在收件箱、垃圾箱、订阅/推广或「其他」分类中查找；QQ、Outlook 等常见邮箱可能自动归类，并确认邮箱未爆满。
          </li>
          <li>
            <strong>密码与账号</strong>：核对邮箱是否拼写正确；输入密码时注意大小写与输入法中英文状态。
          </li>
        </ul>
        <button
          type="button"
          class="mt-3 text-xs font-semibold text-brand-600 underline decoration-brand-300/80 underline-offset-2 transition duration-200 hover:text-brand-800 disabled:opacity-50"
          :disabled="resendLoading"
          @click="resendVerification"
        >
          {{ resendLoading ? '发送中…' : '重发验证邮件到上方邮箱' }}
        </button>
        <p v-if="resendHint" class="mt-2 text-xs font-medium text-brand-800">{{ resendHint }}</p>
      </div>

      <p class="mt-8 text-center text-sm text-slate-600">
        还没有账号？
        <RouterLink
          to="/register"
          class="font-semibold text-brand-600 transition duration-200 hover:text-brand-800"
          >学生注册</RouterLink
        >
        <span class="mx-1.5 text-slate-300">·</span>
        <RouterLink
          to="/register?role=publisher"
          class="font-semibold text-brand-600 transition duration-200 hover:text-brand-800"
          >招聘方注册</RouterLink
        >
      </p>
    </div>
  </AuthLayout>
</template>
