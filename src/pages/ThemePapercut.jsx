import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Icon from '../components/Icon'
import { EntryCard } from '../components/EntryCard'
import { ThemeContentHead, ThemeHero, ThemeSidebar } from '../components/ThemeShell'
import { Empty } from '../components/UI'
import { useStore } from '../hooks/useStore'
import { PAPERCUT_CATEGORIES } from '../data/taxonomy'
import { COLLECTION_MAP } from '../data/collections'

const PAGE = 40
const ACCENT = COLLECTION_MAP.papercut.accent

/**
 * 剪纸纹样馆 —— 保留原馆的「左侧纹样目录 + 右侧瀑布流」版式。
 *
 * 三处刻意的一致性调整（其余原样）：
 * 1) 图样比例保持原始宽高比（对叠剪的团花不能裁切），所以用瀑布流而非等宽卡；
 * 2) 点击不再开弹层，而是进入统一详情页 /entry/:id（可分享、可后退）；
 * 3) 详情页的图版仍支持滚轮锚点缩放 1–6×，与原来弹层里的手感一致。
 */
export default function ThemePapercut() {
  const { entries } = useStore()
  const [params, setParams] = useSearchParams()
  const cat = params.get('cat') || ''
  const [visible, setVisible] = useState(PAGE)

  const all = useMemo(() => entries.filter((e) => e.collection === 'papercut'), [entries])
  const list = useMemo(() => (cat ? all.filter((e) => e.category === cat) : all), [all, cat])

  useEffect(() => {
    setVisible(PAGE)
  }, [cat])

  const activeCat = PAPERCUT_CATEGORIES.find((c) => c.id === cat)
  const categories = PAPERCUT_CATEGORIES.map((c) => ({
    ...c,
    count: all.filter((e) => e.category === c.id).length
  }))
  /** 侧栏分类释义：截断到 220 字，并确保空值时不产生 "undefined" 文本 */
  const sidebarIntro = activeCat?.intro
    ? `${activeCat.intro.slice(0, 220)}${activeCat.intro.length > 220 ? '……' : ''}`
    : ''

  const setCat = (id) => {
    const next = new URLSearchParams(params)
    if (id) next.set('cat', id)
    else next.delete('cat')
    setParams(next, { replace: true })
  }

  const shown = list.slice(0, visible)

  return (
    <div className="animate-seep">
      <ThemeHero
        collection="papercut"
        stats={[
          { label: '图样', value: all.length },
          { label: '题材', value: PAPERCUT_CATEGORIES.length },
          { label: '图录', value: '上下两册' }
        ]}
      >
        <div className="mt-6 flex flex-wrap items-center gap-2 text-[12px] text-ink-mute">
          <span className="inline-flex items-center gap-1 rounded-lg border border-zhu-100 bg-zhu-50 px-2 py-1 text-zhu-700">
            <Icon name="scissors" size={12} />
            中国民间彩贴剪纸
          </span>
          <span>陕西 · 旬邑 · 库淑兰（1920—2004）</span>
          <span className="text-ink-mute/40">|</span>
          <span>取材自《剪花娘子》图录，按题材编次</span>
        </div>
      </ThemeHero>

      <div className="wrap grid gap-8 py-8 lg:grid-cols-[248px_minmax(0,1fr)]">
        <ThemeSidebar
          categories={categories}
          active={cat}
          onChange={setCat}
          total={all.length}
          allLabel="全部图样"
          accent={ACCENT}
          label="纹样目录"
          intro={sidebarIntro}
        />

        <main className="min-w-0">
          <ThemeContentHead
            title={activeCat ? activeCat.name : '全部图样'}
            count={list.length}
            desc={
              activeCat
                ? '按图录页码顺序排列，点击进入详情可深度缩放'
                : '八个题材按图录编次排列；点开任一图样可查看纹样细解'
            }
            right={
              <span className="hidden items-center gap-1.5 rounded-lg border border-black/[0.07] bg-white px-2.5 py-1.5 text-[11px] text-ink-mute sm:inline-flex">
                <Icon name="expand" size={12} />
                详情页支持 1–6× 缩放
              </span>
            }
          />

          {activeCat?.intro && (
            <div className="mb-5 rounded-2xl border border-zhu-100 bg-zhu-50/60 p-4 lg:hidden">
              <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-zhu-700">
                <Icon name="info" size={12} />
                {activeCat.name} · 分类释义
              </p>
              <p className="text-[12.5px] leading-[1.85] text-ink-soft">{activeCat.intro}</p>
            </div>
          )}

          {list.length === 0 ? (
            <Empty title="此分类暂无图样" iconName="scissors" desc="换一个题材，或回到全部图样。" />
          ) : (
            <>
              <div className="masonry columns-2 md:columns-3 xl:columns-4">
                {shown.map((e, i) => (
                  <EntryCard key={e.id} entry={e} index={i} variant="masonry" />
                ))}
              </div>

              {visible < list.length && (
                <div className="mt-6 flex flex-col items-center gap-2">
                  <button onClick={() => setVisible((v) => v + PAGE)} className="btn-ghost">
                    <Icon name="chevron" size={15} />
                    继续翻看（还有 {list.length - visible} 件）
                  </button>
                  <p className="text-[11px] text-ink-mute/70">
                    已显示 {shown.length} / {list.length}
                  </p>
                </div>
              )}
            </>
          )}

          {/* 图录说明 */}
          <section className="mt-10 rounded-2xl border border-black/[0.07] bg-white p-4">
            <h2 className="mb-2 flex items-center gap-1.5 font-serif text-[13.5px] font-bold text-ink">
              <Icon name="book" size={14} />
              关于这套图录
            </h2>
            <p className="text-[12.5px] leading-[1.9] text-ink-mute">
              全馆共 {all.length} 件图样，分八个题材：剪花娘子系列、人物形象、花卉草木、动物纹样、爱情婚姻故事、
              生活场景与世情、民俗信仰与吉祥、纹样符号与构成元素。上册为论述性画册，图版区为满版整页；
              下册按乡土生活、爱情史话、世俗风情、童谣世界、宗教信仰、剪花娘子六个板块编次。
              每条图样均著录册次、页码与图版尺寸，可在详情页核回图录。
            </p>
          </section>
        </main>
      </div>
    </div>
  )
}
