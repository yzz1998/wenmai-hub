import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useStore } from '../hooks/useStore'
import { CATEGORIES, categoryTokens } from '../data/taxonomy'
import { filterWorks, searchMaterials, SORTS, collectTags } from '../lib/search'
import { Empty, ConfirmDialog, CategoryChip, SectionTitle, Modal } from '../components/UI'
import { MaterialForm } from '../components/MaterialForm'
import MaterialImageDialog from '../components/MaterialImageDialog'
import { useResolvedImage } from '../components/MaterialCard'
import { idbKeys, imageStats } from '../lib/images'
import { gradeOf } from '../lib/review'
import Icon from '../components/Icon'
import { workTypeName, WORK_TYPES } from '../data/taxonomy'

const TABS = [
  { id: 'materials', label: '素材管理', iconName: 'book' },
  { id: 'works', label: '成果管理', iconName: 'award' }
]

const IMG_FILTERS = [
  { id: '', label: '全部配图' },
  { id: 'photo', label: '实景照片' },
  { id: 'vector', label: '自制插画' },
  { id: 'missing', label: '缺配图' },
  { id: 'local', label: '本地上传' }
]

/** 判定一条素材的配图是否为矢量插画（与 images.js 的统计口径保持一致） */
const isVectorImage = (v) => !!v && !String(v).startsWith('data:') && !String(v).startsWith('local:') && /\.svg(\?|$)/i.test(String(v))

