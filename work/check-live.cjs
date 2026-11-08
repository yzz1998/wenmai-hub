// 线上验收：打开 EdgeOne 部署地址，检查首页/专题馆封面是否为最新版，并截图
const { chromium } = require('playwright-core')
const BASE = 'https://wenmai-hub-oidslsnr.edgeone.cool/?eo_token=466268d8e7583ccc89c0193897b3b0aa&eo_time=1793941797'
;(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } })
  const bad = []
  page.on('requestfailed', (r) => bad.push(r.url().slice(-70) + ' :: ' + (r.failure()?.errorText || '')))
  page.on('response', (r) => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url().slice(-70)) })

  const probe = async (hash) => {
    await page.goto(BASE + hash, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 100)) }
      window.scrollTo(0, 0)
    })
    await page.waitForTimeout(800)
    return page.evaluate(() => {
      const imgs = [...document.querySelectorAll('img')]
      const broken = imgs.filter(i => i.complete && i.naturalWidth === 0).map(i => i.getAttribute('src'))
      const heroGrid = [...document.querySelectorAll('.grid-rows-3')].length
      const sources = [...new Set(imgs.map(i => (i.getAttribute('src') || '').split('/').pop()))]
      return { imgTotal: imgs.length, broken, heroGrid, hasXiapu: sources.some(s => s.includes('scenic-xiapu')) }
    })
  }

  const home = await probe('#/')
  console.log('首页', JSON.stringify(home))
  const theme = await probe('#/theme')
  console.log('专题馆', JSON.stringify(theme))

  // 截专题馆第二行三张卡（乡土三馆）
  const cards = await page.$$('article')
  console.log('专题馆卡片数', cards.length)
  if (cards[2]) await (await cards[2].$('a')).screenshot({ path: 'work/shots/live-mindong.png' })
  await page.screenshot({ path: 'work/shots/live-theme-row.png', clip: { x: 0, y: 0, width: 1440, height: 1100 } })
  console.log('请求异常', bad.slice(0, 6))
  await browser.close()
})()
