/**
 * 给「评阅结果编辑态」拍图（桌面 + 移动），零模型成本。
 * 用法：node work/shot-review-edit.cjs
 */
const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright-core')

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const BASE = process.env.BASE || 'http://127.0.0.1:5183'
const WORK_ID = 'W-EDIT-SHOT'
const { review } = JSON.parse(fs.readFileSync(path.join(__dirname, 'live-lesson-result.json'), 'utf8'))

const WORK = {
  id: WORK_ID,
  title: '唐宋经典诗词解析（5-6 年级 语文 1 课时）',
  type: 'lesson_plan',
  author: '宁德开大附小 语文组',
  grade: '5-6 年级',
  semester: '2026秋',
  course: '语文',
  summary: '以《元日》《九月九日忆山东兄弟》为例，教学生用三步读节令诗，并把细节改写成 80 字片段。',
  content: '一、教学目标\n1. 能借助注释说出两首诗的节令与习俗。',
  tags: ['唐宋诗词', '节令诗'],
  docs: [],
  createdAt: '2026-11-07T14:20:00.000Z',
  updatedAt: '2026-11-07T14:20:00.000Z'
}

;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const outDir = path.join(__dirname, 'shots')
  fs.mkdirSync(outDir, { recursive: true })

  for (const [name, viewport] of [
    ['edit-desktop', { width: 1280, height: 1800 }],
    ['edit-mobile', { width: 390, height: 1500 }]
  ]) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 2 })
    await page.goto(BASE, { waitUntil: 'networkidle' })
    await page.evaluate(
      ({ id, work, review }) => {
        const works = JSON.parse(localStorage.getItem('wenmai.works.v1') || '[]')
        localStorage.setItem('wenmai.works.v1', JSON.stringify([work, ...works.filter((w) => w.id !== id)]))
        const reviews = JSON.parse(localStorage.getItem('wenmai.reviews.v1') || '{}')
        reviews[id] = { ...review, workId: id, edited: true, editCount: 1, editedAt: new Date().toISOString(), origin: { ...review } }
        localStorage.setItem('wenmai.reviews.v1', JSON.stringify(reviews))
      },
      { id: WORK_ID, work: WORK, review }
    )
    await page.goto(`${BASE}/?shot=${Date.now()}#/works/${WORK_ID}`, { waitUntil: 'networkidle' })
    await page.waitForSelector('[data-testid="review-panel"]')
    await page.waitForTimeout(500)
    await page.locator('[data-testid="review-panel"]').screenshot({ path: path.join(outDir, `review-edited-${name}.png`) })
    await page.click('[data-testid="review-edit-enter"]')
    await page.waitForSelector('[data-testid="review-editor"]')
    await page.waitForTimeout(400)
    await page.locator('[data-testid="review-panel"]').screenshot({ path: path.join(outDir, `review-${name}.png`) })
    await page.close()
  }

  await browser.close()
  console.log('shots →', outDir)
})().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
