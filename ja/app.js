// ============================================================
// GAME QUIZ — Lógica principal
// ============================================================
"use strict";

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const SHAPES = ["▲","◆","●","■"];

let sb = null;
const hasBackend = !SUPABASE_URL.includes("PEGA_AQUI");
if (hasBackend) sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- Estado ----------
const S = {
  mode: null,          // 'create' | 'join'
  room: null,          // fila de rooms
  me: null,            // fila de players (yo)
  players: [],
  bank: {},            // cache de preguntas por categoría
  channel: null,
  solo: false,         // sala ZZZX
  selCat: "disney",
  selCount: 10, selMode: "admin", selFilter: "on",
  answered: false,
  qTimer: null, qLeft: 40,
  hostTimers: [],
  blocked: JSON.parse(localStorage.getItem("gq_blocked") || "[]"),
  unread: 0,
  soloState: null,
};

// ---------- Utilidades ----------
function show(id){
  $$(".screen").forEach(e => e.classList.remove("active"));
  $("#scr-" + id).classList.add("active");
  const chatOk = ["lobby","board","podium"].includes(id) && !S.solo && S.room;
  $("#chatFab").classList.toggle("hidden", !chatOk);
  if (id !== "lobby") closeChat();
}
function toast(t){
  const d = document.createElement("div");
  d.className = "toast"; d.textContent = t;
  $("#toasts").appendChild(d);
  setTimeout(() => d.remove(), 3200);
}
function modal(html, buttons){
  $("#modalBox").innerHTML = html;
  buttons.forEach(b => {
    const btn = document.createElement("button");
    btn.className = "btn " + (b.cls || "btn-blue");
    btn.textContent = b.t;
    btn.onclick = () => { $("#modal").classList.add("hidden"); b.fn && b.fn(); };
    $("#modalBox").appendChild(btn);
  });
  $("#modal").classList.remove("hidden");
}
const shuffle = a => { for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };
const roomCode = () => { const L="ABCDEFGHJKLMNPQRSTUVWXYZ"; let c=""; for(let i=0;i<4;i++) c+=L[Math.floor(Math.random()*L.length)]; return c; };
const censor = t => { let r=t; BAD_WORDS.forEach(w=>{ r = r.replace(new RegExp(`\\b${w}\\b`,"gi"),"***"); }); return r; };
const esc = t => t.replace(/[<>&"]/g, c => ({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;"}[c]));

async function loadBank(cat){
  if (S.bank[cat]) return S.bank[cat];
  const r = await fetch(`data/${cat}.json`);
  S.bank[cat] = await r.json();
  return S.bank[cat];
}

// ---------- Conexión / offline ----------
window.addEventListener("offline", () => $("#offlineBanner").classList.remove("hidden"));
window.addEventListener("online", async () => {
  $("#offlineBanner").classList.add("hidden");
  toast("✅ Conexión recuperada");
  if (S.room && !S.solo) await resync();
});
async function resync(){
  const { data: room } = await sb.from("rooms").select("*").eq("id", S.room.id).single();
  const { data: players } = await sb.from("players").select("*").eq("room_id", S.room.id).order("joined_at");
  if (room){ S.room = room; S.players = players || []; handleRoomState(); renderPlayers(); }
}

// ---------- HOME ----------
$("#btnGoCreate").onclick = () => { Sfx.click(); S.mode = "create"; openProfile(); };
$("#btnGoJoin").onclick = () => { Sfx.click(); S.mode = "join"; openProfile(); };
$$("[data-back]").forEach(b => b.onclick = () => { Sfx.click(); show("home"); });

