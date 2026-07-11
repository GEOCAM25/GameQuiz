// ============================================================
// GAME QUIZ — KARAOKE EN RED (KarSync)
// Conecta los teléfonos con la pantalla del karaoke usando los
// canales en tiempo real de Supabase (broadcast + presence). NO
// necesita tablas nuevas ni SQL.
//
//  • La pantalla del karaoke = "ESCENARIO" (recibe y reproduce).
//  • Cada teléfono que escanea el QR = "CONTROL" (manda comandos y,
//    si activa el micrófono, transmite su voz por WebRTC al escenario,
//    que la saca por sus parlantes / la TV).
//
// Roles: los 3 PRIMEROS que escanean el QR son ANFITRIONES (pueden
// activar/silenciar el micrófono de otros y transferir el rol).
//
// El estado (cola de canciones, qué suena, volúmenes, roles) vive en
// el escenario y se difunde a todos. Toda la lógica de estado está en
// KarState (funciones puras, fáciles de probar).
// ============================================================
const KarSync = (() => {

  // ==========================================================
  //  KarState — lógica pura del estado (sin DOM, sin red)
  // ==========================================================
  const KarState = (() => {
    function initial(category){
      return {
        queue: [],          // próximas canciones: {vid, title, by}
        now: null,          // canción del usuario sonando ahora, o null = playlist de la categoría
        playing: true,
        songVol: 60,        // 0..100
        category: category || "tombola",
        order: [],          // ids en orden de llegada
        hosts: [],          // hasta 3 ids anfitriones
        members: {},        // id -> { name, micOn, micVol }
      };
    }
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    function clone(s){
      return { ...s, queue:[...s.queue], order:[...s.order], hosts:[...s.hosts], members:{...s.members} };
    }
    function fillHosts(s){
      for (const id of s.order){
        if (s.hosts.length >= 3) break;
        if (!s.hosts.includes(id)) s.hosts.push(id);
      }
    }
    // Devuelve { state, fx }. fx (opcional) = efecto para el reproductor:
    //  {type:'load',vid} | {type:'playlist',cat} | {type:'play'} |
    //  {type:'pause'} | {type:'songVol',v}
    function reduce(state, cmd){
      const s = clone(state);
      let fx = null;
      switch (cmd.t){
        case "join": {
          if (!s.members[cmd.id]) s.members[cmd.id] = { name: cmd.name || "Invitado", micOn:false, micVol:80 };
          else s.members[cmd.id] = { ...s.members[cmd.id], name: cmd.name || s.members[cmd.id].name };
          if (!s.order.includes(cmd.id)) s.order.push(cmd.id);
          fillHosts(s);
          break;
        }
        case "leave": {
          delete s.members[cmd.id];
          s.order = s.order.filter(x => x !== cmd.id);
          s.hosts = s.hosts.filter(x => x !== cmd.id);
          fillHosts(s);
          break;
        }
        case "add":      if (cmd.item && cmd.item.vid) s.queue.push(cmd.item); break;
        case "playNext": if (cmd.item && cmd.item.vid) s.queue.unshift(cmd.item); break;
        case "playNow":
          if (cmd.item && cmd.item.vid){ s.now = cmd.item; s.playing = true; fx = { type:"load", vid:cmd.item.vid }; }
          break;
        case "move": {
          const i = s.queue.findIndex(x => x.vid === cmd.vid);
          const j = cmd.dir === "up" ? i-1 : i+1;
          if (i >= 0 && j >= 0 && j < s.queue.length){ const t = s.queue[i]; s.queue[i] = s.queue[j]; s.queue[j] = t; }
          break;
        }
        case "remove": s.queue = s.queue.filter(x => x.vid !== cmd.vid); break;
        case "skip":
          if (s.queue.length){ s.now = s.queue.shift(); s.playing = true; fx = { type:"load", vid:s.now.vid }; }
          else { s.now = null; fx = { type:"playlist", cat:s.category }; }
          break;
        case "prev":
          fx = s.now ? { type:"load", vid:s.now.vid } : { type:"playlist", cat:s.category };
          break;
        case "pause": s.playing = false; fx = { type:"pause" }; break;
        case "play":  s.playing = true;  fx = { type:"play" };  break;
        case "songVol": s.songVol = clamp(cmd.v|0, 0, 100); fx = { type:"songVol", v:s.songVol }; break;
        case "setCategory":
          s.category = cmd.cat;
          if (s.now === null) fx = { type:"playlist", cat:cmd.cat };
          break;
        case "transferHost":
          if (s.hosts.includes(cmd.from) && s.members[cmd.to] && !s.hosts.includes(cmd.to))
            s.hosts = s.hosts.map(h => h === cmd.from ? cmd.to : h);
          break;
        case "setMic": // anfitrión activa/silencia el micrófono de alguien (o uno el suyo)
          if (s.members[cmd.id]) s.members[cmd.id] = { ...s.members[cmd.id], micOn: !!cmd.micOn };
          break;
        case "micVol": // el dueño ajusta su propio volumen de micrófono
          if (s.members[cmd.id]) s.members[cmd.id] = { ...s.members[cmd.id], micVol: clamp(cmd.v|0, 0, 100) };
          break;
      }
      return { state: s, fx };
    }
    function parseVideoId(str){
      str = (str || "").trim(); if (!str) return null;
      const m = str.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/);
      if (m) return m[1];
      if (/^[\w-]{11}$/.test(str)) return str;
      return null;
    }
    function decodeEntities(s){
      return (s || "").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'")
        .replace(/&lt;/g,"<").replace(/&gt;/g,">");
    }
    function parseSearch(json){
      const items = (json && json.items) || [];
      return items.filter(it => it.id && it.id.videoId).map(it => ({
        vid: it.id.videoId,
        title: decodeEntities(it.snippet && it.snippet.title),
        channel: decodeEntities(it.snippet && it.snippet.channelTitle),
        thumb: it.snippet && it.snippet.thumbnails && it.snippet.thumbnails.default && it.snippet.thumbnails.default.url,
      }));
    }
    return { initial, reduce, parseVideoId, parseSearch, decodeEntities };
  })();

  // ==========================================================
  //  Utilidades
  // ==========================================================
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  const rid = () => Math.random().toString(36).slice(2, 10);
  function code4(){ const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let c = ""; for (let i=0;i<4;i++) c += A[Math.floor(Math.random()*A.length)]; return c; }
  const sbClient = () => (typeof sb !== "undefined" && sb) ? sb : (window.sb || null);

  const ICE = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

  // ==========================================================
  //  ESCENARIO (la pantalla del karaoke)
  // ==========================================================
  // opts.onFx(fx)  -> aplica el efecto al reproductor de YouTube (karaoke.js)
  // Devuelve un controlador para karaoke.js.
  function startStage(opts){
    const client = sbClient();
    const code = code4();
    let state = KarState.initial(opts.category);
    let ch = null;

    // ---- Audio de los micrófonos (Web Audio en el escenario) ----
    let actx = null;
    const mics = {};   // remoteId -> { pc, gain, srcNode, audioEl }
    function audioCtx(){ if (!actx){ try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){} } return actx; }
    function applyMicGains(){
      Object.keys(mics).forEach(id => {
        const m = mics[id], mem = state.members[id];
        if (m && m.gain) m.gain.gain.value = (mem && mem.micOn ? (mem.micVol || 0) / 100 : 0);
      });
    }

    function broadcastState(){ if (ch) ch.send({ type:"broadcast", event:"state", payload: state }); }
    function dispatch(cmd){ const r = KarState.reduce(state, cmd); state = r.state; if (r.fx && opts.onFx) opts.onFx(r.fx); applyMicGains(); broadcastState(); }

    function onCmd(payload){ if (payload && payload.t) dispatch(payload); }

    // ---- WebRTC: el escenario recibe la voz de cada teléfono ----
    async function onRtc(p){
      if (!p || p.to !== "stage") return;
      let m = mics[p.from];
      if (p.kind === "offer"){
        const pc = new RTCPeerConnection(ICE);
        m = mics[p.from] = { pc, gain:null, srcNode:null, audioEl:null };
        pc.onicecandidate = e => { if (e.candidate) ch.send({ type:"broadcast", event:"rtc", payload:{ kind:"ice", to:p.from, from:"stage", cand:e.candidate } }); };
        pc.ontrack = e => {
          try {
            const ctx = audioCtx();
            const stream = e.streams[0];
            // Elemento <audio> mudo (necesario en algunos navegadores para que fluya el stream)
            const a = new Audio(); a.srcObject = stream; a.muted = true; a.play().catch(()=>{});
            m.audioEl = a;
            const src = ctx.createMediaStreamSource(stream);
            const gain = ctx.createGain(); gain.gain.value = 0;
            src.connect(gain); gain.connect(ctx.destination);
            m.srcNode = src; m.gain = gain;
            applyMicGains();
          } catch(err){ console.warn("mic ontrack", err); }
        };
        await pc.setRemoteDescription(new RTCSessionDescription(p.sdp));
        const ans = await pc.createAnswer();
        await pc.setLocalDescription(ans);
        ch.send({ type:"broadcast", event:"rtc", payload:{ kind:"answer", to:p.from, from:"stage", sdp: ans } });
      } else if (p.kind === "ice" && m && m.pc){
        try { await m.pc.addIceCandidate(new RTCIceCandidate(p.cand)); } catch(e){}
      } else if (p.kind === "bye" && m){
        try { m.pc.close(); } catch(e){}
        delete mics[p.from];
      }
    }

    ch = client.channel("kar-" + code, { config: { broadcast: { self:false }, presence: { key:"stage" } } });
    ch.on("broadcast", { event:"cmd" }, ({ payload }) => onCmd(payload))
      .on("broadcast", { event:"rtc" }, ({ payload }) => onRtc(payload))
      .on("broadcast", { event:"hello" }, () => broadcastState())   // un control nuevo pide el estado
      .on("presence", { event:"leave" }, ({ key }) => { if (key && key !== "stage") dispatch({ t:"leave", id:key }); if (mics[key]){ try{mics[key].pc.close();}catch(e){} delete mics[key]; } })
      .subscribe(async (status) => { if (status === "SUBSCRIBED"){ try { await ch.track({ role:"stage" }); } catch(e){} broadcastState(); } });

    return {
      code,
      joinURL: () => location.origin + location.pathname + "?karsync=" + code,
      getState: () => state,
      dispatchLocal: dispatch,     // p. ej. karaoke.js al terminar un video -> {t:'skip'}
      setCategory: (cat) => dispatch({ t:"setCategory", cat }),
      destroy(){ try { Object.values(mics).forEach(m => { try{m.pc.close();}catch(e){} }); } catch(e){} try { client.removeChannel(ch); } catch(e){} }
    };
  }

  // ==========================================================
  //  CONTROL (el teléfono)
  // ==========================================================
  let R = null;  // estado del control remoto en este teléfono

  function startRemote(code){
    const client = sbClient();
    if (!client){ $("#karRemoteScreen").innerHTML = `<div class="krem-msg">Este karaoke necesita conexión (Supabase) para el control remoto.</div>`; showRemoteScreen(); return; }
    const myId = rid();
    const myName = (localStorage.getItem("gq_name") || "").trim() || "Invitado";
    R = { code, myId, myName, state: null, ch:null, pc:null, micStream:null, micTrack:null, searchResults:[] };

    R.ch = client.channel("kar-" + code, { config: { broadcast: { self:false }, presence: { key: myId } } });
    R.ch.on("broadcast", { event:"state" }, ({ payload }) => { R.state = payload; renderRemote(); })
      .on("broadcast", { event:"rtc" }, ({ payload }) => onRemoteRtc(payload))
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED"){
          try { await R.ch.track({ name: R.myName }); } catch(e){}
          send({ t:"join", id: myId, name: R.myName });
          R.ch.send({ type:"broadcast", event:"hello", payload:{ id: myId } });
        }
      });
    renderRemoteShell();
    showRemoteScreen();
  }

  function send(cmd){ if (R && R.ch) R.ch.send({ type:"broadcast", event:"cmd", payload: cmd }); }
  const iAmHost = () => R && R.state && R.state.hosts.includes(R.myId);

  // ---- WebRTC del control: envía su micrófono al escenario ----
  async function micStart(){
    try {
      if (!R.micStream){
        R.micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation:true, noiseSuppression:true, autoGainControl:true }, video:false });
        R.micTrack = R.micStream.getAudioTracks()[0];
      }
      R.pc = new RTCPeerConnection(ICE);
      R.micStream.getTracks().forEach(t => R.pc.addTrack(t, R.micStream));
      R.pc.onicecandidate = e => { if (e.candidate) R.ch.send({ type:"broadcast", event:"rtc", payload:{ kind:"ice", to:"stage", from:R.myId, cand:e.candidate } }); };
      const offer = await R.pc.createOffer();
      await R.pc.setLocalDescription(offer);
      R.ch.send({ type:"broadcast", event:"rtc", payload:{ kind:"offer", to:"stage", from:R.myId, sdp: offer } });
      send({ t:"setMic", id:R.myId, micOn:true });
    } catch(e){ toast("🎤 No se pudo usar el micrófono (permiso denegado)"); }
  }
  function micStop(){
    send({ t:"setMic", id:R.myId, micOn:false });
    try { R.ch.send({ type:"broadcast", event:"rtc", payload:{ kind:"bye", to:"stage", from:R.myId } }); } catch(e){}
    try { if (R.pc) R.pc.close(); } catch(e){}
    R.pc = null;
    try { if (R.micTrack) R.micTrack.enabled = false; } catch(e){}
  }
  async function onRemoteRtc(p){
    if (!p || p.to !== R.myId) return;
    if (p.kind === "answer" && R.pc){ try { await R.pc.setRemoteDescription(new RTCSessionDescription(p.sdp)); } catch(e){} }
    else if (p.kind === "ice" && R.pc){ try { await R.pc.addIceCandidate(new RTCIceCandidate(p.cand)); } catch(e){} }
  }

  // ---- Búsqueda de canciones (YouTube Data API) ----
  async function doSearch(q){
    q = (q || "").trim(); if (!q) return;
    const box = $("#kremResults"); if (box) box.innerHTML = `<div class="krem-hint">Buscando…</div>`;
    // ¿pegó un link directo de YouTube?
    const direct = KarState.parseVideoId(q);
    if (direct){ R.searchResults = [{ vid:direct, title:"Video de YouTube", channel:"", thumb:null }]; return renderResults(); }
    if (typeof YOUTUBE_API_KEY === "undefined" || !YOUTUBE_API_KEY){
      if (box) box.innerHTML = `<div class="krem-hint">🔎 La búsqueda por nombre necesita una clave de YouTube (pégala en <code>js/config.js</code>). Por ahora puedes pegar el <b>link</b> de una canción.</div>`;
      return;
    }
    try {
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=15&q=${encodeURIComponent(q + " karaoke")}&key=${YOUTUBE_API_KEY}`;
      const r = await fetch(url);
      const j = await r.json();
      if (j.error){ if (box) box.innerHTML = `<div class="krem-hint">⚠️ ${esc(j.error.message || "Error de búsqueda")}</div>`; return; }
      R.searchResults = KarState.parseSearch(j);
      renderResults();
    } catch(e){ if (box) box.innerHTML = `<div class="krem-hint">⚠️ No se pudo buscar. Revisa la conexión o la clave.</div>`; }
  }

  // ---- Interfaz del control ----
  function showRemoteScreen(){ document.querySelectorAll(".screen").forEach(s => s.classList.remove("active")); const scr = $("#scr-karremote"); if (scr) scr.classList.add("active"); }

  function renderRemoteShell(){
    const host = $("#karRemoteScreen");
    host.innerHTML = `
      <div class="krem-wrap">
        <div class="krem-top">
          <span class="krem-brand">🎤 Karaoke · control</span>
          <span class="krem-code">${esc(R.code)}</span>
        </div>
        <div class="krem-search">
          <input id="kremQ" class="krem-input" placeholder="Buscar canción o pegar link de YouTube…" />
          <button id="kremGo" class="krem-searchbtn">🔎</button>
        </div>
        <div id="kremResults" class="krem-results"></div>
        <div id="kremBody"></div>
      </div>`;
    $("#kremGo").onclick = () => doSearch($("#kremQ").value);
    $("#kremQ").addEventListener("keydown", e => { if (e.key === "Enter") doSearch($("#kremQ").value); });
  }

  function renderResults(){
    const box = $("#kremResults");
    if (!R.searchResults.length){ box.innerHTML = `<div class="krem-hint">Sin resultados.</div>`; return; }
    box.innerHTML = R.searchResults.map(v => `
      <div class="krem-res">
        <div class="krem-res-info">${v.thumb ? `<img src="${esc(v.thumb)}" alt="">` : "🎵"}<span>${esc(v.title)}</span></div>
        <div class="krem-res-btns">
          <button data-vid="${esc(v.vid)}" data-a="now" title="Reproducir ahora">▶</button>
          <button data-vid="${esc(v.vid)}" data-a="next" title="Reproducir a continuación">⏭</button>
          <button data-vid="${esc(v.vid)}" data-a="add" title="Agregar a la cola">➕</button>
        </div>
      </div>`).join("");
    $$("#kremResults .krem-res-btns button").forEach(b => b.onclick = () => {
      const v = R.searchResults.find(x => x.vid === b.dataset.vid);
      const item = { vid: v.vid, title: v.title, by: R.myName };
      if (b.dataset.a === "now") send({ t:"playNow", item });
      else if (b.dataset.a === "next") send({ t:"playNext", item });
      else send({ t:"add", item });
      toast(b.dataset.a === "now" ? "▶ Reproduciendo" : b.dataset.a === "next" ? "⏭ A continuación" : "➕ Agregada a la cola");
    });
  }

  function renderRemote(){
    const st = R.state; if (!st) return;
    const body = $("#kremBody"); if (!body) return;
    const me = st.members[R.myId] || { micOn:false, micVol:80 };
    const host = iAmHost();
    const nowTitle = st.now ? st.now.title : `Playlist: ${st.category}`;

    body.innerHTML = `
      <div class="krem-now">
        <div class="krem-now-lbl">${st.now ? "🎶 Ahora suena" : "🎶 Reproduciendo"}</div>
        <div class="krem-now-title">${esc(nowTitle)}</div>
      </div>
      <div class="krem-transport">
        <button id="kremPrev">⏮</button>
        <button id="kremPlay">${st.playing ? "⏸" : "▶"}</button>
        <button id="kremSkip">⏭</button>
      </div>
      <div class="krem-vol">
        <span>🔊 Canción</span>
        <button data-d="-1" class="kv">−</button><span class="kvval">${st.songVol}</span><button data-d="1" class="kv">+</button>
      </div>

      <div class="krem-mic ${me.micOn ? "on" : ""}">
        <div class="krem-mic-row">
          <button id="kremMic" class="krem-micbtn ${me.micOn ? "on" : ""}">${me.micOn ? "🎤 Micrófono ACTIVO" : "🎤 Activar micrófono"}</button>
        </div>
        <div class="krem-vol">
          <span>🎙️ Mi voz</span>
          <button data-md="-1" class="kmv">−</button><span class="kmvval">${me.micVol}</span><button data-md="1" class="kmv">+</button>
        </div>
      </div>

      <div class="krem-queue">
        <div class="krem-queue-lbl">📋 Cola (${st.queue.length})</div>
        ${st.queue.map((it, i) => `
          <div class="krem-qitem">
            <span class="krem-qtitle">${esc(it.title)}</span>
            <div class="krem-qbtns">
              <button data-vid="${esc(it.vid)}" data-q="up" ${i===0?"disabled":""}>▲</button>
              <button data-vid="${esc(it.vid)}" data-q="down" ${i===st.queue.length-1?"disabled":""}>▼</button>
              <button data-vid="${esc(it.vid)}" data-q="rm">✕</button>
            </div>
          </div>`).join("") || `<div class="krem-hint">Vacía. Busca canciones arriba y agrégalas.</div>`}
      </div>

      <div class="krem-people">
        <div class="krem-queue-lbl">🎤 En la sala ${host ? "· eres ANFITRIÓN" : ""}</div>
        ${st.order.map(id => {
          const m = st.members[id]; if (!m) return "";
          const isH = st.hosts.includes(id), isMe = id === R.myId;
          return `<div class="krem-person">
            <span>${isH ? "👑 " : ""}${esc(m.name)}${isMe ? " (tú)" : ""} ${m.micOn ? "🎙️" : ""}</span>
            <div class="krem-qbtns">
              ${host && !isMe ? `<button data-id="${esc(id)}" data-p="${m.micOn?"muteo":"activa"}">${m.micOn ? "🔇" : "🎤"}</button>` : ""}
              ${host && !isMe && !isH ? `<button data-id="${esc(id)}" data-p="host" title="Hacer anfitrión">👑</button>` : ""}
            </div>
          </div>`;
        }).join("")}
      </div>

      ${st.now ? "" : `<div class="krem-cats">${(catChips())}</div>`}
    `;

    // transporte
    $("#kremPrev").onclick = () => send({ t:"prev" });
    $("#kremSkip").onclick = () => send({ t:"skip" });
    $("#kremPlay").onclick = () => send({ t: st.playing ? "pause" : "play" });
    $$(".kv").forEach(b => b.onclick = () => send({ t:"songVol", v: st.songVol + (+b.dataset.d)*10 }));
    // micrófono propio
    $("#kremMic").onclick = () => { if (me.micOn) micStop(); else micStart(); };
    $$(".kmv").forEach(b => b.onclick = () => send({ t:"micVol", id:R.myId, v: me.micVol + (+b.dataset.md)*10 }));
    // cola
    $$("#kremBody .krem-qbtns [data-q]").forEach(b => b.onclick = () => {
      if (b.dataset.q === "rm") send({ t:"remove", vid:b.dataset.vid });
      else send({ t:"move", vid:b.dataset.vid, dir:b.dataset.q });
    });
    // gente (anfitrión)
    $$("#kremBody .krem-person [data-p]").forEach(b => b.onclick = () => {
      const id = b.dataset.id;
      if (b.dataset.p === "host") send({ t:"transferHost", from:R.myId, to:id });
      else send({ t:"setMic", id, micOn: b.dataset.p === "activa" });
    });
    // categorías
    $$("#kremBody .krem-catchip").forEach(b => b.onclick = () => send({ t:"setCategory", cat:b.dataset.cat }));
  }

  // chips de categoría (se llenan desde karaoke.js si expuso las categorías)
  function catChips(){
    const cats = (typeof Karaoke !== "undefined" && Karaoke.categories) ? Karaoke.categories() : [];
    if (!cats.length) return "";
    return `<div class="krem-queue-lbl">🎚️ Categoría</div>` + cats.map(c =>
      `<button class="krem-catchip" data-cat="${esc(c.id)}">${c.emoji || "🎵"} ${esc(c.nombre)}</button>`).join("");
  }

  return { startStage, startRemote, _state: KarState };
})();
