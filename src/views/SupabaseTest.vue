<script setup>
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'

const running = ref(false)

const testConn = async () => {
  running.value = true
  try {
    const { data, error } = await supabase.from('part_time').select('*').limit(1)

    if (error) {
      console.error(error)
      alert('连接失败：请检查 .env、密钥与表名（part_time）及 RLS 策略')
    } else {
      console.log(data)
      alert('数据库可读：Vue + Supabase 连通正常')
    }
  } finally {
    running.value = false
  }
}
</script>

<template>
  <div class="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
    <div class="app-card p-6 sm:p-8">
      <p class="text-xs font-semibold uppercase tracking-wider text-brand-600">开发者</p>
      <h1 class="mt-2 text-2xl font-bold tracking-tight text-slate-900">数据连接自检</h1>
      <p class="mt-3 text-sm leading-relaxed text-slate-600">
        请求 <code class="rounded-lg bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-800">part_time</code>
        表一行数据，用于确认环境变量与 RLS 是否允许当前身份读取。
      </p>
      <button
        type="button"
        class="app-btn-primary mt-8 w-full sm:w-auto"
        :disabled="running"
        @click="testConn"
      >
        {{ running ? '请求中…' : '运行连接测试' }}
      </button>
    </div>
  </div>
</template>
