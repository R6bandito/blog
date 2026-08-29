// 背景图轮换：直接操作 body 背景 + 透明度渐变过渡
// 图片放 source/images/，在 images 数组里添加路径
(function () {
    var images = ['/images/bg.webp', '/images/bg2.webp', '/images/bg3.webp', '/images/bg4.webp', '/images/bg5.webp'];
    var body = document.body;
    var idx = 0;
    var switching = false;
    var INTERVAL = 60000;   // 切换间隔 30 秒

    if (images.length < 2) { return; }

    setInterval(function () {
        if (switching) { return; }
        switching = true;
        var next = (idx + 1) % images.length;
        var img = new Image();
        img.onload = function () {
            // 淡出 → 换图 → 淡入（底色与图片色调接近，过渡柔和）
            body.style.transition = 'opacity 0.4s ease';
            body.style.opacity = '0';
            setTimeout(function () {
                body.style.backgroundImage = 'url(' + images[next] + ')';
                body.style.opacity = '1';
                body.style.transition = 'opacity 0.6s ease';
                setTimeout(function () {
                    body.style.transition = '';
                    switching = false;
                }, 700);
            }, 450);
            idx = next;
        };
        img.onerror = function () { switching = false; };
        img.src = images[next];
    }, INTERVAL);
})();
