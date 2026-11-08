import { Link } from 'react-router-dom'
import Icon from '../components/Icon'
import { SectionTitle } from '../components/UI'
import { useStore } from '../hooks/useStore'
import { COLLECTIONS } from '../data/collections'
import { PAPERCUT_CATEGORIES, MINDONG_CATEGORIES, SHE_ZONES } from '../data/taxonomy'
import { computeStats } from '../data'

/* ---------------- 内容数据 ---------------- */

const SOURCE_MAP = [
  {
    from: '《人类与社会》教材',
    form: '纸质教材 · 章 / 节 / 小目三级结构',
    to: '专题馆 › 资源与发展馆 / 城市与乡村馆',
    kept: [
      '第二章 人类社会发展与资源（三节 · 12 条要点）',
      '第五章 城市、城市化与乡村社会（教材原题「城市化、工业化与乡村社会」，三节 · 13 条要点）',
      '原章节顺序与节内要点次序'
    ],
    changed: [
      '书面章节 → 条目化要点释读，可单独检索与引用',
      '新增馆—节—要点三级编次与「按节分组」陈列',
      '引用格式改为「章 + 节 + 要点位置」'
    ],
    color: 'dai'
  },
  {
    from: '库淑兰剪纸纹样馆',
    form: '纯静态单页 · 原生 HTML/CSS/JS',
    to: '专题馆 › 剪纸纹样馆',
    kept: ['241 件图样与 8 类题材编次', '分类释义原文', '图录页码 / 图版尺寸', '1–6× 滚轮锚点缩放 + 拖拽平移'],
    changed: ['详情弹层 → /entry/:id 独立路由', '图片路径改为 ascii 编号，去掉中文 URL 风险'],
    color: 'zhu'
  },
  {
    from: '畲族民俗文化展示',
    form: '离线单页 + base64 缩略图（photos.js 7MB）',
    to: '专题馆 › 畲族民俗馆',
    kept: ['7 个展区 · 30 个展项与原文', '78 帧实景照片与逐帧署名', '原始报道外链', '展区主题色与图标'],
    changed: ['顶部分区横栏 → 左侧目录（与剪纸馆统一）', 'base64 内嵌 → 实体文件按需加载（体积降 7MB）', '弹层 → 统一详情页'],
    color: 'indigoSea'
  },
  {
    from: '闽东本土文化知识库',
    form: 'Vite + React 19 单页应用',
    to: '资源库 / 学生成果 / 管理（作为外壳骨架）',
    kept: ['38 条素材与来源标注', '中文检索内核（二元组分词 + 字段加权）', '素材 CRUD 与配图管理（IndexedDB）', '学生成果入库流程', '设计令牌与组件规范'],
    changed: ['检索范围从 38 条扩到 334 条（含课程 25 条要点）', '新增 collection 维度与跨馆相关推荐', '引用格式按专题分流', '路由 /material/:id → /entry/:id（旧链接自动跳转）'],
    color: 'dai'
  }
]

const SHARED = [
  ['Entry 数据模型', '一条内容的所有形态：标题/摘要/正文/标签/媒体/署名/来源/扩展 facets', '新建（抽取自三源）'],
  ['SearchBox + 检索内核', '输入即搜（300ms 防抖）、Ctrl/⌘K 聚焦、字段加权、命中回显、多条件交集', '知识库 search.js 升级'],
  ['Lightbox', '光标锚点缩放 1–6×、拖拽平移、限位防拖丢、相册连播、逐帧署名', '剪纸缩放内核 + 畲族相册 + 知识库大图'],
  ['MediaGallery', '按专题形态切换：单幅图版 / 单图 / 三列相册', '新建（统一三处图片排版）'],
  ['EntryCard', '三变体（grid / masonry / row），徽标、标签、选辑、引用入口一致', '知识库 MaterialCard 抽象'],
  ['DetailShell', '面包屑 → 徽标 → 标题 → 摘要 → 元数据 → 正文 → 来源 → 相邻件 → 相关条目', '新建（收编三处详情版式）'],
  ['CitationBar', '引用格式按专题分流；复制引用 / 复制链接 / 导出 Markdown / 加入选辑', '知识库 citation.js 扩展'],
  ['ThemeShell', '专题题匾 + 左侧目录 + 内容头，五个馆共用', '新建（收编剪纸侧栏 + 畲族分区）'],
  ['SelectionDrawer', '跨专题教学选辑，按专题分组、导出备课包', '新建（合并后才成立的能力）'],
  ['ImageField / MaterialForm', '配图替换、压缩、IndexedDB 大图仓储、素材表单', '知识库原样复用'],
  ['Store / storage', 'localStorage 持久化、旧 key 迁移、素材与成果 CRUD、Toast', '知识库 useStore 扩展'],
  ['UI 原语', 'Button / Chip / Card / Modal / Toast / Empty / Segmented / Stat', '知识库 UI.jsx 扩展']
]

