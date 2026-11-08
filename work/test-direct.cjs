/**
 * 端到端走查：浏览器直连模型（不经站内云函数）。
 *
 * 这个测试回答的是这次改造最关键的质疑 ——
 * 「不配 EdgeOne、不当管理员，真的能让评阅跑起来吗」。
 *
 * 它把设置里的接口地址指向本地假端点（work/mock-llm.cjs），
 * 于是整条路径和线上完全一致：读 localStorage 的配置 → 浏览器的 fetch
 * → 跨域预检 → 带 Bearer 头请求 → 解析 → 钳位 → 落盘 → 渲染。
 * 唯一的差别只是对面换成了一个会说假话的服务器。
 *
 * 用法：node work/test-direct.cjs   （需 vite 在 5183；脚本自己拉起假端点）
 */
const path = require('path')
const { spawn } = require('child_process')
const { chromium } = require('playwright-core')

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const BASE = process.env.BASE || 'http://127.0.0.1:5183'
const MOCK_PORT = Number(process.env.MOCK_LLM_PORT || 8099)
const MOCK_URL = `http://127.0.0.1:${MOCK_PORT}`
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

;(async () => {
  // 先拉起假端点，等它真的在监听
  const mock = spawn(process.execPath, [path.join(__dirname, 'mock-llm.cjs')], {
    env: { ...process.env, MOCK_LLM_PORT: String(MOCK_PORT) },
    stdio: 'ignore'
  })
  await sleep(900)

  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } })
  const errors = []
  const requests = []
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 160)))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 160))
  })
  page.on('request', (r) => {
    if (r.url().includes('/chat/completions')) requests.push(r.url())
  })

  /** 直接写配置，模拟用户在设置面板里填完保存的结果 */
  const configure = async (patch) => {
    await page.evaluate(
      ({ url, extra }) => {
        const cur = JSON.parse(localStorage.getItem('wenmai.settings.v1') || '{}')
        localStorage.setItem(
          'wenmai.settings.v1',
          JSON.stringify({
            apiKey: 'sk-local-test-0123456789abcdef',
            baseUrl: url,
            model: 'mock-ok',
            vision: false,
            mock: false,
            relay: false,
            ...cur,
            ...extra
          })
        )
      },
      { url: MOCK_URL, extra: patch }
    )
  }

  const runReview = async () => {
    await page.goto(`${BASE}/#/works/${WORK_ID}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(900)
    // 未评阅时入口在正文区，已有结果时入口在面板右上角
    for (const sel of ['[data-testid="review-start"]', '[data-testid="review-rerun"]']) {
      const btn = page.locator(sel)
      if ((await btn.count()) > 0) {
        await btn.first().click()
        return true
      }
    }
    return false
  }

  const waitResult = async (timeout = 20000) =>
    page
      .waitForFunction(() => document.querySelector('[data-testid="review-total"]'), { timeout })
      .then(() => true)
      .catch(() => false)

  const waitError = async (timeout = 20000) =>
    page
      .waitForFunction(() => document.querySelector('[data-testid="review-error"]'), { timeout })
      .then(() => true)
      .catch(() => false)

  /* ---------- 1. 正常直连：脏数据被钳住 ---------- */
  await page.goto(`${BASE}/#/works`, { waitUntil: 'networkidle' })
  await configure({})
  const started = await runReview()
  started ? ok('配置后可直接发起评阅') : bad('配置后可直接发起评阅', '按钮缺失')

  const got = await waitResult()
  if (got) {
    const total = Number((await page.locator('[data-testid="review-total"]').first().innerText()).trim())
    const dims = await page.locator('[data-testid="review-dim-score"]').count()
    // 25 + 19 + 22 + 0 = 66：越界、字符串、小数、缺项，四种脏数据各钳一次
    total === 66
      ? ok('直连结果被正确钳位', `总分 ${total}（25 + 19 + 22 + 0）`)
      : bad('直连结果被正确钳位', `总分 ${total}，期望 66`)
    dims === 4 ? ok('缺项维度自动补齐', `${dims} 维全在`) : bad('缺项维度自动补齐', `${dims} 维`)

    const used = await page.locator('[data-testid="review-materials-used"]').innerText()
    ok('材料摘要随结果落盘', used.trim().slice(0, 40))
  } else {
    bad('直连结果被正确钳位', '没等到分数')
  }

  requests.length > 0 && requests[0].startsWith(MOCK_URL)
    ? ok('请求确实直连到配置的地址', new URL(requests[0]).host)
    : bad('请求确实直连到配置的地址', requests[0] || '无请求')

  const relayed = requests.some((u) => u.includes('/api/review'))
  relayed ? bad('未走站内中继（relay=false）', '出现了 /api/review 请求') : ok('未走站内中继（relay=false 生效）')

  /* ---------- 2. 密钥无效：不提供重试按钮 ---------- */
  await configure({ model: 'mock-401' })
  const r2 = await runReview()
  const e2 = r2 ? await waitError() : false
  if (e2) {
    const txt = await page.locator('[data-testid="review-error"]').innerText()
    txt.includes('密钥无效')
      ? ok('401 映射为「密钥无效」', txt.split('\n')[0].slice(0, 20))
      : bad('401 映射为「密钥无效」', txt.split('\n')[0].slice(0, 30))
    const hasRetry = await page.locator('[data-testid="review-error"] button:has-text("重试")').count()
    hasRetry === 0 ? ok('不可恢复错误不给重试按钮') : bad('不可恢复错误不给重试按钮', '出现了重试按钮')
    const hasSettings = await page.locator('[data-testid="review-open-settings"]').count()
    hasSettings > 0 ? ok('错误态引导去设置') : bad('错误态引导去设置', '没有设置入口')
  } else {
    bad('401 映射为「密钥无效」', '没等到错误态')
  }

  /* ---------- 3. 限流：可重试 ---------- */
  await configure({ model: 'mock-429' })
  const r3 = await runReview()
  const e3 = r3 ? await waitError() : false
  if (e3) {
    const txt = await page.locator('[data-testid="review-error"]').innerText()
    txt.includes('频繁') ? ok('429 映射为「请求过于频繁」') : bad('429 映射为「请求过于频繁」', txt.split('\n')[0])
    const hasRetry = await page.locator('[data-testid="review-error"] button:has-text("重试")').count()
    hasRetry > 0 ? ok('可恢复错误提供重试') : bad('可恢复错误提供重试', '没有重试按钮')
  } else {
    bad('429 映射为「请求过于频繁」', '没等到错误态')
  }

  /* ---------- 4. 设置面板的「测试连接」真的会打接口 ---------- */
  await configure({ model: 'mock-ok' })
  await page.goto(`${BASE}/#/works`, { waitUntil: 'networkidle' })
  await page.locator('[data-testid="open-settings"]').click()
  await page.waitForTimeout(400)
  await page.locator('[data-testid="test-connection"]').click()
  await page.waitForTimeout(1500)
  const test = page.locator('[data-testid="test-result"]')
  if ((await test.count()) > 0) {
    const t = await test.innerText()
    t.includes('连通正常') ? ok('测试连接通过并回报延迟', t.trim().slice(0, 30)) : bad('测试连接通过并回报延迟', t.trim().slice(0, 40))
  } else {
    bad('测试连接通过并回报延迟', '没有结果条')
  }

  await page.locator('[role="dialog"] button[aria-label="关闭"]').click()
  await page.waitForTimeout(300)

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
  mock.kill()
  process.exit(pass === results.length ? 0 : 1)
})().catch((e) => {
  console.error('测试脚本异常：', e)
  process.exit(1)
})
