import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../hooks/useStore'
import { workTypeName } from '../data/taxonomy'
import { ConfirmDialog, CopyButton, Empty } from '../components/UI'
import { useResolvedImage } from '../components/MaterialCard'
import { buildCitation, buildShareLink, copyText, downloadText } from '../lib/citation'
import ReviewPanel from '../components/ReviewPanel'
import DocViewer from '../components/DocViewer'
import { buildReviewMarkdown } from '../lib/review'
import { previewMaterials } from '../lib/review-materials'
import { requestOpenSettings } from '../lib/settings'
import { readDocFile } from '../lib/docs'
import { formatBytes } from '../lib/images'
import Icon from '../components/Icon'

export default function WorkDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { works, removeWork, reviews, reviewJobs, startReview, notify } = useStore()
  const [confirm, setConfirm] = useState(false)
  const [copied, setCopied] = useState('')
  const [viewerIdx, setViewerIdx] = useState(-1)

  const work = works.find((w) => w.id === id)
  const coverSrc = useResolvedImage(work?.image)
  const review = work ? reviews[work.id] : null
  const reviewJob = work ? reviewJobs[work.id] : null

  const siblings = useMemo(
    () => (work ? works.filter((w) => w.id !== work.id && (w.author === work.author || w.semester === work.semester)).slice(0, 3) : []),
    [works, work]
  )

  /**
   * 评阅材料预览。只算元信息、不读 IndexedDB：
   * 详情页首屏不该为了「列一下会评什么」而去解一份 20MB 的 PDF。
   * 真正点下按钮时才由 startReview 去做完整采集。
   */
  const materialPreview = useMemo(() => (work ? previewMaterials(work) : null), [work])

  if (!work) {
    return (
      <div className="wrap py-20">
        <Empty
          iconName="warn"
          title="未找到该成果"
          desc={`编号 ${id} 对应的成果可能已被移除或链接有误。`}
          action={
            <Link to="/works" className="btn-primary">
              <Icon name="back" size={15} />
              返回成果库
            </Link>
          }
        />
      </div>
    )
  }

  const citation = buildCitation(
    {
      title: work.title,
      category: workTypeName(work.type),
      region: work.course || '宁德开放大学',
      level: `${work.grade} · ${work.semester}`,
      source: `学生成果，作者：${work.author}${work.course ? `，课程：${work.course}` : ''}，收录于闽东本土文化知识库`,
      sourceUrl: '',
      updatedAt: work.updatedAt
    },
    { style: 'brief', categoryLabel: `学生成果 · ${workTypeName(work.type)}` }
  )

  const shareLink = buildShareLink(work)
  const paragraphs = String(work.content || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
  const docs = Array.isArray(work.docs) ? work.docs : []

  const handleCopy = async (key, text) => {
    const ok = await copyText(text)
    setCopied(ok ? key : '')
    setTimeout(() => setCopied(''), 1800)
  }

  const runReview = () => {
    // 面板自己会渲染失败态，这里只需要吞掉 rejection，避免控制台报未捕获
    startReview(work.id, { force: true }).catch(() => {})
  }

  const exportReview = () => {
    if (!review) return
    downloadText(`${work.id}-${work.title}-AI评阅.md`, buildReviewMarkdown(review, work))
  }

  const downloadDoc = async (doc) => {
    const blob = await readDocFile(doc)
    if (!blob) {
      notify('原件已不在本地存储中，仅解析文本可用', 'warn')
      return
    }
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = doc.name || 'document'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  }

  return (
    <article className="animate-seep">
      <div className="relative border-b border-black/[0.06] bg-gradient-to-br from-dai-700 to-indigoSea-900 text-paper">
        {coverSrc && (
          <>
            <img
              src={coverSrc}
              alt=""
              className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-25"
              aria-hidden="true"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-dai-700/85 to-indigoSea-900/90" />
          </>
        )}
        <div className="wrap relative py-9">
          <nav className="mb-5 flex items-center gap-1.5 text-xs text-paper/55" aria-label="面包屑">
            <Link to="/" className="hover:text-paper">首页</Link>
            <span className="opacity-40">/</span>
            <Link to="/works" className="hover:text-paper">学生成果</Link>
            <span className="opacity-40">/</span>
            <span className="truncate text-paper/80">{work.title}</span>
          </nav>

          <div className="flex flex-wrap items-center gap-2">
            <span className="chip bg-paper/15 text-paper">
              <Icon name={work.type} size={12} />
              {workTypeName(work.type)}
            </span>
            <span className="chip bg-paper/15 text-paper">{work.semester}</span>
            <span className="chip bg-paper/15 text-paper">{work.grade}</span>
            {review && <span className="chip bg-paper/15 text-paper">AI 评阅 {review.total} 分</span>}
            <span className="font-mono text-[11px] text-paper/45">{work.id}</span>
          </div>

          <h1 className="mt-4 font-serif text-[26px] font-bold leading-[1.3] tracking-tight sm:text-[34px]">
            {work.title}
          </h1>

          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-paper/70">
            <span className="flex items-center gap-1.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-paper/20 font-serif text-[12px] font-bold text-paper">
                {work.author.slice(0, 1)}
              </span>
              {work.author}
            </span>
            {work.course && (
              <span className="flex items-center gap-1.5">
                <Icon name="book" size={14} />
                {work.course}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Icon name="calendar" size={14} />
              提交于 {work.createdAt}
            </span>
          </div>
        </div>
      </div>

      {/* 操作条 */}
      <div className="sticky top-16 z-30 border-b border-black/[0.07] bg-paper/90 backdrop-blur-xl no-print">
        <div className="wrap flex flex-wrap items-center gap-2 py-3">
          <button onClick={() => handleCopy('cite', citation)} className="btn-primary btn-xs sm:px-3.5 sm:py-2 sm:text-sm">
            <Icon name={copied === 'cite' ? 'check' : 'copy'} size={14} />
            {copied === 'cite' ? '已复制引用' : '复制引用信息'}
          </button>
          <button onClick={() => handleCopy('link', shareLink)} className="btn-ghost btn-xs sm:px-3.5 sm:py-2 sm:text-sm">
            <Icon name={copied === 'link' ? 'check' : 'link'} size={14} />
            {copied === 'link' ? '已复制链接' : '生成分享链接'}
          </button>
          <button
            onClick={() =>
              downloadText(
                `${work.title}.txt`,
                `${work.title}\n\n作者：${work.author}\n学期：${work.semester}\n学段：${work.grade}\n课程：${work.course}\n类型：${workTypeName(work.type)}\n\n${work.summary}\n\n${work.content}`
              )
            }
            className="btn-ghost btn-xs sm:px-3.5 sm:py-2 sm:text-sm"
          >
            <Icon name="download" size={14} />
            导出
          </button>
          <div className="ml-auto flex gap-2">
            <Link to={`/works/new/${work.id}`} className="btn-ghost btn-xs sm:px-3.5 sm:py-2 sm:text-sm">
              <Icon name="edit" size={14} />
              编辑
            </Link>
            <button
              onClick={() => setConfirm(true)}
              className="btn-ghost btn-xs text-zhu-700 sm:px-3.5 sm:py-2 sm:text-sm"
            >
              <Icon name="trash" size={14} />
              移除
            </button>
          </div>
        </div>
      </div>

      <div className="wrap grid gap-10 py-10 lg:grid-cols-[1.6fr_1fr]">
        <div>
          <div className="card mb-6 border-l-4 border-l-dai-500 p-5">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-dai-500">
              <Icon name="sparkle" size={12} />
              成果简介
            </p>
            <p className="text-[15px] leading-[1.9] text-ink-soft">{work.summary}</p>
          </div>

          {/* 评阅紧跟简介：这是教师/学生最关心的结论，不该埋到长正文后面 */}
          <ReviewPanel
            work={work}
            review={review}
            job={reviewJob}
            materials={materialPreview}
            onStart={runReview}
            onExport={exportReview}
            onOpenSettings={requestOpenSettings}
          />

          {paragraphs.length > 0 && (
            <>
              <h2 className="mb-4 flex items-center gap-2 font-serif text-xl font-bold text-ink">
                <span className="ridge !w-8" />
                作品正文
              </h2>
              <div className="space-y-3.5">
                {paragraphs.map((p, i) => {
                  // 简易小标题识别：以「一、」「1.」「【】」开头则加粗
                  const isHeading = /^([一二三四五六七八九十]+[、.]|\d+[.、]|【.+】)/.test(p)
                  return isHeading ? (
                    <h3 key={i} className="pt-2 font-serif text-[15px] font-bold text-ink">
                      {p}
                    </h3>
                  ) : (
                    <p key={i} className="text-[15px] leading-[1.9] text-ink-soft">
                      {p}
                    </p>
                  )
                })}
              </div>
            </>
          )}

          {work.attachedUrl && (
            <div className="mt-8">
              <h2 className="mb-3 flex items-center gap-2 font-serif text-xl font-bold text-ink">
                <span className="ridge !w-8" />
                附件
              </h2>
              {work.type === 'image' ? (
                <img
                  src={work.attachedUrl}
                  alt={work.title}
                  className="w-full rounded-2xl border border-black/[0.07] shadow-card"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              ) : work.type === 'audio' ? (
                <audio controls src={work.attachedUrl} className="w-full" />
              ) : work.type === 'video' ? (
                <video controls src={work.attachedUrl} className="w-full rounded-2xl border border-black/[0.07]" />
              ) : null}
              <a
                href={work.attachedUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-2.5 inline-flex items-center gap-1 text-xs text-indigoSea-700 hover:underline"
              >
                <Icon name="external" size={12} />
                在新窗口打开发布地址
              </a>
            </div>
          )}

          {/* 成果文档：原件、解析文本与元信息 */}
          {docs.length > 0 && (
            <div className="mt-8">
              <h2 className="mb-3 flex items-center gap-2 font-serif text-xl font-bold text-ink">
                <span className="ridge !w-8" />
                成果文档
              </h2>
              <ul className="space-y-2.5">
                {docs.map((doc, i) => (
                  <li
                    key={doc.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-black/[0.08] bg-white/70 p-3.5"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-dai-50 text-dai-700">
                      <Icon name={doc.kind === 'pdf' ? 'doc' : doc.kind === 'docx' ? 'book' : 'scroll'} size={17} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-serif text-[13.5px] font-semibold text-ink" title={doc.name}>
                        {doc.name}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-ink-mute">
                        <span className="chip bg-black/[0.04] px-1.5 py-0 text-[10px] uppercase">{doc.kind}</span>
                        {doc.pages ? <span>{doc.pages} 页</span> : null}
                        <span>{doc.chars.toLocaleString('zh-CN')} 字</span>
                        <span>{formatBytes(doc.bytes)}</span>
                        {doc.truncated && <span className="text-cha-700">已截断</span>}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <button type="button" onClick={() => setViewerIdx(i)} className="btn-ghost btn-xs">
                        <Icon name="eye" size={12} />
                        解析文本
                      </button>
                      {doc.fileRef && (
                        <button type="button" onClick={() => downloadDoc(doc)} className="btn-ghost btn-xs">
                          <Icon name="download" size={12} />
                          原件
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(work.tags || []).length > 0 && (
            <div className="mt-8 border-t border-black/[0.07] pt-6">
              <p className="mb-3 flex items-center gap-1.5 text-xs font-medium text-ink-soft">
                <Icon name="tag" size={13} />
                关键词
              </p>
              <div className="flex flex-wrap gap-2">
                {work.tags.map((t) => (
                  <Link key={t} to={`/works?q=${encodeURIComponent(t)}`} className="chip-tag">
                    #{t}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-5">
          <div className="card p-4">
            <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink">
              <Icon name="copy" size={15} className="text-dai-500" />
              引用信息
            </p>
            <pre className="whitespace-pre-wrap break-words rounded-xl border border-black/[0.07] bg-white/80 p-3.5 text-[12px] leading-[1.85] text-ink-soft">
              {citation}
            </pre>
            <CopyButton text={citation} label="复制引用" className="btn-primary btn-xs mt-3 w-full" />
          </div>

          <div className="card p-4">
            <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink">
              <Icon name="info" size={15} className="text-cha-500" />
              成果信息
            </p>
            <dl className="space-y-2 text-[13px]">
              {[
                ['作者', work.author],
                ['学段', work.grade],
                ['学期', work.semester],
                ['关联课程', work.course || '—'],
                ['成果类型', workTypeName(work.type)],
                ['成果文档', docs.length ? `${docs[0].kind.toUpperCase()} · ${docs[0].chars} 字` : '未上传'],
                ['AI 评阅', review ? `${review.total} / 100` : '未评阅'],
                ['提交日期', work.createdAt],
                ['最近更新', work.updatedAt]
              ].map(([k, v]) => (
                <div key={k} className="flex gap-3">
                  <dt className="w-16 shrink-0 text-ink-mute">{k}</dt>
                  <dd className="min-w-0 flex-1 text-ink-soft">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          {siblings.length > 0 && (
            <div className="card p-4">
              <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink">
                <Icon name="award" size={15} className="text-zhu-500" />
                相关成果
              </p>
              <ul className="space-y-2.5">
                {siblings.map((s) => (
                  <li key={s.id}>
                    <Link
                      to={`/works/${s.id}`}
                      className="flex items-start gap-2 text-[13px] leading-snug text-ink-soft hover:text-dai-700"
                    >
                      <Icon name={s.type} size={14} className="mt-0.5 shrink-0 text-ink-mute" />
                      <span className="line-clamp-2">{s.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>

      <DocViewer
        doc={viewerIdx >= 0 ? docs[viewerIdx] : null}
        open={viewerIdx >= 0}
        onClose={() => setViewerIdx(-1)}
      />

      <ConfirmDialog
        open={confirm}
        title="确认移除该成果？"
        desc={`将移除《${work.title}》（作者：${work.author}），连同上传的文档与评阅结果。此操作不可撤销。`}
        confirmText="确认移除"
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false)
          removeWork(work.id)
          nav('/works')
        }}
      />
    </article>
  )
}