function openProfile(){
  $("#profileTitle").textContent = S.mode === "create" ? "Crea tu sala 🎪" : "Únete a una sala 🚪";
  $("#joinCodeWrap").classList.toggle("hidden", S.mode !== "join");
  renderAvatars([]);
  show("profile");
}
function renderAvatars(taken){
  $("#avatarGrid").innerHTML = "";
  AVATARS.forEach(a => {
    const d = document.createElement("div");
    d.className = "ava" + (taken.includes(a) ? " taken" : "");
    d.textContent = a;
    d.onclick = () => { Sfx.pick(); $$(".ava").forEach(x=>x.classList.remove("sel")); d.classList.add("sel"); };
    $("#avatarGrid").appendChild(d);
  });
}
$("#btnProfileGo").onclick = async () => {
  const name = $("#inpName").value.trim();
  const ava = $(".ava.sel")?.textContent;
  if (!name) return toast("✏️ Escribe tu nombre");
  if (!ava) return toast("🐼 Elige un personaje");
  Sfx.click();
  if (S.mode === "create") return createRoom(name, ava);
  const code = $("#inpCode").value.trim().toUpperCase();
  if (code.length !== 4) return toast("El código tiene 4 letras");
  if (code === TEST_ROOM) return startSolo(name, ava);
  joinRoom(code, name, ava);
};

function needBackend(){
  if (hasBackend) return false;
  modal("<h3>⚙️ Falta configurar Supabase</h3><p>Abre <b>js/config.js</b> y pega tu URL y anon key. Revisa el README para el paso a paso. La sala de prueba <b>ZZZX</b> funciona sin configurar nada.</p>", [{t:"Entendido"}]);
  return true;
}

// ---------- Crear / unirse ----------
async function createRoom(name, ava){
  if (needBackend()) return;
  const code = roomCode();
  const settings = { count:10, mode:"admin", filter:"on", cat:"disney", qids:[] };
  const { data: room, error } = await sb.from("rooms").insert({ code, settings }).select().single();
  if (error) return toast("⚠️ No se pudo crear la sala");
  const { data: me } = await sb.from("players").insert({ room_id: room.id, name, avatar: ava, is_host: true }).select().single();
  await sb.from("rooms").update({ host_id: me.id }).eq("id", room.id);
  room.host_id = me.id;
  enterRoom(room, me);
}
async function joinRoom(code, name, ava){
  if (needBackend()) return;
  const { data: room } = await sb.from("rooms").select("*").eq("code", code).maybeSingle();
  if (!room) return toast("🔍 No existe una sala con ese código");
  if (room.status !== "lobby") return toast("⛔ La partida ya comenzó");
  const { data: players } = await sb.from("players").select("*").eq("room_id", room.id);
  if (players.length >= MAX_PLAYERS) return toast("😅 La sala está llena (15 máx)");
  let avatar = ava;
  if (players.some(p => p.avatar === avatar)){
    avatar = AVATARS.find(a => !players.some(p => p.avatar === a)) || ava;
    toast(`Ese personaje estaba ocupado, te tocó ${avatar}`);
  }
  const late = false;
  const { data: me, error } = await sb.from("players").insert({ room_id: room.id, name, avatar, joined_late: late }).select().single();
  if (error) return toast("⚠️ No se pudo entrar");
  sysMsg(room.id, `${avatar} ${name} entró a la sala 👋`);
  enterRoom(room, me);
}

function saveSession(){ localStorage.setItem("gq_session", JSON.stringify({ roomId: S.room.id, playerId: S.me.id })); }

async function enterRoom(room, me){
  S.room = room; S.me = me; S.solo = false;
  saveSession();
  await subscribeRoom();
  await resync();
  renderLobby();
  show("lobby");
  Sfx.join();
}

// ---------- Reconexión al abrir la app ----------
(async function tryRejoin(){
  const raw = localStorage.getItem("gq_session");
  if (!raw || !hasBackend) return;
  const { roomId, playerId } = JSON.parse(raw);
  const { data: room } = await sb.from("rooms").select("*").eq("id", roomId).maybeSingle();
  if (!room || room.status === "podium"){ localStorage.removeItem("gq_session"); return; }
  const { data: me } = await sb.from("players").select("*").eq("id", playerId).maybeSingle();
  if (!me){ localStorage.removeItem("gq_session"); return; }
  modal(`<h3>🎪 Tienes una partida en curso</h3><p>Sala <b>${room.code}</b> — ¿quieres volver a conectarte?</p>`, [
    { t:"Volver a la sala 🔄", cls:"btn-green", fn: async () => {
        await sb.from("players").update({ connected: true }).eq("id", me.id);
        sysMsg(room.id, `${me.avatar} ${me.name} volvió a la partida 🔄`);
        enterRoom(room, me);
    }},
    { t:"No, salir", cls:"btn-red", fn: async () => {
        await sb.from("players").update({ connected: false }).eq("id", me.id);
        localStorage.removeItem("gq_session");
    }},
  ]);
})();

