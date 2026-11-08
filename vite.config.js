import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * base 用相对路径：构建产物既可直接部署到任意静态托管，
 * 也可以 file:// 双击打开（全站用 HashRouter + 相对资源地址）。
 *
 * 注意：现在站内唯一会发网络请求的地方是 AI 评阅（POST /api/review），
 * 它由 EdgeOne 云函数提供。开发时前端跑 vite（5183，热更新快），
 * 函数跑 `edgeone makers dev`（8088），所以这里把 /api 代理过去。
 * 只在 dev 生效，构建产物里没有代理，线上由 EdgeOne 自己的路由接管。
 */
const FUNCTIONS_ORIGIN = process.env.EO_DEV_ORIGIN || 'http://127.0.0.1:8088'

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 5183,
    strictPort: false,
    proxy: {
      '/api': { target: FUNCTIONS_ORIGIN, changeOrigin: false }
    }
  },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 2048,
    chunkSizeWarningLimit: 1600
  }
})
