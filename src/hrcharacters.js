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
const AO_CACHE=new Map();
export function makeFrontierCharacter(o={}) {
 const high=o.quality!=='low',female=o.sex==='female'||o.kind==='barmaid'||o.kind==='dancer',R=new THREE.Group();R.name=o.name||'Frontier '+(o.kind||'person');
 const bones=[],B={},p=[],n=[],c=[],joints=[],weights=[],tags=[],part=[],pBone=[],pTag=[];let partN=0;const NOBLEND=new Set(['Head','Fan','LeftToeBase','RightToeBase','Hips']),hc=new THREE.Vector3(),bw=new THREE.Vector3(),M=new THREE.Matrix4(),Q=new THREE.Quaternion(),E=new THREE.Euler(),V=new THREE.Vector3(),S=new THREE.Vector3(),C=new THREE.Color();
 const bone=(name,parent,x=0,y=0,z=0)=>{const b=new THREE.Bone();b.name=name;b.position.set(x,y,z);parent.add(b);B[name]=b;bones.push(b);return b;};
 const hips=bone('Hips',R,0,.93),spine=bone('Spine02',hips,0,.06),chest=bone('Spine01',spine,0,.22),neck=bone('neck',chest,0,.2),head=bone('Head',neck,0,.08);
 const arms=[],legs=[],hands=[];for(const [side,name] of [[-1,'Left'],[1,'Right']]){
  const a=bone(name+'Arm',chest,side*(female?.195:.225),.20),b=bone(name+'ForeArm',a,0,-.255),h=bone(name+'Hand',b,0,-.238);arms.push([a,b]);hands.push(h);
  const u=bone(name+'UpLeg',hips,side*.095,-.02),l=bone(name+'Leg',u,0,-.375),f=bone(name+'Foot',l,0,-.365),toe=bone(name+'ToeBase',f,0,-.045,.14);legs.push([u,l]);
 }
 const ell=(sx,sy,sz)=>new THREE.SphereGeometry(1,high?20:12,high?14:8).scale(sx,sy,sz);
 // v36 polish (Grok Bot): smooth joint weights (vertices near a joint share the neighbouring bone, so elbows / knees /
 // shoulders bend instead of creasing), hair strand streaks, cheek / lip colour; contact shading is baked after the build.
 function add(g,b,col,x=0,y=0,z=0,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0,tag=0){
  R.updateMatrixWorld(true);const a=g.index?g.toNonIndexed():g.clone();g.dispose();Q.setFromEuler(E.set(rx,ry,rz));M.compose(V.set(x,y,z),Q,S.set(sx,sy,sz));M.premultiply(b.matrixWorld);a.applyMatrix4(M);C.setHex(col);const pp=a.attributes.position,nn=a.attributes.normal,bi=bones.indexOf(b),pid=partN++;pBone[pid]=bi;pTag[pid]=tag;
  const nb=[];if(!NOBLEND.has(b.name)){const pb=b.parent&&b.parent.isBone?b.parent:null,r=b.name.includes('Hand')||b.name.includes('Foot')?.045:.075;if(pb)nb.push([bones.indexOf(pb),b.getWorldPosition(new THREE.Vector3()),r]);for(const ch of b.children)if(ch.isBone&&!NOBLEND.has(ch.name)&&ch.name!=='Fan')nb.push([bones.indexOf(ch),ch.getWorldPosition(new THREE.Vector3()),ch.name.includes('Hand')||ch.name.includes('Foot')?.045:.075]);}
  B.Head.getWorldPosition(hc);hc.y+=.14;
  for(let i=0;i<pp.count;i++){const X=pp.getX(i),Y=pp.getY(i),Z=pp.getZ(i);p.push(X,Y,Z);n.push(nn.getX(i),nn.getY(i),nn.getZ(i));let gr=1+.025*Math.sin(X*130+Y*173),cr=C.r,cg=C.g,cb=C.b;
   if(tag===4){const ang=Math.atan2(X-hc.x,Z-hc.z),st=Math.sin(ang*46+Y*30)*.5+.5;gr=.8+.3*st*st;}
   else if(tag===1&&b===B.Head){const ly=Y-hc.y+.14-.12,ax=Math.abs(X-hc.x),fz=Z-hc.z;if(fz>.03){const ch=Math.exp(-((ax-.055)**2+(ly+.02)**2)/.0007);const bk=female?.07:.035;cr+=bk*ch;cg-=bk*.25*ch;cb-=bk*.12*ch;}}
   c.push(cr*gr,cg*gr,cb*gr);tags.push(tag);part.push(pid);
   let w0=1,j1=0,w1=0;for(const [j,o,r] of nb){const d=bw.set(X,Y,Z).distanceTo(o);if(d<r){const t=1-d/r,w=.5*t*t*(3-2*t);if(w>w1){w1=w;j1=j;}}}
   if(w1>0){w0=1-w1;joints.push(bi,j1,0,0);weights.push(w0,w1,0,0);}else{joints.push(bi,0,0,0);weights.push(1,0,0,0);}}a.dispose();
 }
 const ball=(b,col,x,y,z,sx,sy,sz,tag=0)=>add(ell(sx,sy,sz),b,col,x,y,z,1,1,1,0,0,0,tag);
 const block=(b,col,x,y,z,w,h,d,rx=0,ry=0,rz=0,tag=0)=>add(new THREE.BoxGeometry(w,h,d),b,col,x,y,z,1,1,1,rx,ry,rz,tag);
 const tube=(b,col,pts,r,tag=0)=>{const curve=new THREE.CatmullRomCurve3(pts.map(a=>new THREE.Vector3(...a)));add(new THREE.TubeGeometry(curve,high?10:5,r,high?6:4,false),b,col,0,0,0,1,1,1,0,0,0,tag);};
 const skin=o.skin??0xd3a07d,hair=o.hair??0x352319,top=o.top??0xddd0b2,bottom=o.bottom??0x343b43,shoe=o.shoe??0x271a14;
 // Tailored silhouette instead of disconnected capsule spheres.
 const torso=new THREE.LatheGeometry([[.13,0],[.14,.1],[female?.155:.195,.24],[female?.18:.22,.36],[female?.16:.19,.43]].map(v=>new THREE.Vector2(...v)),high?28:16);torso.scale(1,1,.72);const TP=[[.13,0],[.14,.1],[female?.155:.195,.24],[female?.18:.22,.36],[female?.16:.19,.43]],torsoR=y=>{for(let i=1;i<TP.length;i++)if(y<=TP[i][1]){const t=(y-TP[i-1][1])/(TP[i][1]-TP[i-1][1]);return TP[i-1][0]+(TP[i][0]-TP[i-1][0])*t;}return TP[TP.length-1][0];},torsoShell=(k,y0,y1)=>{const v=[];for(let i=0;i<=8;i++){const y=y0+(y1-y0)*i/8;v.push(new THREE.Vector2(torsoR(y)*k+.004,y));}return v;};add(torso,spine,top,0,0,0,1,1,1,0,0,0,3);
 ball(hips,bottom,0,-.015,0,.17,.12,.12,3);ball(neck,skin,0,.025,0,.045,.075,.045,1);
 // Face: shaped jaw, cheek planes, nose bridge, nostrils, lips, ears, lashes/eyebrows.
 const skull=new THREE.SphereGeometry(1,high?44:22,high?34:16),sp=skull.attributes.position,gs=(a,b,s)=>Math.exp(-(a*a+b*b)/s);
 for(let i=0;i<sp.count;i++){let x=sp.getX(i),y=sp.getY(i),z=sp.getZ(i);const ax=Math.abs(x);
  if(y<-.15){const t=Math.min(1,(-.15-y)/.85);x*=1-t*(female?.3:.22);if(z<.2)z*=1-t*.25;} // jaw and chin taper
  if(y<-.75&&z>.2)z+=.06*(y+.75)*-1; // chin forward
  if(z>.35){z-=.11*gs(ax-.38,y-.2,.035);z+=.05*gs(ax,y-.32,.06)*(ax<.5?1:0);z+=.05*gs(ax-.55,y+.12,.05);z+=.1*gs(x/.5,(y+.08)/1.2,.025);} // eye sockets, brow, cheekbones, nose bridge
  if(z<-.3)z*=.94; // flatter back of the head
  sp.setXYZ(i,x*.102,y*.13,z*.1);}
 skull.computeVertexNormals();add(skull,head,skin,0,.12,0,1,1,1,0,0,0,1);
 for(const s of [-1,1]){
  ball(head,skin,s*.1,.118,-.004,.012,.03,.017,1);
  ball(head,0xe6dccb,s*.039,.147,.084,.019,.0105,.01,5);ball(head,o.eye??(female?0x5f7a6c:0x5e5548),s*.039,.147,.093,.0085,.0085,.003,6);ball(head,0x151612,s*.039,.147,.0955,.0038,.0042,.0015,6);ball(head,0xffffff,s*.036,.15,.097,.0016,.0016,.001,5);
  tube(head,new THREE.Color(skin).multiplyScalar(.82).getHex(),[[s*.019,.152,.09],[s*.039,.159,.094],[s*.06,.152,.086]],.0035,1);tube(head,0x1c1410,[[s*.02,.1525,.093],[s*.039,.1565,.0965],[s*.058,.1515,.089]],.0011,4);
  tube(head,hair,[[s*.015,.172,.094],[s*.038,.18,.096],[s*.064,.17,.087]],female?.0025:.004,4);
  tube(head,0x39271e,[[s*.016,.154,.1],[s*.039,.16,.105],[s*.062,.153,.094]],.0015,4);
  ball(head,0x56332b,s*.009,.093,.110,.004,.002,.004,1);
 }
 ball(head,skin,0,.106,.112,.014,.012,.013,1);for(const s of [-1,1])ball(head,skin,s*.012,.1,.106,.008,.007,.008,1);
 tube(head,female?0xa55e59:0x916252,[[-.027,.068,.093],[-.012,.07,.101],[0,.068,.104],[.012,.07,.101],[.027,.068,.093]],.0033,1);
 tube(head,female?0xb8736d:0xa87665,[[-.025,.065,.094],[0,.060,.102],[.025,.065,.094]],.0035,1);
 tube(head,0x5a3c32,[[-.022,.066,.098],[0,.065,.104],[.022,.066,.098]],.0009,1);
 // Hair cap plus sculpted strands/curls; no expensive transparent hair cards.
 const cap=new THREE.SphereGeometry(1,high?24:14,high?14:8,0,Math.PI*2,0,Math.PI*.44);cap.scale(.113,.12,.11);add(cap,head,hair,0,.16,-.01,1,1,1,0,0,0,4);
 for(let i=0;i<(high?30:14);i++){const a=i/(high?30:14)*Math.PI*2,x=Math.cos(a)*.09,z=Math.sin(a)*.085-.015;
  if(o.curls){ball(head,hair,x,.225+(i%3)*.012,z,.025,.023,.025,4);if(female)ball(head,hair,x*1.1,.07,z-.05,.025,.06,.027,4);}
  else tube(head,hair,[[x*.5,.27,z*.5],[x,.21,z],[x*1.04,.13,z*1.05]],high?.005:.007,4);
 }
 if(female){for(const s of [-1,1])for(let k=0;k<(high?5:3);k++){const t=k/(high?4:2);tube(head,hair,[[s*.01,.255,.07],[s*(.05+t*.03),.235-t*.02,.098],[s*(.088+t*.012),.17-t*.04,.07],[s*(.1+t*.005),.1-t*.04,.03]],.011,4);}ball(head,hair,0,.105,-.09,.085,.13,.05,4);if(o.long)for(let i=0;i<(high?12:6);i++){const x=(i/((high?12:6)-1)-.5)*.18;tube(head,hair,[[x,.14,-.08],[x*.9,-.02,-.10],[x*.8,-.12,-.075]],.012,4);}else ball(head,hair,0,.15,-.13,.06,.06,.05,4);}
 // Articulated limbs, leather boots, fitted cuffs, individual fingers/thumbs.
 for(let i=0;i<2;i++){const [a,b]=arms[i],[u,l]=legs[i],hand=hands[i],side=i?1:-1;
  const lathe=(bn,col,len,r0,r1,tag)=>{const pts=[];for(let k=0;k<=8;k++){const t=k/8,bulge=Math.sin(Math.PI*Math.min(1,t*1.3))*.12;pts.push(new THREE.Vector2(Math.max(.002,(r0+(r1-r0)*(1-t))*(1+bulge)),-len*(1-t)));}add(new THREE.LatheGeometry(pts,high?18:10),bn,col,0,0,0,1,1,1,0,0,0,tag);ball(bn,col,0,0,0,r0*1.02,r0*1.02,r0*1.02,tag);};
  lathe(a,o.sleeve??top,.255,female?.047:.055,female?.037:.043,3);lathe(b,o.glove??skin,.238,female?.035:.042,female?.026:.031,o.glove?2:1);
  add(new THREE.CylinderGeometry(.047,.045,.035,12),b,top,0,-.205,0,1,1,1,0,0,0,3);
  ball(hand,o.glove??skin,0,-.026,.005,.034,.05,.023,o.glove?2:1);
  for(let f=0;f<4;f++){const x=(f-1.5)*.015,len=.035+(f===1?.01:0);ball(hand,o.glove??skin,x,-.07-len*.2,.009,.007,len*.65,.008,o.glove?2:1);}ball(hand,o.glove??skin,-side*.034,-.032,.018,.012,.028,.012,o.glove?2:1);
  lathe(u,o.legs??bottom,.375,.074,.054,3);lathe(l,o.legs??bottom,.35,.054,.038,3);
  block(B[(i?'Right':'Left')+'Foot'],shoe,0,-.015,.055,.112,.105,.235,0,0,0,2);block(B[(i?'Right':'Left')+'Foot'],0x171412,0,-.07,.055,.115,.025,.24,0,0,0,2);
  for(let k=0;k<3;k++)ball(l,o.legs??bottom,0,-.27+k*.035,.037,.058,.01,.026,3);
 }
 // Waistcoat, fasteners and restrained tailoring retain similar outfits across players.
 const vest=o.kind==='barmaid'?(o.bodice??0x335e4c):o.kind==='dancer'?top:(o.coat??0x4a3426);
 if(o.kind!=='barmaid'&&o.kind!=='dancer'){
  for(const side of [-1,1]){const vp=new THREE.LatheGeometry(torsoShell(1.07,.04,.425),high?14:7,side>0?.12:-1.62,1.5);add(vp,spine,vest,0,0,0,1,1,.75,0,0,0,3);tube(spine,0xa18b65,[[side*.04,.42,.13],[side*.13,.28,.14],[side*.045,.08,.13]],.005,2);}block(spine,top,0,.36,.125,.07,.16,.025,0,0,0,3);
 }
 for(let i=0;i<5;i++)ball(spine,0xbd9658,.018,.11+i*.055,.145,.009,.009,.006,7);
 add(new THREE.TorusGeometry(.17,.016,5,24).rotateX(Math.PI/2),hips,0x362318,0,.02,0,1,1,.77,0,0,0,2);block(hips,0xc49c59,0,.02,.145,.06,.045,.015,0,0,0,7);
 if(o.kind==='barmaid'||o.kind==='dancer'){
  const skirt=new THREE.CylinderGeometry(.16,o.kind==='barmaid'?.36:.32,o.kind==='barmaid'?.67:.25,high?48:24,5,true),pp=skirt.attributes.position;
  for(let i=0;i<pp.count;i++){const a=Math.atan2(pp.getZ(i),pp.getX(i)),factor=1+.045*Math.cos(a*18);pp.setX(i,pp.getX(i)*factor);pp.setZ(i,pp.getZ(i)*factor);}skirt.computeVertexNormals();add(skirt,hips,o.skirt??0x802b37,0,o.kind==='barmaid'?-.32:-.12,0,1,1,1,0,0,0,3);
  if(o.kind==='barmaid'){const shell=(rt,rb,h,t0,tl,seg)=>new THREE.CylinderGeometry(rt,rb,h,seg,4,true,t0,tl); // curved bodice / apron (were flat slabs)
   const ap=shell(.19,.35,.5,-.62,1.24,high?20:10);add(ap,hips,0xe8dfca,0,-.29,0,1,1,1,0,0,0,3);
   for(const side of [-1,1])ball(chest,top,side*.185,.205,0,.055,.05,.055,3);
   const bd=new THREE.LatheGeometry(torsoShell(1.06,.065,.335),high?28:14,-1.35,2.7);add(bd,spine,vest,0,0,0,1,1,.75,0,0,0,3);}
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
 { // contact shading: vertices whose normal runs into another part get darker (collars, armpits, under the hat, skirt tops);
  // cached per body shape (same kind / options = same geometry), typed-array spatial hash
  const N=part.length,sig=[o.kind,high,female,!!o.long,!!o.curls,!!o.glove,!!o.rifle,N].join();let AO=AO_CACHE.get(sig);
  if(!AO){AO=new Float32Array(N);const cs=.018,SZ=1<<20,MK=SZ-1,K=new Int32Array(SZ),Pt=new Int32Array(SZ),used=new Uint8Array(SZ);
   const hk=(x,y,z)=>((Math.floor(x/cs)+512)&1023)|(((Math.floor(y/cs)+512)&1023)<<10)|(((Math.floor(z/cs)+512)&1023)<<20); // exact cell (unique within ±9 m)
   const foreign=(a,b)=>a!==b&&(pBone[a]!==pBone[b]||pTag[a]!==pTag[b]); // same bone + same surface (lips on the skull, ball on its sleeve) never shades
   const put=(k,pid)=>{let h=(k*0x9E3779B1)>>>12&MK;while(used[h]&&K[h]!==k)h=(h+1)&MK;if(!used[h]){used[h]=1;K[h]=k;Pt[h]=pid;}else if(Pt[h]>=0&&foreign(Pt[h],pid))Pt[h]=-1;};
   const get=k=>{let h=(k*0x9E3779B1)>>>12&MK;while(used[h]){if(K[h]===k)return Pt[h];h=(h+1)&MK;}return -2;};
   for(let i=0;i<N;i++)put(hk(p[i*3],p[i*3+1],p[i*3+2]),part[i]);
   const hb=bones.indexOf(B.Head);for(let i=0;i<N;i++){let oc=0;const pi=part[i];if(!(pBone[pi]===hb&&pTag[pi]===1))for(const d of [.012,.026,.045]){const e=get(hk(p[i*3]+n[i*3]*d,p[i*3+1]+n[i*3+1]*d,p[i*3+2]+n[i*3+2]*d));if(e===-1||(e>=0&&foreign(e,part[i])))oc+=d<.02?.5:d<.03?.32:.18;}
    AO[i]=Math.max(.55,1-oc)*(.88+.12*(n[i*3+1]*.5+.5));}
   if(AO_CACHE.size>24)AO_CACHE.clear();AO_CACHE.set(sig,AO);}
  for(let i=0;i<N;i++){c[i*3]*=AO[i];c[i*3+1]*=AO[i];c[i*3+2]*=AO[i];} }
 const geometry=new THREE.BufferGeometry();for(const [name,a,size] of [['position',p,3],['normal',n,3],['color',c,3],['skinWeight',weights,4],['surfaceTag',tags,1]])geometry.setAttribute(name,new THREE.Float32BufferAttribute(a,size));geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(joints,4));geometry.computeBoundingSphere();
 const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.78,metalness:0});material.onBeforeCompile=sh=>{
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute float surfaceTag;varying float frontierTag;').replace('#include <begin_vertex>','#include <begin_vertex>\nfrontierTag=surfaceTag;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying float frontierTag;').replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=frontierTag>6.5?.3:frontierTag<1.5?.56:frontierTag>4.5?.3:.83;').replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor=frontierTag>6.5?.72:0.;').replace('#include <opaque_fragment>','{float fr=pow(1.-clamp(dot(normalize(vViewPosition),normal),0.,1.),3.);if(frontierTag>2.5&&frontierTag<3.5)outgoingLight+=diffuseColor.rgb*fr*.22;if(frontierTag<1.5)outgoingLight+=diffuseColor.rgb*vec3(.055,.03,.022);}\n#include <opaque_fragment>');
 };material.customProgramCacheKey=()=> 'frontier-person-4';
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