// ---------- Realtime ----------
async function subscribeRoom(){
  if (S.channel) sb.removeChannel(S.channel);
  const rid = S.room.id;
  S.channel = sb.channel("room-" + rid)
    .on("postgres_changes", { event:"UPDATE", schema:"public", table:"rooms", filter:`id=eq.${rid}` },
      p => { S.room = p.new; handleRoomState(); })
    .on("postgres_changes", { event:"*", schema:"public", table:"players", filter:`room_id=eq.${rid}` },
      p => {
        if (p.eventType === "INSERT"){ S.players.push(p.new); Sfx.join(); }
        else if (p.eventType === "UPDATE"){
          const old = S.players.find(x => x.id === p.new.id);
          if (old && old.connected && !p.new.connected && p.new.id !== S.me.id) Sfx.leave();
          S.players = S.players.map(x => x.id === p.new.id ? p.new : x);
        }
        renderPlayers(); renderBoardIfVisible();
      })
    .on("postgres_changes", { event:"INSERT", schema:"public", table:"answers", filter:`room_id=eq.${rid}` },
      p => { onAnswerInsert(p.new); })
    .on("postgres_changes", { event:"INSERT", schema:"public", table:"messages", filter:`room_id=eq.${rid}` },
      p => { onMessage(p.new); })
    .on("postgres_changes", { event:"*", schema:"public", table:"votes", filter:`room_id=eq.${rid}` },
      () => { refreshVotes(); })
    .subscribe();
}

// ---------- LOBBY ----------
const amHost = () => S.me && S.room && S.room.host_id === S.me.id;

function renderLobby(){
  $("#lobbyCode").textContent = S.room.code;
  $("#hostSettings").classList.toggle("hidden", !amHost());
  $("#btnStart").classList.toggle("hidden", !amHost());
  $("#lobbyHint").classList.toggle("hidden", amHost());
  const st = S.room.settings;
  S.selCount = st.count; S.selMode = st.mode; S.selFilter = st.filter; S.selCat = st.cat;
  syncSeg("#segCount", String(st.count)); syncSeg("#segMode", st.mode); syncSeg("#segFilter", st.filter);
  renderCats(); renderPlayers(); refreshVotes();
}
function syncSeg(sel, v){ $$(sel + " button").forEach(b => b.classList.toggle("on", b.dataset.v === v)); }

function segHandler(sel, key){
  $$(sel + " button").forEach(b => b.onclick = async () => {
    Sfx.click();
    syncSeg(sel, b.dataset.v);
    const settings = { ...S.room.settings, [key]: key === "count" ? +b.dataset.v : b.dataset.v };
    await sb.from("rooms").update({ settings }).eq("id", S.room.id);
  });
}
segHandler("#segCount", "count"); segHandler("#segMode", "mode"); segHandler("#segFilter", "filter");

function renderCats(){
  const grid = $("#catGrid"); grid.innerHTML = "";
  const voteMode = S.room?.settings.mode === "vote";
  $("#catTitle").textContent = voteMode ? "Vota por una categoría 🗳️" : "Categoría 📚" + (amHost() ? "" : " (la elige el anfitrión)");
  CATEGORIES.forEach(c => {
    const b = document.createElement("button");
    b.className = "cat" + (S.room.settings.cat === c.id && !voteMode ? " sel" : "");
    b.innerHTML = `<span class="ce">${c.emoji}</span>${c.name}<span class="votes hidden" id="v-${c.id}">0</span>`;
    b.onclick = async () => {
      Sfx.pick();
      if (voteMode){
        await sb.from("votes").upsert({ room_id:S.room.id, player_id:S.me.id, category:c.id });
        toast(`Votaste por ${c.name} ${c.emoji}`);
      } else if (amHost()){
        const settings = { ...S.room.settings, cat:c.id };
        await sb.from("rooms").update({ settings }).eq("id", S.room.id);
      }
    };
    grid.appendChild(b);
  });
}
async function refreshVotes(){
  if (!S.room || S.room.settings.mode !== "vote") { $$(".votes").forEach(v=>v.classList.add("hidden")); return; }
  const { data } = await sb.from("votes").select("category").eq("room_id", S.room.id);
  const counts = {};
  (data||[]).forEach(v => counts[v.category] = (counts[v.category]||0)+1);
  CATEGORIES.forEach(c => {
    const el = $("#v-" + c.id);
    if (!el) return;
    el.textContent = counts[c.id] || 0;
    el.classList.toggle("hidden", !counts[c.id]);
  });
}

