// 将自定义样式 /css/custom.css 注入到每个页面的 <head> 末尾
// 放在主题 default.css 之后加载，可覆盖主题默认样式
// Hexo 8 已移除 _config.yml 中的 inject 配置支持，故使用 injector API
hexo.extend.injector.register('head_end', '<link rel="stylesheet" href="/css/custom.css">');

// 提前预加载背景图，缩短整页加载时的白屏时间
hexo.extend.injector.register('head_begin', '<link rel="preload" as="image" href="/images/bg.webp">');

// 禁用 MoOx Pjax（其 301 重定向场景静默失效导致整页刷新），由自研 pjax-custom.js 接管
hexo.extend.injector.register('head_begin', '<script>window.Pjax = function () {}; document.addEventListener(\'DOMContentLoaded\', function () { window.Pjax = function () {}; });</script>');

// 自研轻量 PJAX（fetch + DOMParser，自动跟随重定向，只替换内容区）
hexo.extend.injector.register('body_end', '<script src="/js/pjax-custom.js"></script>');

// 背景图轮换脚本
hexo.extend.injector.register('body_end', '<script src="/js/bg-slideshow.js"></script>');

// 分类/标签页标记：列表页只显示标题（隐藏正文）
hexo.extend.injector.register('body_end', '<script>(function () { function hideContents() { var p = location.pathname; var isList = (p.indexOf(\'/categories/\') === 0 && p !== \'/categories/\') || (p.indexOf(\'/tags/\') === 0 && p !== \'/tags/\'); document.querySelectorAll(\'.article .content, .article .article-more\').forEach(function (el) { el.style.display = isList ? \'none\' : \'\'; }); } hideContents(); document.addEventListener(\'pjax:complete\', hideContents); })();</script>');


// 回到顶部适配：独立滚动布局下监听滚动容器
hexo.extend.injector.register('body_end', '<script>(function () { var btn = document.getElementById(\'back-to-top\'); if (!btn) return; var scrollers = Array.prototype.slice.call(document.querySelectorAll(\'.column-main, .column-left, .column-right\')); function onScroll() { var show = scrollers.some(function (s) { return s.scrollTop > 200; }); if (show) { btn.classList.add(\'is-active\'); } else { btn.classList.remove(\'is-active\'); } } scrollers.forEach(function (s) { s.addEventListener(\'scroll\', onScroll); }); btn.addEventListener(\'click\', function () { scrollers.forEach(function (s) { s.scrollTop = 0; }); }); })();</script>');


// 防止 PJAX 切页时替换 head 中的样式链接导致布局瞬间塌陷（闪烁）
// 只摘掉 head 里 link 的 data-pjax 属性，body 中脚本的 data-pjax 保留
hexo.extend.injector.register('head_begin', '<script>document.addEventListener(\'DOMContentLoaded\', function () { document.querySelectorAll(\'head [data-pjax]\').forEach(function (el) { el.removeAttribute(\'data-pjax\'); }); });</script>');

// 背景音乐：原生 audio 实现，音符按钮 = 播放/暂停，控制条可收起（收起后音乐继续）
// 音频文件放 source/music/ 目录（01-07.mp3）
hexo.extend.injector.register('body_end', [
    '<button id="music-toggle" title="音乐"><i class="fas fa-music"></i></button>',
    '<div id="music-bar">',
    '<span id="music-title">音乐</span>',
    '<button id="music-prev" title="上一首"><i class="fas fa-backward"></i></button>',
    '<button id="music-play" title="播放/暂停"><i class="fas fa-play"></i></button>',
    '<button id="music-next" title="下一首"><i class="fas fa-forward"></i></button>',
    '<button id="music-close" title="收起"><i class="fas fa-times"></i></button>',
    '</div>',
    '<script src="/js/music.js"></script>'
].join(''));
