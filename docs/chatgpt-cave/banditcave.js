/** Bandit Falls: procedural cave + outlaw saloon. THREE r170; no assets/addons.
 * Coordinates: entrance (0,0,0), interior extends toward local -Z.
 * position is a Vector3, [x,y,z], or {x,y,z}. All gameplay markers/Box3s are
 * WORLD SPACE snapshots; don't transform group after creation. Box3 collisions
 * are conservative after rotation; use your own capsule controller/grounding.
 * No AI, damage system, persistent economy, poker evaluator, or real-money play.
 */
import * as THREE from 'three';

export function createBanditCave({ position = [0, 0, 0], rotationY = 0, quality = 'high' } = {}) {
  const high = quality !== 'low', group = new THREE.Group(); group.name = 'Bandit Falls';
  if (Array.isArray(position)) group.position.set(position[0], position[1], position[2]);
  else group.position.copy(position);
  // Oval 40m-wide cavern; compress design depth so vault stays within 60m.
  group.rotation.y = rotationY; group.scale.z = .65; group.updateMatrixWorld(true);
  const colliders = [], spawnPoints = [], lootPoints = [], interactions = [];
  const geometries = new Set(), materials = new Set(), textures = new Set();
  const staticBatches = new Map(), instanceBatches = new Map(), localColliders = [];
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler();
  const V = new THREE.Vector3(), S = new THREE.Vector3(), color = new THREE.Color();
  const tmp = new THREE.Vector3(), entrance = new THREE.Vector3().applyMatrix4(group.matrixWorld);
  let seed = 74817, time = 0, disposed = false, challenge = false, keyDropped = false;
  const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
  const geo = g => (geometries.add(g), g), mat = m => (materials.add(m), m);
  const boxG = geo(new THREE.BoxGeometry(1, 1, 1));
  const cylG = geo(new THREE.CylinderGeometry(1, 1, 1, high ? 12 : 8));
  const sphereG = geo(new THREE.SphereGeometry(1, high ? 12 : 8, high ? 8 : 5));
  const coneG = geo(new THREE.ConeGeometry(1, 1, high ? 10 : 6, 3));
  const planeG = geo(new THREE.PlaneGeometry(1, 1));
  const standard = (c, roughness = .85, metalness = 0) => mat(new THREE.MeshStandardMaterial({ color: c, roughness, metalness }));
  const wood = standard(0x493022), iron = standard(0x343332, .6, .65), gold = standard(0xe8b14b, .3, .8);
  const cloth = standard(0x632b32), leather = standard(0x282620), glass = standard(0x27664d, .25, .2);
  const skin = standard(0xc18a65), waterDark = standard(0x123435, .18, .3);
  const glow = mat(new THREE.MeshBasicMaterial({ color: 0xffbd61, fog: true }));
  const rock = mat(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .96, side: THREE.DoubleSide }));
  // Local triplanar-style procedural grain: no textures, derivatives or assets.
  rock.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 caveP,caveN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ncaveP=position; caveN=normal;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 caveP,caveN;
      float cg(vec2 p){return .5+.25*sin(p.x*3.1+sin(p.y*2.7))+.25*sin(p.y*5.3+sin(p.x*4.2));}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      vec3 w=pow(abs(normalize(caveN)),vec3(4.));w/=max(dot(w,vec3(1.)),.001);
      float g=dot(w,vec3(cg(caveP.yz*2.),cg(caveP.zx*2.),cg(caveP.xy*2.)));
      float strata=.92+.08*sin(caveP.y*8.+g*3.);diffuseColor.rgb*=mix(.72,1.14,g)*strata;`);
  };
  rock.customProgramCacheKey = () => 'bandit-rock-v1';
  const rockParts = { p: [], n: [], c: [], uv: [] };
  function pushGeometry(g, material, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
    const src = g.index ? g.toNonIndexed() : g.clone();
    E.set(rx, ry, rz); Q.setFromEuler(E); M.compose(V.set(x, y, z), Q, S.set(sx, sy, sz)); src.applyMatrix4(M);
    let b = staticBatches.get(material); if (!b) staticBatches.set(material, b = { p: [], n: [], uv: [], c: [] });
    const p = src.attributes.position, n = src.attributes.normal, uv = src.attributes.uv;
    for (let i = 0; i < p.count; i++) { b.p.push(p.getX(i), p.getY(i), p.getZ(i)); b.n.push(n.getX(i), n.getY(i), n.getZ(i)); b.uv.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0); }
    src.dispose();
  }
  function inst(g, material, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
    const k = g.uuid + material.uuid; let b = instanceBatches.get(k);
    if (!b) instanceBatches.set(k, b = { g, material, matrices: [] });
    E.set(rx, ry, rz); Q.setFromEuler(E); M.compose(V.set(x, y, z), Q, S.set(sx, sy, sz)); b.matrices.push(M.clone());
  }
  function solid(x, y, z, sx, sy, sz, material = wood) { pushGeometry(boxG, material, x, y, z, sx, sy, sz); }
  function collider(x, y, z, sx, sy, sz) { const b = new THREE.Box3(new THREE.Vector3(x - sx / 2, y - sy / 2, z - sz / 2), new THREE.Vector3(x + sx / 2, y + sy / 2, z + sz / 2)); localColliders.push(b); return b; }
  function floor(x, z, sx, sz, y = 0, material = rock) { solid(x, y - .3, z, sx, .6, sz, material); collider(x, y - .3, z, sx, .6, sz); }
  function world(x, y, z) { return new THREE.Vector3(x, y, z).applyMatrix4(group.matrixWorld); }
  function marker(id, type, x, y, z, extra = {}) { const a = { id, type, position: world(x, y, z), radius: 2.4, ...extra }; interactions.push(a); return a; }
  function rough(x, y, z) { return .22 * Math.sin(x * 1.37 + Math.sin(z * .61)) + .15 * Math.sin(y * 2.11 + z * 1.71) + .07 * Math.cos(x * 4.2 - z * 2.4); }
  function triangle(a, b, c) {
    for (const p of [a, b, c]) { rockParts.p.push(p[0], p[1], p[2]); const k = rough(p[0], p[1], p[2]); color.setRGB(.25 + k * .12, .23 + k * .09, .20 + k * .06); rockParts.c.push(color.r, color.g, color.b); rockParts.uv.push(0, 0); }
  }
  // Elliptic arched tunnel, with open ends. Separate conservative wall/floor boxes.
  function tunnel(points, width = 5, height = 5) {
    const rings = [], sides = high ? 14 : 8;
    for (let i = 0; i < points.length; i++) {
      const p = points[i], a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
      const yaw = Math.atan2(b[0] - a[0], b[1] - a[1]), cx = Math.cos(yaw), cz = -Math.sin(yaw), ring = [];
      for (let s = 0; s <= sides; s++) { const t = s / sides * Math.PI, r = rough(p[0] + s, 2, p[1]) * .4, d = Math.cos(t) * (width / 2 + r); ring.push([p[0] + cx * d, Math.sin(t) * height + r * Math.sin(t), p[1] + cz * d]); }
      rings.push(ring);
      if (i) {
        const prev = points[i - 1], dx = p[0] - prev[0], dz = p[1] - prev[1], length = Math.hypot(dx, dz), mx = (p[0] + prev[0]) / 2, mz = (p[1] + prev[1]) / 2;
        floor(mx, mz, width + Math.abs(dx), length + width * .4);
        for (const sign of [-1, 1]) { const ox = cx * sign * (width / 2 + .5), oz = cz * sign * (width / 2 + .5); collider(mx + ox, height / 2, mz + oz, Math.abs(cx) * .6 + Math.abs(dx), height, Math.abs(cz) * .6 + Math.abs(dz)); }
        for (let s = 0; s < sides; s++) { triangle(rings[i - 1][s], ring[s], ring[s + 1]); triangle(rings[i - 1][s], ring[s + 1], rings[i - 1][s + 1]); }
      }
    }
  }
  tunnel([[0, 0], [0, -5], [1, -10], [4, -15], [4, -20], [1, -25], [0, -29]], 5.6, 5.2);
  floor(0, -49, 40, 40); // cavern: 40 m wide, 12 m high
  // Circular chamber walls: doorways at front / left / right / rear.
  const sectors = 64, levels = high ? 9 : 5;
  for (let i = 0; i < sectors; i++) {
    const a = i / sectors * Math.PI * 2, b = (i + 1) / sectors * Math.PI * 2, mid = (a + b) / 2;
    const door = Math.abs(Math.sin(mid)) < .16 || Math.abs(Math.cos(mid)) < .16;
    for (let j = 0; j < levels; j++) {
      const y0 = j / levels * 10, y1 = (j + 1) / levels * 10;
      if (door && y0 < 5) continue;
      const pt = (ang, y) => { const r = 20 + rough(Math.cos(ang) * 20, y, Math.sin(ang) * 20) * 1.8; return [Math.sin(ang) * r, y, -49 + Math.cos(ang) * r]; };
      triangle(pt(a, y0), pt(b, y0), pt(b, y1)); triangle(pt(a, y0), pt(b, y1), pt(a, y1));
    }
    if (!door) collider(Math.sin(mid) * 20, 5, -49 + Math.cos(mid) * 20, Math.abs(Math.cos(mid)) * 2.5 + .5, 10, Math.abs(Math.sin(mid)) * 2.5 + .5);
    // Vaulted roof rises from 10 to 12 m; shared center apex.
    const rimA = [Math.sin(a) * 20, 10, -49 + Math.cos(a) * 20], rimB = [Math.sin(b) * 20, 10, -49 + Math.cos(b) * 20];
    triangle(rimA, rimB, [0, 12, -49]);
  }
  tunnel([[-19, -49], [-24, -49], [-29, -49]], 5.2, 4.8);
  tunnel([[19, -49], [24, -49], [29, -49]], 5.2, 4.8);
  tunnel([[0, -68], [0, -73], [0, -77]], 5.2, 4.8);
  function room(cx, cz, w, d, doorway, name) {
    floor(cx, cz, w, d);
    for (const side of [-1, 1]) {
      if (doorway === 'x' && side === (cx < 0 ? 1 : -1)) {
        for (const s of [-1, 1]) { solid(cx + side * w / 2, 2.5, cz + s * (d / 4 + 1.3), .7, 5, d / 2 - 2.6, rock); collider(cx + side * w / 2, 2.5, cz + s * (d / 4 + 1.3), .7, 5, d / 2 - 2.6); }
      } else { solid(cx + side * w / 2, 2.5, cz, .7, 5, d, rock); collider(cx + side * w / 2, 2.5, cz, .7, 5, d); }
      if (doorway === 'z' && side === 1) {
        for (const s of [-1, 1]) { solid(cx + s * (w / 4 + 1.3), 2.5, cz + d / 2, w / 2 - 2.6, 5, .7, rock); collider(cx + s * (w / 4 + 1.3), 2.5, cz + d / 2, w / 2 - 2.6, 5, .7); }
      } else { solid(cx, 2.5, cz + side * d / 2, w, 5, .7, rock); collider(cx, 2.5, cz + side * d / 2, w, 5, .7); }
    }
    solid(cx, 5.1, cz, w, .7, d, rock); group.userData[name] = world(cx, 0, cz);
  }
  room(-34, -49, 10, 12, 'x', 'bunkRoom'); room(34, -49, 10, 12, 'x', 'armory'); room(0, -83, 12, 12, 'z', 'vault');
  // Irregular rock formations, all repeated crystals in one instanced draw.
  for (let i = 0; i < (high ? 100 : 40); i++) {
    const a = rand() * Math.PI * 2, r = 6 + rand() * 13, x = Math.sin(a) * r, z = -49 + Math.cos(a) * r, h = 1 + rand() * 3;
    inst(coneG, rock, x, 10.2 - h / 2, z, .3 + rand() * .6, h, .3 + rand() * .6, Math.PI);
    if (i % 3 === 0 && r > 15) { inst(coneG, rock, x, h / 2, z, .6, h, .6); collider(x, h / 2, z, 1, h, 1); }
  }
  // Bunks, crates, barrels, armory racks, rough timber scaffold and lookout.
  for (let i = 0; i < 6; i++) {
    const x = -37 + i % 2 * 6, z = -53 + Math.floor(i / 2) * 4;
    for (const y of [.65, 2.25]) { inst(boxG, wood, x, y, z, 2, .2, 3); inst(boxG, cloth, x, y + .15, z, 1.8, .18, 2.8); }
    for (const dx of [-.9, .9]) for (const dz of [-1.4, 1.4]) inst(boxG, wood, x + dx, 1.5, z + dz, .12, 3, .12);
    collider(x, 1.5, z, 2, 3, 3);
  }
  for (let i = 0; i < 24; i++) { const x = i < 12 ? 30 + rand() * 7 : -16 + rand() * 4, z = i < 12 ? -53 + rand() * 8 : -58 + rand() * 7;
    if (i % 2) { inst(cylG, wood, x, .65, z, .55, 1.3, .55); for (const y of [.2, 1.05]) inst(cylG, iron, x, y, z, .57, .09, .57); }
    else { inst(boxG, wood, x, .6, z, 1.1, 1.2, 1.1); for (const d of [-.38, .38]) inst(boxG, iron, x + d, .6, z, .06, 1.22, 1.13); }
    collider(x, .6, z, 1.15, 1.2, 1.15);
  }
  solid(34, 1, -54, 7, .3, 1); collider(34, .6, -54, 7, 1.2, 1);
  for (let i = 0; i < 7; i++) { inst(boxG, wood, 31 + i, 1.7, -54, .15, 1.5, .28, 0, 0, -.12); inst(cylG, iron, 31 + i, 2.6, -54, .045, 1.2, .045, 0, 0, -.12); }
  floor(-13, -39, 9, 7, 3.6, wood); // climb hook supplies access to the lookout
  for (const x of [-17, -9]) for (const z of [-42, -36]) inst(boxG, wood, x, 1.8, z, .35, 3.6, .35);
  for (const x of [-17, -9]) inst(boxG, wood, x, 4.2, -39, .12, 1.2, 7);
  function ladder(x, z, h) { for (const s of [-1, 1]) inst(boxG, wood, x + s * .48, h / 2, z, .12, h, .16); for (let y = .3; y < h; y += .35) inst(cylG, wood, x, y, z, .06, 1.1, .06, 0, 0, Math.PI / 2); marker('ladder', 'climb', x, 0, z, { destination: world(x, h + .2, z - 1) }); }
  ladder(-12, -35.4, 3.9);
  for (let i = 0; i < 12; i++) { inst(boxG, wood, 7, .05, -32 - i * 1.5, 2.4, .12, .25); for (const x of [6.25, 7.75]) inst(boxG, iron, x, .15, -32 - i * 1.5, .10, .15, 1.5); }
  solid(7, .75, -45, 1.8, 1.1, 2.5, iron); collider(7, .6, -45, 1.8, 1.2, 2.5);
  // Saloon is rough furniture inside exposed rock, not a building.
  floor(8, -58, 15, 6, .12, wood); solid(8, 1.15, -58, 12, .3, 1.3); solid(8, .55, -58, 11.6, 1, .9);
  collider(8, .6, -58, 12, 1.2, 1.3);
  for (let i = 0; i < 16; i++) { const x = 2.8 + i * .68; inst(cylG, glass, x, 1.55, -58, .095, .45, .095); inst(cylG, glass, x, 1.85, -58, .045, .2, .045); }
  marker('bar', 'drink', 8, .2, -56, { price: 3, currency: 'fictional-coins', effect: 'whiskey', duration: 12 });
  for (let i = 0; i < 5; i++) { const x = 3 + i * 2.3; inst(cylG, wood, x, .8, -55, .38, .15, .38); inst(cylG, iron, x, .4, -55, .08, .8, .08); }
  function table(x, z, poker = false) { inst(cylG, wood, x, .9, z, poker ? 2.2 : 1.3, .18, poker ? 1.5 : 1.3); inst(cylG, wood, x, .45, z, .2, .9, .2);
    collider(x, .5, z, poker ? 4.4 : 2.6, 1, poker ? 3 : 2.6);
    if (poker) { inst(cylG, cloth, x, 1.005, z, 2.02, .02, 1.32);
      for (let j = 0; j < 8; j++) { const a = j / 8 * Math.PI * 2; inst(boxG, glow, x + Math.cos(a) * 1.4, 1.03, z + Math.sin(a) * .7, .17, .015, .25, 0, a); inst(cylG, gold, x + Math.cos(a) * 1.15, 1.06, z + Math.sin(a) * .5, .08, .1, .08); }
    }
  }
  table(-5, -48, true); table(12, -44); table(-8, -57);
  marker('poker', 'poker', -5, 0, -45.4, { cameraPosition: world(-5, 1.4, -45.6), cameraTarget: world(-5, 1.02, -48), currency: 'fictional-coins' });
  // Small cabaret stage: adult, fully clothed stylized dancers, animated as instances.
  floor(-11, -60, 7, 4, .45, wood);
  const dancers = geo(new THREE.CylinderGeometry(.24, .5, .9, 10)), dancerParts = [];
  for (let i = 0; i < 3; i++) { const x = -13 + i * 2, z = -60;
    inst(coneG, cloth, x, 1.5, z, .5, 1.2, .5); inst(sphereG, skin, x, 2.35, z, .21, .24, .21); inst(sphereG, leather, x, 2.5, z + .07, .23, .14, .2);
    for (const s of [-1, 1]) { inst(cylG, skin, x + s * .33, 1.95, z, .065, .65, .065, 0, 0, s * .4); inst(cylG, leather, x + s * .16, .85, z, .1, .7, .1); }
    dancerParts.push({ x, z, phase: i * 2 });
    marker('dance-' + i, 'dance', x, .45, z + 1.7, { price: 5, duration: 15, adult: true, currency: 'fictional-coins', cameraPosition: world(x, 1.6, z + 3), cameraTarget: world(x, 1.65, z) });
  }
  // Swaying skirt fringe: a single instanced draw; static bodies remain in batches.
  const danceMesh = new THREE.InstancedMesh(dancers, cloth, 3); group.add(danceMesh);
  // Posters/signs: one procedural CanvasTexture atlas, one merged material.
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (canvas) { canvas.width = 1024; canvas.height = 256; const ctx = canvas.getContext('2d');
    if (ctx) { const labels = ['WANTED\nTHE BLACK GULCH GANG\n$500 REWARD', 'BANDIT FALLS\nWHISKEY • POKER • CABARET\nLEAVE YOUR TROUBLE OUTSIDE', 'THE VAULT\nONE KEY. NO MERCY.\nDEFEAT EVERY GUARD', 'LUCKY STRIKE\nFICTIONAL COINS ONLY\nPULL YOUR LUCK'];
      for (let i = 0; i < 4; i++) { ctx.fillStyle = i === 1 ? '#291c16' : '#bca16f'; ctx.fillRect(i * 256, 0, 256, 256); ctx.strokeStyle = '#65462b'; ctx.strokeRect(i * 256 + 9, 9, 238, 238); ctx.fillStyle = i === 1 ? '#e8bb68' : '#33231b'; ctx.textAlign = 'center'; labels[i].split('\n').forEach((s, j) => { ctx.font = j ? 'bold 12px serif' : 'bold 25px serif'; ctx.fillText(s, i * 256 + 128, 65 + j * 48, 230); }); }
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; textures.add(texture);
      const paper = mat(new THREE.MeshStandardMaterial({ map: texture, roughness: 1, side: THREE.DoubleSide }));
      const poster = (i, x, y, z, w, h, ry = 0) => { const g = planeG.clone(); const u = g.attributes.uv; for (let j = 0; j < u.count; j++) u.setX(j, (u.getX(j) + i) / 4); pushGeometry(g, paper, x, y, z, w, h, 1, 0, ry); g.dispose(); };
      poster(1, 8, 3.5, -61, 6, 2); poster(0, -17, 2, -43, 1.4, 1.7, Math.PI / 2); poster(2, 0, 4.1, -76.5, 3, 1); poster(3, 16, 3, -54, 2, 1.2, -Math.PI / 2);
    }
  }
  // Three slots: cosmetic reels + fair local fictional-coin result hook, no economy writes.
  const slots = [];
  for (let i = 0; i < 3; i++) { const x = 16, z = -51 + i * 2;
    solid(x, 1, z, 1.25, 2, 1.2); solid(x, 1.45, z + .63, 1.1, .65, .08, iron); collider(x, 1, z, 1.25, 2, 1.2);
    for (let j = 0; j < 3; j++) inst(cylG, gold, x - .32 + j * .32, 1.45, z + .7, .13, .22, .13, Math.PI / 2);
    inst(cylG, iron, x + .8, 1.4, z, .05, .65, .05, 0, 0, -.5); inst(sphereG, cloth, x + .95, 1.7, z, .12, .12, .12);
    slots.push(marker('slots-' + i, 'slots', x, 0, z + 1.7, { price: 1, currency: 'fictional-coins' }));
  }
  // Torch baskets and a central campfire. Five point lights + one ambient = six.
  const ambient = new THREE.AmbientLight(0x667477, .19); group.add(ambient);
  const lightData = [], fires = [];
  function fire(x, y, z, intensity, distance, camp = false) {
    const l = new THREE.PointLight(0xffa653, intensity, distance, 2); l.position.set(x, y + .65, z); l.castShadow = false; // default: no six-face point-shadow render; shafts carry the mood
    if (l.castShadow) { l.shadow.mapSize.set(512, 512); l.shadow.camera.near = .2; l.shadow.camera.far = distance; l.shadow.bias = -.001; }
    group.add(l); lightData.push({ l, base: intensity, phase: rand() * 6 }); fires.push({ x, y, z });
    if (camp) for (let i = 0; i < 8; i++) inst(cylG, wood, x, y - .2, z, .16, 2, .16, Math.PI / 2, i * .8);
    else inst(cylG, iron, x, y - .4, z, .13, .9, .13);
  }
  fire(0, 2, -8, 23, 13); fire(4, 2, -21, 25, 15); fire(0, .3, -48, 65, 25, true); fire(8, 2.5, -58, 45, 23); fire(0, 2, -81, 30, 14);
  const flameMat = mat(new THREE.MeshBasicMaterial({ color: 0xffa53e, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false, fog: true }));
  const flameMesh = new THREE.InstancedMesh(coneG, flameMat, fires.length); group.add(flameMesh);
  const emberCount = high ? 70 : 28, emberMesh = new THREE.InstancedMesh(sphereG, glow, emberCount); group.add(emberMesh);
  const emberData = new Float32Array(emberCount * 4); for (let i = 0; i < emberCount; i++) { emberData[i * 4] = rand() * 6.28; emberData[i * 4 + 1] = rand(); emberData[i * 4 + 2] = .6 + rand(); emberData[i * 4 + 3] = rand() * 5; }
  if (high) { const shaftMat = mat(new THREE.MeshBasicMaterial({ color: 0xeaba79, side: THREE.DoubleSide, transparent: true, opacity: .025, depthWrite: false, blending: THREE.AdditiveBlending, fog: true }));
    for (const f of fires) pushGeometry(coneG, shaftMat, f.x, f.y + 2, f.z, 1.2, 4, 1.2, Math.PI);
  }
  // Waterfall: animated, fog-compatible procedural sheets, no framebuffer sampling.
  const waterUniforms = { caveTime: { value: 0 } };
  const waterfallMat = mat(new THREE.MeshStandardMaterial({ color: 0x83cbd0, roughness: .22, metalness: .15, transparent: true, opacity: .65, side: THREE.DoubleSide, depthWrite: false }));
  waterfallMat.onBeforeCompile = sh => { Object.assign(sh.uniforms, waterUniforms);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float caveTime; varying vec2 fallUV;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nfallUV=uv; transformed.z+=sin(position.x*4.+caveTime*2.)*.12;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float caveTime; varying vec2 fallUV;')
      .replace('#include <color_fragment>', `#include <color_fragment>
      float s=sin(fallUV.x*180.+sin(fallUV.y*23.+caveTime*7.)*2.);
      float f=.5+.5*sin(fallUV.y*90.+caveTime*22.+s*2.);
      diffuseColor.rgb*=.75+.4*f;diffuseColor.a*=smoothstep(0.,.06,fallUV.x)*smoothstep(0.,.06,1.-fallUV.x)*(.45+.55*f);`);
  };
  waterfallMat.customProgramCacheKey = () => 'bandit-waterfall-v1';
  const sheetG = geo(new THREE.PlaneGeometry(12, 16, high ? 32 : 12, high ? 24 : 8));
  const sheet = new THREE.Mesh(sheetG, waterfallMat); sheet.position.set(0, 7.8, .9); sheet.renderOrder = 2; group.add(sheet);
  const poolG = geo(new THREE.CircleGeometry(8, 40)); const pool = new THREE.Mesh(poolG, waterDark); pool.rotation.x = -Math.PI / 2; pool.position.set(0, -.09, 3.5); group.add(pool);
  floor(0, 4, 17, 12, -.4);
  const mistMat = mat(new THREE.MeshBasicMaterial({ color: 0xc8e1da, transparent: true, opacity: .08, blending: THREE.AdditiveBlending, depthWrite: false, fog: true }));
  const mistMesh = new THREE.InstancedMesh(sphereG, mistMat, high ? 16 : 7); group.add(mistMesh);
  // Vault gate, key and chests. Gate is movable; its Box3 stays in returned array.
  const gate = new THREE.Group(); gate.position.set(0, 0, -76); group.add(gate);
  const gateBars = new THREE.InstancedMesh(boxG, iron, 15); gate.add(gateBars);
  for (let i = 0; i < 15; i++) { E.set(0, 0, 0); Q.setFromEuler(E); M.compose(V.set(-2.4 + i * .343, 2.2, 0), Q, S.set(.09, 4.4, .12)); gateBars.setMatrixAt(i, M); }
  const gateCollider = collider(0, 2.2, -76, 5.2, 4.4, .45);
  const gateHook = marker('vault-gate', 'gate', 0, 0, -74.3, { locked: true });
  const keyGroup = new THREE.Group(); keyGroup.visible = false; group.add(keyGroup);
  const keyG = geo(new THREE.TorusGeometry(.16, .045, 6, 12)), keyRing = new THREE.Mesh(keyG, gold); keyGroup.add(keyRing);
  const stem = new THREE.Mesh(boxG, gold); stem.position.y = -.32; stem.scale.set(.08, .5, .08); keyGroup.add(stem);
  const keyHook = marker('vault-key', 'key', 0, 1, -48, { active: false });
  for (let i = 0; i < 3; i++) { const x = -3 + i * 3, z = -85;
    inst(boxG, wood, x, .55, z, 1.8, 1.1, 1.1); for (const s of [-1, 1]) inst(boxG, gold, x + s * .6, .55, z, .12, 1.12, 1.12);
    collider(x, .55, z, 1.8, 1.1, 1.1);
    const l = marker('chest-' + i, 'chest', x, 0, z + 1.3, { locked: true, opened: false }); lootPoints.push(l);
  }
  for (let i = 0; i < 100; i++) inst(sphereG, gold, (rand() - .5) * 9, .1 + rand() * .3, -80 - rand() * 6, .09 + rand() * .15, .04, .09 + rand() * .15);
  const guards = [[-8,-38],[9,-38],[-12,-48],[12,-48],[-7,-55],[4,-54],[-13,-39],[31,-49],[-33,-49],[0,-72]];
  const defeated = new Set();
  guards.forEach((p, i) => spawnPoints.push({ id: 'bandit-' + i, position: world(p[0], i === 6 ? 3.6 : 0, p[1]), rotationY: rotationY + Math.PI, role: i === 6 ? 'lookout' : i === 9 ? 'captain' : 'guard' }));
  // Fold small mixed-primitive decorative batches into existing material batches.
  // Wood props, bottles, and rock formations remain instanced.
  for (const [k, b] of instanceBatches) {
    if (![gold, iron, skin, leather, cloth].includes(b.material)) continue;
    for (const matrix of b.matrices) {
      const g = b.g.clone(); g.applyMatrix4(matrix);
      pushGeometry(g, b.material, 0, 0, 0, 1, 1, 1); g.dispose();
    }
    instanceBatches.delete(k);
  }
  // Finalize exactly one mesh per static material and one draw per repeated batch.
  function finish(b, material, vertexColors = false) {
    const g = geo(new THREE.BufferGeometry()); g.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3));
    if (b.n.length) g.setAttribute('normal', new THREE.Float32BufferAttribute(b.n, 3)); else g.computeVertexNormals();
    g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
    if (vertexColors) g.setAttribute('color', new THREE.Float32BufferAttribute(b.c, 3));
    g.computeBoundingSphere(); const mesh = new THREE.Mesh(g, material); mesh.receiveShadow = true; mesh.castShadow = high && material !== flameMat; group.add(mesh);
  }
  // Rock-colored static floors/room boxes require color attributes, too.
  const sb = staticBatches.get(rock); if (sb) { for (let i = 0; i < sb.p.length; i += 3) { const k = rough(sb.p[i], sb.p[i+1], sb.p[i+2]); sb.c.push(.25 + k*.12,.23 + k*.09,.20 + k*.06); } }
  finish(rockParts, rock, true);
  for (const [material, b] of staticBatches) finish(b, material, material === rock);
  for (const b of instanceBatches.values()) { const mesh = new THREE.InstancedMesh(b.g, b.material, b.matrices.length);
    for (let i = 0; i < b.matrices.length; i++) mesh.setMatrixAt(i, b.matrices[i]);
    if (b.material === rock) { // instanceColor supplies vertex color for shared cone geometry
      for (let i = 0; i < mesh.count; i++) mesh.setColorAt(i, color.setRGB(.28,.25,.21));
    }
    mesh.castShadow = high; mesh.receiveShadow = true; mesh.computeBoundingSphere(); group.add(mesh);
  }
  for (const b of localColliders) colliders.push(b.applyMatrix4(group.matrixWorld));
  // Dynamic bounds are conservative and fixed. Never recomputed during update.
  for (const mesh of [danceMesh, flameMesh, emberMesh, mistMesh]) { mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 5, -43), 75); }
  const keyOrigin = new THREE.Vector3(), keyLocal = new THREE.Vector3(0,1,-48);
  const inverseWorld = group.matrixWorld.clone().invert();
  const result = { group, colliders, spawnPoints, lootPoints, interactions, update, dispose,
    state: { challenge: false, remainingGuards: guards.length, keyDropped: false, hasKey: false, vaultOpen: false },
    startChallenge() { if (disposed || challenge) return false; challenge = true; result.state.challenge = true; return true; },
    // Call ONLY after your combat authority confirms this guard's death.
    guardDefeated(id, deathPosition) {
      if (disposed || !challenge || !spawnPoints.some(p => p.id === id) || defeated.has(id)) return false;
      defeated.add(id); result.state.remainingGuards = guards.length - defeated.size;
      if (!result.state.remainingGuards && !keyDropped) { keyDropped = result.state.keyDropped = true;
        if (deathPosition) keyLocal.copy(deathPosition).applyMatrix4(inverseWorld);
        else keyLocal.set(0,1,-48);
        keyLocal.y += .5; keyGroup.position.copy(keyLocal); keyOrigin.copy(keyLocal); keyGroup.visible = true;
        keyHook.position.copy(keyLocal).applyMatrix4(group.matrixWorld); keyHook.active = true;
      } return true;
    },
    // Caller checks proximity and handles coin deduction / persistence / replication.
    interact(id, playerWorldPosition) {
      if (disposed) return { ok:false, reason:'disposed' };
      const h = interactions.find(p => p.id === id); if (!h) return {ok:false,reason:'unknown'};
      if (!playerWorldPosition || playerWorldPosition.distanceToSquared(h.position) > h.radius*h.radius) return {ok:false,reason:'too-far'};
      if (id === 'vault-key') { if (!keyHook.active) return {ok:false,reason:'no-key'}; keyHook.active=false; keyGroup.visible=false; result.state.hasKey=true; return {ok:true,type:'key'}; }
      if (id === 'vault-gate') { if (!result.state.hasKey) return {ok:false,reason:'defeat-all-guards-and-collect-key'}; result.state.vaultOpen=true; gateHook.locked=false; gateCollider.makeEmpty(); for (const l of lootPoints) l.locked=false; return {ok:true,type:'gate'}; }
      if (h.type === 'chest') { if (h.locked || h.opened) return {ok:false,reason:h.opened?'already-open':'locked'}; h.opened=true; return {ok:true,type:'loot',chestId:id}; }
      if (h.type === 'slots') { const reels=[Math.floor(rand()*6),Math.floor(rand()*6),Math.floor(rand()*6)]; const payout = reels[0]===reels[1]&&reels[1]===reels[2]?20:reels[0]===reels[1]?2:0; return {ok:true,type:'slots',price:1,reels,payout,currency:'fictional-coins'}; }
      return {ok:true,type:h.type,hook:h};
    }
  };
  group.userData.instructions = 'Fight guards → report confirmed deaths → collect dropped key → unlock gate → open chests. Interactions/economy/AI are host-game responsibilities.';
  function update(dt, camera, playerPos) {
    if (disposed) return; time += Math.max(0, Math.min(Number.isFinite(dt) ? dt : 0, .1));
    group.visible = !!playerPos && playerPos.distanceToSquared(entrance) <= 3600;
    if (!group.visible) return;
    waterUniforms.caveTime.value = time;
    for (let i=0;i<lightData.length;i++) { const d=lightData[i]; d.l.intensity=d.base*(.9+.07*Math.sin(time*9+d.phase)+.04*Math.sin(time*17+d.phase*2)); }
    Q.identity();
    for (let i=0;i<fires.length;i++) { const f=fires[i], k=1+.13*Math.sin(time*11+i); M.compose(V.set(f.x,f.y+.35,f.z),Q,S.set(.23*k,.9*k,.23*k)); flameMesh.setMatrixAt(i,M); } flameMesh.instanceMatrix.needsUpdate=true;
    for (let i=0;i<emberCount;i++) { const j=i*4, life=(time*.35+emberData[j+1])%1, a=emberData[j]+time*.5, r=emberData[j+2]*life;
      M.compose(V.set(Math.cos(a)*r,.7+life*3.5,-48+Math.sin(a)*r),Q,S.setScalar(.022*(1-life))); emberMesh.setMatrixAt(i,M); } emberMesh.instanceMatrix.needsUpdate=true;
    for(let i=0;i<danceMesh.count;i++){const d=dancerParts[i]; E.set(0,Math.sin(time*1.8+d.phase)*.35,Math.sin(time*2.4+d.phase)*.09);Q.setFromEuler(E);M.compose(V.set(d.x,1.2,d.z),Q,S.set(.75,.55,.75));danceMesh.setMatrixAt(i,M);}danceMesh.instanceMatrix.needsUpdate=true;
    Q.identity();for(let i=0;i<mistMesh.count;i++){const a=i*2.399,timeP=(time*.13+i*.17)%1;M.compose(V.set(Math.sin(a)*5,.15+timeP*1.8,1.4+Math.cos(a)*1.6),Q,S.set(1+timeP*1.8,.2+timeP*.5,.7+timeP));mistMesh.setMatrixAt(i,M);}mistMesh.instanceMatrix.needsUpdate=true;
    gate.position.y += ((result.state.vaultOpen?4.7:0)-gate.position.y)*Math.min(1,dt*3);
    if(keyHook.active){keyGroup.position.y=keyOrigin.y+Math.sin(time*2)*.12;keyGroup.rotation.y=time;}
  }
  function dispose() { if(disposed)return;disposed=true;group.removeFromParent();group.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.isLight&&o.shadow)o.shadow.dispose();});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();group.clear();colliders.length=spawnPoints.length=lootPoints.length=interactions.length=0; }
  update(0, null, entrance); group.updateMatrixWorld(true);
  return result;
}

/* Usage (your page must already resolve the bare 'three' import, e.g. import map):
import { createBanditCave } from './banditcave.js';
const cave = createBanditCave({ position: new THREE.Vector3(120,0,-80), quality:'high' });
scene.add(cave.group);
// Spawn your NPCs at cave.spawnPoints[i].position and retain each marker id.
cave.startChallenge();
// After a host-authoritative death: cave.guardDefeated(guardId, npc.position);
// On nearby E/tap: cave.interact(interaction.id, player.position).
// Key and gate require the key; chests can be opened once each.
// Apply drink/dance/camera hooks and fictional-coin transactions in your game.
// Slots return a local sample outcome; authoritative multiplayer must roll on host.
function animate(dt) { cave.update(dt, camera, player.position); }
// Register cave.colliders with your collision system. Ignore Box3.isEmpty().
// Call cave.dispose() and unregister colliders/NPCs when unloading.
*/
