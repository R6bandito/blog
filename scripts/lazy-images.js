// 图片懒加载：自动给渲染后的 <img> 补 loading="lazy" 与 decoding="async"
// 规则：已有 loading 属性的不加；带 data-no-lazy 标记的不加（留给需要立刻加载的图）
hexo.extend.filter.register('after_render:html', function (str) {
    return str.replace(
        /<img\b(?![^>]*\bloading=)(?![^>]*\bdata-no-lazy)([^>]*?)(\/?)>/gi,
        '<img loading="lazy" decoding="async"$1$2>'
    );
});
