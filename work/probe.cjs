const { chromium } = require('playwright-core')
const BASE = process.env.BASE || 'http://127.0.0.1:5183'
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'

;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } })
  page.on('console', (m) => m.type() === 'error' && console.log('[console]', m.text()))
  await page.goto(`${BASE}/#/entry/PC-001`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)

  const before = await page.evaluate(() => {
    const art = document.querySelector('article')
    const cs = art ? getComputedStyle(art) : null
    return {
      hasArticle: !!art,
      animName: cs && cs.animationName,
      animFill: cs && cs.animationFillMode,
      animPlay: cs && cs.animationPlayState
    }
  })
  console.log('article:', JSON.stringify(before))

  await page.locator('figure button').first().click()
  await page.waitForTimeout(900)

  const after = await page.evaluate(() => {
    const el = document.elementFromPoint(20, 20)
    const dlg = document.querySelector('[role="dialog"][aria-modal="true"]')
    const r = dlg ? dlg.getBoundingClientRect() : null
    const mt = dlg ? getComputedStyle(dlg).marginTop : null
    // 找出夹住 dialog 的所有祖先里带 transform/filter/animation 的
    const chain = []
    let p = dlg ? dlg.parentElement : null
    while (p && p !== document.body) {
      const s = getComputedStyle(p)
      if (
        s.transform !== 'none' ||
        s.filter !== 'none' ||
        s.backdropFilter !== 'none' ||
        s.animationName !== 'none' ||
        s.willChange !== 'auto' ||
        s.contain !== 'none'
      ) {
        chain.push({
          tag: p.tagName,
          cls: (p.className || '').toString().slice(0, 70),
          transform: s.transform,
          filter: s.filter,
          backdrop: s.backdropFilter,
          anim: s.animationName,
          willChange: s.willChange,
          contain: s.contain,
          zIndex: s.zIndex
        })
      }
      p = p.parentElement
    }
    return {
      topEl: el ? `${el.tagName}.${(el.className || '').toString().slice(0, 40)}` : 'null',
      rect: r ? { y: Math.round(r.y), h: Math.round(r.height), w: Math.round(r.width) } : null,
      marginTop: mt,
      blockers: chain
    }
  })
  console.log('overlay:', JSON.stringify(after, null, 2))
  await browser.close()
})()