function renderPlayers(){
  const list = $("#playerList"); if (!list) return;
  list.innerHTML = "";
  const alive = S.players.filter(p => p.connected);
  $("#playerCount").textContent = alive.length;
  S.players.forEach(p => {
    const d = document.createElement("div");
    d.className = "chip" + (p.connected ? "" : " off");
    d.innerHTML = `<span class="em">${p.avatar}</span>${esc(p.name)}${p.is_host ? ' <span class="host-star">👑</span>' : ""}`;
    list.appendChild(d);
  });
}

$("#btnShare").onclick = () => {
  Sfx.click();
  const text = `🎲 ¡Juguemos GAME QUIZ! Entra con el código ${S.room.code} 👉 ${location.origin + location.pathname}`;
  if (navigator.share) navigator.share({ text }).catch(()=>{});
  else { navigator.clipboard.writeText(text); toast("📋 Invitación copiada"); }
};

$("#btnLeave").onclick = () => {
  modal("<h3>🚪 ¿Salir de la partida?</h3><p>Podrás volver a entrar, pero perderás los puntos de las preguntas que te pierdas.</p>", [
    { t:"Sí, salir", cls:"btn-red", fn: leaveGame },
    { t:"Quedarme", cls:"btn-green" },
  ]);
};
async function leaveGame(){
  if (S.solo){ endSoloToHome(); return; }
  await sb.from("players").update({ connected:false }).eq("id", S.me.id);
  sysMsg(S.room.id, `${S.me.avatar} ${S.me.name} salió de la partida 👋`);
  if (S.channel) sb.removeChannel(S.channel);
  localStorage.removeItem("gq_session");
  S.hostTimers.forEach(clearTimeout);
  S.room = null; S.me = null; S.players = [];
  show("home");
}

// ---------- INICIO DEL JUEGO (anfitrión) ----------
$("#btnStart").onclick = async () => {
  const alive = S.players.filter(p => p.connected);
  if (alive.length < 2) return toast("🧍 Se necesitan mínimo 2 jugadores");
  Sfx.click();
  let cat = S.room.settings.cat;
  if (S.room.settings.mode === "vote"){
    const { data } = await sb.from("votes").select("category").eq("room_id", S.room.id);
    const counts = {};
    (data||[]).forEach(v => counts[v.category] = (counts[v.category]||0)+1);
    const max = Math.max(0, ...Object.values(counts));
    const top = Object.keys(counts).filter(k => counts[k] === max);
    if (top.length) cat = top[Math.floor(Math.random()*top.length)];
  }
  const bank = await loadBank(cat);
  const count = Math.min(S.room.settings.count, bank.questions.length);
  const qids = shuffle([...bank.questions.keys()]).slice(0, count);
  const settings = { ...S.room.settings, cat, qids, count };
  await sb.from("rooms").update({ settings, status:"countdown", current_q:-1 }).eq("id", S.room.id);
  hostSchedule(() => nextQuestion(0), 3800);
};

function hostSchedule(fn, ms){ S.hostTimers.push(setTimeout(fn, ms)); }

async function nextQuestion(i){
  await sb.from("rooms").update({ status:"question", current_q:i, q_started_at:new Date().toISOString() }).eq("id", S.room.id);
  hostSchedule(() => finishQuestion(i), QUESTION_TIME*1000 + 1500);
}

