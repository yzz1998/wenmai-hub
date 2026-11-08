/**
 * lib/photo-fetch.mjs —— 实景照片抓取引擎（第 N 轮通用）
 *
 * 把「Bing 图片检索 → 域名/词表过滤 → 可信源打分 → 下载 + 探测尺寸 → 写回候选池」
 * 这套流程抽出来，各轮只提供自己的 FIX 配置，避免每轮复制 300 行。
 *
 * 用法（在轮次脚本里）：
 *   import { runFetch, NOT_OTHER_PROVINCE, PHOTO_WORDS } from './lib/photo-fetch.mjs';
 *   await runFetch({ fix: FIX, round: 6, rawDir: 'raw6' });
 *
 * 参数：
 *   fix      { [id]: { q, not?, want? } }  本轮要重抓的条目
 *   round    轮次号（写入候选池，便于追溯）
 *   rawDir   .photo-staging 下的子目录名（每轮独立，便于回滚）
 *   block   额外的封禁域名片段
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..', '..');
const STAGE = path.join(ROOT, '.img-staging');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/** 外省 / 同名异地事物 —— 命中重罚且不下载 */
export const NOT_OTHER_PROVINCE = [
  '江西', '浙江', '广东', '广西', '贵州', '云南', '湖南', '湖北',
  '安徽', '四川', '海南', '重庆', '江苏', '河南', '山东', '陕西', '甘肃',
  '泰顺', '景宁', '丽水', '温州', '罗源', '苏州', '黄埭'
];

/** 命中了直接丢弃，连下载都不下载 */
export const HARD_REJECT = [
  '合影', '留念', '合照', '签到', '揭牌', '启动仪式', '开幕式',
  '攻略', '游记', '路线', '门票', '自驾', '住宿', '美食推荐', '一日游',
  '招聘', '公告', '通知', '名单', '公示', '会议', '座谈', '视察', '调研',
  '素材', '模板', '矢量', '插画', '手绘', '简笔画', '动漫', '漫画',
  '头像', '壁纸', '名片', '广告', '海报设计', 'PPT',
  '商城', '旗舰店', '优惠', '促销',
  // 课程条目第二轮补漏：方案文本 / 3D 模型 / 商品图 —— 这三类是概念检索的重灾区
  '图库', '素材下载', '模型下载', '3D模型', '三维模型', '数字孪生', '场景模型',
  '解决方案', '方案文本', '规划方案', '效果图', '渲染图', '设计图集',
  '商品图', '正版', '包邮', '优品', '京东', '苏宁', '当当', '购买链接'
];

/** 命中才加分：把「照片本体」而非「活动报道」挑出来 */
export const PHOTO_WORDS = ['风光', '风景', '实景', '航拍', '全景', '景色', '美景', '摄影', '高清', '大图'];

/** 图库 / 付费素材 / 商城 / 文档站 / UGC 平台 —— 图源没法交代 */
export const DEFAULT_BLOCK = [
  '699pic.com', 'nximg.cn', 'veer.com', 'tuchong.com', 'zcool.com.cn', '58pic.com',
  'pngtree', 'shutterstock', 'gettyimages', 'dreamstime', '123rf', 'istockphoto',
  'adobe.com', 'huaban.com', 'duitang.com', 'nipic.com', 'ooopic.com',
  'bigstockphoto', 'depositphotos', 'alamy',
  'mall', 'shop', 'audit', 'sinauditgam', 'jsxlh', 'taobao', 'tmall', 'jd.com',
  '1688', 'alibaba', 'made-in-china', 'zhaopin', 'liepin', 'docin', 'doc88',
  'book118', 'wenku', 'xueshu', 'taodocs',
  'qunar', 'mafengwo', 'ctrip', 'tuniu', 'ly.com', 'meituan', 'dianping',
  'xiaohongshu', 'xhslink', 'sohu.com', 'baijiahao', 'toutiao', '360doc',
  'zhihu', 'jianshu', 'douban', 'weibo.com', 'bilibili',
  'huitu.com', 'zol.com.cn', 'baike.so.com', 'jingyan.baidu.com', 'dashangu.com',
  // 第七轮补漏：百科/UGC 摄影社区 —— 图源仍不可交代
  'baike.baidu.com', 'pconline.com.cn', 'atimebook.com', 'ndnu.edu.cn'
];

export const TRUST_HOSTS = [
  { re: /\.gov\.cn$/, w: 34, name: '政府网站' },
  { re: /news\.cn$/, w: 32, name: '新华网' },
  { re: /xinhuanet\.com$/, w: 32, name: '新华网' },
  { re: /people\.com\.cn$/, w: 30, name: '人民网' },
  { re: /fjdaily\.com$/, w: 30, name: '福建日报' },
  { re: /ndsww\.com$/, w: 30, name: '宁德网' },
  { re: /ndwww\.cn$/, w: 30, name: '宁德网' },
  { re: /fjsen\.com$/, w: 28, name: '东南网' },
  { re: /fj\.gov\.cn$/, w: 32, name: '福建省人民政府' },
  { re: /cctv\.com$/, w: 26, name: '央视' },
  { re: /thepaper\.cn$/, w: 24, name: '澎湃新闻' },
  { re: /cnr\.cn$/, w: 24, name: '央广网' },
  { re: /gmw\.cn$/, w: 24, name: '光明网' },
  { re: /china\.com\.cn$/, w: 24, name: '中国网' },
  { re: /chinanews\.com\.cn$/, w: 24, name: '中新网' },
  { re: /ihchina\.cn$/, w: 30, name: '中国非物质文化遗产网' },
  { re: /wenming\.cn$/, w: 26, name: '中国文明网' }
];

