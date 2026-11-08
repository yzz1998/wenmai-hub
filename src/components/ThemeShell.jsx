import Icon from './Icon'
import { COLLECTION_MAP } from '../data/collections'

/**
 * 专题浏览骨架 —— 两个专题共用同一套「题匾 + 左侧目录 + 右侧内容」版式。
 *
 * 合并依据：剪纸馆原本就是左侧固定目录 + 右侧图墙；畲族馆原本是顶部分区横栏。
 * 统一后都采用左侧目录（移动端降级为横向胶囊），因为两馆的分类都在 7~8 个量级，
 * 侧栏能让内容区保持完整的视觉宽度；差异只留在内容区的排布方式（瀑布流 / 等宽网格）。
 */

export function ThemeHero({ collection, stats = [], children }) {
  const c = COLLECTION_MAP[collection]
  return (
    <section className="relative overflow-hidden border-b border-black/[0.06]">
      <div className="paper-grain absolute inset-0" aria-hidden="true" />
      <div className={`absolute inset-0 bg-gradient-to-br ${c.accent.hero} opacity-[0.07]`} aria-hidden="true" />
      <div className="wrap relative py-10 sm:py-14">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-ink-mute">
              <span className={`h-px w-8 ${c.accent.bgSolid}`} />
              专题馆
            </p>
            <h1 className="plaque-title text-[30px] sm:text-[40px]">{c.name}</h1>
            <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-soft">
              <span className="font-serif tracking-[0.14em] text-ink-mute">{c.en}</span>
              <span className="text-ink-mute/40">|</span>
              <span>{c.tagline}</span>
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {stats.map((s) => (
                <span
                  key={s.label}
                  className="inline-flex items-baseline gap-1.5 rounded-lg border border-black/[0.07] bg-white/70 px-2.5 py-1.5"
                >
                  <b className={`font-serif text-[15px] ${c.accent.text}`}>{s.value}</b>
                  <span className="text-[11px] text-ink-mute">{s.label}</span>
                </span>
              ))}
            </div>
          </div>
          <div className="hidden shrink-0 sm:block">
            <span
              className={`seal h-14 w-14 text-[15px] tracking-[0.06em]`}
              aria-hidden="true"
            >
              文脉
              <span className="mt-0.5 text-[9px] font-normal opacity-80">鉴藏</span>
            </span>
          </div>
        </div>
        {children}
      </div>
    </section>
  )
}

/**
 * 左侧目录。
 * @param {{categories:Array, active:string, onChange:Function, total:number, allLabel?:string, intro?:string}} props
 */
export function ThemeSidebar({ categories, active, onChange, total, allLabel = '全部', intro, accent, label = '目录' }) {
  const countOf = (id) => categories.find((c) => c.id === id)?.count || 0
  return (
    <aside className="min-w-0 lg:sticky lg:top-[76px] lg:self-start">
      <div className="mb-3 flex items-center gap-2 px-1">
        <span className={`h-4 w-1 rounded-full ${accent?.bgSolid || 'bg-dai-700'}`} />
        <span className="text-[11px] font-semibold tracking-[0.16em] text-ink-mute">{label}</span>
      </div>

      <nav
        className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-2 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0 lg:pb-0"
        aria-label="分类目录"
      >
        <button
          onClick={() => onChange('')}
          className={`flex shrink-0 items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-[13px] font-medium transition-all lg:w-full ${
            active === ''
              ? `${accent?.bg || 'bg-dai-50'} ${accent?.text || 'text-dai-700'} border-transparent`
              : 'border-transparent text-ink-soft hover:bg-black/[0.035]'
          }`}
        >
          <span className="flex items-center gap-2">
            <Icon name="grid" size={14} />
            {allLabel}
          </span>
          <span className="text-[11px] tabular-nums opacity-60">{total}</span>
        </button>

        {categories.map((cat) => {
          const on = active === cat.id
          return (
            <button
              key={cat.id}
              onClick={() => onChange(cat.id)}
              className={`group relative flex shrink-0 items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-[13px] transition-all lg:w-full ${
                on
                  ? `${accent?.bg || 'bg-dai-50'} ${accent?.text || 'text-dai-700'} border-transparent font-medium`
                  : 'border-transparent text-ink-soft hover:bg-black/[0.035]'
              }`}
              title={cat.desc || cat.name}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    on ? accent?.dot || 'bg-dai-500' : 'bg-black/15 group-hover:bg-black/25'
                  }`}
                />
                <span className="truncate">{cat.name}</span>
              </span>
              <span className="shrink-0 text-[11px] tabular-nums opacity-60">{cat.count}</span>
            </button>
          )
        })}
      </nav>

      {intro && (
        <div className="mt-4 hidden rounded-xl border border-black/[0.06] bg-white/60 p-3 lg:block">
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-ink-mute">
            <Icon name="info" size={12} />
            分类释义
          </p>
          <p className="text-[12px] leading-[1.8] text-ink-mute">{intro}</p>
        </div>
      )}
    </aside>
  )
}

/** 内容区头部：当前分类 + 计数 + 右侧工具位 */
export function ThemeContentHead({ title, count, desc, right }) {
  return (
    <div className="mb-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl font-bold text-ink sm:text-2xl">{title}</h2>
          <p className="mt-1 text-[12.5px] text-ink-mute">
            共 <b className="font-semibold text-ink-soft">{count}</b> 条
            {desc ? ` · ${desc}` : ''}
          </p>
        </div>
        {right}
      </div>
    </div>
  )
}
