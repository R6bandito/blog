// 背景图轮换：双图层交叉淡入（新图淡入盖住旧图，全程无灰底闪烁）
// 图片放 source/images/，在 images 数组里添加路径
(function () {
    var images = ['/images/bg2.webp', '/images/bg3.webp', '/images/bg4.webp', '/images/bg5.webp', '/images/bg6.webp', '/images/bg7.webp', '/images/bg8.webp'];
    var INTERVAL = 60000;   // 切换间隔 60 秒
    var FADE = 1200;        // 交叉淡入时长（ms）

    if (images.length < 2) { return; }

    function makeLayer() {
        var d = document.createElement('div');
        d.className = 'site-bg-layer';
        d.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;' +
            'background-size:cover;background-position:center;background-repeat:no-repeat;' +
            'opacity:0;transition:opacity ' + (FADE / 1000) + 's ease;pointer-events:none';
        return d;
    }

    var bottom = makeLayer();   // 常驻底层（始终有不透明图，避免露底色）
    var top = makeLayer();      // 过渡层（新图在上面淡入）
    // DOM 顺序：bottom 在前、top 在后 → top 绘制在上层
    document.body.insertBefore(top, document.body.firstChild);
    document.body.insertBefore(bottom, top);
    // 清掉可能残留在 body 上的旧背景
    document.body.style.backgroundImage = '';
    document.body.style.opacity = '';

    var showing = 0;
    bottom.style.backgroundImage = 'url(' + images[0] + ')';
    bottom.style.opacity = '1';
    if (window.console && console.log) { console.log('[bg] init, ' + images.length + ' 张图（交叉淡入模式）'); }

    setInterval(function () {
        var next = (showing + 1) % images.length;
        var img = new Image();
        img.onload = function () {
            // 新图放到 top 层并淡入
            top.style.backgroundImage = 'url(' + images[next] + ')';
            void top.offsetWidth;   // 强制 reflow，确保过渡触发
            top.style.opacity = '1';
            // 淡入完成后：底层悄悄同步为新图，过渡层复位
            setTimeout(function () {
                bottom.style.backgroundImage = 'url(' + images[next] + ')';
                bottom.style.opacity = '1';
                top.style.opacity = '0';
                showing = next;
                if (window.console && console.log) { console.log('[bg] 已切换到 ' + images[next]); }
            }, FADE + 120);
        };
        img.src = images[next];
    }, INTERVAL);
})();
