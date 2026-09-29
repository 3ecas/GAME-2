# Hop

Hold to charge, release to jump, land dead center. A side-view 2D hopper for one thumb, drawn in the flat, quiet style of Mini Metro: plain shapes, soft gradients for depth, a tiny glow, and a lot of empty space.

## Play

- Open `hop/index.html` from the published site, or serve the repo root locally (`python3 -m http.server 8123`) and open `http://localhost:8123/hop/`.
- Hold anywhere to charge (the longer, the further), release to jump. Space bar on a desktop, Escape pauses.

## Core loop

1. The shape rests on a pad. Holding squashes it and fills a thin ring around it.
2. Releasing launches it on a parabola. Full charge flies about 270 px; no charge about 44 px.
3. Land on a pad to continue. Land on the dot in the middle for a PERFECT and a growing streak. Miss and the run ends with a few ripples on the baseline.
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

The palette changes every 25 pads: Paper, Mist, Night, Ink, then around again. The background crossfades on the first landing in a new theme, and the UI flips to light text in the dark themes. There is no scenery, only a subtle gradient, a few soft out-of-focus circles for depth, the pads, the baseline, and the shape.

## Characters

Seven shapes, unlocked by best score: Square (0), Circle (25), Triangle (75), Diamond (150), Hexagon (300), Star (600), Plus (1200). Streak scoring grows fast, so these are further apart than they look. A character is a shape name and a color in `data.js`; the color is also the glow, the charge ring, the perfect popups and the UI accent. Paths live in `shapePath`, so adding one is a few lines.

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

- Squash on charge, stretch in the air, a bounce on landing. Particles are only small dots and thin rings: a few accent dots and a faint ring on takeoff, a faint trail in the air, muted dots on landing, two expanding rings and a burst of accent dots on a perfect, three ripples on the baseline on a miss.
- Depth comes from a vertical gradient and a soft shadow on each pad, a gradient and a colored glow on the shape, and the soft background circles. Nothing has an outline.
- The palette lives in `data.js` (`themes`). The UI is typography on the background: light weights, small letter-spaced caps for labels, a solid ink pill for the primary button, outlined pills for the rest.
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