let finishing = false;
async function finishQuestion(i){
  if (!amHost() || finishing || S.room.current_q !== i || S.room.status !== "question") return;
  finishing = true;
  try{
    const bank = await loadBank(S.room.settings.cat);
    const q = bank.questions[S.room.settings.qids[i]];
    const { data: answers } = await sb.from("answers").select("*").eq("room_id", S.room.id).eq("q_index", i).order("answered_at");
    const t0 = new Date(S.room.q_started_at).getTime();
    const PLACE = [120,115,110,100];
    let place = 0;
    for (const a of (answers||[])){
      if (a.answer !== q.c) continue;
      const secs = Math.max(0, QUESTION_TIME - Math.floor((new Date(a.answered_at).getTime() - t0)/1000));
      const pts = (PLACE[Math.min(place,3)]) + secs;
      place++;
      await sb.from("answers").update({ points: pts, correct: true }).eq("id", a.id);
      const pl = S.players.find(p => p.id === a.player_id);
      if (pl) await sb.from("players").update({ score: pl.score + pts }).eq("id", pl.id);
    }
    await sb.from("rooms").update({ status:"reveal" }).eq("id", S.room.id);
    hostSchedule(async () => {
      await sb.from("rooms").update({ status:"board" }).eq("id", S.room.id);
      hostSchedule(async () => {
        const last = i >= S.room.settings.qids.length - 1;
        if (last) await sb.from("rooms").update({ status:"podium" }).eq("id", S.room.id);
        else nextQuestion(i + 1);
      }, BOARD_TIME*1000);
    }, REVEAL_TIME*1000);
  } finally { finishing = false; }
}

function onAnswerInsert(a){
  if (S.room.status !== "question") return;
  const alive = S.players.filter(p => p.connected).length;
  answersThisQ.add(a.player_id);
  $("#qWait").textContent = `${answersThisQ.size}/${alive} han respondido ✋`;
  if (amHost() && answersThisQ.size >= alive){
    S.hostTimers.forEach(clearTimeout);
    finishQuestion(S.room.current_q);
  }
}

// ---------- Reacción al estado de la sala (todos) ----------
let lastStatus = "", lastQ = -2;
const answersThisQ = new Set();

async function handleRoomState(){
  const st = S.room.status;
  if (st === "lobby"){ renderLobby(); if (lastStatus !== "lobby") show("lobby"); }
  else if (st === "countdown" && lastStatus !== "countdown") runCountdown();
  else if (st === "question" && (lastStatus !== "question" || lastQ !== S.room.current_q)) showQuestion();
  else if (st === "reveal" && lastStatus !== "reveal") showReveal();
  else if (st === "board" && lastStatus !== "board") showBoard();
  else if (st === "podium" && lastStatus !== "podium") showPodium();
  if (st === "lobby") renderCats();
  lastStatus = st; lastQ = S.room.current_q;
}

function runCountdown(){
  show("countdown");
  let n = 3;
  $("#cdNum").textContent = n; Sfx.countdown();
  const iv = setInterval(() => {
    n--;
    if (n <= 0){ clearInterval(iv); $("#cdNum").textContent = "¡YA!"; Sfx.go(); }
    else { $("#cdNum").textContent = n; Sfx.countdown(); }
  }, 1000);
}

async function showQuestion(){
  answersThisQ.clear();
  S.answered = false;
  const i = S.room.current_q;
  const bank = await loadBank(S.room.settings.cat);
  const q = bank.questions[S.room.settings.qids[i]];
  $("#qIdx").textContent = `${i+1}/${S.room.settings.qids.length}`;
  $("#qEmoji").textContent = q.e || bank.emoji;
  $("#qText").textContent = q.q;
  $("#qWait").textContent = "";
  const grid = $("#answerGrid"); grid.innerHTML = "";
  q.o.forEach((opt, idx) => {
    const b = document.createElement("button");
    b.className = `ans a${idx}`;
    b.innerHTML = `<span class="shape">${SHAPES[idx]}</span>${esc(opt)}`;
    b.onclick = () => submitAnswer(idx, q);
    grid.appendChild(b);
  });
  startTimer();
  show("question");
  Sfx.go();
}

