import * as THREE from 'three';
import { LAYOUTS } from './layouts.js';
const $ = id => document.getElementById(id);
const Q = new URLSearchParams(location.search);
// ---------------- World ----------------
const W=96,H=24,D=96,CS=16,CX=48,CZ=48;
const T={AIR:0,GROUND:1,TIMBER:2,COBBLE:3,PLATE:4,RAMPART:5,HEART:6,HALL:7,FORGE:8};
const INFO={1:{c:0x4f8a3a,hp:1e9},2:{c:0xa8743c,hp:40,n:'Timber'},3:{c:0x8a8f96,hp:100,n:'Cobble'},4:{c:0x56708a,hp:220,n:'Plate'},
 5:{c:0x6e5a8c,hp:150,base:1},6:{c:0xe8b830,hp:160,base:1,core:1},7:{c:0xb5654a,hp:70,base:1},8:{c:0x3a3f4a,hp:120,base:1}};
const blocks=new Uint8Array(W*H*D), bhp=new Float32Array(W*H*D);
const I=(x,y,z)=>x+W*(z+D*y);
const inb=(x,y,z)=>x>=0&&y>=0&&z>=0&&x<W&&y<H&&z<D;
const get=(x,y,z)=>{x|=0;y|=0;z|=0; if(y<0)return 1; if(!inb(x,y,z))return y<6?1:0; return blocks[I(x,y,z)];};
const solid=(x,y,z)=>get(Math.floor(x),Math.floor(y),Math.floor(z))!==0;
const stats={base:0,baseTotal:0,core:0,coreTotal:0};
const dirty=new Set();
function setB(x,y,z,t,init){ if(!inb(x,y,z))return; const i=I(x,y,z), o=blocks[i];
 if(o&&INFO[o].base){stats.base--; if(INFO[o].core)stats.core--;}
 blocks[i]=t; bhp[i]=t?INFO[t].hp:0;
 if(t&&INFO[t].base){stats.base++; if(INFO[t].core)stats.core++; if(init){stats.baseTotal++; if(INFO[t].core)stats.coreTotal++;}}
 const cx=x/CS|0,cz=z/CS|0; dirty.add(cx+','+cz);
 if(x%CS==0&&cx>0)dirty.add((cx-1)+','+cz); if(x%CS==CS-1)dirty.add((cx+1)+','+cz);
 if(z%CS==0&&cz>0)dirty.add(cx+','+(cz-1)); if(z%CS==CS-1)dirty.add(cx+','+(cz+1));
}
// ---------------- Rendering ----------------
const renderer=new THREE.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5)); renderer.setSize(innerWidth,innerHeight); document.body.appendChild(renderer.domElement);
const scene=new THREE.Scene(); scene.background=new THREE.Color(0x87b8e8); scene.fog=new THREE.Fog(0x87b8e8,40,110);
const camera=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,0.1,200); camera.rotation.order='YXZ';
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
const chunkMat=new THREE.MeshBasicMaterial({vertexColors:true});
const chunks={};
const FACES=[[[1,0,0],[[1,0,0],[1,1,0],[1,1,1],[1,0,1]],.78],[[-1,0,0],[[0,0,1],[0,1,1],[0,1,0],[0,0,0]],.72],[[0,1,0],[[0,1,1],[1,1,1],[1,1,0],[0,1,0]],1],
 [[0,-1,0],[[0,0,0],[1,0,0],[1,0,1],[0,0,1]],.5],[[0,0,1],[[1,0,1],[1,1,1],[0,1,1],[0,0,1]],.88],[[0,0,-1],[[0,0,0],[0,1,0],[1,1,0],[1,0,0]],.64]];
const tmpC=new THREE.Color();
function buildChunk(cx,cz){ const pos=[],col=[],idx=[];
 for(let y=0;y<H;y++)for(let z=cz*CS;z<cz*CS+CS;z++)for(let x=cx*CS;x<cx*CS+CS;x++){ const t=blocks[I(x,y,z)]; if(!t)continue;
  const h=((x*73856093)^(y*19349663)^(z*83492791))>>>0, n=0.92+((h%100)/100)*0.12;
  const dmg=bhp[I(x,y,z)]/INFO[t].hp; const dk=t==1?1:0.55+0.45*Math.min(1,dmg);
  for(const [d,vs,s] of FACES){ const nx=x+d[0],ny=y+d[1],nz=z+d[2]; if(ny<0)continue; if(inb(nx,ny,nz)&&blocks[I(nx,ny,nz)])continue;
   const b=pos.length/3; tmpC.setHex(INFO[t].c).multiplyScalar(s*n*dk);
   for(const v of vs){pos.push(x+v[0],y+v[1],z+v[2]);col.push(tmpC.r,tmpC.g,tmpC.b);} idx.push(b,b+1,b+2,b,b+2,b+3);} }
 const k=cx+','+cz; if(chunks[k]){scene.remove(chunks[k]);chunks[k].geometry.dispose();}
 const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('color',new THREE.Float32BufferAttribute(col,3)); g.setIndex(idx);
 const m=new THREE.Mesh(g,chunkMat); m.material.side=THREE.DoubleSide; scene.add(m); chunks[k]=m; }
