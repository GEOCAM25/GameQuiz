// ============================================================
// GAME QUIZ — Lógica principal
// ============================================================
"use strict";

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const SHAPES = ["●","◆","▲","■"];

// Anti doble-tap-zoom en iOS (Safari ignora user-scalable=no).
// Si detecta dos toques a menos de 300ms, cancela el segundo.
let _lastTouch = 0;
document.addEventListener("touchend", e => {
  const now = Date.now();
  if (now - _lastTouch < 300) e.preventDefault();
  _lastTouch = now;
}, { passive: false });
// Cancela el gesto de pellizco/zoom
document.addEventListener("gesturestart", e => e.preventDefault());

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
  hostTimers: [], hostLoop: null, syncLoop: null,
  miniIntroIv: null, miniPlayIv: null,
  flashNext: 0, flashScore: 0, flashDone: false,
  colorRound: 0, colorScore: 0, colorAnswered: false,
  memoInput: [], memoDone: false, memoT0: 0, memoHideT: null,
  puntHits: 0, puntDone: false, puntSpawnIv: null,
  reacRound: 0, reacTotal: 0, reacFouls: 0, reacDone: false, reacReady: false, reacShownAt: 0, reacGoT: null,
  ritmoLevel: 2, ritmoInput: [], ritmoScore: 0, ritmoDone: false, ritmoLocked: true,
  pregT0: 0, pregDone: false, pregFilled: [],
  delatorVoted: false,
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
  // Propina visible solo donde no estorba (no durante pregunta/cuenta regresiva)
  const tip = $("#tipFab");
  if (tip) tip.classList.toggle("hidden", !["home","podium"].includes(id));
  if (id !== "lobby") closeChat();
  if (id === "home" || id === "profile" || id === "lobby") clearCategoryTheme();
}
function toast(t){
  const d = document.createElement("div");
  d.className = "toast"; d.textContent = t;
  $("#toasts").appendChild(d);
  setTimeout(() => d.remove(), 3200);
}

// Fondo temático según la categoría (punto 12). Agrega clase theme-<cat> al body.
const THEME_CATS = ["disney","pixar","netflix","hbo","anime","cine","famosos","geek",
  "banderas","historia","pop","trivia","curiosos","tecnologia","espacio","animales","futbol","deportes"];
