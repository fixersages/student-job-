<template>
  <footer class="mt-auto border-t border-slate-200/80 bg-gradient-to-b from-white to-slate-50/90">
    <div class="app-container py-12 sm:py-14">
      <div class="grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-12">
        <div class="lg:col-span-1">
          <div class="flex items-center gap-2.5">
            <span
              class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-indigo-700 text-sm font-bold text-white shadow-md shadow-brand-600/20"
              >校</span
            >
            <span class="text-lg font-bold tracking-tight text-slate-900">校兼</span>
          </div>
          <p class="mt-4 text-sm leading-relaxed text-slate-600">
            面向高校学生的合规兼职信息平台：结构化展示、分端权限与移动端友好布局，助力安全撮合。
          </p>
        </div>
        <div>
          <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-400">求职者</h3>
          <ul class="mt-4 space-y-2.5 text-sm">
            <li>
              <router-link
                to="/list"
                class="text-slate-600 transition hover:text-brand-600"
                >浏览职位</router-link
              >
            </li>
            <li>
              <router-link to="/profile" class="text-slate-600 transition hover:text-brand-600">个人中心</router-link>
            </li>
            <li>
              <router-link to="/register" class="text-slate-600 transition hover:text-brand-600">学生注册</router-link>
            </li>
          </ul>
        </div>
        <div>
          <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-400">招聘方</h3>
          <ul class="mt-4 space-y-2.5 text-sm">
            <li>
              <router-link
                to="/publish"
                class="text-slate-600 transition hover:text-brand-600"
                >发布兼职</router-link
              >
            </li>
            <li>
              <router-link
                to="/register?role=publisher"
                class="text-slate-600 transition hover:text-brand-600"
                >招聘方注册</router-link
              >
            </li>
            <li>
              <router-link to="/login" class="text-slate-600 transition hover:text-brand-600">登录管理</router-link>
            </li>
          </ul>
        </div>
        <div>
          <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-400">合规与安全</h3>
          <ul class="mt-4 space-y-2.5 text-sm text-slate-600">
            <li>请勿轻信「押金 / 刷单」类信息</li>
            <li>签约与薪资请以书面约定为准</li>
            <li>
              <router-link to="/test" class="font-medium text-brand-600 transition hover:text-brand-700"
                >连接与数据自检</router-link
              >
            </li>
          </ul>
        </div>
      </div>
      <div
        class="mt-10 flex flex-col items-center justify-between gap-4 border-t border-slate-200/80 pt-8 text-center text-xs text-slate-500 sm:flex-row sm:text-left"
      >
        <p>© {{ year }} 校兼 CampusPart · 演示界面 · 上线前请补充资质与用户协议</p>
        <p class="text-slate-400">support@example.com · 工作日 9:00–18:00</p>
      </div>
    </div>
  </footer>
</template>

<script setup>
const year = new Date().getFullYear()
</script>
