import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Icon from './Icon'
import SelectionDrawer from './SelectionDrawer'
import SettingsDialog from './SettingsDialog'
import { useStore } from '../hooks/useStore'
import { useSettings } from '../hooks/useSettings'
import { isConfigured, onOpenSettingsRequest } from '../lib/settings'
import { COURSE_COLLECTIONS, LOCAL_COLLECTIONS } from '../data/collections'
import { SITE } from '../data/site'

/**
 * 统一外壳：一处导航、一处页脚、一处选辑抽屉。
 * 三馆不再各有一套管壳 —— 这是「合并」在版式层面最直接的体现。
 * 站点身份（名称 / 副标 / 署名）统一取自 data/site.js。
 */

const NAV = [
  { to: '/', label: '首页', iconName: 'home' },
  { to: '/library', label: '资源库', iconName: 'book' },
  { to: '/theme', label: '专题馆', iconName: 'layers' },
  { to: '/works', label: '学生成果', iconName: 'award' },
  { to: '/manage', label: '管理', iconName: 'edit' },
  { to: '/about', label: '关于', iconName: 'info' }
]

const MOBILE_NAV = NAV.filter((n) => n.to !== '/about')

function MountainSeaBand() {
  return (
    <svg
      className="pointer-events-none absolute inset-x-0 top-0 h-20 w-full opacity-[0.5]"
      viewBox="0 0 1200 80"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="bandFar" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#37648c" stopOpacity="0.20" />
          <stop offset="55%" stopColor="#2b463e" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#37648c" stopOpacity="0.20" />
        </linearGradient>
        <linearGradient id="bandNear" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#2b463e" stopOpacity="0.30" />
          <stop offset="50%" stopColor="#37648c" stopOpacity="0.24" />
          <stop offset="100%" stopColor="#2b463e" stopOpacity="0.30" />
        </linearGradient>
      </defs>
      <path
        d="M0 62 L120 30 L210 54 L330 18 L430 50 L520 26 L640 58 L760 22 L860 52 L980 28 L1090 54 L1200 32 L1200 80 L0 80 Z"
        fill="url(#bandFar)"
      />
      <path
        d="M0 74 L100 56 L190 70 L300 44 L400 68 L510 50 L620 72 L740 48 L850 68 L960 52 L1080 72 L1200 54 L1200 80 L0 80 Z"
        fill="url(#bandNear)"
      />
    </svg>
  )
}

/**
 * 移动端底部导航。
 * 必须放在 <header> 之外：header 上的 backdrop-filter 会为 fixed 子元素
 * 创建包含块，导致「固定在底部」的导航实际贴在顶栏下面。
 */
function MobileNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-black/[0.08] bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      aria-label="移动端导航"
    >
      <div className="grid grid-cols-5">
        {MOBILE_NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                isActive ? 'text-zhu-500' : 'text-ink-mute'
              }`
            }
          >
            <Icon name={n.iconName} size={19} />
            {n.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

export function Header({ onOpenSelection, onOpenSettings }) {
  const nav = useNavigate()
  const { selection } = useStore()
  const settings = useSettings()
  const configured = isConfigured(settings)

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-black/[0.07] bg-paper/85 backdrop-blur-xl">
        <div className="wrap flex h-16 items-center justify-between gap-3">
          <button onClick={() => nav('/')} className="flex min-w-0 items-center gap-3 text-left" aria-label="返回首页">
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-dai-700 shadow-sm">
              <svg viewBox="0 0 40 40" className="h-full w-full" aria-hidden="true">
                <path d="M0 27 C8 23 14 28 22 24 C29 20 34 25 40 22 L40 40 L0 40 Z" fill="#37648c" opacity="0.9" />
                <path d="M0 32 C8 29 15 33 23 30 C30 27 35 31 40 29 L40 40 L0 40 Z" fill="#17314a" opacity="0.75" />
                <path d="M6 27 L14 13 L20 23 L25 16 L34 27 Z" fill="#f7f3ea" opacity="0.22" />
                <circle cx="30" cy="10" r="4.4" fill="#bd4536" />
              </svg>
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate font-serif text-[17px] font-bold tracking-tight text-ink">
                {SITE.name}
                <span className="ml-1.5 align-middle text-[11px] font-normal tracking-[0.14em] text-ink-mute">
                  课程数字资源平台
                </span>
              </span>
              <span className="block truncate text-[11px] tracking-wide text-ink-mute">
                {SITE.unit} · 课程专题馆 · 乡土专题
              </span>
            </span>
          </button>

          <nav className="hidden items-center gap-0.5 lg:flex" aria-label="主导航">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-dai-700 text-paper-warm shadow-sm'
                      : 'text-ink-soft hover:bg-black/[0.045] hover:text-dai-700'
                  }`
                }
              >
                <Icon name={n.iconName} size={15} />
                {n.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-1.5">
            {/* 配置入口常驻顶栏：评阅是随时可能点的动作，不该藏进二级菜单 */}
            <button
              onClick={onOpenSettings}
              className="btn-ghost btn-xs relative"
              title={configured ? 'AI 评阅设置（已配置，可修改或测试）' : 'AI 评阅尚未配置，点此填入模型密钥'}
              aria-label="AI 评阅设置"
              data-testid="open-settings"
            >
              <Icon name="sliders" size={14} />
              <span className="hidden sm:inline">设置</span>
              {!configured && (
                <span
                  className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-zhu-500 ring-2 ring-paper"
                  aria-hidden="true"
                />
              )}
            </button>
            <button
              onClick={() => nav('/library?focus=1')}
              className="btn-ghost btn-xs hidden sm:inline-flex"
              title="前往资源库检索"
            >
              <Icon name="search" size={14} />
              检索
            </button>
            <button
              onClick={onOpenSelection}
              className="btn-ghost btn-xs relative"
              title="教学选辑"
              aria-label={`教学选辑，已选 ${selection.length} 条`}
            >
              <Icon name="basket" size={14} />
              <span className="hidden sm:inline">选辑</span>
              {selection.length > 0 && (
                <span className="ml-0.5 rounded-full bg-zhu-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                  {selection.length}
                </span>
              )}
            </button>
            <button onClick={() => nav('/works/new')} className="btn-zhu btn-xs hidden sm:inline-flex">
              <Icon name="upload" size={14} />
              提交成果
            </button>
          </div>
        </div>
      </header>
      <MobileNav />
    </>
  )
}

