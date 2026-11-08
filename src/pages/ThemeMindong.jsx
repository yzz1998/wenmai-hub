import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import Icon from '../components/Icon'
import { EntryCard } from '../components/EntryCard'
import { ThemeContentHead, ThemeHero, ThemeSidebar } from '../components/ThemeShell'
import { Empty } from '../components/UI'
import { useStore } from '../hooks/useStore'
import { MINDONG_CATEGORIES } from '../data/taxonomy'
import { COLLECTION_MAP } from '../data/collections'

const ACCENT = COLLECTION_MAP.mindong.accent

/**
 * 闽东本土文化知识库 —— 从「资源库里的一个筛选项」升为独立专题馆。
 *
 * 为什么不直接复用资源库的列表：
 * 资源库回答「有没有这条」，按 24 条分页、字段匹配，读者看到的是检索结果；
 * 知识库原本的组织方式是「五类主题」（节庆 / 曲艺 / 人物 / 技艺 / 名胜），
 * 每类有自己的释义与地望，这个编次本身是策展成果，值得单独成馆。
 *
 * 与剪纸、畲族两馆的差别：本馆条目是「素材」而非「展项」，可增删改、可替换配图，
 * 所以底部给出维护入口与来源说明，而不是像展馆那样只交代摄影署名。
 */
export default function ThemeMindong() {
  const { entries } = useStore()
  const [params, setParams] = useSearchParams()
  const cat = params.get('cat') || ''

  const all = useMemo(() => entries.filter((e) => e.collection === 'mindong'), [entries])
  const list = useMemo(() => (cat ? all.filter((e) => e.category === cat) : all), [all, cat])

  const activeCat = MINDONG_CATEGORIES.find((c) => c.id === cat)
  const categories = MINDONG_CATEGORIES.map((c) => ({
    ...c,
    count: all.filter((e) => e.category === c.id).length
  }))

  // 按文件去重计数：同一条素材被多个条目引用时不应重复计
  const images = new Set()
  all.forEach((e) => (e.media || []).forEach((m) => images.add(m.full || m.src)))

  // 地望覆盖：region 是「福安 · 蕉城 · 霞浦 · 宁德全市」这样的自由文本，还夹着乡镇村名，
  // 直接按分隔符切分会把「蕉城区霍童镇」算成另一个地方。这里只按宁德九县市白名单比对。
  const COUNTIES = ['蕉城', '福安', '福鼎', '霞浦', '古田', '屏南', '寿宁', '周宁', '柘荣']
  const counties = new Set()
  all.forEach((e) => {
    const r = String(e.region || '')
    COUNTIES.forEach((c) => {
      if (r.includes(c)) counties.add(c)
    })
  })

  const setCat = (id) => {
    const next = new URLSearchParams(params)
    if (id) next.set('cat', id)
    else next.delete('cat')
    setParams(next, { replace: true })
  }

  /* 全部视图按五类分组陈列（保留编次）；选定某类后平铺，便于逐条比对 */
  const groups = cat
    ? [{ cat: activeCat, list }]
    : MINDONG_CATEGORIES.map((c) => ({ cat: c, list: all.filter((e) => e.category === c.id) }))
        .filter((g) => g.list.length > 0)

  return (
    <div className="animate-seep">
      <ThemeHero
        collection="mindong"
        stats={[
          { label: '条素材', value: all.length },
          { label: '类主题', value: MINDONG_CATEGORIES.length },
          { label: '张配图', value: images.size }
        ]}
      >
        <div className="mt-6 flex flex-wrap items-center gap-2 text-[12px] text-ink-mute">
          <span className="inline-flex items-center gap-1 rounded-lg border border-dai-100 bg-dai-50 px-2 py-1 text-dai-700">
            <Icon name="mountain" size={12} />
            山海之间 · 闽东九县市
          </span>
          <span>节庆 · 曲艺 · 人物 · 技艺 · 名胜</span>
        </div>
      </ThemeHero>

      <div className="wrap grid gap-8 py-8 lg:grid-cols-[248px_minmax(0,1fr)]">
        <ThemeSidebar
          categories={categories}
          active={cat}
          onChange={setCat}
          total={all.length}
          allLabel="全部素材"
          accent={ACCENT}
          label="主题目录"
          intro={activeCat ? activeCat.desc : ''}
        />

        <main className="min-w-0">
          <ThemeContentHead
            title={activeCat ? activeCat.name : '全部素材'}
            count={list.length}
            desc={
              activeCat
                ? activeCat.desc
                : `五类主题依次陈列 · 素材涉及闽东 ${counties.size || '九'} 个县市区`
            }
            right={
              <span className="hidden items-center gap-1.5 rounded-lg border border-black/[0.07] bg-white px-2.5 py-1.5 text-[11px] text-dai-700 sm:inline-flex">
                <Icon name="book" size={12} />
                可检索 · 可引用 · 可维护
              </span>
            }
          />

          {list.length === 0 ? (
            <Empty title="此主题暂无素材" iconName="book" desc="换一个主题，或回到全部素材。" />
          ) : cat ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {list.map((e, i) => (
                <EntryCard key={e.id} entry={e} index={i} />
              ))}
            </div>
          ) : (
            <div className="space-y-9">
              {groups.map((g, gi) => (
                <section key={g.cat.id} id={g.cat.id} className="scroll-mt-24">
                  <header className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-black/[0.07] pb-2">
                    <span className="font-serif text-[12px] tabular-nums text-ink-mute">
                      {String(gi + 1).padStart(2, '0')}
                    </span>
                    <h3 className="flex items-center gap-1.5 font-serif text-[17px] font-bold text-ink">
                      <Icon name={g.cat.icon} size={15} className={ACCENT.text} />
                      {g.cat.name}
                    </h3>
                    <span className="text-[11px] text-ink-mute">{g.list.length} 条</span>
                    <p className="w-full text-[12px] leading-relaxed text-ink-mute sm:w-auto sm:flex-1">
                      {g.cat.desc}
                    </p>
                  </header>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {g.list.map((e, i) => (
                      <EntryCard key={e.id} entry={e} index={i} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          <section className="mt-10 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-black/[0.07] bg-white p-4">
              <h2 className="mb-2 flex items-center gap-1.5 font-serif text-[13.5px] font-bold text-ink">
                <Icon name="camera" size={14} />
                关于素材与来源
              </h2>
              <p className="text-[12.5px] leading-[1.9] text-ink-mute">
                本馆 {all.length} 条素材的配图取自政府门户、地方史志与权威媒体报道，
                每条在详情页标注刊发媒体与原文链接。文字依据非物质文化遗产名录、
                各地政府门户与史志资料整理，原始出处见「参考与延伸」。
              </p>
            </div>
            <div className="rounded-2xl border border-black/[0.07] bg-white p-4">
              <h2 className="mb-2 flex items-center gap-1.5 font-serif text-[13.5px] font-bold text-ink">
                <Icon name="edit" size={14} />
                这是一座可维护的馆
              </h2>
              <p className="text-[12.5px] leading-[1.9] text-ink-mute">
                与剪纸、畲族两馆的「定稿展陈」不同，素材会随教学需要增补：
                新增条目、替换配图、调整主题归属都在管理页完成，保存后本馆即时更新。
                条目编号一经启用不再变动，便于讲义与课件长期引用。
              </p>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
