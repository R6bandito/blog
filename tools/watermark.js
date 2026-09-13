// 图片批量加水印脚本
// 用法: node tools/watermark.js
// 原理: 扫描 source/_posts 下所有图片，右下角叠加粉色水印（樱花 + 站名）
// 水印模板: E:/blog-image-originals/_watermark-template.png（如需改样式重新生成）
// 原图备份: E:/blog-image-originals/（首次处理自动备份）
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BASE = 'source/_posts';
const WM = 'E:/blog-image-originals/_watermark-template.png';
const BACKUP = 'E:/blog-image-originals';
const RATIO = 281 / 85; // 水印宽高比

if (!fs.existsSync(WM)) {
  console.log('水印模板不存在: ' + WM);
  process.exit(1);
}

// 收集图片
const imgs = [];
(function scan(d) {
  try {
    fs.readdirSync(d, { withFileTypes: true }).forEach(it => {
      const p = d + '/' + it.name;
      if (it.isDirectory()) scan(p);
      else if (/\.(webp|png|jpe?g)$/i.test(it.name)) imgs.push(p);
    });
  } catch (e) {}
})(BASE);

let ok = 0, fail = 0, skipped = [];
imgs.forEach(p => {
  // 备份（不存在才备份，保留原始版本）
  const rel = p.replace(BASE + '/', '');
  const bfile = BACKUP + '/' + rel;
  if (!fs.existsSync(bfile)) {
    const bdir = path.dirname(bfile);
    if (!fs.existsSync(bdir)) fs.mkdirSync(bdir, { recursive: true });
    fs.copyFileSync(p, bfile);
  }
  // 尺寸
  const pr = spawnSync('ffprobe', ['-v', 'quiet', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', p], { encoding: 'utf8' });
  const [w, h] = (pr.stdout || '0,0').trim().split(',').map(Number);
  if (!w || !h) { fail++; return; }
  // 自适应大小：宽 28%，高度不超过图高 40%
  let wmW = Math.round(w * 0.28);
  if (wmW / RATIO > h * 0.4) wmW = Math.round(h * 0.4 * RATIO);
  if (wmW < 100) { skipped.push(rel); return; }
  // 加水印
  const tmp = p + '.tmp.webp';
  const r = spawnSync('ffmpeg', ['-y', '-i', p, '-i', WM,
    '-filter_complex', '[1:v]scale=' + wmW + ':-1[wm];[0][wm]overlay=W-w-6:H-h-2',
    '-c:v', 'libwebp', '-quality', '82', tmp], { encoding: 'utf8' });
  if (r.status === 0 && fs.existsSync(tmp)) {
    fs.unlinkSync(p);
    fs.renameSync(tmp, p);
    ok++;
  } else {
    try { fs.unlinkSync(tmp); } catch (e) {}
    fail++;
    console.log('✗ ' + rel);
  }
});

console.log('完成: 成功 ' + ok + '，失败 ' + fail + (skipped.length ? '，跳过（过小）' + skipped.length : ''));
console.log('原图备份位置: ' + BACKUP);
