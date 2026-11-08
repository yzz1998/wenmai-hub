import { useEffect, useState } from 'react'
import { readSettings, subscribeSettings } from '../lib/settings'

/**
 * 订阅应用内配置。设置面板保存后，所有用到它的组件会一起重渲染 ——
 * 不需要刷新页面，也不需要把配置塞进 Store Context（它会拖累整棵树的 memo）。
 */
export function useSettings() {
  const [settings, setSettings] = useState(readSettings)
  useEffect(() => subscribeSettings(setSettings), [])
  return settings
}

export default useSettings
