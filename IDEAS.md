# Game ideas

Brief: a simple, addictive iPhone game with light progression, built for short sessions on the metro, the bus, or the bathroom. Something catchy.

## Ground rules for a commute game

- Portrait, one thumb. Every control reachable from the bottom third of the screen.
- No tilt controls. Buses shake.
- Fully playable on mute. Feedback comes through visuals and haptics.
- Runs of 30 seconds to 3 minutes. Instant pause when interrupted. Restart in under half a second.
- Works offline.
- Whatever the pick, add a daily seeded challenge with a shareable result. That is the glue that turns "one more try" into "every day".

## Candidates

### 1. Next Stop

You drive the metro. Hold to brake, release, and stop the train with the doors lined up on the platform.

- A perfect stop builds a streak multiplier. An overshoot ends the run.
- Difficulty ramps: stations arrive faster, rails get wet, slopes change braking distance, express runs skip stations.
- Progression: unlock lines inspired by real cities, each with its own colors, trains and quirks. Use inspired-by names and colors, not real logos.
- Why it is catchy: the player is literally on the metro. City pride makes it shareable. iPhone haptics make the braking feel great.

### 2. Zipper

Traffic merge as a timing game. Cars stream past, your queue waits on the on-ramp, and you tap to release the front car into a gap.

- Bikes fit small gaps, trucks need big ones, an ambulance must get through.
- Near misses feel amazing. Clean back-to-back merges build combos.
- Progression: vehicle skins, highways with weather, a daily seeded run with a leaderboard.

### 3. Pour

A water-sort puzzle where colors mix. Tap a glass, tap another, and blue poured into yellow makes green.

- Each level asks for specific colors in specific glasses, so you plan instead of just sorting.
- No timer, so interruptions cost nothing.
- Progression: hundreds of levels in chapters, stars, hints.
- Sort puzzles are known for strong retention in casual. Mixing adds an "aha" the clones lack.
- Needs a solver to guarantee that generated levels are solvable.

### 4. Pack

A block-fit puzzle themed as packing a suitcase. Drag tetromino-shaped items into the case and complete rows to "zip" and clear them.

- Levels are trips: beach, ski, safari, space.
- Progression: suitcases, and a souvenir collection per trip.
- Block-fit has been one of the most downloaded casual genres for years. The theme and the collection are what make it yours.

### 5. Sushi Belt

Plates pass on a conveyor and a ticket shows the order. Tap the right plates in sequence.

- The belt speeds up, orders get longer, lookalike dishes appear.
- Reaction plus short-term memory, with a charming art style doing the marketing.
- Progression: dishes, restaurants, regular customers with special requests.

### 6. Rank

A daily ritual in the Wordle mold. Put five things in order, like animals by speed or cities by population.

- Drag, submit, get green or yellow per slot, three tries, then share a colored grid.
- Progression: streaks and categories.
- Cheapest to build and strongest for word of mouth. Needs a steady content pipeline and categories that feel fair.

### 7. Hop

Hold to charge, release to jump to the next platform. Landing dead center builds a streak.

- The mechanic behind WeChat's Jump Jump, which reportedly passed a hundred million daily players at its peak.
- Proven and tiny to build. Weak on originality unless the theme carries it.

## Recommendation

Build **Next Stop** first. One mechanic, one thumb, a weekend to prototype in SpriteKit, and a marketing hook nobody else owns: the game about the metro, played on the metro. City lines are a cheap content pipeline, since a line is just colors, names and a few physics numbers.

- **Pour** if long-term revenue matters more than a splash.
- **Rank** if the goal is virality from the smallest build.
