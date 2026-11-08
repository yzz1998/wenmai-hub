// 用 file:// 打开构建包，验证图片是否真的能加载（用户很可能双击 dist/index.html）
const { chromium } = require('playwright-core')
;(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const errs = []
  page.on('requestfailed', (r) => errs.push(r.url().slice(-60) + ' :: ' + r.failure()?.errorText))
  await page.goto('file:///C:/Users/YZZ/WorkBuddy/2026-11-04-19-28-57/wenmai-hub/dist/index.html#/', { waitUntil: 'load' })
  await page.waitForTimeout(2500)
  const stat = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll('img')]
    return {
      total: imgs.length,
      broken: imgs.filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.getAttribute('src')),
      sample: imgs.slice(0, 6).map((i) => i.getAttribute('src') + ' → ' + i.naturalWidth)
    }
  })
  console.log(JSON.stringify(stat, null, 2))
  console.log('请求失败：', errs.slice(0, 5))
  await page.screenshot({ path: 'work/shots/file-home.png', fullPage: false })
  await browser.close()
})()