const NAV_TREE = [
  ['/', '首页', '平台总览 · 课程两馆与乡土入口 · 全库搜索 · 跨馆关联示例'],
  ['/library', '资源库', '334 条统一检索：专题 / 分类 / 标签 / 排序 / 网格与列表'],
  ['/entry/:id', '条目详情', '全站唯一详情出口：图集 + 正文 + 引用 + 相邻件 + 跨馆相关'],
  ['/theme', '专题馆', '五个专题馆的入口与策展说明'],
  ['/theme/papercut', '剪纸纹样馆', '8 类题材侧栏 + 瀑布流（原始比例）+ 图录著录'],
  ['/theme/she', '畲族民俗馆', '7 展区侧栏 + 等宽卡 + 实景相册'],
  ['/theme/mindong', '闽东知识库', '5 类主题侧栏 + 按类分组 + 可增删维护'],
  ['/theme/resources', '资源与发展馆', '第二章：3 节侧栏 + 按节分组 + 章节导读'],
  ['/theme/urban-rural', '城市与乡村馆', '第五章：3 节侧栏 + 按节分组 + 章节导读'],
  ['/works', '学生成果', '成果列表 · 多维筛选（作者 / 学期 / 类型）'],
  ['/works/new', '提交成果', '成果入库表单（含封面）'],
  ['/manage', '管理', '知识素材 CRUD · 配图管理 · 导入导出 · 选辑概览'],
  ['/about', '关于', '架构、模块对应、共享组件、取舍与来源说明']
]

const DECISIONS = [
  {
    q: '分类体系为什么不合并成一套？',
    a: '剪纸的「花卉草木」与畲族的「传统服饰」不在同一维度，硬并会把两馆的策展逻辑同时打断。合并的是访问方式——统一 categoryMeta(collection, id) 入口，页面与卡片只认这一个函数，分类数据各存各的。'
  },
  {
    q: '畲族内容在知识库里也有，重复了怎么办？',
    a: '不删。两者叙述粒度不同（知识库是教学条目，展馆是展陈文本），删任何一侧都会损失信息。改为用标签与主题重叠自动生成跨馆「相关条目」，让两条记录互相指路而不是互相取代。'
  },
  {
    q: '为什么剪纸、畲族不能编辑，只有知识素材能？',
    a: '这是内容性质决定的：剪纸是图录的数字化摹本，页码与图版必须可回溯；畲族展项是对公开报道的二次整理，改动会破坏与原文的对应。两者设为只读策展语料，管理页只维护可增删的知识素材，并在页面上写明这一点。'
  },
  {
    q: '原来剪纸和畲族都是弹层，为什么改成独立页？',
    a: '弹层无法分享、无法后退、无法被检索收录。合并后所有条目共享 /entry/:id，深链可发、可收藏、可被引用；旧的 #/material/:id 链接会自动重定向，不会失效。'
  },
  {
    q: '课程两章为什么做成专题馆，而不是资源库里的两个库？',
    a: '教材的章本身带有编次与叙事推进（概念 → 问题 → 出路；空间 → 产业 → 动力），这正是专题馆要保留的东西。资源库只回答「有没有这条」，专题馆回答「这批内容怎么被组织」。两章各建一馆，进馆先看到章导语、学习目标与三节目的，再按节陈列要点。'
  },
  {
    q: '两个课程馆怎么保证互不混杂？',
    a: '由数据边界保证，不靠人盯：两馆的条目 id 前缀不同（HS2 / HS5）、collection 不同（hs-res / hs-city）、分类只取本章三节；页面里凡取数据处都先按 collection 过滤，页尾的「另一个课程专题馆」是唯一的跨馆入口。'
  },
  {
    q: '两个专题的浏览版式为什么统一成左侧目录？',
    a: '两馆分类都在 7–8 个量级，侧栏能让内容区保持完整宽度；畲族原本的顶部横栏在合并后与剪纸并置会显得像两套系统。差异改由内容区承担：剪纸用原始比例瀑布流（团花不能裁切），畲族用等宽 4:3 卡片（照片构图统一）。'
  }
]

