const { chromium } = require('playwright-core')
const BASE = process.env.BASE || 'http://127.0.0.1:5183'
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'

;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 })
  await page.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  await page.screenshot({ path: 'work/shots/_crop-mobile-head.png', clip: { x: 240, y: 0, width: 150, height: 64 } })
  const info = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('header button')].map((b) => ({
      cls: b.className.slice(0, 60),
      text: b.innerText.trim(),
      html: b.innerHTML.slice(0, 120)
    }))
    return btns
  })
  console.log(JSON.stringify(info, null, 2))
  await browser.close()
})()
