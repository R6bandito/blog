// 照片墙 · 本地发布服务
// 只在本机运行：浏览器里点"发布" → 本服务执行 压缩 + 水印 + 写文件 + 更新数据 + git 提交
// 仅监听 127.0.0.1（外部不可访问）；线上站点没有此服务，访客无法发布
//
// 启动：node tools/publish-server.js   （或双击 tools/publish.bat）
// 端口：4801
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PORT = 4801;
const ROOT = path.resolve(__dirname, '..');
const SOURCE_UPLOAD = path.join(ROOT, 'source', 'gallery', 'uploads');
const PUBLIC_UPLOAD = path.join(ROOT, 'public', 'gallery', 'uploads');
const SOURCE_DATA = path.join(ROOT, 'source', 'gallery', 'data.json');
const PUBLIC_DATA = path.join(ROOT, 'public', 'gallery', 'data.json');
const TMP = path.join(ROOT, '_watermark-tmp');
const WM = 'E:/blog-image-originals/_watermark-template.png';
const RATIO = 281 / 85;
const MAX_BODY = 200 * 1024 * 1024;   // 200MB 上限

function log() {
    const t = new Date().toLocaleTimeString('zh-CN');
    console.log('[' + t + '] ' + Array.prototype.join.call(arguments, ' '));
}

