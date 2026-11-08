// 单页截图：node work/shot-one.cjs <hash路由> <out.png> [宽]
const { chromium } = require('playwright-core')
const path = require('path')

;(async () => {
  const rel = process.argv[2] || '/#/library'
  const out = path.resolve(process.argv[3] || 'work/shots/one.png')
  const w = Number(process.argv[4] || 1440)
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
  const page = await browser.newPage({ viewport: { width: w, height: 1000 } })
  await page.goto('http://127.0.0.1:5183' + rel, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  await page.screenshot({ path: out })
  console.log('ok', out)
  await browser.close()
})()
