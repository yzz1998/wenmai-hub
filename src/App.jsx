import { useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { StoreProvider, useStore } from './hooks/useStore'
import { Layout } from './components/Layout'
import { Toast } from './components/UI'
import Home from './pages/Home'
import Library from './pages/Library'
import EntryDetail from './pages/EntryDetail'
import Themes from './pages/Themes'
import ThemePapercut from './pages/ThemePapercut'
import ThemeShe from './pages/ThemeShe'
import ThemeMindong from './pages/ThemeMindong'
import ThemeCourse from './pages/ThemeCourse'
import Works from './pages/Works'
import WorkNew from './pages/WorkNew'
import WorkDetail from './pages/WorkDetail'
import Manage from './pages/Manage'
import About from './pages/About'

/** 路由切换回到顶部 */
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [pathname])
  return null
}

/**
 * 旧链接兼容：
 *   #/material/M-FEST-001  →  #/entry/M-FEST-001
 * 三个原项目里已经发出去的深链不能因为合并而失效。
 */
function LegacyEntryRedirect() {
  const { id } = useParams()
  const { search } = useLocation()
  return <Navigate to={`/entry/${id}${search}`} replace />
}

function Shell() {
  const { toast } = useStore()
  return (
    <>
      <Layout>
        <Routes>
          {/* 首页与检索 */}
          <Route path="/" element={<Home />} />
          <Route path="/library" element={<Library />} />
          <Route path="/entry/:id" element={<EntryDetail />} />

          {/* 专题馆 */}
          <Route path="/theme" element={<Themes />} />
          <Route path="/theme/papercut" element={<ThemePapercut />} />
          <Route path="/theme/she" element={<ThemeShe />} />
          <Route path="/theme/mindong" element={<ThemeMindong />} />
          {/* 课程两章各成一馆：同一个组件，靠 collection 区分数据范围 */}
          <Route path="/theme/resources" element={<ThemeCourse collection="hs-res" />} />
          <Route path="/theme/urban-rural" element={<ThemeCourse collection="hs-city" />} />

          {/* 教学 */}
          <Route path="/works" element={<Works />} />
          <Route path="/works/new" element={<WorkNew />} />
          <Route path="/works/new/:id" element={<WorkNew />} />
          <Route path="/works/:id" element={<WorkDetail />} />
          <Route path="/manage" element={<Manage />} />
          <Route path="/about" element={<About />} />

          {/* 旧路由兼容 */}
          <Route path="/material/:id" element={<LegacyEntryRedirect />} />
          <Route path="/materials" element={<Navigate to="/library" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
      <Toast toast={toast} />
    </>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <HashRouter>
        <ScrollToTop />
        <Shell />
      </HashRouter>
    </StoreProvider>
  )
}