export default function About() {
  const { entries } = useStore()
  const stats = computeStats(entries)

  return (
    <div className="animate-seep">
      <section className="relative overflow-hidden border-b border-black/[0.06]">
        <div className="paper-grain absolute inset-0" aria-hidden="true" />
        <div className="wrap relative py-10 sm:py-12">
          <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-ink-mute">
            <span className="h-px w-8 bg-dai-700" />
            ABOUT THE PLATFORM
          </p>
          <h1 className="plaque-title text-[32px] sm:text-[40px]">关于本站</h1>
          <p className="mt-4 max-w-3xl text-[14.5px] leading-[1.95] text-ink-soft">
            本站以《人类与社会》课程的两个章节为主干 —— 第二章「人类社会发展与资源」、第五章「城市、城市化与乡村社会」，
            各自构成一个独立的专题馆，按「章 — 节 — 要点」三级组织，两馆互不混排；另设剪纸、畲族、闽东知识库三个乡土专题馆，作为课程的本地案例。
            目前共 <b className="font-semibold text-ink">{stats.total}</b> 条统一条目、
            <b className="font-semibold text-ink">{stats.media}</b> 张图片与图版，
            全部落在同一套内容模型、同一套检索、引用与选辑之上。
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {COLLECTIONS.map((c) => (
              <Link key={c.id} to={c.route} className={`chip ${c.accent.bg} ${c.accent.text} text-[12px]`}>
                <Icon name={c.icon} size={12} />
                {c.name}
                <span className="ml-0.5 opacity-60">{stats.byCollection[c.id] || 0}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- 架构 ---------------- */}
      <section className="wrap py-10">
        <SectionTitle
          eyebrow="ARCHITECTURE"
          title="一库三径"
          sub="底层一份统一内容库，上层三条不同的访问路径。所谓「有机合并」，指的是共享同一份数据与同一套组件，而不是三套页面并排摆放。"
        />

        <div className="grid gap-3 lg:grid-cols-3">
          {[
            {
              t: '① 数据层',
              s: 'Entry 统一模型',
              d: 'papercut 241 / she 30 / mindong 38 / 课程两章 25 全部归一为同一结构：id、collection、title、summary、body[]、tags[]、media[]、credit、source、facets。抽取脚本保证原文一字不改，只做结构映射与资源搬迁。',
              icon: 'layers',
              tone: 'bg-dai-50 text-dai-700'
            },
            {
              t: '② 能力层',
              s: '四个共享内核',
              d: '检索内核（跨馆打分与过滤）、引用内核（按专题分流格式）、图集内核（缩放 / 相册 / 署名）、持久化内核（localStorage + IndexedDB，含旧数据迁移）。',
              icon: 'sparkle',
              tone: 'bg-indigoSea-50 text-indigoSea-700'
            },
            {
              t: '③ 展示层',
              s: '三径 + 教学',
              d: '资源库（索引路径）、专题馆（策展路径）、条目详情（唯一出口）、教学（学生成果 / 管理 / 跨馆选辑）。所有路径最终落到同一个 /entry/:id。',
              icon: 'compass',
              tone: 'bg-zhu-50 text-zhu-700'
            }
          ].map((x) => (
            <div key={x.t} className="rounded-2xl border border-black/[0.07] bg-white/70 p-5">
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${x.tone}`}>
                <Icon name={x.icon} size={18} />
              </span>
              <p className="mt-3 text-[11px] font-semibold tracking-[0.16em] text-ink-mute">{x.t}</p>
              <h3 className="mt-1 font-serif text-[16px] font-bold text-ink">{x.s}</h3>
              <p className="mt-2 text-[12.5px] leading-[1.85] text-ink-mute">{x.d}</p>
            </div>
          ))}
        </div>

        {/* 模型字段 */}
        <div className="mt-4 overflow-hidden rounded-2xl border border-black/[0.07] bg-white/60">
          <div className="border-b border-black/[0.06] px-4 py-3">
            <p className="font-serif text-[13.5px] font-bold text-ink">Entry 统一字段</p>
            <p className="mt-0.5 text-[11.5px] text-ink-mute">
              四支来源的原有字段全部落到下面这张表里；专题特有的元数据放进 facets，不污染主干。
            </p>
          </div>
          <div className="grid gap-px bg-black/[0.06] sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['id / sourceId', '统一编号 + 原始编号（可回溯）'],
              ['collection', 'mindong · papercut · she · hs-res · hs-city'],
              ['title / subtitle', '标题与副题（册次页、形制等）'],
              ['summary / body[]', '摘要与分段正文'],
              ['tags[]', '主题标签（跨馆关联的锚点）'],
              ['media[]', 'src / full / w·h / credit / note'],
              ['category', '各馆自有分类 id'],
              ['region / era / level', '地域、年代、保护级别'],
              ['source / sourceUrl / links[]', '来源与原始出处'],
              ['facets{}', '册次、页码、图版尺寸、展区、形制…'],
              ['status / createdAt / updatedAt', '发布状态与时间戳'],
              ['credit / note', '图片署名、授权提示与校注']
            ].map(([k, v]) => (
              <div key={k} className="bg-white/80 px-4 py-2.5">
                <p className="font-mono text-[11.5px] text-dai-700">{k}</p>
                <p className="mt-0.5 text-[11.5px] text-ink-mute">{v}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- 模块对应 ---------------- */}
      <section className="wrap pb-10">
        <SectionTitle
          eyebrow="MAPPING"
          title="原项目 → 统一站点"
          sub="每一支原有能力的去向都写在这里：留下的、改造的，都列清楚。"
        />
        <div className="space-y-4">
          {SOURCE_MAP.map((s) => (
            <div key={s.from} className="overflow-hidden rounded-2xl border border-black/[0.07] bg-white/70">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/[0.06] px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-serif text-[14.5px] font-bold text-ink">{s.from}</span>
                  <Icon name="arrow" size={14} className="text-ink-mute" />
                  <span className="chip bg-dai-50 text-dai-700">{s.to}</span>
                </div>
                <span className="text-[11px] text-ink-mute">原形态：{s.form}</span>
              </div>
              <div className="grid gap-4 p-4 sm:grid-cols-2">
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-[11.5px] font-semibold text-dai-700">
                    <Icon name="check" size={12} />
                    完整保留
                  </p>
                  <ul className="space-y-1">
                    {s.kept.map((k) => (
                      <li key={k} className="flex items-start gap-1.5 text-[12.5px] leading-relaxed text-ink-soft">
                        <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-dai-500" />
                        {k}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-[11.5px] font-semibold text-cha-700">
                    <Icon name="refresh" size={12} />
                    合并时改造
                  </p>
                  <ul className="space-y-1">
                    {s.changed.map((k) => (
                      <li key={k} className="flex items-start gap-1.5 text-[12.5px] leading-relaxed text-ink-mute">
                        <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-cha-500" />
                        {k}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- 共享组件 ---------------- */}
      <section className="wrap pb-10">
        <SectionTitle
          eyebrow="SHARED COMPONENTS"
          title="共享组件清单"
          sub="合并后「同一件事只有一处实现」。下表是可以直接对应到源码文件的。"
        />
        <div className="overflow-hidden rounded-2xl border border-black/[0.07] bg-white/70">
          <div className="grid grid-cols-[140px_1fr_170px] gap-px bg-black/[0.06] text-[11.5px] sm:grid-cols-[170px_1fr_200px]">
            <div className="bg-paper-sunk/60 px-3 py-2 font-semibold text-ink-soft">组件</div>
            <div className="bg-paper-sunk/60 px-3 py-2 font-semibold text-ink-soft">职责</div>
            <div className="bg-paper-sunk/60 px-3 py-2 font-semibold text-ink-soft">来源</div>
            {SHARED.map(([n, d, src]) => (
              <div key={n} className="contents">
                <div className="bg-white/85 px-3 py-2 font-medium text-ink">{n}</div>
                <div className="bg-white/85 px-3 py-2 leading-relaxed text-ink-mute">{d}</div>
                <div className="bg-white/85 px-3 py-2 text-ink-mute/90">{src}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- 导航结构 ---------------- */}
      <section className="wrap pb-10">
        <SectionTitle
          eyebrow="INFORMATION ARCHITECTURE"
          title="导航与页面结构"
          sub="桌面端顶部六项，移动端底部五项（「关于」收进页脚）；所有页面共用一套外壳与页脚。"
        />
        <div className="overflow-hidden rounded-2xl border border-black/[0.07] bg-white/70">
          {NAV_TREE.map(([path, name, desc], i) => (
            <div
              key={path}
              className={`flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-2.5 ${
                i > 0 ? 'border-t border-black/[0.05]' : ''
              }`}
            >
              <code className="w-[150px] shrink-0 font-mono text-[11.5px] text-dai-700">{path}</code>
              <span className="w-[86px] shrink-0 text-[12.5px] font-medium text-ink">{name}</span>
              <span className="min-w-0 flex-1 text-[12px] text-ink-mute">{desc}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11.5px] text-ink-mute/80">
          兼容路由：<code className="font-mono">/material/:id → /entry/:id</code>（保留 query）、
          <code className="ml-2 font-mono">/materials → /library</code>。
        </p>
      </section>

      {/* ---------------- 取舍 ---------------- */}
      <section className="wrap pb-10">
        <SectionTitle eyebrow="TRADE-OFFS" title="合并中的取舍与冲突处理" sub="合并不是把所有东西塞进一个页面，而是明确哪些该合、哪些不该合。" />
        <div className="space-y-3">
          {DECISIONS.map((d) => (
            <details key={d.q} className="group rounded-2xl border border-black/[0.07] bg-white/70 px-4 py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                <span className="font-serif text-[13.5px] font-bold text-ink">{d.q}</span>
                <Icon name="chevron" size={16} className="shrink-0 text-ink-mute transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-2.5 border-t border-black/[0.05] pt-2.5 text-[12.5px] leading-[1.9] text-ink-mute">{d.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ---------------- 数据与使用 ---------------- */}
      <section className="wrap pb-12">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-black/[0.07] bg-white/70 p-5">
            <h3 className="mb-2 flex items-center gap-1.5 font-serif text-[14px] font-bold text-ink">
              <Icon name="shield" size={15} />
              分类规模
            </h3>
            <ul className="space-y-1 text-[12.5px] text-ink-mute">
              <li>剪纸：{PAPERCUT_CATEGORIES.length} 类题材 · {stats.papercut} 件</li>
              <li>畲族：{SHE_ZONES.length} 个展区 · {stats.she} 个展项</li>
              <li>知识：{MINDONG_CATEGORIES.length} 类主题 · {stats.mindong} 条素材</li>
              <li>课程：第二章 3 节 12 条 · 第五章 3 节 13 条</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-black/[0.07] bg-white/70 p-5">
            <h3 className="mb-2 flex items-center gap-1.5 font-serif text-[14px] font-bold text-ink">
              <Icon name="info" size={15} />
              来源与版权
            </h3>
            <p className="text-[12.5px] leading-[1.85] text-ink-mute">
              文字与图版来源逐条标注在详情页。剪纸图版取自《剪花娘子》图录；畲族照片版权归原拍摄者与刊发媒体；
              知识素材来源为政府门户、地方史志、权威媒体与非遗名录。正式发表或商业使用请自行核实并取得授权。
            </p>
          </div>
          <div className="rounded-2xl border border-black/[0.07] bg-white/70 p-5">
            <h3 className="mb-2 flex items-center gap-1.5 font-serif text-[14px] font-bold text-ink">
              <Icon name="layers" size={15} />
              技术形态
            </h3>
            <p className="text-[12.5px] leading-[1.85] text-ink-mute">
              Vite + React 19 + React Router（HashRouter）+ Tailwind。纯前端、无后端、无账号：
              数据存于本机 localStorage，大图存 IndexedDB。构建产物为相对路径，可直接静态托管，也可离线打开。
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-black/[0.07] bg-dai-900 p-6 text-paper/80">
          <p className="font-serif text-[15px] font-bold text-paper-warm">署名单位</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-paper/60">
            宁德开放大学 · 《人类与社会》课程数字资源平台。适用于课程教学、研学实践与校本资源建设。
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/library" className="btn-ghost btn-xs border-white/20 bg-white/10 text-paper-warm hover:bg-white/20 hover:text-white">
              <Icon name="search" size={13} />
              开始检索
            </Link>
            <Link to="/theme" className="btn-ghost btn-xs border-white/20 bg-white/10 text-paper-warm hover:bg-white/20 hover:text-white">
              <Icon name="layers" size={13} />
              进入专题馆
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
