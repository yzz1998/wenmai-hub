import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Icon from '../components/Icon'
import SearchBox from '../components/SearchBox'
import { EntryCard } from '../components/EntryCard'
import { CollectionBadge, Empty, SectionTitle, Segmented } from '../components/UI'
import { useStore } from '../hooks/useStore'
import { COLLECTIONS, GALLERY_COLLECTIONS } from '../data/collections'
import { categoryList } from '../data/taxonomy'
import { LIBRARY_SORTS, collectTags, countBy, searchEntries } from '../lib/search'

const PAGE_SIZE = 24

/**
 * 资源库 —— 三馆统一检索与浏览。
 *
 * 这是合并后「新增」的页面（原三个项目都没有跨馆检索能力）：
 * 一个输入框、一个专题切换、一个分类下拉、一套标签，作用于全部 309 条内容。
 * 各专题自己的策展浏览仍然保留在「专题馆」里 —— 检索路径与策展路径分开，互不替代。
 */
export default function Library() {
  const { entries } = useStore()
  const [params, setParams] = useSearchParams()

  const q = params.get('q') || ''
  const collection = params.get('c') || ''
  const category = params.get('cat') || ''
  const activeTags = (params.get('tag') || '').split(',').filter(Boolean)
  const sort = params.get('sort') || 'relevance'
  const view = params.get('view') || 'grid'

  const [visible, setVisible] = useState(PAGE_SIZE)
  const focus = params.get('focus') === '1'

  const setParam = (key, value) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'focus') next.delete('focus')
    setParams(next, { replace: true })
  }

  const setCollection = (id) => {
    const next = new URLSearchParams(params)
    if (id) next.set('c', id)
    else next.delete('c')
    next.delete('cat')
    next.delete('focus')
    setParams(next, { replace: true })
  }

  const toggleTag = (tag) => {
    const next = new Set(activeTags)
    if (next.has(tag)) next.delete(tag)
    else next.add(tag)
    setParam('tag', [...next].join(','))
  }

  const collectionOptions = useMemo(
    () => [
      { id: '', name: '全部专题', count: entries.length },
      ...COLLECTIONS.map((c) => ({ id: c.id, name: c.short, count: entries.filter((e) => e.collection === c.id).length }))
    ],
    [entries]
  )

  /** 分类下拉：限定专题时只列该专题分类，否则按专题分组 */
  const categoryGroups = useMemo(() => {
    const ids = collection ? [collection] : COLLECTIONS.map((c) => c.id)
    return ids.map((id) => ({
      collection: id,
      name: COLLECTIONS.find((c) => c.id === id)?.short,
      items: categoryList(id).map((cat) => ({
        ...cat,
        count: entries.filter((e) => e.collection === id && e.category === cat.id).length
      }))
    }))
  }, [collection, entries])

  const tagPool = useMemo(() => {
    const scoped = collection ? entries.filter((e) => e.collection === collection) : entries
    return collectTags(scoped).slice(0, 16)
  }, [entries, collection])

  const results = useMemo(
    () => searchEntries(entries, { q, collection, category, tags: activeTags, sort }),
    [entries, q, collection, category, activeTags, sort]
  )

  // 筛选条件变化时回到首屏
  useEffect(() => {
    setVisible(PAGE_SIZE)
  }, [q, collection, category, activeTags.join(','), sort])

  const shown = results.slice(0, visible)
  const hasFilter = q || collection || category || activeTags.length

  return (
    <div className="animate-seep">
      {/* ===== 检索头 ===== */}
      <section className="relative overflow-hidden border-b border-black/[0.06] bg-paper-warm">
        <div className="paper-grain absolute inset-0 opacity-60" aria-hidden="true" />
        <div className="wrap relative py-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-ink-mute">
                <span className="h-px w-7 bg-dai-700" />
                RESOURCE LIBRARY
              </p>
              <h1 className="font-serif text-[26px] font-bold tracking-tight text-ink sm:text-[30px]">资源库</h1>
              <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-ink-mute">
                五个专题的全部条目在同一处检索：课程两章与乡土三支共用一套分词与字段加权，关键词、标签、章节、分类、正文一起匹配，命中字段会标注在卡片上。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Segmented options={collectionOptions} value={collection} onChange={setCollection} size="xs" />
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto]">
            <SearchBox
              value={q}
              onChange={(v) => setParam('q', v)}
              autoFocus={focus}
              placeholder="搜索标题、标签、地域、正文……"
            />
            <div className="flex items-center gap-2">
              <select
                aria-label="分类筛选"
                className="select-field h-[42px] py-0 text-[13px]"
                value={category}
                onChange={(e) => setParam('cat', e.target.value)}
              >
                <option value="">全部分类</option>
                {categoryGroups.map((g) => (
                  <optgroup key={g.collection} label={g.name}>
                    {g.items.map((c) => (
                      <option key={`${g.collection}-${c.id}`} value={c.id}>
                        {c.name}（{c.count}）
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <select
                aria-label="排序方式"
                className="select-field h-[42px] py-0 text-[13px]"
                value={sort}
                onChange={(e) => setParam('sort', e.target.value)}
              >
                {LIBRARY_SORTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 标签池 */}
          <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 flex items-center gap-1 text-[11px] text-ink-mute">
              <Icon name="tag" size={12} />
              标签
            </span>
            {tagPool.map((t) => (
              <button
                key={t.name}
                onClick={() => toggleTag(t.name)}
                className={activeTags.includes(t.name) ? 'chip-tag-on text-[11px]' : 'chip-tag text-[11px]'}
              >
                {t.name}
                <span className="ml-0.5 opacity-50">{t.count}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ===== 结果 ===== */}
      <section className="wrap py-7">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-mute">
            <span>
              共 <b className="font-serif text-[15px] font-bold text-ink">{results.length}</b> 条
              {q && (
                <>
                  ，关键词 <b className="text-ink-soft">「{q}」</b>
                </>
              )}
            </span>
            {collection && <CollectionBadge collection={collection} />}
            {category && (
              <button
                onClick={() => setParam('cat', '')}
                className="chip bg-black/[0.05] text-ink-mute transition-colors hover:text-zhu-500"
                title="清除分类"
              >
                {categoryGroups.flatMap((g) => g.items).find((c) => c.id === category)?.name || category}
                <Icon name="close" size={11} />
              </button>
            )}
            {activeTags.map((t) => (
              <button
                key={t}
                onClick={() => toggleTag(t)}
                className="chip bg-dai-50 text-dai-700 transition-colors hover:bg-dai-100"
                title="移除标签"
              >
                #{t}
                <Icon name="close" size={11} />
              </button>
            ))}
            {hasFilter && (
              <button
                onClick={() => setParams(new URLSearchParams(), { replace: true })}
                className="text-[12px] text-ink-mute underline decoration-dotted hover:text-zhu-500"
              >
                清除全部
              </button>
            )}
          </div>

          <div className="flex items-center gap-1">
            <span className="mr-1 hidden text-[11px] text-ink-mute sm:inline">视图</span>
            <button
              onClick={() => setParam('view', 'grid')}
              className={`rounded-lg p-1.5 transition-colors ${view === 'grid' ? 'bg-dai-700 text-paper-warm' : 'text-ink-mute hover:bg-black/[0.05]'}`}
              title="网格视图"
              aria-label="网格视图"
            >
              <Icon name="grid" size={15} />
            </button>
            <button
              onClick={() => setParam('view', 'list')}
              className={`rounded-lg p-1.5 transition-colors ${view === 'list' ? 'bg-dai-700 text-paper-warm' : 'text-ink-mute hover:bg-black/[0.05]'}`}
              title="列表视图"
              aria-label="列表视图"
            >
              <Icon name="list" size={15} />
            </button>
          </div>
        </div>

        {results.length === 0 ? (
          <Empty
            title="没有匹配的条目"
            desc="试试更短的关键词，或去掉分类与标签限制。跨馆检索对课程要点的正文、剪纸的纹样名、畲族的展项标题、知识库的素材都生效。"
            action={
              <button onClick={() => setParams(new URLSearchParams(), { replace: true })} className="btn-primary">
                清除筛选条件
              </button>
            }
          />
        ) : view === 'list' ? (
          <div className="space-y-3">
            {shown.map((e) => (
              <EntryCard key={e.id} entry={e} variant="row" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {shown.map((e, i) => (
              <EntryCard key={e.id} entry={e} index={i} />
            ))}
          </div>
        )}

        {visible < results.length && (
          <div className="mt-8 flex flex-col items-center gap-2">
            <button onClick={() => setVisible((v) => v + PAGE_SIZE)} className="btn-ghost">
              <Icon name="chevron" size={15} />
              继续加载（还有 {results.length - visible} 条）
            </button>
            <p className="text-[11px] text-ink-mute/70">
              已显示 {shown.length} / {results.length}
            </p>
          </div>
        )}
      </section>

      {/* ===== 引导去专题馆 ===== */}
      {!hasFilter && (
        <section className="wrap pb-4">
          <div className="rounded-2xl border border-black/[0.07] bg-white p-5">
            <SectionTitle
              eyebrow="ALSO TRY"
              title="按策展路径浏览"
              sub="检索适合「我知道要找什么」；如果你只是想看，专题馆里的五个馆各自保留了教材节次或原馆的编次与叙事。"
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {GALLERY_COLLECTIONS.map((c) => (
                <Link
                  key={c.id}
                  to={c.route}
                  className="group flex min-w-0 items-center justify-between gap-3 rounded-xl border border-black/[0.06] bg-paper-sunk p-3 transition-colors hover:border-dai-300 hover:bg-white"
                >
                  <span className="min-w-0">
                    <span className="block font-serif text-[13.5px] font-semibold text-ink group-hover:text-dai-700">
                      {c.name}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-ink-mute">{c.tagline}</span>
                  </span>
                  <Icon name="arrow" size={15} className="shrink-0 text-ink-mute" />
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
