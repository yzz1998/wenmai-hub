import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useStore, inferSemester } from '../hooks/useStore'
import { GRADES, SEMESTERS, WORK_TYPES, workTypeName } from '../data/taxonomy'
import Icon from '../components/Icon'
import { SectionTitle } from '../components/UI'
import { ImageField } from '../components/ImageField'
import { DocField } from '../components/DocField'
import { isMockMode, reviewErrorText } from '../lib/review'
import { useSettings } from '../hooks/useSettings'
import { isConfigured } from '../lib/settings'
import { RUBRIC_MATERIALS, rubricNote, rubricViewForType } from '../data/rubric'

const empty = {
  title: '',
  type: 'article',
  author: '',
  grade: GRADES[0],
  semester: '',
  course: '',
  summary: '',
  content: '',
  tagText: '',
  attachedUrl: '',
  image: '',
  docs: []
}

/** 学生成果提交 / 编辑表单（整页形式，符合长内容录入习惯） */
export default function WorkNew() {
  const { id } = useParams()
  const nav = useNavigate()
  const { works, createWork, updateWork, startReview, notify } = useStore()
  const settings = useSettings()
  const configured = isConfigured(settings)
  const editing = id ? works.find((w) => w.id === id) : null

  const [form, setForm] = useState(empty)
  const [imageMeta, setImageMeta] = useState(null)
  const [errors, setErrors] = useState({})
  const [autoReview, setAutoReview] = useState(true)

  useEffect(() => {
    if (editing) {
      setForm({
        title: editing.title || '',
        type: editing.type || 'article',
        author: editing.author || '',
        grade: editing.grade || GRADES[0],
        semester: editing.semester || '',
        course: editing.course || '',
        summary: editing.summary || '',
        content: editing.content || '',
        tagText: (editing.tags || []).join('、'),
        attachedUrl: editing.attachedUrl || '',
        image: editing.image || '',
        docs: Array.isArray(editing.docs) ? editing.docs : []
      })
      setImageMeta(editing.imageMeta || null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }))
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }))
  }

  const validate = () => {
    const e = {}
    if (!form.title.trim()) e.title = '请填写成果标题'
    if (!form.author.trim()) e.author = '请填写作者姓名'
    if (!form.summary.trim()) e.summary = '请填写成果简介'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  /** 这套成果会用哪套量表：交教案就按七维教案量表评，交文章按四维通用量表评 */
  const rubricView = useMemo(() => rubricViewForType(form.type), [form.type])

  /** 可评阅的依据：有文档解析正文，或有手填正文。评阅按钮/勾选的可用性都看这个 */
  const hasReviewSource = useMemo(
    () => Boolean(form.docs[0]) || form.content.replace(/\s/g, '').length >= 200,
    [form.docs, form.content]
  )

  /** 勾选旁的一句话：把「现在点了会发生什么」说清楚，别让人提交完才发现没配密钥 */
  const autoReviewHint = useMemo(() => {
    if (!hasReviewSource) return '需要先上传文档，或在「正文」里写满 200 字以上。'
    if (isMockMode(settings)) return '当前为示例模式，分数由本地生成，不代表真实模型判断。'
    if (!configured) return '尚未配置模型密钥：到顶栏「设置」填入后即刻可用，无需重新部署。'
    return '评阅会复用已上传的文档、正文与配图，不用再传一次。'
  }, [hasReviewSource, configured, settings])

  const submit = () => {
    if (!validate()) return
    const payload = {
      title: form.title.trim(),
      type: form.type,
      author: form.author.trim(),
      grade: form.grade,
      semester: form.semester || inferSemester(),
      course: form.course.trim(),
      summary: form.summary.trim(),
      content: form.content,
      tags: form.tagText
        .split(/[、,，;；|\s]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .filter((v, i, a) => a.indexOf(v) === i),
      attachedUrl: form.attachedUrl.trim(),
      image: form.image,
      imageMeta: form.image ? imageMeta || undefined : undefined,
      docs: form.docs
    }
    if (editing) {
      updateWork(editing.id, payload)
      nav(`/works/${editing.id}`)
      return
    }
    const created = createWork(payload)
    // 不 await：评阅要几十秒，先把人送到详情页看面板上的进度。
    // 失败也只提示一句，不阻断入库——成果本身已经存好了。
    if (autoReview && hasReviewSource) {
      if (!configured) {
        notify('已入库。当前未配置模型密钥，评阅可在详情页配置后再发起', 'warn')
      } else {
        startReview(created.id, { work: created }).catch((e) => {
          const info = reviewErrorText(e?.code)
          notify(`已入库，但评阅未完成：${info.title}`, 'warn')
        })
      }
    }
    nav(`/works/${created.id}`)
  }

  const typeHint = {
    article: '请粘贴或撰写文章正文，可分段。',
    image: '请描述作品内容与创作思路，并在下方填写图片地址（或图集链接）。',
    audio: '请描述录音内容、录制场景与时长，并在下方填写音频地址。',
    video: '请描述视频内容、拍摄手法与时长，并在下方填写视频地址。'
  }[form.type]

  return (
    <div className="wrap max-w-4xl py-10">
      <button onClick={() => nav(-1)} className="btn-quiet btn-xs mb-5 -ml-2">
        <Icon name="back" size={14} />
        返回
      </button>

      <SectionTitle
        eyebrow={editing ? `编辑成果 · ${editing.id}` : '成果入库'}
        title={editing ? '修改学生成果' : '提交学生优秀成果'}
        sub="支持文章、教案、图片、音频、视频五类成果。可上传 PDF / DOCX / TXT / MD 原稿，入库后由 AI 按对应量表自动评阅。"
      />

      <div className="card space-y-5 p-6">
        {/* 类型选择 */}
        <div>
          <span className="field-label">成果类型 <span className="text-zhu-500">*</span></span>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {WORK_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => set('type', t.id)}
                className={`flex flex-col items-center gap-2 rounded-xl border p-3.5 transition-all ${
                  form.type === t.id
                    ? 'border-zhu-500 bg-zhu-50 text-zhu-700 shadow-sm'
                    : 'border-black/10 bg-white/70 text-ink-mute hover:border-dai-300 hover:text-dai-700'
                }`}
              >
                <Icon name={t.icon} size={22} />
                <span className="text-[13px] font-medium">{t.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="field-label" htmlFor="wf-title">
              成果标题 <span className="text-zhu-500">*</span>
            </label>
            <input
              id="wf-title"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              className="field"
              placeholder="如：山海之间的乡音——福安平讲戏田野调查札记"
            />
            {errors.title && <p className="mt-1.5 text-[12px] text-zhu-700">{errors.title}</p>}
          </div>

          <div>
            <label className="field-label" htmlFor="wf-author">
              作者姓名 <span className="text-zhu-500">*</span>
            </label>
            <input
              id="wf-author"
              value={form.author}
              onChange={(e) => set('author', e.target.value)}
              className="field"
              placeholder="学生姓名（或小组名）"
            />
            {errors.author && <p className="mt-1.5 text-[12px] text-zhu-700">{errors.author}</p>}
          </div>

          <div>
            <label className="field-label" htmlFor="wf-grade">
              学段 / 类型
            </label>
            <select
              id="wf-grade"
              value={form.grade}
              onChange={(e) => set('grade', e.target.value)}
              className="field cursor-pointer"
            >
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label" htmlFor="wf-semester">
              所属学期
            </label>
            <select
              id="wf-semester"
              value={form.semester}
              onChange={(e) => set('semester', e.target.value)}
              className="field cursor-pointer"
            >
              <option value="">按提交日期自动判定（{inferSemester()}）</option>
              {SEMESTERS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label" htmlFor="wf-course">
              关联课程
            </label>
            <input
              id="wf-course"
              value={form.course}
              onChange={(e) => set('course', e.target.value)}
              className="field"
              placeholder="如：地域文化与方言调查"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="field-label" htmlFor="wf-summary">
              成果简介 <span className="text-zhu-500">*</span>
            </label>
            <textarea
              id="wf-summary"
              value={form.summary}
              onChange={(e) => set('summary', e.target.value)}
              rows={3}
              className="field resize-y"
              placeholder="用 2—3 句话说明作品做了什么、用了什么方法、有什么发现。"
            />
            {errors.summary && <p className="mt-1.5 text-[12px] text-zhu-700">{errors.summary}</p>}
          </div>

          <div className="sm:col-span-2">
            <label className="field-label" htmlFor="wf-content">
              正文 / 作品说明
            </label>
            <textarea
              id="wf-content"
              value={form.content}
              onChange={(e) => set('content', e.target.value)}
              rows={10}
              className="field resize-y leading-relaxed"
              placeholder={`${typeHint}\n\n支持分段与简单小标题（如「一、缘起」）。`}
            />
          </div>

          {/* 成果文档：紧贴正文，方便「写完再上传成稿」或「上传后把解析文本回填正文」 */}
          <div className="sm:col-span-2">
            <DocField
              value={form.docs[0] || null}
              onChange={(doc) => set('docs', doc ? [doc] : [])}
              onFillContent={(text) => set('content', text)}
              contentEmpty={!form.content.trim()}
            />
          </div>

          <div>
            <label className="field-label" htmlFor="wf-tags">
              关键词标签
            </label>
            <input
              id="wf-tags"
              value={form.tagText}
              onChange={(e) => set('tagText', e.target.value)}
              className="field"
              placeholder="用顿号分隔，如：平讲戏、田野调查、福安"
            />
          </div>

          <div>
            <label className="field-label" htmlFor="wf-url">
              附件地址（图片 / 音频 / 视频）
            </label>
            <input
              id="wf-url"
              value={form.attachedUrl}
              onChange={(e) => set('attachedUrl', e.target.value)}
              className="field"
              placeholder="https://… （选填）"
            />
          </div>

          <div className="sm:col-span-2">
            <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-ink-mute">
              <Icon name="info" size={11} className="mt-0.5 shrink-0" />
              图片、音视频文件仍建议上传至校内网盘后填入链接；文字成稿请走上方「成果文档」，AI 评阅读的是它的解析文本。
            </p>
          </div>

          <div className="sm:col-span-2">
            <label className="field-label">成果封面</label>
            <ImageField
              value={form.image}
              meta={imageMeta}
              category="craft"
              title={form.title}
              onChange={(ref, meta) => {
                setForm((f) => ({ ...f, image: ref }))
                setImageMeta(meta)
              }}
            />
          </div>
        </div>

        {!editing && (
          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-black/[0.08] bg-paper/50 p-3.5">
            <input
              type="checkbox"
              checked={autoReview}
              onChange={(e) => setAutoReview(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 accent-dai-700"
              data-testid="auto-review"
            />
            <span className="text-[12.5px] leading-relaxed text-ink-soft">
              入库后立即发起 AI 评阅（约 20–60 秒，可在详情页查看分数、评语与改进建议）
              <span className="mt-0.5 block text-[11px] text-ink-mute">{autoReviewHint}</span>
            </span>
          </label>
        )}

        {/* 标准要能被看得见：学生提交前就能判断自己还缺什么，而不是评完才知道 */}
        {!editing && (
          <details className="rounded-xl border border-black/[0.08] bg-paper/50 px-3.5 py-2.5">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[12px] font-medium text-ink-soft">
              <Icon name="info" size={13} className="shrink-0 text-dai-700" />
              评阅按什么标准打分
              <span className="chip ml-1 bg-dai-50 px-1.5 py-0 text-[10px] font-normal text-dai-700">
                {rubricView.name}
              </span>
              <Icon name="chevron" size={12} className="ml-auto shrink-0 text-ink-mute" />
            </summary>
            <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
              {rubricView.dimensions.map((d) => (
                <div key={d.key} className="rounded-lg bg-black/[0.025] px-3 py-2">
                  <p className="flex items-baseline justify-between gap-2 text-[12px] font-medium text-ink">
                    {d.name}
                    <span className="shrink-0 text-[10.5px] font-normal text-ink-mute">{d.max} 分</span>
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-ink-mute">{d.desc}</p>
                </div>
              ))}
            </div>
            <p className="mt-2.5 border-t border-black/[0.06] pt-2 text-[11px] leading-relaxed text-ink-mute">
              {rubricNote(rubricView)}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-mute">{RUBRIC_MATERIALS}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-mute">
              换成果类型，量表会跟着换：教案要评环节、时间与目标—评价一致性，用文章的四维标准评不出来。
            </p>
          </details>
        )}

        <div className="flex flex-wrap justify-end gap-2 border-t border-black/[0.07] pt-5">
          <button onClick={() => nav(-1)} className="btn-ghost">
            取消
          </button>
          <button onClick={submit} className="btn-zhu" data-testid="submit-work">
            <Icon name="upload" size={15} />
            {editing ? '保存修改' : '确认入库'}
          </button>
        </div>
      </div>
    </div>
  )
}
