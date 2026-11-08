const { chromium } = require('playwright-core')
const BASE = process.env.BASE || 'http://127.0.0.1:5183'
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const OUT = 'work/shots'

const PAGES = [
  ['home', '/#/', 1440, 1100, 0],
  ['library', '/#/library', 1440, 1050, 0],
  ['papercut', '/#/theme/papercut', 1440, 1100, 0],
  ['she', '/#/theme/she', 1440, 1100, 0],
  ['entry-papercut', '/#/entry/PC-001', 1440, 1250, 0],
  ['entry-she', '/#/entry/SHE-CLOTH-01', 1440, 1350, 0],
  ['entry-mindong', '/#/entry/M-FEST-001', 1440, 1250, 0],
  ['themes', '/#/theme', 1440, 1050, 0],
  ['theme-resources', '/#/theme/resources', 1440, 1150, 0],
  ['theme-urban-rural', '/#/theme/urban-rural', 1440, 1150, 0],
  ['entry-course', '/#/entry/HS5-002', 1440, 1250, 0],
  ['about', '/#/about', 1440, 1100, 0],
  ['manage', '/#/manage', 1440, 1050, 0],
  ['home-mobile', '/#/', 390, 844, 0],
  ['papercut-mobile', '/#/theme/papercut', 390, 844, 0],
  ['theme-resources-mobile', '/#/theme/resources', 390, 844, 0]
]

;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  for (const [name, path, w, h] of PAGES) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
    await page.goto(BASE + path, { waitUntil: 'networkidle' })
    await page.waitForTimeout(900)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(250)
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false })
    console.log('shot', name)
    await page.close()
  }

  // 查看器特写
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } })
  await page.goto(`${BASE}/#/entry/PC-001`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  await page.locator('figure button').first().click()
  await page.waitForTimeout(900)
  await page.screenshot({ path: `${OUT}/lightbox.png` })
  console.log('shot lightbox')
  await browser.close()
})()
