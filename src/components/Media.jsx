import { useEffect, useState } from 'react'
import Icon from './Icon'
import { useResolvedImage } from '../hooks/useResolvedImage'
import { asset } from '../lib/assets'
import { categoryMeta } from '../data/taxonomy'
import coversData from '../data/covers.json'

/** 统一配图表：entry.id → 1200×900 标准图 */
const COVERS = coversData.items || {}

/* ------------------------------------------------------------------ */
/* 智能图片：统一解析 外链 / DataURL / IndexedDB(local:) 三种来源        */
/* ------------------------------------------------------------------ */
export function SmartImage({
  src,
  alt = '',
  className = '',
  imgClassName = '',
  ratio = 'aspect-[4/3]',
  fallback = null,
  eager = false
}) {
  const resolved = useResolvedImage(src)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [src])

  return (
    <div className={`relative overflow-hidden bg-paper-sunk ${ratio} ${className}`}>
      {resolved && !failed ? (
        <img
          src={resolved}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => setFailed(true)}
          className={`h-full w-full object-cover ${imgClassName}`}
        />
      ) : (
        fallback || (
          <div className="flex h-full w-full items-center justify-center text-ink-mute/35">
            <Icon name="image" size={26} />
          </div>
        )
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 纹样底图：无实景照片的条目用它，明确是「装饰纹样」而非照片            */
/* ------------------------------------------------------------------ */
function hash(str) {
  let h = 0
  for (let i = 0; i < String(str).length; i += 1) h = (h * 31 + str.charCodeAt(i)) % 9973
  return h
}

/**
 * 无图条目的母题配色。
 * c 是渐变底（会被压到纯白上），所以必须是该色系的 50 档；
 * a / b 是母题线条的两支主色，d 是收口的深色。
 * 数值与 tailwind.config.js 的专题色逐一对应，换肤时两处要一起改。
 */
const PALETTE = {
  papercut: { a: '#c63a2b', b: '#ae7c26', c: '#fdf0ee', d: '#9a2a1e' },
  she: { a: '#225483', b: '#287e77', c: '#edf4fb', d: '#c63a2b' },
  mindong: { a: '#287e77', b: '#2e6ea7', c: '#eef7f6', d: '#ae7c26' }
}

/**
 * 三个专题各有一套母题：
 * · 剪纸 —— 团花 / 对称花瓣（对叠剪）
 * · 畲族 —— 织锦菱格 + 凤凰弧线
 * · 闽东 —— 山脊 + 海浪
 * 无图条目统一压一枚朱印 + 「文字条目」说明，避免看起来像加载失败。
 */
export function CategoryArt({ collection = 'mindong', seed = '', className = '', label }) {
  const p = PALETTE[collection] || PALETTE.mindong
  const h = hash(seed || collection)
  const rot = (h % 10) - 5
  const mark = (label || '文脉').replace(/[·\s]/g, '').slice(0, 2)

  return (
    <div className={`relative flex h-full w-full items-center justify-center overflow-hidden ${className}`}>
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(155deg, ${p.c} 0%, #ffffff 55%, ${p.c} 100%)` }}
      />
      <svg
        viewBox="0 0 120 120"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
        style={{ transform: `rotate(${rot}deg) scale(1.08)` }}
      >
        {collection === 'papercut' && (
          <g transform="translate(60 60)" fill="none" strokeWidth="1.15" opacity="0.62">
            {Array.from({ length: 12 }).map((_, i) => (
              <ellipse key={i} rx="12" ry="31" stroke={i % 2 ? p.b : p.a} transform={`rotate(${i * 30})`} />
            ))}
            {Array.from({ length: 12 }).map((_, i) => (
              <circle key={`c${i}`} r="2.2" cy="-27" fill={i % 2 ? p.a : p.b} transform={`rotate(${i * 30})`} />
            ))}
            <circle r="11" fill={p.a} opacity="0.2" />
            <circle r="4.5" fill={p.d} opacity="0.55" />
          </g>
        )}

        {collection === 'she' && (
          <g fill="none" strokeWidth="1.15" opacity="0.6">
            {Array.from({ length: 6 }).map((_, r) =>
              Array.from({ length: 6 }).map((__, c) => (
                <path
                  key={`${r}-${c}`}
                  d={`M${6 + c * 22} ${14 + r * 20} l10 -8 10 8 -10 8Z`}
                  stroke={(r + c) % 2 ? p.a : p.b}
                />
              ))
            )}
            <path d="M8 96c22-14 40-4 52-16 10-10 24-8 46-2" stroke={p.d} strokeWidth="1.8" />
          </g>
        )}

        {collection === 'mindong' && (
          <g fill="none" opacity="0.6">
            <path d="M0 58 22 32 36 50 50 26 66 54 82 34 96 52 120 30" stroke={p.a} strokeWidth="1.5" />
            <path d="M0 72 26 50 44 66 62 46 78 68 94 52 120 64" stroke={p.b} strokeWidth="1.2" opacity="0.75" />
            {Array.from({ length: 4 }).map((_, i) => (
              <path
                key={i}
                d={`M0 ${84 + i * 8}c14-5 22 3 34-1s18 4 28 0 20 3 30-1 20 2 28-1`}
                stroke={p.b}
                strokeWidth="0.95"
                opacity={0.55 - i * 0.09}
              />
            ))}
          </g>
        )}
      </svg>

      {/* 中心留白，保证朱印与说明可读 */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(circle at 50% 46%, rgba(255,255,255,.86) 0%, rgba(255,255,255,.5) 38%, transparent 68%)' }}
        aria-hidden="true"
      />

      <div className="relative z-10 flex flex-col items-center gap-2">
        <span className="seal h-11 w-11 text-[12px] tracking-[0.04em]" aria-hidden="true">
          {mark}
        </span>
        <span className="text-[10px] tracking-[0.12em] text-ink-mute/75">文字条目 · 无实景图</span>
      </div>
    </div>
  )
}

/**
 * 课程条目主图 —— 没有照片，用「章节卡」表达它在教材里的位置。
 * 不套用「文字条目 · 无实景图」的说明：那是展陈语境的措辞，
 * 放在课程条目上会让人误以为缺图。
 */
export function isCourseEntry(entry) {
  return entry?.collection === 'hs-res' || entry?.collection === 'hs-city'
}

function CourseArt({ entry }) {
  const isRes = entry?.collection === 'hs-res'
  /* 两个章节分别用琥珀与陶土：色相只差 16°，靠这一步明度差把卡片区分开 */
  const ink = isRes ? '#875f19' : '#914f22'
  const paperSoft = isRes ? '#fcf6e5' : '#f8e2cc'
  const num = String(entry?.facets?.chapter || '').replace(/^第/, '').replace(/章$/, '')
  /* 印章里放「本章第几条要点」而不是章号：同一节的卡片章号相同，放序号才能彼此区分 */
  const seq = entry?.facets?.order ? String(entry.facets.order).padStart(2, '0') : num
  const meta = categoryMeta(entry?.collection, entry?.category)

  return (
    <div
      className="relative flex h-full w-full items-center justify-center overflow-hidden"
      style={{ background: `linear-gradient(160deg, #ffffff 0%, ${paperSoft} 100%)` }}
    >
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 120 90" preserveAspectRatio="none" aria-hidden="true">
        {Array.from({ length: 7 }).map((_, i) => (
          <line key={i} x1="0" y1={i * 15} x2="120" y2={i * 15} stroke={ink} strokeWidth="0.4" opacity="0.22" />
        ))}
      </svg>
      <div className="relative z-10 flex max-w-full items-center gap-2.5 px-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md font-serif text-[17px] font-bold leading-none tabular-nums text-white shadow-sm"
          style={{ backgroundColor: ink }}
          aria-hidden="true"
        >
          {seq}
        </span>
        <span className="min-w-0">
          <span className="block text-[10px] tracking-[0.14em] text-ink-mute">
            {entry?.facets?.chapter} · {entry?.facets?.section}
          </span>
          {/* 不再重复节名：节名已经是分组标题与侧栏选项，卡片上标「第几条要点」信息量更高 */}
          <span className="mt-0.5 block truncate font-serif text-[12.5px] font-semibold text-ink">
            {entry?.facets?.order ? `本节第 ${entry.facets.order} 条要点` : meta.short}
          </span>
        </span>
      </div>
    </div>
  )
}

/** 条目主图（有实景图用实景，没有则用纹样底图，课程条目用章节卡） */
export function EntryVisual({ entry, ratio = 'aspect-[4/3]', className = '', eager = false, label }) {
  const meta = categoryMeta(entry?.collection, entry?.category)
  const cover = COVERS[entry?.id]?.cover
  const fallback = isCourseEntry(entry) ? (
    <CourseArt entry={entry} />
  ) : (
    <CategoryArt collection={entry?.collection} seed={entry?.id} label={label || meta.name} />
  )

  // 统一配图优先：334 条各一张 1200x900 标准图，卡片观感一致
  if (cover) {
    return (
      <SmartImage
        src={asset(cover)}
        alt={entry?.media?.[0]?.alt || entry?.title || label || ''}
        ratio={ratio}
        className={className}
        eager={eager}
        fallback={fallback}
      />
    )
  }

  const media = entry?.media?.[0]
  if (media?.src) {
    return (
      <SmartImage
        src={asset(media.src)}
        alt={media.alt || entry.title}
        ratio={ratio}
        className={className}
        eager={eager}
        fallback={fallback}
      />
    )
  }
  return (
    <div className={`relative overflow-hidden bg-paper-sunk ${ratio} ${className}`}>{fallback}</div>
  )
}
