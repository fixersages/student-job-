<script setup>
import { ref } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { signIn } from '@/lib/supabase'
import AuthLayout from '@/components/AuthLayout.vue'

const router = useRouter()
const email = ref('')
const pwd = ref('')
const loading = ref(false)

const doLogin = async () => {
  loading.value = true
  const { error } = await signIn(email.value, pwd.value)
  loading.value = false
  if (error) {
    alert('登录失败：请检查邮箱与密码')
  } else {
    router.push('/list')
  }
}
</script>

<template>
  <AuthLayout
    headline="欢迎回到校兼"
    subline="登录后可收藏沟通记录、发布与管理职位（具体能力依后端配置而定）。"
  >
    <div class="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-card">
      <h1 class="text-xl font-bold text-slate-900">登录账号</h1>
      <p class="mt-1 text-sm text-slate-500">使用注册邮箱与密码登录</p>

      <form class="mt-8 space-y-5" @submit.prevent="doLogin">
        <div>
          <label class="block text-sm font-medium text-slate-700">邮箱</label>
          <input
            v-model="email"
            type="email"
            autocomplete="email"
            required
            class="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
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
            class="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
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

      <p class="mt-8 text-center text-sm text-slate-600">
        还没有账号？
        <RouterLink to="/register" class="font-semibold text-brand-600 hover:text-brand-800">免费注册</RouterLink>
      </p>
    </div>
  </AuthLayout>
</template>
