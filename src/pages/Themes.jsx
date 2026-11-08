import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../components/Icon'
import { SmartImage } from '../components/Media'
import { SectionTitle } from '../components/UI'
import { useStore } from '../hooks/useStore'
import { GALLERY_COLLECTIONS } from '../data/collections'
import { pickCoverEntries } from '../data/cover-selection'
import { chapterOf } from '../data'
import { categoryList } from '../data/taxonomy'
import coversData from '../data/covers.json'
import { asset } from '../lib/assets'

/**
 * 专题馆总览 —— 五个馆的入口。
 *
 * 为什么资源库之外还要保留专题馆：
 * 资源库回答「有没有这条内容」，专题馆回答「这批内容是怎么被组织起来的」。
 * 剪纸的八类题材编次、畲族的七个展区动线、闽东知识库的五类主题、课程两章的
 * 「概念—问题—出路」递进，本身就是策展成果，不能在合并中丢掉。
 *
 * 五个馆排成两行，但彼此界限清楚：课程两馆各收一章，乡土三馆各收一馆内容，
 * 互不引用、互不混排，只在详情页的「跨馆相关」里显式互通。
 */

const COVERS = coversData.items || {}

/**
 * 课程馆封面：真实照片 + 章号与节次。
 *
 * 早前这一块是纯渐变加 SVG 线稿（等高线 / 街区网格），好处是与乡土馆区分明显，
 * 坏处是「五个馆里只有两个没有照片」，翻到专题馆首页会以为这里没配图。
 * 现在改成整幅照片压深色，把原来的章号、章名、节次原样留在上面：
 * 照片说明「这一章在讲什么现场」，文字说明「这一章按什么顺序讲」。
 */
