// 背景音乐：原生 audio 实现，无第三方库
// 音符按钮 = 播放/暂停开关；控制条可收起（收起后音乐继续播放）
// 状态持久化到 localStorage：页面加载只恢复状态不自动播放，切页被动暂停自动恢复
(function () {
    // PJAX 切页时脚本可能重新执行，全局标志防止重复创建播放器
    if (window.__musicInit) { return; }
    window.__musicInit = true;

    var LS_KEY = 'musicState';

    function loadState() {
        try {
            var s = localStorage.getItem(LS_KEY);
            return s ? JSON.parse(s) : null;
        } catch (e) { return null; }
    }
    function saveState(st) {
        try { localStorage.setItem(LS_KEY, JSON.stringify(st)); } catch (e) { /* ignore */ }
    }

    var songs = [
        { name: '僕たちは戦わない', url: '/music/10-bokutachi-wa-tatakawanai.mp3' },
        { name: '初日', url: '/music/07-hatsuhi.mp3' },
        { name: '恋するフォーチュンクッキー', url: '/music/06-koisuru-fortune-cookie.mp3' },
        { name: '名残り桜', url: '/music/03-nagori-zakura.mp3' },
        { name: 'フライングゲット', url: '/music/01-flying-get.mp3' },
        { name: 'ヘビーローテーション', url: '/music/02-heavy-rotation.mp3' },
        { name: 'ポニーテールとシュシュ', url: '/music/04-ponytail-shushu.mp3' },
        { name: 'ポニーテールとシュシュ (1988)', url: '/music/12-ponytail-1988.mp3' },
        { name: '風は吹いている', url: '/music/05-kaze-wa-fuiteiru.mp3' },
        { name: 'RIVER', url: '/music/08-river.mp3' },
        { name: '結晶', url: '/music/09-kesshou.mp3' },
        { name: 'ナギイチ', url: '/music/11-nagiichi.mp3' }
    ];

    var btn = document.getElementById('music-toggle');
    var bar = document.getElementById('music-bar');
    var title = document.getElementById('music-title');
    var playBtn = document.getElementById('music-play');
    var prevBtn = document.getElementById('music-prev');
    var nextBtn = document.getElementById('music-next');
    var closeBtn = document.getElementById('music-close');
    if (!btn || !bar) return;

    var audio = new Audio();
    var idx = 0;
    var loaded = false;
    var userPaused = false;
    // 本次页面会话内是否播放过（用户主动操作），防止残留状态自动播放
    window.__musicWasPlaying = false;

    function persistPlaying() {
        saveState({ playing: true, time: audio.currentTime, idx: idx });
    }
    function persistPaused() {
        saveState({ playing: false, time: audio.currentTime, idx: idx });
    }

    // ===== 音量渐变（渐入/渐出，避免突然响起或骤停）=====
    var FADE_IN_MS = 720;      // 渐入时长（更从容的渐入）
    var FADE_OUT_MS = 520;     // 渐出时长（明显但不拖沓）
    var TARGET_VOL = 1;        // 目标音量
    var fadeTimer = null;

    function clearFade() {
        if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null; }
    }
    // 渐入：音量从 0 平滑升到目标（平方曲线，听感更自然）
    function fadeIn() {
        clearFade();
        try { audio.volume = 0; } catch (e) {}
        var steps = Math.max(8, Math.round(FADE_IN_MS / 25));
        var cur = 0;
        fadeTimer = setInterval(function () {
            cur++;
            var v = cur / steps;
            try { audio.volume = Math.min(TARGET_VOL, TARGET_VOL * v * v * v); } catch (e) {}
            if (cur >= steps) {
                clearFade();
                try { audio.volume = TARGET_VOL; } catch (e) {}
            }
        }, 25);
    }
    // 渐出：音量降到 0 后再执行回调（暂停/切歌）
    function fadeOut(done) {
        clearFade();
        var start = 1;
        try { start = audio.volume; } catch (e) {}
        var steps = Math.max(6, Math.round(FADE_OUT_MS / 25));
        var cur = 0;
        fadeTimer = setInterval(function () {
            cur++;
            try { audio.volume = Math.max(0, start * (1 - cur / steps)); } catch (e) {}
            if (cur >= steps) {
                clearFade();
                try { audio.volume = 0; } catch (e) {}
                if (typeof done === 'function') { done(); }
            }
        }, 25);
    }

    function load(i, showBar) {
        idx = (i + songs.length) % songs.length;
        var doSwitch = function () {
            audio.src = songs[idx].url;
            title.textContent = songs[idx].name;
            if (showBar !== false) { bar.classList.add('show'); }
            userPaused = false;
            audio.play();
            fadeIn();
        };
        // 正在播放 → 先渐出再切歌；否则直接切
        if (!audio.paused) { fadeOut(doSwitch); } else { clearFade(); doSwitch(); }
    }

    // 音符按钮：播放/暂停开关
    btn.addEventListener('click', function () {
        if (audio.paused) {
            if (!loaded) { loaded = true; load(0, true); }
            else {
                clearFade();                       // 取消可能还在进行的渐出
                userPaused = false;
                bar.classList.add('show');
                audio.play();
                fadeIn();
            }
        } else {
            userPaused = true;
            fadeOut(function () { audio.pause(); });
        }
    });

    // 收起控制条：音乐继续播放
    closeBtn.addEventListener('click', function () {
        bar.classList.remove('show');
    });

    // 控制条内的播放/暂停
    playBtn.addEventListener('click', function () {
        if (audio.paused) {
            clearFade();
            userPaused = false;
            audio.play();
            fadeIn();
        } else {
            userPaused = true;
            fadeOut(function () { audio.pause(); });
        }
    });

    prevBtn.addEventListener('click', function () { load(idx - 1, true); });
    nextBtn.addEventListener('click', function () { load(idx + 1, true); });

    // 播放状态 UI 与持久化
    audio.addEventListener('play', function () {
        userPaused = false;
        window.__musicWasPlaying = true;
        btn.classList.add('playing');
        playBtn.innerHTML = '<i class="fas fa-pause"></i>';
        persistPlaying();
    });
    audio.addEventListener('pause', function () {
        if (userPaused) {
            window.__musicWasPlaying = false;
            btn.classList.remove('playing');
            playBtn.innerHTML = '<i class="fas fa-play"></i>';
            persistPaused();
        } else {
            persistPlaying();   // 被动暂停（切页等）：保持"应播放"状态并保存位置
        }
    });

    // 播放中实时保存位置
    audio.addEventListener('timeupdate', function () {
        if (window.__musicWasPlaying) { persistPlaying(); }
    });

    // 播完自动下一首
    audio.addEventListener('ended', function () { load(idx + 1, true); });

    // 被动暂停自动恢复（PJAX 切页等场景）——仅本次会话播放过才恢复
    function restore() {
        if (!window.__musicWasPlaying || userPaused || !audio.paused) { return; }
        var st = loadState();
        if (!st || !st.playing) { return; }
        // src 丢失则按记忆曲目重载
        if (!audio.src && st.idx !== undefined && songs[st.idx]) {
            idx = st.idx;
            audio.src = songs[idx].url;
            title.textContent = songs[idx].name;
        }
        var resume = function () {
            if (st.time && audio.currentTime < st.time - 1) {
                try { audio.currentTime = st.time; } catch (e) { /* ignore */ }
            }
            audio.play().then(function () { fadeIn(); }).catch(function () { /* 被拦截则等用户点击 */ });
        };
        if (audio.readyState >= 2) { resume(); }
        else {
            audio.addEventListener('canplay', function h() {
                audio.removeEventListener('canplay', h);
                resume();
            });
        }
    }

    // 首次加载：只恢复歌曲和位置，不自动播放（避免"没点就响"）
    (function () {
        var st = loadState();
        if (st && st.playing) {
            if (st.idx !== undefined && songs[st.idx]) {
                idx = st.idx;
                loaded = true;
                audio.src = songs[idx].url;
                title.textContent = songs[idx].name;
            }
            if (st.time) {
                audio.addEventListener('loadedmetadata', function h() {
                    audio.removeEventListener('loadedmetadata', h);
                    try { audio.currentTime = st.time; } catch (e) { /* ignore */ }
                });
            }
        }
    })();

    // 切页完成事件 + 轮询双保险
    document.addEventListener('pjax:complete', restore);
    setInterval(restore, 2000);
})();
