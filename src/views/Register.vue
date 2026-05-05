<script setup>
import { ref } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { signUp } from '@/lib/supabase'
import AuthLayout from '@/components/AuthLayout.vue'

const router = useRouter()
const nickname = ref('')
const email = ref('')
const pwd = ref('')
const loading = ref(false)

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
  const { error } = await signUp(email.value, pwd.value, nickname.value)
  loading.value = false
  if (error) {
    alert('注册失败：' + error.message)
  } else {
    alert('注册成功，请前往邮箱验证（若开启）或直接登录')
    router.push('/login')
  }
}
</script>

<template>
  <AuthLayout
    headline="加入校兼人才库"
    subline="完善基本信息，更快获得可信兼职机会；我们建议你使用校园邮箱注册。"
  >
    <div class="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-card">
      <h1 class="text-xl font-bold text-slate-900">创建账号</h1>
      <p class="mt-1 text-sm text-slate-500">免费注册，用于发布与沟通职位</p>

      <form class="mt-8 space-y-5" @submit.prevent="doReg">
        <div>
          <label class="block text-sm font-medium text-slate-700">昵称</label>
          <input
            v-model="nickname"
            type="text"
            autocomplete="nickname"
            required
            class="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            placeholder="如何在平台上展示"
          />
        </div>
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
          <label class="block text-sm font-medium text-slate-700">密码（≥6 位）</label>
          <input
            v-model="pwd"
            type="password"
            autocomplete="new-password"
            required
            minlength="6"
            class="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            placeholder="••••••••"
          />
        </div>
        <button
          type="submit"
          :disabled="loading"
          class="w-full rounded-xl bg-brand-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-700 disabled:opacity-60"
        >
          {{ loading ? '提交中…' : '注册并继续' }}
        </button>
      </form>

      <p class="mt-8 text-center text-sm text-slate-600">
        已有账号？
        <RouterLink to="/login" class="font-semibold text-brand-600 hover:text-brand-800">直接登录</RouterLink>
      </p>
    </div>
  </AuthLayout>
</template>
