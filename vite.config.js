import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  /** 仅暴露以此前缀开头的环境变量到 import.meta.env（默认即为 VITE_，此处显式固定便于排查） */
  envPrefix: 'VITE_',
  plugins: [vue()],
  base: '/',
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
