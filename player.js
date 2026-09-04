/* NANZZ_HUB — shared background music player
   Menyimpan status lagu (video id + posisi waktu) di localStorage
   supaya bisa "dilanjutkan" saat pindah ke halaman lain (hub & modul).
   Catatan: ini best-effort, bukan streaming tanpa putus — setiap halaman
   memuat ulang player dari posisi terakhir yang tersimpan.
*/
(function(){
  window.NanzzPlayer = window.NanzzPlayer || {};

  var STORAGE_KEY = 'nanzz_player_state';
  var ytPlayer = null;
  var widgetEl = null;
  var saveTimer = null;

  function injectStyles(){
    if(document.getElementById('nanzz-player-styles')) return;
    var style = document.createElement('style');
    style.id = 'nanzz-player-styles';
    style.textContent =
      '#nanzz-player-widget{position:fixed;bottom:16px;right:16px;z-index:9999;' +
      'display:flex;align-items:center;gap:.7rem;background:#14181C;' +
      'border:1px solid rgba(232,163,61,0.35);padding:.55rem .75rem;' +
      "font-family:'JetBrains Mono',monospace;box-shadow:0 8px 26px rgba(0,0,0,.45);" +
      'max-width:260px;transform:translateY(20px);opacity:0;' +
      'transition:transform .4s ease,opacity .4s ease;}' +
      '#nanzz-player-widget.is-in{transform:translateY(0);opacity:1;}' +
      '#nanzz-player-widget img{width:36px;height:36px;object-fit:cover;flex-shrink:0;}' +
      '#nanzz-player-widget .np-info{flex-grow:1;min-width:0;}' +
      '#nanzz-player-widget .np-title{font-size:.66rem;color:#E7E9E4;white-space:nowrap;' +
      'overflow:hidden;text-overflow:ellipsis;}' +
      '#nanzz-player-widget .np-sub{font-size:.58rem;color:#7C848B;margin-top:.15rem;}' +
      '#nanzz-player-widget button{background:none;border:1px solid rgba(231,233,228,0.15);' +
      "color:#E8A33D;font-family:'JetBrains Mono',monospace;font-size:.7rem;cursor:pointer;" +
      'padding:.32rem .5rem;flex-shrink:0;}' +
      '#nanzz-player-widget button:hover{background:#E8A33D;color:#0B0D10;}' +
      '#nanzz-yt-mount{position:absolute;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;}';
    document.head.appendChild(style);
  }

  function loadState(){
    try{
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch(e){ return null; }
  }
  function saveState(state){
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch(e){}
  }
  function clearState(){
    try{ localStorage.removeItem(STORAGE_KEY); } catch(e){}
  }

  function ensureYTApi(cb){
    if(window.YT && window.YT.Player){ cb(); return; }
    if(!document.getElementById('nanzz-yt-api')){
      var tag = document.createElement('script');
      tag.id = 'nanzz-yt-api';
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }
    var prevCb = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = function(){
      if(prevCb) prevCb();
      cb();
    };
  }

  function setToggleIcon(state){
    if(!widgetEl) return;
    var btn = widgetEl.querySelector('[data-action="toggle"]');
    if(btn) btn.textContent = state === 1 ? '⏸' : '▶';
  }

  function buildWidget(state){
    injectStyles();
    if(widgetEl) widgetEl.remove();
    widgetEl = document.createElement('div');
    widgetEl.id = 'nanzz-player-widget';
    widgetEl.innerHTML =
      '<img src="https://i.ytimg.com/vi/' + state.videoId + '/default.jpg" alt="">' +
      '<div class="np-info">' +
        '<div class="np-title">' + (state.title || 'Memutar musik') + '</div>' +
        '<div class="np-sub">NANZZ_HUB &middot; latar</div>' +
      '</div>' +
      '<button data-action="toggle">▶</button>' +
      '<button data-action="stop">&times;</button>' +
      '<div id="nanzz-yt-mount"></div>';
    document.body.appendChild(widgetEl);
    requestAnimationFrame(function(){ widgetEl.classList.add('is-in'); });

    widgetEl.querySelector('[data-action="toggle"]').addEventListener('click', function(){
      if(!ytPlayer) return;
      var s = ytPlayer.getPlayerState();
      if(s === 1) ytPlayer.pauseVideo();
      else ytPlayer.playVideo();
    });
    widgetEl.querySelector('[data-action="stop"]').addEventListener('click', function(){
      if(ytPlayer && ytPlayer.stopVideo) ytPlayer.stopVideo();
      if(saveTimer) clearInterval(saveTimer);
      clearState();
      if(widgetEl){ widgetEl.remove(); widgetEl = null; }
    });
  }

  function startPlayer(state){
    ensureYTApi(function(){
      buildWidget(state);
      ytPlayer = new YT.Player('nanzz-yt-mount', {
        videoId: state.videoId,
        playerVars: { autoplay: 1, start: Math.floor(state.time || 0), controls: 0 },
        events: {
          onReady: function(e){
            try{ e.target.playVideo(); } catch(err){}
          },
          onStateChange: function(e){ setToggleIcon(e.data); }
        }
      });

      if(saveTimer) clearInterval(saveTimer);
      saveTimer = setInterval(function(){
        if(!ytPlayer || !ytPlayer.getCurrentTime) return;
        var current = loadState();
        if(!current) return;
        current.time = ytPlayer.getCurrentTime();
        saveState(current);
      }, 2000);

      window.addEventListener('beforeunload', function(){
        if(!ytPlayer || !ytPlayer.getCurrentTime) return;
        var current = loadState();
        if(!current) return;
        current.time = ytPlayer.getCurrentTime();
        saveState(current);
      });
    });
  }

  // Mulai memutar lagu baru (dipanggil dari halaman pemilih lagu)
  window.NanzzPlayer.play = function(videoId, title){
    var state = { videoId: videoId, title: title, time: 0 };
    saveState(state);
    startPlayer(state);
  };

  // Panggil ini di setiap halaman (hub & modul) supaya lagu yang sedang
  // berjalan otomatis dilanjutkan begitu halaman ini termuat.
  window.NanzzPlayer.mount = function(){
    var state = loadState();
    if(!state || !state.videoId) return;
    startPlayer(state);
  };

  window.NanzzPlayer.stop = function(){
    if(saveTimer) clearInterval(saveTimer);
    clearState();
    if(widgetEl){ widgetEl.remove(); widgetEl = null; }
  };
})();
