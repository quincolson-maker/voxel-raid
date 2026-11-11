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

## Graphics & mobile update
- Procedural PBR texture atlas (wood grain, cobblestone, riveted plate, castle brick, gold, shingles, iron) with normal/roughness/metal maps and crack damage stages; per-vertex voxel AO.
- Sky with sun, image-based lighting, soft real-time shadows, GTAO ambient occlusion, bloom, ACES tone mapping, fog; hilly terrain with instanced trees, rocks and grass.
- Original low-poly troops (Ember Ranger, Powder Sapper, Bulwark Golem, Bastion Warden) with walk/attack/death animation; modeled defense heads, keep heartstone, roofs; first-person Arc Repeater viewmodel.
- Particles (muzzle flash, explosions, smoke/fire on damaged buildings, debris chunks), hit markers, damage numbers, synthesized WebAudio SFX.
- Quality presets Low/Medium/High/Ultra (menu or `?q=`), auto-detect (phones default Low/Medium), adaptive resolution when FPS < 28.
- Touch controls: left joystick (a thumb-sized circle bottom-left), drag look on the right side **or anywhere on the left outside the joystick** (left-thumb aim; two look drags never add up, the newest one steers; works in the scope; `?touchzones=1` shows the zones), FIRE (drag to aim while firing), BUILD, JUMP, RELOAD, PIECE, MAT, SKIP; landscape prompt; fullscreen button. Pointer lock is desktop-only.
- Bots: buffed raiders, new Bulwark Golem tank, grid A* pathing that routes through the weakest walls.

## Endless Zombies — Dead Signal

Live: https://voxel-raid.onrender.com/ (existing free Render static hosting; no new services).
Choose **ENDLESS ZOMBIES — Dead Signal** in the main menu. Attack and Defend are unchanged.

- Original night-outpost survival arena; buy the east-wing gate to expand the playable area.
- Endless rounds with a 6-second opening countdown and 9-second resupply breaks. Round size is `5 + 3*round`; health and movement speed rise each round. Walkers, runners from round 3, and a brute every fifth round.
- Start with a pistol and 500 points. Earn 10 per hit, 60 per kill, or 100 per headshot kill (plus hit points); headshots do 3x base damage before range falloff. Two weapon slots; purchases replace the held weapon. Reserve ammo is finite in Zombies only.
- Glowing stations: Carbine (500), Shotgun (750), Ammo Cache (350), East Wing (1000), Mystery Box (950; Carbine/SMG-9/Shotgun/DMR/LMG), Iron Heart (2000; 180 HP), Quick Hands (1500; 40% faster reloads). Approach within 3.4m to see the prompt.
- Occasional collectible drops: Max Ammo, Insta-Kill (30s), Double Points (30s), Nuke. Drops expire after 24 seconds. Active effect timers appear on the HUD.
- Health regenerates after 5 seconds without damage. Death ends the solo run: completed rounds, reached round, kills, headshot kills, earned/unspent points, and a local best-round record. Local records are per browser/device, not cloud saves.
- Humanoid shambling animations, melee, flinches, headshots, falling deaths, and synthesized spatial groans. Original assets/names; not Call of Duty assets or a recreation of its maps.
- Desktop: WASD, mouse look, left click fire, right click ADS, R reload, Shift sprint, Space jump, 1/2 or wheel swap, **E buy/use**, Esc release mouse.
- Phone: landscape; left joystick moves, drag right side to aim, FIRE, ADS, RELOAD, JUMP, SWAP, **USE** (replaces BUILD). A full joystick push sprints. Add to Home Screen for iPhone fullscreen.
- Performance: shared geometry/materials, recycled zombie models, at most 16 live zombies on touch devices or 28 on desktop (remaining wave enemies spawn as slots free up), four simultaneous drops. Quality presets/adaptive resolution still apply. This is solo only; no co-op/revive, physics ragdolls, or persistent online progression.

### Build and smoke tests

`sh build.sh` regenerates `game.min.js` (the checked-in bundle used by Render). Deploy updates by pushing `main` to the existing linked GitHub repository; do not create paid hosting.

Serve the repository with `python3 -m http.server 8767`. With `puppeteer-core` installed and Chrome at `/usr/bin/google-chrome` (or `CHROME_PATH` set):

```
node tests/zombies.cjs http://localhost:8767
node tests/zombies-input.cjs http://localhost:8767
```

