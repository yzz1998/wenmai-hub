/**
 * 截几张图看内嵌设置与材料清单的实际观感。
 * 用法：node work/shot-settings.cjs
 */
const path = require('path')
const { chromium } = require('playwright-core')

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const BASE = process.env.BASE || 'http://127.0.0.1:5183'
const OUT = path.join(__dirname, 'shots')

;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 1400 }, deviceScaleFactor: 2 })
  await page.addInitScript(() => {
    localStorage.removeItem('wenmai.settings.v1')
    localStorage.removeItem('wenmai.review.mock')
  })

  /* 1. 未配置：评阅面板的引导 + 材料清单 */
  await page.goto(`${BASE}/#/works/W-2026-0001`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  const panel = page.locator('[data-testid="review-panel"]')
  await panel.screenshot({ path: path.join(OUT, 'review-need-setup-2x.png') })
  console.log('已截 review-need-setup-2x.png')

  /* 2. 设置面板：未配置态 */
  await page.locator('[data-testid="open-settings"]').click()
  await page.waitForTimeout(600)
  await page.locator('[role="dialog"]').screenshot({ path: path.join(OUT, 'settings-empty-2x.png') })
  console.log('已截 settings-empty-2x.png')

  /* 3. 设置面板：已填 Key + 测过连接 */
  await page.locator('[data-testid="api-key-input"]').fill('sk-demo0000000000000000000000000000')
  await page.waitForTimeout(400)
  await page.locator('[role="dialog"]').screenshot({ path: path.join(OUT, 'settings-filled-2x.png') })
  console.log('已截 settings-filled-2x.png')

  /* 4. 已配置后的评阅面板（含材料清单 + 按钮） */
  await page.locator('[data-testid="toggle-mock"]').check()
  await page.locator('[data-testid="save-settings"]').click()
  await page.waitForTimeout(300)
  await page.locator('[role="dialog"] button[aria-label="关闭"]').click()
  await page.waitForTimeout(500)
  await page.locator('[data-testid="review-panel"]').screenshot({ path: path.join(OUT, 'review-ready-2x.png') })
  console.log('已截 review-ready-2x.png')

  /* 5. 移动端设置弹窗 */
  const m = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  await m.goto(`${BASE}/#/works`, { waitUntil: 'networkidle' })
  await m.waitForTimeout(700)
  await m.locator('[data-testid="open-settings"]').click()
  await m.waitForTimeout(600)
  await m.screenshot({ path: path.join(OUT, 'settings-mobile-2x.png') })
  console.log('已截 settings-mobile-2x.png')

  await browser.close()
})()
