import EntryCard from './EntryCard'

/**
 * 兼容薄壳 —— 管理端与成果页沿用旧组件名，实际渲染统一卡片。
 * 这样"卡片长什么样"只有一处实现（EntryCard），不会随页面漂移。
 */
export { useResolvedImage } from '../hooks/useResolvedImage'

export function MaterialCard({ item, onQuickView, index = 0 }) {
  return <EntryCard entry={item} index={index} onCite={onQuickView} variant="grid" />
}

export function MaterialRow({ item, onQuickView }) {
  return <EntryCard entry={item} variant="row" onCite={onQuickView} />
}

export default MaterialCard
