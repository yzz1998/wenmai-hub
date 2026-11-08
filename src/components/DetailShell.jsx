import { Link, useNavigate } from 'react-router-dom'
import Icon from './Icon'
import { CategoryChip, CollectionBadge } from './UI'
import { COLLECTION_MAP } from '../data/collections'

/**
 * 统一详情骨架 —— 三馆条目共用同一套信息层级：
 *   面包屑 → 徽标 → 标题 → 副题 → 摘要 → 元数据 → 正文/图集 → 来源与引用 → 相邻条目 → 相关条目
 *
 * 合并前：剪纸是弹层（无路由）、畲族是弹层（无路由）、知识素材是独立页面。
 * 合并后：全部走 /entry/:id 一个真实路由，可分享、可回退、可被检索收录。
 */
export default function DetailShell({
  entry,
  metaItems = [],
  children,
  aside,
  prevEntry,
  nextEntry,
  related = [],
  relatedTitle = '相关条目',
  backHref,
  backLabel
}) {
  const nav = useNavigate()
  const c = COLLECTION_MAP[entry.collection] || {}
  const accent = c.accent || {}

  return (
    <article className="animate-seep">
      {/* ====== 头部 ====== */}
      <div className="relative overflow-hidden border-b border-black/[0.06] bg-paper-warm">
        <div className={`absolute inset-0 ${accent.bg || 'bg-dai-50'} opacity-60`} aria-hidden="true" />
        <div className="paper-grain absolute inset-0 opacity-40" aria-hidden="true" />
        <div className="wrap relative py-7">
          <nav className="mb-5 flex flex-wrap items-center gap-1.5 text-xs text-ink-mute" aria-label="面包屑">
            <Link to="/" className="hover:text-dai-700">
              首页
            </Link>
            <span className="opacity-40">/</span>
            <Link to={c.route || '/library'} className="hover:text-dai-700">
              {c.name || '资源库'}
            </Link>
            <span className="opacity-40">/</span>
            <span className="truncate text-ink-soft">{entry.categoryLabel}</span>
            <span className="opacity-40">/</span>
            <span className="truncate text-ink-soft">{entry.title}</span>
          </nav>

          <div className="grid gap-7 lg:grid-cols-[1.55fr_1fr] lg:items-start">
            <div className="min-w-0">
              <div className="mb-3.5 flex flex-wrap items-center gap-2">
                <CollectionBadge collection={entry.collection} solid />
                <CategoryChip collection={entry.collection} category={entry.category} />
                {entry.level && (
                  <span className="chip border border-black/[0.07] bg-white text-ink-soft">
                    <Icon name="award" size={12} />
                    {entry.level}
                  </span>
                )}
                {entry.status === 'draft' && <span className="chip bg-ink/70 text-paper-warm">草稿</span>}
              </div>

              <h1 className="font-serif text-[27px] font-bold leading-[1.28] tracking-tight text-ink sm:text-[34px]">
                {entry.title}
              </h1>
              {entry.subtitle && (
                <p className="mt-2 font-kai text-[15px] tracking-wide text-ink-mute">{entry.subtitle}</p>
              )}

              <p className="mt-4 max-w-2xl text-[15px] leading-[1.9] text-ink-soft">{entry.summary}</p>

              {metaItems.length > 0 && (
                <dl className="mt-6 grid gap-x-6 gap-y-3 text-[13px] sm:grid-cols-2">
                  {metaItems
                    .filter(([, v]) => v !== '' && v != null)
                    .map(([k, v]) => (
                      <div key={k} className="flex gap-2.5">
                        <dt className="w-[68px] shrink-0 text-ink-mute">{k}</dt>
                        <dd className="min-w-0 flex-1 break-words text-ink-soft">{v}</dd>
                      </div>
                    ))}
                </dl>
              )}
            </div>

            {/* 右栏：引用 / 操作 / 来源，桌面端吸顶 */}
            <div className="space-y-3 lg:sticky lg:top-[76px]">{aside}</div>
          </div>
        </div>
      </div>

      {/* ====== 正文 ====== */}
      <div className="wrap py-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
          <div className="min-w-0">{children}</div>

          <aside className="space-y-4 lg:sticky lg:top-[76px]">
            {entry.tags?.length > 0 && (
              <section className="rounded-2xl border border-black/[0.07] bg-white p-4">
                <h3 className="mb-2.5 flex items-center gap-1.5 font-serif text-[13.5px] font-bold text-ink">
                  <Icon name="tag" size={14} />
                  主题标签
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {entry.tags.map((t) => (
                    <Link key={t} to={`/library?q=${encodeURIComponent(t)}`} className="chip-tag text-[11px]">
                      #{t}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <section className="rounded-2xl border border-black/[0.07] bg-white p-4">
              <h3 className="mb-2 flex items-center gap-1.5 font-serif text-[13.5px] font-bold text-ink">
                <Icon name="info" size={14} />
                资料来源
              </h3>
              <p className="text-[12px] leading-[1.8] text-ink-mute">{entry.source || '本馆整理'}</p>
              {entry.sourceUrl && (
                <a
                  href={entry.sourceUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-2 inline-flex items-center gap-1 text-[12px] text-dai-700 hover:underline"
                >
                  查看原始出处
                  <Icon name="external" size={12} />
                </a>
              )}
              {entry.links?.length > 1 && (
                <ul className="mt-2.5 space-y-1.5 border-t border-black/[0.06] pt-2.5">
                  {entry.links.slice(1).map(([label, url]) => (
                    <li key={url}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="flex items-start gap-1 text-[12px] leading-snug text-ink-mute hover:text-dai-700"
                      >
                        <Icon name="link" size={11} className="mt-0.5 shrink-0" />
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-black/[0.07] bg-white p-4">
              <h3 className="mb-2 flex items-center gap-1.5 font-serif text-[13.5px] font-bold text-ink">
                <Icon name="layers" size={14} />
                条目信息
              </h3>
              <dl className="space-y-1.5 text-[12px]">
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-mute">编号</dt>
                  <dd className="font-mono text-ink-soft">{entry.id}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-mute">专题</dt>
                  <dd className="text-ink-soft">{c.short}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-mute">更新</dt>
                  <dd className="text-ink-soft">{entry.updatedAt || '—'}</dd>
                </div>
              </dl>
            </section>
          </aside>
        </div>

        {/* ====== 上一件 / 下一件 ====== */}
        {(prevEntry || nextEntry) && (
          <nav className="mt-10 grid gap-3 border-t border-black/[0.07] pt-6 sm:grid-cols-2" aria-label="同分类相邻条目">
            {prevEntry ? (
              <button
                onClick={() => nav(`/entry/${prevEntry.id}`)}
                className="group flex items-center gap-3 rounded-xl border border-black/[0.07] bg-white p-3 text-left transition-colors hover:border-dai-300 hover:bg-white"
              >
                <Icon name="back" size={16} className="shrink-0 text-ink-mute" />
                <span className="min-w-0">
                  <span className="block text-[11px] text-ink-mute">上一件</span>
                  <span className="line-clamp-1 block font-serif text-[13.5px] font-semibold text-ink group-hover:text-dai-700">
                    {prevEntry.title}
                  </span>
                </span>
              </button>
            ) : (
              <span />
            )}
            {nextEntry && (
              <button
                onClick={() => nav(`/entry/${nextEntry.id}`)}
                className="group flex items-center justify-end gap-3 rounded-xl border border-black/[0.07] bg-white p-3 text-right transition-colors hover:border-dai-300 hover:bg-white"
              >
                <span className="min-w-0">
                  <span className="block text-[11px] text-ink-mute">下一件</span>
                  <span className="line-clamp-1 block font-serif text-[13.5px] font-semibold text-ink group-hover:text-dai-700">
                    {nextEntry.title}
                  </span>
                </span>
                <Icon name="arrow" size={16} className="shrink-0 text-ink-mute" />
              </button>
            )}
          </nav>
        )}

        {/* ====== 相关条目（可跨专题） ====== */}
        {related.length > 0 && (
          <section className="mt-10">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <h2 className="font-serif text-lg font-bold text-ink">{relatedTitle}</h2>
                <p className="mt-1 text-[12px] text-ink-mute">
                  按标签与主题自动关联，可能来自其他专题 —— 这条链路正是三馆合并的价值所在
                </p>
              </div>
              {backHref && (
                <Link to={backHref} className="btn-ghost btn-xs shrink-0">
                  <Icon name="back" size={13} />
                  {backLabel || '返回'}
                </Link>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((r) => (
                <Link
                  key={r.id}
                  to={`/entry/${r.id}`}
                  className="group rounded-xl border border-black/[0.07] bg-white p-3 transition-all hover:-translate-y-0.5 hover:border-dai-300 hover:shadow-card"
                >
                  <CollectionBadge collection={r.collection} className="mb-2" />
                  <p className="line-clamp-2 font-serif text-[13.5px] font-semibold leading-snug text-ink group-hover:text-dai-700">
                    {r.title}
                  </p>
                  <p className="mt-1.5 line-clamp-2 text-[11.5px] leading-relaxed text-ink-mute">{r.summary}</p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </article>
  )
}
