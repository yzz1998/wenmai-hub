/**
 * 评阅内核的前端入口。
 *
 * 关键点：**prompt 与结果清洗只有一份实现**，就在 cloud-functions/_lib 里。
 * 前端直接 import 它，云函数也 import 它 —— 不是复制一份到 src 下。
 *
 * 这么做是因为这里最容易出漂移：改了量表措辞、改了 JSON 结构，
 * 如果前端直连和中继走两套 prompt，同一篇作品会因为「走哪条路」而得到不同分数，
 * 而且这种差异在界面上完全看不出来。
 *
 * 现在有两套量表（通用成果四维 / 教案七维），选择逻辑同样只在这里：
 * `resolveRubricKey()` 由成果类型决定用哪套，前端与云函数各调一次、结果必然一致。
 *
 * Vite 允许 import 项目根内的任意模块，所以跨目录引用是安全的；
 * 这几个模块都是纯字符串/纯函数，没有 Node 专有 API。
 */

export {
  RUBRICS,
  RUBRIC_KEYS,
  DEFAULT_RUBRIC_KEY,
  getRubric,
  resolveRubricKey,
  buildMessages,
  maxTokensFor,
  RUBRIC_META,
  RUBRIC_VERSION,
  PROMPT_VERSION,
  DIMENSIONS as PAPER_DIMENSIONS
} from '../../cloud-functions/_lib/rubric.js'

export { normalizeReview, extractJson, levelOf } from '../../cloud-functions/_lib/normalize.js'