export const hostOf = (u) => {
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; }
};

export function probeSize(buf) {
  if (buf.length < 24) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), fmt: 'png' };
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return { w: buf.readUInt16LE(6), h: buf.readUInt16LE(8), fmt: 'gif' };
  if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') {
    const f = buf.slice(12, 16).toString('ascii');
    if (f === 'VP8X') return { w: 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16)), h: 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16)), fmt: 'webp' };
    if (f === 'VP8 ') return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff, fmt: 'webp' };
    if (f === 'VP8L') { const b = buf.readUInt32LE(21); return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1, fmt: 'webp' }; }
    return { w: 0, h: 0, fmt: 'webp' };
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let off = 2;
    while (off < buf.length - 9) {
      if (buf[off] !== 0xff) { off++; continue; }
      const mk = buf[off + 1];
      const len = buf.readUInt16BE(off + 2);
      if (mk >= 0xc0 && mk <= 0xcf && mk !== 0xc4 && mk !== 0xc8 && mk !== 0xcc) {
        return { h: buf.readUInt16BE(off + 5), w: buf.readUInt16BE(off + 7), fmt: 'jpg' };
      }
      off += 2 + len;
    }
    return { w: 0, h: 0, fmt: 'jpg' };
  }
  return null;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Bing 图片检索。
 *
 * **必须带重试**：连续请求十几条后 Bing 会返回 `fetch failed`（瞬时限流，等几秒即恢复）。
 * 第一轮 30 条就是没重试，后 25 条全灭。
 */
export async function bingSearch(q, count = 45, tries = 3) {
  const url = `https://cn.bing.com/images/async?q=${encodeURIComponent(q)}&first=1&count=${count}&mmasync=1`;
  let lastErr;
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9' },
        signal: AbortSignal.timeout(25000)
      });
      if (!r.ok) throw new Error(`bing ${r.status}`);
      const html = await r.text();
      const out = [];
      const re = /m="([^"]+)"/g;
      let m;
      while ((m = re.exec(html))) {
        const raw = m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'");
        try { const o = JSON.parse(raw); if (o.murl) out.push({ murl: o.murl, purl: o.purl || '', t: o.t || '' }); } catch { /* skip */ }
      }
      if (out.length) return out;
      throw new Error('empty result');
    } catch (e) {
      lastErr = e;
      await wait(2200 + attempt * 3200);
    }
  }
  throw lastErr;
}

/**
 * 360 图片检索 —— Bing 挂掉时的备用源。
 * 返回结构与 bingSearch 对齐（murl / purl / t）。
 * 注意：360 结果里图库与简笔画占比更高，`purl` 也常直接是图片直链而非来源页，
 * 所以只作为兜底，且信任源打分基本不生效（hostname 是 qhimg 之类）。
 */
export async function search360(q, count = 35) {
  const url = `https://image.so.com/j?q=${encodeURIComponent(q)}&pn=0&rn=${count}`;
  const r = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9', Referer: 'https://image.so.com/' },
    signal: AbortSignal.timeout(20000)
  });
  if (!r.ok) throw new Error(`360 ${r.status}`);
  const j = await r.json();
  return (j.list || [])
    .filter((o) => o.img || o.thumb)
    .map((o) => ({
      murl: o.img || o.thumb,
      purl: o.comm_purl || o.site || o.link || '',
      t: o.title || '',
      w: Number(o.width) || 0,
      h: Number(o.height) || 0
    }));
}

/** 双源检索：先 Bing，拿到 ≥3 条就收工，否则用 360 补齐 */
export async function searchAny(q, count = 45) {
  const out = [];
  try {
    out.push(...(await bingSearch(q, count)));
  } catch (e) {
    console.log(`     bing 失败（${e.message}），转备用源`);
  }
  if (out.length < 3) {
    try {
      const alt = await search360(q);
      const seen = new Set(out.map((x) => x.murl));
      for (const a of alt) if (!seen.has(a.murl)) out.push(a);
      if (alt.length) console.log(`     备用源补 ${alt.length} 条`);
    } catch (e) {
      console.log(`     备用源也失败：${e.message}`);
    }
  }
  return out;
}

