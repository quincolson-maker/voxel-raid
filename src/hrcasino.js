// Host-authoritative poker and private blackjack, sharing the saloon sv/svr route.
// Table chips are free, isolated practice chips; they never award game points.
import * as THREE from 'three';
import {HoldemTable,BlackjackGame,cardText} from './hrcasinogames.js';
import {makeFrontierCharacter} from './hrcharacters.js';
export function createCasino({scene,H,P,T,camera,mobile,msg,beforeOpen=()=>{}}){
 const s=T.town,F=s.F,table=new HoldemTable(),blackjack=new Map(),modes=new Map(),sequences=new Map(),me=()=>String(H.me||'P1'),auth=()=>!H.netRole||H.netRole()!=='client';
 const root=new THREE.Group();root.position.set(s.cx,s.y0,s.cz);root.rotation.y=s.rot;root.name='Frontier casino tables';scene.add(root);
 const geos=new Set(),mats=new Set(),textures=new Set(),G=g=>(geos.add(g),g),M=m=>(mats.add(m),m),wood=M(new THREE.MeshStandardMaterial({color:0x40271b,roughness:.5})),felt=M(new THREE.MeshStandardMaterial({color:0x164c40,roughness:1})),brass=M(new THREE.MeshStandardMaterial({color:0xc5a05a,metalness:.75,roughness:.4}));
 function mesh(g,m,x,y,z,sx=1,sy=1,sz=1){const o=new THREE.Mesh(G(g),m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);root.add(o);return o;}
 mesh(new THREE.CylinderGeometry(1,1,.10,48),wood,-4.2,F+.79,1.6,1.35,1,1.0);mesh(new THREE.CylinderGeometry(1,1,.01,48),felt,-4.2,F+.85,1.6,1.22,1,.88);
 mesh(new THREE.TorusGeometry(1,.045,6,48).rotateX(Math.PI/2),wood,-4.2,F+.86,1.6,1.3,1,.95);
 mesh(new THREE.CylinderGeometry(1,1,.1,40),wood,-3,F+.79,7.2,1.1,1,1.0);mesh(new THREE.CylinderGeometry(1,1,.012,40),felt,-3,F+.85,7.2,1,1,.9);
 // One card atlas and one instanced card draw; backs are also atlas cells.
 const cv=document.createElement('canvas');cv.width=832;cv.height=480;const ctx=cv.getContext('2d');
 for(let i=0;i<65;i++){const x=i%13*64,y=Math.floor(i/13)*96;ctx.fillStyle=i===52?'#59202c':'#f4ead5';ctx.fillRect(x+1,y+1,62,94);ctx.strokeStyle='#b48c49';ctx.strokeRect(x+3,y+3,58,90);if(i<52){ctx.fillStyle=Math.floor(i/13)===1||Math.floor(i/13)===2?'#a43136':'#202b2a';ctx.font='bold 18px Georgia';ctx.fillText(cardText(i),x+6,y+25);ctx.font='28px Georgia';ctx.fillText(['♣','♦','♥','♠'][Math.floor(i/13)],x+18,y+65);}else{ctx.strokeStyle='#c99b59';for(let n=0;n<5;n++){ctx.beginPath();ctx.arc(x+32,y+48,8+n*5,0,Math.PI*2);ctx.stroke();}}}
 const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;textures.add(tex);const cardMat=M(new THREE.MeshStandardMaterial({map:tex,roughness:.7}));
 cardMat.onBeforeCompile=sh=>{sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute float cardFace;').replace('#include <uv_vertex>','#include <uv_vertex>\nvMapUv=vec2((vMapUv.x+mod(cardFace,13.))/13.,(vMapUv.y+4.-floor(cardFace/13.))/5.);');};
 const cardGeo=G(new THREE.PlaneGeometry(.15,.22).rotateX(-Math.PI/2)),faceAttr=new THREE.InstancedBufferAttribute(new Float32Array(40),1);cardGeo.setAttribute('cardFace',faceAttr);const cards=new THREE.InstancedMesh(cardGeo,cardMat,40);root.add(cards);cards.count=0;cards.frustumCulled=false;
 const chips=new THREE.InstancedMesh(G(new THREE.CylinderGeometry(.035,.035,.012,12)),brass,60);root.add(chips);chips.count=0;chips.frustumCulled=false;
 const V=new THREE.Vector3(),Q=new THREE.Quaternion(),S=new THREE.Vector3(),MX=new THREE.Matrix4(),look=new THREE.Vector3(),dolls=[];
 function seat(i){const a=i/6*Math.PI*2;return [-4.2+Math.sin(a)*1.8,F,1.6-Math.cos(a)*1.45];}
 for(let i=0;i<6;i++){const D=makeFrontierCharacter({kind:'bandit',skin:[0xd0a180,0x704a35,0xb58462][i%3],hair:0x322317,top:0xd0b98f,coat:[0x514337,0x333b37,0x664532][i%3],quality:mobile?'low':'high'}),p=seat(i);D.g.position.set(...p);D.g.rotation.y=Math.atan2(-4.2-p[0],1.6-p[2]);D.hips.position.y=.55;for(const l of D.legs){l[0].rotation.x=-1.5;l[1].rotation.x=1.5;}for(const a of D.arms){a[0].rotation.x=-.8;a[1].rotation.x=-.6;}root.add(D.g);D.g.visible=false;dolls.push(D);}
 const dealer=makeFrontierCharacter({kind:'dealer',skin:0xb08263,top:0xf0e4c8,hair:0x28231c,quality:mobile?'low':'high'});dealer.g.position.set(-3,F,8.35);dealer.g.rotation.y=Math.PI;root.add(dealer.g);dolls.push(dealer);
 const panel=document.createElement('section');panel.id='hrCasino';panel.hidden=true;document.body.appendChild(panel);const style=document.createElement('style');style.textContent=`#hrCasino{position:fixed;z-index:61;bottom:12px;left:50%;transform:translateX(-50%);width:min(740px,95vw);max-height:78vh;overflow:auto;box-sizing:border-box;padding:16px;color:#f3dfb4;background:linear-gradient(140deg,#1b302bfa,#21150ffa);border:2px solid #bc9855;border-radius:10px;font:15px system-ui;box-shadow:0 12px 60px #000b}#hrCasino h2{font:700 23px Georgia;margin:0 0 10px;color:#e5c382}#hrCasino button{touch-action:manipulation;background:#563b26;border:1px solid #bb9659;border-radius:6px;color:#fff0cc;padding:11px 14px;font-weight:700;margin:4px;min-height:44px}#hrCasino button:disabled{opacity:.35}#hrCasino .exit{float:right}#hrCasino .players{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}#hrCasino .seat{border:1px solid #896c3d;padding:7px;border-radius:6px}#hrCasino .acting{border-color:#ffdf83;box-shadow:inset 0 0 16px #d5a33233}#hrCasino .cards{display:flex;gap:5px;margin:7px 0;flex-wrap:wrap}#hrCasino .card{display:inline-flex;align-items:center;justify-content:center;min-width:35px;height:48px;background:#f4ead5;color:#252a27;border:1px solid #c7aa6e;border-radius:4px;font:bold 21px Georgia}#hrCasino .red{color:#a33035}#hrCasino .muted{opacity:.7;font-size:12px}#hrCasino .history{font:12px system-ui;max-height:75px;overflow:auto;margin-top:8px}#hrCasino input{width:90px;padding:10px;background:#fff2d5;color:#302118;border:1px solid #b28b4e} @media(max-width:550px){#hrCasino .players{grid-template-columns:repeat(2,1fr)}#hrCasino{padding:10px}}`;document.head.appendChild(style);
 let opened=null,saved=null,view=null,request=0,lastRender=0,receivedAt=0,nextHandT=0,lastRev=-1,disposed=false,pendingAt=0;
 const session=Math.random().toString(36).slice(2),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const htmlCards=a=>'<div class="cards">'+a.map(c=>`<span class="card ${c!=null&&[1,2].includes(Math.floor(c/13))?'red':''}">${cardText(c)}</span>`).join('')+'</div>';
 const game=id=>{if(!blackjack.has(id)&&blackjack.size<32)blackjack.set(id,new BlackjackGame());return blackjack.get(id);};
 function reply(id,which,error=''){const data=which==='poker'?table.view(id):game(id)?.view();if(!data)return;const m={t:'svr',k:'casino',which,data,error};if(id===me())receive(m);else H.zSendTo&&H.zSendTo(id,m);}
 function broadcast(){for(const [id,which] of modes)reply(id,which);lastRev=table.revision;}
 function send(action,args={}){const m={t:'sv',k:'casino',action,which:opened,n:++request,session,name:String(H.callsign?.()||me()).slice(0,24),...args};pendingAt=performance.now();if(auth())handle(m,me());else if(H.zSend)H.zSend(m);else msg('Casino host unavailable',2);}
 function handle(m,from){if(disposed||!auth()||!from||m.k!=='casino'||!Number.isSafeInteger(m.n)||m.n<1||typeof m.session!=='string'||m.session.length>32||!['poker','blackjack'].includes(m.which))return false;
  if(!modes.has(from)&&modes.size>=32)return false;const prev=sequences.get(from);if(prev&&prev.session===m.session&&m.n<=prev.n){reply(from,m.which);return true;}sequences.set(from,{session:m.session,n:m.n});let ok=false;
  if(m.action==='join'){if(modes.get(from)==='poker'&&m.which!=='poker')table.leave(from);modes.set(from,m.which);if(m.which==='poker'){ok=table.join(from,typeof m.name==='string'?m.name.slice(0,24):from);if(ok&&table.phase==='waiting')table.startHand();}else ok=!!game(from);}
  else if(m.action==='leave'){if(m.which==='poker')table.leave(from);modes.delete(from);broadcast();return true;}
  else if(modes.get(from)!==m.which){reply(from,m.which,'Join this table first');return true;}
  else if(m.which==='poker'){if(m.action==='rebuy')ok=table.rebuy(from);else if(m.action==='next')ok=table.startHand();else ok=table.act(from,m.action,Number(m.amount));}
  else{const b=game(from);if(b)ok=m.action==='bet'?b.bet(Number(m.amount)):m.action==='rebuy'?b.rebuy():b.action(m.action);}
  reply(from,m.which,ok?'':'That action is not available');if(m.which==='poker')broadcast();return true;
 }
 function receive(m){if(m.k!=='casino'||m.which!==opened||!m.data||!Array.isArray(m.data.players)&&!Array.isArray(m.data.hands))return false;view=m.data;receivedAt=performance.now();pendingAt=0;if(m.error)msg(m.error,2);render();drawCards();return true;}
 function drawCards(){if(!view)return;let count=0,chipN=0;function card(c,x,z,y,angle=0){if(count>=40)return;faceAttr.setX(count,c==null?52:c);Q.setFromAxisAngle(V.set(0,1,0),angle);MX.compose(S.set(x,y,z),Q,look.setScalar(1));cards.setMatrixAt(count++,MX);}
  if(opened==='poker'){
   view.board.forEach((c,i)=>card(c,-4.6+i*.20,1.6,F+.87));
   view.players.forEach((p,i)=>{const a=i/6*Math.PI*2;for(let j=0;j<p.hole.length;j++)card(p.hole[j],-4.2+Math.sin(a)*.83+(j-.5)*.16,1.6-Math.cos(a)*.63,F+.87,-a);for(let j=0;j<Math.min(8,Math.ceil(p.stack/150));j++){MX.compose(V.set(-4.2+Math.sin(a)*1.0,F+.87+j*.013,1.6-Math.cos(a)*.72),Q.identity(),S.setScalar(1));chips.setMatrixAt(chipN++,MX);}if(dolls[i])dolls[i].g.visible=p.bot;});
  }else{for(let i=0;i<6;i++)dolls[i].g.visible=false;view.dealer.forEach((c,i)=>card(c,-3.25+i*.19,7.65,F+.87));view.hands.forEach((h,j)=>h.cards.forEach((c,i)=>card(c,-3.7+j*.45+i*.10,7,F+.87)));}
  cards.count=count;chips.count=chipN;faceAttr.needsUpdate=true;cards.instanceMatrix.needsUpdate=chips.instanceMatrix.needsUpdate=true;
 }
 function render(){if(!opened)return;let h='<button class="exit" data-a="exit">LEAVE TABLE</button><h2>'+ (opened==='poker'?'THE FRONTIER · TEXAS HOLD’EM':'DEALER’S CHOICE · BLACKJACK')+'</h2><div class="muted">Fictional practice chips · no cash value · separate from game points</div>';
  if(!view){panel.innerHTML=h+'<p>Joining the host…</p>';return;}
  if(opened==='poker'){
   const v=view,l=v.legal;h+=`<p>${esc(v.phase.toUpperCase())} · POT <b>${v.pot}</b> · HAND ${v.handId} <span id="hrTurnClock"></span></p>`+htmlCards(v.board)+ '<div class="players">';
   v.players.forEach((p,i)=>{h+=`<div class="seat ${v.actor===i?'acting':''}"><b>${esc(p.name)}</b>${p.bot?' · BOT':''}${v.button===i?' · D':''}<div>${p.stack} chips · ${p.folded?'FOLDED':p.allIn?'ALL IN':'in '+p.street}</div>${htmlCards(p.hole)}</div>`;});h+='</div>';
   if(v.waiting?.some(p=>p.id===me()))h+='<p>Your seat is reserved for the next hand. Bots will step aside.</p>';
   if(l)h+=`<div><button data-a="fold">FOLD</button><button data-a="${l.canCheck?'check':'call'}">${l.canCheck?'CHECK':'CALL '+l.call}</button><input aria-label="Raise to" id="hrRaise" type="number" min="${Math.min(l.minTo,l.maxTo)}" max="${l.maxTo}" step="1" value="${Math.min(l.minTo,l.maxTo)}"><button data-a="raise" ${l.canRaise?'':'disabled'}>RAISE TO</button><button data-a="allin">ALL IN</button></div>`;
   if(['complete','waiting'].includes(v.phase))h+='<button data-a="next">DEAL NEXT HAND</button><button data-a="rebuy">FREE REBUY IF BUSTED</button>';
   h+='<div class="history">'+v.log.map(esc).join('<br>')+'</div><div class="muted">Blinds 10/20 · 30-second turns · unused seats filled by bots · late joins enter next hand</div>';
  }else{
   const v=view;h+=`<p>YOUR CHIPS: <b>${v.balance}</b></p><b>DEALER</b>`+htmlCards(v.dealer);v.hands.forEach((hand,i)=>h+=`<div class="seat ${v.active===i?'acting':''}">HAND ${i+1} · BET ${hand.bet} ${esc(hand.outcome)}${htmlCards(hand.cards)}</div>`);
   if(v.phase==='playing')h+=`<button data-a="hit">HIT</button><button data-a="stand">STAND</button><button data-a="double" ${v.canDouble?'':'disabled'}>DOUBLE</button><button data-a="split" ${v.canSplit?'':'disabled'}>SPLIT</button>`;
   else h+=[10,50,100].map(n=>`<button data-a="bet" data-n="${n}" ${v.balance<n?'disabled':''}>DEAL · ${n}</button>`).join('')+'<button data-a="rebuy">FREE REBUY IF BUSTED</button>';
   h+='<p>'+esc(v.message)+'</p><div class="muted">Six decks · dealer stands soft 17 · 3:2 blackjack · split to four hands · split aces get one card · double after split · no insurance</div>';
  }panel.innerHTML=h;
 }
 function open(which){if(disposed||!['poker','blackjack'].includes(which)||opened)return false;beforeOpen();saved={pos:P.pos.clone(),yaw:P.yaw,pitch:P.pitch,fp:H.fp,seated:H.seated,noGun:H.noGun,uiOpen:H.uiOpen};opened=which;view=null;H.seated=H.noGun=H.uiOpen=H.fp=true;H.fv?.set(0,0);H.guns?.holster();if(document.pointerLockElement)document.exitPointerLock();panel.hidden=false;render();send('join');return true;}
 function close(){if(!opened)return;send('leave');opened=null;panel.hidden=true;cards.count=chips.count=0;for(let i=0;i<6;i++)dolls[i].g.visible=false;if(saved){P.pos.copy(saved.pos);P.yaw=saved.yaw;P.pitch=saved.pitch;H.fp=saved.fp;H.noGun=saved.noGun;H.seated=saved.seated;H.uiOpen=saved.uiOpen;}saved=null;}
 const click=e=>{const b=e.target.closest('button');if(!b||b.disabled)return;e.stopPropagation();const a=b.dataset.a;if(a==='exit')return close();send(a,{amount:a==='raise'?Number(panel.querySelector('#hrRaise')?.value):Number(b.dataset.n)});};
 const stop=e=>e.stopPropagation();panel.addEventListener('pointerdown',stop);panel.addEventListener('mousedown',stop);panel.addEventListener('click',click);
 const key=e=>{if(opened&&e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();}};addEventListener('keydown',key,true);
 const tableWalls=[];for(const [cx,cz,rx,rz] of [[-4.2,1.6,1.35,1],[-3,7.2,1.1,1]])for(let i=0;i<10;i++){const a=i/10*Math.PI*2,b=(i+1)/10*Math.PI*2,[ax,az]=T.toW(s,cx+Math.sin(a)*rx,cz+Math.cos(a)*rz),[bx,bz]=T.toW(s,cx+Math.sin(b)*rx,cz+Math.cos(b)*rz),w=[ax,az,bx,bz,s.y0+F,s.y0+F+.87];T.walls.push(w);tableWalls.push(w);}
 const stopUse=T.onUse;T.onUse=o=>{if(o.kind==='poker'||o.kind==='blackjack'){open(o.kind);return true;}return stopUse?stopUse(o):false;};Object.assign(T.TL,{poker:'SIT & PLAY<small>TEXAS HOLD’EM</small>',blackjack:'SIT & PLAY<small>BLACKJACK</small>'});
 const spots=[];for(const [kind,x,z] of [['poker',-4.2,.35],['blackjack',-3,6.1]]){const [wx,wz]=T.toW(s,x,z),p={x:wx,z:wz,y:s.y0+F,kind,label:kind==='poker'?'Play Texas Hold’em':'Play blackjack',r:1.25,s};T.spots.push(p);spots.push(p);}
 return {table,open,close,handleRequest:handle,handleResponse:receive,get view(){return view;},get opened(){return opened;},tick(dt){if(disposed)return;dt=Math.max(0,Math.min(.1,dt||0));
   if(auth()){table.tick(dt);if(table.revision!==lastRev)broadcast();if(table.phase==='complete'&&table.players.some(p=>!p.bot&&!p.leaving)){nextHandT+=dt;if(nextHandT>8){nextHandT=0;table.startHand();broadcast();}}else nextHandT=0;}
   const near=Math.hypot(P.pos.x-s.cx,P.pos.z-s.cz)<65;root.visible=near;
   if(near){for(let i=0;i<dolls.length;i++)if(dolls[i].g.visible)dolls[i].head.rotation.y=Math.sin((H.t||0)*.6+i)*.1;}
   if(opened){let p;if(opened==='poker'){let i=view?.players?.findIndex(p=>p.id===me());p=i==null||i<0?[-6.15,F,.3]:seat(i);}else p=[-3,F,6.0];const [wx,wz]=T.toW(s,p[0],p[2]);P.pos.set(wx,s.y0+p[1],wz);H.fv?.set(0,0);const [tx,tz]=T.toW(s,opened==='poker'?-4.2:-3,opened==='poker'?1.6:7.2);P.yaw=Math.atan2(-(tx-wx),-(tz-wz));P.pitch=-.32;
     lastRender+=dt;if(lastRender>.25){lastRender=0;const el=panel.querySelector('#hrTurnClock');if(el&&view?.actor>=0)el.textContent=' · '+Math.max(0,Math.ceil(view.turnSeconds-(performance.now()-receivedAt)/1000))+'s';}
     if(pendingAt&&performance.now()-pendingAt>8000){pendingAt=0;msg('The casino host is not responding. Leave and rejoin; no local outcomes are generated.',4);}
   }
 },dispose(){if(disposed)return;close();disposed=true;removeEventListener('keydown',key,true);panel.remove();style.remove();root.removeFromParent();for(const d of dolls)d.dispose();cards.dispose();chips.dispose();for(const g of geos)g.dispose();for(const m of mats)m.dispose();for(const t of textures)t.dispose();for(const p of spots){const i=T.spots.indexOf(p);if(i>=0)T.spots.splice(i,1);}for(const w of tableWalls){const i=T.walls.indexOf(w);if(i>=0)T.walls.splice(i,1);}T.onUse=stopUse;}};
}
