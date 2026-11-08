/**
 * 合并后的分类体系 —— 三个专题各自保留原有分类，不做强行统一。
 *
 * 为什么不合并分类：剪纸的「花卉草木」与畲族的「传统服饰」不是同一维度，
 * 硬并成一套会同时破坏两个馆策展逻辑的完整性。合并的是「分类的访问方式」：
 * 统一提供 categoryMeta(collection, id) 一个入口，页面/卡片/筛选器只认这一个函数。
 */
import papercutData from './papercut.json'
import sheData from './she.json'
import hsCh2 from './hs-ch2.json'
import hsCh5 from './hs-ch5.json'

/* ---------------- 知识素材：5 类（源自闽东知识库） ---------------- */
export const MINDONG_CATEGORIES = [
  {
    id: 'festival',
    name: '民俗节庆',
    short: '节庆',
    desc: '畲族三月三、二月二灯会、临水夫人信俗、祭祖歌会等岁时节令与民间信仰活动',
    icon: 'lantern',
    tokens: { fg: 'text-zhu-700', bg: 'bg-zhu-50', ring: 'ring-zhu-100', dot: 'bg-zhu-500' }
  },
  {
    id: 'opera',
    name: '方言曲艺',
    short: '曲艺',
    desc: '四平戏、北路戏、平讲戏、畲族民歌双音、闽东方言语系与口头传统',
    icon: 'mask',
    tokens: { fg: 'text-indigoSea-700', bg: 'bg-indigoSea-50', ring: 'ring-indigoSea-100', dot: 'bg-indigoSea-500' }
  },
  {
    id: 'figure',
    name: '历史人物',
    short: '人物',
    desc: '开闽第一进士薛令之、寿宁知县冯梦龙、戍台名将甘国宝等闽东先贤',
    icon: 'scroll',
    tokens: { fg: 'text-cha-700', bg: 'bg-cha-50', ring: 'ring-cha-100', dot: 'bg-cha-500' }
  },
  {
    id: 'craft',
    name: '传统技艺',
    short: '技艺',
    desc: '木拱廊桥营造、柘荣剪纸、霍童线狮、畲族银器、白茶与坦洋工夫制茶技艺',
    icon: 'hands',
    tokens: { fg: 'text-dai-700', bg: 'bg-dai-50', ring: 'ring-dai-100', dot: 'bg-dai-500' }
  },
  {
    id: 'scenic',
    name: '名胜古迹',
    short: '名胜',
    desc: '太姥山、白水洋、白云山、廉村古渡、支提山华严寺等山海人文景观',
    icon: 'mountain',
    tokens: { fg: 'text-tan-700', bg: 'bg-tan-100', ring: 'ring-tan-300', dot: 'bg-tan-500' }
  }
]

/* ---------------- 剪纸图样：8 类（源自剪纸馆 catOrder） ---------------- */
const PC_TOKENS = [
  { fg: 'text-zhu-700', bg: 'bg-zhu-50', ring: 'ring-zhu-100', dot: 'bg-zhu-500' },
  { fg: 'text-cha-700', bg: 'bg-cha-50', ring: 'ring-cha-100', dot: 'bg-cha-500' },
  { fg: 'text-tan-700', bg: 'bg-tan-100', ring: 'ring-tan-300', dot: 'bg-tan-500' },
  { fg: 'text-zhu-700', bg: 'bg-zhu-50', ring: 'ring-zhu-100', dot: 'bg-zhu-500' }
]

export const PAPERCUT_CATEGORIES = papercutData.categories.map((c, i) => ({
  ...c,
  icon: 'scissors',
  desc: c.intro || '',
  tokens: PC_TOKENS[i % PC_TOKENS.length]
}))

/* ---------------- 畲族展区：7 区（源自畲族馆 ZONES） ---------------- */
const SHE_TOKENS = [
  { fg: 'text-dai-700', bg: 'bg-dai-50', ring: 'ring-dai-100', dot: 'bg-dai-500' },
  { fg: 'text-indigoSea-700', bg: 'bg-indigoSea-50', ring: 'ring-indigoSea-100', dot: 'bg-indigoSea-500' },
  { fg: 'text-zhu-700', bg: 'bg-zhu-50', ring: 'ring-zhu-100', dot: 'bg-zhu-500' },
  { fg: 'text-cha-700', bg: 'bg-cha-50', ring: 'ring-cha-100', dot: 'bg-cha-500' },
  { fg: 'text-tan-700', bg: 'bg-tan-100', ring: 'ring-tan-300', dot: 'bg-tan-500' },
  { fg: 'text-dai-700', bg: 'bg-dai-50', ring: 'ring-dai-100', dot: 'bg-dai-500' },
  { fg: 'text-cha-700', bg: 'bg-cha-50', ring: 'ring-cha-100', dot: 'bg-cha-500' }
]

