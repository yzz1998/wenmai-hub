import { useEffect, useRef, useState } from 'react'

/**
 * 输入防抖 —— 全站检索框共用（原知识库 320ms「输入即搜」策略保留）。
 */
export function useDebounce(value, delay = 320) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export function useDebouncedCallback(fn, delay = 320) {
  const timer = useRef(null)
  const fnRef = useRef(fn)
  fnRef.current = fn
  return (...args) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => fnRef.current(...args), delay)
  }
}
