/** 让卡片/详情优先使用统一配图，原图仍在 Lightbox 中查看 */
const fs = require('fs')
const p = 'src/components/Media.jsx'
let s = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n')

const importAnchor = "import { categoryMeta } from '../data/taxonomy'"
if (!s.includes('const COVERS')) {
  if (!s.includes(importAnchor)) throw new Error('import 锚点未命中')
  s = s.replace(
    importAnchor,
    [
      importAnchor,
      "import coversData from '../data/covers.json'",
      '',
      '/** 统一配图表：entry.id → 1200×900 标准图 */',
      'const COVERS = coversData.items || {}'
    ].join('\n')
  )
}

const start = s.indexOf('export function EntryVisual(')
if (start < 0) throw new Error('未找到 EntryVisual')
// 函数体内所有右花括号都有缩进，第一个顶格右括号即函数结尾
const end = s.indexOf('\n}', start)
if (end < 0) throw new Error('未找到函数结尾')

const newFn = [
  "export function EntryVisual({ entry, ratio = 'aspect-[4/3]', className = '', eager = false, label }) {",
  '  const meta = categoryMeta(entry?.collection, entry?.category)',
  '  const cover = COVERS[entry?.id]?.cover',
  '  const fallback = isCourseEntry(entry) ? (',
  '    <CourseArt entry={entry} />',
  '  ) : (',
  '    <CategoryArt collection={entry?.collection} seed={entry?.id} label={label || meta.name} />',
  '  )',
  '',
  '  // 统一配图优先：334 条各一张 1200x900 标准图，卡片观感一致',
  '  if (cover) {',
  '    return (',
  '      <SmartImage',
  '        src={asset(cover)}',
  "        alt={entry?.media?.[0]?.alt || entry?.title || label || ''}",
  '        ratio={ratio}',
  '        className={className}',
  '        eager={eager}',
  '        fallback={fallback}',
  '      />',
  '    )',
  '  }',
  '',
  '  const media = entry?.media?.[0]',
  '  if (media?.src) {',
  '    return (',
  '      <SmartImage',
  '        src={asset(media.src)}',
  '        alt={media.alt || entry.title}',
  '        ratio={ratio}',
  '        className={className}',
  '        eager={eager}',
  '        fallback={fallback}',
  '      />',
  '    )',
  '  }',
  '  return (',
  '    <div className={`relative overflow-hidden bg-paper-sunk ${ratio} ${className}`}>{fallback}</div>',
  '  )',
  '}'
].join('\n')

s = s.slice(0, start) + newFn + s.slice(end + 2)
if (!s.endsWith('\n')) s += '\n'
fs.writeFileSync(p, s)
console.log('patched ok | COVERS:', /const COVERS/.test(s), '| 统一配图优先:', /统一配图优先/.test(s))
