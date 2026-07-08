// ============================================================
// GAME QUIZ — CRUCI-QUIZ (crucigrama real estilo CodyCross)
// Cada nivel tiene una lista de palabras que se CRUZAN entre sí
// de verdad (horizontal y vertical, compartiendo letras), y una
// PALABRA/FRASE SECRETA que se lee en diagonal a través de una
// letra de cada palabra (celdas doradas numeradas).
// El avance se guarda en el teléfono (localStorage).
// ============================================================
const Cruci = (() => {
  // Cada nivel: { tema, secret, words:[{ w, p }] }
  // "secret" es la palabra o frase oculta (puede tener espacio, ej "EL DORADO").
  const LEVELS = [
    { tema:"Frutas 🍓", secret:"MELON", words:[
      { w:"MANZANA", p:"Roja o verde, la mordió Blancanieves" },
      { w:"FRESA", p:"Roja con pepitas, también llamada frutilla" },
      { w:"CIRUELA", p:"Morada; seca es una pasa" },
      { w:"DURAZNO", p:"Naranja, aterciopelado y con carozo" },
      { w:"BANANA", p:"Amarilla y alargada, favorita del mono" },
    ]},
    { tema:"Animales 🦁", secret:"TIGRE", words:[
      { w:"GATO", p:"Ronronea y cae de pie" },
      { w:"DELFIN", p:"Mamífero marino juguetón" },
      { w:"CANGURO", p:"Salta y lleva a su cría en bolsa" },
      { w:"PERRO", p:"El mejor amigo del humano" },
      { w:"ELEFANTE", p:"El más grande de tierra, con trompa" },
    ]},
    { tema:"Colores 🎨", secret:"VERDE", words:[
      { w:"VIOLETA", p:"Mezcla de azul y rojo" },
      { w:"CELESTE", p:"Azul clarito como el cielo" },
      { w:"MARRON", p:"Color del chocolate" },
      { w:"DORADO", p:"Color del oro" },
      { w:"BEIGE", p:"Tono claro entre crema y café" },
    ]},
    { tema:"Países 🌍", secret:"CHILE", words:[
      { w:"CANADA", p:"País de la hoja de arce" },
      { w:"CHINA", p:"El más poblado de Asia" },
      { w:"ITALIA", p:"País con forma de bota" },
      { w:"POLONIA", p:"Europeo, capital Varsovia" },
      { w:"GRECIA", p:"Cuna de la democracia" },
    ]},
    { tema:"Deportes ⚽", secret:"REMO", words:[
      { w:"KARATE", p:"Arte marcial de katas" },
      { w:"TENIS", p:"Raqueta y pelota amarilla" },
      { w:"GIMNASIA", p:"Saltos, giros y equilibrio" },
      { w:"NATACION", p:"Deporte dentro del agua" },
    ]},
    { tema:"Cuerpo 🫀", secret:"CODO", words:[
      { w:"BOCA", p:"Por aquí entran los alimentos" },
      { w:"HOMBRO", p:"Une el brazo con el tronco" },
      { w:"DEDO", p:"Hay diez en las manos" },
      { w:"CORAZON", p:"Bombea la sangre" },
    ]},
    { tema:"Cocina 🍳", secret:"SARTEN", words:[
      { w:"ENSALADA", p:"Mezcla fresca de verduras" },
      { w:"CUCHARA", p:"Sirve para la sopa" },
      { w:"HARINA", p:"Polvo blanco base del pan" },
      { w:"MANTEL", p:"Cubre la mesa" },
      { w:"PIMIENTA", p:"Especia que va con la sal" },
      { w:"TENEDOR", p:"Cubierto de púas" },
    ]},
    { tema:"Clima 🌦️", secret:"NIEVE", words:[
      { w:"TRUENO", p:"El sonido tras el relámpago" },
      { w:"GRANIZO", p:"Bolitas de hielo del cielo" },
      { w:"VIENTO", p:"Mueve las hojas y las cometas" },
      { w:"LLUVIA", p:"Cae del cielo y moja todo" },
      { w:"NUBE", p:"Algodón blanco en el cielo" },
    ]},
    { tema:"Escuela 📚", secret:"LAPIZ", words:[
      { w:"REGLA", p:"Mide y traza rectas" },
      { w:"MAPA", p:"Muestra países y ciudades" },
      { w:"PIZARRA", p:"Se escribe con tiza" },
      { w:"LIBRO", p:"Lleno de páginas para leer" },
      { w:"ALUMNO", p:"Va a clases para aprender" },
    ]},
    { tema:"Espacio 🚀", secret:"LUNA", words:[
      { w:"ESTRELLA", p:"Punto brillante en la noche" },
      { w:"PLUTON", p:"Planeta enano y helado" },
      { w:"SATURNO", p:"El planeta de los anillos" },
      { w:"MARTE", p:"El planeta rojo" },
    ]},
    { tema:"Música 🎵", secret:"PIANO", words:[
      { w:"TROMPETA", p:"Viento dorado y brillante" },
      { w:"BATERIA", p:"Tambores y platillos" },
      { w:"GUITARRA", p:"Seis cuerdas y caja de madera" },
      { w:"VIOLIN", p:"Se toca con arco y cuerdas" },
      { w:"SAXOFON", p:"Viento curvo del jazz" },
    ]},
    { tema:"Ropa 👕", secret:"GORRO", words:[
      { w:"ABRIGO", p:"Prenda gruesa para el frío" },
      { w:"ZAPATO", p:"Va en los pies" },
      { w:"POLERA", p:"Camiseta de manga corta" },
      { w:"SOMBRERO", p:"Cubre la cabeza, con ala" },
      { w:"PANTALON", p:"Cubre ambas piernas" },
    ]},
    { tema:"Naturaleza 🌳", secret:"RIO", words:[
      { w:"ARBOL", p:"Tronco, ramas y hojas" },
      { w:"ISLA", p:"Tierra rodeada de agua" },
      { w:"BOSQUE", p:"Muchos árboles juntos" },
    ]},
    { tema:"Transporte 🚗", secret:"AVION", words:[
      { w:"BARCO", p:"Navega por el mar" },
      { w:"AVIONETA", p:"Avión pequeño de hélice" },
      { w:"TAXI", p:"Auto de alquiler" },
      { w:"TRINEO", p:"Se desliza sobre la nieve" },
      { w:"CANOA", p:"Bote angosto a remo" },
    ]},
    { tema:"Cine 🎬", secret:"ACTOR", words:[
      { w:"CAMARA", p:"Graba las escenas" },
      { w:"ESCENA", p:"Cada parte de una película" },
      { w:"PANTALLA", p:"Donde se proyecta el film" },
      { w:"GUION", p:"El texto que dicen los actores" },
      { w:"ESTRENO", p:"La primera función" },
    ]},
    { tema:"Oficios 👷", secret:"MEDICO", words:[
      { w:"BOMBERO", p:"Apaga incendios" },
      { w:"MAESTRO", p:"Enseña en la escuela" },
      { w:"PANADERO", p:"Hace pan cada mañana" },
      { w:"PILOTO", p:"Conduce el avión" },
      { w:"CARPINTERO", p:"Trabaja la madera" },
      { w:"COCINERO", p:"Prepara los platos" },
    ]},
    { tema:"Bosque 🫐", secret:"MORA", words:[
      { w:"FRAMBUESA", p:"Roja, prima de la mora" },
      { w:"HELECHO", p:"Planta de hojas plumosas" },
      { w:"GROSELLA", p:"Racimos ácidos rojos o negros" },
      { w:"ARANDANO", p:"Azul, pequeño, antioxidante" },
    ]},
    { tema:"Herramientas ⚙️", secret:"MARTILLO", words:[
      { w:"MARTILLO", p:"Clava clavos" },
      { w:"DESTORNILLADOR", p:"Aprieta y saca tornillos" },
      { w:"SERRUCHO", p:"Corta la madera" },
      { w:"ALICATE", p:"Pinza para alambres" },
      { w:"NIVEL", p:"Verifica que algo esté derecho" },
      { w:"TALADRO", p:"Hace agujeros" },
      { w:"LLAVE", p:"Aprieta tuercas" },
      { w:"METRO", p:"Cinta que mide distancias" },
    ]},
    { tema:"Mitología ⚡", secret:"ZEUS", words:[
      { w:"ZOMBI", p:"Muerto que camina" },
      { w:"MEDUSA", p:"Serpientes por cabello" },
      { w:"CENTAURO", p:"Mitad hombre, mitad caballo" },
      { w:"HADES", p:"Dios del inframundo" },
    ]},
    { tema:"Postres 🍰", secret:"TORTA", words:[
      { w:"GALLETA", p:"Redonda y crujiente" },
      { w:"BROWNIE", p:"Cuadrado de chocolate húmedo" },
      { w:"ALFAJOR", p:"Dos tapas con dulce de leche" },
      { w:"TIRAMISU", p:"Postre italiano con café" },
      { w:"HELADO", p:"Se derrite si tardas" },
    ]},
  ];

  // ---- Generador de crucigrama real (cruces horizontales y verticales) ----
  // Coloca cada palabra cruzando alguna ya puesta (letra compartida real,
  // no solo contra una columna fija). Además intenta que la letra de cruce
  // de cada palabra coincida con la letra secreta que le corresponde, y que
  // esa celda quede lo más cerca posible de una diagonal (visual estilo
  // CodyCross). Si una palabra no logra cruzar a otra, se ubica aparte.
  function buildLayout(levelIdx){
    const lv = LEVELS[levelIdx];
    const secretRaw = lv.secret.toUpperCase();
    const secretLetters = secretRaw.replace(/[^A-ZÑ]/g, "").split("");
    const words = lv.words.map(e => ({ word: e.w.toUpperCase(), clue: e.p }));

    const grid = new Map(); // "r,c" -> letter
    const placed = []; // {word, clue, row, col, dir, len}

    const key = (r,c) => r + "," + c;
    function canPlace(word, row, col, dir){
      let touchesAny = false;
      for (let i = 0; i < word.length; i++){
        const r = dir === "V" ? row + i : row;
        const c = dir === "H" ? col + i : col;
        const existing = grid.get(key(r,c));
        if (existing){
          if (existing !== word[i]) return false;
          touchesAny = true;
        }
      }
      return { ok: true, touchesAny };
    }
    function commit(word, row, col, dir){
      for (let i = 0; i < word.length; i++){
        const r = dir === "V" ? row + i : row;
        const c = dir === "H" ? col + i : col;
        grid.set(key(r,c), word[i]);
      }
    }

    // primera palabra: horizontal en el origen
    const first = words[0];
    commit(first.word, 0, 0, "H");
    placed.push({ word: first.word, clue: first.clue, row: 0, col: 0, dir: "H" });

    for (let idx = 1; idx < words.length; idx++){
      const { word, clue } = words[idx];
      const wantedLetter = secretLetters[idx % secretLetters.length];
      let best = null, bestScore = -Infinity;

      for (const [k, letter] of grid.entries()){
        const [gr, gc] = k.split(",").map(Number);
        for (let i = 0; i < word.length; i++){
          if (word[i] !== letter) continue;
          for (const dir of ["H","V"]){
            const row = dir === "V" ? gr - i : gr;
            const col = dir === "H" ? gc - i : gc;
            const res = canPlace(word, row, col, dir);
            if (!res || !res.ok) continue;
            let score = 0;
            if (word[i] === wantedLetter) score += 15; // prioriza que cruce con la letra secreta que le toca
            score += res.touchesAny ? 2 : 0;
            score -= Math.abs(row) * 0.3 + Math.abs(col) * 0.3; // compacidad
            if (score > bestScore){ bestScore = score; best = { row, col, dir, crossIdx: i }; }
          }
        }
      }
      if (!best){
        // no cruzó con nada: la dejamos aparte, debajo de todo
        let minR = 0; for (const k of grid.keys()) minR = Math.min(minR, +k.split(",")[0]);
        best = { row: minR - 2 - idx, col: 0, dir: "H", crossIdx: -1 };
      }
      commit(word, best.row, best.col, best.dir);
      placed.push({ word, clue, row: best.row, col: best.col, dir: best.dir, crossIdx: best.crossIdx });
    }

    // normalizar para que todo tenga coordenadas >= 0
    let minR = Infinity, minC = Infinity, maxR = -Infinity, maxC = -Infinity;
    placed.forEach(p => {
      const len = p.word.length;
      const r0 = p.row, c0 = p.col;
      const r1 = p.dir === "V" ? p.row + len - 1 : p.row;
      const c1 = p.dir === "H" ? p.col + len - 1 : p.col;
      minR = Math.min(minR, r0, r1); maxR = Math.max(maxR, r0, r1);
      minC = Math.min(minC, c0, c1); maxC = Math.max(maxC, c0, c1);
    });
    placed.forEach(p => { p.row -= minR; p.col -= minC; });
    const rows = maxR - minR + 1, cols = maxC - minC + 1;

    // asignar celda "secreta" a cada palabra: la letra que coincide con la
    // secretLetters[idx % len] más cercana a su índice de cruce real
    placed.forEach((p, idx) => {
      const wanted = secretLetters[idx % secretLetters.length];
      let secretLocalIdx = p.word.indexOf(wanted);
      if (p.crossIdx >= 0 && p.word[p.crossIdx] === wanted) secretLocalIdx = p.crossIdx;
      if (secretLocalIdx < 0) secretLocalIdx = 0;
      p.secretLocalIdx = secretLocalIdx;
      p.secretOrder = idx; // orden en que se lee la palabra secreta
    });

    return { placed, rows, cols, secret: secretRaw, filled: placed.map(p => Array(p.word.length).fill("")) };
  }

  let level = 0, layout = null, activeEntry = 0, onExit = null;
  let hintsLeft = 3, hintResetAt = 0;
  const HINT_MAX = 3, HINT_COOLDOWN_MS = 30 * 60 * 1000;

  const $ = s => document.querySelector(s);
  function unlockedMax(){ return +(localStorage.getItem("gq_cruci_max") || 0); }
  function setUnlocked(n){ localStorage.setItem("gq_cruci_max", String(Math.max(unlockedMax(), n))); }

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

  // ---------- Selector de niveles ----------
  function renderLevelSelect(){
    const host = $("#cruciScreen");
    const maxU = unlockedMax();
    host.innerHTML = `
      <div class="cruci-head">
        <button class="cruci-back" id="cruciBackHome">‹</button>
        <h2>CRUCI-QUIZ 🧩</h2>
        <span class="cruci-sub">${Math.min(maxU+1,LEVELS.length)}/${LEVELS.length}</span>
      </div>
      <p class="cruci-tagline">Completa las palabras cruzadas y descubre la palabra secreta en diagonal.</p>
      <div class="cruci-levels" id="cruciLevels"></div>`;
    const grid = host.querySelector("#cruciLevels");
    LEVELS.forEach((lv, i) => {
      const locked = i > maxU;
      const done = i < maxU;
      const b = document.createElement("button");
      b.className = "cruci-lvl" + (locked ? " locked" : "") + (done ? " done" : "");
      b.innerHTML = locked
        ? `<span class="cl-lock">🔒</span><span class="cl-n">${i+1}</span>`
        : `<span class="cl-n">${i+1}</span><span class="cl-theme">${lv.tema}</span>${done?'<span class="cl-star">⭐</span>':''}`;
      if (!locked) b.onclick = () => startLevel(i);
      grid.appendChild(b);
    });
    host.querySelector("#cruciBackHome").onclick = () => { if (onExit) onExit(); };
    showScreen();
  }

  function startLevel(i){
    level = i;
    layout = buildLayout(i);
    activeEntry = firstUnsolvedEntry();
    renderBoard();
  }

  function firstUnsolvedEntry(){
    const idx = layout.filled.findIndex((f, i) => f.join("") !== layout.placed[i].word);
    return idx < 0 ? 0 : idx;
  }

  function isSolved(i){ return layout.filled[i].join("") === layout.placed[i].word; }

  // ---------- Tablero ----------
  function renderBoard(){
    const host = $("#cruciScreen");
    const lv = LEVELS[level];
    host.innerHTML = `
      <div class="cruci-head">
        <button class="cruci-back" id="cruciBackSel">‹</button>
        <h2>Nivel ${level+1} · ${lv.tema}</h2>
        <span class="cruci-sub">💡 ${hintsLeft}</span>
      </div>
      <div class="cruci-gridwrap"><div class="cruci-grid" id="cruciGrid"></div></div>
      <div class="cruci-clues" id="cruciClues"></div>
      <div class="cruci-keyboard" id="cruciKb"></div>`;
    host.querySelector("#cruciBackSel").onclick = () => renderLevelSelect();
    drawGrid();
    drawClues();
    drawKeyboard();
    showScreen();
  }

  function drawGrid(){
    const g = $("#cruciGrid");
    g.style.setProperty("--cols", layout.cols);
    g.innerHTML = "";
    // mapa de celdas ocupadas
    const cellMap = new Map();
    layout.placed.forEach((p, idx) => {
      for (let i = 0; i < p.word.length; i++){
        const r = p.dir === "V" ? p.row + i : p.row;
        const c = p.dir === "H" ? p.col + i : p.col;
        const k = r + "," + c;
        if (!cellMap.has(k)) cellMap.set(k, []);
        cellMap.get(k).push({ idx, li: i });
      }
    });
    for (let r = 0; r < layout.rows; r++){
      const rowEl = document.createElement("div");
      rowEl.className = "cruci-row";
      for (let c = 0; c < layout.cols; c++){
        const owners = cellMap.get(r + "," + c);
        const cell = document.createElement("div");
        if (!owners){ cell.className = "cruci-cell empty"; rowEl.appendChild(cell); continue; }
        cell.className = "cruci-cell";
        const primary = owners.find(o => o.idx === activeEntry) || owners[0];
        const solved = isSolved(primary.idx);
        const ch = layout.filled[primary.idx][primary.li];
        const isSecret = owners.some(o => o.li === layout.placed[o.idx].secretLocalIdx);
        if (isSecret) cell.classList.add("key");
        if (solved) cell.classList.add("solved");
        if (owners.some(o => o.idx === activeEntry)) cell.classList.add("active-cell");
        cell.textContent = ch || "";
        if (isSecret){
          const ownerSecret = owners.find(o => layout.placed[o.idx].secretLocalIdx === o.li);
          if (ownerSecret){
            const num = document.createElement("span");
            num.className = "cc-secretnum";
            num.textContent = layout.placed[ownerSecret.idx].secretOrder + 1;
            cell.appendChild(num);
          }
        }
        cell.onclick = () => {
          const clickable = owners.find(o => !isSolved(o.idx)) || owners[0];
          selectEntry(clickable.idx);
        };
        rowEl.appendChild(cell);
      }
      g.appendChild(rowEl);
    }
  }

  function drawClues(){
    const host = $("#cruciClues");
    host.innerHTML = "";
    layout.placed.forEach((p, idx) => {
      if (isSolved(idx)) return; // se borra la pista al resolverla
      const div = document.createElement("div");
      div.className = "cruci-clue-item" + (idx === activeEntry ? " active" : "");
      div.innerHTML = `<span class="cc-num">${idx+1}.</span> ${p.clue} <span class="cc-len">(${p.word.length} letras · ${p.dir === "H" ? "→" : "↓"})</span>`;
      div.onclick = () => selectEntry(idx);
      host.appendChild(div);
    });
    if (!host.children.length){
      host.innerHTML = `<div class="cruci-clue-item">¡Todas las palabras resueltas! 🎉</div>`;
    }
  }

  function selectEntry(idx){
    activeEntry = idx;
    drawGrid();
    drawClues();
  }

  function drawKeyboard(){
    const kb = $("#cruciKb");
    kb.innerHTML = "";
    const rowsK = ["QWERTYUIOP", "ASDFGHJKLÑ", "ZXCVBNM"];
    rowsK.forEach((line, idx) => {
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
      btn.textContent = `💡 Revelar una letra (${hintsLeft})`;
      btn.disabled = false;
      btn.classList.remove("disabled");
    } else {
      const msLeft = Math.max(0, hintResetAt - Date.now());
      const mins = Math.ceil(msLeft / 60000);
      btn.textContent = `⏳ Sin pistas · vuelven en ${mins} min`;
      btn.disabled = true;
      btn.classList.add("disabled");
    }
  }

  function nextEmpty(idx){ return layout.filled[idx].findIndex(x => !x); }

  function typeLetter(letter){
    if (isSolved(activeEntry)) return;
    const i = nextEmpty(activeEntry);
    if (i < 0) return;
    layout.filled[activeEntry][i] = letter;
    try { Sfx.pick(); } catch(e){}
    if (nextEmpty(activeEntry) < 0) checkWord(activeEntry);
    drawGrid();
  }
  function backspace(){
    if (isSolved(activeEntry)) return;
    const f = layout.filled[activeEntry];
    for (let i = f.length - 1; i >= 0; i--){ if (f[i]){ f[i] = ""; break; } }
    drawGrid();
  }
  function revealOne(){
    if (isSolved(activeEntry)) return;
    const i = nextEmpty(activeEntry);
    if (i < 0) return;
    if (!useHint()){ updateHintLabel(); return; }
    layout.filled[activeEntry][i] = layout.placed[activeEntry].word[i];
    try { Sfx.click(); } catch(e){}
    if (nextEmpty(activeEntry) < 0) checkWord(activeEntry);
    drawGrid();
    updateHintLabel();
  }

  function checkWord(idx){
    const p = layout.placed[idx];
    if (layout.filled[idx].join("") === p.word){
      try { Sfx.correct(); } catch(e){}
      try { if (typeof Fun !== "undefined"){ const g = $("#cruciGrid").getBoundingClientRect(); Fun.floatUp("✨", g.left+g.width/2, g.top+40, 5); } } catch(e){}
      drawClues();
      if (layout.placed.every((_, i) => isSolved(i))) setTimeout(levelComplete, 500);
      else setTimeout(() => { selectEntry(firstUnsolvedEntry()); }, 400);
    } else {
      try { Sfx.wrong(); } catch(e){}
      const gridEl = $("#cruciGrid");
      if (gridEl){ gridEl.classList.add("shake"); setTimeout(() => gridEl.classList.remove("shake"), 400); }
      setTimeout(() => { layout.filled[idx] = layout.filled[idx].map((ch, i) => ch === p.word[i] ? ch : ""); drawGrid(); }, 450);
    }
  }

  function levelComplete(){
    try { Sfx.fanfare(); } catch(e){}
    try { if (typeof Fun !== "undefined"){ Fun.confetti(80); Fun.burst(["🎉","🧩","⭐","🔑"], 12); } } catch(e){}
    setUnlocked(level + 1);
    const host = $("#cruciScreen");
    const isLast = level + 1 >= LEVELS.length;
    const card = document.createElement("div");
    card.className = "cruci-win";
    card.innerHTML = `
      <div class="cw-box">
        <div class="cw-emoji">🔑</div>
        <p class="cw-label">Palabra secreta</p>
        <div class="cw-key">${layout.secret.split("").map(c => c === " " ? `<span class="cw-space"></span>` : `<span>${c}</span>`).join("")}</div>
        <p class="cw-msg">¡Nivel ${level+1} completado! 🎉</p>
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

  return { open };
})();