function startTimer(){
  clearInterval(S.qTimer);
  const t0 = new Date(S.room.q_started_at).getTime();
  const tick = () => {
    const elapsed = (Date.now() - t0)/1000;
    S.qLeft = Math.max(0, Math.round(QUESTION_TIME - elapsed > QUESTION_TIME ? QUESTION_TIME : QUESTION_TIME - elapsed));
    $("#qTimerNum").textContent = S.qLeft;
    $("#qTimerBar").style.transform = `scaleX(${S.qLeft/QUESTION_TIME})`;
    $("#qTimerBar").style.background = S.qLeft <= 10 ? "var(--red)" : S.qLeft <= 20 ? "var(--yellow)" : "var(--green)";
    if (S.qLeft <= 5 && S.qLeft > 0 && !S.answered) Sfx.urgent();
    else if (S.qLeft > 0 && !S.answered) Sfx.tick();
    if (S.qLeft <= 0) clearInterval(S.qTimer);
  };
  tick();
  S.qTimer = setInterval(tick, 1000);
}

async function submitAnswer(idx, q){
  if (S.answered || S.qLeft <= 0) return;
  S.answered = true;
  Sfx.pick();
  $$(".ans").forEach((b,k) => b.classList.toggle(k === idx ? "picked" : "dim", true));
  if (S.solo) return soloAnswer(idx, q);
  await sb.from("answers").insert({
    room_id: S.room.id, q_index: S.room.current_q,
    player_id: S.me.id, answer: idx, correct: idx === q.c,
  });
}

async function showReveal(){
  clearInterval(S.qTimer);
  const i = S.room.current_q;
  const bank = await loadBank(S.room.settings.cat);
  const q = bank.questions[S.room.settings.qids[i]];
  const { data: mine } = await sb.from("answers").select("*").eq("room_id", S.room.id)
    .eq("q_index", i).eq("player_id", S.me.id).maybeSingle();
  const ok = mine && mine.answer === q.c;
  $("#revealIcon").textContent = ok ? "🎉" : mine ? "😵" : "⏰";
  $("#revealText").textContent = `Respuesta correcta: ${q.o[q.c]}`;
  $("#revealYou").textContent = ok ? `¡Correcto! +${mine.points} puntos` : mine ? "Incorrecto esta vez 😬" : "No alcanzaste a responder";
  ok ? Sfx.correct() : Sfx.wrong();
  show("reveal");
}

function renderBoardIfVisible(){ if (S.room && S.room.status === "board") showBoard(); }

function showBoard(){
  const sorted = [...S.players].sort((a,b) => b.score - a.score);
  const list = $("#boardList"); list.innerHTML = "";
  sorted.forEach((p, i) => {
    const d = document.createElement("div");
    d.className = "brow" + (p.id === S.me?.id ? " me" : "");
    d.innerHTML = `<span class="pos">${i===0?"🥇":i+1+"º"}</span><span class="em">${p.avatar}</span>
      <span class="nm">${esc(p.name)}${p.connected?"":" 💤"}</span><span class="pts">${p.score} pts</span>`;
    list.appendChild(d);
  });
  Sfx.board();
  show("board");
}

// ---------- PODIO + fuegos artificiales ----------
function showPodium(){
  const sorted = [...S.players].sort((a,b) => b.score - a.score);
  const [p1,p2,p3] = sorted;
  const set = (n, p) => {
    $(`#pod${n}a`).textContent = p ? p.avatar : "";
    $(`#pod${n}n`).textContent = p ? `${p.name} · ${p.score}` : "";
  };
  set(1,p1); set(2,p2); set(3,p3);
  const rest = $("#podiumRest"); rest.innerHTML = "";
  sorted.slice(3).forEach((p,i) => {
    const d = document.createElement("div");
    d.className = "brow" + (p.id === S.me?.id ? " me" : "");
    d.innerHTML = `<span class="pos">${i+4}º</span><span class="em">${p.avatar}</span><span class="nm">${esc(p.name)}</span><span class="pts">${p.score} pts</span>`;
    rest.appendChild(d);
  });
  show("podium");
  Sfx.fanfare();
  fireworks(8000);
  localStorage.removeItem("gq_session");
}

$("#btnAgain").onclick = () => {
  Sfx.click();
  if (S.channel) sb?.removeChannel(S.channel);
  S.hostTimers.forEach(clearTimeout);
  S.room = null; S.me = null; S.players = []; S.solo = false;
  show("home");
};

