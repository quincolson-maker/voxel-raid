# Grok: install and finish the Frontier upgrade

The user wants the saloon upgrade AND the four player variants AND the Tommy
replica/suppressor/brass/audio. Keep all three workstreams. Do not drop existing
game features. This package changes the TWO uploaded modules and adds companions;
it does not contain the current full game or deploy anything.

## What is implemented

- Replacements for `src/hrsaloon.js` and `src/hrtown.js`, retaining their public
  entry points and existing darts/checkers/store/posse/drinks/fights functionality.
- Procedural detailed skinned NPCs: Greta, adult dancers, seated/hired bandits.
  Each person's body, face, hair, hands and clothing are one vertex-colored
  skinned draw, rather than dozens of independent capsule/sphere mesh draws.
- Three distinct original mechanical slots: GOLD RUSH, GHOST TOWN, SUN & SILVER.
  Distinct cabinet colors, finials, symbol art, signs, paytables and sound tones.
  Shared math drives the physical reels and UI payout. Exact RTP: 93.6371%,
  93.92395%, 94.52820%. No client-generated result fallback after host timeout.
- Texas Hold'em: up to six seats; bots fill vacant seats; humans replace bots
  between hands. Blinds, all betting streets, checks/calls/folds/raises/all-ins,
  minimum raises, short all-in raise-right rules, side pots, split pots, odd chips,
  turn timeouts, private hole cards, 7-card evaluator, delayed next hands.
  Bots estimate equity against random unseen cards, not opponents' secret hands.
- Private blackjack: six-deck shoe, soft-17 stand, ace valuation, natural 3:2,
  hit/stand/double/split, up to four hands, one card to split aces, double after
  non-ace split, no insurance. Dealer hole card stays hidden during player action.
- Casino tables use FREE fictional practice chips isolated from game score.
  Existing slots continue using the existing game's points ledger.
- Architectural details: carved mahogany, raised panels, aged brass, inked
  wallpaper, porch fretwork/corbels, sash windows with actual visual wall openings,
  chandelier clusters, velvet stage curtains, balcony spindles, backbar trim.
- Four player body/face/hair/Western outfit variants, all adult:
  Isaiah (dark-skinned Black man), Cole (White man), June (Black woman), Clara
  (White woman). Consistent outfit family; not four unrelated art styles.
- Separate Tommy gun asset: M1928-style walnut furniture, cooling fins,
  compensator, drum, sights, selector/screws, moving bolt, suppressor attachment.
- Pooled brass: 72 high / 24 low, right-side ejection, tumbling, gravity, bounce,
  floor query and timed cleanup. No new casing mesh per shot.
- Original synthesized Web Audio plus four optional WAVs. These are NOT recordings
  of a real Thompson. No authenticity claim or external samples.

## Install first

1. Back up the current project. Copy ALL files from this package's `src/` into
   the game's `src/`. Do not copy this test package's package.json over the game.
2. Preserve the game's existing `three` import map, Three.js r170, existing
   `addons/utils/BufferGeometryUtils.js` and `src/hrcheckers.js`. Those dependencies
   were already required by the supplied town file and are not duplicated here.
3. Keep creating the saloon with the same `createSaloon(c)` call as before.
4. Check that the real `horsenet.js` routes existing saloon messages. If missing,
   add to its authenticated message switch (adapt variable names to current code):

```js
case 'sv':
  if (isHost() && H.saloon) H.saloon.netIn(m, S.peers.get(from));
  break;
case 'svr':
  if (isClient() && H.saloon) H.saloon.netRes(m);
  break;
```

`from` must come from the transport's authenticated connection map. Never trust
an ID supplied in a message. Use the existing H.zSend/H.zSendTo adapters. Poker
views are sent individually with only that player's hole cards. Never put whole
poker state/deck into the public rider snapshot. Dealer games are per player.

5. Rebuild the deployed game.min.js using the project's existing build.sh and bump
   its index.html cache version. Editing source alone does not change the live game.
6. Invoke `H.saloon.dispose()` when unloading, before replacing the town. Preserve
   whatever town resource lifecycle the full game already uses.

## Integrate the four player variants (main avatar code not supplied)

The original upload only contained hrsaloon.js and hrtown.js. Player avatar
creation lives in horse.js, so this package does NOT pretend it has already
changed the live player avatar selector. Implement this integration next:

```js
import {createPlayerCharacter,poseFrontierCharacter,
        variantIndexForPlayer} from './hrcharacters.js';

// Assign once on authenticated join. Four templates can repeat above four players.
const index = variantIndexForPlayer(authenticatedPlayerId); // 0..3
const character = createPlayerCharacter(index, {quality: mobile ? 'low' : 'high'});
scene.add(character.g);
// Or parent character.g under your existing avatar root.
poseFrontierCharacter(character, dt, {
  speed: avatarSpeed,
  seated: false,
  riding: isMounted,
  aiming: isAiming,
});
```

Send the chosen index once in join metadata (or validated `av:0..3` rider state)
and reuse the same value locally/remotely. Rebuild only when appearance changes,
not per frame. Use a persistent authenticated identity if reconnect appearance
must remain stable; room callsigns can change.

The factory supplies hips/spine/head/arms/legs/hands, a 19-bone skeleton,
`g.userData.B` and rest quaternions, and `.dispose()`. It is a NEW procedural rig,
not a drop-in retargeted copy of the original GLTF's bind pose. Do not blindly
play old GLTF clips on it. Use the supplied pose helper or properly retarget.

