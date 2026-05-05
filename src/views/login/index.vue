<script setup>
import { useRouter } from 'vue-router'
import axios from 'axios'

const router = useRouter()

// 登录表单
const loginForm = {
  username: '',
  password: ''
}

// 登录提交
const login = async () => {
  try {
    // 调用登录接口
    const res = await axios.post('/api/login', loginForm)
    
    if (res.code === 200) {
      // 保存token和角色
      localStorage.setItem('token', res.data.token)
      localStorage.setItem('role', res.data.role)
      
      // 跳首页
      router.push('/home')
    }
  } catch (error) {
    alert('登录失败')
  }
}
</script>