// 背景音乐：原生 audio 实现，无第三方库
// 音符按钮 = 播放/暂停开关；控制条可收起（收起后音乐继续播放）
(function () {
    var songs = [
        { name: '初日', url: '/music/07-hatsuhi.mp3' },
        { name: '恋するフォーチュンクッキー', url: '/music/06-koisuru-fortune-cookie.mp3' },
        { name: '名残り桜', url: '/music/03-nagori-zakura.mp3' },
        { name: 'フライングゲット', url: '/music/01-flying-get.mp3' },
        { name: 'ヘビーローテーション', url: '/music/02-heavy-rotation.mp3' },
        { name: 'ポニーテールとシュシュ', url: '/music/04-ponytail-shushu.mp3' },
        { name: '風は吹いている', url: '/music/05-kaze-wa-fuiteiru.mp3' }
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

    function load(i, showBar) {
        idx = (i + songs.length) % songs.length;
        audio.src = songs[idx].url;
        title.textContent = songs[idx].name;
        if (showBar !== false) { bar.classList.add('show'); }
        audio.play();
    }

    // 音符按钮：播放/暂停开关
    btn.addEventListener('click', function () {
        if (audio.paused) {
            if (!loaded) { loaded = true; load(0, true); }
            else { audio.play(); bar.classList.add('show'); }
        } else {
            audio.pause();
        }
    });

    // 收起控制条：音乐继续播放
    closeBtn.addEventListener('click', function () {
        bar.classList.remove('show');
    });

    // 控制条内的播放/暂停
    playBtn.addEventListener('click', function () {
        if (audio.paused) { audio.play(); } else { audio.pause(); }
    });

    prevBtn.addEventListener('click', function () { load(idx - 1, true); });
    nextBtn.addEventListener('click', function () { load(idx + 1, true); });

    // 音符按钮播放状态样式
    audio.addEventListener('play', function () {
        btn.classList.add('playing');
        playBtn.innerHTML = '<i class="fas fa-pause"></i>';
    });
    audio.addEventListener('pause', function () {
        btn.classList.remove('playing');
        playBtn.innerHTML = '<i class="fas fa-play"></i>';
    });

    // 播完自动下一首
    audio.addEventListener('ended', function () { load(idx + 1, true); });
})();