function flushChunks(max=6){ let n=0; for(const k of dirty){ const [a,b]=k.split(',').map(Number); if(a>=0&&b>=0&&a<W/CS&&b<D/CS)buildChunk(a,b); dirty.delete(k); if(++n>=max)break; } }
// ---------------- Voxel ray ----------------
function rayVox(o,d,maxD){ let x=Math.floor(o.x),y=Math.floor(o.y),z=Math.floor(o.z); const sx=Math.sign(d.x),sy=Math.sign(d.y),sz=Math.sign(d.z);
 const tdx=Math.abs(1/d.x),tdy=Math.abs(1/d.y),tdz=Math.abs(1/d.z);
 let tx=(sx>0?x+1-o.x:o.x-x)*tdx, ty=(sy>0?y+1-o.y:o.y-y)*tdy, tz=(sz>0?z+1-o.z:o.z-z)*tdz; let px=x,py=y,pz=z,t=0;
 while(t<maxD){ if(get(x,y,z)&&!(y>=H))return {x,y,z,px,py,pz,dist:t}; px=x;py=y;pz=z;
  if(tx<ty&&tx<tz){x+=sx;t=tx;tx+=tdx;} else if(ty<tz){y+=sy;t=ty;ty+=tdy;} else {z+=sz;t=tz;tz+=tdz;} if(y<-1||y>H)return null; }
 return null; }
const los=(a,b)=>{const d=b.clone().sub(a),L=d.length(); const h=rayVox(a,d.normalize(),L); return !h||h.dist>=L-0.8;};
// ---------------- Game state ----------------
const G={mode:'attack',phase:'menu',timer:0,shield:true,layout:0,wave:0,mat:{2:300,3:200,4:80},gears:14,structures:[],units:[],traps:[],fx:[],over:false,buildT:300};
const PIECES_ATT=['Wall','Ramp','Floor'], PIECES_DEF=['Wall','Ramp','Floor','Bolt Spire','Quake Mortar','Snapjaw Trap'];
const COST={'Bolt Spire':3,'Quake Mortar':4,'Snapjaw Trap':1};
const MATS=[2,3,4];
const P={pos:new THREE.Vector3(),vel:new THREE.Vector3(),yaw:0,pitch:0,hp:100,ammo:30,mag:30,reload:0,cd:0,piece:0,mat:0,team:'att',dead:0,onGround:false,spawn:new THREE.Vector3()};
// structures
const SDEF={core:{s:6,h:5,t:6,n:'Heartstone Keep'},vault:{s:4,h:3,t:7,n:'Ore Vault'},hut:{s:3,h:3,t:7,n:'Tinker Hut'},
 turret:{s:2,h:2,t:8,n:'Bolt Spire',range:20,dmg:5,rate:0.6,col:0x40c0ff},mortar:{s:3,h:1,t:8,n:'Quake Mortar',range:30,min:5,dmg:35,rate:3.5,splash:3,col:0xff6030},
 needle:{s:2,h:4,t:8,n:'Skyneedle',range:30,dmg:18,rate:1.8,col:0xd0ff40}};
function placeStructure(kind,x,z,y0=1){ const d=SDEF[kind]; const x0=Math.round(x-d.s/2),z0=Math.round(z-d.s/2);
 for(let y=y0;y<y0+d.h;y++)for(let i=0;i<d.s;i++)for(let k=0;k<d.s;k++){ if(kind=='core'&&y==y0+d.h-1&&(i==0||k==0||i==d.s-1||k==d.s-1)&&((i+k)%2))continue; setB(x0+i,y,z0+k,d.t,true);}
 const st={kind,d,x:x0+d.s/2,z:z0+d.s/2,top:y0+d.h,cd:Math.random(),bx:x0,bz:z0};
 if(d.range){ const m=new THREE.Mesh(new THREE.BoxGeometry(0.8,0.8,0.8),new THREE.MeshBasicMaterial({color:d.col})); m.position.set(st.x,st.top+0.4,st.z); scene.add(m); st.mesh=m; }
 G.structures.push(st); return st; }
