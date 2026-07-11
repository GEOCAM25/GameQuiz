// ============================================================
// GAME QUIZ — CRUCI-QUIZ (estilo CodyCross)
// Tablero DENSO: cada pista es una palabra HORIZONTAL en su propia
// fila, apiladas sin huecos. Una letra de cada palabra (dorada) arma
// la PALABRA SECRETA hacia abajo. Al completar una palabra, se
// revelan 2–4 letras al azar en otras para ayudar. Botón "Revelar 1
// letra" (al azar) con 3 usos y recarga a los 30 min. Teclado grande
// con vibración. Niveles desde data/cruci.json (agregar = llenar).
// ============================================================
const Cruci = (() => {
  const $  = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const vibrate = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch(e){} };

  let LEVELS = null, level = 0, board = null, activeRow = 0, onExit = null;

  // ---------- persistencia ----------
  function unlockedMax(){ return +(localStorage.getItem("gq_cruci_max") || 0); }
  function setUnlocked(n){ localStorage.setItem("gq_cruci_max", String(Math.max(unlockedMax(), n))); }

  // ---------- Revelar 1 letra: 3 usos, recarga a los 30 min ----------
  const REVEAL_MAX = 3, REVEAL_COOLDOWN = 30 * 60 * 1000;
  function revealState(){
    let s; try { s = JSON.parse(localStorage.getItem("gq_cruci_reveal") || "null"); } catch(e){ s = null; }
    if (!s || typeof s.left !== "number") s = { left: REVEAL_MAX, ts: 0 };
    if (s.left <= 0 && Date.now() - s.ts >= REVEAL_COOLDOWN) s = { left: REVEAL_MAX, ts: 0 };
    return s;
  }
  function saveReveal(s){ localStorage.setItem("gq_cruci_reveal", JSON.stringify(s)); }
  function revealCooldownMin(){ const s = revealState(); return s.left > 0 ? 0 : Math.max(1, Math.ceil((REVEAL_COOLDOWN - (Date.now() - s.ts)) / 60000)); }

  // ---------- carga de niveles ----------
  async function ensureLevels(){
    if (LEVELS) return LEVELS;
    const r = await fetch("data/cruci.json", { cache: "no-store" });
    const j = await r.json();
    LEVELS = (j.niveles || []).map(normalizeLevel).filter(Boolean);
    return LEVELS;
  }
  function normalizeLevel(lv){
    const secreta = String(lv.secreta || "").toUpperCase();
    const palabras = (lv.palabras || []).map((it, i) => {
      const w = String(it.w || "").toUpperCase().replace(/[^A-ZÑ]/g, "");
      let hi = w.indexOf(secreta[i] || w[0]); if (hi < 0) hi = 0;
      return { w, p: it.p || "", hi };
    }).filter(x => x.w.length > 1);
    if (!palabras.length) return null;
    return { tema: lv.tema || "Nivel", secreta: secreta.slice(0, palabras.length), palabras };
  }

  // ---------- tablero (filas apiladas, alineadas a la izquierda) ----------
  function buildBoard(lv){
    const rows = lv.palabras.map(it => ({
      w: it.w, clue: it.p, hi: it.hi,
      filled: Array(it.w.length).fill(""), given: Array(it.w.length).fill(false), solved: false,
    }));
    return { secreta: lv.secreta, rows, width: Math.max(...rows.map(r => r.w.length)), height: rows.length };
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
    catch(e){ host.innerHTML = `<div class="cruci-loading">No se pudieron cargar los niveles.</div>`; return; }
    if (!LEVELS.length){ host.innerHTML = `<div class="cruci-loading">Aún no hay niveles.</div>`; return; }
    renderLevelSelect();
  }

  function renderLevelSelect(){
    const host = $("#cruciScreen");
    const maxU = unlockedMax();
    host.innerHTML = `
      <div class="cruci-head">
        <button class="cruci-back" id="cruciBackHome">‹</button>
        <h2>CRUCI-QUIZ 🧩</h2>
        <span class="cruci-sub">${Math.min(maxU + 1, LEVELS.length)}/${LEVELS.length}</span>
      </div>
      <p class="cruci-tagline">Completa las palabras y descubre la palabra secreta.</p>
      <div class="cruci-levels" id="cruciLevels"></div>`;
    const grid = host.querySelector("#cruciLevels");
    LEVELS.forEach((lv, i) => {
      const locked = i > maxU, done = i < maxU;
      const b = document.createElement("button");
      b.className = "cruci-lvl" + (locked ? " locked" : "") + (done ? " done" : "");
      b.innerHTML = locked ? `<span class="cl-lock">🔒</span><span class="cl-n">${i+1}</span>`
        : `<span class="cl-n">${i+1}</span><span class="cl-theme">${lv.tema}</span>${done?'<span class="cl-star">⭐</span>':''}`;
      if (!locked) b.onclick = () => startLevel(i);
      grid.appendChild(b);
    });
    host.querySelector("#cruciBackHome").onclick = () => { if (onExit) onExit(); };
    showScreen();
  }

  function startLevel(i){
    level = i;
    board = buildBoard(LEVELS[i]);
    activeRow = 0;
    renderBoard();
  }

  function renderBoard(){
    const host = $("#cruciScreen");
    const lv = LEVELS[level];
    host.innerHTML = `
      <div class="cruci-head">
        <button class="cruci-back" id="cruciBackSel">‹</button>
        <h2>Nivel ${level+1} · ${lv.tema}</h2>
        <span class="cruci-sub">🔑 ${lv.secreta.length}</span>
      </div>
      <div class="cruci-secret" id="cruciSecret"></div>
      <div class="cruci-gridwrap"><div class="cruci-xgrid" id="cruciGrid"></div></div>
      <div class="cruci-clue" id="cruciClue"></div>
      <div class="cruci-actions"><button class="cruci-reveal" id="cruciReveal"></button></div>
      <div class="cruci-keyboard" id="cruciKb"></div>`;
    host.querySelector("#cruciBackSel").onclick = () => renderLevelSelect();
    host.querySelector("#cruciReveal").onclick = revealOne;
    drawSecret(); drawGrid(); drawKeyboard(); updateReveal();
    selectRow(firstUnsolved(), true);
    showScreen();
  }

  function firstUnsolved(){ const i = board.rows.findIndex(r => !r.solved); return i < 0 ? 0 : i; }

  function drawGrid(){
    const g = $("#cruciGrid");
    g.style.setProperty("--cols", board.width);
    const wrap = g.parentElement.getBoundingClientRect();
    const availW = (wrap.width || window.innerWidth) - 8;
    const availH = (wrap.height || window.innerHeight * 0.45) - 8;
    const cs = Math.max(26, Math.min(54, Math.floor(availW / board.width) - 4, Math.floor(availH / board.height) - 4));
    g.style.setProperty("--cs", cs + "px");
    g.innerHTML = "";
    board.rows.forEach((r, ri) => {
      for (let c = 0; c < board.width; c++){
        if (c >= r.w.length){ const b = document.createElement("div"); b.className = "xc-blank"; g.appendChild(b); continue; }
        const cell = document.createElement("div");
        cell.className = "xc";
        if (c === r.hi) cell.classList.add("secret");
        if (r.solved) cell.classList.add("solved");
        else if (r.given[c]) cell.classList.add("given");
        if (ri === activeRow) cell.classList.add("active");
        cell.textContent = r.filled[c] || "";
        cell.onclick = () => selectRow(ri);
        g.appendChild(cell);
      }
    });
  }

  function selectRow(ri, force){
    if (board.rows[ri].solved && !force){ ri = firstUnsolved(); }
    activeRow = ri;
    const r = board.rows[ri];
    $("#cruciClue").innerHTML = `<span class="cc-num">${ri+1}.</span> ${r.clue} <span class="cc-len">(${r.w.length})</span>`;
    drawGrid();
  }

  function drawSecret(){
    const bar = $("#cruciSecret");
    bar.innerHTML = `<span class="cs-label">🔑</span>` + board.secreta.split("").map((ch, i) =>
      `<span class="cs-box" data-i="${i}">${board.rows[i] && board.rows[i].solved ? ch : ""}</span>`).join("");
  }
  function updateSecret(){
    board.secreta.split("").forEach((ch, i) => {
      const el = $(`.cs-box[data-i="${i}"]`);
      if (el && board.rows[i] && board.rows[i].solved && el.textContent !== ch){ el.textContent = ch; el.classList.add("pop"); }
    });
  }

  function drawKeyboard(){
    const kb = $("#cruciKb"); kb.innerHTML = "";
    ["QWERTYUIOP", "ASDFGHJKLÑ", "ZXCVBNM"].forEach((line, idx) => {
      const row = document.createElement("div"); row.className = "ckb-row";
      line.split("").forEach(letter => {
        const b = document.createElement("button"); b.className = "ckb-key"; b.textContent = letter;
        b.onclick = () => typeLetter(letter);
        row.appendChild(b);
      });
      if (idx === 2){ const del = document.createElement("button"); del.className = "ckb-key ckb-del"; del.textContent = "⌫"; del.onclick = backspace; row.appendChild(del); }
      kb.appendChild(row);
    });
  }

  function nextEmpty(r){ return r.filled.findIndex(x => !x); }
  function typeLetter(letter){
    const r = board.rows[activeRow];
    if (r.solved) return;
    const i = nextEmpty(r); if (i < 0) return;
    r.filled[i] = letter;
    vibrate(12); try { Sfx.pick(); } catch(e){}
    drawGrid();
    if (nextEmpty(r) < 0) checkWord(activeRow);
  }
  function backspace(){
    const r = board.rows[activeRow]; if (r.solved) return;
    for (let i = r.filled.length - 1; i >= 0; i--){ if (r.given[i]) continue; if (r.filled[i]){ r.filled[i] = ""; break; } }
    vibrate(10); drawGrid();
  }

  function checkWord(ri){
    const r = board.rows[ri];
    if (r.filled.join("") === r.w){
      solveRow(ri);
      // Regalo: 2–4 letras al azar en otras palabras sin resolver
      giveHintLetters(ri, 2 + Math.floor(Math.random() * 3));
      checkAllSolved();
      if (board.rows.every(x => x.solved)) return setTimeout(levelComplete, 450);
      setTimeout(() => selectRow(firstUnsolved(), true), 350);
    } else {
      try { Sfx.wrong(); } catch(e){} vibrate([30, 20, 30]);
      const g = $("#cruciGrid");
      const cells = $$(".cruci-xgrid .xc").filter((_, idx) => true); // marcar la fila activa
      // sacudir la fila activa
      const rowCells = rowCellEls(ri); rowCells.forEach(el => { el.classList.add("shake"); setTimeout(() => el.classList.remove("shake"), 400); });
      setTimeout(() => { r.filled = r.filled.map((ch, i) => r.given[i] ? ch : ""); drawGrid(); }, 450);
    }
  }
  function rowCellEls(ri){
    // devuelve los elementos .xc/.xc-blank de la fila ri (incluye blanks)
    const all = $$("#cruciGrid > div");
    return all.slice(ri * board.width, ri * board.width + board.rows[ri].w.length);
  }
  function solveRow(ri){
    const r = board.rows[ri]; if (r.solved) return;
    r.solved = true;
    try { Sfx.correct(); } catch(e){} vibrate([40, 20, 60]);
    try { if (typeof Fun !== "undefined"){ const gg = $("#cruciGrid").getBoundingClientRect(); Fun.floatUp("✨", gg.left + gg.width/2, gg.top + 30, 4); } } catch(e){}
    updateSecret();
  }
  function checkAllSolved(){
    board.rows.forEach((r, ri) => { if (!r.solved && r.filled.join("") === r.w) solveRow(ri); });
    updateSecret();
  }
  // Revela n celdas vacías al azar repartidas en palabras sin resolver (distintas a exceptRow)
  function giveHintLetters(exceptRow, n){
    const spots = [];
    board.rows.forEach((r, ri) => {
      if (ri === exceptRow || r.solved) return;
      r.filled.forEach((ch, ci) => { if (!ch) spots.push([ri, ci]); });
    });
    for (let k = 0; k < n && spots.length; k++){
      const idx = Math.floor(Math.random() * spots.length);
      const [ri, ci] = spots.splice(idx, 1)[0];
      board.rows[ri].filled[ci] = board.rows[ri].w[ci];
      board.rows[ri].given[ci] = true;
      // quitar de spots los que sean la misma celda (ya cubierto por splice)
    }
    drawGrid();
  }

  function revealOne(){
    const s = revealState();
    if (s.left <= 0){ try { toast(`Sin revelaciones. Vuelven en ${revealCooldownMin()} min ⏳`); } catch(e){} return; }
    // buscar una celda vacía: primero en la fila activa, si no en cualquiera sin resolver
    let r = board.rows[activeRow], i = r.solved ? -1 : nextRandomEmpty(r);
    if (i < 0){ const ri = board.rows.findIndex(x => !x.solved && x.filled.includes("")); if (ri < 0) return; r = board.rows[ri]; activeRow = ri; i = nextRandomEmpty(r); }
    if (i < 0) return;
    r.filled[i] = r.w[i]; r.given[i] = true;
    vibrate(20); try { Sfx.pick(); } catch(e){}
    s.left--; if (s.left <= 0) s.ts = Date.now(); saveReveal(s); updateReveal();
    drawGrid();
    if (nextEmpty(r) < 0) checkWord(activeRow);
    else { checkAllSolved(); if (board.rows.every(x => x.solved)) setTimeout(levelComplete, 400); }
  }
  function nextRandomEmpty(r){ const empties = r.filled.map((c, i) => c ? -1 : i).filter(i => i >= 0); return empties.length ? empties[Math.floor(Math.random() * empties.length)] : -1; }

  function updateReveal(){
    const btn = $("#cruciReveal"); if (!btn) return;
    const s = revealState();
    if (s.left > 0){ btn.disabled = false; btn.classList.remove("cooling"); btn.innerHTML = `💡 Revelar 1 letra <span class="cr-n">${s.left}/${REVEAL_MAX}</span>`; }
    else { btn.disabled = true; btn.classList.add("cooling"); btn.innerHTML = `⏳ Vuelven en ${revealCooldownMin()} min`; }
  }

  function levelComplete(){
    try { Sfx.fanfare(); } catch(e){}
    try { if (typeof Fun !== "undefined"){ Fun.confetti(90); Fun.burst(["🎉","🧩","⭐","🔑"], 12); } } catch(e){}
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
        <p class="cw-msg">¡Nivel ${level+1} completado! 🎉</p>
        <div class="cw-btns">
          ${isLast ? "" : `<button class="btn big btn-green" id="cwNext">Siguiente nivel ▶</button>`}
          <button class="btn ghost" id="cwSelect">Elegir nivel</button>
        </div>
        ${isLast ? '<p class="cw-msg">¡Terminaste todos los niveles! Pronto habrá más 🚀</p>' : ""}
      </div>`;
    host.appendChild(card);
    const nx = card.querySelector("#cwNext"); if (nx) nx.onclick = () => startLevel(level + 1);
    card.querySelector("#cwSelect").onclick = () => renderLevelSelect();
  }

  function showScreen(){ document.querySelectorAll(".screen").forEach(s => s.classList.remove("active")); $("#scr-cruci").classList.add("active"); }
  window.addEventListener("resize", () => { if (board && $("#cruciGrid")) drawGrid(); });

  return { open };
})();
