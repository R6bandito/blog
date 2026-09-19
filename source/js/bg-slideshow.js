// 背景图轮换：双图层交叉淡入 + 白天/夜间分组
// 白天图：source/images/ 下的 bg2-bg8；夜间图：source/images/night/night1-N（放图后自动生效）
(function () {
    var INTERVAL = 60000;   // 切换间隔 60 秒
    var FADE = 1200;        // 交叉淡入时长（ms）

    var dayImages = ['/images/bg2.webp', '/images/bg3.webp', '/images/bg4.webp', '/images/bg5.webp', '/images/bg6.webp', '/images/bg7.webp', '/images/bg8.webp'];
    // 夜间候选（运行时探测哪些存在；不存在则自动沿用白天图）
    var nightCandidates = ['/images/night/night1.webp', '/images/night/night2.webp', '/images/night/night3.webp', '/images/night/night4.webp', '/images/night/night5.webp', '/images/night/night6.webp', '/images/night/night7.webp', '/images/night/night8.webp'];
    var nightImages = [];   // 探测后的可用夜间图

    function makeLayer() {
        var d = document.createElement('div');
        d.className = 'site-bg-layer';
        d.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100vh;height:100lvh;' +
            'background-size:cover;background-position:center;background-repeat:no-repeat;' +
            'opacity:0;transition:opacity ' + (FADE / 1000) + 's ease;pointer-events:none';
        return d;
    }
    var bottom = makeLayer();   // 常驻底层
    var top = makeLayer();      // 过渡层
    document.body.insertBefore(top, document.body.firstChild);
    document.body.insertBefore(bottom, top);
    document.body.style.backgroundImage = '';
    document.body.style.opacity = '';

    var group = dayImages;      // 当前使用的图片组
    var gi = 0;                 // 组内索引
    var switching = false;
    var pendingUrl = null;      // 动画中收到的新目标（避免丢失切换）

    // 交叉淡入切换到指定 URL（带队列：动画中来的新请求会在完成后立即执行）
    function switchTo(url, done) {
        if (switching) { pendingUrl = url; return; }
        switching = true;
        var img = new Image();
        img.onload = function () {
            top.style.backgroundImage = 'url(' + url + ')';
            void top.offsetWidth;
            top.style.opacity = '1';
            setTimeout(function () {
                bottom.style.backgroundImage = 'url(' + url + ')';
                bottom.style.opacity = '1';
                top.style.opacity = '0';
                switching = false;
                if (done) { done(); }
                if (pendingUrl) {
                    var u = pendingUrl;
                    pendingUrl = null;
                    switchTo(u);
                }
            }, FADE + 120);
        };
        img.onerror = function () { switching = false; };
        img.src = url;
    }

    // 初始显示
    bottom.style.backgroundImage = 'url(' + group[0] + ')';
    bottom.style.opacity = '1';
    if (window.console && console.log) { console.log('[bg] init, 白天组 ' + group.length + ' 张'); }

    // 定时轮换
    setInterval(function () {
        if (switching || group.length < 2) { return; }
        gi = (gi + 1) % group.length;
        switchTo(group[gi]);
    }, INTERVAL);

    // 探测夜间图可用性（连续编号，遇到第一张缺失就停止；用 fetch 探测避免控制台 404 噪音）
    function finishProbe() {
        if (nightImages.length && window.console && console.log) {
            console.log('[bg] 夜间组可用 ' + nightImages.length + ' 张');
        }
        if (document.documentElement.classList.contains('dark-mode')) { setMode('dark'); }
    }
    // 优先用 hexo 注入的清单（零请求零 404）；没有清单时回退为逐张探测
    if (window.__nightImages && window.__nightImages.length) {
        nightImages = window.__nightImages.slice();
        finishProbe();
    } else {
        (function probeNight(i) {
            if (i >= nightCandidates.length) { finishProbe(); return; }
            fetch(nightCandidates[i], { method: 'HEAD' })
                .then(function (r) {
                    if (r.ok) { nightImages.push(nightCandidates[i]); probeNight(i + 1); }
                    else { finishProbe(); }
                })
                .catch(function () { finishProbe(); });
        })(0);
    }

    // 对外接口：主题切换时调用
    function setMode(mode) {
        var target = (mode === 'dark' && nightImages.length) ? nightImages : dayImages;
        if (target === group) { return; }
        group = target;
        gi = 0;
        switchTo(group[0]);
        if (window.console && console.log) {
            console.log('[bg] 切换图片组: ' + (mode === 'dark' ? '夜间' : '白天') + '（' + group.length + ' 张）');
        }
    }
    window.__bgSlideshow = { setMode: setMode };
})();
