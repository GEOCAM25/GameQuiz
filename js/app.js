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

// ---------- Sesión anónima (identidad para las políticas de seguridad) ----------
// Cada celular obtiene, en silencio y sin pedir nada al usuario, una sesión
// anónima verificada por Supabase. Esa identidad (window.myUid) es la que las
// políticas de la base de datos (RLS) usan para saber "esta fila es tuya" y
// dejarte editarla o no. Sin esto, cualquiera con la llave pública podría
// editar salas y jugadores ajenos con una simple llamada a la API.
window.myUid = null;
window.authReady = hasBackend ? (async () => {
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session && session.user){ window.myUid = session.user.id; return; }
    const { data, error } = await sb.auth.signInAnonymously();
    if (error) throw error;
    window.myUid = data.user.id;
  } catch(e){
    console.error("No se pudo iniciar sesión anónima en Supabase:", e);
  }
})() : Promise.resolve();

// ---------- Modo PANTALLA (Smart TV / Roku) ----------
// Si la URL trae ?tv=1, esta pestaña se comporta como la PANTALLA grande:
// crea la sala, muestra el QR y renderiza todo para la TV. No usa la UI de
// teléfono. Se corta aquí el arranque normal.
if (typeof TV !== "undefined" && TV.isTVRequested()){
  document.addEventListener("DOMContentLoaded", () => TV.start(sb));
}

// ---------- Karaoke: CONTROL remoto (teléfono que escaneó el QR) ----------
// Si la URL trae ?karsync=CÓDIGO, esta pestaña es el control del karaoke:
// se conecta a la sesión y muestra la pantalla de control (no el juego).
const KAR_REMOTE = new URLSearchParams(location.search).get("karsync");
if (KAR_REMOTE && /^[A-Za-z0-9]{4}$/.test(KAR_REMOTE)){
  document.addEventListener("DOMContentLoaded", () => {
    try { if (typeof KarSync !== "undefined") KarSync.startRemote(KAR_REMOTE.toUpperCase()); }
    catch(e){ console.warn("karsync remote", e); }
  });
}

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
  rescueLoop: null,   // vigilante que rescata la partida si el anfitrión desaparece
  myStreak: 0,        // racha personal de respuestas correctas seguidas
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
  // Música: visible en toda la partida (sala + juego), no en home/perfil
  const musicOk = (S.room || S.solo) && id !== "home" && id !== "profile";
  $("#musicFab").classList.toggle("hidden", !musicOk);
  closeMusicPanel();
  // Salir: visible durante el juego activo (pregunta, revelación, marcador,
  // mini-juegos, cuenta regresiva). El lobby y el podio ya tienen su propio botón.
  const leaveOk = !!S.room && !["home","profile","lobby","podium"].includes(id);
  const leaveBtn = $("#leaveFab");
  if (leaveBtn) leaveBtn.classList.toggle("hidden", !leaveOk);
  if (id === "home" || id === "profile" || id === "lobby") clearCategoryTheme();
  // Escenario vivo: efecto especial en cuenta regresiva y celebración en el podio
  if (typeof Scenes !== "undefined") Scenes.onScreen(id);
}
function toast(t){
  const d = document.createElement("div");
  d.className = "toast"; d.textContent = t;
  $("#toasts").appendChild(d);
  setTimeout(() => d.remove(), 3200);
}

// Fondo temático según la categoría (punto 12). Agrega clase theme-<cat> al body.
const THEME_CATS = ["disney","pixar","netflix","hbo","anime","cine","famosos","geek",
  "banderas","historia","pop","trivia","curiosos","tecnologia","espacio","animales","futbol","deportes",
  "greys","terror","histchile","farandula","marvel","dc","dragonball","starwars","lotr"];
function applyCategoryTheme(cat){
  THEME_CATS.forEach(c => document.body.classList.remove("theme-" + c));
  if (cat) document.body.classList.add("theme-" + cat);
  // Escenario vivo por categoría (espacio, estadio, cine, sakura…)
  if (typeof Scenes !== "undefined") Scenes.setCategory(cat);
}
function clearCategoryTheme(){
  THEME_CATS.forEach(c => document.body.classList.remove("theme-" + c));
  // Vuelve al ambiente rotativo del inicio/lobby (cambia solo cada 30 s)
  if (typeof Scenes !== "undefined") Scenes.setAmbient();
}
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

// Tiempo por pregunta configurable por el anfitrión (15/25/40s). Si la sala
// no trae el ajuste (salas viejas), se usa el clásico QUESTION_TIME.
const qTime = () => (S.room && S.room.settings && +S.room.settings.qtime) || QUESTION_TIME;

// ---------- Pantalla siempre encendida durante la partida ----------
// En una trivia por turnos el teléfono pasa ratos sin toques y la pantalla
// se apagaría a mitad de pregunta. El Wake Lock la mantiene despierta
// mientras estás en una sala; se suelta al salir. Si el navegador no lo
// soporta (o falla), no pasa nada: el juego sigue igual.
let wakeLock = null;
async function keepAwake(){
  try {
    if (!wakeLock && "wakeLock" in navigator){
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => { wakeLock = null; });
    }
  } catch(e){ /* sin soporte o sin permiso: da lo mismo */ }
}
function releaseWake(){ try { wakeLock && wakeLock.release(); } catch(e){} wakeLock = null; }

// Al volver a la app (cambiaste de app, se apagó la pantalla, etc.):
// re-sincroniza AL TIRO en vez de esperar al ciclo de 4s, recupera el
// Wake Lock (el sistema lo suelta al ocultar la página) y se auto-marca
// conectado por si un rescate de anfitrión lo dio por desaparecido.
document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState !== "visible") return;
  if (S.room || S.solo) keepAwake();
  if (!S.room || S.solo || !sb) return;
  try { await sb.from("players").update({ connected:true }).eq("id", S.me.id); } catch(e){}
  try { await resync(); } catch(e){}
});
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
  if (room){ S.room = room; S.players = players || []; Music.onRoomUpdate(S.room); handleRoomState(); renderPlayers(); }
}

// ---------- HOME ----------
// Arranca la música YA, en el mismo toque, antes de cualquier "await" de red.
// iOS solo permite reproducir audio si el play() ocurre pegado al toque; si se
// llama después de esperar una respuesta del servidor, Safari ya lo bloqueó.
$("#btnGoCreate").onclick = () => { Music.enterGame(); Sfx.click(); S.mode = "create"; openProfile(); };
$("#btnGoJoin").onclick = () => { Music.enterGame(); Sfx.click(); S.mode = "join"; openProfile(); };
$("#btnSolo") && ($("#btnSolo").onclick = () => { Music.enterGame(); Sfx.click(); show("solo-menu"); });
// Inicio de dos niveles: el home solo ofrece Multijugador / Un jugador
$("#btnModeMulti") && ($("#btnModeMulti").onclick = () => { Music.enterGame(); Sfx.click(); show("multi-menu"); });
$("#btnModeSolo") && ($("#btnModeSolo").onclick = () => { Music.enterGame(); Sfx.click(); show("solo-menu"); });
$("#multiBackHome") && ($("#multiBackHome").onclick = () => { Sfx.click(); show("home"); });
$("#btnMundo") && ($("#btnMundo").onclick = () => {
  Sfx.click();
  if (typeof Mundo === "undefined") return toast("⛏️ Mundo Quiz llega pronto");
  Mundo.open(() => show("multi-menu"));
});
$("#soloBackHome") && ($("#soloBackHome").onclick = () => { Sfx.click(); show("home"); });
$("#soloCruci") && ($("#soloCruci").onclick = () => {
  Sfx.click();
  if (typeof Cruci === "undefined") return toast("No se pudo cargar el juego");
  Cruci.open(() => show("solo-menu")); // al salir del cruci, vuelve al menú
});
$("#soloMinis") && ($("#soloMinis").onclick = () => { Sfx.click(); startSoloMinis(); });
$("#soloQuizTime") && ($("#soloQuizTime").onclick = () => { Sfx.click(); startSolo("Tú", "😎"); });
$("#btnKaraoke") && ($("#btnKaraoke").onclick = () => {
  Sfx.click();
  if (typeof Karaoke === "undefined") return toast("No se pudo cargar el karaoke");
  Karaoke.open(() => show("multi-menu"));
});
$("#btnKaraokeLobby") && ($("#btnKaraokeLobby").onclick = () => {
  Sfx.click();
  if (typeof Karaoke === "undefined") return toast("No se pudo cargar el karaoke");
  Karaoke.open(() => show("lobby"));
});
$("#btnImpostor") && ($("#btnImpostor").onclick = () => {
  Sfx.click();
  if (typeof Impostor === "undefined") return toast("No se pudo cargar el juego");
  Impostor.open(() => show("multi-menu"));
});
$("#btnDraw") && ($("#btnDraw").onclick = () => {
  Sfx.click();
  if (typeof Draw === "undefined") return toast("🎨 Dibuja y Adivina llega pronto");
  Draw.open(() => show("multi-menu"));
});
$("#btnMojate") && ($("#btnMojate").onclick = () => {
  Sfx.click();
  if (typeof Mojate === "undefined") return toast("🫵 ¿Quién será? llega pronto");
  Mojate.open(() => show("multi-menu"));
});

// ---------- Lanzar otros juegos DENTRO de la sala (mismo código/jugadores) ----------
// El anfitrión toca un juego → se avisa a todos por el canal de la sala y
// TODOS lo abren conectados a la misma sesión (código = código de la sala).
function openRoomGame(game, code, name, isLeader){
  const back = () => show("lobby");
  if (game === "impostor" && typeof Impostor !== "undefined") Impostor.openShared(code, name, isLeader, back);
  else if (game === "draw" && typeof Draw !== "undefined") Draw.openShared(code, name, isLeader, back);
  else if (game === "mojate" && typeof Mojate !== "undefined") Mojate.openShared(code, name, isLeader, back);
}
function launchRoomGame(game){
  if (!S.room || !S.me) return;
  Sfx.click();
  const code = S.room.code, name = S.me.name;
  try { S.channel && S.channel.send({ type:"broadcast", event:"launchgame", payload:{ game, code, by: S.me.id } }); } catch(e){}
  openRoomGame(game, code, name, true);   // el anfitrión es el líder
}
function onLaunchGame(p){
  if (!p || !S.me || p.by === S.me.id) return;   // quien lo lanzó ya lo abrió como líder
  openRoomGame(p.game, p.code, S.me.name, false);
}
$("#btnRoomImpostor") && ($("#btnRoomImpostor").onclick = () => launchRoomGame("impostor"));
$("#btnRoomDraw") && ($("#btnRoomDraw").onclick = () => launchRoomGame("draw"));
$("#btnRoomMojate") && ($("#btnRoomMojate").onclick = () => launchRoomGame("mojate"));
$("#btnTV") && ($("#btnTV").onclick = () => {
  Sfx.click();
  modal(`<h3>📺 Modo pantalla</h3>
    <div style="text-align:left;font-weight:700;line-height:1.6;color:var(--ink2)">
      Abre <b>esta misma página en tu Smart TV</b> (o Roku con navegador) agregando <b>?tv=1</b> al final de la dirección.<br><br>
      La TV mostrará un <b>código y un QR</b>; los jugadores lo escanean con el teléfono y usan el celular como control 🎮.<br><br>
      Las preguntas se ven en la <b>TV</b> y los mini-juegos en el <b>teléfono</b>. El anfitrión puede <b>pausar</b> con el botón OK del control.
    </div>`,
    [{ t:"Abrir modo pantalla aquí 📺", cls:"btn-blue", fn: () => { location.href = location.pathname + "?tv=1"; } },
     { t:"Cerrar" }]);
});
$("#btnHowTo") && ($("#btnHowTo").onclick = () => {
  Sfx.click();
  modal(`<h3>❓ Cómo se juega</h3>
    <div style="text-align:left;font-weight:700;line-height:1.6;color:var(--ink2)">
      🎪 <b>Crea una sala</b> y comparte el código de 4 letras, o <b>entra</b> con el código de un amigo.<br><br>
      ⚡ Responde rápido: mientras antes aciertas, más puntos. Encadena aciertos para <b>rachas</b> 🔥 y ojo con la <b>pregunta final</b> que vale doble.<br><br>
      🎁 Entre preguntas pueden salir <b>mini-juegos sorpresa</b>.<br><br>
      🔊 En la sala, tu <b>botón sorpresa</b> hace sonar algo para todos. 🐠 Toca los peces y naves del fondo, ¡se arrancan!<br><br>
      💬 Chatea, manda stickers y GIFs. ¡Que gane el mejor!
    </div>`, [{ t:"¡A jugar! 🚀", cls:"btn-green" }]);
});
$$("[data-back]").forEach(b => b.onclick = () => { Sfx.click(); show("home"); });