const alive=st=>{ for(let i=0;i<st.d.s;i++)for(let k=0;k<st.d.s;k++)for(let y=1;y<st.top;y++) if(get(st.bx+i,y,st.bz+k)) return true; return false; };
function line(x0,z0,x1,z1,h,t){ const n=Math.max(Math.abs(x1-x0),Math.abs(z1-z0)); for(let s=0;s<=n;s++){ const x=Math.round(x0+(x1-x0)*s/n), z=Math.round(z0+(z1-z0)*s/n); for(let y=1;y<=h;y++){setB(CX+x,y,CZ+z,t,true); setB(CX+x+1,y,CZ+z,t,true);} } }
function buildWorld(L){ for(let x=0;x<W;x++)for(let z=0;z<D;z++)setB(x,0,z,1);
 for(const [a,b,c,d] of L.rects){ line(a,b,c,b,3,5);line(c,b,c,d,3,5);line(c,d,a,d,3,5);line(a,d,a,b,3,5); }
 for(const [a,b,c,d] of L.lines) line(a,b,c,d,3,5);
 for(const [gx,gz] of L.gaps) for(let y=1;y<=3;y++)for(const dx of [0,1])setB(CX+gx+dx,y,CZ+gz,0);
 for(const [k,x,z] of L.buildings){ if(k=='trap')addTrap(CX+x,1,CZ+z); else placeStructure(k,CX+x,CZ+z); }
 stats.baseTotal=stats.base; stats.coreTotal=stats.core; for(let a=0;a<W/CS;a++)for(let b=0;b<D/CS;b++)buildChunk(a,b); dirty.clear(); }
function addTrap(x,y,z){ const m=new THREE.Mesh(new THREE.BoxGeometry(0.9,0.1,0.9),new THREE.MeshBasicMaterial({color:0x552222,transparent:true,opacity:G.mode=='defend'?0.9:0.15}));
 m.position.set(x+0.5,y+0.05,z+0.5); scene.add(m); G.traps.push({x:x+0.5,y,z:z+0.5,m,armed:true}); }
// ---------------- Damage / FX ----------------
function damageBlock(x,y,z,amt){ const t=get(x,y,z); if(!t||t==1||!inb(x,y,z))return; if(G.shield&&INFO[t].base)return; const i=I(x,y,z); bhp[i]-=amt;
 if(bhp[i]<=0){ setB(x,y,z,0); debris(x,y,z,INFO[t].c);} else { dirty.add((x/CS|0)+','+(z/CS|0)); } }
function explode(c,r,dmg,team){ for(let x=-r;x<=r;x++)for(let y=-r;y<=r;y++)for(let z=-r;z<=r;z++){ if(x*x+y*y+z*z>r*r)continue; const bx=Math.floor(c.x)+x,by=Math.floor(c.y)+y,bz=Math.floor(c.z)+z;
  const t=get(bx,by,bz); if(team=='def'&&t&&INFO[t].base)continue; damageBlock(bx,by,bz,dmg*1.5);} 
 for(const u of [...G.units,P]){ const uteam=u===P?P.team:u.team; if(uteam==team)continue; const dd=u.pos.distanceTo(c); if(dd<r+1)hurt(u,dmg*(1-dd/(r+2))); }
 const s=new THREE.Mesh(new THREE.SphereGeometry(r,8,6),new THREE.MeshBasicMaterial({color:0xffa030,transparent:true,opacity:.6})); s.position.copy(c); scene.add(s); G.fx.push({m:s,life:.3}); }
const debG=new THREE.BoxGeometry(.3,.3,.3);
function debris(x,y,z,c){ if(G.fx.length>200)return; const m=new THREE.Mesh(debG,new THREE.MeshBasicMaterial({color:c})); m.position.set(x+.5,y+.5,z+.5); scene.add(m); G.fx.push({m,life:.8,v:new THREE.Vector3(Math.random()-.5,2+Math.random()*2,Math.random()-.5)}); }
function tracer(a,b,c){ const g=new THREE.BufferGeometry().setFromPoints([a,b]); const l=new THREE.Line(g,new THREE.LineBasicMaterial({color:c})); scene.add(l); G.fx.push({m:l,life:.07}); }
function hurt(u,d){ if(u===P){ if(P.dead>0)return; P.hp-=d; if(P.hp<=0){P.dead=5;msg('You were knocked out – respawning in 5s',3);} } else u.hp-=d; }
let msgT=0; function msg(s,t=2){ $('msg').textContent=s; msgT=t; }
// ---------------- Units (original troops) ----------------
const UDEF={skirm:{n:'Skirmisher',hp:140,spd:3.2,dmg:6,rate:.6,range:20,wall:40,col:0xff8a30},
 breaker:{n:'Rampart Breaker',hp:220,spd:2.6,dmg:0,rate:1,range:0,wall:130,col:0xc04020,bomb:1},
 warden:{n:'Warden',hp:120,spd:3.4,dmg:5,rate:.6,range:24,wall:0,col:0x3070ff}};
