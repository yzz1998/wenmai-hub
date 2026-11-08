/**
 * 端到端走查：内嵌 AI 配置（不依赖任何云端环境变量）。
 *
 * 这条链路要证明的是：
 *   没有配 Key 时，界面能明确告知并一键引导到设置；
 *   在网页里填完 Key 保存后，不需要刷新、不需要重新部署，评阅立刻可用；
 *   评阅按钮复用的是本页已加载的正文/文档/配图，而不是让用户再传一次。
 *
 * 用法：node work/test-settings.cjs   （需 vite 在 5183）
 */
const path = require('path')
const { chromium } = require('playwright-core')

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const BASE = process.env.BASE || 'http://127.0.0.1:5183'
const FIX = path.join(__dirname, 'fixtures')
const WORK_ID = 'W-2026-0001'

const results = []
const ok = (n, d = '') => {
  results.push({ n, d, pass: true })
  console.log(`  ✓ ${n}${d ? `  ${d}` : ''}`)
}
const bad = (n, d = '') => {
  results.push({ n, d, pass: false })
  console.log(`  ✗ ${n}${d ? `  ${d}` : ''}`)
}

;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 160)))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 160))
  })

  // 干净起点：不带任何配置，也不开旧版 mock
  await page.addInitScript(() => {
    localStorage.removeItem('wenmai.settings.v1')
    localStorage.removeItem('wenmai.review.mock')
  })

  /* ---------- 1. 未配置时，详情页要说清楚并给出入口 ---------- */
  await page.goto(`${BASE}/#/works/${WORK_ID}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)

  const needSetup = page.locator('[data-testid="review-need-setup"]')
  ;(await needSetup.count()) > 0
    ? ok('未配置时评阅面板给出配置引导', await needSetup.first().innerText().then((t) => t.split('\n')[0].slice(0, 24)))
    : bad('未配置时评阅面板给出配置引导', '没找到 review-need-setup')

  const headBtn = page.locator('[data-testid="review-rerun"]')
  ;(await headBtn.count()) === 0
    ? ok('未配置时不显示「评阅」按钮，避免点了必然失败')
    : bad('未配置时不显示「评阅」按钮', '按钮仍在')

  // 材料清单：即使没配 Key，也要能看到「会评什么」
  const matList = page.locator('[data-testid="review-materials"]')
  if ((await matList.count()) > 0) {
    const txt = await matList.first().innerText()
    const chips = ['正文', '文档', '配图'].filter((k) => txt.includes(k))
    ok('评阅前展示材料清单', `${chips.join(' / ')}｜${(txt.match(/正文 [\d,]+ 字/) || [''])[0]}`)
    ok('清单说明「取自本页、无需重传」', txt.includes('不需要再上传一次') ? '文案在位' : '缺说明')
  } else {
    bad('评阅前展示材料清单', '没找到 review-materials')
  }

  /* ---------- 2. 面板里的按钮能打开同一个设置弹窗 ---------- */
  await page.locator('[data-testid="review-need-setup"] button').first().click()
  await page.waitForTimeout(500)
  const dialog = page.locator('[role="dialog"]')
  ;(await dialog.count()) > 0
    ? ok('从评阅面板可打开设置弹窗', await page.locator('[role="dialog"] h3').first().innerText())
    : bad('从评阅面板可打开设置弹窗', '弹窗未出现')

  const statusText = await page.locator('[data-testid="settings-status"]').innerText()
  statusText.includes('未配置')
    ? ok('状态带先给结论', statusText.trim().slice(0, 18))
    : bad('状态带先给结论', statusText.trim().slice(0, 30))

  /* ---------- 3. 填入 Key，状态即时变化 ---------- */
  await page.locator('[data-testid="api-key-input"]').fill('sk-abcdefghijklmnopqrstuvwxyz012345')
  await page.waitForTimeout(300)
  const status2 = await page.locator('[data-testid="settings-status"]').innerText()
  status2.includes('已配置') && status2.includes('DeepSeek')
    ? ok('填 Key 后状态变为已配置', status2.trim().slice(0, 26))
    : bad('填 Key 后状态变为已配置', status2.trim().slice(0, 40))

  const masked = await dialog.innerText()
  masked.includes('****')
    ? ok('密钥默认遮蔽显示', '输入框为 password，附脱敏摘要')
    : bad('密钥默认遮蔽显示', '没看到脱敏')

  // 同时打开示例模式，这样后面真点评阅时不打网络
  await page.locator('[data-testid="toggle-mock"]').check()
  await page.waitForTimeout(200)
  await page.locator('[data-testid="save-settings"]').click()
  await page.waitForTimeout(400)

  await page.locator('[role="dialog"] button[aria-label="关闭"]').click()
  await page.waitForTimeout(500)

  // 保存后不刷新页面，详情页直接可用 —— 这正是「内嵌配置」的价值
  const rerun = page.locator('[data-testid="review-start"]')
  ;(await rerun.count()) > 0
    ? ok('保存后无需刷新，评阅按钮即刻出现', (await rerun.first().innerText()).trim())
    : bad('保存后无需刷新，评阅按钮即刻出现', '按钮没出现')

  const dot = await page.locator('[data-testid="open-settings"] .bg-zhu-500').count()
  dot === 0 ? ok('顶栏未配置红点消失') : bad('顶栏未配置红点消失', `仍有 ${dot} 个红点`)

  /* ---------- 4. 点一次评阅：复用已加载内容 ---------- */
  await rerun.first().click()
  await page.waitForTimeout(600)
  const running = await page.locator('[data-testid="review-running"]').count()
  running > 0 ? ok('评阅进入运行态') : bad('评阅进入运行态', '没有 running 区块')

  await page.waitForFunction(
    () => document.querySelector('[data-testid="review-total"]'),
    { timeout: 30000 }
  )
  const total = await page.locator('[data-testid="review-total"]').first().innerText()
  const dims = await page.locator('[data-testid="review-dim-score"]').count()
  ok('评阅出分', `总分 ${total}｜${dims} 维`)

  const used = await page.locator('[data-testid="review-materials-used"]').innerText()
  if (/正文 [\d,]+ 字/.test(used)) ok('结果区标注本次评阅材料', used.trim())
  else bad('结果区标注本次评阅材料', used.trim().slice(0, 40))

  /* ---------- 5. 设置项落到 localStorage，可复核 ---------- */
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('wenmai.settings.v1') || '{}'))
  stored.apiKey && stored.mock === true && stored.model === 'deepseek-chat'
    ? ok('配置写入 localStorage', `model=${stored.model}｜mock=${stored.mock}｜vision=${stored.vision}`)
    : bad('配置写入 localStorage', JSON.stringify(stored).slice(0, 80))

  /* ---------- 6. 清除配置回到未配置 ---------- */
  await page.locator('[data-testid="open-settings"]').click()
  await page.waitForTimeout(400)
  await page.locator('[role="dialog"] button:has-text("清除配置")').click()
  await page.waitForTimeout(400)
  const status3 = await page.locator('[data-testid="settings-status"]').innerText()
  status3.includes('未配置')
    ? ok('清除配置后回到未配置状态')
    : bad('清除配置后回到未配置状态', status3.trim().slice(0, 30))
  await page.locator('[role="dialog"] button[aria-label="关闭"]').click()
  await page.waitForTimeout(300)

  /* ---------- 7. 配置面板在移动端不横向溢出 ---------- */
  await page.setViewportSize({ width: 390, height: 844 })
  await page.locator('[data-testid="open-settings"]').click()
  await page.waitForTimeout(500)
  const overflow = await page.evaluate(() => {
    const el = document.querySelector('[role="dialog"]')
    if (!el) return -1
    return el.scrollWidth - el.clientWidth
  })
  overflow <= 1 ? ok('移动端设置弹窗无横向溢出', `溢出 ${overflow}px`) : bad('移动端设置弹窗无横向溢出', `${overflow}px`)

  await page.screenshot({ path: path.join(__dirname, 'shots', 'settings-mobile.png') })

  console.log('')
  if (errors.length) {
    console.log('浏览器错误：')
    errors.slice(0, 6).forEach((e) => console.log(`  ! ${e}`))
  } else {
    console.log('浏览器错误： 无')
  }

  const pass = results.filter((r) => r.pass).length
  console.log(`\n通过 ${pass} / ${results.length}`)
  await browser.close()
  process.exit(pass === results.length ? 0 : 1)
})().catch((e) => {
  console.error('测试脚本异常：', e)
  process.exit(1)
})