function applyCategoryTheme(cat){
  THEME_CATS.forEach(c => document.body.classList.remove("theme-" + c));
  if (cat) document.body.classList.add("theme-" + cat);
}
function clearCategoryTheme(){ THEME_CATS.forEach(c => document.body.classList.remove("theme-" + c)); }
function modal(html, buttons){
  $("#modalBox").innerHTML = html;
  buttons.forEach(b => {
    const btn = document.createElement("button");
    btn.className = "btn " + (b.cls || "btn-blue");
    btn.textContent = b.t;
    btn.onclick = () => { if (!b.keep) $("#modal").classList.add("hidden"); b.fn && b.fn(); };
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
// Color de fondo por avatar (punto 11). Coincide 1:1 con AVATARS por índice.
const AVATAR_COLORS = ["#FFB84D","#5BC0EB","#F76C6C","#9BC53D","#C3A0E8",
  "#4ECDC4","#FF8FA3","#FFD23F","#7BDFF2","#B388EB",
  "#F4A261","#63C7B2","#E56399","#FFCB77","#A0C4FF"];
function avatarColor(a){ const i = AVATARS.indexOf(a); return i>=0 ? AVATAR_COLORS[i % AVATAR_COLORS.length] : "#EDE4D8"; }

function renderAvatars(taken){
  $("#avatarGrid").innerHTML = "";
  AVATARS.forEach(a => {
    const d = document.createElement("div");
    d.className = "ava" + (taken.includes(a) ? " taken" : "");
    d.textContent = a;
    d.style.background = avatarColor(a);
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
  const settings = { count:10, mode:"admin", filter:"on", cat:"disney", qids:[], scoreMode:"reset" };
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
  // Nombre duplicado entre jugadores conectados (bug 2)
  const nameTaken = players.some(p => p.connected && p.name.trim().toLowerCase() === name.trim().toLowerCase());
  if (nameTaken) return toast("🙋 Ese nombre ya está en uso, elige otro");
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
  clearInterval(S.syncLoop);
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

  // Watchdog del CLIENTE: si Realtime se cae en silencio, re-sincroniza
  // solo cada 4s durante la partida. Nadie tiene que refrescar a mano (bug 4).
  clearInterval(S.syncLoop);
  S.syncLoop = setInterval(async () => {
    if (!S.room || S.solo) return;
    if (["question","reveal","board","countdown","mini"].includes(S.room.status)) {
      try { await resync(); } catch(e){}
    }
  }, 4000);
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
  syncSeg("#segScore", st.scoreMode || "reset");
  syncMinis(st.minis || (st.mini ? [st.mini] : ["none"]));
  renderCats(); renderPlayers(); refreshVotes();
}
function syncMinis(arr){ $$("#miniGrid button").forEach(b => b.classList.toggle("on", arr.includes(b.dataset.v))); }
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
segHandler("#segScore", "scoreMode");

// Selector de mini-juegos (selección múltiple: puedes elegir varios a la vez)
$$("#miniGrid button").forEach(b => b.onclick = async () => {
  if (b.disabled) return;
  Sfx.click();
  const v = b.dataset.v;
  let cur = S.room.settings.minis || (S.room.settings.mini ? [S.room.settings.mini] : ["none"]);
  if (v === "none" || v === "random"){
    cur = [v]; // "Ninguno" y "Al azar" son excluyentes con el resto
  } else {
    cur = cur.filter(k => k !== "none" && k !== "random");
    cur = cur.includes(v) ? cur.filter(k => k !== v) : [...cur, v];
    if (cur.length === 0) cur = ["none"];
  }
  syncMinis(cur);
  const settings = { ...S.room.settings, minis: cur };
  await sb.from("rooms").update({ settings }).eq("id", S.room.id);
});

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
    d.innerHTML = `<span class="em" style="background:${avatarColor(p.avatar)}">${p.avatar}</span>${esc(p.name)}${p.is_host ? ' <span class="host-star">👑</span>' : ""}`;
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
  // Si yo era el anfitrión, traspaso el mando a otro jugador conectado (bug 7)
  if (amHost()){
    const heir = S.players.find(p => p.connected && p.id !== S.me.id);
    if (heir){
      await sb.from("players").update({ is_host: true }).eq("id", heir.id);
      await sb.from("rooms").update({ host_id: heir.id }).eq("id", S.room.id);
      sysMsg(S.room.id, `👑 ${heir.avatar} ${heir.name} es el nuevo anfitrión`);
    }
  }
  stopHostLoop();
  await sb.from("players").update({ connected:false }).eq("id", S.me.id);
  sysMsg(S.room.id, `${S.me.avatar} ${S.me.name} salió de la partida 👋`);
  if (S.channel) sb.removeChannel(S.channel);
  clearInterval(S.syncLoop);
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

  // Decidir qué mini-juegos entran (pueden ser varios) y en qué momento aparece cada uno
  const IMPLEMENTED_MINIS = ["flash","color","memoria","punteria","reaccion","ritmo","delator","preg"];
  let chosen = S.room.settings.minis || (S.room.settings.mini ? [S.room.settings.mini] : ["none"]);
  let minisToPlay = [];
  if (chosen.includes("random")){
    const howMany = 1 + Math.floor(Math.random() * IMPLEMENTED_MINIS.length); // 1 o 2
    minisToPlay = shuffle([...IMPLEMENTED_MINIS]).slice(0, howMany);
  } else if (!chosen.includes("none") && chosen.length){
    minisToPlay = chosen.filter(k => IMPLEMENTED_MINIS.includes(k));
  }
  // Delator necesita al menos 3 jugadores para tener gracia; si no, se descarta
  const connectedCount = S.players.filter(p => p.connected).length;
  if (connectedCount < 3) minisToPlay = minisToPlay.filter(k => k !== "delator");

  // Cada mini-juego aparece en un punto distinto (entre la pregunta 2 y la penúltima, nunca repetido)
  let miniSchedule = [];
  if (minisToPlay.length && count >= 3){
    const totalSlots = count - 2;
    minisToPlay = minisToPlay.slice(0, totalSlots); // por si hay más minis que espacio disponible
    const slots = shuffle(Array.from({ length: totalSlots }, (_, i) => i + 1));
    minisToPlay.forEach((kind, idx) => miniSchedule.push({ kind, at: slots[idx], done:false }));
  }

  const settings = { ...S.room.settings, cat, qids, count, miniSchedule };
  await sb.from("rooms").update({ settings, mini_state:null, status:"countdown", current_q:-1, phase_until: Date.now()+3800 }).eq("id", S.room.id);
  startHostLoop();
  hostSchedule(() => nextQuestion(0), 3800);
};

function hostSchedule(fn, ms){ S.hostTimers.push(setTimeout(fn, ms)); }

// ============================================================
// MOTOR ROBUSTO: en vez de un solo setTimeout frágil, cada fase
// guarda un "phase_until" (marca de tiempo) en la BD. Un watchdog
// que corre cada segundo en el ANFITRIÓN revisa si ya venció la
// fase y avanza. Si al host se le corta internet, al volver el
// watchdog retoma solo. Ningún jugador queda colgado.
// ============================================================

async function nextQuestion(i){
  const until = Date.now() + QUESTION_TIME*1000;
  await sb.from("rooms").update({
    status:"question", current_q:i,
    q_started_at:new Date().toISOString(),
    phase_until: until
  }).eq("id", S.room.id);
}

// Arranca el watchdog del anfitrión (idempotente: nunca duplica)
function startHostLoop(){
  if (S.hostLoop) return;
  S.hostLoop = setInterval(hostTick, 1000);
}
function stopHostLoop(){ clearInterval(S.hostLoop); S.hostLoop = null; }

let hostBusy = false;
async function hostTick(){
  if (!amHost() || hostBusy || !S.room) return;
  const st = S.room.status;
  if (!["question","reveal","board","mini"].includes(st)) return;

  // ¿Todos los conectados ya respondieron? → avanzar YA (bug 5)
  if (st === "question"){
    const aliveIds = S.players.filter(p => p.connected).map(p => p.id);
    if (aliveIds.length > 0){
      const { data: ans } = await sb.from("answers").select("player_id")
        .eq("room_id", S.room.id).eq("q_index", S.room.current_q);
      const answered = new Set((ans||[]).map(a => a.player_id));
      const allDone = aliveIds.every(id => answered.has(id));
      if (allDone){ hostBusy = true; try { await finishQuestion(S.room.current_q); } finally { hostBusy = false; } return; }
    }
  }

  // ¿Venció el tiempo de la fase? → avanzar
  const until = S.room.phase_until || 0;
  if (Date.now() >= until){
    hostBusy = true;
    try {
      if (st === "question") await finishQuestion(S.room.current_q);
      else if (st === "reveal") await sb.from("rooms").update({ status:"board", phase_until: Date.now()+BOARD_TIME*1000 }).eq("id", S.room.id);
      else if (st === "board"){
        const s = S.room.settings;
        const last = S.room.current_q >= s.qids.length - 1;
        // ¿Toca alguno de los mini-juegos programados tras esta pregunta?
        const pending = (s.miniSchedule || []).find(m => !m.done && m.at === S.room.current_q);
        if (pending){
          await startMiniGame(pending);
        } else if (last){ await saveGameHistory(); await sb.from("rooms").update({ status:"podium" }).eq("id", S.room.id); }
        else await nextQuestion(S.room.current_q + 1);
      }
      else if (st === "mini"){
        await hostMiniTick();
      }
    } finally { hostBusy = false; }
  }
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
      if (a.points > 0) { place++; continue; } // ya puntuada (evita doble conteo)
      const secs = Math.max(0, QUESTION_TIME - Math.floor((new Date(a.answered_at).getTime() - t0)/1000));
      const pts = (PLACE[Math.min(place,3)]) + secs;
      place++;
      await sb.from("answers").update({ points: pts, correct: true }).eq("id", a.id);
      const pl = S.players.find(p => p.id === a.player_id);
      if (pl) await sb.from("players").update({ score: pl.score + pts }).eq("id", pl.id);
    }
    await sb.from("rooms").update({ status:"reveal", phase_until: Date.now()+REVEAL_TIME*1000 }).eq("id", S.room.id);
  } finally { finishing = false; }
}

function onAnswerInsert(a){
  if (!S.room || S.room.status !== "question") return;
  // Solo nos importa QUIÉN respondió, no QUÉ respondió (no revelar nada).
  const alive = S.players.filter(p => p.connected).length;
  answersThisQ.add(a.player_id);
  $("#qWait").textContent = `${answersThisQ.size}/${alive} han respondido ✋`;
  // El avance real lo decide el watchdog del host (hostTick), no aquí.
  if (amHost() && answersThisQ.size >= alive) hostTick();
}

// ---------- Reacción al estado de la sala (todos) ----------
let lastStatus = "", lastQ = -2;
const answersThisQ = new Set();

async function handleRoomState(){
  const st = S.room.status;
  // El anfitrión mantiene el watchdog vivo durante toda la partida (bug 3,4,5)
  if (amHost() && ["countdown","question","reveal","board","mini"].includes(st)) startHostLoop();
  else if (st === "lobby" || st === "podium") stopHostLoop();

  if (st === "lobby"){ renderLobby(); if (lastStatus !== "lobby") show("lobby"); }
  else if (st === "countdown" && lastStatus !== "countdown") runCountdown();
  else if (st === "question" && (lastStatus !== "question" || lastQ !== S.room.current_q)) showQuestion();
  else if (st === "reveal" && lastStatus !== "reveal") showReveal();
  else if (st === "board" && lastStatus !== "board") showBoard();
  else if (st === "mini") handleMiniState();
  else if (st === "podium" && lastStatus !== "podium") showPodium();
  if (st === "lobby") renderCats();
  lastStatus = st; lastQ = S.room.current_q;
}

function runCountdown(){
  S._podiumFx = false;
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
  applyCategoryTheme(S.room.settings.cat);
  $("#qIdx").textContent = `${i+1}/${S.room.settings.qids.length}`;
  // Imagen grande (punto 9): si la pregunta trae 'img', se muestra; si falla, cae al emoji
  const imgEl = $("#qImg"), emoEl = $("#qEmoji");
  if (q.img){
    emoEl.classList.add("hidden");
    imgEl.classList.remove("hidden");
    imgEl.onerror = () => { imgEl.classList.add("hidden"); emoEl.classList.remove("hidden"); emoEl.textContent = q.e || bank.emoji; };
    imgEl.src = q.img;
  } else {
    imgEl.classList.add("hidden"); imgEl.removeAttribute("src");
    emoEl.classList.remove("hidden");
    emoEl.textContent = q.e || bank.emoji;
  }
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
  // NO enviamos si es correcta: el host lo calcula al cerrar la pregunta.
  // Así la respuesta correcta nunca viaja por Realtime antes del reveal (bug 1).
  await sb.from("answers").insert({
    room_id: S.room.id, q_index: S.room.current_q,
    player_id: S.me.id, answer: idx,
  });
}

async function showReveal(){
  clearInterval(S.qTimer);
  const i = S.room.current_q;
  const bank = await loadBank(S.room.settings.cat);
  const q = bank.questions[S.room.settings.qids[i]];
  // Mostramos la pantalla de inmediato; si el query falla, no se cuelga.
  show("reveal");
  $("#revealText").textContent = `Respuesta correcta: ${q.o[q.c]}`;
  let mine = null;
  try {
    const { data } = await sb.from("answers").select("*").eq("room_id", S.room.id)
      .eq("q_index", i).eq("player_id", S.me.id).maybeSingle();
    mine = data;
  } catch(e){ mine = null; }
  const ok = mine && mine.answer === q.c;
  $("#revealIcon").textContent = ok ? "🎉" : mine ? "😵" : "⏰";
  $("#revealYou").textContent = ok ? `¡Correcto! +${mine.points||0} puntos` : mine ? "Incorrecto esta vez 😬" : "No alcanzaste a responder";
  ok ? Sfx.correct() : Sfx.wrong();
}

function renderBoardIfVisible(){
  if (!S.room) return;
  if (S.room.status === "board") showBoard();
  else if (S.room.status === "podium") showPodium();
}

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

// ---------- Historial de partidas por sala (punto 13) ----------
async function saveGameHistory(){
  if (!amHost()) return;
  try {
    // Número de partida = cuántas van + 1
    const { data: prev } = await sb.from("game_history").select("game_number")
      .eq("room_id", S.room.id).order("game_number", { ascending:false }).limit(1);
    const gameNumber = (prev && prev[0] ? prev[0].game_number : 0) + 1;
    const results = [...S.players].sort((a,b)=>b.score-a.score)
      .map(p => ({ player_id:p.id, name:p.name, avatar:p.avatar, score:p.score }));
    await sb.from("game_history").insert({ room_id:S.room.id, game_number:gameNumber, results });
    // Sumar al acumulado de cada jugador
    for (const p of S.players){
      await sb.from("players").update({ total_score: (p.total_score||0) + p.score }).eq("id", p.id);
    }
  } catch(e){ /* si falla, el podio igual se muestra */ }
}

// ---------- PODIO + fuegos artificiales ----------
function showPodium(){
  const accum = S.room?.settings.scoreMode === "accum";
  // En acumulativo, total_score YA incluye la partida actual (se sumó en saveGameHistory).
  // Usamos total_score directo. Si un cliente aún no lo tiene actualizado, el syncLoop
  // hará resync y el podio se re-renderiza con el valor correcto.
  const scoreOf = p => accum ? (p.total_score||0) : p.score;
  const sorted = [...S.players].sort((a,b) => scoreOf(b) - scoreOf(a));
  const [p1,p2,p3] = sorted;
  const set = (n, p) => {
    $(`#pod${n}a`).textContent = p ? p.avatar : "";
    $(`#pod${n}a`).style.background = p ? avatarColor(p.avatar) : "";
    $(`#pod${n}n`).textContent = p ? `${p.name} · ${scoreOf(p)}` : "";
  };
  set(1,p1); set(2,p2); set(3,p3);
  const rest = $("#podiumRest"); rest.innerHTML = "";
  sorted.slice(3).forEach((p,i) => {
    const d = document.createElement("div");
    d.className = "brow" + (p.id === S.me?.id ? " me" : "");
    d.innerHTML = `<span class="pos">${i+4}º</span><span class="em" style="background:${avatarColor(p.avatar)}">${p.avatar}</span><span class="nm">${esc(p.name)}</span><span class="pts">${scoreOf(p)} pts</span>`;
    rest.appendChild(d);
  });
  show("podium");
  if (!S._podiumFx){
    S._podiumFx = true;
    Sfx.fanfare();
    fireworks(8000);
  }
  stopHostLoop();
  // Mostrar/ocultar el botón "otra ronda" según seas anfitrión
  const again = $("#btnPlayAgain");
  if (again) again.classList.toggle("hidden", !amHost() || S.solo);
}

// Volver al inicio (cerrar todo)
$("#btnAgain").onclick = async () => {
  Sfx.click();
  if (!S.solo && S.me) {
    await sb.from("players").update({ connected:false }).eq("id", S.me.id).catch?.(()=>{});
  }
  if (S.channel) sb?.removeChannel(S.channel);
  clearInterval(S.syncLoop);
  stopHostLoop();
  S.hostTimers.forEach(clearTimeout);
  localStorage.removeItem("gq_session");
  S.room = null; S.me = null; S.players = []; S.solo = false;
  lastStatus = ""; lastQ = -2;
  show("home");
};

document.addEventListener("DOMContentLoaded", () => {
  const b = $("#btnPlayAgain"); if (b) b.onclick = playAgain;
});
// Jugar otra ronda en la MISMA sala (solo anfitrión): resetea puntajes y vuelve al lobby (bug 6)
async function playAgain(){
  if (!amHost()) return;
  Sfx.click();
  // Reset de puntajes y limpieza de respuestas/votos de la ronda anterior
  await sb.from("players").update({ score: 0 }).eq("room_id", S.room.id);
  await sb.from("answers").delete().eq("room_id", S.room.id);
  await sb.from("votes").delete().eq("room_id", S.room.id);
  const settings = { ...S.room.settings, qids: [] };
  await sb.from("rooms").update({ status:"lobby", current_q:-1, phase_until:null, settings }).eq("id", S.room.id);
}

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

// ============================================================
// ENTREGA 3 — Compartir resultado, historial y propina
// ============================================================

// ---------- Compartir mi resultado (punto 15) ----------
function myPodiumInfo(){
  const accum = S.room?.settings.scoreMode === "accum";
  const scoreOf = p => accum ? ((p.total_score||0) + p.score) : p.score;
  const sorted = [...S.players].sort((a,b) => scoreOf(b) - scoreOf(a));
  const pos = sorted.findIndex(p => p.id === S.me?.id) + 1;
  const me = sorted.find(p => p.id === S.me?.id);
  return { pos, total: sorted.length, score: me ? scoreOf(me) : 0 };
}
document.addEventListener("DOMContentLoaded", () => {
  const bs = $("#btnShareResult");
  if (bs) bs.onclick = async () => {
    Sfx.click();
    const { pos, total, score } = myPodiumInfo();
    const medal = pos===1?"🥇":pos===2?"🥈":pos===3?"🥉":"🎮";
    const text = `${medal} ¡Quedé ${pos}º de ${total} en GAME QUIZ con ${score} puntos! ¿Me ganas? 👉 ${location.origin + location.pathname}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); toast("📋 Resultado copiado"); }
    } catch(e){ /* usuario canceló */ }
  };
});

// ---------- Historial de la sala (punto 13) ----------
document.addEventListener("DOMContentLoaded", () => {
  const bh = $("#btnHistory");
  if (bh) bh.onclick = showHistory;
});
async function showHistory(){
  Sfx.click();
  let games = [];
  try {
    const { data } = await sb.from("game_history").select("*")
      .eq("room_id", S.room.id).order("game_number");
    games = data || [];
  } catch(e){}
  if (!games.length){
    modal("<h3>📊 Historial de la sala</h3><p>Aún no hay partidas guardadas. Juega una ronda completa y aquí verás los resultados de cada partida.</p>", [{t:"Cerrar"}]);
    return;
  }
  let html = "<h3>📊 Historial de la sala</h3>";
  // Acumulado total por jugador
  const totals = {};
  games.forEach(g => g.results.forEach(r => { totals[r.name] = (totals[r.name]||0) + r.score; }));
  const rank = Object.entries(totals).sort((a,b)=>b[1]-a[1]);
  html += `<div class="hist-game"><h4>🏆 Acumulado total</h4>` +
    rank.map(([n,s],i)=>`<div class="hist-row"><span>${i+1}º ${esc(n)}</span><span>${s} pts</span></div>`).join("") + `</div>`;
  // Cada partida
  games.slice().reverse().forEach(g => {
    const rows = g.results.map(r =>
      `<div class="hist-row"><span><span class="r-em">${r.avatar}</span>${esc(r.name)}</span><span>${r.score} pts</span></div>`
    ).join("");
    html += `<div class="hist-game"><h4>Partida ${g.game_number}</h4>${rows}</div>`;
  });
  $("#modalBox").className = "lg";
  modal(html, [{t:"Cerrar", fn:()=>{ $("#modalBox").className=""; }}]);
}

// ---------- Propina (punto 16) ----------
// >>> CUANDO CREES TU CUENTA EN EMAILJS, PON AQUÍ TUS 3 DATOS Y CAMBIA
//     EMAILJS_READY A true. Mientras esté en false, el botón "Enviar"
//     abre la app de correo con el mensaje ya escrito (fallback). <<<
const EMAILJS_READY = false;
const EMAILJS_PUBLIC_KEY = "PON_TU_PUBLIC_KEY";
const EMAILJS_SERVICE_ID = "PON_TU_SERVICE_ID";
const EMAILJS_TEMPLATE_ID = "PON_TU_TEMPLATE_ID";
const TIP_EMAIL = "hielos9mm@gmail.com";
const TIP_DATA = "Nombre: R Soto\nRUT: 19.228.747-2\nMercado Pago\nCuenta Vista\nNúmero de cuenta: 1092855622";
if (EMAILJS_READY && window.emailjs){ try { emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY }); } catch(e){} }

document.addEventListener("DOMContentLoaded", () => {
  const t = $("#tipFab"); if (t) t.onclick = openTip;
});
function openTip(){
  Sfx.click();
  const html = `
    <h3>💛 Una propina, si quieres</h3>
    <p class="tip-msg">Hola 👋 GAME QUIZ es y seguirá siendo gratis. Lo hago con harto cariño en mis ratos libres, probando cada detalle para que jueguen tranquilos con la familia y los amigos. Si te ha hecho pasar un buen rato y quieres tirar una moneda al sombrero, me ayudas a seguir mejorándolo y me sacas una sonrisa. Sin presión: que lo disfrutes ya es suficiente. ¡Gracias por estar aquí! 🎪</p>
    <div class="tip-data" id="tipData">${TIP_DATA}</div>
    <p class="tip-msg">¿Una sugerencia, idea o saludo? Escríbeme:</p>
    <textarea class="tip-field" id="tipMsg" placeholder="Tu mensaje (opcional)…"></textarea>`;
  $("#modalBox").className = "lg";
  modal(html, [
    { t:"📋 Copiar datos", cls:"btn-yellow", fn: copyTipData, keep:true },
    { t:"✉️ Enviar mensaje", cls:"btn-green", fn: sendTipMsg, keep:true },
    { t:"Cerrar", cls:"btn-blue", fn:()=>{ $("#modalBox").className=""; } },
  ]);
}
function copyTipData(){
  navigator.clipboard.writeText(TIP_DATA).then(
    ()=>toast("📋 Datos copiados, ¡gracias!"),
    ()=>toast("No se pudo copiar, cópialos a mano")
  );
}
async function sendTipMsg(){
  const msg = ($("#tipMsg")?.value || "").trim();
  if (!msg){ toast("✏️ Escribe un mensaje primero"); return; }
  if (EMAILJS_READY && window.emailjs){
    try {
      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, { message: msg }, EMAILJS_PUBLIC_KEY);
      toast("✅ ¡Mensaje enviado, gracias!");
      $("#modal").classList.add("hidden"); $("#modalBox").className="";
    } catch(e){ toast("⚠️ No se pudo enviar, intenta más tarde"); }
  } else {
    // Fallback: abre la app de correo con el mensaje listo
    const subject = encodeURIComponent("Mensaje desde GAME QUIZ");
    const body = encodeURIComponent(msg);
    location.href = `mailto:${TIP_EMAIL}?subject=${subject}&body=${body}`;
    $("#modal").classList.add("hidden"); $("#modalBox").className="";
  }
}

// ============================================================
// ENTREGA 4 — MINI-JUEGOS
// Estado en rooms.mini_state = { kind, phase, until, round, data, ... }
// phase: "intro" (lectura+cuenta) → "play" → "result"
// ============================================================

const MINI_META = {
  flash:   { emoji:"🔢", title:"NúmeroFlash", desc:"Toca los números en orden lo más rápido que puedas. ¡30 segundos!" },
  color:   { emoji:"🎨", title:"Colorín",     desc:"Lee bien la instrucción… ¡y no te dejes engañar por los colores!" },
  memoria: { emoji:"🧠", title:"Memoria Relámpago", desc:"Memoriza el orden de los emojis… ¡y repítelo cuando desaparezcan!" },
  punteria:{ emoji:"🎯", title:"Puntería Extrema", desc:"Toca los objetivos antes de que se achiquen y escapen. ¡30 segundos!" },
  reaccion:{ emoji:"⚡", title:"Reacción Rápida", desc:"Espera el verde… ¡y toca lo más rápido que puedas! No te adelantes." },
  ritmo:   { emoji:"🎵", title:"Ritmo Copiado", desc:"Mira la secuencia de colores y repítela igual. ¡Se pone más larga!" },
  preg:    { emoji:"💡", title:"Preguntón",   desc:"Adivina rápido según la categoría. ¡El más veloz gana más!" },
  delator: { emoji:"🕵️", title:"Delator",     desc:"¿Quién es más probable que…? Vota (y cuídate)." },
};

// Mini-juegos cuyo puntaje se reparte por ORDEN DE LLEGADA (1°=100, 2°=90…)
// en vez de sumar el score crudo que guardó cada jugador.
const RANK_MINIS = { memoria:[100,90,80,70,60,50], preg:[100,90,80,70], reaccion:[100,90,80,70,60,50] };

// ---------- El anfitrión arma el mini-juego ----------
async function startMiniGame(entry){
  if (!amHost()) return;
  const kind = entry.kind;
  // Marcar este mini-juego (y solo este) como usado para que no se repita
  const miniSchedule = (S.room.settings.miniSchedule || []).map(m =>
    (m.kind === entry.kind && m.at === entry.at) ? { ...m, done:true } : m
  );
  const settings = { ...S.room.settings, miniSchedule };
  let mini = { kind, phase:"intro", round:0 };

  if (kind === "flash") mini.data = buildFlash();
  if (kind === "color") mini.data = buildColor();
  if (kind === "memoria") mini.data = buildMemoria();
  if (kind === "punteria") mini.data = buildPunteria();
  if (kind === "reaccion") mini.data = buildReaccion();
  if (kind === "ritmo") mini.data = buildRitmo();
  if (kind === "preg") mini.data = await buildPreg();
  if (kind === "delator"){
    mini.data = buildDelator();
    mini.phase = "names";        // fase extra: pedir nombre real
    mini.dround = 0;             // ronda de delator actual
  }

  const introMs = (kind === "delator") ? 20000 : 5000; // delator: 20s para escribir nombre real
  mini.until = Date.now() + introMs;
  await sb.from("mini_scores").delete().eq("room_id", S.room.id).eq("kind", kind);
  await sb.from("rooms").update({ settings, mini_state: mini, status:"mini", phase_until: Date.now()+introMs }).eq("id", S.room.id);
}

// Construye el patrón de NúmeroFlash (mismo para todos)
function buildFlash(){
  const variants = ["1-30","A-S","Z-J","2en2","5en5","30-1"];
  const v = variants[Math.floor(Math.random()*variants.length)];
  let seq = [];
  if (v === "1-30") seq = Array.from({length:30}, (_,i)=>String(i+1));
  else if (v === "A-S") seq = "ABCDEFGHIJKLMNÑOPQRS".split("").slice(0,19);
  else if (v === "Z-J") seq = "ZYXWVUTSRQPONMLKJ".split("");
  else if (v === "2en2") seq = Array.from({length:30}, (_,i)=>String((i+1)*2));
  else if (v === "5en5") seq = Array.from({length:24}, (_,i)=>String((i+1)*5));
  else if (v === "30-1") seq = Array.from({length:30}, (_,i)=>String(30-i));
  // Posiciones barajadas (mismo orden para todos)
  const positions = shuffle([...seq.keys()]);
  const cells = seq.map((val,i)=>({ val, pos: positions[i] }));
  cells.sort((a,b)=>a.pos-b.pos); // orden visual
  return { variant:v, seq, cells: cells.map(c=>c.val), n: seq.length };
}

// Construye Memoria Relámpago: una secuencia de emojis a memorizar (misma para todos)
function buildMemoria(){
  const POOL = ["🍎","🚗","🐶","⚽","🌟","🎈","🍕","🐱","🎸","🌈","🔑","🦋","🍦","🎁","🚀","🌻","🐢","⚡","🎩","🍄"];
  const len = 6 + Math.floor(Math.random()*3); // 6, 7 u 8
  const seq = shuffle([...POOL]).slice(0, len);
  return { seq, n: len };
}

// Construye Puntería Extrema: objetivos que aparecerán en posiciones/tiempos.
// El patrón NO necesita ser idéntico entre jugadores (cada quien toca lo que puede),
// pero fijamos una semilla de tamaños para que sea parejo.
function buildPunteria(){
  return { total: 40, minSize: 42, maxSize: 96, life: 900 }; // objetivos van saliendo por JS local
}

// Reacción Rápida: 3 rondas, cada una con un tiempo de espera distinto antes del "¡YA!"
function buildReaccion(){
  const rounds = [];
  for (let r=0; r<3; r++){
    rounds.push({ waitMs: 1500 + Math.floor(Math.random()*3500) }); // entre 1.5s y 5s
  }
  return { rounds, n: 3 };
}

// Ritmo Copiado (Simón dice): una secuencia larga; cada ronda revela un paso más.
function buildRitmo(){
  const seq = Array.from({length:12}, () => Math.floor(Math.random()*4)); // colores 0..3
  return { seq, n: seq.length };
}

// Delator: 5 preguntas "¿Quién es más probable que…?" (elegidas al azar del banco)
const DELATOR_BANK = [
  "se quede dormido en un viaje largo",
  "llegue tarde a todos lados",
  "se ría en el momento menos apropiado",
  "revise el celular a cada rato",
  "se coma la última papa sin preguntar",
  "cante en la ducha a todo volumen",
  "se pierda usando el GPS",
  "gaste toda su plata en comida",
  "hable con desconocidos en la calle",
  "olvide dónde dejó las llaves",
  "arme una fiesta de improviso",
  "diga una talla mala y nadie se ría",
  "se ponga a bailar sin música",
  "mande un audio de 5 minutos",
  "se coma algo del suelo (regla de los 3 segundos)",
  "se quede pegado viendo videos hasta tarde",
  "llore con una película animada",
  "se meta a nadar con ropa",
  "conteste 'ya voy' y no vaya",
  "haga la tarea a última hora",
];
function buildDelator(){
  const qs = shuffle([...DELATOR_BANK]).slice(0, 5);
  return { questions: qs, n: 5, startPts: 500, penalty: 15 };
}

// Preguntón: elige una palabra, revela algunas letras como pista y arma un
// teclado con las letras que faltan + señuelos. Todos reciben la MISMA palabra.
async function buildPreg(){
  const bank = await loadBank("palabras");
  const item = bank.words[Math.floor(Math.random()*bank.words.length)];
  const word = item.w.toUpperCase();
  const letters = word.split("");
  // Revelar ~30% de las posiciones (mínimo 1, nunca todas)
  const nReveal = Math.max(1, Math.floor(letters.length * 0.3));
  const revealIdx = shuffle([...letters.keys()]).slice(0, nReveal);
  const shown = letters.map((ch,i) => revealIdx.includes(i) ? ch : null);
  // Letras que el jugador debe colocar (las ocultas), en orden de aparición
  const missing = letters.filter((_,i) => !revealIdx.includes(i));
  // Teclado: letras faltantes (únicas) + señuelos hasta ~10 teclas
  const uniqueMissing = [...new Set(missing)];
  const ALFA = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ".split("");
  const pool = ALFA.filter(l => !uniqueMissing.includes(l));
  const decoys = shuffle(pool).slice(0, Math.max(0, 10 - uniqueMissing.length));
  const keys = shuffle([...uniqueMissing, ...decoys]);
  return { word, cat:item.c, hint:item.h, shown, keys, n: letters.length };
}

// ---------- Watchdog del mini-juego (host) ----------
async function hostMiniTick(){
  const m = S.room.mini_state; if (!m) return;
  if (Date.now() < (m.until||0)) return;

  // ----- Flujo especial de DELATOR -----
  if (m.kind === "delator"){
    if (m.phase === "names"){
      // Pasar a la primera ronda de votación
      const nm = { ...m, phase:"play", dround:0, until: Date.now()+60000 };
      await sb.from("rooms").update({ mini_state:nm, phase_until: Date.now()+60000 }).eq("id", S.room.id);
    } else if (m.phase === "play"){
      // Cerrar la ronda actual: contar votos y penalizar, mostrar resultado de ronda
      await delatorCloseRound(m);
    } else if (m.phase === "dround-result"){
      // Avanzar a la siguiente ronda o terminar
      if (m.dround + 1 >= m.data.n){
        await finishDelator(m);
      } else {
        const nm = { ...m, phase:"play", dround: m.dround+1, until: Date.now()+60000 };
        await sb.from("rooms").update({ mini_state:nm, phase_until: Date.now()+60000 }).eq("id", S.room.id);
      }
    } else if (m.phase === "result"){
      const last = S.room.current_q >= S.room.settings.qids.length - 1;
      if (last){ await saveGameHistory(); await sb.from("rooms").update({ status:"podium" }).eq("id", S.room.id); }
      else await nextQuestion(S.room.current_q + 1);
    }
    return;
  }

  // ----- Flujo normal del resto de mini-juegos -----
  if (m.phase === "intro"){
    const playMs = miniPlayMs(m.kind);
    const nm = { ...m, phase:"play", until: Date.now()+playMs };
    await sb.from("rooms").update({ mini_state:nm, phase_until: Date.now()+playMs }).eq("id", S.room.id);
  } else if (m.phase === "play"){
    await finishMini();
  } else if (m.phase === "result"){
    // Volver al quiz: siguiente pregunta o podio
    const last = S.room.current_q >= S.room.settings.qids.length - 1;
    if (last){ await saveGameHistory(); await sb.from("rooms").update({ status:"podium" }).eq("id", S.room.id); }
    else await nextQuestion(S.room.current_q + 1);
  }
}
function miniPlayMs(kind){
  if (kind === "flash") return 30000;
  if (kind === "color") return 22000;
  if (kind === "memoria") return 12000;   // tiempo para repetir la secuencia
  if (kind === "punteria") return 30000;
  if (kind === "reaccion") return 16000;   // varias rondas de espera+toque
  if (kind === "ritmo") return 30000;      // secuencia que crece
  if (kind === "preg") return 25000;       // completar la palabra con pistas
  return 15000;
}

// El host cierra el mini-juego, suma puntos al score del quiz
async function finishMini(){
  if (!amHost()) return;
  const m = S.room.mini_state;
  const { data: scores } = await sb.from("mini_scores").select("*")
    .eq("room_id", S.room.id).eq("kind", m.kind);

  const byPlayer = {};
  const table = RANK_MINIS[m.kind];
  if (table){
    // Reparto por ORDEN DE LLEGADA. Solo puntúan quienes acertaron (payload.ok).
    // Se ordena por tiempo de acierto (payload.t, menor = más rápido).
    const finishers = (scores||[])
      .filter(s => s.payload && s.payload.ok)
      .sort((a,b) => (a.payload.t||0) - (b.payload.t||0));
    finishers.forEach((s, idx) => {
      byPlayer[s.player_id] = (byPlayer[s.player_id]||0) + (table[Math.min(idx, table.length-1)]);
    });
    // Quienes no acertaron quedan en 0 (no se agregan)
  } else {
    // Puntaje directo: se suma el score crudo que guardó cada jugador
    (scores||[]).forEach(s => { byPlayer[s.player_id] = (byPlayer[s.player_id]||0) + s.score; });
  }

  for (const [pid, pts] of Object.entries(byPlayer)){
    const pl = S.players.find(p => p.id === pid);
    if (pl) await sb.from("players").update({ score: pl.score + pts }).eq("id", pid);
  }
  const nm = { ...m, phase:"result", until: Date.now()+6000, results: byPlayer };
  await sb.from("rooms").update({ mini_state:nm, phase_until: Date.now()+6000 }).eq("id", S.room.id);
}

// ---------- DELATOR (host) ----------
// Cierra la ronda actual: cuenta los votos recibidos y muestra el resultado de la ronda.
async function delatorCloseRound(m){
  if (!amHost()) return;
  const { data: votes } = await sb.from("mini_scores").select("*")
    .eq("room_id", S.room.id).eq("kind", "delator").eq("round", m.dround);
  // Contar votos recibidos por jugador en esta ronda
  const received = {};
  (votes||[]).forEach(v => {
    const target = v.payload && v.payload.votedFor;
    if (target) received[target] = (received[target]||0) + 1;
  });
  const nm = { ...m, phase:"dround-result", until: Date.now()+7000, roundVotes: received };
  await sb.from("rooms").update({ mini_state:nm, phase_until: Date.now()+7000 }).eq("id", S.room.id);
}

// Al terminar las 5 rondas: cada jugador parte con 500 y pierde 15 por cada voto recibido (total).
async function finishDelator(m){
  if (!amHost()) return;
  const { data: votes } = await sb.from("mini_scores").select("*")
    .eq("room_id", S.room.id).eq("kind", "delator");
  const totalReceived = {};
  (votes||[]).forEach(v => {
    const target = v.payload && v.payload.votedFor;
    if (target) totalReceived[target] = (totalReceived[target]||0) + 1;
  });
  const byPlayer = {};
  const startPts = m.data.startPts, penalty = m.data.penalty;
  for (const p of S.players){
    const votesGot = totalReceived[p.id] || 0;
    const final = Math.max(0, startPts - votesGot * penalty); // no baja de 0
    byPlayer[p.id] = final;
    await sb.from("players").update({ score: p.score + final }).eq("id", p.id);
  }
  const nm = { ...m, phase:"result", until: Date.now()+7000, results: byPlayer, totalReceived };
  await sb.from("rooms").update({ mini_state:nm, phase_until: Date.now()+7000 }).eq("id", S.room.id);
}

let miniLastRound = -1;
function handleMiniState(){
  const m = S.room.mini_state; if (!m) return;
  const changed = (m.phase !== miniLastPhase) || (m.kind !== miniLastKind) || ((m.dround??-1) !== miniLastRound);
  miniLastPhase = m.phase; miniLastKind = m.kind; miniLastRound = (m.dround??-1);

  // ----- Delator tiene sus propias fases -----
  if (m.kind === "delator"){
    if (m.phase === "names"){ if (changed) delatorShowNames(m); delatorUpdateNamesTimer(m); }
    else if (m.phase === "play"){ if (changed) delatorShowVote(m); delatorUpdateVoteTimer(m); }
    else if (m.phase === "dround-result"){ if (changed) delatorShowRoundResult(m); }
    else if (m.phase === "result"){ if (changed) showMiniResult(m); }
    return;
  }

  // ----- Resto de mini-juegos -----
  if (m.phase === "intro"){ if (changed) showMiniIntro(m); }
  else if (m.phase === "play"){ if (changed) startMiniPlay(m); updateMiniTimer(m); }
  else if (m.phase === "result"){ if (changed) showMiniResult(m); }
}

function showMiniIntro(m){
  const meta = MINI_META[m.kind];
  $("#miniIntroEmoji").textContent = meta.emoji;
  $("#miniIntroTitle").textContent = meta.title;
  $("#miniIntroDesc").textContent = meta.desc;
  show("mini-intro");
  Sfx.go();
  // Cuenta regresiva visual en los últimos 3s de la intro
  clearInterval(S.miniIntroIv);
  S.miniIntroIv = setInterval(() => {
    const left = Math.ceil(((m.until||0) - Date.now())/1000);
    $("#miniIntroCd").textContent = left <= 3 && left > 0 ? left : "";
    if (left <= 0) clearInterval(S.miniIntroIv);
  }, 200);
}

function startMiniPlay(m){
  clearInterval(S.miniIntroIv);
  // Limpieza defensiva: apaga cualquier timer de un mini-juego anterior
  clearInterval(S.puntSpawnIv); clearTimeout(S.reacGoT); clearTimeout(S.memoHideT);
  flashSubmitted = false; colorSubmitted = false; memoriaSubmitted = false; punteriaSubmitted = false;
  reaccionSubmitted = false; ritmoSubmitted = false; pregSubmitted = false;
  if (m.kind === "flash") flashStart(m);
  if (m.kind === "color") colorStart(m);
  if (m.kind === "memoria") memoriaStart(m);
  if (m.kind === "punteria") punteriaStart(m);
  if (m.kind === "reaccion") reaccionStart(m);
  if (m.kind === "ritmo") ritmoStart(m);
  if (m.kind === "preg") pregStart(m);
  // Loop local para el cronómetro del mini-juego (no depende de eventos de red)
  clearInterval(S.miniPlayIv);
  S.miniPlayIv = setInterval(() => {
    const mm = S.room?.mini_state;
    if (!mm || mm.phase !== "play"){ clearInterval(S.miniPlayIv); return; }
    updateMiniTimer(mm);
  }, 250);
}
function updateMiniTimer(m){
  if (m.kind === "flash"){
    const left = Math.max(0, Math.ceil(((m.until||0)-Date.now())/1000));
    const el = $("#flashTimer"); if (el) el.textContent = left;
    if (left <= 0) flashOnTimeUp(m);
  } else if (m.kind === "color"){
    const left = Math.max(0, Math.ceil(((m.until||0)-Date.now())/1000));
    const el = $("#colorTimer"); if (el) el.textContent = left;
    if (left <= 0) colorOnTimeUp(m);
  } else if (m.kind === "memoria"){
    const left = Math.max(0, Math.ceil(((m.until||0)-Date.now())/1000));
    const el = $("#memoTimer"); if (el) el.textContent = left;
    if (left <= 0) memoriaOnTimeUp(m);
  } else if (m.kind === "punteria"){
    const left = Math.max(0, Math.ceil(((m.until||0)-Date.now())/1000));
    const el = $("#puntTimer"); if (el) el.textContent = left;
    if (left <= 0) punteriaOnTimeUp(m);
  } else if (m.kind === "reaccion"){
    const left = Math.max(0, Math.ceil(((m.until||0)-Date.now())/1000));
    const el = $("#reacTimer"); if (el) el.textContent = left;
    if (left <= 0) reaccionOnTimeUp(m);
  } else if (m.kind === "ritmo"){
    const left = Math.max(0, Math.ceil(((m.until||0)-Date.now())/1000));
    const el = $("#ritmoTimer"); if (el) el.textContent = left;
    if (left <= 0) ritmoOnTimeUp(m);
  } else if (m.kind === "preg"){
    const left = Math.max(0, Math.ceil(((m.until||0)-Date.now())/1000));
    const el = $("#pregTimer"); if (el) el.textContent = left;
    if (left <= 0) pregOnTimeUp(m);
  }
}
function showMiniResult(m){
  // Reutiliza la pantalla de marcador para mostrar resultados del mini
  const meta = MINI_META[m.kind];
  const results = m.results || {};
  const isDelator = m.kind === "delator";
  const rows = S.players.map(p => ({ p, pts: results[p.id]||0 })).sort((a,b)=>b.pts-a.pts);
  const list = $("#boardList"); list.innerHTML = "";
  const title = $("#scr-board .scr-title");
  if (title) title.textContent = isDelator ? "🕵️ Delator — puntaje final" : `${meta.emoji} ${meta.title} — resultados`;
  rows.forEach((r,i) => {
    const d = document.createElement("div");
    d.className = "brow" + (r.p.id === S.me?.id ? " me" : "");
    const nm = isDelator ? (r.p.real_name || r.p.name) : r.p.name;
    const ptsLabel = isDelator ? `${r.pts} pts` : `+${r.pts}`;
    d.innerHTML = `<span class="pos">${i===0?"🥇":i+1+"º"}</span><span class="em" style="background:${avatarColor(r.p.avatar)}">${r.p.avatar}</span>
      <span class="nm">${esc(nm)}</span><span class="pts">${ptsLabel}</span>`;
    list.appendChild(d);
  });
  show("board");
  Sfx.board();
}

// ---------- NÚMEROFLASH ----------
function flashStart(m){
  const d = m.data;
  S.flashNext = 0; // índice del próximo valor a tocar (en m.data.seq)
  S.flashScore = 0;
  S.flashDone = false;
  const instr = {
    "1-30":"Toca del 1 al 30 en orden","A-S":"Toca de la A a la S en orden",
    "Z-J":"Toca de la Z a la J (al revés)","2en2":"De 2 en 2: 2, 4, 6…",
    "5en5":"De 5 en 5: 5, 10, 15…","30-1":"Del 30 al 1 (al revés)"
  }[d.variant] || "Toca en orden";
  $("#flashInstr").textContent = instr;
  $("#flashScore").textContent = "";
  // Grilla cuadrada
  const cols = Math.ceil(Math.sqrt(d.n));
  const grid = $("#flashGrid");
  grid.style.gridTemplateColumns = `repeat(${cols},1fr)`;
  grid.innerHTML = "";
  d.cells.forEach((val) => {
    const b = document.createElement("button");
    b.className = "flash-cell";
    b.textContent = val;
    b.dataset.val = val;
    b.onclick = () => flashTap(b, val, m);
    grid.appendChild(b);
  });
  updateFlashTarget(m);
  show("mini-flash");
}
function updateFlashTarget(m){
  const seq = m.data.seq;
  const t = $("#flashTarget");
  if (S.flashNext < seq.length) t.textContent = "Busca: " + seq[S.flashNext];
  else t.textContent = "¡Completo! 🎉";
}
async function flashTap(btn, val, m){
  if (S.flashDone) return;
  const seq = m.data.seq;
  const expected = seq[S.flashNext];
  if (val === expected){
    Sfx.pick();
    btn.classList.add("done");
    S.flashNext++;
    S.flashScore += 6;
    updateFlashTarget(m);
    $("#flashScore").textContent = `Tu puntaje: ${S.flashScore}`;
    if (S.flashNext >= seq.length){
      // Completó la secuencia entera → +60 extra
      S.flashScore += 60;
      S.flashDone = true;
      $("#flashScore").textContent = `¡Secuencia completa! ${S.flashScore} pts 🎉`;
      Sfx.correct();
      await flashSubmit(m);
    }
  } else {
    Sfx.wrong();
    btn.classList.add("wrong");
    setTimeout(()=>btn.classList.remove("wrong"), 400);
  }
}
let flashSubmitted = false;
async function flashSubmit(m){
  if (flashSubmitted) return; flashSubmitted = true;
  try {
    await sb.from("mini_scores").insert({
      room_id:S.room.id, player_id:S.me.id, kind:"flash", round:0, score:S.flashScore
    });
  } catch(e){}
}
// Si se acaba el tiempo sin completar, enviar el puntaje parcial
function flashOnTimeUp(m){
  if (!S.flashDone && !flashSubmitted) flashSubmit(m);
}

// ---------- COLORÍN (Stroop) ----------
const COLORS = [
  { name:"ROJO",    hex:"#FF5E5B" },
  { name:"AZUL",    hex:"#38B6FF" },
  { name:"VERDE",   hex:"#3ECF6E" },
  { name:"AMARILLO",hex:"#FFC145" },
  { name:"MORADO",  hex:"#8C52FF" },
  { name:"NARANJO", hex:"#FF8A3D" },
];
const pick = arr => arr[Math.floor(Math.random()*arr.length)];

// Genera 12 rondas (sobran; se juega hasta que se acabe el tiempo). Mismas para todos.
function buildColor(){
  const rounds = [];
  for (let r=0; r<12; r++){
    // 4 variantes de reto:
    // 0: "¿De qué COLOR está pintada la palabra?"  (ignora el texto)
    // 1: "¿Qué PALABRA dice?"                       (ignora el color)
    // 2: "Toca el color VERDE" con opciones de texto pintado (Stroop puro)
    // 3: "¿Cuántas palabras hay del color X?" — variante de conteo simple
    const type = pick([0,0,1,2,2,3]); // más peso al Stroop
    const word = pick(COLORS);
    let inkColor = pick(COLORS);
    // que a veces coincidan y a veces no
    if (Math.random() < 0.5) inkColor = pick(COLORS.filter(c=>c.name!==word.name));

    let instr, stimText, stimColor, correct, options;
    if (type === 0){ // color de la tinta
      instr = "¿De qué COLOR está pintada la palabra?";
      stimText = word.name; stimColor = inkColor.hex;
      correct = inkColor.name;
      options = optionSet(inkColor.name);
    } else if (type === 1){ // qué dice
      instr = "¿Qué PALABRA dice?";
      stimText = word.name; stimColor = inkColor.hex;
      correct = word.name;
      options = optionSet(word.name);
    } else if (type === 2){ // toca el color X (nombre) pero botones pintados distinto
      const target = pick(COLORS);
      instr = `Toca el botón que DICE "${target.name}"`;
      stimText = "🎨"; stimColor = "#fff";
      correct = target.name;
      options = optionSet(target.name).map(name => ({ name, hex: pick(COLORS).hex }));
      rounds.push({ type, instr, stimText, stimColor, correct, options, painted:true });
      continue;
    } else { // conteo: "¿cuántas veces aparece VERDE?" simplificado a color dominante
      const target = pick(COLORS);
      const count = 1 + Math.floor(Math.random()*4);
      instr = `¿Cuántas veces aparece el color ${target.name} abajo?`;
      const dots = [];
      for (let i=0;i<count;i++) dots.push(target.hex);
      const others = 5 - count;
      for (let i=0;i<others;i++) dots.push(pick(COLORS.filter(c=>c.name!==target.name)).hex);
      stimText = shuffle(dots).map(()=>"⬤").join(" ");
      // guardamos los colores para pintar cada punto
      rounds.push({ type, instr, dots: shuffle(dots), correct:String(count),
        options:[String(count), String(Math.max(0,count-1)), String(count+1), String(count+2)].filter((v,i,a)=>a.indexOf(v)===i).slice(0,4) });
      continue;
    }
    rounds.push({ type, instr, stimText, stimColor, correct, options });
  }
  return { rounds, n: rounds.length };
}
// 4 opciones de nombres de color incluyendo el correcto
function optionSet(correctName){
  const others = shuffle(COLORS.filter(c=>c.name!==correctName)).slice(0,3).map(c=>c.name);
  return shuffle([correctName, ...others]);
}

function colorStart(m){
  S.colorRound = 0;
  S.colorScore = 0;
  S.colorAnswered = false;
  renderColorRound(m);
  show("mini-color");
}
function renderColorRound(m){
  const rounds = m.data.rounds;
  if (S.colorRound >= rounds.length){ $("#colorInstr").textContent = "¡Muy bien! Espera…"; return; }
  const r = rounds[S.colorRound];
  S.colorAnswered = false;
  $("#colorRound").textContent = `Ronda ${S.colorRound+1}`;
  $("#colorInstr").textContent = r.instr;
  $("#colorScore").textContent = S.colorScore ? `Puntaje: ${S.colorScore}` : "";
  const stim = $("#colorStim");
  if (r.type === 3){ // puntos de colores
    stim.innerHTML = r.dots.map(h=>`<span style="color:${h}">⬤</span>`).join(" ");
    stim.style.color = "";
  } else {
    stim.textContent = r.stimText;
    stim.style.color = r.stimColor || "#fff";
  }
  const opts = $("#colorOpts"); opts.innerHTML = "";
  r.options.forEach(opt => {
    const isObj = typeof opt === "object";
    const label = isObj ? opt.name : opt;
    const b = document.createElement("button");
    b.className = "color-opt";
    b.textContent = label;
    // color del botón: pintado (variante 2), color propio (variantes de color) o neutro
    if (r.painted && isObj) b.style.background = opt.hex;
    else if (r.type === 3) b.style.background = "var(--purple)";
    else {
      const cobj = COLORS.find(c=>c.name===label);
      b.style.background = cobj ? cobj.hex : "var(--purple)";
      if (label === "AMARILLO") b.style.color = "var(--ink)";
    }
    b.onclick = () => colorPick(b, label, r, m);
    opts.appendChild(b);
  });
}
async function colorPick(btn, label, r, m){
  if (S.colorAnswered) return;
  S.colorAnswered = true;
  const ok = label === r.correct;
  if (ok){ Sfx.pick(); btn.classList.add("good"); S.colorScore += 12; }
  else { Sfx.wrong(); btn.classList.add("bad"); }
  $$("#colorOpts .color-opt").forEach(b => { if (b!==btn) b.classList.add("dim"); });
  $("#colorScore").textContent = `Puntaje: ${S.colorScore}`;
  // Siguiente ronda tras un respiro
  setTimeout(() => { S.colorRound++; renderColorRound(m); }, 650);
}
let colorSubmitted = false;
async function colorSubmit(m){
  if (colorSubmitted) return; colorSubmitted = true;
  try {
    await sb.from("mini_scores").insert({
      room_id:S.room.id, player_id:S.me.id, kind:"color", round:0, score:S.colorScore
    });
  } catch(e){}
}
function colorOnTimeUp(m){ if (!colorSubmitted) colorSubmit(m); }

// ---------- MEMORIA RELÁMPAGO ----------
// Fases internas: "show" (ver la secuencia 3s) → "input" (repetir tocando)
let memoriaSubmitted = false;
function memoriaStart(m){
  S.memoInput = [];       // orden en que el jugador toca
  S.memoDone = false;
  S.memoT0 = 0;
  const seq = m.data.seq;
  // Mostrar la secuencia grande, en orden, por 3 segundos
  $("#memoRound").textContent = "¡Memoriza!";
  $("#memoScore").textContent = "";
  const board = $("#memoBoard"); board.innerHTML = "";
  seq.forEach((emo, i) => {
    const d = document.createElement("div");
    d.className = "memo-show-cell";
    d.textContent = emo;
    d.style.animationDelay = (i*0.12) + "s";
    // numerito de orden para reforzar la memoria
    const badge = document.createElement("span");
    badge.className = "memo-num"; badge.textContent = i+1;
    d.appendChild(badge);
    board.appendChild(d);
  });
  $("#memoInstr").textContent = "Fíjate en el ORDEN…";
  show("mini-memoria");
  // Tras 3s, ocultar y pasar a input
  clearTimeout(S.memoHideT);
  S.memoHideT = setTimeout(() => memoriaInputPhase(m), 3000);
}
function memoriaInputPhase(m){
  const seq = m.data.seq;
  S.memoT0 = Date.now();
  $("#memoRound").textContent = "¡Ahora tú!";
  $("#memoInstr").textContent = "Tócalos en el MISMO orden";
  const board = $("#memoBoard"); board.innerHTML = "";
  // Botones barajados (para que tenga que recordar posición y orden)
  shuffle([...seq]).forEach(emo => {
    const b = document.createElement("button");
    b.className = "memo-cell";
    b.textContent = emo;
    b.onclick = () => memoriaTap(b, emo, m);
    board.appendChild(b);
  });
}
async function memoriaTap(btn, emo, m){
  if (S.memoDone) return;
  const seq = m.data.seq;
  const idx = S.memoInput.length;
  if (emo === seq[idx]){
    Sfx.pick();
    btn.classList.add("ok");
    btn.textContent = (idx+1) + "";
    btn.style.pointerEvents = "none";
    S.memoInput.push(emo);
    if (S.memoInput.length === seq.length){
      // ¡Completó la secuencia entera!
      S.memoDone = true;
      const t = Date.now() - S.memoT0;
      $("#memoScore").textContent = "¡Perfecto! 🎉 Espera el resultado…";
      Sfx.correct();
      await memoriaSubmit(m, true, t);
    }
  } else {
    // Falló: se marca error y queda fuera (no acertó la secuencia completa)
    Sfx.wrong();
    btn.classList.add("err");
    S.memoDone = true;
    $("#memoScore").textContent = "¡Uy! Fallaste el orden 😬";
    $$("#memoBoard .memo-cell").forEach(b => b.style.pointerEvents = "none");
    await memoriaSubmit(m, false, 0);
  }
}
async function memoriaSubmit(m, ok, t){
  if (memoriaSubmitted) return; memoriaSubmitted = true;
  try {
    await sb.from("mini_scores").insert({
      room_id:S.room.id, player_id:S.me.id, kind:"memoria", round:m.round||0,
      score:0, payload:{ ok, t: t||999999 }
    });
  } catch(e){}
}
function memoriaOnTimeUp(m){
  clearTimeout(S.memoHideT);
  if (!memoriaSubmitted) memoriaSubmit(m, false, 0);
}

// ---------- PUNTERÍA EXTREMA ----------
let punteriaSubmitted = false;
function punteriaStart(m){
  S.puntHits = 0;
  S.puntDone = false;
  $("#puntScore").textContent = "Aciertos: 0";
  const arena = $("#puntArena"); arena.innerHTML = "";
  // Lanzar objetivos en bucle mientras dure la fase play
  clearInterval(S.puntSpawnIv);
  const spawn = () => {
    const mm = S.room?.mini_state;
    if (!mm || mm.phase !== "play"){ clearInterval(S.puntSpawnIv); return; }
    spawnTarget(arena, m);
  };
  // Ritmo rápido: un objetivo nuevo cada ~450ms, varios a la vez → difícil
  S.puntSpawnIv = setInterval(spawn, 450);
  spawn();
  show("mini-punteria");
}
function spawnTarget(arena, m){
  const d = m.data;
  const size = d.minSize + Math.random()*(d.maxSize - d.minSize);
  const rect = arena.getBoundingClientRect();
  const x = Math.random() * Math.max(10, rect.width - size);
  const y = Math.random() * Math.max(10, rect.height - size);
  const t = document.createElement("button");
  t.className = "punt-target";
  t.style.width = t.style.height = size + "px";
  t.style.left = x + "px";
  t.style.top = y + "px";
  const hue = Math.floor(Math.random()*360);
  t.style.background = `radial-gradient(circle at 35% 35%, hsl(${hue},90%,70%), hsl(${hue},85%,45%))`;
  t.textContent = "🎯";
  // Se achica y desaparece rápido (difícil)
  t.style.animation = `puntShrink ${d.life}ms linear forwards`;
  let hit = false;
  t.onclick = () => {
    if (hit || S.puntDone) return;
    hit = true;
    Sfx.pick();
    S.puntHits++;
    $("#puntScore").textContent = "Aciertos: " + S.puntHits;
    t.classList.add("popped");
    setTimeout(() => t.remove(), 120);
  };
  // Auto-remover al terminar su vida
  setTimeout(() => { if (!hit) t.remove(); }, d.life);
  arena.appendChild(t);
}
async function punteriaSubmit(m){
  if (punteriaSubmitted) return; punteriaSubmitted = true;
  clearInterval(S.puntSpawnIv);
  const pts = S.puntHits * 10; // +10 por acierto, sin tope
  try {
    await sb.from("mini_scores").insert({
      room_id:S.room.id, player_id:S.me.id, kind:"punteria", round:0, score:pts
    });
  } catch(e){}
}
function punteriaOnTimeUp(m){
  S.puntDone = true;
  if (!punteriaSubmitted) punteriaSubmit(m);
}

// ---------- REACCIÓN RÁPIDA ----------
// 3 rondas. Cada ronda: "Espera…" → (tiempo random) → "¡YA!". Se mide la
// reacción total sumada. Tocar antes del "¡YA!" penaliza esa ronda.
let reaccionSubmitted = false;
function reaccionStart(m){
  S.reacRound = 0;
  S.reacTotal = 0;      // suma de tiempos de reacción (ms); menor = mejor
  S.reacFouls = 0;      // veces que se adelantó
  S.reacDone = false;
  const pad = $("#reacPad");
  pad.onclick = () => reaccionTapPad(m);
  show("mini-reaccion");
  reaccionNextRound(m);
}
function reaccionNextRound(m){
  if (S.reacRound >= m.data.rounds.length){ reaccionFinishLocal(m); return; }
  const r = m.data.rounds[S.reacRound];
  const pad = $("#reacPad");
  pad.className = "reac-pad waiting";
  $("#reacBig").textContent = "Espera…";
  $("#reacSub").textContent = `Ronda ${S.reacRound+1} de ${m.data.rounds.length}`;
  S.reacReady = false;
  S.reacShownAt = 0;
  clearTimeout(S.reacGoT);
  // Tras el tiempo de espera, cambia a verde
  S.reacGoT = setTimeout(() => {
    if (S.reacDone) return;
    S.reacReady = true;
    S.reacShownAt = Date.now();
    pad.className = "reac-pad go";
    $("#reacBig").textContent = "¡YA! 🟢";
    Sfx.go && Sfx.go();
  }, r.waitMs);
}
function reaccionTapPad(m){
  if (S.reacDone) return;
  const pad = $("#reacPad");
  if (!S.reacReady){
    // Se adelantó → penalización de esta ronda
    Sfx.wrong();
    S.reacFouls++;
    S.reacTotal += 2000; // castigo de 2s
    clearTimeout(S.reacGoT);
    pad.className = "reac-pad foul";
    $("#reacBig").textContent = "¡Muy pronto! ✋";
    $("#reacSub").textContent = "Espera el verde…";
    setTimeout(() => { S.reacRound++; reaccionNextRound(m); }, 900);
  } else {
    // Reacción válida
    const dt = Date.now() - S.reacShownAt;
    S.reacTotal += dt;
    Sfx.pick();
    pad.className = "reac-pad hit";
    $("#reacBig").textContent = dt + " ms";
    $("#reacSub").textContent = "¡Buena!";
    S.reacReady = false;
    setTimeout(() => { S.reacRound++; reaccionNextRound(m); }, 800);
  }
}
function reaccionFinishLocal(m){
  if (S.reacDone) return;
  S.reacDone = true;
  $("#reacBig").textContent = "¡Listo! ⚡";
  $("#reacSub").textContent = "Espera el resultado…";
  // "ok" = al menos una reacción válida (no todas foul). t = tiempo total (menor gana).
  const ok = S.reacFouls < m.data.rounds.length;
  reaccionSubmit(m, ok, S.reacTotal);
}
async function reaccionSubmit(m, ok, t){
  if (reaccionSubmitted) return; reaccionSubmitted = true;
  try {
    await sb.from("mini_scores").insert({
      room_id:S.room.id, player_id:S.me.id, kind:"reaccion", round:0,
      score:0, payload:{ ok, t: t||999999 }
    });
  } catch(e){}
}
function reaccionOnTimeUp(m){
  clearTimeout(S.reacGoT);
  if (!S.reacDone) reaccionFinishLocal(m);
}

// ---------- RITMO COPIADO (Simón dice) ----------
// Se muestra una secuencia que crece (2,3,4,5…). El jugador la repite.
// Puntos = cuántos pasos correctos en total logró (score directo × 10).
const RITMO_COLORS = ["#FF5E5B","#38B6FF","#3ECF6E","#FFC145"];
let ritmoSubmitted = false;
function ritmoStart(m){
  S.ritmoLevel = 2;      // empieza mostrando 2
  S.ritmoInput = [];
  S.ritmoScore = 0;      // pasos correctos acumulados
  S.ritmoDone = false;
  S.ritmoLocked = true;  // bloqueado mientras muestra
  const pads = $("#ritmoPads");
  pads.innerHTML = "";
  RITMO_COLORS.forEach((c,i) => {
    const b = document.createElement("button");
    b.className = "ritmo-pad";
    b.dataset.i = i;
    b.style.background = c;
    b.onclick = () => ritmoTap(i, m);
    pads.appendChild(b);
  });
  show("mini-ritmo");
  ritmoPlaySequence(m);
}
async function ritmoPlaySequence(m){
  S.ritmoLocked = true;
  S.ritmoInput = [];
  $("#ritmoMsg").textContent = "Observa… 👀";
  const seq = m.data.seq.slice(0, S.ritmoLevel);
  await sleep(600);
  for (const idx of seq){
    if (S.ritmoDone) return;
    await ritmoFlash(idx);
    await sleep(220);
  }
  $("#ritmoMsg").textContent = "¡Tu turno! Repite la secuencia";
  S.ritmoLocked = false;
}
function ritmoFlash(idx){
  return new Promise(res => {
    const pad = $$("#ritmoPads .ritmo-pad")[idx];
    if (!pad){ res(); return; }
    pad.classList.add("lit");
    Sfx.pick && Sfx.pick();
    setTimeout(() => { pad.classList.remove("lit"); res(); }, 420);
  });
}
async function ritmoTap(idx, m){
  if (S.ritmoLocked || S.ritmoDone) return;
  const seq = m.data.seq.slice(0, S.ritmoLevel);
  const pos = S.ritmoInput.length;
  // Flash visual del toque
  const pad = $$("#ritmoPads .ritmo-pad")[idx];
  pad.classList.add("lit"); setTimeout(()=>pad.classList.remove("lit"), 180);
  if (idx === seq[pos]){
    Sfx.pick && Sfx.pick();
    S.ritmoInput.push(idx);
    S.ritmoScore++; // cada paso correcto suma
    if (S.ritmoInput.length === seq.length){
      // Completó el nivel → sube dificultad
      S.ritmoLocked = true;
      $("#ritmoMsg").textContent = "¡Bien! 🎉 Ahora más largo…";
      S.ritmoLevel++;
      if (S.ritmoLevel > m.data.seq.length){ ritmoFinishLocal(m); return; }
      await sleep(800);
      ritmoPlaySequence(m);
    }
  } else {
    // Falló → termina su participación
    Sfx.wrong();
    pad.classList.add("err"); setTimeout(()=>pad.classList.remove("err"), 400);
    $("#ritmoMsg").textContent = `¡Fallaste! Llegaste a ${S.ritmoScore} pasos`;
    ritmoFinishLocal(m);
  }
}
function ritmoFinishLocal(m){
  if (S.ritmoDone) return;
  S.ritmoDone = true;
  S.ritmoLocked = true;
  ritmoSubmit(m);
}
async function ritmoSubmit(m){
  if (ritmoSubmitted) return; ritmoSubmitted = true;
  const pts = S.ritmoScore * 10; // 10 por paso correcto
  try {
    await sb.from("mini_scores").insert({
      room_id:S.room.id, player_id:S.me.id, kind:"ritmo", round:0, score:pts
    });
  } catch(e){}
}
function ritmoOnTimeUp(m){ if (!S.ritmoDone) ritmoFinishLocal(m); }

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

// ---------- PREGUNTÓN (completar palabra con pistas) ----------
let pregSubmitted = false;
function pregStart(m){
  const d = m.data;
  S.pregT0 = Date.now();
  S.pregDone = false;
  S.pregFilled = d.shown.slice();     // copia: letras ya reveladas; el resto null
  $("#pregCat").textContent = d.cat;
  $("#pregHint").textContent = "💡 " + d.hint;
  $("#pregScore").textContent = "";
  pregRenderWord(m);
  pregRenderKeys(m);
  show("mini-preg");
}
function pregNextEmptyIndex(){
  return S.pregFilled.findIndex(ch => ch === null);
}
function pregRenderWord(m){
  const wrap = $("#pregWord"); wrap.innerHTML = "";
  const next = pregNextEmptyIndex();
  S.pregFilled.forEach((ch, i) => {
    const slot = document.createElement("div");
    slot.className = "preg-slot" + (ch ? " filled" : "") + (i===next ? " active" : "");
    slot.textContent = ch || "";
    wrap.appendChild(slot);
  });
}
function pregRenderKeys(m){
  const wrap = $("#pregKeys"); wrap.innerHTML = "";
  m.data.keys.forEach(letter => {
    const b = document.createElement("button");
    b.className = "preg-key";
    b.textContent = letter;
    b.onclick = () => pregTapKey(letter, b, m);
    wrap.appendChild(b);
  });
}
async function pregTapKey(letter, btn, m){
  if (S.pregDone) return;
  const idx = pregNextEmptyIndex();
  if (idx < 0) return;
  const expected = m.data.word[idx];
  if (letter === expected){
    Sfx.pick();
    S.pregFilled[idx] = letter;
    pregRenderWord(m);
    if (pregNextEmptyIndex() < 0){
      // Palabra completa
      S.pregDone = true;
      const t = Date.now() - S.pregT0;
      $("#pregScore").textContent = "¡Correcto! 🎉 Espera el resultado…";
      Sfx.correct();
      await pregSubmit(m, true, t);
    }
  } else {
    // Letra incorrecta: parpadeo rojo, no avanza
    Sfx.wrong();
    btn.classList.add("wrong");
    setTimeout(()=>btn.classList.remove("wrong"), 400);
  }
}
async function pregSubmit(m, ok, t){
  if (pregSubmitted) return; pregSubmitted = true;
  try {
    await sb.from("mini_scores").insert({
      room_id:S.room.id, player_id:S.me.id, kind:"preg", round:0,
      score:0, payload:{ ok, t: t||999999 }
    });
  } catch(e){}
}
function pregOnTimeUp(m){
  if (!S.pregDone && !pregSubmitted) pregSubmit(m, false, 0);
}

// ---------- DELATOR (cliente) ----------
// Fase 1: escribir nombre real
function delatorShowNames(m){
  S.delatorVoted = false;
  show("mini-delator-names");
  const saved = S.me?.real_name || "";
  const inp = $("#delatorNameInput");
  inp.value = saved; inp.disabled = false;
  const btn = $("#delatorNameBtn");
  btn.disabled = false;
  btn.onclick = delatorSaveName;
  $("#delatorNameMsg").textContent = "";
}
function delatorUpdateNamesTimer(m){
  const left = Math.max(0, Math.ceil(((m.until||0)-Date.now())/1000));
  const el = $("#delatorNamesTimer"); if (el) el.textContent = left;
}
async function delatorSaveName(){
  const v = ($("#delatorNameInput").value || "").trim().slice(0,20);
  if (!v){ $("#delatorNameMsg").textContent = "Escribe tu nombre real 🙈"; return; }
  try {
    await sb.from("players").update({ real_name: v }).eq("id", S.me.id);
    if (S.me) S.me.real_name = v;
    $("#delatorNameMsg").textContent = "¡Listo! Espera a los demás… ✅";
    $("#delatorNameInput").disabled = true;
    $("#delatorNameBtn").disabled = true;
  } catch(e){ $("#delatorNameMsg").textContent = "No se pudo guardar, reintenta"; }
}

// Fase 2: votar (cada ronda)
function delatorShowVote(m){
  S.delatorVoted = false;
  const q = m.data.questions[m.dround];
  $("#delatorRound").textContent = `Pregunta ${m.dround+1} de ${m.data.n}`;
  $("#delatorQ").textContent = `¿Quién es más probable que ${q}?`;
  $("#delatorVoteMsg").textContent = "";
  const grid = $("#delatorOpts"); grid.innerHTML = "";
  // Opciones = todos los jugadores conectados MENOS uno mismo (no puedes votarte)
  S.players.filter(p => p.connected && p.id !== S.me?.id).forEach(p => {
    const b = document.createElement("button");
    b.className = "delator-opt";
    const nm = p.real_name || p.name;
    b.innerHTML = `<span class="d-em" style="background:${avatarColor(p.avatar)}">${p.avatar}</span>${esc(nm)}`;
    b.onclick = () => delatorVote(p.id, b, m);
    grid.appendChild(b);
  });
  show("mini-delator-vote");
}
function delatorUpdateVoteTimer(m){
  const left = Math.max(0, Math.ceil(((m.until||0)-Date.now())/1000));
  const el = $("#delatorVoteTimer"); if (el) el.textContent = left;
}
async function delatorVote(targetId, btn, m){
  if (S.delatorVoted) return;
  S.delatorVoted = true;
  $$("#delatorOpts .delator-opt").forEach(b => { if (b!==btn) b.classList.add("dim"); });
  btn.classList.add("picked");
  $("#delatorVoteMsg").textContent = "Voto enviado (anónimo) 🤫";
  Sfx.pick();
  try {
    await sb.from("mini_scores").insert({
      room_id:S.room.id, player_id:S.me.id, kind:"delator", round:m.dround,
      score:0, payload:{ votedFor: targetId }
    });
  } catch(e){}
}

// Fase 3: resultado de cada ronda (quién recibió más votos)
function delatorShowRoundResult(m){
  const received = m.roundVotes || {};
  const rows = Object.entries(received).map(([pid,cnt]) => {
    const p = S.players.find(x=>x.id===pid);
    return { p, cnt };
  }).filter(r=>r.p).sort((a,b)=>b.cnt-a.cnt);
  const q = m.data.questions[m.dround];
  $("#delatorResQ").textContent = `¿Quién es más probable que ${q}?`;
  const list = $("#delatorResList"); list.innerHTML = "";
  if (!rows.length){
    list.innerHTML = `<p class="hint">Nadie votó esta ronda 🤷</p>`;
  } else {
    const top = rows[0];
    $("#delatorResTop").textContent = `🏆 ${(top.p.real_name||top.p.name)} con ${top.cnt} voto${top.cnt>1?"s":""}`;
    rows.forEach(r => {
      const d = document.createElement("div");
      d.className = "brow";
      d.innerHTML = `<span class="em" style="background:${avatarColor(r.p.avatar)}">${r.p.avatar}</span>
        <span class="nm">${esc(r.p.real_name||r.p.name)}</span><span class="pts">${r.cnt} 🗳️ · −${r.cnt*15}</span>`;
      list.appendChild(d);
    });
  }
  show("mini-delator-result");
  Sfx.board();
}

// ---------- PWA ----------
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(()=>{});
