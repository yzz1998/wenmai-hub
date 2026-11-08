/**
 * 给「真实模型评阅结果」拍一张完整截图，用来看七维面板的实际排版。
 *
 * 不复跑模型：直接把 work/live-lesson-result.json（真实 deepseek-flash 输出）注入
 * localStorage，再打开详情页。这样截图零成本，且看到的就是真实数据。
 *
 * 用法：node work/shot-live-panel.cjs
 */
const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright-core')

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const BASE = process.env.BASE || 'http://127.0.0.1:5183'
const RESULT = path.join(__dirname, 'live-lesson-result.json')
const WORK_ID = 'W-LIVE-LESSON'

if (!fs.existsSync(RESULT)) {
  console.error('先跑 work/test-live-lesson.mjs 生成 live-lesson-result.json')
  process.exit(2)
}
const { review, elapsedMs, usage } = JSON.parse(fs.readFileSync(RESULT, 'utf8'))

;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const page = await browser.newPage({ viewport: { width: 1240, height: 1400 }, deviceScaleFactor: 2 })
  await page.goto(BASE, { waitUntil: 'networkidle' })

  await page.evaluate(
    ({ id, review }) => {
      const WORK = {
        id,
        title: '唐宋经典诗词解析（5-6 年级 语文 1 课时）',
        type: 'lesson_plan',
        author: '宁德开大附小 语文组',
        grade: '5-6 年级',
        semester: '2026秋',
        course: '语文',
        summary:
          '以《元日》《九月九日忆山东兄弟》为例，教学生用「找细节—想画面—说情感」三步读节令诗，并用删换比较说清细节的表达作用，最后改写成 80 字描述片段。',
        content: '',
        tags: ['唐宋诗词', '节令诗', '教学设计'],
        docs: [{ name: '唐宋经典诗词解析.docx', kind: 'DOCX', chars: 3584, size: 19133 }],
        createdAt: '2026-11-07T14:20:00.000Z',
        updatedAt: '2026-11-07T14:20:00.000Z'
      }
      const works = JSON.parse(localStorage.getItem('wenmai.works.v1') || '[]')
      localStorage.setItem('wenmai.works.v1', JSON.stringify([WORK, ...works.filter((w) => w.id !== id)]))
      const reviews = JSON.parse(localStorage.getItem('wenmai.reviews.v1') || '{}')
      reviews[id] = { ...review, workId: id }
      localStorage.setItem('wenmai.reviews.v1', JSON.stringify(reviews))
    },
    { id: WORK_ID, review }
  )

  // 注意：只改 hash 不会重新加载页面，而 store 在挂载时已经把种子数据写回 localStorage 了。
  // 所以这里必须带一个 query 强制整页重载，否则注入的成果会被应用的初始存档盖掉。
  await page.goto(`${BASE}/?inject=${Date.now()}#/works/${WORK_ID}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  await page.locator('[data-testid="review-panel"]').screenshot({ path: path.join(__dirname, 'shots', 'live-panel-full.png') })
  await page.screenshot({ path: path.join(__dirname, 'shots', 'live-page-full.png'), fullPage: true })

  const total = await page.locator('[data-testid="review-total"]').innerText()
  console.log(`截图完成：总分 ${total}，本次 ${(elapsedMs / 1000).toFixed(1)}s，推理 ${usage?.completion_tokens_details?.reasoning_tokens} token`)
  console.log('  work/shots/live-panel-full.png（只有面板）')
  console.log('  work/shots/live-page-full.png（整页）')
  await browser.close()
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
