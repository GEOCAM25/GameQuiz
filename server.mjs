// Game Quiz 3 · one authoritative process · Node.js 22 or newer · no runtime dependencies.
import http from 'node:http';
import {randomBytes,randomInt} from 'node:crypto';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {networkInterfaces} from 'node:os';
import {createMatch,addPlayer,begin,nextRound,answer,tick,snapshot,validSettings,gameAction,playerLeft} from './arcade/engine.mjs';
const ROOT=path.dirname(fileURLToPath(import.meta.url));
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.mp3':'audio/mpeg','.wav':'audio/wav','.ico':'image/x-icon','.webmanifest':'application/manifest+json'};
const id=()=>randomBytes(24).toString('base64url');
const codes='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode=()=>Array.from({length:5},()=>codes[randomInt(codes.length)]).join('');
export function createGameServer({clock=Date.now,maxRooms=100}={}){
 const rooms=new Map(),sessions=new Map(),limits=new Map(),banks=new Map();
 function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
 function limited(key,max,span){const n=clock(),l=limits.get(key)||{n:0,t:n};if(n-l.t>span){l.t=n;l.n=0;}l.n++;limits.set(key,l);return l.n>max;}
 async function body(req){let b='';for await(const chunk of req){b+=chunk;if(Buffer.byteLength(b)>16384)throw new Error('La solicitud es demasiado grande.');}try{return JSON.parse(b||'{}');}catch{throw new Error('Solicitud inválida.');}}
 function getSession(req){const token=(req.headers.authorization||'').replace(/^Bearer /,'');const s=sessions.get(token);if(!s)throw new Error('La sesión terminó. Vuelve a entrar con el código.');const room=rooms.get(s.code);const p=room?.players.find(p=>p.id===s.playerId);if(!p)throw new Error('La sala ya no está disponible.');p.lastSeen=clock();if(!p.connected){p.connected=true;send(room);}return {...s,token,room,p};}
 function send(room){room.version++;room.updatedAt=clock();for(const s of sessions.values())if(s.code===room.code&&s.stream&&!s.stream.destroyed){if(s.stream.writableLength>262144){s.stream.destroy();continue;}s.stream.write(`event: state\ndata: ${JSON.stringify(snapshot(room,s.playerId,clock()))}\n\n`);}}
 async function bank(category){if(['learn','english'].includes(category))return [];if(!/^[a-z]{2,20}$/.test(category))throw new Error('Categoría inválida.');if(!banks.has(category)){try{banks.set(category,JSON.parse(await readFile(path.join(ROOT,'data',category+'.json'),'utf8')).questions||[]);}catch{throw new Error('No se pudo cargar esa categoría.');}}return banks.get(category);}
 function join(room,data){const token=id(),playerId=id();addPlayer(room,{id:playerId,name:data.name,avatar:data.avatar,look:data.look},clock());sessions.set(token,{code:room.code,playerId,stream:null});send(room);return {token,state:snapshot(room,playerId,clock())};}
 function remove(room,playerId){room.players=room.players.filter(p=>p.id!==playerId);for(const [token,s]of sessions)if(s.code===room.code&&s.playerId===playerId){s.stream?.end('event: ended\ndata: {}\n\n');sessions.delete(token);}if(room.hostId===playerId)room.hostId=room.players.find(p=>p.connected)?.id||room.players[0]?.id||null;if(!room.players.length){rooms.delete(room.code);return;}playerLeft(room,clock());send(room);}
 function karaoke(room,p,cmd){
  const k=room.karaoke,host=room.hostId===p.id;
  if(cmd.kind==='add'){
   if(k.queue.length>=50)throw new Error('La cola tiene 50 canciones. Espera a que avance.');
   if(k.queue.filter(q=>q.by===p.id).length>=3)throw new Error('Puedes tener hasta 3 canciones pendientes.');
   if(!/^[a-zA-Z0-9_-]{11}$/.test(String(cmd.video||'')))throw new Error('Pega un enlace válido de YouTube.');
   k.queue.push({id:id(),video:cmd.video,title:String(cmd.title||'Mi canción').slice(0,90),singer:p.name,by:p.id});
  }else if(!host)throw new Error('Solo el anfitrión controla el escenario.');
  else if(cmd.kind==='next'){k.now=k.queue.shift()||null;k.playing=!!k.now;}
  else if(cmd.kind==='toggle')k.playing=!k.playing;
  else if(cmd.kind==='remove')k.queue=k.queue.filter(q=>q.id!==cmd.item);
  else if(cmd.kind==='move'){const i=k.queue.findIndex(q=>q.id===cmd.item);if(i>0)[k.queue[i-1],k.queue[i]]=[k.queue[i],k.queue[i-1]];}
  k.revision++;
 }
 const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  try{
   const url=new URL(req.url,'http://localhost'),route=url.pathname;
   if(route.startsWith('/api/')){
    const origin=req.headers.origin;
    if(origin&&new URL(origin).host!==req.headers.host)return json(res,403,{error:'Origen no permitido.'});
    if(route==='/api/health'&&req.method==='GET')return json(res,200,{ok:true,version:'4.0.0',maxPlayers:30,serverNow:clock()});
    const ip=req.socket.remoteAddress;
    if(limited(ip,10000,60000))return json(res,429,{error:'Demasiadas solicitudes. Espera un momento.'});
    if(['/api/create','/api/join'].includes(route)&&req.method==='POST'){
     if(limited('join:'+ip,80,60000))return json(res,429,{error:'Espera un momento antes de volver a entrar.'});
     const data=await body(req);
     if(route==='/api/create'){
      if(rooms.size>=maxRooms)return json(res,503,{error:'Todas las salas están ocupadas. Intenta más tarde.'});
      let code;do{code=newCode();}while(rooms.has(code));
      const room=createMatch({code,seed:randomInt(0x7fffffff),settings:validSettings(data.settings)});
      const result=join(room,data);rooms.set(code,room);return json(res,201,result);
     }
     const room=rooms.get(String(data.code||'').trim().toUpperCase());
     if(!room)return json(res,404,{error:'No encontramos esa sala. Revisa el código.'});
     return json(res,200,join(room,data));
    }
    const s=getSession(req),{room,p}=s;
    if(route==='/api/ping'&&req.method==='GET')return json(res,200,{ok:true,serverNow:clock()});
    if(route==='/api/state'&&req.method==='GET'){return json(res,200,{state:snapshot(room,p.id,clock())});}
    if(route==='/api/events'&&req.method==='GET'){
     const old=sessions.get(s.token);if(old.stream)old.stream.end('event: replaced\ndata: {}\n\n');old.stream=res;
     res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});res.flushHeaders();
     p.connected=true;p.lastSeen=clock();send(room);
     req.on('close',()=>{if(old.stream===res){old.stream=null;p.lastSeen=clock();}});return;
    }
    if(route==='/api/action'&&req.method==='POST'){
     if(limited('act:'+s.token,180,60000))return json(res,429,{error:'Demasiadas acciones. Espera un momento.'});
     const a=await body(req),host=room.hostId===p.id;
     const hostActions=['settings','start','next','replay','kick','lock','transfer','chatDelete','chatMute','bachExtend'];
     if(hostActions.includes(a.type)&&!host)return json(res,403,{error:'Esta acción corresponde al anfitrión.'});
     if(a.type==='settings'){if(room.phase!=='lobby')throw new Error('Los ajustes se cambian antes de empezar.');room.settings={...room.settings,...validSettings(a.settings)};}
     else if(a.type==='start'){
      if(!['lobby','results'].includes(room.phase))throw new Error('La partida ya está en curso.');
      const qs=await bank(room.settings.category);
      if(room.hostId!==p.id)throw new Error('Cambió el anfitrión. Vuelve a intentarlo.');
      if(room.phase==='lobby'&&room.players.some(x=>x.id!==p.id&&x.connected&&!x.ready))throw new Error('Espera a que todos marquen «Estoy listo».');
      begin(room,clock(),qs);room.rounds.forEach(q=>q.id=id());
     }
     else if(a.type==='ready'){if(room.phase!=='lobby')throw new Error('La partida ya comenzó.');p.ready=!!a.ready;}
     else if(['golf','impostor','emote','bingo','bach','bachExtend'].includes(a.type))gameAction(room,p,a,clock());
     else if(a.type==='answer')answer(room,p.id,a.value,a.roundId,clock());
     else if(a.type==='next'){if(!['reveal','bach-score'].includes(room.phase))throw new Error('Todavía no termina la ronda.');nextRound(room,clock());}
     else if(a.type==='replay'){if(!['results','karaoke'].includes(room.phase))throw new Error('Termina la partida primero.');room.phase='lobby';room.seed=randomInt(0x7fffffff);room.index=-1;room.players.forEach(x=>x.ready=false);}
     else if(a.type==='leave'){remove(room,p.id);return json(res,200,{ok:true});}
     else if(a.type==='kick'){if(a.player===p.id)throw new Error('Usa Salir para abandonar la sala.');remove(room,a.player);}
     else if(a.type==='lock')room.locked=!room.locked;
     else if(a.type==='transfer'){if(!room.players.some(x=>x.id===a.player&&x.connected))throw new Error('Ese jugador no está conectado.');room.hostId=a.player;}
     else if(a.type==='chatDelete'){room.messages=room.messages.filter(m=>m.id!==a.message);}
     else if(a.type==='chatMute'){const target=room.players.find(x=>x.id===a.player);if(!target)throw new Error('Jugador no encontrado.');target.chatMuted=!target.chatMuted;}
     else if(a.type==='sticker'){if(p.chatMuted)throw new Error('El anfitrión pausó tus mensajes.');if(limited('chat:'+s.token,12,10000))throw new Error('Envía stickers con un poco más de pausa.');if(!['👏','💚','🔥','🥳','😎','🤝','🏆','😂','🦊','🐸','🦖','🌟'].includes(a.emoji))throw new Error('Sticker inválido.');const target=room.players.find(x=>x.id===a.target);if(!target||target.id===p.id)throw new Error('Elige otra persona de la sala.');room.messages.push({id:id(),playerId:p.id,name:p.name,avatar:p.avatar,text:a.emoji,time:clock(),to:target.id,toName:target.name,sticker:true,reactions:{}});room.messages=room.messages.slice(-80);}
     else if(a.type==='chatReact'){if(!['💚','😂','👏','🔥','🤔'].includes(a.emoji))throw new Error('Reacción inválida.');const msg=room.messages.find(m=>m.id===a.message);if(!msg||(msg.to&&msg.to!==p.id&&msg.playerId!==p.id))throw new Error('El mensaje no está disponible.');msg.reactions??={};msg.reactions[p.id]=msg.reactions[p.id]===a.emoji?undefined:a.emoji;}
     else if(a.type==='chat'){
      if(p.chatMuted)throw new Error('El anfitrión pausó tus mensajes en esta sala.');
      if(limited('chat:'+s.token,12,10000))throw new Error('Envía los mensajes con un poco más de pausa.');
      const text=String(a.text||'').replace(/[\x00-\x1f]/g,'').trim().slice(0,240);if(!text)throw new Error('Escribe un mensaje.');
      const clean=text.replace(/\b(ctm|csm|we[oó]n|hue[oó]n|puta|puto|mierda|culiao|fuck|shit|bitch)\b/gi,'***');
      const reply=room.messages.find(m=>m.id===a.replyTo&&(!m.to||m.to===p.id||m.playerId===p.id));room.messages.push({id:id(),playerId:p.id,name:p.name,avatar:p.avatar,text:clean,time:clock(),reactions:{},to:reply?.to?(reply.playerId===p.id?reply.to:reply.playerId):null,toName:reply?.to?room.players.find(x=>x.id===(reply.playerId===p.id?reply.to:reply.playerId))?.name:null,replyTo:reply?{id:reply.id,name:reply.name,text:reply.text.slice(0,70)}:null});room.messages=room.messages.slice(-80);
     }
     else if(a.type==='karaoke'){if(room.phase!=='karaoke')throw new Error('El escenario no está abierto.');karaoke(room,p,a);}
     else throw new Error('Acción desconocida.');
     send(room);return json(res,200,{state:snapshot(room,p.id,clock())});
    }
    return json(res,404,{error:'Acción no disponible.'});
   }
   if(!['GET','HEAD'].includes(req.method))return json(res,405,{error:'Método no permitido.'});
   let pathname;try{pathname=decodeURIComponent(route);}catch{return json(res,400,{error:'Ruta inválida.'});}
   // Only public assets, never server source, SQL, tests, credentials, backups or arbitrary files.
   if(pathname.includes('\0')||pathname.split('/').some(s=>s.startsWith('.')||s==='..'))return json(res,404,{error:'No encontrado.'});
   const publicRoot=['/','/index.html','/classic.html','/manifest.json','/sw.js'];
   if(!publicRoot.includes(pathname)&&!/^\/(arcade|js|css|icons|data|audio)\//.test(pathname))return json(res,404,{error:'No encontrado.'});
   const file=path.resolve(ROOT,'.'+(pathname==='/'?'/index.html':pathname));
   if(!file.startsWith(ROOT+path.sep))return json(res,404,{error:'No encontrado.'});
   const ext=path.extname(file);if(!MIME[ext])return json(res,404,{error:'No encontrado.'});
   const st=await stat(file);if(!st.isFile())return json(res,404,{error:'No encontrado.'});
   res.writeHead(200,{'Content-Type':MIME[ext],'Cache-Control':'no-cache','Content-Length':st.size});
   if(req.method==='HEAD')res.end();else res.end(await readFile(file));
  }catch(e){if(res.headersSent){res.end();return;}json(res,e.code==='ENOENT'?404:400,{error:e.code==='ENOENT'?'No encontrado.':e.message||'No se pudo completar la acción.'});}
 });
 const interval=setInterval(()=>{
  const now=clock();for(const room of rooms.values()){
   const before=room.phase+':'+room.index+':'+Object.keys(room.answers).length;tick(room,now);let changed=before!==room.phase+':'+room.index+':'+Object.keys(room.answers).length;
   for(const p of room.players){if(p.connected&&now-p.lastSeen>12000){p.connected=false;changed=true;}}
   const host=room.players.find(p=>p.id===room.hostId);
   if(host&&!host.connected&&now-host.lastSeen>18000){const next=room.players.find(p=>p.connected);if(next){room.hostId=next.id;changed=true;}}
   if(room.phase==='playing'&&room.rounds[room.index]?.studyMs){const end=room.startedAt+room.rounds[room.index].studyMs;if(now>=end&&!room.studyEnded){room.studyEnded=true;changed=true;}}
   if(room.phase==='countdown')room.studyEnded=false;
   if(changed)send(room);
   if(now-room.updatedAt>6*3600000||(!room.players.some(p=>p.connected)&&now-room.updatedAt>30*60000)){
    for(const [token,s]of sessions)if(s.code===room.code){s.stream?.end('event: ended\ndata: {}\n\n');sessions.delete(token);}rooms.delete(room.code);
   }
  }
 },200);interval.unref();
 const pulse=setInterval(()=>{for(const s of sessions.values())s.stream?.write(': heartbeat\n\n');for(const [k,l]of limits)if(clock()-l.t>120000)limits.delete(k);},10000);pulse.unref();
 server.on('close',()=>{clearInterval(interval);clearInterval(pulse);});
 return {server,rooms,sessions,close:async()=>{clearInterval(interval);clearInterval(pulse);for(const s of sessions.values())s.stream?.end();server.closeAllConnections();await new Promise(r=>server.close(r));}};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const port=Number(process.env.PORT)||3000;const {server}=createGameServer();
 server.listen(port,'0.0.0.0',()=>{
  console.log(`\n  GAME QUIZ 4 · listo para jugar\n  En este equipo: http://localhost:${port}\n`);
  try { for(const list of Object.values(networkInterfaces()))for(const a of list||[])if(a.family==='IPv4'&&!a.internal)console.log(`  Otros dispositivos en tu Wi-Fi: http://${a.address}:${port}`); } catch { console.log('  Comparte la IP local de este equipo para jugar en la misma red.'); }
  console.log('\n  Mantén esta ventana abierta durante la partida. Ctrl+C para cerrar.\n');
 });
 server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`El puerto ${port} está ocupado. Cierra el otro juego o usa PORT=3001.`:e.message);process.exitCode=1;});
}
