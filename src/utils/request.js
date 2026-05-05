import axios from 'axios'

const service = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 5000
})

// 请求拦截器
service.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截器
service.interceptors.response.use(
  res => res.data,
  err => {
    // 401 过期/未登录，跳登录
    if (err.response?.status === 401) {
      localStorage.clear()
      location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default service