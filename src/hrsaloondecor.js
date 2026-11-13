// Original 1880s-inspired mahogany / oxblood / aged brass art direction.
// Additive dressing inside the EXISTING collision footprint; no external assets.
import * as THREE from 'three';
export function createSaloonDecor({scene,T,mobile}){
 const s=T.town,F=s.F,Y=s.Y2,root=new THREE.Group();root.position.set(s.cx,s.y0,s.cz);root.rotation.y=s.rot;root.name='The Red Garter · architectural detail';scene.add(root);
 const gs=new Set(),ms=new Set(),ts=new Set(),bins=new Map(),M=new THREE.Matrix4(),Q=new THREE.Quaternion(),E=new THREE.Euler(),V=new THREE.Vector3(),S=new THREE.Vector3();
 const mat=(color,roughness=.7,metalness=0)=>{const m=new THREE.MeshStandardMaterial({color,roughness,metalness});ms.add(m);return m;};
 const walnut=mat(0x5b3424,.55),dark=mat(0x291b15,.6),brass=mat(0xc5a160,.36,.78),ivory=mat(0xd8c6a1),red=mat(0x622b35,.9),iron=mat(0x252725,.5,.75),amber=new THREE.MeshBasicMaterial({color:0xffd79c});ms.add(amber);
 function add(g,m,x,y,z,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0){Q.setFromEuler(E.set(rx,ry,rz));M.compose(V.set(x,y,z),Q,S.set(sx,sy,sz));g.applyMatrix4(M);if(!bins.has(m))bins.set(m,[]);bins.get(m).push(g);}
 const box=(m,x,y,z,w,h,d)=>add(new THREE.BoxGeometry(w,h,d),m,x,y,z);
 const cyl=(m,x,y,z,r,h)=>add(new THREE.CylinderGeometry(r,r,h,mobile?8:16),m,x,y,z);
 const tube=(m,points,r)=>add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),mobile?8:16,r,6,false),m,0,0,0);
 // Wallpaper is repeated ink on canvas, not an external image.
 const cv=document.createElement('canvas');cv.width=cv.height=256;const ctx=cv.getContext('2d');ctx.fillStyle='#392526';ctx.fillRect(0,0,256,256);ctx.strokeStyle='#947348';ctx.lineWidth=2;for(let y=0;y<3;y++)for(let x=0;x<3;x++){const px=x*128,py=y*128;ctx.beginPath();ctx.moveTo(px,py-48);ctx.bezierCurveTo(px+48,py-18,px+37,py+18,px,py+48);ctx.bezierCurveTo(px-37,py+18,px-48,py-18,px,py-48);ctx.stroke();ctx.beginPath();ctx.arc(px,py,7,0,Math.PI*2);ctx.stroke();}
 const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(10,3);ts.add(tex);const wallpaper=new THREE.MeshStandardMaterial({map:tex,roughness:.95});ms.add(wallpaper);
 add(new THREE.PlaneGeometry(15.7,5),wallpaper,-9,F+4.3,9.90);add(new THREE.PlaneGeometry(9.8,5),wallpaper,-1.10,F+4.3,5,1,1,1,0,-Math.PI/2);add(new THREE.PlaneGeometry(9.8,5),wallpaper,-16.90,F+4.3,5,1,1,1,0,Math.PI/2);
 // Raised panel wainscot, picture rails, layered cornices.
 for(let x=-16.5;x<-.9;x+=.72){box(walnut,x,F+.8,9.82,.66,1.6,.12);box(dark,x,F+.8,9.73,.51,1.22,.04);for(const dx of [-.26,.26])box(brass,x+dx,F+.8,9.68,.018,1.24,.025);}
 for(const y of [F+.15,F+1.58,F+1.68,F+6.8,F+7.1]){box(walnut,-9,y,9.7,15.8,.09,.24);box(brass,-9,y+.045,9.56,15.8,.018,.025);}
 for(const x of [-16.83,-1.17])for(const y of [F+.2,F+1.65,F+7])box(walnut,x,y,5,.2,.12,10);
 // Beaded false-front cornice, siding details, porch fretwork and corbels.
 for(const y of [F+7.7,F+8,F+9.8]){box(walnut,-9,y,-.21,16.5,.16,.34);box(brass,-9,y-.12,-.35,16.5,.035,.05);}
 for(let x=-16.8;x<-.9;x+=.65){box(ivory,x,F+7.9,-.27,.12,.32,.18);box(walnut,x,F+9,-.16,.035,1.5,.1);}
 for(const x of [-16.8,-9,-1.2]){box(walnut,x,F+1.4,-2.3,.26,2.9,.26);for(const y of [F+.12,F+2.5,F+2.82])box(ivory,x,y,-2.3,.38,.12,.38);
  tube(walnut,[[x,F+2.5,-2.3],[x,F+2.35,-1.9],[x,F+2.6,-1.6],[x,F+2.9,-1.5]],.06);}
 for(let x=-16.6;x<-1.3;x+=.4){add(new THREE.TorusGeometry(.16,.025,5,12,Math.PI),walnut,x,F+2.7,-2.32);}
 // Framed sash windows (the patched town walls have actual visual apertures).
 for(const [x,y,w,h] of [[-15.4,F+1.7,1.4,1.2],[-2.6,F+1.7,1.4,1.2],...[-15.5,-12.5,-9.5,-3.5].map(x=>[x,Y+1.5,1.2,1.1])]){
  for(const dx of [-w/2-.08,w/2+.08])box(ivory,x+dx,y,-.15,.13,h+.28,.16);for(const dy of [-h/2-.08,h/2+.08])box(ivory,x,y+dy,-.15,w+.28,.13,.16);box(walnut,x,y,-.15,.055,h,.12);box(walnut,x,y,-.15,w,.055,.12);box(brass,x,y-h/2-.16,-.22,w+.4,.06,.3);
 }
 // Balcony turned spindles and handrail; existing walls remain collision authority.
 for(let z=.3;z<=2.8;z+=.22){cyl(walnut,-11.48,Y+.48,z,.025,.86);add(new THREE.SphereGeometry(.05,8,6),walnut,-11.48,Y+.48,z);}
 box(walnut,-11.48,Y+.99,1.55,.12,.09,2.8);box(brass,-11.39,Y+1.02,1.55,.025,.02,2.8);
 // Carved backbar, scalloped mahogany arches, brass foot rail and raised counter panels.
 for(let x=-9.6;x<=-4.3;x+=.88){box(walnut,x,F+.62,5.16,.78,.8,.08);box(dark,x,F+.62,5.1,.61,.6,.04);for(const dx of [-.3,.3])box(brass,x+dx,F+.62,5.07,.014,.62,.015);}
 tube(brass,[[-10,F+.22,5],[-7,F+.22,5],[-4,F+.22,5]],.035);
 for(const x of [-10.15,-3.85]){box(walnut,x,F+2.05,9.68,.26,3.8,.35);add(new THREE.CylinderGeometry(.15,.15,3.8,12),walnut,x,F+2.05,9.48);}
 box(walnut,-7,F+3.95,9.65,6.7,.3,.45);box(brass,-7,F+3.78,9.4,6.7,.035,.035);
 for(let i=0;i<6;i++){add(new THREE.TorusGeometry(.45,.045,6,20,Math.PI),walnut,-9.5+i,F+3.4,9.42);}
 // Layered velvet curtains and swags around the cabaret stage.
 for(const z of [.62,3.18])for(let i=0;i<(mobile?7:12);i++){const zz=z+(i-(mobile?3:5.5))*.034;add(new THREE.CylinderGeometry(.09,.12,2.9,8),red,-16.72,F+1.85,zz);}
 tube(red,[[-16.7,F+3.4,.4],[-16.68,F+2.95,1.15],[-16.7,F+3.4,1.9],[-16.68,F+2.95,2.65],[-16.7,F+3.4,3.4]],.18);for(const z of [.7,3.1]){box(brass,-16.56,F+1.5,z,.15,.05,.32);}
 // Two clustered chandeliers, with low mobile light count and no shadows.
 const lights=[];for(const [x,z,y] of [[-6.9,3,F+5.1],[-14.1,6.2,Y+2.7]]){cyl(iron,x,y+.6,z,.018,1.3);add(new THREE.TorusGeometry(.58,.025,6,32).rotateX(Math.PI/2),brass,x,y,z);
  for(let i=0;i<6;i++){const a=i/6*Math.PI*2,xx=x+Math.cos(a)*.58,zz=z+Math.sin(a)*.58;cyl(brass,xx,y-.1,zz,.055,.2);add(new THREE.SphereGeometry(.07,8,6),amber,xx,y+.05,zz);}
  if(!mobile||!lights.length){const l=new THREE.PointLight(0xffc58a,mobile?9:14,11,2);l.position.set(x,y-.25,z);root.add(l);lights.push(l);}}
 // Brass number plates, delicate glass rims, ashtrays and old brass clock.
 add(new THREE.TorusGeometry(.32,.035,8,32),brass,-7,F+4.25,9.43);add(new THREE.CircleGeometry(.29,32),ivory,-7,F+4.25,9.435);box(dark,-7,F+4.32,9.45,.012,.16,.012);box(dark,-6.93,F+4.25,9.45,.16,.012,.012);
 for(const [x,z] of [[-4.2,1.6],[-3,7.2],[-14.2,6.2]])for(let i=0;i<3;i++){cyl(brass,x+.25*Math.sin(i*2),F+.81,z+.25*Math.cos(i*2),.042,.11);}
 for(const [material,list] of bins){const p=[],n=[],uv=[];for(const g of list){const a=g.index?g.toNonIndexed():g;for(let i=0;i<a.attributes.position.count;i++){p.push(a.attributes.position.getX(i),a.attributes.position.getY(i),a.attributes.position.getZ(i));n.push(a.attributes.normal.getX(i),a.attributes.normal.getY(i),a.attributes.normal.getZ(i));uv.push(a.attributes.uv?.getX(i)||0,a.attributes.uv?.getY(i)||0);}if(a!==g)a.dispose();g.dispose();}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));gs.add(geo);const m=new THREE.Mesh(geo,material);m.castShadow=!mobile;m.receiveShadow=true;root.add(m);}bins.clear();
 return {group:root,update(t,near){root.visible=near;for(let i=0;i<lights.length;i++)lights[i].intensity=(mobile?9:14)*(1+.035*Math.sin(t*7+i));},dispose(){root.removeFromParent();for(const g of gs)g.dispose();for(const m of ms)m.dispose();for(const t of ts)t.dispose();root.clear();}};
}
