import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { GRADES, SEMESTERS, categoryName } from '../data/taxonomy'
import { buildEntries, normalizeEntry } from '../data'
import { SEED_MATERIALS } from '../data'
import {
  loadMaterials,
  loadReviews,
  loadSelection,
  loadWorks,
  nextMaterialId,
  nextWorkId,
  saveMaterials,
  saveReviews,
  saveSelection,
  saveWorks,
  todayISO
} from '../lib/storage'
import { discardWorkDocs } from '../lib/docs'
import { collectReviewMaterials, previewMaterials } from '../lib/review-materials'
import { ReviewError, requestReview } from '../lib/review'
import { readSettings } from '../lib/settings'

const StoreContext = createContext(null)

/** 推断成果所属学期（按录入日期），减少表单填写负担 */
export function inferSemester(dateISO) {
  const d = dateISO || todayISO()
  const [y, m] = d.split('-').map(Number)
  if (!y) return SEMESTERS[0]
  if (m >= 2 && m <= 7) return `${y}春`
  if (m >= 8) return `${y}秋`
  return `${y - 1}秋`
}

/** 评阅所需的最短正文（与服务端 TEXT_TOO_SHORT 阈值对齐，先在本地拦一道） */
const MIN_REVIEW_CHARS = 200

export function StoreProvider({ children }) {
  const [materials, setMaterials] = useState(loadMaterials)
  const [works, setWorks] = useState(loadWorks)
  const [selection, setSelection] = useState(loadSelection)
  const [reviews, setReviews] = useState(loadReviews)
  /**
   * 进行中的评阅任务。必须放在 Provider 里而不是详情页组件里：
   * 评阅要跑 20–60 秒，用户很可能会跳到列表页再回来，
   * 状态若挂在组件上，一卸载就丢，回来看到按钮又变成「开始评阅」。
   */
  const [reviewJobs, setReviewJobs] = useState({})
  const [toast, setToast] = useState(null)

  useEffect(() => {
    saveMaterials(materials)
  }, [materials])

  useEffect(() => {
    saveWorks(works)
  }, [works])

  useEffect(() => {
    saveSelection(selection)
  }, [selection])

  useEffect(() => {
    saveReviews(reviews)
  }, [reviews])

  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(t)
  }, [toast])

  const notify = useCallback((message, tone = 'ok') => setToast({ message, tone }), [])

  /** 全站统一条目集（静态策展语料 + 实时知识素材） */
  const entries = useMemo(() => buildEntries(materials), [materials])

  /* ---------------- 知识素材 CRUD ---------------- */
  const createMaterial = useCallback(
    (draft) => {
      const now = todayISO()
      const item = normalizeEntry({
        collection: 'mindong',
        status: 'published',
        createdAt: now,
        ...draft,
        id: nextMaterialId(materials, draft.category),
        updatedAt: now
      })
      setMaterials((prev) => [item, ...prev])
      notify(`已新增素材《${item.title}》`)
      return item
    },
    [materials, notify]
  )

  const updateMaterial = useCallback(
    (id, patch) => {
      setMaterials((prev) =>
        prev.map((m) => (m.id === id ? normalizeEntry({ ...m, ...patch, updatedAt: todayISO() }) : m))
      )
      notify('素材已保存')
    },
    [notify]
  )

  const removeMaterial = useCallback(
    (id) => {
      let title = ''
      setMaterials((prev) => {
        title = prev.find((m) => m.id === id)?.title || ''
        return prev.filter((m) => m.id !== id)
      })
      setSelection((prev) => prev.filter((x) => x !== id))
      notify(`已删除《${title}》`, 'warn')
    },
    [notify]
  )

  const resetMaterials = useCallback(() => {
    setMaterials(SEED_MATERIALS)
    notify('知识素材已重置为默认数据', 'warn')
  }, [notify])

  const importMaterials = useCallback(
    (items) => {
      if (!Array.isArray(items) || !items.length) {
        notify('导入失败：未识别到有效数据', 'warn')
        return 0
      }
      let addedCount = 0
      setMaterials((prev) => {
        const ids = new Set(prev.map((m) => m.id))
        const added = []
        items.forEach((it) => {
          if (!it || !it.title) return
          const base = { ...it, collection: 'mindong' }
          if (!base.id || ids.has(base.id)) {
            base.id = nextMaterialId([...prev, ...added], base.category || 'festival')
          }
          ids.add(base.id)
          added.push(
            normalizeEntry({
              status: 'published',
              createdAt: todayISO(),
              tags: [],
              body: [],
              ...base,
              updatedAt: todayISO()
            })
          )
        })
        addedCount = added.length
        return [...added, ...prev]
      })
      notify(`已导入 ${addedCount} 条素材`)
      return addedCount
    },
    [notify]
  )

  /* ---------------- 学生成果 CRUD ---------------- */
  const createWork = useCallback(
    (draft) => {
      const now = todayISO()
      const year = now.slice(0, 4)
      const item = {
        id: nextWorkId(works, year),
        status: 'published',
        createdAt: now,
        tags: [],
        docs: [],
        ...draft,
        semester: draft.semester || inferSemester(now),
        updatedAt: now
      }
      setWorks((prev) => [item, ...prev])
      notify(`成果《${item.title}》已入库`)
      return item
    },
    [works, notify]
  )

  const updateWork = useCallback(
    (id, patch) => {
      setWorks((prev) => prev.map((w) => (w.id === id ? { ...w, ...patch, updatedAt: todayISO() } : w)))
      notify('成果已更新')
    },
    [notify]
  )

  const removeWork = useCallback(
    (id) => {
      const target = works.find((w) => w.id === id)
      setWorks((prev) => prev.filter((w) => w.id !== id))
      // 级联：评阅结果与 IndexedDB 里的文档正文/原件一起清掉，否则会留下孤儿数据
      setReviews((prev) => {
        if (!prev[id]) return prev
        const next = { ...prev }
        delete next[id]
        return next
      })
      if (target?.docs?.length) discardWorkDocs(target.docs).catch(() => {})
      notify('成果已移除', 'warn')
    },
    [works, notify]
  )

  /* ---------------- AI 评阅 ---------------- */
  /**
   * 发起一次评阅。材料不向用户索取，全部复用当前页面已有的东西：
   * 文档解析正文（IndexedDB）、网页正文、配图清单、附件说明。
   *
   * 两处容易踩的坑：
   * - `override` 是给「刚 createWork 完立刻评阅」用的：那一刻 works 闭包还是旧数组，
   *   按 id 查会查不到，表现成「未找到该成果」。
   * - job 里只存材料**摘要**，不存 base64 图片：那会把 localStorage 撑爆，
   *   而 localStorage 写入失败是静默的，用户会以为评阅结果丢了。
   */
  const startReview = useCallback(
    async (workId, { force = false, work: override = null } = {}) => {
      const work = override || works.find((w) => w.id === workId)
      if (!work) {
        const err = new ReviewError('NO_TEXT', { message: '未找到该成果', retryable: false })
        throw err
      }
      if (!force && reviews[workId]) return reviews[workId]

      const settings = readSettings()
      setReviewJobs((j) => ({
        ...j,
        [workId]: { status: 'reviewing', startedAt: Date.now(), materials: previewMaterials(work) }
      }))

      try {
        const bundle = await collectReviewMaterials(work, { vision: settings.vision })
        if (bundle.chars < MIN_REVIEW_CHARS) {
          throw new ReviewError('NO_TEXT', {
            message: `有效正文不足 ${MIN_REVIEW_CHARS} 字（当前 ${bundle.chars} 字）`,
            retryable: false
          })
        }

        // 采集阶段结束后把真实清单回填给面板：用户能看到「这次到底评了什么」
        setReviewJobs((j) => ({
          ...j,
          [workId]: { ...j[workId], materials: bundle.summary }
        }))

        const result = await requestReview({ work, bundle, settings })
        const saved = { ...result, workId, materialsBrief: result.materialsBrief || null }
        setReviews((m) => ({ ...m, [workId]: saved }))
        setReviewJobs((j) => ({
          ...j,
          [workId]: { status: 'done', at: Date.now(), materials: bundle.summary }
        }))
        notify(`《${work.title}》评阅完成：${saved.total} 分`)
        return saved
      } catch (e) {
        setReviewJobs((j) => ({
          ...j,
          [workId]: {
            ...j[workId],
            status: 'error',
            code: e?.code || 'INTERNAL',
            message: e?.message || '',
            at: Date.now()
          }
        }))
        throw e
      }
    },
    [works, reviews, notify]
  )

  const clearReview = useCallback((workId) => {
    setReviews((prev) => {
      if (!prev[workId]) return prev
      const next = { ...prev }
      delete next[workId]
      return next
    })
  }, [])

  /* ---------------- 教学选辑（跨专题收藏） ---------------- */
  const inSelection = useCallback((id) => selection.includes(id), [selection])

  const toggleSelection = useCallback(
    (id) => {
      setSelection((prev) => {
        const has = prev.includes(id)
        notify(has ? '已从选辑移除' : '已加入教学选辑', has ? 'warn' : 'ok')
        return has ? prev.filter((x) => x !== id) : [id, ...prev]
      })
    },
    [notify]
  )

  const removeFromSelection = useCallback((id) => {
    setSelection((prev) => prev.filter((x) => x !== id))
  }, [])

  const clearSelection = useCallback(() => {
    setSelection([])
    notify('选辑已清空', 'warn')
  }, [notify])

  /** 选辑条目（按加入顺序） */
  const selectedEntries = useMemo(
    () => selection.map((id) => entries.find((e) => e.id === id)).filter(Boolean),
    [selection, entries]
  )

  const value = useMemo(
    () => ({
      materials,
      works,
      entries,
      toast,
      notify,
      createMaterial,
      updateMaterial,
      removeMaterial,
      resetMaterials,
      importMaterials,
      createWork,
      updateWork,
      removeWork,
      reviews,
      reviewJobs,
      startReview,
      clearReview,
      selection,
      selectedEntries,
      inSelection,
      toggleSelection,
      removeFromSelection,
      clearSelection,
      grades: GRADES,
      semesters: SEMESTERS,
      categoryName
    }),
    [
      materials,
      works,
      entries,
      toast,
      notify,
      createMaterial,
      updateMaterial,
      removeMaterial,
      resetMaterials,
      importMaterials,
      createWork,
      updateWork,
      removeWork,
      reviews,
      reviewJobs,
      startReview,
      clearReview,
      selection,
      selectedEntries,
      inSelection,
      toggleSelection,
      removeFromSelection,
      clearSelection
    ]
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore 必须在 StoreProvider 内使用')
  return ctx
}
