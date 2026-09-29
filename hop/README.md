# Hop

A square, a mountain, a slingshot. Pull back, release, and the square launches the opposite way. Gravity, spin, bounce, skid and friction do the rest. The score is the highest point you touch, in meters, and the best height is kept. Flat pastel fills and nothing else: no background, no shadows, no round shapes. Every line is horizontal, vertical or a 45° diagonal, and no corner of the mountain is acute.

## Play

- Open `hop/index.html` from the published site, or serve the repo root locally (`python3 -m http.server 8123`) and open `http://localhost:8123/hop/`.
- Press anywhere, pull back like a slingshot, release. Pulling further gives more speed; the direction is the opposite of the pull. Pulls shorter than 12 px are ignored, so a tap does nothing. Escape pauses.

## Core loop

1. The square rests on a ledge. A pull shows a band toward the finger and a dashed line the way the square will go, its length showing the power.
2. On release it flies on a real parabola with a slow tumble.
3. It is a rigid body: its four corners hit the mountain, not a point under it. A corner that lands first tips the square over; a face that lands flat stops it. Impacts bounce a little, friction acts at the corners, and both put torque on the body, so it tumbles, skids and rights itself the way a block does. It never changes shape.
4. A block does not roll. Once two corners sit on the same surface the square is lying on a face: its spin is killed and the face is kept flush, so it skids to a stop without turning. While any corner touches the ground its spin decays fast, so a corner landing tips it onto a face and that is the end of it, about one quarter turn on average. Land on a 45° ramp and it slides back down on its face to the ledge below; clip a step and it tumbles down. The rewind is the physics, not a menu.
5. Steps are vertical: hit one in flight and the square bounces off it and drops. Crevasses are slots in the mountain with a visible floor: fall into one and the run ends. They only appear above 50 m, so the first climb cannot end in one. Falling to the foot of the mountain, or twelve seconds without touching anything, ends it too.
6. Every ground contact updates the highest point reached. A rest higher than the last rest shows the meters gained; a rest lower shows where you slid back to.

A run is a minute or a few. Restart is one tap.

## Smoothness

Physics runs on a fixed 1/240 s step inside an accumulator, so every phone plays the same launch. Rendering interpolates the square's position and rotation between the last two physics states by the accumulator remainder, so frames that happen to contain three steps and frames that contain five look identical: the motion is smooth at 60 Hz and 120 Hz alike. The camera follows the interpolated position with a gentle exponential lag.

## Physics

All numbers live in `data.js`. Gravity 1800 px/s², launch speed up to 820 px/s at a full 140 px pull, so a full-power launch can gain at most about 187 px (19 m) straight up, or carry about 370 px on the flat.

Each fixed step moves and rotates the square, then runs three passes over its four corners. A corner below the mountain's outline is pushed out toward the nearest point of the outline (crevasse walls and floors are part of the outline, so a corner is never pushed up through rock). If the corner is moving into the surface it receives a normal impulse with restitution 0.2, or none at all below 40 px/s so resting contacts stay still, then a Coulomb friction impulse capped at 0.6 times the normal impulse. When two corners touch one surface, the spin is damped to a fifth per step and the face is pulled flush with the surface, so the square slides like a block rather than rolling like a wheel. While any corner touches, spin decays at 25 per second. Launch spin is 0.12 of speed over half the side, about one turn per second at a full pull. Both impulses act at the corner, so they change the spin as well as the velocity; the moment of inertia is that of a uniform square. The square is asleep, and can be launched, after a quarter second in contact with speed under 14 px/s and spin under 0.7 rad/s. Two safety nets exist for things that should never happen: a center found inside rock is lifted onto the surface, and twelve seconds without any contact counts as a fall.

`simulateLaunch(vx, vy)` runs the same integrator without side effects and `solveTo(ledge)` scans angles and powers for a launch that rests on a given ledge. `solveNext()` adds the move a stuck player makes: when nothing reaches the next ledge from where the square stands (flush against a step, say), it hops elsewhere on the same ledge and tries from there. The demo behind the menu uses it, and so do the tests.

## The mountain

The mountain is one polyline of horizontals, verticals and 45° diagonals generated left to right: flat ledges separated by one or two obstacles. Obstacles are steps up (20–100 px, taller with height), 45° ramps (20–110 px of rise), crevasses (30–110 px wide, 150 px deep, only above 50 m) and rarely a small step down or 45° descent (16–40 px), so the mountain goes up. Pairs are limited to shapes that keep every corner of the outline at 90° or wider and never put two verticals at one x: crevasse then step, crevasse then ramp, step down or descent into a crevasse, ramp then step, step then ramp. Ledges shrink from 60–120 px to 44–90 px as the climb goes on, and no group may ask for more than 135 px of height in one launch.

Every group is proven before it is kept: the generator test-flies launches from the middle of the previous ledge with the real physics (six angles, 24 powers) and keeps the group only if at least five of them come to rest on the new ledge. A typical ledge gets about 27. A group that fails is rolled again a little smaller, up to eight times, then a modest single step goes in. The run starts with 700 px of mountain and adds one attempt per frame while the square rests, so nothing stalls a flight. Difficulty ramps over the first 300 m of climb. One pixel is 10 cm; height marks appear every 50 m.

## Palettes

Four flat palettes, one every 60 m of best height in the run: Cream, Mint, Lilac, Dusk. Each is a background, a mountain color, a ledge color and two text colors. They crossfade when the square comes to rest in a new band, and the UI flips to light text in Dusk. The square is always the same coral.

## Daily

One mountain per day, seeded from the date so everyone climbs the same one. One try. The share button produces the day, the height climbed and a strip of squares: green for a higher rest, yellow for a slide back, red for the fall. The day number counts from 2026-09-29.

## Feel

- The square is rigid: no squash or stretch, only a slow tumble in the air and the tip, skid or clean landing that the corners produce.
- Particles are tiny spinning squares on launch and on bounces.
- Optional synthesized sound: a rising tone while pulling, a thock on launch, ticks on bounces, a two-note chime on gaining height, a low drop on a fall. Fully playable on mute.
- Haptics go through the same `haptic()` hook as Next Stop. The game pauses itself in the background and cancels a pull in progress.

## Tech

Vanilla JavaScript, one canvas, no dependencies, no build step. Logical width 390 px, a 2D camera that keeps the square left of center and at 62 percent of the height. Progress is in `localStorage` under `hop.v4`. `window.Hop` exposes state plus `start(mode, seed)`, `simulateLaunch`, `solveTo`, `solveNext`, `reachable`, `nextLedge`, `aimVector`, `launch` and a synchronous `settle()` for tests and tuning. Installable and offline capable via `manifest.webmanifest` and `sw.js`.

## Ship to the App Store

Same recipe as Next Stop: Capacitor with `--web-dir hop`, portrait only, and haptics start working through `haptic()`.

## Roadmap

- Wind higher up, shown as a small arrow, that pushes the square in flight.
- Loose rocks: a ledge that gives way after a few rests.
- Game Center leaderboard once wrapped.