function makeUnit(kind,team,x,z){ const d=UDEF[kind]; const g=new THREE.Group(); const mat=new THREE.MeshBasicMaterial({color:d.col});
 const body=new THREE.Mesh(new THREE.BoxGeometry(.7,1,.45),mat); body.position.y=.9; g.add(body);
 const head=new THREE.Mesh(new THREE.BoxGeometry(.5,.5,.5),new THREE.MeshBasicMaterial({color:0xe8c8a0})); head.position.y=1.65; g.add(head);
 const helm=new THREE.Mesh(new THREE.BoxGeometry(.56,.18,.56),mat); helm.position.y=1.95; g.add(helm);
 for(const s of [-.18,.18]){ const l=new THREE.Mesh(new THREE.BoxGeometry(.25,.4,.3),new THREE.MeshBasicMaterial({color:0x333333})); l.position.set(s,.2,0); g.add(l);}
 if(d.bomb){ const b=new THREE.Mesh(new THREE.BoxGeometry(.5,.5,.5),new THREE.MeshBasicMaterial({color:0x222222})); b.position.set(0,1,.4); g.add(b);}
 else { const gun=new THREE.Mesh(new THREE.BoxGeometry(.12,.12,.8),new THREE.MeshBasicMaterial({color:0x222222})); gun.position.set(.4,1.1,-.3); g.add(gun);}
 scene.add(g); const u={kind,d,team,hp:d.hp,pos:new THREE.Vector3(x,1,z),vy:0,cd:Math.random(),m:g,guard:new THREE.Vector3(x,1,z),side:Math.random()<.5?1:-1};
 G.units.push(u); return u; }
