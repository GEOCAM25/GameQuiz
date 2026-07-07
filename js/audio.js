// ===== Sonidos (WebAudio, sin archivos) + vibración =====
const Sfx = (() => {
  let ctx = null;
  const ac = () => (ctx ||= new (window.AudioContext || window.webkitAudioContext)());
  const unlock = () => {
    try { ac().resume(); } catch(e){}
    // Truco necesario para iPhone: si el celular está en modo vibrar (silencio),
    // Safari SILENCIA el Web Audio API por defecto. Reproducir, aunque sea un
    // instante, un <audio> HTML normal (no Web Audio) obliga a iOS a tratar la
    // sesión de audio de la página como "multimedia" en vez de "llamada/timbre",
    // y a partir de ahí también se escuchan los sonidos del juego con el
    // celular en silencio.
    silentUnlock.play().catch(()=>{});
  };
  document.addEventListener("pointerdown", unlock, { once:true });

  // WAV silencioso en loop: mantiene la sesión de audio de iOS activa como
  // "multimedia" mientras dura la partida.
  const silentUnlock = new Audio("data:audio/wav;base64,UklGRoQCAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQACAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA=");
  silentUnlock.loop = true;
  silentUnlock.volume = 1; // el WAV en sí es silencio total (todo 0x80 = cero)

  function tone(freq, dur=0.15, type="sine", vol=0.25, when=0){
    try{
      const a = ac(), o = a.createOscillator(), g = a.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, a.currentTime + when);
      g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + when + dur);
      o.connect(g).connect(a.destination);
      o.start(a.currentTime + when); o.stop(a.currentTime + when + dur + 0.05);
    }catch(e){}
  }
  const vib = p => { try{ navigator.vibrate && navigator.vibrate(p); }catch(e){} };

  return {
    click(){ tone(600,0.06,"square",0.12); vib(15); },
    tick(){ tone(880,0.05,"square",0.08); },
    urgent(){ tone(1200,0.07,"square",0.15); vib(30); },
    countdown(){ tone(523,0.2,"triangle",0.3); vib(60); },
    go(){ tone(523,0.12,"triangle",0.3); tone(659,0.12,"triangle",0.3,0.12); tone(784,0.25,"triangle",0.35,0.24); vib([60,40,120]); },
    pick(){ tone(700,0.1,"sine",0.2); vib(25); },
    correct(){ [523,659,784,1047].forEach((f,i)=>tone(f,0.14,"triangle",0.3,i*0.09)); vib([50,30,50,30,120]); },
    wrong(){ tone(220,0.3,"sawtooth",0.22); tone(180,0.35,"sawtooth",0.2,0.1); vib([200]); },
    board(){ tone(440,0.1,"triangle",0.2); tone(554,0.1,"triangle",0.2,0.1); },
    msg(){ tone(900,0.08,"sine",0.15); },
    join(){ tone(659,0.1,"triangle",0.2); tone(880,0.15,"triangle",0.2,0.1); },
    leave(){ tone(440,0.12,"triangle",0.2); tone(330,0.2,"triangle",0.2,0.12); },
    fanfare(){ [523,659,784,1047,784,1047,1319].forEach((f,i)=>tone(f,0.22,"triangle",0.32,i*0.14)); vib([100,50,100,50,300]); },
  };
})();

