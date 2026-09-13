// 页面微装饰：樱花飘落 + 点击礼花 + 背景微光点
// 设计原则：轻量（单 rAF 循环驱动两个 Canvas）、克制、不干扰正文
// 参数集中在下方 CONFIG，可随时调整
(function () {
    if (window.__floatingInit) { return; }
    window.__floatingInit = true;
    var CONFIG = {
        // 无视系统「减少动态效果」偏好强制开启（站主设置：你的系统开了减少动画时，花瓣仍显示）
        ignoreReduceMotion: true,
        // 樱花花瓣（飘在内容上方，淡而小）
        petalColors: ['#ffc2dd', '#ff9acb', '#ffd6ea', '#f8a5c8', '#ffb3d4'],
        petalMin: 7, petalMax: 16,
        petalAlpha: [0.30, 0.60],
        petalSpeed: [0.25, 0.8],
        countPerWidth: 120,
        countMax: 14,
        // 点击礼花
        confettiCount: 12,
        confettiColors: ['#ff6fb3', '#ffa726', '#26c6da', '#66bb6a', '#ab47bc', '#ffca28', '#ef5350', '#ff8a65'],
        // 背景微光点（在背景图之上、正文之下，不碰内容）
        dotCount: 22,
        dotColors: ['#ffd6ea', '#ffc2dd', '#ffe9f3', '#fff0f7'],
        dotAlpha: [0.08, 0.22],
        dotR: [1.2, 4.0],
        dotSpeed: 0.12
    };

    // 系统「减少动态效果」：跳过持续动画（花瓣/光点），但保留点击礼花（可用 CONFIG.ignoreReduceMotion 强制开启）
    var sysReduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var reduceMotion = sysReduce && !CONFIG.ignoreReduceMotion;

    // ==================== 上层 Canvas：花瓣 + 礼花 ====================
    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9998';
    document.body.appendChild(canvas);
    var ctx = canvas.getContext('2d');

    // ==================== 下层 Canvas：微光点（z-index:-1） ====================
    var bCanvas = document.createElement('canvas');
    bCanvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none';
    document.body.insertBefore(bCanvas, document.body.firstChild);
    var bCtx = bCanvas.getContext('2d');

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    function resize() {
        canvas.width = innerWidth * dpr;
        canvas.height = innerHeight * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        bCanvas.width = innerWidth * dpr;
        bCanvas.height = innerHeight * dpr;
        bCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    addEventListener('resize', resize);

    // ---------- 樱花花瓣 ----------
    var petals = [];
    function makePetal(fromTop) {
        return {
            x: Math.random() * innerWidth,
            y: fromTop ? -20 - Math.random() * 80 : Math.random() * innerHeight,
            size: CONFIG.petalMin + Math.random() * (CONFIG.petalMax - CONFIG.petalMin),
            vy: CONFIG.petalSpeed[0] + Math.random() * (CONFIG.petalSpeed[1] - CONFIG.petalSpeed[0]),
            sway: 0.4 + Math.random() * 0.9,
            phase: Math.random() * Math.PI * 2,
            rot: Math.random() * Math.PI * 2,
            vr: (Math.random() - 0.5) * 0.02,
            alpha: CONFIG.petalAlpha[0] + Math.random() * (CONFIG.petalAlpha[1] - CONFIG.petalAlpha[0]),
            color: CONFIG.petalColors[Math.floor(Math.random() * CONFIG.petalColors.length)]
        };
    }
    function resetPetals() {
        if (reduceMotion) { petals = []; return; }
        var n = Math.max(6, Math.min(CONFIG.countMax, Math.floor(innerWidth / CONFIG.countPerWidth)));
        petals = [];
        for (var i = 0; i < n; i++) petals.push(makePetal(false));
    }
    resetPetals();

    function drawPetal(p) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        var s = p.size;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(s * 0.55, -s * 0.45, s * 0.6, -s * 1.1, 0, -s * 1.45);
        ctx.bezierCurveTo(-s * 0.6, -s * 1.1, -s * 0.55, -s * 0.45, 0, 0);
        ctx.fill();
        ctx.restore();
    }

    // ---------- 点击礼花 ----------
    var confetti = [];

    // ---------- 背景微光点 ----------
    var dots = [];
    function makeDot(fromBottom) {
        return {
            x: Math.random() * innerWidth,
            y: fromBottom ? innerHeight + 10 : Math.random() * innerHeight,
            r: CONFIG.dotR[0] + Math.random() * (CONFIG.dotR[1] - CONFIG.dotR[0]),
            vx: (Math.random() - 0.5) * CONFIG.dotSpeed,
            vy: -(CONFIG.dotSpeed * 0.4 + Math.random() * CONFIG.dotSpeed * 0.6),
            base: CONFIG.dotAlpha[0] + Math.random() * (CONFIG.dotAlpha[1] - CONFIG.dotAlpha[0]),
            pulse: 0.5 + Math.random() * 1.5,
            phase: Math.random() * Math.PI * 2,
            color: CONFIG.dotColors[Math.floor(Math.random() * CONFIG.dotColors.length)]
        };
    }
    function resetDots() {
        if (reduceMotion) { dots = []; return; }
        var n = Math.max(8, Math.min(CONFIG.dotCount, Math.floor(innerWidth / 70)));
        dots = [];
        for (var i = 0; i < n; i++) dots.push(makeDot(false));
    }
    resetDots();

    var t = 0, raf = null, hidden = false;
    if (window.console && console.log) { console.log('[floating] init, reduceMotion=' + reduceMotion + ', petals=' + petals.length + ', dots=' + dots.length); }
    document.addEventListener('visibilitychange', function () {
        hidden = document.hidden;
        if (!hidden && !raf) { raf = requestAnimationFrame(loop); }
    });

    function loop() {
        raf = null;
        if (hidden) { return; }

        t += 0.016;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        bCtx.clearRect(0, 0, bCanvas.width, bCanvas.height);

        // 花瓣：下落 + 摇摆 + 自转
        for (var i = 0; i < petals.length; i++) {
            var p = petals[i];
            p.y += p.vy;
            p.x += Math.sin(t * p.sway + p.phase) * 0.6;
            p.rot += p.vr;
            if (p.y > innerHeight + 30) { petals[i] = makePetal(true); continue; }
            drawPetal(p);
        }

        // 微光点：缓慢上升漂移 + 呼吸闪烁（背景层）
        for (var k = 0; k < dots.length; k++) {
            var d = dots[k];
            d.x += d.vx;
            d.y += d.vy;
            if (d.y < -20 || d.x < -20 || d.x > innerWidth + 20) { dots[k] = makeDot(true); continue; }
            bCtx.save();
            bCtx.globalAlpha = Math.max(0, d.base * (0.65 + 0.35 * Math.sin(t * d.pulse + d.phase)));
            bCtx.fillStyle = d.color;
            bCtx.beginPath();
            bCtx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
            bCtx.fill();
            bCtx.restore();
        }

        // 礼花：重力 + 旋转 + 淡出
        for (var j = confetti.length - 1; j >= 0; j--) {
            var c = confetti[j];
            c.vy += 0.28;
            c.x += c.vx;
            c.y += c.vy;
            c.vx *= 0.99;
            c.rot += c.vr;
            c.life -= 0.016;
            if (c.life <= 0 || c.y > innerHeight + 40) { confetti.splice(j, 1); continue; }
            ctx.save();
            ctx.translate(c.x, c.y);
            ctx.rotate(c.rot);
            ctx.globalAlpha = Math.max(0, Math.min(1, c.life));
            ctx.fillStyle = c.color;
            ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
            ctx.restore();
        }

        raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    document.addEventListener('click', function (e) {
        for (var i = 0; i < CONFIG.confettiCount; i++) {
            var a = Math.PI * 2 * Math.random();
            var sp = 2 + Math.random() * 5;
            confetti.push({
                x: e.clientX, y: e.clientY,
                vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2.5,
                rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.35,
                w: 3 + Math.random() * 4, h: 5 + Math.random() * 5,
                color: CONFIG.confettiColors[Math.floor(Math.random() * CONFIG.confettiColors.length)],
                life: 1
            });
            if (confetti.length > 240) { confetti.shift(); }
        }
    }, true);
})();
