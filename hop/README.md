# Hop

A square, a mountain, a slingshot. Pull back, release, and the square launches the opposite way. Gravity, spin, bounce, slide and friction do the rest. The score is the highest point you touch, in meters, and the best height is kept. Flat pastel fills and nothing else: no background, no shadows, no round shapes.

## Play

- Open `hop/index.html` from the published site, or serve the repo root locally (`python3 -m http.server 8123`) and open `http://localhost:8123/hop/`.
- Press anywhere, pull back like a slingshot, release. Pulling further gives more speed; the direction is the opposite of the pull. Pulls shorter than 12 px are ignored, so a tap does nothing. Escape pauses.

## Core loop

1. The square rests on a ledge. A pull shows a band toward the finger and a dashed line the way the square will go, its length showing the power.
2. On release it flies on a real parabola, spinning.
3. It is a rigid body: its four corners hit the mountain, not a point under it. A corner that lands first tips the square over; a face that lands flat stops it. Impacts bounce a little, friction acts at the corners, and both put torque on the body, so it tumbles, skids and rights itself the way a block does.
4. Flat ledges and gentle slopes (under about 23°) let it come to rest on a face. On steeper ground friction cannot hold it: it slides or tumbles back down, over edges and into the air again, until it finds a ledge lower down. The rewind is the physics, not a menu.
5. Walls are just steep surfaces: corners bounce off them. Crevasses are slots in the mountain: fall into one and the run ends. Falling to the foot of the mountain, or twelve seconds without touching anything, ends it too.
6. Every ground contact updates the highest point reached. A rest higher than the last rest shows the meters gained; a rest lower shows where you slid back to.

A run is a minute or a few. Restart is one tap.

## Smoothness

Physics runs on a fixed 1/240 s step inside an accumulator, so every phone plays the same launch. Rendering interpolates the square's position and rotation between the last two physics states by the accumulator remainder, so frames that happen to contain three steps and frames that contain five look identical: the motion is smooth at 60 Hz and 120 Hz alike. The camera follows the interpolated position with a gentle exponential lag.

## Physics

All numbers live in `data.js`. Gravity 1800 px/s², launch speed up to 820 px/s at a full 140 px pull, so a full-power launch can gain at most about 187 px (19 m) straight up, or carry about 370 px on the flat.

Each fixed step moves and rotates the square, then runs three passes over its four corners. A corner below the mountain's outline is pushed out toward the nearest point of the outline (crevasse walls and floors are part of the outline, so a corner is never pushed up through rock). If the corner is moving into the surface it receives a normal impulse with restitution 0.25, or none at all below 40 px/s so resting contacts stay still, then a Coulomb friction impulse capped at 0.42 times the normal impulse. Both impulses act at the corner, so they change the spin as well as the velocity; the moment of inertia is that of a uniform square. The square is asleep, and can be launched, after a quarter second in contact with speed under 14 px/s and spin under 0.7 rad/s. Two safety nets exist for things that should never happen: a center found inside rock is lifted onto the surface, and twelve seconds without any contact counts as a fall.

`simulateLaunch(vx, vy)` runs the same integrator without side effects and `solveTo(ledge)` scans angles and powers for a launch that rests on a given ledge; the demo behind the menu uses it, and so do the tests.

## The mountain

The mountain is one polyline generated left to right and upward: flat safe ledges separated by obstacles, at most two obstacles between ledges. Obstacles are rising slopes (18–56°, steeper with height), vertical steps (20–100 px), crevasses (30–110 px wide, 200 px deep) and the occasional descent. Each obstacle pair is checked against a full pull from the end of the last ledge: it may not demand more than 135 px of height gain or more than 80 percent of the theoretical range for that gain, so the next ledge is always reachable, even if not easily. Difficulty ramps over the first 300 m of climb. One pixel is 10 cm; height marks appear every 50 m.

## Palettes

Four flat palettes, one every 60 m of best height in the run: Cream, Mint, Lilac, Dusk. Each is a background, a mountain color, a ledge color and two text colors. They crossfade when the square comes to rest in a new band, and the UI flips to light text in Dusk. The square is always the same coral.

## Daily

One mountain per day, seeded from the date so everyone climbs the same one. One try. The share button produces the day, the height climbed and a strip of squares: green for a higher rest, yellow for a slide back, red for the fall. The day number counts from 2026-09-29.

## Feel

- Squash toward the pull while aiming, a stretch on launch, a squash scaled by each impact, spin in the air, and the tumble, skid or clean landing that the corners produce.
- Particles are tiny spinning squares on launch and on bounces.
- Optional synthesized sound: a rising tone while pulling, a thock on launch, ticks on bounces, a two-note chime on gaining height, a low drop on a fall. Fully playable on mute.
- Haptics go through the same `haptic()` hook as Next Stop. The game pauses itself in the background and cancels a pull in progress.

## Tech

Vanilla JavaScript, one canvas, no dependencies, no build step. Logical width 390 px, a 2D camera that keeps the square left of center and at 62 percent of the height. Progress is in `localStorage` under `hop.v4`. `window.Hop` exposes state plus `simulateLaunch`, `solveTo`, `groundAt`, `nextLedge`, `aimVector` and `launch` for tests and tuning. Installable and offline capable via `manifest.webmanifest` and `sw.js`.

## Ship to the App Store

Same recipe as Next Stop: Capacitor with `--web-dir hop`, portrait only, and haptics start working through `haptic()`.

## Roadmap

- Wind higher up, shown as a small arrow, that pushes the square in flight.
- Loose rocks: a ledge that gives way after a few rests.
- Game Center leaderboard once wrapped.
