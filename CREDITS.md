# Credits & asset licenses

All code, models (soldiers, emplacements, watchtower, command post, rifle viewmodel, trees, grass, fence) and procedural textures (chain-link, muzzle flash) are original work created for this project.
No Bohemia Interactive / Arma or Supercell assets, models, textures or likenesses are used.

## Third-party assets (all CC0 1.0 – public domain)
| Asset | Used for | Source | License |
|---|---|---|---|
| Kloofendal 48d Partly Cloudy (Pure Sky) HDRI, 1k | Sky background + image-based lighting | https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky | CC0 |
| sparse_grass | Terrain grass | https://polyhaven.com/a/sparse_grass | CC0 |
| dirt | Terrain dirt patches | https://polyhaven.com/a/dirt | CC0 |
| aerial_rocks_02 | Terrain slopes, rocks | https://polyhaven.com/a/aerial_rocks_02 | CC0 |
| concrete_wall_008 | Concrete T-walls | https://polyhaven.com/a/concrete_wall_008 | CC0 |
| concrete | Player concrete pieces | https://polyhaven.com/a/concrete | CC0 |
| red_brick_03 | Command post | https://polyhaven.com/a/red_brick_03 | CC0 |
| hessian_230 | HESCO barriers, sandbags, emplacement bases | https://polyhaven.com/a/hessian_230 | CC0 |
| corrugated_iron_02 | Barracks, watchtower roof | https://polyhaven.com/a/corrugated_iron_02 | CC0 |
| metal_plate_02 | Player steel pieces | https://polyhaven.com/a/metal_plate_02 | CC0 |
| brown_planks_05 | Player timber pieces, watchtower | https://polyhaven.com/a/brown_planks_05 | CC0 |
| bark_brown_02 | Tree trunks | https://polyhaven.com/a/bark_brown_02 | CC0 |

Textures were resized and re-encoded to WebP (512 px default, 1k lazy-loaded on High/Ultra); glTF textures downscaled to 512 px.
Library: three.js r170 (MIT) incl. examples/jsm add-ons (MIT).

## Realism pass (v8)
All new effects (bullet-hole/scorch decals, debris/rubble, dust, rain, shell casings, lens shader, height fog, reverb impulse, footsteps) are procedural original code — no new third-party assets. No CC0/CC-BY rigged human met license requirements (Mixamo is not CC), so soldiers remain original procedural models.

- PeerJS 1.5.4 (MIT) — vendored at `vendor/peerjs.min.js` for co-op WebRTC data channels; signaling via the free public PeerJS broker.

## Horse Rider models (CC0 1.0 – public domain, by Grab3D)
| Asset | Used for | Source | License |
|---|---|---|---|
| "Bay Horse" (full-resolution version, `horse.glb`, 731k tris, 4K base/normal/metal-rough) | `assets/horses/horse.glb` (desktop medium+ near LOD, ~60k tris, 2K WebP base colour + normal + roughness maps), `assets/horses/horse_mid.glb` (phones / low quality, ~24k tris, 1K WebP maps) and `assets/horses/horse_far.glb` (far LOD, ~9k tris, texture baked to vertex colours). Rigged at runtime in `src/horse.js`; coat colours are recoloured in the shader | https://grab3d.com/models/animals/horse/ | CC0 (see `assets/horses/LICENSE-horse.txt`) |
| "Farmer" (rigged version, full-resolution 250k-tri rig + 2K maps) | `assets/horses/rider_hq.glb` (desktop medium+, ~50k tris, 2K WebP base/normal/roughness) and `assets/horses/rider.glb` (phones / low, ~27k tris, 1K WebP). Used as the player on foot (its walk / run clips blended with an idle built at runtime) and as the rider (procedural seated, mounting and riding pose) | https://grab3d.com/models/characters/farmer/ | CC0 (see `assets/horses/LICENSE-rider.txt`) |

Both Grab3D models are marked by their author as **AI-assisted** (base mesh/textures generated with Meshy image-to-3D, then cleaned up in Blender). They were simplified (meshoptimizer), resized (horse 2K/1K, rider 1K), converted to WebP and quantized with glTF-Transform for this project. Saddle, reins, fence, shed, trough, hay bales, trees and grass in Horse Rider are procedural/original. The Horse Rider zombies reuse this same CC0 farmer rig (tinted and re-posed at runtime); no extra models or textures were added for them.

