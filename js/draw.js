// ============================================================
// GAME QUIZ — DIBUJA Y ADIVINA 🎨
// Un jugador DIBUJA una palabra secreta y los demás la ADIVINAN
// escribiendo. El lienzo se sincroniza en tiempo real (los trazos
// viajan por el canal de Supabase). Por turnos, cada uno dibuja.
//
// Autónomo (broadcast + presence), como Incógnito: no toca el motor
// de trivia ni requiere SQL. El que crea la sala es el anfitrión.
// ============================================================
const Draw = (() => {
  const $  = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  const rid = () => Math.random().toString(36).slice(2, 10);
  function code4(){ const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let c=""; for(let i=0;i<4;i++) c+=A[Math.floor(Math.random()*A.length)]; return c; }
  const sbClient = () => (typeof sb !== "undefined" && sb) ? sb : (window.sb || null);

  // ---------- Lógica pura ----------
  const DrawLogic = {
    normalize(s){ return String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z0-9ñ]/g,"").trim(); },
    isCorrect(guess, word){ const g = DrawLogic.normalize(guess); return !!g && g === DrawLogic.normalize(word); },
    nextDrawerIdx(order, curIdx){ return order.length ? (curIdx + 1) % order.length : 0; },
    scoreGuess(){ return { guesser: 100, drawer: 50 }; },
  };

  let S = null, CATS = null;
  async function ensureWords(){ if (CATS) return CATS; const r = await fetch("data/draw.json",{cache:"no-store"}); CATS = (await r.json()).palabras || {}; return CATS; }
  function showScreen(){ document.querySelectorAll(".screen").forEach(s => s.classList.remove("active")); const sc = $("#scr-draw"); if (sc) sc.classList.add("active"); }

  async function open(exitCb){ S = { onExit: exitCb || null }; try { await ensureWords(); } catch(e){} renderStart(); showScreen(); }

  function renderStart(){
    const host = $("#drawScreen");
    const savedName = (localStorage.getItem("gq_name")||"").trim();
    host.innerHTML = `
      <div class="imp-wrap">
        <button class="cruci-back" id="drwBack">‹</button>
        <div class="imp-logo">🎨</div>
        <h2 class="imp-title">Dibuja y Adivina</h2>
        <p class="imp-tag">Uno dibuja la palabra secreta… ¡los demás adivinan!</p>
        <input id="drwName" class="imp-input" maxlength="14" placeholder="Tu nombre" value="${esc(savedName)}" />
        <button class="btn big btn-green" id="drwCreate">🎪 Crear sala</button>
        <div class="imp-or">o</div>
        <div class="imp-joinrow">
          <input id="drwCode" class="imp-input" maxlength="4" placeholder="CÓDIGO" style="text-transform:uppercase" />
          <button class="btn btn-blue" id="drwJoin">Unirse</button>
        </div>
      </div>`;
    $("#drwBack").onclick = () => { destroy(); if (S.onExit) S.onExit(); };
    $("#drwCreate").onclick = () => { const n=($("#drwName").value||"").trim(); if(!n) return toast("✏️ Escribe tu nombre"); localStorage.setItem("gq_name",n); startSession(code4(), n, true); };
    $("#drwJoin").onclick = () => { const n=($("#drwName").value||"").trim(); if(!n) return toast("✏️ Escribe tu nombre"); const c=($("#drwCode").value||"").trim().toUpperCase(); if(c.length!==4) return toast("El código tiene 4 letras"); localStorage.setItem("gq_name",n); startSession(c, n, false); };
  }

  function startSession(code, name, isLeader){
    const client = sbClient(); if (!client){ toast("Necesita conexión (Supabase)"); return; }
    const myId = rid();
    S = { ...S, code, myId, name, isLeader, ch:null, pub:null, card:null, strokes:[], lastPhase:null, catList:Object.keys(CATS||{}),
          full: isLeader ? { code, leader:myId, phase:"lobby", players:{}, order:[], round:0, drawerIdx:-1, drawer:null, word:null, category:null, guesses:[], solvedBy:null, timer:null } : null };
    S.ch = client.channel("draw-"+code, { config:{ broadcast:{ self:false }, presence:{ key:myId } } });
    S.ch.on("broadcast", { event:"pub" }, ({payload}) => { S.pub = payload; render(); })
        .on("broadcast", { event:"card" }, ({payload}) => { if (payload.to===myId){ S.card=payload; render(); } })
        .on("broadcast", { event:"cmd" }, ({payload}) => { if (S.isLeader) hostDispatch(payload); })
        .on("broadcast", { event:"stroke" }, ({payload}) => onStroke(payload))
        .on("broadcast", { event:"clear" }, () => { S.strokes=[]; clearCanvas(); })
        .on("broadcast", { event:"hello" }, () => { if (S.isLeader) broadcastPub(); })
        .on("presence", { event:"leave" }, ({key}) => { if (S.isLeader && key) hostDispatch({t:"leave",id:key}); })
        .subscribe(async (st) => { if (st==="SUBSCRIBED"){ try{await S.ch.track({name});}catch(e){} if(S.isLeader) hostDispatch({t:"join",id:myId,name}); else { send({t:"join",id:myId,name}); S.ch.send({type:"broadcast",event:"hello",payload:{id:myId}}); } } });
    render(); showScreen();
  }
  function send(cmd){ if (S.ch) S.ch.send({ type:"broadcast", event:"cmd", payload:cmd }); }
  function send0(cmd){ if (S.isLeader) hostDispatch(cmd); else send(cmd); }
  const iAmDrawer = () => S.pub && S.pub.drawer === S.myId;

  // ---------- Anfitrión ----------
  function hostDispatch(cmd){
    const f = S.full; if (!f) return;
    switch (cmd.t){
      case "join": if(!f.players[cmd.id]) f.players[cmd.id]={name:cmd.name||"Jugador",score:0}; else f.players[cmd.id].name=cmd.name||f.players[cmd.id].name; if(!f.order.includes(cmd.id)) f.order.push(cmd.id); break;
      case "leave": delete f.players[cmd.id]; f.order=f.order.filter(x=>x!==cmd.id); if(f.leader===cmd.id) f.leader=f.order[0]||f.leader; break;
      case "setCategory": if(f.phase==="lobby") f.category=cmd.cat; break;
      case "start": if(f.phase==="lobby" && f.order.length>=2) hostStartRound(); break;
      case "guess": if(f.phase==="draw" && cmd.id!==f.drawer && f.players[cmd.id]) hostGuess(cmd.id, cmd.text); break;
      case "next": if(f.phase==="reveal") hostStartRound(); break;
      case "end": if(f.phase==="reveal"||f.phase==="draw"){ f.phase="lobby"; f.word=null; f.drawer=null; f.guesses=[]; f.solvedBy=null; clearTimeout(f.timer); } break;
    }
    broadcastPub();
  }
  function hostStartRound(){
    const f = S.full, cats = CATS||{};
    const cat = f.category && cats[f.category] ? f.category : Object.keys(cats)[0];
    f.category = cat;
    const words = cats[cat] || ["Casa"];
    f.drawerIdx = DrawLogic.nextDrawerIdx(f.order, f.drawerIdx);
    f.drawer = f.order[f.drawerIdx];
    f.word = words[Math.floor(Math.random()*words.length)];
    f.guesses = []; f.solvedBy = null; f.round++; f.phase = "draw";
    S.ch.send({ type:"broadcast", event:"clear", payload:{} }); S.strokes=[]; clearCanvas();
    // palabra en privado al que dibuja
    S.ch.send({ type:"broadcast", event:"card", payload:{ to:f.drawer, word:f.word } });
    if (S.myId===f.drawer) S.card = { to:S.myId, word:f.word };
    broadcastPub();
    clearTimeout(f.timer); f.timer = setTimeout(hostReveal, 85000);
  }
  function hostGuess(id, text){
    const f = S.full;
    const correct = DrawLogic.isCorrect(text, f.word);
    f.guesses.push({ id, name: f.players[id]?.name||"?", text: correct ? "" : String(text).slice(0,24), correct });
    if (correct && !f.solvedBy){
      f.solvedBy = id;
      const s = DrawLogic.scoreGuess();
      if (f.players[id]) f.players[id].score += s.guesser;
      if (f.players[f.drawer]) f.players[f.drawer].score += s.drawer;
      hostReveal();
    }
  }
  function hostReveal(){ const f=S.full; if(f.phase==="reveal") return; clearTimeout(f.timer); f.phase="reveal"; broadcastPub(); }
  function broadcastPub(){
    const f=S.full; if(!f) return;
    const pub = { code:f.code, leader:f.leader, phase:f.phase, players:f.players, order:f.order, round:f.round,
                  drawer:f.drawer, category:f.category, guesses:f.guesses, solvedBy:f.solvedBy,
                  word: f.phase==="reveal" ? f.word : null };
    S.pub = pub; render();
    if (S.ch) S.ch.send({ type:"broadcast", event:"pub", payload:pub });
  }

  // ---------- Interfaz ----------
  function render(){
    const host = $("#drawScreen"); if(!host) return;
    const p = S.pub;
    if (!p){ if(!host.querySelector(".imp-wrap")) host.innerHTML = `<div class="imp-wrap"><div class="imp-logo">🎨</div><p class="imp-tag">Conectando a <b>${esc(S.code||"")}</b>…</p></div>`; return; }
    if (p.phase === "lobby") return renderLobby(p);
    // draw/reveal: solo re-render completo si cambió la fase (para no borrar el lienzo)
    if (p.phase !== S.lastPhase){ S.lastPhase = p.phase; (p.phase==="draw"?renderDraw:renderReveal)(p); }
    else { updateGuesses(p); updateScores(p); if(p.phase==="reveal") renderReveal(p); }
  }
  function bindLeave(id){ const b=$("#"+id); if(b) b.onclick=()=>{ destroy(); if(S.onExit) S.onExit(); else backHome(); }; }

  function renderLobby(p){
    S.lastPhase = null;
    const host=$("#drawScreen"); const amLeader=p.leader===S.myId;
    host.innerHTML = `
      <div class="imp-wrap">
        <div class="imp-top"><button class="cruci-back" id="drwLeave">‹</button><span class="imp-code">🎨 ${esc(p.code)}</span><span class="imp-sub">${p.order.length} jug.</span></div>
        <p class="imp-tag">Comparte el código <b>${esc(p.code)}</b> o el enlace (mínimo 2).</p>
        <div class="imp-players">${p.order.map(id=>`<div class="imp-chip">${esc(p.players[id]?.name||"?")}${id===p.leader?" 👑":""}</div>`).join("")}</div>
        <button class="btn btn-blue" id="drwShare">🔗 Compartir sala</button>
        ${amLeader ? `<label class="lbl" style="color:#fff">Categoría</label>
          <select id="drwCat" class="imp-input">${(S.catList||[]).map(c=>`<option ${c===p.category?"selected":""}>${esc(c)}</option>`).join("")}</select>
          <button class="btn big btn-green" id="drwStart" ${p.order.length<2?"disabled":""}>▶ Empezar</button>` : `<p class="imp-hint">Esperando al anfitrión… 👑</p>`}
      </div>`;
    bindLeave("drwLeave");
    const sh=$("#drwShare"); if(sh) sh.onclick=()=>window.shareGameRoom(p.code, "draw", "Dibuja y Adivina");
    if(amLeader){ $("#drwCat").onchange=e=>send0({t:"setCategory",cat:e.target.value}); $("#drwStart").onclick=()=>send0({t:"start"}); }
  }

  function renderDraw(p){
    const host=$("#drawScreen"); const amDrawer=p.drawer===S.myId;
    const drawerName = p.players[p.drawer]?.name || "?";
    host.innerHTML = `
      <div class="draw-wrap">
        <div class="imp-top"><button class="cruci-back" id="drwLeave">‹</button>
          <span class="imp-code">🎨 ${esc(p.code)}</span>
          <span class="draw-timer" id="drwTimer"></span></div>
        <div class="draw-hdr">${amDrawer ? `✏️ Dibuja: <b>${esc(S.card?S.card.word:"…")}</b>` : `✏️ Dibuja <b>${esc(drawerName)}</b> — ¡adivina!`}</div>
        <div class="draw-canvas-wrap"><canvas id="drwCanvas" class="draw-canvas"></canvas></div>
        ${amDrawer ? `<div class="draw-tools" id="drwTools">
            ${["#111","#E8455e","#2f9bff","#2ECC71","#ffb821","#8a3fd6","#8a5a2b"].map(c=>`<button class="draw-color" data-c="${c}" style="background:${c}"></button>`).join("")}
            <button class="draw-tool" id="drwErase">🧽</button><button class="draw-tool" id="drwClear">🗑️</button>
          </div>`
          : `<div class="draw-guessrow"><input id="drwGuess" class="imp-input" placeholder="Escribe tu adivinanza…" autocomplete="off"/><button class="btn btn-green" id="drwGuessGo">Enviar</button></div>`}
        <div class="draw-feed" id="drwFeed"></div>
      </div>`;
    bindLeave("drwLeave");
    setupCanvas(amDrawer);
    if (amDrawer){
      S.penColor = "#111"; S.penSize = 4;
      $$("#drwTools .draw-color").forEach(b=>b.onclick=()=>{ S.penColor=b.dataset.c; S.penSize=4; $$(".draw-color").forEach(x=>x.classList.toggle("on",x===b)); });
      $("#drwErase").onclick=()=>{ S.penColor="#ffffff"; S.penSize=18; };
      $("#drwClear").onclick=()=>{ S.strokes=[]; clearCanvas(); S.ch.send({type:"broadcast",event:"clear",payload:{}}); };
      $$(".draw-color")[0]?.classList.add("on");
    } else {
      const go=()=>{ const v=($("#drwGuess").value||"").trim(); if(!v) return; $("#drwGuess").value=""; send0({t:"guess",id:S.myId,text:v}); };
      $("#drwGuessGo").onclick=go; $("#drwGuess").onkeydown=e=>{ if(e.key==="Enter") go(); };
    }
    updateGuesses(p); redrawAll();
    startTimer();
  }

  function renderReveal(p){
    const host=$("#drawScreen");
    const solvedName = p.solvedBy ? (p.players[p.solvedBy]?.name||"?") : null;
    const amLeader = p.leader===S.myId;
    const ranking = p.order.map(id=>({id,name:p.players[id]?.name||"?",score:p.players[id]?.score||0})).sort((a,b)=>b.score-a.score);
    host.innerHTML = `
      <div class="imp-wrap">
        <div class="imp-top"><button class="cruci-back" id="drwLeave">‹</button><span class="imp-code">🎨 ${esc(p.code)}</span><span class="imp-sub">Ronda ${p.round}</span></div>
        <div class="imp-reveal ${solvedName?"good":"bad"}">
          <div class="imp-card-emoji">${solvedName?"🎉":"⏰"}</div>
          <p class="imp-reveal-msg">${solvedName?`¡${esc(solvedName)} adivinó!`:"¡Se acabó el tiempo!"}</p>
          <p class="imp-reveal-word">La palabra era <b>${esc(p.word||"")}</b></p>
        </div>
        <div class="imp-board">${ranking.map((x,i)=>`<div class="imp-brow ${x.id===S.myId?"me":""}"><span>${i===0?"🥇":i+1+"º"}</span><span class="imp-bnm">${esc(x.name)}</span><span>${x.score} pts</span></div>`).join("")}</div>
        ${amLeader ? `<button class="btn big btn-green" id="drwNext">▶ Siguiente turno</button><button class="btn ghost" id="drwEnd">Volver a la sala</button>` : `<p class="imp-hint">Esperando al anfitrión… 👑</p>`}
      </div>`;
    bindLeave("drwLeave");
    if(amLeader){ $("#drwNext").onclick=()=>send0({t:"next"}); $("#drwEnd").onclick=()=>send0({t:"end"}); }
  }

  function updateGuesses(p){
    const feed=$("#drwFeed"); if(!feed) return;
    feed.innerHTML = (p.guesses||[]).slice(-8).map(g=>`<div class="draw-guess ${g.correct?"ok":""}">${esc(g.name)}: ${g.correct?"✅ ¡adivinó!":esc(g.text)}</div>`).join("");
    feed.scrollTop = feed.scrollHeight;
  }
  function updateScores(){ /* el marcador se ve en reveal */ }

  // ---------- Lienzo ----------
  function setupCanvas(canDraw){
    const cv=$("#drwCanvas"); if(!cv) return;
    const fit=()=>{ const r=cv.getBoundingClientRect(); cv.width=Math.max(1,Math.round(r.width)); cv.height=Math.max(1,Math.round(r.height)); redrawAll(); };
    fit(); S._fit=fit;
    if(!canDraw) return;
    let drawing=false, buf=[];
    const pt=e=>{ const r=cv.getBoundingClientRect(); const t=e.touches?e.touches[0]:e; return { x:(t.clientX-r.left)/r.width, y:(t.clientY-r.top)/r.height }; };
    const start=e=>{ e.preventDefault(); drawing=true; buf=[pt(e)]; };
    const move=e=>{ if(!drawing) return; e.preventDefault(); buf.push(pt(e)); if(buf.length>=3){ emit(buf.slice()); buf=[buf[buf.length-1]]; } };
    const end=()=>{ if(!drawing) return; drawing=false; if(buf.length>=2) emit(buf.slice()); buf=[]; };
    cv.onpointerdown=start; cv.onpointermove=move; window.addEventListener("pointerup",end);
    cv.ontouchstart=start; cv.ontouchmove=move; cv.ontouchend=end;
  }
  function emit(pts){ const seg={ pts, color:S.penColor, size:S.penSize }; S.strokes.push(seg); drawSeg(seg); try{ S.ch.send({type:"broadcast",event:"stroke",payload:seg}); }catch(e){} }
  function onStroke(seg){ if(!seg||!seg.pts) return; S.strokes.push(seg); drawSeg(seg); }
  function drawSeg(seg){
    const cv=$("#drwCanvas"); if(!cv) return; const ctx=cv.getContext("2d");
    ctx.strokeStyle=seg.color; ctx.lineWidth=(seg.size||4); ctx.lineCap="round"; ctx.lineJoin="round";
    ctx.beginPath();
    seg.pts.forEach((pp,i)=>{ const x=pp.x*cv.width, y=pp.y*cv.height; if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); });
    ctx.stroke();
  }
  function redrawAll(){ const cv=$("#drwCanvas"); if(!cv) return; const ctx=cv.getContext("2d"); ctx.clearRect(0,0,cv.width,cv.height); ctx.fillStyle="#fff"; ctx.fillRect(0,0,cv.width,cv.height); (S.strokes||[]).forEach(drawSeg); }
  function clearCanvas(){ const cv=$("#drwCanvas"); if(!cv) return; const ctx=cv.getContext("2d"); ctx.clearRect(0,0,cv.width,cv.height); ctx.fillStyle="#fff"; ctx.fillRect(0,0,cv.width,cv.height); }

  function startTimer(){
    clearInterval(S.tick);
    const total=85; S.t0=Date.now();
    const upd=()=>{ const el=$("#drwTimer"); if(!el){ clearInterval(S.tick); return; } const left=Math.max(0,total-Math.floor((Date.now()-S.t0)/1000)); el.textContent="⏱️ "+left+"s"; if(left<=0) clearInterval(S.tick); };
    upd(); S.tick=setInterval(upd,500);
  }

  function backHome(){ document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active")); const h=$("#scr-home"); if(h) h.classList.add("active"); }
  function destroy(){ try{clearInterval(S.tick);}catch(e){} try{clearTimeout(S.full&&S.full.timer);}catch(e){} try{ if(S.ch) sbClient().removeChannel(S.ch); }catch(e){} S={onExit:S.onExit}; }
  window.addEventListener("resize", () => { if (S && S._fit && $("#drwCanvas")) S._fit(); });

  // Abrir DENTRO de una sala existente (código compartido + nombre del jugador)
  async function openShared(code, name, isLeader, exitCb){
    S = { onExit: exitCb || null };
    try { await ensureWords(); } catch(e){}
    startSession(String(code).toUpperCase(), name || "Jugador", !!isLeader);
  }

  // Entrar por enlace compartido (con nombre guardado entra directo).
  async function join(code, exitCb){
    S = { onExit: exitCb || null };
    try { await ensureWords(); } catch(e){}
    const nm = (localStorage.getItem("gq_name")||"").trim();
    if (nm){ startSession(String(code).toUpperCase(), nm, false); }
    else { renderStart(); showScreen(); const ci=$("#drwCode"); if(ci) ci.value=String(code).toUpperCase(); const ni=$("#drwName"); if(ni) ni.focus(); }
  }

  return { open, openShared, join, _logic: DrawLogic };
})();
