// Frontier people: one vertex-colored SkinnedMesh per character, no external assets.
// Detailed procedural art, not a scanned/photoreal human. Adult characters only.
import * as THREE from 'three';
export const PLAYER_VARIANTS = Object.freeze([
 {id:'isaiah',name:'Isaiah Reed',kind:'player',sex:'male',skin:0x482a20,hair:0x15100e,top:0xd5c7ac,bottom:0x343e43,coat:0x393024,hatC:0x32271e,bandana:0x934532,curls:true},
 {id:'cole',name:'Cole Mercer',kind:'player',sex:'male',skin:0xd5a080,hair:0x533a27,top:0xd8c6a2,bottom:0x343e43,coat:0x65503b,hatC:0x564431,bandana:0x934532},
 {id:'june',name:'June Reed',kind:'player',sex:'female',skin:0x573329,hair:0x15100f,top:0xd5c7ac,bottom:0x343e43,coat:0x393024,hatC:0x32271e,bandana:0x934532,curls:true,long:true},
 {id:'clara',name:'Clara Mercer',kind:'player',sex:'female',skin:0xe0ad8e,hair:0x533a27,top:0xd8c6a2,bottom:0x343e43,coat:0x65503b,hatC:0x564431,bandana:0x934532,long:true},
]);
export function playerVariant(index=0){return PLAYER_VARIANTS[((index|0)%4+4)%4];}
export function createPlayerCharacter(index=0,options={}){return makeFrontierCharacter({...playerVariant(index),...options,kind:'player'});}
export function makeFrontierCharacter(o={}) {
 const high=o.quality!=='low',female=o.sex==='female'||o.kind==='barmaid'||o.kind==='dancer',R=new THREE.Group();R.name=o.name||'Frontier '+(o.kind||'person');
 const bones=[],B={},p=[],n=[],c=[],joints=[],weights=[],tags=[],M=new THREE.Matrix4(),Q=new THREE.Quaternion(),E=new THREE.Euler(),V=new THREE.Vector3(),S=new THREE.Vector3(),C=new THREE.Color();
 const bone=(name,parent,x=0,y=0,z=0)=>{const b=new THREE.Bone();b.name=name;b.position.set(x,y,z);parent.add(b);B[name]=b;bones.push(b);return b;};
 const hips=bone('Hips',R,0,.93),spine=bone('Spine02',hips,0,.06),chest=bone('Spine01',spine,0,.22),neck=bone('neck',chest,0,.2),head=bone('Head',neck,0,.08);
 const arms=[],legs=[],hands=[];for(const [side,name] of [[-1,'Left'],[1,'Right']]){
  const a=bone(name+'Arm',chest,side*(female?.195:.225),.20),b=bone(name+'ForeArm',a,0,-.255),h=bone(name+'Hand',b,0,-.238);arms.push([a,b]);hands.push(h);
  const u=bone(name+'UpLeg',hips,side*.095,-.02),l=bone(name+'Leg',u,0,-.375),f=bone(name+'Foot',l,0,-.365),toe=bone(name+'ToeBase',f,0,-.045,.14);legs.push([u,l]);
 }
 const ell=(sx,sy,sz)=>new THREE.SphereGeometry(1,high?20:12,high?14:8).scale(sx,sy,sz);
 function add(g,b,col,x=0,y=0,z=0,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0,tag=0){
  R.updateMatrixWorld(true);const a=g.index?g.toNonIndexed():g.clone();g.dispose();Q.setFromEuler(E.set(rx,ry,rz));M.compose(V.set(x,y,z),Q,S.set(sx,sy,sz));M.premultiply(b.matrixWorld);a.applyMatrix4(M);C.setHex(col);const pp=a.attributes.position,nn=a.attributes.normal,bi=bones.indexOf(b);
  for(let i=0;i<pp.count;i++){p.push(pp.getX(i),pp.getY(i),pp.getZ(i));n.push(nn.getX(i),nn.getY(i),nn.getZ(i));const grain=1+.025*Math.sin(pp.getX(i)*130+pp.getY(i)*173);c.push(C.r*grain,C.g*grain,C.b*grain);joints.push(bi,0,0,0);weights.push(1,0,0,0);tags.push(tag);}a.dispose();
 }
 const ball=(b,col,x,y,z,sx,sy,sz,tag=0)=>add(ell(sx,sy,sz),b,col,x,y,z,1,1,1,0,0,0,tag);
 const block=(b,col,x,y,z,w,h,d,rx=0,ry=0,rz=0,tag=0)=>add(new THREE.BoxGeometry(w,h,d),b,col,x,y,z,1,1,1,rx,ry,rz,tag);
 const tube=(b,col,pts,r,tag=0)=>{const curve=new THREE.CatmullRomCurve3(pts.map(a=>new THREE.Vector3(...a)));add(new THREE.TubeGeometry(curve,high?10:5,r,high?6:4,false),b,col,0,0,0,1,1,1,0,0,0,tag);};
 const skin=o.skin??0xd3a07d,hair=o.hair??0x352319,top=o.top??0xddd0b2,bottom=o.bottom??0x343b43,shoe=o.shoe??0x271a14;
 // Tailored silhouette instead of disconnected capsule spheres.
 const torso=new THREE.LatheGeometry([[.13,0],[.14,.1],[female?.155:.195,.24],[female?.18:.22,.36],[female?.16:.19,.43]].map(v=>new THREE.Vector2(...v)),high?28:16);torso.scale(1,1,.72);add(torso,spine,top,0,0,0,1,1,1,0,0,0,3);
 ball(hips,bottom,0,-.015,0,.17,.12,.12,3);ball(neck,skin,0,.025,0,.045,.075,.045,1);
 // Face: shaped jaw, cheek planes, nose bridge, nostrils, lips, ears, lashes/eyebrows.
 const skull=ell(.108,.135,.103),sp=skull.attributes.position;for(let i=0;i<sp.count;i++){const y=sp.getY(i);if(y<-.03)sp.setX(i,sp.getX(i)*(female?.84:.92));if(sp.getZ(i)>.02&&y<.025)sp.setZ(i,sp.getZ(i)*.94);}skull.computeVertexNormals();add(skull,head,skin,0,.12,0,1,1,1,0,0,0,1);
 for(const s of [-1,1]){
  ball(head,skin,s*.108,.12,-.006,.022,.034,.018,1);ball(head,skin,s*.062,.1,.075,.032,.026,.02,1);
  ball(head,0xdcc9b4,s*.039,.147,.091,.026,.0125,.012,5);ball(head,o.eye??(female?0x698578:0x6d6658),s*.039,.148,.102,.010,.010,.004,6);ball(head,0x151612,s*.039,.148,.105,.0045,.006,.002,6);ball(head,0xffffff,s*.036,.152,.107,.002,.002,.001,5);
  tube(head,hair,[[s*.015,.172,.094],[s*.038,.18,.096],[s*.064,.17,.087]],female?.0025:.004,4);
  tube(head,0x39271e,[[s*.016,.154,.1],[s*.039,.16,.105],[s*.062,.153,.094]],.0015,4);
  ball(head,0x56332b,s*.009,.093,.110,.004,.002,.004,1);
 }
 ball(head,skin,0,.124,.101,.012,.027,.017,1);ball(head,skin,0,.103,.115,.017,.011,.015,1);
 tube(head,female?0xa55e59:0x916252,[[-.027,.068,.093],[-.012,.07,.101],[0,.068,.104],[.012,.07,.101],[.027,.068,.093]],.0033,1);
 tube(head,female?0xb8736d:0xa87665,[[-.025,.065,.094],[0,.060,.102],[.025,.065,.094]],.0035,1);
 tube(head,0x5a3c32,[[-.022,.066,.098],[0,.065,.104],[.022,.066,.098]],.0009,1);
 // Hair cap plus sculpted strands/curls; no expensive transparent hair cards.
 const cap=new THREE.SphereGeometry(1,high?24:14,high?14:8,0,Math.PI*2,0,Math.PI*.44);cap.scale(.113,.12,.11);add(cap,head,hair,0,.16,-.01,1,1,1,0,0,0,4);
 for(let i=0;i<(high?30:14);i++){const a=i/(high?30:14)*Math.PI*2,x=Math.cos(a)*.09,z=Math.sin(a)*.085-.015;
  if(o.curls){ball(head,hair,x,.225+(i%3)*.012,z,.025,.023,.025,4);if(female)ball(head,hair,x*1.1,.07,z-.05,.025,.06,.027,4);}
  else tube(head,hair,[[x*.5,.27,z*.5],[x,.21,z],[x*1.04,.13,z*1.05]],high?.005:.007,4);
 }
 if(female){ball(head,hair,0,.105,-.09,.085,.13,.05,4);if(o.long)for(let i=0;i<(high?12:6);i++){const x=(i/((high?12:6)-1)-.5)*.18;tube(head,hair,[[x,.14,-.08],[x*.9,-.02,-.10],[x*.8,-.12,-.075]],.012,4);}else ball(head,hair,0,.15,-.13,.06,.06,.05,4);}
 // Articulated limbs, leather boots, fitted cuffs, individual fingers/thumbs.
 for(let i=0;i<2;i++){const [a,b]=arms[i],[u,l]=legs[i],hand=hands[i],side=i?1:-1;
  ball(a,o.sleeve??top,0,-.12,0,.055,.15,.058,3);ball(b,o.glove??skin,0,-.11,0,.043,.13,.042,o.glove?2:1);
  add(new THREE.CylinderGeometry(.047,.045,.035,12),b,top,0,-.205,0,1,1,1,0,0,0,3);
  ball(hand,o.glove??skin,0,-.026,.005,.034,.05,.023,o.glove?2:1);
  for(let f=0;f<4;f++){const x=(f-1.5)*.015,len=.035+(f===1?.01:0);ball(hand,o.glove??skin,x,-.07-len*.2,.009,.007,len*.65,.008,o.glove?2:1);}ball(hand,o.glove??skin,-side*.034,-.032,.018,.012,.028,.012,o.glove?2:1);
  ball(u,o.legs??bottom,0,-.18,0,.073,.22,.075,3);ball(l,o.legs??bottom,0,-.17,0,.056,.21,.059,3);
  block(B[(i?'Right':'Left')+'Foot'],shoe,0,-.015,.055,.112,.105,.235,0,0,0,2);block(B[(i?'Right':'Left')+'Foot'],0x171412,0,-.07,.055,.115,.025,.24,0,0,0,2);
  for(let k=0;k<3;k++)ball(l,o.legs??bottom,0,-.27+k*.035,.037,.058,.01,.026,3);
 }
 // Waistcoat, fasteners and restrained tailoring retain similar outfits across players.
 const vest=o.kind==='barmaid'?(o.bodice??0x335e4c):o.kind==='dancer'?top:(o.coat??0x4a3426);
 if(o.kind!=='barmaid'&&o.kind!=='dancer'){
  for(const side of [-1,1]){block(spine,vest,side*.105,.23,.1,.15,.39,.075,0,0,side*.06,3);tube(spine,0xa18b65,[[side*.04,.42,.13],[side*.13,.28,.14],[side*.045,.08,.13]],.005,2);}block(spine,top,0,.36,.125,.07,.16,.025,0,0,0,3);
 }
 for(let i=0;i<5;i++)ball(spine,0xbd9658,.018,.11+i*.055,.145,.009,.009,.006,7);
 add(new THREE.TorusGeometry(.17,.016,5,24).rotateX(Math.PI/2),hips,0x362318,0,.02,0,1,1,.77,0,0,0,2);block(hips,0xc49c59,0,.02,.145,.06,.045,.015,0,0,0,7);
 if(o.kind==='barmaid'||o.kind==='dancer'){
  const skirt=new THREE.CylinderGeometry(.16,o.kind==='barmaid'?.36:.32,o.kind==='barmaid'?.67:.25,high?48:24,5,true),pp=skirt.attributes.position;
  for(let i=0;i<pp.count;i++){const a=Math.atan2(pp.getZ(i),pp.getX(i)),factor=1+.045*Math.cos(a*18);pp.setX(i,pp.getX(i)*factor);pp.setZ(i,pp.getZ(i)*factor);}skirt.computeVertexNormals();add(skirt,hips,o.skirt??0x802b37,0,o.kind==='barmaid'?-.32:-.12,0,1,1,1,0,0,0,3);
  if(o.kind==='barmaid'){block(hips,0xe8dfca,0,-.26,.29,.27,.48,.018,0,0,0,3);for(const side of [-1,1])ball(chest,top,side*.195,.20,0,.07,.075,.07,3);block(spine,vest,0,.22,.12,.26,.23,.045,0,0,0,3);}
  else{for(let j=0;j<5;j++){tube(spine,0xd3ae6b,[[-.07,.11+j*.045,.13],[.07,.15+j*.045,.14]],.0025,7);}for(let i=0;i<7;i++)ball(head,o.feather??0xb0495d,(i-3)*.018,.28+i*.013,-.02,.012,.095,.008,3);}
 }
 if(o.kind==='player'||o.kind==='bandit'||o.kind==='dealer'){
  const hat=o.hatC??0x30241b;add(new THREE.CylinderGeometry(.235,.235,.025,high?40:20),head,hat,0,.268,0,1,1,.85,0,0,0,2);add(new THREE.CylinderGeometry(.10,.127,.14,high?24:14),head,hat,0,.34,0,1,1,1,0,0,0,2);add(new THREE.CylinderGeometry(.13,.13,.025,20),head,0x9c7546,0,.285,0,1,1,1,0,0,0,2);
  const scarf=o.bandana??0x8c3f31;add(new THREE.ConeGeometry(.12,.15,16,1,true),neck,scarf,0,-.02,.03,1,1,.85,Math.PI,0,0,3);
  if(o.kind==='bandit'){for(const s of [-1,1])block(hips,vest,s*.14,-.25,-.04,.17,.55,.11,.08,0,s*.08,3);}
 }
 let fanBone=null;
 if(o.kind==='dancer'){fanBone=bone('Fan',hands[1],0,-.04,.03);fanBone.rotation.x=-Math.PI/2;add(new THREE.CircleGeometry(.27,20,0,Math.PI),fanBone,o.feather??0xd08b99,0,0,0,1,1,1,0,0,0,3);for(let j=0;j<10;j++){const a=j/9*Math.PI;tube(fanBone,0xd5b37e,[[0,0,.002],[Math.cos(a)*.25,Math.sin(a)*.25,.002]],.002,7);}}
 if(o.kind==='barmaid')for(const h of hands){add(new THREE.CylinderGeometry(.045,.045,.115,12),h,0xc19a58,0,-.02,.08,1,1,1,0,0,0,7);add(new THREE.CylinderGeometry(.047,.047,.018,12),h,0xefe7d6,0,.045,.08,1,1,1,0,0,0,0);}
 const geometry=new THREE.BufferGeometry();for(const [name,a,size] of [['position',p,3],['normal',n,3],['color',c,3],['skinWeight',weights,4],['surfaceTag',tags,1]])geometry.setAttribute(name,new THREE.Float32BufferAttribute(a,size));geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(joints,4));geometry.computeBoundingSphere();
 const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.78,metalness:0});material.onBeforeCompile=sh=>{
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute float surfaceTag;varying float frontierTag;').replace('#include <begin_vertex>','#include <begin_vertex>\nfrontierTag=surfaceTag;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying float frontierTag;').replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=frontierTag>6.5?.3:frontierTag<1.5?.56:frontierTag>4.5?.3:.83;').replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor=frontierTag>6.5?.72:0.;');
 };material.customProgramCacheKey=()=> 'frontier-person-2';
 const body=new THREE.SkinnedMesh(geometry,material),skeleton=new THREE.Skeleton(bones);R.add(body);R.updateMatrixWorld(true);body.bind(skeleton);body.castShadow=true;body.receiveShadow=true;body.frustumCulled=false;
 for(const b of bones)b.userData.rest=b.quaternion.clone();R.userData.B=B;R.userData.kind='real';R.userData.adult=true;R.userData.variant=o.id||null;
 const D={g:R,hips,spine,head,arms,legs,hand:hands[1],hands,fan:fanBone,o,mode:'idle',t:Math.random()*10,ph:Math.random()*6,v:0,body,skeleton,dispose(){R.removeFromParent();skeleton.dispose();geometry.dispose();material.dispose();}};
 // A small separate gun remains attached to the hand; player weapons supplied by game.
 if(o.kind==='bandit'){const gg=new THREE.Group(),gm=new THREE.MeshStandardMaterial({color:0x30302d,metalness:.8,roughness:.35}),barrel=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,o.rifle?.7:.22,10).rotateX(Math.PI/2),gm);barrel.position.z=o.rifle?.25:.08;gg.add(barrel);hands[1].add(gg);D.gun=gg;const dp=D.dispose;D.dispose=()=>{barrel.geometry.dispose();gm.dispose();dp();};}
 return D;
}
// Stable four-way appearance assignment. Host should send this 0..3 value once
// on join; do not infer another player's appearance from their display name.
export function variantIndexForPlayer(id){let h=2166136261;for(const ch of String(id)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0)%4;}
export function poseFrontierCharacter(D,dt,{speed=0,seated=false,riding=false,aiming=false}={}){
 D.t+=Math.max(0,Math.min(.1,dt||0));const p=D.t*(speed>3?9:6),k=Math.min(1,speed/4);D.hips.position.set(0,seated||riding?.55:.93,0);D.spine.rotation.set(Math.sin(D.t*1.7)*.012,0,0);D.head.rotation.y=Math.sin(D.t*.43)*.07;
 for(let i=0;i<2;i++){const sign=i?1:-1,a=D.arms[i],l=D.legs[i];l[0].rotation.set(seated||riding?-1.5:Math.sin(p)*k*.7*sign,0,riding?sign*.35:0);l[1].rotation.set(seated||riding?1.5:Math.max(0,-Math.sin(p)*sign)*k,0,0);a[0].rotation.set(aiming?-1.4:seated||riding?-.7:-Math.sin(p)*k*.5*sign,0,sign*.08);a[1].rotation.x=aiming?-.2:seated||riding?-.6:-.15;}
}
