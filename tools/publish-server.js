// 照片墙 · 本地发布服务
// 只在本机运行：浏览器里点"发布"→ 本服务执行 压缩 + 写文件 + 更新数据 + git 提交
//              浏览器里点"垃圾桶"→ 本服务执行 删数据 + 删图片 + git 提交
// 仅监听 127.0.0.1（外部不可访问）；线上站点没有此服务，访客无法发布或删除
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
const MAX_BODY = 200 * 1024 * 1024;   // 200MB 上限

function log() {
    const t = new Date().toLocaleTimeString('zh-CN');
    console.log('[' + t + '] ' + Array.prototype.join.call(arguments, ' '));
}

function readData() {
    let data = [];
    try { data = JSON.parse(fs.readFileSync(SOURCE_DATA, 'utf8')); } catch (e) {}
    return Array.isArray(data) ? data : [];
}
function writeData(data) {
    const json = JSON.stringify(data, null, 2) + '\n';
    fs.writeFileSync(SOURCE_DATA, json);
    fs.writeFileSync(PUBLIC_DATA, json);
}

// 单张图片处理：原始 base64 → 压缩为 webp（照片墙图片不加水印）
function processImage(base64, outPath) {
    fs.mkdirSync(TMP, { recursive: true });
    const base = path.basename(outPath, '.webp');
    const rawPath = path.join(TMP, '_pub_raw_' + base);
    fs.writeFileSync(rawPath, Buffer.from(base64, 'base64'));

    const r = spawnSync('ffmpeg', ['-y', '-i', rawPath, '-c:v', 'libwebp', '-quality', '80', outPath], { encoding: 'utf8' });
    try { fs.unlinkSync(rawPath); } catch (e) {}
    if (r.status !== 0) {
        throw new Error('图片处理失败: ' + (r.stderr || '').split('\n').filter(l => /rror/.test(l)).slice(0, 1).join(''));
    }
    const pr = spawnSync('ffprobe', ['-v', 'quiet', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', outPath], { encoding: 'utf8' });
    const wh = (pr.stdout || '0,0').trim().split(',').map(Number);
    return { w: wh[0] || 0, h: wh[1] || 0, size: fs.statSync(outPath).size };
}

function gitCommit(msg) {
    try {
        spawnSync('git', ['add', '-A', 'source/gallery'], { cwd: ROOT, encoding: 'utf8' });
        const c = spawnSync('git', ['commit', '-m', msg], { cwd: ROOT, encoding: 'utf8' });
        const out = ((c.stdout || '') + (c.stderr || '')).trim();
        if (c.status === 0) { return { committed: true, msg: '' }; }
        // 没有变更时也算正常
        if (/nothing to commit/i.test(out)) { return { committed: true, msg: '（无变更）' }; }
        return { committed: false, msg: out.split('\n')[0] || '提交失败' };
    } catch (e) { return { committed: false, msg: e.message }; }
}

// ---------- 发布 ----------
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

    const data = readData();
    const entry = {
        id: String(now.getTime()) + '-' + Math.random().toString(36).slice(2, 7),
        date: dateStr,
        time: timeStr,
        text: text,
        images: urls
    };
    data.unshift(entry);
    writeData(data);

    const g = gitCommit('照片墙：发布 ' + (urls.length ? urls.length + ' 张照片' : '一条文字'));
    return { entry: entry, committed: g.committed, commitMsg: g.msg };
}

// ---------- 删除 ----------
function handleDelete(body) {
    const data = readData();
    let idx = -1;

    // 优先按 id 找；老条目没有 id 时按索引 + 日期校验
    if (body.id) {
        idx = data.findIndex(function (e) { return e && e.id === body.id; });
    }
    if (idx < 0 && typeof body.index === 'number' && body.index >= 0 && body.index < data.length) {
        const e = data[body.index];
        if (!body.date || e.date === body.date) { idx = body.index; }
    }
    if (idx < 0) { throw new Error('找不到这条动态（可能已被删除，刷新页面重试）'); }

    const entry = data[idx];
    // 只删除上传目录里的图片；站点公共图（如 /images/xxx）不动
    const removed = [];
    (entry.images || []).forEach(function (u) {
        if (u && u.indexOf('/gallery/uploads/') === 0) {
            const name = path.basename(u);
            [path.join(SOURCE_UPLOAD, name), path.join(PUBLIC_UPLOAD, name)].forEach(function (f) {
                try { if (fs.existsSync(f)) { fs.unlinkSync(f); removed.push(name); } } catch (e) {}
            });
        }
    });
    data.splice(idx, 1);
    writeData(data);

    const g = gitCommit('照片墙：删除一条动态（' + removed.length + ' 张图片）');
    log('已删除动态: ' + (entry.text || '(无文字)').substring(0, 24) + '，清理图片 ' + removed.length + ' 个文件');
    return { deleted: entry, files: removed, committed: g.committed, commitMsg: g.msg };
}

// ---------- 编辑（仅文字） ----------
function handleUpdate(body) {
    const data = readData();
    let idx = -1;
    if (body.id) {
        idx = data.findIndex(function (e) { return e && e.id === body.id; });
    }
    if (idx < 0 && typeof body.index === 'number' && body.index >= 0 && body.index < data.length) {
        const e = data[body.index];
        if (!body.date || e.date === body.date) { idx = body.index; }
    }
    if (idx < 0) { throw new Error('找不到这条动态（可能已被删除，刷新页面重试）'); }

    const entry = data[idx];
    const oldText = entry.text || '';
    entry.text = (body.text || '').trim();
    writeData(data);

    const g = gitCommit('日常：编辑一条动态的文字');
    log('已更新动态文字（' + oldText.length + ' 字 → ' + entry.text.length + ' 字）');
    return { entry: entry, committed: g.committed, commitMsg: g.msg };
}

// ---------- HTTP ----------
const server = http.createServer(function (req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    function send(code, obj) {
        res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(obj));
    }
    function readBody(cb) {
        let size = 0;
        const chunks = [];
        let aborted = false;
        req.on('data', function (c) {
            size += c.length;
            if (size > MAX_BODY) { aborted = true; req.destroy(); return; }
            chunks.push(c);
        });
        req.on('end', function () {
            if (aborted) { return cb(new Error('内容过大（上限 200MB）')); }
            try { cb(null, JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
            catch (e) { cb(new Error('数据解析失败: ' + e.message)); }
        });
    }

    if (req.method === 'GET' && req.url === '/api/ping') {
        return send(200, { ok: true, service: '照片墙本地发布服务' });
    }

    if (req.method === 'POST' && req.url === '/api/publish') {
        return readBody(function (err, body) {
            if (err) { return send(400, { ok: false, error: err.message }); }
            try {
                const r = handlePublish(body);
                log('发布成功: ' + r.entry.images.length + ' 张图' + (r.entry.text ? ' + 文字' : '') + (r.committed ? ' （已 git 提交）' : '（git: ' + r.commitMsg + '）'));
                send(200, { ok: true, entry: r.entry, committed: r.committed, commitMsg: r.commitMsg });
            } catch (e) {
                log('发布失败: ' + e.message);
                send(500, { ok: false, error: e.message });
            }
        });
    }

    if (req.method === 'POST' && req.url === '/api/delete') {
        return readBody(function (err, body) {
            if (err) { return send(400, { ok: false, error: err.message }); }
            try {
                const r = handleDelete(body);
                send(200, { ok: true, files: r.files, committed: r.committed, commitMsg: r.commitMsg });
            } catch (e) {
                log('删除失败: ' + e.message);
                send(500, { ok: false, error: e.message });
            }
        });
    }

    if (req.method === 'POST' && req.url === '/api/update') {
        return readBody(function (err, body) {
            if (err) { return send(400, { ok: false, error: err.message }); }
            try {
                const r = handleUpdate(body);
                send(200, { ok: true, committed: r.committed, commitMsg: r.commitMsg });
            } catch (e) {
                log('编辑失败: ' + e.message);
                send(500, { ok: false, error: e.message });
            }
        });
    }

    send(404, { ok: false, error: '未知接口' });
});

server.listen(PORT, '127.0.0.1', function () {
    log('照片墙本地发布服务已启动: http://127.0.0.1:' + PORT);
    log('支持: 发布（压缩 webp）/ 编辑（改文字）/ 删除（清数据 + 清图片），均自动 git 提交');
    log('（本服务仅本机可访问；关闭此窗口即停止）');
});
server.on('error', function (e) {
    if (e.code === 'EADDRINUSE') {
        log('端口 ' + PORT + ' 已被占用——服务可能已在运行');
    } else {
        log('启动失败: ' + e.message);
    }
});
