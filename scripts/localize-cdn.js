// CDN 本地化插件
// 通过 after_render:html 过滤器，在 HTML 渲染输出时把外部 CDN 引用替换为本地资源路径
// 效果：线上页面零外部依赖（除统计脚本 busuanzi）
// 注：用 after_render:html 而非 after_generate，前者在写入磁盘前且 server 模式同样生效

// 删除整个标签的规则（未使用/冗余资源）
const REMOVE_TAGS = [
  /<link[^>]*href="[^"]*fonts\.googleapis\.com[^"]*"[^>]*>\s*/g,
  /<script[^>]*src="[^"]*pace-js[^"]*"[^>]*>\s*<\/script>\s*/g,
  /<script[^>]*src="[^"]*justifiedGallery[^"]*"[^>]*>\s*<\/script>\s*/g,
  /<link[^>]*href="[^"]*justifiedGallery[^"]*"[^>]*>\s*/g,
  /<script[^>]*src="[^"]*pjax@[^"]*"[^>]*>\s*<\/script>\s*/g,
];

// URL 替换（保留标签）
const REPLACE_URLS = [
  ['https://use.fontawesome.com/releases/v6.0.0/css/all.css', '/css/fontawesome-all.css'],
  ['https://cdn.jsdelivr.net/npm/highlight.js@11.7.0/styles/atom-one-dark.css', '/css/atom-one-dark.css'],
  ['https://cdn.jsdelivr.net/npm/jquery@3.3.1/dist/jquery.min.js', '/js/vendor/jquery.min.js'],
  ['https://cdn.jsdelivr.net/npm/moment@2.22.2/min/moment-with-locales.min.js', '/js/vendor/moment-with-locales.min.js'],
  ['https://cdn.jsdelivr.net/npm/clipboard@2.0.4/dist/clipboard.min.js', '/js/vendor/clipboard.min.js'],
  ['https://cdn.jsdelivr.net/npm/lightgallery@1.10.0/dist/css/lightgallery.min.css', '/css/lightgallery.min.css'],
  ['https://cdn.jsdelivr.net/npm/lightgallery@1.10.0/dist/js/lightgallery.min.js', '/js/lightgallery.min.js'],
];

hexo.extend.filter.register('after_render:html', function (str) {
  let out = str;
  REMOVE_TAGS.forEach(re => { out = out.replace(re, ''); });
  REPLACE_URLS.forEach(([from, to]) => { out = out.split(from).join(to); });
  return out;
});
