import { useEffect, useMemo, useRef, useState } from 'react'
import Icon from './Icon'
import { ConfirmDialog } from './UI'
import {
  EDIT_LIMITS,
  applyReviewEdits,
  dimensionsOf,
  draftLevel,
  draftTotal,
  editableDraft,
  editedDimensionKeys,
  gradeOf,
  restoreOriginalReview,
  reviewErrorText,
  rubricFor,
  rubricForKey
} from '../lib/review'
import { useSettings } from '../hooks/useSettings'
import { isConfigured } from '../lib/settings'

/**
 * AI 评阅面板。
 *
 * 四种状态各自有明确的视觉，不给用户猜：
 * 未评阅（空态 + 开始按钮） / 评阅中（计时器，让他知道还在跑） / 失败（原因 + 是否可重试） / 有结果。
 *
 * 三个刻意的设计：
 * - **没配密钥这类不可恢复的错误，不显示重试按钮**，改成「去设置」。
 *   点了也不会好，给重试只会让人反复点、以为系统坏了。
 * - **评阅前先亮材料清单**。用户点「评阅」时最想知道的是「它到底评了什么」，
 *   所以把正文、文档、配图、未纳入项逐项列出，并说明这些内容取自本页、无需重传。
 * - **结果可人工修订，但修订是受约束的**。分数钳到该维满分、等级由分数重算、
 *   总分由分项求和 —— 这三条都在 lib/review.js 的 applyReviewEdits 里，界面只负责收集输入。
 *   AI 原始结果被整份存进 origin，随时可一键恢复；报告里用 ✎ 标出改过的维度。
 */

/**
 * 等级配色。stroke 用于分数圆环的 SVG，必须与 bar 的 class 同值——
 * 圆环读的是十六进制、进度条读的是 Tailwind 类，两处一旦不同步，
 * 同一份结果里圆环和进度条会呈现两个色（旧版就差点踩到）。
 */
const LEVEL_STYLE = {
  优秀: { chip: 'bg-cha-50 text-cha-700', bar: 'bg-cha-500', stroke: '#ae7c26' },
  良好: { chip: 'bg-dai-50 text-dai-700', bar: 'bg-dai-500', stroke: '#287e77' },
  合格: { chip: 'bg-tan-100 text-tan-700', bar: 'bg-tan-500', stroke: '#bc6c36' },
  待改进: { chip: 'bg-zhu-50 text-zhu-700', bar: 'bg-zhu-500', stroke: '#c63a2b' }
}

const styleOf = (level) => LEVEL_STYLE[level] || LEVEL_STYLE.合格

/**
 * 材料清单。接受两种形状：
 * - previewMaterials()：轻量预览（还没读 IndexedDB）
 * - collectReviewMaterials().summary：真实采集结果（含文档名）
 */
function MaterialList({ materials, note = true }) {
  if (!materials) return null
  const { chars = 0, docCount = 0, imageCount = 0, skippedCount = 0 } = materials
  const chips = [
    { text: `正文 ${Number(chars).toLocaleString('zh-CN')} 字`, on: chars > 0 },
    { text: `文档 ${docCount} 份`, on: docCount > 0 },
    { text: `配图 ${imageCount} 张`, on: imageCount > 0 },
    { text: `未纳入 ${skippedCount} 项`, on: skippedCount > 0 }
  ]
  return (
    <div className="rounded-xl border border-black/[0.07] bg-white px-3.5 py-3" data-testid="review-materials">
      <p className="mb-2 flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-ink-mute">
        <Icon name="layers" size={11} />
        本次评阅材料
      </p>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <span
            key={c.text}
            className={`chip px-2 py-0.5 text-[11px] tabular-nums ${
              c.on ? 'bg-dai-50 text-dai-700' : 'bg-black/[0.035] text-ink-mute opacity-70'
            }`}
          >
            {c.text}
          </span>
        ))}
      </div>
      {note && (
        <p className="mt-2 text-[11px] leading-relaxed text-ink-mute">
          内容取自本页已加载的正文、成果文档与配图，点按钮即评，不需要再上传一次。
          {skippedCount > 0 && '「未纳入」指音视频或外链附件，模型读不了，会在评语里说明而不计入分数。'}
        </p>
      )}
    </div>
  )
}

