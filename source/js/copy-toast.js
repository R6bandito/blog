// 代码复制成功提示（toast）
// 监听代码块的复制按钮点击，弹出"✓ 已复制"粉色提示
(function () {
    if (window.__copyToastInit) { return; }
    window.__copyToastInit = true;
    var toast = null;
    function ensure() {
        // PJAX 切换后 toast 可能被移除，需要时重建
        if (!toast || !document.body.contains(toast)) {
            toast = document.createElement('div');
            toast.className = 'copy-toast';
            toast.textContent = '✓ 已复制';
            document.body.appendChild(toast);
        }
        return toast;
    }
    var timer = null;
    document.addEventListener('click', function (e) {
        var btn = e.target && e.target.closest ? e.target.closest('.highlight .copy') : null;
        if (!btn) { return; }
        // 记录按钮位置（等 ClipboardJS 执行完成后显示在按钮下方）
        var rect = btn.getBoundingClientRect();
        // 复制瞬间：让本代码块的选区不可见（避免全选高亮闪现）
        var block = btn.closest('figure.highlight');
        if (block) { block.classList.add('copying'); }
        setTimeout(function () {
            var t = ensure();
            // 复制已完成：立即取消文本选中（去掉全选高亮）
            if (window.getSelection) {
                var sel = window.getSelection();
                if (sel && sel.removeAllRanges) { sel.removeAllRanges(); }
            }
            // 按钮正下方、水平居中于按钮；左/上边界保护
            var half = t.offsetWidth / 2 || 50;
            var cx = Math.min(Math.max(rect.left + rect.width / 2, half + 8), window.innerWidth - half - 8);
            t.style.left = cx + 'px';
            t.style.top = (rect.bottom + 8) + 'px';
            t.classList.add('show');
            if (timer) { clearTimeout(timer); }
            timer = setTimeout(function () { t.classList.remove('show'); }, 1600);
            // 复制完成：恢复选区渲染
            if (block) {
                setTimeout(function () { block.classList.remove('copying'); }, 120);
            }
        }, 80);
    }, true);
})();
