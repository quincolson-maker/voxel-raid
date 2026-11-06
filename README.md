# Voxel Raid: Bastion Breakers (prototype)
Original voxel FPS base-raid game. All names, troops, defenses, and materials are original. No third-party game assets are used.

Run it: serve this folder statically (`python3 -m http.server`) and open `index.html`. Three.js r170 is bundled in `three.module.js`.

## Controls
WASD move · Mouse look (click to lock the pointer) · Space jump · Shift sprint · LMB shoot (this also breaks blocks) · RMB place the selected piece
Q cycle piece (Wall / Ramp / Floor; in Defend mode also Bolt Spire, Quake Mortar, Snapjaw Trap) · Z cycle material · R reload · G skip build phase (dev) · Esc release mouse
URL dev params: `?auto=attack|defend&layout=0-3&build=SECONDS&dev=1` (with dev=1, G also ends the raid)

## Match flow
- **Queue Match** gives you Attack or Defend at random. You can also pick a role yourself. Bots fill both teams.
- **Attack:** the build phase defaults to 300 s and can be changed in the menu. During it the base is shielded and you can't build within 26 blocks of the center. Build pieces from Timber (40 HP), Cobble (100 HP), or Plate (220 HP). The raid phase then lasts 3:00. Your bot raiders (Skirmishers, Rampart Breakers) fight Wardens, Bolt Spires, Quake Mortars, Skyneedles, and hidden Snapjaw traps.
- **Crests (stars):** you get one for ≥50% destruction, one for toppling the Heartstone Keep (≥75% of its blocks), and one for 100%.
- **Defend:** a prep phase of up to 90 s where you spend 14 Gears on defenses and use materials for walls. Then 3 waves of raiders come from every side.
- Every block of a base is destructible, so you can breach from any side.

## Layouts (`layouts.js`, data-driven; add one by appending to the array)
Citadel Ring (centralized core), Honeycomb Grid (compartments), Sentinel Spread (spread-out long-range defenses), Gauntlet Funnel (funnel and traps).

## Tech
- 96×24×96 voxel grid split into 16×16 chunk meshes with hidden faces culled. Only changed chunks are rebuilt.
- Unlit vertex colors with baked face shading. Damaged blocks render darker.
- Bots use greedy steering with step-up. When attackers are blocked they break the wall in front of them. Breakers blow themselves up on walls.

## Roadmap
**Graphics:** texture atlas and greedy meshing, ambient occlusion, then lit materials with shadows. Next come animated rigged troops, particle/VFX and sound, and a later move to smoothed voxels or low-poly art.
**Gameplay:** A*/flow-field pathing, more troop and defense types, base upgrades and a base editor, weapon variety, and editing pieces after they're placed.
**Multiplayer:**
1. An authoritative server (Node/Colyseus or Cloudflare Durable Objects per match) with block-delta sync and client prediction.
2. A matchmaking queue that assigns roles, with bots backfilling empty slots.
3. Async raids on saved player bases, then accounts and progression.
