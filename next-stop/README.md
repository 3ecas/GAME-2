# Next Stop

Hold to brake. Stop on the line. A one-thumb metro game for playing on the metro.

Runs in Safari with no install. Add it to the iPhone home screen and it opens full screen, works offline, and remembers progress. The same code can be wrapped for the App Store with Capacitor (see below).

## Play

- Open `next-stop/index.html` from the published site, or serve the repo root locally (`python3 -m http.server 8123`) and open `http://localhost:8123/next-stop/`.
- Hold anywhere to brake, release to coast. You can pump the brake.
- On a desktop the space bar brakes, Escape pauses.

## Core loop

1. The train leaves a station and accelerates on its own to the cruise speed for that station number. Power stays on and holds that speed until the player first touches the brake in the segment; after that the train coasts with slight rolling resistance, so a brake tapped too early can leave it stranded in the tunnel.
2. A station comes into view. A thin radar bar on the right edge shows the next stop line sliding toward the train before it is on screen. Wet rails start raining one screen early.
3. The player holds to brake. The front of the train (cyan marker) must come to rest on the white stop line.
4. The result is scored, doors open for about a second, passengers board, and the train leaves for the next station.
5. The run ends on the first miss.

A run is 30 seconds to 3 minutes. Restart is one tap.

## Scoring

| Result | Condition | Points |
| --- | --- | --- |
| Perfect | front within the thin bright band | 3 + streak bonus (streak minus 1, capped at 7) |
| Good | front within the wide colored band | 1, streak resets |
| Skipped | drove through a skip station | 2 |
| Miss | overshot the wide band, stopped before it, stopped at a skip station | run ends |

The headline number is points. Stations count and perfect count are shown too and go into the share text.

## Difficulty

Within a run, per station number `k`:

- Cruise speed `v = min(vmax, v0 + k * dv)`.
- The good and perfect bands shrink linearly from their start value to their end value over `ramp` stations.
- From station 3, a station can have wet rails (brakes at 70 percent, rain starts 1000 px before the platform).
- From station 6, a station can be a skip station (red hatching, no stop line, drive through). Never two in a row.

Across lines, later lines start faster, cap higher, and have narrower bands. All numbers live in `lines.js` with a comment explaining each field.

## Lines and unlocks

Eight lines inspired by real cities. Place names and plain colors only, no logos. A line opens when the player's total stops (lifetime stations passed) reaches its `unlock` value.

| Line | Opens at |
| --- | --- |
| Lisboa · Linha Azul | 0 |
| Porto · Linha Amarela | 30 |
| London · Central | 80 |
| Paris · Ligne 6 | 150 |
| Berlin · U9 | 240 |
| New York · 7 Flushing | 350 |
| Tokyo · Tozai | 480 |
| Mexico City · Línea 1 | 640 |

Adding a line is a new object in `lines.js`.

## Daily

One run per day, seeded from the date so everyone gets the same stations, on a line that rotates daily through all eight (locked ones included, as a taste). One try. The result screen has a share button that produces:

```
Next Stop 🚇 Daily #12
Lisboa · Linha Azul
14 stations · 9 perfect · 61 pts
🟩🟩🟨🟩🟩🟩🟨🟩🟩🟩🟩🟨🟩🟥
https://…/next-stop/
```

The day number counts from 2026-09-28.

## Feel

- Feedback is visual first: brake lights, sparks, screen shake on a miss, popups with the offset in meters on a good stop.
- Sound is optional synthesized WebAudio (brake hiss, chimes, door beeps). The game is fully playable on mute, and the toggle is on the menu.
- Haptics: `haptic()` in `game.js` calls the Capacitor Haptics plugin when present, otherwise `navigator.vibrate` where supported. Safari on iPhone has neither, so the web version has no haptics until it is wrapped.
- The game pauses itself when the app goes to the background and resumes on tap.

## Tech

- Vanilla JavaScript, one canvas, no dependencies, no build step.
- Logical width is fixed at 390 px; height follows the device. World units are px, and 1 px is about 10 cm for the on-screen offsets.
- `manifest.webmanifest` and `sw.js` make it installable and offline capable (network first, cache fallback).
- Progress is in `localStorage` under `nextstop.v1`.
- `window.NextStop` exposes state for tests and console tuning.

## Ship to the App Store

1. On a Mac with Xcode: `npm init -y && npm i @capacitor/core @capacitor/cli @capacitor/ios @capacitor/haptics`.
2. `npx cap init "Next Stop" com.yourname.nextstop --web-dir next-stop`.
3. `npx cap add ios && npx cap sync && npx cap open ios`.
4. Set the app to portrait only and hide the status bar in the Xcode target. Haptics start working automatically through `haptic()`.

## Roadmap

- Short platforms (narrower bands) and downhill segments as later variants.
- A ghost of your best run on the daily.
- Game Center leaderboard per line once wrapped.
