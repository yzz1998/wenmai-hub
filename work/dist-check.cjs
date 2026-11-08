/** 构建产物验收：不依赖 dev server，检查真实 dist 的静态资源与关键路由 */
const { chromium } = require('playwright-core')
const BASE = process.env.BASE || 'http://127.0.0.1:5199'
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'

const ROUTES = [
  ['首页', '/#/'],
  ['资源库', '/#/library'],
  ['剪纸馆', '/#/theme/papercut'],
  ['畲族馆', '/#/theme/she'],
  ['剪纸详情', '/#/entry/PC-001'],
  ['畲族详情', '/#/entry/SHE-CLOTH-01'],
  ['知识详情', '/#/entry/M-FEST-001'],
  ['关于', '/#/about'],
  ['管理', '/#/manage']
]

;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } })
  const bad = []
  page.on('console', (m) => m.type() === 'error' && bad.push('console: ' + m.text().slice(0, 120)))
  page.on('response', (r) => r.status() >= 400 && bad.push(r.status() + ' ' + r.url()))

  for (const [name, path] of ROUTES) {
    await page.goto(BASE + path, { waitUntil: 'networkidle' })
    await page.waitForTimeout(700)
    const imgs = await page.evaluate(() => {
      const list = [...document.querySelectorAll('img')].filter((i) => i.clientWidth > 0)
      const okImgs = list.filter((i) => i.complete && i.naturalWidth > 0)
      return { total: list.length, ok: okImgs.length, h1: (document.querySelector('h1')?.innerText || '').slice(0, 24) }
    })
    console.log(`${name.padEnd(6, '　')} ${path.padEnd(26)} h1="${imgs.h1}" 图片 ${imgs.ok}/${imgs.total}`)
  }

  console.log('\n错误：', bad.length ? [...new Set(bad)].slice(0, 10) : '无')
  await browser.close()
})()
