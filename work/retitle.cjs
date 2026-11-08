const fs = require('fs')

/* 1) index.html：标题与描述 */
let h = fs.readFileSync('index.html', 'utf8')
h = h.replace('<title>文脉馆 · 地方文化数字资源平台</title>', '<title>人类与社会 · 课程数字资源平台</title>')
h = h.replace(
  'content="文脉馆整合库淑兰剪纸纹样、闽东畲族民俗与闽东本土文化知识库，提供跨馆检索、策展浏览、教学引用与学生成果入库。"',
  'content="以《人类与社会》课程第二章「人类社会发展与资源」、第五章「城市、城市化与乡村社会」为两个独立专题馆，配剪纸、畲族两个乡土专题馆与闽东本土文化知识库，提供跨馆检索、策展浏览、教学引用与选辑。"'
)
fs.writeFileSync('index.html', h)
console.log('index.html → title:', h.includes('人类与社会 · 课程数字资源平台'), '| desc:', h.includes('两个独立专题馆'))

/* 2) site.js：副标与定位 */
let s = fs.readFileSync('src/data/site.js', 'utf8')
s = s.replace("sub: '课程章节库 · 乡土文化专题',", "sub: '课程专题馆 · 乡土专题',")
s = s.replace(
  /desc:\s*'[^']*'/,
  "desc: '以《人类与社会》第二、五章为两个课程专题馆，配剪纸、畲族两个乡土专题馆与闽东本土文化知识库，共用一套检索、引用与选辑。'"
)
fs.writeFileSync('src/data/site.js', s)
console.log('site.js → sub:', /课程专题馆 · 乡土专题/.test(s), '| desc:', /两个课程专题馆/.test(s))
