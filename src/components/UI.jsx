import { useState } from 'react'
import Icon from './Icon'
import { copyText } from '../lib/citation'
import { COLLECTION_MAP } from '../data/collections'
import { categoryMeta } from '../data/taxonomy'

/** 一键复制按钮：带成功态反馈 */
export function CopyButton({ text, label = '复制', className = 'btn-ghost btn-xs', onDone, iconName = 'copy' }) {
  const [done, setDone] = useState(false)
  const handle = async () => {
    const ok = await copyText(text)
    setDone(ok)
    onDone?.(ok)
    setTimeout(() => setDone(false), 1800)
  }
  return (
    <button type="button" onClick={handle} className={className} title={label}>
      <Icon name={done ? 'check' : iconName} size={14} />
      {done ? '已复制' : label}
    </button>
  )
}

/** 轻提示 */
export function Toast({ toast }) {
  if (!toast) return null
  const tone = {
    ok: 'bg-dai-700 text-paper-warm',
    warn: 'bg-zhu-700 text-white',
    info: 'bg-indigoSea-700 text-white'
  }[toast.tone || 'ok']
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[90] flex justify-center px-4 lg:bottom-8">
      <div
        className={`animate-rise flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium shadow-lift ${tone}`}
        role="status"
      >
        <Icon name={toast.tone === 'warn' ? 'warn' : 'check'} size={15} />
        {toast.message}
      </div>
    </div>
  )
}

/** 空态 */
export function Empty({ title = '暂无内容', desc, action, iconName = 'search' }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-black/12 bg-white/50 px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-dai-50 text-dai-500">
        <Icon name={iconName} size={26} />
      </div>
      <p className="font-serif text-lg font-semibold text-ink">{title}</p>
      {desc && <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-mute">{desc}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/** 分类徽标（跨专题统一：传 collection + category 即可；兼容旧调用传入 tokens） */
export function CategoryChip({ collection, category, name, size = 'sm', tokens }) {
  const meta = categoryMeta(collection, category)
  const t = tokens || meta.tokens
  return (
    <span className={`chip ${t.bg} ${t.fg} ${size === 'xs' ? 'text-[11px]' : ''}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
      {name || meta.name}
    </span>
  )
}

/** 专题徽标 —— 让用户随时知道这条内容来自哪一馆 */
export function CollectionBadge({ collection, solid = false, className = '' }) {
  const c = COLLECTION_MAP[collection]
  if (!c) return null
  return solid ? (
    <span className={`chip ${c.accent.bgSolid} text-paper-warm ${className}`}>
      <Icon name={c.icon} size={11} />
      {c.short}
    </span>
  ) : (
    <span className={`chip ${c.accent.bg} ${c.accent.text} ${className}`}>
      <Icon name={c.icon} size={11} />
      {c.short}
    </span>
  )
}

/** 区块标题 */
export function SectionTitle({ title, sub, right, eyebrow, tone = 'sea' }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-dai-700">{eyebrow}</p>
        )}
        <h2 className="sec-title">{title}</h2>
        {sub && <p className="sec-sub">{sub}</p>}
        <div className={tone === 'cha' ? 'ridge-cha mt-4' : 'ridge mt-4'} />
      </div>
      {right}
    </div>
  )
}

/** 分段控件（专题 / 视图切换） */
export function Segmented({ options, value, onChange, size = 'sm' }) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl border border-black/10 bg-white p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`shrink-0 whitespace-nowrap rounded-lg px-3 ${size === 'xs' ? 'py-1 text-[12px]' : 'py-1.5 text-[13px]'} font-medium transition-colors ${
            value === o.id ? 'bg-dai-700 text-paper-warm shadow-sm' : 'text-ink-mute hover:text-dai-700'
          }`}
        >
          {o.name}
          {o.count != null && (
            <span className={`ml-1.5 text-[11px] ${value === o.id ? 'text-paper/60' : 'text-ink-mute/60'}`}>
              {o.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

/** 确认对话框 */
export function ConfirmDialog({ open, title, desc, confirmText = '确认删除', onConfirm, onCancel }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="animate-rise relative w-full max-w-md rounded-2xl border border-black/8 bg-paper-warm p-6 shadow-lift">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-zhu-50 text-zhu-500">
            <Icon name="warn" size={18} />
          </span>
          <h3 className="font-serif text-lg font-semibold text-ink">{title}</h3>
        </div>
        {desc && <p className="text-sm leading-relaxed text-ink-mute">{desc}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onCancel}>
            取消
          </button>
          <button className="btn-zhu" onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

/** 模态容器 */
export function Modal({ open, onClose, title, desc, children, footer, wide }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto p-4 py-8 sm:items-center sm:py-4">
      <div className="fixed inset-0 bg-ink/45 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`animate-rise relative w-full ${wide ? 'max-w-3xl' : 'max-w-2xl'} rounded-2xl border border-black/8 bg-paper-warm shadow-lift`}
        role="dialog"
        aria-modal="true"
      >
        <header className="flex items-start justify-between gap-4 border-b border-black/[0.07] px-6 py-4">
          <div>
            <h3 className="font-serif text-lg font-semibold text-ink">{title}</h3>
            {desc && <p className="mt-1 text-xs leading-relaxed text-ink-mute">{desc}</p>}
          </div>
          <button className="btn-quiet -mr-2 -mt-1 shrink-0" onClick={onClose} aria-label="关闭">
            <Icon name="close" size={18} />
          </button>
        </header>
        <div className="max-h-[68vh] overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <footer className="flex flex-wrap justify-end gap-2 border-t border-black/[0.07] px-6 py-4">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}

/** 统计数字块 */
export function Stat({ label, value, iconName, tone = 'dai', hint }) {
  const tones = {
    dai: 'bg-dai-50 text-dai-700',
    sea: 'bg-indigoSea-50 text-indigoSea-700',
    zhu: 'bg-zhu-50 text-zhu-700',
    cha: 'bg-cha-50 text-cha-700',
    tan: 'bg-tan-100 text-tan-700'
  }
  return (
    <div className="card flex items-center gap-3 px-4 py-3.5">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>
        <Icon name={iconName} size={19} />
      </span>
      <div className="min-w-0">
        <p className="font-serif text-xl font-bold leading-tight text-ink">{value}</p>
        <p className="truncate text-xs text-ink-mute">
          {label}
          {hint && <span className="ml-1 text-ink-mute/60">{hint}</span>}
        </p>
      </div>
    </div>
  )
}
