// 手机端截图：node work/shot-mobile.cjs <hash路由> <out.png>
const { chromium } = require('playwright-core')
const path = require('path')

;(async () => {
  const rel = process.argv[2] || '/#/theme/mindong'
  const out = path.resolve(process.argv[3] || 'work/shots/mobile.png')
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  })
  await page.goto('http://127.0.0.1:5183' + rel, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  await page.screenshot({ path: out })
  console.log('ok', out)
  await browser.close()
})()
