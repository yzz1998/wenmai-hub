import { useCallback, useEffect, useRef, useState } from 'react'
import Icon from './Icon'
import { asset } from '../lib/assets'

/**
 * 统一图片查看器 —— 合并三处历史实现：
 * · 剪纸馆的「滚轮锚点缩放 + 拖拽平移 + 限位防拖丢」（内核原样沿用，算法未改）
 * · 畲族馆的「多图相册 + 左右切换 + 拍摄署名」
 * · 知识库的「大图查看 / 配图预览」
 * 现在它是全站唯一的大图查看入口，任何专题调用都是同一套手感与快捷键。
 */

const MIN_SCALE = 1
const MAX_SCALE = 6
const EDGE_PAD = 60

export default function Lightbox({ open, items = [], index = 0, onClose, onIndexChange, caption, sub }) {
  const stageRef = useRef(null)
  const imgRef = useRef(null)
  const z = useRef({ s: 1, tx: 0, ty: 0, base: null, box: null })
  const drag = useRef({ down: false, moved: false, t0: 0, sx: 0, sy: 0, stx: 0, sty: 0 })
  const [scale, setScale] = useState(1)
  const [loaded, setLoaded] = useState(false)

  const media = items[index]
  const src = media ? asset(media.full || media.src) : ''
  const total = items.length

  /* ---------------- 视图应用 ---------------- */
  const applyView = useCallback(() => {
    const img = imgRef.current
    const st = z.current
    if (!img || !st.base) return
    const W = st.base.w * st.s
    const H = st.base.h * st.s
    const rangeX = W > st.box.w ? W - st.box.w + EDGE_PAD : (st.box.w - W) / 2
    const rangeY = H > st.box.h ? H - st.box.h + EDGE_PAD : (st.box.h - H) / 2
    st.tx = Math.max(-rangeX, Math.min(rangeX, st.tx))
    st.ty = Math.max(-rangeY, Math.min(rangeY, st.ty))
    img.style.transform = `translate(${st.tx}px, ${st.ty}px) scale(${st.s})`
    setScale(st.s)
  }, [])

  const measure = useCallback(() => {
    const img = imgRef.current
    const stage = stageRef.current
    if (!img || !stage || !img.complete) return
    const b = img.getBoundingClientRect()
    const c = stage.getBoundingClientRect()
    const s = z.current.s || 1
    // 若当前处于缩放态，反解出 scale=1 时的基准矩形
    z.current.base = { left: b.left - z.current.tx, top: b.top - z.current.ty, w: b.width / s, h: b.height / s }
    z.current.box = { w: c.width, h: c.height }
    applyView()
  }, [applyView])

  const resetView = useCallback(() => {
    z.current.s = 1
    z.current.tx = 0
    z.current.ty = 0
    if (imgRef.current) imgRef.current.style.transform = 'scale(1)'
    measure()
    setScale(1)
  }, [measure])

  /* ---------------- 打开 / 切换时复位 ---------------- */
  useEffect(() => {
    if (!open) return
    z.current.s = 1
    z.current.tx = 0
    z.current.ty = 0
    setLoaded(false)
    setScale(1)
    if (imgRef.current) imgRef.current.style.transform = ''
  }, [open, index])

  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  /* ---------------- 滚轮缩放（以光标为锚点） ---------------- */
  useEffect(() => {
    const img = imgRef.current
    if (!open || !img) return undefined
    const onWheel = (e) => {
      e.preventDefault()
      const st = z.current
      if (!st.base) return
      const factor = Math.pow(1.0018, -e.deltaY)
      const s0 = st.s
      const s1 = Math.max(MIN_SCALE, Math.min(MAX_SCALE, s0 * factor))
      if (s1 === s0) return
      const px = e.clientX
      const py = e.clientY
      const wx = (px - st.base.left - st.tx) / s0
      const wy = (py - st.base.top - st.ty) / s0
      st.s = s1
      st.tx = px - st.base.left - wx * s1
      st.ty = py - st.base.top - wy * s1
      applyView()
    }
    img.addEventListener('wheel', onWheel, { passive: false })
    return () => img.removeEventListener('wheel', onWheel)
  }, [open, index, applyView])

  /* ---------------- 拖拽平移 ---------------- */
  useEffect(() => {
    const img = imgRef.current
    if (!open || !img) return undefined
    const onDown = (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      if (z.current.s <= 1) return
      drag.current = {
        down: true,
        moved: false,
        t0: Date.now(),
        sx: e.clientX,
        sy: e.clientY,
        stx: z.current.tx,
        sty: z.current.ty
      }
      try {
        img.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      e.preventDefault()
    }
    const onMove = (e) => {
      const d = drag.current
      if (!d.down) return
      const dx = e.clientX - d.sx
      const dy = e.clientY - d.sy
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) d.moved = true
      z.current.tx = d.stx + dx
      z.current.ty = d.sty + dy
      applyView()
    }
    const onUp = () => {
      const d = drag.current
      if (!d.down) return
      d.down = false
      if (!d.moved && Date.now() - d.t0 < 450) resetView()
    }
    img.addEventListener('pointerdown', onDown)
    img.addEventListener('dragstart', (e) => e.preventDefault())
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      img.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [open, index, applyView, resetView])

  /* ---------------- 窗口尺寸变化 ---------------- */
  useEffect(() => {
    if (!open) return undefined
    const onResize = () => {
      z.current.s = 1
      z.current.tx = 0
      z.current.ty = 0
      if (imgRef.current) imgRef.current.style.transform = ''
      measure()
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [open, measure])

  /* ---------------- 键盘 ---------------- */
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') return onClose?.()
      if (e.key === 'ArrowRight' && total > 1) {
        onIndexChange?.((index + 1) % total)
        return undefined
      }
      if (e.key === 'ArrowLeft' && total > 1) {
        onIndexChange?.((index - 1 + total) % total)
        return undefined
      }
      if (e.key === '0') resetView()
      if (e.key === '+' || e.key === '=') {
        z.current.s = Math.min(MAX_SCALE, z.current.s * 1.25)
        applyView()
      }
      if (e.key === '-') {
        z.current.s = Math.max(MIN_SCALE, z.current.s / 1.25)
        applyView()
      }
      return undefined
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, index, total, onClose, onIndexChange, resetView, applyView])

  if (!open || !media) return null

  const credit = [media.credit, media.creditTitle].filter(Boolean).join(' / ')

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col backdrop-blur-sm"
      style={{ backgroundColor: 'rgba(16,22,20,0.955)' }}
      role="dialog"
      aria-modal="true"
    >
      {/* 顶栏 */}
      <header className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 text-paper-warm/90 sm:px-6">
        <div className="min-w-0">
          <p className="truncate font-serif text-sm font-semibold sm:text-base">{caption || media.alt || ''}</p>
          {sub && <p className="mt-0.5 truncate text-[11px] text-paper-warm/50">{sub}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="hidden rounded-lg bg-white/10 px-2 py-1 text-[11px] text-paper-warm/70 sm:inline">
            滚轮缩放 · 拖拽平移 · 0 复位
          </span>
          <button
            onClick={resetView}
            className="rounded-lg p-2 text-paper-warm/70 transition-colors hover:bg-white/10 hover:text-paper-warm"
            title="复位视图"
            aria-label="复位视图"
          >
            <Icon name="refresh" size={17} />
          </button>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-paper-warm/70 transition-colors hover:bg-white/10 hover:text-paper-warm"
            title="关闭（Esc）"
            aria-label="关闭"
          >
            <Icon name="close" size={19} />
          </button>
        </div>
      </header>

      {/* 舞台 */}
      <div ref={stageRef} className="viewer-stage relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-2 sm:px-16">
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center text-paper-warm/40">
            <Icon name="image" size={30} />
          </div>
        )}
        <img
          ref={imgRef}
          key={src}
          src={src}
          alt={media.alt || caption || ''}
          draggable={false}
          onLoad={() => {
            setLoaded(true)
            // 首帧布局完成后校正基准
            requestAnimationFrame(() => {
              z.current.s = 1
              z.current.tx = 0
              z.current.ty = 0
              if (imgRef.current) imgRef.current.style.transform = ''
              measure()
            })
          }}
          className={`max-h-full max-w-full select-none object-contain transition-opacity duration-300 ${
            loaded ? 'opacity-100' : 'opacity-0'
          } ${scale > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'}`}
          style={{ touchAction: 'none', willChange: 'transform' }}
        />

        {total > 1 && (
          <>
            <button
              onClick={() => onIndexChange?.((index - 1 + total) % total)}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-paper-warm/80 backdrop-blur transition-colors hover:bg-white/20 hover:text-white sm:left-4"
              aria-label="上一张"
            >
              <Icon name="chevronLeft" size={20} />
            </button>
            <button
              onClick={() => onIndexChange?.((index + 1) % total)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-paper-warm/80 backdrop-blur transition-colors hover:bg-white/20 hover:text-white sm:right-4"
              aria-label="下一张"
            >
              <Icon name="chevronRight" size={20} />
            </button>
          </>
        )}
      </div>

      {/* 底栏：署名 + 计数 + 缩放比 */}
      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-4 py-3 text-[11px] text-paper-warm/55 sm:px-6">
        <p className="min-w-0 flex-1 truncate">
          {credit ? `图片来源：${credit}` : media.note || ''}
        </p>
        <div className="flex shrink-0 items-center gap-3">
          <span className="rounded-md bg-white/10 px-1.5 py-0.5 tabular-nums">{scale.toFixed(1)}×</span>
          {total > 1 && (
            <span className="tabular-nums">
              {index + 1} / {total}
            </span>
          )}
        </div>
      </footer>
    </div>
  )
}
