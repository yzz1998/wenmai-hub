/**
 * 联网检索配图候选（Wikimedia Commons 开放图库）
 * 每条给 2–3 组检索词，取候选并过滤低质/非照片资源
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const UA = 'WenmaiHub-Edu/1.0 (course resource project; contact: local)'

const TASKS = [
  /* ---- 畲族缺图 6 条 ---- */
  { id: 'SHE-LANG-01', q: ['She people China', 'She ethnic group Fujian', 'She minority village'] },
  { id: 'SHE-LANG-02', q: ['She people Fujian village', 'She ethnic costume China', 'Fujian mountain village people'] },
  { id: 'SHE-LANG-03', q: ['Chinese ancestral hall interior', 'Chinese clan genealogy book', 'ancestral hall Zhejiang'] },
  { id: 'SHE-LANG-04', q: ['folk song singers village China', 'She people singing', 'Chinese folk singers outdoor'] },
  { id: 'SHE-FESTIVAL-02', q: ['Chinese wedding sedan chair', 'traditional Chinese wedding ceremony', 'She people wedding'] },
  { id: 'SHE-CRAFT-04', q: ['wooden arch bridge Fujian', 'covered bridge Zhejiang', 'langqiao bridge China'] },
  { id: 'SHE-ARCHIVE-01', q: ['Chinese herbal medicine dried herbs', 'traditional Chinese medicine pharmacy', 'medicinal plants basket'] },
  { id: 'SHE-RIBBON-05', q: ['silk ribbon weaving loom', 'Chinese brocade weaving', 'colorful woven ribbon textile'] },

  /* ---- 第二章：资源与发展 12 条 ---- */
  { id: 'HS2-001', q: ['natural resources landscape mountains river', 'renewable energy wind turbines field'] },
  { id: 'HS2-002', q: ['open pit mine mineral', 'forest timber resources', 'water reservoir resource'] },
  { id: 'HS2-003', q: ['river basin watershed landscape aerial', 'mountain valley ecosystem'] },
  { id: 'HS2-004', q: ['students classroom education', 'research laboratory scientists', 'office workers knowledge'] },
  { id: 'HS2-005', q: ['coal fired power plant', 'oil refinery industry', 'wind turbines solar panels field'] },
  { id: 'HS2-006', q: ['crowded street crowd people city', 'population density street market'] },
  { id: 'HS2-007', q: ['copper open pit mine', 'mining excavator ore', 'oil pump jack field'] },
  { id: 'HS2-008', q: ['air pollution smog city', 'deforestation cleared forest', 'river pollution waste'] },
  { id: 'HS2-009', q: ['Earth from space blue marble', 'environmental summit conference'] },
  { id: 'HS2-010', q: ['solar panels wind farm landscape', 'renewable energy installation'] },
  { id: 'HS2-011', q: ['recycling plant sorting waste', 'recycling bins collection', 'scrap metal recycling'] },
  { id: 'HS2-012', q: ['solar power plant China', 'wind farm China desert', 'Three Gorges Dam'] },

  /* ---- 第五章：城市与乡村 13 条 ---- */
  { id: 'HS5-001', q: ['ancient city ruins Mesopotamia', 'Ur ziggurat Iraq', 'ancient mud brick city wall'] },
  { id: 'HS5-002', q: ['aerial view city skyline downtown', 'city skyline panorama'] },
  { id: 'HS5-003', q: ['urban sprawl aerial suburb', 'city aerial view residential'] },
  { id: 'HS5-004', q: ['suburban houses aerial', 'city outskirts aerial view'] },
  { id: 'HS5-005', q: ['Shanghai skyline Pudong', 'Chinese city skyline night'] },
  { id: 'HS5-006', q: ['traffic congestion city street', 'urban road traffic jam'] },
  { id: 'HS5-007', q: ['wheat field harvest golden', 'wheat ears close up field'] },
  { id: 'HS5-008', q: ['rice terraces China', 'ox ploughing field traditional farming'] },
  { id: 'HS5-009', q: ['combine harvester wheat field', 'tractor spraying field agriculture'] },
  { id: 'HS5-010', q: ['Chinese rural village houses', 'rural village China countryside'] },
  { id: 'HS5-011', q: ['textile mill factory machines', 'steam engine industrial museum'] },
  { id: 'HS5-012', q: ['steel mill blast furnace', 'industrial revolution factory interior'] },
  { id: 'HS5-013', q: ['city edge farmland aerial', 'urban rural boundary landscape'] }
]

const BAD = /(logo|icon|map|diagram|chart|graph|flag|coat of arms|seal|signature|svg|banner|poster|stamp|screenshot|table|formula|symbol|crest|emblem)/i

async function search(q, limit = 8) {
  const url =
    'https://commons.wikimedia.org/w/api.php?' +
    new URLSearchParams({
      action: 'query',
      generator: 'search',
      gsrsearch: `filetype:bitmap ${q}`,
      gsrnamespace: '6',
      gsrlimit: String(limit),
      prop: 'imageinfo',
      iiprop: 'url|extmetadata|size|mime',
      iiurlwidth: '1400',
      format: 'json',
      origin: '*'
    })
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) return []
  const j = await res.json()
  const pages = j?.query?.pages
  if (!pages) return []
  return Object.values(pages).map((p) => {
    const ii = (p.imageinfo || [])[0] || {}
    const em = ii.extmetadata || {}
    const strip = (h) => String(h || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    return {
      title: p.title.replace(/^File:/, ''),
      page: ii.descriptionurl || '',
      thumb: ii.thumburl || '',
      w: ii.width || 0,
      h: ii.height || 0,
      mime: ii.mime || '',
      author: strip(em.Artist?.value).slice(0, 80),
      license: em.LicenseShortName?.value || '',
      desc: strip(em.ImageDescription?.value).slice(0, 160),
      q
    }
  })
}

;(async () => {
  const out = {}
  for (const t of TASKS) {
    const seen = new Set()
    const list = []
    for (const q of t.q) {
      let r = []
      try {
        r = await search(q)
      } catch (e) {
        console.error('fail', t.id, q, e.message)
      }
      for (const c of r) {
        if (!c.thumb || seen.has(c.page)) continue
        if (BAD.test(c.title)) continue
        if (!/^image\/(jpeg|png|webp)$/.test(c.mime)) continue
        if (c.w < 900 || c.h < 600) continue
        const ar = c.w / c.h
        if (ar > 3 || ar < 0.4) continue
        seen.add(c.page)
        list.push(c)
      }
      await new Promise((r) => setTimeout(r, 220))
    }
    out[t.id] = list.slice(0, 10)
    console.log(t.id.padEnd(14), '候选', String(list.length).padStart(2), '|', list.slice(0, 3).map((c) => c.title.slice(0, 34)).join(' ‖ '))
  }
  fs.writeFileSync(path.join(ROOT, 'work/candidates.json'), JSON.stringify(out, null, 1))
  const total = Object.values(out).reduce((a, b) => a + b.length, 0)
  console.log('=== 合计候选', total, '| 有条目的', Object.values(out).filter((v) => v.length).length, '/', TASKS.length)
})()
