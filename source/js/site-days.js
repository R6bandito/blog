// 页脚：本站已运行 N 天
// 起算日期由 hexo 注入（window.__siteStart = 第一篇博文日期），前端实时计算
// 天数随真实时间增长，网站不重新部署也会自动更新
(function () {
    function render() {
        var footerP = document.querySelector('.footer .level-start p.is-size-7');
        if (!footerP) { return; }
        if (document.getElementById('site-days')) { return; }   // 已插入
        var startStr = window.__siteStart || '';
        if (!startStr) { return; }
        // 以北京时间的零点为起算（与博文日期的语义一致）
        var start = new Date(startStr + 'T00:00:00+08:00');
        if (isNaN(start.getTime())) { return; }
        var days = Math.floor((Date.now() - start.getTime()) / 86400000);
        if (days < 1) { days = 1; }   // 建站当天显示 1 天
        var span = document.createElement('span');
        span.id = 'site-days';
        span.innerHTML = '本站已运行 <b>' + days + '</b> 天';
        footerP.appendChild(document.createElement('br'));
        footerP.appendChild(span);
    }

    // 首次 + PJAX 换页后都能工作
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', render);
    } else {
        render();
    }
    try {
        var mo = new MutationObserver(function () { render(); });
        mo.observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
})();
