/**
 * 本地模拟 GitHub Pages 的子路径托管：把 dist/ 挂在 http://127.0.0.1:8099/wenmai-hub/ 下。
 *
 * 为什么要这一步：站点部署到项目页时，根目录不是域名根而是 /<repo>/。
 * 任何写死的 '/img/...' 或 '/assets/...' 都会指到域名根而 404，而本地 dev（根路径）
 * 永远发现不了这个问题。所以发布前先用真实的子路径跑一遍。
 *
 * 用法：node work/serve-pages.cjs [port]
 */
const http = require('http')
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const DIST = path.join(ROOT, 'dist')
const PREFIX = '/wenmai-hub'
const PORT = Number(process.argv[2] || 8099)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8'
}

const log = []

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0])

  // 记录每个请求，测试脚本据此判断有没有 404
  const record = (status) => log.push({ path: urlPath, status })

  if (urlPath === '/' || urlPath === PREFIX) {
    res.writeHead(302, { Location: `${PREFIX}/` })
    record(302)
    return res.end()
  }
  if (!urlPath.startsWith(`${PREFIX}/`)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    record(404)
    return res.end('outside base path')
  }

  let rel = urlPath.slice(PREFIX.length + 1)
  if (rel === '' || rel.endsWith('/')) rel += 'index.html'

  const file = path.join(DIST, rel)
  if (!file.startsWith(DIST) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    record(404)
    return res.end('not found')
  }

  res.writeHead(200, {
    'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': 'no-cache'
  })
  record(200)
  fs.createReadStream(file).pipe(res)
})

if (process.argv.includes('--log')) {
  // 供测试脚本读取 404 清单
  server.on('request', (req) => {
    if (req.url === '/__log') {
      // 不会走到这里（上面的 handler 先响应），保留位
    }
  })
}

// 单独开一个只回日志的小服务，避免与静态路径混在一起
http
  .createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify(log, null, 2))
  })
  .listen(PORT + 1, '127.0.0.1')

server.listen(PORT, '127.0.0.1', () => {
  console.log(`serving dist at http://127.0.0.1:${PORT}${PREFIX}/  (log: http://127.0.0.1:${PORT + 1}/)`)
})
