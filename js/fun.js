// ============================================================
// GAME QUIZ v2.3 — Módulo de "diversión" (Fun)
// Cosas vivas con las que se puede interactuar y micro-animaciones
// que hacen la partida más entretenida, sin tocar la lógica del juego:
//   · Bichos que se arrancan si los tocas (peces bajo el agua, naves
//     en el espacio, etc.) — los inserta el motor de escenas.
//   · Estallidos de emojis/GIF que caen de vez en cuando.
//   · Confeti y "screen shake" reutilizables.
// Todo es CSS + emojis: liviano para celulares de gama baja y respeta
// "reducir movimiento" del sistema.
// ============================================================
const Fun = (() => {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const rnd = (a, b) => a + Math.random() * (b - a);

  // Capa propia encima de todo para estallidos/confeti (no bloquea toques).
  let layer = document.getElementById("funLayer");
  if (!layer){
    layer = document.createElement("div");
    layer.id = "funLayer";
    document.body.appendChild(layer);
  }

  // ---------- Bichos que se arrancan al tocarlos ----------
  // Se enganchan a los elementos .critter que crea el motor de escenas.
  // Al tocar uno: sonidito, se aleja rápido y desaparece; reaparece solo
  // más tarde por su cuenta (el motor los repuebla al cambiar de escena).
  function spookCritter(node){
    if (node._spooked) return;
    node._spooked = true;
    try { Sfx && Sfx.pick && Sfx.pick(); } catch(e){}
    try { navigator.vibrate && navigator.vibrate(12); } catch(e){}
    const dir = Math.random() < 0.5 ? -1 : 1;
    node.style.transition = "transform .5s cubic-bezier(.3,.9,.3,1), opacity .5s";
    node.style.transform = `translate(${dir * rnd(60, 140)}px, ${rnd(-70, -20)}px) scale(.3) rotate(${dir*40}deg)`;
    node.style.opacity = "0";
    setTimeout(() => { node.remove(); }, 520);
  }
  // El motor de escenas llama a esto tras crear los bichos de la escena.
  function bindCritters(root){
    (root || document).querySelectorAll(".critter:not([data-bound])").forEach(node => {
      node.setAttribute("data-bound", "1");
      node.style.pointerEvents = "auto";
      node.addEventListener("pointerdown", (e) => { e.stopPropagation(); spookCritter(node); });
    });
  }

  // ---------- Estallido de emojis que caen ----------
  function burst(emojis, n = 14){
    if (reduced) n = Math.min(n, 5);
    const pool = Array.isArray(emojis) ? emojis : [emojis];
    for (let i = 0; i < n; i++){
      const s = document.createElement("div");
      s.className = "fun-drop";
      s.textContent = pool[Math.floor(Math.random() * pool.length)];
      s.style.left = rnd(2, 96) + "vw";
      s.style.fontSize = rnd(20, 42) + "px";
      s.style.animationDuration = rnd(2.4, 4.2) + "s";
      s.style.animationDelay = rnd(0, 0.6) + "s";
      s.style.setProperty("--rot", (rnd(-1, 1) * 360).toFixed(0) + "deg");
      layer.appendChild(s);
      setTimeout(() => s.remove(), 5200);
    }
  }

  // ---------- Confeti (fin de ronda / celebración) ----------
  const CONF = ["#FF4A6E","#1E9BFF","#16B364","#FFB821","#8C52FF","#FFD25E","#ffffff"];
  function confetti(n = 90){
    if (reduced) n = Math.min(n, 24);
    for (let i = 0; i < n; i++){
      const c = document.createElement("i");
      c.className = "fun-confetti";
      c.style.left = rnd(0, 100) + "vw";
      c.style.background = CONF[Math.floor(Math.random() * CONF.length)];
      c.style.animationDuration = rnd(2.2, 3.8) + "s";
      c.style.animationDelay = rnd(0, 0.5) + "s";
      c.style.setProperty("--x", (rnd(-1, 1) * 160).toFixed(0) + "px");
      c.style.setProperty("--rot", (rnd(-1, 1) * 720).toFixed(0) + "deg");
      if (Math.random() < 0.5) c.style.borderRadius = "50%";
      layer.appendChild(c);
      setTimeout(() => c.remove(), 4400);
    }
  }

  // Emojis "flotan hacia arriba" desde un punto (al ganar, acertar, etc.)
  function floatUp(emoji, x, y, n = 8){
    if (reduced) n = Math.min(n, 3);
    for (let i = 0; i < n; i++){
      const s = document.createElement("div");
      s.className = "fun-floatup";
      s.textContent = emoji;
      s.style.left = (x + rnd(-24, 24)) + "px";
      s.style.top = (y + rnd(-10, 10)) + "px";
      s.style.fontSize = rnd(20, 38) + "px";
      s.style.animationDelay = rnd(0, 0.35) + "s";
      s.style.setProperty("--dx", rnd(-40, 40).toFixed(0) + "px");
      layer.appendChild(s);
      setTimeout(() => s.remove(), 1800);
    }
  }

  // ---------- Sacudida de pantalla ----------
  function shake(ms = 500){
    if (reduced) return;
    const app = document.getElementById("app");
    if (!app) return;
    app.classList.add("fun-shake");
    setTimeout(() => app.classList.remove("fun-shake"), ms);
  }

  // ---------- Estallidos ambientales aleatorios ----------
  // Cada cierto tiempo, mientras estás en el lobby, cae un estallido temático
  // según la escena actual (globos, burbujas, estrellas fugaces…).
  const SCENE_BURST = {
    fiesta:["🎈","🎊","✨"], candy:["🍬","🍭","⭐"], oceano:["🫧","🐠","🐚"],
    aurora:["✨","💫","❄️"], celebracion:["🎉","🎊","🏆"],
  };
  let ambientTimer = null;
  function startAmbient(getScene){
    stopAmbient();
    if (reduced) return;
    ambientTimer = setInterval(() => {
      if (document.hidden) return;
      const scene = getScene();
      const set = SCENE_BURST[scene];
      if (set && Math.random() < 0.55) burst(set, 6);
    }, 14000);
  }
  function stopAmbient(){ if (ambientTimer){ clearInterval(ambientTimer); ambientTimer = null; } }

  return { bindCritters, spookCritter, burst, confetti, floatUp, shake, startAmbient, stopAmbient };
})();
