// ============================================================
// GAME QUIZ — MODO PANTALLA (Smart TV / Roku / navegador de TV)
// La TV entra como ESPECTADORA a una sala normal de Supabase y muestra
// todo en grande: código + QR para que los teléfonos se unan como control,
// las preguntas con sus 4 opciones, el marcador y el podio. Los teléfonos
// siguen siendo los que responden (son el "joystick"). En los mini-juegos
// la TV avisa "atento a tu teléfono" porque esos se juegan en el celular.
//
// Se activa con ?tv=1 en la URL, o desde el botón "Modo pantalla (TV)".
// El anfitrión puede PAUSAR con la tecla OK / barra espaciadora.
// ============================================================
const TV = (() => {
  let sb = null, room = null, channel = null, code = null;
  let bankCache = {};
  const $ = s => document.querySelector(s);

  function isTVRequested(){
    return new URLSearchParams(location.search).get("tv") === "1";
  }

  // ---- Arranque del modo TV ----
  async function start(supa){
    sb = supa;
    document.body.classList.add("tv-mode");
    renderShell();
    if (!sb){ $("#tvBody").innerHTML = `<p class="tv-msg">⚙️ Falta configurar Supabase (js/config.js) para el modo pantalla.</p>`; return; }
    await createRoom();
    subscribe();
    bindKeys();
  }

  function renderShell(){
    let host = document.getElementById("tvRoot");
    if (!host){ host = document.createElement("div"); host.id = "tvRoot"; document.body.appendChild(host); }
    host.innerHTML = `
      <div class="tv-topbar">
        <div class="tv-logo">GAME <span>QUIZ</span> <b>TV</b></div>
        <div class="tv-code-box">Sala <span id="tvCode">····</span></div>
        <div class="tv-players" id="tvPlayers"></div>
      </div>
      <div class="tv-body" id="tvBody"></div>
      <div class="tv-pause-overlay hidden" id="tvPause">
        <div class="tv-pause-card">⏸ <b>Juego en pausa</b><small>El anfitrión pausó la partida</small></div>
      </div>`;
  }

  async function createRoom(){
    // Código NUMÉRICO para la TV (más fácil de dictar/teclear en teléfonos)
    code = String(Math.floor(1000 + Math.random() * 9000));
    const settings = { count:10, mode:"admin", filter:"on", cat:"disney", qids:[], scoreMode:"reset", qtime:40, tv:true };
    const { data, error } = await sb.from("rooms").insert({ code, settings, status:"lobby" }).select().single();
    if (error){ $("#tvBody").innerHTML = `<p class="tv-msg">No se pudo crear la sala 😕</p>`; return; }
    room = data;
    $("#tvCode").textContent = code;
    renderLobby();
  }

  function joinURL(){
    return location.origin + location.pathname + "?sala=" + code;
  }

  function subscribe(){
    channel = sb.channel("tv-" + room.id)
      .on("postgres_changes", { event:"*", schema:"public", table:"rooms", filter:`id=eq.${room.id}` },
        p => { room = p.new; onRoom(); })
      .on("postgres_changes", { event:"*", schema:"public", table:"players", filter:`room_id=eq.${room.id}` },
        () => refreshPlayers())
      .subscribe();
    // sondeo de respaldo por si Realtime se atrasa
    setInterval(async () => {
      const { data } = await sb.from("rooms").select("*").eq("id", room.id).maybeSingle();
      if (data){ room = data; onRoom(); }
    }, 3000);
    refreshPlayers();
  }

  async function refreshPlayers(){
    const { data } = await sb.from("players").select("*").eq("room_id", room.id).order("score", { ascending:false });
    const list = (data || []).filter(p => p.connected);
    const box = $("#tvPlayers");
    if (box) box.innerHTML = list.map(p => `<span class="tvp">${p.avatar}<small>${esc(p.name)}</small></span>`).join("");
    if (room.status === "lobby") renderLobby(list);
    if (room.status === "board" || room.status === "podium") renderScores(list);
  }

  // ---- Reacción a cada cambio de estado de la sala ----
  let lastStatus = null, lastQ = null;
  function onRoom(){
    const paused = room.settings && room.settings.paused;
    $("#tvPause").classList.toggle("hidden", !paused);
    const st = room.status;
    if (st === "lobby" && lastStatus !== "lobby") renderLobby();
    else if (st === "countdown" && lastStatus !== "countdown") renderCountdown();
    else if (st === "question" && (lastStatus !== "question" || lastQ !== room.current_q)) renderQuestion();
    else if (st === "reveal" && lastStatus !== "reveal") renderReveal();
    else if (st === "board" && lastStatus !== "board") refreshPlayers();
    else if (st === "mini" && lastStatus !== "mini") renderMiniAlert();
    else if (st === "podium" && lastStatus !== "podium") refreshPlayers();
    lastStatus = st; lastQ = room.current_q;
  }

  // ---- Pantallas grandes ----
  function renderLobby(list){
    const qr = qrSVG(joinURL(), 260);
    $("#tvBody").innerHTML = `
      <div class="tv-lobby">
        <div class="tv-join">
          <h1>Escanea para jugar 📲</h1>
          <div class="tv-qr">${qr}</div>
          <p class="tv-or">o entra en la app con el código</p>
          <div class="tv-bigcode">${code}</div>
        </div>
        <div class="tv-waiting">
          <h2>Jugadores</h2>
          <div class="tv-waitlist" id="tvWaitList"></div>
          <p class="tv-hint">El anfitrión inicia la partida desde su teléfono 🎮</p>
        </div>
      </div>`;
    const wl = $("#tvWaitList");
    if (wl && list) wl.innerHTML = list.length
      ? list.map(p => `<span class="tvp big">${p.avatar}<small>${esc(p.name)}</small></span>`).join("")
      : `<p class="tv-hint">Esperando jugadores…</p>`;
  }

  function renderCountdown(){
    let n = 3;
    $("#tvBody").innerHTML = `<div class="tv-count"><div class="tv-count-num" id="tvCd">3</div><p>¡Prepárate!</p></div>`;
    const iv = setInterval(() => {
      n--;
      const el = $("#tvCd");
      if (!el){ clearInterval(iv); return; }
      el.textContent = n > 0 ? n : "¡YA!";
      if (n <= 0) clearInterval(iv);
    }, 1000);
  }

  async function loadBank(cat){
    if (bankCache[cat]) return bankCache[cat];
    try { const r = await fetch(`data/${cat}.json`); const j = await r.json(); bankCache[cat] = j; return j; }
    catch(e){ return null; }
  }

  async function renderQuestion(){
    const s = room.settings;
    const bank = await loadBank(s.cat);
    if (!bank){ $("#tvBody").innerHTML = `<p class="tv-msg">Cargando…</p>`; return; }
    const q = bank.questions[s.qids[room.current_q]];
    if (!q) return;
    const shapes = ["🔺","🔷","🟡","🟢"];
    const total = s.qids.length;
    const isFinal = room.current_q >= total - 1;
    $("#tvBody").innerHTML = `
      <div class="tv-q">
        <div class="tv-qbar"><div class="tv-qbar-fill" id="tvQBar"></div><span id="tvQNum"></span></div>
        <p class="tv-qidx">${isFinal ? "PREGUNTA FINAL ×2" : `Pregunta ${room.current_q+1} de ${total}`}</p>
        ${q.e ? `<div class="tv-qemoji">${q.e}</div>` : ""}
        <h1 class="tv-qtext">${esc(q.q)}</h1>
        <div class="tv-answers">
          ${q.o.map((op,i)=>`<div class="tv-ans a${i}"><span class="tv-shape">${shapes[i]}</span>${esc(op)}</div>`).join("")}
        </div>
      </div>`;
    animateQBar(room.q_started_at, s.qtime || 40);
  }

  let qbarIv = null;
  function animateQBar(startedAt, secs){
    clearInterval(qbarIv);
    const t0 = new Date(startedAt).getTime();
    qbarIv = setInterval(() => {
      const bar = $("#tvQBar"), num = $("#tvQNum");
      if (!bar){ clearInterval(qbarIv); return; }
      const left = Math.max(0, secs - (Date.now() - t0) / 1000);
      bar.style.width = (left / secs * 100) + "%";
      if (num) num.textContent = Math.ceil(left);
      if (left <= 0) clearInterval(qbarIv);
    }, 200);
  }

  async function renderReveal(){
    const s = room.settings;
    const bank = await loadBank(s.cat);
    if (!bank) return;
    const q = bank.questions[s.qids[room.current_q]];
    if (!q) return;
    const shapes = ["🔺","🔷","🟡","🟢"];
    $("#tvBody").innerHTML = `
      <div class="tv-q reveal">
        <h1 class="tv-qtext">${esc(q.q)}</h1>
        <div class="tv-answers">
          ${q.o.map((op,i)=>`<div class="tv-ans a${i} ${i===q.c?"correct":"faded"}"><span class="tv-shape">${shapes[i]}</span>${esc(op)}${i===q.c?' <span class="tv-check">✔</span>':''}</div>`).join("")}
        </div>
      </div>`;
  }

  function renderMiniAlert(){
    $("#tvBody").innerHTML = `
      <div class="tv-mini">
        <div class="tv-mini-emoji">📱</div>
        <h1>¡Mini-juego sorpresa!</h1>
        <p>Atento a tu teléfono 👀 — este se juega en tu mano</p>
      </div>`;
  }

  function renderScores(list){
    if (!list){ refreshPlayers(); return; }
    const top = Math.max(1, list[0]?.score || 1);
    const isPodium = room.status === "podium";
    $("#tvBody").innerHTML = `
      <div class="tv-scores">
        <h1>${isPodium ? "🏆 Resultado final" : "Marcador"}</h1>
        <div class="tv-scorelist">
          ${list.slice(0, 8).map((p,i)=>`
            <div class="tv-srow ${i===0?'lead':''}">
              <span class="tv-pos">${i===0?"🥇":i===1?"🥈":i===2?"🥉":(i+1)+"º"}</span>
              <span class="tv-em">${p.avatar}</span>
              <span class="tv-nm">${esc(p.name)}</span>
              <div class="tv-bar"><div class="tv-bar-fill" style="width:${(p.score/top*100)}%"></div></div>
              <span class="tv-pts">${p.score}</span>
            </div>`).join("")}
        </div>
      </div>`;
  }

  // ---- Pausa (tecla OK del control de TV / barra espaciadora) ----
  function bindKeys(){
    document.addEventListener("keydown", async (e) => {
      // Enter / Espacio / botón OK de Roku (que manda "Enter")
      if (e.key === "Enter" || e.key === " " || e.keyCode === 13 || e.keyCode === 32){
        e.preventDefault();
        await togglePause();
      }
    });
    // También un toque en la pantalla de la TV pausa (por si tiene touch)
    document.addEventListener("dblclick", () => togglePause());
  }
  async function togglePause(){
    if (!room) return;
    const paused = !(room.settings && room.settings.paused);
    const settings = { ...room.settings, paused };
    await sb.from("rooms").update({ settings }).eq("id", room.id);
  }

  // ---- Generador de QR (librería qrcode-generator vía CDN) ----
  function qrSVG(text, size){
    try {
      if (typeof qrcode === "undefined") throw new Error("qr lib no cargada");
      const qr = qrcode(0, "M");      // versión automática, corrección media
      qr.addData(text);
      qr.make();
      const n = qr.getModuleCount();
      const cell = size / n;
      let rects = "";
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++){
        if (qr.isDark(y, x)) rects += `<rect x="${(x*cell).toFixed(2)}" y="${(y*cell).toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}"/>`;
      }
      return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" style="background:#fff;border-radius:12px;padding:10px" xmlns="http://www.w3.org/2000/svg"><g fill="#111">${rects}</g></svg>`;
    } catch(e){
      return `<div class="tv-qr-fallback">Entra con el código<br><b>${code}</b></div>`;
    }
  }

  return { isTVRequested, start };
})();