const enemiesOf=team=>{ const l=G.units.filter(u=>u.team!=team&&u.hp>0); if(P.team!=team&&P.dead<=0)l.push(P); return l; };
const eye=u=>u.pos.clone().add(new THREE.Vector3(0,1.5,0));
function nearestEnemy(u,range){ let best=null,bd=range; for(const e of enemiesOf(u.team)){ const dd=e.pos.distanceTo(u.pos); if(dd<bd&&los(eye(u),eye(e))){bd=dd;best=e;} } return best; }
function coreSt(){ return G.structures.find(s=>s.kind=='core'); }
function updateUnit(u,dt){ const d=u.d; if(u.hp<=0){ scene.remove(u.m); return false; }
 if(G.phase!='raid'){ u.m.position.copy(u.pos); return true; }
 u.cd-=dt; let goal=null; const foe=d.range?nearestEnemy(u,d.range):null;
 if(foe&&u.cd<=0){ u.cd=d.rate; const a=eye(u), b=eye(foe); b.x+=(Math.random()-.5)*1.2; b.y+=(Math.random()-.5)*1.2; const dir=b.clone().sub(a).normalize();
  const hb=rayVox(a,dir,a.distanceTo(b)); if(hb){ tracer(a,a.clone().addScaledVector(dir,hb.dist),0xffee88); if(u.team=='att')damageBlock(hb.x,hb.y,hb.z,d.wall*0.3); } else { tracer(a,b,0xffee88); if(Math.random()<.7)hurt(foe,d.dmg);} }
 if(u.team=='att'){ const tgts=G.structures.filter(s=>alive(s)&&(u.kind=='breaker'?s.kind=='core':true)); let bd=1e9; for(const s of tgts){const dd=Math.hypot(s.x-u.pos.x,s.z-u.pos.z); const w=s.d.range?dd*.6:dd; if(w<bd){bd=w;goal=s;}}
  u.gs=goal; goal=goal?new THREE.Vector3(goal.x,1,goal.z):null; if(foe&&u.kind=='skirm'&&foe.pos.distanceTo(u.pos)<10)goal=null; }
 else { const f=nearestEnemy(u,40)||enemiesOf('def').sort((a,b)=>a.pos.distanceTo(u.pos)-b.pos.distanceTo(u.pos))[0]; goal=f&&f.pos.distanceTo(u.pos)>(foe?12:2)?f.pos.clone():(f?null:u.guard); }
 if(u.team=='att'&&u.gs&&goal&&Math.hypot(u.gs.x-u.pos.x,u.gs.z-u.pos.z)<u.gs.d.s/2+1.8){ u.cd2=(u.cd2||0)-dt; if(u.cd2<=0){ u.cd2=.5; const st=u.gs; let bb=null,bd=1e9; for(let i=0;i<st.d.s;i++)for(let k=0;k<st.d.s;k++)for(let y=1;y<st.top;y++){ if(!get(st.bx+i,y,st.bz+k))continue; const dd=Math.hypot(st.bx+i+.5-u.pos.x,y-u.pos.y-1,st.bz+k+.5-u.pos.z); if(dd<bd){bd=dd;bb=[st.bx+i,y,st.bz+k];} }
  if(bb){ if(d.bomb){explode(new THREE.Vector3(bb[0]+.5,bb[1]+.5,bb[2]+.5),2.2,d.wall,'att');u.hp=0;} else {damageBlock(...bb,d.wall); tracer(eye(u),new THREE.Vector3(bb[0]+.5,bb[1]+.5,bb[2]+.5),0xffaa44);} } } goal=null; }
 if(goal){ const dir=new THREE.Vector3(goal.x-u.pos.x,0,goal.z-u.pos.z); const L=dir.length(); if(L>0.8){ dir.normalize(); u.m.rotation.y=Math.atan2(-dir.x,-dir.z);
   const step=d.spd*dt, nx=u.pos.x+dir.x*.6, nz=u.pos.z+dir.z*.6, fy=Math.floor(u.pos.y+.01);
   const footS=solid(nx,fy,nz), headS=solid(nx,fy+1,nz);
   if(!footS&&!headS){ u.pos.x+=dir.x*step; u.pos.z+=dir.z*step; }
   else if(footS&&!headS&&!solid(nx,fy+2,nz)&&!solid(u.pos.x,fy+2,u.pos.z)){ u.pos.y=fy+1; u.pos.x+=dir.x*step; u.pos.z+=dir.z*step; }
   else if(u.team=='att'){ if(d.bomb){ explode(new THREE.Vector3(nx,fy+1,nz),2.2,d.wall,'att'); u.hp=0; }
     else { u.cd2=(u.cd2||0)-dt; if(u.cd2<=0){u.cd2=.5; const by=headS?fy+1:fy; damageBlock(Math.floor(nx),by,Math.floor(nz),d.wall); tracer(eye(u),new THREE.Vector3(nx,by+.5,nz),0xffaa44);} } }
   else { const px=-dir.z*u.side, pz=dir.x*u.side; if(!solid(u.pos.x+px*.6,fy+1,u.pos.z+pz*.6)&&!solid(u.pos.x+px*.6,fy,u.pos.z+pz*.6)){u.pos.x+=px*step;u.pos.z+=pz*step;} else u.side*=-1; } } }
 // gravity
 if(!solid(u.pos.x,u.pos.y-0.05,u.pos.z)){ u.vy-=20*dt; u.pos.y+=u.vy*dt; if(solid(u.pos.x,u.pos.y,u.pos.z)){u.pos.y=Math.floor(u.pos.y)+1;u.vy=0;} } else u.vy=0;
 if(u.pos.y<-5)u.hp=0;
 u.m.position.copy(u.pos); return true; }
// ---------------- Defenses ----------------
function updateStructures(dt){ if(G.phase!='raid')return; for(const s of G.structures){ if(!s.d.range)continue; if(!alive(s)||!get(Math.floor(s.x),s.top-1,Math.floor(s.z))){ if(s.mesh){scene.remove(s.mesh);s.mesh=null;} continue; }
  s.cd-=dt; if(s.cd>0)continue; const o=new THREE.Vector3(s.x,s.top+.5,s.z); let best=null,bd=s.d.range;
  for(const e of enemiesOf('def')){ const dd=e.pos.distanceTo(o); if(dd<bd&&dd>(s.d.min||0)&&(s.kind=='mortar'||los(o,eye(e)))){bd=dd;best=e;} }
  if(!best)continue; s.cd=s.d.rate; const tp=eye(best);
  if(s.kind=='mortar'){ const c=best.pos.clone().add(new THREE.Vector3(Math.random()*2-1,0.5,Math.random()*2-1)); tracer(o,c,0xff6030); explode(c,s.d.splash,s.d.dmg,'def'); }
  else { tracer(o,tp,s.d.col); hurt(best,s.d.dmg); } } }
