/* Hop — hold to charge, release to jump, land dead center.
   Side-view 2D, one thumb, portrait, playable on mute, works offline. No dependencies, no build step. */
(() => {
  'use strict';

  // ---------- data & constants ----------
  const DATA = window.HOP_DATA;
  const T = DATA.tuning;
  const CHARS = DATA.characters;
  const BIOMES = DATA.biomes;
  const KEY = 'hop.v1';
  const PASTELS = DATA.pastels;
  const INK = DATA.ink;
  const CREAM = DATA.cream;
  const LAUNCH_UTC = Date.UTC(2026, 8, 29);
  const LOGICAL_W = 390;
  const WATER_FRAC = 0.72;
  const FONT = 'ui-rounded, "SF Pro Rounded", "Nunito", "Varela Round", "Segoe UI", system-ui, sans-serif';

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
  const biomeFor = (i) => Math.floor(i / T.BIOME_LEN) % BIOMES.length;
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
    run.popups.push({ text, x, y, t: 0, life: o.life || 1.0, color: o.color || CREAM, stroke: o.stroke || INK, size: o.size || 26 });
  }
  // ---------- particles: soft dust, confetti squares, sparkles, rings, a trail ----------
  const pastel = () => PASTELS[Math.floor(Math.random() * PASTELS.length)];
  function part(o) { run.parts.push(Object.assign({ kind: 'dot', x: 0, y: 0, vx: 0, vy: 0, t: 0, life: 0.5, r: 3, color: CREAM, g: 0, rot: 0, spin: 0 }, o)); }
  function puff(x, y, n, spread, up) {
    for (let i = 0; i < n; i++) part({ x: x + (Math.random() - 0.5) * spread, y, vx: (Math.random() - 0.5) * 150, vy: -Math.random() * up - 20, life: 0.35 + Math.random() * 0.3, r: 2.5 + Math.random() * 3.5, color: Math.random() < 0.6 ? CREAM : pastel(), g: 420 });
  }
  function confetti(x, y, n) {
    for (let i = 0; i < n; i++) part({ kind: 'square', x, y, vx: (Math.random() - 0.5) * 320, vy: -120 - Math.random() * 300, life: 0.6 + Math.random() * 0.4, r: 2.5 + Math.random() * 2.5, color: pastel(), g: 700, rot: Math.random() * TAU, spin: (Math.random() - 0.5) * 14 });
  }
  function sparkle(x, y, n, color) {
    for (let i = 0; i < n; i++) part({ kind: 'star', x: x + (Math.random() - 0.5) * 44, y: y + (Math.random() - 0.5) * 28, vy: -30 - Math.random() * 40, life: 0.45 + Math.random() * 0.3, r: 3 + Math.random() * 3, color: color || CREAM });
  }
  function ringFx(x, y, color) { part({ kind: 'ring', x, y, life: 0.5, color }); }
  function trail(x, y, color) { part({ x, y, life: 0.32, r: 2.5 + Math.random() * 2, color: hexA(color, 0.7) }); }

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
    puff(f.x, f.y, 7, 26, 90); confetti(f.x, f.y - 4, 5);
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
        if (f.trailT > 0.045) { f.trailT = 0; trail(f.x, f.y - 18, CHARS[charIndex].body); }
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
              puff(f.x, f.y - 10, 5, 6, 60);
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
    puff(lx, top, 9, 34, 80); sparkle(lx, top - 10, 2);
    if (j === run.cur) { Sfx.land(); return; } // hopped in place, no score
    const skipped = j - run.cur - 1;
    const perfect = Math.abs(f.off) <= T.PERFECT_R;
    let gained;
    if (perfect) {
      run.combo++; run.maxCombo = Math.max(run.maxCombo, run.combo);
      gained = 2 * run.combo + skipped;
      run.results.push('P');
      popup('PERFECT', lx, top - 60, { size: 30 });
      if (run.combo >= 2) popup('×' + run.combo, lx, top - 92, { color: '#ff9fb2', size: 22, life: 1.2 });
      ringFx(lx, top + 11, '#ff9fb2'); confetti(lx, top - 6, 16); sparkle(lx, top - 22, 6, '#fff0a6');
      Sfx.perfect(run.combo); haptic('perfect');
    } else {
      run.combo = 0;
      gained = 1 + skipped;
      run.results.push('N');
      popup('+' + gained, lx, top - 56, { size: 24 });
      Sfx.land(); haptic('tap');
    }
    if (skipped > 0) popup('LONG JUMP +' + skipped, lx, top - 120, { color: '#8fd9c4', size: 18, life: 1.3 });
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
    const b = BIOMES[run.biome];
    if (b.water) { for (let i = 0; i < 26; i++) run.parts.push({ kind: 'dot', x: f.x + (Math.random() - 0.5) * 30, y: yWater, vx: (Math.random() - 0.5) * 260, vy: -Math.random() * 420 - 80, t: 0, life: 0.5 + Math.random() * 0.4, r: 2 + Math.random() * 3.5, color: hexA(b.water, 0.95), g: 900 }); f.state = 'gone'; }
    else f.vx *= 0.3;
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
      eyebrow: BIOMES[run.biome].water ? 'SPLASH' : 'FLOATED AWAY', title: run.deadReason,
      stats: fmt(run.score) + ' pts · ' + run.hops + ' hops · best streak ×' + run.maxCombo,
      best: bestLine, strip: run.results, unlock: unlockLine, daily: run.dailyResult,
    });
  }

  // ---------- drawing: pastel scenery, jelly cube ----------
  function draw() {
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    const cam = run.cam.x;
    ctx.save();
    if (run.shake > 0.3) ctx.translate((Math.random() - 0.5) * run.shake, (Math.random() - 0.5) * run.shake);
    if (run.biomeMix < 1) { drawBackground(BIOMES[run.biomeFrom], cam, 1); drawBackground(BIOMES[run.biome], cam, run.biomeMix); }
    else drawBackground(BIOMES[run.biome], cam, 1);
    for (let j = Math.max(0, run.cur - 3); j < run.pads.length; j++) { const p = run.pads[j]; if (padX(p) - p.w / 2 - cam > LOGICAL_W + 30) break; drawPad(p, cam); }
    drawWaterFront(cam);
    const f = run.frog;
    if (f.state !== 'gone') drawChar(ctx, CHARS[charIndex], f.x - cam, f.y, f.sx, f.sy, f.look);
    if (f.state === 'charge') drawChargeBar(f.x - cam, f.y - 62, f.charge / T.T_MAX);
    drawParticles(cam); drawPopups(cam);
    ctx.restore();
  }

  function drawBackground(b, cam, alpha) {
    ctx.globalAlpha = alpha;
    const sky = ctx.createLinearGradient(0, 0, 0, yWater);
    sky.addColorStop(0, b.sky[0]); sky.addColorStop(1, b.sky[1]);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, LOGICAL_W, H);
    if (b.stars) {
      const span = LOGICAL_W * 1.5;
      for (let i = 0; i < (b.scene === 'planets' ? 90 : 55); i++) {
        const sx = (((hash01(i * 7 + 1) * span - cam * 0.04) % span) + span) % span - LOGICAL_W * 0.25;
        const sy = hash01(i * 13 + 3) * (b.scene === 'planets' ? H : yWater * 0.8);
        const tw = 0.6 + 0.4 * Math.sin(run.t * 2 + i);
        ctx.globalAlpha = alpha * tw * (0.5 + 0.5 * hash01(i * 3 + 9));
        ctx.fillStyle = '#fff3c4';
        circle(ctx, sx, sy, 0.8 + hash01(i * 5 + 2) * 1.5);
      }
      ctx.globalAlpha = alpha;
    }
    if (b.sun) {
      const sx = b.sun.x, sy = b.sun.low ? yWater - 150 : b.sun.y, r = b.sun.r;
      const g = ctx.createRadialGradient(sx, sy, r * 0.6, sx, sy, r * 3.2);
      g.addColorStop(0, hexA(b.sun.color, 0.45)); g.addColorStop(1, hexA(b.sun.color, 0));
      ctx.fillStyle = g; ctx.fillRect(sx - r * 3.2, sy - r * 3.2, r * 6.4, r * 6.4);
      ctx.fillStyle = b.sun.color; circle(ctx, sx, sy, r);
      ctx.fillStyle = 'rgba(255,255,255,.45)'; circle(ctx, sx - r * 0.3, sy - r * 0.3, r * 0.35);
    }
    if (b.moon) {
      const mx = 300, my = 110, r = 28;
      const g = ctx.createRadialGradient(mx, my, r * 0.6, mx, my, r * 3);
      g.addColorStop(0, 'rgba(255,243,196,.4)'); g.addColorStop(1, 'rgba(255,243,196,0)');
      ctx.fillStyle = g; ctx.fillRect(mx - r * 3, my - r * 3, r * 6, r * 6);
      ctx.fillStyle = '#fff3c4'; circle(ctx, mx, my, r);
      ctx.fillStyle = b.sky[0]; circle(ctx, mx + 11, my - 6, r * 0.82);
    }
    if (b.clouds) clouds(cam, b.clouds, alpha);
    if (b.scene === 'planets') {
      const px = ((-cam * 0.08) % 900 + 900) % 900 - 200;
      ctx.fillStyle = '#ffc9d6'; circle(ctx, px, 150, 34);
      ctx.fillStyle = 'rgba(255,255,255,.35)'; circle(ctx, px - 10, 140, 12);
      ctx.strokeStyle = 'rgba(255,240,166,.85)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(px, 150, 60, 13, -0.3, 0, TAU); ctx.stroke();
      ctx.fillStyle = '#bfe0ff'; circle(ctx, px + 520, 260, 18);
      ctx.fillStyle = '#dcccff'; circle(ctx, px + 300, 330, 10);
    } else if (b.scene === 'skyline') {
      skyline(cam, 0.22, yWater, b.far, 60, 140, alpha);
      skyline(cam, 0.4, yWater + 4, b.near, 30, 90, alpha);
    } else {
      hills(cam, 0.16, yWater - 40, b.far, 120, 0.011);
      hills(cam, 0.32, yWater - 6, b.near, 70, 0.02);
    }
    if (b.water) {
      const wg = ctx.createLinearGradient(0, yWater, 0, H);
      wg.addColorStop(0, b.water); wg.addColorStop(1, b.waterDeep);
      ctx.fillStyle = wg; ctx.fillRect(0, yWater, LOGICAL_W, H - yWater);
    } else {
      const vg = ctx.createLinearGradient(0, yWater, 0, H);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(30,20,50,.5)');
      ctx.fillStyle = vg; ctx.fillRect(0, yWater, LOGICAL_W, H - yWater);
    }
    ctx.globalAlpha = 1;
  }
  function clouds(cam, color, alpha) {
    ctx.fillStyle = color; ctx.globalAlpha = alpha * 0.92;
    const span = 760;
    for (let k = 0; k < 4; k++) {
      const base = hash01(k * 17 + 5) * span;
      const cx = (((base - cam * (0.10 + 0.04 * k)) % span) + span) % span - 120;
      const cy = 90 + hash01(k * 23 + 1) * 200;
      const sc = 0.8 + hash01(k * 31 + 2) * 0.6;
      circle(ctx, cx, cy, 18 * sc); circle(ctx, cx + 20 * sc, cy - 10 * sc, 24 * sc); circle(ctx, cx + 46 * sc, cy - 2 * sc, 18 * sc); circle(ctx, cx + 24 * sc, cy + 6 * sc, 16 * sc);
      rr(ctx, cx - 14 * sc, cy - 2 * sc, 74 * sc, 20 * sc, 10 * sc); ctx.fill();
    }
    ctx.globalAlpha = alpha;
  }
  function hills(cam, par, base, color, amp, freq) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, H);
    for (let sx = 0; sx <= LOGICAL_W + 6; sx += 6) {
      const wx = sx + cam * par;
      const y = base - amp * (0.55 + 0.45 * Math.sin(wx * freq) * Math.cos(wx * freq * 0.37 + 1.3));
      ctx.lineTo(sx, y);
    }
    ctx.lineTo(LOGICAL_W, H); ctx.closePath(); ctx.fill();
  }
  function skyline(cam, par, base, color, minH, maxH, alpha) {
    const seg = 34; const off = cam * par; const k0 = Math.floor(off / seg);
    for (let k = k0 - 1; k < k0 + LOGICAL_W / seg + 2; k++) {
      const h = minH + hash01(k * 31 + 7) * (maxH - minH); const w = seg - 4 - hash01(k * 17) * 10;
      const x = k * seg - off;
      ctx.fillStyle = color; rr(ctx, x, base - h, w, h + 12, 5); ctx.fill();
      ctx.fillStyle = 'rgba(255,233,176,' + 0.6 * alpha + ')';
      for (let wy = base - h + 8; wy < base - 8; wy += 12) for (let wx = x + 4; wx < x + w - 4; wx += 8) if (hash01(k * 101 + wy * 3 + wx) > 0.55) rr(ctx, wx, wy, 3.5, 5, 1.2), ctx.fill();
    }
  }
  function drawWaterFront(cam) {
    const b = BIOMES[run.biome]; if (!b.water) return;
    const wave = (sx) => yWater + 6 + 3 * Math.sin((sx + cam * 0.6) * 0.05 + run.t * 2.2) + 2 * Math.sin((sx - cam * 0.3) * 0.11 - run.t * 1.6);
    ctx.fillStyle = hexA(b.water, 0.55);
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let sx = 0; sx <= LOGICAL_W + 8; sx += 8) ctx.lineTo(sx, wave(sx));
    ctx.lineTo(LOGICAL_W, H); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.beginPath();
    for (let sx = 0; sx <= LOGICAL_W + 8; sx += 8) { const y = wave(sx); if (sx === 0) ctx.moveTo(sx, y); else ctx.lineTo(sx, y); }
    ctx.stroke();
  }
  function drawPad(p, cam) {
    const x = padX(p) - cam, top = padTop(p);
    if (x + p.w / 2 < -20) return;
    const b = BIOMES[p.biome];
    const bottom = b.water ? yWater + 10 : top + 36;
    ctx.save();
    ctx.translate(x, bottom); ctx.scale(1, p.sq); ctx.translate(-x, -bottom);
    ctx.fillStyle = b.padSide; rr(ctx, x - p.w / 2 + 5, top + 10, p.w - 10, bottom - top - 10, 8); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.18)'; rr(ctx, x - p.w / 2 + 9, top + 16, 5, bottom - top - 22, 2.5); ctx.fill();
    ctx.fillStyle = 'rgba(74,63,92,.10)'; rr(ctx, x + p.w / 2 - 14, top + 16, 6, bottom - top - 22, 3); ctx.fill();
    rr(ctx, x - p.w / 2, top, p.w, 20, 10); ctx.fillStyle = b.padTop; ctx.fill();
    ctx.strokeStyle = 'rgba(74,63,92,.18)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = b.padRim; rr(ctx, x - p.w / 2 + 4, top + 3, p.w - 8, 6, 3); ctx.fill();
    ctx.fillStyle = b.marker; circle(ctx, x, top + 11, 3.6);
    ctx.fillStyle = 'rgba(255,255,255,.7)'; circle(ctx, x - 1.2, top + 9.8, 1.3);
    if (p.move) { ctx.fillStyle = 'rgba(74,63,92,.28)'; tri(ctx, x - p.w / 2 + 6, top + 11, x - p.w / 2 + 12, top + 7, x - p.w / 2 + 12, top + 15); tri(ctx, x + p.w / 2 - 6, top + 11, x + p.w / 2 - 12, top + 7, x + p.w / 2 - 12, top + 15); }
    ctx.restore();
  }
  function star5(g, x, y, r) {
    g.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const rr2 = i % 2 === 0 ? r : r * 0.45; g.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); }
    g.closePath(); g.fill();
  }
  function star4(g, x, y, r) {
    g.beginPath(); g.moveTo(x, y - r);
    g.quadraticCurveTo(x, y, x + r, y); g.quadraticCurveTo(x, y, x, y + r); g.quadraticCurveTo(x, y, x - r, y); g.quadraticCurveTo(x, y, x, y - r);
    g.closePath(); g.fill();
  }
  // The character: a jelly cube with a face, scaled about its feet so squash and stretch keep it grounded.
  function drawChar(g, ch, x, y, sx, sy, look) {
    g.save(); g.translate(x, y); g.scale(sx, sy);
    const S = 36;
    rr(g, -S / 2, -S, S, S, 9); g.fillStyle = ch.body; g.fill();
    g.strokeStyle = 'rgba(74,63,92,.28)'; g.lineWidth = 2; g.stroke();
    g.fillStyle = 'rgba(255,255,255,.42)'; rr(g, -S / 2 + 4, -S + 4, S - 8, 9, 5); g.fill();
    g.fillStyle = 'rgba(74,63,92,.08)'; rr(g, -S / 2 + 4, -8, S - 8, 5, 3); g.fill();
    const ex = 7, ey = -19, lk = look * 1.5;
    g.fillStyle = 'rgba(255,120,150,.40)'; ellipse(g, -12, -12, 3.6, 2.2); ellipse(g, 12, -12, 3.6, 2.2);
    if (ch.face === 'sleepy') {
      g.strokeStyle = INK; g.lineWidth = 2; g.lineCap = 'round';
      g.beginPath(); g.arc(-ex + lk, ey + 1, 3.2, Math.PI, 0); g.stroke();
      g.beginPath(); g.arc(ex + lk, ey + 1, 3.2, Math.PI, 0); g.stroke();
    } else if (ch.face === 'star') {
      g.fillStyle = INK; star5(g, -ex + lk, ey, 4.2); star5(g, ex + lk, ey, 4.2);
    } else {
      g.fillStyle = INK; circle(g, -ex + lk, ey, 3.1); circle(g, ex + lk, ey, 3.1);
      g.fillStyle = '#fff'; circle(g, -ex + lk - 1, ey - 1.1, 1.1); circle(g, ex + lk - 1, ey - 1.1, 1.1);
    }
    g.strokeStyle = INK; g.lineWidth = 1.6; g.lineCap = 'round';
    g.beginPath(); g.arc(0, -14.5, 2.8, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
    if (ch.acc === 'sprout') {
      g.strokeStyle = '#6cbf8f'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -S); g.quadraticCurveTo(1, -S - 5, 0, -S - 8); g.stroke();
      g.fillStyle = '#8fd9a8'; ellipse(g, -4, -S - 7, 4.5, 2.6); ellipse(g, 4.5, -S - 9, 4.5, 2.6);
    }
    if (ch.acc === 'bow') { g.fillStyle = '#ff8fb1'; tri(g, 12, -S - 2, 4, -S - 8, 4, -S + 4); tri(g, 12, -S - 2, 20, -S - 8, 20, -S + 4); g.fillStyle = '#ffb5c2'; circle(g, 12, -S - 2, 2.6); }
    if (ch.acc === 'glasses') {
      g.strokeStyle = INK; g.lineWidth = 1.6;
      g.beginPath(); g.arc(-ex + lk, ey, 5.6, 0, TAU); g.stroke(); g.beginPath(); g.arc(ex + lk, ey, 5.6, 0, TAU); g.stroke();
      g.beginPath(); g.moveTo(-ex + lk + 5.6, ey); g.lineTo(ex + lk - 5.6, ey); g.stroke();
    }
    if (ch.acc === 'crown') {
      g.fillStyle = '#ffd985'; g.beginPath(); g.moveTo(-10, -S + 1); g.lineTo(-10, -S - 9); g.lineTo(-5, -S - 3); g.lineTo(0, -S - 12); g.lineTo(5, -S - 3); g.lineTo(10, -S - 9); g.lineTo(10, -S + 1); g.closePath(); g.fill();
      g.fillStyle = '#ff8fb1'; circle(g, 0, -S - 3, 1.8);
    }
    g.restore();
  }
  function drawChargeBar(x, y, p) {
    const w = 62, h = 10;
    rr(ctx, x - w / 2, y, w, h, 5); ctx.fillStyle = 'rgba(255,247,238,.85)'; ctx.fill();
    ctx.strokeStyle = 'rgba(74,63,92,.35)'; ctx.lineWidth = 1.5; ctx.stroke();
    if (p > 0.02) {
      const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
      g.addColorStop(0, '#bfeedd'); g.addColorStop(0.5, '#fff0a6'); g.addColorStop(1, '#ffb5c2');
      rr(ctx, x - w / 2 + 2, y + 2, (w - 4) * p, h - 4, 3); ctx.fillStyle = g; ctx.fill();
    }
  }
  function drawParticles(cam) {
    for (const p of run.parts) {
      const k = p.t / p.life, a = 1 - k;
      ctx.globalAlpha = a;
      if (p.kind === 'dot') { ctx.fillStyle = p.color; circle(ctx, p.x - cam, p.y, p.r * (0.6 + 0.4 * a)); }
      else if (p.kind === 'square') { ctx.save(); ctx.translate(p.x - cam, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.color; ctx.fillRect(-p.r, -p.r, p.r * 2, p.r * 2); ctx.restore(); }
      else if (p.kind === 'star') { ctx.fillStyle = p.color; star4(ctx, p.x - cam, p.y, p.r * (k < 0.3 ? k / 0.3 : 1)); }
      else if (p.kind === 'ring') { ctx.strokeStyle = p.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x - cam, p.y, 6 + k * 44, 0, TAU); ctx.stroke(); }
    }
    ctx.globalAlpha = 1;
  }
  function drawPopups(cam) {
    for (const p of run.popups) {
      const a = 1 - p.t / p.life;
      const s = p.t < 0.12 ? 0.5 + (p.t / 0.12) * 0.6 : 1.1 - Math.min(0.1, (p.t - 0.12) * 0.4);
      ctx.save(); ctx.globalAlpha = a;
      ctx.translate(p.x - cam, p.y - p.t * 40); ctx.scale(s, s);
      ctx.font = '900 ' + p.size + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.strokeStyle = p.stroke; ctx.strokeText(p.text, 0, 0);
      ctx.fillStyle = p.color; ctx.fillText(p.text, 0, 0);
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
    el.combo.textContent = run.combo >= 2 ? 'STREAK ×' + run.combo : run.combo === 1 ? 'PERFECT' : '';
    const bestTxt = fmt(Math.max(Save.d.best, run.score));
    el.best.textContent = (len > 5 || bestTxt.length > 5 ? '★ ' : 'BEST ') + bestTxt;
    el.mode.textContent = (run.mode === 'daily' ? 'DAILY · ' : '') + BIOMES[run.biome].name.toUpperCase();
  }
  function renderMenu() {
    const ch = CHARS[charIndex];
    const unlocked = ch.unlock <= Save.d.best;
    el.mName.textContent = ch.name;
    el.mKind.textContent = unlocked ? 'CUBE' : 'LOCKED · BEST ' + ch.unlock;
    const g = el.preview.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 112, 112);
    g.setTransform(2, 0, 0, 2, 0, 0);
    if (!unlocked) g.globalAlpha = 0.35;
    drawChar(g, ch, 28, 50, 1, 1, 0);
    if (!unlocked) { g.globalAlpha = 1; g.font = '900 22px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = INK; g.fillText('🔒', 28, 32); }
    el.mStats.textContent = 'Best ' + fmt(Save.d.best) + ' · best streak ×' + Save.d.bestCombo + ' · ' + fmt(Save.d.totalHops) + ' hops in total';
    el.play.disabled = !unlocked;
    el.play.textContent = unlocked ? 'PLAY' : 'LOCKED';
    el.mDots.textContent = '';
    CHARS.forEach((c, i) => { const s = document.createElement('span'); if (i === charIndex) s.className = 'on'; else if (c.unlock > Save.d.best) s.className = 'locked'; el.mDots.appendChild(s); });
    const done = Save.d.daily[todayKey()];
    el.daily.innerHTML = done ? 'DAILY DONE<small>' + fmt(done.score) + ' PTS · ' + done.hops + ' HOPS · SHARE</small>' : 'DAILY #' + dayNumber() + '<small>ONE TRY · SAME FOR EVERYONE</small>';
    el.soundBtn.textContent = 'Sound: ' + (Save.d.sound ? 'on' : 'off');
  }
  function showMenu() {
    state = 'menu';
    run = newRun('play', true);
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
    el.oBest.textContent = o.best; el.oStrip.textContent = stripText(o.strip || []); el.oUnlock.textContent = o.unlock || '';
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
