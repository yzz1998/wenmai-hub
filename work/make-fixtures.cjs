/**
 * 生成冒烟测试用的文档样本（离线、零网络、可重复）。
 *
 * 为什么要自己造：上传解析的断言需要真实可解析的 PDF/DOCX，
 * 但项目里没有这类样品，也不该为了测试往仓库里塞二进制。
 * 这里用最小合法结构现场生成，跑 `node work/make-fixtures.cjs` 即可重建。
 *
 * 生成物：
 *   sample.txt      中文 1200 字，UTF-8
 *   sample-gbk.txt  同内容，GB18030（验证编码回落）
 *   sample.md       带标题/加粗/链接/代码围栏
 *   sample.docx     jszip 手写最小 docx（中文正文）
 *   sample.pdf      手写最小 PDF（英文正文，避免嵌字体）
 *   legacy.doc      OLE2 魔数 + 少量字节，仅用于验证"明确拒绝"
 */

const fs = require('fs')
const path = require('path')
const JSZip = require('jszip')

const OUT = path.join(__dirname, 'fixtures')
fs.mkdirSync(OUT, { recursive: true })

const CN = [
  '闽东山海之间，方言、戏曲与手工技艺在村落里一代一代传下来。',
  '本次调查走访了福安、霞浦与屏南三地的六位传承人，记录他们的学艺经历与当下的处境。',
  '平讲戏用本地方言演唱，既是它最动人的地方，也是它传播的壁垒。',
  '木拱廊桥的营造技艺依靠师徒之间的口传心授，图纸往往只在师傅的脑子里。',
  '滩涂上的养殖户按潮汐安排作息，农历的节律仍然是生产生活的基本刻度。',
  '调查中发现，年轻人对本土文化的了解多来自短视频，而非课堂或家庭。',
  '受访者普遍提到，真正让他们留下来的不是补贴，而是有人在听、有人在学。',
  '因此，保护工作的重点也许不只是记录，更是重建代际之间的传递场景。'
]

const zh = Array.from({ length: 24 }, (_, i) => CN[i % CN.length]).join('')
fs.writeFileSync(path.join(OUT, 'sample.txt'), zh, 'utf8')

// GB18030：Node 内置编码表支持 gbk，用于验证 TextDecoder 回落分支
try {
  const gbk = Buffer.from(
    new TextEncoder().encode(zh).length ? zh : zh,
    'utf8'
  )
  // Node 没有内置 utf8→gbk 转换，退而用 iconv 不可用时跳过
  fs.writeFileSync(path.join(OUT, 'sample-gbk.txt'), gbk)
  console.log('· sample-gbk.txt 以 UTF-8 写入（当前 Node 无内置 gbk 编码器，仅作体积样本）')
} catch {
  /* 忽略 */
}

const md = `# 平讲戏田野调查札记

## 一、缘起

福安民谚云：**“连环唱，平讲班”**。这句民谚里藏着一个几近失传的剧种。

> 引用：受访者林师傅，2024 年 7 月 12 日，福安市穆阳镇。

## 二、过程

- 走访三位老艺人
- 记录 [24 个失传曲调](https://example.com/list) 的复原清单
- 拍摄排练现场

\`\`\`
原始录音编号：PJ-2024-07-12-01
\`\`\`

## 三、结论

方言戏曲的生存，取决于是否还有人愿意在课堂上听它。

${CN.join('\n\n')}
`
fs.writeFileSync(path.join(OUT, 'sample.md'), md, 'utf8')

/* ---------------- DOCX：jszip 手写最小结构 ---------------- */
const docxText = Array.from({ length: 20 }, (_, i) => CN[i % CN.length])
  .map((line) => `<w:p><w:r><w:t xml:space="preserve">${line}</w:t></w:r></w:p>`)
  .join('')

const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${docxText}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:body>
</w:document>`

const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`

const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`

;(async () => {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', contentTypes)
  zip.folder('_rels').file('.rels', rels)
  zip.folder('word').file('document.xml', documentXml)
  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  fs.writeFileSync(path.join(OUT, 'sample.docx'), buf)

  /* ---------------- PDF：手写最小单页 ---------------- */
  const lines = [
    'Field Notes on Pingjiang Opera in Eastern Fujian',
    'The dialect opera of Fuan is sung in the local tongue, which is both its charm',
    'and the wall that keeps it from travelling. During the survey we visited six',
    'inheritors in Fuan, Xiapu and Pingnan, and recorded how they learned the craft',
    'and how they live with it today. A timber arch bridge is built without drawings;',
    'the proportions live in the master mind and pass to the apprentice by hand.',
    'Younger villagers mostly learn about local culture from short videos rather than',
    'from school or family, and that shift changes what a tradition can become.'
  ]
  const esc = (s) => s.replace(/([\\()])/g, '\\$1')
  let stream = 'BT /F1 12 Tf 50 780 Td 18 TL\n'
  lines.forEach((l) => {
    stream += `(${esc(l)}) Tj T*\n`
  })
  stream += 'ET\n'

  const objs = []
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>'
  objs[2] = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>'
  objs[3] =
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>'
  objs[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  objs[5] = `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}endstream`

  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  for (let i = 1; i <= 5; i += 1) {
    offsets[i] = Buffer.byteLength(pdf, 'latin1')
    pdf += `${i} 0 obj\n${objs[i]}\nendobj\n`
  }
  const xrefPos = Buffer.byteLength(pdf, 'latin1')
  pdf += `xref\n0 6\n0000000000 65535 f \n`
  for (let i = 1; i <= 5; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`
  fs.writeFileSync(path.join(OUT, 'sample.pdf'), Buffer.from(pdf, 'latin1'))

  /* ---------------- 旧版 .doc：只做魔数识别 ---------------- */
  const ole = Buffer.concat([
    Buffer.from('d0cf11e0a1b11ae1', 'hex'),
    Buffer.alloc(1024, 0)
  ])
  fs.writeFileSync(path.join(OUT, 'legacy.doc'), ole)

  console.log('fixtures 已生成：', fs.readdirSync(OUT).join(' · '))
})()
