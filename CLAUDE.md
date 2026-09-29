# GAME-2

Simple, addictive games for short sessions on the metro, bus, or bathroom. Web-first (vanilla HTML5 canvas, no build step), installable on iPhone from Safari, wrappable for the App Store with Capacitor.

## Workflow

- Commit and push directly to `main`. Do not create feature branches or pull requests unless asked.
- Every push to `main` deploys the repo root to GitHub Pages via `.github/workflows/static.yml` (the one GitHub generated when Pages was enabled).

## Layout

- `index.html` is the hub page linking to each game.
- One folder per game, self-contained: `next-stop/` (metro braking) and `hop/` (slingshot mountain climber: one square, a flat mountain, real physics, score is height) are live; maybe `sushi-belt/` next. Rank was dropped.
- `IDEAS.md` holds the concept shortlist. Each game has its own `README.md` with the design and tuning notes.

## Conventions

- Portrait, one thumb, no tilt controls, fully playable on mute, works offline, restart in under half a second.
- Plain scripts (no ES modules) so a game also runs from `file://`.
- Keep all tuning numbers in one data file per game with a comment per field.
- Expose a small `window.<Game>` object with state and a `start()` for automated tests.

## Run and test

- Serve: `python3 -m http.server 8123` from the repo root, then open `http://localhost:8123/next-stop/` or `http://localhost:8123/hop/`.
- Headless checks use the globally installed Playwright: `NODE_PATH=/opt/node22/lib/node_modules node <script>.cjs` with `chromium.launch()`.