const SHE_ICONS = ['mask', 'cloth', 'music', 'lantern', 'hands', 'scroll', 'layers']

export const SHE_ZONES = sheData.categories.map((z, i) => ({
  ...z,
  icon: SHE_ICONS[i] || 'sparkle',
  tokens: SHE_TOKENS[i % SHE_TOKENS.length]
}))

/* ---------------- 课程章节库：直接把教材的「节」当作分类 ---------------- */
const COURSE_TOKENS = [
  { fg: 'text-cha-700', bg: 'bg-cha-50', ring: 'ring-cha-100', dot: 'bg-cha-500' },
  { fg: 'text-tan-700', bg: 'bg-tan-100', ring: 'ring-tan-300', dot: 'bg-tan-500' },
  { fg: 'text-dai-700', bg: 'bg-dai-50', ring: 'ring-dai-100', dot: 'bg-dai-500' }
]

const toSections = (data, icons) =>
  data.sections.map((s, i) => ({
    ...s,
    icon: icons[i] || 'sparkle',
    tokens: COURSE_TOKENS[i % COURSE_TOKENS.length]
  }))

/** 第二章三节：资源与分类 / 资源环境问题 / 可持续发展 */
export const HS_RES_SECTIONS = toSections(hsCh2, ['basket', 'warn', 'compass'])
/** 第五章三节：城市与城市化 / 农业与乡村 / 工业与社会变迁 */
export const HS_CITY_SECTIONS = toSections(hsCh5, ['grid', 'hands', 'sliders'])

/* ---------------- 统一查询入口 ---------------- */
const REGISTRY = {
  mindong: MINDONG_CATEGORIES,
  papercut: PAPERCUT_CATEGORIES,
  she: SHE_ZONES,
  'hs-res': HS_RES_SECTIONS,
  'hs-city': HS_CITY_SECTIONS
}

const FALLBACK_TOKENS = { fg: 'text-ink-soft', bg: 'bg-black/[0.04]', ring: 'ring-black/10', dot: 'bg-ink-mute' }

export function categoryMeta(collection, id) {
  const list = REGISTRY[collection] || []
  const found = list.find((c) => c.id === id)
  if (found) return found
  return { id, name: typeof id === 'string' ? id : '未分类', short: '未分类', desc: '', tokens: FALLBACK_TOKENS }
}

export const categoryList = (collection) => REGISTRY[collection] || []

/**
 * 兼容旧调用：管理页/表单只处理知识素材，历史上写的是 categoryName(id)。
 * 这里做参数形态兼容 —— 单参视为 mindong，双参为 (collection, id)。
 */
export const categoryName = (collection, id) =>
  id === undefined ? categoryMeta('mindong', collection).name : categoryMeta(collection, id).name

export const categoryTokens = (collection, id) =>
  id === undefined ? categoryMeta('mindong', collection).tokens : categoryMeta(collection, id).tokens

/** 兼容别名：知识素材分类表（管理端沿用旧名字） */
export const CATEGORIES = MINDONG_CATEGORIES

/* ---------------- 通用枚举（沿用知识库原定义） ---------------- */
export const STATUSES = [
  { id: 'published', name: '已发布' },
  { id: 'draft', name: '草稿' }
]

/**
 * 成果类型。
 *
 * `lesson_plan` 不是「文章的另一种写法」，而是另一套评价对象：
 * 教案要评的是环节、时间、师生活动是否成对、评价是否回到目标，
 * 用论文的四维量表评它，只能评出「文字通不通顺」。
 * 所以它是独立类型，并绑定独立的评阅量表（见 cloud-functions/_lib/rubrics/lesson.js）。
 */
export const WORK_TYPES = [
  { id: 'article', name: '文章', icon: 'doc' },
  { id: 'lesson_plan', name: '教案', icon: 'book' },
  { id: 'image', name: '图片', icon: 'image' },
  { id: 'audio', name: '音频', icon: 'audio' },
  { id: 'video', name: '视频', icon: 'video' }
]

export const workTypeName = (id) => WORK_TYPES.find((t) => t.id === id)?.name || '其他'

export const SEMESTERS = ['2026春', '2025秋', '2025春', '2024秋']

export const GRADES = ['开放教育本科', '开放教育专科', '中职', '社区教育', '教师研修']