// 单张图片处理：原始 base64 → 压缩 webp + 水印 → 输出到目标路径
function processImage(base64, outPath) {
    if (!fs.existsSync(WM)) { throw new Error('水印模板缺失: ' + WM); }
    fs.mkdirSync(TMP, { recursive: true });
    const base = path.basename(outPath, '.webp');
    const rawPath = path.join(TMP, '_pub_raw_' + base);
    const plainPath = path.join(TMP, '_pub_plain_' + base + '.webp');
    fs.writeFileSync(rawPath, Buffer.from(base64, 'base64'));

    // 1. 压缩为 webp
    let r = spawnSync('ffmpeg', ['-y', '-i', rawPath, '-c:v', 'libwebp', '-quality', '80', plainPath], { encoding: 'utf8' });
    if (r.status !== 0) {
        try { fs.unlinkSync(rawPath); } catch (e) {}
        throw new Error('压缩失败: ' + (r.stderr || '').split('\n').filter(l => /rror/.test(l)).slice(0, 1).join(''));
    }

    // 2. 自适应水印
    const pr = spawnSync('ffprobe', ['-v', 'quiet', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', plainPath], { encoding: 'utf8' });
    const wh = (pr.stdout || '0,0').trim().split(',').map(Number);
    const w = wh[0], h = wh[1];
    let wmW = Math.round(w * 0.28);
    if (wmW / RATIO > h * 0.4) { wmW = Math.round(h * 0.4 * RATIO); }
    r = spawnSync('ffmpeg', ['-y', '-i', plainPath, '-i', WM,
        '-filter_complex', '[1:v]scale=' + wmW + ':-1[wm];[0][wm]overlay=W-w-6:H-h-2',
        '-c:v', 'libwebp', '-quality', '82', outPath], { encoding: 'utf8' });

    try { fs.unlinkSync(rawPath); } catch (e) {}
    try { fs.unlinkSync(plainPath); } catch (e) {}
    if (r.status !== 0) { throw new Error('加水印失败: ' + (r.stderr || '').split('\n').filter(l => /rror/.test(l)).slice(0, 1).join('')); }
    return { w: w, h: h, size: fs.statSync(outPath).size };
}

// 处理一整个发布请求
function handlePublish(body) {
    const text = (body.text || '').trim();
    const images = body.images || [];
    if (!text && !images.length) { throw new Error('发布内容为空（图片和文字至少要有一样）'); }

    const now = new Date();
    const stamp = '' + now.getFullYear() +
        String(now.getMonth() + 1).padStart(2, '0') +
        String(now.getDate()).padStart(2, '0') + '-' +
        String(now.getTime()).slice(-6);
    const dateStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    const timeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

    fs.mkdirSync(SOURCE_UPLOAD, { recursive: true });
    fs.mkdirSync(PUBLIC_UPLOAD, { recursive: true });

    const urls = [];
    images.forEach(function (img, i) {
        const name = stamp + '_' + (i + 1) + '.webp';
        const outPath = path.join(SOURCE_UPLOAD, name);
        const info = processImage(img.data, outPath);
        // 同步一份到 public：页面立即能看到（不必等 hexo 重新生成）
        fs.copyFileSync(outPath, path.join(PUBLIC_UPLOAD, name));
        urls.push('/gallery/uploads/' + name);
        log('图片 ' + (i + 1) + '/' + images.length + ' 完成: ' + name + ' (' + info.w + '×' + info.h + ', ' + (info.size / 1024).toFixed(0) + 'KB)');
    });

    // 更新数据（新条目放最前）
    let data = [];
    try { data = JSON.parse(fs.readFileSync(SOURCE_DATA, 'utf8')); } catch (e) {}
    if (!Array.isArray(data)) { data = []; }
    const entry = { date: dateStr, time: timeStr, text: text, images: urls };
    data.unshift(entry);
    const json = JSON.stringify(data, null, 2);
    fs.writeFileSync(SOURCE_DATA, json);
    fs.writeFileSync(PUBLIC_DATA, json);

    // git 提交（不 push，由你自己决定何时推送）
    let committed = false, commitMsg = '';
    try {
        spawnSync('git', ['add', 'source/gallery'], { cwd: ROOT, encoding: 'utf8' });
        const c = spawnSync('git', ['commit', '-m', '照片墙：发布 ' + urls.length + ' 张照片'], { cwd: ROOT, encoding: 'utf8' });
        committed = c.status === 0;
        if (!committed) { commitMsg = ((c.stdout || '') + (c.stderr || '')).trim().split('\n')[0] || '提交失败'; }
    } catch (e) { commitMsg = e.message; }

    return { entry: entry, committed: committed, commitMsg: commitMsg };
}

const server = http.createServer(function (req, res) {
    // CORS（本地服务，允许博客页面调用）
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    function send(code, obj) {
        res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(obj));
    }

    if (req.method === 'GET' && req.url === '/api/ping') {
        return send(200, { ok: true, service: '照片墙本地发布服务', note: '浏览器里的"发布"按钮会自动连接本服务' });
    }

    if (req.method === 'POST' && req.url === '/api/publish') {
        let size = 0;
        const chunks = [];
        let aborted = false;
        req.on('data', function (c) {
            size += c.length;
            if (size > MAX_BODY) { aborted = true; req.destroy(); return; }
            chunks.push(c);
        });
        req.on('end', function () {
            if (aborted) { return send(413, { ok: false, error: '内容过大（上限 200MB）' }); }
            let body;
            try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
            catch (e) { return send(400, { ok: false, error: '数据解析失败: ' + e.message }); }
            try {
                const result = handlePublish(body);
                log('发布成功: ' + result.entry.images.length + ' 张图' + (result.entry.text ? ' + 文字' : '') + (result.committed ? ' （已 git 提交）' : ' （git 未提交: ' + result.commitMsg + '）'));
                send(200, { ok: true, entry: result.entry, committed: result.committed, commitMsg: result.commitMsg });
            } catch (e) {
                log('发布失败: ' + e.message);
                send(500, { ok: false, error: e.message });
            }
        });
        return;
    }

    send(404, { ok: false, error: '未知接口' });
});

server.listen(PORT, '127.0.0.1', function () {
    log('照片墙本地发布服务已启动: http://127.0.0.1:' + PORT);
    log('用法: 打开博客照片墙页面，点"发布"→ 选图写字 → 发布（自动压缩+水印+更新+git 提交）');
    log('（本服务仅本机可访问；关闭此窗口即停止）');
});
server.on('error', function (e) {
    if (e.code === 'EADDRINUSE') {
        log('端口 ' + PORT + ' 已被占用——服务可能已在运行');
    } else {
        log('启动失败: ' + e.message);
    }
});
