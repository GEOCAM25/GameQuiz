// ===== Sonidos (WebAudio, sin archivos) + vibración =====
const Sfx = (() => {
  let ctx = null;
  // Interruptor global de EFECTOS del juego (tonos + acierto/ganador/inicio).
  // Independiente de la música. Se guarda en el teléfono.
  let sfxOn = localStorage.getItem("gq_sfx_off") !== "1";
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
    if (!sfxOn) return;
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
    setEnabled(on){ sfxOn = !!on; localStorage.setItem("gq_sfx_off", on ? "0" : "1"); },
    isEnabled(){ return sfxOn; },
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
  el.loop = true;
  el.preload = "auto";

  const LS_TRACK = "gq_music_track";
  const LS_VOL   = "gq_music_vol";
  const LS_MUTED = "gq_music_muted";

  let trackIdx = 0;
  let userVol = parseFloat(localStorage.getItem(LS_VOL));
  if (isNaN(userVol)) userVol = 0.08;         // 8% por defecto: música de fondo bien suave
  // Migración única: baja a 8% a quien ya tenía un volumen más alto guardado
  if (localStorage.getItem("gq_vol_v2") !== "1"){
    userVol = Math.min(userVol, 0.08);
    localStorage.setItem(LS_VOL, String(userVol));
    localStorage.setItem("gq_vol_v2", "1");
  }
  let muted = localStorage.getItem(LS_MUTED) === "1";
  let started = false;
  let userPaused = false;                      // true si el jugador pausó a propósito (no reintentar solo)
  let inGame = false;                          // true = baja a 10% (concentración)
  let syncState = null;                        // último { on, trackId, startedAt } de la sala
  let onUpdateUI = () => {};
  let hasError = false;

  // ---- "Ducking": cuando suena un efecto (correcto/incorrecto/ganador/
  // inicio), la música NO se pausa, solo baja de volumen un rato — como el
  // aviso de Google Maps sobre la música, pero sin dejarla inaudible: baja
  // solo hasta un 35% de lo que sonaba, no la silencia casi entera.
  const DUCK_FACTOR = 0.35;
  let duckCount = 0;         // puede haber varios efectos sonando casi juntos
  let rampFrame = null;

  function rampVolumeTo(target, ms){
    if (rampFrame) cancelAnimationFrame(rampFrame);
    const start = el.volume, t0 = performance.now();
    if (ms <= 0){ el.volume = target; onUpdateUI(); return; }
    const step = (now) => {
      const p = Math.min(1, (now - t0) / ms);
      el.volume = start + (target - start) * p;
      if (p < 1) rampFrame = requestAnimationFrame(step);
      else { rampFrame = null; onUpdateUI(); }
    };
    rampFrame = requestAnimationFrame(step);
  }

  // Si el archivo no carga (nombre mal escrito, no se subió, etc.), se
  // muestra un aviso claro en el panel en vez de fallar en silencio.
  el.addEventListener("error", () => { hasError = true; onUpdateUI(); });
  el.addEventListener("canplay", () => { hasError = false; onUpdateUI(); });

  const savedTrack = localStorage.getItem(LS_TRACK);
  if (savedTrack){
    const i = MUSIC_TRACKS.findIndex(t => t.id === savedTrack);
    if (i >= 0) trackIdx = i;
  }

  function effectiveVolume(){ return muted ? 0 : (inGame ? 0.06 : userVol); }
  function targetVolume(){ const v = effectiveVolume(); return duckCount > 0 ? v * DUCK_FACTOR : v; }
  function applyVolume(){ el.volume = targetVolume(); onUpdateUI(); }
  function currentTrack(){ return MUSIC_TRACKS[trackIdx]; }

  // Baja la música mientras suena un efecto (correcto/incorrecto/ganador/
  // inicio) y la sube de nuevo sola cuando termina. No la pausa nunca.
  function duck(){
    duckCount++;
    if (duckCount === 1) rampVolumeTo(targetVolume(), 90);   // baja rápido
  }
  function unduck(){
    duckCount = Math.max(0, duckCount - 1);
    if (duckCount === 0) rampVolumeTo(targetVolume(), 380);  // sube suave
  }

  function loadTrack(idx, playFrom){
    trackIdx = ((idx % MUSIC_TRACKS.length) + MUSIC_TRACKS.length) % MUSIC_TRACKS.length;
    const t = MUSIC_TRACKS[trackIdx];
    el.src = t.file;
    localStorage.setItem(LS_TRACK, t.id);
    if (started){
      const go = () => { try{ el.currentTime = playFrom || 0; }catch(e){} fadeInPlay(); };
      if (el.readyState >= 1) go(); else el.addEventListener("loadedmetadata", go, { once:true });
    } else {
      applyVolume();
    }
    onUpdateUI();
  }

  // Arranca en volumen 0 y sube suavemente hasta el volumen que corresponda
  // (nunca "de golpe" a todo volumen, ni al comenzar ni al reanudar).
  function fadeInPlay(){
    el.volume = 0;
    el.play().then(() => { userPaused = false; rampVolumeTo(targetVolume(), 450); })
      .catch(() => { applyVolume(); });
  }

  // Arranca sola en cuanto el jugador crea su perfil / entra a una sala o partida.
  function enterGame(){
    if (started || !MUSIC_TRACKS.length) return;
    started = true;
    if (syncState && syncState.on) applySyncState(syncState);
    else { loadTrack(trackIdx); fadeInPlay(); }
  }

  // Red de seguridad: en iOS/Android el primer play() puede ser bloqueado si
  // no vino de un toque directo. Si eso pasa, el próximo toque en la pantalla
  // lo reintenta solo (con fundido, nunca a todo volumen de golpe) — pero
  // SOLO si el jugador no la pausó a propósito; si la pausó, un toque
  // cualquiera en la pantalla (responder, chatear) ya no la resucita.
  document.addEventListener("pointerdown", () => {
    if (started && el.paused && !muted && !userPaused) fadeInPlay();
  });

  function play(){ if (!started) return enterGame(); fadeInPlay(); }
  function pause(){ userPaused = true; el.pause(); onUpdateUI(); }
  function togglePlay(){ el.paused ? play() : pause(); }
  // Elige un índice al azar DISTINTO al actual (si hay más de 1 canción).
  function randomIdx(){
    if (MUSIC_TRACKS.length <= 1) return trackIdx;
    let i;
    do { i = Math.floor(Math.random() * MUSIC_TRACKS.length); } while (i === trackIdx);
    return i;
  }
  // ⏮/⏭ ahora son aleatorios (antes iban en orden fijo, que era el problema).
  // Cambiar de canción manualmente solo tiene sentido en modo individual;
  // si el anfitrión sincronizó, el celular normal sigue lo que él eligió
  // (el anfitrión sí puede saltar de canción estando sincronizado: ver
  // hostChangeTrack más abajo, que además avisa a todos los conectados).
  function next(){ if (syncState && syncState.on) return; loadTrack(randomIdx()); }
  function prev(){ if (syncState && syncState.on) return; loadTrack(randomIdx()); }

  // Adelantar/retroceder DENTRO de la canción actual (arrastrando la barra).
  function seekTo(seconds){
    const dur = el.duration && isFinite(el.duration) ? el.duration : (currentTrack()?.duration || 0);
    try { el.currentTime = Math.max(0, Math.min(seconds, dur || seconds)); } catch(e){}
    onUpdateUI();
  }

  function setVolume(v){ userVol = Math.max(0, Math.min(1, v)); localStorage.setItem(LS_VOL, String(userVol)); if (muted && userVol>0){ muted=false; localStorage.setItem(LS_MUTED,"0"); } applyVolume(); }
  function toggleMute(){
    muted = !muted;
    localStorage.setItem(LS_MUTED, muted ? "1":"0");
    if (!muted && started){ userPaused = false; if (el.paused) fadeInPlay(); else rampVolumeTo(targetVolume(), 300); }
    else applyVolume();
  }

  // Se llama con cada cambio de estado de la sala (lobby/countdown/question/...).
  // Al comenzar la partida, baja sola a 10% para no distraer; al volver al
  // lobby o al podio, regresa al volumen que el jugador tenía elegido. Con
  // fundido suave (no un salto brusco) en ambos sentidos.
  function setGamePhase(status){
    const active = ["countdown","question","reveal","board","mini"].includes(status);
    if (active === inGame) return;
    inGame = active;
    rampVolumeTo(targetVolume(), 500);
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
    el.src = t.file;
    el.volume = 0;
    const seek = () => {
      const dur = el.duration && isFinite(el.duration) ? el.duration : (t.duration || 180);
      const pos = ((Date.now() - sync.startedAt) / 1000) % dur;
      try { el.currentTime = Math.max(0, pos); } catch(e){}
      el.play().then(() => { userPaused = false; rampVolumeTo(targetVolume(), 450); }).catch(() => applyVolume());
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
    if (sync && sync.on){
      // Si la sincronía está activa, la música arranca aunque en este
      // celular nunca hubiera empezado (así todos suenan juntos).
      if (!started) started = true;
      if (changed) applySyncState(sync);
    } else if (wasOn){
      // El anfitrión apagó la sincronía: cada quien vuelve a su canción guardada.
      if (started) loadTrack(trackIdx);
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

  // El anfitrión adelanta/retrocede la canción ESTANDO sincronizado: recalcula
  // el "startedAt" para que la posición nueva quede igual en todos los
  // celulares conectados (mismo truco que ya usa la sincronía normal).
  async function hostSeek(seconds, room, sbClient){
    if (!(syncState && syncState.on)) { seekTo(seconds); return; }
    const settings = { ...room.settings };
    settings.musicSync = { on:true, trackId: currentTrack().id, startedAt: Date.now() - seconds*1000 };
    await sbClient.from("rooms").update({ settings }).eq("id", room.id);
  }

  // El anfitrión salta a otra canción (al azar) ESTANDO sincronizado, y se
  // avisa a todos los conectados al toque (vía Realtime, igual que hostSetSync).
  async function hostChangeTrack(room, sbClient){
    if (!(syncState && syncState.on)) { loadTrack(randomIdx()); return; }
    const idx = randomIdx();
    const t = MUSIC_TRACKS[idx];
    const settings = { ...room.settings };
    settings.musicSync = { on:true, trackId: t.id, startedAt: Date.now() };
    await sbClient.from("rooms").update({ settings }).eq("id", room.id);
  }

  function bindUI(cb){ onUpdateUI = cb; cb(); }
  function state(){
    const t = currentTrack();
    return { track: t, image: t?.image || null, playing: !el.paused, volume: userVol, muted,
      synced: !!(syncState && syncState.on), hasError, currentTime: el.currentTime||0, duration: el.duration||0 };
  }

  return { enterGame, play, pause, togglePlay, next, prev, setVolume, toggleMute, seekTo,
           setGamePhase, onRoomUpdate, hostSetSync, hostSeek, hostChangeTrack, duck, unduck, bindUI, state };
})();

// Baja la música mientras suena "a" (un efecto corto) y la vuelve a subir
// sola al terminar. Nunca la pausa. Con seguro por si el navegador no
// dispara "ended" (o el archivo falla): la sube igual a los pocos segundos.
function duckWhilePlaying(a){
  Music.duck();
  let done = false;
  const finish = () => { if (done) return; done = true; Music.unduck(); };
  a.addEventListener("ended", finish, { once:true });
  a.addEventListener("error", finish, { once:true });
  setTimeout(finish, 8000);
}

// ============================================================
// Desbloqueo real de audio para iOS: crear un <audio> no basta — Safari
// solo permite reproducir después un elemento que YA sonó (aunque sea un
// instante) dentro de un toque del usuario. Se reproduce mute y se pausa
// al instante, así queda "desbloqueado" para más tarde sin que se escuche
// nada raro en ese primer toque.
function primeAudio(a){
  try {
    a.muted = true;
    const p = a.play();
    if (p && p.then) p.then(() => { a.pause(); a.currentTime = 0; a.muted = false; }).catch(() => { a.muted = false; });
    else { a.pause(); a.currentTime = 0; a.muted = false; }
  } catch(e){ a.muted = false; }
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
  // Desbloqueo real en el primer toque de la pantalla (ver primeAudio arriba).
  function warmUp(){
    (WINNER_SOUNDS || []).forEach(s => { try{ primeAudio(get(s.file)); }catch(e){} });
  }
  document.addEventListener("pointerdown", warmUp, { once:true });

  function play(idx){
    if (!Sfx.isEnabled()) return;
    const s = (WINNER_SOUNDS || [])[idx];
    if (!s) return;
    try {
      const a = get(s.file);
      a.currentTime = 0;
      a.volume = 1;
      duckWhilePlaying(a);
      a.play().catch(()=>{});
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
    (CORRECT_SOUNDS||[]).forEach(f => { try{ primeAudio(get(f)); }catch(e){} });
    (INCORRECT_SOUNDS||[]).forEach(f => { try{ primeAudio(get(f)); }catch(e){} });
  }
  document.addEventListener("pointerdown", warmUp, { once:true });

  function play(ok){
    if (!Sfx.isEnabled()) return;
    const pool = ok ? CORRECT_SOUNDS : INCORRECT_SOUNDS;
    if (!pool || !pool.length) return;
    const file = pool[Math.floor(Math.random()*pool.length)];
    try {
      const a = get(file);
      a.currentTime = 0;
      a.volume = 1;
      duckWhilePlaying(a);
      a.play().catch(()=>{});
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
  function get(){
    if (!a){ a = new Audio(GAME_START_SOUND); a.preload = "auto"; }
    return a;
  }
  document.addEventListener("pointerdown", () => {
    if (typeof GAME_START_SOUND === "undefined" || !GAME_START_SOUND) return;
    try { primeAudio(get()); } catch(e){}
    playOnceToday();
  }, { once:true });
  // Suena una vez cada día, la primera vez que la persona abre la app
  // (además de sonar en cada inicio de partida, como ya hacía).
  function playOnceToday(){
    try {
      const today = new Date().toISOString().slice(0, 10); // AAAA-MM-DD
      if (localStorage.getItem("gq_start_sound_day") === today) return;
      localStorage.setItem("gq_start_sound_day", today);
      setTimeout(play, 400); // pequeño respiro tras el desbloqueo mudo de iOS
    } catch(e){}
  }
  function play(){
    if (!Sfx.isEnabled()) return;
    if (typeof GAME_START_SOUND === "undefined" || !GAME_START_SOUND) return;
    try {
      const el2 = get();
      el2.currentTime = 0;
      el2.volume = 0.4;   // sonido de inicio suave (no a todo volumen)
      duckWhilePlaying(el2);
      el2.play().catch(()=>{});
    } catch(e){}
  }
  return { play };
})();
