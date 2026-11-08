import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from './Icon'
import { CollectionBadge, CategoryChip } from './UI'
import { EntryVisual, SmartImage } from './Media'
import { asset } from '../lib/assets'
import { categoryMeta } from '../data/taxonomy'
import { useStore } from '../hooks/useStore'

/**
 * 统一条目卡片 —— 三馆共用一套卡片，靠 variant 适配不同内容形态：
 * · grid      等宽卡（知识素材 / 畲族展项）
 * · masonry   自然比例卡（剪纸图样：不裁切纹样）
 * · row       列表行（管理页 / 紧凑浏览）
 * 差异只在「图怎么排」；标题、徽标、标签、选辑按钮、引用入口全部一致。
 */

function SelectionButton({ entry, className = 'btn-quiet btn-xs' }) {
  const { inSelection, toggleSelection } = useStore()
  const on = inSelection(entry.id)
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        e.preventDefault()
        toggleSelection(entry.id)
      }}
      className={`${className} ${on ? 'text-dai-700' : ''}`}
      title={on ? '从选辑移除' : '加入教学选辑'}
      aria-label={on ? '从选辑移除' : '加入教学选辑'}
    >
      <Icon name="basket" size={14} />
    </button>
  )
}

/**
 * 图源角标。
 * 剪纸条目的「来源」其实精确到图版页码（《剪花娘子》下册 p.150），只写书名等于没写来源，
 * 所以这里把卷次与页码拼进角标；书名与完整著录仍留在 title 里备查。
 */
function CreditTag({ media, entry }) {
  if (!media?.credit) return null
  const f = entry?.facets || {}
  const plate = entry?.collection === 'papercut' && (f.page || f.vol)
  const page = plate ? [f.vol ? `${f.vol}册` : '', f.page ? `p.${f.page}` : ''].filter(Boolean).join(' ') : ''
  const label = page ? `图版 ${page}` : media.credit
  const tip = page ? `${media.credit} · ${page}${f.size ? ` · 图版 ${f.size}` : ''}` : media.creditTitle ? `${media.credit}　${media.creditTitle}` : media.credit
  return (
    <span
      className="absolute bottom-2 right-2 max-w-[70%] truncate rounded-md bg-ink/55 px-1.5 py-0.5 text-[10px] leading-tight text-paper-warm/95 backdrop-blur-sm"
      title={tip}
    >
      图源：{label}
    </span>
  )
}

/**
 * 保护级别压缩成短徽标。
 * level 是自由文本（"人类非物质文化遗产代表作名录 / 国家级非遗"、
 * "勤廉闽东二十四人物 / 明代文学家"…），原样放进卡片会撑破一行，
 * 只保留可比较的等级信息；无等级的条目干脆不显示，交给「地域」行表达。
 */
function gradeOf(level) {
  if (!level) return ''
  if (/人类非/.test(level)) return '人类非遗'
  if (/国家级/.test(level)) return '国家级非遗'
  if (/省级/.test(level)) return '省级非遗'
  if (/5A/.test(level)) return '5A 景区'
  if (/4A/.test(level)) return '4A 景区'
  return ''
}

