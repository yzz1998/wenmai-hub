import { useEffect, useMemo, useState } from 'react'
import Icon from './Icon'
import { Modal } from './UI'
import {
  DEFAULT_SETTINGS,
  looksLikeKey,
  maskKey,
  normalizeBaseUrl,
  providerLabel,
  readSettings,
  resetSettings,
  writeSettings
} from '../lib/settings'
import { ReviewError, reviewErrorText, testConnection } from '../lib/review'

/**
 * AI 评阅设置（内嵌，不需要任何云端配置）。
 *
 * 设计上的几个判断：
 *
 * 1. **先给「当前状态」，再给输入框**。用户打开这个面板最常见的疑问是
 *    「现在到底能不能用」，而不是「我该填什么」。所以顶部一条状态带先说结论。
 *
 * 2. **测试连接独立于保存**。很多人会先粘一把 Key 试一下再决定用不用，
 *    如果必须先保存才能测，改错了还得再改回来。
 *
 * 3. **不隐藏风险**。Key 明文存在 localStorage，界面里直说，并给出「清除」按钮。
 *    假装安全比不安全更糟。
 *
 * 4. **模型名与地址都留了口子**。DeepSeek 只是默认值，换 OpenAI 兼容端点、
 *    换支持视觉的模型，都不用改代码。
 */

const BASE_SUGGESTIONS = [
  { url: 'https://api.deepseek.com', note: 'DeepSeek 官方' },
  { url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', note: '阿里云百炼（有视觉模型）' },
  { url: 'https://open.bigmodel.cn/api/paas/v4', note: '智谱 GLM' },
  { url: 'https://api.siliconflow.cn/v1', note: '硅基流动' },
  { url: 'https://api.openai.com/v1', note: 'OpenAI' }
]

const MODEL_SUGGESTIONS = ['deepseek-chat', 'deepseek-reasoner', 'qwen-plus', 'qwen-vl-plus', 'gpt-4o-mini']

function Field({ label, hint, children, error }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[12.5px] font-semibold text-ink">{label}</span>
        {hint && <span className="text-[11px] text-ink-mute">{hint}</span>}
      </span>
      {children}
      {error && <span className="mt-1 block text-[11.5px] text-zhu-700">{error}</span>}
    </label>
  )
}

