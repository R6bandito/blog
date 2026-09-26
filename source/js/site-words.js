// 个人卡片：全站字数统计（纯展示文本，不可点击）
(function () {
    function render() {
        var words = window.__siteWords;
        if (!words) { return; }
        // 只找"文章/分类/标签"那个统计区（不含社交图标区的 is-multiline）
        var nav = document.querySelector('.widget[data-type="profile"] nav.level.is-mobile:not(.is-multiline)');
        if (!nav || nav.querySelector('.profile-words')) { return; }   // 幂等
        var text = (words / 10000).toFixed(1) + 'w';
        var item = document.createElement('div');
        item.className = 'level-item has-text-centered is-marginless profile-words';
        // 注意：用 <p> 而非 <a>，不可点击
        item.innerHTML = '<div><p class="heading">字数</p><p class="title">' + text + '</p></div>';
        nav.appendChild(item);
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', render);
    } else {
        render();
    }
    document.addEventListener('pjax:complete', render);
})();
