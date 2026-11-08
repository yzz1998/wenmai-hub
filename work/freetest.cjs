/** 测试 Pixabay / Unsplash / Pexels 搜索页可抓取的图片直链 */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

async function get(url) {
  const t0 = Date.now()
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8' },
      redirect: 'follow'
    })
    const html = await res.text()
    return { status: res.status, len: html.length, ms: Date.now() - t0, html }
  } catch (e) {
    return { status: 0, len: 0, ms: Date.now() - t0, err: e.message }
  }
}

const uniq = (a) => [...new Set(a)]

;(async () => {
  const q = 'city traffic jam'

  // 1. Pixabay
  let r = await get(`https://pixabay.com/images/search/${encodeURIComponent(q)}/`)
  let imgs = uniq((r.html || '').match(/https:\/\/cdn\.pixabay\.com\/photo\/[^"'\\\s]+?\.(?:jpg|png)/g) || [])
  console.log('Pixabay', r.status, r.ms + 'ms', 'len=' + r.len, '| 图', imgs.length, '|', imgs[0] || '-')

  // 2. Unsplash
  r = await get(`https://unsplash.com/s/photos/${encodeURIComponent(q)}`)
  imgs = uniq((r.html || '').match(/https:\/\/images\.unsplash\.com\/photo-[^"'\\\s?]+/g) || [])
  console.log('Unsplash', r.status, r.ms + 'ms', 'len=' + r.len, '| 图', imgs.length, '|', imgs[0] || '-')

  // 3. Pexels
  r = await get(`https://www.pexels.com/search/${encodeURIComponent(q)}/`)
  imgs = uniq((r.html || '').match(/https:\/\/images\.pexels\.com\/photos\/\d+\/[^"'\\\s?]+/g) || [])
  console.log('Pexels', r.status, r.ms + 'ms', 'len=' + r.len, '| 图', imgs.length, '|', imgs[0] || '-')

  // 4. 中文主题在免版权图库的覆盖测试
  for (const zh of ['she ethnic china', 'chinese covered bridge', 'rice terraces china']) {
    const rx = await get(`https://pixabay.com/images/search/${encodeURIComponent(zh)}/`)
    const list = uniq((rx.html || '').match(/https:\/\/cdn\.pixabay\.com\/photo\/[^"'\\\s]+?\.(?:jpg|png)/g) || [])
    console.log('  pixabay:', zh, '→', list.length)
  }
})()
