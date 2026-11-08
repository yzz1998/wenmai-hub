/**
 * 假的 OpenAI 兼容端点，只为验证「浏览器直连」这条链路。
 *
 * 它要回答的问题不是「模型评得好不好」，而是：
 *   跨域能不能过、Key 有没有按规范带上、返回的脏数据有没有被前端钳住。
 *
 * 所以它故意返回**有问题的分数**：26（越界）、21.6（小数）、"19"（字符串）、
 * 以及干脆缺掉一个维度。normalize 必须把它们分别变成 25 / 22 / 19 / 0。
 *
 * 错误分支用模型名触发，测试里改一个字段就能切换：
 *   mock-ok    正常
 *   mock-401   密钥无效
 *   mock-429   限流（带 retry-after）
 *   mock-500   上游故障
 *
 * 用法：node work/mock-llm.cjs  （监听 8099）
 */
const http = require('http')

const PORT = Number(process.env.MOCK_LLM_PORT || 8099)

const REVIEW_JSON = JSON.stringify({
  dimensions: [
    { key: 'structure', score: 21.6, comment: '四段递进清楚，小标题层级成立。', evidence: '二、田野过程' },
    { key: 'relevance', score: 26, comment: '选题切中课程目标，第三部分建议偏空。', evidence: '一、缘起' },
    { key: 'evidence', score: '19', comment: '访谈缺时间与地点，可核查性被削弱。', evidence: '我先后走访了三位老艺人' }
    // norm 维度刻意缺失：验证前端会不会自己补 0 而不是崩
  ],
  summary: '这是一段用于验证直连链路的示例总评：结构与切题是长处，规范是短板。',
  suggestions: ['补受访者姓名与访谈日期', '给文中民谚标注出处', '文末补三条参考文献']
})

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'authorization,content-type,x-api-key',
  'Access-Control-Max-Age': '600'
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS)
    res.end()
    return
  }
  if (!req.url.startsWith('/chat/completions')) {
    res.writeHead(404, { ...CORS, 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: { message: 'not found' } }))
    return
  }

  let raw = ''
  req.on('data', (c) => {
    raw += c
  })
  req.on('end', () => {
    let body = {}
    try {
      body = JSON.parse(raw)
    } catch {
      /* 保持空对象 */
    }
    const model = String(body.model || '')
    const auth = String(req.headers.authorization || '')

    const send = (status, payload, extra = {}) => {
      res.writeHead(status, { ...CORS, 'Content-Type': 'application/json', ...extra })
      res.end(JSON.stringify(payload))
    }

    if (!/^Bearer\s+sk-/.test(auth)) {
      send(401, { error: { message: '缺少或格式错误的 Authorization' } })
      return
    }
    if (model === 'mock-401') {
      send(401, { error: { message: 'Authentication Fails, Your api key is invalid' } })
      return
    }
    if (model === 'mock-429') {
      send(429, { error: { message: 'Rate limit reached' } }, { 'retry-after': '2' })
      return
    }
    if (model === 'mock-500') {
      send(500, { error: { message: 'upstream boom' } })
      return
    }

    // 自检请求不带 response_format，回一句话即可
    if (!body.response_format) {
      send(200, { model: model || 'mock-llm', choices: [{ message: { content: 'OK' } }] })
      return
    }

    send(200, {
      id: 'chatcmpl-mock',
      model: model || 'mock-llm',
      choices: [{ index: 0, message: { role: 'assistant', content: REVIEW_JSON }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 1000, completion_tokens: 400, total_tokens: 1400 }
    })
  })
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`mock LLM listening on http://127.0.0.1:${PORT}`)
})
