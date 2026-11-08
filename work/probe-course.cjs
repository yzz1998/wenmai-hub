/* 课程专题馆专项探测：结构、边界、跨馆混杂检查 */
const { chromium } = require('playwright-core')

const BASE = 'http://127.0.0.1:5183'
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'

;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } })
  const errors = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(String(e)))
  const out = {}

  /* 首页 */
  await page.goto(BASE + '/#/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  out.title = (await page.title()).trim()
  out.h1 = (await page.locator('h1').first().innerText()).replace(/\s+/g, ' ').trim()

  /* 专题馆总览 */
  await page.goto(BASE + '/#/theme', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  out.themeCards = await page.locator('article').count()
  out.themeNames = await page.locator('article h2').allInnerTexts()

  /* 第二章馆 */
  await page.goto(BASE + '/#/theme/resources', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  out.resH1 = (await page.locator('h1').first().innerText()).trim()
  out.resSidebar = await page.locator('nav[aria-label="分类目录"] button').count()
  out.resSections = await page.locator('main section h3').allInnerTexts()
  out.resCards = await page.locator('main article').count()
  out.resChapterLine = (await page.locator('main').first().innerText()).includes('人类社会发展与资源')
  /* 抽样检查：馆内不应出现第五章的条目 */
  const resIds = await page.locator('main article a').evaluateAll((as) => as.map((a) => a.getAttribute('href') || ''))
  out.resHasCity = resIds.some((h) => h.includes('HS5'))

  /* 第五章馆 */
  await page.goto(BASE + '/#/theme/urban-rural', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  out.cityH1 = (await page.locator('h1').first().innerText()).trim()
  out.citySections = await page.locator('main section h3').allInnerTexts()
  out.cityCards = await page.locator('main article').count()
  const cityIds = await page.locator('main article a').evaluateAll((as) => as.map((a) => a.getAttribute('href') || ''))
  out.cityHasRes = cityIds.some((h) => h.includes('HS2'))

  /* 按节筛选 */
  await page.getByRole('button', { name: /工业与社会变迁/ }).first().click()
  await page.waitForTimeout(600)
  out.filteredCards = await page.locator('main article').count()
  out.filteredGroups = await page.locator('main section h3').count()

  /* 课程条目详情 */
  await page.goto(BASE + '/#/entry/HS2-003', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  const body = await page.locator('main').innerText()
  out.entryHasSection = body.includes('要点释读')
  out.entryMeta = body.includes('所属章节')
  const cite = await page.locator('section').filter({ hasText: '引用本条' }).first().innerText()
  out.citeLine = cite.split('\n').filter(Boolean).slice(1, 3).join(' / ').slice(0, 90)

  /* 移动端溢出 */
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(BASE + '/#/theme/resources', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  out.mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  out.mobileNav = await page.locator('nav[aria-label="移动端导航"] a').count()

  out.errors = errors.slice(0, 5)
  console.log(JSON.stringify(out, null, 1))
  await browser.close()
})()