function ChapterCover({ chapter, meta }) {
  const rec = COVERS[meta.coverId]
  const src = rec?.cover ? asset(rec.cover) : ''
  return (
    <div className="relative h-full w-full overflow-hidden bg-ink">
      {src && (
        <img
          src={src}
          alt={rec?.note || `${meta.name}封面`}
          loading="eager"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-[900ms] group-hover:scale-[1.04]"
        />
      )}
      {/* 双压暗：自下而上保证章名可读，自左而右保证书名可读。
          注意档位只能用 Tailwind 的有效值（5 / 10 / 20 … 95），写成 /94 这类
          不存在的档位会被整条类名丢掉，渐变直接失效、白字全糊在亮天上。 */}
      <div className="absolute inset-0 bg-gradient-to-t from-ink/95 via-ink/55 to-ink/15" />
      <div className="absolute inset-0 bg-gradient-to-r from-ink/40 via-ink/5 to-transparent" />
      <span
        className="absolute -right-1 -top-7 font-kai text-[112px] font-bold leading-none text-white/[0.14]"
        aria-hidden="true"
      >
        {String(chapter?.chapter.no || '').replace(/^第/, '').replace(/章$/, '')}
      </span>
      <div className="relative flex h-full flex-col justify-between p-5">
        <p className="flex items-center gap-1.5 text-[10px] tracking-[0.18em] text-white/80">
          <Icon name={meta.icon} size={11} />
          {chapter?.chapter.textbook}
        </p>
        <div>
          <p className="text-[10px] tracking-[0.16em] text-white/55">
            {chapter?.chapter.no} · {chapter?.chapter.en}
          </p>
          <p className="mt-1 font-kai text-[19px] font-bold leading-snug text-white drop-shadow-sm sm:text-[20px]">
            {chapter?.chapter.title}
          </p>
          <ul className="mt-2 space-y-0.5">
            {(chapter?.sections || []).map((s) => (
              <li key={s.id} className="flex items-baseline gap-1.5 text-[10.5px] text-white/65">
                <span className="tabular-nums opacity-70">{s.no}</span>
                <span className="truncate">{s.name}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {rec?.source && (
        <span
          className="absolute bottom-2 right-3 hidden text-[9px] leading-none tracking-wide text-white/45 lg:block"
          title={rec.credit || ''}
        >
          图源 {rec.source}
        </span>
      )}
    </div>
  )
}

export default function Themes() {
  const { entries } = useStore()

  const boards = useMemo(() => {
    return {
      papercut: pickCoverEntries('papercut', entries),
      // 注意：这里必须传「条目」而不是「媒体对象」—— 封面拼贴统一读 e.media[0].src，
      // 早前误传 media 对象，导致畲族卡的四个格子全部落到无图占位。
      she: pickCoverEntries('she', entries),
      mindong: pickCoverEntries('mindong', entries)
    }
  }, [entries])

  const cards = GALLERY_COLLECTIONS.map((c) => ({
    ...c,
    images: boards[c.id] || [],
    chapterData: c.kind === 'course' ? chapterOf(c.id) : null,
    count: entries.filter((e) => e.collection === c.id).length
  }))

  return (
    <div className="animate-seep">
      <section className="relative overflow-hidden border-b border-black/[0.06]">
        <div className="paper-grain absolute inset-0" aria-hidden="true" />
        <div className="wrap relative py-10 sm:py-12">
          <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-ink-mute">
            <span className="h-px w-8 bg-dai-700" />
            THEMATIC GALLERIES
          </p>
          <h1 className="plaque-title text-[34px] sm:text-[42px]">专题馆</h1>
          <p className="mt-3 max-w-2xl text-[14px] leading-[1.9] text-ink-soft">
            五个专题馆并列：课程两馆（《人类与社会》第二章、第五章）与乡土三馆（剪纸、畲族、闽东知识库）。
            它们不是「资源库的分类页」，而是五场已经策好的展 —— 目录、导语、编次都是内容的一部分。
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {[
              { k: '课程专题', n: cards.filter((c) => c.kind === 'course').length, icon: 'book' },
              { k: '乡土专题', n: cards.filter((c) => c.kind !== 'course').length, icon: 'mountain' },
              { k: '五个馆各自独立成篇，不混排', icon: 'layers' }
            ].map((x) => (
              <span key={x.k} className="chip border border-black/[0.07] bg-white/70 text-[11px] text-ink-mute">
                <Icon name={x.icon} size={11} />
                {x.k}
                {x.n != null && <b className="ml-0.5 font-serif text-[12px] text-ink-soft">{x.n}</b>}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="wrap py-10">
        {/* 6 栅格：课程两馆各占一半，乡土三馆各占三分之一 —— 一行两馆 + 一行三馆 */}
        <div className="grid gap-5 lg:grid-cols-6">
          {cards.map((c, i) => (
            <article
              key={c.id}
              className={`group flex animate-rise flex-col overflow-hidden rounded-2xl border border-black/[0.07] bg-white/80 shadow-card transition-all hover:-translate-y-1 hover:shadow-lift ${
                c.kind === 'course' ? 'lg:col-span-3' : 'lg:col-span-2'
              }`}
              style={{ animationDelay: `${i * 70}ms` }}
            >
              {/* 封面：课程馆用本章的一张实景整幅；乡土馆用馆内图版拼贴。
                  拼贴栅格按素材性质分开：剪纸、畲族是「同一批藏品横排」，四列等分像展柜；
                  闽东是「一幅主图 + 三条索引」，主图占 3×3 格、右侧三条各占一格。
                  为什么只有闽东改版式：它的条目跨五类主题，四格里塞不下，而 377px 宽的卡片
                  切成四条竖条时每格只剩 90px，风景会糊成色块；给一幅整图反而立得住。 */}
              <Link to={c.route} className="relative block">
                <div
                  className={`grid aspect-[16/9] gap-0.5 bg-paper-sunk ${
                    c.id === 'mindong' ? 'grid-cols-4 grid-rows-3' : 'grid-cols-4'
                  }`}
                >
                  {c.chapterData ? (
                    <div className="col-span-4">
                      <ChapterCover collection={c.id} chapter={c.chapterData} meta={c} />
                    </div>
                  ) : c.images.length > 0 ? (
                    c.images.slice(0, 4).map((e, k) => (
                      <div
                        key={`${e.id}-${k}`}
                        className={`relative overflow-hidden ${
                          c.id === 'mindong' && k === 0 ? 'col-span-3 row-span-3' : ''
                        }`}
                        title={COVERS[e.id]?.source ? `${e.title} · 图源 ${COVERS[e.id].source}` : e.title}
                      >
                        <SmartImage
                          src={asset(e.media?.[0]?.src || '')}
                          alt={e.title}
                          ratio="h-full"
                          imgClassName="transition-transform duration-700 group-hover:scale-[1.06]"
                        />
                      </div>
                    ))
                  ) : null}
                </div>
                {!c.chapterData && <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-transparent" />}
                {!c.chapterData && (
                  <div className="absolute inset-x-0 bottom-0 p-5">
                    <p className="text-[10px] tracking-[0.2em] text-paper-warm/60">{c.en}</p>
                    <span className="mt-1.5 block font-kai text-[22px] font-bold tracking-wide text-paper-warm">{c.name}</span>
                  </div>
                )}
              </Link>

              <div className="flex flex-1 flex-col p-5">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <h2 className="font-serif text-[18px] font-bold text-ink">{c.name}</h2>
                  {c.chapterData && (
                    <span className={`chip ${c.accent.bg} ${c.accent.text} text-[10px]`}>
                      {c.chapter} · {c.chapterTitle}
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-mute">{c.tagline}</p>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(c.facts || []).map((f) => (
                    <span key={f} className={`chip ${c.accent.bg} ${c.accent.text}`}>
                      {f}
                    </span>
                  ))}
                </div>

                <ul className="mt-4 space-y-1.5">
                  {(c.points || []).map((p) => (
                    <li key={p} className="flex items-start gap-1.5 text-[12.5px] text-ink-soft">
                      <Icon name="check" size={13} className={`mt-0.5 shrink-0 ${c.accent.text}`} />
                      {p}
                    </li>
                  ))}
                </ul>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {categoryList(c.id).map((cat) => (
                    <Link
                      key={cat.id}
                      to={`${c.route}?cat=${encodeURIComponent(cat.id)}`}
                      className="chip bg-black/[0.04] text-[11px] text-ink-mute transition-colors hover:bg-black/[0.08] hover:text-ink"
                    >
                      {cat.name}
                      <span className="ml-0.5 opacity-50">
                        {entries.filter((e) => e.collection === c.id && e.category === cat.id).length}
                      </span>
                    </Link>
                  ))}
                </div>

                <Link to={c.route} className={`mt-auto pt-5 inline-flex items-center gap-1.5 text-[13.5px] font-medium ${c.accent.text} hover:underline`}>
                  <Icon name={c.icon} size={15} />
                  进入{c.name}
                  <span className="text-[11px] text-ink-mute">（{c.count} {c.unit}）</span>
                  <Icon name="arrow" size={14} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="wrap pb-12">
        <div className="rounded-2xl border border-black/[0.07] bg-white/60 p-5 sm:p-6">
          <SectionTitle
            eyebrow="WHY FIVE HALLS"
            title="五个馆为什么这样分工"
            sub="合并时最需要克制的地方：不要把「能搜到」当成「已经组织好」。"
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                t: '课程两馆 = 教材编次',
                d: '第二章讲「概念 → 问题 → 出路」，第五章讲「空间 → 产业 → 动力」。节次顺序本身就是讲课顺序。'
              },
              {
                t: '剪纸馆 = 图录编次',
                d: '按八类题材编次，上下两册图录依原书页码著录，一图一档，可直接引作插图出处。'
              },
              {
                t: '畲族馆 = 展区动线',
                d: '七个展区按族群记忆的顺序走动线，三十个展项各带一册实景相册。'
              },
              {
                t: '闽东馆 = 五类素材',
                d: '节庆、曲艺、人物、技艺、名胜五类平铺，每类有释义；可增删改，随教学需要长出新条目。'
              },
              {
                t: '资源库 = 索引',
                d: '跨馆、按字段匹配、可叠加分类与标签。目标是「三秒之内确认有没有」。'
              },
              {
                t: '详情页 = 唯一出口',
                d: '所有路径最终都落到 /entry/:id，同一份内容、同一套引用与图集，不会出现两个版本。'
              }
            ].map((x) => (
              <div key={x.t} className="rounded-xl border border-black/[0.06] bg-paper/50 p-4">
                <p className="font-serif text-[13.5px] font-bold text-ink">{x.t}</p>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-mute">{x.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
