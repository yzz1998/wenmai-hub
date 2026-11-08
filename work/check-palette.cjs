/**
 * 配色审计 —— 换肤后跑这一支。
 *
 * 它做三件事，都是"人眼看图看不出来"的：
 *   1. 逐页截图（桌面 1440 / 移动 390），留档对比
 *   2. 采样真实渲染的计算样式，算文字对底色的对比度，低于 AA 就报出来
 *   3. 扫一遍全站背景色，看还有没有残留的米色（色相 25–65°、饱和 <40%、明度 >88%）
 *
 * 为什么不能只看截图：米色残留、对比度差 0.2 这类问题，肉眼看图完全分不出，
 * 但换成低亮度屏幕或强光下就会出问题。必须量。
 *
 * 用法：
 *   node work/check-palette.cjs                 # 打本地 5183
 *   BASE=https://yzz1998.github.io/wenmai-hub node work/check-palette.cjs
 */
const path = require('path')
const fs = require('fs')

const BASE = process.env.BASE || 'http://127.0.0.1:5183'
const SHOTS = path.join(__dirname, 'shots', 'palette')

const PAGES = [
  ['/', 'home', '首页'],
  ['/library', 'library', '资源库'],
  ['/theme/papercut', 'theme-papercut', '剪纸馆'],
  ['/theme/she', 'theme-she', '畲族馆'],
  ['/theme/mindong', 'theme-mindong', '闽东馆'],
  ['/works', 'works', '成果列表'],
  ['/works/new', 'works-new', '提交成果'],
  ['/about', 'about', '关于']
]

let pass = 0
const fails = []
const ok = (n, d = '') => {
  pass += 1
  console.log(`  ✓ ${n}${d ? ' — ' + d : ''}`)
}
const bad = (n, d = '') => {
  fails.push(`${n}${d ? ' — ' + d : ''}`)
  console.log(`  ✗ ${n}${d ? ' — ' + d : ''}`)
}

/* ---------------- 颜色工具 ---------------- */
const parse = (s) => {
  const m = String(s).match(/rgba?\(([^)]+)\)/)
  if (!m) return null
  const p = m[1].split(/[,/]/).map((x) => parseFloat(x.trim()))
  return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }
}
const lin = (c) => {
  c /= 255
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}
const lum = ({ r, g, b }) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
const ratio = (a, b) => {
  const l1 = lum(a)
  const l2 = lum(b)
  const [x, y] = l1 > l2 ? [l1, l2] : [l2, l1]
  return (x + 0.05) / (y + 0.05)
}
const hex = ({ r, g, b }) =>
  '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
