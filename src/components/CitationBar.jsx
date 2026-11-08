import { useState } from 'react'
import Icon from './Icon'
import { CopyButton } from './UI'
import { buildCitation, buildExportText, buildShareLink, downloadText } from '../lib/citation'
import { useStore } from '../hooks/useStore'

const STYLES = [
  { id: 'gbt', name: '规范引用' },
  { id: 'brief', name: '简明注记' }
]

/**
 * 引用工具条 —— 三馆内容统一从这里取引用文本。
 * 格式按专题自动切换（图录 / 展项 / 电子资源），用户只需选「规范」或「简明」。
 */
export default function CitationBar({ entry, compact = false }) {
  const [style, setStyle] = useState('gbt')
  const { inSelection, toggleSelection, notify } = useStore()
  const text = buildCitation(entry, { style })
  const share = buildShareLink(entry)
  const on = inSelection(entry.id)

  return (
    <section className={`rounded-2xl border border-black/[0.07] bg-white ${compact ? 'p-3.5' : 'p-4'}`}>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 font-serif text-[13.5px] font-bold text-ink">
          <Icon name="quote" size={14} />
          引用本条
        </h3>
        <div className="flex rounded-lg bg-black/[0.04] p-0.5">
          {STYLES.map((s) => (
            <button
              key={s.id}
              onClick={() => setStyle(s.id)}
              className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                style === s.id ? 'bg-white text-ink shadow-sm' : 'text-ink-mute hover:text-ink'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      <p className="select-all rounded-xl border border-dashed border-black/10 bg-paper-sunk p-2.5 text-[12px] leading-[1.75] text-ink-soft">
        {text}
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <CopyButton text={text} label="复制引用" className="btn-ghost btn-xs" iconName="copy" />
        <CopyButton text={share} label="复制链接" className="btn-ghost btn-xs" iconName="link" />
        <button
          onClick={() => {
            downloadText(`文脉馆-${entry.id}-${entry.title.slice(0, 12)}.md`, buildExportText(entry))
            notify('已导出本条 Markdown')
          }}
          className="btn-ghost btn-xs"
          title="导出为 Markdown"
        >
          <Icon name="download" size={13} />
          导出
        </button>
        <button
          onClick={() => toggleSelection(entry.id)}
          className={`btn-xs ${on ? 'btn-zhu' : 'btn-primary'}`}
          title={on ? '从选辑移除' : '加入教学选辑'}
        >
          <Icon name="basket" size={13} />
          {on ? '已在选辑' : '加入选辑'}
        </button>
      </div>
    </section>
  )
}
