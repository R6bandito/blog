// 页面微装饰：樱花飘落 + 点击礼花 + 背景微光点 + 夜间雨丝
// 设计原则：轻量（单 rAF 循环驱动多个 Canvas）、克制、不干扰正文
// 参数集中在下方 CONFIG，可随时调整
// 主题过渡：白天/夜间切换时不做任何"重建"，alpha 与数量都平滑过渡（花瓣不重置）
(function () {
    if (window.__floatingInit) { return; }
    window.__floatingInit = true;
    // 系统「减少动态效果」：跳过持续动画（花瓣/光点/雨丝），但保留点击礼花
    var CONFIG = {
        ignoreReduceMotion: true,
        // 樱花花瓣（白天）
        petalColors: ['#ffc2dd', '#ff9acb', '#ffd6ea', '#f8a5c8', '#ffb3d4'],
        petalMin: 7, petalMax: 16,
        petalAlpha: [0.30, 0.60],
        petalAlphaDark: [0.46, 0.74],     // 夜间：对比稍强（更清晰）
        petalSpeed: [0.25, 0.8],
        countPerWidth: 120,
        countMax: 14,
        nightPetalFactor: 0.6,            // 夜间：花瓣数量乘以该系数（更少）
        // 主题过渡速度（每帧逼近系数，越小越慢越柔和）
        themeLerp: 0.05,                  // 花瓣透明度过渡
        rainLerp: 0.045,                  // 雨丝渐入渐出
        petalSpawnStep: 0.25,             // 补花瓣的速度（约每 4 帧一片）
        petalFadeStep: 0.010,             // 减花瓣的淡出速度
        // 点击礼花
        confettiCount: 12,
        confettiColors: ['#ff6fb3', '#ffa726', '#26c6da', '#66bb6a', '#ab47bc', '#ffca28', '#ef5350', '#ff8a65'],
        // 背景微光点
        dotCount: 22,
        dotColors: ['#ffd6ea', '#ffc2dd', '#ffe9f3', '#fff0f7'],
        dotAlpha: [0.08, 0.22],
        dotR: [1.2, 4.0],
        dotSpeed: 0.12,
        // 夜间雨丝（仅暗色模式）
        rainStreakMax: 90,
        rainStreakAlpha: [0.16, 0.30]     // 雨丝透明度（更明显）
    };
    var sysReduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var reduceMotion = sysReduce && !CONFIG.ignoreReduceMotion;

    function isDark() {
        return document.documentElement.classList.contains('dark-mode');
    }

    // ==================== 上层 Canvas：花瓣 + 礼花 ====================
    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100vh;height:100lvh;pointer-events:none;z-index:9998';
    document.body.appendChild(canvas);
    var ctx = canvas.getContext('2d');

    // ==================== 雨丝 Canvas（最上层，仅夜间显示） ====================
    var rCanvas = document.createElement('canvas');
    rCanvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100vh;height:100lvh;pointer-events:none;z-index:9999';
    document.body.appendChild(rCanvas);
    var rCtx = rCanvas.getContext('2d');

    // ==================== 下层 Canvas：微光点 ====================
    var bCanvas = document.createElement('canvas');
    bCanvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100vh;height:100lvh;pointer-events:none';
    document.body.insertBefore(bCanvas, document.body.firstChild);
    var bCtx = bCanvas.getContext('2d');

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    function resize() {
        canvas.width = innerWidth * dpr;
        canvas.height = innerHeight * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        rCanvas.width = innerWidth * dpr;
        rCanvas.height = innerHeight * dpr;
        rCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        bCanvas.width = innerWidth * dpr;
        bCanvas.height = innerHeight * dpr;
        bCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    addEventListener('resize', resize);

    // ---------- 樱花花瓣 ----------
    var petals = [];
    function makePetal(fromTop) {
        var dark = isDark();
        var range = dark ? CONFIG.petalAlphaDark : CONFIG.petalAlpha;
        var ratio = Math.random();          // 在 alpha 区间内的相对位置（供主题过渡插值）
        return {
            x: Math.random() * innerWidth,
            y: fromTop ? -20 - Math.random() * 80 : Math.random() * innerHeight,
            size: CONFIG.petalMin + Math.random() * (CONFIG.petalMax - CONFIG.petalMin),
            vy: CONFIG.petalSpeed[0] + Math.random() * (CONFIG.petalSpeed[1] - CONFIG.petalSpeed[0]),
            sway: 0.4 + Math.random() * 0.9,
            phase: Math.random() * Math.PI * 2,
            rot: Math.random() * Math.PI * 2,
            vr: (Math.random() - 0.5) * 0.02,
            alphaRatio: ratio,
            alpha: range[0] + ratio * (range[1] - range[0]),
            dying: false,
            color: CONFIG.petalColors[Math.floor(Math.random() * CONFIG.petalColors.length)]
        };
    }

    // 目标花瓣数（随主题与窗口宽度变化）
    function targetPetalCount() {
        var n = Math.max(6, Math.min(CONFIG.countMax, Math.floor(innerWidth / CONFIG.countPerWidth)));
        if (isDark()) { n = Math.max(4, Math.round(n * CONFIG.nightPetalFactor)); }
        return n;
    }

    function resetPetals() {
        if (reduceMotion) { petals = []; return; }
        var n = targetPetalCount();
        petals = [];
        for (var i = 0; i < n; i++) petals.push(makePetal(false));
    }
    resetPetals();

    // 数量平滑收敛：不足时从顶部慢慢补，超出时让最靠下的花瓣淡出（不重置任何已有花瓣）
    var petalSpawnCarry = 0;
    function syncPetals() {
        if (reduceMotion) { return; }
        var target = targetPetalCount();
        if (petals.length < target) {
            petalSpawnCarry += CONFIG.petalSpawnStep;
            while (petalSpawnCarry >= 1 && petals.length < target) {
                petals.push(makePetal(true));
                petalSpawnCarry -= 1;
            }
        } else if (petals.length > target) {
            var idx = -1, maxY = -1;
            for (var i = 0; i < petals.length; i++) {
                var q = petals[i];
                if (!q.dying && q.y > maxY) { maxY = q.y; idx = i; }
            }
            if (idx >= 0) { petals[idx].dying = true; }   // 主循环里淡出后移除
        }
    }

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

    // ---------- 夜间雨丝 ----------
    var streaks = [];
    function makeStreak(fromTop) {
        return {
            x: Math.random() * (innerWidth + 160) - 80,
            y: fromTop ? -30 - Math.random() * innerHeight : Math.random() * innerHeight,
            len: 7 + Math.random() * 13,
            vy: 6 + Math.random() * 8,
            vx: 0.8 + Math.random() * 0.8,
            alpha: CONFIG.rainStreakAlpha[0] + Math.random() * (CONFIG.rainStreakAlpha[1] - CONFIG.rainStreakAlpha[0])
        };
    }
    function resetStreaks() {
        if (reduceMotion) { streaks = []; return; }
        var n = Math.min(CONFIG.rainStreakMax, Math.floor(innerWidth / 14));
        streaks = [];
        for (var i = 0; i < n; i++) streaks.push(makeStreak(false));
    }
    resetStreaks();

    // 进入夜间：雨丝回到屏幕上方，自然"开始下雨"（不重建数组）
    function resetStreakPositions() {
        for (var i = 0; i < streaks.length; i++) {
            streaks[i].y = -30 - Math.random() * innerHeight;
            streaks[i].x = Math.random() * (innerWidth + 160) - 80;
        }
    }

    var t = 0, raf = null, hidden = false;
    var rainCleared = true;
    // 主题过渡系数：0 = 白天，1 = 夜间（逐帧逼近，切换不跳变）
    var darkLevel = isDark() ? 1 : 0;
    var rainLevel = darkLevel;
    document.addEventListener('visibilitychange', function () {
        hidden = document.hidden;
        if (!hidden && !raf) { raf = requestAnimationFrame(loop); }
    });

    // 主题切换：花瓣不重建（主循环里做平滑过渡）；仅在进入夜间时把雨丝归位
    try {
        var mo = new MutationObserver(function (muts) {
            for (var i = 0; i < muts.length; i++) {
                if (muts[i].attributeName === 'class') {
                    if (isDark()) { resetStreakPositions(); }
                    break;
                }
            }
        });
        mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    } catch (e) {}

    function loop() {
        raf = null;
        if (hidden) { return; }

        t += 0.016;

        // 主题过渡逼近（花瓣透明度 / 雨丝显隐都跟着它走）
        var darkTarget = isDark() ? 1 : 0;
        darkLevel += (darkTarget - darkLevel) * CONFIG.themeLerp;
        if (Math.abs(darkTarget - darkLevel) < 0.002) { darkLevel = darkTarget; }
        rainLevel += (darkTarget - rainLevel) * CONFIG.rainLerp;
        if (Math.abs(darkTarget - rainLevel) < 0.002) { rainLevel = darkTarget; }

        // 花瓣数量平滑收敛（补/减都不改变已有花瓣的位置）
        syncPetals();

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        bCtx.clearRect(0, 0, bCanvas.width, bCanvas.height);

        // 花瓣 alpha 区间随主题过渡插值
        var a0 = CONFIG.petalAlpha[0] + (CONFIG.petalAlphaDark[0] - CONFIG.petalAlpha[0]) * darkLevel;
        var a1 = CONFIG.petalAlpha[1] + (CONFIG.petalAlphaDark[1] - CONFIG.petalAlpha[1]) * darkLevel;

        // 花瓣：下落 + 摇摆 + 自转
        for (var i = 0; i < petals.length; i++) {
            var p = petals[i];
            if (p.dying) {
                p.alpha -= CONFIG.petalFadeStep;                 // 减量：淡出后移除
                if (p.alpha <= 0.006) { petals.splice(i, 1); i--; continue; }
            } else {
                p.alpha = a0 + p.alphaRatio * (a1 - a0);         // 随主题平滑变化
            }
            p.y += p.vy;
            p.x += Math.sin(t * p.sway + p.phase) * 0.6;
            p.rot += p.vr;
            if (p.y > innerHeight + 30) {
                // 落底：需要减量时不再重生，否则从顶部重新飘入
                if (petals.length > targetPetalCount()) { petals.splice(i, 1); i--; continue; }
                petals[i] = makePetal(true);
                continue;
            }
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

        // ---------- 夜间雨丝（随 rainLevel 渐入渐出） ----------
        if (rainLevel > 0.004) {
            rainCleared = false;
            rCtx.clearRect(0, 0, rCanvas.width, rCanvas.height);
            rCtx.lineWidth = 1;
            for (var s = 0; s < streaks.length; s++) {
                var st = streaks[s];
                st.y += st.vy;
                st.x += st.vx;
                if (st.y > innerHeight + 30 || st.x > innerWidth + 30) { streaks[s] = makeStreak(true); continue; }
                rCtx.save();
                rCtx.globalAlpha = st.alpha * rainLevel;
                rCtx.strokeStyle = '#cfe0f5';
                rCtx.beginPath();
                rCtx.moveTo(st.x, st.y);
                rCtx.lineTo(st.x - st.vx * 3.2, st.y - st.len);
                rCtx.stroke();
                rCtx.restore();
            }
        } else if (!rainCleared) {
            rCtx.clearRect(0, 0, rCanvas.width, rCanvas.height);
            rainCleared = true;
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
