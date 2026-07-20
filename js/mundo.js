// ============================================================
// GAME QUIZ — MUNDO QUIZ ⛏️ (sandbox voxel 3D estilo Minecraft)
// Un ÚNICO mundo compartido y persistente: entra solo o con amigos.
//
// Gráficos v2:
// - Texturas pixeladas 16x16 (atlas procedural en canvas, NearestFilter)
//   con cara superior/lateral/inferior distintas (pasto, tronco, etc.)
// - Oclusión ambiental por vértice (sombras suaves en las esquinas)
// - Sol, luna, estrellas y nubes en movimiento; niebla acorde al cielo
// - Resaltado del bloque apuntado; agua animada semitransparente
// - Animales y aldeanos con patas y animación al caminar
// Controles v2:
// - Auto-salto al caminar contra un bloque (como Minecraft móvil)
// - Mantener presionado para picar seguido; correr con Shift
// - Joystick táctil más suave + botones grandes
// Persistencia: Supabase mundo_edits (supabase-mundo.sql) + localStorage;
// sincronización en vivo por Realtime (broadcast + presence).
// ============================================================
const Mundo = (() => {
  const $ = s => document.querySelector(s);
  const sbClient = () => (typeof sb !== "undefined" && sb) ? sb : (window.sb || null);

  // ---------- Constantes ----------
  const H = 64, WATER = 18, CH = 16, SEED = 1337;
  const DAY_MS = 8 * 60 * 1000;
  const isTouch = () => "ontouchstart" in window;
  const RADIUS = () => isTouch() ? 2 : 3;

  const AIR=0, GRASS=1, DIRT=2, STONE=3, SAND=4, WATERB=5, WOOD=6, LEAF=7, SNOW=8, LAVA=9, BASALT=10, PLANK=11, BRICK=12;
  const NAMES  = { [GRASS]:"Pasto",[DIRT]:"Tierra",[STONE]:"Piedra",[SAND]:"Arena",[WOOD]:"Tronco",[LEAF]:"Hojas",[SNOW]:"Nieve",[PLANK]:"Madera",[BRICK]:"Ladrillo" };
  const HOTBAR = [GRASS, DIRT, STONE, SAND, WOOD, PLANK, LEAF, BRICK, SNOW];
  const solid = b => b !== AIR && b !== WATERB && b !== LAVA;

  // ---------- Ruido determinista ----------
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
    return s;
  }

  // ---------- Terreno ----------
  const colCache = new Map();
  function column(x, z){
    const k = x + "," + z;
    let c = colCache.get(k); if (c) return c;
    const e = fbm(x*0.004, z*0.004, 4);
    let h = 14 + Math.pow(Math.max(0, e-0.25)*1.9, 2.2) * 66;
    let biome = "plains";
    if (h > 42) biome = "mountain";
    const cy = fbm(x*0.008+900, z*0.008+900, 3);
    if (cy > 0.74){ h -= (cy-0.74)*160; biome = "canyon"; }
    const rv = Math.abs(fbm(x*0.0028+500, z*0.0028+500, 3) - 0.5);
    if (rv < 0.016 && biome !== "mountain"){ h = Math.min(h, WATER - 2 + rv*80); biome = "river"; }
    const VCELL = 192;
    const vx = Math.floor(x/VCELL), vz = Math.floor(z/VCELL);
    const vcx = vx*VCELL + Math.floor(hash2(vx,vz)*VCELL*0.6) + VCELL*0.2;
    const vcz = vz*VCELL + Math.floor(hash2(vx+7,vz+7)*VCELL*0.6) + VCELL*0.2;
    if (hash2(vx+3,vz+9) > 0.45){
      const d = Math.hypot(x-vcx, z-vcz), R = 24;
      if (d < R){
        const cone = 26 + (R-d)*1.35;
        if (d < 4.5){ h = 34; biome = "crater"; }
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
  const isTree = (x,z) => { const c = column(x,z); return c.biome === "plains" && c.h > WATER+2 && hash2(x*3+11, z*3+17) > 0.985; };
  const HOUSES = [[6,6],[18,4],[8,20],[20,18]];
  function houseBlock(x, y, z){
    for (const [hx,hz] of HOUSES){
      const g = column(hx+2, hz+2).h;
      const lx = x-hx, lz = z-hz, ly = y-g;
      if (lx<0||lx>4||lz<0||lz>4||ly<1||ly>4) continue;
      if (ly === 4) return PLANK;
      if (lx===0||lx===4||lz===0||lz===4){
        if (lz===0 && lx===2 && ly<=2) return AIR;
        return (ly===2 && (lx===2||lz===2)) ? AIR : BRICK;
      }
      return AIR;
    }
    return -1;
  }
  function terrainAt(x, y, z){
    if (y < 0 || y >= H) return AIR;
    if (y === 0) return STONE;
    const hb = houseBlock(x,y,z); if (hb >= 0) return hb;
    const { h, biome } = column(x, z);
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
  const edits = new Map();
  const ekey = (x,y,z) => x+","+y+","+z;
  function blockAt(x, y, z){
    const e = edits.get(ekey(x,y,z));
    return e !== undefined ? e : terrainAt(x,y,z);
  }

  let S = null;

  // ---------- Atlas de texturas 16x16 (pixel-art procedural) ----------
  // Tiles: 0 pasto-top 1 pasto-lado 2 tierra 3 piedra 4 arena 5 agua 6 tronco-lado
  //        7 tronco-top 8 hojas 9 nieve 10 lava 11 basalto 12 madera 13 ladrillo
  const TILE = 16, COLS = 4, ROWS = 4;
  function px(ctx, x, y, c){ ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); }
  function drawTile(ctx, tx, ty, fn){
    ctx.save(); ctx.translate(tx*TILE, ty*TILE);
    for (let x=0;x<TILE;x++) for (let y=0;y<TILE;y++) fn(x, y, (a)=>px(ctx,x,y,a), hash2(tx*TILE+x + ty*7919, y));
    ctx.restore();
  }
  function shadeHex(base, f){
    const r = Math.min(255, (base>>16&255)*f), g = Math.min(255, (base>>8&255)*f), b = Math.min(255, (base&255)*f);
    return `rgb(${r|0},${g|0},${b|0})`;
  }
  function makeAtlas(){
    const cv = document.createElement("canvas");
    cv.width = COLS*TILE; cv.height = ROWS*TILE;
    const ctx = cv.getContext("2d");
    const speckle = (base, lo, hi) => (x,y,put,r) => put(shadeHex(base, lo + r*(hi-lo)));
    const tiles = [
      speckle(0x6abe30, 0.82, 1.08),                                        // 0 pasto top
      (x,y,put,r) => {                                                      // 1 pasto lado
        if (y < 3 + (r>0.5?1:0)) put(shadeHex(0x6abe30, 0.8 + r*0.3));
        else put(shadeHex(0x8a5a32, 0.78 + r*0.34));
      },
      speckle(0x8a5a32, 0.76, 1.1),                                         // 2 tierra
      (x,y,put,r) => {                                                      // 3 piedra con grietas
        const crack = (x*7+y*13)%23===0;
        put(shadeHex(0x8d8d94, crack ? 0.6 : 0.82 + r*0.26));
      },
      speckle(0xe6d9a2, 0.86, 1.06),                                        // 4 arena
      (x,y,put,r) => {                                                      // 5 agua con ondas
        const wave = Math.sin((x+y*2)*0.9) > 0.6;
        put(shadeHex(0x3f76e4, wave ? 1.16 : 0.85 + r*0.2));
      },
      (x,y,put,r) => {                                                      // 6 tronco lado (vetas verticales)
        const stripe = x%4===0 || (x+2)%5===0;
        put(shadeHex(0x6b4a2b, stripe ? 0.66 : 0.85 + r*0.24));
      },
      (x,y,put,r) => {                                                      // 7 tronco top (anillos)
        const d = Math.hypot(x-7.5, y-7.5)|0;
        put(shadeHex(0x9c7040, d%3===0 ? 0.68 : 0.9 + r*0.16));
      },
      (x,y,put,r) => {                                                      // 8 hojas con huecos oscuros
        put(shadeHex(0x3e8f3e, r > 0.82 ? 0.5 : 0.78 + r*0.4));
      },
      speckle(0xf4f8fb, 0.93, 1.02),                                        // 9 nieve
      (x,y,put,r) => {                                                      // 10 lava en remolino
        const s = Math.sin(x*0.8)+Math.cos(y*0.8);
        put(shadeHex(s > 0.7 ? 0xffdd55 : 0xe25822, 0.85 + r*0.3));
      },
      speckle(0x4a4046, 0.72, 1.12),                                        // 11 basalto
      (x,y,put,r) => {                                                      // 12 tablones de madera
        const line = y%4===0 || (y%4===3 && x%8===0);
        put(shadeHex(0xb08a55, line ? 0.62 : 0.86 + r*0.2));
      },
      (x,y,put,r) => {                                                      // 13 ladrillo clásico
        const row = Math.floor(y/4), off = row%2 ? 2 : 6;
        const mortar = y%4===0 || (x+off)%8===0;
        put(mortar ? "#cbb9a8" : shadeHex(0xa5524a, 0.82 + r*0.26));
      },
    ];
    tiles.forEach((fn,i) => drawTile(ctx, i%COLS, Math.floor(i/COLS), fn));
    const T = window.THREE;
    const tex = new T.CanvasTexture(cv);
    tex.magFilter = T.NearestFilter; tex.minFilter = T.NearestFilter;
    tex.generateMipmaps = false; tex.colorSpace = T.SRGBColorSpace;
    return tex;
  }
  // qué tile usa cada bloque según la cara: [top, lado, bottom]
  const BLOCK_TILES = {
    [GRASS]:[0,1,2], [DIRT]:[2,2,2], [STONE]:[3,3,3], [SAND]:[4,4,4], [WATERB]:[5,5,5],
    [WOOD]:[7,6,7], [LEAF]:[8,8,8], [SNOW]:[9,9,9], [LAVA]:[10,10,10], [BASALT]:[11,11,11],
    [PLANK]:[12,12,12], [BRICK]:[13,13,13],
  };
  function tileUV(tile){
    const e = 0.02;   // pequeño margen para evitar sangrado entre tiles
    const u0 = (tile%COLS)/COLS, v0 = 1 - (Math.floor(tile/COLS)+1)/ROWS;
    return [u0 + e/COLS, v0 + e/ROWS, u0 + (1-e)/COLS, v0 + (1-e)/ROWS];
  }

  // ---------- Caras del cubo (con ejes para oclusión ambiental) ----------
  // n: normal · c: 4 esquinas (CCW desde afuera) · t: los 2 ejes tangentes
  const FACES = [
    { n:[ 1,0,0], t:[[0,0,1],[0,1,0]], shade:.80, kind:1, c:[[1,0,0],[1,1,0],[1,1,1],[1,0,1]] },
    { n:[-1,0,0], t:[[0,0,1],[0,1,0]], shade:.80, kind:1, c:[[0,0,1],[0,1,1],[0,1,0],[0,0,0]] },
    { n:[0, 1,0], t:[[1,0,0],[0,0,1]], shade:1.0, kind:0, c:[[0,1,0],[0,1,1],[1,1,1],[1,1,0]] },
    { n:[0,-1,0], t:[[1,0,0],[0,0,1]], shade:.55, kind:2, c:[[0,0,0],[1,0,0],[1,0,1],[0,0,1]] },
    { n:[0,0, 1], t:[[1,0,0],[0,1,0]], shade:.72, kind:1, c:[[1,0,1],[1,1,1],[0,1,1],[0,0,1]] },
    { n:[0,0,-1], t:[[1,0,0],[0,1,0]], shade:.72, kind:1, c:[[0,0,0],[0,1,0],[1,1,0],[1,0,0]] },
  ];
  const AO_LEVELS = [0.45, 0.62, 0.8, 1.0];
  function vertexAO(bx, by, bz, face, corner){
    // celda vecina en la dirección de la cara
    const nx = bx+face.n[0], ny = by+face.n[1], nz = bz+face.n[2];
    // signos del vértice a lo largo de los ejes tangentes
    const s1 = (corner[0]*face.t[0][0] + corner[1]*face.t[0][1] + corner[2]*face.t[0][2]) ? 1 : -1;
    const s2 = (corner[0]*face.t[1][0] + corner[1]*face.t[1][1] + corner[2]*face.t[1][2]) ? 1 : -1;
    const a = solid(blockAt(nx+face.t[0][0]*s1, ny+face.t[0][1]*s1, nz+face.t[0][2]*s1));
    const b = solid(blockAt(nx+face.t[1][0]*s2, ny+face.t[1][1]*s2, nz+face.t[1][2]*s2));
    const c = solid(blockAt(nx+face.t[0][0]*s1+face.t[1][0]*s2, ny+face.t[0][1]*s1+face.t[1][1]*s2, nz+face.t[0][2]*s1+face.t[1][2]*s2));
    return AO_LEVELS[(a && b) ? 0 : 3 - (a+b+c)];
  }

  // ---------- Construcción de chunks ----------
  const chunkKey = (cx,cz) => cx+","+cz;
  function buildChunk(cx, cz){
    const T = window.THREE;
    const pos=[], nor=[], col=[], uv=[], idx=[];
    const wpos=[], wnor=[], wcol=[], wuv=[], widx=[];
    for (let lx=0; lx<CH; lx++) for (let lz=0; lz<CH; lz++){
      const x = cx*CH+lx, z = cz*CH+lz;
      for (let y=0; y<H; y++){
        const b = blockAt(x,y,z); if (b === AIR) continue;
        const isW = (b === WATERB);
        const P = isW?wpos:pos, N = isW?wnor:nor, C = isW?wcol:col, U = isW?wuv:uv, I = isW?widx:idx;
        const tiles = BLOCK_TILES[b] || BLOCK_TILES[STONE];
        const sink = isW && blockAt(x,y+1,z)===AIR ? 0.87 : 1;
        for (const f of FACES){
          const nb = blockAt(x+f.n[0], y+f.n[1], z+f.n[2]);
          const show = isW ? (nb === AIR) : (!solid(nb) && nb !== b);
          if (!show) continue;
          const [u0,v0,u1,v1] = tileUV(tiles[f.kind]);
          const uvC = [[u0,v0],[u0,v1],[u1,v1],[u1,v0]];
          const base = P.length/3;
          f.c.forEach((cn,i) => {
            P.push(x+cn[0], y + cn[1]*sink, z+cn[2]);
            N.push(f.n[0], f.n[1], f.n[2]);
            const ao = isW ? 1 : vertexAO(x,y,z,f,cn);
            const s = f.shade * ao;
            C.push(s, s, s);
            U.push(uvC[i][0], uvC[i][1]);
          });
          I.push(base,base+1,base+2, base,base+2,base+3);
        }
      }
    }
    const group = new T.Group();
    const mk = (p,n,c,u,i,mat) => {
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.Float32BufferAttribute(p,3));
      g.setAttribute("normal", new T.Float32BufferAttribute(n,3));
      g.setAttribute("color", new T.Float32BufferAttribute(c,3));
      g.setAttribute("uv", new T.Float32BufferAttribute(u,2));
      g.setIndex(i);
      group.add(new T.Mesh(g, mat));
    };
    if (pos.length) mk(pos,nor,col,uv,idx, S.matSolid);
    if (wpos.length) mk(wpos,wnor,wcol,wuv,widx, S.matWater);
    return group;
  }
  function ensureChunks(){
    const R = RADIUS();
    const pcx = Math.floor(S.pos.x/CH), pcz = Math.floor(S.pos.z/CH);
    const want = new Set();
    for (let dx=-R; dx<=R; dx++) for (let dz=-R; dz<=R; dz++){
      const k = chunkKey(pcx+dx, pcz+dz); want.add(k);
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

  // ---------- Persistencia ----------
  const LS_KEY = "gq_mundo_edits";
  function loadLocal(){ try { const j = JSON.parse(localStorage.getItem(LS_KEY) || "{}"); Object.entries(j).forEach(([k,v]) => edits.set(k, v)); } catch(e){} }
  function saveLocal(){ try { const o = {}; edits.forEach((v,k) => o[k]=v); localStorage.setItem(LS_KEY, JSON.stringify(o)); } catch(e){} }
  async function loadCloud(){
    const c = sbClient(); if (!c) return;
    try {
      const { data, error } = await c.from("mundo_edits").select("x,y,z,b").limit(100000);
      if (error || !data){ S.cloud = false; return; }
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

  // ---------- Raycast voxel ----------
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

  // ---------- Física ----------
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

  // ---------- Cielo: sol, luna, estrellas, nubes ----------
  function buildSky(){
    const T = window.THREE;
    S.skyG = new T.Group(); S.scene.add(S.skyG);
    const disc = (color, size) => {
      const m = new T.Mesh(new T.PlaneGeometry(size,size), new T.MeshBasicMaterial({ color, fog:false }));
      S.skyG.add(m); return m;
    };
    S.sunM = disc(0xffe9a8, 22);
    S.moonM = disc(0xd8e2f5, 14);
    // Estrellas
    const starPos = [];
    for (let i=0;i<420;i++){
      const a = hash2(i,1)*Math.PI*2, b = Math.acos(hash2(i,2)*2-1);
      starPos.push(Math.sin(b)*Math.cos(a)*260, Math.abs(Math.cos(b))*260+10, Math.sin(b)*Math.sin(a)*260);
    }
    const sg = new T.BufferGeometry();
    sg.setAttribute("position", new T.Float32BufferAttribute(starPos,3));
    S.stars = new T.Points(sg, new T.PointsMaterial({ color:0xffffff, size:1.6, sizeAttenuation:false, transparent:true, opacity:0, fog:false }));
    S.skyG.add(S.stars);
    // Nubes: placas blancas que van a la deriva
    S.clouds = new T.Group();
    const cm = new T.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.55, fog:false });
    for (let i=0;i<16;i++){
      const w = 10+hash2(i,5)*22, d = 6+hash2(i,6)*14;
      const c = new T.Mesh(new T.BoxGeometry(w, 1.1, d), cm);
      c.position.set((hash2(i,7)-0.5)*300, 76+hash2(i,8)*8, (hash2(i,9)-0.5)*300);
      S.clouds.add(c);
    }
    S.scene.add(S.clouds);
  }
  function dayT(){ return ((Date.now() % DAY_MS) / DAY_MS); }
  function updateSky(dt){
    const T = window.THREE;
    const t = dayT();
    const ang = t * Math.PI * 2 - Math.PI/2;
    const sunUp = Math.sin(ang+Math.PI/2);
    const day = Math.max(0, Math.min(1, (sunUp+0.25)*1.6));
    const sx = Math.cos(ang)*180, sy = Math.sin(ang+Math.PI/2)*180;
    S.sun.position.set(sx, Math.max(10,sy), 60);
    S.sun.intensity = 0.35 + day*0.9;
    S.amb.intensity = 0.3 + day*0.5;
    // discos de sol y luna orbitando alrededor del jugador
    S.skyG.position.copy(S.pos);
    S.sunM.position.set(sx, sy, 40); S.sunM.lookAt(S.skyG.position.x*0+0,0,0); S.sunM.lookAt(0,0,0);
    S.moonM.position.set(-sx, -sy, -40); S.moonM.lookAt(0,0,0);
    S.sunM.visible = sy > -20; S.moonM.visible = -sy > -20;
    S.stars.material.opacity = Math.max(0, 0.9 - day*1.4);
    const sky = new T.Color().lerpColors(new T.Color(0x0a0e2a), new T.Color(0x8fc8ef), day);
    const horizon = new T.Color().lerpColors(new T.Color(0x101433), new T.Color(0xc6e3f7), day);
    S.scene.background = sky;
    if (S.scene.fog) S.scene.fog.color = horizon;
    // nubes a la deriva, siempre alrededor del jugador
    S.clouds.children.forEach((c,i) => {
      c.position.x += dt * (1.2 + (i%3)*0.4);
      if (c.position.x - S.pos.x > 170) c.position.x -= 340;
      if (S.pos.x - c.position.x > 170) c.position.x += 340;
      if (c.position.z - S.pos.z > 170) c.position.z -= 340;
      if (S.pos.z - c.position.z > 170) c.position.z += 340;
    });
    S.clouds.children.forEach(c => c.material.opacity = 0.25 + day*0.35);
  }

  // ---------- Criaturas ----------
  function makeCreature(type){
    const T = window.THREE;
    const g = new T.Group(); g.legs = [];
    const mat = c => new T.MeshLambertMaterial({ color: c });
    const box = (w,h,d,c,x,y,z) => { const m = new T.Mesh(new T.BoxGeometry(w,h,d), mat(c)); m.position.set(x,y,z); g.add(m); return m; };
    const leg = (c,x,z,h=0.3) => { const m = box(.14,h,.14, c, x, h/2, z); m.baseY = h/2; g.legs.push(m); return m; };
    if (type === "villager"){
      box(.5,.8,.3, 0x8a6642, 0,.85,0);
      box(.34,.34,.34, 0xd9a066, 0,1.45,0);
      box(.1,.14,.06, 0xb5854f, 0,1.4,.19);       // nariz
      box(.44,.1,.34, 0x6e4f33, 0,1.66,0);        // pelo
      box(.12,.5,.12, 0x8a6642, -.31,.95,0); box(.12,.5,.12, 0x8a6642, .31,.95,0);  // brazos
      leg(0x5c452c,-.12,.0,.45); leg(0x5c452c,.12,0,.45);
    } else if (type === "pig"){
      box(.8,.45,.5, 0xeba3a3, 0,.55,0);
      const h = box(.36,.34,.34, 0xeba3a3, .52,.62,0);
      box(.14,.1,.06, 0xd97f7f, .72,.58,0);       // hocico
      leg(0xd98f8f,-.25,-.15); leg(0xd98f8f,-.25,.15); leg(0xd98f8f,.25,-.15); leg(0xd98f8f,.25,.15);
    } else if (type === "sheep"){
      box(.8,.5,.55, 0xf2f2f2, 0,.62,0);
      box(.3,.3,.28, 0xccb9a8, .52,.7,0);
      leg(0xe8e2da,-.25,-.16,.4); leg(0xe8e2da,-.25,.16,.4); leg(0xe8e2da,.25,-.16,.4); leg(0xe8e2da,.25,.16,.4);
    } else {
      box(.9,.55,.55, 0x6e4a34, 0,.62,0);
      box(.34,.32,.3, 0x6e4a34, .56,.72,0);
      box(.3,.1,.32, 0xd9c8b8, .56,.6,0);         // hocico
      leg(0x5a3c2a,-.28,-.16,.35); leg(0x5a3c2a,-.28,.16,.35); leg(0x5a3c2a,.28,-.16,.35); leg(0x5a3c2a,.28,.16,.35);
    }
    return g;
  }
  function spawnCreatures(){
    const types = ["pig","sheep","cow"];
    for (let i=0;i<8;i++){
      const a = hash2(i,99)*Math.PI*2, d = 12 + hash2(i,7)*30;
      const x = S.pos.x + Math.cos(a)*d, z = S.pos.z + Math.sin(a)*d;
      const mesh = makeCreature(types[i%3]);
      mesh.position.set(x, groundY(x,z,H-1), z);
      S.scene.add(mesh);
      S.creatures.push({ mesh, type: types[i%3], dir: hash2(i,3)*Math.PI*2, t: 0, walk: 0 });
    }
    for (let i=0;i<4;i++){
      const [hx,hz] = HOUSES[i%HOUSES.length];
      const x = hx+2.5, z = hz+7;
      const mesh = makeCreature("villager");
      mesh.position.set(x, groundY(x,z,H-1), z);
      S.scene.add(mesh);
      S.creatures.push({ mesh, type:"villager", dir: i*1.6, t: 0, home:[x,z], walk: 0 });
    }
  }
  function updateCreatures(dt){
    for (const c of S.creatures){
      c.t -= dt;
      if (c.t <= 0){ c.t = 2 + Math.random()*4; c.dir = Math.random()*Math.PI*2; c.moving = Math.random() > 0.35; }
      if (c.moving){
        const sp = c.type === "villager" ? 0.9 : 1.4;
        let nx = c.mesh.position.x + Math.cos(c.dir)*sp*dt;
        let nz = c.mesh.position.z + Math.sin(c.dir)*sp*dt;
        if (c.home && Math.hypot(nx-c.home[0], nz-c.home[1]) > 10){ c.dir += Math.PI; continue; }
        const gy = groundY(nx, nz, c.mesh.position.y+2);
        if (Math.abs(gy - c.mesh.position.y) > 1.6){ c.dir += Math.PI/2; continue; }
        c.mesh.position.set(nx, gy, nz);
        c.mesh.rotation.y = -c.dir + Math.PI/2;
        c.walk += dt*8;
      }
      // patitas al caminar
      const sw = c.moving ? Math.sin(c.walk)*0.5 : 0;
      c.mesh.legs.forEach((l,i) => { l.rotation.x = (i%2 ? sw : -sw); });
    }
  }

  // ---------- Disparo ----------
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
        if (c.type === "villager") continue;
        if (p.distanceTo(c.mesh.position) < 0.9){
          dead = true;
          const nx = S.pos.x + (Math.random()*60-30), nz = S.pos.z + (Math.random()*60-30);
          c.mesh.position.set(nx, groundY(nx,nz,H-1), nz);
          try { Sfx.correct(); } catch(e){}
        }
      }
      if (dead){ S.scene.remove(s.mesh); s.mesh.geometry.dispose(); S.shots.splice(i,1); }
    }
  }

  // ---------- Multijugador ----------
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
      const body = new T.Mesh(new T.BoxGeometry(.5,.78,.28), new T.MeshLambertMaterial({ color: 0x4a6cf0 }));
      body.position.y = .95;
      const head = new T.Mesh(new T.BoxGeometry(.4,.4,.4), new T.MeshLambertMaterial({ color: 0xd9a066 }));
      head.position.y = 1.55;
      const l1 = new T.Mesh(new T.BoxGeometry(.16,.55,.16), new T.MeshLambertMaterial({ color: 0x27408b }));
      l1.position.set(-.13,.28,0);
      const l2 = l1.clone(); l2.position.x = .13;
      g.add(body, head, l1, l2);
      S.scene.add(g);
      r = S.remotes[p.id] = { mesh: g, tx:p.x, ty:p.y, tz:p.z, ry:p.ry||0 };
    }
    r.tx = p.x; r.ty = p.y; r.tz = p.z; r.ry = p.ry || 0;
  }
  function removeRemote(id){ const r = S.remotes[id]; if (!r) return; S.scene.remove(r.mesh); delete S.remotes[id]; }
  function broadcastPos(){
    const now = performance.now();
    if (now - (S.lastPosSend||0) < 150) return;
    S.lastPosSend = now;
    try { S.ch && S.ch.send({ type:"broadcast", event:"pos", payload:{ id:S.myId, x:S.pos.x, y:S.pos.y, z:S.pos.z, ry:S.yaw } }); } catch(e){}
  }

  // ---------- HUD ----------
  function buildHud(host){
    const atlasCv = S.atlas.image;
    const tileImg = (b) => {
      const t = BLOCK_TILES[b][0];
      const c = document.createElement("canvas"); c.width = c.height = TILE;
      c.getContext("2d").drawImage(atlasCv, (t%COLS)*TILE, Math.floor(t/COLS)*TILE, TILE, TILE, 0, 0, TILE, TILE);
      return c.toDataURL();
    };
    const hb = HOTBAR.map((b,i) => `<button class="mun-slot ${i===0?'on':''}" data-i="${i}" title="${NAMES[b]}"><img src="${tileImg(b)}" alt="${NAMES[b]}"></button>`).join("");
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
            <button class="mun-act" id="munMine">⛏️</button>
            <button class="mun-act" id="munPut">🧱</button>
            <button class="mun-act" id="munShoot">🎯</button>
            <button class="mun-act mun-jump" id="munJump">⬆️</button>
          </div>` : `
          <p class="mun-help">Click para entrar · WASD mover · Shift correr · espacio saltar · click izq romper · click der poner · Q disparar</p>`}
      </div>`);
    $("#munExit").onclick = () => close();
    document.querySelectorAll(".mun-slot").forEach(b => b.onclick = (ev) => {
      ev.stopPropagation();
      S.slot = +b.dataset.i;
      document.querySelectorAll(".mun-slot").forEach(x => x.classList.toggle("on", +x.dataset.i === S.slot));
      try { Sfx.click(); } catch(e){}
    });
  }
  function updHud(){
    const el = $("#munInfo"); if (!el) return;
    const t = dayT();
    const icon = t < .25 ? "🌅" : t < .5 ? "☀️" : t < .55 ? "🌇" : "🌙";
    el.textContent = `${icon}  👥 ${Math.max(1, S.online||1)}${S.cloud===false ? "  💾 local" : ""}`;
  }

  // ---------- Controles ----------
  function startRepeat(mode){
    stopRepeat();
    act(mode);
    S.repTimer = setInterval(() => act(mode), 280);
  }
  function stopRepeat(){ if (S.repTimer){ clearInterval(S.repTimer); S.repTimer = null; } }
  function setupControls(cv){
    S.keys = {};
    if (!isTouch()){
      cv.addEventListener("click", () => { if (document.pointerLockElement !== cv) cv.requestPointerLock && cv.requestPointerLock(); });
      document.addEventListener("pointerlockchange", () => { S.locked = document.pointerLockElement === cv; if (!S.locked) stopRepeat(); });
      S.onMouseMove = e => { if (!S.locked) return; S.yaw -= e.movementX*0.0023; S.pitch = Math.max(-1.55, Math.min(1.55, S.pitch - e.movementY*0.0023)); };
      document.addEventListener("mousemove", S.onMouseMove);
      S.onMouseDown = e => { if (!S.locked) return; if (e.button === 0) startRepeat("mine"); else if (e.button === 2) startRepeat("put"); };
      S.onMouseUp = () => stopRepeat();
      cv.addEventListener("mousedown", S.onMouseDown);
      document.addEventListener("mouseup", S.onMouseUp);
      cv.addEventListener("contextmenu", e => e.preventDefault());
      S.onKey = e => {
        S.keys[e.code] = e.type === "keydown";
        if (e.type === "keydown" && e.code === "KeyQ") shoot();
        if (e.type === "keydown" && /^Digit[1-9]$/.test(e.code)){
          S.slot = +e.code.slice(5) - 1;
          document.querySelectorAll(".mun-slot").forEach(x => x.classList.toggle("on", +x.dataset.i === S.slot));
        }
      };
      document.addEventListener("keydown", S.onKey);
      document.addEventListener("keyup", S.onKey);
    } else {
      const stick = $("#munStick"), knob = $("#munKnob");
      let sid = null, sx=0, sy=0;
      stick.addEventListener("touchstart", e => { const t=e.changedTouches[0]; sid=t.identifier; const r=stick.getBoundingClientRect(); sx=r.left+r.width/2; sy=r.top+r.height/2; }, {passive:true});
      stick.addEventListener("touchmove", e => {
        for (const t of e.changedTouches){ if (t.identifier!==sid) continue;
          const dx=(t.clientX-sx)/46, dy=(t.clientY-sy)/46;
          const len = Math.hypot(dx,dy) || 1, cl = Math.min(1, len);
          S.stickX = dx/len*cl; S.stickY = dy/len*cl;
          knob.style.transform = `translate(${S.stickX*30}px,${S.stickY*30}px)`;
        }
      }, {passive:true});
      const endS = e => { for (const t of e.changedTouches){ if (t.identifier===sid){ sid=null; S.stickX=0; S.stickY=0; knob.style.transform=""; } } };
      stick.addEventListener("touchend", endS); stick.addEventListener("touchcancel", endS);
      let lid=null, lx=0, ly=0;
      cv.addEventListener("touchstart", e => { const t=e.changedTouches[0]; lid=t.identifier; lx=t.clientX; ly=t.clientY; }, {passive:true});
      cv.addEventListener("touchmove", e => {
        for (const t of e.changedTouches){ if (t.identifier!==lid) continue;
          S.yaw -= (t.clientX-lx)*0.0052; S.pitch = Math.max(-1.55, Math.min(1.55, S.pitch-(t.clientY-ly)*0.0052));
          lx=t.clientX; ly=t.clientY;
        }
      }, {passive:true});
      cv.addEventListener("touchend", e => { for (const t of e.changedTouches){ if (t.identifier===lid) lid=null; } });
      const hold = (id, down, up) => { const b=$(id); if(!b) return;
        b.addEventListener("touchstart", e=>{ e.preventDefault(); down(); }, {passive:false});
        b.addEventListener("touchend", e=>{ e.preventDefault(); up && up(); }, {passive:false});
      };
      hold("#munJump", () => { S.wantJump = true; });
      hold("#munMine", () => startRepeat("mine"), stopRepeat);
      hold("#munPut",  () => startRepeat("put"), stopRepeat);
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
      const inMe = Math.floor(S.pos.x)===px && Math.floor(S.pos.z)===pz && py>=Math.floor(S.pos.y) && py<=Math.floor(S.pos.y)+1;
      if (inMe) return;
      applyEdit(px, py, pz, HOTBAR[S.slot||0], false);
      try { Sfx.pick(); } catch(e){}
    }
  }

  // ---------- Bucle principal ----------
  function tick(now){
    if (!S || !S.running) return;
    S.raf = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - (S.lastT||now))/1000); S.lastT = now;

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
    const sprint = !isTouch() && (S.keys["ShiftLeft"]||S.keys["ShiftRight"]);
    const speed = (inWater ? 2.4 : 4.4) * (sprint ? 1.6 : 1);
    const sin = Math.sin(S.yaw), cos = Math.cos(S.yaw);
    const vx = (mx*cos - mz*sin) * speed, vz = (mx*-sin - mz*cos) * speed;
    S.vy = inWater ? Math.max(S.vy - 4*dt, -2) : S.vy - 22*dt;
    if (S.wantJump){ if (S.onGround || inWater) S.vy = inWater ? 3.5 : 7.6; S.wantJump = false; }
    // mover por ejes con AUTO-SALTO (sube solo escalones de 1 bloque)
    const tryMove = (nx, nz) => {
      if (!collide(nx, S.pos.y, nz)){ S.pos.x = nx; S.pos.z = nz; return; }
      if (S.onGround && !collide(nx, S.pos.y+1.05, nz) && !collide(S.pos.x, S.pos.y+1.05, S.pos.z)){
        S.pos.y += 1.05; S.pos.x = nx; S.pos.z = nz;   // escalón de 1 bloque
      }
    };
    tryMove(S.pos.x + vx*dt, S.pos.z);
    tryMove(S.pos.x, S.pos.z + vz*dt);
    let ny = S.pos.y + S.vy*dt;
    S.onGround = false;
    if (collide(S.pos.x, ny, S.pos.z)){
      if (S.vy < 0) S.onGround = true;
      S.vy = 0;
    } else S.pos.y = ny;
    if (S.pos.y < -8){ S.pos.set(2, groundY(2,2,H-1)+1, 2); S.vy = 0; }

    S.camera.position.set(S.pos.x, S.pos.y + 1.62, S.pos.z);
    S.camera.rotation.set(0,0,0);
    S.camera.rotateY(S.yaw); S.camera.rotateX(S.pitch);

    // resaltar el bloque apuntado
    const dirV = new window.THREE.Vector3(); S.camera.getWorldDirection(dirV);
    const hit = raycast(S.camera.position, dirV, 6);
    if (hit){ S.hl.visible = true; S.hl.position.set(hit.hit[0]+0.5, hit.hit[1]+0.5, hit.hit[2]+0.5); }
    else S.hl.visible = false;

    ensureChunks();
    processBuildQueue();
    updateCreatures(dt);
    updateShots(dt);
    updateSky(dt);
    // agua animada (desliza la textura)
    S.waterTex.offset.x = (now*0.00002) % 1; S.waterTex.offset.y = (now*0.000013) % 1;
    broadcastPos();
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
      yaw: Math.PI, pitch: -0.08, vy: 0, slot: 0, online: 1, running: true, cloud: undefined,
    };
    S.scene = new T.Scene();
    S.scene.fog = new T.Fog(0xc6e3f7, 24, RADIUS()*CH*2.1);
    S.camera = new T.PerspectiveCamera(75, 1, 0.1, 600);
    S.renderer = new T.WebGLRenderer({ antialias: false });
    S.renderer.setPixelRatio(Math.min(devicePixelRatio||1, isTouch() ? 1.5 : 2));
    host.appendChild(S.renderer.domElement);
    // materiales con atlas de texturas
    S.atlas = makeAtlas();
    S.matSolid = new T.MeshLambertMaterial({ map: S.atlas, vertexColors: true });
    const wcv = document.createElement("canvas"); wcv.width = wcv.height = TILE;
    const wctx = wcv.getContext("2d");
    for (let x=0;x<TILE;x++) for (let y=0;y<TILE;y++){
      const wave = Math.sin((x+y*2)*0.9) > 0.6;
      px(wctx, x, y, shadeHex(0x3f76e4, wave ? 1.16 : 0.85 + hash2(x,y)*0.2));
    }
    S.waterTex = new T.CanvasTexture(wcv);
    S.waterTex.magFilter = T.NearestFilter; S.waterTex.minFilter = T.NearestFilter;
    S.waterTex.wrapS = S.waterTex.wrapT = T.RepeatWrapping; S.waterTex.colorSpace = T.SRGBColorSpace;
    S.matWater = new T.MeshLambertMaterial({ map: S.waterTex, vertexColors: true, transparent: true, opacity: 0.75 });
    S.amb = new T.AmbientLight(0xffffff, 0.6); S.scene.add(S.amb);
    S.sun = new T.DirectionalLight(0xfff3d6, 1); S.scene.add(S.sun);
    S.hemi = new T.HemisphereLight(0xbfd9ff, 0x6b5a3e, 0.35); S.scene.add(S.hemi);
    // resaltado del bloque apuntado
    S.hl = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(1.002,1.002,1.002)),
      new T.LineBasicMaterial({ color: 0x111111, transparent:true, opacity:0.85 }));
    S.scene.add(S.hl);
    buildSky();
    S.pos = new T.Vector3(2.5, groundY(2,2,H-1)+1, 2.5);
    const resize = () => { const w = host.clientWidth||innerWidth, h = host.clientHeight||innerHeight; S.renderer.setSize(w,h); S.camera.aspect = w/h; S.camera.updateProjectionMatrix(); };
    S.onResize = resize; addEventListener("resize", resize);
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
    stopRepeat();
    flushCloud(); saveLocal();
    try { S.ch && sbClient().removeChannel(S.ch); } catch(e){}
    removeEventListener("resize", S.onResize);
    if (S.onMouseMove) document.removeEventListener("mousemove", S.onMouseMove);
    if (S.onMouseUp) document.removeEventListener("mouseup", S.onMouseUp);
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