export function Footer() {
  const nav = useNavigate()
  return (
    <footer className="relative mt-20 overflow-hidden border-t border-black/[0.07] bg-dai-900 text-paper/80">
      <MountainSeaBand />
      <div className="wrap relative grid gap-8 py-12 md:grid-cols-12">
        <div className="md:col-span-6">
          <p className="font-serif text-lg font-bold text-paper-warm">{SITE.full}</p>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-paper/60">
            以《人类与社会》课程的两章内容为主干 ——
            <b className="font-semibold text-paper/85">第二章 人类社会发展与资源</b>、
            <b className="font-semibold text-paper/85">第五章 城市、城市化与乡村社会</b>；
            另配三个乡土专题馆（剪纸 241 件图样、畲族 7 展区 30 展项、闽东知识库 38 条素材），作为课程的本地案例。
          </p>
          <p className="mt-4 text-xs leading-relaxed text-paper/40">
            课程条目依据教材章节框架整理，供课堂教学与自主学习使用；乡土素材与图版来源标注于各条目详情页，
            涵盖政府门户、地方史志、权威媒体报道及非物质文化遗产名录等公开渠道。正式发表或商业使用前请自行核实原始出处。
          </p>
        </div>
        <div className="md:col-span-3">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-paper/45">课程专题馆</p>
          <ul className="space-y-2 text-sm">
            {COURSE_COLLECTIONS.map((c) => (
              <li key={c.id}>
                <button onClick={() => nav(c.route)} className="text-left text-paper/70 transition-colors hover:text-paper-warm">
                  {c.chapter}　{c.name}
                </button>
              </li>
            ))}
          </ul>
          <p className="mb-3 mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-paper/45">乡土专题</p>
          <ul className="space-y-2 text-sm">
            {LOCAL_COLLECTIONS.map((c) => (
              <li key={c.id}>
                <button onClick={() => nav(c.route)} className="text-left text-paper/70 transition-colors hover:text-paper-warm">
                  {c.name}
                </button>
              </li>
            ))}
            <li>
              <button onClick={() => nav('/library')} className="text-paper/70 transition-colors hover:text-paper-warm">
                全库检索
              </button>
            </li>
          </ul>
        </div>
        <div className="md:col-span-3">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-paper/45">建设与维护</p>
          <ul className="space-y-2 text-sm text-paper/60">
            <li>署名单位：{SITE.unit}</li>
            <li>适用场景：课程教学 · 研学实践 · 校本资源</li>
            <li>技术形态：纯前端静态应用 · 数据本地留存</li>
            <li>
              <button onClick={() => nav('/about')} className="transition-colors hover:text-paper-warm">
                架构与合并说明 →
              </button>
            </li>
          </ul>
        </div>
      </div>
      <div className="wrap relative flex flex-wrap items-center justify-between gap-3 border-t border-white/10 py-5">
        <p className="text-xs text-paper/40">© {new Date().getFullYear()} {SITE.unit} · {SITE.name}</p>
        <p className="flex items-center gap-1.5 text-xs text-paper/40">
          <Icon name="mountain" size={13} />
          山海交融 · 课程为纲 · 乡土为证
        </p>
      </div>
    </footer>
  )
}

/** 布局容器：负责选辑抽屉与 AI 设置的挂载 */
export function Layout({ children }) {
  const [selOpen, setSelOpen] = useState(false)
  const [setOpen, setSetOpen] = useState(false)
  const loc = useLocation()

  // 页面内的「去设置」按钮通过这个通道打开同一个弹窗，避免出现两个设置实例
  useEffect(() => onOpenSettingsRequest(() => setSetOpen(true)), [])

  return (
    <div className="flex min-h-screen flex-col">
      <Header onOpenSelection={() => setSelOpen(true)} onOpenSettings={() => setSetOpen(true)} />
      <main className="flex-1 pb-16 lg:pb-0" key={loc.pathname}>
        {children}
      </main>
      <Footer />
      <SelectionDrawer open={selOpen} onClose={() => setSelOpen(false)} />
      <SettingsDialog open={setOpen} onClose={() => setSetOpen(false)} />
    </div>
  )
}

export default Layout
