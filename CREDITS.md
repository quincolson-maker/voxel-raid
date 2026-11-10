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
| ammo_box (glTF) | Supply depot props | https://polyhaven.com/a/ammo_box | CC0 |
| wooden_military_crate (glTF) | Supply depot props | https://polyhaven.com/a/wooden_military_crate | CC0 |

Textures were resized and re-encoded to WebP (512 px default, 1k lazy-loaded on High/Ultra); glTF textures downscaled to 512 px.
Library: three.js r170 (MIT) incl. examples/jsm add-ons (MIT).

## Weapons
All six weapons (Carbine, SMG-9, Shotgun, DMR, LMG, Pistol) are original procedural models authored in code (`src/models.js` → `makeGun`), with generic names and no trademarks or manufacturer markings. Firing sounds are synthesized with WebAudio.
Downloadable CC0/CC-BY gun models were reviewed on Poly Pizza (e.g. Quaternius CC0 low-poly rifles), but they are stylized flat-colour low-poly and clashed with the realistic look, so none were used. No third-party weapon assets are included.

## Realism pass (v8)
All new effects (bullet-hole/scorch decals, debris/rubble, dust, rain, shell casings, lens shader, height fog, reverb impulse, footsteps) are procedural original code — no new third-party assets. No CC0/CC-BY rigged human met license requirements (Mixamo is not CC), so soldiers remain original procedural models.

- PeerJS 1.5.4 (MIT) — vendored at `vendor/peerjs.min.js` for co-op WebRTC data channels; signaling via the free public PeerJS broker.

## Weapon models (CC0 / public domain)
All from **Quaternius — "Ultimate Guns Pack"** (https://quaternius.itch.io/50-lowpoly-guns, GLB mirror https://poly.pizza/bundle/Ultimate-Guns-Pack-cpgUfI4t2F), license **CC0 1.0**. Re-exported with glTF-Transform (quantized) to `assets/guns/`.
- M4A1 (`carbine.glb`) ← "Assault Rifle" https://poly.pizza/m/Bgvuu4CUMV
- MP9 (`smg9.glb`) ← "Submachine Gun" https://poly.pizza/m/7ehatxr7FY
- M870 (`shotgun.glb`) ← "Shotgun" https://poly.pizza/m/DcNE0HVdW8
- SR-25 (`dmr.glb`) ← "Sniper Rifle" https://poly.pizza/m/XCIC2Ae4Rb
- M17 (`pistol.glb`) ← "Pistol" https://poly.pizza/m/Jyn9qex4ba
- M249 and RPG-7 remain original procedural models (no suitable CC0 model found).

## Horse Rider models (CC0 1.0 – public domain, by Grab3D)
| Asset | Used for | Source | License |
|---|---|---|---|
| "Bay Horse" (full-resolution version, `horse.glb`, 731k tris, 4K base/normal/metal-rough) | `assets/horses/horse.glb` (desktop medium+ near LOD, ~60k tris, 2K WebP base colour + normal + roughness maps), `assets/horses/horse_mid.glb` (phones / low quality, ~24k tris, 1K WebP maps) and `assets/horses/horse_far.glb` (far LOD, ~9k tris, texture baked to vertex colours). Rigged at runtime in `src/horse.js`; coat colours are recoloured in the shader | https://grab3d.com/models/animals/horse/ | CC0 (see `assets/horses/LICENSE-horse.txt`) |
| "Farmer" (rigged version) | `assets/horses/rider.glb` (~27k tris, 1K webp textures), posed seated on the saddle at runtime | https://grab3d.com/models/characters/farmer/ | CC0 (see `assets/horses/LICENSE-rider.txt`) |

Both Grab3D models are marked by their author as **AI-assisted** (base mesh/textures generated with Meshy image-to-3D, then cleaned up in Blender). They were simplified (meshoptimizer), resized (horse 2K/1K, rider 1K), converted to WebP and quantized with glTF-Transform for this project. Saddle, reins, fence, shed, trough, hay bales, trees and grass in Horse Rider are procedural/original.
