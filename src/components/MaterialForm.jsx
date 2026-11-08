import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../hooks/useStore'
import { CATEGORIES, STATUSES } from '../data/taxonomy'
import { Modal } from './UI'
import { ImageField } from './ImageField'
import Icon from './Icon'

const empty = {
  title: '',
  category: CATEGORIES[0].id,
  summary: '',
  bodyText: '',
  tagText: '',
  region: '',
  era: '',
  level: '',
  source: '',
  sourceUrl: '',
  image: '',
  status: 'published'
}

/** 素材新增 / 编辑表单 */
export function MaterialForm({ open, initial, onClose }) {
  const { createMaterial, updateMaterial, materials } = useStore()
  const [form, setForm] = useState(empty)
  const [imageMeta, setImageMeta] = useState(null)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (!open) return
    if (initial) {
      setForm({
        title: initial.title || '',
        category: initial.category || CATEGORIES[0].id,
        summary: initial.summary || '',
        bodyText: (initial.body || []).join('\n'),
        tagText: (initial.tags || []).join('、'),
        region: initial.region || '',
        era: initial.era || '',
        level: initial.level || '',
        source: initial.source || '',
        sourceUrl: initial.sourceUrl || '',
        image: initial.image || '',
        status: initial.status || 'published'
      })
      setImageMeta(initial.imageMeta || null)
    } else {
      setForm(empty)
      setImageMeta(null)
    }
    setErrors({})
  }, [open, initial])

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }))
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }))
  }

  // 已有标签候选，便于复用而非重复造词
  const tagSuggestions = useMemo(() => {
    const s = new Set()
    materials.forEach((m) => (m.tags || []).forEach((t) => s.add(t)))
    return [...s].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
  }, [materials])

  const pickTag = (t) => {
    const cur = splitTags(form.tagText)
    if (cur.includes(t)) set('tagText', cur.filter((x) => x !== t).join('、'))
    else set('tagText', [...cur, t].join('、'))
  }

  const validate = () => {
    const e = {}
    if (!form.title.trim()) e.title = '请填写标题'
    else if (!initial && materials.some((m) => m.title.trim() === form.title.trim()))
      e.title = '已存在同名素材，请换一个标题或直接编辑原条目'
    if (!form.summary.trim()) e.summary = '请填写简介，这是列表与检索的主要依据'
    if (!form.source.trim()) e.source = '请填写来源说明，保证素材可核实'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const submit = () => {
    if (!validate()) return
    const payload = {
      title: form.title.trim(),
      category: form.category,
      summary: form.summary.trim(),
      body: form.bodyText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      tags: splitTags(form.tagText),
      region: form.region.trim(),
      era: form.era.trim(),
      level: form.level.trim(),
      source: form.source.trim(),
      sourceUrl: form.sourceUrl.trim(),
      image: form.image.trim(),
      imageMeta: form.image.trim() ? imageMeta || undefined : undefined,
      status: form.status
    }
    if (initial) updateMaterial(initial.id, payload)
    else createMaterial(payload)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={initial ? `编辑素材 · ${initial.id}` : '新增素材'}
      desc={
        initial
          ? '修改后将同步更新素材库中的检索结果与引用信息。'
          : '编号将根据所选分类自动生成，保存后可在素材详情页复制引用信息与分享链接。'
      }
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            取消
          </button>
          <button className="btn-primary" onClick={submit}>
            <Icon name="check" size={15} />
            {initial ? '保存修改' : '创建素材'}
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {/* 标题 */}
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="mf-title">
            标题 <span className="text-zhu-500">*</span>
          </label>
          <input
            id="mf-title"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            className="field"
            placeholder="如：畲族三月三（乌饭节·对歌节）"
          />
          {errors.title && <p className="mt-1.5 text-[12px] text-zhu-700">{errors.title}</p>}
        </div>

        {/* 分类 */}
        <div>
          <label className="field-label" htmlFor="mf-cat">
            分类 <span className="text-zhu-500">*</span>
          </label>
          <select
            id="mf-cat"
            value={form.category}
            onChange={(e) => set('category', e.target.value)}
            className="field cursor-pointer"
          >
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[11px] leading-relaxed text-ink-mute">
            {CATEGORIES.find((c) => c.id === form.category)?.desc}
          </p>
        </div>

        {/* 状态 */}
        <div>
          <label className="field-label" htmlFor="mf-status">
            状态
          </label>
          <select
            id="mf-status"
            value={form.status}
            onChange={(e) => set('status', e.target.value)}
            className="field cursor-pointer"
          >
            {STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[11px] leading-relaxed text-ink-mute">
            草稿状态仍会在后台管理列表显示，便于分阶段整理。
          </p>
        </div>

        {/* 简介 */}
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="mf-summary">
            简介 <span className="text-zhu-500">*</span>
          </label>
          <textarea
            id="mf-summary"
            value={form.summary}
            onChange={(e) => set('summary', e.target.value)}
            rows={3}
            className="field resize-y"
            placeholder="2—4 句话概括该素材的核心信息与价值，将用于列表摘要与检索匹配"
          />
          <div className="mt-1.5 flex items-center justify-between">
            {errors.summary ? (
              <p className="text-[12px] text-zhu-700">{errors.summary}</p>
            ) : (
              <span />
            )}
            <span className="text-[11px] text-ink-mute">{form.summary.length} 字</span>
          </div>
        </div>

        {/* 正文 */}
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="mf-body">
            详细内容
          </label>
          <textarea
            id="mf-body"
            value={form.bodyText}
            onChange={(e) => set('bodyText', e.target.value)}
            rows={7}
            className="field resize-y leading-relaxed"
            placeholder={
              '每行一段。建议用【小标题】开头分段，例如：\n【历史源流】……\n【艺术特征】……\n【教学建议】……'
            }
          />
          <p className="mt-1.5 text-[11px] text-ink-mute">
            共 {form.bodyText.split('\n').filter((s) => s.trim()).length} 段。建议包含「教学建议」段落，方便其他教师直接取用。
          </p>
        </div>

        {/* 标签 */}
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="mf-tags">
            标签
          </label>
          <input
            id="mf-tags"
            value={form.tagText}
            onChange={(e) => set('tagText', e.target.value)}
            className="field"
            placeholder="用顿号或逗号分隔，如：畲族、三月三、国家级非遗"
          />
          {tagSuggestions.length > 0 && (
            <div className="no-scrollbar mt-2 flex max-h-20 flex-wrap gap-1.5 overflow-y-auto">
              {tagSuggestions.slice(0, 26).map((t) => {
                const on = splitTags(form.tagText).includes(t)
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => pickTag(t)}
                    className={on ? 'chip-tag-on !text-[11px]' : 'chip-tag !text-[11px]'}
                  >
                    {on && <Icon name="check" size={10} />}
                    {t}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* 地域 / 年代 */}
        <div>
          <label className="field-label" htmlFor="mf-region">
            地域分布
          </label>
          <input
            id="mf-region"
            value={form.region}
            onChange={(e) => set('region', e.target.value)}
            className="field"
            placeholder="如：福安市溪潭镇廉村"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="mf-era">
            年代 / 时期
          </label>
          <input
            id="mf-era"
            value={form.era}
            onChange={(e) => set('era', e.target.value)}
            className="field"
            placeholder="如：宋代建村，延续至今"
          />
        </div>

        {/* 保护级别 */}
        <div>
          <label className="field-label" htmlFor="mf-level">
            保护级别 / 认定
          </label>
          <input
            id="mf-level"
            value={form.level}
            onChange={(e) => set('level', e.target.value)}
            className="field"
            placeholder="如：国家级非物质文化遗产 / 国家 5A 级旅游景区"
          />
          <p className="mt-1.5 text-[11px] leading-relaxed text-ink-mute">
            该字段会出现在引用信息中，便于标注非遗级别或景区等级。
          </p>
        </div>

        {/* 配图 */}
        <div className="sm:col-span-2">
          <label className="field-label">素材配图</label>
          <ImageField
            value={form.image}
            meta={imageMeta}
            category={form.category}
            title={form.title}
            onChange={(ref, meta) => {
              setForm((f) => ({ ...f, image: ref }))
              setImageMeta(meta)
            }}
          />
        </div>

        {/* 来源 */}
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="mf-source">
            来源说明 <span className="text-zhu-500">*</span>
          </label>
          <textarea
            id="mf-source"
            value={form.source}
            onChange={(e) => set('source', e.target.value)}
            rows={2}
            className="field resize-y"
            placeholder="如：宁德市民族与宗教事务局《…》；宁德史志网《宁德市》"
          />
          {errors.source && <p className="mt-1.5 text-[12px] text-zhu-700">{errors.source}</p>}
        </div>
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="mf-sourceurl">
            来源链接
          </label>
          <input
            id="mf-sourceurl"
            value={form.sourceUrl}
            onChange={(e) => set('sourceUrl', e.target.value)}
            className="field"
            placeholder="https://…"
          />
          <p className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-relaxed text-ink-mute">
            <Icon name="info" size={11} className="mt-0.5 shrink-0" />
            填写真实可访问的来源链接，便于使用者在正式引用前核对原始出处。来源不明的内容建议暂存为草稿而非发布。
          </p>
        </div>
      </div>
    </Modal>
  )
}

function splitTags(text) {
  return String(text || '')
    .split(/[、,，;；|\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i)
}

export default MaterialForm
