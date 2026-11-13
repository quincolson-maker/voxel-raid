/** THE HOLLOW SUN — original fictional mountain temple. THREE r170, no assets.
 * +Y up; entrance local (0,0,0); temple extends toward -Z and descends 9 m.
 * group transform is fixed after construction. Box3s/markers/triggers are WORLD
 * space, conservative AABBs after rotation. Ignore empty Box3s. Host your own
 * character controller, AI, audio, damage, persistence and network authority.
 * interactions[i].activate({playerId, weight}) is the action API. Call update
 * before activate for proximity validation. Trap events carry reusable hazard
 * boxes: copy event data if retaining it. Events are synchronous and reused.
 */
import * as THREE from 'three';
const TAU = Math.PI * 2, UP = new THREE.Vector3(0, 1, 0);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const rampY = z => Math.max(-9, z * .14);
function place(v, p) { if (Array.isArray(p)) v.set(p[0], p[1], p[2]); else if (p) v.copy(p); }
function makeResources() {
  const gs = new Set(), ms = new Set();
  return { gs, ms, g(g) { gs.add(g); return g; }, m(m) { ms.add(m); return m; },
    dispose() { for (const g of gs) g.dispose(); for (const m of ms) m.dispose(); } };
}
function rockyMaterial(R) {
  const m = R.m(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .94 }));
  m.onBeforeCompile = s => {
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 templeP,templeN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntempleP=position;templeN=normal;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 templeP,templeN;
      float grain(vec2 p){return .5+.23*sin(p.x*5.7+sin(p.y*3.1))+.22*sin(p.y*9.1+sin(p.x*4.3));}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      vec3 w=pow(abs(normalize(templeN)),vec3(4.));w/=max(dot(w,vec3(1.)),.001);
      float n=dot(w,vec3(grain(templeP.yz),grain(templeP.zx),grain(templeP.xy)));
      vec2 cell=abs(fract(templeP.xz*.42)-.5);float relief=smoothstep(.035,.07,min(cell.x,cell.y));
      float bands=.94+.06*sin(templeP.y*14.+n*2.);diffuseColor.rgb*=mix(.78,1.13,n)*mix(.84,1.,relief)*bands;`)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal=normalize(normal+vec3(dFdx(relief),dFdy(relief),0.)*.35);');
  };
  m.customProgramCacheKey = () => 'hollow-sun-rock-1'; return m;
}
function glowMaterial(R, color, opacity = .25) {
  return R.m(new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false,
    side: THREE.DoubleSide, forceSinglePass:true, blending: THREE.AdditiveBlending, fog: true }));
}
function noiseBox(R, detail) {
  const g = R.g(new THREE.BoxGeometry(1, 1, 1, detail, detail, detail)), p = g.attributes.position;
  const c = new Float32Array(p.count * 3);
  for (let i=0;i<p.count;i++) {
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    const n=Math.sin(x*19+y*13+z*7)*Math.sin(z*17-y*11+x*5)*.015;
    p.setXYZ(i,x*(1+n),y*(1+n),z*(1+n));
    const k=.86+.08*Math.sin(x*12+y*9+z*6);c.set([.40*k,.34*k,.265*k],i*3);
  }
  g.setAttribute('color',new THREE.BufferAttribute(c,3));g.computeVertexNormals(); return g;
}
// One static draw per material. All intermediate transformed geometry is released.
function batcher(R, parent) {
  const bins=new Map(), m=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler(),v=new THREE.Vector3(),s=new THREE.Vector3();
  function add(g,material,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0,tint=null) {
    const a=g.index?g.toNonIndexed():g.clone();q.setFromEuler(e.set(rx,ry,rz));m.compose(v.set(x,y,z),q,s.set(sx,sy,sz));a.applyMatrix4(m);
    let b=bins.get(material);if(!b)bins.set(material,b={p:[],n:[],uv:[],c:[]});
    const p=a.attributes.position,n=a.attributes.normal,u=a.attributes.uv,c=a.attributes.color;
    for(let i=0;i<p.count;i++){b.p.push(p.getX(i),p.getY(i),p.getZ(i));b.n.push(n.getX(i),n.getY(i),n.getZ(i));b.uv.push(u?u.getX(i):0,u?u.getY(i):0);b.c.push(c?c.getX(i):tint?tint[0]:.4,c?c.getY(i):tint?tint[1]:.34,c?c.getZ(i):tint?tint[2]:.265);}a.dispose();
  }
  return { add, finish() { for(const [material,b] of bins){const g=R.g(new THREE.BufferGeometry());for(const [name,array,size] of [['position',b.p,3],['normal',b.n,3],['uv',b.uv,2],['color',b.c,3]])g.setAttribute(name,new THREE.Float32BufferAttribute(array,size));g.computeBoundingSphere();const mesh=new THREE.Mesh(g,material);mesh.receiveShadow=true;parent.add(mesh);}bins.clear(); } };
}
export function createSunTemple({position=[0,0,0],rotationY=0,quality='high'}={}) {
  const high=quality!=='low',R=makeResources(),group=new THREE.Group();group.name='The Hollow Sun';place(group.position,position);group.rotation.y=rotationY;group.updateMatrixWorld(true);
  const inverse=group.matrixWorld.clone().invert(),entrance=new THREE.Vector3().applyMatrix4(group.matrixWorld);
  const colliders=[],spawnPoints=[],lootPoints=[],interactions=[],triggers=[],listeners=new Set();
  const state={mirror:false,glyph:false,weight:false,entranceOpen:false},pLocal=new THREE.Vector3(),pWorld=new THREE.Vector3();
  const M=new THREE.Matrix4(),Q=new THREE.Quaternion(),E=new THREE.Euler(),V=new THREE.Vector3(),S=new THREE.Vector3(),A=new THREE.Vector3(),B=new THREE.Vector3(),C=new THREE.Vector3();
  let t=0,disposed=false,hasPlayer=false,seed=91823;
  const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};
  const stone=rockyMaterial(R),dark=R.m(new THREE.MeshStandardMaterial({color:0x222527,roughness:.86,metalness:.35}));
  const gold=R.m(new THREE.MeshStandardMaterial({color:0xe8b85b,metalness:.78,roughness:.27}));
  const ivory=R.m(new THREE.MeshStandardMaterial({color:0xb0a28a,roughness:.7}));
  const emit=R.m(new THREE.MeshBasicMaterial({color:0xffd075,fog:true})),beamMat=glowMaterial(R,0xffc65c,.13),BATCH=batcher(R,group);
  const slab=noiseBox(R,high?4:2),box=R.g(new THREE.BoxGeometry(1,1,1)),cylinder=R.g(new THREE.CylinderGeometry(1,1,1,high?16:10));
  const cone=R.g(new THREE.ConeGeometry(1,1,high?12:8)),sphere=R.g(new THREE.IcosahedronGeometry(1,high?2:1));
  const torus=R.g(new THREE.TorusGeometry(1,.06,6,high?40:24)),plane=R.g(new THREE.PlaneGeometry(1,1));
  const pyramid=R.g(new THREE.ConeGeometry(1,1.4,4));pyramid.rotateY(Math.PI/4);
  const event={type:'trap',id:'',phase:'',bounds:null,playerId:null,value:0};
  function send(type,id,phase='',bounds=null,playerId=null,value=0){event.type=type;event.id=id;event.phase=phase;event.bounds=bounds;event.playerId=playerId;event.value=value;for(const cb of listeners)cb(event);}
  function world(x,y,z){return new THREE.Vector3(x,y,z).applyMatrix4(group.matrixWorld);}
  function localBox(x,y,z,w,h,d){return new THREE.Box3(new THREE.Vector3(x-w/2,y-h/2,z-d/2),new THREE.Vector3(x+w/2,y+h/2,z+d/2));}
  function collider(x,y,z,w,h,d){const b=localBox(x,y,z,w,h,d).applyMatrix4(group.matrixWorld);colliders.push(b);return b;}
  function solid(x,y,z,w,h,d,material=stone,collision=true,rx=0){BATCH.add(material===stone?slab:box,material,x,y,z,w,h,d,rx);if(collision)collider(x,y,z,w,h+Math.abs(Math.sin(rx))*d,d);}
  function floor(x,z,w,d,y=rampY(z)){solid(x,y-.45,z,w,.9,d,stone,true,-Math.atan(.14));}
  function interaction(id,type,x,y,z,action,extra={}){
    const h={id,type,position:world(x,y,z),radius:3,activate:null,...extra};
    h.activate=(args={})=>{if(disposed||!hasPlayer||pWorld.distanceToSquared(h.position)>h.radius*h.radius)return false;return action(args,h);};interactions.push(h);return h;
  }
  function glyph(x,y,z,r=1,ry=0){
    BATCH.add(torus,gold,x,y,z,r,r,r,0,ry);
    // Original asymmetric seven-ray mark, with a floating square center.
    BATCH.add(box,emit,x,y,z,.22*r,.22*r,.05,0,ry,Math.PI/4);
    for(let j=0;j<7;j++){const a=j/7*TAU+.13,k=j%3===0?1.48:1.22;BATCH.add(box,gold,x+Math.cos(a)*r*k*Math.cos(ry),y+Math.sin(a)*r*k,z-Math.cos(a)*r*k*Math.sin(ry),.06*r,.34*r,.07,0,ry,a-Math.PI/2);}
  }
  // Huge cut blocks and buttresses, with an open 10x13m doorway.
  floor(0,1,30,12,0);
  for(const s of [-1,1]){solid(s*10,8,-1,9,16,6);solid(s*17,5,-1,5,10,8);solid(s*6.8,6.5,1,2,13,3);}
  solid(0,14.5,-1,15,4,6);glyph(0,14,2.1,2.1);
  for(const side of [-1,1]){
    const x=side*11;solid(x,1,3,5,2,5);solid(x,5,3,3.4,6,2.8);solid(x,9.4,3,2.4,2.7,2.5);
    BATCH.add(pyramid,stone,x,11.4,3,2.2,2.4,2.2);solid(x,9.5,4.3,1.6,.25,.25,dark,false);
    for(const s of [-1,1]){solid(x+s*2.1,5.5,3,.9,5,1.1);solid(x+s*.9,1.8,4,1.2,2,2.3);}
    glyph(x,5.8,4.45,.65); // faceless original wardens, not historical icons
  }
  // Descending hall. Chasm has only a narrow, broken bridge; no invisible floor.
  for(let z=-6;z>=-54;z-=4){if(z<=-30&&z>=-38)continue;floor(0,z,18,4.05);}
  for(const z of [-30,-38])floor(0,z,3.2,4);
  floor(-17,-14,17,12);floor(-22,-22,12,8); // mirror chamber/approach
  floor(17,-52,16,10); // counterweight alcove
  floor(0,-65,30,18,-9); // inner sanctum ends at -74 (<80m from entrance)
  const walls=[[-10,-4,-8],[-10,-23,-58],[10,-4,-47],[10,-57,-59]];
  for(const [x,a,b] of walls){const z=(a+b)/2;solid(x,rampY(z)+7,z,2,14,Math.abs(b-a));}
  // Portal headers leave actual walkable openings into the side chambers.
  solid(-10,rampY(-15)+10,-15,2,6,14);solid(10,rampY(-52)+10,-52,2,6,10);
  for(let z=-7;z>-58;z-=8)solid(0,rampY(z)+15,z,23,4,8.3,stone,false);
  for(const [x,z,w,d] of [[-25,-16,2,18],[-17,-8,18,2],[-22,-26,12,2],[25,-52,2,12],[17,-58,16,2],[17,-46,16,2],[0,-75,34,2],[-16,-66,2,20],[16,-66,2,20]])solid(x,rampY(z)+6,z,w,12,d);
  solid(-18,11,-17,18,2,20,stone,false);solid(17,5,-52,18,2,13,stone,false);solid(0,10,-66,34,4,20,stone,false);
  const pillarMatrices=[];
  for(let z=-9;z>-58;z-=8)for(const x of [-7,7]){
    const y=rampY(z);Q.identity();M.compose(V.set(x,y+7,z),Q,S.set(1.6,14,1.8));pillarMatrices.push(M.clone());
    collider(x,y+7,z,1.65,14,1.85);solid(x,y+.5,z,2.8,1,2.8);solid(x,y+13.5,z,2.8,1.1,2.8);
    glyph(x,y+8,z+1,.55);
  }
  const pillars=new THREE.InstancedMesh(slab,stone,pillarMatrices.length);for(let i=0;i<pillarMatrices.length;i++)pillars.setMatrixAt(i,pillarMatrices[i]);pillars.computeBoundingSphere();group.add(pillars);
  // Large ribbed slabs and chamfer-like relief, plus debris on the chasm edges.
  for(let i=0;i<(high?70:28);i++){const x=(rnd()<.5?-1:1)*(4+rnd()*4),z=-5-rnd()*50;if(z<-29&&z>-39)continue;BATCH.add(slab,stone,x,rampY(z)+.13,z,.3+rnd()*.9,.15+rnd()*.4,.3+rnd(),rnd()*.3,rnd()*TAU);}
  for(let j=0;j<10;j++){BATCH.add(slab,stone,-8+j*1.7,-15,-34,1.1,6+rnd()*6,1.1,0,rnd());}
  // Chasm bottom provides depth only, NOT a walkable collider.
  solid(0,-23,-34,22,2,13,dark,false);
  // Door leaves + collapsing bridge share ONE dynamic instanced draw.
  const doors=[],doorCount=4,doorMesh=new THREE.InstancedMesh(slab,stone,doorCount*2+1);group.add(doorMesh);
  for(const [id,z,w,h] of [['entrance',0,10,13],['mirror_door',-22,12,11],['glyph_door',-49,12,11],['sanctum_door',-58,12,12]]){
    const d={id,z,w,h,y:rampY(z),progress:0,target:0,announced:false,boxes:[collider(-w/4,rampY(z)+h/2,z,w/2,h,1.3),collider(w/4,rampY(z)+h/2,z,w/2,h,1.3)]};doors.push(d);
    solid(-w/2-.8,d.y+h/2,z,1.6,h+1,3);solid(w/2+.8,d.y+h/2,z,1.6,h+1,3);solid(0,d.y+h+.5,z,w+3,1.4,3);glyph(0,d.y+h+.6,z+1.6,.7);
  }
  interaction('entrance','door',0,0,4,()=>{doors[0].target=1;return true;},{hint:'Push the divided sun seal to open the mountain.'});
  function solve(id){if(state[id])return;state[id]=true;send('puzzle_solved',id);if(id==='mirror')doors[1].target=1;if(id==='glyph')doors[2].target=1;if(state.mirror&&state.glyph&&state.weight)doors[3].target=1;}
  // Three adjustable reflective discs. Normals are computed from actual paths.
  const mirrorPts=[new THREE.Vector3(-22,1.8,-12),new THREE.Vector3(-16,1.5,-14),new THREE.Vector3(-21,1,-21)];
  const source=new THREE.Vector3(-23,9,-10),receiver=new THREE.Vector3(-12,.6,-21);
  const targets=[2,5,1],steps=[0,0,0],normals=[],mirrorQs=[],route=[];
  const disc=R.g(new THREE.CylinderGeometry(1,1,.15,high?32:16));disc.rotateX(Math.PI/2);
  const mirrorMat=R.m(new THREE.MeshStandardMaterial({color:0xeed59b,metalness:.95,roughness:.12}));
  const mirrorMesh=new THREE.InstancedMesh(disc,mirrorMat,3),rays=new THREE.InstancedMesh(cylinder,emit,4);group.add(mirrorMesh,rays);
  const rayDirs=[],rayOrigins=[];for(let i=0;i<4;i++){rayDirs.push(new THREE.Vector3());rayOrigins.push(new THREE.Vector3());}
  for(let i=0;i<3;i++){
    const p=mirrorPts[i],prev=i?mirrorPts[i-1]:source,next=i<2?mirrorPts[i+1]:receiver;
    A.copy(p).sub(prev).normalize();B.copy(next).sub(p).normalize();normals.push(A.clone().sub(B).normalize());mirrorQs.push(new THREE.Quaternion());
    solid(p.x,rampY(p.z)+.9,p.z,1.2,1.8,1.2);glyph(p.x,rampY(p.z)+.8,p.z+.65,.35);
    interaction('mirror_'+i,'mirror',p.x,rampY(p.z),p.z+1.7,()=>{if(state.mirror)return false;steps[i]=(steps[i]+1)%8;refreshMirrors();return true;},{hint:'Rotate the reflective sun disc. Align all three beams.',steps:8});
  }
  glyph(receiver.x,receiver.y,receiver.z,.7);solid(receiver.x,receiver.y-1,receiver.z,1.3,2,.6);
  function refreshMirrors(){
    let connected=true;A.copy(source);
    for(let i=0;i<3;i++){
      Q.setFromAxisAngle(UP,(steps[i]-targets[i])*Math.PI/4);B.copy(normals[i]).applyQuaternion(Q);
      mirrorQs[i].setFromUnitVectors(V.set(0,0,1),B);M.compose(mirrorPts[i],mirrorQs[i],S.setScalar(1.05));mirrorMesh.setMatrixAt(i,M);
      if(connected){rayOrigins[i].copy(A);rayDirs[i].copy(mirrorPts[i]).sub(A);A.copy(mirrorPts[i]);
        if(steps[i]!==targets[i]){C.copy(rayDirs[i]).normalize().reflect(B).multiplyScalar(5).add(A);rayOrigins[i+1].copy(A);rayDirs[i+1].copy(C).sub(A);for(let k=i+2;k<4;k++)rayDirs[k].set(0,0,0);connected=false;}
      }
    }
    if(connected){rayOrigins[3].copy(A);rayDirs[3].copy(receiver).sub(A);solve('mirror');}
    for(let i=0;i<4;i++){const len=rayDirs[i].length();Q.setFromUnitVectors(UP,V.copy(rayDirs[i]).normalize());M.compose(B.copy(rayOrigins[i]).addScaledVector(rayDirs[i],.5),Q,S.set(.035,len,.035));rays.setMatrixAt(i,M);}
    mirrorMesh.instanceMatrix.needsUpdate=rays.instanceMatrix.needsUpdate=true;
  }
  // Stepping tiles show the same four distinct fictional glyphs as the clue wall.
  const plateG=R.g(new THREE.CylinderGeometry(1,1,.12,6)),plates=new THREE.InstancedMesh(plateG,gold,4);group.add(plates);
  const sequence=[0,2,1,3],plateTriggers=[],plateInside=[false,false,false,false];let sequenceAt=0;
  for(let i=0;i<4;i++){
    const x=-4.5+i*3,z=-42,y=rampY(z);M.compose(V.set(x,y+.1,z),Q.identity(),S.set(.8,1,.8));plates.setMatrixAt(i,M);
    const trigger=localBox(x,y+.8,z,1.5,2,1.5).applyMatrix4(group.matrixWorld);plateTriggers.push(trigger);triggers.push({id:'glyph_'+i,type:'puzzle',bounds:trigger});
    // Dot counts are original numeric clues. Order on the frieze: 1,3,2,4.
    for(let n=0;n<=i;n++)BATCH.add(sphere,emit,x-.3+n*.2,y+.19,z,.055,.025,.055);
  }
  for(let k=0;k<4;k++){const dots=sequence[k]+1;for(let n=0;n<dots;n++)BATCH.add(sphere,emit,-3+k*2+n*.15,2,-47.3,.06,.06,.06);}
  interaction('glyph_reset','reset',-6,rampY(-42),-40,()=>{sequenceAt=0;return true;},{hint:'Read the raised dots left to right: 1, 3, 2, 4. Step off between tiles.'});
  function stepGlyph(i){if(state.glyph)return;if(i===sequence[sequenceAt]){sequenceAt++;if(sequenceAt===sequence.length)solve('glyph');}else sequenceAt=0;}
  // Counterweight: a deliberately visible clue of twelve gold studs.
  solid(18,rampY(-52)+1,-52,4,2,3);solid(18,rampY(-52)+3.5,-54,5,7,1);
  for(let i=0;i<12;i++)BATCH.add(sphere,gold,16.4+(i%4)*1.05,rampY(-52)+3+Math.floor(i/4)*.6,-53.4,.09,.09,.09);
  const balance=new THREE.Mesh(box,gold);balance.scale.set(4,.14,.3);balance.position.set(18,rampY(-52)+2.5,-52);group.add(balance);
  interaction('counterweight','weight_swap',18,rampY(-52),-50,({weight})=>{if(state.weight)return false;if(!Number.isFinite(weight)||Math.abs(weight-12)>.1){send('trap','counterweight','warning');return false;}solve('weight');return true;},{requiredWeight:12,hint:'Twelve sun studs: substitute weight 12 before taking the altar prize.'});
  // Trap lifecycle: idle -> telegraph -> active -> recovery -> idle after exit.
  const traps=[];
  function trap(id,x,z,w,d,warn,duration,recover){
    const y=rampY(z),b=localBox(x,y+1,z,w,3,d).applyMatrix4(group.matrixWorld);
    const a={id,bounds:b,hazard:new THREE.Box3(),phase:0,clock:0,warn,duration,recover,latched:false,damageReady:false};
    traps.push(a);triggers.push({id,type:'trap',bounds:b,hazard:a.hazard});return a;
  }
  const roll=trap('rolling_boulder',0,-10,5,3,1.5,2.6,6),dart=trap('dart_wall',0,-26,7,3,1.1,1.4,4),collapse=trap('collapsing_bridge',0,-34,3,3.8,1.3,2,5),blade=trap('swinging_blade',0,-46,5,3,1.2,3.5,4);
  const boulder=new THREE.Mesh(sphere,stone);boulder.geometry=R.g(sphere.clone());
  {const p=boulder.geometry.attributes.position,c=new Float32Array(p.count*3);for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),k=1+.1*Math.sin(x*12+y*7+z*9);p.setXYZ(i,x*k,y*k,z*k);c.set([.30,.27,.22],i*3);}boulder.geometry.setAttribute('color',new THREE.BufferAttribute(c,3));boulder.geometry.computeVertexNormals();}boulder.scale.setScalar(2.1);boulder.visible=false;group.add(boulder);
  const dartMesh=new THREE.InstancedMesh(cone,dark,12);group.add(dartMesh);dartMesh.visible=false;
  for(let i=0;i<12;i++){const x=i%2?-9:9,z=-25-Math.floor(i/2)*.35;BATCH.add(cylinder,dark,x,rampY(z)+1.3,z,.16,.4,.16,0,0,Math.PI/2);}
  const collapseBox=collider(0,rampY(-34)-.4,-34,3.2,.8,4.1);
  // Blade + rod are combined into one local mesh.
  const bladeRoot=new THREE.Group();bladeRoot.position.set(0,rampY(-46)+7,-46);bladeRoot.rotation.z=1.2;group.add(bladeRoot);
  const bladeBatch=batcher(R,bladeRoot);bladeBatch.add(box,dark,0,-2.5,0,.16,5,.18);bladeBatch.add(cylinder,dark,0,-5.3,0,1.6,.12,1.6,Math.PI/2);bladeBatch.finish();
  // Gold-filled inner sanctum and the concealed second altar.
  for(const x of [-11,11]){solid(x,-3,-67,2.6,12,2.6);glyph(x,-1,-65.5,1.3);}
  for(let i=0;i<4;i++)solid(0,-8.8+i*.32,-68,12-i*1.7,.4,7-i*.6);
  const bars=new THREE.InstancedMesh(box,gold,180);for(let i=0;i<180;i++){const layer=Math.floor(i/36),n=i%36;Q.setFromAxisAngle(UP,layer%2?Math.PI/2:0);M.compose(V.set(-3.1+(n%6)*1.22,-7.7+layer*.27,-66-Math.floor(n/6)*.55),Q,S.set(1.08,.23,.45));bars.setMatrixAt(i,M);}bars.computeBoundingSphere();group.add(bars);
  const claims=new Set(),weaponClaims=new Set();
  const cache=interaction('gold_cache','pickup',0,-8,-63,({playerId})=>{if(!allSolved()||typeof playerId!=='string'||!playerId||claims.has(playerId))return false;claims.add(playerId);send('pickup','gold_cache','claimed',null,playerId,100000);return true;},{value:100000,oneTimePerPlayer:true});lootPoints.push(cache);
  const altar=new THREE.Group();altar.position.set(-10,-8,-71);group.add(altar);
  const altarBatch=batcher(R,altar);altarBatch.add(slab,stone,0,.5,0,3,1,3);altarBatch.add(torus,gold,0,1.3,0,1.3,1.3,1.3,Math.PI/2);altarBatch.finish();
  const prize=new THREE.Mesh(pyramid,gold);prize.position.set(0,2,0);altar.add(prize);
  const halo=new THREE.Mesh(torus,beamMat);halo.scale.setScalar(1.6);halo.position.y=2;altar.add(halo);
  const hiddenSeal=new THREE.Mesh(slab,stone);hiddenSeal.position.set(-10,-5,-69);hiddenSeal.scale.set(5,7,.8);group.add(hiddenSeal);
  const sealCollider=collider(-10,-5,-69,5,7,.8);let sealOpen=0;
  interaction('hidden_altar','reveal',-10,-8,-66.5,()=>{if(!allSolved())return false;sealOpen=1;return true;},{hint:'The three restored seals reveal the forgotten altar.'});
  const pickup=interaction('sun_pyramid','pickup',-10,-8,-70,({playerId})=>{if(!allSolved()||hiddenSeal.position.y<2.5||typeof playerId!=='string'||!playerId||weaponClaims.has(playerId))return false;weaponClaims.add(playerId);send('pickup','sun_pyramid','claimed',null,playerId);return true;},{oneTimePerPlayer:true});lootPoints.push(pickup);
  function allSolved(){return state.mirror&&state.glyph&&state.weight;}
  // Warm pools of light, not a uniform orange wash. Five points + one ambient.
  group.add(new THREE.AmbientLight(0x657885,.16));const lights=[];
  for(const [x,z,y,power,distance] of [[0,1,9,170,27],[-20,-15,5,90,21],[0,-27,5,110,24],[16,-52,0,100,22],[0,-66,2,200,29]]){
    const l=new THREE.PointLight(0xffb653,power,distance,2);l.position.set(x,y,z);l.castShadow=false;group.add(l);lights.push({l,power,phase:rnd()*TAU});
    glyph(x,y-1,z-.2,.4);BATCH.add(sphere,emit,x,y,z,.12,.12,.12);
  }
  const shaftMat=glowMaterial(R,0xffd187,high?.035:.018),shaftGeo=R.g(new THREE.ConeGeometry(1,1,high?24:10,1,true));
  const shafts=new THREE.InstancedMesh(shaftGeo,shaftMat,high?7:3);group.add(shafts);
  for(let i=0;i<shafts.count;i++){const z=-7-i*9;Q.setFromEuler(E.set(.10,0,-.18));M.compose(V.set((i%2?1:-1)*2,5+rampY(z),z),Q,S.set(2.4,15,2.4));shafts.setMatrixAt(i,M);}
  // Dust billboards: one draw, procedural soft discs, existing scene fog retained.
  const dustU={value:0},dustMat=glowMaterial(R,0xffdda2,.32);
  dustMat.onBeforeCompile=s=>{s.uniforms.templeTime=dustU;s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nuniform float templeTime;varying vec2 moteUV;').replace('#include <begin_vertex>','#include <begin_vertex>\nmoteUV=uv;').replace('#include <project_vertex>',`vec4 mvPosition=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.);mvPosition.x+=sin(templeTime*.3+instanceMatrix[3].z)*.2;mvPosition.y+=sin(templeTime*.22+instanceMatrix[3].x)*.3;mvPosition.xy+=position.xy*.045*length(instanceMatrix[0].xyz);gl_Position=projectionMatrix*mvPosition;`);s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 moteUV;').replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a*=max(0.,1.-length(moteUV-.5)*2.);');};
  const dust=new THREE.InstancedMesh(plane,dustMat,high?240:70);group.add(dust);for(let i=0;i<dust.count;i++){const z=-rnd()*70;M.compose(V.set((rnd()-.5)*17,rampY(z)+rnd()*12,z),Q.identity(),S.setScalar(1));dust.setMatrixAt(i,M);}dust.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,2,-35),48);
  const cueDust=new THREE.InstancedMesh(plane,dustMat,32);group.add(cueDust);cueDust.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,0,-30),40);cueDust.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  for(const [id,x,z,role] of [['sentinel_0',-5,-18,'guardian'],['sentinel_1',5,-24,'guardian'],['sentinel_2',-5,-45,'zombie'],['sentinel_3',5,-53,'zombie'],['sun_keeper',0,-65,'boss']])spawnPoints.push({id,role,position:world(x,rampY(z),z),rotationY});
  BATCH.finish();refreshMirrors();
  // Fixed conservative bounds for dynamic batches; no bounds allocations in update.
  for(const mesh of [doorMesh,mirrorMesh,rays,plates,dartMesh,shafts])mesh.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,1,-35),65);
  doorMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);dartMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const trapView={traps,sequence,mirrorTargets:targets,mirrorSteps:steps};
  group.userData.temple={state,triggers,trapView,entrance};
  function dynamicBox(b,x,y,z,w,h,d){A.set(x-w/2,y-h/2,z-d/2);B.set(x+w/2,y+h/2,z+d/2);b.set(A,B).applyMatrix4(group.matrixWorld);}
  function update(dt,camera,playerPos){
    if(disposed)return;dt=clamp(Number.isFinite(dt)?dt:0,0,.1);hasPlayer=!!playerPos;if(playerPos){pWorld.copy(playerPos);pLocal.copy(playerPos).applyMatrix4(inverse);}
    group.visible=hasPlayer&&pWorld.distanceToSquared(entrance)<=6400;if(!group.visible)return;t+=dt;dustU.value=t;
    for(let i=0;i<lights.length;i++){const a=lights[i];a.l.intensity=a.power*(.96+.025*Math.sin(t*5+a.phase)+.015*Math.sin(t*11+a.phase));}
    for(let i=0;i<doors.length;i++){
      const d=doors[i];if(d.target&&!d.started){d.started=true;send('door_open',d.id,'opening');}d.progress=Math.min(d.target,d.progress+dt*.28);const ease=d.progress*d.progress*(3-2*d.progress);
      for(let side=0;side<2;side++){const sign=side?1:-1,x=sign*(d.w/4+ease*(d.w/2+.8));M.compose(V.set(x,d.y+d.h/2,d.z),Q.identity(),S.set(d.w/2,d.h,1.3));doorMesh.setMatrixAt(i*2+side,M);dynamicBox(d.boxes[side],x,d.y+d.h/2,d.z,d.w/2,d.h,1.3);}
      if(d.progress===1&&!d.announced){d.announced=true;if(i===0)state.entranceOpen=true;send('door_open',d.id,'open');}
    }
    for(let i=0;i<4;i++){const inside=plateTriggers[i].containsPoint(pWorld);if(inside&&!plateInside[i])stepGlyph(i);plateInside[i]=inside;}
    for(let i=0;i<traps.length;i++){
      const a=traps[i],inside=a.bounds.containsPoint(pWorld);if(!inside)a.latched=false;
      if(a.phase===0&&inside&&!a.latched){a.latched=true;a.phase=1;a.clock=0;send('trap',a.id,'telegraph',a.bounds);}
      if(a.phase){a.clock+=dt;if(a.phase===1&&a.clock>=a.warn){a.phase=2;a.clock=0;a.announce=true;}else if(a.phase===2&&a.clock>=a.duration){a.phase=3;a.clock=0;a.hazard.makeEmpty();send('trap',a.id,'recovery',a.hazard);}else if(a.phase===3&&a.clock>=a.recover){a.phase=0;a.clock=0;send('trap',a.id,'reset',a.hazard);}}
    }
    const rollActive=roll.phase===2;boulder.visible=rollActive;
    if(rollActive){const z=-4-Math.pow(roll.clock/roll.duration,2)*16;boulder.position.set(0,rampY(z)+2.2,z);boulder.rotation.x=-roll.clock*4;dynamicBox(roll.hazard,0,boulder.position.y,z,4.2,4.2,4.2);}else roll.hazard.makeEmpty();
    dartMesh.visible=dart.phase===2;if(dartMesh.visible){for(let i=0;i<12;i++){const side=i%2?1:-1,travel=(dart.clock*1.8+Math.floor(i/2)*.07)%1,x=side*(8.5-travel*17),z=-25-Math.floor(i/2)*.35;Q.setFromAxisAngle(V.set(0,0,1),side*Math.PI/2);M.compose(C.set(x,rampY(z)+1.3,z),Q,S.set(.05,.7,.05));dartMesh.setMatrixAt(i,M);}dartMesh.instanceMatrix.needsUpdate=true;dynamicBox(dart.hazard,0,rampY(-26)+1.3,-26,18,1.2,3);}else dart.hazard.makeEmpty();
    const fall=collapse.phase===2?Math.min(12,collapse.clock*8):collapse.phase===3?12*(1-clamp(collapse.clock/collapse.recover,0,1)):0;
    const shake=collapse.phase===1?Math.sin(t*65)*.035:0;M.compose(V.set(shake,rampY(-34)-.45-fall,-34),Q.setFromAxisAngle(V.set(1,0,0),-Math.atan(.14)),S.set(3.2,.9,4.1));doorMesh.setMatrixAt(8,M);doorMesh.instanceMatrix.needsUpdate=true;
    if(collapse.phase===2){collapseBox.makeEmpty();dynamicBox(collapse.hazard,0,rampY(-34)-6,-34,3.2,12,4.1);}else{dynamicBox(collapseBox,0,rampY(-34)-.45-fall,-34,3.2,.9,4.1);collapse.hazard.makeEmpty();}
    const bladeWant=blade.phase===2?Math.cos(blade.clock*3.2)*1.05:1.2+(blade.phase===1?Math.sin(t*25)*.025:0);bladeRoot.rotation.z+=(bladeWant-bladeRoot.rotation.z)*Math.min(1,dt*12);
    if(blade.phase===2){const a=bladeRoot.rotation.z;dynamicBox(blade.hazard,Math.sin(a)*5.3,bladeRoot.position.y-Math.cos(a)*5.3,-46,3,3,.5);}else blade.hazard.makeEmpty();
    let cueVisible=false;
    for(let i=0;i<4;i++){const a=traps[i];if(a.announce){a.announce=false;send('trap',a.id,'active',a.hazard);}const on=a.phase===1;cueVisible=cueVisible||on;const z=i===0?-8:i===1?-26:i===2?-34:-46;for(let j=0;j<8;j++){const age=(t*.9+j*.13)%1;M.compose(V.set(Math.sin(j*2.4)*1.5,rampY(z)+age*1.5,z+Math.cos(j)*.8),Q.identity(),S.setScalar(on?5*(1-age):0));cueDust.setMatrixAt(i*8+j,M);}}
    cueDust.visible=cueVisible;cueDust.instanceMatrix.needsUpdate=true;
    balance.rotation.z=state.weight?Math.sin(t*2)*.015:.19;
    hiddenSeal.position.y+=((sealOpen?3:-5)-hiddenSeal.position.y)*Math.min(1,dt*2);dynamicBox(sealCollider,-10,hiddenSeal.position.y,-69,5,7,.8);
    prize.position.y=2+Math.sin(t*1.5)*.12;prize.rotation.y=t*.35;halo.rotation.set(Math.PI/2+.12*Math.sin(t),0,t*.18);
  }
  function dispose(){if(disposed)return;disposed=true;listeners.clear();group.removeFromParent();group.traverse(o=>{if(o.isInstancedMesh)o.dispose();});R.dispose();group.clear();colliders.length=spawnPoints.length=lootPoints.length=interactions.length=triggers.length=0;}
  update(0,null,entrance);hasPlayer=false;group.updateMatrixWorld(true);
  return {group,colliders,spawnPoints,lootPoints,interactions,triggers,state,update,onEvent(cb){if(typeof cb!=='function')throw new TypeError('Expected callback');listeners.add(cb);return()=>listeners.delete(cb);},dispose};
}

/** Standalone sun weapon. fire() returns a REUSED ticket (or null if busy).
 * Charging: .55 s; visible pulse: .26 s; cooldown: 1.1 s. Damage only when
 * ticket.ready becomes true after update. ticket.shotId increments once/pulse.
 * ray is WORLD SPACE. Optional setImpact(worldPoint) places/clamps the flare.
 * Add mesh to the scene with identity parent transform; it includes weapon model
 * and world-space FX. Position model via mesh.userData.model (not mesh root).
 * heat shimmer is a procedural animated glow envelope, not scene refraction.
 */
export function createSunPyramidWeapon(){
  const R=makeResources(),mesh=new THREE.Group();mesh.name='Sun Pyramid Weapon';
  const gold=R.m(new THREE.MeshStandardMaterial({color:0xf3c15b,metalness:.85,roughness:.2}));
  const geo=R.g(new THREE.ConeGeometry(.22,.34,4));geo.rotateY(Math.PI/4);const model=new THREE.Mesh(geo,gold);mesh.add(model);mesh.userData.model=model;
  const inner=glowMaterial(R,0xfff5ce,.95),outer=glowMaterial(R,0xffac2a,.24),heat=glowMaterial(R,0xffd775,.12),flareMat=glowMaterial(R,0xffdc8b,.8);
  const cylinder=R.g(new THREE.CylinderGeometry(1,1,1,12,1,true)),core=new THREE.Mesh(cylinder,inner),glow=new THREE.Mesh(cylinder,outer),shimmer=new THREE.Mesh(cylinder,heat);mesh.add(core,glow,shimmer);
  const orbG=R.g(new THREE.SphereGeometry(1,16,10)),flare=new THREE.Mesh(orbG,flareMat),chargeOrb=new THREE.Mesh(orbG,outer);mesh.add(flare,chargeOrb);
  const uT={value:0};heat.onBeforeCompile=s=>{s.uniforms.sunTime=uT;s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nuniform float sunTime;').replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.xz*=1.+.14*sin(position.y*80.+sunTime*31.)+.07*cos(position.y*130.-sunTime*22.);');};
  const ticket={ray:new THREE.Ray(),ready:false,shotId:0,state:'idle',maxDistance:90,hitDistance:90};
  const origin=new THREE.Vector3(),direction=new THREE.Vector3(),axis=new THREE.Vector3(0,1,0),center=new THREE.Vector3(),end=new THREE.Vector3(),q=new THREE.Quaternion();
  let phase=0,clock=0,time=0,dead=false;
  function hide(){core.visible=glow.visible=shimmer.visible=flare.visible=chargeOrb.visible=false;}hide();
  function fire(o,d){if(dead||phase!==0||!o||!d||!Number.isFinite(o.x+o.y+o.z+d.x+d.y+d.z)||d.lengthSq()<1e-9)return null;origin.copy(o);direction.copy(d).normalize();ticket.ray.set(origin,direction);ticket.ready=false;ticket.hitDistance=ticket.maxDistance;phase=1;clock=0;ticket.state='charging';return ticket;}
  function update(dt){if(dead)return;dt=clamp(Number.isFinite(dt)?dt:0,0,.1);time+=dt;uT.value=time;ticket.ready=false;if(phase===0)return;clock+=dt;
    if(phase===1&&clock>=.55){phase=2;clock=0;ticket.state='firing';ticket.shotId++;ticket.ready=true;}else if(phase===2&&clock>=.26){phase=3;clock=0;ticket.state='cooldown';hide();}else if(phase===3&&clock>=1.1){phase=0;clock=0;ticket.state='idle';hide();}
    chargeOrb.visible=phase===1;if(phase===1){chargeOrb.position.copy(origin);chargeOrb.scale.setScalar(.04+clock*.4);model.rotation.y+=dt*5;}
    if(phase===2){const len=ticket.hitDistance,pulse=1-clock/.26;center.copy(origin).addScaledVector(direction,len*.5);end.copy(origin).addScaledVector(direction,len);q.setFromUnitVectors(axis,direction);
      core.visible=glow.visible=shimmer.visible=flare.visible=true;core.position.copy(center);glow.position.copy(center);shimmer.position.copy(center);core.quaternion.copy(q);glow.quaternion.copy(q);shimmer.quaternion.copy(q);core.scale.set(.045*pulse,len,.045*pulse);glow.scale.set(.19*pulse,len,.19*pulse);shimmer.scale.set(.32*pulse,len,.32*pulse);flare.position.copy(end);flare.scale.setScalar(.5*pulse);}
  }
  return {mesh,fire,update,get state(){return ticket.state;},setImpact(p){if(!p||phase!==2)return;ticket.hitDistance=clamp(center.copy(p).sub(origin).dot(direction),0,ticket.maxDistance);const len=ticket.hitDistance;center.copy(origin).addScaledVector(direction,len*.5);core.position.copy(center);glow.position.copy(center);shimmer.position.copy(center);core.scale.y=glow.scale.y=shimmer.scale.y=len;flare.position.copy(origin).addScaledVector(direction,len);},dispose(){if(dead)return;dead=true;mesh.removeFromParent();R.dispose();mesh.clear();}};
}

/* Usage: your page resolves 'three' via its existing import map.
import {createSunTemple,createSunPyramidWeapon} from './suntemple.js';
const temple=createSunTemple({position:[0,0,0],quality:'high'});scene.add(temple.group);
const off=temple.onEvent(e=>{ // synchronous, reused event: copy fields to retain
  if(e.type==='pickup') grantPickup(e.playerId,e.id,e.value); // host authority!
  if(e.type==='trap') playTrapCue(e.id,e.phase);
});
// Each frame: temple.update(dt,camera,player.position);
// On nearby E/tap: hook.activate({playerId:'P1',weight:12});
// Poll temple.triggers[i].hazard for active trap collision, not damage numbers.
// Persist claims on host; rebuilding the module resets its in-memory claim sets.
const gun=createSunPyramidWeapon();scene.add(gun.mesh);let shot=null,lastShot=0;
// On fire: shot=gun.fire(muzzleWorld,aimDirectionWorld);
// Each frame: gun.update(dt); if(shot?.ready && shot.shotId!==lastShot){
//   lastShot=shot.shotId; const hit=castGameRay(shot.ray,shot.maxDistance);
//   if(hit){applyGameDamage(hit);gun.setImpact(hit.point);}
// }
// Unload: off();temple.dispose();gun.dispose();unregisterGameColliders();
*/
