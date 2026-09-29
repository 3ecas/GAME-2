/* Hop — pull back, release, climb the mountain.
   A square, a stepped mountain, a slingshot. Gravity, spin, bounce, skid, friction. Nothing else.
   Side-view 2D, one thumb, portrait, playable on mute, works offline. No dependencies, no build step. */
(() => {
  'use strict';

  // ---------- data & constants ----------
  const DATA = window.HOP_DATA;
  const T = DATA.tuning;
  const THEMES = DATA.themes;
  const SQUARE = DATA.square;
  const KEY = 'hop.v4';
  const LAUNCH_UTC = Date.UTC(2026, 8, 29);
  const LOGICAL_W = 390;
  const FONT = '-apple-system, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif';
  const TAU = Math.PI * 2;
  const RAD = Math.PI / 180;
  const HALF = T.SIZE / 2;
  const I_INV = 6 / (T.SIZE * T.SIZE); // inverse moment of inertia of a unit-mass square

  // ---------- helpers ----------
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const $ = (id) => document.getElementById(id);
  const meters = (px) => Math.max(0, Math.floor(px * T.M_PER_PX));

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function todayKey() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function dayNumber() {
    const d = new Date();
    const t = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.max(1, Math.floor((t - LAUNCH_UTC) / 86400000) + 1);
  }
  function rgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function hexA(hex, a) { const c = rgb(hex); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function mixHex(a, b, t) { const A = rgb(a), B = rgb(b); return 'rgb(' + Math.round(lerp(A[0], B[0], t)) + ',' + Math.round(lerp(A[1], B[1], t)) + ',' + Math.round(lerp(A[2], B[2], t)) + ')'; }

  // ---------- persistence ----------
  const Save = {
    d: { best: 0, daily: {}, sound: true, runs: 0 },
    load() {
      try { const raw = localStorage.getItem(KEY); if (raw) { const o = JSON.parse(raw); if (o && typeof o === 'object') Object.assign(this.d, o); } }
      catch (e) { /* storage blocked: play without saving */ }
    },
    save() { try { localStorage.setItem(KEY, JSON.stringify(this.d)); } catch (e) { /* ignore */ } },
  };
  Save.load();

  // ---------- sound (optional; fully playable on mute) ----------
  const Sfx = {
    ctx: null, aimOsc: null, aimGain: null,
    init() {
      if (this.ctx) return;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 180;
        const g = this.ctx.createGain(); g.gain.value = 0;
        o.connect(g); g.connect(this.ctx.destination); o.start();
        this.aimOsc = o; this.aimGain = g;
      } catch (e) { this.ctx = null; }
    },
    resume() { try { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); } catch (e) { /* ignore */ } },
    get on() { return Save.d.sound && !!this.ctx; },
    aim(p) {
      if (!this.ctx || !this.aimGain) return;
      const t = this.ctx.currentTime;
      if (p < 0 || !this.on) { this.aimGain.gain.setTargetAtTime(0, t, 0.03); return; }
      this.aimGain.gain.setTargetAtTime(0.04, t, 0.03);
      this.aimOsc.frequency.setTargetAtTime(160 + 380 * p, t, 0.03);
    },
    tone(f, dur, type, vol, when, slide) {
      if (!this.on) return;
      try {
        const t = this.ctx.currentTime + (when || 0);
        const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
        o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
        if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(this.ctx.destination); o.start(t); o.stop(t + dur + 0.05);
      } catch (e) { /* ignore */ }
    },
    launch(p) { this.tone(240 + 160 * p, 0.09, 'triangle', 0.2, 0, 90); },
    bounce(v) { this.tone(170 + v * 0.08, 0.05, 'triangle', clamp(v / 900, 0.04, 0.14), 0, 130); },
    up() { this.tone(520, 0.08, 'sine', 0.14); this.tone(780, 0.16, 'sine', 0.14, 0.08); },
    fall() { this.tone(200, 0.45, 'sawtooth', 0.14, 0, 50); },
  };
  function haptic(kind) {
    try {
      const cap = window.Capacitor, Hp = cap && cap.Plugins && cap.Plugins.Haptics;
      if (Hp) { if (kind === 'score') Hp.notification({ type: 'SUCCESS' }); else if (kind === 'fail') Hp.notification({ type: 'ERROR' }); else Hp.impact({ style: 'LIGHT' }); }
      else if (navigator.vibrate) navigator.vibrate(kind === 'fail' ? [60, 40, 60] : kind === 'score' ? [20, 30, 20] : 12);
    } catch (e) { /* ignore */ }
  }

  // ---------- DOM ----------
  const canvas = $('c');
  const ctx = canvas.getContext('2d');
  const el = {
    game: $('game'), hud: $('hud'), mode: $('hud-mode'), score: $('hud-score'), combo: $('hud-combo'), best: $('hud-best'), hint: $('hud-hint'),
    menu: $('menu'), over: $('over'), pause: $('pause'), help: $('help'), mStats: $('m-stats'),
    play: $('play'), daily: $('daily'), helpBtn: $('help-btn'), soundBtn: $('sound-btn'), helpClose: $('help-close'),
    oEyebrow: $('o-eyebrow'), oTitle: $('o-title'), oStats: $('o-stats'), oBest: $('o-best'), oStrip: $('o-strip'), oUnlock: $('o-unlock'),
    oAgain: $('o-again'), oShare: $('o-share'), oMenu: $('o-menu'),
  };

  // ---------- state ----------
  let state = 'menu'; // menu | playing | paused | over
  let run = null;
  let cssW = 390, cssH = 800, dpr = 1, scale = 1, H = 800;
  let lastT = 0;

  function resize() {
    cssW = el.game.clientWidth || window.innerWidth;
    cssH = el.game.clientHeight || window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    scale = cssW / LOGICAL_W;
    H = cssH / scale;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
  }

  // ---------- the mountain ----------
  const themeFor = (m) => Math.floor(m / T.THEME_M) % THEMES.length;
  const theme = () => THEMES[run.theme];
  const pick = (range, d, u) => lerp(lerp(range[0][0], range[1][0], d), lerp(range[0][1], range[1][1], d), u);

  // The mountain of the current run. Kept outside `run` so terrain generation can test-fly launches over it
  // before the run is installed.
  let segs = [];
  const BASE_Y = 320; // falling below the start ledge by this much ends the run

  function newRun(mode, demo, seedIn) {
    const seed = seedIn !== undefined ? seedIn >>> 0 : mode === 'daily' ? hashStr('hop4:' + todayKey()) : (Math.random() * 4294967296) >>> 0;
    const r = {
      mode, demo: !!demo, seed, rng: mulberry32(seed), t: 0,
      segs: [], maxH: 0, restH: 0, results: [], startBest: Save.d.best,
      ball: { x: 0, y: -HALF, vx: 0, vy: 0, ang: 0, av: 0, state: 'rest', hit: false, restT: 0, airT: 0, groundY: 0, cx: 0, cy: 0, px: 0, py: -HALF, pang: 0 },
      alpha: 1, aim: null, acc2: 0, cam: { x: -LOGICAL_W * T.CAM_X, y: -600 * T.CAM_Y }, popups: [], parts: [], shake: 0,
      dead: false, deadReason: '', deadT: 0, theme: 0, themeFrom: 0, themeMix: 1, hinted: false, demoT: 0, demoV: null, dailyResult: null,
    };
    segs = r.segs;
    addSeg(r, -120, 0, 120, 0, 'ledge');
    genTerrain(r, 700);
    r.cam.y = -H * T.CAM_Y;
    return r;
  }
  function line(x0, y0, x1, y1) { const len = Math.hypot(x1 - x0, y1 - y0) || 1; return { x0, y0, x1, y1, nx: (y1 - y0) / len, ny: -(x1 - x0) / len }; }
  function addSeg(r, x0, y0, x1, y1, kind) {
    const floor = kind === 'hole' ? Math.max(y0, y1) + T.HOLE_DEPTH : 0;
    const pit = floor + 80;
    const lines = kind === 'hole' ? [line(x0, y0, x0, pit), line(x0, pit, x1, pit), line(x1, pit, x1, y1)] : [line(x0, y0, x1, y1)];
    r.segs.push({ x0, y0, x1, y1, kind, floor, pit, lines });
  }
  function addLedge(r, x, y, d) { addSeg(r, x, y, x + pick(T.LEDGE, d, r.rng()), y, 'ledge'); }
  // Between two ledges come one or two obstacles: a step up, a crevasse, a step down. Nothing is ever sloped.
  // Steps have no width, so the only pairs are a crevasse whose far rim is the foot of a step, and a step down
  // straight into a crevasse; anything else would put two verticals at one x and make a fin or a crack.
  // A group is kept only when the physics can land on its ledge from the middle of the ledge before it, with
  // a few different launches so a near miss still has a chance; otherwise it is rolled again, a little smaller.
  // The run starts with a short stretch and adds one group per frame as the square climbs, so no frame stalls.
  function genTerrain(r, untilX) {
    while (r.segs[r.segs.length - 1].x1 < untilX) tryGroup(r);
  }
  // One attempt at the next group: rolls it, keeps it if its ledge is reachable, else discards it for the next call.
  // After eight failed attempts a modest single step goes in, which a half pull clears. Returns true when a group went in.
  function tryGroup(r) {
    const from = r.segs[r.segs.length - 1], rng = r.rng, attempt = r.attempt || 0;
    const d = clamp((-from.y1 * T.M_PER_PX) / T.RAMP_M, 0, 1), n0 = r.segs.length;
    if (attempt >= 8) {
      addSeg(r, from.x1, from.y1, from.x1, from.y1 - 30, 'wall'); addLedge(r, from.x1, from.y1 - 30, d);
      r.attempt = 0; return true;
    }
    r.attempt = attempt + 1;
    const shrink = Math.pow(0.85, attempt);
    let kinds;
    if (rng() < lerp(T.LEDGE_P[0], T.LEDGE_P[1], d)) { const roll = rng(); kinds = [roll < 0.55 ? 'wall' : roll < 0.85 ? 'hole' : 'drop']; }
    else kinds = rng() < 0.65 ? ['hole', 'wall'] : ['drop', 'hole'];
    let x = from.x1, y = from.y1, gain = 0;
    for (const kind of kinds) {
      if (kind === 'wall') { const h = Math.round(pick(T.WALL_H, d, rng()) * shrink); addSeg(r, x, y, x, y - h, 'wall'); y -= h; gain += h; }
      else if (kind === 'hole') { const w = Math.round(pick(T.HOLE_W, d, rng()) * shrink); addSeg(r, x, y, x + w, y, 'hole'); x += w; }
      else { const h = Math.round(lerp(T.DROP[0], T.DROP[1], rng())); addSeg(r, x, y, x, y + h, 'wall'); y += h; gain -= h; }
    }
    if (gain <= T.MAX_GAIN) {
      addLedge(r, x, y, d);
      if (reachable(from, r.segs[r.segs.length - 1])) { r.attempt = 0; return true; }
    }
    r.segs.length = n0;
    return false;
  }
  function segAt(x) {
    const s = segs; let lo = 0, hi = s.length - 1;
    if (x < s[0].x0 || x >= s[hi].x1) return null;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (s[mid].x1 <= x) lo = mid + 1; else hi = mid; }
    return s[lo];
  }
  // The surface under x: its height, unit direction (pointing right), signed steepness in degrees. Null over a crevasse or off the map.
  function groundAt(x) {
    const s = segAt(x);
    if (!s || s.kind === 'hole') return null;
    const len = Math.hypot(s.x1 - s.x0, s.y1 - s.y0) || 1, t = (x - s.x0) / (s.x1 - s.x0 || 1);
    return { y: s.y0 + (s.y1 - s.y0) * t, dx: (s.x1 - s.x0) / len, dy: (s.y1 - s.y0) / len, deg: Math.atan2(-(s.y1 - s.y0), s.x1 - s.x0) / RAD, seg: s };
  }
  function fallLine(x) { const s = segAt(x); return s && s.kind === 'hole' ? s.floor : BASE_Y; }
  // Height of the solid at x: the surface, or the floor of a crevasse. Anything below it is rock.
  function surfaceY(x) {
    const s = segAt(x);
    if (!s) return Infinity;
    if (s.kind === 'hole') return s.pit;
    return s.y0 + (s.y1 - s.y0) * ((x - s.x0) / (s.x1 - s.x0 || 1));
  }
  function segIndexAt(x) {
    const s = segs; let lo = 0, hi = s.length - 1;
    if (x < s[0].x0) return 0; if (x >= s[hi].x1) return hi;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (s[mid].x1 <= x) lo = mid + 1; else hi = mid; }
    return lo;
  }
  // Closest point on the mountain's outline to a point, searching the segments around x.
  function nearestLine(x, y) {
    const i = segIndexAt(x);
    let best = null;
    for (let j = Math.max(0, i - 3); j <= Math.min(segs.length - 1, i + 3); j++) {
      for (const L of segs[j].lines) {
        const dx = L.x1 - L.x0, dy = L.y1 - L.y0, len2 = dx * dx + dy * dy || 1;
        const t = clamp(((x - L.x0) * dx + (y - L.y0) * dy) / len2, 0, 1);
        const px = L.x0 + dx * t, py = L.y0 + dy * t, d = Math.hypot(x - px, y - py);
        if (!best || d < best.d) best = { d, px, py, line: L };
      }
    }
    return best;
  }
  function nextLedge(x) { for (const s of segs) if (s.kind === 'ledge' && s.x0 > x + 4) return s; return null; }

  // ---------- physics (fixed step; y grows downward) ----------
  // The square is a rigid body: position is its center, and its four corners collide with the mountain.
  function corners(b) {
    const c = Math.cos(b.ang), sn = Math.sin(b.ang), h = HALF;
    return [
      { x: b.x + c * h - sn * h, y: b.y + sn * h + c * h },
      { x: b.x - c * h - sn * h, y: b.y - sn * h + c * h },
      { x: b.x - c * h + sn * h, y: b.y - sn * h - c * h },
      { x: b.x + c * h + sn * h, y: b.y + sn * h - c * h },
    ];
  }
  // One step. Corners inside the rock are pushed out along the nearest surface; approaching corners get a
  // normal impulse (with restitution above BOUNCE_V) and a Coulomb friction impulse, both of which also spin the
  // body. Returns 'hit', 'rest', 'fall' or null.
  function stepBall(b, dt) {
    if (b.state !== 'air') return null;
    b.vy += T.G * dt;
    b.x += b.vx * dt; b.y += b.vy * dt; b.ang += b.av * dt;
    let contacts = 0, groundHits = 0, impact = 0, groundY = -Infinity, cx = 0, cy = 0;
    const normals = [];
    for (let it = 0; it < 3; it++) {
      for (const c of corners(b)) {
        if (!(c.y > surfaceY(c.x))) continue;
        const nl = nearestLine(c.x, c.y);
        if (!nl) continue;
        let nx, ny;
        if (nl.d > 0.3) { nx = (nl.px - c.x) / nl.d; ny = (nl.py - c.y) / nl.d; } else { nx = nl.line.nx; ny = nl.line.ny; }
        const corr = Math.max(nl.d - T.SLOP, 0) * T.CORR;
        b.x += nx * corr; b.y += ny * corr;
        const rx = c.x - b.x, ry = c.y - b.y;
        const vn = (b.vx - b.av * ry) * nx + (b.vy + b.av * rx) * ny;
        if (it === 0) { contacts++; normals.push({ nx, ny }); if (ny < -0.5) { groundHits++; if (c.y > groundY) { groundY = c.y; cx = c.x; cy = c.y; } } }
        if (vn >= 0) continue;
        if (it === 0) impact = Math.max(impact, -vn);
        const rn = rx * ny - ry * nx;
        const e = -vn > T.BOUNCE_V ? T.BOUNCE : 0;
        const j = -(1 + e) * vn / (1 + rn * rn * I_INV);
        b.vx += j * nx; b.vy += j * ny; b.av += rn * j * I_INV;
        const tx = -ny, ty = nx;
        const vt = (b.vx - b.av * ry) * tx + (b.vy + b.av * rx) * ty;
        const rt = rx * ty - ry * tx;
        const jt = clamp(-vt / (1 + rt * rt * I_INV), -T.MU * j, T.MU * j);
        b.vx += jt * tx; b.vy += jt * ty; b.av += rt * jt * I_INV;
      }
    }
    // Two corners on one surface means the square lies on a face. A block does not roll: kill the spin
    // and keep the face flush, so it skids to a stop instead of turning.
    if (normals.length >= 2) {
      const a = normals[0], b2 = normals[1];
      if (a.nx * b2.nx + a.ny * b2.ny > 0.95) {
        b.av *= T.FACE_DAMP; if (Math.abs(b.av) < 2) b.av = 0;
        const surf = Math.atan2(a.nx, -a.ny);
        const target = surf + Math.round((b.ang - surf) / (Math.PI / 2)) * (Math.PI / 2);
        b.ang += (target - b.ang) * T.FACE_SNAP;
      }
    }
    // never inside the rock: if the center somehow got below the surface, lift it out
    const sy = surfaceY(b.x), sg = segAt(b.x);
    if (sg && sg.kind !== 'hole' && b.y > sy + HALF * 0.5) { b.y = sy - HALF; if (b.vy > 0) b.vy = 0; }
    if (b.y > fallLine(b.x)) { b.state = 'fall'; return 'fall'; }
    if (contacts > 0) {
      b.airT = 0;
      if (groundHits > 0) { b.groundY = groundY; b.cx = cx; b.cy = cy; }
      if (Math.hypot(b.vx, b.vy) < T.REST_V && Math.abs(b.av) < T.REST_W) {
        b.restT += dt;
        if (b.restT >= T.REST_TIME) { b.vx = 0; b.vy = 0; b.av = 0; b.state = 'rest'; return 'rest'; }
      } else b.restT = 0;
      if (impact > 40) { b.impact = impact; return 'hit'; }
    } else {
      b.restT = 0; b.airT += dt;
      if (b.airT > T.AIR_TIMEOUT) { b.state = 'fall'; return 'fall'; }
    }
    return null;
  }
  function launchWith(vx, vy) {
    const b = run.ball;
    b.vx = vx; b.vy = vy; b.state = 'air'; b.hit = false; b.restT = 0; b.airT = 0;
    const sp = Math.hypot(vx, vy);
    b.av = (sp / HALF) * T.SPIN * (vx >= 0 ? 1 : -1);
    run.acc2 = 0;
    squares(b.x, b.y + HALF, 5, hexA(theme().ink, 0.35), 90, 14);
    Sfx.aim(-1); Sfx.launch(sp / T.V_MAX); haptic('tap');
  }
  // Pure: plays a launch from a resting position (the square's, by default) and reports where it ends up.
  // `stop` ends it early once the square is past that x (in its direction) and below that y: it cannot come back.
  function simulateLaunch(vx, vy, src, stop) {
    src = src || run.ball;
    const b = { x: src.x, y: src.y, vx, vy, ang: src.ang, av: 0, state: 'air', restT: 0, airT: 0, groundY: src.groundY, cx: 0, cy: 0, impact: 0 };
    const sp = Math.hypot(vx, vy);
    b.av = (sp / HALF) * T.SPIN * (vx >= 0 ? 1 : -1);
    let t = 0, ev = null, touchY = Infinity;
    while (t < 8) {
      if (stop && b.y > stop.y && (stop.dir > 0 ? b.x > stop.x : b.x < stop.x)) break;
      ev = stepBall(b, T.STEP); t += T.STEP;
      if (ev === 'hit' || ev === 'rest') touchY = Math.min(touchY, b.groundY);
      if (ev === 'rest' || ev === 'fall') break;
    }
    return { state: b.state, x: b.x, y: b.y, bottom: b.groundY, ang: b.ang, touchY, t };
  }
  // Scan launches from `src` toward the middle of ledge `seg` and keep the one resting nearest it, stopping
  // early once one lands within 4 px of it. With `want`, it instead stops as soon as that many launches rest on
  // the ledge at all, and reports the count. Null when none does.
  function scanTo(src, seg, angles, step, want) {
    const mid = (seg.x0 + seg.x1) / 2, dir = mid >= src.x ? 1 : -1;
    const stop = { dir, x: dir > 0 ? seg.x1 + 40 : seg.x0 - 40, y: seg.y0 + 20 };
    let best = null, hits = 0;
    for (const deg of angles) {
      const a = deg * RAD;
      for (let i = 6; i <= 100; i += step) {
        const v = (i / 100) * T.V_MAX, vx = dir * v * Math.cos(a), vy = -v * Math.sin(a);
        const res = simulateLaunch(vx, vy, src, stop);
        if (res.state !== 'rest' || res.x < seg.x0 || res.x > seg.x1 || Math.abs(res.bottom - seg.y0) > 3) continue;
        const err = Math.abs(res.x - mid); hits++;
        if (!best || err < best.err) best = { vx, vy, err, x: res.x, hits };
        best.hits = hits;
        if (want ? hits >= want : err < 4) return best;
      }
    }
    return best;
  }
  const CHECK_ANGLES = [36, 48, 60, 72, 80, 86], ANGLES = [32, 36, 42, 48, 54, 60, 66, 72, 80, 86], FAST_ANGLES = [45, 62, 84];
  // A launch that comes to rest on ledge `seg`, as near its middle as the scan finds. Null if none.
  function solveTo(seg, fast) { return seg ? scanTo(run.ball, seg, fast ? FAST_ANGLES : ANGLES, fast ? 4 : 2, 0) : null; }
  // Terrain check: do at least five of the scanned launches from the middle of ledge `from` rest on ledge `seg`?
  // (A typical ledge gets about 27 of the 144; the bar keeps out the ones only a perfect shot lands on.)
  function reachable(from, seg) {
    const src = { x: (from.x0 + from.x1) / 2, y: from.y0 - HALF, ang: 0, groundY: from.y0 };
    const r = scanTo(src, seg, CHECK_ANGLES, 4, 5);
    return !!r && r.hits >= 5;
  }
  // The autopilot's next move: onto the next ledge, or, when nothing reaches it from here (the foot of a wall,
  // usually), a hop that lands somewhere else on the ledge it stands on to try again from there. Null when stuck.
  function solveNext(fast) {
    const b = run.ball;
    const v = solveTo(nextLedge(b.x), fast);
    if (v) { v.kind = 'next'; return v; }
    const here = segAt(b.x);
    if (!here || here.kind !== 'ledge') return null;
    const w = solveTo(here, fast);
    if (!w || Math.abs(w.x - b.x) < 4) return null;
    w.kind = 'here'; return w;
  }

  // ---------- particles & popups (small squares only) ----------
  function popup(text, x, y, o) {
    o = o || {};
    run.popups.push({ text, x, y, t: 0, life: o.life || 1.0, color: o.color || null, size: o.size || 22, spaced: !!o.spaced });
  }
  function squares(x, y, n, color, speed, spread) {
    for (let i = 0; i < n; i++) run.parts.push({ x: x + (Math.random() - 0.5) * spread, y, vx: (Math.random() - 0.5) * speed * 2, vy: -Math.random() * speed - 20, t: 0, life: 0.4 + Math.random() * 0.3, r: 1.6 + Math.random() * 2, rot: Math.random() * TAU, spin: (Math.random() - 0.5) * 10, color });
  }

  // ---------- aiming (slingshot) ----------
  function aimVector(d) {
    const len = Math.hypot(d.x, d.y);
    if (len < T.DEADZONE) return null;
    const pow = Math.min(len, T.DRAG_MAX) / T.DRAG_MAX;
    return { vx: -d.x / len * pow * T.V_MAX, vy: -d.y / len * pow * T.V_MAX, pow };
  }
  function aimStart(pt) {
    if (state !== 'playing' || !run || run.dead || run.demo) return;
    if (run.ball.state !== 'rest') return;
    run.aim = { sx: pt.x, sy: pt.y, x: pt.x, y: pt.y };
    run.hinted = true; el.hint.classList.add('on');
    Sfx.aim(0);
  }
  function aimMove(pt) { if (run && run.aim) { run.aim.x = pt.x; run.aim.y = pt.y; const v = aimVector({ x: pt.x - run.aim.sx, y: pt.y - run.aim.sy }); Sfx.aim(v ? v.pow : 0); } }
  function aimEnd() {
    el.hint.classList.remove('on');
    if (!run || !run.aim) return;
    const v = aimVector({ x: run.aim.x - run.aim.sx, y: run.aim.y - run.aim.sy });
    run.aim = null;
    Sfx.aim(-1);
    if (run.dead || run.ball.state !== 'rest') return;
    if (v) { el.hint.classList.add('hidden'); launchWith(v.vx, v.vy); }
  }

  function touched() {
    const b = run.ball;
    const h = -b.groundY;
    if (h > run.maxH) {
      run.maxH = h;
      if (!run.demo && meters(h) > Save.d.best) Save.d.best = meters(h);
      syncHud();
    }
  }
  function onEvent(ev) {
    const b = run.ball;
    if (ev === 'hit') { const k = clamp(b.impact / 500, 0, 1); squares(b.cx, b.cy, 3 + Math.round(3 * k), hexA(theme().ink, 0.3), 60 + 80 * k, 10); Sfx.bounce(b.impact * 2); touched(); }
    else if (ev === 'fall') { const s = segAt(b.x); die(s && s.kind === 'hole' ? 'Fell into a crevasse' : 'Fell off the mountain'); }
    else if (ev === 'rest') resolveRest();
  }
  function resolveRest() {
    const b = run.ball;
    b.restT = 0;
    touched();
    const h = -b.groundY;
    if (h > run.restH + 1) {
      popup('+' + Math.max(1, meters(h) - meters(run.restH)) + ' m', b.x, b.y - 42, { size: 22 });
      run.results.push('N');
      Sfx.up(); haptic('score');
    } else if (h < run.restH - 1) {
      popup('back to ' + meters(h) + ' m', b.x, b.y - 42, { size: 15, spaced: true });
      run.results.push('B');
    }
    run.restH = h;
    const th = themeFor(meters(run.maxH));
    if (th !== run.theme) { run.themeFrom = run.theme; run.theme = th; run.themeMix = 0; }
    syncHud();
  }

  function update(dt) {
    const b = run.ball;
    run.t += dt;
    // grow the mountain ahead: freely while the square rests, only when needed during a flight
    const ahead = segs[segs.length - 1].x1 - b.x;
    if (ahead < 800 || (ahead < 1400 && b.state === 'rest' && !run.aim)) tryGroup(run);
    if (!run.dead) {
      if (b.state === 'rest') {
        b.restT += dt; run.alpha = 1;
        if (run.demo) {
          if (!run.demoV && b.restT > 0.6) {
            const v = solveNext(true);
            run.demoV = v ? { vx: v.vx * (1 + (Math.random() - 0.5) * 0.04), vy: v.vy * (1 + (Math.random() - 0.5) * 0.04) } : { vx: 220, vy: -420 };
            run.demoT = 0;
          }
          if (run.demoV) {
            run.demoT += dt;
            const k = clamp(run.demoT / 0.45, 0, 1), sp = Math.hypot(run.demoV.vx, run.demoV.vy), L = (sp / T.V_MAX) * T.DRAG_MAX * k;
            run.aim = { sx: 200, sy: 500, x: 200 - run.demoV.vx / sp * L, y: 500 - run.demoV.vy / sp * L };
            if (run.demoT > 0.75) { run.aim = null; launchWith(run.demoV.vx, run.demoV.vy); run.demoV = null; }
          }
        }
      } else if (b.state === 'air') {
        run.acc2 += dt;
        while (run.acc2 >= T.STEP) {
          run.acc2 -= T.STEP;
          b.px = b.x; b.py = b.y; b.pang = b.ang;
          const ev = stepBall(b, T.STEP);
          if (ev) { onEvent(ev); if (ev === 'rest' || ev === 'fall') break; }
        }
        run.alpha = b.state === 'air' ? run.acc2 / T.STEP : 1;
      }
    } else {
      run.deadT += dt; run.alpha = 1;
      if (b.state === 'fall') { b.vy += T.G * dt; b.y += b.vy * dt; b.x += b.vx * dt * 0.3; b.ang += b.av * dt; }
      if (run.demo && run.deadT > 1.4) { run = newRun('play', true); return; }
      if (!run.demo && run.deadT > 0.8 && state === 'playing') finishRun();
    }

    // camera follows the interpolated position, gently
    const vx = lerp(b.px, b.x, run.alpha), vy = lerp(b.py, b.y, run.alpha);
    const camX = vx - LOGICAL_W * T.CAM_X, camY = vy - H * T.CAM_Y;
    run.cam.x += (camX - run.cam.x) * (1 - Math.exp(-dt * 6));
    run.cam.y += (camY - run.cam.y) * (1 - Math.exp(-dt * 5));
    if (run.themeMix < 1) run.themeMix = Math.min(1, run.themeMix + dt / 1.2);
    for (const p of run.parts) { p.t += dt; p.vy += 500 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.spin * dt; }
    run.parts = run.parts.filter((p) => p.t < p.life);
    for (const p of run.popups) p.t += dt;
    run.popups = run.popups.filter((p) => p.t < p.life);
    run.shake *= Math.exp(-dt * 7);
  }

  function die(reason) {
    if (run.dead) return;
    run.dead = true; run.deadReason = reason; run.deadT = 0;
    run.results.push('X');
    run.shake = 10;
    run.aim = null;
    Sfx.aim(-1);
    if (!run.demo) { Sfx.fall(); haptic('fail'); el.hint.classList.add('hidden'); }
  }

  function finishRun() {
    state = 'over';
    const m = meters(run.maxH), before = run.startBest, after = Save.d.best;
    let bestLine = m >= after && m > before ? 'NEW BEST' : 'BEST ' + fmt(after) + ' m';
    if (run.mode === 'daily') {
      run.dailyResult = { day: dayNumber(), score: m, results: run.results.slice(0, 60) };
      Save.d.daily[todayKey()] = run.dailyResult;
      bestLine = 'DAILY #' + run.dailyResult.day + (m > before ? ' · NEW BEST' : '');
    }
    Save.d.runs = (Save.d.runs || 0) + 1;
    Save.save();
    showOver({ eyebrow: 'The climb ends', title: run.deadReason, stats: 'Highest point ' + fmt(m) + ' m', best: bestLine, strip: run.results, unlock: '', daily: run.dailyResult });
  }

  // ---------- drawing: flat fills only ----------
  function col(key) { return run.themeMix >= 1 ? THEMES[run.theme][key] : mixHex(THEMES[run.themeFrom][key], THEMES[run.theme][key], run.themeMix); }

  function draw() {
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    const cx = run.cam.x, cy = run.cam.y;
    ctx.save();
    if (run.shake > 0.3) ctx.translate((Math.random() - 0.5) * run.shake, (Math.random() - 0.5) * run.shake);
    ctx.fillStyle = col('bg'); ctx.fillRect(0, 0, LOGICAL_W, H);

    // the mountain: one polygon under the surface, dipping into each crevasse
    let i0 = 0; while (i0 < segs.length - 1 && segs[i0].x1 < cx - 60) i0++;
    let i1 = i0; while (i1 < segs.length - 1 && segs[i1].x0 <= cx + LOGICAL_W + 60) i1++;
    ctx.fillStyle = col('mount'); ctx.beginPath();
    ctx.moveTo(segs[i0].x0 - cx, H + 80); ctx.lineTo(segs[i0].x0 - cx, segs[i0].y0 - cy);
    for (let j = i0; j <= i1; j++) {
      const s = segs[j];
      if (s.kind === 'hole') { ctx.lineTo(s.x0 - cx, s.floor + 80 - cy); ctx.lineTo(s.x1 - cx, s.floor + 80 - cy); }
      ctx.lineTo(s.x1 - cx, s.y1 - cy);
    }
    ctx.lineTo(segs[i1].x1 - cx, H + 80); ctx.closePath(); ctx.fill();
    ctx.fillStyle = col('ledge');
    for (let j = i0; j <= i1; j++) { const s = segs[j]; if (s.kind === 'ledge') ctx.fillRect(s.x0 - cx, s.y0 - cy, s.x1 - s.x0, 6); }

    // height marks every 50 m
    const ink = col('ink');
    ctx.fillStyle = hexA(THEMES[run.theme].ink, 0.35); ctx.font = '600 10px ' + FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const step = 50 / T.M_PER_PX;
    for (let m = Math.max(50, Math.ceil((-(cy + H)) / step) * 50); -m / T.M_PER_PX > cy - 20; m += 50) {
      const y = -m / T.M_PER_PX - cy;
      if (y < 100) continue;
      ctx.fillRect(14, y - 1, 16, 2); ctx.fillText(m + ' m', 36, y);
    }

    const b = run.ball;
    const vx = lerp(b.px, b.x, run.alpha), vy = lerp(b.py, b.y, run.alpha), vang = lerp(b.pang, b.ang, run.alpha);
    if (run.aim) drawAim(vx - cx, vy - cy);
    drawSquare(vx - cx, vy - cy, vang);
    drawParticles(cx, cy);
    drawPopups(cx, cy, ink);
    ctx.restore();
  }
  // The pull: a band in the direction of the finger, and a dashed line the way the square will go.
  function drawAim(ox, oy) {
    const v = aimVector({ x: run.aim.x - run.aim.sx, y: run.aim.y - run.aim.sy });
    if (!v) return;
    const dx = v.vx / T.V_MAX, dy = v.vy / T.V_MAX;
    ctx.lineCap = 'butt';
    ctx.strokeStyle = hexA(SQUARE, 0.7); ctx.lineWidth = 3; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox - dx * T.DRAG_MAX, oy - dy * T.DRAG_MAX); ctx.stroke();
    ctx.strokeStyle = hexA(THEMES[run.theme].ink, 0.45); ctx.setLineDash([7, 6]);
    ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + dx * 110, oy + dy * 110); ctx.stroke();
    ctx.setLineDash([]);
  }
  function drawSquare(x, y, ang) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.fillStyle = SQUARE; ctx.fillRect(-HALF, -HALF, T.SIZE, T.SIZE);
    ctx.fillStyle = 'rgba(59,58,74,.25)'; ctx.fillRect(HALF * 0.3, -2, 4, 4);
    ctx.restore();
  }
  function drawParticles(cx, cy) {
    for (const p of run.parts) {
      ctx.save(); ctx.globalAlpha = 1 - p.t / p.life; ctx.translate(p.x - cx, p.y - cy); ctx.rotate(p.rot);
      ctx.fillStyle = p.color; ctx.fillRect(-p.r, -p.r, p.r * 2, p.r * 2);
      ctx.restore();
    }
  }
  function drawPopups(cx, cy, ink) {
    for (const p of run.popups) {
      const a = 1 - p.t / p.life, s = p.t < 0.12 ? 0.7 + (p.t / 0.12) * 0.3 : 1;
      ctx.save(); ctx.globalAlpha = a;
      ctx.translate(clamp(p.x - cx, 72, LOGICAL_W - 72), p.y - cy - p.t * 34); ctx.scale(s, s);
      ctx.font = (p.spaced ? '600 ' : '300 ') + p.size + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      try { ctx.letterSpacing = p.spaced ? '0.22em' : '0em'; } catch (e) { /* older engines */ }
      ctx.fillStyle = p.color || ink;
      ctx.fillText(p.text, p.spaced ? p.size * 0.11 : 0, 0);
      ctx.restore();
    }
  }

  // ---------- UI ----------
  function show(node, on) { node.classList.toggle('hidden', !on); }
  function applyTheme(t) {
    const g = el.game.style;
    g.setProperty('--bg', t.bg); g.setProperty('--ink', t.ink); g.setProperty('--muted', t.muted);
    g.setProperty('--line', hexA(t.ink, 0.14)); g.setProperty('--overlay', hexA(t.bg, 0.94));
    g.setProperty('--panel', t.dark ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.55)');
    g.setProperty('--accent', SQUARE);
    el.game.dataset.theme = t.dark ? 'dark' : 'light';
  }
  function syncHud() {
    if (!run) return;
    el.score.textContent = fmt(meters(run.maxH)) + ' m';
    const len = el.score.textContent.length;
    el.score.classList.toggle('mid', len === 6 || len === 7);
    el.score.classList.toggle('long', len > 7);
    el.combo.textContent = '';
    el.best.textContent = 'Best ' + fmt(Math.max(Save.d.best, meters(run.maxH))) + ' m';
    el.mode.textContent = (run.mode === 'daily' ? 'Daily · ' : '') + THEMES[run.theme].name;
    applyTheme(THEMES[run.theme]);
  }
  function renderMenu() {
    el.mStats.textContent = 'Best ' + fmt(Save.d.best) + ' m';
    const done = Save.d.daily[todayKey()];
    el.daily.innerHTML = done ? 'Daily done<small>' + fmt(done.score) + ' m · share</small>' : 'Daily #' + dayNumber() + '<small>one try · same for everyone</small>';
    el.soundBtn.textContent = 'Sound: ' + (Save.d.sound ? 'on' : 'off');
  }
  function showMenu() {
    state = 'menu';
    run = newRun('play', true);
    applyTheme(THEMES[0]);
    show(el.hud, false); show(el.over, false); show(el.pause, false); show(el.help, false); show(el.menu, true);
    renderMenu();
  }
  function startRun(mode, seed) {
    run = newRun(mode, false, seed);
    state = 'playing';
    show(el.menu, false); show(el.over, false); show(el.pause, false); show(el.help, false); show(el.hud, true);
    show(el.hint, true); el.hint.classList.remove('on');
    syncHud();
    lastT = performance.now();
  }
  function stripText(results) {
    const s = results.map((r) => (r === 'X' ? '🟥' : r === 'B' ? '🟨' : '🟩')).join('');
    return results.length > 40 ? Array.from(s).slice(0, 40).join('') + '…' : s;
  }
  function shareText(res) {
    const url = location.href.split(/[?#]/)[0];
    return 'Hop ◼ Daily #' + res.day + '\nClimbed ' + res.score + ' m\n' + stripText(res.results) + '\n' + url;
  }
  async function share(text) {
    try { if (navigator.share) { await navigator.share({ text }); return 'Shared'; } } catch (e) { if (e && e.name === 'AbortError') return 'Share'; }
    try { await navigator.clipboard.writeText(text); return 'Copied'; } catch (e) { /* ignore */ }
    return 'Share';
  }
  function showOver(o) {
    state = 'over';
    el.oEyebrow.textContent = o.eyebrow; el.oTitle.textContent = o.title; el.oStats.textContent = o.stats;
    el.oBest.textContent = o.best; el.oUnlock.textContent = o.unlock || '';
    el.oStrip.textContent = '';
    (o.strip || []).slice(0, 60).forEach((r) => { const d = document.createElement('span'); d.className = r === 'X' ? 'x' : r === 'B' ? 'b' : 'n'; el.oStrip.appendChild(d); });
    show(el.oAgain, !o.daily); show(el.oShare, !!o.daily);
    el.oShare.textContent = 'Share';
    el.oShare.onclick = o.daily ? async () => { el.oShare.textContent = await share(shareText(o.daily)); } : null;
    show(el.hint, false); show(el.menu, false); show(el.pause, false); show(el.hud, true); show(el.over, true);
  }
  function showDailyDone(done) {
    run = newRun('play', true);
    showOver({ eyebrow: 'Daily #' + done.day + ' · done', title: done.score + ' m', stats: '', best: 'COME BACK TOMORROW', strip: done.results, unlock: '', daily: done });
    show(el.hud, false);
  }
  function pause() {
    if (state !== 'playing') return;
    state = 'paused';
    run.aim = null; el.hint.classList.remove('on'); Sfx.aim(-1);
    show(el.pause, true);
  }
  function resume() { if (state !== 'paused') return; state = 'playing'; show(el.pause, false); lastT = performance.now(); }

  // ---------- input ----------
  function toLogical(e) { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale }; }
  canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); Sfx.init(); Sfx.resume(); aimStart(toLogical(e)); });
  window.addEventListener('pointermove', (e) => { if (run && run.aim && !run.demo) aimMove(toLogical(e)); });
  window.addEventListener('pointerup', aimEnd);
  window.addEventListener('pointercancel', () => { if (run) run.aim = null; el.hint.classList.remove('on'); Sfx.aim(-1); });
  window.addEventListener('blur', () => { if (run) run.aim = null; el.hint.classList.remove('on'); Sfx.aim(-1); });
  canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'Space' || e.code === 'Enter') {
      if (state === 'paused') resume();
      else if (state === 'over' && run && run.mode === 'play') startRun('play');
      else if (state === 'menu') startRun('play');
    }
    if (e.code === 'Escape' && state === 'playing') pause();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

  el.play.addEventListener('click', () => { Sfx.init(); Sfx.resume(); startRun('play'); });
  el.daily.addEventListener('click', () => { Sfx.init(); Sfx.resume(); const done = Save.d.daily[todayKey()]; if (done) showDailyDone(done); else startRun('daily'); });
  el.helpBtn.addEventListener('click', () => show(el.help, true));
  el.helpClose.addEventListener('click', () => show(el.help, false));
  el.soundBtn.addEventListener('click', () => { Save.d.sound = !Save.d.sound; Save.save(); renderMenu(); });
  el.oAgain.addEventListener('click', () => startRun('play'));
  el.oMenu.addEventListener('click', showMenu);
  el.pause.addEventListener('click', resume);

  // ---------- loop ----------
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - lastT) / 1000; lastT = now;
    if (!(dt > 0)) dt = 0; if (dt > 0.05) dt = 0.05;
    if (state !== 'paused') update(dt);
    draw();
  }
  window.addEventListener('resize', resize);
  resize();
  showMenu();
  lastT = performance.now();
  requestAnimationFrame(frame);

  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
  }

  // Exposed for automated tests and console tuning.
  window.Hop = {
    get state() { return state; }, get run() { return run; }, get H() { return H; }, get scale() { return scale; },
    start: startRun, menu: showMenu, save: Save, data: DATA, sync: syncHud,
    simulateLaunch, scanTo, solveTo, solveNext, reachable, aimVector, groundAt, segAt, nextLedge, meters, surfaceY, nearestLine, corners,
    launch(vx, vy) { if (!run || run.dead || run.ball.state !== 'rest') return false; launchWith(vx, vy); return true; },
    // Test hook: play the flight out synchronously, with the same events the frame loop would fire.
    settle() {
      const b = run.ball; let t = 0;
      while (b.state === 'air' && t < 8) { const ev = stepBall(b, T.STEP); t += T.STEP; if (ev) onEvent(ev); }
      b.px = b.x; b.py = b.y; b.pang = b.ang; run.alpha = 1;
      genTerrain(run, b.x + 1400);
      return b.state;
    },
  };
})();