// ============================================================
// Música de fondo: playlist propia, control INDIVIDUAL por celular
// (cada quien puede pausar/cambiar canción/subir o silenciar el volumen
// sin afectar a los demás) + un interruptor del ANFITRIÓN para sincronizar
// a todos en la misma canción y en el mismo punto exacto.
// ============================================================
const Music = (() => {
  const el = new Audio();
  el.loop = false;   // el avance de canción lo maneja "order" (aleatorio), no el loop nativo
  el.preload = "auto";

  const LS_TRACK = "gq_music_track";
  const LS_VOL   = "gq_music_vol";
  const LS_MUTED = "gq_music_muted";

  let trackIdx = 0;
  let userVol = parseFloat(localStorage.getItem(LS_VOL));
  if (isNaN(userVol)) userVol = 0.25;         // 25% por defecto
  let muted = localStorage.getItem(LS_MUTED) === "1";
  let started = false;
  let inGame = false;                          // true = baja a 10% (concentración)
  let syncState = null;                        // último { on, trackId, startedAt } de la sala
  let onUpdateUI = () => {};
  let hasError = false;

  // ---- Orden aleatorio de reproducción (tipo "shuffle") ----
  let order = [];   // índices de MUSIC_TRACKS en orden barajado
  let shufflePos = -1;  // posición actual dentro de "order"

  // ---- Atenuación ("ducking") mientras suena otro efecto (correcto/incorrecto/ganador/inicio) ----
  let duckCount = 0;
  let fadeRAF = null;

  // Si el archivo no carga (nombre mal escrito, no se subió, etc.), se
  // muestra un aviso claro en el panel en vez de fallar en silencio.
  el.addEventListener("error", () => { hasError = true; onUpdateUI(); });
  el.addEventListener("canplay", () => { hasError = false; onUpdateUI(); });

  // Al terminar una canción: si el anfitrión sincronizó, se repite ella misma
  // (es él quien decide cuándo cambiar); si no, pasa sola a otra al azar.
  el.addEventListener("ended", () => {
    if (syncState && syncState.on){
      try { el.currentTime = 0; } catch(e){}
      el.play().catch(()=>{});
    } else {
      advance(1);
    }
  });

  const savedTrack = localStorage.getItem(LS_TRACK);
  if (savedTrack){
    const i = MUSIC_TRACKS.findIndex(t => t.id === savedTrack);
    if (i >= 0) trackIdx = i;
  }

  function shuffledIdxs(){
    const a = MUSIC_TRACKS.map((_,i)=>i);
    for (let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
    return a;
  }
  // Arma una vuelta nueva del "mazo" aleatorio, evitando repetir de inmediato
  // la última canción que sonó.
  function buildOrder(avoidIdx){
    const a = shuffledIdxs();
    if (avoidIdx != null && a.length > 1 && a[0] === avoidIdx){ [a[0],a[1]] = [a[1],a[0]]; }
    return a;
  }
  function ensureOrder(){
    if (order.length) return;
    order = buildOrder(null);
    const oi = order.indexOf(trackIdx);
    if (oi > 0){ [order[0], order[oi]] = [order[oi], order[0]]; }
    shufflePos = 0;
  }
  function advance(dir){
    ensureOrder();
    if (dir > 0){
      shufflePos++;
      if (shufflePos >= order.length){ order = buildOrder(order[order.length-1]); shufflePos = 0; }
    } else {
      shufflePos--;
      if (shufflePos < 0){ order = buildOrder(trackIdx); shufflePos = order.length - 1; }
    }
    loadTrack(order[shufflePos]);
  }

  function effectiveVolume(){ return muted ? 0 : (inGame ? 0.10 : userVol); }
  // Mientras hay un efecto sonando encima (duckCount>0), la música baja a
  // una fracción de su volumen normal en vez de silenciarse del todo.
  const DUCK_MULT = 0.35;
  function targetVolume(){ return effectiveVolume() * (duckCount > 0 ? DUCK_MULT : 1); }
  function applyVolume(){ el.volume = targetVolume(); onUpdateUI(); }
  function fadeVolume(target, ms){
    cancelAnimationFrame(fadeRAF);
    const start = el.volume, t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / ms);
      el.volume = start + (target - start) * p;
      if (p < 1) fadeRAF = requestAnimationFrame(step);
    };
    fadeRAF = requestAnimationFrame(step);
  }
  // Llamar duck() justo antes de reproducir un efecto (correcto/incorrecto/
  // ganador/inicio) y unduck() cuando termine. Soporta efectos superpuestos
  // gracias al contador: solo baja en el primero y solo sube en el último.
  function duck(){ duckCount++; if (duckCount === 1) fadeVolume(targetVolume(), 150); }
  function unduck(){ duckCount = Math.max(0, duckCount - 1); if (duckCount === 0) fadeVolume(targetVolume(), 320); }

  function currentTrack(){ return MUSIC_TRACKS[trackIdx]; }

  function loadTrack(idx, playFrom){
    trackIdx = ((idx % MUSIC_TRACKS.length) + MUSIC_TRACKS.length) % MUSIC_TRACKS.length;
    const t = MUSIC_TRACKS[trackIdx];
    el.src = t.file;
    applyVolume();
    localStorage.setItem(LS_TRACK, t.id);
    if (started){
      const go = () => { try{ el.currentTime = playFrom || 0; }catch(e){} el.play().catch(()=>{}); };
      if (el.readyState >= 1) go(); else el.addEventListener("loadedmetadata", go, { once:true });
    }
    onUpdateUI();
  }
  // Mover la posición de reproducción dentro de la canción actual
  // (arrastrar la barra de progreso). frac: 0..1
  function seekTo(frac){
    const dur = el.duration && isFinite(el.duration) ? el.duration : (currentTrack()?.duration || 180);
    try { el.currentTime = Math.max(0, Math.min(1, frac)) * dur; } catch(e){}
    onUpdateUI();
  }

  // Arranca sola en cuanto el jugador crea su perfil / entra a una sala o partida.
  function enterGame(){
    if (started || !MUSIC_TRACKS.length) return;
    started = true;
    if (syncState && syncState.on) applySyncState(syncState);
    else { ensureOrder(); loadTrack(trackIdx); el.play().catch(()=>{}); }
  }

  // Red de seguridad: en iOS/Android el primer play() puede ser bloqueado si
  // no vino de un toque directo. Si eso pasa, el próximo toque en la pantalla
  // lo reintenta solo (sin volver a mostrar nada raro al usuario).
  document.addEventListener("pointerdown", () => { if (started && el.paused && !muted) el.play().catch(()=>{}); });

  function play(){ if (!started) return enterGame(); el.play().catch(()=>{}); onUpdateUI(); }
  function pause(){ el.pause(); onUpdateUI(); }
  function togglePlay(){ el.paused ? play() : pause(); }
  // Adelantar/retroceder de canción: funciona siempre, incluso si el
  // anfitrión sincronizó la música para todos (ese celular pasa a moverse
  // por su cuenta hasta que el anfitrión vuelva a sincronizar).
  function next(){ advance(1); }
  function prev(){ advance(-1); }

  function setVolume(v){ userVol = Math.max(0, Math.min(1, v)); localStorage.setItem(LS_VOL, String(userVol)); if (muted && userVol>0){ muted=false; localStorage.setItem(LS_MUTED,"0"); } applyVolume(); }
  function toggleMute(){ muted = !muted; localStorage.setItem(LS_MUTED, muted ? "1":"0"); applyVolume(); if(!muted) el.play().catch(()=>{}); }

  // Se llama con cada cambio de estado de la sala (lobby/countdown/question/...).
  // Al comenzar la partida, baja sola a 10% para no distraer; al volver al
  // lobby o al podio, regresa al volumen que el jugador tenía elegido.
  function setGamePhase(status){
    const active = ["countdown","question","reveal","board","mini"].includes(status);
    if (active === inGame) return;
    inGame = active;
    applyVolume();
  }

  // ---- Sincronía entre dispositivos (la activa el anfitrión) ----
  // Se guarda en room.settings.musicSync = { on, trackId, startedAt(ms) }.
  // Cada celular calcula su posición como (ahora - startedAt) % duración,
  // así todos suenan exactamente igual y quien se reconecta cae en el mismo
  // punto, sin desfase, sin importar cuándo entró.
  function applySyncState(sync){
    const idx = MUSIC_TRACKS.findIndex(t => t.id === sync.trackId);
    if (idx < 0) return;
    const t = MUSIC_TRACKS[idx];
    trackIdx = idx;
    if (order.length){ const oi = order.indexOf(idx); if (oi >= 0) shufflePos = oi; }
    el.src = t.file;
    applyVolume();
    const seek = () => {
      const dur = el.duration && isFinite(el.duration) ? el.duration : (t.duration || 180);
      const pos = ((Date.now() - sync.startedAt) / 1000) % dur;
      try { el.currentTime = Math.max(0, pos); } catch(e){}
      el.play().catch(()=>{});
    };
    if (el.readyState >= 1) seek(); else el.addEventListener("loadedmetadata", seek, { once:true });
    onUpdateUI();
  }

  // Se llama cada vez que llega una actualización de la sala (Realtime, resync
  // al reconectar, etc.)
  function onRoomUpdate(room){
    const sync = room?.settings?.musicSync || null;
    const wasOn = !!(syncState && syncState.on);
    const changed = !syncState || (sync?.trackId !== syncState.trackId) || (sync?.startedAt !== syncState.startedAt) || (!!sync?.on !== wasOn);
    syncState = sync;
    if (!started) return;
    if (sync && sync.on){
      if (changed) applySyncState(sync);
    } else if (wasOn){
      // El anfitrión apagó la sincronía: cada quien vuelve a su canción guardada.
      loadTrack(trackIdx);
      el.play().catch(()=>{});
    }
  }

  // El anfitrión prende/apaga la sincronía para todos.
  async function hostSetSync(on, room, sbClient){
    const settings = { ...room.settings };
    settings.musicSync = on
      ? { on:true, trackId: currentTrack().id, startedAt: Date.now() }
      : { on:false };
    await sbClient.from("rooms").update({ settings }).eq("id", room.id);
  }

  function bindUI(cb){ onUpdateUI = cb; cb(); }
  function state(){
    return { track: currentTrack(), playing: !el.paused, volume: userVol, muted, synced: !!(syncState && syncState.on),
      hasError, currentTime: el.currentTime||0, duration: el.duration||0 };
  }

  return { enterGame, play, pause, togglePlay, next, prev, setVolume, toggleMute,
           setGamePhase, onRoomUpdate, hostSetSync, bindUI, state, duck, unduck, seekTo };
})();

