// RSS 订阅源美化
// 在生成的 atom.xml 顶部注入 xml-stylesheet 声明，浏览器打开时渲染成漂亮的订阅页
// 样式文件：source/atom.xsl → /atom.xsl
hexo.extend.filter.register('after_generate', function () {
  var route = hexo.route;
  if (!route.get('atom.xml')) { return; }
  return new Promise(function (resolve) {
    var chunks = [];
    route.get('atom.xml')
      .on('data', function (c) { chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)); })
      .on('end', function () {
        var xml = Buffer.concat(chunks).toString('utf8');
        if (!xml.includes('atom.xsl')) {
          xml = xml.replace(/(<\?xml[^>]*\?>)/, '$1\n<?xml-stylesheet type="text/xsl" href="/atom.xsl"?>');
          route.set('atom.xml', xml);
          hexo.log.info('RSS 订阅页样式已注入');
        }
        resolve();
      });
  });
});