async function tryDownload(u, referer) {
  const headers = {
    'User-Agent': UA,
    Accept: 'image/avif,image/webp,image/jpeg,image/png,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9'
  };
  if (referer) headers.Referer = referer;
  const r = await fetch(u, { headers, redirect: 'follow', signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`http ${r.status}`);
  const ct = r.headers.get('content-type') || '';
  if (!ct.startsWith('image/')) throw new Error(`not-image: ${ct}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 30 * 1024) throw new Error(`too-small: ${buf.length}`);
  if (buf.length > 12 * 1024 * 1024) throw new Error(`too-large: ${buf.length}`);
  return buf;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 执行一轮抓取
 * @returns {Promise<Array<[id, status, oldCount]>>} 汇总
 */
export async function runFetch({ fix, round, rawDir, block = [], minW = 900, minH = 600, maxPicks = 8, only = null }) {
  const RAW = path.join(STAGE, rawDir);
  fs.mkdirSync(RAW, { recursive: true });
  const candPath = path.join(STAGE, 'candidates.json');
  const all = JSON.parse(fs.readFileSync(candPath, 'utf8'));
  const BLOCK = [...DEFAULT_BLOCK, ...block];

  const isBlocked = (u) => {
    const h = (hostOf(u) + ' ' + u).toLowerCase();
    return BLOCK.some((b) => h.includes(b.toLowerCase()));
  };
  const trustOf = (purl) => {
    const h = hostOf(purl);
    for (const t of TRUST_HOSTS) if (t.re.test(h)) return t;
    return null;
  };

  const summary = [];

  for (const [id, cfg] of Object.entries(fix)) {
    if (only && !only.includes(id)) continue;
    console.log(`\n[${id}] ${cfg.q}`);

    const prev = all[id] ? all[id].picks : [];
    let cands = [];
    try {
      cands = await searchAny(cfg.q);
    } catch (e) {
      console.log(`  x 检索失败：${e.message}`);
      summary.push([id, '检索失败', prev.length]);
      continue;
    }

    const clean = cands.filter((c) => {
      if (isBlocked(c.murl) || isBlocked(c.purl)) return false;
      const hay = `${c.t} ${c.purl} ${c.murl}`;
      return !HARD_REJECT.some((w) => hay.includes(w));
    });

    const scored = clean.map((c) => {
      const t = trustOf(c.purl);
      let s = t ? t.w : 0;
      const hay = `${c.t} ${c.purl} ${c.murl}`;
      let banned = 0;
      for (const n of cfg.not || []) if (hay.includes(n)) banned += 45;
      for (const k of cfg.q.split(/\s+/).filter((k) => k.length >= 2)) if (hay.includes(k)) s += 5;
      for (const w of cfg.want || []) if (hay.includes(w)) s += 7;
      for (const w of PHOTO_WORDS) if (hay.includes(w)) s += 4;
      return { ...c, score: s - banned, banned, trust: t ? t.name : hostOf(c.purl) };
    }).sort((a, b) => b.score - a.score);

    const picks = [];
    for (const c of scored) {
      if (picks.length >= maxPicks) break;
      if (c.banned >= 45) continue;
      try {
        const buf = await tryDownload(c.murl, c.purl);
        const dim = probeSize(buf);
        if (!dim || !dim.w || !dim.h) continue;
        if (dim.w < minW || dim.h < minH) continue;
        const ratio = dim.w / dim.h;
        if (ratio < 0.62 || ratio > 2.0) continue;
        const sizeBonus = Math.min(14, Math.round((dim.w * dim.h) / 400000));
        const ext = dim.fmt === 'png' ? 'png' : dim.fmt === 'webp' ? 'webp' : 'jpg';
        const file = path.join(RAW, `${id}__${picks.length}.${ext}`);
        fs.writeFileSync(file, buf);
        picks.push({
          idx: picks.length,
          file: path.relative(ROOT, file).replace(/\\/g, '/'),
          w: dim.w, h: dim.h, bytes: buf.length, fmt: dim.fmt,
          murl: c.murl, purl: c.purl, title: c.t, trust: c.trust,
          score: c.score + sizeBonus
        });
        console.log(`  + [${picks.length - 1}] ${dim.w}x${dim.h} ${(buf.length / 1024).toFixed(0)}KB  ${c.trust}  ${c.t.slice(0, 44)}`);
      } catch { /* 单张失败跳过 */ }
      await sleep(220);
    }
    picks.sort((a, b) => b.score - a.score);
    picks.forEach((p, i) => { p.idx = i; });

    if (!picks.length) {
      console.log('  ! 本轮无合格候选，保留上一轮');
      summary.push([id, '无新候选', prev.length]);
    } else {
      all[id] = { query: cfg.q, searchHits: cands.length, afterFilter: clean.length, picks, prevPicks: prev, round };
      summary.push([id, `新候选 ${picks.length} 张`, prev.length]);
    }
    await sleep(1100);
  }

  fs.writeFileSync(candPath, JSON.stringify(all, null, 2), 'utf8');
  console.log(`\n===== 第 ${round} 轮汇总 =====`);
  for (const [id, st, n] of summary) console.log(`  ${id.padEnd(14)} ${st}  (旧候选 ${n})`);
  return summary;
}
