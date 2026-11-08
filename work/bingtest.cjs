/** 测试从 Bing 图片搜索解析 murl / purl / 标题 */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

async function bing(q, first = 1) {
  const url = `https://cn.bing.com/images/async?q=${encodeURIComponent(q)}&first=${first}&count=35&mkt=zh-CN&adlt=off`
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9' } })
  const html = await res.text()
  const out = []
  const re = /m="([^"]+)"/g
  let m
  while ((m = re.exec(html))) {
    const raw = m[1]
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
    try {
      const o = JSON.parse(raw)
      if (o.murl) out.push({ murl: o.murl, purl: o.purl, title: (o.t || '').slice(0, 90) })
    } catch {
      /* ignore */
    }
  }
  return { status: res.status, len: html.length, items: out }
}

;(async () => {
  for (const q of ['上海 陆家嘴 天际线', '城市 交通拥堵']) {
    const r = await bing(q)
    console.log('=== ', q, '| status', r.status, '| html', r.len, '| 解出', r.items.length)
    r.items.slice(0, 5).forEach((it, i) =>
      console.log(` ${i + 1}. ${it.title}\n    url: ${it.murl.slice(0, 100)}\n    src: ${it.purl.slice(0, 100)}`)
    )
  }
})()
