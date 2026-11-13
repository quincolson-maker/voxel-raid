# Frontier saloon, character and Tommy upgrade

Start with **NOTE_FOR_GROK.md**. It lists exactly what is ready, what needs wiring
into the full game, and the tests performed.

## Package

- `src/hrsaloon.js`, `src/hrtown.js`: upgraded versions of your uploaded files.
- `src/hrsaloondecor.js`: architectural detail and lighting.
- `src/hrcasino.js`: table models, card atlas, FPV seats, menus, network adapter.
- `src/hrcasinogames.js`: pure slot / Texas Hold'em / blackjack rules and bots.
- `src/hrcharacters.js`: saloon NPCs and four skinned player variants.
- `src/hrtommy.js`: replica-style model, suppressor, audio and brass effects.
- `src/hrtommy-store.js`: buy/equip/remove transaction adapter.
- `audio/`: original synthesized WAVs, not real firearm recordings.
- `saloon-preview.html`: manual preview using your game's existing Three.js and
  checkers/addon files. Put it in the game root and serve with HTTP.
- `tests/`: repeatable logic and structural tests; no npm dependencies.
- `changes.patch`: review diff for the two uploaded source files.

The saloon changes retain the existing code structure and footprint. Detailed
procedural characters replace the old dolls. The four PLAYER templates and new
Tommy asset are supplied separately for Grok to wire into the avatar/weapon code,
which was not included in the upload.

Poker fills six seats with bots when people are absent; humans joining an active
hand are queued until the next deal. The dealer does not expose private cards.
Blackjack is against a dealer. Casino chips have no cash value and are isolated
from game points. Slots retain the original game's fictional points integration.

## Run tests

```sh
node tests/casino.test.mjs
THREE_TEST_ROOT=/absolute/path/to/your/game \
  node --loader ./tests/three-loader.mjs tests/assets.test.mjs
```

The second command expects the existing game's `three.module.js`,
`addons/utils/BufferGeometryUtils.js` and `src/hrcheckers.js`. It stubs DOM/canvas:
passing is NOT a claim that a browser render was inspected.

## Manual preview

Copy src files into the game's src folder and put `saloon-preview.html` in its
root. Run a local HTTP server, then open `/saloon-preview.html` in a WebGL browser.
Controls: WASD, mouse look, E interact. Buttons jump to poker, blackjack, slots,
the four player variants and a Tommy showcase. U buys/equips the suppressor in
this preview; hold fire in the gun showcase to see brass. R plays reload audio.
`?low=1` uses reduced model detail. `?norender=1` tests DOM-only casino behavior.

Preview points are an in-memory demo wallet, not the game's saved balance. The
preview does not apply weapon damage. Neither sounds nor figures are advertised
as recorded/scanned realism. Real browser/device verification is still required.
