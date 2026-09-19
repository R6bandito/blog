// 夜间模式：状态管理 + 导航栏切换按钮 + 背景组联动
// 状态存 localStorage（键 r6blog-theme），默认白天，用户手动切换后记住
// 防闪白：head_begin 内联脚本已在渲染前设置 html.dark-mode
(function () {
    if (window.__themeToggleInit) { return; }
    window.__themeToggleInit = true;

    var KEY = 'r6blog-theme';
    var root = document.documentElement;

    function currentMode() {
        var saved = null;
        try { saved = localStorage.getItem(KEY); } catch (e) {}
        if (saved === 'dark') { return 'dark'; }
        return 'light';   // 默认白天（不跟随系统）
    }
    var transTimer = null;
    var lockedUntil = 0;   // 切换动画期间的锁定时间戳
    function apply(mode, persist, noTrans) {
        // 手动切换时触发全局过渡动画（500ms 后移除；初始化时跳过）
        if (!noTrans) {
            root.classList.add('theme-transition');
            if (transTimer) { clearTimeout(transTimer); }
            transTimer = setTimeout(function () { root.classList.remove('theme-transition'); }, 500);
        }
        if (mode === 'dark') { root.classList.add('dark-mode'); }
        else { root.classList.remove('dark-mode'); }
        if (persist) { try { localStorage.setItem(KEY, mode); } catch (e) {} }
        updateBtn(mode);
        updateThemeColor(mode);
        if (window.__bgSlideshow && window.__bgSlideshow.setMode) {
            window.__bgSlideshow.setMode(mode);
        }
    }
    // 手机浏览器地址栏颜色跟随模式
    function updateThemeColor(mode) {
        var m = document.querySelector('meta[name="theme-color"]');
        if (!m) {
            m = document.createElement('meta');
            m.setAttribute('name', 'theme-color');
            document.head.appendChild(m);
        }
        m.setAttribute('content', mode === 'dark' ? '#14161c' : '#f5f5f5');
    }
    function toggle() {
        // 完全切换完毕之前不响应重复点击（背景交叉淡入约 1.3s）
        if (Date.now() < lockedUntil) { return; }
        lockedUntil = Date.now() + 1350;
        var next = currentMode() === 'dark' ? 'light' : 'dark';
        apply(next, true);
    }

    // ---------- 导航栏按钮 ----------
    function makeBtn() {
        var a = document.createElement('a');
        a.href = 'javascript:;';
        a.className = 'navbar-item';
        a.id = 'theme-toggle';
        a.title = '切换夜间模式';
        a.innerHTML = '<i class="fas fa-moon"></i>';
        a.addEventListener('click', function (e) {
            e.preventDefault();
            toggle();
            a.blur();   // 移除焦点（防止按钮残留高亮）
        });
        return a;
    }
    function updateBtn(mode) {
        var btn = document.getElementById('theme-toggle');
        if (!btn) { return; }
        var icon = btn.querySelector('i');
        if (icon) { icon.className = mode === 'dark' ? 'fas fa-sun' : 'fas fa-moon'; }
        btn.title = mode === 'dark' ? '切换到白天模式' : '切换到夜间模式';
    }
    function ensureBtn() {
        if (document.getElementById('theme-toggle')) { return; }
        var end = document.querySelector('.navbar-end');
        if (!end) { return; }
        var search = end.querySelector('.navbar-item.search');
        var btn = makeBtn();
        if (search) { end.insertBefore(btn, search); }
        else { end.appendChild(btn); }
        updateBtn(currentMode());
    }

    // 初次 + PJAX 换页后补按钮（用观察器跟踪导航栏重建）
    ensureBtn();
    try {
        var mo = new MutationObserver(function () { ensureBtn(); });
        mo.observe(document.body, { childList: true, subtree: true });
    } catch (e) {}

    // 应用初始状态（head 内联脚本已设好 class，这里同步按钮和背景组）
    apply(currentMode(), false, true);
})();
