import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import SearchBox from '../components/SearchBox'
import { EntryCard } from '../components/EntryCard'
import { SmartImage } from '../components/Media'
import { SectionTitle } from '../components/UI'
import { useStore } from '../hooks/useStore'
import { COURSE_COLLECTIONS, LOCAL_COLLECTIONS } from '../data/collections'
import { chapterOf, computeStats, relatedEntries } from '../data'
import { pickCoverEntries } from '../data/cover-selection'
import { SITE } from '../data/site'
import { collectTags } from '../lib/search'
import { asset } from '../lib/assets'

/**
 * 门面图从 cover-selection 统一取：第 0 张是主图，其余三张做角标索引。
 * 早前这里写死 M-SCENIC-001（太姥山云海），与专题馆那张新拼贴不是同一组图，
 * 首页和专题馆会同时出现两个版本的闽东封面，改一处漏一处。
 */

/** 门面卡上的名称与入口文案：比全名短，比 short 更像入口 */
const COVER_META = {
  papercut: { name: '剪纸纹样馆', cta: '进入纹样馆', facts: '8 类纹样' },
  she: { name: '畲族民俗馆', cta: '进入民俗馆', facts: '7 个展区' },
  mindong: { name: '闽东知识库', cta: '进入知识库', facts: '5 类主题' }
}

const catLink = (route, id) => `${route}${route.includes('?') ? '&' : '?'}cat=${encodeURIComponent(id)}`

const SUGGESTIONS = ['可持续发展', '城市化', '城乡二元结构', '农业文明', '凤凰装', '木拱廊桥']

const CAPABILITIES = [
  {
    icon: 'search',
    title: '一处检索，五个专题同搜',
    desc: '课程两章与三支乡土内容共用一套分词与字段加权，关键词、标签、章节、正文一起匹配，并回显命中字段。'
  },
  {
    icon: 'layers',
    title: '馆—节—要点三级编次',
    desc: '课程馆按教材的章、节编排：进馆先看到章节导语与三节的结构，条目按节分组陈列，不会混成一堆。'
  },
  {
    icon: 'quote',
    title: '引用格式按馆切换',
    desc: '课程要点按「章 + 节 + 要点位置」引，图录图版按页码引，展项按展馆条目引，知识素材按 GB/T 7714 引。'
  },
  {
    icon: 'basket',
    title: '跨馆教学选辑',
    desc: '把第五章的「S 形曲线」、剪纸的团花纹样、畲族的凤凰装放进同一选辑，一键导出 Markdown 备课包。'
  }
]