function openProfile(){
  $("#profileTitle").textContent = S.mode === "create" ? "Crea tu sala 🎪" : "Únete a una sala 🚪";
  $("#joinCodeWrap").classList.toggle("hidden", S.mode !== "join");
  renderAvatars([]);
  // Al entrar se marca un personaje al azar automáticamente (punto pedido):
  // el jugador puede cambiarlo, pero ya parte con uno elegido.
  autoPickAvatar([]);
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
    d.onclick = () => selectAvatar(d);
    $("#avatarGrid").appendChild(d);
  });
}
// Selección con animación: brinca y queda con un leve balanceo.
function selectAvatar(node){
  if (node.classList.contains("taken")) return;
  Sfx.pick();
  try { navigator.vibrate && navigator.vibrate(15); } catch(e){}
  $$(".ava").forEach(x => { x.classList.remove("sel"); x.classList.remove("just-picked"); });
  node.classList.add("sel", "just-picked");
  // pequeño confeti de emojis saliendo del avatar elegido
  try {
    const r = node.getBoundingClientRect();
    if (typeof Fun !== "undefined") Fun.floatUp(node.textContent, r.left + r.width/2, r.top + r.height/2, 5);
  } catch(e){}
}
// Marca un avatar libre al azar. Si todos los de la primera opción están
// tomados, elige entre los que queden desocupados.
function autoPickAvatar(taken){
  const free = AVATARS.filter(a => !taken.includes(a));
  const pick = (free.length ? free : AVATARS)[Math.floor(Math.random() * (free.length ? free.length : AVATARS.length))];
  const node = $$(".ava").find(x => x.textContent === pick);
  if (node) selectAvatar(node);
}
let _joining = false;   // evita doble toque y el "pegado" del botón
$("#btnProfileGo").onclick = async () => {
  if (_joining) return;
  Music.enterGame(); // refuerzo: si por algún motivo no arrancó antes, lo intenta aquí también
  const name = $("#inpName").value.trim();
  const ava = $(".ava.sel")?.textContent;
  if (!name) return toast("✏️ Escribe tu nombre");
  if (!ava) return toast("🐼 Elige un personaje");
  const code = (S.mode === "create") ? "" : $("#inpCode").value.trim().toUpperCase();
  if (S.mode !== "create" && code.length !== 4) return toast("El código tiene 4 letras");
  Sfx.click();
  // Feedback inmediato: el botón se bloquea y muestra "Entrando…" (antes se
  // quedaba "pegado" sin avisar mientras esperaba la red).
  const btn = $("#btnProfileGo");
  const label = btn.textContent;
  _joining = true; btn.disabled = true; btn.classList.add("loading"); btn.textContent = "Entrando… ⏳";
  const release = () => { _joining = false; btn.disabled = false; btn.classList.remove("loading"); btn.textContent = label; };
  // Timeout de seguridad: si la red/autenticación se cuelga, el botón se
  // libera con aviso en vez de quedarse "pegado" para siempre.
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 12000));
  try {
    let task;
    if (S.mode === "create") task = createRoom(name, ava);
    else if (code === TEST_ROOM) task = startSolo(name, ava);
    else task = joinRoom(code, name, ava);
    await Promise.race([task, timeout]);
  } catch(e){ toast(e && e.message === "timeout" ? "⌛ La conexión tardó demasiado, intenta otra vez" : "⚠️ No se pudo entrar, intenta otra vez"); }
  release();
};

function needBackend(){
  if (hasBackend) return false;
  modal("<h3>⚙️ Falta configurar Supabase</h3><p>Abre <b>js/config.js</b> y pega tu URL y anon key. Revisa el README para el paso a paso. La sala de prueba <b>ZZZX</b> funciona sin configurar nada.</p>", [{t:"Entendido"}]);
  return true;
}

// ---------- Crear / unirse ----------
async function createRoom(name, ava){
  if (needBackend()) return;
  await window.authReady;
  const code = roomCode();
  const settings = { count:10, mode:"admin", filter:"on", cat: "disney", qids:[], scoreMode:"reset", qtime:15, minis:["random"] };
  const { data: room, error } = await sb.from("rooms").insert({ code, settings }).select().single();
  if (error) return toast("⚠️ No se pudo crear la sala");
  const { data: me } = await sb.from("players").insert({ room_id: room.id, name, avatar: ava, is_host: true }).select().single();
  await sb.from("rooms").update({ host_id: me.id }).eq("id", room.id);
  room.host_id = me.id;
  enterRoom(room, me);
}
async function joinRoom(code, name, ava){
  if (needBackend()) return;
  await window.authReady;
  const { data: room } = await sb.from("rooms").select("*").eq("code", code).maybeSingle();
  if (!room) return toast("🔍 No existe una sala con ese código");
  if (room.status !== "lobby") return toast("⛔ La partida ya comenzó");
  // Nombres expulsados por el anfitrión no pueden volver a entrar (soft-ban)
  if ((room.settings.banned || []).includes(name.trim().toLowerCase()))
    return toast("🚫 Ese nombre fue expulsado de esta sala");
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
  // En una sala de PANTALLA (TV/Roku) nadie es anfitrión todavía, porque la
  // TV crea la sala pero no es "jugador". El primer teléfono que entra pasa
  // a ser el anfitrión automáticamente (si no, nadie podría iniciar el juego).
  const needsHost = !!(room.settings && room.settings.tv) && !room.host_id;
  const { data: me, error } = await sb.from("players")
    .insert({ room_id: room.id, name, avatar, joined_late: late, is_host: needsHost })
    .select().single();
  if (error) return toast("⚠️ No se pudo entrar");
  if (needsHost){
    await sb.from("rooms").update({ host_id: me.id, host_owner_id: window.myUid }).eq("id", room.id);
    room.host_id = me.id;
  }
  sysMsg(room.id, `${avatar} ${name} entró a la sala 👋`);
  enterRoom(room, me);
}

function saveSession(){ localStorage.setItem("gq_session", JSON.stringify({ roomId: S.room.id, playerId: S.me.id })); }

async function enterRoom(room, me){
  S.room = room; S.me = me; S.solo = false;
  lastSoundPing = (room.settings && room.settings.soundPing && room.settings.soundPing.t) || 0;
  saveSession();
  keepAwake();
  await subscribeRoom();
  await resync();
  renderLobby();
  show("lobby");
  Sfx.join();
  Music.onRoomUpdate(S.room);
  Music.enterGame();
}

// ---------- Reconexión al abrir la app ----------
(async function tryRejoin(){
  // En modo pantalla (TV) no corre el flujo de teléfono.
  if (typeof TV !== "undefined" && TV.isTVRequested()) return;
  // Si es el control remoto del karaoke, tampoco corre el flujo normal.
  if (KAR_REMOTE) return;
  // Si llegó por un enlace compartido con ?sala=CÓDIGO, saltar directo a
  // "entrar a la sala" con el código ya puesto (más fácil que buscarlo).
  const _p = new URLSearchParams(location.search);
  const salaParam = _p.get("sala");
  const jParam = (_p.get("j") || "").toLowerCase();
  if (salaParam && /^[A-Za-z0-9]{4}$/.test(salaParam)){
    const code = salaParam.toUpperCase();
    // Enlace de un juego autónomo (Incógnito / Dibuja / ¿Quién será?):
    // entrar DIRECTO a esa sala, sin escribir el código.
    const AUTOG = {
      impostor: (typeof Impostor !== "undefined") ? Impostor : null,
      draw:     (typeof Draw     !== "undefined") ? Draw     : null,
      mojate:   (typeof Mojate   !== "undefined") ? Mojate   : null,
    };
    if (jParam && AUTOG[jParam] && AUTOG[jParam].join){
      history.replaceState(null, "", location.pathname);
      Music.enterGame();
      AUTOG[jParam].join(code, () => show("home"));
      return;
    }
    const raw0 = localStorage.getItem("gq_session");
    if (!raw0){ // no reventar una reconexión en curso
      Music.enterGame();
      S.mode = "join";
      openProfile();
      const codeInput = $("#inpCode");
      if (codeInput) codeInput.value = salaParam.toUpperCase();
      toast("🎪 Entrando a la sala " + salaParam.toUpperCase());
      // limpiar el parámetro para que un refresh no reintente
      history.replaceState(null, "", location.pathname);
      return;
    }
  }
  const raw = localStorage.getItem("gq_session");
  if (!raw || !hasBackend) return;
  await window.authReady;   // esperar el login anónimo antes de tocar la base
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
      p => { S.room = p.new; Music.onRoomUpdate(S.room); handleRoomState(); })
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
    .on("broadcast", { event:"sound" }, ({ payload }) => onRemoteSound(payload))
    .on("broadcast", { event:"launchgame" }, ({ payload }) => onLaunchGame(payload))
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

  // Vigilante de rescate: corre en todos, por si el anfitrión desaparece
  clearInterval(S.rescueLoop);
  S.rescueLoop = setInterval(rescueTick, 2500);
}

// ---------- LOBBY ----------
const amHost = () => S.me && S.room && S.room.host_id === S.me.id;
// Categoría inicial al azar (antes siempre quedaba Disney marcada por defecto)
function randomCategoryId(){ return CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)].id; }

function renderLobby(){
  $("#lobbyCode").textContent = S.room.code;
  // Control remoto de la TV/Roku desde el teléfono (solo en salas de pantalla)
  const isTvRoom = !!(S.room.settings && S.room.settings.tv);
  const rem = $("#tvRemote");
  if (rem) rem.classList.toggle("hidden", !isTvRoom);
  $("#hostSettings").classList.toggle("hidden", !amHost());
  $("#roomGames") && $("#roomGames").classList.toggle("hidden", !amHost());
  $("#btnStart").classList.toggle("hidden", !amHost());
  $("#lobbyHint").classList.toggle("hidden", amHost());
  const st = S.room.settings;
  S.selCount = st.count; S.selMode = st.mode; S.selFilter = st.filter; S.selCat = st.cat;
  syncSeg("#segCount", String(st.count)); syncSeg("#segMode", st.mode); syncSeg("#segFilter", st.filter);
  syncSeg("#segScore", st.scoreMode || "reset");
  syncSeg("#segTime", String(st.qtime || 40));
  syncMinis(st.minis || (st.mini ? [st.mini] : ["none"]));
  $("#chkMusicSync").checked = !!(st.musicSync && st.musicSync.on);
  renderCats(); renderPlayers(); refreshVotes(); renderSoundBoard();
}
function syncMinis(arr){ $$("#miniGrid button").forEach(b => b.classList.toggle("on", arr.includes(b.dataset.v))); }
function syncSeg(sel, v){ $$(sel + " button").forEach(b => b.classList.toggle("on", b.dataset.v === v)); }

// ---------- Botón sorpresa de sonido (uno por jugador) ----------
// A cada jugador se le asigna un sonido de "ganador" al azar. Al tocarlo,
// suena en SU celular y se avisa por broadcast para que suene en todos.
// Se re-sortea cada vez que se vuelve al lobby tras una partida, usando el
// número de ronda como semilla para que sea estable dentro del mismo lobby.
const SB_COLORS = ["#FF4A6E","#1E9BFF","#16B364","#FFB821","#8C52FF","#4ECDC4","#E56399","#F4A261"];
const SB_EMOJIS = ["📣","🎺","🔔","💥","🎉","🤪","🥁","📢","😜","🎪"];
let sbCooldown = 0;
function mySoundIndex(){
  if (typeof WINNER_SOUNDS === "undefined" || !WINNER_SOUNDS.length || !S.me) return -1;
  // Semilla: id del jugador + "generación" de sonido de la sala (sube cada partida).
  const gen = (S.room && S.room.settings && S.room.settings.soundGen) || 0;
  let h = gen * 2654435761;
  const id = String(S.me.id);
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % WINNER_SOUNDS.length;
}
function renderSoundBoard(){
  const box = $("#soundBoard");
  if (!box) return;
  const idx = mySoundIndex();
  if (idx < 0){ box.innerHTML = ""; return; }
  const s = WINNER_SOUNDS[idx];
  const color = SB_COLORS[idx % SB_COLORS.length];
  const emoji = SB_EMOJIS[idx % SB_EMOJIS.length];
  box.innerHTML = "";
  const btn = document.createElement("button");
  btn.className = "sound-btn";
  btn.style.background = `linear-gradient(180deg, ${lighten(color)}, ${color})`;
  btn.style.boxShadow = `0 6px 0 ${shade(color)}, 0 14px 24px rgba(0,0,0,.35)`;
  btn.innerHTML = `<span class="sb-emoji">${emoji}</span><span class="sb-name">${esc(s.label)}</span>
    <span class="sb-wave"><i></i><i></i><i></i></span>`;
  btn.onclick = () => playMySound(idx, btn);
  box.appendChild(btn);
}
function playMySound(idx, btn){
  const now = Date.now();
  if (now < sbCooldown) return toast("⏳ Espera un poquito…");
  sbCooldown = now + 1200; // anti-spam
  btn.classList.add("playing");
  setTimeout(() => btn.classList.remove("playing"), 700);
  WinnerFx.play(idx);
  showSoundToast(idx, S.me);
  if (S.solo) return;
  // Avisar a todos: dos vías por seguridad —
  //  1) broadcast (instantáneo, efímero)
  //  2) un "soundPing" en la sala, que viaja por el mismo canal de Realtime
  //     que ya funciona siempre para las actualizaciones de sala. Así, si el
  //     broadcast se pierde, el ping igual llega.
  if (S.channel){
    try {
      S.channel.send({ type:"broadcast", event:"sound",
        payload:{ idx, by: S.me.name, avatar: S.me.avatar, from: S.me.id, t: Date.now() } });
    } catch(e){}
  }
  try {
    const settings = { ...S.room.settings,
      soundPing: { idx, by: S.me.name, avatar: S.me.avatar, from: S.me.id, t: Date.now() } };
    sb.from("rooms").update({ settings }).eq("id", S.room.id);
  } catch(e){}
}
let lastSoundPing = 0;
function handleSoundPing(){
  const p = S.room && S.room.settings && S.room.settings.soundPing;
  if (!p || p.t === lastSoundPing) return;
  lastSoundPing = p.t;
  if (p.from === (S.me && S.me.id)) return; // el mío ya sonó localmente
  if (typeof WINNER_SOUNDS === "undefined" || !WINNER_SOUNDS[p.idx]) return;
  WinnerFx.play(p.idx);
  showSoundToast(p.idx, { name: p.by, avatar: p.avatar });
}
function onRemoteSound(p){
  if (!p || p.from === (S.me && S.me.id)) return; // el mío ya sonó localmente
  if (p.t && p.t === lastSoundPing) return;       // ya sonó por el ping
  if (p.t) lastSoundPing = p.t;
  if (typeof WINNER_SOUNDS === "undefined" || !WINNER_SOUNDS[p.idx]) return;
  WinnerFx.play(p.idx);
  showSoundToast(p.idx, { name: p.by, avatar: p.avatar });
}
function showSoundToast(idx, who){
  const s = WINNER_SOUNDS[idx];
  const t = document.createElement("div");
  t.className = "sound-toast";
  t.innerHTML = `<span class="st-emoji">🔊</span><span>${who && who.avatar ? who.avatar : ""} ${esc(who && who.name ? who.name : "Alguien")}: ${esc(s.label)}</span>`;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 1900);
}
function shade(hex){
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, (n>>16) - 60), g = Math.max(0, ((n>>8)&255) - 60), b = Math.max(0, (n&255) - 60);
  return `rgb(${r},${g},${b})`;
}