// v37 perf: a low-detail body (about a third of the triangles) skinned to the SAME skeleton, for NPCs seen from a distance.
// Built on demand (one per frame from the caller) so it adds nothing to load time. Bones are created identically at every
// quality, which is checked by name; on any mismatch the NPC simply keeps its detailed body.
export function addLowLOD(D) {
 if (!D || D.lod !== undefined || !D.body || !D.o) return D && D.lod; D.lod = null;
 const L = makeFrontierCharacter({ ...D.o, quality: 'low' }), lb = L.skeleton.bones, hb = D.skeleton.bones;
 const same = lb.length === hb.length && lb.every((b, i) => b.name === hb[i].name);
 if (same) { const m = new THREE.SkinnedMesh(L.body.geometry, D.body.material); m.name = 'lod-low'; D.body.parent.add(m); m.bind(D.skeleton, D.body.bindMatrix);
  m.castShadow = D.body.castShadow; m.receiveShadow = true; m.frustumCulled = D.body.frustumCulled; if (D.body.boundingSphere) m.boundingSphere = D.body.boundingSphere.clone(); m.visible = false; D.lod = m;
  const dp = D.dispose; D.dispose = () => { m.removeFromParent(); m.geometry.dispose(); dp(); }; }
 L.skeleton.dispose(); L.body.material.dispose(); if (!same) L.body.geometry.dispose(); if (L.gun) L.gun.traverse(x => { if (x.geometry) x.geometry.dispose(); if (x.material) x.material.dispose(); });
 return D.lod; }

