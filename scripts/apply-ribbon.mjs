/**
 * apply-ribbon.mjs —— 把 4 条「彩带」条目的配图换成更高清、更贴题的官媒图
 *
 * 起因：这 5 条原有的图源都是 400×267（放大 3.37×），且画面是同一展馆同一人的织带场景，
 * 彼此高度雷同。逐条核验时发现可信源里有分辨率高得多、且分别贴合各条标题的照片。
 *
 * 只换确认为「同一对象 / 同一题材」的四条：
 *   02 纹样特写（福建省政府·指尖技艺数字活化）
 *   03 腰机织造（新宁德·非遗技艺传承）
 *   05 彩带铺展（澎湃·畲族彩带编织技艺丽水地区标准）
 *   06 走向秀场（福建省政府·乡村模特队）
 * 04「传统配色」的候选都是傩面、银饰、人物，与「黑白蓝底 vs 五彩缤纷」不符 —— 保持原图。
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const SHE = path.join(ROOT, 'src', 'data', 'she.json');
const OUTDIR = path.join(ROOT, 'public', 'img', 'she', 'ribbon');
const W = 1200;
const H = 900;
const PAPER = { r: 244, g: 239, b: 228, alpha: 1 };
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const PICKS = [
  {
    id: 'SHE-RIBBON-02',
    url: 'https://www.fujian.gov.cn/zwgk/ztzl/sxzygwzxsgzx/sdjj/wvjj/202512/W020251210299817347251.jpg',
    page: 'https://www.fujian.gov.cn/zwgk/ztzl/sxzygwzxsgzx/sdjj/wvjj/202512/t20251210_7044466.htm',
    credit: '福建省人民政府门户网站《千年指尖技艺的数字活化新生》',
    slug: 'w-ribbon-02'
  },
  {
    id: 'SHE-RIBBON-03',
    url: 'http://img.ndsww.com/a/10001/202210/445d3cfa17ee3aa9e5c36f9585ae9eaf.jpeg',
    page: 'http://cmstop.ndsww.com/p/91044.html',
    credit: '新宁德《在纪录中传承！让畲族非遗技艺不再"隐入尘烟"》',
    slug: 'w-ribbon-03'
  },
  {
    id: 'SHE-RIBBON-05',
    url: 'https://imagepphcloud.thepaper.cn/pph/image/73/490/288.jpg',
    page: 'http://www.thepaper.cn/newsDetail_forward_7923247',
    credit: '澎湃新闻《畲族彩带编织技艺，丽水给出了地区标准》',
    slug: 'w-ribbon-05'
  },
  {
    id: 'SHE-RIBBON-06',
    url: 'https://www.fj.gov.cn/zwgk/ztzl/sxzygwzxsgzx/sdjj/wvjj/202507/W020250704298652589255.jpg',
    page: 'https://www.fj.gov.cn/zwgk/ztzl/sxzygwzxsgzx/sdjj/wvjj/202507/t20250704_6961501.htm',
    credit: '福建省人民政府门户网站《乡村模特队，走出畲家古韵今风》',
    slug: 'w-ribbon-06'
  }
];

const FRAME = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" fill="none" stroke="rgba(43,33,25,0.14)" stroke-width="1"/></svg>`
);

const she = JSON.parse(fs.readFileSync(SHE, 'utf8'));
fs.mkdirSync(OUTDIR, { recursive: true });

for (const p of PICKS) {
  const entry = she.entries.find((e) => e.id === p.id);
  if (!entry) {
    console.log('跳过（无此条目）', p.id);
    continue;
  }
  let buf;
  try {
    const r = await fetch(p.url, {
      headers: { 'User-Agent': UA, Referer: p.page, Accept: 'image/*' },
      signal: AbortSignal.timeout(20000)
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    buf = Buffer.from(await r.arrayBuffer());
  } catch (e) {
    console.log('下载失败', p.id, e.message);
    continue;
  }

  const md = await sharp(buf).metadata();
  if (!md.width || md.width < 600) {
    console.log('分辨率不足，放弃', p.id, md.width);
    continue;
  }

  const out = await sharp(buf)
    .resize(W, H, { fit: 'cover', position: 'centre', kernel: 'lanczos3' })
    .flatten({ background: PAPER })
    .modulate({ saturation: 1.03, brightness: 1.012 })
    .linear(1.02, -2)
    .composite([{ input: FRAME }])
    .jpeg({ quality: 82, progressive: true, mozjpeg: true })
    .toBuffer();

  const rel = `img/she/ribbon/${p.slug}.jpg`;
  fs.writeFileSync(path.join(ROOT, 'public', rel), out);

  entry.media[0] = {
    src: rel,
    full: rel,
    kind: 'photo',
    credit: p.credit,
    creditPage: p.page,
    creditTitle: p.credit,
    source: p.credit,
    alt: entry.title
  };

  console.log(`✓ ${p.id}  ${md.width}×${md.height} → 1200×900  (${Math.round(out.length / 1024)} KB)`);
}

fs.writeFileSync(SHE, JSON.stringify(she, null, 1));
console.log('she.json 已更新');
