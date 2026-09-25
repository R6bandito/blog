// 文章分享条：复制链接 / 微博 / QQ / 微信二维码 / 系统分享
// 仅在文章详情页注入（列表页、归档页自动跳过）；PJAX 切页后自动补挂
(function () {
    if (window.__shareInit) { return; }
    window.__shareInit = true;

    function pageUrl() {
        return location.href.split('#')[0];
    }

    // 复制（clipboard API + execCommand 降级）
    function copyText(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text).catch(function () { return fallbackCopy(text); });
        }
        return Promise.resolve(fallbackCopy(text));
    }
    function fallbackCopy(text) {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;top:-9999px;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (e) {}
        document.body.removeChild(ta);
    }

    function flashOk(btn) {
        var old = btn.innerHTML;
        btn.classList.add('is-ok');
        btn.innerHTML = '<i class="fas fa-check"></i>';
        setTimeout(function () {
            btn.classList.remove('is-ok');
            btn.innerHTML = old;
        }, 1500);
    }

    // 微信二维码弹层
    function showQR(url) {
        var mask = document.createElement('div');
        mask.className = 'share-qr-mask';
        var box = document.createElement('div');
        box.className = 'share-qr-box';
        box.innerHTML =
            '<div class="share-qr-title">微信扫码阅读</div>' +
            '<div class="share-qr-code"></div>' +
            '<div class="share-qr-url">' + url.replace(/^https?:\/\//, '') + '</div>' +
            '<div class="share-qr-hint">用微信「扫一扫」即可打开本文</div>';
        mask.appendChild(box);
        document.body.appendChild(mask);

        var holder = box.querySelector('.share-qr-code');
        try {
            if (window.QRCode) {
                new QRCode(holder, {
                    text: url,
                    width: 168,
                    height: 168,
                    colorDark: '#2b2b33',
                    colorLight: '#ffffff',
                    correctLevel: QRCode.CorrectLevel.M
                });
            } else {
                holder.textContent = '（二维码库未加载，请用「复制链接」）';
                holder.style.fontSize = '12px';
                holder.style.color = '#b39aa6';
            }
        } catch (e) {
            holder.textContent = url;
            holder.style.cssText += 'font-size:11px;word-break:break-all;color:#b39aa6;';
        }

        function close() {
            if (mask.parentNode) { mask.parentNode.removeChild(mask); }
            document.removeEventListener('keydown', onKey);
        }
        function onKey(e) { if (e.key === 'Escape' || e.keyCode === 27) { close(); } }
        mask.addEventListener('click', function (e) { if (e.target === mask) { close(); } });
        document.addEventListener('keydown', onKey);
    }

    // 系统分享（navigator.share）：仅触摸设备显示——桌面浏览器即使 API 存在点了也无效
    function supportsNativeShare() {
        if (!navigator.share) { return false; }
        try {
            if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) { return true; }
        } catch (e) {}
        return (navigator.maxTouchPoints || 0) > 0;
    }

    function buildBar() {
        var article = document.querySelector('article.card-content.article');
        if (!article) { return; }
        if (!article.querySelector('.content')) { return; }           // 非文章页
        if (document.body.classList.contains('is-list-page')) { return; }
        if (article.querySelector('.share-bar')) { return; }          // 幂等

        var titleEl = article.querySelector('h1.title');
        var title = (titleEl ? titleEl.textContent : document.title).trim();
        var url = pageUrl();

        var bar = document.createElement('div');
        bar.className = 'share-bar';
        bar.innerHTML =
            '<span class="share-label"><i class="fas fa-share-alt"></i>分享</span>' +
            '<button type="button" class="share-btn share-copy" title="复制链接"><i class="fas fa-link"></i></button>' +
            '<a class="share-btn share-weibo" title="分享到微博" target="_blank" rel="noopener nofollow"><i class="fab fa-weibo"></i></a>' +
            '<a class="share-btn share-qq" title="分享到 QQ" target="_blank" rel="noopener nofollow"><i class="fab fa-qq"></i></a>' +
            '<button type="button" class="share-btn share-wechat" title="微信扫码"><i class="fab fa-weixin"></i></button>' +
            (supportsNativeShare() ? '<button type="button" class="share-btn share-native" title="更多"><i class="fas fa-ellipsis-h"></i></button>' : '');

        // 平台链接
        var wb = bar.querySelector('.share-weibo');
        wb.href = 'https://service.weibo.com/share/share.php?url=' + encodeURIComponent(url) + '&title=' + encodeURIComponent(title);
        var qq = bar.querySelector('.share-qq');
        qq.href = 'https://connect.qq.com/widget/shareqq/index.html?url=' + encodeURIComponent(url) + '&title=' + encodeURIComponent(title);

        // 插入到标签之后（标签不存在则追加到文章末尾）
        var tags = article.querySelector('.article-tags');
        if (tags && tags.parentNode === article) {
            article.insertBefore(bar, tags.nextSibling);
        } else {
            article.appendChild(bar);
        }

        // 事件
        bar.querySelector('.share-copy').addEventListener('click', function () {
            var btn = this;
            copyText(url).then(function () { flashOk(btn); });
        });
        bar.querySelector('.share-wechat').addEventListener('click', function () {
            showQR(url);
        });
        var native = bar.querySelector('.share-native');
        if (native) {
            native.addEventListener('click', function () {
                var btn = this;
                try {
                    navigator.share({ title: title, url: url }).catch(function () {
                        // 系统分享不可用/被取消：降级为复制链接
                        copyText(url).then(function () { flashOk(btn); });
                    });
                } catch (e) {
                    copyText(url).then(function () { flashOk(btn); });
                }
            });
        }
    }

    function tryInit() { buildBar(); }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', tryInit);
    } else {
        tryInit();
    }
    document.addEventListener('pjax:complete', tryInit);
    try {
        var mo = new MutationObserver(function () { tryInit(); });
        mo.observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
})();
