import { useRef, useState } from 'react'
import Icon from './Icon'
import DocViewer from './DocViewer'
import { DOC_ACCEPT, DOC_LIMITS, docErrorText, parseDocument, readDocFile } from '../lib/docs'
import { formatBytes } from '../lib/images'

/**
 * 成果文档上传区。
 *
 * 交互骨架照搬 ImageField（隐藏 input + 拖拽 + 错误条 + 移除），
 * 但有三处不同，都是文档特有的：
 *
 * 1) **解析是异步且慢的**（一份 20 页 PDF 要几秒），所以有三个阶段的进度文案，
 *    而不是一个转圈图标——用户要知道它卡在哪一步。
 * 2) **解析完不等于成功**，还要看提取到多少字。扫描件 PDF 会"解析成功但 0 字"，
 *    这种情况必须当成错误处理，否则上传完评阅会拿到空文本。
 * 3) **原件可选下载**。文本已经存好了，原件只用于"我传错了要拿回来看看"，
 *    超过 10MB 就不存，避免 IndexedDB 被几份 PDF 塞满。
 */

const STAGE_TEXT = {
  reading: '正在读取文件…',
  parsing: '正在解析文档…',
  persisting: '正在写入本地仓库…'
}

export function DocField({ value, onChange, onFillContent, contentEmpty = true }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [state, setState] = useState('idle') // idle | parsing | ready | error
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState(null)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [fillHint, setFillHint] = useState(false)

  const doc = value || null
  const ready = Boolean(doc) && state !== 'parsing'

  const reset = () => {
    setState('idle')
    setProgress(null)
    setError(null)
    setFillHint(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleFile = async (file) => {
    if (!file) return
    setError(null)
    setState('parsing')
    setProgress({ stage: 'reading', pct: 3 })
    try {
      const { doc: parsed } = await parseDocument(file, {
        onProgress: (p) => setProgress(p)
      })
      onChange(parsed)
      setState('ready')
      setProgress(null)
    } catch (e) {
      const info = docErrorText(e?.code || 'PARSE_FAILED', e?.detail || '')
      setError({ ...info, code: e?.code || 'PARSE_FAILED' })
      setState('error')
      setProgress(null)
      onChange(null)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const onPick = (e) => {
    const f = e.target.files && e.target.files[0]
    if (f) handleFile(f)
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer?.files && e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  const remove = () => {
    onChange(null)
    reset()
  }

  const download = async () => {
    const blob = await readDocFile(doc)
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = doc.name || 'document'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  }

  const fill = async () => {
    if (!onFillContent) return
    const { readDocText } = await import('../lib/docs')
    const text = await readDocText(doc)
    if (text) {
      onFillContent(text)
      setFillHint(true)
    }
  }

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="field-label mb-0">成果文档</span>
        <span className="text-[11px] text-ink-mute">PDF / DOCX / TXT / MD，单选</span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={DOC_ACCEPT}
        onChange={onPick}
        className="hidden"
        data-testid="doc-input"
        aria-label="上传成果文档"
      />

      {/* ---------- 已就绪 ---------- */}
      {ready ? (
        <div
          className="rounded-xl border border-black/[0.09] bg-white p-3.5"
          data-testid="doc-status"
          data-state="ready"
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-dai-50 text-dai-700">
              <Icon name={doc.kind === 'pdf' ? 'doc' : doc.kind === 'docx' ? 'book' : 'scroll'} size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-serif text-[13.5px] font-semibold text-ink" title={doc.name}>
                {doc.name}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-ink-mute" data-testid="doc-meta">
                <span className="chip bg-black/[0.04] px-1.5 py-0 text-[10px] uppercase">{doc.kind}</span>
                {doc.pages ? <span>{doc.pages} 页</span> : null}
                <span>{doc.chars.toLocaleString('zh-CN')} 字</span>
                <span>{formatBytes(doc.bytes)}</span>
                {doc.truncated && (
                  <span className="chip bg-cha-50 px-1.5 py-0 text-[10px] text-cha-700">
                    超出 {DOC_LIMITS.maxChars / 10000} 万字，已截断
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <button type="button" onClick={() => setViewerOpen(true)} className="btn-ghost btn-xs">
              <Icon name="eye" size={12} />
              查看解析文本
            </button>
            {doc.fileRef && (
              <button type="button" onClick={download} className="btn-ghost btn-xs">
                <Icon name="download" size={12} />
                下载原件
              </button>
            )}
            {onFillContent && (
              <button type="button" onClick={fill} className="btn-ghost btn-xs">
                <Icon name="edit" size={12} />
                填入正文
              </button>
            )}
            <button type="button" onClick={remove} className="btn-quiet btn-xs text-zhu-700">
              <Icon name="trash" size={12} />
              移除文档
            </button>
          </div>
          {fillHint && (
            <p className="mt-2 text-[11px] text-dai-700">
              已把解析文本填入下方「正文」，可继续编辑。
            </p>
          )}
          {!contentEmpty && fillHint === false && onFillContent && (
            <p className="mt-2 text-[11px] text-ink-mute">
              提示：正文框已有内容，「填入正文」会用解析文本覆盖它。
            </p>
          )}
        </div>
      ) : null}

      {/* ---------- 解析中 ---------- */}
      {state === 'parsing' && (
        <div
          className="rounded-xl border border-dai-300 bg-dai-50/60 p-4"
          data-testid="doc-status"
          data-state="parsing"
        >
          <div className="flex items-center gap-2 text-[13px] text-dai-700">
            <Icon name="refresh" size={15} className="animate-spin" />
            {STAGE_TEXT[progress?.stage] || '正在处理…'}
            {progress?.stage === 'parsing' && progress.pages ? (
              <span className="tabular-nums text-[11.5px] text-ink-mute">
                第 {progress.page || 0} / {progress.pages} 页
              </span>
            ) : null}
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-dai-100">
            <div
              className="h-full rounded-full bg-dai-700 transition-all"
              style={{ width: `${Math.max(4, progress?.pct || 4)}%` }}
            />
          </div>
        </div>
      )}

      {/* ---------- 空态 / 拖拽区 ---------- */}
      {!ready && state !== 'parsing' && (
        <button
          type="button"
          onClick={() => inputRef.current && inputRef.current.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed px-4 py-6 text-center transition-colors ${
            dragging
              ? 'border-dai-500 bg-dai-50'
              : 'border-black/[0.16] bg-paper-sunk hover:border-dai-300 hover:bg-white'
          }`}
        >
          <Icon name="upload" size={20} className="text-ink-mute" />
          <span className="text-[13px] font-medium text-ink-soft">拖入或点击上传成果文档</span>
          <span className="text-[11.5px] leading-relaxed text-ink-mute">
            支持 PDF（≤20MB）、DOCX（≤10MB）、TXT / MD（≤5MB）；旧版 .doc 请先另存为 .docx
          </span>
        </button>
      )}

      {/* ---------- 错误 ---------- */}
      {error && (
        <div
          className="mt-2 rounded-xl border border-zhu-300 bg-zhu-50 p-3"
          data-testid="doc-error"
          data-code={error.code}
        >
          <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-zhu-700">
            <Icon name="warn" size={13} />
            {error.title}
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">{error.desc}</p>
          <button
            type="button"
            onClick={() => {
              reset()
              if (inputRef.current) inputRef.current.click()
            }}
            className="btn-ghost btn-xs mt-2"
          >
            {error.action || '重新选择'}
          </button>
        </div>
      )}

      <DocViewer doc={doc} open={viewerOpen} onClose={() => setViewerOpen(false)} />
    </div>
  )
}

export default DocField
