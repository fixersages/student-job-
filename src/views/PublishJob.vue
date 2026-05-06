<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase, getCurrentUser, getCategoryList, isPublisher } from '@/lib/supabase'

const router = useRouter()

const form = ref({
  category_id: '',
  title: '',
  address: '',
  price: '',
  work_time: '',
  gender_req: '不限',
  phone: '',
  wechat: '',
  content: '',
  /** 可选；需在 Supabase part_time 表增加 cover_image (text) 可空列后才会写入成功 */
  cover_image: '',
})

const categoryList = ref([])
const submitting = ref(false)

const loadCategory = async () => {
  const { data } = await getCategoryList()
  categoryList.value = data ?? []
}

const submitJob = async () => {
  const user = await getCurrentUser()
  if (!user) {
    router.push('/login')
    return
  }
  if (!isPublisher(user)) {
    alert('当前为学生账号，无法发布职位。请使用招聘方账号登录，或前往注册招聘方身份。')
    router.push({ path: '/list', query: { forbidden: 'publish' } })
    return
  }

  if (!form.value.category_id || !form.value.title || !form.value.phone) {
    alert('请填写分类、标题和联系电话')
    return
  }

  submitting.value = true
  const row = {
    category_id: form.value.category_id,
    title: form.value.title,
    address: form.value.address,
    price: form.value.price,
    work_time: form.value.work_time,
    gender_req: form.value.gender_req,
    phone: form.value.phone,
    wechat: form.value.wechat,
    content: form.value.content,
    user_id: user.id,
    nickname: user.user_metadata?.nickname ?? '',
    status: 1,
  }
  const ci = form.value.cover_image?.trim()
  if (ci) row.cover_image = ci

  const { error } = await supabase.from('part_time').insert([row])
  submitting.value = false

  if (error) {
    alert('发布失败：' + (error.message || '请检查表结构与权限'))
    console.error(error)
  } else {
    alert('发布成功，您可以在职位大厅查看')
    form.value = {
      category_id: '',
      title: '',
      address: '',
      price: '',
      work_time: '',
      gender_req: '不限',
      phone: '',
      wechat: '',
      content: '',
      cover_image: '',
    }
    router.push('/list')
  }
}

onMounted(async () => {
  loadCategory()
  const user = await getCurrentUser()
  if (!user) {
    router.push({ path: '/login', query: { redirect: router.currentRoute.value.fullPath } })
    return
  }
  if (!isPublisher(user)) {
    router.replace({ path: '/list', query: { forbidden: 'publish' } })
  }
})
</script>

<template>
  <div class="border-b border-slate-200/80 bg-gradient-to-br from-white via-slate-50/80 to-brand-50/30">
    <div class="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
      <p class="text-xs font-semibold uppercase tracking-wider text-brand-600">招聘方</p>
      <h1 class="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">发布兼职职位</h1>
      <p class="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
        信息将展示在职位大厅。请如实填写联系方式，并遵守平台与法律对兼职招用、个人信息保护的要求。
      </p>
    </div>
  </div>

  <div class="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
    <div class="app-card overflow-hidden shadow-card">
      <div class="border-b border-slate-100 bg-slate-50/90 px-6 py-4 sm:px-8">
        <h2 class="text-sm font-semibold text-slate-800">基础信息</h2>
        <p class="mt-0.5 text-xs text-slate-500">带 * 为建议必填，便于学生筛选与联系</p>
      </div>
      <div class="space-y-6 p-6 sm:p-8">
        <div>
          <label class="block text-sm font-medium text-slate-700"
            >兼职分类 <span class="text-red-500">*</span></label
          >
          <select v-model="form.category_id" class="app-input mt-2">
            <option disabled value="">请选择分类</option>
            <option v-for="item in categoryList" :key="item.id" :value="item.id">
              {{ item.name }}
            </option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700"
            >职位标题 <span class="text-red-500">*</span></label
          >
          <input
            v-model="form.title"
            type="text"
            class="app-input mt-2"
            placeholder="简洁说明岗位，如：周末咖啡店店员"
          />
        </div>

        <div class="grid gap-6 sm:grid-cols-2">
          <div>
            <label class="block text-sm font-medium text-slate-700">工作地址</label>
            <input v-model="form.address" type="text" class="app-input mt-2" placeholder="城市 / 商圈 / 校区" />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700">薪资待遇</label>
            <input v-model="form.price" type="text" class="app-input mt-2" placeholder="如：150 元/天、25 元/小时" />
          </div>
        </div>

        <div class="grid gap-6 sm:grid-cols-2">
          <div>
            <label class="block text-sm font-medium text-slate-700">工作时间</label>
            <input v-model="form.work_time" type="text" class="app-input mt-2" placeholder="周末 / 晚班 / 弹性" />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700">性别要求</label>
            <select v-model="form.gender_req" class="app-input mt-2">
              <option value="不限">不限</option>
              <option value="仅限男">仅限男</option>
              <option value="仅限女">仅限女</option>
            </select>
          </div>
        </div>
      </div>

      <div class="border-t border-slate-100 bg-slate-50/50 px-6 py-4 sm:px-8">
        <h2 class="text-sm font-semibold text-slate-800">联系方式（对学生可见）</h2>
      </div>
      <div class="space-y-6 p-6 sm:p-8">
        <div class="grid gap-6 sm:grid-cols-2">
          <div>
            <label class="block text-sm font-medium text-slate-700"
              >联系电话 <span class="text-red-500">*</span></label
            >
            <input v-model="form.phone" type="tel" class="app-input mt-2" placeholder="常用手机号" />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700">微信号</label>
            <input v-model="form.wechat" type="text" class="app-input mt-2" placeholder="可选" />
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700">职位详情</label>
          <textarea
            v-model="form.content"
            rows="5"
            class="app-input mt-2 min-h-[120px] resize-y"
            placeholder="工作内容、任职要求、面试方式等"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700">封面图 URL（可选）</label>
          <input
            v-model="form.cover_image"
            type="url"
            class="app-input mt-2"
            placeholder="https://… 横图更佳；需在数据库表 part_time 增加 cover_image 文本列"
          />
          <p class="mt-1.5 text-xs leading-relaxed text-slate-500">
            未配置数据库列时请留空，列表与详情仍会自动使用系统配图。若已添加 <code class="rounded bg-slate-100 px-1">cover_image</code> 列，此处链接将用作 Banner。
          </p>
        </div>

        <div class="rounded-xl border border-slate-200/90 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
          提交即表示您确认信息真实合法，并同意在必要时配合平台进行合规核验。处理个人信息须遵守《个人信息保护法》及学校相关规定。
        </div>

        <button
          type="button"
          :disabled="submitting"
          class="app-btn-primary w-full py-3.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-brand-600"
          @click="submitJob"
        >
          {{ submitting ? '提交中…' : '提交发布' }}
        </button>
      </div>
    </div>
  </div>
</template>
