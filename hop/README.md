# Hop

A square, some platforms, a slingshot. Pull back, release, and the square launches the opposite way. Gravity, spin, bounce and slide do the rest. Land on the next platform to score. Flat pastel rectangles and nothing else: no background, no shadows, no round shapes.

## Play

- Open `hop/index.html` from the published site, or serve the repo root locally (`python3 -m http.server 8123`) and open `http://localhost:8123/hop/`.
- Press anywhere, pull back like a slingshot, release. Pulling further gives more speed; the direction is the opposite of the pull. Pulls shorter than 12 px are ignored, so a tap does nothing. Escape pauses.

## Core loop

1. The square rests on a platform. A pull shows a short band toward the finger and a dashed line the way the square will go, its length showing the power.
2. On release the square flies on a real parabola, spinning forward.
3. On landing it bounces (30 percent of its downward speed comes back, 45 percent of its forward speed is lost), then slides with friction until it stops. If it slides off an edge it falls again. Once at rest it settles onto a flat side.
4. Stop on a platform beyond the current one and you score one point per platform passed, so clearing two at once is worth 2.
5. Falling below the platforms, or hitting the side of one and dropping, ends the run.

## Physics

All numbers live in `data.js`. Gravity 1800 px/s², launch speed up to 820 px/s at a full 140 px pull, so a flat 45° launch carries about 370 px. Bounce restitution 0.3, surface friction on each bounce 0.55, sliding deceleration 420 px/s². The square is integrated with a fixed step of 1/240 s inside an accumulator, so a 60 Hz phone and a 120 Hz phone play the same launch. `simulateLaunch(vx, vy)` runs the same integrator without side effects and `solveLaunch(j)` scans angles and powers for a launch that rests on platform `j`; the demo behind the menu uses it, and so do the tests.

## Course

Platforms are generated one at a time. Each new one is placed at a random gap and height change from the previous, and the gap is capped so the platform is reachable at full pull from anywhere on the previous one, including uphill. Over the first 50 platforms the widths shrink from 84–124 px to 46–72 px, the gaps grow from 50–130 px to 100–190 px, and the height changes grow from ±30 px to 110 px up or 80 px down. Platforms stay within 320 px of the first one's height.

## Palettes

Four flat palettes, one every 25 platforms: Cream, Mint, Lilac, Dusk. Each is a background, a platform color and two text colors. They crossfade on the first landing in a new palette, and the UI flips to light text in Dusk. The square is always the same coral.

## Daily

One course per day, seeded from the date so everyone plays the same platforms. One try. The share button produces a line with the day, the platform count and a strip of squares, and the day number counts from 2026-09-29.

## Feel

- Squash toward the pull while aiming, a stretch on launch, squash on every bounce, spin in the air, slide-out on the platform.
- Particles are tiny spinning squares on launch and on bounces.
- Optional synthesized sound: a rising tone while pulling, a thock on launch, ticks on bounces, a two-note chime on scoring, a low drop on a fall. Fully playable on mute.
- Haptics go through the same `haptic()` hook as Next Stop. The game pauses itself in the background and cancels a pull in progress.

## Tech

Vanilla JavaScript, one canvas, no dependencies, no build step. Logical width 390 px, a 2D camera that keeps the resting square near the left and at 60 percent of the height. Progress is in `localStorage` under `hop.v3`. `window.Hop` exposes state plus `simulateLaunch`, `solveLaunch`, `aimVector` and `launch` for tests and tuning. Installable and offline capable via `manifest.webmanifest` and `sw.js`.

## Ship to the App Store

Same recipe as Next Stop: Capacitor with `--web-dir hop`, portrait only, and haptics start working through `haptic()`.

## Roadmap

- Moving platforms after a while.
- A dead-center bonus if the scoring wants more depth.
- Game Center leaderboard once wrapped.
