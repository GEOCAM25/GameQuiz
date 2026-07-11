// ============================================================
// GAME QUIZ — PALABRA SECRETA / IMPOSTOR 🕵️
// Juego social en red. Todos reciben la MISMA palabra secreta…
// menos el IMPOSTOR, que no la sabe y debe disimular. Cada uno da
// una pista de una palabra; luego todos VOTAN quién creen que es el
// impostor. Si lo atrapan, gana el grupo; si sobrevive, gana él.
//
// Usa los canales en tiempo real de Supabase (broadcast + presence),
// igual que el karaoke: NO toca el motor de trivia ni necesita SQL.
// El dispositivo que crea la sala es el "anfitrión" (autoridad del
// estado) y también juega. La palabra/impostor se mandan en privado
// a cada teléfono; el estado público no los revela hasta el final.
// ============================================================
const Impostor = (() => {
  const $  = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  const rid = () => Math.random().toString(36).slice(2, 10);
  function code4(){ const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let c = ""; for (let i=0;i<4;i++) c += A[Math.floor(Math.random()*A.length)]; return c; }
  const sbClient = () => (typeof sb !== "undefined" && sb) ? sb : (window.sb || null);

  // ==========================================================
  //  Lógica pura (testeable)
  // ==========================================================
  const ImpLogic = {
    assignRoles(ids, words, rnd){
      const r = rnd || Math.random;
      const impostor = ids[Math.floor(r() * ids.length)];
      const word = words[Math.floor(r() * words.length)];
      return { impostor, word };
    },
    tally(votes){
      const t = {};
      Object.values(votes || {}).forEach(target => { if (target) t[target] = (t[target] || 0) + 1; });
      return t;
    },
    // El impostor es "atrapado" si es el MÁS votado en solitario (sin empate arriba).
    caught(tally, impostorId){
      const counts = Object.entries(tally);
      if (!counts.length) return false;
      const max = Math.max(...counts.map(([, c]) => c));
      const top = counts.filter(([, c]) => c === max).map(([id]) => id);
      return top.length === 1 && top[0] === impostorId;
    },
    scoreRound(order, votes, impostorId, wasCaught){
      const delta = {};
      order.forEach(id => delta[id] = 0);
      if (wasCaught){
        order.forEach(id => { if (id !== impostorId && votes[id] === impostorId) delta[id] = 100; });
      } else {
        delta[impostorId] = 150;
      }
      return delta;
    },
  };

  // ==========================================================
  //  Estado / red
  // ==========================================================
  let S = null;   // estado de esta pestaña
  let CATS = null;

  async function ensureWords(){
    if (CATS) return CATS;
    const r = await fetch("data/impostor.json", { cache: "no-store" });
    const j = await r.json();
    CATS = j.categorias || {};
    return CATS;
  }

  function showScreen(){ document.querySelectorAll(".screen").forEach(s => s.classList.remove("active")); const sc = $("#scr-impostor"); if (sc) sc.classList.add("active"); }

  async function open(exitCb){
    S = { onExit: exitCb || null };
    try { await ensureWords(); } catch(e){}
    renderStart();
    showScreen();
  }

  // ---------- Pantalla inicial: crear / unirse ----------
  function renderStart(){
    const host = $("#impostorScreen");
    const savedName = (localStorage.getItem("gq_name") || "").trim();
    host.innerHTML = `
      <div class="imp-wrap">
        <button class="cruci-back" id="impBack">‹</button>
        <div class="imp-logo">🕵️</div>
        <h2 class="imp-title">Palabra Secreta</h2>
        <p class="imp-tag">Todos saben la palabra… menos el impostor. ¿Quién miente?</p>
        <input id="impName" class="imp-input" maxlength="14" placeholder="Tu nombre" value="${esc(savedName)}" />
        <button class="btn big btn-green" id="impCreate">🎪 Crear sala</button>
        <div class="imp-or">o</div>
        <div class="imp-joinrow">
          <input id="impCode" class="imp-input" maxlength="4" placeholder="CÓDIGO" style="text-transform:uppercase" />
          <button class="btn btn-blue" id="impJoin">Unirse</button>
        </div>
      </div>`;
    $("#impBack").onclick = () => { destroy(); if (S.onExit) S.onExit(); };
    $("#impCreate").onclick = () => {
      const name = ($("#impName").value || "").trim(); if (!name) return toast("✏️ Escribe tu nombre");
      localStorage.setItem("gq_name", name);
      startSession(code4(), name, true);
    };
    $("#impJoin").onclick = () => {
      const name = ($("#impName").value || "").trim(); if (!name) return toast("✏️ Escribe tu nombre");
      const code = ($("#impCode").value || "").trim().toUpperCase(); if (code.length !== 4) return toast("El código tiene 4 letras");
      localStorage.setItem("gq_name", name);
      startSession(code, name, false);
    };
  }

  // ---------- Conexión a la sesión ----------
  function startSession(code, name, isLeader){
    const client = sbClient();
    if (!client){ toast("Impostor necesita conexión (Supabase)"); return; }
    const myId = rid();
    S = { ...S, code, myId, name, isLeader, ch:null, pub:null, card:null,
          full: isLeader ? newFull(code, myId) : null, timer:null, catList: Object.keys(CATS || {}) };

    S.ch = client.channel("imp-" + code, { config:{ broadcast:{ self:false }, presence:{ key:myId } } });
    S.ch.on("broadcast", { event:"pub" }, ({ payload }) => { S.pub = payload; render(); })
        .on("broadcast", { event:"card" }, ({ payload }) => { if (payload.to === myId){ S.card = payload; render(); } })
        .on("broadcast", { event:"cmd" }, ({ payload }) => { if (S.isLeader) onHostCmd(payload); })
        .on("broadcast", { event:"hello" }, () => { if (S.isLeader) broadcastPub(); })
        .on("presence", { event:"leave" }, ({ key }) => { if (S.isLeader && key) hostDispatch({ t:"leave", id:key }); })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED"){
            try { await S.ch.track({ name }); } catch(e){}
            if (S.isLeader){ hostDispatch({ t:"join", id:myId, name }); }
            else { send({ t:"join", id:myId, name }); S.ch.send({ type:"broadcast", event:"hello", payload:{ id:myId } }); }
          }
        });
    render();
    showScreen();
  }

  function send(cmd){ if (S.ch) S.ch.send({ type:"broadcast", event:"cmd", payload:cmd }); }

  // ---------- Estado autoritario (solo anfitrión) ----------
  function newFull(code, leaderId){
    return { code, leader:leaderId, phase:"lobby", players:{}, order:[], round:0,
             category:null, word:null, impostor:null, clues:{}, votes:{}, result:null };
  }
  function onHostCmd(cmd){ hostDispatch(cmd); }

  function hostDispatch(cmd){
    const f = S.full; if (!f) return;
    switch (cmd.t){
      case "join":
        if (!f.players[cmd.id]) f.players[cmd.id] = { name: cmd.name || "Jugador", score:0 };
        else f.players[cmd.id].name = cmd.name || f.players[cmd.id].name;
        if (!f.order.includes(cmd.id)) f.order.push(cmd.id);
        break;
      case "leave":
        delete f.players[cmd.id]; f.order = f.order.filter(x => x !== cmd.id);
        if (f.leader === cmd.id) f.leader = f.order[0] || f.leader;
        break;
      case "setCategory": if (f.phase === "lobby") f.category = cmd.cat; break;
      case "start": if (f.phase === "lobby" && f.order.length >= 3) hostStartRound(); break;
      case "clue": if (f.phase === "clue" && f.players[cmd.id]) { f.clues[cmd.id] = String(cmd.word || "").slice(0, 20); maybeAdvanceFromClue(); } break;
      case "vote": if (f.phase === "vote" && f.players[cmd.id]) { f.votes[cmd.id] = cmd.target; maybeAdvanceFromVote(); } break;
      case "next": if (f.phase === "reveal") hostStartRound(); break;
      case "end": if (f.phase === "reveal" || f.phase === "vote"){ f.phase = "lobby"; f.clues={}; f.votes={}; f.result=null; f.word=null; f.impostor=null; } break;
    }
    broadcastPub();
  }

  function hostStartRound(){
    const f = S.full;
    const cats = CATS || {};
    const cat = f.category && cats[f.category] ? f.category : (Object.keys(cats)[Math.floor(Math.random()*Object.keys(cats).length)]);
    f.category = cat;
    const words = cats[cat] || ["Palabra"];
    const { impostor, word } = ImpLogic.assignRoles(f.order, words);
    f.impostor = impostor; f.word = word;
    f.clues = {}; f.votes = {}; f.result = null; f.round++;
    f.phase = "assign";
    // Mandar a cada jugador su carta privada
    f.order.forEach(id => {
      S.ch.send({ type:"broadcast", event:"card", payload:{ to:id, role: id === impostor ? "impostor" : "crew", word: id === impostor ? null : word, category:cat } });
    });
    // El anfitrión también recibe su carta localmente
    S.card = { to: S.myId, role: S.myId === impostor ? "impostor" : "crew", word: S.myId === impostor ? null : word, category:cat };
    broadcastPub();
    clearTimeout(S.timer);
    S.timer = setTimeout(() => { f.phase = "clue"; broadcastPub(); armPhaseTimeout(50000, () => { f.phase = "vote"; broadcastPub(); armPhaseTimeout(40000, hostReveal); }); }, 6000);
  }
  function armPhaseTimeout(ms, fn){ clearTimeout(S.timer); S.timer = setTimeout(fn, ms); }
  function maybeAdvanceFromClue(){
    const f = S.full;
    if (f.order.every(id => f.clues[id] != null)){ f.phase = "vote"; broadcastPub(); armPhaseTimeout(40000, hostReveal); }
  }
  function maybeAdvanceFromVote(){
    const f = S.full;
    if (f.order.every(id => f.votes[id] != null)) hostReveal();
  }
  function hostReveal(){
    const f = S.full; if (f.phase === "reveal") return;
    clearTimeout(S.timer);
    const tally = ImpLogic.tally(f.votes);
    const wasCaught = ImpLogic.caught(tally, f.impostor);
    const delta = ImpLogic.scoreRound(f.order, f.votes, f.impostor, wasCaught);
    f.order.forEach(id => { if (f.players[id]) f.players[id].score += (delta[id] || 0); });
    f.result = { impostor:f.impostor, word:f.word, tally, caught:wasCaught, delta };
    f.phase = "reveal";
    broadcastPub();
  }

  // El anfitrión difunde una VISTA PÚBLICA (sin palabra ni impostor salvo en reveal)
  function broadcastPub(){
    const f = S.full; if (!f) return;
    const pub = { code:f.code, leader:f.leader, phase:f.phase, players:f.players, order:f.order,
                  round:f.round, category:f.category, clues:f.clues,
                  votes: Object.fromEntries(Object.keys(f.votes).map(k => [k, true])),  // solo QUIÉN votó, no a quién
                  result: f.phase === "reveal" ? f.result : null };
    S.pub = pub; render();
    if (S.ch) S.ch.send({ type:"broadcast", event:"pub", payload:pub });
  }

  // ==========================================================
  //  Interfaz
  // ==========================================================
  function render(){
    const host = $("#impostorScreen"); if (!host) return;
    const p = S.pub;
    if (!p){ host.innerHTML = `<div class="imp-wrap"><div class="imp-logo">🕵️</div><p class="imp-tag">Conectando a la sala <b>${esc(S.code||"")}</b>…</p></div>`; return; }
    if (p.phase === "lobby") return renderLobby(p);
    if (p.phase === "assign") return renderAssign(p);
    if (p.phase === "clue")  return renderClue(p);
    if (p.phase === "vote")  return renderVote(p);
    if (p.phase === "reveal") return renderReveal(p);
  }

  function topBar(p, sub){
    return `<div class="imp-top"><button class="cruci-back" id="impLeave">‹</button>
      <span class="imp-code">🕵️ ${esc(p.code)}</span><span class="imp-sub">${sub||""}</span></div>`;
  }
  function bindLeave(){ const b = $("#impLeave"); if (b) b.onclick = () => { destroy(); if (S.onExit) S.onExit(); else backHome(); }; }

  function renderLobby(p){
    const host = $("#impostorScreen");
    const amLeader = p.leader === S.myId;
    host.innerHTML = `
      <div class="imp-wrap">
        ${topBar(p, `${p.order.length} jugador${p.order.length===1?"":"es"}`)}
        <p class="imp-tag">Comparte el código <b>${esc(p.code)}</b> para que se unan (mínimo 3).</p>
        <div class="imp-players">${p.order.map(id => `<div class="imp-chip">${esc(p.players[id]?.name||"?")}${id===p.leader?" 👑":""}</div>`).join("")}</div>
        ${amLeader ? `
          <label class="lbl" style="color:#fff">Categoría</label>
          <select id="impCat" class="imp-input">${(S.catList||[]).map(c => `<option ${c===p.category?"selected":""}>${esc(c)}</option>`).join("")}</select>
          <button class="btn big btn-green" id="impStart" ${p.order.length<3?"disabled":""}>▶ Empezar ronda</button>
          ${p.order.length<3?'<p class="imp-hint">Faltan jugadores para empezar</p>':''}
        ` : `<p class="imp-hint">Esperando que el anfitrión inicie… 👑</p>`}
      </div>`;
    bindLeave();
    if (amLeader){
      $("#impCat").onchange = e => send0({ t:"setCategory", cat:e.target.value });
      $("#impStart").onclick = () => send0({ t:"start" });
    }
  }

  function renderAssign(p){
    const host = $("#impostorScreen");
    const c = S.card;
    const isImp = c && c.role === "impostor";
    host.innerHTML = `
      <div class="imp-wrap imp-center">
        <p class="imp-round">Ronda ${p.round} · ${esc(p.category||"")}</p>
        <div class="imp-card ${isImp?"imp-card-bad":"imp-card-good"}">
          ${isImp ? `<div class="imp-card-emoji">🕵️</div><div class="imp-card-role">Eres el IMPOSTOR</div><div class="imp-card-hint">No sabes la palabra. ¡Disimula y da una pista creíble!</div>`
                  : `<div class="imp-card-emoji">🔑</div><div class="imp-card-role">La palabra es</div><div class="imp-card-word">${esc(c?c.word:"…")}</div>`}
        </div>
        <p class="imp-hint">Memorízala… la carta desaparece pronto</p>
      </div>`;
  }

  function renderClue(p){
    const host = $("#impostorScreen");
    const mine = p.clues[S.myId];
    host.innerHTML = `
      <div class="imp-wrap">
        ${topBar(p, "Pistas")}
        <p class="imp-tag">Escribe UNA palabra de pista relacionada. ${S.card&&S.card.role==="impostor"?"(Tú improvisa 😏)":""}</p>
        ${mine == null ? `
          <div class="imp-joinrow">
            <input id="impClue" class="imp-input" maxlength="20" placeholder="Tu pista (1 palabra)" />
            <button class="btn btn-green" id="impClueGo">Enviar</button>
          </div>` : `<p class="imp-hint">Tu pista: <b>${esc(mine)}</b> ✓ — esperando al resto…</p>`}
        <div class="imp-clues">
          ${p.order.map(id => `<div class="imp-clue-row"><span>${esc(p.players[id]?.name||"?")}</span><b>${p.clues[id]!=null?esc(p.clues[id]):"…"}</b></div>`).join("")}
        </div>
      </div>`;
    bindLeave();
    if (mine == null){
      const go = () => { const v = ($("#impClue").value||"").trim(); if (!v) return; send0({ t:"clue", id:S.myId, word:v }); };
      $("#impClueGo").onclick = go;
      $("#impClue").onkeydown = e => { if (e.key === "Enter") go(); };
    }
  }

  function renderVote(p){
    const host = $("#impostorScreen");
    const voted = p.votes[S.myId];
    host.innerHTML = `
      <div class="imp-wrap">
        ${topBar(p, "Votación")}
        <p class="imp-tag">¿Quién es el impostor? Toca para votar.</p>
        <div class="imp-clues" style="margin-bottom:8px">${p.order.map(id => `<div class="imp-clue-row"><span>${esc(p.players[id]?.name||"?")}</span><b>${p.clues[id]!=null?esc(p.clues[id]):"—"}</b></div>`).join("")}</div>
        <div class="imp-votegrid">
          ${p.order.filter(id => id !== S.myId).map(id => `<button class="imp-vbtn ${voted===id?"on":""}" data-id="${id}">${esc(p.players[id]?.name||"?")}</button>`).join("")}
        </div>
        <p class="imp-hint">${voted ? "Voto enviado ✓ — esperando al resto…" : ""} ${Object.keys(p.votes).length}/${p.order.length} han votado</p>
      </div>`;
    bindLeave();
    if (!voted) $$("#impostorScreen .imp-vbtn").forEach(b => b.onclick = () => send0({ t:"vote", id:S.myId, target:b.dataset.id }));
  }

  function renderReveal(p){
    const host = $("#impostorScreen");
    const r = p.result || {};
    const impName = p.players[r.impostor]?.name || "?";
    const amLeader = p.leader === S.myId;
    const ranking = p.order.map(id => ({ id, name:p.players[id]?.name||"?", score:p.players[id]?.score||0 })).sort((a,b)=>b.score-a.score);
    host.innerHTML = `
      <div class="imp-wrap">
        ${topBar(p, "Resultado")}
        <div class="imp-reveal ${r.caught?"good":"bad"}">
          <div class="imp-card-emoji">${r.caught?"✅":"🕵️"}</div>
          <p class="imp-reveal-msg">${r.caught?"¡Atraparon al impostor!":"¡El impostor se salió con la suya!"}</p>
          <p class="imp-reveal-imp">El impostor era <b>${esc(impName)}</b></p>
          <p class="imp-reveal-word">La palabra era <b>${esc(r.word||"")}</b></p>
        </div>
        <div class="imp-board">
          ${ranking.map((x,i) => `<div class="imp-brow ${x.id===S.myId?"me":""}"><span>${i===0?"🥇":i+1+"º"}</span><span class="imp-bnm">${esc(x.name)}${x.id===r.impostor?" 🕵️":""}</span><span>${x.score} pts${r.delta&&r.delta[x.id]?` (+${r.delta[x.id]})`:""}</span></div>`).join("")}
        </div>
        ${amLeader ? `<button class="btn big btn-green" id="impNext">▶ Otra ronda</button><button class="btn ghost" id="impEnd">Volver a la sala</button>`
                   : `<p class="imp-hint">Esperando al anfitrión… 👑</p>`}
      </div>`;
    bindLeave();
    if (amLeader){
      $("#impNext").onclick = () => send0({ t:"next" });
      $("#impEnd").onclick = () => send0({ t:"end" });
    }
  }

  // Enviar un comando: si soy anfitrión lo aplico directo; si no, lo mando por la red
  function send0(cmd){ if (S.isLeader) hostDispatch(cmd); else send(cmd); }

  function backHome(){ document.querySelectorAll(".screen").forEach(s => s.classList.remove("active")); const h = $("#scr-home"); if (h) h.classList.add("active"); }
  function destroy(){ try { clearTimeout(S.timer); } catch(e){} try { if (S.ch) sbClient().removeChannel(S.ch); } catch(e){} S = { onExit:S.onExit }; }

  return { open, _logic: ImpLogic };
})();
