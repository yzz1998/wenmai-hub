/**
 * 子路径部署体检：模拟 GitHub Pages 的 /<repo>/ 目录，逐页检查资源有没有 404、图片有没有加载失败。
 *
 * 为什么必须做这一步：本地 dev 跑在域名根，任何写死的 '/img/x.svg' 都正常；
 * 一旦挂到 /wenmai-hub/ 下就会静默变白块，而 dev 环境永远发现不了。
 *
 * 两个容易误判的点，脚本里已经绕开了：
 * 1. 卡片图片带 loading="lazy"，没滚到视口就不会加载，naturalWidth 自然是 0 ——
 *    直接统计会得到一堆假故障。所以先把 loading 全改成 eager 并滚到底，等 decode() 完成再判定。
 * 2. 同一页面内改 hash 不会产生新的导航，page.goto 的 response 是 null，
 *    用它判断「深链是否可达」必然失败。深链改用新开页面验证。
 */
const path = require('path')
const { chromium } = require('playwright-core')

const BASE = process.env.PAGES_BASE || 'http://127.0.0.1:8099/wenmai-hub'
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const SHOTS = path.join(__dirname, 'shots')

let pass = 0
let fail = 0
const rows = []
const ok = (n, d = '') => (pass++, rows.push(`  ✓ ${n}${d ? ' — ' + d : ''}`))
const bad = (n, d = '') => (fail++, rows.push(`  ✗ ${n}${d ? ' — ' + d : ''}`))

