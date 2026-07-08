// ============================================================
// CRUCI-QUIZ — Crucigrama estilo CodyCross 100% lleno
// Grid compacto, todas las celdas ocupadas, pista contextual
// ============================================================
const Cruci = (() => {
  // Cada nivel es un grid NxM totalmente lleno.
  // entries: [{word, clue, row, col, dir:"H"|"V", num}]
  // secret: palabra oculta (se arma en diagonal de celdas doradas)
  // grid: array 2D con letra de cada celda
  const LEVELS = [
    {
      name: "Frutas", emoji: "🍓", secret: "MELON",
      size: { r: 8, c: 8 },
      grid: [
        "MANZANAV",
        "ASNORLAO",
        "NAUATEAR",
        "ZREAIZAQ",
        "APNOLANL",
        "NACIRUEL",
        "AILADNEA",
        "VANANAAB"
      ],
      entries: [
        { num: 1, word: "MANZANA", clue: "Roja o verde, la mordió Blancanieves", row: 0, col: 0, dir: "H" },
        { num: 2, word: "FRESA", clue: "Roja con pepitas, también llamada frutilla", row: 0, col: 7, dir: "V" },
        { num: 3, word: "BANANA", clue: "Amarilla y alargada, favorita del mono", row: 7, col: 2, dir: "H" },
        { num: 4, word: "CIRUELA", clue: "Morada; seca es una pasa", row: 5, col: 3, dir: "H" },
        { num: 5, word: "DURAZNO", clue: "Naranja, aterciopelado y con carozo", row: 2, col: 7, dir: "V" },
      ],
      secretCells: [
        { row: 0, col: 4, letter: "M" }, // MANZANA[4]
        { row: 1, col: 3, letter: "E" }, // FRESA vertical[1] 
        { row: 4, col: 0, letter: "L" },
        { row: 6, col: 5, letter: "O" },
        { row: 7, col: 6, letter: "N" }
      ]
    },
    {
      name: "Animales", emoji: "🦁", secret: "TIGRE",
      size: { r: 8, c: 8 },
      grid: [
        "GATOSCAN",
        "ARLOETOD",
        "TDMAROOE",
        "OPFINNFL",
        "ELINGARF",
        "LPELICAI",
        "ABEOAUAN",
        "NATURENO"
      ],
      entries: [
        { num: 1, word: "GATO", clue: "Ronronea y cae de pie", row: 0, col: 0, dir: "H" },
        { num: 2, word: "PERRO", clue: "El mejor amigo del humano", row: 0, col: 4, dir: "V" },
        { num: 3, word: "DELFIN", clue: "Mamífero marino juguetón", row: 2, col: 6, dir: "V" },
        { num: 4, word: "CANGURO", clue: "Salta y lleva a su cría en bolsa", row: 0, col: 7, dir: "V" },
        { num: 5, word: "ELEFANTE", clue: "El más grande de tierra, con trompa", row: 4, col: 1, dir: "H" },
      ],
      secretCells: [
        { row: 0, col: 4, letter: "T" },
        { row: 1, col: 5, letter: "I" },
        { row: 3, col: 4, letter: "G" },
        { row: 5, col: 2, letter: "R" },
        { row: 7, col: 3, letter: "E" }
      ]
    },
    {
      name: "Países", emoji: "🌍", secret: "CHILE",
      size: { r: 8, c: 8 },
      grid: [
        "CANADAIR",
        "AINAIHEL",
        "NITCUASE",
        "AOLVAOIA",
        "DIANA",
        "AROGIRLT",
        "LAELECIA",
        "APOLONIA"
      ],
      entries: [
        { num: 1, word: "CANADA", clue: "País de la hoja de arce", row: 0, col: 0, dir: "H" },
        { num: 2, word: "ITALIA", clue: "País con forma de bota", row: 1, col: 4, dir: "H" },
        { num: 3, word: "CHINA", clue: "El más poblado de Asia", row: 0, col: 6, dir: "V" },
        { num: 4, word: "GRECIA", clue: "Cuna de la democracia", row: 6, col: 1, dir: "H" },
        { num: 5, word: "POLONIA", clue: "Europeo, capital Varsovia", row: 7, col: 1, dir: "H" },
      ],
      secretCells: [
        { row: 0, col: 1, letter: "C" },
        { row: 2, col: 4, letter: "H" },
        { row: 4, col: 0, letter: "I" },
        { row: 6, col: 2, letter: "L" },
        { row: 7, col: 3, letter: "E" }
      ]
    },
    {
      name: "Deportes", emoji: "⚽", secret: "REMO",
      size: { r: 7, c: 8 },
      grid: [
        "KARATEAM",
        "AENEISOE",
        "RISRNTEM",
        "AITSNECI",
        "TAQNINAC",
        "EAGIMUAG",
        "ENACITAN"
      ],
      entries: [
        { num: 1, word: "KARATE", clue: "Arte marcial de katas", row: 0, col: 0, dir: "H" },
        { num: 2, word: "TENIS", clue: "Raqueta y pelota amarilla", row: 0, col: 6, dir: "V" },
        { num: 3, word: "GIMNASIA", clue: "Saltos, giros y equilibrio", row: 2, col: 2, dir: "H" },
        { num: 4, word: "NATACION", clue: "Deporte dentro del agua", row: 6, col: 2, dir: "H" },
      ],
      secretCells: [
        { row: 0, col: 6, letter: "R" },
        { row: 1, col: 7, letter: "E" },
        { row: 2, col: 7, letter: "M" },
        { row: 4, col: 6, letter: "O" }
      ]
    },
    {
      name: "Cuerpo", emoji: "🫀", secret: "CODO",
      size: { r: 8, c: 8 },
      grid: [
        "BOCADEDO",
        "OEMBOSRO",
        "CORALZOS",
        "ACAOASON",
        "REZONARA",
        "ADNCDAHO",
        "OZOLOOBA",
        "ZORABANO"
      ],
      entries: [
        { num: 1, word: "BOCA", clue: "Por aquí entran los alimentos", row: 0, col: 0, dir: "H" },
        { num: 2, word: "HOMBRO", clue: "Une el brazo con el tronco", row: 0, col: 7, dir: "V" },
        { num: 3, word: "DEDO", clue: "Hay diez en las manos", row: 0, col: 4, dir: "H" },
        { num: 4, word: "CORAZON", clue: "Bombea la sangre", row: 2, col: 0, dir: "H" },
        { num: 5, word: "NARIZ", clue: "Dos agujeros, por donde respiramos", row: 4, col: 3, dir: "V" },
      ],
      secretCells: [
        { row: 0, col: 0, letter: "C" },
        { row: 1, col: 1, letter: "O" },
        { row: 2, col: 2, letter: "D" },
        { row: 3, col: 3, letter: "O" }
      ]
    },
    {
      name: "Escuela", emoji: "📚", secret: "LAPIZ",
      size: { r: 8, c: 8 },
      grid: [
        "REGLAZAP",
        "EASMAPAI",
        "GTADALAR",
        "LLAONZAA",
        "AALBIRMA",
        "LLUSTREP",
        "ALUMNOTA",
        "ZAALOMAO"
      ],
      entries: [
        { num: 1, word: "REGLA", clue: "Mide y traza rectas", row: 0, col: 0, dir: "H" },
        { num: 2, word: "LAPIZ", clue: "Escribe en el papel", row: 0, col: 6, dir: "V" },
        { num: 3, word: "MAPA", clue: "Muestra países y ciudades", row: 1, col: 4, dir: "H" },
        { num: 4, word: "PIZARRA", clue: "Se escribe con tiza", row: 2, col: 6, dir: "V" },
        { num: 5, word: "LIBRO", clue: "Lleno de páginas para leer", row: 4, col: 3, dir: "H" },
        { num: 6, word: "ALUMNO", clue: "Va a clases para aprender", row: 6, col: 1, dir: "H" },
      ],
      secretCells: [
        { row: 0, col: 6, letter: "L" },
        { row: 1, col: 7, letter: "A" },
        { row: 3, col: 6, letter: "P" },
        { row: 5, col: 5, letter: "I" },
        { row: 6, col: 6, letter: "Z" }
      ]
    },
    {
      name: "Clima", emoji: "🌦️", secret: "NIEVE",
      size: { r: 8, c: 8 },
      grid: [
        "TRUENOAN",
        "RLUVIANE",
        "UAREORVI",
        "EANOZAZE",
        "NEPVIENT",
        "OIIIHELO",
        "ZELOVTUA",
        "NABIELTA"
      ],
      entries: [
        { num: 1, word: "TRUENO", clue: "Sonido tras el relámpago", row: 0, col: 0, dir: "H" },
        { num: 2, word: "LLUVIA", clue: "Cae del cielo y moja todo", row: 1, col: 1, dir: "H" },
        { num: 3, word: "NUBE", clue: "Algodón blanco en el cielo", row: 2, col: 5, dir: "V" },
        { num: 4, word: "GRANIZO", clue: "Bolitas de hielo del cielo", row: 3, col: 2, dir: "H" },
        { num: 5, word: "VIENTO", clue: "Mueve las hojas y cometas", row: 4, col: 3, dir: "H" },
      ],
      secretCells: [
        { row: 0, col: 7, letter: "N" },
        { row: 1, col: 7, letter: "I" },
        { row: 2, col: 7, letter: "E" },
        { row: 3, col: 7, letter: "V" },
        { row: 4, col: 7, letter: "E" }
      ]
    },
    {
      name: "Música", emoji: "🎵", secret: "PIANO",
      size: { r: 8, c: 8 },
      grid: [
        "TROMPETA",
        "RAAOBINT",
        "OTAAATAA",
        "MSIATANR",
        "PIVILONN",
        "EAAOXSAO",
        "TBATORON",
        "AAGUITAR"
      ],
      entries: [
        { num: 1, word: "TROMPETA", clue: "Viento dorado y brillante", row: 0, col: 0, dir: "H" },
        { num: 2, word: "BATERIA", clue: "Tambores y platillos", row: 1, col: 1, dir: "V" },
        { num: 3, word: "GUITARRA", clue: "Seis cuerdas y caja de madera", row: 7, col: 1, dir: "H" },
        { num: 4, word: "VIOLIN", clue: "Se toca con arco", row: 4, col: 0, dir: "H" },
        { num: 5, word: "SAXOFON", clue: "Viento curvo del jazz", row: 1, col: 7, dir: "V" },
      ],
      secretCells: [
        { row: 0, col: 5, letter: "P" },
        { row: 1, col: 6, letter: "I" },
        { row: 2, col: 7, letter: "A" },
        { row: 4, col: 2, letter: "N" },
        { row: 5, col: 6, letter: "O" }
      ]
    },
    {
      name: "Ropa", emoji: "👕", secret: "GORRO",
      size: { r: 8, c: 8 },
      grid: [
        "ABRIGOGA",
        "BRETOSEO",
        "RIPEZOAR",
        "IAZOTAOR",
        "GOCORROT",
        "OPEADORE",
        "SOMBRAOA",
        "AMANEGAO"
      ],
      entries: [
        { num: 1, word: "ABRIGO", clue: "Prenda gruesa para el frío", row: 0, col: 0, dir: "H" },
        { num: 2, word: "ZAPATO", clue: "Va en los pies", row: 2, col: 3, dir: "H" },
        { num: 3, word: "POLERA", clue: "Camiseta de manga corta", row: 1, col: 4, dir: "V" },
        { num: 4, word: "SOMBRERO", clue: "Cubre la cabeza con ala", row: 6, col: 0, dir: "H" },
        { num: 5, word: "PANTALON", clue: "Cubre ambas piernas", row: 4, col: 1, dir: "H" },
      ],
      secretCells: [
        { row: 0, col: 6, letter: "G" },
        { row: 1, col: 7, letter: "O" },
        { row: 2, col: 7, letter: "R" },
        { row: 4, col: 3, letter: "R" },
        { row: 6, col: 4, letter: "O" }
      ]
    }
  ];

  let level = 0, state = null, activeNum = 0, onExit = null;
  let hintsLeft = 3, hintResetAt = 0;
  const HINT_MAX = 3, HINT_COOLDOWN_MS = 30 * 60 * 1000;

  const $ = s => document.querySelector(s);
  const unlockedMax = () => +(localStorage.getItem("gq_cruci_max") || 0);
  const setUnlocked = n => localStorage.setItem("gq_cruci_max", String(Math.max(unlockedMax(), n)));

  function loadHints(){
    hintsLeft = +(localStorage.getItem("gq_cruci_hints") ?? HINT_MAX);
    hintResetAt = +(localStorage.getItem("gq_cruci_hint_reset") || 0);
    if (hintsLeft < HINT_MAX && Date.now() >= hintResetAt){
      hintsLeft = HINT_MAX;
      saveHints();
    }
  }
  function saveHints(){
    localStorage.setItem("gq_cruci_hints", String(hintsLeft));
    localStorage.setItem("gq_cruci_hint_reset", String(hintResetAt));
  }
  function useHint(){
    if (hintsLeft <= 0) return false;
    hintsLeft--;
    if (hintsLeft === 0) hintResetAt = Date.now() + HINT_COOLDOWN_MS;
    saveHints();
    return true;
  }

  function open(exitCb){
    onExit = exitCb || null;
    loadHints();
    renderLevelSelect();
  }

  function renderLevelSelect(){
    const host = $("#cruciScreen");
    const maxU = unlockedMax();
    host.innerHTML = `
      <div class="cruci-head">
        <button class="cruci-back" id="cruciBackHome">‹</button>
        <h2>CRUCI-QUIZ 🧩</h2>
        <span class="cruci-sub">${Math.min(maxU+1,LEVELS.length)}/${LEVELS.length}</span>
      </div>
      <p class="cruci-tagline">Completa las palabras cruzadas y descubre la palabra secreta.</p>
      <div class="cruci-levels" id="cruciLevels"></div>`;
    const grid = host.querySelector("#cruciLevels");
    LEVELS.forEach((lv, i) => {
      const locked = i > maxU;
      const done = i < maxU;
      const b = document.createElement("button");
      b.className = "cruci-lvl" + (locked ? " locked" : "") + (done ? " done" : "");
      b.innerHTML = locked
        ? `<span class="cl-lock">🔒</span><span class="cl-n">${i+1}</span>`
        : `<span class="cl-n">${i+1}</span><span class="cl-theme">${lv.emoji} ${lv.name}</span>${done?'<span class="cl-star">⭐</span>':''}`;
      if (!locked) b.onclick = () => startLevel(i);
      grid.appendChild(b);
    });
    host.querySelector("#cruciBackHome").onclick = () => { if (onExit) onExit(); };
    showScreen();
  }

  function startLevel(i){
    level = i;
    const lv = LEVELS[i];
    state = {
      filled: lv.grid.map(row => row.split("").map(() => "")),
      lv
    };
    activeNum = lv.entries[0].num;
    renderBoard();
  }

  function renderBoard(){
    const host = $("#cruciScreen");
    const lv = state.lv;
    host.innerHTML = `
      <div class="cruci-head">
        <button class="cruci-back" id="cruciBackSel">‹</button>
        <h2>Nivel ${level+1}: ${lv.emoji} ${lv.name}</h2>
        <span class="cruci-sub">💡 ${hintsLeft}</span>
      </div>
      <div class="cruci-board">
        <div class="cruci-grid" id="cruciGrid"></div>
        <div class="cruci-clue" id="cruciClue"></div>
      </div>
      <div class="cruci-keyboard" id="cruciKb"></div>`;
    host.querySelector("#cruciBackSel").onclick = () => renderLevelSelect();
    drawGrid();
    updateClue();
    drawKeyboard();
    showScreen();
  }

  function getActivePair(){
    const lv = state.lv;
    const hEntry = lv.entries.find(e => e.num === activeNum && e.dir === "H");
    const vEntry = lv.entries.find(e => e.num === activeNum && e.dir === "V");
    return { h: hEntry, v: vEntry };
  }

  function drawGrid(){
    const g = $("#cruciGrid");
    const lv = state.lv;
    const { h, v } = getActivePair();
    g.innerHTML = "";
    g.style.setProperty("--cols", lv.size.c);
    for (let r = 0; r < lv.size.r; r++){
      const row = document.createElement("div");
      row.className = "cruci-row";
      for (let c = 0; c < lv.size.c; c++){
        const cell = document.createElement("div");
        cell.className = "cruci-cell";
        const ch = state.filled[r][c];
        const isSecret = lv.secretCells.some(sc => sc.row === r && sc.col === c);
        if (isSecret) cell.classList.add("key");
        
        const isActive = (h && h.row === r && h.col <= c && c < h.col + h.word.length) ||
                         (v && v.col === c && v.row <= r && r < v.row + v.word.length);
        if (isActive) cell.classList.add("active-cell");
        
        const hHasNum = lv.entries.some(e => e.dir === "H" && e.row === r && e.col === c);
        const vHasNum = lv.entries.some(e => e.dir === "V" && e.col === c && e.row === r);
        if (hHasNum || vHasNum){
          const num = lv.entries.find(e => (e.dir === "H" || e.dir === "V") && e.row === r && e.col === c).num;
          const numSpan = document.createElement("span");
          numSpan.className = "cc-num";
          numSpan.textContent = num;
          cell.appendChild(numSpan);
        }
        
        if (ch) cell.textContent = ch;
        
        cell.onclick = () => selectCell(r, c);
        row.appendChild(cell);
      }
      g.appendChild(row);
    }
  }

  function selectCell(r, c){
    const lv = state.lv;
    const hEntry = lv.entries.find(e => e.dir === "H" && e.row === r && e.col <= c && c < e.col + e.word.length);
    const vEntry = lv.entries.find(e => e.dir === "V" && e.col === c && e.row <= r && r < e.row + e.word.length);
    if (hEntry || vEntry) activeNum = (hEntry || vEntry).num;
    drawGrid();
    updateClue();
  }

  function updateClue(){
    const lv = state.lv;
    const { h, v } = getActivePair();
    const clue = $("#cruciClue");
    if (h && v){
      clue.innerHTML = `<div style="font-size:12px;opacity:.7">${h.num}H. ${h.clue} | ${v.num}V. ${v.clue}</div>`;
    } else if (h){
      clue.innerHTML = `<div>${h.num}→ ${h.clue}</div>`;
    } else if (v){
      clue.innerHTML = `<div>${v.num}↓ ${v.clue}</div>`;
    }
  }

  function drawKeyboard(){
    const kb = $("#cruciKb");
    kb.innerHTML = "";
    const rows = ["QWERTYUIOP", "ASDFGHJKLÑ", "ZXCVBNM"];
    rows.forEach((line, idx) => {
      const rowEl = document.createElement("div");
      rowEl.className = "ckb-row";
      line.split("").forEach(letter => {
        const b = document.createElement("button");
        b.className = "ckb-key";
        b.textContent = letter;
        b.onclick = () => typeLetter(letter);
        rowEl.appendChild(b);
      });
      if (idx === 2){
        const del = document.createElement("button");
        del.className = "ckb-key ckb-del";
        del.textContent = "⌫";
        del.onclick = backspace;
        rowEl.appendChild(del);
      }
      kb.appendChild(rowEl);
    });
    const hintRow = document.createElement("div");
    hintRow.className = "ckb-row";
    const hint = document.createElement("button");
    hint.className = "ckb-hint";
    updateHintLabel(hint);
    hint.onclick = revealOne;
    hintRow.appendChild(hint);
    kb.appendChild(hintRow);
  }

  function updateHintLabel(btn){
    btn = btn || $(".ckb-hint");
    if (!btn) return;
    if (hintsLeft > 0){
      btn.textContent = `💡 Revelar (${hintsLeft})`;
      btn.disabled = false;
      btn.classList.remove("disabled");
    } else {
      const msLeft = Math.max(0, hintResetAt - Date.now());
      const mins = Math.ceil(msLeft / 60000);
      btn.textContent = `⏳ Próximas pistas en ${mins}m`;
      btn.disabled = true;
      btn.classList.add("disabled");
    }
  }

  function typeLetter(letter){
    const lv = state.lv;
    const { h, v } = getActivePair();
    const entries = [h, v].filter(Boolean);
    if (!entries.length) return;
    
    for (const entry of entries){
      for (let i = 0; i < entry.word.length; i++){
        const r = entry.dir === "V" ? entry.row + i : entry.row;
        const c = entry.dir === "H" ? entry.col + i : entry.col;
        if (!state.filled[r][c]){
          state.filled[r][c] = letter.toUpperCase();
          try { Sfx.pick(); } catch(e){}
          drawGrid();
          checkComplete();
          return;
        }
      }
    }
  }

  function backspace(){
    const lv = state.lv;
    const { h, v } = getActivePair();
    const entries = [h, v].filter(Boolean);
    if (!entries.length) return;
    for (const entry of entries){
      for (let i = entry.word.length - 1; i >= 0; i--){
        const r = entry.dir === "V" ? entry.row + i : entry.row;
        const c = entry.dir === "H" ? entry.col + i : entry.col;
        if (state.filled[r][c]){
          state.filled[r][c] = "";
          drawGrid();
          return;
        }
      }
    }
  }

  function revealOne(){
    const lv = state.lv;
    const { h, v } = getActivePair();
    const entries = [h, v].filter(Boolean);
    if (!entries.length) return;
    if (!useHint()){ updateHintLabel(); return; }
    for (const entry of entries){
      for (let i = 0; i < entry.word.length; i++){
        const r = entry.dir === "V" ? entry.row + i : entry.row;
        const c = entry.dir === "H" ? entry.col + i : entry.col;
        if (!state.filled[r][c]){
          state.filled[r][c] = entry.word[i];
          try { Sfx.click(); } catch(e){}
          drawGrid();
          checkComplete();
          updateHintLabel();
          return;
        }
      }
    }
  }

  function checkComplete(){
    const lv = state.lv;
    let allFilled = true;
    for (let r = 0; r < lv.size.r; r++){
      for (let c = 0; c < lv.size.c; c++){
        if (!state.filled[r][c]) { allFilled = false; break; }
      }
      if (!allFilled) break;
    }
    if (allFilled) levelComplete();
  }

  function levelComplete(){
    try { Sfx.fanfare(); } catch(e){}
    try { if (typeof Fun !== "undefined"){ Fun.confetti(80); Fun.burst(["🎉","🧩","⭐","🔑"], 12); } } catch(e){}
    setUnlocked(level + 1);
    const host = $("#cruciScreen");
    const lv = LEVELS[level];
    const isLast = level + 1 >= LEVELS.length;
    const card = document.createElement("div");
    card.className = "cruci-win";
    card.innerHTML = `
      <div class="cw-box">
        <div class="cw-emoji">🔑</div>
        <p class="cw-label">Palabra secreta</p>
        <div class="cw-key">${lv.secret.split("").map(c => c === " " ? `<span class="cw-space"></span>` : `<span>${c}</span>`).join("")}</div>
        <p class="cw-msg">¡Nivel ${level+1} completado! 🎉</p>
        <div class="cw-btns">
          ${isLast ? "" : `<button class="btn big btn-green" id="cwNext">Siguiente nivel ▶</button>`}
          <button class="btn ghost" id="cwSelect">Elegir nivel</button>
        </div>
        ${isLast ? '<p class="cw-msg">¡Todos los niveles completados! Pronto habrá más 🚀</p>' : ""}
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

  return { open };
})();