export function MaterialSummaryLine({ materials }) {
  if (!materials?.label) return null
  return (
    <p className="text-[11px] text-ink-mute" data-testid="review-materials-line">
      评阅材料：{materials.label}
    </p>
  )
}

function ScoreRing({ total, dimsHint = '四维各 25 分', edited = false }) {
  const grade = gradeOf(total)
  const style = styleOf(grade)
  const r = 26
  const c = 2 * Math.PI * r
  const dash = (Math.max(0, Math.min(100, total)) / 100) * c
  return (
    <div className="flex items-center gap-4">
      <div className="relative h-[68px] w-[68px] shrink-0">
        <svg viewBox="0 0 68 68" className="h-full w-full -rotate-90">
          <circle cx="34" cy="34" r={r} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="6" />
          <circle
            cx="34"
            cy="34"
            r={r}
            fill="none"
            stroke={style.stroke}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c}`}
            style={{ transition: 'stroke-dasharray .6s ease' }}
          />
        </svg>
        <span
          className="absolute inset-0 flex items-center justify-center font-serif text-[19px] font-bold text-ink tabular-nums"
          data-testid="review-total"
        >
          {total}
        </span>
      </div>
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-1.5 font-serif text-[15px] font-bold text-ink">
          <Icon name="award" size={14} className="text-cha-700" />
          总分 {total} / 100
          <span className={`chip ${style.chip} text-[10px]`}>{grade}</span>
          {edited && (
            <span className="chip bg-white px-1.5 py-0 text-[10px] text-ink-mute ring-1 ring-inset ring-black/[0.08]">
              人工修订后
            </span>
          )}
        </p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-ink-mute">
          {dimsHint}，由分项求和；等级按总分区间派生。
        </p>
      </div>
    </div>
  )
}

function DimensionRows({ dimensions = [], placeholder = [], editedKeys }) {
  const list = dimensions.length
    ? dimensions
    : placeholder.map((d) => ({ ...d, score: 0, level: '待改进', comment: '', evidence: '' }))
  return (
    <div className="space-y-4">
      {list.map((d) => {
        const style = styleOf(d.level)
        const pct = Math.max(2, Math.round((d.score / (d.max || 25)) * 100))
        const changed = editedKeys?.has?.(d.key)
        return (
          <div key={d.key}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
              <p className="flex flex-wrap items-center gap-1.5 text-[13px] font-medium text-ink">
                {d.name}
                <span className={`chip ${style.chip} px-1.5 py-0 text-[10px]`}>{d.level}</span>
                {changed && (
                  <span
                    className="chip bg-white px-1.5 py-0 text-[10px] text-ink-mute ring-1 ring-inset ring-black/[0.08]"
                    title="该维度的分数或评语经人工修订"
                    data-testid="review-dim-edited"
                  >
                    ✎ 已修订
                  </span>
                )}
              </p>
              <p className="font-serif text-[13px] font-bold tabular-nums text-ink-soft" data-testid="review-dim-score">
                {d.score}
                <span className="text-[10.5px] font-normal text-ink-mute"> / {d.max || 25}</span>
              </p>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
              <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${pct}%` }} />
            </div>
            {d.comment && (
              <p className="mt-1.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink-soft">{d.comment}</p>
            )}
            {d.evidence && (
              <p className="mt-1 flex items-start gap-1 text-[11.5px] leading-relaxed text-ink-mute">
                <Icon name="quote" size={11} className="mt-0.5 shrink-0 opacity-60" />
                原文：{d.evidence}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 编辑态                                                              */
/* ------------------------------------------------------------------ */

const EDIT_INPUT = 'field px-2.5 py-1.5 text-[12.5px] leading-relaxed'

/** 字数计数器：只在接近上限时出现，否则纯噪声 */
function Counter({ value = '', max }) {
  if (!max || value.length < max * 0.7) return null
  const over = value.length >= max
  return (
    <span className={`ml-auto text-[10.5px] tabular-nums ${over ? 'text-zhu-700' : 'text-ink-mute'}`}>
      {value.length}/{max}
    </span>
  )
}

/**
 * 自增高的多行输入。
 *
 * 固定 rows 的问题在窄屏上特别明显：一行只放得下二十来个汉字，两行装不满 AI 那 60 字评语，
 * 最后一句被切在输入框下沿，看起来像渲染坏了。这里按内容高度撑开，超过 420px 才内部滚动。
 */
function AutoTextarea({ value, minRows = 2, className = '', ...rest }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight + 2, 420)}px`
  }, [value])
  return (
    <textarea ref={ref} rows={minRows} value={value} className={`${className} resize-y overflow-y-auto`} {...rest} />
  )
}

/** 可增删的条目列表（亮点 / 建议共用）：条目为空时保存会被过滤掉，不会留下空行 */
function EditList({ label, iconName, hint, items, onChange, placeholder, testid, max = 6 }) {
  const list = Array.isArray(items) ? items : []
  return (
    <div>
      <div className="mb-1.5 flex items-baseline gap-1.5">
        <Icon name={iconName} size={12} className="translate-y-[1px] text-dai-700" />
        <span className="font-serif text-[13px] font-bold text-ink">{label}</span>
        <span className="text-[11px] text-ink-mute">{list.length} 条</span>
        {hint && <span className="ml-auto text-[10.5px] text-ink-mute">{hint}</span>}
      </div>
      <div className="space-y-1.5">
        {list.map((v, i) => (
          <div key={i} className="flex items-start gap-1.5">
            <span className="mt-2 w-4 shrink-0 text-[11px] tabular-nums text-ink-mute">{i + 1}</span>
            <AutoTextarea
              minRows={1}
              value={v}
              maxLength={EDIT_LIMITS.item}
              onChange={(e) => onChange(list.map((x, j) => (j === i ? e.target.value : x)))}
              className={`${EDIT_INPUT} min-h-[34px] flex-1`}
              placeholder="写一条具体、可执行的表述"
              aria-label={`${label}第 ${i + 1} 条`}
              data-testid={testid}
            />
            <button
              type="button"
              onClick={() => onChange(list.filter((_, j) => j !== i))}
              className="btn-quiet mt-0.5 shrink-0 px-1.5 py-1.5 text-ink-mute hover:text-zhu-700"
              title="删除这一条"
              aria-label={`删除${label}第 ${i + 1} 条`}
            >
              <Icon name="trash" size={12} />
            </button>
          </div>
        ))}
        {list.length === 0 && <p className="text-[11.5px] leading-relaxed text-ink-mute">{placeholder}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange([...list, ''])}
        disabled={list.length >= max}
        className="btn-ghost btn-xs mt-1.5"
        data-testid={`${testid}-add`}
      >
        <Icon name="plus" size={11} />
        添加一条
      </button>
    </div>
  )
}

/**
 * 编辑态主体。
 *
 * `dirty` 用「草稿与已保存结果的 JSON 比对」判断，而不是维护一堆 touched 标记：
 * 改回原样就自动变回未修改状态，保存按钮也跟着灰掉，语义更诚实。
 */
function ReviewEditor({ review, draft, setDraft, onSave, onCancel, onRestore }) {
  const total = draftTotal(draft)
  const saved = useMemo(() => editableDraft(review), [review])
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved])

  const setScore = (i, value) =>
    setDraft((d) => ({ ...d, dimensions: d.dimensions.map((x, j) => (j === i ? { ...x, score: value } : x)) }))

  /** 失焦时把分数落到合法区间：输入框允许中途为空，但离开时必须给出一个能存的值 */
  const normalizeScore = (i) =>
    setDraft((d) => ({
      ...d,
      dimensions: d.dimensions.map((x, j) =>
        j === i ? { ...x, score: String(Math.max(0, Math.min(x.max, Math.round(Number(x.score) || 0)))) } : x
      )
    }))

  const setDimText = (i, field, value) =>
    setDraft((d) => ({ ...d, dimensions: d.dimensions.map((x, j) => (j === i ? { ...x, [field]: value } : x)) }))

  const save = () => {
    if (!dirty) return
    onSave(applyReviewEdits(review, draft))
  }

  // Ctrl/⌘+S 保存：长表单滚到底再找按钮是件烦人的事
  const saveRef = useRef(save)
  saveRef.current = save
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        saveRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div data-testid="review-editor">
      <div className="mb-3 flex items-start gap-2 rounded-xl border border-dai-300 bg-dai-50 px-3.5 py-2.5">
        <Icon name="edit" size={13} className="mt-0.5 shrink-0 text-dai-700" />
        <p className="text-[12px] leading-relaxed text-dai-700">
          正在人工修订。分数限制在该维满分以内，<strong className="font-semibold">等级与总分按修改后的分数自动重算</strong>；
          保存后详情页、成果列表与导出报告都用这一份结果，报告里会标出改了哪几维。
        </p>
      </div>

      <ScoreRing total={total} dimsHint="按当前分项实时求和，保存后生效" edited={dirty} />

      <div className="mt-4 space-y-2.5">
        {draft.dimensions.map((d, i) => {
          const style = styleOf(draftLevel(d))
          const pct = Math.max(2, Math.round((Number(d.score) || 0) / (d.max || 25) * 100))
          return (
            <div key={d.key} className="rounded-xl border border-black/[0.07] bg-white p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
                <p className="flex min-w-0 flex-wrap items-center gap-1.5 text-[13px] font-medium text-ink">
                  {d.name}
                  {d.block && <span className="text-[10.5px] font-normal text-ink-mute">取自 {d.block}</span>}
                </p>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    max={d.max || 25}
                    step={1}
                    inputMode="numeric"
                    value={d.score}
                    onChange={(e) => setScore(i, e.target.value)}
                    onBlur={() => normalizeScore(i)}
                    // 滚轮划过不抢焦点，避免滚动页面时把分数改掉（改了还看不出来）
                    onWheel={(e) => e.currentTarget.blur()}
                    className="no-spin field w-16 px-2 py-1 text-center font-serif text-[13px] font-bold tabular-nums"
                    aria-label={`${d.name} 得分`}
                    data-testid="review-edit-score"
                  />
                  <span className="text-[11.5px] text-ink-mute">/ {d.max || 25}</span>
                  <span className={`chip ${style.chip} px-1.5 py-0 text-[10px]`}>{draftLevel(d)}</span>
                </div>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-black/[0.06]">
                <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${pct}%` }} />
              </div>

              <label className="mt-2.5 block">
                <span className="mb-1 flex items-baseline gap-1 text-[11px] font-medium text-ink-mute">
                  评语
                  <Counter value={d.comment} max={EDIT_LIMITS.comment} />
                </span>
                <AutoTextarea
                  minRows={2}
                  value={d.comment}
                  maxLength={EDIT_LIMITS.comment}
                  onChange={(e) => setDimText(i, 'comment', e.target.value)}
                  className={EDIT_INPUT}
                  placeholder="这一维做得怎么样、为什么给这个分"
                  aria-label={`${d.name} 评语`}
                  data-testid="review-edit-comment"
                />
              </label>

              <label className="mt-2 block">
                <span className="mb-1 flex items-baseline gap-1 text-[11px] font-medium text-ink-mute">
                  原文证据
                  <Counter value={d.evidence} max={EDIT_LIMITS.evidence} />
                </span>
                <AutoTextarea
                  minRows={1}
                  value={d.evidence}
                  maxLength={EDIT_LIMITS.evidence}
                  onChange={(e) => setDimText(i, 'evidence', e.target.value)}
                  className={EDIT_INPUT}
                  placeholder="从作品中摘一句能支撑该评分的话"
                  aria-label={`${d.name} 原文证据`}
                  data-testid="review-edit-evidence"
                />
              </label>
            </div>
          )
        })}
      </div>

      <div className="mt-4 space-y-4 rounded-xl border border-black/[0.06] bg-paper-sunk p-4">
        <EditList
          label="做得好的地方"
          iconName="award"
          items={draft.highlights}
          onChange={(highlights) => setDraft((d) => ({ ...d, highlights }))}
          placeholder="没有亮点条目。留空则详情页不显示这一块。"
          testid="review-edit-highlight"
          max={4}
        />

        <div>
          <div className="mb-1.5 flex items-baseline gap-1.5">
            <Icon name="quote" size={12} className="translate-y-[1px] text-dai-700" />
            <span className="font-serif text-[13px] font-bold text-ink">总评</span>
            <Counter value={draft.summary} max={EDIT_LIMITS.summary} />
          </div>
          <AutoTextarea
            minRows={3}
            value={draft.summary}
            maxLength={EDIT_LIMITS.summary}
            onChange={(e) => setDraft((d) => ({ ...d, summary: e.target.value }))}
            className={EDIT_INPUT}
            placeholder="几句话说清整体水平、主要问题与改进方向"
            aria-label="总评"
            data-testid="review-edit-summary"
          />
        </div>

        <EditList
          label="改进建议"
          iconName="check"
          items={draft.suggestions}
          onChange={(suggestions) => setDraft((d) => ({ ...d, suggestions }))}
          placeholder="没有建议条目。"
          testid="review-edit-suggestion"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-black/[0.07] pt-3.5">
        <button type="button" onClick={save} disabled={!dirty} className="btn-primary btn-xs" data-testid="review-edit-save-bottom">
          <Icon name="check" size={12} />
          保存修改
        </button>
        <button type="button" onClick={onCancel} className="btn-ghost btn-xs">
          取消
        </button>
        {review.origin && (
          <button type="button" onClick={onRestore} className="btn-ghost btn-xs text-zhu-700">
            <Icon name="refresh" size={12} />
            恢复 AI 原始结果
          </button>
        )}
        <p className="ml-auto text-[11px] text-ink-mute">
          {dirty ? '有未保存的修改' : '尚未修改'} · Ctrl/⌘ + S 保存
        </p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 面板                                                                */