## Horse Rider sky + terrain pass (v22) — all CC0 1.0 (public domain) from Poly Haven
| Asset | Author(s) | Used for | Source | License |
|---|---|---|---|---|
| leafy_grass (diff / nor / arm) | Charlotte Baglioni | Meadow grass layer (two scales) + AO / roughness | https://polyhaven.com/a/leafy_grass | CC0 |
| rocky_trail (diff) | Amal Kumar | Dirt trails around the pen and south into the valley | https://polyhaven.com/a/rocky_trail | CC0 |
| rock_face (diff / nor) | Greg Zaal, Dario Barresi | Triplanar rock on steep slopes and the mountains | https://polyhaven.com/a/rock_face | CC0 |
| snow_02 (diff / nor) | Rob Tuytel | Snow caps on the high peaks | https://polyhaven.com/a/snow_02 | CC0 |
| namaqualand_boulder_02 (glTF) | Greg Zaal, Rico Cilliers | Scanned boulders (`assets/models/rock_namaqualand_boulder_02.glb`) | https://polyhaven.com/a/namaqualand_boulder_02 | CC0 |
| namaqualand_boulder_04 (glTF) | Jenelle van Heerden | Scanned boulders with lichen (`…_04.glb`) | https://polyhaven.com/a/namaqualand_boulder_04 | CC0 |
| namaqualand_boulder_05 (glTF) | Jenelle van Heerden, Dario Barresi | Scanned boulders (`…_05.glb`) | https://polyhaven.com/a/namaqualand_boulder_05 | CC0 |

Textures re-encoded to WebP at 1k (desktop medium+) and 512 px (phones / low). Boulders simplified to ~1.8k triangles with meshoptimizer, 512 px WebP maps, quantized (glTF-Transform).
The existing CC0 `sparse_grass` and `dirt` sets (above) are reused for grass variation and the pen floor.
Sky: original code (`src/hrworld.js`); the atmospheric scattering is the Preetham analytic daylight model as implemented in three.js `examples/jsm/objects/Sky.js` (MIT, three.js authors), extended with procedural clouds, Kasten–Young sun colour and PMREM sky lighting. Terrain heights, GPU grass, wildflowers, trails and the colour grade are original code.

## Horse Rider cowboy guns (v23) — original, no downloaded assets
- Single-action six-shooter and lever-action rifle (`src/hrguns.js`): original procedural three.js geometry (extruded frames, lathe-turned cylinder/barrels, fluted cylinder, octagon barrel, brass receiver, walnut stock) with procedurally generated canvas textures (walnut grain, case-hardened colour, blued steel) — no external files, nothing to license.
- Shooting range targets (glass bottles, tin cans, painted bullseye boards, sign) and muzzle flash / bullet-hole textures: procedural, original.
- Gun sounds: synthesized at runtime with WebAudio (existing `SFX` in `src/fx.js`), no samples.
- **Buffalo rifle (v24)** — long-range single-shot falling-block rifle with a full-length brass tube scope, in the general style of 1870s buffalo rifles (Sharps 1874 / rolling-block era): original procedural three.js geometry built in `src/hrguns.js` (`buildSharps`) — octagon barrel, case-hardened receiver, lock plates and side hammer, falling breech block and trigger-guard lever, double set triggers, walnut forend with ebony tip, crescent butt plate, brass scope with mounts and knobs. Built from general knowledge of the historical rifle type; no TurboSquid or other third-party model, texture or reference asset was downloaded, bought or copied. Scope overlay / reticle: CSS, original. Long-range steel gongs: procedural, original. Sounds: synthesized WebAudio.
- Gameplay tuning (round counts, fire/lever/reload timings, spread model, aim-assist cone, horseback yaw limit) adapted from a draft module Quin Colson had ChatGPT write (`cowboy-guns.mjs`); code reviewed and mostly rewritten.

## Horse Rider landscape (v29) — original, no downloaded assets
- Sagebrush, bunchgrass, prickly pear, saguaro, pebbles and far mountain conifers (`src/hrflora.js`, `src/horse.js`): original procedural three.js geometry, instanced; existing CC0 textures above reused. Mountain range, snow-line, conifer-belt and haze shaders: original code. Nothing bought or downloaded.

## Horse Rider rideable mountains (v30) — original, no downloaded assets
- Mountain trails, ponds, creek, detail-terrain chunks, world mask, water shader (`src/hrterrain.js`), mountain forests, low-poly outcrop rocks, fallen logs, trail signposts and summit cairns (`src/horse.js`): original code / procedural geometry. Textures are the existing CC0 Poly Haven sets listed above (bark, rock, grass, dirt, rocky trail, snow). Nothing bought or downloaded.


v31: the voxel raid / zombies FPS modes were removed, together with their assets (Quaternius CC0 gun GLBs, Poly Haven ammo_box / wooden_military_crate); their credits are in git history (<= v30).

