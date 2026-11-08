// 逐张卡片截图：node work/shot-cards.cjs <hash路由> <outPrefix> [宽]
// 用于放大检查专题馆封面（图源、裁切、是否变形）
const { chromium } = require('playwright-core')
const path = require('path')

;(async () => {
  const rel = process.argv[2] || '/#/theme'
  const prefix = process.argv[3] || 'work/shots/card'
  const w = Number(process.argv[4] || 1440)
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
  const page = await browser.newPage({ viewport: { width: w, height: 1100 } })
  await page.goto('http://127.0.0.1:5183' + rel, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  await page.evaluate(async () => {
    const step = 700
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 120))
    }
    window.scrollTo(0, 0)
  })
  await page.waitForTimeout(700)

  const cards = await page.$$('article')
  console.log('找到卡片', cards.length)
  for (let i = 0; i < cards.length; i++) {
    const el = await cards[i].$('a')
    if (!el) continue
    const out = path.resolve(`${prefix}-${i + 1}.png`)
    await el.screenshot({ path: out })
    const box = await el.boundingBox()
    console.log('ok', out, `${Math.round(box.width)}x${Math.round(box.height)}`)
  }
  await browser.close()
})()
