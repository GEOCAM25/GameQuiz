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

  let CATS = null, cur = null, player = null, onExit = null, needShuffle = false, stage = null;

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
    setupStage();     // sesión en red + QR para los teléfonos
    await loadYT();
    if (!(window.YT && window.YT.Player)){
      showMsg("⚠️ No se pudo cargar el reproductor de YouTube. Revisa tu conexión.");
      return;
    }
    createPlayer();
  }

  function close(){
    try { if (stage && stage.destroy) stage.destroy(); } catch(e){} stage = null;
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
        <div class="kar-beams"></div>
        <div class="kar-floor"></div>
        <div class="kar-notes"><i>🎵</i><i>🎶</i><i>🎵</i><i>🎶</i></div>
        <div class="kar-ball"><div class="kb-cord"></div><div class="kb-sphere"></div><div class="kb-spark"></div></div>
        <div class="kar-topbar">
          <button class="kar-close" id="karClose">✕</button>
          <div class="kar-title"><span class="kar-mic">🎤</span><span class="kar-neon">KARAOKE</span><span class="kar-disco">🪩</span></div>
          <span class="kar-spacer"></span>
        </div>
        <div class="kar-body">
          <div class="kar-videowrap">
            <div class="kar-screenframe">
              <div id="ytHolder"></div>
              <div class="kar-msg" id="karMsg" hidden></div>
            </div>
          </div>
          <div class="kar-panel">
            <div class="kar-now" id="karNow">
              <span class="kar-eq"><i></i><i></i><i></i><i></i></span>
              <span class="kar-nowtitle" id="karNowTitle">Elige una categoría 🎶</span>
            </div>
            <div class="kar-controls">
              <button class="kar-ctrl" id="karPrev" title="Anterior">⏮</button>
              <button class="kar-ctrl kar-play" id="karPlay" title="Reproducir/Pausar">⏸</button>
              <button class="kar-ctrl" id="karNext" title="Siguiente">⏭</button>
            </div>
            <div class="kar-cats" id="karCats"></div>
            <div class="kar-qr" id="karQR"></div>
          </div>
        </div>
      </div>`;
    $("#karClose").onclick = () => { try { Sfx.click(); } catch(e){} close(); };
    $("#karPrev").onclick  = () => { if (stage) stage.dispatchLocal({ t:"prev" }); else if (player) { try { player.previousVideo(); } catch(e){} } };
    $("#karNext").onclick  = () => { if (stage) stage.dispatchLocal({ t:"skip" }); else if (player) { try { player.nextVideo(); } catch(e){} } };
    $("#karPlay").onclick  = () => { if (stage){ const st = stage.getState(); stage.dispatchLocal({ t: st.playing ? "pause" : "play" }); } else togglePlay(); };
    drawCats();
    showScreen();
  }

  // ---------- sesión en red (escenario) + QR ----------
  function setupStage(){
    if (typeof KarSync === "undefined") return;
    if (typeof sb === "undefined" || !sb) return;   // sin backend no hay control remoto (el karaoke igual funciona)
    try { if (stage && stage.destroy) stage.destroy(); } catch(e){}
    stage = KarSync.startStage({ category: cur, onFx: applyFx });
    renderQR();
  }
  function renderQR(){
    const box = $("#karQR"); if (!box || !stage) return;
    box.innerHTML = `<div class="kar-qr-inner">${qrSVG(stage.joinURL(), 92)}</div>
      <div class="kar-qr-cap">📱 Escanea para cantar y controlar<b>${stage.code}</b></div>`;
  }
  // Aplica al reproductor de YouTube los efectos que decide el estado en red
  function applyFx(fx){
    if (!fx) return;
    try {
      if (fx.type === "load"){ hideMsg(); needShuffle = false; if (player && player.loadVideoById) player.loadVideoById(fx.vid); }
      else if (fx.type === "playlist"){ cur = fx.cat || cur; drawCats(); loadCur(); }
      else if (fx.type === "play"){ if (player && player.playVideo) player.playVideo(); }
      else if (fx.type === "pause"){ if (player && player.pauseVideo) player.pauseVideo(); }
      else if (fx.type === "songVol"){ if (player && player.setVolume) player.setVolume(fx.v); }
    } catch(e){}
  }
  function qrSVG(text, size){
    try {
      if (typeof qrcode === "undefined") throw new Error("qr");
      const qr = qrcode(0, "M"); qr.addData(text); qr.make();
      const n = qr.getModuleCount(), cell = size / n; let rects = "";
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++)
        if (qr.isDark(y, x)) rects += `<rect x="${(x*cell).toFixed(2)}" y="${(y*cell).toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}"/>`;
      return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><rect width="${size}" height="${size}" fill="#fff"/><g fill="#111">${rects}</g></svg>`;
    } catch(e){ return `<div class="kar-qr-cap">Código: <b>${stage ? stage.code : ""}</b></div>`; }
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
    cur = id;
    try { Sfx.click(); } catch(e){}
    drawCats();
    if (stage) stage.setCategory(id);   // el escenario decide y avisa a los controles
    else if (player) loadCur();
  }

  function currentCat(){ return CATS.find(c => c.id === cur) || {}; }

  function showMsg(txt){
    const m = $("#karMsg");
    if (!m) return;
    m.hidden = false; m.style.display = "flex";   // inline gana al display:flex de la clase
    m.innerHTML = txt;
  }
  function hideMsg(){ const m = $("#karMsg"); if (m){ m.hidden = true; m.style.display = "none"; } }

  // ---------- reproductor ----------
  function createPlayer(){
    try { if (player && player.destroy) player.destroy(); } catch(e){}
    player = new YT.Player("ytHolder", {
      width: "100%", height: "100%",
      // www.youtube.com (no el modo nocookie): así el reproductor usa la sesión
      // de YouTube del navegador — si el usuario tiene Premium y está logueado,
      // NO le aparecen anuncios.
      host: "https://www.youtube.com",
      playerVars: { rel: 0, modestbranding: 1, playsinline: 1, iv_load_policy: 3, fs: 1, origin: location.origin },
      events: {
        onReady: () => { try { if (player && player.setVolume) player.setVolume(stage ? stage.getState().songVol : 60); } catch(e){} loadCur(); },
        onError: onError,
        onStateChange: onState
      }
    });
  }

  function loadCur(){
    const cat = currentCat();
    // 1) Búsqueda automática de karaokes INCRUSTABLES (si hay clave de API y query)
    if (cat.buscar && typeof YOUTUBE_API_KEY !== "undefined" && YOUTUBE_API_KEY){
      searchAndLoad(cat); return;
    }
    // 2) Playlist / lista de videos fija
    const p = parsePlaylist(cat.playlist);
    if (p){ loadFromParsed(p); return; }
    // 3) Nada configurado todavía
    showMsg(`<b>${cat.emoji || "🎤"} ${cat.nombre}</b><br><br>Esta categoría aún no tiene canciones.<br>
      Pega tu <b>clave de YouTube</b> en <code>js/config.js</code> (búsqueda automática de karaokes)
      o un link de playlist en <code>data/karaoke.json</code>.`);
    try { if (player && player.stopVideo) player.stopVideo(); } catch(e){}
  }
  function loadFromParsed(p){
    hideMsg(); needShuffle = true;
    try {
      if (p.type === "playlist") player.loadPlaylist({ list: p.id, listType: "playlist", index: 0 });
      else player.loadPlaylist(p.ids);
    } catch(e){ showMsg("⚠️ No se pudo cargar la playlist. Revisa el link en data/karaoke.json."); }
  }
  // Busca en YouTube SOLO videos que permiten incrustarse (videoEmbeddable=true),
  // así nunca sale el error de "no se puede reproducir". Se actualiza solo.
  const searchCache = {};   // resultados por categoría (evita gastar cuota al volver a una categoría)
  async function searchAndLoad(cat){
    // Si ya buscamos esta categoría en la sesión, reusamos (no gasta cuota)
    if (searchCache[cat.id] && searchCache[cat.id].length){
      if (cat.id !== cur) return;
      hideMsg(); needShuffle = true; player.loadPlaylist(searchCache[cat.id]); return;
    }
    showMsg("🔎 Buscando karaokes…");
    try {
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&videoSyndicated=true&maxResults=25&q=${encodeURIComponent(cat.buscar)}&key=${YOUTUBE_API_KEY}`;
      const r = await fetch(url);
      const j = await r.json();
      if (j.error) throw new Error(j.error.message || "error");
      const ids = (j.items || []).filter(it => it.id && it.id.videoId).map(it => it.id.videoId);
      if (!ids.length) throw new Error("sin resultados");
      searchCache[cat.id] = ids;
      if (cat.id !== cur) return;   // el usuario ya cambió de categoría
      hideMsg(); needShuffle = true;
      player.loadPlaylist(ids);
    } catch(e){
      // Respaldo: si hay playlist fija, úsala; si no, avisa
      const p = parsePlaylist(cat.playlist);
      if (p) loadFromParsed(p);
      else showMsg("⚠️ No se pudieron buscar karaokes. Revisa tu clave de YouTube en <code>js/config.js</code>.");
    }
  }

  function onState(ev){
    // Si terminó una canción DE LA COLA (0 = ENDED), avanzar a la siguiente.
    // En modo playlist (now=null) dejamos que YouTube avance solo.
    if (ev.data === 0 && stage){
      const st = stage.getState();
      if (st.now){ stage.dispatchLocal({ t:"skip" }); return; }
    }
    // 1 = reproduciendo, 5 = en cola: aplicar orden aleatorio una vez por carga
    if (needShuffle && (ev.data === 1 || ev.data === 5)){
      needShuffle = false;
      try {
        player.setShuffle(true);
        const list = player.getPlaylist && player.getPlaylist();
        if (list && list.length > 1) player.playVideoAt(Math.floor(Math.random() * list.length));
      } catch(e){}
    }
    if (ev.data === 1) hideMsg();   // ya está sonando → quitar cualquier aviso que tape el video
    updatePlayBtn();
    updateNowPlaying();
  }
  function updatePlayBtn(){
    const btn = $("#karPlay"); if (!btn || !player || !player.getPlayerState) return;
    let st; try { st = player.getPlayerState(); } catch(e){ return; }
    btn.textContent = (st === 1) ? "⏸" : "▶";
  }
  // Muestra el título de la canción actual + anima el ecualizador si suena
  function updateNowPlaying(){
    const now = $("#karNow"); if (!now || !player) return;
    let title = "", playing = false;
    try { title = (player.getVideoData && player.getVideoData().title) || ""; } catch(e){}
    try { playing = player.getPlayerState && player.getPlayerState() === 1; } catch(e){}
    const t = $("#karNowTitle"); if (t) t.textContent = title || "Karaoke 🎤";
    now.classList.toggle("playing", playing);
  }
  function togglePlay(){
    if (!player) return;
    try {
      const st = player.getPlayerState();
      if (st === 1) player.pauseVideo(); else player.playVideo();
    } catch(e){}
  }
  function onError(){
    showMsg("⏭️ Saltando a la siguiente canción…");
    setTimeout(() => { try { if (player) player.nextVideo(); hideMsg(); } catch(e){} }, 1200);
  }

  function showScreen(){
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    const scr = $("#scr-karaoke"); if (scr) scr.classList.add("active");
  }

  return {
    open,
    categories: () => (CATS || []).map(c => ({ id:c.id, nombre:c.nombre, emoji:c.emoji })),
    _parsePlaylist: parsePlaylist,   // expuesto solo para pruebas
  };
})();