export default function Manage() {
  const { materials, works, reviews, removeMaterial, removeWork, resetMaterials } = useStore()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') || 'materials'

  const [query, setQuery] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [imgFilter, setImgFilter] = useState('')
  const [editing, setEditing] = useState(null)
  const [creating, setCreating] = useState(false)
  const [imgTarget, setImgTarget] = useState(null)
  const [confirm, setConfirm] = useState(null) // {kind, id, title}
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [importErr, setImportErr] = useState('')
  const fileRef = useRef(null)
  const { importMaterials } = useStore()

  const stats = useMemo(() => imageStats(materials), [materials])

  // 管理台关心的是「还有哪些没评」和「整体处在什么档位」，而不是逐条复述总分
  const reviewStats = useMemo(() => {
    const scored = works.map((w) => reviews?.[w.id]?.total).filter((n) => typeof n === 'number')
    return {
      total: works.length,
      done: scored.length,
      avg: scored.length ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : 0
    }
  }, [works, reviews])

  // 深链：/manage?edit=xxx 直接打开编辑
  useEffect(() => {
    const editId = params.get('edit')
    if (editId) {
      const found = materials.find((m) => m.id === editId)
      if (found) {
        setEditing(found)
        const next = new URLSearchParams(params)
        next.delete('edit')
        setParams(next, { replace: true })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const list = useMemo(() => {
    if (tab !== 'materials') return []
    let r = searchMaterials(materials, { q: query, category: catFilter, sort: 'updated' })
    if (imgFilter === 'photo') r = r.filter((m) => !!m.image && !isVectorImage(m.image))
    else if (imgFilter === 'vector') r = r.filter((m) => isVectorImage(m.image))
    else if (imgFilter === 'missing') r = r.filter((m) => !m.image)
    else if (imgFilter === 'local') r = r.filter((m) => String(m.image || '').startsWith('local:'))
    return r
  }, [materials, query, catFilter, imgFilter, tab])

  const workList = useMemo(() => {
    if (tab !== 'works') return []
    return filterWorks(works, { q: query })
  }, [works, query, tab])

  const handleImport = (raw) => {
    setImportErr('')
    try {
      const data = JSON.parse(raw)
      const items = Array.isArray(data) ? data : data.materials
      if (!Array.isArray(items)) throw new Error('结构不正确')
      const valid = items.filter((it) => it && it.title && it.category)
      if (!valid.length) throw new Error('没有可导入的有效条目（需含 title 与 category）')
      importMaterials(valid)
      setImportOpen(false)
      setImportText('')
    } catch (e) {
      setImportErr(`解析失败：${e.message}。请确认是合法的 JSON 数组，或导出文件内容。`)
    }
  }

  const onPickFile = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => setImportText(String(reader.result || ''))
    reader.readAsText(f, 'utf-8')
    e.target.value = ''
  }

  const exportAll = () => {
    // 成果附件的解析正文与原件存在 IndexedDB 的 blobs 里，不属于 localStorage 快照。
    // 这里如实标注，免得用户以为「导出备份」把文档也一起带走了。
    const payload = {
      _meta: {
        exportedAt: new Date().toISOString(),
        schema: 2,
        note: '成果附件的正文与原件保存在浏览器 IndexedDB，不包含在本备份中；换设备或清缓存后需重新上传。',
        counts: {
          materials: materials.length,
          works: works.length,
          reviews: Object.keys(reviews || {}).length
        }
      },
      materials,
      works,
      reviews
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8'
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `闽东文化知识库-全量备份-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="wrap py-10">
      <SectionTitle
        eyebrow="后台管理"
        title="素材与成果管理"
        sub="支持素材的新增、编辑、删除，以及全量数据的导入导出，方便批量维护与迁移。"
        right={
          <div className="flex flex-wrap gap-2">
            <button onClick={exportAll} className="btn-ghost btn-xs">
              <Icon name="download" size={14} />
              导出备份
            </button>
            <button onClick={() => setImportOpen(true)} className="btn-ghost btn-xs">
              <Icon name="upload" size={14} />
              导入
            </button>
            <button
              onClick={() => setConfirm({ kind: 'reset' })}
              className="btn-ghost btn-xs text-zhu-700"
            >
              <Icon name="refresh" size={14} />
              重置示例
            </button>
          </div>
        }
      />

      {/* 标签页 */}
      <div className="mb-6 flex flex-wrap gap-2 border-b border-black/[0.07] pb-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setQuery('')
              setCatFilter('')
              const next = new URLSearchParams(params)
              next.set('tab', t.id)
              setParams(next, { replace: true })
            }}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-dai-700 text-paper-warm shadow-sm' : 'text-ink-soft hover:bg-black/[0.04]'
            }`}
          >
            <Icon name={t.iconName} size={15} />
            {t.label}
            <span className="rounded-full bg-black/[0.08] px-1.5 py-0.5 text-[10px]">
              {t.id === 'materials' ? materials.length : works.length}
            </span>
          </button>
        ))}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <Icon
              name="search"
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tab === 'materials' ? '搜索素材…' : '搜索成果…'}
              className="field w-44 py-2 pl-9 text-[13px] sm:w-56"
            />
          </div>
          {tab === 'materials' ? (
            <button onClick={() => setCreating(true)} className="btn-zhu btn-xs">
              <Icon name="plus" size={14} />
              新增素材
            </button>
          ) : (
            <Link to="/works/new" className="btn-zhu btn-xs">
              <Icon name="plus" size={14} />
              提交成果
            </Link>
          )}
        </div>
      </div>

      {/* 分类筛选 + 配图筛选（素材） */}
      {tab === 'materials' && (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            <button
              onClick={() => setCatFilter('')}
              className={catFilter === '' ? 'chip-tag-on' : 'chip-tag'}
            >
              全部分类
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setCatFilter(catFilter === c.id ? '' : c.id)}
                className={catFilter === c.id ? 'chip-tag-on' : 'chip-tag'}
              >
                {c.name}
                <span className="ml-0.5 text-[10px] opacity-70">
                  {materials.filter((m) => m.category === c.id).length}
                </span>
              </button>
            ))}
          </div>

          <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl bg-black/[0.02] px-3 py-2.5">
            <span className="flex items-center gap-1 text-xs font-medium text-ink-mute">
              <Icon name="image" size={13} />
              配图
            </span>
            {IMG_FILTERS.map((f) => {
              const n =
                f.id === 'photo'
                  ? stats.photoCount
                  : f.id === 'vector'
                    ? stats.vectorCount
                    : f.id === 'missing'
                      ? stats.missing.length
                      : f.id === 'local'
                        ? stats.localCount
                        : materials.length
              return (
                <button
                  key={f.id}
                  onClick={() => setImgFilter(f.id)}
                  className={imgFilter === f.id ? 'chip-tag-on' : 'chip-tag'}
                >
                  {f.label}
                  <span className="ml-0.5 text-[10px] opacity-70">{n}</span>
                </button>
              )
            })}
            <span className="ml-auto text-[11px] text-ink-mute">
              配图覆盖 {stats.total ? Math.round((stats.withImage / stats.total) * 100) : 0}%（{stats.withImage}/{stats.total}）
              <span className="mx-1.5 text-ink-mute/50">·</span>
              实景照片 {stats.photoCount}
              <span className="mx-1.5 text-ink-mute/50">·</span>
              自制插画 {stats.vectorCount}
            </span>
          </div>
        </>
      )}

      {/* ======== 素材表格 ======== */}
      {tab === 'materials' &&
        (list.length === 0 ? (
          <Empty
            iconName="book"
            title={query || catFilter ? '没有符合条件的素材' : '素材库还是空的'}
            desc={
              query || catFilter
                ? '试着减少筛选条件，或清空搜索词。'
                : '点击「新增素材」录入第一条内容，也可以先「导入」已有的 JSON 数据。'
            }
            action={
              <button onClick={() => setCreating(true)} className="btn-primary">
                <Icon name="plus" size={15} />
                新增素材
              </button>
            }
          />
        ) : (
          <div className="card overflow-hidden">
            {/* 桌面表格 */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-black/[0.07] bg-black/[0.02] text-xs text-ink-mute">
                  <tr>
                    <th className="px-4 py-3 font-medium">配图</th>
                    <th className="px-4 py-3 font-medium">素材编号</th>
                    <th className="px-4 py-3 font-medium">标题</th>
                    <th className="px-4 py-3 font-medium">分类</th>
                    <th className="px-4 py-3 font-medium">地域</th>
                    <th className="px-4 py-3 font-medium">状态</th>
                    <th className="px-4 py-3 font-medium">更新时间</th>
                    <th className="px-4 py-3 text-right font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((m) => {
                    const t = categoryTokens(m.category)
                    return (
                      <tr key={m.id} className="border-b border-black/[0.05] last:border-0 hover:bg-dai-50/40">
                        <td className="px-4 py-2.5">
                          <ManageThumb item={m} onEdit={() => setImgTarget(m)} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-[12px] text-ink-mute">{m.id}</td>
                        <td className="max-w-[22rem] px-4 py-3">
                          <Link
                            to={`/entry/${m.id}`}
                            className="line-clamp-1 font-medium text-ink hover:text-dai-700"
                          >
                            {m.title}
                          </Link>
                          <p className="mt-0.5 line-clamp-1 text-[11px] text-ink-mute">{m.summary}</p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <CategoryChip
                            category={m.category}
                            tokens={t}
                            name={CATEGORIES.find((c) => c.id === m.category)?.name}
                          />
                        </td>
                        <td className="max-w-[10rem] truncate px-4 py-3 text-[12px] text-ink-mute">{m.region}</td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span
                            className={`chip ${
                              m.status === 'published' ? 'bg-dai-50 text-dai-700' : 'bg-black/[0.06] text-ink-mute'
                            }`}
                          >
                            {m.status === 'published' ? '已发布' : '草稿'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-[12px] text-ink-mute">{m.updatedAt}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => setImgTarget(m)}
                              className={`btn-quiet btn-xs ${m.image ? '' : 'text-zhu-700'}`}
                              title={m.image ? '管理配图' : '添加配图'}
                            >
                              <Icon name="image" size={14} />
                            </button>
                            <button onClick={() => setEditing(m)} className="btn-quiet btn-xs" title="编辑">
                              <Icon name="edit" size={14} />
                            </button>
                            <Link to={`/entry/${m.id}`} className="btn-quiet btn-xs" title="查看">
                              <Icon name="eye" size={14} />
                            </Link>
                            <button
                              onClick={() => setConfirm({ kind: 'material', id: m.id, title: m.title })}
                              className="btn-quiet btn-xs text-zhu-700"
                              title="删除"
                            >
                              <Icon name="trash" size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* 移动端卡片列表 */}
            <div className="divide-y divide-black/[0.06] lg:hidden">
              {list.map((m) => (
                <div key={m.id} className="p-4">
                  <div className="flex gap-3">
                    <ManageThumb item={m} onEdit={() => setImgTarget(m)} size="lg" />
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex items-center gap-2">
                        <CategoryChip
                          category={m.category}
                          tokens={categoryTokens(m.category)}
                          name={CATEGORIES.find((c) => c.id === m.category)?.name}
                        />
                        <span className="font-mono text-[11px] text-ink-mute">{m.id}</span>
                      </div>
                      <p className="font-medium leading-snug text-ink">{m.title}</p>
                      <p className="mt-1 line-clamp-2 text-[12px] text-ink-mute">{m.summary}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[11px] text-ink-mute">更新 {m.updatedAt}</span>
                    <div className="flex gap-1">
                      <button onClick={() => setImgTarget(m)} className="btn-ghost btn-xs">
                        <Icon name="image" size={13} />
                        配图
                      </button>
                      <button onClick={() => setEditing(m)} className="btn-ghost btn-xs">
                        <Icon name="edit" size={13} />
                        编辑
                      </button>
                      <button
                        onClick={() => setConfirm({ kind: 'material', id: m.id, title: m.title })}
                        className="btn-ghost btn-xs text-zhu-700"
                      >
                        <Icon name="trash" size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

      {/* ======== 成果列表 ======== */}
      {tab === 'works' &&
        (workList.length === 0 ? (
          <Empty
            iconName="award"
            title={query ? '没有符合条件的成果' : '还没有学生成果'}
            desc={query ? '换个关键词试试。' : '点击「提交成果」录入第一篇学生作品。'}
            action={
              <Link to="/works/new" className="btn-primary">
                <Icon name="plus" size={15} />
                提交成果
              </Link>
            }
          />
        ) : (
          <div className="space-y-3">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-black/[0.02] px-3 py-2 text-[11.5px] text-ink-mute">
              <span className="flex items-center gap-1">
                <Icon name="sparkle" size={12} />
                AI 评阅覆盖
                <strong className="font-semibold text-ink-soft">
                  {reviewStats.done}/{reviewStats.total}
                </strong>
              </span>
              {reviewStats.done > 0 && (
                <>
                  <span className="text-ink-mute/50">·</span>
                  <span>
                    平均 <strong className="font-semibold text-ink-soft">{reviewStats.avg}</strong> 分
                  </span>
                </>
              )}
              {reviewStats.done < reviewStats.total && (
                <>
                  <span className="text-ink-mute/50">·</span>
                  <span>还有 {reviewStats.total - reviewStats.done} 项未评阅，可在成果详情页发起</span>
                </>
              )}
            </p>
            {workList.map((w) => (
              <div key={w.id} className="card flex flex-wrap items-center gap-4 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zhu-50 text-zhu-500">
                  <Icon name={w.type} size={19} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-ink">
                    <Link to={`/works/${w.id}`} className="hover:text-dai-700">
                      {w.title}
                    </Link>
                    <ReviewBadge review={reviews?.[w.id]} />
                  </p>
                  <p className="mt-1 text-[12px] text-ink-mute">
                    {w.author} · {w.semester} · {w.grade} · {workTypeName(w.type)} · 编号 {w.id}
                  </p>
                  {(w.docs || []).length > 0 && (
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-mute">
                      <span className="flex items-center gap-1">
                        <Icon name="doc" size={11} />
                        {w.docs.length} 份附件
                      </span>
                      <span className="text-ink-mute/50">·</span>
                      <span className="truncate">{w.docs.map((d) => d.name).join('、')}</span>
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  <Link to={`/works/${w.id}`} className="btn-quiet btn-xs" title="查看">
                    <Icon name="eye" size={14} />
                  </Link>
                  <button
                    onClick={() => setConfirm({ kind: 'work', id: w.id, title: w.title })}
                    className="btn-quiet btn-xs text-zhu-700"
                    title="移除"
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ))}

      {/* ======== 表单 ======== */}
      <MaterialForm
        open={creating || !!editing}
        initial={editing}
        onClose={() => {
          setCreating(false)
          setEditing(null)
        }}
      />

      {/* ======== 导入 ======== */}
      {importOpen && (
        <div className="fixed inset-0 z-[66] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink/45 backdrop-blur-sm" onClick={() => setImportOpen(false)} />
          <div className="animate-rise relative w-full max-w-2xl rounded-2xl border border-black/8 bg-paper-warm shadow-lift">
            <header className="flex items-center justify-between border-b border-black/[0.07] px-6 py-4">
              <div>
                <h3 className="font-serif text-lg font-semibold text-ink">导入素材数据</h3>
                <p className="mt-1 text-xs text-ink-mute">
                  支持粘贴 JSON 或选择 .json 文件。每条至少需要 title 与 category 字段，编号冲突时会自动重新分配。
                </p>
                <p className="mt-1 flex items-start gap-1.5 text-[11px] leading-relaxed text-tan-700">
                  <Icon name="info" size={11} className="mt-0.5 shrink-0" />
                  本入口只导入素材。备份文件里的 works（学生成果）与 reviews（评阅结果）不会被还原，
                  导出功能目前用于归档与审计。
                </p>
              </div>
              <button onClick={() => setImportOpen(false)} className="btn-quiet -mr-2" aria-label="关闭">
                <Icon name="close" size={18} />
              </button>
            </header>
            <div className="px-6 py-5">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <button onClick={() => fileRef.current?.click()} className="btn-ghost btn-xs">
                  <Icon name="upload" size={14} />
                  选择 JSON 文件
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={onPickFile}
                />
                <button
                  onClick={() =>
                    setImportText(
                      JSON.stringify(
                        [
                          {
                            title: '示例：某某民俗活动',
                            category: 'festival',
                            summary: '一句话简介（必填）',
                            body: ['第一段详细说明。', '第二段详细说明。'],
                            tags: ['示例标签'],
                            region: '福安市某乡镇',
                            era: '清代至今',
                            level: '市级非物质文化遗产',
                            source: '来源说明（请填写真实出处）',
                            sourceUrl: '',
                            image: ''
                          }
                        ],
                        null,
                        2
                      )
                    )
                  }
                  className="btn-quiet btn-xs"
                >
                  载入模板
                </button>
                <span className="text-[11px] text-ink-mute">
                  可用分类：{CATEGORIES.map((c) => `${c.id}(${c.name})`).join('、')}
                </span>
              </div>

              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                rows={12}
                spellCheck={false}
                placeholder='[{"title":"...","category":"festival","summary":"..."}]'
                className="field min-h-[16rem] font-mono text-[12px] leading-relaxed"
              />

              {importErr && (
                <p className="mt-3 flex items-start gap-2 rounded-xl bg-zhu-50 p-3 text-[12px] leading-relaxed text-zhu-700">
                  <Icon name="warn" size={14} className="mt-0.5 shrink-0" />
                  {importErr}
                </p>
              )}
            </div>
            <footer className="flex justify-end gap-2 border-t border-black/[0.07] px-6 py-4">
              <button onClick={() => setImportOpen(false)} className="btn-ghost">
                取消
              </button>
              <button
                onClick={() => handleImport(importText)}
                className="btn-primary"
                disabled={!importText.trim()}
              >
                <Icon name="check" size={15} />
                确认导入
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* ======== 配图管理 ======== */}
      <MaterialImageDialog item={imgTarget} onClose={() => setImgTarget(null)} />

      {/* ======== 删除确认 ======== */}
      <ConfirmDialog
        open={!!confirm}
        title={
          confirm?.kind === 'reset'
            ? '确认重置为默认示例数据？'
            : confirm?.kind === 'work'
              ? '确认移除该学生成果？'
              : '确认删除该素材？'
        }
        desc={
          confirm?.kind === 'reset'
            ? '将清空本地改动，恢复为内置的默认素材与成果数据。自行录入的内容将全部丢失，建议先「导出备份」。'
            : confirm
              ? `将删除《${confirm.title}》（编号 ${confirm.id}）。此操作不可撤销。`
              : ''
        }
        confirmText={confirm?.kind === 'reset' ? '确认重置' : confirm?.kind === 'work' ? '确认移除' : '确认删除'}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm.kind === 'material') removeMaterial(confirm.id)
          else if (confirm.kind === 'work') removeWork(confirm.id)
          else if (confirm.kind === 'reset') resetMaterials()
          setConfirm(null)
        }}
      />
    </div>
  )
}

/** 成果行上的评阅徽标：有结果给总分与等级，没有就给一个低对比的「未评阅」——这正是管理台要盯的待办 */
function ReviewBadge({ review }) {
  if (!review) {
    return (
      <span
        className="chip bg-black/[0.04] px-1.5 py-0 text-[10.5px] font-normal text-ink-mute"
        data-testid="manage-review-none"
      >
        未评阅
      </span>
    )
  }
  return (
    <span
      className="chip gap-1 bg-cha-50 px-1.5 py-0 text-[10.5px] font-semibold text-cha-700"
      data-testid="manage-review-score"
      title={`AI 评阅总分 ${review.total}${review.model ? ` · ${review.model}` : ''}`}
    >
      <Icon name="sparkle" size={10} />
      {review.total}
      <span className="font-normal opacity-70">{gradeOf(review.total)}</span>
    </span>
  )
}

/** 管理列表中的配图缩略图：点击直接进入配图管理 */
function ManageThumb({ item, onEdit, size = 'sm' }) {
  const src = useResolvedImage(item.image)
  const tokens = categoryTokens(item.category)
  const box = size === 'lg' ? 'h-20 w-28' : 'h-11 w-16'

  return (
    <button
      onClick={onEdit}
      title={item.image ? '点击更换 / 移除配图' : '点击添加配图'}
      className={`group relative shrink-0 overflow-hidden rounded-lg border ${
        item.image ? 'border-black/[0.08]' : 'border-dashed border-zhu-300'
      } ${box} ${tokens.bg}`}
    >
      {src ? (
        <>
          <img src={src} alt="" className="h-full w-full object-cover" />
          <span className="absolute inset-0 flex items-center justify-center bg-ink/55 opacity-0 transition-opacity group-hover:opacity-100">
            <Icon name="edit" size={14} className="text-white" />
          </span>
        </>
      ) : (
        <span className={`flex h-full w-full flex-col items-center justify-center gap-0.5 ${tokens.fg}`}>
          <Icon name="image" size={size === 'lg' ? 18 : 14} />
          <span className="text-[10px] font-medium opacity-80">缺图</span>
        </span>
      )}
    </button>
  )
}
