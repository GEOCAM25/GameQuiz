import {characterFor,OUTFITS} from './characters.mjs';
// All characters are procedural 3D meshes. No downloaded model or texture is required.
export function createCharacterStage(container,players,{reduced=false,me=null,now=Date.now}={}){
 const T=window.THREE;let renderer,frame,done=false,current=players,objects=new Map();
 container.classList.add('character-stage');container.setAttribute('aria-label','Escenario de personajes en 3D');
 if(!T)return fallback();
 try{renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});}catch{return fallback();}
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));container.appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-hidden','true');
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(35,1,.1,100);scene.add(new T.HemisphereLight(0xffffff,0x52785f,2));const light=new T.DirectionalLight(0xfff0df,2.5);light.position.set(-4,8,7);scene.add(light);
 const labels=document.createElement('div');labels.className='character-labels';container.appendChild(labels);
 function mat(color){return new T.MeshStandardMaterial({color,roughness:.55,metalness:.08});}
 function build(p){const c=characterFor(p.look),i=+c.id.slice(1),group=new T.Group(),body=new T.Group();group.add(body);const skin=mat(p.look?.color||c.color),dark=mat('#203b40'),white=mat('#fffdf3'),cloth=mat(['#353a69','#dd994e','#dbe7ec','#415caa','#232831','#f1cf67'][OUTFITS.indexOf(p.look?.outfit)]||'#353a69');
 const add=(g,m,x=0,y=0,z=0,parent=body)=>{const o=new T.Mesh(g,m);o.position.set(x,y,z);parent.add(o);return o;};
 const sphere=(r,m,x,y,z)=>add(new T.SphereGeometry(r,14,10),m,x,y,z);
 const torso=add(new T.SphereGeometry(.46,16,12),cloth,0,.65,0);torso.scale.set(1,1.15,.8);
 const head=sphere(.48,skin,0,1.3,0);head.scale.set(1+c.variant*.05,1-(c.shape%3)*.09,.86);
 const arms=[sphere(.14,skin,-.5,.8,0),sphere(.14,skin,.5,.8,0)];arms.forEach(a=>a.scale.y=1.8);
 const legs=[sphere(.17,dark,-.22,.12,.03),sphere(.17,dark,.22,.12,.03)];
 for(const x of [-.18,.18]){sphere(.10,white,x,1.34,.36);sphere(.051,dark,x,1.34,.44);}sphere(.055,dark,0,1.16,.42);
 const ears=c.shape;
 if([0,1,4,7,8,9].includes(ears))for(const x of [-.35,.35]){const e=add(ears===1||ears===4?new T.SphereGeometry(.18,12,8):new T.ConeGeometry(.17,ears===0?.6:.38,4),skin,x,1.72,0);if(ears===0)e.rotation.z=x*.3;}
 if(ears===2)for(let k=0;k<6;k++)add(new T.ConeGeometry(.15,.36,5),skin,Math.cos(k)*.48,1.35+Math.sin(k)*.4,-.05);
 if(ears===3)for(const x of [-.29,.29])sphere(.17,skin,x,1.66,0);
 if(ears===5)for(let k=0;k<5;k++){const tail=sphere(.14,skin,(k-2)*.24,.15,-.3);tail.scale.y=1.6;}
 if(ears===6){add(new T.CylinderGeometry(.54,.6,.17,16),skin,0,1.65,0);add(new T.ConeGeometry(.22,.42,8),white,0,1.93,0);}
 // Each of the forty characters has a distinctive crest arrangement and body proportions.
 body.scale.set(1+(i%4)*.045,1+Math.floor(i/10)*.07,1);for(let k=0;k<c.variant+1;k++)sphere(.06,white,(k-c.variant/2)*.16,1.62,.38);
 if(p.look?.accessory==='glasses')for(const x of [-.18,.18])add(new T.TorusGeometry(.12,.025,6,16),dark,x,1.34,.47);
 if(p.look?.accessory==='crown')for(let k=0;k<3;k++)add(new T.ConeGeometry(.09,.27,4),mat('#f9cc58'),(k-1)*.17,1.85,.02);
 if(p.look?.accessory==='headphones')for(const x of [-.52,.52])sphere(.15,dark,x,1.38,0);
 if(p.look?.outfit==='Astronauta'){const helmet=mat('#a9e4fa');helmet.transparent=true;helmet.opacity=.18;sphere(.58,helmet,0,1.3,0);}
 if(p.look?.outfit==='Explorador')add(new T.CylinderGeometry(.46,.46,.08,16),cloth,0,1.72,0);
 const platform=add(new T.CylinderGeometry(.77,.82,.1,24),mat(p.id===me?'#e1ef90':'#e5e9e3'),0,-.07,0,group);
 scene.add(group);const label=document.createElement('span');label.textContent=p.name;labels.appendChild(label);return {group,body,arms,legs,label,platform};}
 function clear(){for(const o of objects.values()){scene.remove(o.group);o.label.remove();const geos=new Set(),mats=new Set();o.group.traverse(n=>{if(n.geometry)geos.add(n.geometry);if(n.material)mats.add(n.material);});geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());}objects.clear();}
 function layout(){clear();const cols=Math.min(6,Math.ceil(Math.sqrt(current.length*1.5))),rows=Math.ceil(current.length/cols);current.forEach((p,i)=>{const o=build(p);o.group.position.set((i%cols-(cols-1)/2)*2.0,0,(Math.floor(i/cols)-(rows-1)/2)*2.3);objects.set(p.id,o);});camera.position.set(0,Math.max(3,rows*2.3),Math.max(7,cols*2.8));camera.lookAt(0,.6,0);}
 const resize=()=>{if(done)return;const {width,height}=container.getBoundingClientRect();if(!width||!height)return;renderer.setSize(width,height);camera.aspect=width/height;const cols=Math.min(6,Math.ceil(Math.sqrt(current.length*1.5)));camera.position.z=Math.max(7,cols*2.8,cols*2.2/(2*Math.tan(35*Math.PI/360)*camera.aspect));camera.lookAt(0,.6,0);camera.updateProjectionMatrix();};const ro=new ResizeObserver(resize);ro.observe(container);layout();resize();let last=0;
 function draw(t){if(done)return;frame=requestAnimationFrame(draw);if(document.hidden||t-last<32)return;last=t;const s=t/1000;for(const p of current){const o=objects.get(p.id);if(!o)continue;const age=now()-(p.emote?.at||0),emote=!reduced&&age<4500?p.emote.kind:null;o.body.position.y=!reduced?.035*Math.sin(s*2):0;o.body.rotation.set(0,0,0);o.arms.forEach(a=>a.rotation.set(0,0,0));if(emote==='dance'){o.body.rotation.z=Math.sin(s*9)*.2;o.arms[0].rotation.z=-.8+Math.sin(s*9)*.6;o.arms[1].rotation.z=.8+Math.cos(s*9)*.6;o.body.position.y=Math.abs(Math.sin(s*9))*.18;}if(emote==='wave')o.arms[1].rotation.z=2+Math.sin(s*12)*.5;if(emote==='jump')o.body.position.y=Math.abs(Math.sin(s*6))*.8;if(emote==='spin')o.body.rotation.y=age*.006;const v=new T.Vector3(o.group.position.x,o.group.position.y-.2,o.group.position.z).project(camera);o.label.style.left=(v.x*.5+.5)*100+'%';o.label.style.top=(-v.y*.5+.5)*100+'%';}renderer.render(scene,camera);}frame=requestAnimationFrame(draw);
 return {update(p){const changed=p.length!==current.length||p.some((v,i)=>v.id!==current[i]?.id);current=p;if(changed)layout();},destroy(){done=true;cancelAnimationFrame(frame);ro.disconnect();clear();renderer.dispose();renderer.domElement.remove();labels.remove();}};
 function fallback(){container.innerHTML='';const draw=ps=>{container.innerHTML='';for(const p of ps){const el=document.createElement('span');el.className='character-fallback';el.textContent=characterFor(p.look).emoji+' '+p.name;container.appendChild(el);}};draw(players);return {update:draw,destroy(){container.innerHTML='';}};}
}
