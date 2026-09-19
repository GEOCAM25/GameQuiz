// Fixed-step physics shared by browser and server. Clients submit direction/power only.
export const COURSES=[
 {name:'Primer green',par:2,start:[100,320],hole:[700,100],walls:[]},
 {name:'La puerta',par:3,start:[95,200],hole:[700,200],walls:[[385,30,28,135],[385,255,28,135]]},
 {name:'Zigzag',par:4,start:[90,320],hole:[710,85],walls:[[250,145,25,245],[505,30,25,240]]},
 {name:'Dos caminos',par:3,start:[90,200],hole:[700,200],walls:[[315,135,160,130]]},
 {name:'Rebote lunar',par:4,start:[90,80],hole:[700,80],walls:[[375,30,30,240]]},
 {name:'La isla',par:3,start:[80,315],hole:[690,100],walls:[[220,90,60,190],[475,190,60,160]]},
 {name:'Pasillo secreto',par:4,start:[80,90],hole:[710,330],walls:[[160,165,350,25],[320,290,300,25]]},
 {name:'Final de campeonato',par:4,start:[95,320],hole:[710,75],walls:[[240,30,25,250],[490,160,25,230]]}
];
export function courseFor(i){return structuredClone(COURSES[i%COURSES.length]);}
export function simulateShot(course,ball,angle,power){
 if(!Number.isFinite(angle)||!Number.isFinite(power)||power<.05||power>1||Math.abs(angle)>Math.PI*4)throw new Error('Golpe inválido. Ajusta dirección y potencia.');
 let x=ball.x,y=ball.y,vx=Math.cos(angle)*power*640,vy=Math.sin(angle)*power*640;const path=[[x,y]],r=9,dt=1/120;let sunk=false,steps=0;
 for(;steps<1200;steps++){
  x+=vx*dt;y+=vy*dt;
  if(x<30+r){x=30+r;vx=Math.abs(vx)*.78;}if(x>770-r){x=770-r;vx=-Math.abs(vx)*.78;}if(y<30+r){y=30+r;vy=Math.abs(vy)*.78;}if(y>390-r){y=390-r;vy=-Math.abs(vy)*.78;}
  for(const [wx,wy,w,h]of course.walls){const cx=Math.max(wx,Math.min(x,wx+w)),cy=Math.max(wy,Math.min(y,wy+h));let dx=x-cx,dy=y-cy,d=Math.hypot(dx,dy);if(d<r){if(d<.001){const side=[Math.abs(x-wx),Math.abs(x-wx-w),Math.abs(y-wy),Math.abs(y-wy-h)].indexOf(Math.min(Math.abs(x-wx),Math.abs(x-wx-w),Math.abs(y-wy),Math.abs(y-wy-h)));dx=side===0?-1:side===1?1:0;dy=side===2?-1:side===3?1:0;d=1;}const nx=dx/d,ny=dy/d;x+=nx*(r-d+.2);y+=ny*(r-d+.2);const dot=vx*nx+vy*ny;if(dot<0){vx-=1.8*dot*nx;vy-=1.8*dot*ny;}}}
  const speed=Math.hypot(vx,vy);if(Math.hypot(x-course.hole[0],y-course.hole[1])<14&&speed<240){x=course.hole[0];y=course.hole[1];sunk=true;break;}
  const friction=Math.max(0,1-100*dt/(speed||1));vx*=friction;vy*=friction;if(steps%6===0)path.push([+x.toFixed(2),+y.toFixed(2)]);if(speed<3)break;
 }
 path.push([x,y]);return {x,y,sunk,path,duration:Math.round(steps*dt*1000),strokes:ball.strokes+1};
}
export function golfShot(room,playerId,a,now,award,reveal){
 const q=room.rounds[room.index];if(room.phase!=='playing'||q?.kind!=='golf'||a.roundId!==q.id||now>=room.deadline)throw new Error('Este hoyo ya no recibe golpes.');
 const p=room.players.find(p=>p.id===playerId),b=room.golf[playerId];if(!p||!b||room.answers[playerId])throw new Error('Ya terminaste este hoyo.');if(now<b.readyAt)throw new Error('Espera a que se detenga la pelota.');
 const shot=simulateShot(q.course,b,a.angle,a.power);room.golf[playerId]={...shot,at:now,readyAt:now+shot.duration};
 // The terminal result is committed after the animation finishes by settleGolf.
}
export function settleGolf(room,now,award,reveal){
 for(const [pid,b]of Object.entries(room.golf||{}))if(!room.answers[pid]&&now>=b.readyAt&&(b.sunk||b.strokes>=8)){const p=room.players.find(p=>p.id===pid);if(!p)continue;const points=b.sunk?Math.max(250,1100-(b.strokes-1)*120):0;award(room,p,{value:b.strokes,correct:b.sunk,points,basePoints:points,speedBonus:0,streakBonus:0,elapsed:now-room.startedAt});}
 if(room.players.filter(p=>p.connected).every(p=>room.answers[p.id]))reveal(room,now);
}
