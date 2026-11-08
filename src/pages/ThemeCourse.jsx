import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Icon from '../components/Icon'
import { EntryCard } from '../components/EntryCard'
import { ThemeContentHead, ThemeHero, ThemeSidebar } from '../components/ThemeShell'
import { Empty } from '../components/UI'
import { useStore } from '../hooks/useStore'
import { chapterOf } from '../data'
import { COLLECTION_MAP, COURSE_COLLECTIONS } from '../data/collections'
import { categoryList } from '../data/taxonomy'

const PAGE = 24

/**
 * 课程章节专题馆 —— 一个组件驱动两个馆（第二章 / 第五章）。
 *
 * 为什么做成「专题馆」而不是资源库里的库：
 * 教材的章本身就有编次与叙事推进（概念 → 问题 → 出路；空间 → 产业 → 动力），
 * 这正是专题馆要保留的东西 —— 顺着读下去能理解，而不是只回答「有没有这条」。
 *
 * 两馆互不混杂由数据保证：本页只从 useStore 里取 collection === 本章 的条目，
 * 分类只取本章的三节（categoryList(collection)），跨馆对比放在页尾的显式链接里。
 */
export default function ThemeCourse({ collection }) {
  const { entries } = useStore()
  const [params, setParams] = useSearchParams()
  const cat = params.get('cat') || ''
  const [visible, setVisible] = useState(PAGE)

  const meta = COLLECTION_MAP[collection]
  const chapter = chapterOf(collection)
  const accent = meta.accent

  const all = useMemo(() => entries.filter((e) => e.collection === collection), [entries, collection])
  const sections = useMemo(
    () => categoryList(collection).map((s) => ({ ...s, count: all.filter((e) => e.category === s.id).length })),
    [all, collection]
  )

  const list = useMemo(() => (cat ? all.filter((e) => e.category === cat) : all), [all, cat])
  const activeSection = sections.find((s) => s.id === cat)

  useEffect(() => {
    setVisible(PAGE)
  }, [cat])

  /** 按节分组：未选节时三段陈列，选了节就平铺 */
  const groups = useMemo(() => {
    if (cat) return [{ section: activeSection, items: list }]
    return sections.map((s) => ({ section: s, items: all.filter((e) => e.category === s.id) }))
  }, [cat, sections, all, list, activeSection])

  const setCat = (id) => {
    const next = new URLSearchParams(params)
    if (id) next.set('cat', id)
    else next.delete('cat')
    setParams(next, { replace: true })
  }

  const other = COURSE_COLLECTIONS.find((c) => c.id !== collection)
  const shown = list.slice(0, visible)

  if (!chapter) {
    return (
      <div className="wrap py-20">
        <Empty title="未找到该章节" desc="章节数据尚未载入，请回到专题馆总览。" iconName="book" />
      </div>
    )
  }

  return (
    <div className="animate-seep">
      <ThemeHero
        collection={collection}
        stats={[
          { label: '条要点', value: all.length },
          { label: '节', value: sections.length },
          { label: '教材', value: chapter.chapter.no }
        ]}
      >
        <div className="mt-6 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
          {/* 章名与导语：馆名是「馆」，这里才是教材里的那一章 */}
          <div className="rounded-2xl border border-black/[0.07] bg-white/70 p-4 sm:p-5">
            <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-mute">
              <span className={`chip ${accent.bg} ${accent.text} text-[10px]`}>{chapter.chapter.no}</span>
              <span className="font-serif text-[13.5px] font-bold normal-case tracking-normal text-ink">
                {chapter.chapter.title}
              </span>
              <span className="text-[10px] tracking-[0.18em] text-ink-mute/70">{chapter.chapter.en}</span>
            </p>
            <p className="mt-3 text-[13px] leading-[1.9] text-ink-soft">{chapter.chapter.intro}</p>
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-ink-mute">
              <Icon name="book" size={12} />
              依据 {chapter.chapter.textbook} {chapter.chapter.no}整理；具体表述与页码以教材正文为准
            </p>
          </div>

          {/* 学习目标：让「读这一章要拿到什么」先立起来 */}
          <div className="rounded-2xl border border-black/[0.07] bg-paper/60 p-4 sm:p-5">
            <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.14em] text-ink-mute">
              <Icon name="compass" size={12} />
              读完之后应该能
            </p>
            <ul className="space-y-2">
              {(chapter.chapter.goals || []).map((g, i) => (
                <li key={g} className="flex items-start gap-2 text-[12.5px] leading-[1.75] text-ink-soft">
                  <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded text-[10px] font-bold text-white ${accent.bgSolid}`}>
                    {i + 1}
                  </span>
                  {g}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </ThemeHero>

      <div className="wrap grid gap-8 py-8 lg:grid-cols-[248px_minmax(0,1fr)]">
        <ThemeSidebar
          categories={sections}
          active={cat}
          onChange={setCat}
          total={all.length}
          allLabel="全部要点"
          accent={accent}
          label="本章各节"
          intro={activeSection?.intro}
        />

        <main className="min-w-0">
          <ThemeContentHead
            title={activeSection ? activeSection.name : '全部要点'}
            count={list.length}
            desc={
              activeSection
                ? `${activeSection.no} · 共 ${activeSection.count} 条要点`
                : '按教材的节次顺序陈列，三节之间是递进关系'
            }
            right={
              <span className="hidden items-center gap-1.5 rounded-lg border border-black/[0.07] bg-white/70 px-2.5 py-1.5 text-[11px] text-ink-mute sm:inline-flex">
                <Icon name="layers" size={12} />
                节 → 要点 两级编次
              </span>
            }
          />

          {activeSection?.intro && (
            <div className={`mb-5 rounded-2xl border p-4 lg:hidden ${accent.border} ${accent.bg}`}>
              <p className={`mb-1 flex items-center gap-1.5 text-[11px] font-semibold ${accent.text}`}>
                <Icon name="info" size={12} />
                {activeSection.name} · 本节导读
              </p>
              <p className="text-[12.5px] leading-[1.85] text-ink-soft">{activeSection.intro}</p>
            </div>
          )}

          {list.length === 0 ? (
            <Empty title="本节暂无要点" iconName="book" desc="换一个节，或回到全部要点。" />
          ) : (
            <div className="space-y-10">
              {groups.map(({ section, items }, gi) => (
                <section key={section?.id || gi} id={section?.id}>
                  {/* 分节头：编号 + 节名 + 节导读，让分组不只是「一堵墙」 */}
                  <div className="mb-4 flex items-start gap-3">
                    <span
                      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-serif text-[13px] font-bold text-white ${accent.bgSolid}`}
                      aria-hidden="true"
                    >
                      {section?.no?.replace('第', '').replace('节', '') || gi + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="flex flex-wrap items-baseline gap-x-2 font-serif text-[17px] font-bold text-ink">
                        {section?.name}
                        <span className="text-[11px] font-normal tabular-nums text-ink-mute">{items.length} 条</span>
                      </h3>
                      {section?.intro && (
                        <p className="mt-1 max-w-3xl text-[12.5px] leading-[1.85] text-ink-mute">{section.intro}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {items.slice(0, cat ? visible : PAGE).map((e, i) => (
                      <EntryCard key={e.id} entry={e} index={i} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          {cat && visible < list.length && (
            <div className="mt-7 flex flex-col items-center gap-2">
              <button onClick={() => setVisible((v) => v + PAGE)} className="btn-ghost">
                <Icon name="chevron" size={15} />
                继续加载（还有 {list.length - visible} 条）
              </button>
              <p className="text-[11px] text-ink-mute/70">
                已显示 {shown.length} / {list.length}
              </p>
            </div>
          )}

          {/* 馆尾：教材依据 + 与另一馆的显式区分 */}
          <div className="mt-10 grid gap-3 rounded-2xl border border-black/[0.07] bg-white/60 p-4 sm:p-5 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <h2 className="mb-2 flex items-center gap-1.5 font-serif text-[13.5px] font-bold text-ink">
                <Icon name="info" size={13} />
                关于本馆的编次
              </h2>
              <p className="text-[12.5px] leading-[1.9] text-ink-mute">
                本馆只收{chapter.chapter.no}「{chapter.chapter.title}」一节之内的内容，
                共 {sections.length} 节 {all.length} 条要点，按教材节次排列，不与其他章节混排。
                每一条都对应一个可讲、可问、可考的知识点：标题是知识点，正文是四点左右的释读，
                文末给出教材位置与相关概念，可直接加入教学选辑。
              </p>
            </div>
            {other && (
              <Link
                to={other.route}
                className="group flex items-center justify-between gap-3 rounded-xl border border-black/[0.06] bg-paper/50 p-3 transition-colors hover:border-black/10 hover:bg-white"
              >
                <span className="min-w-0">
                  <span className="mb-0.5 block text-[10px] tracking-[0.16em] text-ink-mute">另一个课程专题馆</span>
                  <span className="block font-serif text-[13.5px] font-semibold text-ink group-hover:text-ink-soft">
                    {other.chapter} · {other.name}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-ink-mute">{other.chapterTitle}</span>
                </span>
                <Icon name="arrow" size={15} className="shrink-0 text-ink-mute" />
              </Link>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
