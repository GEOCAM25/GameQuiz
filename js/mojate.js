// ============================================================
// GAME QUIZ — MÓJATE 💦  (¿Quién es más probable que...?)
// Juego grande para todo el grupo, tipo "mójate el potito": sale una
// pregunta ("¿Quién es más probable que...?") y TODOS votan por la
// persona que mejor calza. Se revela quién ganó los votos (¡y se
// moja!) y quién votó a quién. Ronda tras ronda, y al final el más
// nominado de la noche.
//
// Autónomo (broadcast + presence de Supabase), como Incógnito/Dibuja:
// no toca el motor de la trivia ni requiere SQL. Modos: familiar y
// atrevido (picante).
// ============================================================
const Mojate = (() => {
  const $  = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  const rid = () => Math.random().toString(36).slice(2, 10);
  function code4(){ const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let c=""; for(let i=0;i<4;i++) c+=A[Math.floor(Math.random()*A.length)]; return c; }
  const sbClient = () => (typeof sb !== "undefined" && sb) ? sb : (window.sb || null);

  // ---------- Lógica pura (testeable) ----------
  const Logic = {
    tally(votes){ const t = {}; Object.values(votes||{}).forEach(x => { if (x) t[x] = (t[x]||0)+1; }); return t; },
    winners(tally){
      const e = Object.entries(tally); if (!e.length) return [];
      const max = Math.max(...e.map(([,c]) => c));
      return e.filter(([,c]) => c === max).map(([id]) => id);
    },
    pick(bank, used){
      const pool = bank.map((_,i)=>i).filter(i => !used.includes(i));
      const src = pool.length ? pool : bank.map((_,i)=>i);
      return src[Math.floor(Math.random()*src.length)];
    },
  };

  let S = null, BANK = null;
  async function ensureBank(){ if (BANK) return BANK; const r = await fetch("data/mojate.json",{cache:"no-store"}); BANK = await r.json(); return BANK; }
  function showScreen(){ document.querySelectorAll(".screen").forEach(s => s.classList.remove("active")); const sc = $("#scr-mojate"); if (sc) sc.classList.add("active"); }

  async function open(exitCb){ S = { onExit: exitCb || null }; try { await ensureBank(); } catch(e){} renderStart(); showScreen(); }
  // Abrir dentro de una sala existente (código y nombre compartidos)
  async function openShared(code, name, isLeader, exitCb){ S = { onExit: exitCb || null }; try { await ensureBank(); } catch(e){} startSession(String(code).toUpperCase(), name || "Jugador", !!isLeader); }

  function renderStart(){
    const host = $("#mojateScreen");
    const saved = (localStorage.getItem("gq_name")||"").trim();
    host.innerHTML = `
      <div class="imp-wrap">
        <button class="cruci-back" id="mojBack">‹</button>
        <div class="imp-logo">💦</div>
        <h2 class="imp-title">Mójate</h2>
        <p class="imp-tag">¿Quién es más probable que…? Todos votan. El más votado… ¡se moja! 😅</p>
        <input id="mojName" class="imp-input" maxlength="14" placeholder="Tu nombre" value="${esc(saved)}" />
        <button class="btn big btn-green" id="mojCreate">🎪 Crear sala</button>
        <div class="imp-or">o</div>
        <div class="imp-joinrow">
          <input id="mojCode" class="imp-input" maxlength="4" placeholder="CÓDIGO" style="text-transform:uppercase" />
          <button class="btn btn-blue" id="mojJoin">Unirse</button>
        </div>
      </div>`;
    $("#mojBack").onclick = () => { destroy(); if (S.onExit) S.onExit(); };
    $("#mojCreate").onclick = () => { const n=($("#mojName").value||"").trim(); if(!n) return toast("✏️ Escribe tu nombre"); localStorage.setItem("gq_name",n); startSession(code4(), n, true); };
    $("#mojJoin").onclick = () => { const n=($("#mojName").value||"").trim(); if(!n) return toast("✏️ Escribe tu nombre"); const c=($("#mojCode").value||"").trim().toUpperCase(); if(c.length!==4) return toast("El código tiene 4 letras"); localStorage.setItem("gq_name",n); startSession(c, n, false); };
  }

  function startSession(code, name, isLeader){
    const client = sbClient(); if (!client){ toast("Necesita conexión (Supabase)"); return; }
    const myId = rid();
    S = { ...S, code, myId, name, isLeader, ch:null, pub:null,
          full: isLeader ? { code, leader:myId, phase:"lobby", mode:"familiar", total:15, players:{}, order:[], round:0, used:[], question:null, votes:{}, result:null, timer:null } : null };
    S.ch = client.channel("moj-"+code, { config:{ broadcast:{ self:false }, presence:{ key:myId } } });
    S.ch.on("broadcast", { event:"pub" }, ({payload}) => { S.pub = payload; render(); })
        .on("broadcast", { event:"cmd" }, ({payload}) => { if (S.isLeader) hostDispatch(payload); })
        .on("broadcast", { event:"hello" }, () => { if (S.isLeader) broadcastPub(); })
        .on("presence", { event:"leave" }, ({key}) => { if (S.isLeader && key) hostDispatch({t:"leave",id:key}); })
        .subscribe(async (st) => { if (st==="SUBSCRIBED"){ try{await S.ch.track({name});}catch(e){} if(S.isLeader) hostDispatch({t:"join",id:myId,name}); else { send({t:"join",id:myId,name}); S.ch.send({type:"broadcast",event:"hello",payload:{id:myId}}); } } });
    render(); showScreen();
  }
  function send(cmd){ if (S.ch) S.ch.send({ type:"broadcast", event:"cmd", payload:cmd }); }
  function send0(cmd){ if (S.isLeader) hostDispatch(cmd); else send(cmd); }

  // ---------- Anfitrión ----------
  function hostDispatch(cmd){
    const f = S.full; if (!f) return;
    switch (cmd.t){
      case "join": if(!f.players[cmd.id]) f.players[cmd.id]={name:cmd.name||"Jugador",noms:0}; else f.players[cmd.id].name=cmd.name||f.players[cmd.id].name; if(!f.order.includes(cmd.id)) f.order.push(cmd.id); break;
      case "leave": delete f.players[cmd.id]; f.order=f.order.filter(x=>x!==cmd.id); if(f.leader===cmd.id) f.leader=f.order[0]||f.leader; break;
      case "setMode": if(f.phase==="lobby") f.mode=cmd.mode==="atrevido"?"atrevido":"familiar"; break;
      case "setRounds": if(f.phase==="lobby") f.total=[15,20,25].includes(cmd.n)?cmd.n:15; break;
      case "start": if(f.phase==="lobby" && f.order.length>=3){ Object.values(f.players).forEach(pl=>pl.noms=0); f.round=0; f.used=[]; hostAsk(); } break;
      case "vote": if(f.phase==="vote" && f.players[cmd.id] && f.players[cmd.target]){ f.votes[cmd.id]=cmd.target; if(f.order.every(id=>f.votes[id]!=null)) return hostReveal(); } break;
      case "next": if(f.phase==="reveal") hostAsk(); break;
      case "end": if(f.phase==="reveal"||f.phase==="vote"){ f.phase="lobby"; f.question=null; f.votes={}; f.result=null; clearTimeout(f.timer); } break;
    }
    broadcastPub();
  }
  function hostAsk(){
    const f = S.full;
    const bank = (BANK && BANK[f.mode]) || (BANK && BANK.familiar) || ["haga algo?"];
    const qi = Logic.pick(bank, f.used);
    f.used.push(qi); if (f.used.length > bank.length - 1) f.used = [qi];
    f.question = bank[qi]; f.votes = {}; f.result = null; f.round++; f.phase = "vote";
    broadcastPub();
    clearTimeout(f.timer); f.timer = setTimeout(hostReveal, 45000);
  }
  function hostReveal(){
    const f = S.full; if (f.phase === "reveal") return;
    clearTimeout(f.timer);
    const tally = Logic.tally(f.votes);
    const winners = Logic.winners(tally);
    // sumar nominaciones (votos recibidos) para el ranking de la noche
    Object.entries(tally).forEach(([id,c]) => { if (f.players[id]) f.players[id].noms += c; });
    f.result = { question:f.question, tally, winners, votes:f.votes, last: f.round >= f.total };
    f.phase = "reveal";
    broadcastPub();
  }
  function broadcastPub(){
    const f = S.full; if (!f) return;
    const pub = { code:f.code, leader:f.leader, phase:f.phase, mode:f.mode, total:f.total, players:f.players, order:f.order,
                  round:f.round, question:f.question,
                  voted: Object.fromEntries(Object.keys(f.votes).map(k=>[k,true])),   // en 'vote' solo QUIÉN votó
                  result: f.phase==="reveal" ? f.result : null };
    S.pub = pub; render();
    if (S.ch) S.ch.send({ type:"broadcast", event:"pub", payload:pub });
  }

  // ---------- Interfaz ----------
  function render(){
    const host = $("#mojateScreen"); if (!host) return;
    const p = S.pub;
    if (!p){ if(!host.querySelector(".imp-wrap")) host.innerHTML = `<div class="imp-wrap"><div class="imp-logo">💦</div><p class="imp-tag">Conectando a <b>${esc(S.code||"")}</b>…</p></div>`; return; }
    if (p.phase === "lobby") return renderLobby(p);
    if (p.phase === "vote")  return renderVote(p);
    if (p.phase === "reveal") return renderReveal(p);
  }
  function bindLeave(){ const b=$("#mojLeave"); if(b) b.onclick=()=>{ destroy(); if(S.onExit) S.onExit(); else backHome(); }; }
  function top(p, sub){ return `<div class="imp-top"><button class="cruci-back" id="mojLeave">‹</button><span class="imp-code">💦 ${esc(p.code)}</span><span class="imp-sub">${sub||""}</span></div>`; }

  function renderLobby(p){
    const host = $("#mojateScreen"); const amLeader = p.leader===S.myId;
    host.innerHTML = `
      <div class="imp-wrap">
        ${top(p, `${p.order.length} jug.`)}
        <p class="imp-tag">Comparte el código <b>${esc(p.code)}</b> (mínimo 3).</p>
        <div class="imp-players">${p.order.map(id=>`<div class="imp-chip">${esc(p.players[id]?.name||"?")}${id===p.leader?" 👑":""}</div>`).join("")}</div>
        ${amLeader ? `
          <label class="lbl" style="color:#fff">Modo</label>
          <div class="seg" id="mojSeg">
            <button data-m="familiar" class="${p.mode==="familiar"?"on":""}">😇 Familiar</button>
            <button data-m="atrevido" class="${p.mode==="atrevido"?"on":""}">🔥 Atrevido</button>
          </div>
          <label class="lbl" style="color:#fff">Preguntas por partida</label>
          <div class="seg" id="mojRounds">
            <button data-n="15" class="${p.total===15?"on":""}">15</button>
            <button data-n="20" class="${p.total===20?"on":""}">20</button>
            <button data-n="25" class="${p.total===25?"on":""}">25</button>
          </div>
          <button class="btn big btn-green" id="mojStart" ${p.order.length<3?"disabled":""}>▶ Empezar</button>
          ${p.order.length<3?'<p class="imp-hint">Faltan jugadores</p>':''}` : `<p class="imp-hint">Esperando al anfitrión… 👑 (${p.mode==="atrevido"?"🔥 Atrevido":"😇 Familiar"} · ${p.total} preguntas)</p>`}
      </div>`;
    bindLeave();
    if(amLeader){
      $$("#mojSeg button").forEach(b=>b.onclick=()=>send0({t:"setMode",mode:b.dataset.m}));
      $$("#mojRounds button").forEach(b=>b.onclick=()=>send0({t:"setRounds",n:+b.dataset.n}));
      $("#mojStart").onclick=()=>send0({t:"start"});
    }
  }

  function renderVote(p){
    const host = $("#mojateScreen");
    const myVote = null; // el voto propio no se ve hasta el reveal
    const iVoted = p.voted && p.voted[S.myId];
    host.innerHTML = `
      <div class="imp-wrap">
        ${top(p, `Ronda ${p.round}/${p.total}`)}
        <div class="moj-q">🤔 ¿Quién es más probable que…<br><b>${esc(p.question||"")}</b></div>
        ${iVoted ? `<p class="imp-hint">Voto enviado ✓ — esperando al resto… (${Object.keys(p.voted).length}/${p.order.length})</p>`
          : `<div class="imp-votegrid">${p.order.map(id=>`<button class="imp-vbtn" data-id="${id}">${esc(p.players[id]?.name||"?")}${id===S.myId?" (yo)":""}</button>`).join("")}</div>`}
      </div>`;
    bindLeave();
    if(!iVoted) $$("#mojateScreen .imp-vbtn").forEach(b=>b.onclick=()=>send0({t:"vote",id:S.myId,target:b.dataset.id}));
  }

  function renderReveal(p){
    const host = $("#mojateScreen"); const r = p.result||{}; const amLeader = p.leader===S.myId;
    const last = !!r.last;
    const names = id => p.players[id]?.name || "?";
    const winnersTxt = (r.winners||[]).map(names).join(" y ");
    // quién votó a quién
    const byTarget = {};
    Object.entries(r.votes||{}).forEach(([voter,target]) => { (byTarget[target] = byTarget[target]||[]).push(voter); });
    const ranking = p.order.map(id=>({id,name:names(id),noms:p.players[id]?.noms||0})).sort((a,b)=>b.noms-a.noms);
    const rankRows = ranking.map((x,i)=>`<div class="imp-brow ${x.id===S.myId?"me":""}"><span>${i===0?"👑":i+1+"º"}</span><span class="imp-bnm">${esc(x.name)}</span><span>${x.noms} 🗳️</span></div>`).join("");
    const champTxt = ranking.length && ranking[0].noms>0 ? ranking.filter(x=>x.noms===ranking[0].noms).map(x=>x.name).join(" y ") : "Nadie";
    host.innerHTML = `
      <div class="imp-wrap">
        ${top(p, `Ronda ${p.round}/${p.total}`)}
        <div class="moj-q small">¿Quién es más probable que… <b>${esc(r.question||"")}</b></div>
        <div class="moj-winner">
          <div class="moj-splash">💦</div>
          <p class="moj-wname">${esc(winnersTxt||"Nadie")}</p>
          <p class="moj-wsub">${(r.winners||[]).length>1?"¡Se mojan!":"¡Se moja el potito!"} 😅</p>
        </div>
        <div class="moj-breakdown">
          ${p.order.map(id=>{
            const c = (r.tally&&r.tally[id])||0;
            const voters = (byTarget[id]||[]).map(names).join(", ");
            return c>0 ? `<div class="moj-brow"><span class="moj-bn">${esc(names(id))}</span><span class="moj-bc">${c} 🗳️</span><span class="moj-bv">${esc(voters)}</span></div>` : "";
          }).join("")}
        </div>
        ${ last ? `
          <div class="moj-final">
            <p class="moj-final-t">🏆 Fin de la partida</p>
            <p class="moj-final-champ">El más mojado de la noche: <b>${esc(champTxt)}</b> 💦</p>
            <div class="moj-final-board">${rankRows}</div>
          </div>
          ${amLeader ? `<button class="btn big btn-green" id="mojAgain">🔁 Nueva partida</button><button class="btn ghost" id="mojEnd">Volver a la sala</button>` : `<p class="imp-hint">Esperando al anfitrión… 👑</p>`}
        ` : `
          <details class="moj-rank"><summary>🏆 Ranking de la noche</summary>${rankRows}</details>
          ${amLeader ? `<button class="btn big btn-green" id="mojNext">▶ Otra pregunta (${p.round}/${p.total})</button><button class="btn ghost" id="mojEnd">Terminar partida</button>` : `<p class="imp-hint">Esperando al anfitrión… 👑</p>`}
        `}
      </div>`;
    bindLeave();
    if(amLeader){
      const nx=$("#mojNext"); if(nx) nx.onclick=()=>send0({t:"next"});
      const ag=$("#mojAgain"); if(ag) ag.onclick=()=>send0({t:"end"});
      $("#mojEnd").onclick=()=>send0({t:"end"});
    }
  }

  function backHome(){ document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active")); const h=$("#scr-home"); if(h) h.classList.add("active"); }
  function destroy(){ try{clearTimeout(S.full&&S.full.timer);}catch(e){} try{ if(S.ch) sbClient().removeChannel(S.ch); }catch(e){} S={onExit:S.onExit}; }

  return { open, openShared, _logic: Logic };
})();
