import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Icon from './Icon'
import { CATEGORIES, categoryTokens } from '../data/taxonomy'
import { asset } from '../lib/assets'
import {
  compressImage,
  dataUrlBytes,
  discardImage,
  formatBytes,
  isLocalRef,
  localKeyOf,
  persistImage,
  probeSize,
  quickSrc,
  resolveImageSrc
} from '../lib/images'

/**
 * 配图管理字段。
 *
 * 覆盖配图全生命周期：上传本地图片 / 指定图片地址 / 从内置图库挑选 /
 * 预览 / 更换 / 移除。本地图片会自动压缩，超大图转存 IndexedDB。
 *
 * @param {object} props
 * @param {string} props.value        当前配图引用（dataURL / URL / local:key / 空）
 * @param {object} props.meta         配图附加信息（尺寸、体积、来源）
 * @param {(ref:string, meta:object|null)=>void} props.onChange
 * @param {string} props.category     当前素材分类，用于图库推荐与占位配色
 * @param {string} props.title        素材标题，用于生成文件名与占位文案
 */
export function ImageField({ value, meta, onChange, category, title }) {
  const [preview, setPreview] = useState('')       // 可显示的图片地址
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [libOpen, setLibOpen] = useState(false)
  const [urlOpen, setUrlOpen] = useState(false)
  const [urlDraft, setUrlDraft] = useState('')
  const fileRef = useRef(null)

  const tokens = categoryTokens(category)

  // 解析本地引用为可显示地址
  useEffect(() => {
    let revoked = ''
    let alive = true
    ;(async () => {
      if (!value) {
        if (alive) setPreview('')
        return
      }
      if (isLocalRef(value)) {
        const src = await resolveImageSrc(value)
        revoked = src
        if (alive) setPreview(src)
      } else if (alive) {
        setPreview(value)
      }
    })()
    return () => {
      alive = false
      if (revoked) URL.revokeObjectURL(revoked)
    }
  }, [value])

  const apply = useCallback(
    async (ref, extraMeta) => {
      const m = extraMeta || (ref ? { source: 'url', updatedAt: new Date().toISOString().slice(0, 10) } : null)
      onChange(ref, m)
    },
    [onChange]
  )

  /* ---------------- 上传本地图片 ---------------- */
  const handleFile = useCallback(
    async (file) => {
      if (!file) return
      setError('')
      if (!/^image\//.test(file.type)) {
        setError('请选择图片文件（JPG / PNG / WebP / GIF）')
        return
      }
      if (file.size > 12 * 1024 * 1024) {
        setError('单张图片建议不超过 12MB，过大的文件请先压缩或裁剪')
        return
      }
      setBusy('正在压缩图片…')
      try {
        // 先清掉旧图的 IndexedDB 副本，避免残留占用
        if (isLocalRef(value)) await discardImage(value)

        const { ref, meta: m } = await persistImage(file)
        const compressed = dataUrlBytes(ref)
        if (!ref.startsWith('data:')) {
          const blob = await fetch(await resolveImageSrc(ref)).then((r) => r.blob())
          m.bytes = blob.size
        } else {
          m.bytes = compressed || m.bytes
        }
        await apply(ref, m)
      } catch (e) {
        setError(e?.message || '图片处理失败，请换一张试试')
      } finally {
        setBusy('')
      }
    },
    [apply, value]
  )

  const onPick = (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    handleFile(f)
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    handleFile(e.dataTransfer?.files?.[0])
  }

  /* ---------------- 移除配图 ---------------- */
  const remove = async () => {
    setError('')
    if (isLocalRef(value)) await discardImage(value)
    await apply('', null)
  }

  /* ---------------- 使用图片地址 ---------------- */
  const useUrl = async () => {
    const u = urlDraft.trim()
    if (!u) return
    setError('')
    setBusy('正在验证图片地址…')
    try {
      const size = await probeSize(u)
      if (!size.width) throw new Error('无法加载该地址，请确认是可公开访问的图片直链')
      await apply(u, {
        source: 'url',
        width: size.width,
        height: size.height,
        updatedAt: new Date().toISOString().slice(0, 10)
      })
      setUrlOpen(false)
      setUrlDraft('')
    } catch (e) {
      setError(e?.message || '图片地址无效')
    } finally {
      setBusy('')
    }
  }

  /* ---------------- 内置图库 ---------------- */
  const library = useMemo(() => buildLibrary(category), [category])

  const useLibrary = async (entry) => {
    setError('')
    if (isLocalRef(value)) await discardImage(value)
    const size = await probeSize(entry.src)
    await apply(entry.src, {
      source: 'library',
      label: entry.label,
      width: size.width,
      height: size.height,
      updatedAt: new Date().toISOString().slice(0, 10)
    })
    setLibOpen(false)
  }

  const srcLabel = { upload: '本地上传', url: '图片地址', library: '内置图库' }[meta?.source] || ''
  const sizeText = meta?.width ? `${meta.width}×${meta.height}` : ''
  const bytesText = meta?.bytes ? formatBytes(meta.bytes) : ''

  return (
    <div>
      {/* 预览区 */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`group relative overflow-hidden rounded-xl border transition-colors ${
          dragOver ? 'border-dai-500 bg-dai-50' : 'border-black/[0.09] bg-paper-sunk'
        }`}
      >
        <div className="aspect-[16/10] w-full">
          {preview ? (
            <img src={preview} alt={title || '素材配图'} className="h-full w-full object-cover" />
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className={`flex h-full w-full flex-col items-center justify-center gap-2 ${tokens.bg} ${tokens.fg}`}
            >
              <Icon name="image" size={30} />
              <span className="text-xs font-medium opacity-80">暂无配图 · 点击上传</span>
              <span className="text-[11px] opacity-60">也可将图片拖拽到此处</span>
            </button>
          )}
        </div>

        {/* 悬停操作层 */}
        {preview && (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-1.5 bg-gradient-to-t from-ink/70 to-transparent px-2.5 pb-2.5 pt-8 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <button type="button" onClick={() => fileRef.current?.click()} className="chip bg-white/90 text-ink hover:bg-white">
              <Icon name="upload" size={12} />
              更换
            </button>
            <button type="button" onClick={() => setUrlOpen((v) => !v)} className="chip bg-white/90 text-ink hover:bg-white">
              <Icon name="link" size={12} />
              地址
            </button>
            <button type="button" onClick={remove} className="chip bg-white/90 text-zhu-700 hover:bg-white">
              <Icon name="trash" size={12} />
              移除
            </button>
          </div>
        )}

        {/* 处理中遮罩 */}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink/45 text-xs font-medium text-white backdrop-blur-sm">
            <Icon name="refresh" size={15} className="mr-1.5 animate-spin" />
            {busy}
          </div>
        )}
      </div>

      {/* 操作按钮行 */}
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => fileRef.current?.click()} className="btn-ghost btn-xs">
          <Icon name="upload" size={13} />
          {preview ? '更换图片' : '上传图片'}
        </button>
        <button type="button" onClick={() => setLibOpen((v) => !v)} className="btn-ghost btn-xs">
          <Icon name="grid" size={13} />
          内置图库
        </button>
        <button type="button" onClick={() => setUrlOpen((v) => !v)} className="btn-ghost btn-xs">
          <Icon name="link" size={13} />
          {urlOpen ? '收起地址栏' : '填写地址'}
        </button>
        {preview && (
          <button type="button" onClick={remove} className="btn-quiet btn-xs text-zhu-700">
            <Icon name="trash" size={13} />
            移除配图
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
      </div>

      {/* 元信息 */}
      {(srcLabel || sizeText || bytesText) && preview && (
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-mute">
          {srcLabel && (
            <span className="inline-flex items-center gap-1">
              <Icon name="info" size={11} />
              {srcLabel}
            </span>
          )}
          {sizeText && <span>尺寸 {sizeText}</span>}
          {bytesText && <span>约 {bytesText}</span>}
          {meta?.storage === 'indexeddb' && <span className="text-cha-700">已转存本地大图仓库</span>}
        </p>
      )}

      {/* 图片地址输入 */}
      {urlOpen && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-xl bg-black/[0.025] p-2.5">
          <input
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                useUrl()
              }
            }}
            placeholder="https://… 或 /img/xxx.svg"
            className="field flex-1 py-1.5 text-[12px]"
          />
          <button type="button" onClick={useUrl} className="btn-primary btn-xs" disabled={!urlDraft.trim()}>
            <Icon name="check" size={13} />
            使用
          </button>
        </div>
      )}

      {/* 内置图库 */}
      {libOpen && (
        <div className="mt-2.5 rounded-xl bg-black/[0.025] p-3">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-ink-soft">
            <Icon name="sparkle" size={12} />
            内置矢量插画（{CATEGORIES.find((c) => c.id === category)?.name || '通用'}优先排序）
          </p>
          <div className="grid max-h-52 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
            {library.map((entry) => (
              <button
                key={entry.src}
                type="button"
                onClick={() => useLibrary(entry)}
                title={entry.label}
                className="group/thumb overflow-hidden rounded-lg border border-black/[0.08] bg-white transition-all hover:border-dai-500 hover:shadow-sm"
              >
                <img src={entry.src} alt={entry.label} loading="lazy" className="aspect-[16/10] w-full object-cover" />
                <span className="line-clamp-1 px-1.5 py-1 text-[10px] text-ink-mute group-hover/thumb:text-dai-700">
                  {entry.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-zhu-50 p-2.5 text-[11px] leading-relaxed text-zhu-700">
          <Icon name="warn" size={12} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}

      <p className="mt-2 text-[11px] leading-relaxed text-ink-mute">
        支持 JPG / PNG / WebP / GIF。本地图片会自动压缩到 1600px 以内并转为 WebP，超大图自动转存浏览器本地仓库，不占用素材库存储配额。
      </p>
    </div>
  )
}

/** 内置图库：public/img 下的矢量插画，按分类优先排序 */
function buildLibrary(category) {
  const IMAGES = [
    // 民俗节庆
    ['festival-sanyuesan', '畲族三月三', 'festival'],
    ['festival-lantern', '元宵灯会', 'festival'],
    ['festival-temple', '临水夫人信俗', 'festival'],
    ['festival-fish', '海鲜节俗', 'festival'],
    ['festival-wedding', '畲族婚俗', 'festival'],
    ['festival-song', '畲族歌会', 'festival'],
    // 方言曲艺
    ['opera-siping', '四平戏', 'opera'],
    ['opera-beilu', '北路戏', 'opera'],
    ['opera-pingjiang', '平讲戏', 'opera'],
    ['opera-shuangyin', '畲族双音', 'opera'],
    ['opera-dialect', '闽东方言', 'opera'],
    ['opera-puppet', '杖头木偶', 'opera'],
    // 历史人物
    ['figure-xuelingzhi', '薛令之', 'figure'],
    ['figure-fengmenglong', '冯梦龙', 'figure'],
    ['figure-ganGuobao', '甘国宝', 'figure'],
    ['figure-huangju', '黄鞠', 'figure'],
    ['figure-lincong', '林聪', 'figure'],
    ['figure-liba', '李拔', 'figure'],
    ['figure-xieao', '谢翱', 'figure'],
    ['figure-caiwei', '蔡威', 'figure'],
    // 传统技艺
    ['craft-bridge', '木拱廊桥', 'craft'],
    ['craft-papercut', '柘荣剪纸', 'craft'],
    ['craft-lions', '霍童线狮', 'craft'],
    ['craft-tea', '坦洋工夫', 'craft'],
    ['craft-redtea', '福鼎白茶', 'craft'],
    ['craft-ship', '福船制造', 'craft'],
    ['craft-silver', '畲族银饰', 'craft'],
    ['craft-fan', '油纸扇', 'craft'],
    // 名胜古迹
    ['scenic-taimu', '太姥山', 'scenic'],
    ['scenic-baishuiyang', '白水洋', 'scenic'],
    ['scenic-baiyun', '白云山', 'scenic'],
    ['scenic-sanduao', '三都澳', 'scenic'],
    ['scenic-xiapu', '霞浦滩涂', 'scenic'],
    ['scenic-zhiti', '支提山', 'scenic'],
    ['scenic-liancun', '廉村', 'scenic'],
    ['scenic-baizhuyang', '柏柱洋', 'scenic'],
    ['scenic-cuiping', '翠屏湖', 'scenic'],
    ['scenic-jiulongji', '九龙漈', 'scenic']
  ]
  const list = IMAGES.map(([file, label, cat]) => ({
    // 走 asset() 而不是写死 '/img/…'：站点可能部署在子目录（GitHub Pages 的
    // /<repo>/ 就是），根绝对路径会指到域名根、直接 404。asset() 按 BASE_URL 拼。
    src: asset(`/img/${file}.svg`),
    label,
    cat
  }))
  return list.sort((a, b) => {
    const pa = a.cat === category ? 0 : 1
    const pb = b.cat === category ? 0 : 1
    return pa - pb || a.label.localeCompare(b.label, 'zh-Hans-CN')
  })
}

export default ImageField
