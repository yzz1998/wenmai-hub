// 全页截图：node work/shot-full.cjs <hash路由> <out.png> [宽] [maxHeight]
const { chromium } = require('playwright-core')
const path = require('path')
const sharp = require('sharp')

;(async () => {
  const rel = process.argv[2] || '/#/theme'
  const out = path.resolve(process.argv[3] || 'work/shots/full.png')
  const w = Number(process.argv[4] || 1440)
  const maxH = Number(process.argv[5] || 4000)
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
  const page = await browser.newPage({ viewport: { width: w, height: 1000 } })
  await page.goto('http://127.0.0.1:5183' + rel, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1400)
  // 懒加载图：先滚到底再回顶，确保全部图片进入视口
  await page.evaluate(async () => {
    const step = 700
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 120))
    }
    window.scrollTo(0, 0)
  })
  await page.waitForTimeout(800)
  const h = await page.evaluate(() => document.body.scrollHeight)
  const shot = await page.screenshot({ fullPage: true })
  if (h > maxH) {
    // 超长页面：等比缩到可读宽度，避免 ViewImage 读不清
    const img = sharp(shot)
    const meta = await img.metadata()
    const scale = Math.min(1, maxH / meta.height)
    await img.resize({ width: Math.round(meta.width * scale) }).toFile(out)
    console.log('ok', out, `${meta.width}x${meta.height} → scaled ${scale.toFixed(2)}`)
  } else {
    await sharp(shot).toFile(out)
    console.log('ok', out, `1440x${h}`)
  }
  await browser.close()
})()