function segHandler(sel, key){
  $$(sel + " button").forEach(b => b.onclick = async () => {
    Sfx.click();
    syncSeg(sel, b.dataset.v);
    const numeric = key === "count" || key === "qtime";
    const settings = { ...S.room.settings, [key]: numeric ? +b.dataset.v : b.dataset.v };
    await sb.from("rooms").update({ settings }).eq("id", S.room.id);
  });
}
segHandler("#segCount", "count"); segHandler("#segMode", "mode"); segHandler("#segFilter", "filter");
segHandler("#segScore", "scoreMode");
segHandler("#segTime", "qtime");

// Selector de mini-juegos (selección múltiple: puedes elegir varios a la vez)
$$("#miniGrid button").forEach(b => b.onclick = async () => {
  if (b.disabled) return;
  Sfx.click();
  const v = b.dataset.v;
  let cur = S.room.settings.minis || (S.room.settings.mini ? [S.room.settings.mini] : ["none"]);
  if (v === "none" || v === "random" || v === "all"){
    cur = [v]; // "Ninguno", "Al azar" y "Todos" son excluyentes con el resto
  } else {
    cur = cur.filter(k => k !== "none" && k !== "random" && k !== "all");
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
  const randomMode = S.room?.settings.mode === "random";
  $("#catTitle").textContent = voteMode ? "Vota por una categoría 🗳️"
    : randomMode ? "Categoría al azar 🎲 (se sortea al iniciar)"
    : "Categoría 📚" + (amHost() ? "" : " (la elige el anfitrión)");
  CATEGORIES.forEach(c => {
    const b = document.createElement("button");
    // En modo aleatorio no se marca ninguna (se decide al iniciar)
    b.className = "cat" + (S.room.settings.cat === c.id && !voteMode && !randomMode ? " sel" : "");
    b.innerHTML = `<span class="ce">${c.emoji}</span>${c.name}<span class="votes hidden" id="v-${c.id}">0</span>`;
    b.onclick = async () => {
      Sfx.pick();
      if (randomMode){
        toast("🎲 En modo aleatorio la categoría se sortea al iniciar");
      } else if (voteMode){
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
  const accum = S.room?.settings?.scoreMode === "accum";
  const hasScores = S.players.some(p => (accum ? p.total_score : p.score) > 0);
  S.players.forEach(p => {
    const d = document.createElement("div");
    d.className = "chip" + (p.connected ? "" : " off");
    const pts = accum ? (p.total_score||0) : (p.score||0);
    const ptsHtml = hasScores ? `<span class="chip-pts">${pts} pts</span>` : "";
    d.innerHTML = `<span class="em" style="background:${avatarColor(p.avatar)}">${p.avatar}</span>${esc(p.name)}${p.is_host ? ' <span class="host-star">👑</span>' : ""}${ptsHtml}`;
    // El anfitrión puede expulsar tocando la ficha del jugador (solo en el lobby)
    if (amHost() && p.id !== S.me.id && S.room.status === "lobby"){
      d.style.cursor = "pointer";
      d.onclick = () => modal(
        `<h3>🚫 ¿Expulsar a ${esc(p.name)}?</h3><p>Saldrá de la sala y no podrá volver a entrar con ese nombre.</p>`,
        [{ t:"Expulsar 🚫", cls:"btn-red", fn: () => kickPlayer(p) }, { t:"Cancelar" }]
      );
    }
    list.appendChild(d);
  });
}

$("#btnShare").onclick = () => {
  Sfx.click();
  const url = location.origin + location.pathname + "?sala=" + S.room.code;
  const text = `🎲 ¡Juguemos Súper Trivia! Toca aquí para entrar directo a mi sala (código ${S.room.code}) 👉 ${url}`;
  if (navigator.share) navigator.share({ title:"Súper Trivia", text, url }).catch(()=>{});
  else { navigator.clipboard.writeText(text); toast("📋 Invitación copiada"); }
};

// Compartir sala de los juegos autónomos (Incógnito / Dibuja / ¿Quién será?).
// Genera un enlace ?sala=CÓDIGO&j=JUEGO; quien lo abra entra DIRECTO a la sala.
window.shareGameRoom = function(code, gameKey, gameName){
  try { Sfx.click(); } catch(e){}
  const url = location.origin + location.pathname + "?sala=" + code + "&j=" + gameKey;
  const text = `🎮 ¡Juguemos ${gameName}! Toca aquí para entrar directo a mi sala (código ${code}) 👉 ${url}`;
  if (navigator.share) navigator.share({ title: gameName, text, url }).catch(()=>{});
  else if (navigator.clipboard) navigator.clipboard.writeText(text).then(()=>toast("📋 Invitación copiada"), ()=>toast("Código de sala: "+code));
  else toast("Código de sala: "+code);
};

$("#btnLeave").onclick = () => {
  modal("<h3>🚪 ¿Salir de la partida?</h3><p>Podrás volver a entrar, pero perderás los puntos de las preguntas que te pierdas.</p>", [
    { t:"Sí, salir", cls:"btn-red", fn: leaveGame },
    { t:"Quedarme", cls:"btn-green" },
  ]);
};
$("#leaveFab").onclick = () => {
  Sfx.click();
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
      await sb.from("rooms").update({ host_id: heir.id, host_owner_id: heir.owner_id }).eq("id", S.room.id);
      sysMsg(S.room.id, `👑 ${heir.avatar} ${heir.name} es el nuevo anfitrión`);
    }
  }
  stopHostLoop();
  await sb.from("players").update({ connected:false }).eq("id", S.me.id);
  sysMsg(S.room.id, `${S.me.avatar} ${S.me.name} salió de la partida 👋`);
  if (S.channel) sb.removeChannel(S.channel);
  clearInterval(S.syncLoop);
  clearInterval(S.rescueLoop); S.rescueLoop = null;
  localStorage.removeItem("gq_session");
  S.hostTimers.forEach(clearTimeout);
  releaseWake();
  S.room = null; S.me = null; S.players = [];
  show("home");
}

// ---------- Expulsar jugadores (anfitrión) ----------
// El aviso viaja dentro de settings.kick; el cliente expulsado lo ve llegar
// por Realtime y se saca solo de la sala. El nombre queda en settings.banned
// para que no pueda volver a entrar tal cual (soft-ban de fiesta).
async function kickPlayer(p){
  const banned = [...(S.room.settings.banned || []), p.name.trim().toLowerCase()];
  const settings = { ...S.room.settings, banned, kick: { id: p.id, t: Date.now() } };
  await sb.from("rooms").update({ settings }).eq("id", S.room.id);
  await sb.from("players").update({ connected:false }).eq("id", p.id);
  sysMsg(S.room.id, `${p.avatar} ${p.name} fue expulsado de la sala 🚫`);
}
function kickedOut(){
  stopHostLoop();
  if (S.channel) sb.removeChannel(S.channel);
  clearInterval(S.syncLoop);
  clearInterval(S.rescueLoop); S.rescueLoop = null;
  localStorage.removeItem("gq_session");
  S.hostTimers.forEach(clearTimeout);
  releaseWake();
  S.room = null; S.me = null; S.players = [];
  show("home");
  modal("<h3>🚫 Te expulsaron de la sala</h3><p>El anfitrión decidió sacarte de esta partida.</p>", [{ t:"Entendido" }]);
}

// ---------- Rescate automático de anfitrión ----------
// El único que avanza las fases es el anfitrión. Si se le apaga el teléfono
// o pierde señal y NO vuelve, antes la partida quedaba pegada para siempre.
// Este vigilante corre en TODOS los jugadores: si una fase lleva 12+ segundos
// vencida sin que nadie la mueva, el siguiente jugador en la fila reclama el
// mando. Cada candidato espera su turno (12s, 16s, 20s…) y el UPDATE
// condicionado a host_id funciona como "compare-and-swap": aunque dos lo
// intenten a la vez, la base de datos deja ganar a uno solo.
let rescuing = false;
async function rescueTick(){
  if (!S.room || S.solo || !S.me || amHost() || rescuing) return;
  const st = S.room.status;
  if (!["countdown","question","reveal","board","mini"].includes(st)) return;
  const until = S.room.phase_until || 0;
  if (until <= 0) return;
  const overdue = Date.now() - until;
  const candidates = S.players
    .filter(p => p.connected && p.id !== S.room.host_id)
    .sort((a,b) => String(a.id).localeCompare(String(b.id)));
  const rank = candidates.findIndex(p => p.id === S.me.id);
  if (rank < 0 || overdue < 12000 + rank*4000) return;
  rescuing = true;
  try {
    const oldHost = S.room.host_id;
    const { data } = await sb.from("rooms").update({ host_id: S.me.id, host_owner_id: window.myUid })
      .eq("id", S.room.id).eq("host_id", oldHost).select().maybeSingle();
    if (data){ // gané el relevo: desde ahora yo muevo la partida
      S.room = data;
      await sb.from("players").update({ is_host:false, connected:false }).eq("id", oldHost);
      await sb.from("players").update({ is_host:true }).eq("id", S.me.id);
      sysMsg(S.room.id, `👑 ${S.me.avatar} ${S.me.name} tomó el mando (el anfitrión se desconectó)`);
      toast("👑 Ahora eres el anfitrión");
      startHostLoop();
      hostTick();
    }
  } catch(e){ console.error("Rescate de anfitrión falló:", e); }
  finally { rescuing = false; }
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
  } else if (S.room.settings.mode === "random"){
    cat = randomCategoryId();
  }
  const bank = await loadBank(cat);
  const count = Math.min(S.room.settings.count, bank.questions.length);
  // Preguntas sin repetir entre rondas: se recuerdan las ya jugadas por
  // categoría (dentro de settings, sin tocar la base de datos). Cuando el
  // banco se agota, se reinicia el ciclo para esa categoría.
  const usedAll = S.room.settings.usedQids || {};
  let usedCat = usedAll[cat] || [];
  let pool = [...bank.questions.keys()].filter(id => !usedCat.includes(id));
  if (pool.length < count){ usedCat = []; pool = [...bank.questions.keys()]; }
  const qids = shuffle(pool).slice(0, count);
  const usedQids = { ...usedAll, [cat]: [...usedCat, ...qids] };

  // Decidir qué mini-juegos entran (pueden ser varios) y en qué momento aparece cada uno
  const IMPLEMENTED_MINIS = ["flash","color","memoria","punteria","reaccion","ritmo","delator","preg","vf","bomba"];
  let chosen = S.room.settings.minis || (S.room.settings.mini ? [S.room.settings.mini] : ["random"]);
  let minisToPlay = [];
  if (chosen.includes("all")){
    minisToPlay = shuffle([...IMPLEMENTED_MINIS]);
  } else if (chosen.includes("random")){
    minisToPlay = shuffle([...IMPLEMENTED_MINIS]).slice(0, 2); // predeterminado: exactamente 2 al azar
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

  const settings = { ...S.room.settings, cat, qids, count, miniSchedule, usedQids };
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
  const until = Date.now() + qTime()*1000;
  await sb.from("rooms").update({
    status:"question", current_q:i,
    q_started_at:new Date().toISOString(),
    phase_until: until,
    round_winner: null
  }).eq("id", S.room.id);
}

// Botones ganadores: solo quien respondió correcto primero puede tocar uno.
// Se eligen 3 sonidos y 3 colores al azar cada vez. Si nadie acertó, no hay botones.
async function computeRoundWinner(){
  if (typeof WINNER_SOUNDS === "undefined" || !WINNER_SOUNDS.length) return null;
  try {
    const { data } = await sb.from("answers").select("player_id,answered_at")
      .eq("room_id", S.room.id).eq("q_index", S.room.current_q).eq("correct", true)
      .order("answered_at", { ascending:true }).limit(1);
    if (!data || !data.length) return null;
    const soundIdx = shuffle(WINNER_SOUNDS.map((_,i)=>i)).slice(0,3);
    const colors = shuffle([...WINNER_COLORS]).slice(0,3);
    return { playerId: data[0].player_id, soundIdx, colors, playedIdx: null };
  } catch(e){ return null; }
}
async function goToBoard(){
  const round_winner = await computeRoundWinner();
  try {
    await sb.from("rooms").update({ status:"board", phase_until: Date.now()+BOARD_TIME*1000, round_winner })
      .eq("id", S.room.id).throwOnError();
  } catch(e){
    // Si falla (ej. falta la columna round_winner porque no se corrió el SQL
    // más nuevo), reintenta SIN ese campo para que el juego jamás quede
    // pegado esperando una actualización que nunca llega.
    console.error("goToBoard falló con round_winner, reintentando sin él:", e);
    await sb.from("rooms").update({ status:"board", phase_until: Date.now()+BOARD_TIME*1000 }).eq("id", S.room.id);
  }
}

// Arranca el watchdog del anfitrión (idempotente: nunca duplica)
function startHostLoop(){
  if (S.hostLoop) return;
  S.hostLoop = setInterval(hostTick, 1000);
}
function stopHostLoop(){ clearInterval(S.hostLoop); S.hostLoop = null; }

let hostBusy = false;
let stuckSig = "", stuckCount = 0;
async function hostTick(){
  if (!amHost() || hostBusy || !S.room) return;
  const st = S.room.status;
  if (!["countdown","question","reveal","board","mini"].includes(st)) return;

  try {
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
      // Disyuntor de seguridad: si llevamos varios segundos intentando pasar
      // esta MISMA fase sin éxito (algo falló silenciosamente), se fuerza un
      // avance de emergencia en vez de quedar pegado para siempre.
      const sig = `${st}:${S.room.current_q}:${until}`;
      stuckCount = (sig === stuckSig) ? stuckCount + 1 : 0;
      stuckSig = sig;
      if (stuckCount >= 8){
        console.error("Watchdog: fase pegada, forzando avance de emergencia:", sig);
        stuckCount = 0;
        hostBusy = true;
        try { await forceAdvance(st); } finally { hostBusy = false; }
        return;
      }

      hostBusy = true;
      try {
        if (st === "question") await finishQuestion(S.room.current_q);
        else if (st === "reveal") await goToBoard();
        else if (st === "countdown"){
          // Respaldo: normalmente el setTimeout del inicio lanza la pregunta 1.
          // Este camino corre si ese timer murió (pantalla bloqueada, o un
          // anfitrión rescatado que retoma una partida pegada en countdown).
          if (Date.now() >= until + 1500) await nextQuestion((S.room.current_q ?? -1) + 1);
        }
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
  } catch(e){
    // Red de seguridad final: cualquier error no previsto se registra en
    // consola pero NUNCA deja la partida pegada en silencio.
    console.error("hostTick: error inesperado", e);
  }
}

// Último recurso del disyuntor: si una fase lleva ~8s sin poder avanzar
// (algo falló en silencio), se fuerza el siguiente paso más razonable,
// aunque eso signifique saltarse un mini-juego o una pregunta puntual.
async function forceAdvance(st){
  try {
    const s = S.room.settings || {};
    const last = S.room.current_q >= (s.qids?.length || 1) - 1;
    if (st === "question"){
      await sb.from("rooms").update({ status:"reveal", phase_until: Date.now()+REVEAL_TIME*1000 }).eq("id", S.room.id);
    } else if (st === "countdown"){
      await nextQuestion((S.room.current_q ?? -1) + 1);
    } else if (st === "reveal"){
      await sb.from("rooms").update({ status:"board", phase_until: Date.now()+BOARD_TIME*1000 }).eq("id", S.room.id);
    } else if (st === "board" || st === "mini"){
      if (last){ await saveGameHistory().catch(()=>{}); await sb.from("rooms").update({ status:"podium" }).eq("id", S.room.id); }
      else await nextQuestion(S.room.current_q + 1);
    }
  } catch(e){ console.error("forceAdvance también falló:", e); }
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
    // Historial de aciertos previos para calcular RACHAS. Se lee de la BD
    // (no de memoria) para que el bono sobreviva a un cambio de anfitrión.
    const hist = {};
    try {
      const { data: prev } = await sb.from("answers").select("player_id,q_index,correct")
        .eq("room_id", S.room.id).lt("q_index", i);
      (prev || []).forEach(a => { (hist[a.player_id] = hist[a.player_id] || {})[a.q_index] = !!a.correct; });
    } catch(e){ /* sin historial no hay bono de racha, pero se puntúa igual */ }
    const streakOf = pid => { let s = 0; for (let k = i-1; k >= 0; k--){ if (hist[pid] && hist[pid][k]) s++; else break; } return s; };
    // Sistema de puntos v2:
    //  · Bono por orden de llegada entre los que aciertan (60/50/42/35).
    //  · Bono de velocidad proporcional al tiempo configurado (0–20 pts),
    //    así 15s y 40s por pregunta premian igual de justo.
    //  · Bono de RACHA: +6 por cada acierto seguido extra (tope +30).
    //  · Responder mal da 15 de participación.
    //  · La ÚLTIMA pregunta vale DOBLE (remontadas de último minuto 🔥).
    const PLACE = [60,50,42,35];
    const INCORRECT_PTS = 5;
    const isFinal = i >= S.room.settings.qids.length - 1;
    let place = 0;
    for (const a of (answers||[])){
      const isCorrect = a.answer === q.c;
      if (a.points > 0){ if (isCorrect) place++; continue; } // ya puntuada (evita doble conteo)
      let pts;
      if (isCorrect){
        const secs = Math.max(0, qTime() - (new Date(a.answered_at).getTime() - t0)/1000);
        const speed = Math.round((secs / qTime()) * 20);
        const streak = streakOf(a.player_id) + 1;
        const streakBonus = Math.min((streak - 1) * 6, 30);
        pts = PLACE[Math.min(place,3)] + speed + streakBonus;
        place++;
      } else {
        pts = INCORRECT_PTS;
      }
      if (isFinal) pts *= 2;
      await sb.from("answers").update({ points: pts, correct: isCorrect }).eq("id", a.id);
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

// Muestra/oculta el aviso de "juego en pausa" en el teléfono.
function showPauseOverlay(on){
  let ov = document.getElementById("pauseOverlay");
  if (on){
    if (!ov){
      ov = document.createElement("div");
      ov.id = "pauseOverlay";
      ov.innerHTML = `<div class="pause-card">⏸<b>Juego en pausa</b><small>El anfitrión pausó desde la pantalla</small></div>`;
      document.body.appendChild(ov);
    }
  } else if (ov){ ov.remove(); }
}
// Al REANUDAR, corre las marcas de tiempo hacia adelante por el rato pausado.
async function resumeShiftDeadlines(pausedMs){
  if (!amHost() || !S.room || pausedMs <= 0) return;
  const upd = {};
  if (S.room.phase_until) upd.phase_until = S.room.phase_until + pausedMs;
  if (S.room.q_started_at) upd.q_started_at = new Date(new Date(S.room.q_started_at).getTime() + pausedMs).toISOString();
  if (Object.keys(upd).length){ try { await sb.from("rooms").update(upd).eq("id", S.room.id); } catch(e){} }
}

async function handleRoomState(){
  // ¿Me expulsaron? El aviso llega dentro de settings.kick por Realtime.
  const k = S.room.settings && S.room.settings.kick;
  if (k && S.me && k.id === S.me.id) return kickedOut();
  handleSoundPing(); // botón sorpresa de otro jugador (vía Realtime, respaldo del broadcast)
  // ¿El anfitrión pausó desde la TV? Mostrar aviso y congelar: el watchdog
  // no avanza mientras esté en pausa. Al reanudar se corren las marcas de
  // tiempo para que no salte de fase.
  const paused = !!(S.room.settings && S.room.settings.paused);
  if (paused && !S._pausedAt) S._pausedAt = Date.now();
  showPauseOverlay(paused);
  if (paused){ stopHostLoop(); lastStatus = S.room.status; return; }
  if (S._pausedAt){ const dur = Date.now() - S._pausedAt; S._pausedAt = 0; resumeShiftDeadlines(dur); }
  const st = S.room.status;
  Music.setGamePhase(st); // baja a 10% durante la partida, sube al volver a lobby/podio
  if (["countdown","question","reveal","board","mini"].includes(st)) keepAwake();
  // El anfitrión mantiene el watchdog vivo durante toda la partida (bug 3,4,5)
  if (amHost() && ["countdown","question","reveal","board","mini"].includes(st)) startHostLoop();
  else if (st === "lobby" || st === "podium") stopHostLoop();

  if (st === "lobby"){ renderLobby(); if (lastStatus !== "lobby") show("lobby"); }
  else if (st === "countdown" && lastStatus !== "countdown") runCountdown();
  else if (st === "question" && (lastStatus !== "question" || lastQ !== S.room.current_q)) showQuestion();
  else if (st === "reveal" && lastStatus !== "reveal") showReveal();
  else if (st === "board"){ if (lastStatus !== "board") enterBoard(); else renderWinnerButtons(); }
  else if (st === "mini") handleMiniState();
  else if (st === "podium" && lastStatus !== "podium") showPodium();
  if (st === "lobby") renderCats();
  lastStatus = st; lastQ = S.room.current_q;
}

function runCountdown(){
  S._podiumFx = false;
  S.myStreak = 0; // partida nueva, racha nueva
  boardAnimQ = null; boardDeltas = {};
  const bl = $("#boardList"); if (bl) bl.innerHTML = ""; // marcador limpio para la ronda nueva
  const cl = $("#scr-countdown .cd-label");
  if (cl) cl.textContent = S.solo ? "¡Trivia-Quiz está por comenzar!" : "¡Súper Trivia está por comenzar!";
  StartFx.play(); // sonido "¡empieza el juego!" para TODOS los jugadores
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
  const totalQ = S.room.settings.qids.length;
  const isFinal = i >= totalQ - 1;
  $("#qIdx").textContent = isFinal ? `Final ×2 · ${i+1}/${totalQ}` : `${i+1}/${totalQ}`;
  if (isFinal && totalQ > 1) toast("🔥 ¡Pregunta final: puntos DOBLES!");
  // Precarga la imagen de la próxima pregunta para que aparezca al tiro
  const nq = bank.questions[S.room.settings.qids[i+1]];
  if (nq && nq.img){ try { new Image().src = nq.img; } catch(e){} }
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
  const total = qTime();
  const t0 = new Date(S.room.q_started_at).getTime();
  const tick = () => {
    const elapsed = (Date.now() - t0)/1000;
    S.qLeft = Math.max(0, Math.round(Math.min(total, total - elapsed)));
    $("#qTimerNum").textContent = S.qLeft;
    $("#qTimerBar").style.transform = `scaleX(${S.qLeft/total})`;
    $("#qTimerBar").style.background = S.qLeft <= total*0.25 ? "var(--red)" : S.qLeft <= total*0.5 ? "var(--yellow)" : "var(--green)";
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
  try { navigator.vibrate && navigator.vibrate(18); } catch(e){}
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
  S.myStreak = ok ? (S.myStreak || 0) + 1 : 0;
  $("#revealIcon").textContent = ok ? "🎉" : mine ? "😵" : "⏰";
  const streakTxt = ok && S.myStreak >= 2 ? ` · 🔥 racha ×${S.myStreak}` : "";
  $("#revealYou").textContent = ok ? `¡Correcto! +${mine.points||0} puntos${streakTxt}` : mine ? "Incorrecto esta vez 😬" : "No alcanzaste a responder";
  playOutcomeSound(ok);
  // Micro-celebración visual: emojis subiendo si acertaste, sacudida si fallaste.
  try {
    if (typeof Fun !== "undefined"){
      if (ok){
        const cx = window.innerWidth/2, cy = window.innerHeight*0.42;
        Fun.floatUp(S.myStreak >= 3 ? "🔥" : "🎉", cx, cy, S.myStreak >= 3 ? 10 : 7);
      } else if (mine){ Fun.shake(420); }
    }
  } catch(e){}
}

// Sonido de acierto/error: uno al azar de la lista correspondiente, una sola
// vez por pregunta (showReveal ya está protegido para llamarse una vez).
// Mantiene la vibración de siempre y solo cambia el audio.
function playOutcomeSound(ok){
  OutcomeFx.play(ok);
  try { navigator.vibrate && navigator.vibrate(ok ? [50,30,50,30,120] : [200]); } catch(e){}
}

function renderBoardIfVisible(){
  if (!S.room) return;
  if (S.room.status === "board") showBoard();
  else if (S.room.status === "podium") showPodium();
}

// Entra al marcador: primero carga cuántos puntos sumó cada quien en la
// pregunta, y recién ahí anima las barras/números creciendo.
async function enterBoard(){
  await loadBoardDeltas();
  showBoard();
}

let lastWinnerKey = null;
let boardDeltas = {};      // { playerId: puntosGanadosEnEstaPregunta }
let boardAnimQ = null;     // índice de pregunta ya animado (para no repetir)

// Trae cuántos puntos sumó cada jugador en la pregunta actual, leyendo la
// tabla de respuestas (cada fila guarda "points"). Con eso mostramos el "+X"
// y animamos la barra creciendo desde el puntaje anterior.
async function loadBoardDeltas(){
  boardDeltas = {};
  if (S.solo || !S.room) return;
  try {
    const { data } = await sb.from("answers").select("player_id,points")
      .eq("room_id", S.room.id).eq("q_index", S.room.current_q);
    (data || []).forEach(a => { boardDeltas[a.player_id] = (boardDeltas[a.player_id] || 0) + (a.points || 0); });
  } catch(e){ boardDeltas = {}; }
}

function showBoard(){
  const list = $("#boardList");
  const sorted = [...S.players].sort((a,b) => b.score - a.score);
  const top = Math.max(1, sorted[0] ? sorted[0].score : 1);
  const firstTime = boardAnimQ !== S.room.current_q;

  // Medir posiciones actuales de las filas existentes (para animación FLIP:
  // así las filas se DESLIZAN suavemente a su nuevo lugar cuando alguien
  // adelanta a otro, en vez de saltar de golpe).
  const prevRects = {};
  $$("#boardList .brow").forEach(el => { prevRects[el.dataset.pid] = el.getBoundingClientRect().top; });

  // Reconstruir/mantener filas
  const seen = {};
  sorted.forEach((p, i) => {
    let d = list.querySelector(`.brow[data-pid="${cssEsc(p.id)}"]`);
    const delta = boardDeltas[p.id] || 0;
    if (!d){
      d = document.createElement("div");
      d.className = "brow" + (p.id === S.me?.id ? " me" : "");
      d.dataset.pid = p.id;
      d.innerHTML = `
        <span class="pos"></span>
        <span class="em">${p.avatar}</span>
        <div class="brow-main">
          <div class="brow-top"><span class="nm"></span><span class="delta"></span></div>
          <div class="brow-bar"><div class="brow-fill"></div></div>
        </div>
        <span class="pts"><span class="pts-num">0</span> pts</span>`;
      list.appendChild(d);
      d._shownScore = firstTime ? Math.max(0, p.score - delta) : p.score;
    }
    seen[p.id] = true;
    d.style.order = i; // el reordenamiento visual lo hace flexbox con "order"
    d.classList.remove("r0","r1","r2"); if (i < 3) d.classList.add("r" + i);
    d.querySelector(".pos").textContent = i===0 ? "🥇" : i===1 ? "🥈" : i===2 ? "🥉" : (i+1)+"º";
    d.querySelector(".nm").innerHTML = `${esc(p.name)}${p.connected?"":" 💤"}`;
    d.classList.toggle("leader", i === 0);

    const deltaEl = d.querySelector(".delta");
    if (firstTime && delta > 0){
      deltaEl.textContent = `+${delta}`;
      deltaEl.classList.remove("hidden");
      deltaEl.classList.remove("pop"); void deltaEl.offsetWidth; deltaEl.classList.add("pop");
    } else {
      deltaEl.classList.add("hidden");
    }
  });

  // Sacar filas de jugadores que ya no están
  $$("#boardList .brow").forEach(el => { if (!seen[el.dataset.pid]) el.remove(); });

  // FLIP: animar el desplazamiento desde la posición anterior a la nueva
  requestAnimationFrame(() => {
    $$("#boardList .brow").forEach(el => {
      const prevTop = prevRects[el.dataset.pid];
      if (prevTop == null) return;
      const dy = prevTop - el.getBoundingClientRect().top;
      if (Math.abs(dy) < 1) return;
      el.style.transition = "none";
      el.style.transform = `translateY(${dy}px)`;
      requestAnimationFrame(() => {
        el.style.transition = "transform .7s cubic-bezier(.34,1.2,.5,1)";
        el.style.transform = "";
      });
    });
  });

  // Animar barras + números subiendo
  if (firstTime){
    boardAnimQ = S.room.current_q;
    $$("#boardList .brow").forEach(el => {
      const p = S.players.find(x => x.id === el.dataset.pid);
      if (!p) return;
      const from = el._shownScore ?? p.score;
      animateCount(el.querySelector(".pts-num"), from, p.score, 900);
      const fill = el.querySelector(".brow-fill");
      const startPct = Math.max(0, Math.min(100, (from / top) * 100));
      const endPct   = Math.max(0, Math.min(100, (p.score / top) * 100));
      fill.style.transition = "none"; fill.style.width = startPct + "%";
      requestAnimationFrame(() => {
        fill.style.transition = "width .9s cubic-bezier(.34,1.1,.5,1)";
        fill.style.width = endPct + "%";
      });
      el._shownScore = p.score;
    });
    // Chispas para quien haya sumado algo
    setTimeout(() => {
      sorted.forEach((p, i) => {
        if ((boardDeltas[p.id]||0) > 0 && i < 3){
          const el = list.querySelector(`.brow[data-pid="${cssEsc(p.id)}"]`);
          if (el){ const r = el.getBoundingClientRect();
            try { Fun.floatUp(i===0?"⭐":"✨", r.right-30, r.top+r.height/2, 4); } catch(e){} }
        }
      });
    }, 500);
  } else {
    // Re-render sin animar (llega otra actualización mientras ya se ve el board)
    $$("#boardList .brow").forEach(el => {
      const p = S.players.find(x => x.id === el.dataset.pid);
      if (!p) return;
      el.querySelector(".pts-num").textContent = p.score;
      el.querySelector(".brow-fill").style.width = Math.max(0, Math.min(100,(p.score/top)*100)) + "%";
    });
  }

  renderWinnerButtons();
  Sfx.board();
  show("board");
}

// Escapa un id para usarlo dentro de un selector [data-pid="..."]
function cssEsc(v){ return String(v).replace(/["\\]/g, "\\$&"); }

// Cuenta ascendente animada de un número (from → to) en "ms" milisegundos.
function animateCount(node, from, to, ms){
  if (!node) return;
  from = Math.round(from); to = Math.round(to);
  if (from === to){ node.textContent = to; return; }
  const t0 = performance.now();
  const step = (now) => {
    const p = Math.min(1, (now - t0) / ms);
    const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
    node.textContent = Math.round(from + (to - from) * eased);
    if (p < 1) requestAnimationFrame(step);
    else node.textContent = to;
  };
  requestAnimationFrame(step);
}

// ---------- Botones ganadores (solo quien acertó primero puede tocar uno) ----------
function renderWinnerButtons(){
  const panel = $("#winnerButtons");
  if (!panel) return;
  const rw = !S.solo ? S.room?.round_winner : null;
  if (!rw){ panel.classList.add("hidden"); return; }
  panel.classList.remove("hidden");

  const winner = S.players.find(p => p.id === rw.playerId);
  const iAmWinner = S.me && rw.playerId === S.me.id;
  const already = rw.playedIdx !== null && rw.playedIdx !== undefined;

  $("#winnerCaption").textContent = already
    ? `🔊 ${winner ? winner.name : "Alguien"} sonó: ${WINNER_SOUNDS[rw.soundIdx[rw.playedIdx]].label}`
    : (iAmWinner ? "🏆 ¡Ganaste la ronda! Elige un sonido:" : `🏆 ${winner ? winner.name : "El ganador"} está eligiendo un sonido…`);

  const wrap = $("#winnerBtnsRow"); wrap.innerHTML = "";
  rw.soundIdx.forEach((sIdx, i) => {
    const s = WINNER_SOUNDS[sIdx];
    const btn = document.createElement("button");
    btn.className = "winner-btn" + (already && rw.playedIdx === i ? " picked" : "") + (already && rw.playedIdx !== i ? " dim" : "");
    btn.style.background = `radial-gradient(circle at 35% 30%, ${lighten(rw.colors[i])}, ${rw.colors[i]})`;
    btn.disabled = !iAmWinner || already;
    btn.innerHTML = `<span class="wb-dot"></span>`;
    btn.onclick = () => pressWinnerButton(i);
    const cap = document.createElement("p");
    cap.className = "winner-btn-label";
    cap.textContent = s.label;
    const cell = document.createElement("div");
    cell.className = "winner-btn-cell";
    cell.appendChild(btn); cell.appendChild(cap);
    wrap.appendChild(cell);
  });

  // Reproducir el sonido UNA sola vez por ronda, en TODOS los celulares, cuando
  // el ganador presiona un botón (evita repetir el sonido en cada re-render).
  const key = `${S.room.current_q}:${rw.playedIdx}`;
  if (already && key !== lastWinnerKey){
    lastWinnerKey = key;
    WinnerFx.play(rw.soundIdx[rw.playedIdx]);
  }
}
function lighten(hex){
  const n = parseInt(hex.slice(1),16);
  const r = Math.min(255,(n>>16)+60), g = Math.min(255,((n>>8)&255)+60), b = Math.min(255,(n&255)+60);
  return `#${((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1)}`;
}
async function pressWinnerButton(i){
  const rw = S.room?.round_winner;
  if (!rw || S.solo || !S.me || rw.playerId !== S.me.id) return;
  if (rw.playedIdx !== null && rw.playedIdx !== undefined) return;
  Sfx.click();
  const round_winner = { ...rw, playedIdx: i };
  await sb.from("rooms").update({ round_winner }).eq("id", S.room.id);
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
    try { if (typeof Fun !== "undefined"){ Fun.confetti(120); Fun.burst(["🎉","🏆","🥳","👑","🎊","⭐"], 18); } } catch(e){}
  }
  stopHostLoop();
  // Mostrar/ocultar el botón "otra ronda" según seas anfitrión
  const again = $("#btnPlayAgain");
  if (again) again.classList.toggle("hidden", !amHost() || S.solo);
  const waitHint = $("#podiumWaitHint");
  if (waitHint) waitHint.classList.toggle("hidden", amHost() || S.solo);
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
  const settings = { ...S.room.settings, qids: [], soundGen: ((S.room.settings.soundGen || 0) + 1) };
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

// ---------- MÚSICA DE FONDO ----------
$("#chkMusicSync").onchange = async (e) => {
  if (!S.room || S.solo) return;
  Sfx.click();
  await Music.hostSetSync(e.target.checked, S.room, sb);
};

// Interruptor de sonidos del juego (efectos), separado de la música.
function refreshSfxToggle(){
  const b = $("#sfxToggle");
  if (b) b.textContent = Sfx.isEnabled() ? "🎮 Sonidos del juego: activados" : "🔇 Sonidos del juego: apagados";
}
$("#sfxToggle") && ($("#sfxToggle").onclick = () => {
  Sfx.setEnabled(!Sfx.isEnabled());
  if (Sfx.isEnabled()) Sfx.click();
  refreshSfxToggle();
});
refreshSfxToggle();

// Control remoto de la TV/Roku: cada botón escribe settings.tvCmd en la sala;
// el Roku lo lee y ejecuta la tecla (navegar menús, escribir, pausar).
document.querySelectorAll("#tvRemote .rk").forEach(b => {
  b.onclick = async () => {
    if (!S.room) return;
    Sfx.click();
    try {
      const settings = { ...S.room.settings, tvCmd: { key: b.dataset.k, t: Date.now() } };
      await sb.from("rooms").update({ settings }).eq("id", S.room.id);
    } catch(e){}
  };
});

$("#musicFab").onclick = () => { $("#musicPanel").classList.remove("hidden"); };
$("#musicClose").onclick = closeMusicPanel;
function closeMusicPanel(){ $("#musicPanel")?.classList.add("hidden"); }

// Si está sincronizado, solo el anfitrión puede saltar de canción o mover
// la barra (y se avisa a todos los conectados); si no, cada uno manda en
// su propio celular sin afectar a nadie más.
function canControlMusic(){ return !Music.state().synced || amHost(); }

$("#musicPrev").onclick = () => {
  const s = Music.state();
  if (s.synced && amHost()) Music.hostChangeTrack(S.room, sb);
  else Music.prev();
};
$("#musicNext").onclick = () => {
  const s = Music.state();
  if (s.synced && amHost()) Music.hostChangeTrack(S.room, sb);
  else Music.next();
};
$("#musicPlayPause").onclick = () => Music.togglePlay();
$("#musicMute").onclick = () => Music.toggleMute();
$("#musicVol").oninput = (e) => Music.setVolume(+e.target.value / 100);

Music.bindUI(() => {
  const s = Music.state();
  $("#musicTrackName").textContent = s.track ? s.track.name : "—";
  $("#musicPlayPause").textContent = s.playing ? "⏸" : "▶️";
  $("#musicMute").textContent = s.muted ? "🔇" : "🔊";
  $("#musicVol").value = Math.round(s.volume * 100);
  const canControl = canControlMusic();
  $("#musicPrev").disabled = !canControl; $("#musicNext").disabled = !canControl;
  $("#musicProgressTrack")?.classList.toggle("locked", !canControl);
  $("#musicSyncNote").classList.toggle("hidden", !s.synced);
  $("#musicEq")?.classList.toggle("on", s.playing && !s.muted);
  const disc = $("#musicDisc");
  if (disc){
    disc.classList.toggle("spin", s.playing && !s.muted);
    disc.classList.toggle("has-image", !!s.image);
    disc.style.backgroundImage = s.image ? `url("${s.image}")` : "";
    const center = disc.querySelector(".music-disc-center");
    if (center) center.textContent = s.image ? "" : "🎵";
  }
  const bg = $("#musicBg");
  if (bg){
    bg.style.backgroundImage = s.image ? `url("${s.image}")` : "";
    bg.classList.toggle("show", !!s.image);
  }
  $("#musicError")?.classList.toggle("hidden", !s.hasError);
});

// Barra de progreso: se actualiza sola cada segundo mientras el panel de
// música esté abierto (no vale la pena gastar ciclos si está cerrado), y
// se puede arrastrar para adelantar o retroceder la canción.
function fmtTime(sec){
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec/60), s = Math.floor(sec%60);
  return `${m}:${String(s).padStart(2,"0")}`;
}
let draggingProgress = false;
setInterval(() => {
  if ($("#musicPanel").classList.contains("hidden") || draggingProgress) return;
  const s = Music.state();
  const pct = s.duration ? Math.min(100, (s.currentTime/s.duration)*100) : 0;
  $("#musicProgressFill").style.width = pct + "%";
  $("#musicTimeCur").textContent = fmtTime(s.currentTime);
  $("#musicTimeDur").textContent = fmtTime(s.duration || (s.track?.duration||0));
}, 1000);

(() => {
  const track = $("#musicProgressTrack");
  if (!track) return;
  function pctFromEvent(e){
    const r = track.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    return Math.max(0, Math.min(1, x / r.width));
  }
  function seekFromEvent(e){
    const s = Music.state();
    const dur = s.duration || s.track?.duration || 0;
    if (!dur) return;
    const pct = pctFromEvent(e);
    $("#musicProgressFill").style.width = (pct*100) + "%";
    $("#musicTimeCur").textContent = fmtTime(pct*dur);
    return pct * dur;
  }
  function onDown(e){
    if (!canControlMusic()) return;
    draggingProgress = true;
    track.classList.add("dragging");
    seekFromEvent(e);
    e.preventDefault();
  }
  function onMove(e){ if (draggingProgress) seekFromEvent(e); }
  function onUp(e){
    if (!draggingProgress) return;
    draggingProgress = false;
    track.classList.remove("dragging");
    const seconds = seekFromEvent(e);
    if (seconds == null) return;
    const s = Music.state();
    if (s.synced && amHost()) Music.hostSeek(seconds, S.room, sb);
    else Music.seekTo(seconds);
  }
  track.addEventListener("pointerdown", onDown);
  track.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  track.addEventListener("touchstart", onDown, { passive:false });
  track.addEventListener("touchmove", onMove, { passive:false });
  window.addEventListener("touchend", onUp);
})();

// ---------- CHAT ----------
$("#chatFab").onclick = () => { $("#chatPanel").classList.remove("hidden"); S.unread = 0; badge(); };
$("#chatClose").onclick = closeChat;
function closeChat(){ $("#chatPanel").classList.add("hidden"); $("#stickerTray").classList.add("hidden"); $("#gifTray").classList.add("hidden"); }
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
  $("#gifTray").classList.add("hidden");
  t.classList.toggle("hidden");
};

// ---------- GIFs de internet (búsqueda GIPHY) ----------
// Solo se aceptan URLs de los CDN oficiales de GIPHY/Tenor al mostrar,
// para que nadie pueda inyectar imágenes de otros sitios en el chat.
const SAFE_GIF = /^https:\/\/(media\d?\.giphy\.com|i\.giphy\.com|media\.tenor\.com|c\.tenor\.com)\//;
$("#btnGifs").onclick = () => {
  $("#stickerTray").classList.add("hidden");
  $("#gifTray").classList.toggle("hidden");
  if (!$("#gifTray").classList.contains("hidden")) $("#gifQuery").focus();
};
$("#gifGo").onclick = searchGifs;
$("#gifQuery").addEventListener("keydown", e => { if (e.key === "Enter") searchGifs(); });
async function searchGifs(){
  const q = $("#gifQuery").value.trim();
  const box = $("#gifResults");
  if (!q){ box.innerHTML = '<p class="gif-hint">Escribe algo y toca la lupa 🎬</p>'; return; }
  box.innerHTML = '<p class="gif-hint">Buscando GIFs… 🔎</p>';
  try {
    const r = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(q)}&limit=24&rating=pg-13&lang=es`);
    const j = await r.json();
    if (!j.data || !j.data.length){
      box.innerHTML = '<p class="gif-hint">Sin resultados 😅 Prueba con otra palabra</p>'; return;
    }
    box.innerHTML = "";
    j.data.forEach(g => {
      const url = g.images && g.images.fixed_width && g.images.fixed_width.url;
      if (!url || !SAFE_GIF.test(url)) return;
      const img = document.createElement("img");
      img.src = url; img.loading = "lazy"; img.alt = g.title || "GIF";
      img.onclick = () => {
        sendMsg(null, "gif:" + url);
        $("#gifTray").classList.add("hidden");
      };
      box.appendChild(img);
    });
  } catch (e) {
    box.innerHTML = '<p class="gif-hint">⚠️ No se pudo buscar. Revisa tu internet o la llave GIPHY_KEY en js/config.js</p>';
  }
}
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
    let inner;
    if (m.sticker && m.sticker.startsWith("gif:")){
      const u = m.sticker.slice(4);
      inner = SAFE_GIF.test(u)
        ? `<img class="gif-msg" src="${esc(u)}" loading="lazy" alt="GIF">`
        : `<div>🎬 GIF</div>`;
    } else if (m.sticker) inner = `<div class="stick">${m.sticker}</div>`;
    else inner = `<div>${text}</div>`;
    d.innerHTML = `<div class="who">${m.avatar} ${esc(m.player_name)}
      ${m.player_id !== S.me.id ? `<button data-block="${m.player_id}">🚫</button>` : ""}</div>
      ${inner}`;
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
  keepAwake();
  S.me = { id:"solo", name, avatar:ava, score:0, connected:true };
  S.players = [S.me];
  Music.enterGame();
  let solCat = "disney";   // Disney marcada por defecto, igual que en multijugador
  const catBtns = CATEGORIES.map(c =>
    `<button type="button" class="cat${c.id===solCat?" sel":""}" data-cat="${c.id}"><span class="ce">${c.emoji}</span>${c.name}</button>`).join("");
  modal(`<h3>🧠 Trivia-Quiz</h3><p>Trivia en solitario: elige categoría y cuántas preguntas. ¡Incluye 2 mini-juegos sorpresa al azar en el camino! 🎁</p>
  <label class="lbl">Categoría</label>
  <div id="soloCatGrid" class="cat-grid solo-cat-grid">${catBtns}</div>
  <label class="lbl">Preguntas</label>
  <select id="soloN" class="inp"><option>10</option><option>20</option><option>30</option></select>
  <label class="lbl">Tiempo por pregunta</label>
  <select id="soloT" class="inp">
    <option value="15">15 segundos</option>
    <option value="20" selected>20 segundos</option>
    <option value="25">25 segundos</option>
    <option value="40">40 segundos</option>
  </select>`, [
    { t:"¡Jugar! 🚀", cls:"btn-green", fn: async () => {
        const cat = solCat, n = +$("#soloN").value, qtime = +$("#soloT").value || 20;
        const bank = await loadBank(cat);
        const qids = shuffle([...bank.questions.keys()]).slice(0, Math.min(n, bank.questions.length));
        S.soloState = { cat, i:0, qids, qtime, miniSchedule: buildSoloMiniSchedule(qids.length) };
        S.room = { status:"countdown", settings:{ cat, qids, filter:"off", qtime }, current_q:-1, q_started_at:null };
        Music.setGamePhase("countdown");
        runCountdown();
        setTimeout(() => soloQuestion(0), 3800);
    }},
    { t:"Volver", fn: () => { S.solo = false; show("solo-menu"); } },
  ]);
  // Grilla de categorías tipo multijugador (marcar la elegida)
  $$("#soloCatGrid .cat").forEach(b => b.onclick = () => {
    solCat = b.dataset.cat; Sfx.pick();
    $$("#soloCatGrid .cat").forEach(x => x.classList.toggle("sel", x === b));
  });
}
// 2 mini-juegos al azar, en 2 momentos distintos de la partida
function buildSoloMiniSchedule(n){
  const SOLO_MINIS = ["flash","color","memoria","punteria","reaccion","ritmo","preg"];
  const slots = shuffle(Array.from({ length: Math.max(0, n - 2) }, (_, i) => i + 1)).slice(0, 2);
  const kinds = shuffle([...SOLO_MINIS]).slice(0, 2);
  return slots.map((at, idx) => ({ kind: kinds[idx], at, done:false }));
}
function soloQuestion(i){
  S.soloState.i = i;
  S.room.current_q = i;
  S.room.q_started_at = new Date().toISOString();
  S.room.status = "question";
  showQuestion();
  S.soloTimeout = setTimeout(() => soloFinish(null), qTime()*1000 + 400);
}
async function soloAnswer(idx, q){
  clearTimeout(S.soloTimeout);
  soloFinish({ idx, q });
}
async function soloFinish(ans){
  clearInterval(S.qTimer);
  const bank = await loadBank(S.soloState.cat);
  const q = bank.questions[S.soloState.qids[S.soloState.i]];
  let pts = 0, ok = false, answered = !!ans;
  if (ans && ans.idx === q.c){ ok = true; pts = 60 + Math.floor(S.qLeft/2); S.me.score += pts; }
  else if (answered){ pts = 15; S.me.score += pts; }
  $("#revealIcon").textContent = ok ? "🎉" : ans ? "😵" : "⏰";
  $("#revealText").textContent = `Respuesta correcta: ${q.o[q.c]}`;
  $("#revealYou").textContent = ok ? `¡Correcto! +${pts} puntos · Total: ${S.me.score}` : ans ? `Incorrecto 😬 (+${pts} de participación)` : "Se acabó el tiempo";
  playOutcomeSound(ok);
  show("reveal");
  setTimeout(() => {
    const last = S.soloState.i >= S.soloState.qids.length - 1;
    const sched = S.soloState.miniSchedule || [];
    const pending = sched.find(m => !m.done && m.at === S.soloState.i);
    if (pending){
      pending.done = true;
      soloRunMiniGame(pending.kind, () => {
        if (last){ S.players = [S.me]; showPodiumSolo(); }
        else soloQuestion(S.soloState.i + 1);
      });
    } else if (last){ S.players = [S.me]; showPodiumSolo(); }
    else soloQuestion(S.soloState.i + 1);
  }, REVEAL_TIME*1000);
}
function showPodiumSolo(){
  Music.setGamePhase("podium");
  $("#pod1a").textContent = S.me.avatar;
  $("#pod1n").textContent = `${S.me.name} · ${S.me.score}`;
  $("#pod2a").textContent = ""; $("#pod2n").textContent = "";
  $("#pod3a").textContent = ""; $("#pod3n").textContent = "";
  $("#podiumRest").innerHTML = "";
  show("podium"); Sfx.fanfare(); fireworks(6000);
}
function endSoloToHome(){ S.solo = false; S.room = null; S.soloState = null; releaseWake(); show("home"); }

// ============================================================
// Mini-juegos en la sala de prueba ZZZX: reutiliza EXACTAMENTE las mismas
// pantallas y lógica que en multijugador (buildX/showMiniIntro/startMiniPlay/
// showMiniResult), pero con un reloj local (setTimeout) en vez del watchdog
// de Supabase, y sin comparar contra otros jugadores (solo hay uno).
// Delator no se ofrece aquí porque necesita votar a otros jugadores reales.
// ============================================================
async function soloRunMiniGame(kind, onDone){
  let finished = false;
  const finish = () => { if (finished) return; finished = true; try { onDone(); } catch(e){ console.error("onDone falló:", e); } };

  try {
    S.soloMiniResult = null;
    let data;
    if (kind === "flash") data = buildFlash();
    else if (kind === "color") data = buildColor();
    else if (kind === "memoria") data = buildMemoria();
    else if (kind === "punteria") data = buildPunteria();
    else if (kind === "reaccion") data = buildReaccion();
    else if (kind === "ritmo") data = buildRitmo();
    else if (kind === "preg") data = await buildPreg();
    else if (kind === "vf") data = buildVf();
    else if (kind === "bomba") data = buildBomba();
    if (!data){ finish(); return; }

    const introMs = 5000;
    S.room.status = "mini";
    S.room.mini_state = { kind, phase:"intro", round:0, data, until: Date.now()+introMs };
    handleMiniState();

    setTimeout(() => {
      try {
        const playMs = miniPlayMs(kind);
        S.room.mini_state = { ...S.room.mini_state, phase:"play", until: Date.now()+playMs };
        handleMiniState();

        setTimeout(() => {
          try {
            const table = RANK_MINIS[kind];
            const r = S.soloMiniResult || {};
            let pts = 0;
            if (table) pts = r.ok ? table[0] : (("ok" in r) ? 10 : 0);
            else pts = r.score || 0;
            S.me.score += pts;
            S.room.mini_state = { ...S.room.mini_state, phase:"result", until: Date.now()+6000, results:{ [S.me.id]: pts } };
            handleMiniState();
            setTimeout(finish, 6000);
          } catch(e){ console.error("Mini-juego solo (resultado) falló:", kind, e); finish(); }
        }, playMs + 400); // margen para que el reloj interno de cada mini alcance a registrar el resultado
      } catch(e){ console.error("Mini-juego solo (jugar) falló:", kind, e); finish(); }
    }, introMs);
  } catch(e){
    // Red de seguridad: si CUALQUIER cosa falla al armar el mini-juego
    // (ej. no cargó el banco de Preguntón), jamás nos quedamos pegados
    // esperando para siempre — se salta y sigue el quiz.
    console.error("Mini-juego solo falló al armarse:", kind, e);
    finish();
  }
}

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
  vf:      { emoji:"⚡", title:"Verdadero o Falso", desc:"Aparecen afirmaciones. Toca ✅ o ❌ lo más rápido y acertado que puedas." },
  bomba:   { emoji:"💣", title:"Palabra Bomba", desc:"Escribe palabras de la categoría… ¡antes de que explote la bomba! 💥" },
};

// Mini-juegos cuyo puntaje se reparte por ORDEN DE LLEGADA (1°=100, 2°=90…)
// en vez de sumar el score crudo que guardó cada jugador.
// Tablas largas: hay premio decreciente para TODOS los que terminan (no solo el podio)
const RANK_MINIS = {
  memoria:[60,52,46,41,37,34,31,29,27,25,23,21,20,19,18],
  preg:[60,52,46,41,37,34,31,29,27,25,23,21,20,19,18],
  reaccion:[60,52,46,41,37,34,31,29,27,25,23,21,20,19,18],
};

// ---------- El anfitrión arma el mini-juego ----------
// ============================================================
// MINI-JUEGOS SUELTOS (individuales, sin sala ni internet)
// Reusa los constructores y renders de los minis del multijugador en un
// envoltorio local: arma el mini, lo corre y al terminar muestra el
// puntaje con opción de repetir. No toca la base de datos.
// ============================================================
const SOLO_MINIS = ["flash","color","memoria","punteria","reaccion","ritmo","preg","vf","bomba"];
const SOLO_MINI_NAMES = { flash:"NúmeroFlash 🔢", color:"Colorín 🎨", memoria:"Memoria 🧠",
  punteria:"Puntería 🎯", reaccion:"Reacción ⚡", ritmo:"Ritmo 🎵", preg:"Preguntón 💡",
  vf:"Verdadero o Falso ⚡", bomba:"Palabra Bomba 💣" };
const SOLO_MINI_STREAK = 5; // cuántos mini-juegos seguidos antes de preguntar si sigue
let soloMiniActive = null;

// Arranca (o continúa) una tanda de mini-juegos sueltos. Se llama una vez
// desde el menú; a partir de ahí, cada mini termina y encadena solo el
// siguiente hasta completar la tanda de 5, sin preguntar nada entre medio.
async function startSoloMinis(){
  S.solo = true; S.soloMini = true;
  if (!S.me) S.me = { id:"solo", name:"Tú", avatar:"😎", score:0, connected:true };
  S.soloMiniRound = 0;
  S.soloMiniTotal = 0;
  soloMiniAdvance();
}

async function soloMiniAdvance(){
  S.soloMiniRound++;
  const pick = SOLO_MINIS[Math.floor(Math.random()*SOLO_MINIS.length)];
  soloMiniActive = pick;
  Music.enterGame();
  let data;
  try {
    if (pick === "flash") data = buildFlash();
    else if (pick === "color") data = buildColor();
    else if (pick === "memoria") data = buildMemoria();
    else if (pick === "punteria") data = buildPunteria();
    else if (pick === "reaccion") data = buildReaccion();
    else if (pick === "ritmo") data = buildRitmo();
    else if (pick === "preg") data = await buildPreg();
    else if (pick === "vf") data = buildVf();
    else if (pick === "bomba") data = buildBomba();
  } catch(e){ data = null; }
  if (!data){
    toast("No se pudo cargar el mini-juego");
    S.soloMini = false; S.solo = false; S.room = null;
    return show("solo-menu");
  }
  const until = Date.now() + (pick === "punteria" || pick === "reaccion" ? 20000 : 35000);
  const m = { kind:pick, phase:"play", round:0, data, until };
  S.room = { status:"mini", mini_state:m, settings:{ filter:"off" }, current_q:0 };
  startMiniPlay(m);
}

// Llamado por los minis cuando terminan, SOLO en modo mini-suelto. Encadena
// el siguiente automáticamente hasta llegar a los 5; ahí recién pregunta.
function soloMiniFinish(score){
  if (!S.soloMini) return false;
  clearInterval(S.miniPlayIv);
  S.soloMiniTotal += (score|0);
  const isLast = S.soloMiniRound >= SOLO_MINI_STREAK;
  const card = document.createElement("div");
  card.className = "cruci-win";
  card.innerHTML = `
    <div class="cw-box">
      <div class="cw-emoji">${isLast ? "🏁" : "🎉"}</div>
      <p class="cw-label">${SOLO_MINI_NAMES[soloMiniActive] || "Mini-juego"} · ${S.soloMiniRound}/${SOLO_MINI_STREAK}</p>
      <div class="cw-key"><span>${score|0}</span></div>
      <p class="cw-msg">puntos${isLast ? ` · ${S.soloMiniTotal} en total` : ""}</p>
    </div>`;
  document.body.appendChild(card);
  try { if (typeof Fun !== "undefined") Fun.confetti(isLast ? 90 : 40); } catch(e){}
  if (isLast){
    // Recién acá se pregunta si sigue, después de los 5 seguidos.
    const btns = document.createElement("div");
    btns.className = "cw-btns";
    btns.innerHTML = `<button class="btn big btn-green" id="smAgain">Jugar 5 más 🎲</button>
      <button class="btn ghost" id="smExit">Salir al menú</button>`;
    card.querySelector(".cw-box").appendChild(btns);
    card.querySelector("#smAgain").onclick = () => { card.remove(); startSoloMinis(); };
    card.querySelector("#smExit").onclick = () => { card.remove(); S.soloMini = false; S.solo = false; S.room = null; show("solo-menu"); };
  } else {
    // Sigue solo a la siguiente ronda tras un respiro breve.
    setTimeout(() => { card.remove(); soloMiniAdvance(); }, 1400);
  }
  return true;
}

async function startMiniGame(entry){
  if (!amHost()) return;
  const kind = entry.kind;
  // Marcar este mini-juego (y solo este) como usado para que no se repita
  const miniSchedule = (S.room.settings.miniSchedule || []).map(m =>
    (m.kind === entry.kind && m.at === entry.at) ? { ...m, done:true } : m
  );
  const settings = { ...S.room.settings, miniSchedule };
  let mini = { kind, phase:"intro", round:0 };

  try {
    if (kind === "flash") mini.data = buildFlash();
    if (kind === "color") mini.data = buildColor();
    if (kind === "memoria") mini.data = buildMemoria();
    if (kind === "punteria") mini.data = buildPunteria();
    if (kind === "reaccion") mini.data = buildReaccion();
    if (kind === "ritmo") mini.data = buildRitmo();
    if (kind === "preg") mini.data = await buildPreg();
    if (kind === "vf") mini.data = buildVf();
    if (kind === "bomba") mini.data = buildBomba();
    if (kind === "delator"){
      mini.data = buildDelator();
      mini.phase = "names";        // fase extra: pedir nombre real
      mini.dround = 0;             // ronda de delator actual
    }
    if (!mini.data) throw new Error("mini sin datos");

    const introMs = (kind === "delator") ? 20000 : 5000; // delator: 20s para escribir nombre real
    mini.until = Date.now() + introMs;
    await sb.from("mini_scores").delete().eq("room_id", S.room.id).eq("kind", kind);
    await sb.from("rooms").update({ settings, mini_state: mini, status:"mini", phase_until: Date.now()+introMs }).eq("id", S.room.id);
  } catch(e){
    // Si algo falla al armar el mini-juego (ej. no cargó el banco de
    // Preguntón), NUNCA nos quedamos pegados reintentando para siempre:
    // se salta el mini-juego (queda marcado como hecho) y sigue el quiz.
    console.error("Mini-juego falló, se salta:", kind, e);
    const last = S.room.current_q >= S.room.settings.qids.length - 1;
    await sb.from("rooms").update({ settings }).eq("id", S.room.id);
    if (last){ await saveGameHistory(); await sb.from("rooms").update({ status:"podium" }).eq("id", S.room.id); }
    else await nextQuestion(S.room.current_q + 1);
  }
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
  const seq = Array.from({length:9}, () => Math.floor(Math.random()*4)); // colores 0..3, 9 niveles (antes 12, imposible de completar)
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
  if (kind === "ritmo") return 42000;      // secuencia que crece (9 niveles, ahora sí alcanza)
  if (kind === "preg") return 25000;       // completar la palabra con pistas
  if (kind === "vf") return 26000;         // 8 afirmaciones a buen ritmo
  if (kind === "bomba") return 22000;      // escribir palabras antes de que explote
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
  const MINI_TRY_PTS = 15; // participación: lo intentó pero no acertó a tiempo
  if (table){
    // Reparto por ORDEN DE LLEGADA con tabla larga: TODOS los que terminan
    // reciben premio decreciente; quienes lo intentaron, participación.
    const rows = scores || [];
    const finishers = rows.filter(s => s.payload && s.payload.ok).sort((a,b) => (a.payload.t||0) - (b.payload.t||0));
    finishers.forEach((s, idx) => {
      byPlayer[s.player_id] = (byPlayer[s.player_id]||0) + (table[Math.min(idx, table.length-1)]);
    });
    rows.filter(s => s.payload && !s.payload.ok).forEach(s => {
      byPlayer[s.player_id] = (byPlayer[s.player_id]||0) + MINI_TRY_PTS;
    });
  } else {
    // Puntaje NORMALIZADO (flash, colorín, ritmo, puntería, V/F, bomba…):
    // antes se sumaba el score crudo y el primero podía sacar 200+ mientras
    // el resto quedaba a años luz. Ahora el mejor marca 60 y los demás
    // reciben proporcional entre 15 y 60 — todos avanzan, el orden se respeta.
    const raw = {};
    (scores || []).forEach(s => { raw[s.player_id] = (raw[s.player_id]||0) + (s.score||0); });
    const best = Math.max(0, ...Object.values(raw));
    Object.entries(raw).forEach(([pid, v]) => {
      byPlayer[pid] = best > 0 ? Math.round(15 + 45 * (v / best)) : 15;
    });
    const PLACE_BONUS = [12, 8, 5]; // oro/plata/bronce (chico: premia sin disparar la brecha)
    Object.entries(raw).sort((a,b) => b[1] - a[1]).forEach(([pid], idx) => {
      if (idx < PLACE_BONUS.length && raw[pid] > 0) byPlayer[pid] += PLACE_BONUS[idx];
    });
  }

  // Piso de participación: TODOS los conectados reciben puntos, aunque no
  // hayan alcanzado a enviar su resultado.
  const FLOOR = 15;
  S.players.filter(p => p.connected).forEach(p => { if (!(byPlayer[p.id] > 0)) byPlayer[p.id] = FLOOR; });

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

let miniLastPhase = null, miniLastKind = null, miniLastRound = -1;
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
  vfSubmitted = false; bombaSubmitted = false;
  if (m.kind === "flash") flashStart(m);
  if (m.kind === "color") colorStart(m);
  if (m.kind === "memoria") memoriaStart(m);
  if (m.kind === "punteria") punteriaStart(m);
  if (m.kind === "reaccion") reaccionStart(m);
  if (m.kind === "ritmo") ritmoStart(m);
  if (m.kind === "preg") pregStart(m);
  if (m.kind === "vf") vfStart(m);
  if (m.kind === "bomba") bombaStart(m);
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
    // Rescate: si el timer de "ocultar y pasar a responder" murió, forzarlo
    if (!S.memoDone && !S.memoT0 && S.memoShownAt && Date.now() - S.memoShownAt > 3600)
      memoriaInputPhase(m);
    if (left <= 0) memoriaOnTimeUp(m);
  } else if (m.kind === "punteria"){
    const left = Math.max(0, Math.ceil(((m.until||0)-Date.now())/1000));
    const el = $("#puntTimer"); if (el) el.textContent = left;
    if (left <= 0) punteriaOnTimeUp(m);
  } else if (m.kind === "reaccion"){
    const left = Math.max(0, Math.ceil(((m.until||0)-Date.now())/1000));
    const el = $("#reacTimer"); if (el) el.textContent = left;
    // Rescate: si el timer del "verde" murió, ponerlo verde igual
    if (!S.reacDone && !S.reacReady && S.reacWaitUntil && Date.now() > S.reacWaitUntil + 900){
      S.reacReady = true; S.reacShownAt = Date.now(); S.reacWaitUntil = 0;
      const pad = $("#reacPad"); if (pad) pad.className = "reac-pad go";
      const b = $("#reacBig"); if (b) b.textContent = "¡YA! 🟢";
    }
    if (left <= 0) reaccionOnTimeUp(m);
  } else if (m.kind === "ritmo"){
    const left = Math.max(0, Math.ceil(((m.until||0)-Date.now())/1000));
    const el = $("#ritmoTimer"); if (el) el.textContent = left;
    // Rescate: si la animación de la secuencia murió, desbloquear igual
    if (S.ritmoLocked && !S.ritmoDone && S.ritmoUnlockBy && Date.now() > S.ritmoUnlockBy){
      S.ritmoLocked = false; S.ritmoUnlockBy = 0;
      const msg = $("#ritmoMsg"); if (msg) msg.textContent = "¡Tu turno! Repite la secuencia";
    }
    if (left <= 0) ritmoOnTimeUp(m);
  } else if (m.kind === "preg"){
    const left = Math.max(0, Math.ceil(((m.until||0)-Date.now())/1000));
    const el = $("#pregTimer"); if (el) el.textContent = left;
    if (left <= 0) pregOnTimeUp(m);
  } else if (m.kind === "vf"){
    const left = Math.max(0, Math.ceil(((m.until||0)-Date.now())/1000));
    const el = $("#vfTimer"); if (el) el.textContent = left;
    if (left <= 0) vfOnTimeUp(m);
  } else if (m.kind === "bomba"){
    const left = Math.max(0, Math.ceil(((m.until||0)-Date.now())/1000));
    const el = $("#bombaTimer"); if (el) el.textContent = left;
    const fuse = $("#bombaFuse"); if (fuse){ const tot = miniPlayMs("bomba"); fuse.style.width = Math.max(0, Math.min(100, ((m.until-Date.now())/tot)*100)) + "%"; }
    if (left <= 0) bombaOnTimeUp(m);
  }
}
// ---------- Barra de puntaje EN VIVO de los mini-juegos ----------
// Cada mini llama a miniBar("#msbX", puntos, tope) cada vez que cambia su
// puntaje. La barra se llena en proporción al "tope" (un puntaje bueno de
// referencia) y el número sube contando. Al llenarse, brilla dorada.
function miniBar(sel, pts, target, label){
  const bar = $(sel);
  if (!bar) return;
  const fill = bar.querySelector(".msb-fill");
  const num = bar.querySelector(".msb-num");
  const pct = Math.max(0, Math.min(100, (pts / Math.max(1, target)) * 100));
  if (fill) fill.style.width = pct + "%";
  bar.classList.toggle("full", pct >= 100);
  const prev = +(bar.dataset.pts || 0);
  bar.dataset.pts = pts;
  if (label != null){ if (num) num.textContent = label; }
  else if (num) animateCount(num, prev, pts, 450);
  if (pts > prev){ bar.classList.remove("bump"); void bar.offsetWidth; bar.classList.add("bump");
    try { navigator.vibrate && navigator.vibrate(10); } catch(e){} }
}
// Reinicia una barra a 0 al empezar cada mini.
function miniBarReset(sel){
  const bar = $(sel);
  if (!bar) return;
  bar.dataset.pts = 0;
  const fill = bar.querySelector(".msb-fill"); if (fill) fill.style.width = "0%";
  const num = bar.querySelector(".msb-num"); if (num) num.textContent = "0";
  bar.classList.remove("full");
}

function showMiniResult(m){
  // Reutiliza la pantalla de marcador para mostrar resultados del mini
  const meta = MINI_META[m.kind];
  const results = m.results || {};
  const isDelator = m.kind === "delator";
  const rows = S.players.map(p => ({ p, pts: results[p.id]||0 })).sort((a,b)=>b.pts-a.pts);
  const list = $("#boardList"); list.innerHTML = "";
  // Los botones ganadores son solo para preguntas normales, no para mini-juegos
  $("#winnerButtons")?.classList.add("hidden");
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
  miniBarReset("#msbFlash");
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
    miniBar("#msbFlash", S.flashScore, (m.data.seq.length * 6) + 60);
    if (S.flashNext >= seq.length){
      // Completó la secuencia entera → +60 extra
      S.flashScore += 60;
      S.flashDone = true;
      $("#flashScore").textContent = `¡Secuencia completa! ${S.flashScore} pts 🎉`;
      miniBar("#msbFlash", S.flashScore, (m.data.seq.length * 6) + 60);
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
  if (S.solo){ S.soloMiniResult = { score:S.flashScore }; if (soloMiniFinish(S.flashScore)) return; return; }
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
  miniBarReset("#msbColor");
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
  miniBar("#msbColor", S.colorScore, (m.data.rounds.length * 12));
  // Siguiente ronda tras un respiro
  setTimeout(() => { S.colorRound++; renderColorRound(m); }, 650);
}
let colorSubmitted = false;
async function colorSubmit(m){
  if (colorSubmitted) return; colorSubmitted = true;
  if (S.solo){ S.soloMiniResult = { score:S.colorScore }; if (soloMiniFinish(S.colorScore)) return; return; }
  try {
    await sb.from("mini_scores").insert({
      room_id:S.room.id, player_id:S.me.id, kind:"color", round:0, score:S.colorScore
    });
  } catch(e){}
}
function colorOnTimeUp(m){ if (!colorSubmitted) colorSubmit(m); }

// ============================================================
// ⚡ VERDADERO O FALSO — aparecen afirmaciones, tocas ✅ o ❌
// ============================================================
function buildVf(){
  const POOL = [
    { t:"El Sol es una estrella.", a:true },
    { t:"Los murciélagos son ciegos.", a:false },
    { t:"Un año en Marte dura más que en la Tierra.", a:true },
    { t:"La Gran Muralla China se ve a simple vista desde la Luna.", a:false },
    { t:"Los pulpos tienen tres corazones.", a:true },
    { t:"El oro es más pesado que el plomo.", a:true },
    { t:"Los tomates son una verdura.", a:false },
    { t:"El agua hierve a 100 °C a nivel del mar.", a:true },
    { t:"Los tiburones son mamíferos.", a:false },
    { t:"La miel nunca se echa a perder.", a:true },
    { t:"Saturno es el planeta con más anillos visibles.", a:true },
    { t:"El corazón humano tiene cuatro cavidades.", a:true },
    { t:"Los camaleones cambian de color solo para camuflarse.", a:false },
    { t:"La Torre Eiffel está en Roma.", a:false },
    { t:"El diamante está hecho de carbono.", a:true },
    { t:"Los seres humanos usan solo el 10% del cerebro.", a:false },
    { t:"El plátano es técnicamente una baya.", a:true },
    { t:"Napoleón era extremadamente bajo de estatura.", a:false },
    { t:"El cuerpo humano tiene 206 huesos en la adultez.", a:true },
    { t:"La sangre es azul dentro de las venas.", a:false },
    { t:"Australia es a la vez un país y un continente.", a:true },
    { t:"Los delfines duermen con medio cerebro despierto.", a:true },
    { t:"El Everest es la montaña más alta del mundo.", a:true },
    { t:"Las jirafas no tienen cuerdas vocales.", a:false },
    { t:"El vidrio es un líquido que fluye muy lento.", a:false },
    { t:"Marte es conocido como el planeta rojo.", a:true },
    { t:"Los pingüinos viven en el Polo Norte.", a:false },
    { t:"El chocolate puede ser tóxico para los perros.", a:true },
  ];
  return { items: shuffle([...POOL]).slice(0, 8) };
}
function vfStart(m){
  S.vfIdx = 0; S.vfScore = 0; S.vfItems = m.data.items || [];
  miniBarReset("#msbVf");
  const t = $("#vfTrue"), f = $("#vfFalse");
  if (t) t.onclick = () => vfAnswer(true);
  if (f) f.onclick = () => vfAnswer(false);
  show("mini-vf");
  vfRender();
}
function vfRender(){
  const items = S.vfItems, i = S.vfIdx;
  const prog = $("#vfProgress"); if (prog) prog.textContent = `${Math.min(i+1, items.length)}/${items.length}`;
  const stim = $("#vfStim"); if (stim) stim.textContent = items[i] ? items[i].t : "";
  const fb = $("#vfFeedback"); if (fb){ fb.textContent = ""; fb.className = "vf-feedback"; }
  $$("#scr-mini-vf .vf-btn").forEach(b => b.disabled = false);
}
function vfAnswer(val){
  const items = S.vfItems, i = S.vfIdx;
  if (!items || i >= items.length) return;
  const t = $("#vfTrue"); if (!t || t.disabled) return;   // ya respondió esta afirmación
  $$("#scr-mini-vf .vf-btn").forEach(b => b.disabled = true);
  const ok = (val === items[i].a);
  if (ok){ S.vfScore += 15; try { Sfx.correct(); } catch(e){} } else { try { Sfx.wrong(); } catch(e){} }
  miniBar("#msbVf", S.vfScore, items.length*15);
  const fb = $("#vfFeedback");
  if (fb){ fb.textContent = ok ? "¡Correcto! ✅" : `Era ${items[i].a ? "Verdadero ✅" : "Falso ❌"}`; fb.className = "vf-feedback " + (ok ? "good" : "bad"); }
  setTimeout(() => {
    S.vfIdx++;
    if (S.vfIdx >= items.length) vfSubmit(S.room?.mini_state);
    else vfRender();
  }, 720);
}
let vfSubmitted = false;
async function vfSubmit(m){
  if (vfSubmitted) return; vfSubmitted = true;
  const score = S.vfScore || 0;
  if (S.solo){ S.soloMiniResult = { score }; if (soloMiniFinish(score)) return; return; }
  try { await sb.from("mini_scores").insert({ room_id:S.room.id, player_id:S.me.id, kind:"vf", round:0, score }); } catch(e){}
}
function vfOnTimeUp(m){ if (!vfSubmitted) vfSubmit(m); }

// ============================================================
// 💣 PALABRA BOMBA — escribe palabras de la categoría antes de que explote
// ============================================================
function buildBomba(){
  const CATS = ["Frutas 🍓","Países 🌍","Animales 🦁","Marcas de autos 🚗","Cosas de la cocina 🍳",
    "Partes del cuerpo 🫀","Deportes ⚽","Colores 🎨","Nombres de persona 🙋","Cosas del colegio 🎒",
    "Ropa 👕","Instrumentos musicales 🎸","Profesiones 👷","Bebidas 🥤","Cosas que vuelan ✈️"];
  return { cat: CATS[Math.floor(Math.random()*CATS.length)] };
}
function bombaStart(m){
  S.bombaWords = []; S.bombaScore = 0;
  miniBarReset("#msbBomba");
  const c = $("#bombaCat"); if (c) c.textContent = m.data.cat || "";
  const list = $("#bombaList"); if (list) list.innerHTML = "";
  const inp = $("#bombaInput"); if (inp) inp.value = "";
  const add = $("#bombaAdd"); if (add) add.onclick = bombaAddWord;
  if (inp) inp.onkeydown = (e) => { if (e.key === "Enter") bombaAddWord(); };
  show("mini-bomba");
  setTimeout(() => { try { $("#bombaInput")?.focus(); } catch(e){} }, 200);
}
function bombaAddWord(){
  const inp = $("#bombaInput"); if (!inp) return;
  const w = inp.value.trim(); inp.value = "";
  if (w.length < 3){ inp.focus(); return; }
  if (S.bombaWords.some(x => x.toLowerCase() === w.toLowerCase())){ toast("Ya la escribiste 😅"); inp.focus(); return; }
  S.bombaWords.push(w);
  S.bombaScore = S.bombaWords.length * 12;
  try { Sfx.pick(); } catch(e){}
  miniBar("#msbBomba", S.bombaScore, 6*12);
  const list = $("#bombaList");
  if (list){ const chip = document.createElement("span"); chip.className = "bomba-chip"; chip.textContent = w; list.appendChild(chip); }
  inp.focus();
}
let bombaSubmitted = false;
async function bombaSubmit(m){
  if (bombaSubmitted) return; bombaSubmitted = true;
  const score = S.bombaScore || 0;
  try { if (typeof Fun !== "undefined" && Fun.burst) Fun.burst(["💥","🔥","💣"], 10); } catch(e){}
  if (S.solo){ S.soloMiniResult = { score }; if (soloMiniFinish(score)) return; return; }
  try { await sb.from("mini_scores").insert({ room_id:S.room.id, player_id:S.me.id, kind:"bomba", round:0, score }); } catch(e){}
}
function bombaOnTimeUp(m){ if (!bombaSubmitted) bombaSubmit(m); }

// ---------- MEMORIA RELÁMPAGO ----------
// Fases internas: "show" (ver la secuencia 3s) → "input" (repetir tocando)
let memoriaSubmitted = false;
function memoriaStart(m){
  S.memoInput = [];       // orden en que el jugador toca
  S.memoDone = false;
  S.memoT0 = 0;
  S.memoShownAt = Date.now();   // para el rescate si el timer de 3s muere
  const seq = m.data.seq;
  // Mostrar la secuencia grande, en orden, por 3 segundos
  $("#memoRound").textContent = "¡Memoriza!";
  $("#memoScore").textContent = "";
  miniBarReset("#msbMemo");
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
  if (S.memoT0 || S.memoDone) return;   // ya está en fase de input (evita doble entrada)
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
    miniBar("#msbMemo", S.memoInput.length * 20, seq.length * 20);
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
  if (S.solo){ S.soloMiniResult = { ok, t: t||999999 }; if (soloMiniFinish(ok?100:20)) return; return; }
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
  miniBarReset("#msbPunt");
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
    miniBar("#msbPunt", S.puntHits * 10, 150);
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
  if (S.solo){ S.soloMiniResult = { score:pts }; if (soloMiniFinish(pts)) return; return; }
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
  miniBarReset("#msbReac");
  const pad = $("#reacPad");
  pad.onclick = () => reaccionTapPad(m);
  show("mini-reaccion");
  reaccionNextRound(m);
}
function reaccionNextRound(m){
  if (S.reacRound >= m.data.rounds.length){ reaccionFinishLocal(m); return; }
  miniBar("#msbReac", S.reacRound, m.data.rounds.length, `Ronda ${Math.min(S.reacRound+1, m.data.rounds.length)}/${m.data.rounds.length}`);
  const r = m.data.rounds[S.reacRound];
  const pad = $("#reacPad");
  pad.className = "reac-pad waiting";
  $("#reacBig").textContent = "Espera…";
  $("#reacSub").textContent = `Ronda ${S.reacRound+1} de ${m.data.rounds.length}`;
  S.reacReady = false;
  S.reacShownAt = 0;
  S.reacWaitUntil = Date.now() + r.waitMs;   // para el rescate si el timer muere
  clearTimeout(S.reacGoT);
  // Tras el tiempo de espera, cambia a verde
  S.reacGoT = setTimeout(() => {
    if (S.reacDone) return;
    S.reacReady = true;
    S.reacShownAt = Date.now();
    S.reacWaitUntil = 0;
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
  if (S.solo){ S.soloMiniResult = { ok, t: t||999999 }; if (soloMiniFinish(ok?100:20)) return; return; }
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
  miniBarReset("#msbRitmo");
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
  // Token de ejecución: si arranca una secuencia nueva, la vieja se aborta
  const run = (S.ritmoRun = (S.ritmoRun || 0) + 1);
  S.ritmoLocked = true;
  S.ritmoInput = [];
  const seq = m.data.seq.slice(0, S.ritmoLevel);
  // Red de seguridad: si los timers se congelan (cambio de app, lag), el
  // bucle de 250ms desbloquea igual pasado el tiempo esperado (bug: jugadores
  // que quedaban pegados en "Observa…" sin poder tocar)
  S.ritmoUnlockBy = Date.now() + 450 + seq.length * 480 + 1500;
  try {
    const msg = $("#ritmoMsg"); if (msg) msg.textContent = "Observa… 👀";
    await sleep(450);
    for (const idx of seq){
      if (S.ritmoDone || run !== S.ritmoRun) return;
      await ritmoFlash(idx);
      await sleep(140);
    }
  } catch(e){ console.warn("ritmo seq", e); }
  if (S.ritmoDone || run !== S.ritmoRun) return;
  const msg2 = $("#ritmoMsg"); if (msg2) msg2.textContent = "¡Tu turno! Repite la secuencia";
  S.ritmoLocked = false;
  S.ritmoUnlockBy = 0;
}
function ritmoFlash(idx){
  return new Promise(res => {
    const pad = $$("#ritmoPads .ritmo-pad")[idx];
    if (!pad){ res(); return; }
    pad.classList.add("lit");
    Sfx.pick && Sfx.pick();
    setTimeout(() => { pad.classList.remove("lit"); res(); }, 340);
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
    miniBar("#msbRitmo", S.ritmoScore * 10, 250);
    if (S.ritmoInput.length === seq.length){
      // Completó el nivel → sube dificultad
      S.ritmoLocked = true;
      $("#ritmoMsg").textContent = "¡Bien! 🎉 Ahora más largo…";
      S.ritmoLevel++;
      if (S.ritmoLevel > m.data.seq.length){ ritmoFinishLocal(m); return; }
      await sleep(550);
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
  if (S.solo){ S.soloMiniResult = { score:pts }; if (soloMiniFinish(pts)) return; return; }
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
  miniBarReset("#msbPreg");
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
    { const filled = S.pregFilled.filter(Boolean).length;
      miniBar("#msbPreg", filled, S.pregFilled.length, `${filled}/${S.pregFilled.length} letras`); }
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
  if (S.solo){ S.soloMiniResult = { ok, t: t||999999 }; if (soloMiniFinish(ok?100:20)) return; return; }
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
