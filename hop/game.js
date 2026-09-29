/* Hop — hold to charge, release to jump, land dead center.
   Side-view 2D, one thumb, portrait, playable on mute, works offline. No dependencies, no build step. */
(() => {
  'use strict';

  // ---------- data & constants ----------
  const DATA = window.HOP_DATA;
  const T = DATA.tuning;
  const CHARS = DATA.characters;
  const THEMES = DATA.themes;
  const KEY = 'hop.v1';
  const LAUNCH_UTC = Date.UTC(2026, 8, 29);
  const LOGICAL_W = 390;
  const WATER_FRAC = 0.72;
  const FONT = '-apple-system, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif';

  // ---------- helpers ----------
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const $ = (id) => document.getElementById(id);
  const TAU = Math.PI * 2;

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
  function hash01(n) { let x = Math.imul(n | 0, 374761393) + 668265263; x = Math.imul(x ^ (x >>> 13), 1274126177); return ((x ^ (x >>> 16)) >>> 0) / 4294967296; }
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
  function shade(hex, k) { const c = rgb(hex).map((v) => clamp(Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k), 0, 255)); return 'rgb(' + c.join(',') + ')'; }
  function rr(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath(); g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  function circle(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
  function ellipse(g, x, y, rx, ry) { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill(); }
  function tri(g, x1, y1, x2, y2, x3, y3) { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.lineTo(x3, y3); g.closePath(); g.fill(); }

  // ---------- persistence ----------
  const Save = {
    d: { best: 0, bestHops: 0, bestCombo: 0, totalHops: 0, daily: {}, sound: true, char: CHARS[0].id, runs: 0 },
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
    jump() { this.tone(300, 0.18, 'sine', 0.18, 0, 720); },
    land() { this.tone(160, 0.09, 'triangle', 0.16, 0, 90); },
    perfect(c) { const b = 660 * Math.pow(1.06, Math.min(c, 12)); this.tone(b, 0.1, 'sine', 0.2); this.tone(b * 1.5, 0.28, 'sine', 0.2, 0.09); },
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
  let cssW = 390, cssH = 800, dpr = 1, scale = 1, H = 800, yWater = 576;
  let lastT = 0;

  function resize() {
    cssW = el.game.clientWidth || window.innerWidth;
    cssH = el.game.clientHeight || window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    scale = cssW / LOGICAL_W;
    H = cssH / scale;
    yWater = H * WATER_FRAC;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
  }

  // ---------- physics ----------
  function jumpParams(p) {
    const d = T.D_MIN + (T.D_MAX - T.D_MIN) * p;
    const tf = T.T_FLIGHT_MIN + T.T_FLIGHT_ADD * p;
    return { vx: d / tf, vy: -T.G * tf / 2 };
  }
  // Where a jump of power p from (x0, y0) crosses the level yTop on the way down. NaN if it never gets that high.
  function landingX(x0, y0, p, yTop) {
    const j = jumpParams(p);
    const disc = j.vy * j.vy - 2 * T.G * (y0 - yTop);
    if (disc < 0) return NaN;
    return x0 + j.vx * ((-j.vy + Math.sqrt(disc)) / T.G);
  }
  // Seconds until a jump of power p from y0 comes down to yTop (NaN if it never gets that high).
  function landingT(y0, p, yTop) {
    const j = jumpParams(p);
    const disc = j.vy * j.vy - 2 * T.G * (y0 - yTop);
    return disc < 0 ? NaN : (-j.vy + Math.sqrt(disc)) / T.G;
  }
  function solvePower(x0, y0, xT, yTop) {
    let lo = 0, hi = 1;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      const lx = landingX(x0, y0, mid, yTop);
      if (isNaN(lx) || lx < xT) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }

  // ---------- run ----------
  const biomeFor = (i) => Math.floor(i / T.BIOME_LEN) % THEMES.length;
  const theme = () => THEMES[run.biome];
  const accent = () => CHARS[charIndex].color;
  const padTop = (p) => yWater - p.h;
  const padX = (p) => p.x + (p.move ? p.move.amp * Math.sin(TAU * run.t / p.move.period + p.move.phase) : 0);

  function newRun(mode, demo) {
    const seed = mode === 'daily' ? hashStr('hop:' + todayKey()) : (Math.random() * 4294967296) >>> 0;
    const r = {
      mode, demo: !!demo, seed, rng: mulberry32(seed), t: 0,
      score: 0, hops: 0, combo: 0, maxCombo: 0, results: [], pads: [], cur: 0, startBest: Save.d.best,
      frog: { x: 0, y: 0, vx: 0, vy: 0, off: 0, state: 'rest', charge: 0, sx: 1, sy: 1, restT: 0, look: 0, hitReason: '' },
      cam: { x: 0 }, popups: [], parts: [], shake: 0, dead: false, deadReason: '', deadT: 0,
      biome: 0, biomeFrom: 0, biomeMix: 1, hinted: false, demoTarget: 0, dailyResult: null,
    };
    while (r.pads.length < 8) spawnPad(r);
    r.frog.x = r.pads[0].x; r.frog.y = padTop(r.pads[0]);
    r.cam.x = r.frog.x - T.FROG_SCREEN_X;
    return r;
  }

  function spawnPad(r) {
    const i = r.pads.length;
    const prev = r.pads[i - 1];
    const diff = clamp(i / T.RAMP, 0, 1);
    const rng = r.rng;
    let w, x, h, move = null;
    if (!prev) { w = 120; x = 120; h = 100; rng(); rng(); rng(); }
    else {
      const wLo = lerp(T.W_START[0], T.W_END[0], diff), wHi = lerp(T.W_START[1], T.W_END[1], diff);
      w = Math.round(lerp(wLo, wHi, rng()));
      const minGap = prev.w / 2 + w / 2 + T.GAP_MARGIN;
      const maxGap = T.D_MAX - 24 - prev.w / 2;
      x = Math.round(prev.x + lerp(minGap, maxGap, Math.pow(rng(), 1 - 0.45 * diff)));
      h = Math.round(clamp(prev.h + (rng() * 2 - 1) * lerp(6, T.H_VAR_END, diff), T.H_MIN, T.H_MAX));
    }
    const mv = rng(), ma = rng(), mp = rng(), mph = rng();
    if (i >= T.MOVE_FROM && mv < lerp(0, T.MOVE_CHANCE_END, diff)) move = { amp: lerp(T.MOVE_AMP[0], T.MOVE_AMP[1], ma), period: lerp(T.MOVE_PERIOD[0], T.MOVE_PERIOD[1], mp), phase: mph * TAU };
    r.pads.push({ i, x, w, h, move, sq: 1, biome: biomeFor(i) });
  }
  function ensurePads() { while (run.pads.length < run.cur + 8) spawnPad(run); }

  function popup(text, x, y, o) {
    o = o || {};
    run.popups.push({ text, x, y, t: 0, life: o.life || 1.0, color: o.color || null, size: o.size || 20, spaced: o.spaced !== false });
  }
  // ---------- particles: small dots and thin rings, nothing else ----------
  function part(o) { run.parts.push(Object.assign({ kind: 'dot', x: 0, y: 0, vx: 0, vy: 0, t: 0, life: 0.5, r: 2, color: '#000', g: 0, size: 46 }, o)); }
  function dots(x, y, n, color, speed, spread, g) {
    for (let i = 0; i < n; i++) part({ x: x + (Math.random() - 0.5) * spread, y, vx: (Math.random() - 0.5) * speed * 2, vy: -Math.random() * speed - 20, life: 0.4 + Math.random() * 0.3, r: 1.5 + Math.random() * 2, color, g: g == null ? 300 : g });
  }
  function ringFx(x, y, color, delay, size) { part({ kind: 'ring', x, y, life: 0.6, color, t: -(delay || 0), size: size || 46 }); }
  function trail(x, y, color) { part({ x, y, life: 0.3, r: 2 + Math.random() * 1.5, color: hexA(color, 0.45) }); }

  function press() {
    if (state !== 'playing' || !run || run.dead || run.demo) return;
    const f = run.frog;
    if (f.state !== 'rest') return;
    f.state = 'charge'; f.charge = 0; run.hinted = true;
    el.hint.classList.add('on');
    Sfx.charge(0);
  }
  function release() {
    el.hint.classList.remove('on');
    if (run && run.hinted) el.hint.classList.add('hidden');
    if (!run || run.dead || run.frog.state !== 'charge' || run.demo) return;
    jump();
  }
  function jump() {
    const f = run.frog;
    const p = clamp(f.charge / T.T_MAX, 0, 1);
    const j = jumpParams(p);
    f.vx = j.vx; f.vy = j.vy; f.state = 'air'; f.power = p; f.x0 = f.x;
    f.sx = 0.8; f.sy = 1.3;
    const pad = run.pads[run.cur]; pad.sq = 1.06;
    dots(f.x, f.y, 6, hexA(accent(), 0.8), 120, 20); ringFx(f.x, f.y, hexA(theme().ink, 0.22), 0, 30);
    Sfx.charge(-1); Sfx.jump(); haptic('tap');
  }

  function update(dt) {
    const f = run.frog;
    run.t += dt;
    const cur = run.pads[run.cur];

    if (!run.dead) {
      if (f.state === 'rest' || f.state === 'charge') {
        f.x = padX(cur) + f.off; f.y = padTop(cur);
        f.restT += dt;
      }
      if (f.state === 'rest') {
        f.vx = f.vy = 0;
        const breathe = 1 + 0.02 * Math.sin(run.t * 3);
        f.sx += (1 - f.sx) * (1 - Math.exp(-dt * 12));
        f.sy += (breathe - f.sy) * (1 - Math.exp(-dt * 12));
        cur.sq += (1 - cur.sq) * (1 - Math.exp(-dt * 10));
        if (run.demo && f.restT > 0.55) {
          const nxt = run.pads[run.cur + 1];
          const p = solvePower(f.x, f.y, padX(nxt), padTop(nxt));
          run.demoTarget = clamp(p + (Math.random() - 0.5) * 0.05, 0, 1) * T.T_MAX;
          f.state = 'charge'; f.charge = 0;
        }
      } else if (f.state === 'charge') {
        f.charge = Math.min(T.T_MAX, f.charge + dt);
        const p = f.charge / T.T_MAX;
        f.sx += (1 + 0.3 * p - f.sx) * (1 - Math.exp(-dt * 14));
        f.sy += (1 - 0.4 * p - f.sy) * (1 - Math.exp(-dt * 14));
        cur.sq += (1 - 0.08 * p - cur.sq) * (1 - Math.exp(-dt * 14));
        Sfx.charge(p);
        if (run.demo && f.charge >= run.demoTarget) jump();
      } else if (f.state === 'air' || f.state === 'fall') {
        const px = f.x, py = f.y;
        // exact constant-acceleration step, so the landing spot does not depend on the frame rate
        f.x += f.vx * dt; f.y += f.vy * dt + 0.5 * T.G * dt * dt; f.vy += T.G * dt;
        f.look = clamp(f.vx / 300, -1, 1);
        f.trailT = (f.trailT || 0) + dt;
        if (f.trailT > 0.045) { f.trailT = 0; trail(f.x, f.y - 17, accent()); }
        const tx = f.vy < 0 ? 0.85 : 0.92, ty = f.vy < 0 ? 1.25 : 1.1;
        f.sx += (tx - f.sx) * (1 - Math.exp(-dt * 10)); f.sy += (ty - f.sy) * (1 - Math.exp(-dt * 10));
        cur.sq += (1 - cur.sq) * (1 - Math.exp(-dt * 10));
        if (f.state === 'air') {
          for (let j = run.cur; j < Math.min(run.pads.length, run.cur + 6); j++) {
            const pad = run.pads[j], cx = padX(pad), top = padTop(pad), left = cx - pad.w / 2, right = cx + pad.w / 2;
            if (f.vy > 0 && py <= top && f.y >= top) {
              const k = (top - py) / (f.y - py || 1);
              const lx = px + (f.x - px) * k;
              if (lx >= left && lx <= right) { land(j, lx); break; }
            }
            if (j > run.cur && px < left - 8 && f.x >= left - 8 && f.y > top + 6) {
              f.x = left - 9; f.vx = -70; f.state = 'fall'; f.hitReason = 'Hit the side of a pad';
              dots(f.x, f.y - 10, 5, hexA(theme().ink, 0.5), 80, 6);
              break;
            }
          }
        }
        if (f.y > yWater + 26) die(f.hitReason || (f.x < padX(run.pads[run.cur + 1]) ? 'Fell short' : 'Jumped too far'));
      }
    } else {
      run.deadT += dt;
      if (f.state !== 'gone') {
        f.vy += T.G * dt; f.y += f.vy * dt; f.x += f.vx * dt;
        if (f.y > H + 80) f.state = 'gone';
      }
      if (run.demo && run.deadT > 1.4) { run = newRun('play', true); return; }
      if (!run.demo && run.deadT > 0.75 && state === 'playing') finishRun();
    }

    // camera, biome crossfade, particles, popups, shake
    const camT = f.x - T.FROG_SCREEN_X;
    run.cam.x += (camT - run.cam.x) * (1 - Math.exp(-dt * 6));
    if (run.biomeMix < 1) run.biomeMix = Math.min(1, run.biomeMix + dt / 1.2);
    for (const p of run.parts) { p.t += dt; if (p.kind !== 'ring') { p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.spin * dt; } }
    run.parts = run.parts.filter((p) => p.t < p.life);
    for (const p of run.popups) p.t += dt;
    run.popups = run.popups.filter((p) => p.t < p.life);
    run.shake *= Math.exp(-dt * 7);
  }

  function land(j, lx) {
    const f = run.frog, pad = run.pads[j];
    const cx = padX(pad), top = padTop(pad);
    f.x = lx; f.y = top; f.off = lx - cx; f.vx = f.vy = 0;
    f.state = 'rest'; f.restT = 0; f.sx = 1.45; f.sy = 0.55; pad.sq = 0.9;
    dots(lx, top, 7, hexA(theme().muted, 0.9), 110, 30);
    if (j === run.cur) { Sfx.land(); return; } // hopped in place, no score
    const skipped = j - run.cur - 1;
    const perfect = Math.abs(f.off) <= T.PERFECT_R;
    let gained;
    if (perfect) {
      run.combo++; run.maxCombo = Math.max(run.maxCombo, run.combo);
      gained = 2 * run.combo + skipped;
      run.results.push('P');
      popup('PERFECT', lx, top - 62, { color: accent(), size: 20 });
      if (run.combo >= 2) popup('×' + run.combo, lx, top - 90, { color: accent(), size: 26, life: 1.2, spaced: false });
      ringFx(lx, top + 10, accent(), 0, 60); ringFx(lx, top + 10, accent(), 0.12, 44); dots(lx, top, 10, hexA(accent(), 0.85), 160, 30);
      Sfx.perfect(run.combo); haptic('perfect');
    } else {
      run.combo = 0;
      gained = 1 + skipped;
      run.results.push('N');
      popup('+' + gained, lx, top - 58, { size: 24, spaced: false });
      Sfx.land(); haptic('tap');
    }
    if (skipped > 0) popup('LONG JUMP +' + skipped, lx, top - 118, { size: 14, life: 1.3 });
    run.score += gained; run.hops++;
    if (!run.demo) { Save.d.totalHops++; if (run.score > Save.d.best) Save.d.best = run.score; }
    run.cur = j; ensurePads();
    if (pad.biome !== run.biome) { run.biomeFrom = run.biome; run.biome = pad.biome; run.biomeMix = 0; }
    syncHud();
  }

  function die(reason) {
    if (run.dead) return;
    run.dead = true; run.deadReason = reason; run.deadT = 0;
    run.results.push('X');
    run.shake = 14;
    const f = run.frog;
    const inkA = hexA(theme().ink, 0.35);
    ringFx(f.x, yWater, inkA, 0, 70); ringFx(f.x, yWater, inkA, 0.12, 56); ringFx(f.x, yWater, inkA, 0.24, 42);
    dots(f.x, yWater, 8, hexA(accent(), 0.8), 140, 16, 600);
    f.state = 'gone';
    Sfx.charge(-1);
    if (!run.demo) { Sfx.splash(); haptic('fail'); el.hint.classList.add('hidden'); }
  }

  function finishRun() {
    state = 'over';
    const before = run.startBest, after = Save.d.best;
    let bestLine = run.score >= after && run.score > before ? 'NEW BEST' : 'BEST ' + fmt(after);
    if (run.hops > Save.d.bestHops) Save.d.bestHops = run.hops;
    if (run.maxCombo > Save.d.bestCombo) Save.d.bestCombo = run.maxCombo;
    if (run.mode === 'daily') {
      run.dailyResult = { day: dayNumber(), score: run.score, hops: run.hops, combo: run.maxCombo, results: run.results.slice(0, 60) };
      Save.d.daily[todayKey()] = run.dailyResult;
      bestLine = 'DAILY #' + run.dailyResult.day + (run.score > before ? ' · NEW BEST' : '');
    }
    Save.d.runs = (Save.d.runs || 0) + 1;
    Save.save();
    const newly = CHARS.filter((c) => c.unlock > before && c.unlock <= after);
    let unlockLine;
    if (newly.length) unlockLine = 'New character unlocked: ' + newly.map((c) => c.name).join(', ');
    else { const n = CHARS.find((c) => c.unlock > after); unlockLine = n ? 'Next character at best ' + n.unlock + ' · you have ' + after : 'All characters unlocked'; }
    showOver({
      eyebrow: 'Missed', title: run.deadReason,
      stats: fmt(run.score) + ' pts · ' + run.hops + ' hops · best streak ×' + run.maxCombo,
      best: bestLine, strip: run.results, unlock: unlockLine, daily: run.dailyResult,
    });
  }

  // ---------- drawing: flat shapes, soft depth, a tiny glow ----------
  function draw() {
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    const cam = run.cam.x;
    ctx.save();
    if (run.shake > 0.3) ctx.translate((Math.random() - 0.5) * run.shake, (Math.random() - 0.5) * run.shake);
    if (run.biomeMix < 1) { drawBackground(THEMES[run.biomeFrom], cam, 1); drawBackground(THEMES[run.biome], cam, run.biomeMix); }
    else drawBackground(THEMES[run.biome], cam, 1);
    for (let j = Math.max(0, run.cur - 3); j < run.pads.length; j++) { const p = run.pads[j]; if (padX(p) - p.w / 2 - cam > LOGICAL_W + 30) break; drawPad(p, cam); }
    const f = run.frog, ch = CHARS[charIndex];
    if (f.state !== 'gone') drawShape(ctx, ch, f.x - cam, f.y, f.sx, f.sy, true);
    if (f.state === 'charge') drawChargeRing(f.x - cam, f.y - 17, f.charge / T.T_MAX, ch.color);
    drawParticles(cam); drawPopups(cam);
    ctx.restore();
  }

  function drawBackground(t, cam, alpha) {
    ctx.globalAlpha = alpha;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, t.bg); g.addColorStop(1, t.bg2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, LOGICAL_W, H);
    const span = 900;
    for (let k = 0; k < 4; k++) {
      const base = hash01(k * 19 + 3) * span, par = 0.05 + 0.04 * k;
      const ox = (((base - cam * par) % span) + span) % span - 150;
      const oy = 80 + hash01(k * 29 + 7) * (yWater - 200);
      const r = 90 + hash01(k * 41 + 1) * 110;
      const og = ctx.createRadialGradient(ox, oy, 0, ox, oy, r);
      og.addColorStop(0, hexA(t.orb, 0.34)); og.addColorStop(1, hexA(t.orb, 0));
      ctx.fillStyle = og; ctx.fillRect(ox - r, oy - r, r * 2, r * 2);
    }
    ctx.fillStyle = t.void; ctx.fillRect(0, yWater, LOGICAL_W, H - yWater);
    ctx.fillStyle = t.base; ctx.fillRect(0, yWater - 0.75, LOGICAL_W, 1.5);
    ctx.globalAlpha = 1;
  }
  function rrTop(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x, y + h);
    g.lineTo(x, y + r); g.arcTo(x, y, x + r, y, r); g.lineTo(x + w - r, y); g.arcTo(x + w, y, x + w, y + r, r);
    g.lineTo(x + w, y + h); g.closePath();
  }
  function drawPad(p, cam) {
    const x = padX(p) - cam, top = padTop(p);
    if (x + p.w / 2 < -20) return;
    const t = THEMES[p.biome];
    const bottom = yWater + 1;
    ctx.save();
    ctx.translate(x, bottom); ctx.scale(1, p.sq); ctx.translate(-x, -bottom);
    const g = ctx.createLinearGradient(0, top, 0, bottom);
    g.addColorStop(0, t.pad[0]); g.addColorStop(1, t.pad[1]);
    ctx.shadowColor = t.padShadow; ctx.shadowBlur = 18; ctx.shadowOffsetY = 8;
    rrTop(ctx, x - p.w / 2, top, p.w, bottom - top, 9); ctx.fillStyle = g; ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.fillStyle = t.marker; circle(ctx, x, top + 10, 3);
    if (p.move) {
      ctx.strokeStyle = hexA(t.marker, 0.35); ctx.lineWidth = 1.5; ctx.lineCap = 'round';
      const l = x - p.w / 2 + 9, r = x + p.w / 2 - 9, y = top + 10;
      ctx.beginPath(); ctx.moveTo(l + 4, y - 3); ctx.lineTo(l, y); ctx.lineTo(l + 4, y + 3); ctx.moveTo(r - 4, y - 3); ctx.lineTo(r, y); ctx.lineTo(r - 4, y + 3); ctx.stroke();
    }
    ctx.restore();
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
      default: { const rad = 7; g.moveTo(cx - r + rad, cy - r); g.arcTo(cx + r, cy - r, cx + r, cy + r, rad); g.arcTo(cx + r, cy + r, cx - r, cy + r, rad); g.arcTo(cx - r, cy + r, cx - r, cy - r, rad); g.arcTo(cx - r, cy - r, cx + r, cy - r, rad); g.closePath(); }
    }
  }
  // The player: one flat shape with a vertical gradient for depth and a soft glow in its own color.
  function drawShape(g, ch, x, y, sx, sy, glow) {
    g.save(); g.translate(x, y); g.scale(sx, sy);
    const S = 34, c = ch.color;
    const grad = g.createLinearGradient(0, -S, 0, 0);
    grad.addColorStop(0, shade(c, 0.24)); grad.addColorStop(1, shade(c, -0.14));
    if (glow) { g.shadowColor = hexA(c, 0.55); g.shadowBlur = 18; g.shadowOffsetY = 3; }
    g.fillStyle = grad; g.strokeStyle = grad; g.lineWidth = 3; g.lineJoin = 'round';
    shapePath(g, ch.shape, 0, -S / 2, S / 2 - 1.5);
    g.fill(); if (ch.shape !== 'circle') g.stroke();
    g.shadowColor = 'transparent'; g.shadowBlur = 0; g.shadowOffsetY = 0;
    g.restore();
  }
  function drawChargeRing(x, y, p, color) {
    const r = 31;
    ctx.lineCap = 'round';
    ctx.strokeStyle = hexA(theme().ink, 0.12); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    if (p > 0.005) {
      ctx.strokeStyle = color; ctx.shadowColor = hexA(color, 0.6); ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + TAU * p); ctx.stroke();
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
    }
  }
  function drawParticles(cam) {
    for (const p of run.parts) {
      if (p.t < 0) continue;
      const k = p.t / p.life, a = 1 - k;
      ctx.globalAlpha = a;
      if (p.kind === 'dot') { ctx.fillStyle = p.color; circle(ctx, p.x - cam, p.y, p.r * (0.5 + 0.5 * a)); }
      else if (p.kind === 'ring') { ctx.strokeStyle = p.color; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x - cam, p.y, 4 + k * p.size, 0, TAU); ctx.stroke(); }
    }
    ctx.globalAlpha = 1;
  }
  function drawPopups(cam) {
    for (const p of run.popups) {
      const a = 1 - p.t / p.life;
      const s = p.t < 0.12 ? 0.7 + (p.t / 0.12) * 0.3 : 1;
      ctx.save(); ctx.globalAlpha = a;
      ctx.translate(p.x - cam, p.y - p.t * 34); ctx.scale(s, s);
      ctx.font = (p.spaced ? '600 ' : '300 ') + p.size + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      try { ctx.letterSpacing = p.spaced ? '0.22em' : '0em'; } catch (e) { /* older engines */ }
      ctx.fillStyle = p.color || theme().ink;
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
    el.combo.textContent = run.combo >= 2 ? 'Streak ×' + run.combo : run.combo === 1 ? 'Perfect' : '';
    const bestTxt = fmt(Math.max(Save.d.best, run.score));
    el.best.textContent = 'Best ' + bestTxt;
    el.mode.textContent = (run.mode === 'daily' ? 'Daily · ' : '') + THEMES[run.biome].name;
    el.game.dataset.theme = THEMES[run.biome].dark ? 'dark' : 'light';
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
    if (!unlocked) g.globalAlpha = 0.22;
    drawShape(g, ch, 28, 46, 1, 1, unlocked);
    if (!unlocked) {
      g.globalAlpha = 1; const ink = THEMES[0].ink;
      g.strokeStyle = ink; g.lineWidth = 2; g.lineCap = 'round'; g.beginPath(); g.arc(28, 27, 5, Math.PI, 0); g.stroke();
      g.fillStyle = ink; rr(g, 21, 27, 14, 11, 3); g.fill();
    }
    el.mStats.textContent = 'Best ' + fmt(Save.d.best) + '  ·  streak ×' + Save.d.bestCombo + '  ·  ' + fmt(Save.d.totalHops) + ' hops';
    el.play.disabled = !unlocked;
    el.play.textContent = unlocked ? 'PLAY' : 'LOCKED';
    el.mDots.textContent = '';
    CHARS.forEach((c, i) => { const s = document.createElement('span'); if (i === charIndex) s.className = 'on'; else if (c.unlock > Save.d.best) s.className = 'locked'; el.mDots.appendChild(s); });
    const done = Save.d.daily[todayKey()];
    el.daily.innerHTML = done ? 'Daily done<small>' + fmt(done.score) + ' pts · ' + done.hops + ' hops · share</small>' : 'Daily #' + dayNumber() + '<small>one try · same for everyone</small>';
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
    return 'Hop 🐸 Daily #' + res.day + '\n' + fmt(res.score) + ' pts · ' + res.hops + ' hops · best streak ×' + res.combo + '\n' + stripText(res.results) + '\n' + url;
  }
  async function share(text) {
    try { if (navigator.share) { await navigator.share({ text }); return 'SHARED'; } } catch (e) { if (e && e.name === 'AbortError') return 'SHARE'; }
    try { await navigator.clipboard.writeText(text); return 'COPIED'; } catch (e) { /* ignore */ }
    return 'SHARE';
  }
  function showOver(o) {
    state = 'over';
    el.oEyebrow.textContent = o.eyebrow; el.oTitle.textContent = o.title; el.oStats.textContent = o.stats;
    el.oBest.textContent = o.best; el.oUnlock.textContent = o.unlock || '';
    el.oStrip.textContent = '';
    (o.strip || []).slice(0, 60).forEach((r) => { const d = document.createElement('span'); d.className = r === 'P' ? 'p' : r === 'X' ? 'x' : 'n'; el.oStrip.appendChild(d); });
    show(el.oAgain, !o.daily); show(el.oShare, !!o.daily);
    el.oShare.textContent = 'SHARE';
    el.oShare.onclick = o.daily ? async () => { el.oShare.textContent = await share(shareText(o.daily)); } : null;
    show(el.hint, false); show(el.menu, false); show(el.pause, false); show(el.hud, true); show(el.over, true);
  }
  function showDailyDone(done) {
    run = newRun('play', true);
    showOver({ eyebrow: 'DAILY #' + done.day + ' · DONE', title: fmt(done.score) + ' points', stats: done.hops + ' hops · best streak ×' + done.combo, best: 'COME BACK TOMORROW', strip: done.results, unlock: '', daily: done });
    show(el.hud, false);
  }
  function pause() {
    if (state !== 'playing') return;
    state = 'paused';
    if (run.frog.state === 'charge') { run.frog.state = 'rest'; run.frog.charge = 0; }
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
    get state() { return state; }, get run() { return run; }, get charIndex() { return charIndex; }, get yWater() { return yWater; }, get H() { return H; },
    start: startRun, menu: showMenu, save: Save, data: DATA, press, release, sync: syncHud,
    solvePower, landingX, landingT, padTop, padX: (p) => padX(p), padXAt: (p, t) => p.x + (p.move ? p.move.amp * Math.sin(TAU * t / p.move.period + p.move.phase) : 0),
    jumpWithPower(p) { if (!run || run.dead || run.frog.state !== 'rest') return false; run.frog.state = 'charge'; run.frog.charge = clamp(p, 0, 1) * T.T_MAX; jump(); return true; },
  };
})();
