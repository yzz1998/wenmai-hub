/**
 * 专题（Collection）元数据 —— 统一站点的「专题馆」定义。
 *
 * 合并策略说明：
 * 三个历史项目各自有一套主题色与信息架构。合并时不做平均，
 * 而是抽出「一套基础层 + 各专题主色」，每个专题在自己的区域内
 * 使用自己的主色，跨专题区域（导航、卡片徽标、检索结果）统一用主色
 * 做区分标记，从而既保留各自气质，又让用户始终知道自己站在哪一馆。
 *
 * 现在站点有两条并列的策展线：
 * · 课程线（kind: 'course'）——《人类与社会》第二、五章，各成一馆；
 * · 乡土线（kind: 'theme' / 'local'）——剪纸、畲族、闽东三支本地内容。
 * 两条线在「专题馆」里并列为五个馆，在「资源库」里共用一套检索。
 */

export const COLLECTIONS = [
  /* ================= 课程线：两个章节专题馆 ================= */
  {
    id: 'hs-res',
    kind: 'course',
    name: '资源与发展馆',
    short: '资源与发展',
    en: 'RESOURCES AND DEVELOPMENT',
    tagline: '第二章：资源是什么、当代的资源环境压力从何而来、可持续发展怎么走',
    unit: '条要点',
    route: '/theme/resources',
    icon: 'leaf',
    /* 封面用本章自己的一条内容（HS2-012 塞罕坝林海）：荒原变林海，正对本章「资源—压力—出路」的落点 */
    coverId: 'HS2-012',
    /* 教材位置：馆名与章名分开，馆名是「馆」，章名是「内容」 */
    chapter: '第二章',
    chapterTitle: '人类社会发展与资源',
    /* 主色：茶金（谷物 / 土地） */
    accent: {
      text: 'text-cha-700',
      bg: 'bg-cha-50',
      bgSolid: 'bg-cha-700',
      border: 'border-cha-300',
      ring: 'ring-cha-100',
      dot: 'bg-cha-500',
      soft: 'bg-cha-900',
      hero: 'from-cha-900 via-cha-700 to-cha-500'
    },
    facts: ['3 节', '12 条要点', '第二章'],
    points: ['资源与三种分类依据', '资源环境问题与承载力', '可持续发展三个原则']
  },
  {
    id: 'hs-city',
    kind: 'course',
    name: '城市与乡村馆',
    short: '城市与乡村',
    en: 'CITY AND COUNTRYSIDE',
    tagline: '第五章：城市怎样产生、城市化遵循什么规律、工业化如何改写城乡关系',
    unit: '条要点',
    route: '/theme/urban-rural',
    icon: 'grid',
    /* 封面用 HS5-003：近处高层住宅、中景农田、远处山脊 —— 一张图里就有城乡交界 */
    coverId: 'HS5-003',
    chapter: '第五章',
    chapterTitle: '城市、城市化与乡村社会',
    /* 主色：暮金（街灯 / 滩涂） */
    accent: {
      text: 'text-tan-700',
      bg: 'bg-tan-50',
      bgSolid: 'bg-tan-700',
      border: 'border-tan-300',
      ring: 'ring-tan-100',
      dot: 'bg-tan-500',
      soft: 'bg-tan-900',
      hero: 'from-tan-900 via-tan-700 to-tan-500'
    },
    facts: ['3 节', '13 条要点', '第五章'],
    points: ['城市化与诺瑟姆曲线', '农业与乡村社会变迁', '工业化与城乡关系']
  },

  /* ================= 乡土线：三支本地内容 ================= */
  {
    id: 'mindong',
    kind: 'local',
    name: '闽东本土文化知识库',
    short: '闽东知识库',
    en: 'MINDONG KNOWLEDGE BASE',
    tagline: '山海之间的乡土知识，五类主题可检索、可引用、可进课堂',
    unit: '条素材',
    route: '/theme/mindong',
    icon: 'book',
    /* 主色：黛青（山） */
    accent: {
      text: 'text-dai-700',
      bg: 'bg-dai-50',
      bgSolid: 'bg-dai-700',
      border: 'border-dai-300',
      ring: 'ring-dai-100',
      dot: 'bg-dai-500',
      soft: 'bg-dai-900',
      hero: 'from-dai-900 via-dai-700 to-dai-500'
    },
    facts: ['5 类主题', '38 条素材', '38 张配图'],
    points: ['五类主题分类与释义', '来源标注可回溯到原文', '支持增删改与配图替换']
  },
  {
    id: 'papercut',
    kind: 'theme',
    name: '库淑兰剪纸纹样馆',
    short: '剪纸图样',
    en: 'KUSHULAN PAPER-CUT MUSEUM',
    tagline: '二百四十一件彩贴剪纸，按题材编次的图样总目',
    unit: '件图样',
    route: '/theme/papercut',
    icon: 'scissors',
    /* 主色：朱砂（剪纸 / 印章） */
    accent: {
      text: 'text-zhu-700',
      bg: 'bg-zhu-50',
      bgSolid: 'bg-zhu-500',
      border: 'border-zhu-300',
      ring: 'ring-zhu-100',
      dot: 'bg-zhu-500',
      soft: 'bg-zhu-900',
      hero: 'from-zhu-900 via-zhu-700 to-zhu-500'
    },
    facts: ['241 件图样', '8 类题材', '上下两册图录'],
    points: ['按题材编次的侧栏目录', '单幅 1–6× 深度缩放', '图录页码与图版尺寸著录']
  },
  {
    id: 'she',
    kind: 'theme',
    name: '畲族民俗文化馆',
    short: '畲族展项',
    en: 'SHE ETHNOGRAPHIC GALLERY',
    tagline: '七个展区、三十个展项、七十八帧实景，山哈的族群记忆',
    unit: '个展项',
    route: '/theme/she',
    icon: 'phoenix',
    /* 主色：靛青（海 / 畲族靛蓝） */
    accent: {
      text: 'text-indigoSea-700',
      bg: 'bg-indigoSea-50',
      bgSolid: 'bg-indigoSea-700',
      border: 'border-indigoSea-300',
      ring: 'ring-indigoSea-100',
      dot: 'bg-indigoSea-500',
      soft: 'bg-indigoSea-900',
      hero: 'from-indigoSea-900 via-indigoSea-700 to-indigoSea-500'
    },
    facts: ['7 个展区', '30 个展项', '78 帧实景照片'],
    points: ['七展区动线导览', '逐帧署名与版权提示', '原始报道可回溯']
  }
]

export const COLLECTION_MAP = Object.fromEntries(COLLECTIONS.map((c) => [c.id, c]))

export const collectionName = (id) => COLLECTION_MAP[id]?.name || '未分类'
export const collectionShort = (id) => COLLECTION_MAP[id]?.short || '条目'

/** 课程两馆（《人类与社会》第二、五章） */
export const COURSE_COLLECTIONS = COLLECTIONS.filter((c) => c.kind === 'course')
/** 乡土三支：剪纸、畲族、闽东知识库 */
export const LOCAL_COLLECTIONS = COLLECTIONS.filter((c) => c.kind !== 'course')
/** 专题馆里的五个馆：课程两馆 + 剪纸、畲族、闽东 */
export const GALLERY_COLLECTIONS = COLLECTIONS.filter((c) => c.route.startsWith('/theme'))

/**
 * 检索/筛选用的专题选项（含「全部」）
 */
export const COLLECTION_FILTERS = [
  { id: '', name: '全部专题', short: '全部' },
  ...COLLECTIONS.map((c) => ({ id: c.id, name: c.short, short: c.short }))
]