// ============================================================
// Ayuda compartida: mientras suena un efecto real (correcto/incorrecto/
// ganador/inicio), la música de fondo NO se detiene, solo baja de volumen
// (Music.duck) para que se escuche bien el efecto, y vuelve a subir sola
// al terminar (Music.unduck) — igual que cuando Google Maps habla encima
// de la música, pero sin bajarla tanto que no se escuche nada.
// ============================================================
function duckedPlay(a){
  let done1 = false;
  const finish = () => { if (done1) return; done1 = true; try{ Music.unduck(); }catch(e){} };
  try { Music.duck(); } catch(e){}
  a.addEventListener("ended", finish, { once:true });
  a.addEventListener("error", finish, { once:true });
  setTimeout(finish, 8000); // red de seguridad si el evento no llega a disparar
  a.play().catch(finish);
}

// ============================================================
// Sonidos "botón ganador": clips cortos (mp3) que solo el ganador de la
// ronda puede disparar. Se cachean como elementos <audio> reutilizables
// para que suenen al instante, sin recargar el archivo cada vez.
// ============================================================
const WinnerFx = (() => {
  const cache = {};
  function get(file){
    if (!cache[file]){
      const a = new Audio(file);
      a.preload = "auto";
      cache[file] = a;
    }
    return cache[file];
  }
  // Precarga silenciosa en el primer toque de la pantalla, para que el
  // audio ya esté "desbloqueado" en iOS cuando de verdad se necesite sonar.
  function warmUp(){
    (WINNER_SOUNDS || []).forEach(s => { try{ get(s.file); }catch(e){} });
  }
  document.addEventListener("pointerdown", warmUp, { once:true });

  function play(idx){
    const s = (WINNER_SOUNDS || [])[idx];
    if (!s) return;
    try {
      const a = get(s.file);
      a.currentTime = 0;
      a.volume = 1;
      duckedPlay(a);
    } catch(e){}
  }
  return { play };
})();

