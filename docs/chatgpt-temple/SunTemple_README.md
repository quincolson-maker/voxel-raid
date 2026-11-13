# The Hollow Sun

An original procedural mountain temple for Three.js r170. No assets, add-ons,
DOM APIs, texture downloads, build step, or dependency beyond `three`.

## Install

Copy `suntemple.js` into your game. Reuse the game's existing import map for
`three`; both this module and your game must resolve to the same Three.js copy.
Place the entrance on a mountainside facing local +Z. Excavation/terrain masking
is your game's responsibility: this module does not cut holes in existing terrain.

```js
import * as THREE from 'three';
import { createSunTemple, createSunPyramidWeapon } from './suntemple.js';

const temple = createSunTemple({
  position: new THREE.Vector3(120, 15, -80),
  rotationY: Math.PI / 3,
  quality: 'high', // 'low' reduces geometry, motes and shafts
});
scene.add(temple.group);
registerBoxColliders(temple.colliders); // your controller; ignore empty Box3s

const unsubscribe = temple.onEvent(e => {
  // Event object and Box3s are reused. Copy fields if retaining them.
  if (e.type === 'door_open' && e.phase === 'opening') playGrindingSound(e.id);
  if (e.type === 'trap') playTrapCue(e.id, e.phase);
  if (e.type === 'pickup') {
    // Validate/replicate on your game's authority before applying rewards.
    if (e.id === 'gold_cache') awardPoints(e.playerId, e.value);
    if (e.id === 'sun_pyramid') equipPyramid(e.playerId);
  }
});

// Every frame, before interaction actions:
temple.update(dt, camera, player.position);
// On E/tap, choose a nearby interaction, then:
nearbyHook.activate({ playerId: authenticatedPlayerId, weight: carriedWeight });

// Trap triggers and active conservative hit volumes:
for (const trap of temple.triggers) {
  if (trap.type === 'trap' && !trap.hazard.isEmpty()) {
    // Test your capsule against trap.hazard and handle damage with your own
    // per-trap hit cooldown. No health/damage/economy is implemented here.
  }
}
```

`spawnPoints` contain world positions for your guardians/zombies and boss.
`lootPoints` contain the pickup interaction records. Every marker, trigger and
collider is already world-space. Keep `temple.group` fixed after creation.
Box3s are conservative after rotation; triangle collision is not provided.
Your controller should account for descending slab floors and moving doors.
A ladder/controller/AI/audio/economy/network implementation is not included.

## Walkthrough

1. Activate `entrance` at the exterior seal. The huge divided doors slide open.
2. Enter the left-side mirror chamber before the first inner door. Activate
   `mirror_0`, `mirror_1`, `mirror_2` to rotate each reflector. Follow the beam.
   Developer solution: from initial state, rotate them 2, 5, and 1 times.
3. Survive the boulder warning and dart wall; cross the narrow chasm bridge.
   Dust precedes trap activation. All four traps recover and rearm after exit.
4. Read the dot frieze. Step on glyph tiles in order 1, 3, 2, 4 (indices 0,2,1,3).
   `glyph_reset` clears an incorrect partial sequence.
5. In the right alcove, count the twelve gold studs. Activate `counterweight`
   with `{weight:12}` after your inventory system validates the substitute.
6. With all three puzzles solved, the sanctum doors open. `gold_cache` emits
   a pickup value of exactly 100000, once per nonempty string playerId.
7. Activate `hidden_altar`, wait for the rock seal to rise, then claim
   `sun_pyramid`. This is also deduplicated per player ID.

Claims are stored in memory for this module instance. Persist and reconcile
player claims in your game so rebuilding/reconnecting cannot grant them twice.
Puzzles/traps require host-authoritative integration for multiplayer; the module
contains no networking or automatic inventory/reward mutation.

## Pyramid weapon

```js
const gun = createSunPyramidWeapon();
scene.add(gun.mesh); // world-space FX: root must have an identity parent transform
// Attach/position gun.mesh.userData.model separately for the held model.
let ticket = null;
let lastShot = 0;

// On trigger: returns null if charging/firing/cooling down.
ticket = gun.fire(muzzleWorld, aimDirectionWorld);

// In the frame loop:
gun.update(dt);
if (ticket?.ready && ticket.shotId !== lastShot) {
  lastShot = ticket.shotId;
  const hit = castYourWorldRay(ticket.ray, ticket.maxDistance);
  if (hit) {
    gun.setImpact(hit.point); // clamps the visible beam/flare immediately
    applyYourWeaponDamage(hit);
  }
}
```

Charge: 0.55 s; beam pulse: 0.26 s; cooldown after pulse: 1.1 s; range: 90 m.
`fire()` returns a reused shot ticket. Read `ready` immediately after `update()`.
The ray is valid for damage only once the charge completes. Direction/origin
are captured at trigger time. Shimmer is a procedural wavy glow envelope, not
screen-space background refraction. There is no damage number or damage rule.

## Appearance and budget

Use your scene's existing fog, tone mapping, environment and exposure. The
module does not overwrite scene settings. Gold benefits from an environment
map if your game already has one; none is downloaded or generated here.

- Temple: 22 mesh objects/base draws with single-pass translucent effects.
- Standalone weapon: 6 meshes; temple + weapon at most 28 base draws.
- Six temple lights total: five warm points and one dark ambient light.
- No real-time shadows, including low quality; translucent cones suggest shafts.
- Approximately 71k high / 28k low submitted triangles with all objects counted.
- Static stone/metal/gold batches; instanced pillars, doors, bars and particles.
- Explicit per-frame vectors/matrices/events are preallocated. User callbacks
  can allocate; the module cannot control allocations inside Three.js/browser.
- Interior pauses/hides beyond 80 m from the entrance. The designed temple fits
  within that radius. Do not move the root after construction.

Counts are structural estimates, not measured GPU timings. Tests checked syntax,
finite geometry, draw/light budgets, transformed marker/proximity behavior,
all three puzzles, all four trap cycles, per-player pickup deduplication,
weapon timing/ray/impact, culling and disposal. WebGL shader compilation and
visual appearance have not been verified in a browser.

```js
// Unload:
unsubscribe();
unregisterBoxColliders(temple.colliders); // do before dispose clears the array
unloadYourSpawnedNPCs();
temple.dispose();
gun.dispose();
```
