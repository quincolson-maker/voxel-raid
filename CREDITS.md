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
