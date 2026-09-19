// 夜间背景图清单注入
// 扫描 source/images/night/ 下存在的图，注入到页面 head：
//   <script>window.__nightImages = ['/images/night/night1.webp', ...]</script>
// bg-slideshow.js 直接读取该清单，省去逐张探测（零 404、加载更快）
const fs = require('fs');
const path = require('path');

hexo.extend.filter.register('after_render:html', function (str) {
    var dir = path.join(hexo.source_dir, 'images', 'night');
    var files = [];
    try {
        files = fs.readdirSync(dir).filter(function (f) { return /\.(webp|jpe?g|png)$/i.test(f); });
    } catch (e) { return str; }
    if (!files.length) { return str; }
    // 按数字自然排序（night2 在 night10 前）
    files.sort(function (a, b) {
        var na = parseInt((a.match(/(\d+)/) || [0, 0])[1], 10);
        var nb = parseInt((b.match(/(\d+)/) || [0, 0])[1], 10);
        return na - nb;
    });
    var urls = files.map(function (f) { return '/images/night/' + f; });
    var inject = '<script>window.__nightImages=' + JSON.stringify(urls) + ';</script>\n';
    return str.replace('</head>', inject + '</head>');
});