/* ------------------------------------------------------------------ */

export default function ReviewPanel({ work, review, job, materials, onStart, onExport, onSave, onOpenSettings }) {
  const settings = useSettings()
  const configured = isConfigured(settings)
  /** 现在这份成果**如果**重评会用哪套量表——教案七维、文章四维 */
  const rubric = rubricFor(work)
  /**
   * 屏幕上这份已有结果**当时**按哪套量表评的。
   * 两者只在「评阅之后又改了成果类型」时才会不同：那时表头若继续用 `rubric`，
   * 就会出现「标注 7 维、下面只有 4 行」这种自相矛盾的画面。
   */
  const shownRubric = review?.rubricKey ? rubricForKey(review.rubricKey) : rubric
  const rubricSwitched = Boolean(review) && shownRubric.key !== rubric.key
  const status = job?.status || 'idle'
  const running = status === 'reviewing'
  /** 评阅前用预览、评阅后用真实采集结果；job 里的记录跨页面保留 */
  const preview = job?.materials || materials || null
  const [elapsed, setElapsed] = useState(0)

  /** 编辑态：draft 是完整副本，取消即丢弃，不碰已保存的结果 */
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(null)
  /** 空串 / 'discard'（放弃修改） / 'restore'（恢复 AI 原结果） */
  const [confirmKind, setConfirmKind] = useState('')
  const editingFrom = useRef(null)

  const editedKeys = useMemo(() => new Set(editedDimensionKeys(review)), [review])

  useEffect(() => {
    if (!running) {
      setElapsed(0)
      return undefined
    }
    const started = job?.startedAt || Date.now()
    setElapsed(Math.round((Date.now() - started) / 1000))
    const t = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000)
    return () => clearInterval(t)
  }, [running, job?.startedAt])

  // 重新评阅产生了新结果（createdAt 变了）：编辑中的旧草稿立刻作废，避免把旧文本存到新结果上
  useEffect(() => {
    if (!editing) return
    if (review?.createdAt !== editingFrom.current) {
      setEditing(false)
      setDraft(null)
    }
  }, [review?.createdAt, editing])

  const errText = status === 'error' ? reviewErrorText(job?.code) : null

  // 文档或正文改过之后，旧评阅就过期了：结果还留着，但要提示重评
  const stale =
    Boolean(review) &&
    Boolean(work?.updatedAt) &&
    new Date(review.createdAt).getTime() < new Date(work.updatedAt).getTime()

  const startEdit = () => {
    editingFrom.current = review?.createdAt
    setDraft(editableDraft(review))
    setEditing(true)
  }

  const exitEdit = () => {
    setEditing(false)
    setDraft(null)
  }

  const cancelEdit = () => {
    const saved = editableDraft(review)
    if (draft && JSON.stringify(draft) !== JSON.stringify(saved)) {
      setConfirmKind('discard')
      return
    }
    exitEdit()
  }

  const saveDraft = (next) => {
    if (!next) return
    onSave?.(next)
    exitEdit()
  }

  const doRestore = () => {
    setConfirmKind('')
    onSave?.(restoreOriginalReview(review))
    exitEdit()
  }

  /** 未修改时按钮无意义，禁用而不是让它点了没反应 */
  const dirty = editing && draft ? JSON.stringify(draft) !== JSON.stringify(editableDraft(review)) : false

  return (
    <section
      className="card mb-6 overflow-hidden border border-black/[0.08] p-0"
      data-testid="review-panel"
      aria-label="AI 评阅"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-black/[0.07] bg-white px-5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-cha-50 text-cha-700">
            <Icon name="sparkle" size={13} />
          </span>
          <h2 className="font-serif text-[15px] font-bold text-ink">AI 评阅</h2>
          <span
            className="chip bg-dai-50 px-1.5 py-0 text-[10px] text-dai-700"
            title={`本次按《${shownRubric.name}》评分`}
            data-testid="review-rubric-badge"
          >
            {shownRubric.dimensions.length} 维 · {shownRubric.name}
          </span>
          {review?.edited && !editing && (
            <span
              className="chip bg-white px-1.5 py-0 text-[10px] text-ink-mute ring-1 ring-inset ring-black/[0.1]"
              title={`人工修订于 ${new Date(review.editedAt || review.createdAt).toLocaleString('zh-CN')}`}
              data-testid="review-edited-badge"
            >
              <Icon name="edit" size={9} />
              已人工修订
            </span>
          )}
          {editing && (
            <span className="chip bg-cha-50 px-1.5 py-0 text-[10px] text-cha-700" data-testid="review-editing-badge">
              编辑中
            </span>
          )}
          {review && !editing && (
            <span className="text-[11px] text-ink-mute">
              {review.model} · {review.source === 'mock' ? '示例模式' : 'DeepSeek'} ·{' '}
              {new Date(review.createdAt).toLocaleDateString('zh-CN')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {editing ? (
            <>
              <button
                type="button"
                onClick={() => saveDraft(applyReviewEdits(review, draft))}
                disabled={!dirty}
                className="btn-primary btn-xs"
                data-testid="review-edit-save"
              >
                <Icon name="check" size={12} />
                保存
              </button>
              <button type="button" onClick={cancelEdit} className="btn-ghost btn-xs" data-testid="review-edit-cancel">
                取消
              </button>
            </>
          ) : (
            <>
              {review && (
                <button type="button" onClick={startEdit} className="btn-ghost btn-xs" data-testid="review-edit-enter">
                  <Icon name="edit" size={12} />
                  编辑结果
                </button>
              )}
              {review && (
                <button type="button" onClick={onExport} className="btn-ghost btn-xs">
                  <Icon name="download" size={12} />
                  导出报告
                </button>
              )}
              {!configured ? (
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="btn-primary btn-xs"
                  data-testid="review-configure"
                >
                  <Icon name="sliders" size={12} />
                  先配置模型
                </button>
              ) : (
                /* 未评阅时右上角不出按钮：正文区已经有一个同样醒目的大按钮，
                   放两个同名按钮只会让人多点一次 */
                (review || running) && (
                  <button
                    type="button"
                    onClick={onStart}
                    disabled={running}
                    className="btn-ghost btn-xs"
                    data-testid="review-rerun"
                  >
                    <Icon name="refresh" size={12} className={running ? 'animate-spin' : ''} />
                    {running ? '评阅中…' : '重新评阅'}
                  </button>
                )
              )}
            </>
          )}
        </div>
      </header>

      <div className="px-5 py-4">
        {/* ---------- 评阅中 ---------- */}
        {running && (
          <div className="flex items-start gap-3" data-testid="review-running">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cha-50 text-cha-700">
              <Icon name="refresh" size={15} className="animate-spin" />
            </span>
            <div>
              <p className="text-[13.5px] font-medium text-ink">
                正在评阅，已用 {elapsed} 秒
                <span className="ml-1 text-[11.5px] font-normal text-ink-mute">通常 20–60 秒，长文或推理模型更久</span>
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-mute">
                模型会逐维对照量表、摘出原文证据后再给分。超过 2 分钟仍未返回时，系统会自动压缩正文并降低推理强度重试一次。
              </p>
              {preview?.label && <p className="mt-1.5 text-[11px] text-ink-mute">已提交：{preview.label}</p>}
            </div>
          </div>
        )}

        {/* ---------- 失败 ---------- */}
        {!running && status === 'error' && (
          <div className="rounded-xl border border-zhu-300 bg-zhu-50 p-3.5" data-testid="review-error">
            <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-zhu-700">
              <Icon name="warn" size={13} />
              {errText.title}
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">{errText.desc}</p>
            {job?.message && (
              <p className="mt-1 text-[11px] text-ink-mute">技术信息：{job.message}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {errText.action === 'settings' && (
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="btn-primary btn-xs"
                  data-testid="review-open-settings"
                >
                  <Icon name="sliders" size={12} />
                  打开设置
                </button>
              )}
              {errText.retry && (
                <button type="button" onClick={onStart} className="btn-ghost btn-xs">
                  <Icon name="refresh" size={12} />
                  重试
                </button>
              )}
            </div>
          </div>
        )}

        {/* ---------- 编辑态 ---------- */}
        {!running && status !== 'error' && review && editing && draft && (
          <ReviewEditor
            review={review}
            draft={draft}
            setDraft={setDraft}
            onSave={saveDraft}
            onCancel={cancelEdit}
            onRestore={() => setConfirmKind('restore')}
          />
        )}

        {/* ---------- 有结果 ---------- */}
        {!running && status !== 'error' && review && !editing && (
          <>
            {rubricSwitched && (
              <div
                className="mb-3 flex items-start gap-1.5 rounded-lg border border-cha-300 bg-cha-50 px-3 py-2 text-[12px] text-cha-700"
                data-testid="review-rubric-switched"
              >
                <Icon name="info" size={12} className="mt-0.5 shrink-0" />
                这份结果是按《{shownRubric.name}》评出来的；成果类型已改为需要《{rubric.name}》，
                重新评阅会改用后面的{shownRubric.dimensions.length !== rubric.dimensions.length
                  ? `${rubric.dimensions.length} 个维度`
                  : '标准'}
                ，两者分数不能直接比较。
              </div>
            )}

            {stale && (
              <div className="mb-3 flex items-start gap-1.5 rounded-lg border border-cha-300 bg-cha-50 px-3 py-2 text-[12px] text-cha-700">
                <Icon name="info" size={12} className="mt-0.5 shrink-0" />
                成果内容在评阅之后更新过，当前分数可能已不对应最新文本，建议重新评阅。
              </div>
            )}

            <ScoreRing
              total={review.total}
              dimsHint={review.edited ? '人工修订后按分项重新求和' : shownRubric.dimsHint}
              edited={review.edited}
            />

            <div className="mt-5 rounded-xl border border-black/[0.06] bg-paper-sunk p-4">
              <DimensionRows
                dimensions={review.dimensions}
                placeholder={dimensionsOf(shownRubric.key)}
                editedKeys={editedKeys}
              />
            </div>

            {review.edited && (
              <div
                className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-lg border border-cha-300 bg-cha-50 px-3 py-2 text-[11.5px] leading-relaxed text-cha-700"
                data-testid="review-edited-note"
              >
                <Icon name="edit" size={11} className="shrink-0" />
                <span className="min-w-0 flex-1">
                  本结果经人工修订（{new Date(review.editedAt || review.createdAt).toLocaleString('zh-CN')}
                  {review.editCount > 1 ? `，第 ${review.editCount} 次` : ''}），标 ✎ 的维度分数或评语已调整；
                  导出报告会一并标注修订项。重新评阅会覆盖这些修订。
                </span>
                {review.origin && (
                  <button
                    type="button"
                    onClick={() => setConfirmKind('restore')}
                    className="btn-ghost btn-xs shrink-0"
                    data-testid="review-restore-inline"
                  >
                    <Icon name="refresh" size={11} />
                    恢复 AI 原始结果
                  </button>
                )}
              </div>
            )}

            {(review.highlights || []).length > 0 && (
              <div className="mt-4">
                <h3 className="mb-1.5 flex items-center gap-1.5 font-serif text-[13px] font-bold text-ink">
                  <Icon name="award" size={12} className="text-cha-700" />
                  做得好的地方
                </h3>
                <ul className="space-y-1">
                  {review.highlights.map((h, i) => (
                    <li
                      key={`${i}-${h}`}
                      className="flex items-start gap-1.5 text-[12.5px] leading-relaxed text-ink-soft"
                    >
                      <Icon name="check" size={11} className="mt-1 shrink-0 text-cha-700" />
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-4">
              <h3 className="mb-1.5 flex items-center gap-1.5 font-serif text-[13px] font-bold text-ink">
                <Icon name="quote" size={12} className="text-dai-700" />
                总评
              </h3>
              <p className="whitespace-pre-wrap text-[13.5px] leading-[1.95] text-ink-soft">{review.summary}</p>
            </div>

            {(review.suggestions || []).length > 0 && (
              <div className="mt-4">
                <h3 className="mb-2 flex items-center gap-1.5 font-serif text-[13px] font-bold text-ink">
                  <Icon name="check" size={12} className="text-dai-700" />
                  改进建议
                  <span className="text-[11px] font-normal text-ink-mute">
                    {review.suggestions.length} 条
                  </span>
                </h3>
                <ol className="space-y-1.5">
                  {review.suggestions.map((s, i) => (
                    <li
                      key={`${i}-${s}`}
                      className="flex items-start gap-2 text-[13px] leading-relaxed text-ink-soft"
                      data-testid="review-suggestion"
                    >
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-dai-50 text-[10px] font-semibold text-dai-700 tabular-nums">
                        {i + 1}
                      </span>
                      {s}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {preview?.label && (
              <p className="mt-3 text-[11px] text-ink-mute" data-testid="review-materials-used">
                本次评阅材料：{preview.label}
              </p>
            )}

            {review.condensed ? (
              <p className="mt-3 rounded-lg bg-cha-50/70 px-2.5 py-1.5 text-[11px] leading-relaxed text-cha-700">
                注：原文 {Number(review.originalChars || 0).toLocaleString('zh-CN')} 字，超过单次评阅时限，
                本次实际评阅的是压缩到 {Number(review.inputChars || 0).toLocaleString('zh-CN')} 字的版本（保留了表格行与小标题，长段落各取开头）。
              </p>
            ) : review.truncated ? (
              <p className="mt-3 text-[11px] text-ink-mute">
                注：原文超过 3 万字，本次仅评阅了前 3 万字。
              </p>
            ) : null}
          </>
        )}

        {/* ---------- 未评阅 ---------- */}
        {!running && status !== 'error' && !review && (
          <div className="space-y-3">
            <MaterialList materials={preview} />
            {configured ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <button
                  type="button"
                  onClick={onStart}
                  className="btn-primary btn-xs"
                  data-testid="review-start"
                >
                  <Icon name="sparkle" size={13} />
                  评阅当前成果
                </button>
                <p className="text-[11.5px] leading-relaxed text-ink-mute">
                  按《{rubric.name}》{rubric.dimsHint}打分，约 20–60 秒。
                </p>
              </div>
            ) : (
              <div
                className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-dashed border-zhu-300 bg-zhu-50/60 px-3.5 py-3"
                data-testid="review-need-setup"
              >
                <p className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-ink-soft">
                  评阅需要先在网页里填入模型密钥，保存后立即生效，不需要改代码或重新部署。
                </p>
                <button type="button" onClick={onOpenSettings} className="btn-primary btn-xs">
                  <Icon name="sliders" size={12} />
                  打开设置
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmKind === 'discard'}
        title="放弃未保存的修改？"
        desc="当前编辑的内容不会保存，评阅结果仍是上次保存的版本。"
        confirmText="放弃修改"
        onCancel={() => setConfirmKind('')}
        onConfirm={() => {
          setConfirmKind('')
          exitEdit()
        }}
      />
      <ConfirmDialog
        open={confirmKind === 'restore'}
        title="恢复 AI 原始结果？"
        desc="将丢弃此前所有人工修订，分数、评语与建议全部回到模型最初生成的那一版。此操作不可撤销。"
        confirmText="恢复原结果"
        onCancel={() => setConfirmKind('')}
        onConfirm={doRestore}
      />
    </section>
  )
}
