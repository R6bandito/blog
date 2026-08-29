// 将自定义样式 /css/custom.css 注入到每个页面的 <head> 末尾
// 放在主题 default.css 之后加载，可覆盖主题默认样式
// Hexo 8 已移除 _config.yml 中的 inject 配置支持，故使用 injector API
hexo.extend.injector.register('head_end', '<link rel="stylesheet" href="/css/custom.css">');

// 提前预加载背景图，缩短整页加载时的白屏时间
hexo.extend.injector.register('head_begin', '<link rel="preload" as="image" href="/images/bg.webp">');

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