function fireworks(dur){
  const cv = $("#fx"), ctx = cv.getContext("2d");
  cv.width = innerWidth; cv.height = innerHeight;
  let parts = [], end = Date.now() + dur;
  function boom(){
    const x = Math.random()*cv.width, y = Math.random()*cv.height*0.55;
    const col = `hsl(${Math.random()*360},95%,60%)`;
    for (let i=0;i<42;i++){
      const a = Math.random()*Math.PI*2, v = 2+Math.random()*4;
      parts.push({ x, y, vx:Math.cos(a)*v, vy:Math.sin(a)*v, life:60+Math.random()*30, col });
    }
  }
  const iv = setInterval(boom, 650); boom();
  (function frame(){
    ctx.clearRect(0,0,cv.width,cv.height);
    parts.forEach(p => { p.x+=p.vx; p.y+=p.vy; p.vy+=0.06; p.life--; ctx.globalAlpha=Math.max(0,p.life/80);
      ctx.fillStyle=p.col; ctx.beginPath(); ctx.arc(p.x,p.y,2.6,0,7); ctx.fill(); });
    ctx.globalAlpha = 1;
    parts = parts.filter(p => p.life > 0);
    if (Date.now() < end || parts.length) requestAnimationFrame(frame);
    else { clearInterval(iv); ctx.clearRect(0,0,cv.width,cv.height); }
  })();
  setTimeout(()=>clearInterval(iv), dur);
}

// ---------- CHAT ----------
$("#chatFab").onclick = () => { $("#chatPanel").classList.remove("hidden"); S.unread = 0; badge(); };
$("#chatClose").onclick = closeChat;
function closeChat(){ $("#chatPanel").classList.add("hidden"); $("#stickerTray").classList.add("hidden"); }
function badge(){
  $("#chatBadge").textContent = S.unread;
  $("#chatBadge").classList.toggle("hidden", S.unread === 0);
}
$("#btnStickers").onclick = () => {
  const t = $("#stickerTray");
  if (!t.children.length) STICKERS.forEach(s => {
    const b = document.createElement("button"); b.textContent = s;
    b.onclick = () => { sendMsg(null, s); t.classList.add("hidden"); };
    t.appendChild(b);
  });
  t.classList.toggle("hidden");
};
$("#btnSend").onclick = () => { const v = $("#chatText").value.trim(); if (v){ sendMsg(v, null); $("#chatText").value=""; } };
$("#chatText").addEventListener("keydown", e => { if (e.key === "Enter") $("#btnSend").click(); });

async function sendMsg(content, sticker){
  if (!S.room || S.solo) return;
  let c = content;
  if (c && S.room.settings.filter === "on") c = censor(c);
  await sb.from("messages").insert({
    room_id:S.room.id, player_id:S.me.id, player_name:S.me.name, avatar:S.me.avatar,
    content:c, sticker,
  });
}
function sysMsg(roomId, text){
  if (!sb) return;
  sb.from("messages").insert({ room_id:roomId, content:text, player_id:null }).then(()=>{});
}
function onMessage(m){
  if (m.player_id && S.blocked.includes(m.player_id)) return;
  if (!m.player_id){ toast(m.content); Sfx.msg(); appendMsg(m); return; }
  appendMsg(m);
  if ($("#chatPanel").classList.contains("hidden") && m.player_id !== S.me.id){ S.unread++; badge(); Sfx.msg(); }
}
function appendMsg(m){
  const box = $("#chatMsgs");
  const d = document.createElement("div");
  if (!m.player_id){ d.className = "msg sys"; d.textContent = m.content; }
  else {
    d.className = "msg" + (m.player_id === S.me.id ? " mine" : "");
    let text = m.content ? esc(S.room.settings.filter === "on" ? censor(m.content) : m.content) : "";
    d.innerHTML = `<div class="who">${m.avatar} ${esc(m.player_name)}
      ${m.player_id !== S.me.id ? `<button data-block="${m.player_id}">🚫</button>` : ""}</div>
      ${m.sticker ? `<div class="stick">${m.sticker}</div>` : `<div>${text}</div>`}`;
    const bb = d.querySelector("[data-block]");
    if (bb) bb.onclick = () => blockPlayer(m.player_id, m.player_name);
  }
  box.appendChild(d);
  box.scrollTop = box.scrollHeight;
}
function blockPlayer(id, name){
  modal(`<h3>🚫 Bloquear a ${esc(name)}</h3><p>Dejarás de ver sus mensajes en el chat (solo para ti).</p>`, [
    { t:"Bloquear", cls:"btn-red", fn: () => {
        S.blocked.push(id);
        localStorage.setItem("gq_blocked", JSON.stringify(S.blocked));
        toast(`No verás más mensajes de ${name}`);
    }},
    { t:"Cancelar" },
  ]);
}

