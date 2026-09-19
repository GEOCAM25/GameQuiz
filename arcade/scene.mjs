export function createScene(container,reduced=false){
 const T=window.THREE;if(!T||reduced)return {destroy(){}};let renderer;
 try{renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});}catch{return {destroy(){}};}
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));container.appendChild(renderer.domElement);container.classList.add('webgl');renderer.domElement.setAttribute('aria-hidden','true');
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(38,1,.1,100),group=new T.Group();camera.position.set(0,0,10);scene.add(group);scene.add(new T.AmbientLight(0xffffff,1.1));const light=new T.DirectionalLight(0xf1ffd0,2);light.position.set(-3,5,6);scene.add(light);
 const mats=[],geos=[];function mat(color){const m=new T.MeshStandardMaterial({color,metalness:.15,roughness:.3});mats.push(m);return m;}
 function mesh(g,m,x,y,z){geos.push(g);const o=new T.Mesh(g,m);o.position.set(x,y,z);group.add(o);return o;}
 const mint=mat(0xb6f3c4),dark=mat(0x163e38),dice=mesh(new T.BoxGeometry(1.9,1.9,1.9),mint,.35,.05,0);dice.rotation.set(.35,-.48,.14);
 for(const [x,y]of [[-.46,.46],[.46,.46],[0,0],[-.46,-.46],[.46,-.46]]){const g=new T.SphereGeometry(.115,12,8);geos.push(g);const d=new T.Mesh(g,dark);d.position.set(x,y,.96);d.scale.z=.18;dice.add(d);}
 const ring=mesh(new T.TorusGeometry(.58,.2,14,48),mat(0xd6c5ff),-1.4,-.4,.9);ring.rotation.x=.65;
 const orb=mesh(new T.IcosahedronGeometry(.63,0),mat(0xffd57e),1.8,1.4,-.2);const ball=mesh(new T.SphereGeometry(.19,16,16),mat(0xffffff),-.8,1.5,0);
 const floor=mesh(new T.TorusGeometry(1.95,.015,6,64),mint,.4,-1.7,0);floor.rotation.x=Math.PI/2.4;
 const resize=()=>{const r=container.getBoundingClientRect();if(!r.width||!r.height)return;renderer.setSize(r.width,r.height);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();};const ro=new ResizeObserver(resize);ro.observe(container);resize();
 let visible=true,raf,done=false,last=0;const io=new IntersectionObserver(e=>visible=e[0].isIntersecting);io.observe(container);
 function frame(t){if(done)return;raf=requestAnimationFrame(frame);if(document.hidden||!visible||t-last<32)return;last=t;const s=t/1000;dice.position.y=Math.sin(s*.8)*.15;dice.rotation.y=-.48+Math.sin(s*.4)*.15;ring.rotation.z=s*.18;ring.position.y=-.4+Math.sin(s+.8)*.16;orb.rotation.y=s*.22;orb.rotation.z=s*.14;ball.position.y=1.5+Math.sin(s)*.15;renderer.render(scene,camera);}raf=requestAnimationFrame(frame);
 return {destroy(){done=true;cancelAnimationFrame(raf);ro.disconnect();io.disconnect();geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());renderer.dispose();renderer.domElement.remove();}};
}
export function celebrate(reduced=false){if(reduced)return;const d=document.createElement('div');d.className='confetti';d.setAttribute('aria-hidden','true');for(let i=0;i<40;i++){const p=document.createElement('i');p.style.cssText=`--x:${Math.random()*100}%;--r:${Math.random()*720}deg;--delay:${Math.random()*.5}s;--c:${['#b7efce','#aa91f1','#ffbf66','#ff93ba'][i%4]}`;d.appendChild(p);}document.body.appendChild(d);setTimeout(()=>d.remove(),3500);}
