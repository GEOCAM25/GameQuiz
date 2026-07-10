// ============================================================
// GAME QUIZ — CRUCI-QUIZ (juego individual estilo crucigrama)
// 20 niveles. En cada nivel todas las palabras tienen la MISMA
// cantidad de letras y comparten una letra con la palabra CLAVE
// vertical. Vas eligiendo una pista, escribes la palabra con el
// teclado en pantalla, y al completarlas todas se revela la clave.
// Las pistas son propias (no copiadas de ningún otro juego).
// El avance se guarda en el teléfono (localStorage).
// ============================================================
const Cruci = (() => {
  // Cada nivel: { tema, clave, palabras:[{ palabra, pista }] }
  // La CLAVE vertical se arma con una letra de cada palabra (la que
  // coincide en la columna de cruce). Todas las palabras miden lo mismo.
  const LEVELS = [
    { tema:"Frutas 🍓", clave:"MELON", words:[
      { w:"MANZANA", p:"Roja o verde, la mordió Blancanieves" },
      { w:"FRESA", p:"Roja con pepitas, también llamada frutilla" },
      { w:"CIRUELA", p:"Morada; seca es una pasa" },
      { w:"DURAZNO", p:"Naranja, aterciopelado y con carozo" },
      { w:"BANANA", p:"Amarilla y alargada, favorita del mono" },
    ]},
    { tema:"Animales 🦁", clave:"TIGRE", words:[
      { w:"GATO", p:"Ronronea y cae de pie" },
      { w:"DELFIN", p:"Mamífero marino juguetón" },
      { w:"CANGURO", p:"Salta y lleva a su cría en bolsa" },
      { w:"PERRO", p:"El mejor amigo del humano" },
      { w:"ELEFANTE", p:"El más grande de tierra, con trompa" },
    ]},
    { tema:"Colores 🎨", clave:"VERDE", words:[
      { w:"VIOLETA", p:"Mezcla de azul y rojo" },
      { w:"CELESTE", p:"Azul clarito como el cielo" },
      { w:"MARRON", p:"Color del chocolate" },
      { w:"DORADO", p:"Color del oro" },
      { w:"BEIGE", p:"Tono claro entre crema y café" },
    ]},
    { tema:"Países 🌍", clave:"CHILE", words:[
      { w:"CANADA", p:"País de la hoja de arce" },
      { w:"CHINA", p:"El más poblado de Asia" },
      { w:"ITALIA", p:"País con forma de bota" },
      { w:"POLONIA", p:"Europeo, capital Varsovia" },
      { w:"GRECIA", p:"Cuna de la democracia" },
    ]},
    { tema:"Deportes ⚽", clave:"REMO", words:[
      { w:"KARATE", p:"Arte marcial de katas" },
      { w:"TENIS", p:"Raqueta y pelota amarilla" },
      { w:"GIMNASIA", p:"Saltos, giros y equilibrio" },
      { w:"NATACION", p:"Deporte dentro del agua" },
    ]},
    { tema:"Cuerpo 🫀", clave:"CODO", words:[
      { w:"BOCA", p:"Por aquí entran los alimentos" },
      { w:"HOMBRO", p:"Une el brazo con el tronco" },
      { w:"DEDO", p:"Hay diez en las manos" },
      { w:"CORAZON", p:"Bombea la sangre" },
    ]},
    { tema:"Cocina 🍳", clave:"SARTEN", words:[
      { w:"ENSALADA", p:"Mezcla fresca de verduras" },
      { w:"CUCHARA", p:"Sirve para la sopa" },
      { w:"HARINA", p:"Polvo blanco base del pan" },
      { w:"MANTEL", p:"Cubre la mesa" },
      { w:"PIMIENTA", p:"Especia que va con la sal" },
      { w:"TENEDOR", p:"Cubierto de púas" },
    ]},
    { tema:"Clima 🌦️", clave:"NIEVE", words:[
      { w:"TRUENO", p:"El sonido tras el relámpago" },
      { w:"GRANIZO", p:"Bolitas de hielo del cielo" },
      { w:"VIENTO", p:"Mueve las hojas y las cometas" },
      { w:"LLUVIA", p:"Cae del cielo y moja todo" },
      { w:"NUBE", p:"Algodón blanco en el cielo" },
    ]},
    { tema:"Escuela 📚", clave:"LAPIZ", words:[
      { w:"REGLA", p:"Mide y traza rectas" },
      { w:"MAPA", p:"Muestra países y ciudades" },
      { w:"PIZARRA", p:"Se escribe con tiza" },
      { w:"LIBRO", p:"Lleno de páginas para leer" },
      { w:"ZAPALLO", p:"(trampa) — no aplica" },
    ]},
    { tema:"Espacio 🚀", clave:"LUNA", words:[
      { w:"ESTRELLA", p:"Punto brillante en la noche" },
      { w:"PLUTON", p:"Planeta enano y helado" },
      { w:"SATURNO", p:"El planeta de los anillos" },
      { w:"MARTE", p:"El planeta rojo" },
    ]},
    { tema:"Música 🎵", clave:"PIANO", words:[
      { w:"TROMPETA", p:"Viento dorado y brillante" },
      { w:"BATERIA", p:"Tambores y platillos" },
      { w:"GUITARRA", p:"Seis cuerdas y caja de madera" },
      { w:"VIOLIN", p:"Se toca con arco y cuerdas" },
      { w:"SAXOFON", p:"Viento curvo del jazz" },
    ]},
    { tema:"Ropa 👕", clave:"GORRO", words:[
      { w:"ABRIGO", p:"Prenda gruesa para el frío" },
      { w:"ZAPATO", p:"Va en los pies" },
      { w:"POLERA", p:"Camiseta de manga corta" },
      { w:"SOMBRERO", p:"Cubre la cabeza, con ala" },
      { w:"PANTALON", p:"Cubre ambas piernas" },
    ]},
    { tema:"Naturaleza 🌳", clave:"RIO", words:[
      { w:"ARBOL", p:"Tronco, ramas y hojas" },
      { w:"ISLA", p:"Tierra rodeada de agua" },
      { w:"BOSQUE", p:"Muchos árboles juntos" },
    ]},
    { tema:"Transporte 🚗", clave:"AVION", words:[
      { w:"BARCO", p:"Navega por el mar" },
      { w:"AVIONETA", p:"Avión pequeño de hélice" },
      { w:"TAXI", p:"Auto de alquiler" },
      { w:"TRINEO", p:"Se desliza sobre la nieve" },
      { w:"CANOA", p:"Bote angosto a remo" },
    ]},
    { tema:"Cine 🎬", clave:"ACTOR", words:[
      { w:"CAMARA", p:"Graba las escenas" },
      { w:"ESCENA", p:"Cada parte de una película" },
      { w:"PANTALLA", p:"Donde se proyecta el film" },
      { w:"GUION", p:"El texto que dicen los actores" },
      { w:"ESTRENO", p:"La primera función" },
    ]},
    { tema:"Oficios 👷", clave:"MEDICO", words:[
      { w:"BOMBERO", p:"Apaga incendios" },
      { w:"MAESTRO", p:"Enseña en la escuela" },
      { w:"PANADERO", p:"Hace pan cada mañana" },
      { w:"PILOTO", p:"Conduce el avión" },
      { w:"CARPINTERO", p:"Trabaja la madera" },
      { w:"COCINERO", p:"Prepara los platos" },
    ]},
    { tema:"Bosque 🫐", clave:"MORA", words:[
      { w:"FRAMBUESA", p:"Roja, prima de la mora" },
      { w:"HELECHO", p:"Planta de hojas plumosas" },
      { w:"GROSELLA", p:"Racimos ácidos rojos o negros" },
      { w:"ARANDANO", p:"Azul, pequeño, antioxidante" },
    ]},
    { tema:"Herramientas ⚙️", clave:"MARTILLO", words:[
      { w:"MARTILLO", p:"Clava clavos" },
      { w:"DESTORNILLADOR", p:"Aprieta y saca tornillos" },
      { w:"SERRUCHO", p:"Corta la madera" },
      { w:"ALICATE", p:"Pinza para alambres" },
      { w:"NIVEL", p:"Verifica que algo esté derecho" },
      { w:"TALADRO", p:"Hace agujeros" },
      { w:"LLAVE", p:"Aprieta tuercas" },
      { w:"METRO", p:"Cinta que mide distancias" },
    ]},
    { tema:"Mitología ⚡", clave:"ZEUS", words:[
      { w:"ZOMBI", p:"Muerto que camina" },
      { w:"MEDUSA", p:"Serpientes por cabello" },
      { w:"CENTAURO", p:"Mitad hombre, mitad caballo" },
      { w:"HADES", p:"Dios del inframundo" },
    ]},
    { tema:"Postres 🍰", clave:"TORTA", words:[
      { w:"GALLETA", p:"Redonda y crujiente" },
      { w:"BROWNIE", p:"Cuadrado de chocolate húmedo" },
      { w:"ALFAJOR", p:"Dos tapas con dulce de leche" },
      { w:"TIRAMISU", p:"Postre italiano con café" },
      { w:"HELADO", p:"Se derrite si tardas" },
    ]},
  ];

  // ---- Construcción automática del crucigrama a partir de la clave ----
  // Para no depender de datos perfectos a mano, generamos el layout:
  // cada palabra i cruza la columna central en la fila i, y la letra de
  // cruce es la i-ésima de la clave. Validamos que la palabra contenga
  // esa letra; si no, la desplazamos para que calce.
  function buildLayout(level){
    const clave = level.clave;
    const rows = [];
    level.words.forEach((entry, i) => {
      const word = entry.w.toUpperCase();
      const keyLetter = clave[i % clave.length];
      let cross = word.indexOf(keyLetter);
      if (cross < 0) cross = 0; // fallback: no comparte letra, cruza en 0
      rows.push({ word, clue: entry.p, cross, filled: Array(word.length).fill("") });
    });
    // columna de cruce = máximo cross para que todas quepan a la izquierda
    const keyCol = Math.max(...rows.map(r => r.cross));
    rows.forEach(r => { r.offset = keyCol - r.cross; });
    const width = Math.max(...rows.map(r => r.offset + r.word.length));
    return { rows, keyCol, width, clave };
  }

  let level = 0, layout = null, activeRow = 0, onExit = null;

  const $ = s => document.querySelector(s);
  function unlockedMax(){ return +(localStorage.getItem("gq_cruci_max") || 0); }
  function setUnlocked(n){ localStorage.setItem("gq_cruci_max", String(Math.max(unlockedMax(), n))); }

  function open(exitCb){
    onExit = exitCb || null;
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
      <p class="cruci-tagline">Completa las palabras y descubre la palabra clave escondida.</p>
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
    layout = buildLayout(LEVELS[i]);
    activeRow = 0;
    renderBoard();
  }

  // ---------- Tablero del nivel ----------
  function renderBoard(){
    const host = $("#cruciScreen");
    const lv = LEVELS[level];
    host.innerHTML = `
      <div class="cruci-head">
        <button class="cruci-back" id="cruciBackSel">‹</button>
        <h2>Nivel ${level+1} · ${lv.tema}</h2>
        <span class="cruci-sub">🔑 ${layout.clave.length}</span>
      </div>
      <div class="cruci-grid" id="cruciGrid"></div>
      <div class="cruci-clue" id="cruciClue"></div>
      <div class="cruci-keyboard" id="cruciKb"></div>`;
    host.querySelector("#cruciBackSel").onclick = () => renderLevelSelect();
    drawGrid();
    drawKeyboard();
    selectRow(firstUnsolvedRow());
    showScreen();
  }

  function firstUnsolvedRow(){
    const idx = layout.rows.findIndex(r => r.filled.join("") !== r.word);
    return idx < 0 ? 0 : idx;
  }

  function drawGrid(){
    const g = $("#cruciGrid");
    g.style.setProperty("--cols", layout.width);
    g.innerHTML = "";
    layout.rows.forEach((r, ri) => {
      const rowEl = document.createElement("div");
      rowEl.className = "cruci-row";
      for (let c = 0; c < layout.width; c++){
        const inWord = c >= r.offset && c < r.offset + r.word.length;
        const cell = document.createElement("div");
        cell.className = "cruci-cell" + (inWord ? "" : " empty");
        if (inWord){
          const li = c - r.offset;
          if (c === layout.keyCol) cell.classList.add("key");
          const ch = r.filled[li];
          cell.textContent = ch || "";
          if (r.filled.join("") === r.word) cell.classList.add("solved");
          cell.onclick = () => { selectRow(ri); };
        }
        rowEl.appendChild(cell);
      }
      g.appendChild(rowEl);
    });
  }

  function selectRow(ri){
    activeRow = ri;
    const r = layout.rows[ri];
    $("#cruciClue").innerHTML = `<span class="cc-num">${ri+1}.</span> ${r.clue} <span class="cc-len">(${r.word.length} letras)</span>`;
    $$(".cruci-row").forEach((el, i) => el.classList.toggle("active", i === ri));
  }
  const $$ = s => Array.from(document.querySelectorAll(s));

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
    // botón de pista extra
    const hintRow = document.createElement("div");
    hintRow.className = "ckb-row";
    const hint = document.createElement("button");
    hint.className = "ckb-hint";
    hint.textContent = "💡 Revelar una letra";
    hint.onclick = revealOne;
    hintRow.appendChild(hint);
    kb.appendChild(hintRow);
  }

  function nextEmpty(r){ return r.filled.findIndex(x => !x); }

  function typeLetter(letter){
    const r = layout.rows[activeRow];
    if (r.filled.join("") === r.word) return; // ya resuelta
    const i = nextEmpty(r);
    if (i < 0) return;
    r.filled[i] = letter;
    try { Sfx.pick(); } catch(e){}
    if (nextEmpty(r) < 0) checkWord(r);
    drawGrid(); selectRow(activeRow);
  }
  function backspace(){
    const r = layout.rows[activeRow];
    if (r.filled.join("") === r.word) return;
    for (let i = r.filled.length - 1; i >= 0; i--){ if (r.filled[i]){ r.filled[i] = ""; break; } }
    drawGrid(); selectRow(activeRow);
  }
  function revealOne(){
    const r = layout.rows[activeRow];
    const i = nextEmpty(r);
    if (i < 0) return;
    r.filled[i] = r.word[i];
    try { Sfx.click(); } catch(e){}
    if (nextEmpty(r) < 0) checkWord(r);
    drawGrid(); selectRow(activeRow);
  }

  function checkWord(r){
    if (r.filled.join("") === r.word){
      try { Sfx.correct(); } catch(e){}
      try { if (typeof Fun !== "undefined"){ const g = $("#cruciGrid").getBoundingClientRect(); Fun.floatUp("✨", g.left+g.width/2, g.top+40, 5); } } catch(e){}
      // ¿nivel completo?
      if (layout.rows.every(x => x.filled.join("") === x.word)) setTimeout(levelComplete, 500);
      else setTimeout(() => selectRow(firstUnsolvedRow()), 400);
    } else {
      try { Sfx.wrong(); } catch(e){}
      const rowEl = $$(".cruci-row")[activeRow];
      if (rowEl){ rowEl.classList.add("shake"); setTimeout(() => rowEl.classList.remove("shake"), 400); }
      // borrar lo escrito para reintentar (deja las reveladas si querés; aquí limpia)
      setTimeout(() => { r.filled = r.filled.map((ch, i) => ch === r.word[i] ? ch : ""); drawGrid(); selectRow(activeRow); }, 450);
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
        <p class="cw-label">Palabra clave</p>
        <div class="cw-key">${layout.clave.split("").map(c=>`<span>${c}</span>`).join("")}</div>
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
