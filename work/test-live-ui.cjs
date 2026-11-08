/**
 * 真实用户路径实测：在浏览器里上传这份教案 docx，让系统自己解析、自己选量表、自己评阅。
 *
 * 和 test-live-lesson.mjs 的分工：
 *   - 那个脚本证明「量表与预算是对的」（不经过 UI，直接调模型）；
 *   - 这个脚本证明「用户点得到、传得进、看得见」（含 mammoth 解析 docx、localStorage 配置、
 *     跨域直连、七维渲染、总分与分项是否自洽）。
 * 两个都过，才算这条链路真的能用。
 *
 * 用法：
 *   DEEPSEEK_API_KEY=sk-xxx node work/test-live-ui.cjs
 * 环境变量：BASE（默认 http://127.0.0.1:5183）、DOCX（默认用 Downloads 里那份）
 */
const path = require('path')
const fs = require('fs')
const { chromium } = require('playwright-core')

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const BASE = process.env.BASE || 'http://127.0.0.1:5183'
const API_KEY = process.env.DEEPSEEK_API_KEY || ''
const DOCX =
  process.env.DOCX || 'C:/Users/YZZ/Downloads/唐宋经典诗词解析_5-6年级_语文_1课时_20261107_2113.docx'
const SHOT = path.join(__dirname, 'shots', 'live-lesson-review.png')

const results = []
const ok = (n, d = '') => {
  results.push({ n, pass: true })
  console.log(`  ✓ ${n}${d ? `  ${d}` : ''}`)
}
const bad = (n, d = '') => {
  results.push({ n, pass: false })
  console.log(`  ✗ ${n}${d ? `  ${d}` : ''}`)
}

if (!API_KEY) {
  console.error('缺少 DEEPSEEK_API_KEY')
  process.exit(2)
}
if (!fs.existsSync(DOCX)) {
  console.error(`样本不存在：${DOCX}`)
  process.exit(2)
}

