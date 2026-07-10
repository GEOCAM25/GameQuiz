// ============================================================
// GAME QUIZ — CRUCI-QUIZ (juego individual estilo CodyCross)
// Crucigrama de verdad: las palabras se ENTRELAZAN (unas en
// horizontal, otras en vertical) y llenan la pantalla como en
// CodyCross. En cada nivel hay una PALABRA SECRETA que se va
// revelando: cada palabra aporta una letra resaltada (dorada).
//
// Los niveles se cargan desde data/cruci.json — para agregar más
// niveles NO se toca este archivo, solo se llena el JSON. El
// contador de niveles se actualiza solo.
//
// Extras:
//  - Al resolver una palabra ganas "letras de pista" que se
//    guardan y pre-rellenan casillas en los niveles siguientes.
//  - Botón "Revelar palabra" con 3 usos; al agotarlos hay que
//    esperar 30 minutos para recuperar los 3.
// El avance se guarda en el teléfono (localStorage).
// ============================================================
const Cruci = (() => {
  const $  = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  let LEVELS = null;          // se cargan desde el JSON (una vez)
  let level = 0, board = null, curWord = 0, lastKey = null, onExit = null;

  // ---------- persistencia ----------
  function unlockedMax(){ return +(localStorage.getItem("gq_cruci_max") || 0); }
  function setUnlocked(n){ localStorage.setItem("gq_cruci_max", String(Math.max(unlockedMax(), n))); }
  function hintBank(){ return +(localStorage.getItem("gq_cruci_hints") || 0); }
  function setHintBank(n){ localStorage.setItem("gq_cruci_hints", String(Math.max(0, n))); }

  // ---------- Revelar palabra: 3 usos, recarga a los 30 min ----------
  const REVEAL_MAX = 3, REVEAL_COOLDOWN = 30 * 60 * 1000;
  function revealState(){
    let s;
    try { s = JSON.parse(localStorage.getItem("gq_cruci_reveal") || "null"); } catch(e){ s = null; }
    if (!s || typeof s.left !== "number") s = { left: REVEAL_MAX, ts: 0 };
    if (s.left <= 0 && Date.now() - s.ts >= REVEAL_COOLDOWN) s = { left: REVEAL_MAX, ts: 0 };
    return s;
  }
  function saveReveal(s){ localStorage.setItem("gq_cruci_reveal", JSON.stringify(s)); }
  function revealCooldownLeft(){
    const s = revealState();
    if (s.left > 0) return 0;
    return Math.max(0, REVEAL_COOLDOWN - (Date.now() - s.ts));
  }

  // ---------- carga de niveles ----------
  async function ensureLevels(){
    if (LEVELS) return LEVELS;
    const r = await fetch("data/cruci.json", { cache: "no-store" });
    const j = await r.json();
    LEVELS = (j.niveles || []).map(normalizeLevel).filter(Boolean);
    return LEVELS;
  }
  // Deja cada nivel listo: mayúsculas y el índice de la letra secreta
  // dentro de cada palabra (la que coincide con la letra i de "secreta").
  function normalizeLevel(lv){
    const secreta = String(lv.secreta || "").toUpperCase();
    const palabras = (lv.palabras || []).map((it, i) => {
      const w = String(it.w || "").toUpperCase().replace(/[^A-ZÑ]/g, "");
      const target = secreta[i] || w[0];
      let hi = w.indexOf(target);
      if (hi < 0) hi = 0;
      return { w, p: it.p || "", hi };
    }).filter(x => x.w.length > 1);
    if (!palabras.length) return null;
    return { tema: lv.tema || "Nivel", secreta: secreta.slice(0, palabras.length), palabras };
  }

  // ============================================================
  //  GENERADOR DE CRUCIGRAMA (entrelaza las palabras)
  // ============================================================
  function buildCrossword(entries){
    const grid = new Map();          // "r,c" -> letra
    const placements = [];           // { w, p, hi, r, c, dir }
    const K = (r, c) => r + "," + c;
    const at = (r, c) => grid.get(K(r, c));

    // ¿Cabe la palabra en (r,c) con dirección dir? Devuelve nº de cruces o -1.
    function fits(word, r, c, dir){
      const [dr, dc] = dir === "H" ? [0, 1] : [1, 0];
      let cross = 0;
      if (at(r - dr, c - dc)) return -1;                       // casilla previa ocupada
      if (at(r + dr * word.length, c + dc * word.length)) return -1; // casilla posterior ocupada
      for (let j = 0; j < word.length; j++){
        const rr = r + dr * j, cc = c + dc * j, cell = at(rr, cc);
        if (cell){
          if (cell !== word[j]) return -1;                     // choca con otra letra
          cross++;
        } else {
          // casilla vacía: sus vecinas perpendiculares deben estar vacías
          if (dir === "H"){ if (at(rr - 1, cc) || at(rr + 1, cc)) return -1; }
          else            { if (at(rr, cc - 1) || at(rr, cc + 1)) return -1; }
        }
      }
      return cross;
    }
    function put(e, r, c, dir){
      const [dr, dc] = dir === "H" ? [0, 1] : [1, 0];
      for (let j = 0; j < e.w.length; j++) grid.set(K(r + dr * j, c + dc * j), e.w[j]);
      placements.push({ w: e.w, p: e.p, hi: e.hi, r, c, dir });
    }

    // primera palabra: horizontal en el origen
    put(entries[0], 0, 0, "H");
    for (let i = 1; i < entries.length; i++){
      const e = entries[i];
      let best = null;
      for (const [k, ch] of grid){
        const [pr, pc] = k.split(",").map(Number);
        for (let j = 0; j < e.w.length; j++){
          if (e.w[j] !== ch) continue;
          for (const dir of ["H", "V"]){
            const [dr, dc] = dir === "H" ? [0, 1] : [1, 0];
            const r = pr - dr * j, c = pc - dc * j;
            const sc = fits(e.w, r, c, dir);
            if (sc >= 1 && (!best || sc > best.sc)) best = { r, c, dir, sc };
          }
        }
      }
      if (best) put(e, best.r, best.c, best.dir);
      else {
        // sin cruce posible: la dejamos debajo de todo, en horizontal
        let maxR = 0; for (const k of grid.keys()) maxR = Math.max(maxR, +k.split(",")[0]);
        put(e, maxR + 2, 0, "H");
      }
    }

    // normalizar a (0,0)
    let minR = Infinity, minC = Infinity, maxR = -Infinity, maxC = -Infinity;
    for (const k of grid.keys()){
      const [r, c] = k.split(",").map(Number);
      minR = Math.min(minR, r); minC = Math.min(minC, c);
      maxR = Math.max(maxR, r); maxC = Math.max(maxC, c);
    }
    placements.forEach(pl => { pl.r -= minR; pl.c -= minC; });
    const H = maxR - minR + 1, W = maxC - minC + 1;

    // mapa de casillas: letra correcta, palabras que la cruzan y si es secreta
    const cells = new Map();         // "r,c" -> { ch, ids:[], secret:idx|undefined }
    placements.forEach((pl, pi) => {
      const [dr, dc] = pl.dir === "H" ? [0, 1] : [1, 0];
      for (let j = 0; j < pl.w.length; j++){
        const kk = K(pl.r + dr * j, pl.c + dc * j);
        let cm = cells.get(kk);
        if (!cm){ cm = { ch: pl.w[j], ids: [] }; cells.set(kk, cm); }
        cm.ids.push(pi);
        if (j === pl.hi) cm.secret = pi;   // esta casilla aporta la letra pi de la secreta
      }
    });

    return { placements, cells, W, H, K,
             typed: new Map(),      // letras escritas por el jugador
             given: new Set(),      // casillas pre-reveladas como pista
             solved: new Set() };   // índices de palabras resueltas
  }

  // ---------- helpers de estado del tablero ----------
  function cellLocked(kk){
    const cm = board.cells.get(kk);
    return cm && cm.ids.some(id => board.solved.has(id));
  }
  function effLetter(kk){
    if (cellLocked(kk)) return board.cells.get(kk).ch;   // fijada por una palabra ya resuelta
    return board.typed.get(kk) || "";
  }
  function wordKeys(pi){
    const pl = board.placements[pi];
    const [dr, dc] = pl.dir === "H" ? [0, 1] : [1, 0];
    const out = [];
    for (let j = 0; j < pl.w.length; j++) out.push(board.K(pl.r + dr * j, pl.c + dc * j));
    return out;
  }
  function firstUnsolved(){
    const i = board.placements.findIndex((_, pi) => !board.solved.has(pi));
    return i < 0 ? 0 : i;
  }

  // ============================================================
  //  API pública
  // ============================================================
  async function open(exitCb){
    onExit = exitCb || null;
    const host = $("#cruciScreen");
    host.innerHTML = `<div class="cruci-loading">Cargando… 🧩</div>`;
    showScreen();
    try { await ensureLevels(); }
    catch(e){ host.innerHTML = `<div class="cruci-loading">No se pudieron cargar los niveles.<br>Revisa data/cruci.json</div>`; return; }
    if (!LEVELS.length){ host.innerHTML = `<div class="cruci-loading">Aún no hay niveles.</div>`; return; }
    renderLevelSelect();
  }

  // ---------- Selector de niveles ----------
  function renderLevelSelect(){
    const host = $("#cruciScreen");
    const maxU = unlockedMax();
    host.innerHTML = `
      <div class="cruci-head">
        <button class="cruci-back" id="cruciBackHome">‹</button>
        <h2>CRUCI-QUIZ 🧩</h2>
        <span class="cruci-sub">${Math.min(maxU + 1, LEVELS.length)}/${LEVELS.length}</span>
      </div>
      <p class="cruci-tagline">Crucigrama con palabras cruzadas. Descubre la palabra secreta de cada nivel.</p>
      <div class="cruci-levels" id="cruciLevels"></div>`;
    const grid = host.querySelector("#cruciLevels");
    LEVELS.forEach((lv, i) => {
      const locked = i > maxU, done = i < maxU;
      const b = document.createElement("button");
      b.className = "cruci-lvl" + (locked ? " locked" : "") + (done ? " done" : "");
      b.innerHTML = locked
        ? `<span class="cl-lock">🔒</span><span class="cl-n">${i + 1}</span>`
        : `<span class="cl-n">${i + 1}</span><span class="cl-theme">${lv.tema}</span>${done ? '<span class="cl-star">⭐</span>' : ""}`;
      if (!locked) b.onclick = () => startLevel(i);
      grid.appendChild(b);
    });
    host.querySelector("#cruciBackHome").onclick = () => { if (onExit) onExit(); };
    showScreen();
  }

  function startLevel(i){
    level = i;
    board = buildCrossword(LEVELS[i].palabras);
    applyStartHints();
    curWord = firstUnsolved();
    lastKey = null;
    renderBoard();
  }

  // Gasta parte del banco de pistas pre-revelando algunas casillas.
  function applyStartHints(){
    let bank = hintBank();
    if (bank <= 0) return;
    const total = board.cells.size;
    let n = Math.min(bank, Math.max(1, Math.round(total * 0.12)), 5);
    const keys = Array.from(board.cells.keys());
    let guard = 0;
    while (n > 0 && guard++ < 200){
      const kk = keys[Math.floor(Math.random() * keys.length)];
      if (board.given.has(kk) || board.typed.get(kk)) continue;
      board.typed.set(kk, board.cells.get(kk).ch);
      board.given.add(kk);
      bank--; n--;
    }
    setHintBank(bank);
  }

  // ---------- Tablero ----------
  function renderBoard(){
    const host = $("#cruciScreen");
    const lv = LEVELS[level];
    host.innerHTML = `
      <div class="cruci-head">
        <button class="cruci-back" id="cruciBackSel">‹</button>
        <h2>Nivel ${level + 1} · ${lv.tema}</h2>
        <span class="cruci-sub">🔑 ${lv.secreta.length}</span>
      </div>
      <div class="cruci-secret" id="cruciSecret"></div>
      <div class="cruci-gridwrap"><div class="cruci-xgrid" id="cruciGrid"></div></div>
      <div class="cruci-clue" id="cruciClue"></div>
      <div class="cruci-actions">
        <button class="cruci-reveal" id="cruciReveal"></button>
      </div>
      <div class="cruci-keyboard" id="cruciKb"></div>`;
    host.querySelector("#cruciBackSel").onclick = () => renderLevelSelect();
    host.querySelector("#cruciReveal").onclick = revealWord;
    drawSecret();
    drawGrid();
    drawKeyboard();
    updateReveal();
    selectWord(curWord, true);
    showScreen();
  }

  function drawGrid(){
    const g = $("#cruciGrid");
    g.style.setProperty("--cols", board.W);
    g.style.setProperty("--rows", board.H);
    // tamaño de casilla para llenar la pantalla sin desbordar
    const wrap = g.parentElement.getBoundingClientRect();
    const availW = (wrap.width || window.innerWidth) - 6;
    const availH = (wrap.height || window.innerHeight * 0.4) - 6;
    const cs = Math.max(16, Math.min(44, Math.floor(availW / board.W), Math.floor(availH / board.H)));
    g.style.setProperty("--cs", cs + "px");
    g.innerHTML = "";
    for (let r = 0; r < board.H; r++){
      for (let c = 0; c < board.W; c++){
        const kk = board.K(r, c), cm = board.cells.get(kk);
        const cell = document.createElement("div");
        if (!cm){ cell.className = "xc-blank"; g.appendChild(cell); continue; }
        cell.className = "xc";
        if (cm.secret !== undefined) cell.classList.add("secret");
        if (cellLocked(kk)) cell.classList.add("solved");
        if (board.given.has(kk) && !cellLocked(kk)) cell.classList.add("given");
        cell.textContent = effLetter(kk);
        cell.dataset.k = kk;
        cell.onclick = () => onCellClick(kk);
        g.appendChild(cell);
      }
    }
    highlightActive();
  }

  function onCellClick(kk){
    const cm = board.cells.get(kk);
    const opts = cm.ids.filter(id => !board.solved.has(id));
    if (!opts.length) return;               // casilla ya resuelta por todos lados
    let pick;
    if (kk === lastKey){                     // segundo clic: alterna entre las palabras del cruce
      const cur = opts.indexOf(curWord);
      pick = opts[(cur + 1) % opts.length];
    } else {
      pick = opts.includes(curWord) ? curWord : opts[0];
    }
    lastKey = kk;
    selectWord(pick);
  }

  function selectWord(pi, resetKey){
    if (board.solved.has(pi)){ pi = firstUnsolved(); }
    curWord = pi;
    if (resetKey) lastKey = null;
    const pl = board.placements[pi];
    const dirTxt = pl.dir === "H" ? "➡️ horizontal" : "⬇️ vertical";
    $("#cruciClue").innerHTML =
      `<span class="cc-num">${pi + 1}.</span> ${pl.p} <span class="cc-len">(${pl.w.length} · ${dirTxt})</span>`;
    highlightActive();
  }

  function highlightActive(){
    $$(".xc").forEach(el => el.classList.remove("active"));
    wordKeys(curWord).forEach(kk => {
      const el = $(`.xc[data-k="${kk}"]`);
      if (el) el.classList.add("active");
    });
  }

  function drawSecret(){
    const bar = $("#cruciSecret");
    const sec = LEVELS[level].secreta;
    bar.innerHTML = `<span class="cs-label">🔑</span>` + sec.split("").map((ch, i) =>
      `<span class="cs-box" data-i="${i}">${board.solved.has(i) ? ch : ""}</span>`).join("");
  }
  function updateSecret(){
    const sec = LEVELS[level].secreta;
    sec.split("").forEach((ch, i) => {
      const el = $(`.cs-box[data-i="${i}"]`);
      if (el && board.solved.has(i) && el.textContent !== ch){
        el.textContent = ch; el.classList.add("pop");
      }
    });
  }

  function drawKeyboard(){
    const kb = $("#cruciKb");
    kb.innerHTML = "";
    ["QWERTYUIOP", "ASDFGHJKLÑ", "ZXCVBNM"].forEach((line, idx) => {
      const row = document.createElement("div");
      row.className = "ckb-row";
      line.split("").forEach(letter => {
        const b = document.createElement("button");
        b.className = "ckb-key"; b.textContent = letter;
        b.onclick = () => typeLetter(letter);
        row.appendChild(b);
      });
      if (idx === 2){
        const del = document.createElement("button");
        del.className = "ckb-key ckb-del"; del.textContent = "⌫";
        del.onclick = backspace;
        row.appendChild(del);
      }
      kb.appendChild(row);
    });
  }

  function nextEmptyKey(pi){
    return wordKeys(pi).find(kk => !effLetter(kk)) || null;
  }
  function typeLetter(letter){
    if (board.solved.has(curWord)) return;
    const kk = nextEmptyKey(curWord);
    if (!kk) return;
    board.typed.set(kk, letter);
    try { Sfx.pick(); } catch(e){}
    refreshCells();
    if (!nextEmptyKey(curWord)) checkWord(curWord);
  }
  function backspace(){
    if (board.solved.has(curWord)) return;
    const keys = wordKeys(curWord);
    for (let i = keys.length - 1; i >= 0; i--){
      const kk = keys[i];
      if (cellLocked(kk) || board.given.has(kk)) continue;   // no se borran letras fijas/pista
      if (board.typed.get(kk)){ board.typed.delete(kk); break; }
    }
    refreshCells();
  }

  // Re-pinta solo las letras (más liviano que redibujar toda la grilla)
  function refreshCells(){
    wordKeys(curWord).forEach(kk => {
      const el = $(`.xc[data-k="${kk}"]`);
      if (el) el.textContent = effLetter(kk);
    });
  }

  function checkWord(pi){
    const pl = board.placements[pi];
    const guess = wordKeys(pi).map(effLetter).join("");
    if (guess === pl.w){
      board.solved.add(pi);
      setHintBank(hintBank() + 1);           // ganas una letra de pista para más adelante
      try { Sfx.correct(); } catch(e){}
      try {
        if (typeof Fun !== "undefined"){
          const g = $("#cruciGrid").getBoundingClientRect();
          Fun.floatUp("✨", g.left + g.width / 2, g.top + 30, 5);
        }
      } catch(e){}
      drawGrid(); updateSecret();
      if (board.placements.every((_, k) => board.solved.has(k))) setTimeout(levelComplete, 450);
      else setTimeout(() => selectWord(firstUnsolved(), true), 350);
    } else {
      try { Sfx.wrong(); } catch(e){}
      wordKeys(pi).forEach(kk => {
        const el = $(`.xc[data-k="${kk}"]`);
        if (el){ el.classList.add("shake"); setTimeout(() => el.classList.remove("shake"), 400); }
      });
      // borra lo escrito (deja intactas casillas fijas y de pista)
      setTimeout(() => {
        wordKeys(pi).forEach(kk => { if (!cellLocked(kk) && !board.given.has(kk)) board.typed.delete(kk); });
        refreshCells();
      }, 450);
    }
  }

  // ---------- Revelar palabra (3 usos / 30 min) ----------
  function revealWord(){
    if (board.solved.has(curWord)){ selectWord(firstUnsolved(), true); return; }
    const s = revealState();
    if (s.left <= 0){
      const mins = Math.ceil(revealCooldownLeft() / 60000);
      try { toast(`Sin revelaciones. Vuelven en ${mins} min ⏳`); } catch(e){}
      return;
    }
    // resuelve la palabra actual completa
    const pl = board.placements[curWord];
    wordKeys(curWord).forEach((kk, j) => board.typed.set(kk, pl.w[j]));
    s.left--;
    if (s.left <= 0) s.ts = Date.now();
    saveReveal(s);
    updateReveal();
    checkWord(curWord);
  }
  function updateReveal(){
    const btn = $("#cruciReveal");
    if (!btn) return;
    const s = revealState();
    if (s.left > 0){
      btn.disabled = false;
      btn.classList.remove("cooling");
      btn.innerHTML = `🔓 Revelar palabra <span class="cr-n">${s.left}/${REVEAL_MAX}</span>`;
    } else {
      btn.disabled = true;
      btn.classList.add("cooling");
      const mins = Math.max(1, Math.ceil(revealCooldownLeft() / 60000));
      btn.innerHTML = `⏳ Vuelven en ${mins} min`;
    }
  }

  function levelComplete(){
    try { Sfx.fanfare(); } catch(e){}
    try { if (typeof Fun !== "undefined"){ Fun.confetti(80); Fun.burst(["🎉","🧩","⭐","🔑"], 12); } } catch(e){}
    setUnlocked(level + 1);
    const host = $("#cruciScreen");
    const sec = LEVELS[level].secreta;
    const isLast = level + 1 >= LEVELS.length;
    const card = document.createElement("div");
    card.className = "cruci-win";
    card.innerHTML = `
      <div class="cw-box">
        <div class="cw-emoji">🔑</div>
        <p class="cw-label">Palabra secreta</p>
        <div class="cw-key">${sec.split("").map(c => `<span>${c}</span>`).join("")}</div>
        <p class="cw-msg">¡Nivel ${level + 1} completado! 🎉</p>
        <p class="cw-hint">Ganaste letras de pista para los próximos niveles 💡</p>
        <div class="cw-btns">
          ${isLast ? "" : `<button class="btn big btn-green" id="cwNext">Siguiente nivel ▶</button>`}
          <button class="btn ghost" id="cwSelect">Elegir nivel</button>
        </div>
        ${isLast ? '<p class="cw-msg">¡Terminaste todos los niveles disponibles! Pronto habrá más 🚀</p>' : ""}
      </div>`;
    host.appendChild(card);
    const nx = card.querySelector("#cwNext");
    if (nx) nx.onclick = () => startLevel(level + 1);
    card.querySelector("#cwSelect").onclick = () => renderLevelSelect();
  }

  function showScreen(){
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    $("#scr-cruci").classList.add("active");
  }

  // redibuja la grilla si cambia el tamaño de la pantalla
  window.addEventListener("resize", () => { if (board && $("#cruciGrid")) drawGrid(); });

  return { open };
})();
