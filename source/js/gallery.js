// 照片墙：数据渲染（data.json）+ 灯箱放大 + 本地发布/删除
// 发布、删除仅在本地环境（localhost / 127.0.0.1 / file 协议）可用，线上访客看不到也无法调用
(function () {
    if (window.__galleryInit) { return; }
    window.__galleryInit = true;

    var PUBLISH_API = 'http://127.0.0.1:4801/api/publish';
    var DELETE_API = 'http://127.0.0.1:4801/api/delete';

    // 是否本地环境（只有站主本机才有发布/删除功能）
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

    function netErrorMessage(e) {
        var msg = (e && e.message) ? e.message : '';
        if (!msg || /failed to fetch|networkerror|connection|load failed/i.test(msg)) {
            return '连不上发布服务——请先运行 tools/publish-server.js（或双击 tools/publish.bat）';
        }
        return msg;
    }

    // 删除按钮（仅本地渲染进 DOM）
    function delHtml(entry, idx) {
        if (!isLocal()) { return ''; }
        return '<button class="gallery-del" type="button" title="删除这条动态"' +
            ' data-id="' + escapeHtml(entry.id || '') + '"' +
            ' data-index="' + idx + '"' +
            ' data-date="' + escapeHtml(entry.date || '') + '">' +
            '<i class="fas fa-trash-alt"></i></button>';
    }

    function dateRowHtml(entry, idx) {
        var dateLine = escapeHtml(entry.date || '') + (entry.time ? ' ' + escapeHtml(entry.time) : '');
        return '<div class="gallery-date-row"><span class="gallery-date">' + dateLine + '</span>' + delHtml(entry, idx) + '</div>';
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
                ft.innerHTML = dateRowHtml(entry, idx) +
                    (entry.text ? '<div class="gallery-text">' + escapeHtml(entry.text) + '</div>' : '');
                f.appendChild(fi);
                f.appendChild(ft);
                feed.appendChild(f);
                if (imgs.length > 1) { feed.appendChild(buildGrid(imgs.slice(1))); }
            } else {
                // 其他条目：日期 + 文字 + 九宫格
                var card = document.createElement('div');
                card.className = 'gallery-entry';
                card.innerHTML = dateRowHtml(entry, idx) +
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

    // ---------- 删除 ----------
    function deleteEntry(btn) {
        if (!isLocal()) { return; }
        var id = btn.getAttribute('data-id') || '';
        var index = parseInt(btn.getAttribute('data-index'), 10);
        var date = btn.getAttribute('data-date') || '';
        if (!window.confirm('删除这条动态？\n\n上传的图片会一并删除，并自动提交 git（推送前仍可找回）。')) {
            return;
        }
        btn.disabled = true;
        fetch(DELETE_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: id, index: isNaN(index) ? undefined : index, date: date })
        })
            .then(function (r) { return r.json(); })
            .then(function (res) {
                if (res && res.ok) {
                    toast('已删除' + (res.files && res.files.length ? '（清理 ' + res.files.length + ' 张图片）' : ''), true);
                    return loadFeed();
                }
                throw new Error((res && res.error) || '删除失败');
            })
            .catch(function (e) {
                btn.disabled = false;
                toast('删除失败：' + netErrorMessage(e), false);
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

        // 删除按钮：事件委托（内容动态渲染，委托一次即可，PJAX 换元素后重绑）
        var feed = document.getElementById('gallery-feed');
        if (feed && !feed.dataset.delBound) {
            feed.dataset.delBound = '1';
            feed.addEventListener('click', function (e) {
                var btn = e.target && e.target.closest ? e.target.closest('.gallery-del') : null;
                if (btn) {
                    e.preventDefault();
                    e.stopPropagation();
                    deleteEntry(btn);
                }
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
                            toast('发布成功！' + (res.committed ? ' 已自动提交 git' : ''), true);
                            return loadFeed();
                        }
                        throw new Error((res && res.error) || '发布失败');
                    })
                    .catch(function (e) {
                        toast('发布失败：' + netErrorMessage(e), false);
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
