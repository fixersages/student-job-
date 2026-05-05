<template>
  <footer class="mt-auto border-t border-slate-200/80 bg-white">
    <div class="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div class="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
        <div class="lg:col-span-1">
          <div class="flex items-center gap-2">
            <span
              class="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white shadow-sm"
              >校</span
            >
            <span class="text-lg font-semibold text-slate-900">校兼</span>
          </div>
          <p class="mt-3 text-sm leading-relaxed text-slate-600">
            面向高校学生的合规兼职信息与撮合平台，助力学业与实习兼顾。
          </p>
        </div>
        <div>
          <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-400">求职者</h3>
          <ul class="mt-4 space-y-2 text-sm">
            <li>
              <router-link to="/list" class="text-slate-600 hover:text-brand-600">浏览职位</router-link>
            </li>
            <li>
              <router-link to="/register" class="text-slate-600 hover:text-brand-600">注册账号</router-link>
            </li>
          </ul>
        </div>
        <div>
          <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-400">招聘方</h3>
          <ul class="mt-4 space-y-2 text-sm">
            <li>
              <router-link to="/publish" class="text-slate-600 hover:text-brand-600">发布兼职</router-link>
            </li>
            <li>
              <router-link to="/login" class="text-slate-600 hover:text-brand-600">登录管理</router-link>
            </li>
          </ul>
        </div>
        <div>
          <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-400">合规与安全</h3>
          <ul class="mt-4 space-y-2 text-sm text-slate-600">
            <li>请勿轻信「押金 / 刷单」类信息</li>
            <li>签约与薪资请以书面约定为准</li>
            <li>
              <router-link to="/test" class="text-brand-600 hover:text-brand-700">连接与数据自检</router-link>
            </li>
          </ul>
        </div>
      </div>
      <div
        class="mt-10 flex flex-col items-center justify-between gap-4 border-t border-slate-100 pt-8 text-center text-xs text-slate-500 sm:flex-row sm:text-left"
      >
        <p>© {{ year }} 校兼 CampusPart · 演示产品界面 · 上线前请补充资质与用户协议</p>
        <p class="text-slate-400">客服邮箱：support@example.com · 工作日 9:00–18:00</p>
      </div>
    </div>
  </footer>
</template>

<script setup>
const year = new Date().getFullYear()
</script>
