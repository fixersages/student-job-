<template>
  <div class="upload-box">
    <!-- 选择图片 -->
    <input
      ref="fileRef"
      type="file"
      accept="image/*"
      style="display: none"
      @change="handleFileChange"
    />
    <button @click="triggerUpload">点击上传图片</button>

    <!-- 图片预览 -->
    <div class="preview" v-if="imgUrl">
      < img :src="imgUrl" alt="预览图" />
    </div>
  </div>
</template>
<script setup>
import { ref } from 'vue'

// 元素实例
const fileRef = ref(null)
// 预览图片地址
const imgUrl = ref('')

// 触发文件选择
const triggerUpload = () => {
  fileRef.value.click()
}

// 监听文件选择
const handleFileChange = async (e) => {
  const file = e.target.files[0]
  if (!file) return

  // 限制只能是图片
  if (!file.type.startsWith('image/')) {
    alert('请选择图片文件')
    return
  }

  // 限制大小 5M
  const maxSize = 5 * 1024 * 1024
  if (file.size > maxSize) {
    alert('图片不能超过5M')
    return
  }

  // 本地预览
  imgUrl.value = URL.createObjectURL(file)

  // 组装 FormData 传给后端
  const formData = new FormData()
  formData.append('file', file)

  try {
    // 替换成你的上传接口地址
    const res = await fetch('/api/uploadImg', {
      method: 'POST',
      body: formData
    })
    const data = await res.json()
    console.log('上传成功', data)
    // 后端返回图片真实url，可存表单提交
  } catch (err) {
    console.error('上传失败', err)
  }
}
</script>
<style scoped>
.upload-box {
  margin: 20px;
}
button {
  padding: 6px 16px;
  cursor: pointer;
}
.preview {
  margin-top: 15px;
}
.preview img {
  width: 200px;
  height: auto;
  border-radius: 4px;
}
</style>