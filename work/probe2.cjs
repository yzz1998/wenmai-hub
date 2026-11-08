const { chromium } = require('playwright-core')
const BASE = process.env.BASE || 'http://127.0.0.1:5183'
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'

;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const errs = []
  page.on('requestfailed', (r) => errs.push('FAIL ' + r.url()))
  page.on('response', (r) => r.status() >= 400 && errs.push(r.status() + ' ' + r.url()))
  await page.goto(`${BASE}/#/theme`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  const info = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll('article img')].map((i) => ({
      src: i.getAttribute('src'),
      cur: i.currentSrc,
      natural: i.naturalWidth,
      w: i.clientWidth,
      h: i.clientHeight
    }))
    const cells = [...document.querySelectorAll('article .grid > div')].slice(0, 8).map((d) => d.innerHTML.slice(0, 90))
    return { imgs, cells }
  })
  console.log(JSON.stringify(info, null, 2))
  console.log('ERRORS:', JSON.stringify([...new Set(errs)], null, 2))
  await page.screenshot({ path: 'work/shots/_crop-themes-she.png', clip: { x: 540, y: 240, width: 460, height: 320 } })
  await browser.close()
})()
