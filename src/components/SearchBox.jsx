import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'

/**
 * 统一检索框。
 * 交互约定（三馆一致）：
 * · 输入即搜（300ms 防抖），不需要按回车；
 * · Enter 立即搜；Esc 清空；⌘/Ctrl+K 聚焦（全站唯一快捷键）。
 */
export default function SearchBox({
  value = '',
  onChange,
  placeholder = '搜索条目、标签、地域……',
  autoFocus = false,
  size = 'md',
  suggestions = [],
  onSubmit
}) {
  const [inner, setInner] = useState(value)
  const timer = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    setInner(value)
  }, [value])

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const commit = (v) => {
    if (timer.current) clearTimeout(timer.current)
    onChange?.(v)
  }

  const handleInput = (v) => {
    setInner(v)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => onChange?.(v), 300)
  }

  const big = size === 'lg'

  return (
    <div className="w-full">
      <div
        className={`relative flex items-center rounded-2xl border border-black/10 bg-white/85 shadow-card transition-shadow focus-within:border-dai-500 focus-within:ring-4 focus-within:ring-dai-500/10 ${
          big ? 'px-4 py-1.5' : 'px-3 py-0.5'
        }`}
      >
        <Icon name="search" size={big ? 20 : 17} className="shrink-0 text-ink-mute" />
        <input
          ref={inputRef}
          type="search"
          aria-label="关键词搜索"
          value={inner}
          onChange={(e) => handleInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commit(e.currentTarget.value)
              onSubmit?.(e.currentTarget.value)
            }
            if (e.key === 'Escape') {
              setInner('')
              commit('')
            }
          }}
          placeholder={placeholder}
          className={`w-full bg-transparent text-ink placeholder:text-ink-mute/60 focus:outline-none ${
            big ? 'px-3 py-2.5 text-[15px]' : 'px-2.5 py-2 text-sm'
          }`}
        />
        {inner && (
          <button
            onClick={() => {
              setInner('')
              commit('')
              inputRef.current?.focus()
            }}
            className="shrink-0 rounded-lg p-1.5 text-ink-mute transition-colors hover:bg-black/[0.05] hover:text-ink"
            aria-label="清空搜索"
          >
            <Icon name="close" size={15} />
          </button>
        )}
        <span className="ml-1 hidden shrink-0 rounded-md border border-black/10 px-1.5 py-0.5 text-[10px] text-ink-mute/70 sm:inline">
          Ctrl K
        </span>
      </div>

      {suggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-ink-mute">试试：</span>
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => {
                setInner(s)
                commit(s)
              }}
              className="chip-tag text-[11px]"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
