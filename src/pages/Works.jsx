import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useStore } from '../hooks/useStore'
import { GRADES, SEMESTERS, WORK_TYPES, workTypeName } from '../data/taxonomy'
import { filterWorks } from '../lib/search'
import { Empty, SectionTitle } from '../components/UI'
import { useResolvedImage } from '../components/MaterialCard'
import Icon from '../components/Icon'

/** 按日期分组为学期标签，便于形成时间轴视图 */
const yearOf = (s) => String(s || '').slice(0, 4)

export default function Works() {
  const { works, reviews } = useStore()
  const [params, setParams] = useSearchParams()
  const nav = useNavigate()

  const q = params.get('q') || ''
  const author = params.get('author') || ''
  const semester = params.get('semester') || ''
  const type = params.get('type') || ''
  const group = params.get('group') || 'semester'

  const [input, setInput] = useState(q)

  const patch = (obj) => {
    const next = new URLSearchParams(params)
    Object.entries(obj).forEach(([k, v]) => {
      if (!v) next.delete(k)
      else next.set(k, v)
    })
    setParams(next, { replace: true })
  }

  const results = useMemo(
    () => filterWorks(works, { q, author, semester, type }),
    [works, q, author, semester, type]
  )

  // 多维分面统计（仅统计全量，反映真实分布）
  const facets = useMemo(() => {
    const authors = new Map()
    const semesters = new Map()
    const types = new Map()
    works.forEach((w) => {
      authors.set(w.author, (authors.get(w.author) || 0) + 1)
      semesters.set(w.semester, (semesters.get(w.semester) || 0) + 1)
      types.set(w.type, (types.get(w.type) || 0) + 1)
    })
    return {
      authors: [...authors.entries()].sort((a, b) => b[1] - a[1]),
      semesters: SEMESTERS.filter((s) => semesters.has(s)).map((s) => [s, semesters.get(s)]),
      types: WORK_TYPES.map((t) => [t.id, types.get(t.id) || 0])
    }
  }, [works])

  const grouped = useMemo(() => {
    if (group === 'none') return [{ key: 'all', label: '全部成果', items: results }]
    const map = new Map()
    results.forEach((w) => {
      const key = group === 'author' ? w.author : group === 'type' ? workTypeName(w.type) : w.semester
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(w)
    })
    return [...map.entries()].map(([key, items]) => ({ key, label: key, items }))
  }, [results, group])

  const activeCount = (q ? 1 : 0) + (author ? 1 : 0) + (semester ? 1 : 0) + (type ? 1 : 0)

  return (
    <div className="wrap py-10">
      <SectionTitle
        eyebrow="成果库"
        title="学生优秀成果"
        sub="按作者、学期、成果类型多维浏览与筛选，支持文章、图片、音频、视频四类成果的在线提交与正式入库展示。"
        right={
          <Link to="/works/new" className="btn-zhu">
            <Icon name="upload" size={15} />
            提交成果
          </Link>
        }
      />

      {/* ====== 多维筛选 ====== */}
      <div className="card mb-6 p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Icon
              name="search"
              size={17}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-mute"
            />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && patch({ q: input.trim() })}
              className="field pl-10"
              placeholder="搜索成果标题、作者、课程或正文关键词"
            />
          </div>
          <button onClick={() => patch({ q: input.trim() })} className="btn-primary">
            <Icon name="search" size={15} />
            搜索
          </button>
          <label className="relative flex items-center">
            <select
              value={group}
              onChange={(e) => patch({ group: e.target.value === 'semester' ? '' : e.target.value })}
              className="field w-auto cursor-pointer appearance-none py-2.5 pl-3 pr-9 text-[13px]"
              aria-label="分组方式"
            >
              <option value="semester">按学期分组</option>
              <option value="type">按类型分组</option>
              <option value="author">按作者分组</option>
              <option value="none">不分组</option>
            </select>
            <Icon name="chevron" size={14} className="pointer-events-none absolute right-3 text-ink-mute" />
          </label>
        </div>

        {/* 分面：类型 */}
        <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-black/[0.06] pt-3.5">
          <span className="flex items-center gap-1 text-xs font-medium text-ink-mute">
            <Icon name="layers" size={13} />
            成果类型
          </span>
          <button onClick={() => patch({ type: '' })} className={type === '' ? 'chip-tag-on' : 'chip-tag'}>
            全部
            <span className="ml-0.5 text-[10px] opacity-70">{works.length}</span>
          </button>
          {facets.types.map(([id, n]) => (
            <button
              key={id}
              onClick={() => patch({ type: type === id ? '' : id })}
              className={type === id ? 'chip-tag-on' : 'chip-tag'}
            >
              <Icon name={id} size={12} />
              {workTypeName(id)}
              <span className="ml-0.5 text-[10px] opacity-70">{n}</span>
            </button>
          ))}
        </div>

        {/* 分面：学期 */}
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 text-xs font-medium text-ink-mute">
            <Icon name="calendar" size={13} />
            学期
          </span>
          <button onClick={() => patch({ semester: '' })} className={semester === '' ? 'chip-tag-on' : 'chip-tag'}>
            全部学期
          </button>
          {facets.semesters.map(([s, n]) => (
            <button
              key={s}
              onClick={() => patch({ semester: semester === s ? '' : s })}
              className={semester === s ? 'chip-tag-on' : 'chip-tag'}
            >
              {s}
              <span className="ml-0.5 text-[10px] opacity-70">{n}</span>
            </button>
          ))}
        </div>

        {/* 分面：作者 */}
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 text-xs font-medium text-ink-mute">
            <Icon name="users" size={13} />
            作者
          </span>
          <button onClick={() => patch({ author: '' })} className={author === '' ? 'chip-tag-on' : 'chip-tag'}>
            全部作者
          </button>
          {facets.authors.map(([a, n]) => (
            <button
              key={a}
              onClick={() => patch({ author: author === a ? '' : a })}
              className={author === a ? 'chip-tag-on' : 'chip-tag'}
            >
              {a}
              <span className="ml-0.5 text-[10px] opacity-70">{n}</span>
            </button>
          ))}
        </div>

        {activeCount > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-black/[0.06] pt-3">
            <span className="text-xs text-ink-mute">已启用 {activeCount} 个筛选条件</span>
            <button
              onClick={() => {
                setInput('')
                const next = new URLSearchParams()
                if (group !== 'semester') next.set('group', group)
                setParams(next, { replace: true })
              }}
              className="btn-quiet btn-xs ml-auto"
            >
              <Icon name="refresh" size={13} />
              重置筛选
            </button>
          </div>
        )}
      </div>

      <p className="mb-5 text-sm text-ink-mute">
        共 <span className="font-serif text-lg font-bold text-zhu-500">{results.length}</span> 项成果
        {activeCount > 0 && <span className="ml-2 text-xs">（多条件组合筛选）</span>}
      </p>

      {/* ====== 结果 ====== */}
      {results.length === 0 ? (
        <Empty
          iconName="award"
          title="没有符合条件的学生成果"
          desc={
            q
              ? `没有与「${q}」相关的成果。可以换个关键词，或放宽作者、学期与类型限制。`
              : '当前筛选组合下暂无成果，试试放宽条件。'
          }
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <button
                onClick={() => {
                  setInput('')
                  setParams(new URLSearchParams(), { replace: true })
                }}
                className="btn-primary"
              >
                <Icon name="refresh" size={15} />
                清除全部条件
              </button>
              <Link to="/works/new" className="btn-ghost">
                <Icon name="upload" size={15} />
                提交新成果
              </Link>
            </div>
          }
        />
      ) : (
        <div className="space-y-10">
          {grouped.map((g) => (
            <section key={g.key}>
              <div className="mb-4 flex items-center gap-3">
                <h3 className="font-serif text-lg font-bold text-ink">{g.label}</h3>
                <span className="chip bg-black/[0.05] text-[11px] text-ink-mute">{g.items.length} 项</span>
                <span className="h-px flex-1 bg-black/[0.08]" />
              </div>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {g.items.map((w, i) => (
                  <WorkCard
                    key={w.id}
                    work={w}
                    score={reviews[w.id]?.total}
                    index={i}
                    onOpen={() => nav(`/works/${w.id}`)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function WorkCard({ work, score, index = 0, onOpen }) {
  const coverSrc = useResolvedImage(work.image)
  return (
    <article
      className="card card-hover group animate-rise flex flex-col overflow-hidden"
      style={{ animationDelay: `${Math.min(index * 45, 400)}ms` }}
    >
      {/* 封面：优先用成果配图，无图时退回类型视觉条 */}
      <div className="relative flex h-24 items-center justify-center overflow-hidden bg-gradient-to-br from-dai-700 to-indigoSea-700">
        {coverSrc ? (
          <>
            <img src={coverSrc} alt={work.title} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
            <span className="absolute inset-0 bg-gradient-to-t from-ink/45 to-transparent" />
          </>
        ) : (
          <>
            <svg className="absolute inset-0 h-full w-full opacity-25" viewBox="0 0 400 100" preserveAspectRatio="none" aria-hidden="true">
              <path d="M0 78 L60 52 L110 72 L170 40 L230 70 L290 46 L340 68 L400 44 L400 100 L0 100 Z" fill="#ffffff" opacity="0.3" />
              <path d="M0 92 L70 74 L130 88 L200 66 L270 86 L340 70 L400 84 L400 100 L0 100 Z" fill="#ffffff" opacity="0.22" />
            </svg>
            <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-paper/95 text-dai-700 shadow-sm">
              <Icon name={work.type} size={23} />
            </span>
          </>
        )}
        <span className="absolute right-3 top-3 chip bg-paper/90 text-[11px] text-dai-700">
          <Icon name={work.type} size={11} />
          {workTypeName(work.type)}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-serif text-[15px] font-bold leading-snug text-ink">
          <button onClick={onOpen} className="text-left hover:text-dai-700">
            {work.title}
          </button>
        </h3>
        <p className="mt-2 line-clamp-3 flex-1 text-[13px] leading-relaxed text-ink-mute">{work.summary}</p>

        {(work.tags || []).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {work.tags.slice(0, 3).map((t) => (
              <span key={t} className="chip bg-black/[0.04] text-[11px] text-ink-mute">
                #{t}
              </span>
            ))}
          </div>
        )}

        <div className="mt-3.5 flex items-center justify-between border-t border-black/[0.06] pt-3">
          <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-ink-mute">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cha-50 font-serif text-[10px] font-bold text-cha-700">
              {work.author.slice(0, 1)}
            </span>
            <span className="truncate">
              {work.author} · {work.semester}
            </span>
          </span>
          <div className="flex shrink-0 items-center gap-1.5">
            {/* 只有评阅过的成果才显示分数，避免整屏「未评阅」噪声 */}
            {typeof score === 'number' && (
              <span
                className="chip bg-cha-50 px-1.5 py-0.5 text-[11px] font-semibold text-cha-700"
                data-testid="work-score"
                title="AI 评阅总分"
              >
                <Icon name="award" size={11} />
                {score}
              </span>
            )}
            <button onClick={onOpen} className="btn-quiet btn-xs shrink-0">
              <Icon name="eye" size={13} />
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}