// ---------- MODO SOLO (sala ZZZX) ----------
async function startSolo(name, ava){
  S.solo = true;
  S.me = { id:"solo", name, avatar:ava, score:0, connected:true };
  S.players = [S.me];
  modal(`<h3>🧪 Sala de prueba ZZZX</h3><p>Modo solitario para probar el juego. No se puede invitar a nadie.</p>
  <label class="lbl">Categoría</label><select id="soloCat" class="inp">${CATEGORIES.map(c=>`<option value="${c.id}">${c.emoji} ${c.name}</option>`).join("")}</select>
  <label class="lbl">Preguntas</label><select id="soloN" class="inp"><option>10</option><option>20</option><option>30</option></select>`, [
    { t:"¡Jugar! 🚀", cls:"btn-green", fn: async () => {
        const cat = $("#soloCat").value, n = +$("#soloN").value;
        const bank = await loadBank(cat);
        S.soloState = { cat, i:0, qids: shuffle([...bank.questions.keys()]).slice(0, Math.min(n, bank.questions.length)) };
        S.room = { status:"countdown", settings:{ cat, qids:S.soloState.qids, filter:"off" }, current_q:-1, q_started_at:null };
        runCountdown();
        setTimeout(() => soloQuestion(0), 3800);
    }},
    { t:"Volver", fn: () => { S.solo = false; show("home"); } },
  ]);
}
function soloQuestion(i){
  S.soloState.i = i;
  S.room.current_q = i;
  S.room.q_started_at = new Date().toISOString();
  S.room.status = "question";
  showQuestion();
  S.soloTimeout = setTimeout(() => soloFinish(null), QUESTION_TIME*1000 + 400);
}
async function soloAnswer(idx, q){
  clearTimeout(S.soloTimeout);
  soloFinish({ idx, q });
}
async function soloFinish(ans){
  clearInterval(S.qTimer);
  const bank = await loadBank(S.soloState.cat);
  const q = bank.questions[S.soloState.qids[S.soloState.i]];
  let pts = 0, ok = false;
  if (ans && ans.idx === q.c){ ok = true; pts = 120 + S.qLeft; S.me.score += pts; }
  $("#revealIcon").textContent = ok ? "🎉" : ans ? "😵" : "⏰";
  $("#revealText").textContent = `Respuesta correcta: ${q.o[q.c]}`;
  $("#revealYou").textContent = ok ? `¡Correcto! +${pts} puntos · Total: ${S.me.score}` : ans ? "Incorrecto 😬" : "Se acabó el tiempo";
  ok ? Sfx.correct() : Sfx.wrong();
  show("reveal");
  setTimeout(() => {
    const last = S.soloState.i >= S.soloState.qids.length - 1;
    if (last){ S.players = [S.me]; showPodiumSolo(); }
    else soloQuestion(S.soloState.i + 1);
  }, REVEAL_TIME*1000);
}
function showPodiumSolo(){
  $("#pod1a").textContent = S.me.avatar;
  $("#pod1n").textContent = `${S.me.name} · ${S.me.score}`;
  $("#pod2a").textContent = ""; $("#pod2n").textContent = "";
  $("#pod3a").textContent = ""; $("#pod3n").textContent = "";
  $("#podiumRest").innerHTML = "";
  show("podium"); Sfx.fanfare(); fireworks(6000);
}
function endSoloToHome(){ S.solo = false; S.room = null; S.soloState = null; show("home"); }

// ---------- PWA ----------
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(()=>{});