Match seated/root offsets to each horse's saddle and retain existing mount,
dismount, reins, gun IK, local FPV body hiding and remote ownership behavior.
Existing rider geometry can remain as an optional fallback. Do not replace
zombie hit proxies with visual geometry or change character capsule dimensions.

## Integrate the Tommy asset and casing/sound hooks (hrguns.js not supplied)

```js
import {buildTommyReplica,createTommyEffects} from './hrtommy.js';
const tommy = buildTommyReplica({quality: mobile ? 'low' : 'high'});
// Use it as the Tommy factory result in hrguns.js:
// {group,muzzle,drum,bolt,kind:'tommy'} remains compatible with that model API.
scene.add(tommy.group);
const tommyFX = createTommyEffects({
  scene,
  audioContext: sfx.ctx, // can also let audio initialize on the first gesture
  quality: mobile ? 'low' : 'high',
  groundHeight: (x,z,y) => town.floorAt(x,z,y),
});

// After an ACCEPTED Tommy shot (after ammo/cooldown checks), once per shot:
tommyFX.emit(tommy);
// In the existing frame loop:
tommyFX.update(dt);
// At reload start: tommyFX.sound.reload();
```

Keep existing gun damage, raycasts, ammo, reloads, firing cadence, upgrades and
tracers. `emit()` adds visuals/audio only; it never deals damage or consumes ammo.
Do not add a second firing loop. Do not detect firing from mouse-down alone.
Stop the OLD Tommy shot-audio branch when enabling this pack's audio so they do
not double-play; keep the original tracer/impact logic.

The muzzle points along local -Z. `muzzle` moves forward when suppressed. Keep
the world FX group under an identity scene root, not parented to the moving gun.
For remote guns create independent model instances or map clone-local moving
parts by name (`drum`, `bolt`, `Tommy suppressor`); do not shallow-copy another
weapon's dynamic object references. Budget effects for distant remote shots.

The optional WAVs can be decoded once into the existing SFX system instead of
using the synthesizer. Reuse decoded buffers; never fetch/decode per shot.
The suppressed sound is quieter/more mechanical, NOT magically silent.

## Store suppressor: register a real working item

The town now exposes a tested `registerStoreItem()` extension; it does not show
an inert purchase button without a functional weapon adapter.

```js
import {createTommySuppressorItem} from './hrtommy-store.js';
const savedAttachment = loadYourAttachmentSave();
const suppressor = createTommySuppressorItem({
  weapon: tommy,
  price: 900, // configurable fictional points price
  owned: !!savedAttachment?.owned,
  equipped: !!savedAttachment?.equipped,
  wallet: {
    spend(points) {
      // Use the authoritative transaction path in the real multiplayer game.
      if (!guns.state.owned.tommy || guns.pts() < points) return false;
      guns.state.spent += points;
      guns.save();
      return true;
    },
  },
  onChange: attachment => saveYourAttachmentState(attachment),
});
town.registerStoreItem(suppressor);
```

The general store shows BUY, EQUIP or REMOVE according to item state. The adapter
prevents charging twice and applies the visual/muzzle change. Integrate ownership
into the real save schema. Send an authenticated equipped flag to other riders;
remote display must never grant ownership. If the game has hearing/noise AI,
connect the quieter report through its existing noise event API.

## Validation already performed

- Syntax checks for every module on Node 24; Three.js structural checks used r170.
- 400 seven-card evaluator cross-checks against all 21 five-card subsets.
- 300 randomized complete poker hands with exact integer chip conservation.
- Explicit unequal all-in side pots, uncalled returns, short raises, hole-card
  privacy, late human joins, all-in disconnect eligibility and short-blind runout.
- 12 complete human/bot hands exercising the bot decision logic.
- 300 blackjack hands plus natural/split/double/soft-ace cases.
- Exhaustive slot RTP enumeration, symbol ranges, payouts.
- Four character variants in high/low, skin indices, finite geometry, single
  skinned body draw, adult NPC rig/hand/fan compatibility.
- Tommy attachment/muzzle behavior, one-time store charge, bounded casing pool.
- Integration construction/tick tests for town + saloon + poker + blackjack +
  slot settlement, duplicate requests, scene geometry and cleanup.

DOM/canvas were stubs in integration tests. The browser could not reach the local
preview server, so NO browser interaction, WebGL shader compilation, screenshot,
real-device performance, acoustic authenticity or real WebRTC-session success is
claimed. Do those checks in the actual project before shipping.

## Critical follow-through

- This is detailed PROCEDURAL character art, not photorealistic scanned humans.
  If the user insists on true photorealism, replace the factory's visual mesh
  with properly authored/licensed rigged models while keeping these hooks.
- Poker/blackjack chips are practice chips; there is no bank/cash-out into the
  player's game score. Do not silently conflate them with persistent score.
- Existing slots still use the game's original client-side points ledger. This
  pack improves outcome authority/deduplication, but does not create a secure
  server-side economy. Do not claim anti-cheat-grade financial authority.
- Test current horsenet routes, private payload isolation, disconnect/rejoin,
  seating/FPV offsets, gun/saddle IK, store persistence and 25-player load.
- Test mobile touch UI, shader compilation, indoor exposure, transparency,
  floors/stairs/window collision, gun grips and relative audio volume in a real
  WebGL browser. Fix problems instead of declaring an unviewed render beautiful.
