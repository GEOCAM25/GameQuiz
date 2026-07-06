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
  el.loop = true;
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

  const savedTrack = localStorage.getItem(LS_TRACK);
  if (savedTrack){
    const i = MUSIC_TRACKS.findIndex(t => t.id === savedTrack);
    if (i >= 0) trackIdx = i;
  }

  function effectiveVolume(){ return muted ? 0 : (inGame ? 0.10 : userVol); }
  function applyVolume(){ el.volume = effectiveVolume(); onUpdateUI(); }
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

  // Arranca sola en cuanto el jugador crea su perfil / entra a una sala o partida.
  function enterGame(){
    if (started || !MUSIC_TRACKS.length) return;
    started = true;
    if (syncState && syncState.on) applySyncState(syncState);
    else { loadTrack(trackIdx); el.play().catch(()=>{}); }
  }

  // Red de seguridad: en iOS/Android el primer play() puede ser bloqueado si
  // no vino de un toque directo. Si eso pasa, el próximo toque en la pantalla
  // lo reintenta solo (sin volver a mostrar nada raro al usuario).
  document.addEventListener("pointerdown", () => { if (started && el.paused && !muted) el.play().catch(()=>{}); });

  function play(){ if (!started) return enterGame(); el.play().catch(()=>{}); onUpdateUI(); }
  function pause(){ el.pause(); onUpdateUI(); }
  function togglePlay(){ el.paused ? play() : pause(); }
  // Cambiar de canción manualmente solo tiene sentido en modo individual;
  // si el anfitrión sincronizó, el celular sigue lo que él eligió.
  function next(){ if (syncState && syncState.on) return; loadTrack(trackIdx + 1); }
  function prev(){ if (syncState && syncState.on) return; loadTrack(trackIdx - 1); }

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
    return { track: currentTrack(), playing: !el.paused, volume: userVol, muted, synced: !!(syncState && syncState.on) };
  }

  return { enterGame, play, pause, togglePlay, next, prev, setVolume, toggleMute,
           setGamePhase, onRoomUpdate, hostSetSync, bindUI, state };
})();

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
      a.play().catch(()=>{});
    } catch(e){}
  }
  return { play };
})();
