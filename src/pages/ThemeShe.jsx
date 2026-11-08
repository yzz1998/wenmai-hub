import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import Icon from '../components/Icon'
import { EntryCard } from '../components/EntryCard'
import { ThemeContentHead, ThemeHero, ThemeSidebar } from '../components/ThemeShell'
import { Empty } from '../components/UI'
import { useStore } from '../hooks/useStore'
import { SHE_ZONES } from '../data/taxonomy'
import { COLLECTION_MAP } from '../data/collections'

const ACCENT = COLLECTION_MAP.she.accent

/**
 * 畲族民俗文化馆 —— 原馆的七个展区改为左侧目录（桌面）/ 横向胶囊（移动）。
 *
 * 内容侧的调整只有一处：原本在弹层里读全文 + 翻相册，
 * 现在进入统一详情页，正文与相册同屏呈现，相册仍可连续查看并逐帧署名。
 */
export default function ThemeShe() {
  const { entries } = useStore()
  const [params, setParams] = useSearchParams()
  const cat = params.get('cat') || ''

  const all = useMemo(() => entries.filter((e) => e.collection === 'she'), [entries])
  const list = useMemo(() => (cat ? all.filter((e) => e.category === cat) : all), [all, cat])

  const activeZone = SHE_ZONES.find((z) => z.id === cat)
  const categories = SHE_ZONES.map((z) => ({
    ...z,
    count: all.filter((e) => e.category === z.id).length
  }))
  // 照片按文件去重计数：同一条照片可能被多个展项复用，按引用次数统计会虚高
  const photos = new Set()
  all.forEach((e) => (e.media || []).forEach((m) => photos.add(m.full || m.src)))
  const photoCount = photos.size

  const setCat = (id) => {
    const next = new URLSearchParams(params)
    if (id) next.set('cat', id)
    else next.delete('cat')
    setParams(next, { replace: true })
  }

  return (
    <div className="animate-seep">
      <ThemeHero
        collection="she"
        stats={[
          { label: '展项', value: all.length },
          { label: '展区', value: SHE_ZONES.length },
          { label: '实景照片', value: photoCount }
        ]}
      >
        <div className="mt-6 flex flex-wrap items-center gap-2 text-[12px] text-ink-mute">
          <span className="inline-flex items-center gap-1 rounded-lg border border-indigoSea-100 bg-indigoSea-50 px-2 py-1 text-indigoSea-700">
            <Icon name="phoenix" size={12} />
            山哈 · 闽东畲族
          </span>
          <span>语言文字 · 传统服饰 · 歌舞艺术 · 节庆习俗 · 手工技艺 · 文史医药 · 彩带织锦</span>
        </div>
      </ThemeHero>

      <div className="wrap grid gap-8 py-8 lg:grid-cols-[248px_minmax(0,1fr)]">
        <ThemeSidebar
          categories={categories}
          active={cat}
          onChange={setCat}
          total={all.length}
          allLabel="全部展项"
          accent={ACCENT}
          label="展区目录"
          intro={activeZone ? `${activeZone.en} · ${activeZone.desc}` : ''}
        />

        <main className="min-w-0">
          <ThemeContentHead
            title={activeZone ? activeZone.name : '全部展项'}
            count={list.length}
            desc={
              activeZone
                ? `${activeZone.desc} · 共 ${list.reduce((n, e) => n + (e.media || []).length, 0)} 帧照片`
                : '七个展区依次展开；每个展项含释读文字与实景相册'
            }
            right={
              activeZone && (
                <span className="hidden items-center gap-1.5 rounded-lg border border-black/[0.07] bg-white px-2.5 py-1.5 text-[11px] text-indigoSea-700 sm:inline-flex">
                  <Icon name="phoenix" size={12} />
                  {activeZone.en}
                </span>
              )
            }
          />

          {list.length === 0 ? (
            <Empty title="此展区暂无展项" iconName="phoenix" desc="换一个展区，或回到全部展项。" />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {list.map((e, i) => (
                <EntryCard key={e.id} entry={e} index={i} />
              ))}
            </div>
          )}

          <section className="mt-10 rounded-2xl border border-black/[0.07] bg-white p-4">
            <h2 className="mb-2 flex items-center gap-1.5 font-serif text-[13.5px] font-bold text-ink">
              <Icon name="camera" size={14} />
              关于照片与署名
            </h2>
            <p className="text-[12.5px] leading-[1.9] text-ink-mute">
              本馆 {photoCount} 帧实景照片来自福建日报、中新社、潮新闻、人民图片网、福建文艺网等公开报道，
              每帧均在相册与查看器中标注拍摄者或刊发媒体。照片版权归原权利人所有，本馆仅用于教学展示；
              如需转载或商业使用，请据署名回溯原出处并取得授权。文字条目参考中国非物质文化遗产网、
              福建省艺术馆及各地政府门户，原始链接见各展项详情页「参考与延伸」。
            </p>
          </section>
        </main>
      </div>
    </div>
  )
}
