/**
 * 解析层自测：在真实浏览器里跑 docs.js，逐个喂 fixture，打印解析结果。
 *
 * 为什么不在 Node 里测：pdfjs 的 worker、TextDecoder('gb18030')、IndexedDB
 * 都只在浏览器环境里成立，Node 侧跑通不代表线上能用。
 *
 * 用法：node work/test-docs.cjs   （需先启动 vite 于 5183）
 */
const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright-core')

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const FIX = path.join(__dirname, 'fixtures')

const CASES = [
  { file: 'sample.txt', name: 'sample.txt', type: 'text/plain', expect: 'ok' },
  { file: 'sample.md', name: 'sample.md', type: 'text/markdown', expect: 'ok' },
  { file: 'sample.docx', name: 'sample.docx', type: '', expect: 'ok' },
  { file: 'sample.pdf', name: 'sample.pdf', type: 'application/pdf', expect: 'ok' },
  { file: 'legacy.doc', name: 'legacy.doc', type: '', expect: 'LEGACY_OFFICE' },
  { file: 'sample.txt', name: 'fake.docx', type: '', expect: 'MISLABELED' },
  { file: 'sample.txt', name: 'photo.jpg', type: 'image/jpeg', expect: 'INVALID_EXT' }
]

;(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const page = await browser.newPage()
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('[console]', m.text().slice(0, 200))
  })
  page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 200)))
  await page.goto('http://127.0.0.1:5183/#/', { waitUntil: 'networkidle' })

  let pass = 0
  let fail = 0

  for (const c of CASES) {
    const b64 = fs.readFileSync(path.join(FIX, c.file)).toString('base64')
    const r = await page.evaluate(
      async ({ b64, name, type }) => {
        const { parseDocument } = await import('/src/lib/docs.js')
        const bin = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0))
        const file = new File([bin], name, { type })
        try {
          const { doc, text } = await parseDocument(file)
          return {
            ok: true,
            kind: doc.kind,
            chars: doc.chars,
            pages: doc.pages,
            truncated: doc.truncated,
            parser: doc.parser,
            preview: text.slice(0, 60).replace(/\n/g, ' / '),
            hasRaw: Boolean(doc.fileRef)
          }
        } catch (e) {
          return { ok: false, code: e.code || 'UNKNOWN', msg: e.message }
        }
      },
      { b64, name: c.name, type: c.type }
    )

    const good = c.expect === 'ok' ? r.ok : !r.ok && r.code === c.expect
    if (good) pass += 1
    else fail += 1
    console.log(
      `${good ? '✓' : '✗'} ${c.name.padEnd(14)} expect=${c.expect.padEnd(14)}`,
      r.ok ? `${r.kind} · ${r.chars} 字 · ${r.pages || '-'} 页 · ${r.parser} · raw=${r.hasRaw}\n    ${r.preview}` : `${r.code} ${r.msg}`
    )
  }

  console.log(`\n通过 ${pass} / ${pass + fail}`)
  await browser.close()
  process.exit(fail ? 1 : 0)
})()
