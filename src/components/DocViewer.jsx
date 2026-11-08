import { useEffect, useState } from 'react'
import { Modal, CopyButton } from './UI'
import Icon from './Icon'
import { readDocText } from '../lib/docs'

/**
 * 解析文本查看器。
 *
 * 为什么不直接把原文渲染成富文本：我们只有纯文本，任何"还原排版"都是猜的。
 * 这里如实展示解析结果，并明说「排版已丢失」——用户看到的是评阅模型看到的东西，
 * 出了偏差能立刻发现（比如扫描件解析成空、表格错行）。
 */
export default function DocViewer({ doc, open, onClose }) {
  const [text, setText] = useState('')
  const [state, setState] = useState('idle') // idle | loading | ready | empty

  useEffect(() => {
    if (!open || !doc) return undefined
    let alive = true
    setState('loading')
    setText('')
    readDocText(doc)
      .then((t) => {
        if (!alive) return
        setText(t || '')
        setState(t ? 'ready' : 'empty')
      })
      .catch(() => {
        if (alive) setState('empty')
      })
    return () => {
      alive = false
    }
  }, [open, doc])

  const chars = text.replace(/\s/g, '').length

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={doc ? doc.name : '解析文本'}
      desc="以下是把文档转成的纯文本，也是 AI 评阅实际读到的内容；原始排版在此已丢失。"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] text-ink-mute">
            {state === 'ready' ? `${chars.toLocaleString('zh-CN')} 字` : state === 'loading' ? '读取中…' : '—'}
            {doc?.truncated ? ' · 已截断' : ''}
          </span>
          <div className="flex gap-2">
            {state === 'ready' && <CopyButton text={text} label="复制全文" className="btn-ghost btn-xs" />}
            <button type="button" onClick={onClose} className="btn-primary btn-xs">
              关闭
            </button>
          </div>
        </div>
      }
    >
      {state === 'loading' && (
        <div className="flex items-center gap-2 py-10 text-[13px] text-ink-mute">
          <Icon name="refresh" size={16} className="animate-spin" />
          正在读取本地解析结果…
        </div>
      )}
      {state === 'empty' && (
        <div className="rounded-xl border border-zhu-300 bg-zhu-50/60 p-4 text-[13px] leading-relaxed text-zhu-700">
          这份文档的解析文本已不在本地（可能被浏览器清理，或换过设备）。
          请重新上传原文件，或直接把正文粘贴到「正文」框。
        </div>
      )}
      {state === 'ready' && (
        <pre className="whitespace-pre-wrap break-words rounded-xl border border-black/[0.07] bg-paper-sunk p-4 font-sans text-[13px] leading-[1.9] text-ink-soft">
          {text}
        </pre>
      )}
    </Modal>
  )
}
