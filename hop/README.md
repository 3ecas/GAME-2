# Hop

Hold to charge, release to hit. The shape flies, spins, bounces and rolls out. Stop it on the green to move on, roll it into the cup on your first stroke for a perfect. A side-view chip-shot game for one thumb, drawn in flat pastel geometry: no shadows, no gradients, no outlines.

## Play

- Open `hop/index.html` from the published site, or serve the repo root locally (`python3 -m http.server 8123`) and open `http://localhost:8123/hop/`.
- Hold anywhere to charge (a ring fills around the shape), release to hit. Space bar on a desktop, Escape pauses.

## Core loop

1. The shape rests on the ground. Every hit leaves at the same angle; holding longer means more speed.
2. It flies on a real parabola, spinning forward. On landing it bounces (a third of its downward speed comes back, half its forward speed is lost to the surface), then rolls with friction until it stops.
3. Water is a miss: the channel right after every green, and on later holes a hazard cutting the fairway.
4. Stop on the **green** and the hole is done, worth 1. Stop short on the fairway and you hit again from there, up to three strokes per hole.
5. Roll over the **cup** slowly enough and the shape drops in. On the first stroke of a hole that is a PERFECT, worth 2 × streak (2, 4, 6, 8…). On a later stroke it is IN, worth 2, and the streak resets.

A run is a minute or a few. Restart is one tap.

## Physics

All numbers live in `data.js`. Gravity 1800 px/s², launch angle 52°, launch speed 300 to 690 px/s, so a full hit carries about 257 px in the air before the roll. Bounce restitution 0.32, surface friction on each bounce 0.5, rolling deceleration 320 px/s². The cup takes the ball when it rolls over at under 160 px/s, or lands on it at under 220 px/s.

The ball is integrated with a fixed step of 1/240 s inside an accumulator, so a 60 Hz phone and a 120 Hz phone play the same shot from the same hold. `simulateShot(power)` runs the same integrator without side effects; `solveShot(x)` scans powers to find the one that sinks or stops closest to a point. The demo behind the menu uses it, and so do the tests.

## Course

Every hole is generated in sequence: a water channel right after the previous green, a stretch of fairway, then the green with its cup somewhere between 35 and 65 percent of the way along. Over the first 50 holes the channel widens from 30 to 56 px, the green narrows from 70–110 px to 46–72 px, and from hole 6 a water hazard can cut the fairway with rising odds. The camera keeps the resting shape near the left edge so the flag is always in view.

## Scoring

| Result | Points |
| --- | --- |
| Perfect (in the cup on the first stroke) | 2 × streak |
| In the cup on a later stroke | 2, streak resets |
| Stopped on the green | 1, streak resets |
| Water, or three strokes without reaching the green | run ends |

## Shapes

Seven shapes, unlocked by best score: Square (0), Circle (25), Triangle (75), Diamond (150), Hexagon (300), Star (600), Plus (1200). A shape is a name and a pastel in `data.js`; the pastel is also the flag, the charge ring and the perfect popups. Paths live in `shapePath`. Every shape has a small off-center dot so the spin reads even on the circle.

## Palettes

Four flat pastel palettes, one every 15 holes: Meadow, Peach, Lilac, Dusk. Sky, ground, green and water are plain fills; the only "detail" is a flat sun. Colors crossfade on the first hole of a new palette, and the UI flips to light text in Dusk.

## Daily

One course per day, seeded from the date so everyone plays the same holes. One try. The share button produces a line of score, holes and streak plus a strip of squares, and the day number counts from 2026-09-29.

## Feel

- Squash on charge and on every bounce, spin in the air, roll-out on the ground.
- Particles are small flat dots and thin rings: a few on the hit and each bounce, a burst and two rings on a perfect, ripples on a splash.
- Optional synthesized sound: a rising tone while charging, a thock on the hit, ticks on bounces, chimes that climb with the streak, a splash. Fully playable on mute.
- Haptics go through the same `haptic()` hook as Next Stop. The game pauses itself in the background and cancels a charge in progress.

## Tech

Vanilla JavaScript, one canvas, no dependencies, no build step. Logical width 390 px, ground at 68 percent of the height. Progress is in `localStorage` under `hop.v2`. `window.Hop` exposes state plus `simulateShot`, `solveShot`, `hitWithPower` and `groundAt` for tests and tuning. Installable and offline capable via `manifest.webmanifest` and `sw.js`.

## Ship to the App Store

Same recipe as Next Stop: Capacitor with `--web-dir hop`, portrait only, and haptics start working through `haptic()`.

## Roadmap

- Wind, shown as a small arrow, that shifts the flight a little.
- Slopes on the green that curve the roll.
- Game Center leaderboard once wrapped.
