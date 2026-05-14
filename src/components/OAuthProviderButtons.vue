<script setup>
import { ref } from 'vue'
import { signInWithOAuthProvider } from '@/lib/supabase'
import { describeAuthError } from '@/lib/authErrors'

const props = defineProps({
  /** 发起跳转前执行（例如写入 sessionStorage 供 OAuth 回调后恢复路由） */
  beforeRedirect: {
    type: Function,
    default: null,
  },
})

const emit = defineEmits(['error'])

const loading = ref('')

async function go(provider) {
  if (loading.value) return
  loading.value = provider
  try {
    props.beforeRedirect?.()
    const { error } = await signInWithOAuthProvider(provider)
    if (error) {
      emit('error', describeAuthError(error))
      loading.value = ''
      return
    }
  } catch (e) {
    emit('error', describeAuthError(e))
    loading.value = ''
    return
  }
  // 成功时浏览器会整页跳转到提供商；若未跳转则复位按钮
  setTimeout(() => {
    loading.value = ''
  }, 12_000)
}
</script>

<template>
  <div class="grid gap-3 sm:grid-cols-2">
    <button
      type="button"
      class="flex w-full items-center justify-center gap-2 rounded-[var(--app-radius-lg)] border border-slate-200/95 bg-white py-3 text-sm font-semibold text-slate-800 shadow-sm ring-1 ring-slate-900/[0.02] transition duration-200 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-55"
      :disabled="!!loading"
      @click="go('google')"
    >
      <span class="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-bold leading-none text-[#4285F4] ring-1 ring-slate-200/80">G</span>
      {{ loading === 'google' ? '跳转中…' : '使用 Google 继续' }}
    </button>
    <button
      type="button"
      class="flex w-full items-center justify-center gap-2 rounded-[var(--app-radius-lg)] border border-slate-200/95 bg-slate-900 py-3 text-sm font-semibold text-white shadow-sm transition duration-200 hover:bg-slate-800 disabled:opacity-55"
      :disabled="!!loading"
      @click="go('github')"
    >
      <svg class="h-5 w-5 shrink-0 opacity-95" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path
          d="M12 2C6.477 2 2 6.463 2 11.97c0 4.404 2.865 8.14 6.839 9.458.5.092.682-.216.682-.481 0-.237-.009-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.905-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.089 2.91.833.092-.647.35-1.086.636-1.336-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.114 2.504.336 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.917.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.107 22 16.373 22 11.969 22 6.463 17.522 2 12 2z"
        />
      </svg>
      {{ loading === 'github' ? '跳转中…' : '使用 GitHub 继续' }}
    </button>
  </div>
</template>
