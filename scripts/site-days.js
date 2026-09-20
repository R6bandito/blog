// 站点运行天数 · 起算日期注入
// 取"第一篇博文"的日期作为起算点，注入到页面：
//   <script>window.__siteStart='2026-08-29';</script>
// 前端 site-days.js 读取后实时计算天数（无需手动维护日期）
hexo.extend.filter.register('after_render:html', function (str) {
    if (str.indexOf('window.__siteStart') >= 0) { return str; }
    var start = '';
    try {
        var posts = hexo.locals.get('posts');
        var first = posts && posts.sort('date', 1).first();
        if (first && first.date) {
            start = first.date.format('YYYY-MM-DD');
        }
    } catch (e) {}
    if (!start) { return str; }
    var inject = '<script>window.__siteStart=' + JSON.stringify(start) + ';</script>\n';
    return str.replace('</head>', inject + '</head>');
});
