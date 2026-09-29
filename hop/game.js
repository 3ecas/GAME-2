/* Hop — hold to charge, release to hit. The shape flies, spins, bounces and rolls out;
   stop it on the green, or roll it into the cup for a perfect.
   Side-view 2D, one thumb, portrait, playable on mute, works offline. No dependencies, no build step. */
(() => {
  'use strict';

  // ---------- data & constants ----------
  const DATA = window.HOP_DATA;
  const T = DATA.tuning;
  const CHARS = DATA.characters;
  const THEMES = DATA.themes;
  const KEY = 'hop.v2';
  const LAUNCH_UTC = Date.UTC(2026, 8, 29);
  const LOGICAL_W = 390;
  const GROUND_FRAC = 0.68;
  const FONT = '-apple-system, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif';
  const TAU = Math.PI * 2;
  const RAD = Math.PI / 180;

  // ---------- helpers ----------
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const $ = (id) => document.getElementById(id);

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
  function circle(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
  function rr(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath(); g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  function shapePath(g, shape, cx, cy, r) {
    g.beginPath();
    switch (shape) {
      case 'circle': g.arc(cx, cy, r, 0, TAU); break;
      case 'triangle': { const R = r * 1.18; for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + i * TAU / 3; g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R + r * 0.16); } g.closePath(); break; }
      case 'diamond': { const R = r * 1.2; g.moveTo(cx, cy - R); g.lineTo(cx + R, cy); g.lineTo(cx, cy + R); g.lineTo(cx - R, cy); g.closePath(); break; }
      case 'hexagon': { const R = r * 1.1; for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * TAU / 6; g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); } g.closePath(); break; }
      case 'star': { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const R = i % 2 === 0 ? r * 1.25 : r * 0.58; g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); } g.closePath(); break; }
      case 'plus': { const w = r * 0.4, R = r * 1.05; g.moveTo(cx - w, cy - R); g.lineTo(cx + w, cy - R); g.lineTo(cx + w, cy - w); g.lineTo(cx + R, cy - w); g.lineTo(cx + R, cy + w); g.lineTo(cx + w, cy + w); g.lineTo(cx + w, cy + R); g.lineTo(cx - w, cy + R); g.lineTo(cx - w, cy + w); g.lineTo(cx - R, cy + w); g.lineTo(cx - R, cy - w); g.lineTo(cx - w, cy - w); g.closePath(); break; }
      default: { const rad = 5; g.moveTo(cx - r + rad, cy - r); g.arcTo(cx + r, cy - r, cx + r, cy + r, rad); g.arcTo(cx + r, cy + r, cx - r, cy + r, rad); g.arcTo(cx - r, cy + r, cx - r, cy - r, rad); g.arcTo(cx - r, cy - r, cx + r, cy - r, rad); g.closePath(); }
    }
  }

  // ---------- persistence ----------
  const Save = {
    d: { best: 0, bestHoles: 0, bestCombo: 0, totalHoles: 0, daily: {}, sound: true, char: CHARS[0].id, runs: 0 },
    load() {
      try { const raw = localStorage.getItem(KEY); if (raw) { const o = JSON.parse(raw); if (o && typeof o === 'object') Object.assign(this.d, o); } }
      catch (e) { /* storage blocked: play without saving */ }
    },
    save() { try { localStorage.setItem(KEY, JSON.stringify(this.d)); } catch (e) { /* ignore */ } },
  };
  Save.load();

  // ---------- sound (optional; fully playable on mute) ----------
  const Sfx = {
    ctx: null, chargeOsc: null, chargeGain: null,
    init() {
      if (this.ctx) return;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 180;
        const g = this.ctx.createGain(); g.gain.value = 0;
        o.connect(g); g.connect(this.ctx.destination); o.start();
        this.chargeOsc = o; this.chargeGain = g;
      } catch (e) { this.ctx = null; }
    },
    resume() { try { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); } catch (e) { /* ignore */ } },
    get on() { return Save.d.sound && !!this.ctx; },
    charge(p) {
      if (!this.ctx || !this.chargeGain) return;
      const t = this.ctx.currentTime;
      if (p < 0 || !this.on) { this.chargeGain.gain.setTargetAtTime(0, t, 0.03); return; }
      this.chargeGain.gain.setTargetAtTime(0.05, t, 0.03);
      this.chargeOsc.frequency.setTargetAtTime(170 + 430 * p, t, 0.03);
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
    noise(dur, vol) {
      if (!this.on) return;
      try {
        const sr = this.ctx.sampleRate, n = Math.floor(sr * dur), buf = this.ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
        const s = this.ctx.createBufferSource(); s.buffer = buf; const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
        const g = this.ctx.createGain(); g.gain.value = vol; s.connect(f); f.connect(g); g.connect(this.ctx.destination); s.start();
      } catch (e) { /* ignore */ }
    },
    hit(p) { this.tone(240 + 120 * p, 0.07, 'triangle', 0.2, 0, 120); },
    bounce(v) { this.tone(180 + v * 0.1, 0.05, 'triangle', clamp(v / 900, 0.04, 0.14), 0, 140); },
    sink(c) { const b = 660 * Math.pow(1.06, Math.min(c, 12)); this.tone(b, 0.1, 'sine', 0.2); this.tone(b * 1.5, 0.28, 'sine', 0.2, 0.09); },
    splash() { this.noise(0.45, 0.35); this.tone(220, 0.4, 'sine', 0.15, 0, 60); },
  };
  function haptic(kind) {
    try {
      const cap = window.Capacitor, Hp = cap && cap.Plugins && cap.Plugins.Haptics;
      if (Hp) { if (kind === 'perfect') Hp.notification({ type: 'SUCCESS' }); else if (kind === 'fail') Hp.notification({ type: 'ERROR' }); else Hp.impact({ style: 'LIGHT' }); }
      else if (navigator.vibrate) navigator.vibrate(kind === 'fail' ? [60, 40, 60] : kind === 'perfect' ? [20, 30, 20] : 12);
    } catch (e) { /* ignore */ }
  }

  // ---------- DOM ----------
  const canvas = $('c');
  const ctx = canvas.getContext('2d');
  const el = {
    game: $('game'), hud: $('hud'), mode: $('hud-mode'), score: $('hud-score'), combo: $('hud-combo'), best: $('hud-best'), hint: $('hud-hint'),
    menu: $('menu'), over: $('over'), pause: $('pause'), help: $('help'),
    preview: $('m-preview'), mKind: $('m-kind'), mName: $('m-name'), mDots: $('m-dots'), mStats: $('m-stats'),
    play: $('play'), daily: $('daily'), prev: $('prev'), nextBtn: $('next'), helpBtn: $('help-btn'), soundBtn: $('sound-btn'), helpClose: $('help-close'),
    oEyebrow: $('o-eyebrow'), oTitle: $('o-title'), oStats: $('o-stats'), oBest: $('o-best'), oStrip: $('o-strip'), oUnlock: $('o-unlock'),
    oAgain: $('o-again'), oShare: $('o-share'), oMenu: $('o-menu'),
  };

  // ---------- state ----------
  let state = 'menu'; // menu | playing | paused | over
  let run = null;
  let charIndex = Math.max(0, CHARS.findIndex((c) => c.id === Save.d.char));
  let cssW = 390, cssH = 800, dpr = 1, scale = 1, H = 800, yGround = 544;
  let lastT = 0;

  function resize() {
    cssW = el.game.clientWidth || window.innerWidth;
    cssH = el.game.clientHeight || window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    scale = cssW / LOGICAL_W;
    H = cssH / scale;
    yGround = H * GROUND_FRAC;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
  }

  // ---------- course ----------
  const themeFor = (i) => Math.floor(i / T.THEME_LEN) % THEMES.length;
  // Rotational symmetry of each shape, so a resting shape settles onto a flat side.
  const SYMMETRY = { square: Math.PI / 2, circle: 0.0001, triangle: TAU / 3, diamond: Math.PI / 2, hexagon: Math.PI / 3, star: TAU / 5, plus: Math.PI / 2 };
  const theme = () => THEMES[run.theme];
  const accent = () => CHARS[charIndex].color;

  function newRun(mode, demo) {
    const seed = mode === 'daily' ? hashStr('hop2:' + todayKey()) : (Math.random() * 4294967296) >>> 0;
    const r = {
      mode, demo: !!demo, seed, rng: mulberry32(seed), t: 0,
      score: 0, holes: 0, combo: 0, maxCombo: 0, results: [], course: [], cur: 0, strokes: 0, startBest: Save.d.best,
      ball: { x: 0, h: 0, vx: 0, vy: 0, ang: 0, av: 0, state: 'rest', charge: 0, sx: 1, sy: 1, restT: 0, holdT: 0, sunkHole: -1 },
      acc: 0, cam: { x: -T.BALL_SCREEN_X }, popups: [], parts: [], shake: 0, dead: false, deadReason: '', deadT: 0,
      theme: 0, themeFrom: 0, themeMix: 1, hinted: false, demoTarget: 0, dailyResult: null,
    };
    while (r.course.length < 6) spawnHole(r);
    return r;
  }

  // Each hole: a water channel right after the previous green, a stretch of fairway (maybe cut by a hazard), then the green with its cup.
  function spawnHole(r) {
    const i = r.course.length, prev = r.course[i - 1];
    const diff = clamp(i / T.RAMP, 0, 1), rng = r.rng;
    const prevEnd = prev ? prev.greenEnd : 40;
    const chW = lerp(T.CHANNEL_W[0], T.CHANNEL_W[1], diff) + (rng() - 0.5) * 8;
    const channelStart = prevEnd, channelEnd = prevEnd + chW;
    const fairLen = lerp(T.FAIRWAY_LEN[0], T.FAIRWAY_LEN[1], rng());
    const gw = lerp(lerp(T.GREEN_W[0][0], T.GREEN_W[1][0], diff), lerp(T.GREEN_W[0][1], T.GREEN_W[1][1], diff), rng());
    const greenStart = channelEnd + fairLen, greenEnd = greenStart + gw;
    const cup = greenStart + gw * lerp(T.CUP_FRAC[0], T.CUP_FRAC[1], rng());
    const hz = rng(), hw = rng(), hp = rng();
    let hazard = null;
    if (i >= T.HAZARD_FROM && hz < lerp(0, T.HAZARD_CHANCE_END, diff)) {
      const w = Math.min(lerp(T.HAZARD_W[0], T.HAZARD_W[1], hw), fairLen - 24);
      if (w >= 18) { const start = channelEnd + 12 + hp * (fairLen - 24 - w); hazard = { start, end: start + w }; }
    }
    r.course.push({ i, channelStart, channelEnd, greenStart, greenEnd, cup, hazard, theme: themeFor(i) });
  }
  function ensureHoles() { while (run.course.length < run.cur + 5) spawnHole(run); }

  function groundAt(x) {
    const c = run.course;
    for (let j = Math.max(0, run.cur - 1); j < c.length; j++) {
      const h = c[j];
      if (x < h.channelStart) break;
      if (x < h.channelEnd) return 'water';
      if (h.hazard && x >= h.hazard.start && x < h.hazard.end) return 'water';
      if (x >= h.greenStart && x <= h.greenEnd) return 'green';
    }
    return 'fairway';
  }
  function cupAt(x) {
    for (let j = run.cur; j < Math.min(run.course.length, run.cur + 2); j++) if (Math.abs(x - run.course[j].cup) <= T.CUP_R) return j;
    return -1;
  }
  // Only greens at or beyond the current hole count; resting on a green already played is just a lie on the course.
  function greenIndexAt(x) {
    for (let j = run.cur; j < Math.min(run.course.length, run.cur + 3); j++) { const h = run.course[j]; if (x >= h.greenStart && x <= h.greenEnd) return j; }
    return -1;
  }

  // ---------- physics (fixed step) ----------
  function launch(b, p) {
    const v = lerp(T.V_MIN, T.V_MAX, clamp(p, 0, 1)), a = T.ANGLE * RAD;
    b.vx = v * Math.cos(a); b.vy = v * Math.sin(a); b.h = 0; b.state = 'air';
    b.av = (b.vx / T.BALL_R) * 0.9;
  }
  // Returns an event name or null. `h` is the height of the ball's bottom above the ground, vy is positive upward.
  function stepBall(b, dt) {
    const r = T.BALL_R;
    if (b.state === 'air') {
      b.vy -= T.G * dt;
      b.x += b.vx * dt; b.h += b.vy * dt; b.ang += b.av * dt;
      if (b.h <= 0 && b.vy < 0 && groundAt(b.x) !== 'water') {
        b.h = 0;
        const cj = cupAt(b.x);
        if (cj >= 0 && Math.abs(b.vx) < T.CUP_V_AIR) { b.x = run.course[cj].cup; b.vx = 0; b.vy = 0; b.sunkHole = cj; b.state = 'sunk'; return 'sunk'; }
        if (-b.vy > T.BOUNCE_MIN_VY) { b.vy = -b.vy * T.BOUNCE; b.vx *= T.BOUNCE_FRICTION; b.av = b.vx / r; return 'bounce'; }
        b.vy = 0; b.state = 'roll'; b.av = b.vx / r; return 'land';
      }
      if (b.h < -30) { b.state = 'water'; return 'water'; }
    } else if (b.state === 'roll') {
      const dec = T.ROLL_DECEL * dt;
      if (Math.abs(b.vx) <= dec) b.vx = 0; else b.vx -= Math.sign(b.vx) * dec;
      b.x += b.vx * dt; b.ang += (b.vx / r) * dt;
      if (groundAt(b.x) === 'water') { b.state = 'air'; b.vy = 0; return null; }
      const cj = cupAt(b.x);
      if (cj >= 0 && Math.abs(b.vx) < T.CUP_V) { b.x = run.course[cj].cup; b.vx = 0; b.sunkHole = cj; b.state = 'sunk'; return 'sunk'; }
      if (b.vx === 0) { b.state = 'rest'; return 'rest'; }
    }
    return null;
  }
  // Pure: plays a shot of power p from the current resting position and reports where it ends up.
  function simulateShot(p) {
    const b = { x: run.ball.x, h: 0, vx: 0, vy: 0, ang: 0, av: 0, state: 'air', sunkHole: -1 };
    launch(b, p);
    let t = 0, ev = null;
    while (t < 8) { ev = stepBall(b, T.STEP); t += T.STEP; if (ev === 'rest' || ev === 'sunk' || ev === 'water') break; }
    return { state: b.state, x: b.x, t };
  }
  // The power whose shot sinks at targetX if one exists, else the one that stops closest to it on land.
  function solveShot(targetX) {
    let best = { p: 0.5, err: Infinity };
    for (let i = 0; i <= 100; i++) {
      const p = i / 100, res = simulateShot(p);
      if (res.state === 'sunk' && Math.abs(res.x - targetX) <= T.CUP_R + 1) return p;
      const err = res.state === 'water' ? 1e9 : Math.abs(res.x - targetX);
      if (err < best.err) best = { p, err };
    }
    return best.p;
  }

  // ---------- particles & popups ----------
  function popup(text, x, y, o) {
    o = o || {};
    run.popups.push({ text, x, y, t: 0, life: o.life || 1.0, color: o.color || null, size: o.size || 20, spaced: o.spaced !== false });
  }
  function part(o) { run.parts.push(Object.assign({ kind: 'dot', x: 0, y: 0, vx: 0, vy: 0, t: 0, life: 0.5, r: 2, color: '#000', g: 0, size: 46 }, o)); }
  function dots(x, y, n, color, speed, spread, g) {
    for (let i = 0; i < n; i++) part({ x: x + (Math.random() - 0.5) * spread, y, vx: (Math.random() - 0.5) * speed * 2, vy: -Math.random() * speed - 20, life: 0.4 + Math.random() * 0.3, r: 1.8 + Math.random() * 2.2, color, g: g == null ? 500 : g });
  }
  function ringFx(x, y, color, delay, size) { part({ kind: 'ring', x, y, life: 0.6, color, t: -(delay || 0), size: size || 46 }); }

  // ---------- input & shots ----------
  function press() {
    if (state !== 'playing' || !run || run.dead || run.demo) return;
    const b = run.ball;
    if (b.state !== 'rest') return;
    b.state = 'charge'; b.charge = 0; run.hinted = true;
    el.hint.classList.add('on');
    Sfx.charge(0);
  }
  function release() {
    el.hint.classList.remove('on');
    if (run && run.hinted) el.hint.classList.add('hidden');
    if (!run || run.dead || run.ball.state !== 'charge' || run.demo) return;
    fire(run.ball.charge / T.T_MAX);
  }
  function fire(p) {
    const b = run.ball;
    launch(b, p);
    run.strokes++;
    run.acc = 0;
    b.sx = 0.85; b.sy = 1.15;
    dots(b.x, yGround, 5, hexA(theme().ink, 0.35), 90, 14);
    Sfx.charge(-1); Sfx.hit(p); haptic('tap');
    syncHud();
  }

  function onEvent(ev) {
    const b = run.ball;
    if (ev === 'bounce') { b.sy = 0.7; b.sx = 1.25; dots(b.x, yGround, 4, hexA(theme().ink, 0.3), 70, 10); Sfx.bounce(Math.abs(b.vy) / T.BOUNCE); }
    else if (ev === 'land') { b.sy = 0.85; b.sx = 1.1; Sfx.bounce(120); }
    else if (ev === 'sunk') { b.holdT = 0; completeHole(b.sunkHole, true); }
    else if (ev === 'water') { die('Splash'); }
    else if (ev === 'rest') resolveRest();
  }

  function resolveRest() {
    const b = run.ball;
    const gi = greenIndexAt(b.x);
    if (gi >= 0) { completeHole(gi, false); return; }
    let ni = run.cur;
    while (ni < run.course.length - 1 && b.x > run.course[ni].greenEnd) ni++;
    if (ni !== run.cur) { run.cur = ni; run.strokes = 1; ensureHoles(); checkTheme(); }
    if (run.strokes >= T.MAX_STROKES) { die('Three strokes, still off the green'); return; }
    b.restT = 0;
    syncHud();
  }

  function completeHole(hi, sunk) {
    const b = run.ball, hole = run.course[hi];
    const first = hi === run.cur && run.strokes === 1;
    let gained;
    if (sunk && first) {
      run.combo++; run.maxCombo = Math.max(run.maxCombo, run.combo);
      gained = 2 * run.combo; run.results.push('P');
      popup('PERFECT', hole.cup, yGround - 70, { color: accent(), size: 20 });
      if (run.combo >= 2) popup('×' + run.combo, hole.cup, yGround - 98, { color: accent(), size: 26, life: 1.2, spaced: false });
      ringFx(hole.cup, yGround, accent(), 0, 60); ringFx(hole.cup, yGround, accent(), 0.12, 44); dots(hole.cup, yGround, 10, hexA(accent(), 0.9), 170, 24);
      Sfx.sink(run.combo); haptic('perfect');
    } else if (sunk) {
      run.combo = 0; gained = 2; run.results.push('N');
      popup('IN  +2', hole.cup, yGround - 66, { size: 20 });
      ringFx(hole.cup, yGround, hexA(theme().ink, 0.4), 0, 44);
      Sfx.sink(0); haptic('tap');
    } else {
      run.combo = 0; gained = 1; run.results.push('N');
      popup('+1', b.x, yGround - 62, { size: 24, spaced: false });
      haptic('tap');
    }
    run.score += gained; run.holes++;
    if (!run.demo) { Save.d.totalHoles++; if (run.score > Save.d.best) Save.d.best = run.score; }
    run.cur = hi + 1; run.strokes = 0; ensureHoles(); checkTheme();
    if (!sunk) { b.state = 'rest'; b.restT = 0; }
    syncHud();
  }
  function checkTheme() {
    const th = run.course[run.cur].theme;
    if (th !== run.theme) { run.themeFrom = run.theme; run.theme = th; run.themeMix = 0; }
  }

  function update(dt) {
    const b = run.ball;
    run.t += dt;
    if (!run.dead) {
      if (b.state === 'rest') {
        b.restT += dt;
        b.sx += (1 - b.sx) * (1 - Math.exp(-dt * 12)); b.sy += (1 - b.sy) * (1 - Math.exp(-dt * 12));
        const sym = SYMMETRY[CHARS[charIndex].shape] || TAU;
        const flat = Math.round(b.ang / sym) * sym;
        b.ang += (flat - b.ang) * (1 - Math.exp(-dt * 14));
        if (run.demo && b.restT > 0.7) {
          const p = solveShot(run.course[run.cur].cup);
          run.demoTarget = clamp(p + (Math.random() - 0.5) * 0.03, 0, 1) * T.T_MAX;
          b.state = 'charge'; b.charge = 0;
        }
      } else if (b.state === 'charge') {
        b.charge = Math.min(T.T_MAX, b.charge + dt);
        const p = b.charge / T.T_MAX;
        b.sx += (1 + 0.15 * p - b.sx) * (1 - Math.exp(-dt * 14)); b.sy += (1 - 0.2 * p - b.sy) * (1 - Math.exp(-dt * 14));
        Sfx.charge(p);
        if (run.demo && b.charge >= run.demoTarget) fire(b.charge / T.T_MAX);
      } else if (b.state === 'air' || b.state === 'roll') {
        run.acc += dt;
        while (run.acc >= T.STEP) {
          run.acc -= T.STEP;
          const ev = stepBall(b, T.STEP);
          if (ev) { onEvent(ev); if (ev === 'rest' || ev === 'sunk' || ev === 'water') break; }
        }
        b.sx += (1 - b.sx) * (1 - Math.exp(-dt * 10)); b.sy += (1 - b.sy) * (1 - Math.exp(-dt * 10));
      } else if (b.state === 'sunk') {
        b.holdT += dt;
        b.h = -26 * clamp(b.holdT / 0.18, 0, 1);
        if (b.holdT > 0.6) { b.x = run.course[b.sunkHole].cup + 14; b.h = 0; b.ang = 0; b.state = 'rest'; b.restT = 0; }
      }
    } else {
      run.deadT += dt;
      if (b.state === 'water') { b.vy -= T.G * dt; b.h += b.vy * dt; b.x += b.vx * dt * 0.3; b.ang += b.av * dt; }
      if (run.demo && run.deadT > 1.4) { run = newRun('play', true); return; }
      if (!run.demo && run.deadT > 0.75 && state === 'playing') finishRun();
    }

    const camT = b.x - T.BALL_SCREEN_X;
    run.cam.x += (camT - run.cam.x) * (1 - Math.exp(-dt * 6));
    if (run.themeMix < 1) run.themeMix = Math.min(1, run.themeMix + dt / 1.2);
    for (const p of run.parts) { p.t += dt; if (p.kind !== 'ring') { p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; } }
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
    const b = run.ball;
    if (b.state === 'water') {
      const w = hexA(mixHex(theme().water, theme().ink, 0.35), 0.9);
      dots(b.x, yGround + 8, 10, w, 180, 20, 700);
      ringFx(b.x, yGround + 8, w, 0, 50); ringFx(b.x, yGround + 8, w, 0.12, 36);
    }
    Sfx.charge(-1);
    if (!run.demo) { Sfx.splash(); haptic('fail'); el.hint.classList.add('hidden'); }
  }

  function finishRun() {
    state = 'over';
    const before = run.startBest, after = Save.d.best;
    let bestLine = run.score >= after && run.score > before ? 'NEW BEST' : 'BEST ' + fmt(after);
    if (run.holes > Save.d.bestHoles) Save.d.bestHoles = run.holes;
    if (run.maxCombo > Save.d.bestCombo) Save.d.bestCombo = run.maxCombo;
    if (run.mode === 'daily') {
      run.dailyResult = { day: dayNumber(), score: run.score, holes: run.holes, combo: run.maxCombo, results: run.results.slice(0, 60) };
      Save.d.daily[todayKey()] = run.dailyResult;
      bestLine = 'DAILY #' + run.dailyResult.day + (run.score > before ? ' · NEW BEST' : '');
    }
    Save.d.runs = (Save.d.runs || 0) + 1;
    Save.save();
    const newly = CHARS.filter((c) => c.unlock > before && c.unlock <= after);
    let unlockLine;
    if (newly.length) unlockLine = 'New shape unlocked: ' + newly.map((c) => c.name).join(', ');
    else { const n = CHARS.find((c) => c.unlock > after); unlockLine = n ? 'Next shape at best ' + n.unlock + ' · you have ' + after : 'All shapes unlocked'; }
    showOver({
      eyebrow: run.deadReason === 'Splash' ? 'Water' : 'Missed', title: run.deadReason,
      stats: fmt(run.score) + ' pts · ' + run.holes + ' holes · best streak ×' + run.maxCombo,
      best: bestLine, strip: run.results, unlock: unlockLine, daily: run.dailyResult,
    });
  }

  // ---------- drawing: flat pastel geometry, nothing else ----------
  function col(key) { return run.themeMix >= 1 ? THEMES[run.theme][key] : mixHex(THEMES[run.themeFrom][key], THEMES[run.theme][key], run.themeMix); }

  function draw() {
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    const cam = run.cam.x;
    ctx.save();
    if (run.shake > 0.3) ctx.translate((Math.random() - 0.5) * run.shake, (Math.random() - 0.5) * run.shake);
    ctx.fillStyle = col('sky'); ctx.fillRect(0, 0, LOGICAL_W, H);
    ctx.fillStyle = col('sun'); circle(ctx, 296 - ((cam * 0.03) % 600), 118, 42);
    ctx.fillStyle = col('ground'); ctx.fillRect(0, yGround, LOGICAL_W, H - yGround);
    ctx.fillStyle = col('groundTop'); ctx.fillRect(0, yGround, LOGICAL_W, 6);

    const sky = col('sky'), water = col('water'), green = col('green'), ink = col('ink');
    for (let j = Math.max(0, run.cur - 2); j < run.course.length; j++) {
      const h = run.course[j];
      if (h.channelStart - cam > LOGICAL_W + 40) break;
      if (h.greenEnd - cam < -40) continue;
      ctx.fillStyle = green; ctx.fillRect(h.greenStart - cam, yGround, h.greenEnd - h.greenStart, H - yGround);
      gap(h.channelStart - cam, h.channelEnd - h.channelStart, sky, water);
      if (h.hazard) gap(h.hazard.start - cam, h.hazard.end - h.hazard.start, sky, water);
      // cup and flag
      ctx.fillStyle = hexA(THEMES[run.theme].ink, 0.85);
      ctx.beginPath(); ctx.ellipse(h.cup - cam, yGround + 1, T.CUP_R, 3, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = hexA(THEMES[run.theme].ink, 0.55); ctx.fillRect(h.cup - cam - 1, yGround - 52, 2, 52);
      ctx.fillStyle = accent(); ctx.beginPath(); ctx.moveTo(h.cup - cam + 1, yGround - 52); ctx.lineTo(h.cup - cam + 22, yGround - 45); ctx.lineTo(h.cup - cam + 1, yGround - 38); ctx.closePath(); ctx.fill();
    }

    const b = run.ball, ch = CHARS[charIndex];
    if (b.state !== 'gone') drawShape(ctx, ch, b.x - cam, yGround - b.h - T.BALL_R, b.sx, b.sy, b.ang);
    if (b.state === 'sunk') { ctx.fillStyle = green; ctx.fillRect(b.x - cam - 20, yGround, 40, 34); ctx.fillStyle = hexA(THEMES[run.theme].ink, 0.85); ctx.beginPath(); ctx.ellipse(b.x - cam, yGround + 1, T.CUP_R, 3, 0, 0, TAU); ctx.fill(); }
    if (b.state === 'water' && b.h < -T.BALL_R) { ctx.fillStyle = water; ctx.fillRect(b.x - cam - 30, yGround + 6, 60, H - yGround); }
    if (b.state === 'charge') drawChargeRing(b.x - cam, yGround - T.BALL_R, b.charge / T.T_MAX, ch.color, ink);
    drawParticles(cam); drawPopups(cam, ink);
    ctx.restore();
  }
  function gap(x, w, sky, water) {
    if (w <= 0) return;
    ctx.fillStyle = sky; ctx.fillRect(x, yGround, w, 6);
    ctx.fillStyle = water; ctx.fillRect(x, yGround + 6, w, H - yGround);
  }
  // The player: one flat shape in its own pastel, rotating with its spin. Squash is applied in world axes before the rotation.
  function drawShape(g, ch, x, y, sx, sy, ang) {
    g.save(); g.translate(x, y); g.scale(sx, sy); g.rotate(ang);
    g.fillStyle = ch.color; g.strokeStyle = ch.color; g.lineWidth = 2; g.lineJoin = 'round';
    shapePath(g, ch.shape, 0, 0, T.BALL_R);
    g.fill(); if (ch.shape !== 'circle') g.stroke();
    g.fillStyle = 'rgba(59,58,74,.28)'; circle(g, T.BALL_R * 0.45, 0, 2.2);
    g.restore();
  }
  function drawChargeRing(x, y, p, color, ink) {
    const r = 26;
    ctx.lineCap = 'round';
    ctx.strokeStyle = hexA(THEMES[run.theme].ink, 0.12); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    if (p > 0.005) { ctx.strokeStyle = color; ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + TAU * p); ctx.stroke(); }
  }
  function drawParticles(cam) {
    for (const p of run.parts) {
      if (p.t < 0) continue;
      const k = p.t / p.life, a = 1 - k;
      ctx.globalAlpha = a;
      if (p.kind === 'dot') { ctx.fillStyle = p.color; circle(ctx, p.x - cam, p.y, p.r * (0.5 + 0.5 * a)); }
      else { ctx.strokeStyle = p.color; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x - cam, p.y, 4 + k * p.size, 0, TAU); ctx.stroke(); }
    }
    ctx.globalAlpha = 1;
  }
  function drawPopups(cam, ink) {
    for (const p of run.popups) {
      const a = 1 - p.t / p.life;
      const s = p.t < 0.12 ? 0.7 + (p.t / 0.12) * 0.3 : 1;
      ctx.save(); ctx.globalAlpha = a;
      ctx.translate(clamp(p.x - cam, 72, LOGICAL_W - 72), p.y - p.t * 34); ctx.scale(s, s);
      ctx.font = (p.spaced ? '600 ' : '300 ') + p.size + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      try { ctx.letterSpacing = p.spaced ? '0.22em' : '0em'; } catch (e) { /* older engines */ }
      ctx.fillStyle = p.color || ink;
      ctx.fillText(p.text, p.spaced ? p.size * 0.11 : 0, 0);
      ctx.restore();
    }
  }

  // ---------- UI ----------
  function show(node, on) { node.classList.toggle('hidden', !on); }
  function syncHud() {
    if (!run) return;
    el.score.textContent = fmt(run.score);
    const len = el.score.textContent.length;
    el.score.classList.toggle('mid', len === 5);
    el.score.classList.toggle('long', len > 5);
    const onFairway = run.strokes >= 1 && run.ball.state === 'rest';
    if (onFairway) { el.combo.textContent = 'Stroke ' + Math.min(run.strokes + 1, T.MAX_STROKES) + ' of ' + T.MAX_STROKES; el.combo.classList.add('stroke'); }
    else { el.combo.textContent = run.combo >= 2 ? 'Streak ×' + run.combo : run.combo === 1 ? 'Perfect' : ''; el.combo.classList.remove('stroke'); }
    el.best.textContent = 'Best ' + fmt(Math.max(Save.d.best, run.score));
    el.mode.textContent = (run.mode === 'daily' ? 'Daily · ' : '') + THEMES[run.theme].name;
    el.game.dataset.theme = THEMES[run.theme].dark ? 'dark' : 'light';
  }
  function renderMenu() {
    const ch = CHARS[charIndex];
    const unlocked = ch.unlock <= Save.d.best;
    el.mName.textContent = ch.name;
    el.mKind.textContent = unlocked ? 'Shape' : 'Unlock at ' + ch.unlock;
    el.game.style.setProperty('--accent', ch.color);
    const g = el.preview.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 112, 112);
    g.setTransform(2, 0, 0, 2, 0, 0);
    if (!unlocked) g.globalAlpha = 0.25;
    drawShape(g, ch, 28, 28, 1, 1, -0.35);
    if (!unlocked) {
      g.globalAlpha = 1; const ink = THEMES[0].ink;
      g.strokeStyle = ink; g.lineWidth = 2; g.lineCap = 'round'; g.beginPath(); g.arc(28, 24, 5, Math.PI, 0); g.stroke();
      g.fillStyle = ink; rr(g, 21, 24, 14, 11, 3); g.fill();
    }
    el.mStats.textContent = 'Best ' + fmt(Save.d.best) + '  ·  streak ×' + Save.d.bestCombo + '  ·  ' + fmt(Save.d.totalHoles) + ' holes';
    el.play.disabled = !unlocked;
    el.play.textContent = unlocked ? 'Play' : 'Locked';
    el.mDots.textContent = '';
    CHARS.forEach((c, i) => { const s = document.createElement('span'); if (i === charIndex) s.className = 'on'; else if (c.unlock > Save.d.best) s.className = 'locked'; el.mDots.appendChild(s); });
    const done = Save.d.daily[todayKey()];
    el.daily.innerHTML = done ? 'Daily done<small>' + fmt(done.score) + ' pts · ' + done.holes + ' holes · share</small>' : 'Daily #' + dayNumber() + '<small>one try · same for everyone</small>';
    el.soundBtn.textContent = 'Sound: ' + (Save.d.sound ? 'on' : 'off');
  }
  function showMenu() {
    state = 'menu';
    run = newRun('play', true);
    el.game.dataset.theme = 'light';
    show(el.hud, false); show(el.over, false); show(el.pause, false); show(el.help, false); show(el.menu, true);
    renderMenu();
  }
  function startRun(mode) {
    run = newRun(mode, false);
    state = 'playing';
    show(el.menu, false); show(el.over, false); show(el.pause, false); show(el.help, false); show(el.hud, true);
    show(el.hint, true); el.hint.classList.remove('on');
    syncHud();
    lastT = performance.now();
  }
  function stripText(results) {
    const map = { P: '🟩', N: '🟨', X: '🟥' };
    const s = results.map((r) => map[r] || '').join('');
    return results.length > 40 ? Array.from(s).slice(0, 40).join('') + '…' : s;
  }
  function shareText(res) {
    const url = location.href.split(/[?#]/)[0];
    return 'Hop ⛳ Daily #' + res.day + '\n' + fmt(res.score) + ' pts · ' + res.holes + ' holes · best streak ×' + res.combo + '\n' + stripText(res.results) + '\n' + url;
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
    (o.strip || []).slice(0, 60).forEach((r) => { const d = document.createElement('span'); d.className = r === 'P' ? 'p' : r === 'X' ? 'x' : 'n'; el.oStrip.appendChild(d); });
    show(el.oAgain, !o.daily); show(el.oShare, !!o.daily);
    el.oShare.textContent = 'Share';
    el.oShare.onclick = o.daily ? async () => { el.oShare.textContent = await share(shareText(o.daily)); } : null;
    show(el.hint, false); show(el.menu, false); show(el.pause, false); show(el.hud, true); show(el.over, true);
  }
  function showDailyDone(done) {
    run = newRun('play', true);
    showOver({ eyebrow: 'Daily #' + done.day + ' · done', title: fmt(done.score) + ' points', stats: done.holes + ' holes · best streak ×' + done.combo, best: 'COME BACK TOMORROW', strip: done.results, unlock: '', daily: done });
    show(el.hud, false);
  }
  function pause() {
    if (state !== 'playing') return;
    state = 'paused';
    if (run.ball.state === 'charge') { run.ball.state = 'rest'; run.ball.charge = 0; }
    el.hint.classList.remove('on'); Sfx.charge(-1);
    show(el.pause, true);
  }
  function resume() { if (state !== 'paused') return; state = 'playing'; show(el.pause, false); lastT = performance.now(); }

  // ---------- input ----------
  function onDown(e) { if (e && e.preventDefault) e.preventDefault(); Sfx.init(); Sfx.resume(); press(); }
  canvas.addEventListener('pointerdown', onDown);
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  window.addEventListener('blur', release);
  canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      if (state === 'playing') { Sfx.init(); press(); }
      else if (state === 'paused') resume();
      else if (state === 'over' && run && run.mode === 'play') startRun('play');
      else if (state === 'menu' && !el.play.disabled) startRun('play');
    }
    if (e.code === 'Escape' && state === 'playing') pause();
  });
  window.addEventListener('keyup', (e) => { if (e.code === 'Space' || e.code === 'ArrowUp') release(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

  el.prev.addEventListener('click', () => { charIndex = (charIndex + CHARS.length - 1) % CHARS.length; Save.d.char = CHARS[charIndex].id; Save.save(); renderMenu(); });
  el.nextBtn.addEventListener('click', () => { charIndex = (charIndex + 1) % CHARS.length; Save.d.char = CHARS[charIndex].id; Save.save(); renderMenu(); });
  el.play.addEventListener('click', () => { if (!el.play.disabled) { Sfx.init(); Sfx.resume(); startRun('play'); } });
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
    get state() { return state; }, get run() { return run; }, get charIndex() { return charIndex; }, get yGround() { return yGround; }, get H() { return H; },
    start: startRun, menu: showMenu, save: Save, data: DATA, press, release, sync: syncHud,
    simulateShot, solveShot, groundAt,
    hitWithPower(p) { if (!run || run.dead || run.ball.state !== 'rest') return false; fire(p); return true; },
  };
})();