export function EntryCard({ entry, index = 0, onCite, variant = 'grid' }) {
  const nav = useNavigate()
  const [failed, setFailed] = useState(false)
  const meta = categoryMeta(entry.collection, entry.category)
  const media = entry.media?.[0]
  const go = () => nav(`/entry/${entry.id}`)

  const delay = { animationDelay: `${Math.min(index * 40, 360)}ms` }

  /* ---------------- 剪纸：自然比例，不裁切 ---------------- */
  if (variant === 'masonry') {
    const ratio = entry.facets?.ratio || 1.3
    return (
      <article className="group animate-rise" style={delay}>
        <div className="overflow-hidden rounded-xl border border-black/[0.07] bg-white shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-lift">
          <button onClick={go} className="relative block w-full text-left" aria-label={`查看《${entry.title}》`}>
            <div className="relative w-full" style={{ paddingBottom: `${Math.min(ratio, 1.8) * 100}%` }}>
              {media?.src && !failed ? (
                <img
                  src={asset(media.src)}
                  alt={entry.title}
                  loading="lazy"
                  decoding="async"
                  onError={() => setFailed(true)}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              ) : (
                <div className="absolute inset-0">
                  <EntryVisual entry={entry} ratio="h-full" />
                </div>
              )}
            </div>
            <span className="absolute left-2 top-2 rounded-md bg-white/85 px-1.5 py-0.5 text-[10px] font-medium text-ink-soft backdrop-blur-sm">
              {entry.facets?.vol}册 · p.{entry.facets?.page}
            </span>
          </button>
          <div className="flex items-start justify-between gap-2 px-3 py-2.5">
            <button onClick={go} className="min-w-0 flex-1 text-left">
              <h3 className="line-clamp-2 font-serif text-[13.5px] font-semibold leading-snug text-ink transition-colors group-hover:text-zhu-700">
                {entry.title}
              </h3>
              <p className="mt-1 truncate text-[11px] text-ink-mute">{meta.name}</p>
            </button>
            <SelectionButton entry={entry} className="btn-quiet btn-xs shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100" />
          </div>
        </div>
      </article>
    )
  }

  /* ---------------- 列表行 ---------------- */
  if (variant === 'row') {
    return (
      <article className="card card-hover flex items-stretch gap-4 overflow-hidden p-3">
        <button onClick={go} className="relative h-24 w-32 shrink-0 overflow-hidden rounded-xl bg-paper-sunk sm:h-28 sm:w-40">
          <EntryVisual entry={entry} ratio="aspect-[4/3]" className="h-full" />
        </button>
        <div className="flex min-w-0 flex-1 flex-col py-0.5">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <CollectionBadge collection={entry.collection} />
            <CategoryChip collection={entry.collection} category={entry.category} />
          </div>
          <h3 className="font-serif text-[15px] font-bold leading-snug text-ink">
            <button onClick={go} className="text-left hover:text-dai-700">
              {entry.title}
            </button>
          </h3>
          <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-ink-mute">{entry.summary}</p>
          <div className="mt-auto flex items-center justify-between gap-2 pt-2">
            <span className="flex items-center gap-1 truncate text-[11px] text-ink-mute">
              <Icon name="pin" size={11} />
              <span className="truncate">{entry.region || entry.subtitle}</span>
              <span className="hidden text-ink-mute/50 sm:inline">·</span>
              <span className="hidden shrink-0 sm:inline">{entry.id}</span>
            </span>
            <div className="flex shrink-0 gap-1">
              <SelectionButton entry={entry} />
              {onCite && (
                <button onClick={() => onCite(entry)} className="btn-quiet btn-xs" title="快速引用">
                  <Icon name="copy" size={13} />
                  引用
                </button>
              )}
              <button onClick={go} className="btn-ghost btn-xs">
                详情
              </button>
            </div>
          </div>
        </div>
      </article>
    )
  }

  /* ---------------- 等宽卡（默认） ---------------- */
  return (
    <article className="card card-hover group flex animate-rise flex-col overflow-hidden" style={delay}>
      <button onClick={go} className="relative block w-full text-left" aria-label={`查看《${entry.title}》详情`}>
        <EntryVisual
          entry={entry}
          ratio="aspect-[4/3]"
          eager={index < 4}
          className="[&>img]:transition-transform [&>img]:duration-500 group-hover:[&>img]:scale-[1.06]"
        />
        {/* 底部暗渐变只为照片压字服务；课程条目的「章节卡」是浅底，不需要 */}
        {!entry.collection?.startsWith('hs-') && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-ink/45 to-transparent" />
        )}
        <CreditTag media={media} entry={entry} />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <CollectionBadge collection={entry.collection} solid />
          {entry.status === 'draft' && <span className="chip bg-ink/70 text-paper-warm">草稿</span>}
        </div>
      </button>

      <div className="flex flex-1 flex-col p-4">
        <div className="mb-1.5 flex items-center gap-1.5">
          <CategoryChip collection={entry.collection} category={entry.category} size="xs" />
          {entry.level && entry.collection === 'mindong' && gradeOf(entry.level) && (
            <span className="chip hidden border border-zhu-100 bg-zhu-50 text-[10.5px] text-zhu-700 sm:inline-flex">
              {gradeOf(entry.level)}
            </span>
          )}
        </div>
        <h3 className="font-serif text-[16px] font-bold leading-snug text-ink">
          <button onClick={go} className="text-left transition-colors hover:text-dai-700">
            {entry.title}
          </button>
        </h3>

        <p className="mt-2 line-clamp-3 flex-1 text-[13px] leading-relaxed text-ink-mute">{entry.summary}</p>

        {entry._hits?.length > 0 && (
          <p className="mt-2 flex items-center gap-1 text-[11px] text-dai-500">
            <Icon name="search" size={11} />
            命中：{entry._hits.join(' / ')}
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-1.5">
          {(entry.tags || []).slice(0, 3).map((t) => (
            <span key={t} className="chip bg-black/[0.04] text-[11px] text-ink-mute">
              #{t}
            </span>
          ))}
          {(entry.tags || []).length > 3 && (
            <span className="chip bg-black/[0.04] text-[11px] text-ink-mute">+{entry.tags.length - 3}</span>
          )}
        </div>

        <div className="mt-3.5 flex items-center justify-between border-t border-black/[0.06] pt-3">
          <span className="flex items-center gap-1 truncate text-[11px] text-ink-mute">
            <Icon name="pin" size={11} />
            <span className="truncate">{entry.region || entry.subtitle || entry.id}</span>
          </span>
          <div className="flex shrink-0 items-center gap-1">
            <SelectionButton entry={entry} />
            {onCite && (
              <button onClick={() => onCite(entry)} className="btn-quiet btn-xs" title="快速引用">
                <Icon name="copy" size={13} />
              </button>
            )}
            <button onClick={go} className="btn-quiet btn-xs" title="查看详情">
              <Icon name="eye" size={13} />
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}

/** 紧凑横向卡：用于「相关条目 / 精选」这一类横向滚动带 */
export function MiniEntryCard({ entry }) {
  const nav = useNavigate()
  return (
    <button
      onClick={() => nav(`/entry/${entry.id}`)}
      className="group flex w-full items-center gap-3 rounded-xl border border-black/[0.06] bg-white p-2.5 text-left transition-colors hover:border-dai-300 hover:bg-white"
    >
      <div className="h-14 w-16 shrink-0 overflow-hidden rounded-lg bg-paper-sunk">
        <SmartImage src={entry.media?.[0]?.src ? asset(entry.media[0].src) : ''} alt={entry.title} ratio="h-full" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 font-serif text-[13px] font-semibold leading-snug text-ink group-hover:text-dai-700">
          {entry.title}
        </p>
        <p className="mt-1 truncate text-[11px] text-ink-mute">
          {entry.collectionLabel || ''} · {entry.categoryLabel || ''}
        </p>
      </div>
    </button>
  )
}

export default EntryCard
