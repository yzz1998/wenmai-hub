import { useEffect, useState } from 'react'
import { useStore } from '../hooks/useStore'
import { CATEGORIES, categoryTokens } from '../data/taxonomy'
import { Modal } from './UI'
import { ImageField } from './ImageField'
import Icon from './Icon'
import { resolveImageSrc, isLocalRef } from '../lib/images'

/**
 * 单条素材的配图管理弹窗 —— 在管理列表中直接完成「更换 / 更新 / 移除」，
 * 不必进入完整编辑表单，适合批量整理配图。
 */
export default function MaterialImageDialog({ item, onClose }) {
  const { updateMaterial } = useStore()
  const [value, setValue] = useState('')
  const [meta, setMeta] = useState(null)
  const [preview, setPreview] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!item) return
    setValue(item.image || '')
    setMeta(item.imageMeta || null)
    setSaved(false)
  }, [item])

  // 预览当前已保存的配图（用于对比）
  useEffect(() => {
    let revoked = ''
    let alive = true
    ;(async () => {
      const cur = item?.image
      if (!cur) {
        if (alive) setPreview('')
        return
      }
      if (isLocalRef(cur)) {
        const u = await resolveImageSrc(cur)
        revoked = u
        if (alive) setPreview(u)
      } else if (alive) setPreview(cur)
    })()
    return () => {
      alive = false
      if (revoked) URL.revokeObjectURL(revoked)
    }
  }, [item])

  if (!item) return null

  const cat = CATEGORIES.find((c) => c.id === item.category)
  const tokens = categoryTokens(item.category)
  const dirty = value !== (item.image || '')

  const save = () => {
    updateMaterial(item.id, {
      image: value,
      imageMeta: value ? meta || undefined : undefined
    })
    setSaved(true)
    setTimeout(() => onClose(), 600)
  }

  return (
    <Modal
      open={!!item}
      onClose={onClose}
      title="管理配图"
      desc={`《${item.title}》· ${item.id}`}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            取消
          </button>
          <button className="btn-primary" onClick={save} disabled={!dirty}>
            <Icon name={saved ? 'check' : 'download'} size={15} />
            {saved ? '已保存' : dirty ? '保存配图' : '无变更'}
          </button>
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">
        {/* 当前已保存 */}
        <div>
          <p className="field-label">当前配图</p>
          <div className={`overflow-hidden rounded-xl border border-black/[0.08] ${tokens.bg}`}>
            <div className="aspect-[16/10] w-full">
              {preview ? (
                <img src={preview} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className={`flex h-full w-full flex-col items-center justify-center gap-1.5 ${tokens.fg}`}>
                  <Icon name="image" size={26} />
                  <span className="text-xs font-medium opacity-80">尚未设置配图</span>
                </div>
              )}
            </div>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-ink-mute">
            {item.image
              ? `来源：${{ upload: '本地上传', url: '图片地址', library: '内置图库' }[item.imageMeta?.source] || '内置素材'}`
              : '建议为该素材补充配图，列表与详情页将以 16:10 比例裁切展示。'}
          </p>
        </div>

        {/* 编辑区 */}
        <div>
          <p className="field-label">设置新配图</p>
          <ImageField
            value={value}
            meta={meta}
            category={item.category}
            title={item.title}
            onChange={(ref, m) => {
              setValue(ref)
              setMeta(m)
              setSaved(false)
            }}
          />
        </div>
      </div>

      <p className="mt-4 flex items-start gap-2 rounded-xl bg-dai-50/70 p-3 text-[11px] leading-relaxed text-dai-700">
        <Icon name="info" size={13} className="mt-0.5 shrink-0" />
        在列表中点任意素材的配图缩略图即可打开此面板，逐条核对与替换，适合集中整理整库配图。分类「{cat?.name}」的推荐插画已在图库中优先排序。
      </p>
    </Modal>
  )
}
