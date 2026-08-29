// 自研轻量 PJAX：替代 MoOx pjax（其在 301 重定向等场景下静默失效导致整页刷新）
// 用 fetch（自动跟随重定向）获取新页面，只替换主内容区和导航，音乐播放器不受影响
(function () {
    if (window.__pjaxCustomInit) { return; }
    window.__pjaxCustomInit = true;

    // 内容替换后需要重新初始化的组件脚本（幂等重跑）
    var rootScripts = ['/js/main.js', '/js/toc.js', '/js/column.js'];

    document.addEventListener('click', function (e) {
        var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
        if (!a) { return; }
        if (a.target && a.target !== '_self') { return; }
        var href = a.getAttribute('href');
        if (!href || href.charAt(0) === '#') { return; }
        // 仅拦截站内链接
        if (a.hostname !== location.hostname || a.protocol !== location.protocol) { return; }
        e.preventDefault();
        navigate(a.href);
    });

    window.addEventListener('popstate', function () {
        navigate(location.href);
    });

    function navigate(url) {
        fetch(url, { headers: { 'X-PJAX': 'true' } })
            .then(function (r) { return r.text(); })
            .then(function (html) {
                var doc = new DOMParser().parseFromString(html, 'text/html');
                document.title = doc.title;
                // 替换主内容区
                var newCols = doc.querySelector('.columns');
                var oldCols = document.querySelector('.columns');
                if (newCols && oldCols) { oldCols.innerHTML = newCols.innerHTML; }
                // 替换导航菜单（当前选中态）
                var newNs = doc.querySelector('.navbar-start');
                var oldNs = document.querySelector('.navbar-start');
                if (newNs && oldNs) { oldNs.innerHTML = newNs.innerHTML; }
                var newNe = doc.querySelector('.navbar-end');
                var oldNe = document.querySelector('.navbar-end');
                if (newNe && oldNe) { oldNe.innerHTML = newNe.innerHTML; }
                // 更新 URL 并回顶
                history.pushState(null, '', url);
                window.scrollTo(0, 0);
                // 重新初始化内容组件（图片包装、代码块、目录等）
                rootScripts.forEach(function (s) {
                    var el = document.createElement('script');
                    el.src = s;
                    document.body.appendChild(el);
                });
                // 通知其他模块（音乐恢复等）
                document.dispatchEvent(new Event('pjax:complete'));
            })
            .catch(function () {
                window.location = url;   // 请求失败则整页跳转兜底
            });
    }
})();