;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  const httpErrors = []
  const pageErrors = []
  page.on('response', (r) => {
    if (r.status() >= 400) httpErrors.push(`${r.status()} ${r.url().replace(BASE, '<base>')}`)
  })
  page.on('pageerror', (e) => pageErrors.push(e.message.slice(0, 160)))

  /** 让所有懒加载图先加载出来，再统计真实加载情况 */
  async function imageReport() {
    return page.evaluate(async () => {
      const imgs = Array.from(document.images)
      imgs.forEach((i) => {
        i.loading = 'eager'
        if (!i.src) i.src = i.getAttribute('src') || ''
      })
      // 分段滚动，触发 IntersectionObserver 与 lazy 加载
      const H = document.body.scrollHeight
      for (let y = 0; y < H; y += 600) {
        window.scrollTo(0, y)
        await new Promise((r) => setTimeout(r, 60))
      }
      window.scrollTo(0, 0)
      await new Promise((r) => setTimeout(r, 400))
      await Promise.all(imgs.map((i) => (i.decode ? i.decode().catch(() => {}) : Promise.resolve())))
      const root = location.origin + '/wenmai-hub/'
      return imgs
        .filter((i) => i.getAttribute('src')) // 排除无 src 的占位
        .map((i) => ({
          src: i.currentSrc || i.src,
          attr: i.getAttribute('src'),
          ok: i.complete && i.naturalWidth > 0,
          outside: !(i.currentSrc || i.src).startsWith(root) && !/^(data|blob):/.test(i.currentSrc || i.src)
        }))
    })
  }

  async function visit(hash, label) {
    const before = httpErrors.length
    await page.goto(`${BASE}/${hash}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(400)
    const imgs = await imageReport()
    const broken = imgs.filter((i) => !i.ok)
    const outside = imgs.filter((i) => i.outside)
    const newErr = httpErrors.slice(before).filter((e) => !/^404 .*favicon/.test(e))
    if (broken.length === 0 && newErr.length === 0) {
      ok(`${label} 资源全通`, `${imgs.length} 张图，0 个 4xx`)
    } else {
      bad(
        `${label} 有资源加载失败`,
        broken.length
          ? `${broken.length}/${imgs.length} 张失败，首个 src="${broken[0].attr}"`
          : newErr.slice(0, 2).join(' | ')
      )
    }
    if (outside.length) bad(`${label} 有图片指向部署目录之外`, outside.slice(0, 2).map((o) => o.attr).join(' '))
  }

  // 1. 首页
  await visit('', '首页')
  ;(await page.locator('body').innerText()).includes('人类与社会')
    ? ok('首页文案渲染正常')
    : bad('首页文案缺失')
  await page.screenshot({ path: path.join(SHOTS, 'pages-home.png') })

  // 2. 各馆与专题
  await visit('#/library', '资源库')
  await visit('#/theme/papercut', '剪纸馆')
  await visit('#/theme/she', '畲族馆')
  await visit('#/theme/mindong', '闽东本土文化馆')
  await visit('#/works', '学生成果列表')

  // 3. 素材详情页（卡片是 button + nav()，不是 <a>，所以直接给已知 id）
  await visit('#/entry/M-FEST-001', '素材详情页')

  // 4. 提交页 → 打开内置图库，验证 SVG 图标（本次改动就为这个）
  await page.goto(`${BASE}/#/works/new`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  const opened = await page
    .locator('button:has-text("内置图库"), button:has-text("从图库")')
    .first()
    .click({ timeout: 3000 })
    .then(() => true)
    .catch(() => false)
  if (opened) {
    // 图库是弹窗里的网格，一半缩略图在可视区外，走 lazy 加载；
    // 直接统计会把「还没轮到加载」误判成 404。先强制 eager、滚动容器、等 decode 完成再判定。
    await page.evaluate(async () => {
      const imgs = Array.from(document.querySelectorAll('img')).filter((i) =>
        /craft-|scenic-|festival-/.test(i.getAttribute('src') || '')
      )
      imgs.forEach((i) => {
        i.loading = 'eager'
      })
      const panel = imgs[0]?.closest('.overflow-y-auto') || document.scrollingElement
      if (panel) {
        for (let y = 0; y < panel.scrollHeight; y += 400) {
          panel.scrollTop = y
          await new Promise((r) => setTimeout(r, 40))
        }
      }
      await new Promise((r) => setTimeout(r, 300))
      await Promise.all(imgs.map((i) => (i.decode ? i.decode().catch(() => {}) : Promise.resolve())))
    })
    const libImgs = await page.evaluate(() =>
      Array.from(document.querySelectorAll('img'))
        .filter((i) => /craft-|scenic-|festival-/.test(i.getAttribute('src') || ''))
        .map((i) => ({ attr: i.getAttribute('src'), ok: i.complete && i.naturalWidth > 0 }))
    )
    if (libImgs.length === 0) {
      bad('内置图库预览', '没找到图库缩略图')
    } else if (libImgs.every((i) => i.ok)) {
      ok('内置图库 SVG 全部命中', `${libImgs.length} 个图标，路径形如 "${libImgs[0].attr}"`)
    } else {
      const badOnes = libImgs.filter((i) => !i.ok)
      bad('内置图库有图标未加载出来', `${badOnes.length}/${libImgs.length}，首个 "${badOnes[0].attr}"`)
    }
    await page.screenshot({ path: path.join(SHOTS, 'pages-gallery.png') })
  } else {
    bad('内置图库', '找不到打开图库的按钮')
  }

  // 5. 深链直达：新开页面访问带 hash 的地址，模拟用户分享链接后直接打开
  const deep = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  const deepResp = await deep.goto(`${BASE}/#/theme/she`, { waitUntil: 'networkidle' })
  const deepText = await deep.locator('body').innerText()
  deepResp && deepResp.status() === 200 && deepText.length > 200
    ? ok('分享链接（带 hash）可直接打开', `HTTP ${deepResp.status()}，正文 ${deepText.length} 字`)
    : bad('分享链接不可达', `HTTP ${deepResp ? deepResp.status() : 'null'}`)
  await deep.close()

  // 6. 全站不该出现指向域名根的绝对资源
  const absoluteRefs = await page.evaluate(() =>
    Array.from(document.querySelectorAll('img,script,link'))
      .map((el) => el.getAttribute('src') || el.getAttribute('href'))
      .filter((u) => u && u.startsWith('/') && !u.startsWith('//'))
  )
  absoluteRefs.length === 0
    ? ok('页面内无根绝对路径资源（/xxx 会跳出部署目录）')
    : bad('仍有根绝对路径资源', absoluteRefs.slice(0, 3).join(' '))

  pageErrors.length === 0 ? ok('无 JS 运行时错误') : bad('有 JS 报错', pageErrors.slice(0, 2).join(' | '))

  const realErrs = httpErrors.filter((e) => !/^404 .*favicon/.test(e))
  realErrs.length === 0
    ? ok('全程无 4xx/5xx')
    : bad('存在失败请求', Array.from(new Set(realErrs)).slice(0, 5).join(' | '))

  await browser.close()
  console.log(rows.join('\n'))
  console.log(`\n通过 ${pass} / ${pass + fail}${fail ? '，失败 ' + fail : ''}`)
  process.exit(fail ? 1 : 0)
})().catch((e) => {
  console.error('体检脚本异常：', e.message)
  process.exit(1)
})