function Toggle({ checked, onChange, title, desc, testid, disabled }) {
  return (
    <label
      className={`flex items-start gap-2.5 rounded-xl border border-black/[0.07] bg-white px-3 py-2.5 ${
        disabled ? 'opacity-55' : 'cursor-pointer hover:border-dai-300'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-dai-700"
        data-testid={testid}
      />
      <span className="min-w-0">
        <span className="block text-[12.5px] font-medium text-ink">{title}</span>
        <span className="mt-0.5 block text-[11.5px] leading-relaxed text-ink-mute">{desc}</span>
      </span>
    </label>
  )
}

export default function SettingsDialog({ open, onClose }) {
  const [draft, setDraft] = useState(readSettings)
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [test, setTest] = useState(null)
  const [saved, setSaved] = useState(false)

  // 每次打开都用磁盘上的最新值重置草稿：上一次没保存的输入不该粘到下一次
  useEffect(() => {
    if (!open) return
    setDraft(readSettings())
    setShowKey(false)
    setTest(null)
    setSaved(false)
  }, [open])

  const baseInfo = useMemo(() => providerLabel(draft.baseUrl), [draft.baseUrl])
  const keyCheck = useMemo(() => looksLikeKey(draft.apiKey), [draft.apiKey])
  const dirty = useMemo(() => {
    const cur = readSettings()
    return (
      cur.apiKey !== draft.apiKey ||
      cur.baseUrl !== normalizeBaseUrl(draft.baseUrl) ||
      cur.model !== draft.model ||
      cur.vision !== draft.vision ||
      cur.mock !== draft.mock ||
      cur.relay !== draft.relay
    )
  }, [draft])

  const patch = (p) => {
    setDraft((d) => ({ ...d, ...p }))
    setTest(null)
    setSaved(false)
  }

  const status = useMemo(() => {
    if (draft.mock) return { tone: 'cha', text: '示例模式：不会请求模型，分数由本地生成，仅用于演示与测试' }
    if (!draft.apiKey) return { tone: 'zhu', text: '未配置：评阅入口会显示「先配置模型」' }
    return { tone: 'dai', text: `已配置 ${baseInfo} · ${draft.model || DEFAULT_SETTINGS.model}` }
  }, [draft.mock, draft.apiKey, baseInfo, draft.model])

  const handleTest = async () => {
    setTesting(true)
    setTest(null)
    try {
      const r = await testConnection({
        apiKey: String(draft.apiKey || '').trim(),
        baseUrl: normalizeBaseUrl(draft.baseUrl),
        model: String(draft.model || '').trim() || DEFAULT_SETTINGS.model
      })
      setTest({ ok: true, text: `连通正常 · ${r.model} · ${r.latencyMs} ms` })
    } catch (e) {
      const code = e instanceof ReviewError ? e.code : 'INTERNAL'
      const copy = reviewErrorText(code)
      setTest({ ok: false, text: `${copy.title}${e?.message ? `｜${e.message}` : ''}`, code })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = () => {
    writeSettings({
      apiKey: String(draft.apiKey || '').trim(),
      baseUrl: normalizeBaseUrl(draft.baseUrl),
      model: String(draft.model || '').trim() || DEFAULT_SETTINGS.model,
      vision: draft.vision,
      mock: draft.mock,
      relay: draft.relay
    })
    setSaved(true)
    setTest(null)
  }

  const handleClear = () => {
    const next = resetSettings()
    setDraft(next)
    setTest(null)
    setSaved(false)
    setShowKey(false)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="AI 评阅设置"
      desc="配置保存在本机浏览器，保存后立即生效。不需要在服务器或部署平台做任何设置。"
      wide
      footer={
        <>
          <button type="button" onClick={handleClear} className="btn-ghost btn-xs mr-auto text-zhu-700">
            <Icon name="trash" size={13} />
            清除配置
          </button>
          <button
            type="button"
            onClick={handleTest}
            disabled={testing || !draft.apiKey}
            className="btn-ghost btn-xs"
            data-testid="test-connection"
          >
            <Icon name="shield" size={13} className={testing ? 'animate-pulse' : ''} />
            {testing ? '测试中…' : '测试连接'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty && saved}
            className="btn-primary btn-xs"
            data-testid="save-settings"
          >
            <Icon name="check" size={13} />
            {saved && !dirty ? '已保存' : '保存'}
          </button>
        </>
      }
    >
      {/* 状态带：先说结论，再给输入框 */}
      <div
        className={`mb-5 flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-[12.5px] leading-relaxed ${
          status.tone === 'zhu'
            ? 'border-zhu-300 bg-zhu-50 text-zhu-700'
            : status.tone === 'cha'
              ? 'border-cha-300 bg-cha-50 text-cha-700'
              : 'border-dai-300 bg-dai-50 text-dai-700'
        }`}
        data-testid="settings-status"
      >
        <Icon name={status.tone === 'zhu' ? 'warn' : 'sparkle'} size={13} className="mt-0.5 shrink-0" />
        <span>{status.text}</span>
      </div>

      <div className="space-y-4">
        <Field
          label="API Key"
          hint={draft.apiKey ? maskKey(draft.apiKey) : '必填'}
          error={draft.apiKey && !keyCheck.ok ? keyCheck.hint : ''}
        >
          <div className="flex gap-1.5">
            <input
              type={showKey ? 'text' : 'password'}
              value={draft.apiKey}
              onChange={(e) => patch({ apiKey: e.target.value })}
              placeholder="sk-…（DeepSeek 控制台 → API keys）"
              autoComplete="off"
              spellCheck="false"
              className="min-w-0 flex-1 rounded-xl border border-black/[0.12] bg-white px-3 py-2 font-mono text-[12.5px] text-ink outline-none focus:border-dai-500 focus:ring-2 focus:ring-dai-500/15"
              data-testid="api-key-input"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="btn-ghost btn-xs shrink-0"
              title={showKey ? '隐藏' : '显示明文'}
            >
              <Icon name="eye" size={13} />
            </button>
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="接口地址" hint={baseInfo}>
            <input
              type="text"
              value={draft.baseUrl}
              onChange={(e) => patch({ baseUrl: e.target.value })}
              list="base-url-options"
              spellCheck="false"
              className="w-full rounded-xl border border-black/[0.12] bg-white px-3 py-2 font-mono text-[12px] text-ink outline-none focus:border-dai-500 focus:ring-2 focus:ring-dai-500/15"
              data-testid="base-url-input"
            />
            <datalist id="base-url-options">
              {BASE_SUGGESTIONS.map((s) => (
                <option key={s.url} value={s.url}>
                  {s.note}
                </option>
              ))}
            </datalist>
          </Field>

          <Field label="模型名" hint="按厂商文档填写">
            <input
              type="text"
              value={draft.model}
              onChange={(e) => patch({ model: e.target.value })}
              list="model-options"
              spellCheck="false"
              className="w-full rounded-xl border border-black/[0.12] bg-white px-3 py-2 font-mono text-[12px] text-ink outline-none focus:border-dai-500 focus:ring-2 focus:ring-dai-500/15"
              data-testid="model-input"
            />
            <datalist id="model-options">
              {MODEL_SUGGESTIONS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </Field>
        </div>

        {test && (
          <div
            className={`flex items-start gap-1.5 rounded-lg border px-3 py-2 text-[12px] leading-relaxed ${
              test.ok ? 'border-cha-300 bg-cha-50 text-cha-700' : 'border-zhu-300 bg-zhu-50 text-zhu-700'
            }`}
            data-testid="test-result"
          >
            <Icon name={test.ok ? 'check' : 'warn'} size={12} className="mt-0.5 shrink-0" />
            <span>{test.text}</span>
          </div>
        )}

        <div className="border-t border-black/[0.07] pt-4">
          <p className="mb-2.5 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-mute">
            <Icon name="sliders" size={12} />
            评阅行为
          </p>
          <div className="space-y-2">
            <Toggle
              checked={draft.vision}
              onChange={(v) => patch({ vision: v })}
              title="把配图一起发给模型（需要模型支持看图）"
              desc="开启后，封面与附件图会压缩成图片一并提交；当前默认模型 deepseek-chat 不支持图片输入，开启会导致请求失败。用通义千问 VL、GPT-4o 这类模型时才打开。"
              testid="toggle-vision"
            />
            <Toggle
              checked={draft.relay}
              onChange={(v) => patch({ relay: v })}
              title="直连失败时走站内中继"
              desc="浏览器直连被网络策略或插件拦住时，改由本站云函数转发（不保存你的 Key）。纯静态部署没有这个接口，关掉即可。"
              testid="toggle-relay"
            />
            <Toggle
              checked={draft.mock}
              onChange={(v) => patch({ mock: v })}
              title="示例模式"
              desc="不请求任何接口，用本地生成的样例分数跑通流程，适合培训演示与界面检查。"
              testid="toggle-mock"
            />
          </div>
        </div>

        <div className="rounded-xl border border-black/[0.07] bg-black/[0.02] px-3.5 py-3">
          <p className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-soft">
            <Icon name="shield" size={12} className="text-dai-700" />
            关于密钥，需要你知道的事
          </p>
          <ul className="mt-1.5 space-y-1 text-[11.5px] leading-relaxed text-ink-mute">
            <li>· 密钥只保存在这台电脑的这个浏览器里（localStorage），不会上传到本站服务器，也不写进代码。</li>
            <li>· 评阅时由浏览器直接发往上述接口地址，本站不经手。</li>
            <li>· 密钥是明文存储的：同一浏览器、同一用户下的其它脚本能读到它。公用电脑用完请点左下角「清除配置」。</li>
            <li>· 每次评阅按厂商计费，一篇通常在几分钱量级；示例模式不产生任何费用。</li>
          </ul>
        </div>
      </div>
    </Modal>
  )
}
