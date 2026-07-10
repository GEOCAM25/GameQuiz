// ============================================================
// GAME QUIZ — KARAOKE 🎤
// Juego para cantar: reproduce videos de YouTube al azar de la
// playlist de la categoría elegida, con estética de discoteca
// (bola de disco, micrófonos y luces). El video va casi a
// pantalla completa, tanto en el teléfono como en la TV.
//
// Las playlists se cargan desde data/karaoke.json — ahí se pegan
// los IDs/links de las playlists de YouTube. La categoría marcada
// como "principal" (La Tómbola Loca) se abre por defecto.
//
// Nota: los anuncios de YouTube NO se pueden bloquear dentro de un
// reproductor incrustado; usar playlists de canales oficiales de
// karaoke reduce la cantidad de anuncios.
// ============================================================
const Karaoke = (() => {
  const $  = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  let CATS = null, cur = null, player = null, onExit = null, needShuffle = false;

  // ---------- datos ----------
  async function ensureCats(){
    if (CATS) return CATS;
    const r = await fetch("data/karaoke.json", { cache: "no-store" });
    const j = await r.json();
    CATS = (j.categorias || []).filter(c => c && c.id);
    return CATS;
  }
  function defaultCat(){
    return (CATS.find(c => c.principal) || CATS[0] || {}).id;
  }

  // ---------- parseo de playlist / videos ----------
  function extractVideoId(tok){
    tok = (tok || "").trim(); if (!tok) return null;
    const m = tok.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/);
    if (m) return m[1];
    if (/^[\w-]{11}$/.test(tok)) return tok;
    return null;
  }
  function parsePlaylist(str){
    const s = (str || "").trim();
    if (!s) return null;
    let m = s.match(/[?&]list=([\w-]+)/);
    if (m) return { type: "playlist", id: m[1] };
    if (/^(PL|OL|UU|RD|FL|LL)[\w-]{10,}$/.test(s)) return { type: "playlist", id: s };
    const ids = s.split(/[\s,]+/).map(extractVideoId).filter(Boolean);
    if (ids.length) return { type: "videos", ids };
    return null;
  }

  // ---------- API de YouTube ----------
  function loadYT(){
    return new Promise(resolve => {
      if (window.YT && window.YT.Player) return resolve();
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { if (prev) { try { prev(); } catch(e){} } resolve(); };
      if (!document.getElementById("yt-iframe-api")){
        const s = document.createElement("script");
        s.id = "yt-iframe-api";
        s.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(s);
      }
      // respaldo por si el script ya estaba cargando
      let tries = 0;
      const iv = setInterval(() => {
        if (window.YT && window.YT.Player){ clearInterval(iv); resolve(); }
        else if (++tries > 120){ clearInterval(iv); resolve(); }
      }, 100);
    });
  }

  // ============================================================
  //  API pública
  // ============================================================
  async function open(exitCb){
    onExit = exitCb || null;
    try { if (typeof Music !== "undefined") Music.pause(); } catch(e){}   // no pisar el audio del karaoke
    const host = $("#karaokeScreen");
    host.innerHTML = `<div class="kar-loading">Preparando el escenario… 🎤</div>`;
    showScreen();
    try { await ensureCats(); }
    catch(e){ host.innerHTML = `<div class="kar-loading">No se pudo cargar el karaoke.<br>Revisa data/karaoke.json</div>`; return; }
    if (!CATS.length){ host.innerHTML = `<div class="kar-loading">Aún no hay categorías.</div>`; return; }
    cur = defaultCat();
    render();
    await loadYT();
    if (!(window.YT && window.YT.Player)){
      showMsg("⚠️ No se pudo cargar el reproductor de YouTube. Revisa tu conexión.");
      return;
    }
    createPlayer();
  }

  function close(){
    try { if (player && player.destroy) player.destroy(); } catch(e){}
    player = null;
    if (onExit) onExit(); else showFallbackHome();
  }
  function showFallbackHome(){
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    const h = $("#scr-home"); if (h) h.classList.add("active");
  }

  // ---------- interfaz (escenario disco) ----------
  function render(){
    const host = $("#karaokeScreen");
    host.innerHTML = `
      <div class="kar-stage">
        <div class="kar-lights"></div>
        <div class="kar-topbar">
          <button class="kar-close" id="karClose">✕</button>
          <div class="kar-title"><span class="kar-mic left">🎤</span><span class="kar-neon">KARAOKE</span><span class="kar-mic right">🎤</span></div>
          <div class="kar-disco">🪩</div>
        </div>
        <div class="kar-videowrap">
          <div class="kar-screenframe">
            <div id="ytHolder"></div>
            <div class="kar-msg" id="karMsg" hidden></div>
          </div>
        </div>
        <div class="kar-controls">
          <button class="kar-ctrl" id="karPrev" title="Anterior">⏮</button>
          <button class="kar-ctrl kar-play" id="karPlay" title="Reproducir/Pausar">⏸</button>
          <button class="kar-ctrl" id="karNext" title="Siguiente">⏭</button>
        </div>
        <div class="kar-cats" id="karCats"></div>
        <p class="kar-note">💡 Consejo: usa playlists de canales oficiales de karaoke para menos anuncios.</p>
      </div>`;
    $("#karClose").onclick = () => { try { Sfx.click(); } catch(e){} close(); };
    $("#karPrev").onclick  = () => { try { if (player) player.previousVideo(); } catch(e){} };
    $("#karNext").onclick  = () => { try { if (player) player.nextVideo(); } catch(e){} };
    $("#karPlay").onclick  = togglePlay;
    drawCats();
    showScreen();
  }

  function drawCats(){
    const wrap = $("#karCats");
    wrap.innerHTML = "";
    CATS.forEach(c => {
      const b = document.createElement("button");
      b.className = "kar-chip" + (c.id === cur ? " on" : "") + (c.principal ? " main" : "");
      b.innerHTML = `<span class="kc-emoji">${c.emoji || "🎵"}</span><span class="kc-name">${c.nombre}</span><span class="kc-desc">${c.desc || ""}</span>`;
      b.onclick = () => pickCat(c.id);
      wrap.appendChild(b);
    });
  }

  function pickCat(id){
    if (id === cur && player) { loadCur(); return; }
    cur = id;
    try { Sfx.click(); } catch(e){}
    drawCats();
    if (player) loadCur();
  }

  function currentCat(){ return CATS.find(c => c.id === cur) || {}; }

  function showMsg(txt){
    const m = $("#karMsg");
    if (!m) return;
    m.hidden = false;
    m.innerHTML = txt;
  }
  function hideMsg(){ const m = $("#karMsg"); if (m) m.hidden = true; }

  // ---------- reproductor ----------
  function createPlayer(){
    try { if (player && player.destroy) player.destroy(); } catch(e){}
    player = new YT.Player("ytHolder", {
      width: "100%", height: "100%",
      host: "https://www.youtube-nocookie.com",
      playerVars: { rel: 0, modestbranding: 1, playsinline: 1, iv_load_policy: 3, fs: 1, origin: location.origin },
      events: {
        onReady: () => loadCur(),
        onError: onError,
        onStateChange: onState
      }
    });
  }

  function loadCur(){
    const cat = currentCat();
    const p = parsePlaylist(cat.playlist);
    if (!p){
      showMsg(`<b>${cat.emoji || "🎤"} ${cat.nombre}</b><br><br>Esta categoría todavía no tiene playlist.<br>
        Pega el link o ID de tu playlist de YouTube en <code>data/karaoke.json</code>
        (campo <code>playlist</code>).`);
      try { if (player && player.stopVideo) player.stopVideo(); } catch(e){}
      return;
    }
    hideMsg();
    needShuffle = true;
    try {
      if (p.type === "playlist") player.loadPlaylist({ list: p.id, listType: "playlist", index: 0 });
      else player.loadPlaylist(p.ids);
    } catch(e){
      showMsg("⚠️ No se pudo cargar la playlist. Revisa el ID/link en data/karaoke.json.");
    }
  }

  function onState(ev){
    // 1 = reproduciendo, 5 = en cola: aplicar orden aleatorio una vez por carga
    if (needShuffle && (ev.data === 1 || ev.data === 5)){
      needShuffle = false;
      try {
        player.setShuffle(true);
        const list = player.getPlaylist && player.getPlaylist();
        if (list && list.length > 1) player.playVideoAt(Math.floor(Math.random() * list.length));
      } catch(e){}
    }
    updatePlayBtn();
  }
  function updatePlayBtn(){
    const btn = $("#karPlay"); if (!btn || !player || !player.getPlayerState) return;
    let st; try { st = player.getPlayerState(); } catch(e){ return; }
    btn.textContent = (st === 1) ? "⏸" : "▶";
  }
  function togglePlay(){
    if (!player) return;
    try {
      const st = player.getPlayerState();
      if (st === 1) player.pauseVideo(); else player.playVideo();
    } catch(e){}
  }
  function onError(){
    showMsg("⚠️ Este video no se pudo reproducir (puede estar bloqueado o no permite incrustarse).<br>Saltando al siguiente…");
    setTimeout(() => { try { if (player) player.nextVideo(); hideMsg(); } catch(e){} }, 1800);
  }

  function showScreen(){
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    const scr = $("#scr-karaoke"); if (scr) scr.classList.add("active");
  }

  return { open, _parsePlaylist: parsePlaylist };   // _parsePlaylist expuesto solo para pruebas
})();
