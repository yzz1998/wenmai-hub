import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from './Icon'
import { CollectionBadge, CopyButton } from './UI'
import { SmartImage } from './Media'
import { asset } from '../lib/assets'
import { useStore } from '../hooks/useStore'
import { buildSelectionText, buildShareLink, downloadText } from '../lib/citation'
import { COLLECTIONS } from '../data/collections'

/**
 * 教学选辑 —— 三馆合并后才成立的能力。
 *
 * 以前每个站点的内容只能在自己的站点里被"收藏"。合并后，
 * 「剪纸的凤凰纹样 + 畲族的凤凰装 + 知识库的畲族服饰条目」可以放进同一个选辑，
 * 一键导出成备课素材包。这是把三个库连成一个库最实用的落点。
 */
export default function SelectionDrawer({ open, onClose }) {
  const { selectedEntries, removeFromSelection, clearSelection, notify } = useStore()
  const nav = useNavigate()

  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  const groups = COLLECTIONS.map((c) => ({
    ...c,
    items: selectedEntries.filter((e) => e.collection === c.id)
  })).filter((g) => g.items.length)

  const exportText = () => {
    if (!selectedEntries.length) return
    downloadText(`文脉馆-教学选辑-${new Date().toISOString().slice(0, 10)}.md`, buildSelectionText(selectedEntries))
    notify('选辑已导出为 Markdown')
  }

  const copyLinks = () => {
    const text = selectedEntries.map((e) => `${e.title}\n${buildShareLink(e)}`).join('\n\n')
    navigator.clipboard?.writeText(text).then(
      () => notify('已复制选辑链接'),
      () => notify('复制失败，请手动选择', 'warn')
    )
  }

  return (
    <div className="fixed inset-0 z-[78] flex justify-end" role="dialog" aria-modal="true" aria-label="教学选辑">
      <div className="absolute inset-0 bg-ink/45 backdrop-blur-sm" onClick={onClose} />
      <aside className="animate-rise relative flex h-full w-full max-w-md flex-col border-l border-black/10 bg-paper-warm shadow-lift">
        <header className="flex items-start justify-between gap-3 border-b border-black/[0.07] px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 font-serif text-lg font-bold text-ink">
              <Icon name="basket" size={17} />
              教学选辑
            </h2>
            <p className="mt-1 text-xs text-ink-mute">
              跨专题收集条目，可导出为备课素材包（{selectedEntries.length} 条）
            </p>
          </div>
          <button className="btn-quiet -mr-2 -mt-1" onClick={onClose} aria-label="关闭">
            <Icon name="close" size={18} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {selectedEntries.length === 0 ? (
            <div className="mt-10 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-dai-50 text-dai-500">
                <Icon name="basket" size={24} />
              </div>
              <p className="font-serif text-base font-semibold text-ink">选辑还是空的</p>
              <p className="mx-auto mt-2 max-w-xs text-[13px] leading-relaxed text-ink-mute">
                在任意专题的条目卡片上点
                <Icon name="basket" size={12} className="mx-1 inline align-[-1px]" />
                即可加入。剪纸图样、畲族展项、知识素材可以混装在一起。
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {groups.map((g) => (
                <section key={g.id}>
                  <div className="mb-2 flex items-center gap-2">
                    <CollectionBadge collection={g.id} />
                    <span className="text-[11px] text-ink-mute">{g.items.length} 条</span>
                  </div>
                  <ul className="space-y-2">
                    {g.items.map((e) => (
                      <li
                        key={e.id}
                        className="group flex items-center gap-2.5 rounded-xl border border-black/[0.06] bg-white/70 p-2 transition-colors hover:border-dai-300"
                      >
                        <button
                          onClick={() => {
                            nav(`/entry/${e.id}`)
                            onClose()
                          }}
                          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                        >
                          <span className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-paper-sunk">
                            <SmartImage
                              src={e.media?.[0]?.src ? asset(e.media[0].src) : ''}
                              alt={e.title}
                              ratio="h-full"
                            />
                          </span>
                          <span className="min-w-0">
                            <span className="line-clamp-2 block font-serif text-[13px] font-semibold leading-snug text-ink">
                              {e.title}
                            </span>
                            <span className="mt-0.5 block truncate text-[11px] text-ink-mute">
                              {e.categoryLabel} · {e.id}
                            </span>
                          </span>
                        </button>
                        <button
                          onClick={() => removeFromSelection(e.id)}
                          className="btn-quiet btn-xs shrink-0 opacity-60 transition-opacity hover:text-zhu-500 group-hover:opacity-100"
                          title="移除"
                          aria-label={`移除《${e.title}》`}
                        >
                          <Icon name="close" size={13} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>

        <footer className="border-t border-black/[0.07] px-5 py-4">
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary flex-1" onClick={exportText} disabled={!selectedEntries.length}>
              <Icon name="download" size={15} />
              导出 Markdown
            </button>
            <CopyButton
              text={selectedEntries.map((e) => `${e.title}\n${buildShareLink(e)}`).join('\n\n')}
              label="复制链接"
              className="btn-ghost"
              iconName="link"
            />
            <button
              className="btn-quiet"
              onClick={clearSelection}
              disabled={!selectedEntries.length}
              title="清空选辑"
            >
              <Icon name="trash" size={15} />
            </button>
          </div>
          <p className="mt-2.5 text-[11px] leading-relaxed text-ink-mute/80">
            选辑保存在本机浏览器，不会上传。换设备或清缓存后需重新收集。
          </p>
        </footer>
      </aside>
    </div>
  )
}
