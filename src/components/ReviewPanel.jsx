import { useEffect, useState } from 'react'
import Icon from './Icon'
import { dimensionsOf, gradeOf, reviewErrorText, rubricFor, rubricForKey } from '../lib/review'
import { useSettings } from '../hooks/useSettings'
import { isConfigured } from '../lib/settings'

/**
 * AI 评阅面板。
 *
 * 四种状态各自有明确的视觉，不给用户猜：
 * 未评阅（空态 + 开始按钮） / 评阅中（计时器，让他知道还在跑） / 失败（原因 + 是否可重试） / 有结果。
 *
 * 两个刻意的设计：
 * - **没配密钥这类不可恢复的错误，不显示重试按钮**，改成「去设置」。
 *   点了也不会好，给重试只会让人反复点、以为系统坏了。
 * - **评阅前先亮材料清单**。用户点「评阅」时最想知道的是「它到底评了什么」，
 *   所以把正文、文档、配图、未纳入项逐项列出，并说明这些内容取自本页、无需重传。
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

function ScoreRing({ total, dimsHint = '四维各 25 分' }) {
  const grade = gradeOf(total)
  const style = LEVEL_STYLE[grade] || LEVEL_STYLE.合格
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
        <p className="flex items-center gap-1.5 font-serif text-[15px] font-bold text-ink">
          <Icon name="award" size={14} className="text-cha-700" />
          总分 {total} / 100
          <span className={`chip ${style.chip} text-[10px]`}>{grade}</span>
        </p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-ink-mute">
          {dimsHint}，由模型逐维评分后求和；等级按总分区间派生。
        </p>
      </div>
    </div>
  )
}

function DimensionRows({ dimensions = [], placeholder = [] }) {
  const list = dimensions.length
    ? dimensions
    : placeholder.map((d) => ({ ...d, score: 0, level: '待改进', comment: '', evidence: '' }))
  return (
    <div className="space-y-4">
      {list.map((d) => {
        const style = LEVEL_STYLE[d.level] || LEVEL_STYLE.合格
        const pct = Math.max(2, Math.round((d.score / (d.max || 25)) * 100))
        return (
          <div key={d.key}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
              <p className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
                {d.name}
                <span className={`chip ${style.chip} px-1.5 py-0 text-[10px]`}>{d.level}</span>
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
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">{d.comment}</p>
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

export default function ReviewPanel({ work, review, job, materials, onStart, onExport, onOpenSettings }) {
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

  const errText = status === 'error' ? reviewErrorText(job?.code) : null

  // 文档或正文改过之后，旧评阅就过期了：结果还留着，但要提示重评
  const stale =
    Boolean(review) &&
    Boolean(work?.updatedAt) &&
    new Date(review.createdAt).getTime() < new Date(work.updatedAt).getTime()

  return (
    <section
      className="card mb-6 overflow-hidden border border-black/[0.08] p-0"
      data-testid="review-panel"
      aria-label="AI 评阅"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-black/[0.07] bg-white px-5 py-3">
        <div className="flex items-center gap-2">
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
          {review && (
            <span className="text-[11px] text-ink-mute">
              {review.model} · {review.source === 'mock' ? '示例模式' : 'DeepSeek'} ·{' '}
              {new Date(review.createdAt).toLocaleDateString('zh-CN')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
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

        {/* ---------- 有结果 ---------- */}
        {!running && status !== 'error' && review && (
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

            <ScoreRing total={review.total} dimsHint={shownRubric.dimsHint} />

            <div className="mt-5 rounded-xl border border-black/[0.06] bg-paper-sunk p-4">
              <DimensionRows dimensions={review.dimensions} placeholder={dimensionsOf(shownRubric.key)} />
            </div>

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
              <p className="text-[13.5px] leading-[1.95] text-ink-soft">{review.summary}</p>
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
    </section>
  )
}
