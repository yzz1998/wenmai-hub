import { useState } from 'react'
import Icon from './Icon'
import Lightbox from './Lightbox'
import { SmartImage } from './Media'
import { asset } from '../lib/assets'

/**
 * 条目图集 —— 一个组件覆盖三种素材形态：
 * · 剪纸：单幅图版，大幅展示 + 点击进入深度缩放（图录的主要阅读方式）
 * · 畲族：多帧实景照片，三列网格 + 署名，点击进入相册
 * · 知识素材：单张配图，占满内容宽度
 * 查看器统一走 Lightbox，因此缩放、切换、署名的行为完全一致。
 */
export default function MediaGallery({ entry, title }) {
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const media = entry.media || []

  if (!media.length) {
    return (
      <div className="rounded-2xl border border-dashed border-black/12 bg-white/50 px-5 py-8 text-center">
        <Icon name="image" size={22} className="mx-auto text-ink-mute/40" />
        <p className="mt-2 text-[12.5px] text-ink-mute">
          本条暂无实景图片
          {entry.collection === 'she' ? '（原展览为文字条目）' : ''}
        </p>
      </div>
    )
  }

  const openAt = (i) => {
    setIndex(i)
    setOpen(true)
  }

  /* ---------- 剪纸：单幅图版 ---------- */
  if (entry.collection === 'papercut') {
    const m = media[0]
    return (
      <>
        <figure className="overflow-hidden rounded-2xl border border-black/[0.07] bg-white shadow-card">
          <button onClick={() => openAt(0)} className="group relative block w-full cursor-zoom-in bg-paper-sunk">
            <img
              src={asset(m.full || m.src)}
              alt={m.alt || entry.title}
              className="max-h-[76vh] w-full object-contain"
            />
            <span className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1 rounded-lg bg-ink/55 px-2 py-1 text-[11px] text-paper-warm opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
              <Icon name="expand" size={12} />
              滚轮缩放 · 拖拽平移
            </span>
          </button>
          <figcaption className="flex flex-wrap items-center justify-between gap-2 border-t border-black/[0.06] px-3.5 py-2.5 text-[11.5px] text-ink-mute">
            <span>{m.credit || '图版来源：《剪花娘子》图录'}</span>
            <span className="tabular-nums">
              {entry.facets?.vol}册 · 第 {entry.facets?.page} 页
              {entry.facets?.size ? ` · ${entry.facets.size}` : ''}
            </span>
          </figcaption>
        </figure>
        <Lightbox
          open={open}
          items={media}
          index={index}
          onClose={() => setOpen(false)}
          onIndexChange={setIndex}
          caption={title || entry.title}
          sub={`${entry.facets?.vol}册 · p.${entry.facets?.page}`}
        />
      </>
    )
  }

  /* ---------- 单图（知识素材） ---------- */
  if (media.length === 1) {
    const m = media[0]
    return (
      <>
        <figure className="overflow-hidden rounded-2xl border border-black/[0.07] bg-white shadow-card">
          <button onClick={() => openAt(0)} className="group relative block w-full cursor-zoom-in">
            <SmartImage
              src={asset(m.full || m.src)}
              alt={m.alt || entry.title}
              ratio="aspect-[4/3]"
              className="[&>img]:transition-transform [&>img]:duration-500 group-hover:[&>img]:scale-[1.02]"
            />
            <span className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1 rounded-lg bg-ink/55 px-2 py-1 text-[11px] text-paper-warm opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
              <Icon name="zoomIn" size={12} />
              查看大图
            </span>
          </button>
          {(m.credit || m.note) && (
            <figcaption className="border-t border-black/[0.06] px-3.5 py-2.5 text-[11.5px] leading-relaxed text-ink-mute">
              {m.note || `图片：${m.credit}${m.creditTitle ? `《${m.creditTitle}》` : ''}`}
            </figcaption>
          )}
        </figure>
        <Lightbox
          open={open}
          items={media}
          index={index}
          onClose={() => setOpen(false)}
          onIndexChange={setIndex}
          caption={title || entry.title}
        />
      </>
    )
  }

  /* ---------- 多图相册（畲族） ---------- */
  return (
    <>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 font-serif text-[14px] font-bold text-ink">
          <Icon name="gallery" size={15} />
          实景照片
          <span className="text-[11px] font-normal text-ink-mute">{media.length} 帧</span>
        </h3>
        <button onClick={() => openAt(0)} className="btn-quiet btn-xs">
          <Icon name="expand" size={13} />
          连续查看
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {media.map((m, i) => (
          <button
            key={`${m.src}-${i}`}
            onClick={() => openAt(i)}
            className="group relative overflow-hidden rounded-xl border border-black/[0.06] bg-paper-sunk"
            style={{ aspectRatio: '4 / 3' }}
            aria-label={`查看第 ${i + 1} 张照片`}
          >
            <SmartImage
              src={asset(m.src)}
              alt={m.alt || entry.title}
              ratio="h-full"
              className="h-full"
              imgClassName="transition-transform duration-500 group-hover:scale-[1.06]"
            />
            {m.credit && (
              <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/70 to-transparent px-2 pb-1.5 pt-5 text-left text-[10px] leading-tight text-paper-warm/95 opacity-0 transition-opacity group-hover:opacity-100">
                {m.credit}
              </span>
            )}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-ink-mute/80">
        照片版权归原拍摄者与刊发媒体所有，此处仅用于教学展示并逐帧署名；如需转载请联系原出处。
      </p>
      <Lightbox
        open={open}
        items={media}
        index={index}
        onClose={() => setOpen(false)}
        onIndexChange={setIndex}
        caption={title || entry.title}
        sub={entry.subtitle}
      />
    </>
  )
}
