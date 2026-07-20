// ============================================================
// GAME QUIZ — MUNDO QUIZ ⛏️ (sandbox voxel 3D estilo Minecraft)
// Un ÚNICO mundo compartido y persistente: entra solo o con amigos
// (si hay alguien más conectado, se ven y construyen juntos).
//
// - Terreno procedural GIGANTE por chunks (colinas, montañas, ríos,
//   cañones, playas, volcanes con lava, nieve) generado con ruido
//   determinista: todos ven exactamente el mismo mundo.
// - Aldea con aldeanos 🧑‍🌾 cerca del punto de aparición, animales
//   (cerdos, ovejas, vacas), ciclo de día y noche.
// - Poner/romper bloques; lo construido SE GUARDA (Supabase si la
//   tabla mundo_edits existe — ver supabase-mundo.sql — y siempre en
//   el teléfono como respaldo) y se sincroniza en vivo por Realtime.
// - Disparo de proyectiles (bolas) contra animales y bloques.
// - Controles: táctil (joystick + botones) y teclado/ratón (WASD +
//   click, pointer lock).
// Motor: Three.js vendorizado en js/vendor/three.min.js.
// ============================================================
const Mundo = (() => {
  const $ = s => document.querySelector(s);
  const sbClient = () => (typeof sb !== "undefined" && sb) ? sb : (window.sb || null);

  // ---------- Constantes del mundo ----------
  const H = 64;              // altura del mundo en bloques
  const WATER = 18;          // nivel del mar
  const CH = 16;             // tamaño de chunk (16x16 columnas)
  const RADIUS = 2;          // radio de chunks visibles (5x5)
  const SEED = 1337;         // semilla fija: mismo mundo para todos
  const DAY_MS = 8 * 60 * 1000;  // un día completo = 8 minutos

  // Bloques
  const AIR=0, GRASS=1, DIRT=2, STONE=3, SAND=4, WATERB=5, WOOD=6, LEAF=7, SNOW=8, LAVA=9, BASALT=10, PLANK=11, BRICK=12;
  const COLORS = { [GRASS]:0x5cb545,[DIRT]:0x8a5a32,[STONE]:0x8d8d94,[SAND]:0xe6d9a2,[WATERB]:0x3f76e4,[WOOD]:0x6b4a2b,[LEAF]:0x3e8f3e,[SNOW]:0xf4f8fb,[LAVA]:0xe25822,[BASALT]:0x4a4046,[PLANK]:0xb08a55,[BRICK]:0xa5524a };
  const NAMES  = { [GRASS]:"Pasto",[DIRT]:"Tierra",[STONE]:"Piedra",[SAND]:"Arena",[WOOD]:"Tronco",[LEAF]:"Hojas",[SNOW]:"Nieve",[PLANK]:"Madera",[BRICK]:"Ladrillo" };
  const HOTBAR = [GRASS, DIRT, STONE, SAND, WOOD, PLANK, LEAF, BRICK, SNOW];
  const solid = b => b !== AIR && b !== WATERB && b !== LAVA;

  // ---------- Ruido determinista (hash + value noise + fbm) ----------
  function hash2(x, z){
    let h = (x|0) * 374761393 + (z|0) * 668265263 + SEED * 1442695041;
    h = (h ^ (h >>> 13)) >>> 0; h = (h * 1274126177) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }
  function vnoise(x, z){
    const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
    const u = xf*xf*(3-2*xf), v = zf*zf*(3-2*zf);
    const a = hash2(xi,zi), b = hash2(xi+1,zi), c = hash2(xi,zi+1), d = hash2(xi+1,zi+1);
    return a + (b-a)*u + (c-a)*v + (a-b-c+d)*u*v;
  }
  function fbm(x, z, oct){
    let s = 0, amp = 0.5, f = 1;
    for (let i = 0; i < oct; i++){ s += amp * vnoise(x*f, z*f); amp *= 0.5; f *= 2; }
    return s;  // ~[0,1)
  }

  // ---------- Terreno: altura + bioma por columna ----------
  const colCache = new Map();   // "x,z" -> {h, biome}
  function column(x, z){
    const k = x + "," + z;
    let c = colCache.get(k); if (c) return c;
    const e = fbm(x*0.004, z*0.004, 4);                          // elevación
    let h = 14 + Math.pow(Math.max(0, e-0.25)*1.9, 2.2) * 66;    // llanuras ~16, montañas 45-58
    let biome = "plains";
    if (h > 42) biome = "mountain";
    // Cañones: franjas profundas
    const cy = fbm(x*0.008+900, z*0.008+900, 3);
    if (cy > 0.74){ h -= (cy-0.74)*160; biome = "canyon"; }
    // Ríos: franjas serpenteantes que cortan hasta bajo el nivel del agua
    const rv = Math.abs(fbm(x*0.0028+500, z*0.0028+500, 3) - 0.5);
    if (rv < 0.016 && biome !== "mountain"){ h = Math.min(h, WATER - 2 + rv*80); biome = "river"; }
    // Volcanes: celdas dispersas con cono + cráter de lava
    const VCELL = 192;
    const vx = Math.floor(x/VCELL), vz = Math.floor(z/VCELL);
    const vcx = vx*VCELL + Math.floor(hash2(vx,vz)*VCELL*0.6) + VCELL*0.2;
    const vcz = vz*VCELL + Math.floor(hash2(vx+7,vz+7)*VCELL*0.6) + VCELL*0.2;
    if (hash2(vx+3,vz+9) > 0.45){                 // no todas las celdas tienen volcán
      const d = Math.hypot(x-vcx, z-vcz), R = 24;
      if (d < R){
        const cone = 26 + (R-d)*1.35;
        if (d < 4.5){ h = 34; biome = "crater"; }  // cráter con lava
        else if (cone > h){ h = cone; biome = "volcano"; }
      }
    }
    h = Math.max(4, Math.min(H-6, Math.floor(h)));
    if (biome === "plains" && h <= WATER+2 && h > WATER-3) biome = "beach";
    c = { h, biome };
    if (colCache.size > 60000) colCache.clear();
    colCache.set(k, c);
    return c;
  }
  // Árboles dispersos (función pura: mismo árbol para todos)
  const isTree = (x,z) => { const c = column(x,z); return c.biome === "plains" && c.h > WATER+2 && hash2(x*3+11, z*3+17) > 0.985; };
  // Casas de la aldea cerca del origen (posiciones fijas)
  const HOUSES = [[6,6],[18,4],[8,20],[20,18]];
  function houseBlock(x, y, z){
    for (const [hx,hz] of HOUSES){
      const g = column(hx+2, hz+2).h;
      const lx = x-hx, lz = z-hz, ly = y-g;
      if (lx<0||lx>4||lz<0||lz>4||ly<1||ly>4) continue;
      if (ly === 4) return PLANK;                          // techo
      if (lx===0||lx===4||lz===0||lz===4){
        if (lz===0 && lx===2 && ly<=2) return AIR;         // puerta
        return (ly===2 && (lx===2||lz===2)) ? AIR : BRICK; // ventanas
      }
      return AIR;                                          // interior hueco
    }
    return -1;
  }
  // Bloque del terreno base (sin ediciones)
  function terrainAt(x, y, z){
    if (y < 0 || y >= H) return AIR;
    if (y === 0) return STONE;
    const hb = houseBlock(x,y,z); if (hb >= 0) return hb;
    const { h, biome } = column(x, z);
    // Árboles (tronco + copa) de bases cercanas
    for (let tx = x-2; tx <= x+2; tx++) for (let tz = z-2; tz <= z+2; tz++){
      if (!isTree(tx,tz)) continue;
      const th = column(tx,tz).h, top = th + 4;
      if (x===tx && z===tz && y>th && y<=top) return WOOD;
      const dy = y-top;
      if (dy>=-1 && dy<=1 && Math.abs(x-tx)+Math.abs(z-tz)+Math.abs(dy) <= 3 && !(x===tx&&z===tz&&dy<=0)) return LEAF;
    }
    if (y > h){
      if (y <= WATER && biome !== "crater") return WATERB;
      if (biome === "crater" && y <= 36) return LAVA;
      return AIR;
    }
    if (y === h){
      if (biome === "mountain") return h > 48 ? SNOW : STONE;
      if (biome === "volcano" || biome === "crater") return BASALT;
      if (biome === "beach" || biome === "river" || biome === "canyon") return SAND;
      return h <= WATER ? SAND : GRASS;
    }
    if (y > h-4) return (biome==="volcano"||biome==="crater") ? BASALT : DIRT;
    return STONE;
  }
  // ---------- Ediciones (lo construido queda para siempre) ----------
  const edits = new Map();     // "x,y,z" -> id de bloque
  const ekey = (x,y,z) => x+","+y+","+z;
  function blockAt(x, y, z){
    const e = edits.get(ekey(x,y,z));
    return e !== undefined ? e : terrainAt(x,y,z);
  }

  // ---------- Estado de sesión ----------
  let S = null;

  // ---------- Persistencia ----------
  const LS_KEY = "gq_mundo_edits";
  function loadLocal(){
    try { const j = JSON.parse(localStorage.getItem(LS_KEY) || "{}"); Object.entries(j).forEach(([k,v]) => edits.set(k, v)); } catch(e){}
  }
  function saveLocal(){
    try { const o = {}; edits.forEach((v,k) => o[k]=v); localStorage.setItem(LS_KEY, JSON.stringify(o)); } catch(e){}
  }
  async function loadCloud(){
    const c = sbClient(); if (!c) return;
    try {
      const { data, error } = await c.from("mundo_edits").select("x,y,z,b").limit(100000);
      if (error || !data) { S.cloud = false; return; }
      S.cloud = true;
      data.forEach(r => edits.set(ekey(r.x,r.y,r.z), r.b));
    } catch(e){ S.cloud = false; }
  }
  const cloudQueue = [];
  function queueCloud(x,y,z,b){
    if (!S || S.cloud === false) return;
    cloudQueue.push({ x,y,z,b });
    if (!S.cloudTimer) S.cloudTimer = setTimeout(flushCloud, 2500);
  }
  async function flushCloud(){
    if (S) S.cloudTimer = null;
    const c = sbClient(); if (!c || !cloudQueue.length) return;
    const batch = cloudQueue.splice(0, 400);
    try { await c.from("mundo_edits").upsert(batch, { onConflict: "x,y,z" }); } catch(e){}
    if (cloudQueue.length && S) S.cloudTimer = setTimeout(flushCloud, 2500);
  }

  // ---------- Aplicar una edición (local o remota) ----------
  function applyEdit(x, y, z, b, fromRemote){
    if (y <= 0 || y >= H) return;
    edits.set(ekey(x,y,z), b);
    saveLocal();
    rebuildAround(x, z);
    if (!fromRemote){
      queueCloud(x, y, z, b);
      try { S.ch && S.ch.send({ type:"broadcast", event:"edit", payload:{ x,y,z,b } }); } catch(e){}
    }
  }

  // ---------- Render 3D ----------
  const chunkKey = (cx,cz) => cx+","+cz;
  function buildChunk(cx, cz){
    const T = window.THREE;
    const pos=[], col=[], idx=[], wpos=[], wcol=[], widx=[];
    const shade = { px:.8, nx:.8, pz:.72, nz:.72, py:1, ny:.5 };
    function face(list, cl, ix, c, sh, verts){
      const base = list.length/3;
      verts.forEach(v => { list.push(v[0],v[1],v[2]); cl.push(((c>>16&255)/255)*sh, ((c>>8&255)/255)*sh, ((c&255)/255)*sh); });
      ix.push(base,base+1,base+2, base,base+2,base+3);
    }
    for (let lx=0; lx<CH; lx++) for (let lz=0; lz<CH; lz++){
      const x = cx*CH+lx, z = cz*CH+lz;
      for (let y=0; y<H; y++){
        const b = blockAt(x,y,z); if (b === AIR) continue;
        const isW = (b === WATERB), isL = (b === LAVA);
        const P = isW ? wpos : pos, C = isW ? wcol : col, I = isW ? widx : idx;
        const c = COLORS[b];
        const vis = (nx,ny,nz) => { const n = blockAt(nx,ny,nz); return isW ? (n===AIR) : !solid(n) && n!==b; };
        const yTop = isW && blockAt(x,y+1,z)===AIR ? y+0.85 : y+1;   // el agua se hunde un pelo
        if (vis(x+1,y,z)) face(P,C,I,c,shade.px, [[x+1,y,z],[x+1,y+1,z],[x+1,y+1,z+1],[x+1,y,z+1]].map((v,i)=>[v[0], i===1||i===2?yTop:v[1], v[2]]));
        if (vis(x-1,y,z)) face(P,C,I,c,shade.nx, [[x,y,z+1],[x,y+1,z+1],[x,y+1,z],[x,y,z]].map((v,i)=>[v[0], i===1||i===2?yTop:v[1], v[2]]));
        if (vis(x,y,z+1)) face(P,C,I,c,shade.pz, [[x+1,y,z+1],[x+1,y+1,z+1],[x,y+1,z+1],[x,y,z+1]].map((v,i)=>[v[0], i===1||i===2?yTop:v[1], v[2]]));
        if (vis(x,y,z-1)) face(P,C,I,c,shade.nz, [[x,y,z],[x,y+1,z],[x+1,y+1,z],[x+1,y,z]].map((v,i)=>[v[0], i===1||i===2?yTop:v[1], v[2]]));
        if (vis(x,y+1,z)) face(P,C,I, isL?0xff8c33:c, shade.py, [[x,yTop,z],[x,yTop,z+1],[x+1,yTop,z+1],[x+1,yTop,z]]);
        if (vis(x,y-1,z)) face(P,C,I,c,shade.ny, [[x,y,z],[x+1,y,z],[x+1,y,z+1],[x,y,z+1]]);
      }
    }
    const group = new T.Group();
    if (pos.length){
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.Float32BufferAttribute(pos,3));
      g.setAttribute("color", new T.Float32BufferAttribute(col,3));
      g.setIndex(idx); g.computeVertexNormals();
      group.add(new T.Mesh(g, S.matSolid));
    }
    if (wpos.length){
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.Float32BufferAttribute(wpos,3));
      g.setAttribute("color", new T.Float32BufferAttribute(wcol,3));
      g.setIndex(widx); g.computeVertexNormals();
      group.add(new T.Mesh(g, S.matWater));
    }
    return group;
  }
  function ensureChunks(){
    const pcx = Math.floor(S.pos.x/CH), pcz = Math.floor(S.pos.z/CH);
    const want = new Set();
    for (let dx=-RADIUS; dx<=RADIUS; dx++) for (let dz=-RADIUS; dz<=RADIUS; dz++){
      const cx=pcx+dx, cz=pcz+dz, k=chunkKey(cx,cz); want.add(k);
      if (!S.chunks.has(k) && !S.buildQueue.includes(k)) S.buildQueue.push(k);
    }
    for (const [k,m] of S.chunks){ if (!want.has(k)){ S.scene.remove(m); disposeGroup(m); S.chunks.delete(k); } }
  }
  function disposeGroup(g){ g.children.forEach(m => m.geometry && m.geometry.dispose()); }
  function processBuildQueue(){
    if (!S.buildQueue.length) return;
    const k = S.buildQueue.shift();
    const [cx,cz] = k.split(",").map(Number);
    const old = S.chunks.get(k); if (old){ S.scene.remove(old); disposeGroup(old); }
    const m = buildChunk(cx,cz); S.scene.add(m); S.chunks.set(k,m);
  }
  function rebuildAround(x, z){
    const cx = Math.floor(x/CH), cz = Math.floor(z/CH);
    const near = new Set([chunkKey(cx,cz)]);
    if (((x%CH)+CH)%CH === 0) near.add(chunkKey(cx-1,cz));
    if (((x%CH)+CH)%CH === CH-1) near.add(chunkKey(cx+1,cz));
    if (((z%CH)+CH)%CH === 0) near.add(chunkKey(cx,cz-1));
    if (((z%CH)+CH)%CH === CH-1) near.add(chunkKey(cx,cz+1));
    near.forEach(k => { if (S.chunks.has(k) && !S.buildQueue.includes(k)) S.buildQueue.unshift(k); });
  }

  // ---------- Raycast voxel (DDA) ----------
  function raycast(origin, dir, maxD){
    let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
    const stepX = dir.x>0?1:-1, stepY = dir.y>0?1:-1, stepZ = dir.z>0?1:-1;
    const tDX = Math.abs(1/(dir.x||1e-9)), tDY = Math.abs(1/(dir.y||1e-9)), tDZ = Math.abs(1/(dir.z||1e-9));
    let tX = (stepX>0 ? (x+1-origin.x) : (origin.x-x)) * tDX;
    let tY = (stepY>0 ? (y+1-origin.y) : (origin.y-y)) * tDY;
    let tZ = (stepZ>0 ? (z+1-origin.z) : (origin.z-z)) * tDZ;
    let px=x, py=y, pz=z;
    for (let i=0; i<maxD*3; i++){
      px=x; py=y; pz=z;
      if (tX < tY && tX < tZ){ x+=stepX; if (tX>maxD) break; tX+=tDX; }
      else if (tY < tZ){ y+=stepY; if (tY>maxD) break; tY+=tDY; }
      else { z+=stepZ; if (tZ>maxD) break; tZ+=tDZ; }
      const b = blockAt(x,y,z);
      if (solid(b)) return { hit:[x,y,z], prev:[px,py,pz], block:b };
    }
    return null;
  }

  // ---------- Física del jugador ----------
  function collide(px, py, pz){
    const r = 0.3;
    for (const ox of [-r, r]) for (const oz of [-r, r]) for (const oy of [0, 0.9, 1.75]){
      if (solid(blockAt(Math.floor(px+ox), Math.floor(py+oy), Math.floor(pz+oz)))) return true;
    }
    return false;
  }
  function groundY(x, z, fromY){
    for (let y = Math.min(H-1, Math.floor(fromY)); y > 0; y--){ if (solid(blockAt(Math.floor(x), y, Math.floor(z)))) return y+1; }
    return WATER+1;
  }

  // ---------- Criaturas (animales + aldeanos) ----------
  function makeCreature(type){
    const T = window.THREE;
    const g = new T.Group();
    const mat = c => new T.MeshLambertMaterial({ color: c });
    const box = (w,h,d,c,x,y,z) => { const m = new T.Mesh(new T.BoxGeometry(w,h,d), mat(c)); m.position.set(x,y,z); g.add(m); return m; };
    if (type === "villager"){
      box(.5,.9,.3, 0x8a6642, 0,.45,0);       // túnica
      box(.34,.34,.34, 0xd9a066, 0,1.1,0);    // cabeza
      box(.1,.1,.06, 0x6b4a2b, 0,1.05,.18);   // nariz
    } else if (type === "pig"){ box(.8,.5,.5, 0xeba3a3, 0,.35,0); box(.35,.35,.35, 0xeba3a3, .5,.45,0); }
    else if (type === "sheep"){ box(.8,.55,.55, 0xeeeeee, 0,.4,0); box(.3,.3,.3, 0xccb9a8, .5,.5,0); }
    else { box(.9,.6,.55, 0x6e4a34, 0,.42,0); box(.35,.35,.3, 0x6e4a34, .55,.55,0); }  // vaca
    return g;
  }
  function spawnCreatures(){
    const T = window.THREE;
    const types = ["pig","sheep","cow"];
    for (let i=0;i<8;i++){
      const a = hash2(i,99)*Math.PI*2, d = 12 + hash2(i,7)*30;
      const x = S.pos.x + Math.cos(a)*d, z = S.pos.z + Math.sin(a)*d;
      const mesh = makeCreature(types[i%3]);
      mesh.position.set(x, groundY(x,z,H-1), z);
      S.scene.add(mesh);
      S.creatures.push({ mesh, type: types[i%3], dir: hash2(i,3)*Math.PI*2, t: 0 });
    }
    for (let i=0;i<4;i++){
      const [hx,hz] = HOUSES[i%HOUSES.length];
      const x = hx+2.5, z = hz+7;
      const mesh = makeCreature("villager");
      mesh.position.set(x, groundY(x,z,H-1), z);
      S.scene.add(mesh);
      S.creatures.push({ mesh, type:"villager", dir: i*1.6, t: 0, home:[x,z] });
    }
  }
  function updateCreatures(dt){
    for (const c of S.creatures){
      c.t -= dt;
      if (c.t <= 0){ c.t = 2 + Math.random()*4; c.dir = Math.random()*Math.PI*2; c.moving = Math.random() > 0.35; }
      if (!c.moving) continue;
      const sp = c.type === "villager" ? 0.9 : 1.4;
      let nx = c.mesh.position.x + Math.cos(c.dir)*sp*dt;
      let nz = c.mesh.position.z + Math.sin(c.dir)*sp*dt;
      if (c.home && Math.hypot(nx-c.home[0], nz-c.home[1]) > 10){ c.dir += Math.PI; continue; }
      const gy = groundY(nx, nz, c.mesh.position.y+2);
      if (Math.abs(gy - c.mesh.position.y) > 1.6){ c.dir += Math.PI/2; continue; }
      c.mesh.position.set(nx, gy, nz);
      c.mesh.rotation.y = -c.dir + Math.PI/2;
    }
  }

  // ---------- Proyectiles (disparo) ----------
  function shoot(){
    const T = window.THREE;
    const dir = new T.Vector3(); S.camera.getWorldDirection(dir);
    const m = new T.Mesh(new T.SphereGeometry(0.12, 6, 6), new T.MeshBasicMaterial({ color: 0x333344 }));
    m.position.copy(S.camera.position);
    S.scene.add(m);
    S.shots.push({ mesh: m, vel: dir.multiplyScalar(26), life: 2.5 });
    try { Sfx.pick(); } catch(e){}
  }
  function updateShots(dt){
    for (let i=S.shots.length-1; i>=0; i--){
      const s = S.shots[i];
      s.vel.y -= 9.8*dt; s.life -= dt;
      s.mesh.position.addScaledVector(s.vel, dt);
      const p = s.mesh.position;
      let dead = s.life <= 0 || solid(blockAt(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)));
      for (const c of S.creatures){
        if (c.type === "villager") continue;   // a los aldeanos no se les dispara
        if (p.distanceTo(c.mesh.position) < 0.9){
          dead = true;
          const nx = S.pos.x + (Math.random()*60-30), nz = S.pos.z + (Math.random()*60-30);
          c.mesh.position.set(nx, groundY(nx,nz,H-1), nz);     // el animal "escapa" y reaparece lejos
          try { Sfx.correct(); } catch(e){}
        }
      }
      if (dead){ S.scene.remove(s.mesh); s.mesh.geometry.dispose(); S.shots.splice(i,1); }
    }
  }

  // ---------- Multijugador (mundo compartido en vivo) ----------
  function connect(){
    const c = sbClient(); if (!c) return;
    const name = (localStorage.getItem("gq_name") || "Jugador").slice(0,14);
    S.ch = c.channel("mundo-global", { config:{ broadcast:{ self:false }, presence:{ key:S.myId } } });
    S.ch.on("broadcast", { event:"edit" }, ({payload:p}) => applyEdit(p.x,p.y,p.z,p.b,true))
        .on("broadcast", { event:"pos" }, ({payload:p}) => remotePos(p))
        .on("presence", { event:"sync" }, () => {
          try {
            const st = S.ch.presenceState(); const ids = Object.keys(st);
            S.online = ids.length;
            for (const id of Object.keys(S.remotes)){ if (!ids.includes(id)) removeRemote(id); }
            updHud();
          } catch(e){}
        })
        .subscribe(async (st) => { if (st==="SUBSCRIBED"){ try { await S.ch.track({ name }); } catch(e){} } });
  }
  function remotePos(p){
    if (!p || p.id === S.myId) return;
    let r = S.remotes[p.id];
    if (!r){
      const T = window.THREE;
      const g = new T.Group();
      const body = new T.Mesh(new T.BoxGeometry(.5,.95,.3), new T.MeshLambertMaterial({ color: 0x4a6cf0 }));
      body.position.y = .48;
      const head = new T.Mesh(new T.BoxGeometry(.36,.36,.36), new T.MeshLambertMaterial({ color: 0xd9a066 }));
      head.position.y = 1.15;
      g.add(body, head);
      S.scene.add(g);
      r = S.remotes[p.id] = { mesh: g, tx:p.x, ty:p.y, tz:p.z, ry:p.ry||0 };
    }
    r.tx = p.x; r.ty = p.y; r.tz = p.z; r.ry = p.ry || 0;
  }
  function removeRemote(id){
    const r = S.remotes[id]; if (!r) return;
    S.scene.remove(r.mesh); delete S.remotes[id];
  }
  function broadcastPos(){
    const now = performance.now();
    if (now - (S.lastPosSend||0) < 150) return;
    S.lastPosSend = now;
    try { S.ch && S.ch.send({ type:"broadcast", event:"pos", payload:{ id:S.myId, x:S.pos.x, y:S.pos.y, z:S.pos.z, ry:S.yaw } }); } catch(e){}
  }

  // ---------- HUD ----------
  function isTouch(){ return "ontouchstart" in window; }
  function buildHud(host){
    const hb = HOTBAR.map((b,i) => `<button class="mun-slot ${i===0?'on':''}" data-i="${i}" style="background:#${COLORS[b].toString(16).padStart(6,"0")}" title="${NAMES[b]}"></button>`).join("");
    host.insertAdjacentHTML("beforeend", `
      <div class="mun-hud">
        <div class="mun-top">
          <button class="mun-btn" id="munExit">‹ Salir</button>
          <span class="mun-info" id="munInfo">☀️</span>
        </div>
        <div class="mun-cross">+</div>
        <div class="mun-hotbar" id="munHotbar">${hb}</div>
        ${isTouch() ? `
          <div class="mun-stick" id="munStick"><div class="mun-knob" id="munKnob"></div></div>
          <div class="mun-acts">
            <button class="mun-act" id="munJump">⬆️</button>
            <button class="mun-act" id="munMine">⛏️</button>
            <button class="mun-act" id="munPut">🧱</button>
            <button class="mun-act" id="munShoot">🎯</button>
          </div>` : `
          <p class="mun-help">Click: entrar · WASD mover · espacio saltar · click izq romper · click der poner · Q disparar</p>`}
      </div>`);
    $("#munExit").onclick = () => close();
    document.querySelectorAll(".mun-slot").forEach(b => b.onclick = (ev) => {
      ev.stopPropagation();
      S.slot = +b.dataset.i;
      document.querySelectorAll(".mun-slot").forEach(x => x.classList.toggle("on", +x.dataset.i === S.slot));
    });
  }
  function updHud(){
    const el = $("#munInfo"); if (!el) return;
    const t = dayT();
    const icon = t < .25 ? "🌅" : t < .5 ? "☀️" : t < .55 ? "🌇" : "🌙";
    el.textContent = `${icon}  👥 ${Math.max(1, S.online||1)}${S.cloud===false ? "  💾 local" : ""}`;
  }

  // ---------- Controles ----------
  function setupControls(cv){
    S.keys = {};
    if (!isTouch()){
      cv.addEventListener("click", () => { if (document.pointerLockElement !== cv) cv.requestPointerLock && cv.requestPointerLock(); });
      document.addEventListener("pointerlockchange", () => { S.locked = document.pointerLockElement === cv; });
      S.onMouseMove = e => { if (!S.locked) return; S.yaw -= e.movementX*0.0024; S.pitch = Math.max(-1.5, Math.min(1.5, S.pitch - e.movementY*0.0024)); };
      document.addEventListener("mousemove", S.onMouseMove);
      S.onMouseDown = e => {
        if (!S.locked) return;
        if (e.button === 0) act("mine");
        else if (e.button === 2) act("put");
      };
      cv.addEventListener("mousedown", S.onMouseDown);
      cv.addEventListener("contextmenu", e => e.preventDefault());
      S.onKey = e => {
        S.keys[e.code] = e.type === "keydown";
        if (e.type === "keydown" && e.code === "KeyQ") shoot();
        if (e.type === "keydown" && e.code === "Escape") {}
      };
      document.addEventListener("keydown", S.onKey);
      document.addEventListener("keyup", S.onKey);
    } else {
      // Joystick izquierdo
      const stick = $("#munStick"), knob = $("#munKnob");
      let sid = null, sx=0, sy=0;
      stick.addEventListener("touchstart", e => { const t=e.changedTouches[0]; sid=t.identifier; const r=stick.getBoundingClientRect(); sx=r.left+r.width/2; sy=r.top+r.height/2; }, {passive:true});
      stick.addEventListener("touchmove", e => {
        for (const t of e.changedTouches){ if (t.identifier!==sid) continue;
          const dx=(t.clientX-sx)/44, dy=(t.clientY-sy)/44;
          S.stickX = Math.max(-1,Math.min(1,dx)); S.stickY = Math.max(-1,Math.min(1,dy));
          knob.style.transform = `translate(${S.stickX*26}px,${S.stickY*26}px)`;
        }
      }, {passive:true});
      const endS = e => { for (const t of e.changedTouches){ if (t.identifier===sid){ sid=null; S.stickX=0; S.stickY=0; knob.style.transform=""; } } };
      stick.addEventListener("touchend", endS); stick.addEventListener("touchcancel", endS);
      // Mirar: arrastrar en el resto de la pantalla
      let lid=null, lx=0, ly=0;
      cv.addEventListener("touchstart", e => { const t=e.changedTouches[0]; lid=t.identifier; lx=t.clientX; ly=t.clientY; }, {passive:true});
      cv.addEventListener("touchmove", e => {
        for (const t of e.changedTouches){ if (t.identifier!==lid) continue;
          S.yaw -= (t.clientX-lx)*0.006; S.pitch = Math.max(-1.5, Math.min(1.5, S.pitch-(t.clientY-ly)*0.006));
          lx=t.clientX; ly=t.clientY;
        }
      }, {passive:true});
      cv.addEventListener("touchend", e => { for (const t of e.changedTouches){ if (t.identifier===lid) lid=null; } });
      const hold = (id, fn) => { const b=$(id); if(!b) return; b.addEventListener("touchstart", e=>{ e.preventDefault(); fn(); }, {passive:false}); };
      hold("#munJump", () => { S.wantJump = true; });
      hold("#munMine", () => act("mine"));
      hold("#munPut",  () => act("put"));
      hold("#munShoot", shoot);
    }
  }
  function act(mode){
    const T = window.THREE;
    const dir = new T.Vector3(); S.camera.getWorldDirection(dir);
    const r = raycast(S.camera.position, dir, 6);
    if (!r) return;
    if (mode === "mine"){
      applyEdit(r.hit[0], r.hit[1], r.hit[2], AIR, false);
      try { Sfx.click(); } catch(e){}
    } else {
      const [px,py,pz] = r.prev;
      // no ponerse un bloque encima de uno mismo
      const inMe = Math.floor(S.pos.x)===px && Math.floor(S.pos.z)===pz && py>=Math.floor(S.pos.y) && py<=Math.floor(S.pos.y)+1;
      if (inMe) return;
      applyEdit(px, py, pz, HOTBAR[S.slot||0], false);
      try { Sfx.pick(); } catch(e){}
    }
  }

  // ---------- Día y noche ----------
  function dayT(){ return ((Date.now() % DAY_MS) / DAY_MS); }   // 0..1 (sincronizado por reloj: igual para todos)
  function updateSky(){
    const T = window.THREE;
    const t = dayT();
    const ang = t * Math.PI * 2 - Math.PI/2;
    const sunUp = Math.sin(ang+Math.PI/2);          // 1 mediodía, -1 medianoche
    const day = Math.max(0, Math.min(1, (sunUp+0.25)*1.6));
    S.sun.position.set(Math.cos(ang)*80, Math.sin(ang+Math.PI/2)*100, 40);
    S.sun.intensity = 0.25 + day*0.85;
    S.amb.intensity = 0.25 + day*0.45;
    const sky = new T.Color().lerpColors(new T.Color(0x0b1030), new T.Color(0x87c5eb), day);
    S.scene.background = sky;
    if (S.scene.fog) S.scene.fog.color = sky;
  }

  // ---------- Bucle principal ----------
  function tick(now){
    if (!S || !S.running) return;
    S.raf = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - (S.lastT||now))/1000); S.lastT = now;

    // Movimiento
    let mx = 0, mz = 0;
    if (isTouch()){ mx = S.stickX||0; mz = S.stickY||0; }
    else {
      if (S.keys["KeyW"]||S.keys["ArrowUp"]) mz = -1;
      if (S.keys["KeyS"]||S.keys["ArrowDown"]) mz = 1;
      if (S.keys["KeyA"]||S.keys["ArrowLeft"]) mx = -1;
      if (S.keys["KeyD"]||S.keys["ArrowRight"]) mx = 1;
      if (S.keys["Space"]) S.wantJump = true;
    }
    const inWater = blockAt(Math.floor(S.pos.x), Math.floor(S.pos.y+0.5), Math.floor(S.pos.z)) === WATERB;
    const speed = inWater ? 2.4 : 4.4;
    const sin = Math.sin(S.yaw), cos = Math.cos(S.yaw);
    const vx = (mx*cos - mz*sin) * speed, vz = (mx*-sin - mz*cos) * speed;
    // gravedad + salto
    S.vy = inWater ? Math.max(S.vy - 4*dt, -2) : S.vy - 22*dt;
    if (S.wantJump){ if (S.onGround || inWater) S.vy = inWater ? 3.5 : 7.6; S.wantJump = false; }
    // resolver por ejes
    let nx = S.pos.x + vx*dt;
    if (!collide(nx, S.pos.y, S.pos.z)) S.pos.x = nx;
    let nz = S.pos.z + vz*dt;
    if (!collide(S.pos.x, S.pos.y, nz)) S.pos.z = nz;
    let ny = S.pos.y + S.vy*dt;
    S.onGround = false;
    if (collide(S.pos.x, ny, S.pos.z)){
      if (S.vy < 0) S.onGround = true;
      S.vy = 0;
    } else S.pos.y = ny;
    if (S.pos.y < -8){ S.pos.set(2, groundY(2,2,H-1)+1, 2); S.vy = 0; }   // caída al vacío → respawn

    // Cámara
    S.camera.position.set(S.pos.x, S.pos.y + 1.62, S.pos.z);
    S.camera.rotation.set(0,0,0);
    S.camera.rotateY(S.yaw); S.camera.rotateX(S.pitch);

    ensureChunks();
    processBuildQueue();
    updateCreatures(dt);
    updateShots(dt);
    updateSky();
    broadcastPos();
    // interpolar jugadores remotos
    for (const id of Object.keys(S.remotes)){
      const r = S.remotes[id];
      r.mesh.position.lerp(new window.THREE.Vector3(r.tx, r.ty, r.tz), Math.min(1, dt*10));
      r.mesh.rotation.y = r.ry;
    }
    if (((now|0) % 1000) < 20) updHud();
    S.renderer.render(S.scene, S.camera);
  }

  // ---------- Abrir / cerrar ----------
  function showScreen(){ document.querySelectorAll(".screen").forEach(s => s.classList.remove("active")); const sc = $("#scr-mundo"); if (sc) sc.classList.add("active"); }

  async function open(exitCb){
    if (!window.THREE){ try { toast("⛏️ El motor 3D no cargó. Recarga la app."); } catch(e){} return; }
    const T = window.THREE;
    const host = $("#mundoScreen");
    host.innerHTML = "";
    S = {
      onExit: exitCb || null, myId: Math.random().toString(36).slice(2,10),
      chunks: new Map(), buildQueue: [], creatures: [], shots: [], remotes: {},
      yaw: Math.PI, pitch: 0, vy: 0, slot: 0, online: 1, running: true, cloud: undefined,
    };
    // Escena
    S.scene = new T.Scene();
    S.scene.fog = new T.Fog(0x87c5eb, 30, RADIUS*CH*1.9);
    S.camera = new T.PerspectiveCamera(74, 1, 0.1, 400);
    S.renderer = new T.WebGLRenderer({ antialias: false });
    S.renderer.setPixelRatio(Math.min(devicePixelRatio||1, 1.6));
    host.appendChild(S.renderer.domElement);
    S.matSolid = new T.MeshLambertMaterial({ vertexColors: true });
    S.matWater = new T.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.72 });
    S.amb = new T.AmbientLight(0xffffff, 0.6); S.scene.add(S.amb);
    S.sun = new T.DirectionalLight(0xfff3d6, 1); S.scene.add(S.sun);
    // Aparición junto a la aldea
    S.pos = new T.Vector3(2.5, groundY(2,2,H-1)+1, 2.5);
    // Tamaño
    const resize = () => { const w = host.clientWidth||innerWidth, h = host.clientHeight||innerHeight; S.renderer.setSize(w,h); S.camera.aspect = w/h; S.camera.updateProjectionMatrix(); };
    S.onResize = resize; addEventListener("resize", resize);
    // Datos guardados
    loadLocal();
    buildHud(host);
    setupControls(S.renderer.domElement);
    showScreen(); resize();
    spawnCreatures();
    connect();
    loadCloud().then(() => { S.chunks.forEach((m,k) => { if (!S.buildQueue.includes(k)) S.buildQueue.push(k); }); updHud(); });
    S.raf = requestAnimationFrame(tick);
    try { toast("⛏️ Mundo Quiz: construye libre — todo queda guardado"); } catch(e){}
  }

  function close(){
    if (!S) return;
    S.running = false;
    cancelAnimationFrame(S.raf);
    flushCloud(); saveLocal();
    try { S.ch && sbClient().removeChannel(S.ch); } catch(e){}
    removeEventListener("resize", S.onResize);
    if (S.onMouseMove) document.removeEventListener("mousemove", S.onMouseMove);
    if (S.onKey){ document.removeEventListener("keydown", S.onKey); document.removeEventListener("keyup", S.onKey); }
    try { document.exitPointerLock && document.exitPointerLock(); } catch(e){}
    S.chunks.forEach(m => disposeGroup(m));
    try { S.renderer.dispose(); } catch(e){}
    const host = $("#mundoScreen"); if (host) host.innerHTML = "";
    const cb = S.onExit; S = null;
    if (cb) cb();
  }

  return { open, close, _logic: { hash2, fbm, column, terrainAt, blockAt, raycast, edits, ekey, WATER, H,
    _applyEditLocal(x,y,z,b){ edits.set(ekey(x,y,z), b); } } };
})();
