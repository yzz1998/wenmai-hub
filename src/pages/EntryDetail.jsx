import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import DetailShell from '../components/DetailShell'
import CitationBar from '../components/CitationBar'
import MediaGallery from '../components/MediaGallery'
import { Empty } from '../components/UI'
import MaterialForm from '../components/MaterialForm'
import Icon from '../components/Icon'
import { useStore } from '../hooks/useStore'
import { getEntry, relatedEntries, siblingsOf } from '../data'
import { categoryMeta } from '../data/taxonomy'
import { COLLECTION_MAP } from '../data/collections'

/**
 * 统一条目详情页 —— 三馆条目共用一条路由 /entry/:id。
 *
 * 合并前：剪纸、畲族用弹层（不可分享、不可后退），知识素材用独立页。
 * 合并后：一个真实 URL，按 collection 装配不同区块：
 *   · papercut → 图录元数据（册次/页码/图版尺寸）+ 单幅深度缩放
 *   · she      → 展区导览 + 多帧实景相册 + 原始报道链接
 *   · mindong  → 正文段落 + 来源 + 就地编辑
 * 骨架（面包屑/标题/摘要/引用/相邻件/相关条目）完全一致。
 */
export default function EntryDetail() {
  const { id } = useParams()
  const { entries } = useStore()
  const [editing, setEditing] = useState(false)

  const entry = getEntry(entries, id)

  const { prevEntry, nextEntry, related, siblings } = useMemo(() => {
    if (!entry) return { prevEntry: null, nextEntry: null, related: [], siblings: [] }
    const list = siblingsOf(entries, entry)
    const at = list.findIndex((e) => e.id === entry.id)
    return {
      prevEntry: at > 0 ? list[at - 1] : null,
      nextEntry: at >= 0 && at < list.length - 1 ? list[at + 1] : null,
      related: relatedEntries(entry, entries, 4),
      siblings: list
    }
  }, [entry, entries])

  if (!entry) {
    return (
      <div className="wrap py-20">
        <Empty
          iconName="warn"
          title="未找到该条目"
          desc={`编号 ${id} 对应的内容可能已删除，或链接有误。三个专题的条目都在同一检索里，可以直接搜标题。`}
          action={
            <Link to="/library" className="btn-primary">
              <Icon name="search" size={15} />
              前往资源库检索
            </Link>
          }
        />
      </div>
    )
  }

  const meta = categoryMeta(entry.collection, entry.category)
  const coll = COLLECTION_MAP[entry.collection]

  /* ---------- 各馆的元数据表 ---------- */
  const metaItems =
    entry.collection === 'papercut'
      ? [
          ['分类', meta.name],
          ['册次', `${entry.facets?.vol || '—'}册`],
          ['页码', entry.facets?.page ? `p.${entry.facets.page}` : '—'],
          ['图版尺寸', entry.facets?.size || '图录未标注'],
          ['创作年代', entry.facets?.year || '图录未标注'],
          ['条目编号', entry.id]
        ]
      : entry.collection === 'she'
        ? [
            ['展区', entry.facets?.zone || meta.name],
            ['形制', entry.facets?.type || '—'],
            ['照片', `${(entry.media || []).length} 帧`],
            ['地域', entry.region || '闽东畲族聚居区'],
            ['条目编号', entry.id]
          ]
        : entry.collection === 'mindong'
          ? [
              ['地域分布', entry.region],
              ['年代', entry.era],
              ['保护级别', entry.level]
            ]
          : [
              ['所属章节', [entry.facets?.chapter, entry.facets?.chapterTitle].filter(Boolean).join('　')],
              ['小节', [entry.facets?.section, entry.facets?.sectionTitle].filter(Boolean).join('　')],
              ['要点位置', entry.facets?.kp ? `第${entry.facets.kp}点` : '—'],
              ['条目编号', entry.id]
            ]

  /* ---------- 正文 ---------- */
  const bodyBlock = (
    <div className="prose-md">
      {(entry.body || []).length > 0 ? (
        entry.body.map((p, i) => (
          <p key={i} className={p.startsWith('【') ? 'text-ink-soft' : ''}>
            {p}
          </p>
        ))
      ) : (
        <p className="text-ink-mute">本条仅有摘要与图版信息。</p>
      )}
    </div>
  )

  return (
    <>
      <DetailShell
        entry={entry}
        metaItems={metaItems}
        aside={
          <>
            <CitationBar entry={entry} />
            {entry.collection === 'mindong' && (
              <button onClick={() => setEditing(true)} className="btn-ghost w-full">
                <Icon name="edit" size={14} />
                编辑本条素材
              </button>
            )}
            {entry.collection === 'papercut' && siblings.length > 1 && (
              <p className="rounded-xl border border-black/[0.06] bg-white/60 p-3 text-[11.5px] leading-relaxed text-ink-mute">
                本条属于「{meta.name}」，同类共 {siblings.length} 件。可用页面底部的上一件 / 下一件连续翻看，
                或回到
                <Link to={`/theme/papercut?cat=${encodeURIComponent(entry.category)}`} className="mx-1 text-zhu-700 hover:underline">
                  纹样目录
                </Link>
                按图录顺序浏览。
              </p>
            )}
            {entry.collection === 'she' && (
              <p className="rounded-xl border border-black/[0.06] bg-white/60 p-3 text-[11.5px] leading-relaxed text-ink-mute">
                本条属于「{meta.name}」展区。展区说明与其余展项见
                <Link to={`/theme/she?cat=${entry.category}`} className="mx-1 text-indigoSea-700 hover:underline">
                  畲族民俗馆
                </Link>
                。
              </p>
            )}
            {entry.collection === 'mindong' && (
              <p className="rounded-xl border border-black/[0.06] bg-white/60 p-3 text-[11.5px] leading-relaxed text-ink-mute">
                知识素材可在「管理」页批量维护（新增 / 导入 / 配图 / 导出），修改后本页即时更新。
              </p>
            )}
          </>
        }
        prevEntry={prevEntry}
        nextEntry={nextEntry}
        related={related}
        relatedTitle="相关条目 · 可跨专题"
        backHref={coll?.route || '/library'}
        backLabel={`返回${coll?.short || '资源库'}`}
      >
        <div className="space-y-8">
          {coll?.kind !== 'course' && <MediaGallery entry={entry} />}

          <section>
            <h2 className="mb-3 flex items-center gap-2 font-serif text-[16px] font-bold text-ink">
              <span className={`h-4 w-1 rounded-full ${coll?.accent?.bgSolid || 'bg-dai-700'}`} />
              {entry.collection === 'papercut'
                ? '纹样细解'
                : entry.collection === 'she'
                  ? '展项释读'
                  : coll?.kind === 'course'
                    ? '要点释读'
                    : '条目详情'}
            </h2>
            {bodyBlock}
          </section>

          {/* 畲族条目补充：原始报道链接 */}
          {entry.collection === 'she' && entry.links?.length > 0 && (
            <section>
              <h2 className="mb-2 flex items-center gap-2 font-serif text-[14px] font-bold text-ink">
                <Icon name="link" size={14} />
                参考与延伸
              </h2>
              <ul className="space-y-1.5">
                {entry.links.map(([label, url]) => (
                  <li key={url}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="flex items-start gap-1.5 text-[13px] leading-relaxed text-dai-700 hover:underline"
                    >
                      <Icon name="external" size={12} className="mt-1 shrink-0" />
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* 剪纸条目：图录信息卡 */}
          {entry.collection === 'papercut' && (
            <section className="rounded-2xl border border-black/[0.07] bg-white/60 p-4">
              <h2 className="mb-2 flex items-center gap-1.5 font-serif text-[13.5px] font-bold text-ink">
                <Icon name="book" size={14} />
                图录著录
              </h2>
              <p className="text-[12.5px] leading-[1.9] text-ink-mute">
                {entry.title}　图版见《剪花娘子》{entry.facets?.vol}册第 {entry.facets?.page} 页
                {entry.facets?.size ? `，原图版尺寸 ${entry.facets.size}` : ''}
                {entry.facets?.year ? `，创作年代 ${entry.facets.year}` : ''}。
                原始图样编号：<span className="font-mono text-[11.5px]">{entry.sourceId}</span>。
              </p>
            </section>
          )}
        </div>
      </DetailShell>

      {entry.collection === 'mindong' && (
        <MaterialForm open={editing} initial={entry} onClose={() => setEditing(false)} />
      )}
    </>
  )
}
