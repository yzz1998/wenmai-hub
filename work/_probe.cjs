/* 一次性探测：模型列表 + 目标模型的最小请求延迟 */
const KEY = 'sk-b97688c3e4ca45ebb69543d372c50bfb'
const BASE = 'https://api.deepseek.com'

async function j(url, opt) {
  const r = await fetch(url, opt)
  const t = await r.text()
  return { status: r.status, body: t.slice(0, 400) }
}

;(async () => {
  console.log('--- GET /models ---')
  console.log(JSON.stringify(await j(`${BASE}/models`, { headers: { Authorization: `Bearer ${KEY}` } }), null, 1))

  for (const model of ['deepseek-flash', 'deepseek-chat']) {
    const started = Date.now()
    const out = await j(`${BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: '只回复两个字：可用' }],
        max_tokens: 16,
        temperature: 0
      })
    })
    console.log(`--- ${model} · ${Date.now() - started}ms ---`)
    console.log(out.status, out.body)
  }
})()
