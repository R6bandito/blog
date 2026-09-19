// 照片墙：数据渲染（data.json）+ 灯箱放大 + 本地发布
// 发布按钮仅在本地环境（localhost / 127.0.0.1 / file 协议）显示，线上访客看不到也无法发布
(function () {
    if (window.__galleryInit) { return; }
    window.__galleryInit = true;

    var PUBLISH_API = 'http://127.0.0.1:4801/api/publish';

    // 是否本地环境（只有站主本机才显示发布功能）
    function isLocal() {
        var h = location.hostname;
        return h === 'localhost' || h === '127.0.0.1' || h === '' || location.protocol === 'file:';
    }

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
            .replace(/\n/g, '<br>');
    }

    // ---------- 轻提示 ----------
    function toast(msg, ok) {
        var t = document.getElementById('gallery-toast');
        if (!t) {
            t = document.createElement('div');
            t.id = 'gallery-toast';
            document.body.appendChild(t);
        }
        t.textContent = msg;
        t.classList.remove('show', 'ok', 'err');
        t.classList.add('show');
        t.classList.add(ok === false ? 'err' : 'ok');
        clearTimeout(t.__timer);
        t.__timer = setTimeout(function () { t.classList.remove('show'); }, 3400);
    }

    // ---------- 渲染 ----------
    function buildGrid(imgs) {
        var g = document.createElement('div');
        g.className = 'gallery-grid';
        imgs.forEach(function (src) {
            var c = document.createElement('div');
            c.className = 'gallery-cell';
            var im = document.createElement('img');
            im.src = src;
            im.alt = '';
            c.appendChild(im);
            g.appendChild(c);
        });
        return g;
    }

    function renderFeed(data) {
        var feed = document.getElementById('gallery-feed');
        if (!feed) { return; }
        // 先销毁旧灯箱（重新渲染前）
        if (window.jQuery && jQuery.fn && jQuery.fn.lightGallery) {
            try {
                var lg = jQuery(feed).data('lightGallery');
                if (lg && lg.destroy) { lg.destroy(true); }
            } catch (e) {}
        }
        feed.innerHTML = '';
        if (!data || !data.length) {
            feed.innerHTML = '<div class="gallery-empty">还没有内容——点右上角「发布」发第一条吧</div>';
            return;
        }
        data.forEach(function (entry, idx) {
            var imgs = entry.images || [];
            var dateLine = escapeHtml(entry.date || '') + (entry.time ? ' ' + escapeHtml(entry.time) : '');
            if (idx === 0 && imgs.length) {
                // 第一条：大图 + 文字
                var f = document.createElement('div');
                f.className = 'gallery-feature';
                var fi = document.createElement('div');
                fi.className = 'gallery-feature-image';
                var fim = document.createElement('img');
                fim.src = imgs[0];
                fim.alt = '置顶照片';
                fi.appendChild(fim);
                var ft = document.createElement('div');
                ft.className = 'gallery-feature-text';
                ft.innerHTML = '<div class="gallery-date">' + dateLine + '</div>' +
                    (entry.text ? '<div class="gallery-text">' + escapeHtml(entry.text) + '</div>' : '');
                f.appendChild(fi);
                f.appendChild(ft);
                feed.appendChild(f);
                if (imgs.length > 1) { feed.appendChild(buildGrid(imgs.slice(1))); }
            } else {
                // 其他条目：日期 + 文字 + 九宫格
                var card = document.createElement('div');
                card.className = 'gallery-entry';
                card.innerHTML = '<div class="gallery-date">' + dateLine + '</div>' +
                    (entry.text ? '<div class="gallery-text">' + escapeHtml(entry.text) + '</div>' : '');
                if (imgs.length) { card.appendChild(buildGrid(imgs)); }
                feed.appendChild(card);
            }
        });
        initLightbox(feed);
    }

    function initLightbox(feed) {
        if (!window.jQuery || !jQuery.fn || !jQuery.fn.lightGallery) { return; }
        try {
            jQuery(feed).lightGallery({
                selector: '.gallery-cell, .gallery-feature-image',
                download: false,
                share: false,
                zoom: true,
                counter: true
            });
        } catch (e) {}
    }

    // ---------- 加载数据 ----------
    function loadFeed() {
        var feed = document.getElementById('gallery-feed');
        if (!feed) { return Promise.resolve(); }
        return fetch('/gallery/data.json?t=' + Date.now())
            .then(function (r) { return r.json(); })
            .then(function (data) { renderFeed(data); })
            .catch(function () {
                feed.innerHTML = '<div class="gallery-empty">内容加载失败，刷新重试</div>';
            });
    }

    // ---------- 发布 ----------
    function fileToBase64(file) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () {
                var s = String(reader.result);
                resolve(s.indexOf(',') >= 0 ? s.split(',')[1] : s);
            };
            reader.onerror = function () { reject(new Error('读取图片失败')); };
            reader.readAsDataURL(file);
        });
    }

    function initGallery() {
        var page = document.getElementById('gallery-page');
        if (!page) { return; }

        // 发布按钮：非本地隐藏
        var pubBtn = document.getElementById('gallery-publish-btn');
        if (pubBtn && !isLocal()) { pubBtn.style.display = 'none'; }

        // 面板元素
        var panel = document.getElementById('gallery-publish-panel');
        var closeBtn = document.getElementById('gallery-panel-close');
        var fileInput = document.getElementById('gallery-file-input');
        var preview = document.getElementById('gallery-upload-preview');
        var zone = document.getElementById('gallery-upload-zone');
        var submit = document.getElementById('gallery-panel-submit');
        var textInput = document.getElementById('gallery-text-input');
        var picked = [];
        var submitting = false;

        if (pubBtn && panel) {
            pubBtn.addEventListener('click', function () { panel.classList.add('open'); });
        }
        if (closeBtn && panel) {
            closeBtn.addEventListener('click', function () { panel.classList.remove('open'); });
        }
        if (panel) {
            panel.addEventListener('click', function (e) {
                if (e.target === panel) { panel.classList.remove('open'); }
            });
        }

        // 选图预览
        if (fileInput && preview && zone) {
            fileInput.addEventListener('change', function () {
                picked = [];
                preview.innerHTML = '';
                var files = fileInput.files || [];
                for (var i = 0; i < files.length; i++) {
                    (function (file) {
                        var url = URL.createObjectURL(file);
                        picked.push({ name: file.name, url: url, file: file });
                        var d = document.createElement('div');
                        d.className = 'up-item';
                        var im = document.createElement('img');
                        im.src = url;
                        d.appendChild(im);
                        preview.appendChild(d);
                    })(files[i]);
                }
                zone.classList.toggle('has-files', picked.length > 0);
            });
        }

        // 发布
        if (submit) {
            submit.addEventListener('click', function () {
                if (!isLocal()) { return; }
                if (submitting) { return; }
                var text = textInput ? textInput.value.trim() : '';
                if (!picked.length && !text) {
                    toast('先选张图片或写点什么吧', false);
                    return;
                }
                submitting = true;
                submit.disabled = true;
                submit.textContent = '处理中…';

                Promise.all(picked.map(function (p) { return fileToBase64(p.file); }))
                    .then(function (arr) {
                        return fetch(PUBLISH_API, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                text: text,
                                images: arr.map(function (d) { return { data: d }; })
                            })
                        });
                    })
                    .then(function (r) { return r.json(); })
                    .then(function (res) {
                        if (res && res.ok) {
                            panel.classList.remove('open');
                            picked = [];
                            preview.innerHTML = '';
                            zone.classList.remove('has-files');
                            if (fileInput) { fileInput.value = ''; }
                            if (textInput) { textInput.value = ''; }
                            toast('发布成功！已自动压缩 + 加水印' + (res.committed ? ' + git 提交' : ''), true);
                            return loadFeed();
                        }
                        throw new Error((res && res.error) || '发布失败');
                    })
                    .catch(function (e) {
                        var msg = (e && e.message) ? e.message : '';
                        if (!msg || /failed to fetch|networkerror|connection|load failed/i.test(msg)) {
                            toast('连不上发布服务——请先运行 tools/publish-server.js（或双击 tools/publish.bat）', false);
                        } else {
                            toast('发布失败：' + msg, false);
                        }
                    })
                    .then(function () {
                        submitting = false;
                        submit.disabled = false;
                        submit.textContent = '发布';
                    });
            });
        }

        // 加载照片墙内容
        loadFeed();
    }

    // 首次 + PJAX 后都初始化
    function tryInit() {
        var page = document.getElementById('gallery-page');
        if (page && !page.dataset.inited) {
            page.dataset.inited = '1';
            initGallery();
        }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', tryInit);
    } else {
        tryInit();
    }
    try {
        var mo = new MutationObserver(function () { tryInit(); });
        mo.observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
})();