function updateTraps(){ if(G.phase!='raid')return; for(const t of G.traps){ if(!t.armed)continue; for(const e of enemiesOf('def')){ if(Math.hypot(e.pos.x-t.x,e.pos.z-t.z)<1.3&&Math.abs(e.pos.y-t.y)<1.5){ t.armed=false; scene.remove(t.m); explode(new THREE.Vector3(t.x,t.y+.5,t.z),2,70,'def'); msg('Snapjaw trap triggered!',1); break; } } } }
// ---------------- Player ----------------
const keys={}; addEventListener('keydown',e=>{keys[e.code]=true; onKey(e.code);}); addEventListener('keyup',e=>keys[e.code]=false);
document.addEventListener('mousemove',e=>{ if(document.pointerLockElement!==renderer.domElement)return; P.yaw-=e.movementX*.0022; P.pitch=Math.max(-1.55,Math.min(1.55,P.pitch-e.movementY*.0022)); });
let mouseL=false; renderer.domElement.addEventListener('mousedown',e=>{ if(document.pointerLockElement!==renderer.domElement){renderer.domElement.requestPointerLock();return;} if(e.button==0)mouseL=true; if(e.button==2)place(); });
addEventListener('mouseup',e=>{if(e.button==0)mouseL=false;}); addEventListener('contextmenu',e=>e.preventDefault());
const pieces=()=>G.mode=='attack'?PIECES_ATT:PIECES_DEF;
function onKey(c){ if(G.phase=='menu'||G.over)return; if(c=='KeyQ')P.piece=(P.piece+1)%pieces().length; if(c=='KeyZ')P.mat=(P.mat+1)%3;
 if(c=='KeyR'&&P.ammo<P.mag)P.reload=1.6; if(c=='KeyG'&&G.phase=='build')G.timer=0; if(c=='KeyG'&&G.phase=='raid'&&Q.get('dev'))G.timer=0; }
const fwd=()=>new THREE.Vector3(0,0,-1).applyEuler(camera.rotation);
function canPlace(x,y,z){ if(!inb(x,y,z)||get(x,y,z))return false; const p=P.pos; if(Math.abs(x+.5-p.x)<.9&&Math.abs(z+.5-p.z)<.9&&y>=Math.floor(p.y)-0&&y<=p.y+1.8)return false;
 if(G.mode=='attack'&&G.phase=='build'&&Math.hypot(x-CX,z-CZ)<26)return false; return true; }
function place(){ if(P.dead>0)return; const h=rayVox(camera.position,fwd(),8); if(!h){msg('Aim at a surface (within 8 blocks)',1);return;}
 const name=pieces()[P.piece]; const f=fwd(); const ax=Math.abs(f.x)>Math.abs(f.z); const fx=ax?Math.sign(f.x):0, fz=ax?0:Math.sign(f.z); const rx=fz?1:0, rz=fx?1:0;
 if(COST[name]){ if(G.gears<COST[name]){msg('Not enough Gears',1);return;} if(G.phase!='build'){msg('Defenses can only be placed during prep',1);return;}
  const x=h.px,y=h.py,z=h.pz; G.gears-=COST[name]; if(name=='Snapjaw Trap')addTrap(x,y,z); else { const st=placeStructure(name=='Bolt Spire'?'turret':'mortar',x+1,z+1,y); stats.baseTotal=stats.base; stats.coreTotal=stats.core; } return; }
 const cells=[]; const X=h.px,Y=h.py,Z=h.pz;
 if(name=='Wall') for(let i=-1;i<=1;i++)for(let j=0;j<3;j++)cells.push([X+i*rx,Y+j,Z+i*rz]);
 if(name=='Floor') for(let i=-1;i<=1;i++)for(let k=0;k<3;k++)cells.push([X+i*rx+k*fx,Y,Z+i*rz+k*fz]);
 if(name=='Ramp') for(let i=-1;i<=1;i++)for(let k=0;k<3;k++)cells.push([X+i*rx+k*fx,Y+k,Z+i*rz+k*fz]);
 const mt=MATS[P.mat]; const ok=cells.filter(c=>canPlace(...c)); if(!ok.length){msg(G.mode=='attack'&&G.phase=='build'?'Cannot build inside the enemy shield zone':'No room',1);return;}
 if(G.mat[mt]<ok.length){msg('Not enough '+INFO[mt].n,1);return;} G.mat[mt]-=ok.length; for(const c of ok)setB(...c,mt); }
function shoot(){ if(P.reload>0||P.cd>0||P.dead>0)return; if(P.ammo<=0){P.reload=1.6;return;} P.ammo--; P.cd=.12;
 const o=camera.position.clone(), d=fwd(); d.x+=(Math.random()-.5)*.01; d.y+=(Math.random()-.5)*.01; d.normalize();
 const hb=rayVox(o,d,80); let best=null,bt=hb?hb.dist:80;
 for(const u of G.units){ if(u.team==P.team||u.hp<=0)continue; const c=u.pos.clone().add(new THREE.Vector3(0,1.1,0)); const t=c.clone().sub(o).dot(d); if(t<0||t>bt)continue; if(o.clone().addScaledVector(d,t).distanceTo(c)<.75){bt=t;best=u;} }
 tracer(o.clone().add(new THREE.Vector3(0,-.2,0)),o.clone().addScaledVector(d,bt),0xffffaa);
 if(best){ best.hp-=22; msg('Hit '+best.d.n+(best.hp<=0?' – down!':''),.4); }
 else if(hb){ const t=get(hb.x,hb.y,hb.z); if(!(P.team=='def'&&INFO[t]&&INFO[t].base)) damageBlock(hb.x,hb.y,hb.z,30); } }