;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } })
  const errors = []
  const chatReqs = []
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 200))
  })
  page.on('request', (r) => {
    if (r.url().includes('/chat/completions')) chatReqs.push({ url: r.url(), at: Date.now() })
  })
  page.on('response', async (r) => {
    if (r.url().includes('/chat/completions')) {
      chatReqs[chatReqs.length - 1].status = r.status()
    }
  })

  // 配置写进 localStorage，等价于用户已经在设置面板里填过
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.evaluate(
    ({ key }) =>
      localStorage.setItem(
        'wenmai.settings.v1',
        JSON.stringify({
          apiKey: key,
          baseUrl: 'https://api.deepseek.com',
          model: 'deepseek-flash',
          vision: false,
          mock: false,
          relay: false
        })
      ),
    { key: API_KEY }
  )

  console.log('\n==== 1. 提交页：选教案、传 docx ====')
  await page.goto(`${BASE}/#/works/new`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)

  await page.getByRole('button', { name: '教案', exact: true }).first().click()
  await page.locator('#wf-title').fill('唐宋经典诗词解析（5-6 年级 语文 1 课时）')
  await page.locator('#wf-author').fill('宁德开大附小 语文组')
  await page.locator('#wf-summary').fill(
    '以《元日》《九月九日忆山东兄弟》为例，教学生用「找细节—想画面—说情感」三步读节令诗，并用删换比较说清细节的表达作用，最后改写成 80 字描述片段。'
  )

  // 选教案后，评分标准面板应切成七维
  const rubricChip = await page.locator('details summary').first().innerText().catch(() => '')
  rubricChip.includes('教案评阅量表')
    ? ok('选教案后量表自动切换', rubricChip.replace(/\s+/g, ' ').slice(0, 24))
    : bad('选教案后量表自动切换', rubricChip.replace(/\s+/g, ' ').slice(0, 30))
  const dimCards = await page.locator('details .grid > div').count()
  dimCards === 7 ? ok('评分标准展示七维', `${dimCards} 条`) : bad('评分标准展示七维', `${dimCards} 条`)

  await page.setInputFiles('[data-testid="doc-input"]', DOCX)
  await page.waitForTimeout(2500)
  const docMeta = await page.locator('[data-testid="doc-meta"]').innerText().catch(() => '')
  const m = docMeta.match(/(\d+)\s*字/)
  m ? ok('docx 在浏览器里解析成功', docMeta.replace(/\s+/g, ' ').slice(0, 46)) : bad('docx 解析', docMeta || '无元信息')

  console.log('\n==== 2. 入库并自动评阅 ====')
  const t0 = Date.now()
  await page.locator('[data-testid="submit-work"]').click()

  // 评阅要几十秒：等待面板出现总分（上限给 150s，超过平台 120s 墙钟就算失败）
  const got = await page
    .waitForFunction(() => document.querySelector('[data-testid="review-total"]'), { timeout: 150000 })
    .then(() => true)
    .catch(() => false)
  const elapsed = Date.now() - t0

  if (!got) {
    const errTxt = await page.locator('[data-testid="review-error"]').innerText().catch(() => '')
    bad('评阅在 150s 内出结果', errTxt ? errTxt.replace(/\s+/g, ' ').slice(0, 80) : '超时且无错误文案')
    await page.screenshot({ path: SHOT, fullPage: false })
    await browser.close()
    console.log(`\n通过 ${results.filter((r) => r.pass).length} / ${results.length}`)
    process.exit(1)
  }
  ok('评阅在 150s 内出结果', `${(elapsed / 1000).toFixed(1)}s，请求 ${chatReqs.length} 次`)

  const total = Number((await page.locator('[data-testid="review-total"]').first().innerText()).trim())
  const scores = await page.locator('[data-testid="review-dim-score"]').allInnerTexts()
  const nums = scores.map((s) => Number(String(s).split('/')[0].trim()))
  const sum = nums.reduce((a, b) => a + b, 0)

  nums.length === 7 ? ok('结果渲染七维', nums.join(' + ')) : bad('结果渲染七维', `${nums.length} 维`)
  total === sum ? ok('总分等于七维之和', `${total} = ${sum}`) : bad('总分等于七维之和', `${total} ≠ ${sum}`)
  total > 0 && total <= 100 ? ok('总分落在 0-100', String(total)) : bad('总分落在 0-100', String(total))

  const panelTxt = await page.locator('[data-testid="review-panel"]').innerText()
  const want = ['目标适切性', '内容准确性', '重难点把握', '过程与时间结构', '任务与活动设计', '评价与一致性', '规范性与可执行性']
  want.every((n) => panelTxt.includes(n))
    ? ok('七个维度名称与量表一致')
    : bad('七个维度名称与量表一致', want.filter((n) => !panelTxt.includes(n)).join('、'))

  const summaryBlock = panelTxt.split('总评')[1] || ''
  const summaryLen = summaryBlock.split('改进建议')[0].replace(/\s/g, '').length
  summaryLen > 40 ? ok('总评有实质内容', `${summaryLen} 字`) : bad('总评有实质内容', `${summaryLen} 字`)

  const suggCount = await page.locator('[data-testid="review-suggestion"]').count()
  suggCount >= 3 ? ok('改进建议 3 条以上', `${suggCount} 条`) : bad('改进建议 3 条以上', `${suggCount} 条`)

  panelTxt.includes('本次实际评阅的是压缩到')
    ? ok('触发了压缩降级并明示（长文兜底生效）')
    : ok('未触发降级压缩（一次成功）')

  console.log('\n==== 3. 请求形状 ====')
  chatReqs.length >= 1
    ? ok('请求直连 DeepSeek', `${new URL(chatReqs[0].url).host} × ${chatReqs.length}`)
    : bad('请求直连 DeepSeek', '没有 /chat/completions 请求')
  chatReqs.some((r) => r.status && r.status !== 200)
    ? bad('所有请求均 2xx', chatReqs.map((r) => r.status).join(','))
    : ok('所有请求均 2xx', chatReqs.map((r) => r.status).join(','))

  fs.mkdirSync(path.dirname(SHOT), { recursive: true })
  await page.screenshot({ path: SHOT })
  console.log(`\n截图：${SHOT}`)

  console.log('')
  if (errors.length) {
    console.log('浏览器错误：')
    ;[...new Set(errors)].slice(0, 6).forEach((e) => console.log(`  ! ${e}`))
  } else {
    console.log('浏览器错误：无')
  }

  const pass = results.filter((r) => r.pass).length
  console.log(`\n通过 ${pass} / ${results.length}`)
  await browser.close()
  process.exit(pass === results.length ? 0 : 1)
})().catch((e) => {
  console.error('脚本异常：', e)
  process.exit(1)
})
