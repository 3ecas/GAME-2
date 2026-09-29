# Hop

Hold to charge, release to jump, land dead center. A side-view 2D hopper for one thumb.

## Play

- Open `hop/index.html` from the published site, or serve the repo root locally (`python3 -m http.server 8123`) and open `http://localhost:8123/hop/`.
- Hold anywhere to charge (the longer, the further), release to jump. Space bar on a desktop, Escape pauses.

## Core loop

1. The character rests on a pad. Holding squashes it and fills a power bar above its head.
2. Releasing launches it on a parabola. Full charge flies about 270 px; no charge about 44 px.
3. Land on a pad to continue. Land on the dot in the middle for a PERFECT and a growing streak. Miss and you are in the water.
4. The camera slides so the character sits at the left third of the screen, with the next pad in view.

A run is 20 seconds to a few minutes. Restart is one tap.

## Scoring

| Landing | Points |
| --- | --- |
| Perfect (within 6 px of the dot) | 2 × streak, so 2, 4, 6, 8… for consecutive perfects |
| Anywhere else on a pad | 1, streak resets |
| Jumping over a pad onto a further one | +1 per skipped pad, on top of the landing |
| Missed the pad, or hit its side | run ends |

## Difficulty

Everything ramps over the first 60 pads:

- Pad widths shrink from 72–106 px to 38–64 px.
- Gaps skew toward the maximum reachable distance.
- Height differences between consecutive pads grow from ±6 px to ±40 px. A higher pad needs slightly more power; the physics is a real parabola, so the same power lands shorter on a higher pad.
- From pad 30, some pads drift side to side (small arrows on the cap mark them). There is no timer, so a moving pad is a timing puzzle, not a rush.

Scenery changes every 25 pads: Pond, Sunset, Night, Space, then around again. The sky crossfades on the first landing in a new biome. In Space there is no water, just the void.

## Characters

Seven characters, unlocked by best score: Frog (0), Toad (25), Ghost (75), Cat (150), Ninja (300), Astronaut (600), King (1200). Streak scoring grows fast, so these are further apart than they look. Each is a few canvas primitives in `drawChar` and a row in `data.js`, so adding one is cheap.

## Daily

One run per day, seeded from the date so everyone gets the same pads. One try. The share button produces:

```
Hop 🐸 Daily #3
38 pts · 17 hops · best streak ×5
🟩🟩🟨🟩🟩🟩🟩🟩🟨🟩🟥
https://…/hop/
```

The day number counts from 2026-09-29.

## Feel

- Squash on charge, stretch in the air, a bounce on landing, dust puffs, a ring on perfects, a splash and screen shake on a miss.
- Sound is optional synthesized WebAudio: a rising tone while charging, a boing, a thud, chimes that climb with the streak, a splash. Fully playable on mute.
- Haptics go through the same `haptic()` hook as Next Stop (Capacitor Haptics when wrapped, `navigator.vibrate` where it exists).
- The game pauses itself in the background. A charge in progress is cancelled on pause so a stray hold cannot fire on resume.
- The menu runs a demo of the game behind the blur: the character plays itself with a bit of noise so it misses now and then.

## Tech

- Vanilla JavaScript, one canvas, no dependencies, no build step. Logical width 390 px, height follows the device, the water line at 72 percent of the height.
- All tuning in `data.js` with a comment per field. `window.Hop` exposes state, `solvePower()` and `jumpWithPower()` for tests and console tuning.
- `manifest.webmanifest` and `sw.js` make it installable and offline capable. Progress is in `localStorage` under `hop.v1`.

## Ship to the App Store

Same recipe as Next Stop: Capacitor with `--web-dir hop`, portrait only, and haptics start working through `haptic()`.

## Roadmap

- Bouncy pads that fling you further, and crumbling pads that only hold one landing.
- Coins in the arc for a cosmetic shop instead of score-gated unlocks.
- Game Center leaderboard once wrapped.