export default function Home() {
  const nav = useNavigate()
  const { entries } = useStore()
  const [q, setQ] = useState('')

  const stats = useMemo(() => computeStats(entries), [entries])
  const tags = useMemo(() => collectTags(entries).slice(0, 16), [entries])

  /** 课程两章的条目数（库头用） */
  const chapterStats = useMemo(
    () =>
      COURSE_COLLECTIONS.map((c) => {
        const ch = chapterOf(c.id)
        return { c, ch, count: ch ? ch.entries.length : 0 }
      }),
    []
  )

  /** 混排精选：两条课程要点 + 四条乡土条目 */
  const featured = useMemo(() => {
    const pick = (ids) => ids.map((id) => entries.find((e) => e.id === id)).filter(Boolean)
    return pick(['HS2-010', 'HS5-004', 'PC-001', 'SHE-CLOTH-01', 'M-FEST-001', 'M-CRAFT-001']).slice(0, 6)
  }, [entries])

  /** 跨馆关联示例：以「凤凰装」为种子，展示自动关联出的跨专题条目 */
  const crossDemo = useMemo(() => {
    const seed = entries.find((e) => e.id === 'SHE-CLOTH-01')
    return seed ? relatedEntries(seed, entries, 4) : []
  }, [entries])

  const submit = (v) => nav(`/library?q=${encodeURIComponent(v)}`)

  return (
    <div className="animate-seep">
      {/* ================= 开篇 ================= */}
      <section className="relative overflow-hidden border-b border-black/[0.06]">
        <div className="paper-grain absolute inset-0" aria-hidden="true" />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(900px 400px at 18% 0%, rgba(55,100,140,.10), transparent 62%), radial-gradient(700px 360px at 88% 6%, rgba(181,137,58,.10), transparent 60%)'
          }}
          aria-hidden="true"
        />
        <div className="wrap relative pb-10 pt-10 sm:pb-14 sm:pt-16">
          <div className="grid gap-9 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-10">
            <div className="min-w-0">
              <p className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-ink-mute">
                <span className="h-px w-8 bg-dai-700" />
                {SITE.unit} · 课程数字资源平台
              </p>

              <h1 className="plaque-title text-[38px] leading-[1.15] sm:text-[52px]">
                {SITE.name}
                <span className="mt-1.5 block font-sans text-[11px] font-normal tracking-[0.2em] text-ink-mute sm:ml-3 sm:mt-0 sm:inline sm:align-middle sm:text-[13px] sm:tracking-[0.24em]">
                  {SITE.en}
                </span>
              </h1>

              <p className="mt-5 max-w-xl text-[14.5px] leading-[1.95] text-ink-soft sm:text-[15px]">
                《人类与社会》课程的两个章节在这里各自成为独立的专题馆：
                <b className="font-semibold text-ink">第二章 人类社会发展与资源</b>、
                <b className="font-semibold text-ink">第五章 城市、城市化与乡村社会</b>。
                另配剪纸、畲族、闽东知识库三个乡土专题馆，共用一套检索、一套引用与一个教学选辑。
              </p>

              <div className="mt-7 max-w-xl">
                <SearchBox
                  value={q}
                  onChange={setQ}
                  onSubmit={submit}
                  size="lg"
                  placeholder="搜「可持续发展」「城市化」「凤凰装」"
                  suggestions={SUGGESTIONS}
                />
              </div>

              <dl className="mt-7 flex flex-wrap items-center gap-x-7 gap-y-3">
                {[
                  ['统一条目', stats.total],
                  ['图片与图版', stats.media],
                  ['可检索标签', stats.tags],
                  ['专题', COURSE_COLLECTIONS.length + LOCAL_COLLECTIONS.length]
                ].map(([label, value]) => (
                  <div key={label} className="flex items-baseline gap-1.5">
                    <dd className="font-serif text-[22px] font-bold tabular-nums text-ink">{value}</dd>
                    <dt className="text-[12px] text-ink-mute">{label}</dt>
                  </div>
                ))}
              </dl>
            </div>

            {/* 课程两馆：首屏第一眼要看到「这是一门课的站点」 */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              {chapterStats.map(({ c, ch, count }) => (
                <Link
                  key={c.id}
                  to={c.route}
                  className="group relative flex min-h-[232px] flex-col justify-between overflow-hidden rounded-2xl border border-black/[0.07] p-4 shadow-card transition-all hover:-translate-y-1 hover:shadow-lift"
                >
                  <span className={`absolute inset-0 bg-gradient-to-br ${c.accent.hero} opacity-[0.95]`} aria-hidden="true" />
                  <span
                    className="absolute -right-1 -top-4 font-kai text-[86px] font-bold leading-none text-white/10"
                    aria-hidden="true"
                  >
                    {String(c.chapter || '').replace(/^第/, '').replace(/章$/, '')}
                  </span>
                  <span className="relative flex items-center gap-1 text-[10px] tracking-[0.14em] text-white/75">
                    <Icon name={c.icon} size={11} />
                    {c.chapter}
                  </span>
                  <span className="relative">
                    <span className="block font-kai text-[15px] font-bold leading-snug text-white drop-shadow-sm">
                      {c.name}
                    </span>
                    <span className="mt-1 block text-[10px] leading-relaxed text-white/70">
                      {ch ? `${ch.sections.length} 节 · ${count} 条要点` : ''}
                    </span>
                    <span className="mt-1.5 line-clamp-2 block text-[10px] leading-snug text-white/60">{c.tagline}</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================= 课程章节库 ================= */}
      <section className="wrap py-12">
        <SectionTitle
          eyebrow="COURSE GALLERIES"
          title="两个课程专题馆"
          sub="按教材的章—节—要点三级组织：馆 → 节 → 要点，逐层可检索、可引用、可加入选辑。"
          right={
            <Link to="/library" className="btn-ghost btn-xs">
              <Icon name="grid" size={14} />
              在资源库中浏览
            </Link>
          }
        />

        <div className="grid gap-4 lg:grid-cols-2">
          {chapterStats.map(({ c, ch, count }, i) => (
            <article
              key={c.id}
              className="group flex animate-rise flex-col overflow-hidden rounded-2xl border border-black/[0.07] bg-white/80 shadow-card"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-start justify-between gap-3 border-b border-black/[0.06] px-5 py-4">
                <div className="min-w-0">
                  <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-mute">
                    {c.chapter} · {c.en}
                  </p>
                  <h3 className="mt-1 font-serif text-[18px] font-bold leading-snug text-ink">{c.name}</h3>
                </div>
                <span className={`chip shrink-0 ${c.accent.bg} ${c.accent.text}`}>{count} 条要点</span>
              </div>

              <div className="flex flex-1 flex-col p-5">
                <p className="text-[12.5px] leading-[1.85] text-ink-mute">{ch?.chapter.intro}</p>

                <ul className="mt-4 space-y-2">
                  {(ch?.sections || []).map((s) => (
                    <li key={s.id}>
                      <Link
                        to={catLink(c.route, s.id)}
                        className="flex items-baseline gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-black/[0.035]"
                      >
                        <span className="shrink-0 text-[10.5px] tracking-[0.1em] text-ink-mute">{s.no}</span>
                        <span className="min-w-0 flex-1 truncate text-[13px] text-ink-soft group-hover:text-ink">
                          {s.name}
                        </span>
                        <span className="shrink-0 text-[10.5px] tabular-nums text-ink-mute/70">
                          {(ch?.entries || []).filter((e) => e.category === s.id).length}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>

                <Link
                  to={c.route}
                  className={`mt-4 inline-flex items-center gap-1 text-[13px] font-medium ${c.accent.text} hover:underline`}
                >
                  <Icon name="arrow" size={14} />
                  进入{c.name}
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ================= 乡土专题 ================= */}
      <section className="wrap pb-12">
        <SectionTitle
          eyebrow="LOCAL CASES"
          title="乡土三支"
          sub="课程讲普遍规律，乡土内容提供可验证的本地案例。剪纸按题材编次、畲族按展区动线、闽东按五类主题，各自成馆。"
          right={
            <Link to="/theme" className="btn-ghost btn-xs">
              <Icon name="layers" size={14} />
              进入专题馆
            </Link>
          }
        />

        <div className="grid gap-4 md:grid-cols-3">
          {LOCAL_COLLECTIONS.map((c, i) => {
            const covers = pickCoverEntries(c.id, entries)
            const media = covers[0]?.media?.[0]
            const minis = covers.slice(1, 4)
            return (
              <article
                key={c.id}
                className="group flex animate-rise flex-col overflow-hidden rounded-2xl border border-black/[0.07] bg-white/80 shadow-card transition-all hover:-translate-y-1 hover:shadow-lift"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <Link to={c.route} className="relative block aspect-[16/9] w-full overflow-hidden bg-paper-sunk">
                  {media?.src ? (
                    /* 与专题馆同一版式：一幅主图占 3×3 格，右侧三条各占一格。
                       379px 宽时右栏 95px，正好装得下木偶、廊桥、鱼群这类有主体的图；
                       四格等分只剩 90px 且全是风景时才会糊成色块。 */
                    <div className="grid h-full w-full grid-cols-4 grid-rows-3 gap-0.5">
                      <div className="relative col-span-3 row-span-3 overflow-hidden">
                        <SmartImage
                          src={asset(media.full || media.src)}
                          alt={c.name}
                          ratio="h-full"
                          imgClassName="transition-transform duration-700 group-hover:scale-[1.05]"
                        />
                        <span className="absolute inset-0 bg-gradient-to-t from-ink/45 via-transparent to-transparent" />
                      </div>
                      {minis.map((e) => (
                        <div key={e.id} className="relative overflow-hidden" title={e.title}>
                          <SmartImage
                            src={asset(e.media[0].src)}
                            alt={e.title}
                            ratio="h-full"
                            imgClassName="transition-transform duration-700 group-hover:scale-[1.08]"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={`h-full w-full bg-gradient-to-br ${c.accent.hero}`} />
                  )}
                  <span className="absolute left-3 top-3">
                    <span className={`chip ${c.accent.bgSolid} text-paper-warm text-[10px]`}>
                      <Icon name={c.icon} size={10} />
                      {c.en}
                    </span>
                  </span>
                </Link>
                <div className="flex flex-1 flex-col p-4">
                  <h3 className="font-serif text-[17px] font-bold text-ink">{c.name}</h3>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-mute">{c.tagline}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span className={`chip ${c.accent.bg} ${c.accent.text}`}>
                      {stats.byCollection[c.id] || 0} {c.unit}
                    </span>
                    <span className="chip bg-black/[0.04] text-ink-mute">{COVER_META[c.id].facts}</span>
                  </div>
                  <Link
                    to={c.route}
                    className={`mt-4 inline-flex items-center gap-1 text-[13px] font-medium ${c.accent.text} hover:underline`}
                  >
                    {COVER_META[c.id].cta}
                    <Icon name="arrow" size={14} />
                  </Link>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      {/* ================= 热门标签 ================= */}
      <section className="border-y border-black/[0.06] bg-white/45">
        <div className="wrap py-8">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <span className="flex items-center gap-1.5 text-[12px] font-semibold tracking-wide text-ink-mute">
              <Icon name="tag" size={14} />
              高频主题
            </span>
            {tags.map((t) => (
              <Link
                key={t.name}
                to={`/library?q=${encodeURIComponent(t.name)}`}
                className="group inline-flex items-baseline gap-1 rounded-lg border border-black/[0.06] bg-white px-2.5 py-1.5 text-[12.5px] text-ink-soft transition-colors hover:border-dai-300 hover:text-dai-700"
              >
                {t.name}
                <span className="text-[10px] tabular-nums text-ink-mute/60">{t.count}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ================= 精选条目 ================= */}
      <section className="wrap py-12">
        <SectionTitle
          eyebrow="SELECTED"
          title="课程与乡土混排"
          sub="同一屏内混排课程要点与乡土条目 —— 徽标告诉你它来自哪个专题，其余的读法完全一致。"
          right={
            <Link to="/library" className="btn-ghost btn-xs">
              <Icon name="grid" size={14} />
              浏览全部 {stats.total} 条
            </Link>
          }
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((e, i) => (
            <EntryCard key={e.id} entry={e} index={i} />
          ))}
        </div>
      </section>

      {/* ================= 跨库关联示例 ================= */}
      {crossDemo.length > 0 && (
        <section className="wrap pb-12">
          <div className="overflow-hidden rounded-2xl border border-black/[0.07] bg-white">
            <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zhu-500">
                  CROSS-COLLECTION
                </p>
                <h2 className="font-serif text-xl font-bold text-ink">一条标签，串起几个库</h2>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-mute">
                  以畲族「凤凰装」条目为起点，系统按标签与主题重叠自动关联出其他库的条目。
                  这种跨库跳转在原三个站点里是不存在的 —— 它需要内容先落进同一套模型。
                </p>
                <Link to="/entry/SHE-CLOTH-01" className="btn-primary btn-xs mt-4">
                  <Icon name="compass" size={14} />
                  从「凤凰装」出发
                </Link>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {crossDemo.map((r) => (
                  <Link
                    key={r.id}
                    to={`/entry/${r.id}`}
                    className="group rounded-xl border border-black/[0.06] bg-paper-sunk p-2.5 transition-colors hover:border-dai-300 hover:bg-white"
                  >
                    <span className="mb-1 flex items-center gap-1 text-[10px] text-ink-mute">
                      <Icon name="link" size={10} />
                      {r.collectionLabel} · {r.categoryLabel}
                    </span>
                    <p className="line-clamp-2 font-serif text-[12.5px] font-semibold leading-snug text-ink group-hover:text-dai-700">
                      {r.title}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ================= 能力说明 ================= */}
      <section className="wrap pb-12">
        <SectionTitle eyebrow="ARCHITECTURE" title="共享的四件事" sub="合并不是几个站并排，而是把重复的骨架抽出来只做一次。" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CAPABILITIES.map((c) => (
            <div key={c.title} className="rounded-2xl border border-black/[0.07] bg-white p-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-dai-50 text-dai-700">
                <Icon name={c.icon} size={17} />
              </span>
              <h3 className="mt-3 font-serif text-[14.5px] font-bold text-ink">{c.title}</h3>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-mute">{c.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
