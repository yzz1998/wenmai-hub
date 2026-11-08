const fs = require('fs')
const p = 'work/smoke.cjs'
let s = fs.readFileSync(p, 'utf8')

/* ---- A. 在剪纸专题之前插入「专题馆（四个馆）」检查 ---- */
const A_ANCHOR = '  /* ---------- 3. 剪纸专题 ---------- */'
const A_BLOCK = `  /* ---------- 2b. 专题馆：四个馆 ---------- */
  await page.goto(\`\${BASE}/#/theme\`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  const hallCount = await page.locator('article').count()
  const hallNames = (await page.locator('article h2').allInnerTexts()).map((x) => x.trim())
  ok('专题馆 · 馆数', \`\${hallCount} 个：\${hallNames.join(' / ')}\`)
  const courseHalls = hallNames.filter((n) => /资源与发展馆|城市与乡村馆/.test(n)).length
  ok('专题馆 · 课程两馆在列', \`\${courseHalls} 个\`)

  /* 第二章馆：结构、条目数、边界 */
  await page.goto(\`\${BASE}/#/theme/resources\`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  ok('资源与发展馆 · 标题', (await page.locator('h1').first().innerText()).trim())
  const resCards = await page.locator('main article').count()
  ok('资源与发展馆 · 要点条数', \`\${resCards} 条\`)
  const resSidebar = await page.locator('nav[aria-label="分类目录"] button').count()
  ok('资源与发展馆 · 侧栏（全部 + 3 节）', \`\${resSidebar} 项\`)
  const resHeads = await page.locator('main section > div h3').allInnerTexts()
  ok('资源与发展馆 · 按节分组', \`\${resHeads.length} 个分组：\${resHeads.map((x) => x.split('\\n')[0]).join(' / ')}\`)
  const resHrefs = await page.locator('main article a').evaluateAll((as) => as.map((a) => a.getAttribute('href') || ''))
  ok('资源与发展馆 · 不混入第五章', \`HS5 出现 \${resHrefs.filter((h) => h.includes('HS5')).length} 次\`)

  /* 第五章馆 */
  await page.goto(\`\${BASE}/#/theme/urban-rural\`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  ok('城市与乡村馆 · 标题', (await page.locator('h1').first().innerText()).trim())
  const cityCards = await page.locator('main article').count()
  ok('城市与乡村馆 · 要点条数', \`\${cityCards} 条\`)
  const cityHrefs = await page.locator('main article a').evaluateAll((as) => as.map((a) => a.getAttribute('href') || ''))
  ok('城市与乡村馆 · 不混入第二章', \`HS2 出现 \${cityHrefs.filter((h) => h.includes('HS2')).length} 次\`)

  /* 按节筛选 */
  await page.getByRole('button', { name: /工业与社会变迁/ }).first().click()
  await page.waitForTimeout(600)
  const oneSection = await page.locator('main article').count()
  ok('城市与乡村馆 · 按节筛选（工业与社会变迁）', \`\${oneSection} 条\`)

  /* 课程条目详情与引用 */
  await page.goto(\`\${BASE}/#/entry/HS5-002\`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const courseMain = await page.locator('main').innerText()
  ok('课程条目 · 正文标题', courseMain.includes('要点释读') ? '要点释读' : '未找到')
  ok('课程条目 · 章节元数据', courseMain.includes('所属章节') && courseMain.includes('第五章'))
  const courseCite = await page.locator('section').filter({ hasText: '引用本条' }).first().innerText()
  const citeText = courseCite.replace(/\\s+/g, ' ')
  ok('课程条目 · 引用含章节定位', /第五章/.test(citeText) ? '含「第五章」' : citeText.slice(0, 60))

${A_ANCHOR}`

if (!s.includes(A_ANCHOR)) throw new Error('A 锚点未命中')
s = s.replace(A_ANCHOR, A_BLOCK)

/* ---- B. 移动端溢出：从只测首页扩展为逐页检测 ---- */
const B_ANCHOR = `  const overflow = await mobile.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth
  }))
  ok('移动端横向溢出检查', \`scrollW=\${overflow.scrollW} clientW=\${overflow.clientW}\`)`

const B_NEW = `  const mobilePages = ['/', '/library', '/theme', '/theme/resources', '/theme/urban-rural', '/theme/papercut', '/theme/she']
  const overflowRows = []
  for (const path of mobilePages) {
    await mobile.goto(\`\${BASE}/#\${path}\`, { waitUntil: 'networkidle' })
    await mobile.waitForTimeout(450)
    const d = await mobile.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    overflowRows.push(\`\${path}:\${d}\`)
  }
  const badOverflow = overflowRows.filter((r) => Number(r.split(':')[1]) > 1)
  ok('移动端横向溢出（7 页）', badOverflow.length ? \`溢出：\${badOverflow.join(' ')}\` : '全部 0')`

if (!s.includes(B_ANCHOR)) throw new Error('B 锚点未命中')
s = s.replace(B_ANCHOR, B_NEW)

fs.writeFileSync(p, s)
console.log('smoke.cjs 已更新；新增检查段落数：2')