function collides(p){ for(let x=Math.floor(p.x-.3);x<=Math.floor(p.x+.3);x++)for(let z=Math.floor(p.z-.3);z<=Math.floor(p.z+.3);z++)for(let y=Math.floor(p.y);y<=Math.floor(p.y+1.75);y++) if(get(x,y,z))return true; return false; }
function updatePlayer(dt){ if(P.dead>0){ P.dead-=dt; if(P.dead<=0){P.hp=100;P.pos.copy(P.spawn);P.ammo=P.mag;} return; }
 const sp=(keys.ShiftLeft?7.5:5); const f=new THREE.Vector3(-Math.sin(P.yaw),0,-Math.cos(P.yaw)), r=new THREE.Vector3(-f.z,0,f.x); const m=new THREE.Vector3();
 if(keys.KeyW)m.add(f); if(keys.KeyS)m.sub(f); if(keys.KeyD)m.add(r); if(keys.KeyA)m.sub(r); if(m.lengthSq())m.normalize().multiplyScalar(sp);
 P.vel.x=m.x;P.vel.z=m.z; P.vel.y-=22*dt; if(keys.Space&&P.onGround){P.vel.y=8;P.onGround=false;}
 for(const ax of ['x','z','y']){ const old=P.pos[ax]; P.pos[ax]+=P.vel[ax]*dt; if(collides(P.pos)){ if(ax!='y'&&P.onGround){ const up=P.pos.clone(); up.y=Math.floor(P.pos.y)+1.01; if(!collides(up)){P.pos.copy(up);continue;} } P.pos[ax]=old; if(ax=='y'){ if(P.vel.y<0)P.onGround=true; P.vel.y=0; } } else if(ax=='y')P.onGround=false; }
 if(P.pos.y<-10){P.pos.copy(P.spawn);}
 P.cd-=dt; if(P.reload>0){P.reload-=dt; if(P.reload<=0)P.ammo=P.mag;} if(mouseL)shoot(); }
// ---------------- Match flow ----------------
function start(mode){ G.mode=mode; G.layout=+$('layout').value; G.buildT=Math.max(0,+$('buildT').value||300); $('menu').style.display='none'; $('hud').style.display='';
 P.team=mode=='attack'?'att':'def'; const L=LAYOUTS[G.layout]; buildWorld(L); G.shield=true;
 if(mode=='attack'){ P.spawn.set(CX+.5,1,3); P.yaw=Math.PI; G.mat={2:300,3:200,4:80};
  for(let i=0;i<8;i++)makeUnit(i%3==0?'breaker':'skirm','att',CX-14+i*4,5); for(let i=0;i<5;i++){ const a=i/5*Math.PI*2; makeUnit('warden','def',CX+Math.cos(a)*9,CZ+Math.sin(a)*9);} }
 else { const c=coreSt(); P.spawn.set(c.x+5,1,c.z-5); P.yaw=0; G.mat={2:150,3:120,4:60}; G.gears=14; for(let i=0;i<3;i++)makeUnit('warden','def',CX-4+i*4,CZ-10); G.buildT=Math.min(G.buildT,90); }
 P.pos.copy(P.spawn); G.phase='build'; G.timer=G.buildT; msg(mode=='attack'?'BUILD PHASE – prepare siege pieces outside the shield':'PREP PHASE – place defenses with Gears',4); }
function startRaid(){ G.phase='raid'; G.shield=false;
 if(G.mode=='attack'){ G.timer=180; msg('RAID! Breach the base and topple the Heartstone Keep',3); }
 else { G.wave=0; nextWave(); } }
function nextWave(){ G.wave++; const n=2+G.wave*2; for(let i=0;i<n;i++){ const side=i%4, t=(Math.random()-.5)*60; const [x,z]=side==0?[CX+t,4]:side==1?[CX+t,D-4]:side==2?[4,CZ+t]:[W-4,CZ+t]; makeUnit(i%3==0?'breaker':'skirm','att',x,z);} G.timer=90; msg('Wave '+G.wave+' of 3 incoming!',2); }
const pct=()=>stats.baseTotal?Math.round(100*(1-stats.base/stats.baseTotal)):0;
const coreDown=()=>stats.core<stats.coreTotal*0.25;
function crests(){ let s=0; if(pct()>=50)s++; if(coreDown())s++; if(pct()>=99)s++; return s; }
function end(why){ G.over=true; G.phase='over'; document.exitPointerLock&&document.exitPointerLock(); const s=crests();
 const att=G.mode=='attack'; const win=att?s>0:s==0||(!coreDown()); $('end').style.display='';
 $('endT').textContent=win?'VICTORY':'DEFEAT'; $('endS').textContent=`${why}\nDestruction: ${pct()}%   Keep: ${coreDown()?'TOPPLED':'standing'}\nAttacker Crests: ${'★'.repeat(s)}${'☆'.repeat(3-s)}`; }
