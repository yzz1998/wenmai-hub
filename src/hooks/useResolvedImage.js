import { useEffect, useState } from 'react'
import { isLocalRef, resolveImageSrc } from '../lib/images'
import { asset } from '../lib/assets'

/**
 * 把条目里的图片字段解析成可直接渲染的地址。
 * 支持四态：外链/相对路径、DataURL、`local:<key>`（IndexedDB 大图）、空值。
 * 相对路径统一过 asset()，保证构建后（base './'）与 file:// 都能正确取图。
 */
export function useResolvedImage(value) {
  const [src, setSrc] = useState(() => (value && !isLocalRef(value) ? asset(value) : ''))

  useEffect(() => {
    let objectUrl = ''
    let alive = true
    if (!value) {
      setSrc('')
      return undefined
    }
    if (!isLocalRef(value)) {
      setSrc(asset(value))
      return undefined
    }
    ;(async () => {
      const url = await resolveImageSrc(value)
      if (!url) {
        if (alive) setSrc('')
        return
      }
      objectUrl = url
      if (alive) setSrc(url)
    })()
    return () => {
      alive = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [value])

  return src
}

export default useResolvedImage
