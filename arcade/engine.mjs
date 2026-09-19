import {AVATARS,MODES,LEARN,ENGLISH,SENTENCES} from './catalog.mjs';
import {reserveLook,characterFor,EMOTES} from './characters.mjs';
import {courseFor,golfShot,settleGolf} from './golf.mjs';
import {startImpostor,spyPublic,spyAction,tickSpy} from './impostor.mjs';
import {startBingo,bingoPublic,bingoAction,startBach,bachPublic,bachAction,tickBach,calculateBach,LETTERS} from './party-games.mjs';
export const MAX_PLAYERS=30;
export const normalize=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ');
export function seeded(seed){let s=seed>>>0;return()=>{s+=0x6D2B79F5;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
export function shuffle(arr,rng=Math.random){const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function choices(answer,rng){const a=new Set([answer]);for(let n=1;a.size<4;n++)a.add(answer+(rng()>.5?n:-n));return shuffle([...a],rng).map(String);}
export function makeRounds({mode='party',count=8,difficulty='normal',category='learn',seed=1,bank=[]}={}){
 const rng=seeded(seed),hard=difficulty==='hard',easy=difficulty==='easy';
 const raw=category==='english'?ENGLISH:category==='learn'?LEARN:bank;
 const pool=shuffle(raw.filter(q=>q&&typeof q.q==='string'&&Array.isArray(q.o)&&q.o.length===4&&q.o.every(o=>typeof o==='string')&&Number.isInteger(q.c)&&q.c>=0&&q.c<4),rng);
 if(!pool.length&&['trivia','party'].includes(mode))throw new Error('La categoría no contiene preguntas válidas.');
 const sentences=shuffle(SENTENCES,rng);let qi=0,wi=0;
 const kinds=shuffle(['trivia','numbers','memory','words','sequence','reaction'],rng);
 return Array.from({length:Math.max(1,Math.min(mode==='trivia'?pool.length:30,count))},(_,i)=>{
  const kind=mode==='party'?kinds[i%kinds.length]:mode;
  const base={id:`${seed}-${i}`,kind,emoji:'✦',explanation:'',study:null};
  if(kind==='trivia'){
   const q=pool[qi++%pool.length],order=shuffle([0,1,2,3],rng);
   return {...base,prompt:q.q,options:order.map(k=>q.o[k]),answer:order.indexOf(q.c),emoji:q.e||'🧠',img:qi%5===1?'arcade/reference/'+category+'.svg':null,explanation:q.explanation||`La respuesta del banco es «${q.o[q.c]}». Puedes repasarla al terminar.`};
  }
  if(kind==='bingo'||kind==='bachillerato')return {...base,prompt:kind==='bingo'?'Bingo del club':'Bachillerato · ronda '+(i+1),answer:null,explanation:'Completa el reto con tu grupo.'};
  if(kind==='golf')return {...base,prompt:'Hoyo '+(i+1)+' · '+courseFor(i).name,course:courseFor(i),answer:'hole',explanation:'Controla la potencia. Aprovecha los rebotes: cada golpe extra reduce 120 puntos. Máximo: 8 golpes por hoyo.'};
  if(kind==='impostor')return {...base,prompt:'Impostor · ronda '+(i+1),answer:'team',explanation:'Observa las pistas y busca contradicciones. Las pistas y los votos se revelan al cerrar cada fase.'};
  if(kind==='stroop'){const colors=[['Verde','#218759'],['Azul','#3864c0'],['Rojo','#c7364b'],['Morado','#8750a9']],ink=Math.floor(rng()*4),word=(ink+1+Math.floor(rng()*3))%4;return {...base,prompt:'¿De qué color es la tinta?',word:colors[word][0],ink:colors[ink][1],options:colors.map(c=>c[0]),answer:ink,emoji:'🎨',explanation:'La tinta era '+colors[ink][0].toLowerCase()+'. Separar el significado de la palabra y su color entrena la atención selectiva.'};}
  if(kind==='balance'){const a=2+Math.floor(rng()*20),b=2+Math.floor(rng()*12),target=a+b,answerText=a+' + '+b,o=shuffle([answerText,(a+1)+' + '+b,a+' + '+(b+3),(a+4)+' + '+b],rng);return {...base,prompt:'Equilibra la balanza: '+target,options:o,answer:o.indexOf(answerText),emoji:'⚖️',explanation:answerText+' = '+target+'. Las otras expresiones suman '+(target+1)+', '+(target+3)+' y '+(target+4)+'.'};}
  if(kind==='numbers'){
   const a=1+Math.floor(rng()*(hard?40:easy?9:15)),b=1+Math.floor(rng()*(hard?12:easy?9:12));
   const op=easy?'+':['+','−','×'][Math.floor(rng()*3)];
   const answer=op==='+'?a+b:op==='−'?Math.max(a,b)-Math.min(a,b):a*b;
   const x=op==='−'?Math.max(a,b):a,y=op==='−'?Math.min(a,b):b,o=choices(answer,rng);
   return {...base,prompt:`${x} ${op} ${y}`,subtitle:'Encuentra el resultado en órbita.',options:o,answer:o.indexOf(String(answer)),emoji:'🪐',explanation:`${x} ${op} ${y} = ${answer}.${op==='×'?` Multiplicar es sumar ${x}, ${y} veces.`:op==='+'?' Para sumar mentalmente, puedes completar primero la decena más cercana.':' Para restar, puedes contar cuánto falta desde el número menor hasta el mayor.'}`};
  }
  if(kind==='memory'){
   const icons=shuffle(['🚀','🌵','🍉','🐙','🍄','⭐','🦊','🎈','🍋','🐸','🎸','🪐'],rng).slice(0,hard?6:easy?3:4);
   const target=Math.floor(rng()*icons.length),o=shuffle([...new Set([icons[target],...shuffle(['🚀','🌵','🍉','🐙','🍄','⭐','🦊','🎈','🍋','🐸','🎸','🪐'],rng)])].slice(0,4),rng);
   return {...base,prompt:`¿Qué había en la posición ${target+1}?`,options:o,answer:o.indexOf(icons[target]),study:icons,studyMs:easy?5000:hard?3000:4000,emoji:'🧩',explanation:`En la posición ${target+1} estaba ${icons[target]}. Agrupar las imágenes en una historia ayuda a recordar el orden.`};
  }
  if(kind==='words'){
   const [sentence,translation,explanation]=sentences[wi++%sentences.length];
   return {...base,prompt:translation,subtitle:'Toca las palabras para construir la frase en inglés.',tokens:shuffle(sentence.split(' '),rng),answer:sentence,emoji:'💬',explanation:`${sentence}. ${explanation}`};
  }
  if(kind==='sequence'){
   const start=1+Math.floor(rng()*10),step=1+Math.floor(rng()*(hard?8:4)),geometric=hard&&rng()>.5;
   const seq=Array.from({length:4},(_,j)=>geometric?start*2**j:start+j*step),answer=geometric?start*16:start+4*step,o=choices(answer,rng);
   return {...base,prompt:seq.join('  ·  ')+'  ·  ?',options:o,answer:o.indexOf(String(answer)),emoji:'🔮',explanation:geometric?`Cada número se multiplica por 2. Después de ${seq[3]} viene ${answer}.`:`Suma ${step} en cada paso: ${seq[3]} + ${step} = ${answer}.`};
  }
  if(kind==='reaction')return {...base,prompt:'Espera la señal verde',waitMs:1800+Math.floor(rng()*2600),answer:'go',emoji:'⚡',explanation:'Controlar el impulso de tocar antes de la señal también es parte de la atención.'};
  throw new Error('Modo de juego desconocido.');
 });
}
export function createMatch({code,seed=1,settings={}}={}){
 return {code,seed,settings:{mode:'party',count:8,time:25,difficulty:'normal',category:'learn',study:true,...settings},phase:'lobby',players:[],hostId:null,rounds:[],index:-1,startedAt:0,deadline:0,answers:{},history:[],messages:[],version:0,createdAt:Date.now(),updatedAt:Date.now(),locked:false,karaoke:{queue:[],now:null,playing:false,revision:0}};
}
export function addPlayer(room,{id,name,avatar,look},now=Date.now()){
 name=String(name||'').replace(/[\x00-\x1f]/g,'').trim().slice(0,20);
 if(!name)throw new Error('Escribe tu nombre para entrar.');
 if(room.players.length>=MAX_PLAYERS)throw new Error('La sala ya tiene 30 jugadores.');
 if(room.phase!=='lobby'&&room.phase!=='karaoke')throw new Error('La partida ya empezó. Espera a la siguiente.');
 if(room.locked)throw new Error('El anfitrión cerró el ingreso a la sala.');
 if(room.players.some(p=>normalize(p.name)===normalize(name)))throw new Error('Ese nombre ya está en uso.');
 const chosen=reserveLook(room.players,look),a=characterFor(chosen).emoji;
 const p={id,name,avatar:a,look:chosen,emote:null,chatMuted:false,score:0,correct:0,streak:0,bestStreak:0,ready:false,connected:true,lastSeen:now,joinedAt:now};
 room.players.push(p);if(!room.hostId)room.hostId=id;return p;
}
export function begin(room,now=Date.now(),bank=[]){
 if(!['lobby','results'].includes(room.phase))throw new Error('Ya hay una partida en curso.');
 if(room.settings.mode==='karaoke'){room.phase='karaoke';return;}
 if(room.settings.mode==='impostor'&&room.players.filter(p=>p.connected).length<3)throw new Error('Impostor necesita al menos 3 personas.');
 room.bachUsedLetters=[];room.rounds=makeRounds({...room.settings,count:room.settings.mode==='bachillerato'?5:room.settings.mode==='bingo'?1:room.settings.count,seed:room.seed,bank});
 room.players.forEach(p=>{p.score=0;p.correct=0;p.streak=0;p.bestStreak=0;});
 room.history=[];room.index=-1;nextRound(room,now);
}
export function nextRound(room,now=Date.now()){
 room.index++;room.answers={};
 if(room.index>=room.rounds.length){room.phase='results';room.deadline=0;return;}
 if(room.settings.mode==='bingo'){startBingo(room,now,seeded(room.seed));return;}
 if(room.settings.mode==='bachillerato'){startBach(room,now,seeded(room.seed+room.index*197));return;}
 if(room.settings.mode==='impostor'){startImpostor(room,now,seeded(room.seed+room.index*17));return;}
 room.phase='countdown';room.startedAt=now+3000;
 const q=room.rounds[room.index];
 if(q.kind==='golf')room.golf=Object.fromEntries(room.players.map(p=>[p.id,{x:q.course.start[0],y:q.course.start[1],strokes:0,sunk:false,readyAt:0,path:[],at:0}]));
 room.deadline=room.startedAt+(q.kind==='golf'?90000:(q.studyMs||0)+(q.waitMs||0)+room.settings.time*1000);
}
export function evaluate(q,value){
 if(q.kind==='words')return typeof value==='string'&&normalize(value)===normalize(q.answer);
 return value===q.answer;
}
export function answer(room,playerId,value,roundId,now=Date.now()){
 if(room.phase==='countdown'&&now>=room.startedAt&&now<room.deadline)room.phase='playing';
 if(now>=room.deadline&&room.phase==='playing')throw new Error('El tiempo para responder terminó.');
 if(room.phase!=='playing')throw new Error('Esta ronda no está recibiendo respuestas.');
 const q=room.rounds[room.index],p=room.players.find(p=>p.id===playerId);
 if(!p)throw new Error('Jugador no encontrado.');
 if(roundId!==q.id)throw new Error('La ronda cambió. Vuelve a intentarlo.');
 if(room.answers[playerId])return room.answers[playerId];
 if(q.studyMs&&now<room.startedAt+q.studyMs)throw new Error('Primero observa las fichas.');
 if(['golf','impostor'].includes(q.kind))throw new Error('Usa los controles de este minijuego.');
 const early=q.kind==='reaction'&&now<room.startedAt+q.waitMs;
 const correct=!early&&evaluate(q,value);
 const elapsed=Math.max(0,now-room.startedAt-(q.studyMs||q.waitMs||0));
 const bonus=Math.round(150*Math.max(0,1-elapsed/(room.settings.time*1000)));
 const streakBonus=correct?Math.min(150,p.streak*30):0;
 const result=award(room,p,{playerId,value,correct,points:correct?800+bonus+streakBonus:0,basePoints:correct?800:0,speedBonus:correct?bonus:0,streakBonus,elapsed,early});
 if(room.players.filter(p=>p.connected).every(p=>room.answers[p.id]))reveal(room,now);
 return result;
}
export function reveal(room,now=Date.now()){
 if(room.phase!=='playing')return;
 room.phase='reveal';const q=room.rounds[room.index];
 for(const p of room.players)if(!room.answers[p.id])p.streak=0;
 room.history.push({id:q.id,prompt:q.prompt,kind:q.kind,answer:q.kind==='words'?q.answer:q.kind==='reaction'?'Tocar después de la señal':q.kind==='golf'?'Embocar con el menor número de golpes':q.options?.[q.answer]||'Ronda completada',explanation:q.explanation,answers:structuredClone(room.answers)});
 room.deadline=room.settings.study?0:now+6500;
}
export function tick(room,now=Date.now()){
 if(room.phase.startsWith('bach-')){tickBach(room,now,(...a)=>scoreBach(room,...a));return;}
 if(room.phase.startsWith('spy-')){tickSpy(room,now,(...a)=>finishSpy(room,...a));return;}
 if(room.phase==='playing'&&room.settings.mode==='golf')settleGolf(room,now,award,reveal);
 if(room.phase==='countdown'&&now>=room.startedAt)room.phase='playing';
 if(room.phase==='playing'&&now>=room.deadline)reveal(room,now);
 if(room.phase==='reveal'&&room.deadline&&now>=room.deadline)nextRound(room,now);
}
export function snapshot(room,playerId,now=Date.now()){
 const q=room.rounds[room.index];let question=null;
 if(q&&['playing','reveal'].includes(room.phase)){
  const {answer,explanation,study,...safe}=q;
  question={...safe,study:study&& (now<room.startedAt+q.studyMs||room.phase==='reveal')?study:null};
  if(room.phase==='reveal')Object.assign(question,{answer,explanation,study});
 }
 return {code:room.code,settings:room.settings,phase:room.phase,hostId:room.hostId,players:room.players.map(({lastSeen,...p})=>{const a=room.answers[p.id];if(a&&['playing','countdown'].includes(room.phase)){p.score-=a.points;p.correct-=a.correct?1:0;p.streak=a.priorStreak;p.bestStreak=a.priorBestStreak;}return p;}),index:room.index,total:room.rounds.length,startedAt:room.startedAt,deadline:room.deadline,question,me:playerId,answeredIds:Object.keys(room.answers),myAnswer:room.answers[playerId]?room.phase==='reveal'||room.phase==='results'?room.answers[playerId]:{submitted:true}:null,history:room.history.map(h=>({...h,answers:undefined,mine:h.answers[playerId]||null})),messages:room.messages.filter(m=>!m.to||m.to===playerId||m.playerId===playerId),bingo:room.settings.mode==='bingo'?bingoPublic(room,playerId):null,bach:room.settings.mode==='bachillerato'?bachPublic(room,playerId):null,impostor:room.settings.mode==='impostor'?spyPublic(room,playerId):null,golf:room.settings.mode==='golf'?room.golf:null,locked:room.locked,karaoke:room.karaoke,serverNow:now,version:room.version};
}
export function validSettings(input={}){
 const s={};if(MODES.some(m=>m.id===input.mode&&m.id!=='cruci'))s.mode=input.mode;
 if([6,8,10,15,20,30].includes(+input.count))s.count=+input.count;
 if([15,25,40,60].includes(+input.time))s.time=+input.time;
 if(['easy','normal','hard'].includes(input.difficulty))s.difficulty=input.difficulty;
 if(typeof input.category==='string'&&/^[a-z]{2,20}$/.test(input.category))s.category=input.category;
 if(Array.isArray(input.omitLetters)){const omitted=[...new Set(input.omitLetters.filter(x=>LETTERS.includes(x)))];if(omitted.length<LETTERS.length)s.omitLetters=omitted;}
 if(typeof input.study==='boolean')s.study=input.study;return s;
}

function award(room,p,result){const priorStreak=p.streak,priorBestStreak=p.bestStreak;p.streak=result.correct?p.streak+1:0;p.bestStreak=Math.max(p.bestStreak,p.streak);if(result.correct)p.correct++;p.score+=result.points;room.answers[p.id]={...result,playerId:p.id,priorStreak,priorBestStreak};return room.answers[p.id];}
function finishSpy(room,winner,now,reason){const s=room.impostor;s.outcome={winner,reason};for(const p of room.players){const spy=s.impostors.includes(p.id),won=spy?winner==='impostors':winner==='detectives',voteRight=!spy&&s.impostors.includes(s.votes[p.id]),bonus=voteRight&&winner!=='cancelled'?200:0;award(room,p,{value:s.votes[p.id]||'Sin voto',correct:won,points:(won?800:0)+bonus,basePoints:won?800:0,speedBonus:0,streakBonus:bonus,elapsed:now-room.startedAt});}room.phase='reveal';room.history.push({id:room.rounds[room.index].id,prompt:room.rounds[room.index].prompt,kind:'impostor',answer:s.word,explanation:reason,answers:structuredClone(room.answers)});room.deadline=room.settings.study?0:now+12000;}
export function gameAction(room,p,a,now=Date.now()){
 if(a.type==='bingo')return bingoAction(room,p,a,now,n=>finishBingo(room,n));
 if(a.type==='bach')return bachAction(room,p,a,now,n=>scoreBach(room,n));
 if(a.type==='bachExtend'){if(p.id!==room.hostId||room.phase!=='results'||room.settings.mode!=='bachillerato')throw new Error('La ampliación se elige al terminar la partida.');for(let i=0;i<3;i++)room.rounds.push({id:room.code+'-extra-'+room.rounds.length,kind:'bachillerato',prompt:'Bachillerato · ronda '+(room.rounds.length+1)});room.index=room.rounds.length-4;nextRound(room,now);return;}
 if(a.type==='golf')return golfShot(room,p.id,a,now,award,reveal);
 if(a.type==='impostor')return spyAction(room,p,a,now,(...v)=>finishSpy(room,...v));
 if(a.type==='emote'){if(!['lobby','reveal','results'].includes(room.phase))throw new Error('Baila al terminar la ronda o en la sala.');if(!EMOTES.includes(a.kind))throw new Error('Emote inválido.');if(p.emote&&now-p.emote.at<3000)throw new Error('Espera un momento antes de otro emote.');p.emote={kind:a.kind,at:now};return;}
 throw new Error('Acción desconocida.');
}

function finishBingo(room,now){room.phase='results';room.deadline=0;room.history=[{id:room.rounds[0].id,prompt:'Bingo del club',kind:'bingo',answer:'Ganador: '+room.players.find(p=>p.id===room.bingo.winner)?.name,explanation:'300 puntos para la primera línea; 1000 para el primer cartón completo. Los números marcados se verifican contra las bolitas sorteadas.',answers:Object.fromEntries(room.players.map(p=>[p.id,{playerId:p.id,points:p.score,correct:p.id===room.bingo.winner}]))}];}
function scoreBach(room,now){if(room.phase!=='bach-review')return;const rows=calculateBach(room);room.bach.scoreRows=rows;for(const row of rows){const p=room.players.find(p=>p.id===row.id);award(room,p,{value:row.cells.map(c=>c.value).join(' · '),correct:row.total>0,points:row.total,basePoints:row.cells.reduce((n,c)=>n+c.base,0),speedBonus:0,streakBonus:row.cells.reduce((n,c)=>n+c.bonus,0),elapsed:now-room.startedAt});}room.phase='bach-score';room.deadline=0;room.history.push({id:room.rounds[room.index].id,prompt:'Bachillerato · letra '+room.bach.letter,kind:'bachillerato',answer:'100 por respuesta válida; 50 repetida; bono único de 10 si alguien no respondió.',explanation:'Puntaje de esta ronda: revisado por el grupo. Las casillas vacías, «No sé», con otra inicial o rechazadas por mayoría suman 0.',answers:structuredClone(room.answers)});}

export function playerLeft(room,now=Date.now()){if(!room.phase.startsWith('spy-'))return;finishSpy(room,'cancelled',now,'Una persona salió. Esta ronda se anula sin sumar puntos; los puntos anteriores se conservan.');if(room.players.length<3)room.phase='results';}