// ============================================================
// Sonidos de acierto/error: uno al azar por pregunta, según si ese jugador
// acertó o falló. Mismo patrón de caché que WinnerFx.
// ============================================================
const OutcomeFx = (() => {
  const cache = {};
  function get(file){
    if (!cache[file]){ const a = new Audio(file); a.preload = "auto"; cache[file] = a; }
    return cache[file];
  }
  function warmUp(){
    (CORRECT_SOUNDS||[]).forEach(f => { try{ get(f); }catch(e){} });
    (INCORRECT_SOUNDS||[]).forEach(f => { try{ get(f); }catch(e){} });
  }
  document.addEventListener("pointerdown", warmUp, { once:true });

  function play(ok){
    const pool = ok ? CORRECT_SOUNDS : INCORRECT_SOUNDS;
    if (!pool || !pool.length) return;
    const file = pool[Math.floor(Math.random()*pool.length)];
    try {
      const a = get(file);
      a.currentTime = 0;
      a.volume = 1;
      duckedPlay(a);
    } catch(e){}
  }
  return { play };
})();

// ============================================================
// Sonido de bienvenida: suena una vez cada vez que alguien entra a una
// sala (al crearla o al unirse), como el "¡Inicio de partida!" de un show.
// ============================================================
const StartFx = (() => {
  let a = null;
  function play(){
    if (typeof GAME_START_SOUND === "undefined" || !GAME_START_SOUND) return;
    try {
      if (!a){ a = new Audio(GAME_START_SOUND); a.preload = "auto"; }
      a.currentTime = 0;
      a.volume = 1;
      duckedPlay(a);
    } catch(e){}
  }
  return { play };
})();