v32 realism: the branch-card / leaf-card tree textures, rock triplanar/moss, strata, snow glints and water fresnel are original procedural code (canvas-drawn textures, GLSL); no new third-party assets. Terrain textures remain the existing Poly Haven CC0 sets (leafy_grass, sparse_grass, dirt, rocky_trail, rock_face, snow_02, aerial_rocks_02, bark_brown_02). Removed in v32 (unused after v31): concrete, concrete_wall_008, red_brick_03, metal_plate_02.

v33 towers: the fire lookouts, town buildings, signs, Tommy gun, Golden Buffalo rifle, HORSE RIDER windbreaker, dartboard, checkers board/AI, drunk post-effect and shop/darts UIs are original procedural code and canvas textures written for this project (no purchased or third-party assets). The bartender/storekeeper reuse the existing CC0 rider model.

v35 saloon / woodcraft / zombies: the saloon interior, slot machines and symbols, NPC dolls (barmaid, dancers, bandits, dealer), batwing doors, fists, axe, log-cabin pieces, wood textures, the zombie rot shader and zombie attachments (eyes, hats, ribs, jaw, rags), and all new sounds (synthesized WebAudio) are original procedural code written for this project. No purchased or third-party assets; zombies still reuse the existing CC0 rider model.

## v36 Frontier upgrade — ChatGPT-generated code supplied by Quin Colson (integrated and adapted by Grok Bot)
Quin had ChatGPT write a "Frontier upgrade" package (kept as-is for reference in `docs/chatgpt-drop3/`). Everything in it is
generated procedural code: no downloaded, purchased or third-party art, models or recordings.
- **Saloon / town upgrade** (`src/hrsaloon.js`, `src/hrtown.js`, `src/hrsaloondecor.js`): ChatGPT-generated code from Quin
  (procedural decor, themed slot machines with fair return math). Merged into our saloon; our interaction ids, E / USE
  buttons and the authenticated `sv` / `svr` routes in `src/horsenet.js` kept.
- **Casino tables** (`src/hrcasino.js`, `src/hrcasinogames.js`): ChatGPT-generated code from Quin. Poker and blackjack use
  practice chips only, slots use game points; nothing is real money.
- **Frontier characters** (`src/hrcharacters.js`): ChatGPT-generated code from Quin — procedural skinned adult characters
  (four player variants, saloon NPCs; dancers clothed). `src/hrskin.js` (Grok Bot) drives them from our existing rider rig
  for the menu character picker; the classic rider stays the default.
- **Tommy replica** (`src/hrtommy.js`, `src/hrtommy-store.js`): ChatGPT-generated code from Quin — replica-style procedural
  model, suppressor, pooled brass, store adapter. Resized to our old Tommy and routed through our sound bus; damage, ammo and
  cadence unchanged. The suppressor costs 900 game points.
- **Tommy sounds** (`assets/audio/tommy-shot.wav`, `tommy-suppressed.wav`, `tommy-reload.wav`, `brass-clink.wav`): original
  synthesized WAVs produced by the package's ChatGPT-generated script (`docs/chatgpt-drop3/tests/generate_audio.py`), from Quin.
  They are not firearm recordings.

## v38 Bandit Falls — ChatGPT-generated code supplied by Quin Colson (integrated and adapted by Grok Bot)
- **Waterfall bandit cave** (`src/hrbanditcave.js`): ChatGPT-generated code from Quin ("Bandit Falls"; the original file is kept
  as-is in `docs/chatgpt-cave/banditcave.js`). It builds the rock shell, waterfall and pool, outlaw bar, stage, poker table,
  slot machines, lookout ladder, vault with gate and strongboxes, lamps, colliders and gameplay markers. Changes for this game:
  a view-distance option, lamps stay in the scene and darken when you are away, crude stand-in dancer shapes hidden (our own
  Frontier dancers stand there instead, adult and fully costumed), the ambient light removed, the poster reads "GAME POINTS ONLY",
  and a few extra rock solids above the mouth.
- **Integration** (`src/hrcave.js`, hooks in `src/horse.js`, `src/hrzombies.js`, `src/hrguns.js`, `src/horsenet.js`, `src/hrworld.js`):
  written by Grok Bot — the site in a flattened hillside notch (the same on every machine), walls / floors / bullets, the
  no-zombie zone, the host-run outlaw guards (they shoot back), the key and vault for everyone in co-op, game-point rewards
  (strongboxes pay once per player). Slots and tips use game points only; poker uses practice chips only. No real money.
