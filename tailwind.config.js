/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        /* ===== 基础层：纸与墨（三源共用，取自闽东知识库底，兼容剪纸宣纸） ===== */
        ink: {
          DEFAULT: '#1d2b2a',
          soft: '#33443f',
          mute: '#5d6f68'
        },
        paper: {
          DEFAULT: '#f7f3ea',
          warm: '#fbf8f1',
          sunk: '#efe8da'
        },

        /* ===== 专题色 1：山（黛青）—— 通用主色 ===== */
        dai: { 50: '#eef4f2', 100: '#d6e5e0', 300: '#8fb3a9', 500: '#3f6257', 700: '#2b463e', 900: '#1a2c26' },
        /* ===== 专题色 2：海（靛蓝）—— 畲族 / 展陈 ===== */
        indigoSea: { 50: '#eef3f8', 100: '#d5e3ef', 300: '#89aecd', 500: '#37648c', 700: '#264a6b', 900: '#17314a' },
        /* ===== 专题色 3：朱（朱砂）—— 剪纸 / 印章 / 强调 ===== */
        zhu: { 50: '#fdefec', 100: '#fadad3', 300: '#e5897a', 500: '#bd4536', 700: '#8f2f24', 900: '#5e1c15' },
        /* ===== 专题色 4：茶金（泥金）—— 剪纸 / 织锦 ===== */
        cha: { 50: '#fbf5e8', 100: '#f4e7c8', 300: '#dcbc74', 500: '#b5893a', 700: '#836021', 900: '#543d12' },
        /* ===== 专题色 5：滩涂暮金 —— 霞浦 / 山海过渡 ===== */
        tan: { 50: '#fdf6ec', 100: '#f6e7d2', 300: '#e3bd8d', 500: '#c98f4d', 700: '#966532', 900: '#4a3218' }
      },
      fontFamily: {
        sans: ['"PingFang SC"', '"Microsoft YaHei"', 'system-ui', 'sans-serif'],
        serif: ['"Songti SC"', '"SimSun"', 'Georgia', 'serif'],
        /* 书法体：仅用于专题题匾，不承担正文 */
        kai: ['"STKaiti"', '"KaiTi"', '"Kaiti SC"', '"楷体"', '"Songti SC"', 'serif']
      },
      boxShadow: {
        card: '0 1px 2px rgba(29,43,42,.04), 0 8px 24px -12px rgba(29,43,42,.18)',
        lift: '0 2px 6px rgba(29,43,42,.06), 0 18px 40px -18px rgba(29,43,42,.28)',
        seal: 'inset 0 0 0 1px rgba(255,255,255,.16), 0 2px 6px rgba(94,28,21,.28)'
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