function update(dt){ if(G.phase=='menu'||G.over)return; G.timer-=dt;
 if(G.phase=='build'&&G.timer<=0)startRaid();
 updatePlayer(dt); G.units=G.units.filter(u=>updateUnit(u,dt)); updateStructures(dt); updateTraps();
 if(G.phase=='raid'){ const atts=G.units.filter(u=>u.team=='att');
  if(G.mode=='attack'){ if(pct()>=99)end('Base fully demolished!'); else if(G.timer<=0)end('Raid timer expired'); }
  else { if(coreDown())end('The Heartstone Keep fell'); else if(!atts.length){ if(G.wave>=3)end('All waves repelled!'); else nextWave(); } else if(G.timer<=0){ if(G.wave>=3)end('Survived the siege'); else nextWave(); } } }
 for(const f of G.fx){ f.life-=dt; if(f.v){f.v.y-=12*dt; f.m.position.addScaledVector(f.v,dt);} if(f.life<=0){scene.remove(f.m); f.m.geometry!==debG&&f.m.geometry.dispose();} } G.fx=G.fx.filter(f=>f.life>0);
 if(msgT>0){msgT-=dt; if(msgT<=0)$('msg').textContent='';}
 camera.position.set(P.pos.x,P.pos.y+1.6,P.pos.z); camera.rotation.set(P.pitch,P.yaw,0); hud(); }
function hud(){ const mm=Math.max(0,G.timer)|0; const ts=`${mm/60|0}:${String(mm%60).padStart(2,'0')}`;
 $('top').innerHTML=`<b>${G.mode.toUpperCase()}</b> · ${LAYOUTS[G.layout].name} · ${G.phase=='build'?'BUILD/PREP':'RAID'+(G.mode=='defend'?' wave '+G.wave+'/3':'')} · ⏱ ${ts}<br>Destruction ${pct()}% · Keep ${coreDown()?'TOPPLED':Math.round(100*stats.core/Math.max(1,stats.coreTotal))+'%'} · Crests ${'★'.repeat(crests())}${'☆'.repeat(3-crests())}`;
 const pn=pieces()[P.piece];
 $('bot').textContent=`HP ${Math.max(0,P.hp|0)}   Ammo ${P.reload>0?'reloading':P.ammo+'/'+P.mag}\nPiece [Q]: ${pn}${COST[pn]?' ('+COST[pn]+' Gears)':''}   Material [Z]: ${INFO[MATS[P.mat]].n}\nTimber ${G.mat[2]}  Cobble ${G.mat[3]}  Plate ${G.mat[4]}${G.mode=='defend'?'   Gears '+G.gears:''}`;
 const a=G.units.filter(u=>u.team=='att').length, d=G.units.filter(u=>u.team=='def').length;
 $('right').textContent=`Raiders: ${a}  Wardens: ${d}\nDefenses up: ${G.structures.filter(s=>s.d.range&&s.mesh).length}\n${G.phase=='build'?'[G] skip phase (dev)':''}`; }
// menu
LAYOUTS.forEach((l,i)=>{ const o=document.createElement('option'); o.value=i; o.textContent=l.name+' – '+l.desc; $('layout').appendChild(o); });
$('layout').value=Math.floor(Math.random()*LAYOUTS.length);
$('queue').onclick=()=>{ msg('Queue matched!'); start(Math.random()<.5?'attack':'defend'); renderer.domElement.requestPointerLock(); };
$('att').onclick=()=>{start('attack');renderer.domElement.requestPointerLock();}; $('def').onclick=()=>{start('defend');renderer.domElement.requestPointerLock();};
// test hooks
window.__G=G; window.__P=P;
if(Q.get('auto')){ if(Q.get('layout'))$('layout').value=Q.get('layout'); if(Q.get('build'))$('buildT').value=Q.get('build'); start(Q.get('auto')); if(Q.get('pitch'))P.pitch=+Q.get('pitch'); }
let last=performance.now(); function loop(t){ const dt=Math.min(.05,(t-last)/1000); last=t; update(dt); flushChunks(); renderer.render(scene,camera); requestAnimationFrame(loop); } requestAnimationFrame(loop);
