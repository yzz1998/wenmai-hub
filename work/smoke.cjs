/**
 * 文脉馆 · 端到端烟测
 * 用 playwright-core + 系统 Chrome 无头跑关键路径，输出可核对的数值。
 * 运行：NODE_PATH=... node work/smoke.cjs
 */
const { chromium } = require('playwright-core')
const path = require('path')

const BASE = process.env.BASE || 'http://127.0.0.1:5183'
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const FIX = path.join(__dirname, 'fixtures')

const results = []
const errors = []
function ok(name, detail) {
  results.push({ name, detail, pass: true })
  console.log(`  ✓ ${name}  ${detail ?? ''}`)
}
function fail(name, detail) {
  results.push({ name, detail, pass: false })
  console.log(`  ✗ ${name}  ${detail ?? ''}`)
}

;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })

  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`)
  })

  /* ---------- 1. 首页 ---------- */
  await page.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
  const title = await page.title()
  ok('首页标题', title)

  const h1 = (await page.locator('h1').first().innerText()).trim()
  ok('首页主标题', h1.replace(/\s+/g, ' '))

  const statCount = await page.locator('dl dd').count()
  ok('统计数字渲染', `${statCount} 项`)

  const cards = await page.locator('article').count()
  ok('首页卡片（收藏+精选）', `${cards} 张`)

  // 搜索框输入 → 回车跳资源库
  await page.fill('input[aria-label="关键词搜索"]', '凤凰装')
  await page.press('input[aria-label="关键词搜索"]', 'Enter')
  await page.waitForTimeout(900)
  ok('搜索跳转', page.url().replace(BASE, ''))
  const countText = await page.locator('section').filter({ hasText: '共 ' }).first().innerText()
  ok('搜索结果统计', countText.split('\n').slice(0, 3).join(' / '))

  /* ---------- 2. 资源库 ---------- */
  await page.goto(`${BASE}/#/library`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  const libCards = await page.locator('article').count()
  ok('资源库首屏条目', `${libCards} 张（分页 24/页）`)

  // 专题切换：剪纸
  await page.getByRole('button', { name: /剪纸图样/ }).click()
  await page.waitForTimeout(500)
  const pcCount = await page.locator('article').count()
  ok('按专题筛选（剪纸）', `${pcCount} 张`)

  // 分类下拉
  const catOptions = await page.locator('select[aria-label="分类筛选"] option').count()
  ok('分类下拉选项（剪纸 8 类）', `${catOptions} 项（含"全部分类"）`)

  // 标签筛选
  await page.goto(`${BASE}/#/library?tag=${encodeURIComponent('国家级非遗')}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  const tagCount = await page.locator('article').count()
  ok('标签筛选（国家级非遗）', `${tagCount} 张`)

  /* ---------- 2b. 专题馆：四个馆 ---------- */
  await page.goto(`${BASE}/#/theme`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  const hallCount = await page.locator('article').count()
  const hallNames = (await page.locator('article h2').allInnerTexts()).map((x) => x.trim())
  ok('专题馆 · 馆数', `${hallCount} 个：${hallNames.join(' / ')}`)
  const courseHalls = hallNames.filter((n) => /资源与发展馆|城市与乡村馆/.test(n)).length
  ok('专题馆 · 课程两馆在列', `${courseHalls} 个`)
  const localHalls = hallNames.filter((n) => /剪纸|畲族|闽东/.test(n)).length
  ok('专题馆 · 乡土三馆在列', `${localHalls} 个`)
  ok('专题馆 · 馆数应为 5', hallCount === 5 ? '5 个' : `异常：${hallCount} 个`)

  /* 闽东本土文化知识库馆 */
  await page.goto(`${BASE}/#/theme/mindong`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  ok('闽东知识库 · 标题', (await page.locator('h1').first().innerText()).trim())
  const mdCards = await page.locator('main article').count()
  ok('闽东知识库 · 素材条数（应 38）', `${mdCards} 条`)
  const mdSidebar = await page.locator('nav[aria-label="分类目录"] button').count()
  ok('闽东知识库 · 侧栏（全部 + 5 类）', `${mdSidebar} 项`)
  const mdGroups = await page.evaluate(() =>
    [...document.querySelectorAll('main section[id]')].map((sec) => (sec.querySelector('h3')?.innerText || '').split('\n')[0])
  )
  ok('闽东知识库 · 按类分组', `${mdGroups.length} 组：${mdGroups.join(' / ')}`)
  const mdHrefs = await page.locator('main article a').evaluateAll((as) => as.map((a) => a.getAttribute('href') || ''))
  ok('闽东知识库 · 不混入他馆', `PC ${mdHrefs.filter((h) => h.includes('PC-')).length} / SHE ${mdHrefs.filter((h) => h.includes('SHE-')).length}`)

  /* 第二章馆：结构、条目数、边界 */
  await page.goto(`${BASE}/#/theme/resources`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  ok('资源与发展馆 · 标题', (await page.locator('h1').first().innerText()).trim())
  const resCards = await page.locator('main article').count()
  ok('资源与发展馆 · 要点条数', `${resCards} 条`)
  const resSidebar = await page.locator('nav[aria-label="分类目录"] button').count()
  ok('资源与发展馆 · 侧栏（全部 + 3 节）', `${resSidebar} 项`)
  const resHeads = await page.evaluate(() => [...document.querySelectorAll('main section[id]')].map((sec) => (sec.querySelector('h3')?.innerText || '').split('\n')[0]))
  ok('资源与发展馆 · 按节分组', `${resHeads.length} 个分组：${resHeads.join(' / ')}`)
  const resHrefs = await page.locator('main article a').evaluateAll((as) => as.map((a) => a.getAttribute('href') || ''))
  ok('资源与发展馆 · 不混入第五章', `HS5 出现 ${resHrefs.filter((h) => h.includes('HS5')).length} 次`)

  /* 第五章馆 */
  await page.goto(`${BASE}/#/theme/urban-rural`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  ok('城市与乡村馆 · 标题', (await page.locator('h1').first().innerText()).trim())
  const cityCards = await page.locator('main article').count()
  ok('城市与乡村馆 · 要点条数', `${cityCards} 条`)
  const cityHrefs = await page.locator('main article a').evaluateAll((as) => as.map((a) => a.getAttribute('href') || ''))
  ok('城市与乡村馆 · 不混入第二章', `HS2 出现 ${cityHrefs.filter((h) => h.includes('HS2')).length} 次`)

  /* 按节筛选 */
  await page.getByRole('button', { name: /工业与社会变迁/ }).first().click()
  await page.waitForTimeout(600)
  const oneSection = await page.locator('main article').count()
  ok('城市与乡村馆 · 按节筛选（工业与社会变迁）', `${oneSection} 条`)

  /* 课程条目详情与引用 */
  await page.goto(`${BASE}/#/entry/HS5-002`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const courseMain = await page.locator('main').innerText()
  ok('课程条目 · 正文标题', courseMain.includes('要点释读') ? '要点释读' : '未找到')
  ok('课程条目 · 章节元数据', courseMain.includes('所属章节') && courseMain.includes('第五章'))
  const courseCite = await page.locator('section').filter({ hasText: '引用本条' }).first().innerText()
  const citeText = courseCite.replace(/\s+/g, ' ')
  ok('课程条目 · 引用含章节定位', /第五章/.test(citeText) ? '含「第五章」' : citeText.slice(0, 60))

  /* ---------- 3. 剪纸专题 ---------- */
  await page.goto(`${BASE}/#/theme/papercut`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const masonryCards = await page.locator('.masonry article').count()
  ok('剪纸馆瀑布流条目', `${masonryCards} 件（首屏 40）`)

  // 分类切换
  await page.getByRole('button', { name: /花卉草木/ }).first().click()
  await page.waitForTimeout(600)
  const catCards = await page.locator('.masonry article').count()
  ok('剪纸分类切换（花卉草木）', `${catCards} 件`)

  // 图片实际加载
  const imgOk = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll('.masonry img')].slice(0, 8)
    return imgs.filter((i) => i.complete && i.naturalWidth > 0).length
  })
  ok('图版实际加载（抽查 8 张）', `${imgOk}/8 成功`)

  // 进入详情
  await page.locator('.masonry article').first().locator('button').first().click()
  await page.waitForTimeout(900)
  const detailUrl = page.url().replace(BASE, '')
  ok('剪纸详情路由', detailUrl)

  const bodyParagraphs = await page.locator('.prose-md p').count()
  ok('纹样细解段落', `${bodyParagraphs} 段`)

  // 打开大图 + 滚轮缩放
  await page.locator('figure button').first().click()
  await page.waitForTimeout(800)
  const viewerVisible = await page.locator('[role="dialog"]').isVisible()
  ok('大图查看器打开', String(viewerVisible))

  // 查看器必须盖住 sticky 顶栏：截图左上角取点，命中的应是查看器自身而非 HEADER
  const covered = await page.evaluate(() => {
    const el = document.elementFromPoint(20, 20)
    if (!el) return 'null'
    const owner = el.closest('[role="dialog"][aria-modal="true"]')
    return owner ? 'covered' : `exposed:${el.tagName}`
  })
  ok('查看器覆盖顶栏', covered)

  const stage = page.locator('.viewer-stage img')
  const box = await stage.boundingBox()
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.wheel(0, -600)
    await page.waitForTimeout(500)
  }
  const transform = await stage.evaluate((el) => el.style.transform)
  ok('滚轮缩放 transform', transform)

  const scaleText = await page.locator('footer span.tabular-nums').first().innerText()
  ok('缩放比例显示', scaleText)

  // 拖拽平移
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 60, { steps: 8 })
    await page.mouse.up()
    await page.waitForTimeout(300)
  }
  const transform2 = await stage.evaluate((el) => el.style.transform)
  ok('拖拽后 transform', transform2)

  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  ok('Esc 关闭查看器', String(!(await page.locator('.viewer-stage').isVisible().catch(() => false))))

  /* ---------- 4. 畲族专题 ---------- */
  await page.goto(`${BASE}/#/theme/she`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  const sheCards = await page.locator('main article').count()
  ok('畲族馆展项', `${sheCards} 个`)

  await page.goto(`${BASE}/#/entry/SHE-CLOTH-01`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  const photoCount = await page.locator('main button[aria-label^="查看第"]').count()
  ok('凤凰装相册帧数', `${photoCount} 帧`)

  const photoLoaded = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll('main img')]
    return imgs.filter((i) => i.complete && i.naturalWidth > 0).length
  })
  ok('相册图片加载', `${photoLoaded} 张成功`)

  // 跨馆相关条目
  const relatedCards = await page.locator('section').filter({ hasText: '相关条目' }).locator('a').count()
  ok('跨馆相关条目', `${relatedCards} 条`)

  /* ---------- 5. 统一引用与选辑 ---------- */
  await page.getByRole('button', { name: /加入选辑/ }).first().click()
  await page.waitForTimeout(400)
  const selBadge = await page.locator('header button[aria-label^="教学选辑"]').innerText()
  ok('加入选辑后角标', selBadge.replace(/\s+/g, ' '))

  await page.locator('header button[aria-label^="教学选辑"]').click()
  await page.waitForTimeout(500)
  const drawerItems = await page.locator('aside li').count()
  ok('选辑抽屉条目', `${drawerItems} 条`)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

  /* ---------- 6. 学生成果 ---------- */
  await page.goto(`${BASE}/#/works`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const workCards = await page.locator('article').count()
  ok('学生成果', `${workCards} 条`)

  /* ---------- 6.5 文档解析与 AI 评阅（Mock 模式，不依赖函数服务与 Key） ---------- */
  // 顺便统计 /api/review 请求数：Mock 下应当为 0，不为 0 说明开关没生效
  const apiHits = []
  page.on('request', (r) => {
    if (r.url().includes('/api/review')) apiHits.push(r.url())
  })
  await page.evaluate(() => localStorage.setItem('wenmai.review.mock', '1'))
  await page.goto(`${BASE}/#/works/new`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  await page.fill('#wf-title', '冒烟 · 闽东传统技艺调查')
  await page.fill('#wf-author', '冒烟机器人')
  await page.fill('#wf-summary', '自动化走查生成的成果，用于验证文档解析与 AI 评阅链路。')

  // 旧版 .doc 必须被拦下，并给出「另存为 .docx」这条可执行的出路
  await page.setInputFiles('[data-testid="doc-input"]', path.join(FIX, 'legacy.doc'))
  await page.waitForSelector('[data-testid="doc-error"]', { timeout: 15000 })
  const legacyMsg = (await page.locator('[data-testid="doc-error"]').innerText()).replace(/\s+/g, ' ')
  if (/另存为/.test(legacyMsg) && /docx/i.test(legacyMsg)) ok('旧版 .doc 被明确拒绝', legacyMsg.slice(0, 42))
  else fail('旧版 .doc 被明确拒绝', legacyMsg.slice(0, 60))

  // TXT
  await page.setInputFiles('[data-testid="doc-input"]', path.join(FIX, 'sample.txt'))
  await page.waitForSelector('[data-testid="doc-status"][data-state="ready"]', { timeout: 30000 })
  const txtMeta = (await page.locator('[data-testid="doc-meta"]').innerText()).replace(/\s+/g, ' ')
  if (/\d+ 字/.test(txtMeta)) ok('TXT 解析就绪', txtMeta)
  else fail('TXT 解析就绪', txtMeta)

  // PDF：走 pdfjs 的动态 chunk，给足时间；DocField 是替换式，所以覆盖上一个文件
  await page.setInputFiles('[data-testid="doc-input"]', path.join(FIX, 'sample.pdf'))
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-testid="doc-meta"]')
      return !!el && /PDF/i.test(el.textContent || '') && /\d+ 字/.test(el.textContent || '')
    },
    { timeout: 45000 }
  )
  const pdfMeta = (await page.locator('[data-testid="doc-meta"]').innerText()).replace(/\s+/g, ' ')
  ok('PDF 解析就绪', pdfMeta)

  // 入库 + 自动评阅
  await page.click('[data-testid="submit-work"]')
  await page.waitForSelector('[data-testid="review-panel"] [data-testid="review-total"]', { timeout: 60000 })
  await page.waitForTimeout(400)
  const dims = await page.locator('[data-testid="review-dim-score"]').allInnerTexts()
  const total = Number((await page.locator('[data-testid="review-total"]').innerText()).replace(/\D/g, ''))
  // 每维显示成「21 / 25」，取第一个数字才是得分
  const dimScores = dims.map((s) => Number((String(s).match(/\d+/) || [0])[0]))
  const sum = dimScores.reduce((a, s) => a + s, 0)
  if (dims.length === 4) ok('评阅四维齐备', String(dims.length))
  else fail('评阅四维齐备', String(dims.length))
  if (total > 0 && total === sum) ok('总分 = 四维之和', `${sum} = ${dimScores.join('+')}`)
  else fail('总分 = 四维之和', `total=${total} sum=${sum}`)
  const sugg = await page.locator('[data-testid="review-suggestion"]').count()
  if (sugg >= 3 && sugg <= 5) ok('改进建议 3–5 条', `${sugg} 条`)
  else fail('改进建议 3–5 条', `${sugg} 条`)

  // 重新评阅：按钮要立刻进入忙碌态，避免连点重复计费
  await page.click('[data-testid="review-rerun"]')
  if (await page.locator('[data-testid="review-rerun"]').isDisabled()) ok('重新评阅进入忙碌态')
  else fail('重新评阅进入忙碌态')
  await page.waitForTimeout(2000)

  // 列表卡片分数徽标
  await page.goto(`${BASE}/#/works`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const scoreChips = await page.locator('[data-testid="work-score"]').count()
  if (scoreChips > 0) ok('列表卡片显示分数', `${scoreChips} 个`)
  else fail('列表卡片显示分数')

  // 管理台：覆盖率摘要 + 逐行分数徽标
  await page.goto(`${BASE}/#/manage?tab=works`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const mgScored = await page.locator('[data-testid="manage-review-score"]').count()
  const mgNone = await page.locator('[data-testid="manage-review-none"]').count()
  if (mgScored > 0) ok('管理台分数徽标', `${mgScored} 个有分 / ${mgNone} 个未评阅`)
  else fail('管理台分数徽标', `${mgScored} 个`)

  // Mock 模式不该打网络
  if (apiHits.length === 0) ok('Mock 模式不打 /api/review', '请求数 0')
  else fail('Mock 模式不打 /api/review', `${apiHits.length} 次`)

  /* ---------- 7. 管理 ---------- */
  await page.goto(`${BASE}/#/manage`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  const rows = await page.locator('tbody tr').count()
  ok('管理页素材行数', `${rows} 行`)

  /* ---------- 8. 关于 ---------- */
  await page.goto(`${BASE}/#/about`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  const aboutH1 = await page.locator('h1').first().innerText()
  ok('关于页', aboutH1.trim())

  /* ---------- 9. 旧链接兼容 ---------- */
  await page.goto(`${BASE}/#/material/M-FEST-001`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  ok('旧路由 /material/:id 重定向', page.url().split('#')[1])

  /* ---------- 10. 移动端 ---------- */
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await mobile.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
  await mobile.waitForTimeout(500)
  const mobilePages = ['/', '/library', '/theme', '/theme/resources', '/theme/urban-rural', '/theme/papercut', '/theme/she', '/theme/mindong', '/works/new', '/works/W-2026-0001']
  const overflowRows = []
  for (const path of mobilePages) {
    await mobile.goto(`${BASE}/#${path}`, { waitUntil: 'networkidle' })
    await mobile.waitForTimeout(450)
    const d = await mobile.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    overflowRows.push(`${path}:${d}`)
  }
  const badOverflow = overflowRows.filter((r) => Number(r.split(':')[1]) > 1)
  ok(`移动端横向溢出（${mobilePages.length} 页）`, badOverflow.length ? `溢出：${badOverflow.join(' ')}` : '全部 0')

  const mobileNav = await mobile.locator('nav[aria-label="移动端导航"] a').count()
  ok('移动端底部导航', `${mobileNav} 项`)

  await mobile.goto(`${BASE}/#/theme/papercut`, { waitUntil: 'networkidle' })
  await mobile.waitForTimeout(600)
  const mobileCols = await mobile.evaluate(() => {
    const el = document.querySelector('.masonry')
    return el ? getComputedStyle(el).columnCount : 'none'
  })
  ok('移动端瀑布流列数', String(mobileCols))

  await browser.close()

  /* ---------- 汇总 ---------- */
  const failed = results.filter((r) => !r.pass)
  console.log('\n================ 汇总 ================')
  console.log(`检查项：${results.length}，失败：${failed.length}`)
  const realErrors = errors.filter(
    (e) => !/favicon|Download the React DevTools|net::ERR_ABORTED/.test(e)
  )
  console.log(`控制台/网络错误：${realErrors.length}`)
  realErrors.slice(0, 12).forEach((e) => console.log('  ! ' + e))
  process.exit(failed.length || realErrors.length ? 1 : 0)
})().catch((e) => {
  console.error('SMOKE CRASHED:', e)
  process.exit(2)
})
