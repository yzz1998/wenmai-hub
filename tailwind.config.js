/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      /**
       * ===== 配色总纲（2026-11 重设计，取消米色底）=====
       *
       * 命名沿用中文语汇，但数值是现代化重排的结果。五个专题色不再各自为政，
       * 统一到同一条「明度—饱和度」带上（500 档 L≈40–46%、S≈50–70%），
       * 因此并排出现时像一组色而不是五种风格。
       *
       * 层次语义（改色时请守住这个契约）：
       *   paper.DEFAULT 页面底 / paper.warm 卡片与表面 / paper.sunk 凹陷区（表头、代码块）
       *   ink.DEFAULT 主文字 / soft 正文 / mute 辅助与占位
       *   dai（青瓷）  主色：导航激活、主按钮、链接、品牌标识
       *   zhu（朱砂）  强调：主 CTA、未读角标、删除与风险、印章
       *   indigoSea / cha / tan  专题识别色：只做分类与馆别标记，不做主按钮
       *
       * 对比度约束（实测值见 README「配色规范」一节）：
       *   正文级文字 ≥ 4.5:1；500/700 档在白底上的白字 ≥ 4.5:1（cha、tan 除外，见下）
       *   cha-500、tan-500 刻意保持明亮（3.7 / 3.9），**只用于进度条、圆点、装饰线**，
       *   需要实心底时一律用 700 档——这与 Tailwind 官方对 yellow 系的处理同理。
       *   300 档只做装饰性边框与淡化图标，不承担传达信息的图标（对白底 2.36）。
       */
      colors: {
        /* ===== 中性层：墨（冷调石板灰，去掉旧版墨绿的浊感）===== */
        ink: {
          DEFAULT: '#0F1E26',
          soft: '#3B4D57',
          /* mute 定在 #5A6B75 而不是更浅的灰：它同时要压在白卡（5.53）和
             paper-sunk 凹陷底（4.73）上，后者才是硬约束 —— 取 #5E7079 时
             凹陷底上只有 4.41，会差一点点不达 AA。 */
          mute: '#5A6B75'
        },
        /* ===== 中性层：纸（冷灰白，米色已取消）===== */
        paper: {
          DEFAULT: '#F4F7F8',
          warm: '#FFFFFF',
          sunk: '#E9EEF0'
        },

        /* ===== 主色：青瓷（山）—— 品牌、主按钮、导航激活 ===== */
        dai: { 50: '#EEF7F6', 100: '#D2E9E6', 300: '#6FB5AE', 500: '#287E77', 700: '#1A5F5A', 900: '#0D3B39' },
        /* ===== 专题色 1：海（靛蓝）—— 畲族馆 / 方言曲艺 ===== */
        indigoSea: { 50: '#EDF4FB', 100: '#D2E4F4', 300: '#7BADD5', 500: '#2E6EA7', 700: '#225483', 900: '#133B5E' },
        /* ===== 强调色：朱砂（朱）—— 主 CTA / 角标 / 印章 ===== */
        zhu: { 50: '#FDF0EE', 100: '#FBD9D4', 300: '#EB9486', 500: '#C63A2B', 700: '#9A2A1E', 900: '#641B13' },
        /* ===== 专题色 2：琥珀（茶）—— 历史人物 / 剪纸图样 ===== */
        cha: { 50: '#FCF6E5', 100: '#F6E7BE', 300: '#DBB65F', 500: '#AE7C26', 700: '#875F19', 900: '#553C0E' },
        /* ===== 专题色 3：陶土（滩涂）—— 名胜古迹 / 剪纸图样 ===== */
        tan: { 50: '#FDF3EA', 100: '#F8E2CC', 300: '#E5AF81', 500: '#BC6C36', 700: '#914F22', 900: '#582F14' }
      },
      fontFamily: {
        sans: ['"PingFang SC"', '"Microsoft YaHei"', 'system-ui', 'sans-serif'],
        serif: ['"Songti SC"', '"SimSun"', 'Georgia', 'serif'],
        /* 书法体：仅用于专题题匾，不承担正文 */
        kai: ['"STKaiti"', '"KaiTi"', '"Kaiti SC"', '"楷体"', '"Songti SC"', 'serif']
      },
      boxShadow: {
        /* 阴影一并去掉暖调，改用石板墨的低透明度，避免与冷背景打架 */
        card: '0 1px 2px rgba(15,30,38,.05), 0 8px 24px -12px rgba(15,30,38,.16)',
        lift: '0 2px 8px rgba(15,30,38,.07), 0 20px 44px -20px rgba(15,30,38,.26)',
        seal: 'inset 0 0 0 1px rgba(255,255,255,.18), 0 2px 6px rgba(100,27,19,.3)'
      },
      borderRadius: { xl2: '1.25rem' },
      keyframes: {
        rise: { '0%': { opacity: 0, transform: 'translateY(10px)' }, '100%': { opacity: 1, transform: 'none' } },
        seep: { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        pop: { '0%': { opacity: 0, transform: 'scale(.965)' }, '100%': { opacity: 1, transform: 'none' } },
        spin: { to: { transform: 'rotate(360deg)' } }
      },
      animation: {
        /**
         * 注意 fill-mode 用 backwards 而不是 both。
         * `both` 会让动画结束后仍保留最后一帧的 opacity/transform，
         * Chrome 因此认为该元素持续处于层叠上下文中 —— 页面容器一旦带这个类，
         * 其内部的全屏浮层（查看器/弹窗）就会被限制在容器内，盖不住 sticky 顶栏。
         * backwards 只在开始前套用首帧，结束后回到元素自身样式，层叠上下文随之释放。
         */
        rise: 'rise .45s cubic-bezier(.22,.7,.3,1) backwards',
        seep: 'seep .6s ease backwards',
        pop: 'pop .28s cubic-bezier(.22,.7,.3,1) backwards',
        spin: 'spin .8s linear infinite'
      }
    }
  },
  plugins: []
}
