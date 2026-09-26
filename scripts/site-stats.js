// 站点总字数统计（所有文章）
// 口径：正文 HTML 去标签后，"中文字符数 + 英文单词数"（最贴近直觉的"字数"）
// 注入 window.__siteWords 供前端展示（前端换算成 w）
var siteStatsCache = null;
hexo.extend.filter.register('after_render:html', function (str) {
    if (str.indexOf('window.__siteWords') >= 0) { return str; }
    if (siteStatsCache === null) {
        var total = 0, count = 0;
        try {
            var posts = hexo.locals.get('posts');
            count = posts.length;
            posts.forEach(function (p) {
                var html = String(p.content || '').replace(/<[^>]*>/g, ' ');
                html = html.replace(/&[a-z#0-9]+;/gi, ' ');            // HTML 实体
                var cn = (html.match(/[\u4e00-\u9fa5]/g) || []).length;   // 中文字符
                var en = (html.match(/[a-zA-Z]+/g) || []).length;          // 英文单词
                total += cn + en;
            });
        } catch (e) {
            console.log('[site-stats] 统计出错: ' + e.message);
        }
        siteStatsCache = total;
        console.log('[site-stats] 全站总字数: ' + total + ' 字（' + (total / 10000).toFixed(1) + 'w），共 ' + count + ' 篇');
    }
    if (!siteStatsCache) { return str; }
    return str.replace('</head>', '<script>window.__siteWords=' + siteStatsCache + ';</script>\n</head>');
});