/** 米色判定：暖色相 + 低饱和 + 高明度 */
const isBeige = ({ r, g, b }) => {
  const mx = Math.max(r, g, b)
  const mn = Math.min(r, g, b)
  if (mx < 225) return false // 足够亮的才算"底色"
  const l = (mx + mn) / 2 / 255
  const s = mx === mn ? 0 : (mx - mn) / (mx + mn > 255 ? 510 - mx - mn : mx + mn)
  if (s > 0.34) return false
  let h = 0
  const d = mx - mn
  if (d === 0) return false
  if (mx === r) h = ((g - b) / d) % 6
  else if (mx === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  h *= 60
  if (h < 0) h += 360
  return h >= 20 && h <= 70 && l > 0.86
}

;(async () => {
  fs.mkdirSync(SHOTS, { recursive: true })
  const { chromium } = require('playwright-core')
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true
  })
  const errors = []
  const beigeHits = []
  const lowContrast = []
  let skippedOnArt = 0

  console.log(`\n==== 1. 逐页渲染与截图（${BASE}）====`)
  for (const [route, name, label] of PAGES) {
    for (const [vw, vh, tag] of [
      [1440, 900, 'desktop'],
      [390, 844, 'mobile']
    ]) {
      const page = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1 })
      page.on('pageerror', (e) => errors.push(`${name}/${tag}: ${e.message.slice(0, 120)}`))
      page.on('console', (m) => {
        if (m.type() !== 'error') return
        const t = m.text()
        /**
         * 打线上时 GitHub Pages 的边缘节点会掐掉一部分连接（连续快速开 16 个页面时常见）。
         * 逐个 curl 复验都是 200，说明不是资源缺失，是网络层噪声。
         * 这类单独计数，不判失败；其余 console 错误照旧算错。
         */
        if (/net::ERR_(CONNECTION_CLOSED|NETWORK_CHANGED|TIMED_OUT|ABORTED|CONNECTION_RESET)/.test(t)) {
          errors.netFlake = (errors.netFlake || 0) + 1
          return
        }
        errors.push(`${name}/${tag}: ${t.slice(0, 120)}`)
      })
      /**
       * 打线上时偶发 ERR_CONNECTION_CLOSED（GitHub Pages 对我们这种
       * 「连续快速开 16 个页面」的访问会掐连接）。这不是站点故障，
       * 但一次网络抖动就让整轮审计中断没有意义，所以失败时退避重试一次。
       */
      let navigated = false
      for (let attempt = 0; attempt < 2 && !navigated; attempt += 1) {
        try {
          await page.goto(BASE + '/#' + route, { waitUntil: 'networkidle', timeout: 45000 })
          navigated = true
        } catch (e) {
          if (attempt === 1) throw e
          await page.waitForTimeout(1800)
        }
      }
      await page.waitForTimeout(1100)
      // 懒加载图不滚到底永远不加载，截图会出现一片白 —— 先滚一轮
      await page.evaluate(async () => {
        const step = window.innerHeight
        for (let y = 0; y < document.body.scrollHeight; y += step) {
          window.scrollTo(0, y)
          await new Promise((r) => setTimeout(r, 90))
        }
        window.scrollTo(0, 0)
        await new Promise((r) => setTimeout(r, 250))
      })
      await page.screenshot({ path: path.join(SHOTS, `${name}-${tag}.png`) })

      // 只审桌面版的计算样式，移动端布局差异不影响配色结论
      if (tag === 'desktop') {
        const sample = await page.evaluate(() => {
          const out = []
          const walk = (el) => {
            const cs = getComputedStyle(el)
            const txt = (el.innerText || '').trim()
            const bg = cs.backgroundColor
            // 取"有背景色"的元素做底色样本
            if (bg && bg !== 'rgba(0, 0, 0, 0)' && el.getBoundingClientRect().width > 40) {
              out.push({ kind: 'bg', bg, tag: el.tagName, cls: (el.className || '').toString().slice(0, 70) })
            }
            // 取"直接含文字叶子节点"做文字样本
            if (txt && txt.length < 200 && el.children.length === 0) {
              out.push({
                kind: 'text',
                bg,
                fg: cs.color,
                fs: parseFloat(cs.fontSize),
                fw: cs.fontWeight,
                tag: el.tagName,
                cls: (el.className || '').toString().slice(0, 70),
                txt: txt.slice(0, 24)
              })
            }
            for (const c of el.children) walk(c)
          }
          walk(document.body)
          return { items: out.slice(0, 4000), bodyBg: getComputedStyle(document.body).backgroundColor }
        })

        // 米色审计
        for (const it of sample.items.filter((i) => i.kind === 'bg')) {
          const c = parse(it.bg)
          if (c && c.a > 0.5 && isBeige(c)) beigeHits.push(`${label} ${hex(c)} ${it.cls}`)
        }
        if (isBeige(parse(sample.bodyBg))) beigeHits.push(`${label} body ${hex(parse(sample.bodyBg))}`)

        // 对比度审计：找实际生效的底色
        //
        // 这里踩过一个假阳性：卡片封面上压着白字，但封面底色是 `bg-gradient-to-br`
        // 的渐变 —— 渐变的颜色写在 background-image 里，backgroundColor 是透明的。
        // 只读 backgroundColor 的版本会一路回溯到 body，得出「白字压在白底上 1:1」
        // 这种荒谬结论，8 个页面一共报了 97 处。
        // 现在遇到 background-image 或 <img> 就判定为「底色不可判定」并跳过，
        // 单独计数，交给人看截图确认。
        const check = await page.evaluate(() => {
          const toRgb = (s) => {
            const m = s.match(/rgba?\(([^)]+)\)/)
            if (!m) return null
            const p = m[1].split(/[,/]/).map((x) => parseFloat(x.trim()))
            return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }
          }
          /**
           * 回溯到第一个「可判定」的底色。
           * 途中只要遇到背景图 / 渐变 / 图片元素，就认输 —— 那上面的文字对比度
           * 取决于图片内容本身，静态分析给不出可信数字。
           * body 单独放行：它的 radial-gradient 是极淡的环境光，不影响判定。
           */
          const effBg = (el) => {
            let n = el
            while (n && n !== document.body && n !== document.documentElement) {
              const tag = n.tagName
              if (tag === 'IMG' || tag === 'VIDEO' || tag === 'PICTURE' || tag === 'CANVAS') return { skip: true }
              const cs = getComputedStyle(n)
              if (cs.backgroundImage && cs.backgroundImage !== 'none') return { skip: true }
              const c = toRgb(cs.backgroundColor)
              if (c && c.a >= 0.85) return { bg: c, skip: false }
              /**
               * 半透明底色（图源角标是 bg-ink/55 压在照片上，hover 高亮是 3.5% 黑）。
               * 前者的真实对比度取决于照片内容，静态算不出来 —— 早先的版本会一路
               * 回溯到白卡片，判出「白字压在白底 1:1」，纯属冤枉。
               * 所以 a≥0.2 的半透明层一律认输跳过；a<0.2 的当作透明继续往上找。
               */
              if (c && c.a >= 0.2) return { skip: true }
              n = n.parentElement
            }
            /**
             * 走到 body 还没找到不透明底 —— 但底色可能压根不在祖先链上。
             * 首页专题卡片就是这种写法：渐变铺在 `<span class="absolute inset-0">` 里，
             * 与文字是**兄弟**关系，只沿着 parentElement 往上爬永远看不到它。
             * 所以再扫一遍祖先容器的子节点，有覆盖性的绝对定位背景层就认输。
             */
            let p = el.parentElement
            while (p && p !== document.body) {
              const pr = p.getBoundingClientRect()
              const covered = Array.from(p.children).some((sib) => {
                if (sib === el || sib.contains(el)) return false
                const s = getComputedStyle(sib)
                if (s.position !== 'absolute' && s.position !== 'fixed') return false
                const r = sib.getBoundingClientRect()
                if (r.width < pr.width * 0.75 || r.height < pr.height * 0.55) return false
                return (
                  (s.backgroundImage && s.backgroundImage !== 'none') ||
                  (s.backgroundColor && s.backgroundColor !== 'rgba(0, 0, 0, 0)')
                )
              })
              if (covered) return { skip: true }
              p = p.parentElement
            }
            return { bg: toRgb(getComputedStyle(document.body).backgroundColor), skip: false }
          }
          const out = []
          let skipped = 0
          document.querySelectorAll('body *').forEach((el) => {
            const own = Array.from(el.childNodes).some(
              (n) => n.nodeType === 3 && n.textContent.trim().length > 2
            )
            if (!own) return
            const cs = getComputedStyle(el)
            if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) < 0.6) return
            const rect = el.getBoundingClientRect()
            if (rect.width < 8 || rect.height < 6) return
            const fg = toRgb(cs.color)
            if (!fg) return
            const { bg, skip } = effBg(el)
            if (skip || !bg) {
              skipped += 1
              return
            }
            out.push({
              fg,
              bg,
              fs: parseFloat(cs.fontSize),
              fw: parseInt(cs.fontWeight, 10) || 400,
              cls: (el.className || '').toString().slice(0, 60),
              txt: el.innerText.trim().slice(0, 20)
            })
          })
          return { items: out, skipped }
        })

        skippedOnArt += check.skipped
        const lumOf = ({ r, g, b }) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
        for (const t of check.items) {
          const l1 = lumOf(t.fg)
          const l2 = lumOf(t.bg)
          const r = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
          // 大字号（≥18.66px 或 ≥14px 粗体）AA 门槛 3，其余 4.5
          const large = t.fs >= 18.66 || (t.fs >= 14 && t.fw >= 700)
          const min = large ? 3 : 4.5
          if (r < min) {
            lowContrast.push({
              page: label,
              ratio: +r.toFixed(2),
              need: min,
              fs: t.fs,
              fw: t.fw,
              fg: hex(t.fg),
              bg: hex(t.bg),
              txt: t.txt,
              cls: t.cls
            })
          }
        }
      }
      await page.close()
    }
    ok(`${label} 渲染 + 截图`)
  }

  console.log('\n==== 2. 米色残留审计 ====')
  const uniqBeige = [...new Set(beigeHits)]
  if (!uniqBeige.length) ok('全站未检出米色背景')
  else {
    bad('仍有米色背景', `${uniqBeige.length} 处`)
    uniqBeige.slice(0, 8).forEach((x) => console.log('      ' + x))
  }

  console.log('\n==== 3. 文字对比度（WCAG AA）====')
  // 同一页面同一组颜色会重复很多次，按「页面+前景+背景」去重，避免刷屏
  const seen = new Map()
  for (const x of lowContrast) {
    const k = `${x.page}|${x.fg}|${x.bg}|${x.fs}|${x.fw}`
    if (!seen.has(k)) seen.set(k, { ...x, count: 1 })
    else seen.get(k).count += 1
  }
  const uniqLC = [...seen.values()].sort((a, b) => a.ratio - b.ratio)
  console.log(`  （跳过 ${skippedOnArt} 处压在图片/渐变上的文字，其对比度取决于图像内容，需看截图判断）`)
  if (!uniqLC.length) ok('所有可见文字均达 AA')
  else {
    bad('存在不达 AA 的文字', `${uniqLC.length} 组 / ${lowContrast.length} 处`)
    uniqLC.slice(0, 12).forEach((x) =>
      console.log(
        `      ${x.page} ${x.fg} on ${x.bg} = ${x.ratio}:1（需 ${x.need}，${x.fs}px/${x.fw}）「${x.txt}」×${x.count}`
      )
    )
  }

  console.log('\n==== 4. 控制台 ====')
  if (errors.netFlake) console.log(`  （已忽略 ${errors.netFlake} 处网络层断连，非应用错误）`)
  errors.length === 0 ? ok('无 JS 报错') : bad('有 JS 报错', errors.slice(0, 3).join(' | '))

  await browser.close()

  console.log(`\n通过 ${pass} / ${pass + fails.length}，截图 ${PAGES.length * 2} 张 → work/shots/palette/`)
  if (fails.length) {
    console.log('\n未通过：')
    fails.forEach((f) => console.log('  · ' + f))
    process.exitCode = 1
  }
})()