The first tests round transitions/scaling/actor caps, shops, ammo, gate, box, perks, powers, death/high-score persistence and both classic modes; it saves `shot-zombies-desktop.png` and `shot-zombies-mobile.png`. The second exercises real mouse/touch fire/headshots, reload, E/USE purchases, melee, regeneration and drop collection. Debug mode (`?dev=1&auto=zombies`) exposes survival state for these tests. Mobile coverage is Chrome iPhone-sized touch emulation, not physical iPhone/Safari testing.

## Dead Signal co-op, build phase & rocket launcher

- **7:00 build phase** before round 1 (solo and co-op): big countdown; RMB / BUILD places Wall/Ramp/Floor (Q piece, Z material) inside the outpost. **G** (desktop) or the on-screen **SKIP** (phone) starts round 1 immediately; in co-op either player can skip and both see it. Zombies claw through player-built blocks (arena walls stay intact). Dev: `?zbuild=SECONDS`.
- **2-player co-op** (peer-to-peer WebRTC via vendored PeerJS + free public broker; no game server): menu → **Host 2-Player Co-op** shows a room code and `?join=CODE` link; teammate enters the code (or opens the link) and taps **Join Co-op**. Host is authoritative for zombies, rounds, drops, purchases and per-player points; builds, positions, firing and rockets are synced. Downed players can be revived by holding **E / USE** for 3 s; game over when both are down. If a player disconnects the other continues solo (a joiner whose host leaves takes over the simulation).
- **Rocket launcher** secondary (all modes): 1/2, wheel, Q (outside building) or SWAP on phone. Splash damage with knockback, light self-damage, 1-round mag, limited reserve refilled by Max Ammo / Ammo Cache.
- Test: `node tests/coop.cjs http://localhost:8767` (two tabs over a `?loopnet=1` BroadcastChannel transport using the same protocol — this box's managed Chrome blocks non-proxied WebRTC UDP, so the real PeerJS/WebRTC path is not exercised by CI).

## GHOSTLINE tactical overhaul (original art direction)
- Cinematic grade (desaturated, cool shadows / warm highlights, contrast, stronger grain + vignette), subtler bloom.
- Tactical HUD: top compass bar with heading (teammate dot; enemy pins during Recon Drone), weapon/ammo bottom-right, killfeed, damage-direction indicators, pulsing red low-health screen, minimal crosshair, DMR scope overlay.
- Dark menu with operator / loadout panel (cosmetic operator choice saved locally).
- Movement/feel: sprint (gun lowered), double-tap Shift or held full stick = tactical sprint (4 s stamina), C/Ctrl or SLIDE button = slide, Space at a 2-block ledge = mantle, I = inspect, per-burst recoil pattern, much subtler muzzle flash (smaller, ~1 frame, dimmer light, hidden while ADS).
- Killstreaks (Attack/Defend): 3 Recon Drone, 5 Precision Strike, 7 Sentry Gun. Zombies: Precision Strike and Recon Drone drops.
- RPG-7 secondary: tube with wooden heat guard, side optic, two grips; finned warhead on the muzzle when loaded, gone after firing, inserted during reload; warhead projectile with booster flame + smoke.
- `node tests/mw-shots.cjs` regenerates `shot-mw-*.png`.

## Zombies-only squad mode (Daybreak — Firebase)
- The menu now offers only **Play Solo**, **Host Co-op (up to 4)** and **Join Co-op**. Everything runs on one large daytime map, **Daybreak — Firebase** (Citadel Ring layout, `LAYOUTS[0]`, built by `buildDay()`, so the layout can be swapped later). Attack/Defend and the night arena are hidden, but their code is still there (`?zmap=night`, `?auto=attack`).
- Placements on the 96×96 map (C=48):
  - M4A1 wall-buy at (35,53)
  - M870 at (61,43)
  - Ammo Cache at (53,61)
  - Iron Heart at (43,35)
  - Quick Hands at (61,54)
  - **Open Command Post** door at (48,40), cost 1000. The **Mystery Box** sits behind it at (48,43.4).
  - Spawns: P1 at (45.5,57.5), with the others next to P1. Zombies spawn 20–32 m from a random living player.
- **Squad:** a host-authoritative PeerJS star for up to 4 players (P1 is the host; a 5th joiner gets "room full"). Positions are relayed through the host. Zombie count scales ×(1+0.5·(n−1)) and HP scales ×(1+0.3·(n−1)). Any teammate can revive a downed player (hold E for 3 s), and it's game over ("SQUAD WIPED") when everyone is down. Press Tab to show the scoreboard with kills and points for each player. The 7:00 build phase can be skipped by the host, or by a vote from half the squad (rounded up). Best round is saved separately per map.
- Tests: `tests/squad.cjs` (host plus 3 joiners, plus a rejected 5th) and `tests/dayz.cjs`. Both use the `?loopnet=1` stand-in transport, so real WebRTC is not exercised here.

## Decluttered UI
- **Menu:** Play Solo · Host Co-op · Join Co-op. The room-code box only appears after you tap Join, or straight away with a `?join=` link. Everything else (operator, graphics, lighting, rain, lens FX, FPS counter, fullscreen, controls, credits) sits behind the ⚙ gear.
- **Phone:** always on screen are the move stick, look area, FIRE, ADS, RELOAD, JUMP and SWAP (cycles your two weapons, e.g. the M17/primary and the RPG-7).
  - The amber **ACTION** button appears only near a wall-buy, perk, ammo cache, door or Mystery Box (BUY / OPEN / BOX with the cost), or next to a downed teammate (REVIVE). In the build phase it becomes PLACE.
  - PIECE / MAT / SKIP (VOTE SKIP for co-op clients) appear only during the build phase.
  - The small **⋯** button holds Slide, Inspect, Scoreboard, Controls, Fullscreen and Quit.
- **Desktop:** no on-screen buttons. There is one faint "H · controls" hint; H toggles the key list. Hold Tab for the co-op scoreboard. The FPS counter is opt-in from settings or `?fps=1`.
- Killstreaks in Zombies are drop pickups that fire on their own, so they don't need a button.
- Test: `node tests/ui-shots.cjs [base] after` (writes shot-ui-after-*.png). `before` shots of the previous UI are committed for comparison.

## Squad voice chat & open lobbies

- **Voice (always on in co-op):** hosting or joining a lobby turns voice on and asks for the mic once. Each teammate gets an audio-only WebRTC link (full mesh, up to 3 links), signaled over the existing co-op data channel (the host relays offers/answers/ICE). ICE uses Google STUN plus PeerJS's free public TURN (`turn:{eu,us}-0.turn.peerjs.com`, best-effort, no SLA). The speaker button (top-left; **V** on desktop) mutes/unmutes your mic: green **MIC ON**, red **MUTED**, grey **NO MIC** (blocked/missing — tap to retry; you still hear the squad). Echo cancellation, noise suppression and auto gain are on.
- **Open lobbies on the main menu:** hosts register their room with a tiny free directory service (`lobby-server/server.js`, Render free web service `voxel-raid-lobby` → https://voxel-raid-lobby.onrender.com) and heartbeat every 15 s; the menu polls every 5 s and lists rooms seen in the last 45 s (full rooms hidden). Tap a row to join. Closing the tab sends a best-effort "closed" beacon; otherwise the row expires. Only code, callsign, player count and map are stored, in memory. Free Render services sleep after ~15 min idle, so the first menu load after a quiet period may show "checking…" for up to a minute; room codes always work regardless.
- Local dev skips the public directory on localhost unless `?lobby=URL` is given. `node tests/serve-lobby.cjs 8795` serves the game + directory together.
- Test: `node tests/voice-lobby.cjs` (fake mic flags; lobby API, list → tap-join, voice signaling/mesh, mute button + V, mic denied, host close/stale removal; saves `shot-voice-*.png`). The box Chrome policy blocks non-proxied WebRTC UDP, so ICE never completes here; the actual audio path needs a real-device check.

## Horse Rider (open landscape, automatic multiplayer lobby + voice)

- Menu → **🐎 HORSE RIDER**. 800 m rolling-hills map (walkable ±360 m, mountains at the edge) with PBR grass/dirt/rock terrain (slope + trodden-track blending), conifer and broadleaf woods (near/far LOD swapped around you), textured rocks, wind-blown grass around the player, HDRI sky, sun shadows. A timber post-and-rail **HORSE PEN** (gate on the south side, opened gate leaf, run-in shed, plank water trough, round + square hay bales) holds five **realistic horses** (CC0 Grab3D GLB: Bay, Chestnut, Grey, Black, Palomino coats) that wander and graze
- Models: `assets/horses/horse.glb` (~60k tris, 2K PBR base/normal/roughness, used on desktop medium+ with a coat sheen) / `horse_mid.glb` (~24k, phones and low) + `horse_far.glb` (~9k, vertex-coloured far LOD), all from the full-resolution CC0 Grab3D horse and `rider.glb` (rigged CC0 farmer, ~27k). The static horse mesh is rigged at runtime (17 bones) with procedural 4-gait locomotion (4-beat walk, diagonal trot, 3-beat canter, transverse gallop; per-gait stance/swing duty factor, folding knees/hocks, head nod, body bob/pitch, tail carriage and idle swish) / idle / graze; the rider is posed seated with reins. Falls back to the old procedural horses if the GLBs fail to load (or `?prochorse=1`). Credits: `CREDITS.md`
- On foot: third-person over-the-shoulder camera on the rigged CC0 person (idle / walk / run blended by speed, turns to face where you move, eases into and out of a run). WASD / left stick (analog: part-way walks), Shift (or full stick) runs, Alt walks, Space jumps, C toggles first person, mouse wheel zooms. Walk within ~2.8 m of a horse → **[E] Ride horse** / **RIDE**: a short mount animation (step into the stirrup on the side you stand, swing the far leg over, settle). The same action reins the horse in and steps down on the mounting side (**GET OFF**); 0.45 s cooldown.
- Riding (RDR-style feel, all procedural): four gaits — walk, trot, canter, gallop — with weighty linear acceleration and firmer braking. Keyboard: W rides at the current gait (starts at a trot), tap Shift = one gait up, hold Shift = flat-out gallop, C = one gait down, S brakes then backs up, A/D steer. Phone: the stick is analog (part-way trot / canter, all the way gallop). Steering is camera-relative; mouse / right-side drag looks around freely without steering, then the cinematic chase camera swings back behind the horse (speed-based distance / FOV, slight roll in turns, tree-aware, bump shake). The horse leans into turns, carving at a gallop costs a little speed, it swings round trees / rocks / posts on its own and reins in (head toss) at a solid fence instead of sticking. Galloping uses stamina (thin bar, only shown while it matters); a winded horse drops to a canter. Hoof dust at speed. The rider posts the trot, stands in the stirrups and leans forward at the gallop, leans into turns, hands follow the reins and the head looks where the camera looks.
- Sky + terrain (v22, `src/hrworld.js`): physically based sky dome (Preetham Rayleigh/Mie scattering, real sun disk, 2.5D cumulus with sun-marched shading + cirrus) that also lights the world (PMREM sky IBL, re-baked as the golden-hour sun drifts slowly; `?sun=<deg>` pins it) and colours the aerial haze (height-falloff fog tinted towards the sun). Terrain: domain-warped hills, carved valleys and ridged mountains up to ~700 m out to 4.3 km; CC0 PBR blend of grass / dirt / trail / triplanar rock / snow by slope and height, with detail normals and forest belts on far slopes. GPU-instanced grass tufts with wind gusts, wildflowers and distance fade; scanned CC0 boulders; dirt trails from the pen gate. Shadows follow the view (texel-snapped), ACES + bloom + warm/cool grade. Tiers: desktop medium+ get 1k textures, full grass, macro terrain detail, dense far mountains; phones / low get 512 px, fewer tufts and rocks, cheaper terrain shading, tighter shadows. Test: `node tests/horse-sky.cjs` (saves `shot-horserider-sky-*.png`).
- Test: `node tests/horse-rider.cjs http://localhost:8767` (desktop keys + phone touch joystick: walk to a horse, mount, cooldown, gallop, chase camera, dismount, remount, fence blocks). Also checks the RDR-style riding (third-person person, mount / dismount animations, trot → tap-Shift canter → gallop with stamina, analog stick gaits, leaning into turns, seated rider pose). Saves `shot-horserider-rdr-*.png` (earlier `-beauty-` / `-real-` shots kept for comparison).
- Multiplayer (up to 4): tapping **🐎 HORSE RIDER** automatically joins an open Horse Rider lobby with a free slot (fullest first) or hosts one — no codes. Hosts advertise `mode: 'horse'` to the lobby directory; the menu's OPEN LOBBIES list shows those rows as **🐎 HORSE RIDER** (zombies rooms are marked **☣ ZOMBIES**) and tapping one rides along in that lobby. Two players who host at the same moment merge (a lone host moves into the older-coded lobby). Synced: riders walking (animated farmer avatars with name tags), which horse each rides and its gait, mount/dismount; the host owns the free herd. No PvP damage (shots are cosmetic for others). Transport = the existing PeerJS co-op star (`src/coop.js`), code in `src/horsenet.js`.
- Cowboy guns: a single-action **six-shooter** and a **Winchester-style lever rifle**, carried in the hand (arm IK) on foot and in the saddle. Desktop: **1** six-shooter, **2** rifle, **Q** cycle, **X** holster, **left mouse** fire (or click to draw), **right mouse** aim (zoom over the shoulder, a small sticky aim-assist), **R** reload one round at a time (hold to keep loading), hold **F** to fan the hammer. Phone: one **🔫 DRAW** button (tap to cycle six-shooter → rifle → holstered); **FIRE** and **AIM** appear only with a gun out; reloading is automatic. From the horse you can't shoot back over its rump (110° limit). A **SHOOTING RANGE** west of the pen has glass bottles on a rail, tin cans on a stump and three bullseye boards (scored). Third gun: the **buffalo rifle** (**3**, also in the **Q** cycle; on phones the DRAW button cycles six-shooter → rifle → buffalo rifle → holstered) — a single-shot falling-block long rifle with a full-length brass scope. Right mouse / **AIM** looks through the scope (8× style zoom, reticle, slower look); it sways with your breathing and more in the saddle; on desktop **hold Shift while scoped to hold your breath** (about 4 s, then you're winded — while scoped Shift doesn't change the horse's gait), phones steady by themselves after a moment. Big hit, ~560 m/s bullet you can watch arrive, huge black-powder cloud and boom, ~2.3 s lever-and-cartridge reload. A **long-range lane** runs south-west from the range with painted steel gongs on chains at **150 / 200 / 245 / 300 m** that ring (after the sound delay) and swing when hit. Other players see your shots (tracer, muzzle flash, smoke, sound) — shots are visual only, no PvP damage; targets are local. Test: `node tests/horse-guns.cjs`.
- **Zombies from the mountains** (`src/hrzombies.js`): the dead come down from the foot of the mountains at the map edge (nearest the riders) and head for players on foot, riders (they claw the horse, and a little of the rider) and loose horses. Steady trickle that thickens every 75 s (WAVE n): shambling **walkers**, fast **runners** (wave 2+) and big **brutes** (wave 3+); they cover open country quickly, then slow to their own pace inside ~90 m. Max 6 at once on phones, 14 on desktop; far ones are animated less often and hidden past 220/320 m. All three guns kill them, headshots ×2.4 (six-shooter 50, lever rifle 70, Buffalo rifle 260 damage; walker 100 hp, runner 70, brute 320). Damage: walker 12, runner 9, brute 28 per swipe. You have 100 hp, regenerating after 5 s without a hit; at 0 you are overrun and come back at the pen after 4 s. A horse has 160 hp; at 0 it throws you and bolts back into the pen, where it heals. **The horse pen is a safe zone and indestructible**: nothing damages the fence or gate, the dead can never step inside (gate gap included) and walk around it, crowding at the rails; anyone inside the pen can't be hurt. HUD top-left: hp (+ horse hp while riding), wave, zombies near, kills/headshots. Multiplayer: the host spawns and simulates every zombie and sends snapshots; clients show the same ones, send their hits to the host, and the host sends each player the damage they take. Re-dressed copies of the CC0 farmer rig (tinted skin and clothes, hunched, arms reaching), no new assets. `?zombies=0` turns them off (used by the older Horse Rider tests). Tests: `tests/horse-zombies.cjs` (spawn at the edge, guns + headshots, hurt, pen stays shut; `shot-horserider-zombies-*.png`) and `tests/horse-zombies-net.cjs` (host-authoritative sync).
- Voice: the same always-on squad voice as zombies co-op starts on its own when you enter (mic prompt on the HORSE RIDER tap); same speaker button top-left — MIC ON / MUTED / NO MIC, tap or **V** to mute. Plain `localhost` dev without `?lobby=` stays solo; `?solo=1` forces solo anywhere.
- Test: `node tests/horse-voice.cjs` (lobby server + game on :8797, `?loopnet=1`): host advertises a horse lobby, phone taps the 🐎 row and joins, a desktop player auto-joins from the button, offer/answer exchanged with sendrecv audio, mute by button and V, ride sync + release, leave updates the count. Saves `shot-horserider-voice-*.png`.
