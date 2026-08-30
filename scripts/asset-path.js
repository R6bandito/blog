// 文章内资源图片路径重写
// 背景：md 里用相对路径写图片（如 文章名/图片.webp），Typora 可预览；
// hexo 渲染后 markdown 语法会转成根相对并 URL 编码（如 /%E5%B5%8C.../图片.webp），
// Typora 调整大小生成的 HTML 标签则是未编码路径（src="文章名/图片.webp"）
// 本脚本把这两类路径统一重写为文章目录下的真实资源路径
hexo.extend.filter.register('after_post_render', function (data) {
    if (!data.content || !data.path) { return data; }
    const layout = data.layout || 'post';
    if (layout !== 'post') { return data; }

    // 文章 URL 目录（如 /2026/08/30/嵌入式20260830/）
    const base = '/' + data.path.replace(/\/[^/]*$/, '/');
    const slug = data.slug;

    if (slug) {
        const esc = function (s) {
            return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        };
        // 同时匹配未编码和 URL 编码的 slug（兼容 markdown 与 Typora HTML 两种写法）
        const pat = '(' + esc(slug) + '|' + esc(encodeURI(slug)) + ')';
        // src="/<slug>/xxx" 或 src="<slug>/xxx" → src="/文章目录/xxx"
        data.content = data.content.replace(
            new RegExp('(<img[^>]+src=")(?:/)?' + pat + '/', 'g'),
            '$1' + base
        );
    }
    return data;
});
