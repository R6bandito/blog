// 将自定义样式 /css/custom.css 注入到每个页面的 <head> 末尾
// 放在主题 default.css 之后加载，可覆盖主题默认样式
// Hexo 8 已移除 _config.yml 中的 inject 配置支持，故使用 injector API
hexo.extend.injector.register('head_end', '<link rel="stylesheet" href="/css/custom.css">');

// 提前预加载背景图，缩短整页加载时的白屏时间
hexo.extend.injector.register('head_begin', '<link rel="preload" as="image" href="/images/bg.webp">');
