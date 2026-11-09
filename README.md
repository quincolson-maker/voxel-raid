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
- Touch controls: left joystick, right-side drag look, FIRE (drag to aim while firing), BUILD, JUMP, RELOAD, PIECE, MAT, SKIP; landscape prompt; fullscreen button. Pointer lock is desktop-only.
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
