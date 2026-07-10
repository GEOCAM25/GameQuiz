// ============================================================
// GAME QUIZ v2 — Motor de escenarios ("escenario vivo")
// Convierte el fondo en un set animado distinto por categoría:
// espacio con estrellas fugaces, estadio con focos, cine con
// reflectores, sakura cayendo, selva, neón, etc.
// - En el inicio/lobby el ambiente ROTA solo cada 30 segundos
//   (fiesta → aurora → océano → dulce) con fundido suave.
// - Detecta día/noche con la hora local (7:00–19:59 = día).
// - Todo es CSS + emojis: cero imágenes, liviano para celulares
//   de gama baja. Respeta "reducir movimiento" del sistema.
// ============================================================
const Scenes = (() => {
  const sky = document.getElementById("sky");
  if (!sky) return { setCategory(){}, setAmbient(){}, onScreen(){} };

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isNight = () => { const h = new Date().getHours(); return h < 7 || h >= 20; };
  const rnd = (a,b) => a + Math.random()*(b-a);

  function el(cls){ const d = document.createElement("div"); d.className = cls; sky.appendChild(d); return d; }

  // Partículas genéricas: cada clase pt-* define su animación en CSS.
  // Aquí solo se reparten posiciones, tamaños y tiempos al azar.
  function parts(cls, n, o={}){
    if (reduced) n = Math.min(n, 4);
    for (let i=0;i<n;i++){
      const s = el("p " + cls);
      s.style.setProperty("--x",  rnd(o.x0??0,  o.x1??100).toFixed(1) + "%");
      s.style.setProperty("--y",  rnd(o.y0??0,  o.y1??100).toFixed(1) + "%");
      s.style.setProperty("--d",  rnd(o.d0??6,  o.d1??14).toFixed(1) + "s");
      s.style.setProperty("--dl", (-rnd(0, (o.d1??14))).toFixed(1) + "s");
      s.style.setProperty("--s",  rnd(o.s0??.6, o.s1??1.25).toFixed(2));
      if (o.ch) s.textContent = o.ch[i % o.ch.length];
    }
  }

  // Emojis flotantes grandes (los "juguetes" de cada mundo)
  const POS = [[6,58],[80,12],[12,26],[82,66],[45,82],[64,38],[28,8],[70,88]];
  function floats(list){
    list.forEach((e,i)=>{
      const [x,y] = POS[i % POS.length];
      const d = el("fl"); d.textContent = e;
      d.style.left = x + "%"; d.style.top = y + "%";
      d.style.animationDelay = (-i*1.15) + "s";
      d.style.fontSize = (28 + (i%3)*9) + "px";
    });
  }

  // Bichos que cruzan la pantalla y SE ARRANCAN si los tocas (peces, naves…).
  // La interacción la maneja Fun.bindCritters tras construir la escena.
  function critters(list, n, o={}){
    if (reduced) n = Math.min(n, 4);
    for (let i=0;i<n;i++){
      const c = el("critter " + (o.cls||""));
      c.textContent = list[i % list.length];
      c.style.top = rnd(o.y0??12, o.y1??82) + "%";
      c.style.fontSize = rnd(o.s0??26, o.s1??44) + "px";
      const dur = rnd(o.d0??10, o.d1??20);
      c.style.animationDuration = dur + "s";
      c.style.animationDelay = (-rnd(0, dur)) + "s";
      if (Math.random() < 0.5) c.classList.add("rev"); // nada/vuela hacia el otro lado
    }
  }

  // Nubes con volumen y sombra proyectada (día) o nubes oscuras (noche)
  function clouds(n, dark){
    for (let i=0;i<n;i++){
      const c = el("cloud" + (dark ? " dark" : ""));
      const w = rnd(84,156);
      c.style.width = w+"px"; c.style.height = (w*0.36)+"px";
      c.style.top = rnd(4,56)+"%";
      c.style.animationDuration = rnd(46,88)+"s";
      c.style.animationDelay = (-rnd(0,80))+"s";
      c.style.opacity = rnd(.6,.95).toFixed(2);
    }
  }

  // ---- Constructores de escena (cada uno arma sus capas) ----
  const B = {
    // Ambientes del inicio/lobby (rotan solos)
    fiesta(n){
      if (n){ el("fx-moon"); parts("pt-star",26,{y1:65,d0:2,d1:5}); parts("pt-firefly",9,{y0:45,y1:95,d0:5,d1:9}); clouds(3,true);
              floats(["🎪","🎡","🎠","🎈","🪁","🎢"]); }
      else  { el("fx-sun"); clouds(6); parts("pt-spark",6,{y1:45,d0:3,d1:6});
              floats(["🎈","🪁","🎡","🎠","🎪","🎢"]); }
    },
    aurora(){ el("fx-aur a1"); el("fx-aur a2"); el("fx-aur a3"); el("fx-moon");
      parts("pt-star",30,{y1:80,d0:2,d1:5}); critters(["🦅","🦉","🌠"],3,{y1:40,d0:16,d1:26});
      floats(["✨","⛰️","🦌","🌲"]); },
    oceano(n){ el(n ? "fx-moon" : "fx-sun low"); el("fx-sea"); clouds(3, n);
      parts("pt-bubble",8,{y0:65,y1:100,d0:6,d1:12}); floats(["⛵","🐬","🏝️","🐚","🦀"]); },
    candy(){ el("fx-sun candy"); clouds(5); parts("pt-spark",8,{d0:3,d1:6});
      critters(["🦄","🎈","🍬"],3,{y1:55,d0:14,d1:22});
      floats(["🍭","🍬","🍩","🧁","🍦","🌈"]); },

    // NUEVO — Bajo el agua: peces que se arrancan si los tocas 🐠
    submarino(){ el("fx-underwater"); parts("pt-bubble",16,{y0:20,y1:100,d0:5,d1:11});
      critters(["🐠","🐟","🐡","🦈","🐢","🦑","🐙","🐬"],9,{y0:14,y1:78,d0:9,d1:18,cls:"swim"});
      floats(["🪸","🐚","⚓","🌊"]); },
    // NUEVO — Espacio nocturno: naves y ovnis que cruzan (tócalos y escapan) 🛸
    galaxia(){ el("fx-moon"); parts("pt-star",40,{d0:2,d1:5}); el("fx-meteor m1"); el("fx-meteor m2");
      critters(["🛸","🚀","🛰️","☄️","👽","⭐"],8,{y0:8,y1:70,d0:8,d1:16,cls:"fly"});
      floats(["🪐","🌌","🌠","🌍"]); },

    // Escenas por categoría
    espacio(){ parts("pt-star",34,{d0:2,d1:5}); el("fx-planet"); el("fx-meteor m1"); el("fx-meteor m2");
      floats(["🚀","🛸","🪐","👨‍🚀","☄️"]); },
    cine(){ el("fx-spot l gold"); el("fx-spot r gold"); el("fx-vign"); parts("pt-dust",10,{d0:8,d1:16});
      floats(["🎬","🍿","🎥","⭐","🎞️"]); },
    series(){ el("fx-spot l red"); el("fx-spot r red"); el("fx-vign"); parts("pt-dust",8,{d0:8,d1:16});
      floats(["📺","🍿","🎬","🛋️","🌙"]); },
    tronos(){ el("fx-spot l purple"); el("fx-spot r purple"); parts("pt-ember",12,{y0:55,y1:100,d0:4,d1:9});
      floats(["🐉","⚔️","🏰","👑","🔥"]); },
    magia(){ el("fx-moon"); parts("pt-star",20,{y1:60,d0:2,d1:5}); parts("pt-spark",14,{d0:3,d1:7});
      floats(["🏰","✨","🪄","🐭","👸","🧚"]); },
    salto(){ el("fx-sun"); clouds(6); floats(["🎈","🤠","🐠","🚗","💡","🦖"]); },
    sakura(){ el("fx-sun low pink"); parts("pt-petal",14,{d0:6,d1:12});
      floats(["⛩️","🌸","🗻","🍜","🏮"]); },
    alfombra(){ el("fx-spot l gold"); el("fx-spot r gold"); parts("pt-flash",8,{y1:70,d0:2,d1:5});
      floats(["⭐","📸","🏆","💃","🕶️"]); },
    neon(){ el("fx-beam b1"); el("fx-beam b2"); el("fx-beam b3"); parts("pt-neon",12,{d0:4,d1:9});
      floats(["🎤","🎧","💿","🪩","🎹"]); },
    comic(){ el("fx-dots"); el("fx-spot l blue"); el("fx-spot r red");
      floats(["💥","🦸","🕹️","🎮","⚡","🧨"]); },
    cyber(){ el("fx-grid"); el("fx-scan"); parts("pt-neon",12,{y1:55,d0:4,d1:9});
      floats(["🤖","💾","⚙️","🛰️","🔌"]); },
    museo(){ parts("pt-dust",14,{d0:8,d1:16}); floats(["🏛️","📜","⚱️","🗿","👑","🛡️"]); },
    selva(){ el("fx-sun low"); parts("pt-leaf",12,{d0:6,d1:12});
      floats(["🦁","🦜","🐒","🌴","🦋","🐘"]); },
    estadio(){ el("fx-spot l white"); el("fx-spot r white"); el("fx-grass"); parts("pt-flash",6,{y1:55,d0:2,d1:5});
      floats(["⚽","🏆","🥅","🧤","📣"]); },
    arena(){ el("fx-spot l gold"); el("fx-spot r red"); parts("pt-ember",10,{y0:55,y1:100,d0:4,d1:9});
      floats(["🏅","🔥","⚡","🏀","🎾","🥇"]); },
    arcade(){ parts("pt-bokeh",10,{d0:7,d1:14}); parts("pt-star",14,{y1:55,d0:2,d1:5});
      floats(["❓","💡","🧠","🎯","🎲","⭐"]); },
    lab(){ parts("pt-bubble",12,{y0:45,y1:100,d0:5,d1:10});
      floats(["🧪","🔬","🤯","⚗️","🧬","💥"]); },
    mundo(n){ el(n ? "fx-moon" : "fx-sun"); clouds(6, n); el("fx-plane");
      floats(["🌍","🗺️","🧭","🗽","🗼","🎌"]); },

    // Fin de partida: el podio se celebra con confeti y focos dorados
    celebracion(){ el("fx-spot l gold"); el("fx-spot r gold");
      parts("pt-confetti",18,{d0:4,d1:8}); parts("pt-spark",10,{d0:3,d1:6});
      floats(["🎉","🏆","🥳","👑","🎊"]); },
  };

  const CAT2SCENE = {
    espacio:"espacio", cine:"cine", netflix:"series", hbo:"tronos", disney:"magia",
    pixar:"salto", anime:"sakura", famosos:"alfombra", pop:"neon", geek:"comic",
    tecnologia:"cyber", historia:"museo", animales:"selva", futbol:"estadio",
    deportes:"arena", trivia:"arcade", curiosos:"lab", banderas:"mundo",
    greys:"series", terror:"galaxia", histchile:"museo", farandula:"alfombra",
    marvel:"comic", dc:"neon", dragonball:"sakura", starwars:"espacio", lotr:"tronos",
  };
  const AMBIENT = ["fiesta","galaxia","submarino","aurora","oceano","candy"];
  const ROTATE_MS = 30000;   // cada cuánto rota el ambiente del lobby/inicio

  let current = "", mode = "", ambIdx = 0, rotTimer = null;

  function setScene(name){
    if (name === current) return;
    current = name;
    sky.classList.add("fade");
    setTimeout(() => {
      sky.innerHTML = "";
      document.body.dataset.time = isNight() ? "night" : "day";
      document.body.dataset.scene = name;
      (B[name] || B.fiesta)(isNight());
      sky.classList.remove("fade");
      // Hace tocables a los bichos recién creados (peces, naves…)
      if (typeof Fun !== "undefined") Fun.bindCritters(sky);
    }, reduced ? 0 : 350);
  }
  function stopRot(){ if (rotTimer){ clearInterval(rotTimer); rotTimer = null; } }

  // Ambiente rotativo del inicio/lobby (idempotente: si ya está rotando, no reinicia)
  function setAmbient(){
    if (mode === "ambient" && rotTimer) return;
    mode = "ambient"; stopRot();
    setScene(AMBIENT[ambIdx % AMBIENT.length]);
    if (!reduced) rotTimer = setInterval(() => {
      if (mode !== "ambient") return;
      ambIdx = (ambIdx + 1) % AMBIENT.length;
      setScene(AMBIENT[ambIdx]);
    }, ROTATE_MS);
  }
  function setCategory(cat){
    mode = "cat"; stopRot();
    setScene(CAT2SCENE[cat] || "arcade");
  }
  function onScreen(id){
    document.body.classList.toggle("hype", id === "countdown");
    if (id === "podium"){ mode = "podium"; stopRot(); setScene("celebracion"); }
  }

  setAmbient(); // arranca apenas carga la página
  if (typeof Fun !== "undefined") Fun.startAmbient(() => current);
  return { setCategory, setAmbient, onScreen, currentScene: () => current };
})();
