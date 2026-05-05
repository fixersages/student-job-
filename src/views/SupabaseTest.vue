<script setup>
import { supabase } from '@/lib/supabase'

const testConn = async () => {
  const { data, error } = await supabase.from('part_time').select('*').limit(1)

  if (error) {
    console.error(error)
    alert('连接失败：请检查 .env、密钥与表名（part_time）')
  } else {
    console.log(data)
    alert('数据库可读：Vue + Supabase 连通正常')
  }
}
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
    <div class="rounded-2xl border border-slate-200 bg-white p-8 shadow-card">
      <p class="text-xs font-semibold uppercase tracking-wider text-brand-600">开发者</p>
      <h1 class="mt-2 text-2xl font-bold text-slate-900">数据连接自检</h1>
      <p class="mt-2 text-sm leading-relaxed text-slate-600">
        点击按钮将请求 <code class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">part_time</code> 表一行数据，用于确认环境变量与
        RLS 策略是否允许匿名/登录读取。
      </p>
      <button
        type="button"
        class="mt-8 w-full rounded-xl bg-slate-900 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 sm:w-auto sm:px-8"
        @click="testConn"
      >
        运行连接测试
      </button>
    </div>
  </div>
</template>
