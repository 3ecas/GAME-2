/* Next Stop — hold to brake, stop on the line.
   One thumb, portrait, playable on mute, works offline. No dependencies, no build step. */
(() => {
  'use strict';

  // ---------- constants ----------
  const LINES = window.NEXT_STOP_LINES;
  const KEY = 'nextstop.v1';
  const LAUNCH_UTC = Date.UTC(2026, 8, 28);

  const LOGICAL_W = 390;          // logical canvas width; height follows the device aspect
  const CX = LOGICAL_W / 2;
  const TRACK_W = 76;
  const TRAIN_LEN = 150;
  const TRAIN_W = 44;
  const PLATFORM_LEN = 260;
  const STOP_FROM_END = 44;       // stop line sits this far before the platform end
  const TRAIN_Y_FRAC = 0.7;       // where the train front sits on screen (fraction of height)
  const ACCEL = 320;              // auto acceleration when leaving a station (px/s²)
  const ROLL = 30;                // rolling resistance while coasting (px/s²)
  const DWELL = 1.15;             // seconds stopped at a station
  const WET_FACTOR = 0.7;         // brake strength on wet rails
  const RAIN_LEAD = 1000;         // rain (and weak brakes) start this far before a wet station
  const TIE_SPACING = 36;
  const LAMP_SPACING = 240;
  const FIRST_GAP = 1250;
  const GAP_MIN = 1050;
  const GAP_MAX = 1700;
  const PTS_PERFECT = 3;
  const PTS_GOOD = 1;
  const PTS_SKIP = 2;
  const STREAK_CAP = 7;
  const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Rounded", "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  const PASSENGER_COLORS = ['#f4a261', '#e76f51', '#2a9d8f', '#e9c46a', '#8ecae6', '#ffb4a2', '#cdb4db', '#b5e48c'];

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
  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function rr(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }

  // ---------- persistence ----------
  const Save = {
    d: { totalStops: 0, best: {}, daily: {}, sound: true, line: LINES[0].id, runs: 0 },
    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) { const o = JSON.parse(raw); if (o && typeof o === 'object') Object.assign(this.d, o); }
      } catch (e) { /* private mode or blocked storage: play without saving */ }
    },
    save() { try { localStorage.setItem(KEY, JSON.stringify(this.d)); } catch (e) { /* ignore */ } },
  };
  Save.load();

  // ---------- sound (optional; the game is fully playable on mute) ----------
  const Sfx = {
    ctx: null, brakeGain: null,
    init() {
      if (this.ctx) return;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        const sr = this.ctx.sampleRate;
        const buf = this.ctx.createBuffer(1, sr * 2, sr);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const src = this.ctx.createBufferSource(); src.buffer = buf; src.loop = true;
        const filt = this.ctx.createBiquadFilter(); filt.type = 'bandpass'; filt.frequency.value = 1800; filt.Q.value = 0.7;
        const g = this.ctx.createGain(); g.gain.value = 0;
        src.connect(filt); filt.connect(g); g.connect(this.ctx.destination);
        src.start();
        this.brakeGain = g;
      } catch (e) { this.ctx = null; }
    },
    resume() { try { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); } catch (e) { /* ignore */ } },
    get on() { return Save.d.sound && !!this.ctx; },
    brake(active, v) {
      if (!this.ctx || !this.brakeGain) return;
      const target = this.on && active && v > 40 ? clamp(v / 600, 0.06, 0.3) : 0;
      this.brakeGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
    },
    tone(f, dur, type, vol, when, slide) {
      if (!this.on) return;
      try {
        const t = this.ctx.currentTime + (when || 0);
        const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
        o.type = type || 'sine';
        o.frequency.setValueAtTime(f, t);
        if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(this.ctx.destination);
        o.start(t); o.stop(t + dur + 0.05);
      } catch (e) { /* ignore */ }
    },
    perfect() { this.tone(880, 0.12, 'sine', 0.22); this.tone(1320, 0.28, 'sine', 0.22, 0.1); },
    good() { this.tone(660, 0.16, 'sine', 0.18); },
    skip() { this.tone(520, 0.08, 'square', 0.06); this.tone(780, 0.08, 'square', 0.06, 0.09); },
    doors() { this.tone(740, 0.1, 'triangle', 0.1); this.tone(740, 0.1, 'triangle', 0.1, 0.16); },
    fail() { this.tone(170, 0.5, 'sawtooth', 0.22, 0, 55); },
  };

  function haptic(kind) {
    try {
      const cap = window.Capacitor;
      const H = cap && cap.Plugins && cap.Plugins.Haptics;
      if (H) {
        if (kind === 'perfect') H.notification({ type: 'SUCCESS' });
        else if (kind === 'fail') H.notification({ type: 'ERROR' });
        else H.impact({ style: 'LIGHT' });
      } else if (navigator.vibrate) {
        navigator.vibrate(kind === 'fail' ? [60, 40, 60] : kind === 'perfect' ? [20, 30, 20] : 15);
      }
    } catch (e) { /* ignore */ }
  }

  // ---------- DOM ----------
  const canvas = $('c');
  const ctx = canvas.getContext('2d');
  const el = {
    game: $('game'), hud: $('hud'), hudDot: $('hud-dot'), hudLine: $('hud-line'), score: $('hud-score'), stops: $('hud-stops'),
    next: $('hud-next'), nextLabel: $('hud-next-label'), flags: $('hud-flags'), streak: $('hud-streak'), hint: $('hud-hint'),
    menu: $('menu'), over: $('over'), pause: $('pause'), help: $('help'),
    mDot: $('m-dot'), mCity: $('m-city'), mName: $('m-name'), mDots: $('m-dots'), mStats: $('m-stats'),
    play: $('play'), daily: $('daily'), prev: $('prev'), nextBtn: $('next'), helpBtn: $('help-btn'), soundBtn: $('sound-btn'), helpClose: $('help-close'),
    oEyebrow: $('o-eyebrow'), oTitle: $('o-title'), oStats: $('o-stats'), oBest: $('o-best'), oStrip: $('o-strip'), oUnlock: $('o-unlock'),
    oAgain: $('o-again'), oShare: $('o-share'), oMenu: $('o-menu'),
  };

  // ---------- state ----------
  let state = 'menu'; // menu | playing | paused | over
  let run = null;
  let lineIndex = Math.max(0, LINES.findIndex((l) => l.id === Save.d.line));
  const demo = { front: 0 };
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

  // ---------- run ----------
  function cruiseFor(line, k) { return Math.min(line.vmax, line.v0 + k * line.dv); }

  function newRun(line, mode) {
    const seed = mode === 'daily' ? hashStr('nextstop:' + todayKey()) : (Math.random() * 4294967296) >>> 0;
    const r = {
      line, mode, seed, rng: mulberry32(seed), t: 0,
      points: 0, stops: 0, perfects: 0, streak: 0, bestStreak: 0, results: [],
      stations: [], cur: 0, startTotal: Save.d.totalStops,
      train: { front: 0, v: 0, phase: 'accel', phaseT: 0, braking: false, cruise: cruiseFor(line, 0), chimed: false, powered: true },
      dead: false, deadReason: '', deadT: 0, popups: [], sparks: [], rain: [], rainA: 0, shake: 0, dailyResult: null,
    };
    for (let i = 0; i < 40; i++) r.rain.push({ x: Math.random() * LOGICAL_W, y: Math.random() * 900, len: 14 + Math.random() * 16, spd: 700 + Math.random() * 400 });
    while (r.stations.length < 3) spawnStation(r);
    return r;
  }

  function spawnStation(r) {
    const k = r.stations.length;
    const line = r.line;
    const prevStop = k === 0 ? 0 : r.stations[k - 1].stop;
    const gap = k === 0 ? FIRST_GAP : lerp(GAP_MIN, GAP_MAX, r.rng());
    const start = prevStop + gap;
    const stop = start + PLATFORM_LEN - STOP_FROM_END;
    const ramp = clamp(k / line.ramp, 0, 1);
    const prevKind = k > 0 ? r.stations[k - 1].kind : 'normal';
    const roll = r.rng();
    let kind = 'normal';
    if (k >= 6 && prevKind !== 'express' && roll < line.express) kind = 'express';
    else if (k >= 3 && roll >= line.express && roll < line.express + line.wet) kind = 'wet';
    const st = {
      k, name: line.stations[k % line.stations.length], start, stop, kind,
      goodTol: lerp(line.good[0], line.good[1], ramp), perfTol: lerp(line.perf[0], line.perf[1], ramp),
      resolved: false, result: null, off: 0, passengers: [],
    };
    const n = 4 + Math.floor(r.rng() * 5);
    for (let i = 0; i < n; i++) {
      const p = { side: r.rng() < 0.5 ? -1 : 1, u: 0.12 + r.rng() * 0.74, d: 24 + r.rng() * 44, c: PASSENGER_COLORS[Math.floor(r.rng() * PASSENGER_COLORS.length)], boarded: 0 };
      if (kind !== 'express') st.passengers.push(p);
    }
    r.stations.push(st);
  }
  function ensureStations() { while (run.stations.length < run.cur + 3) spawnStation(run); }

  function isWet(st, front) { return st.kind === 'wet' && front > st.start - RAIN_LEAD && front < st.start + PLATFORM_LEN; }

  function popup(text, o) {
    o = o || {};
    run.popups.push({ text, t: 0, life: o.life || 1.1, color: o.color || '#fff', size: o.size || 30, dy: o.dy || 0 });
  }

  function update(dt) {
    const tr = run.train;
    const line = run.line;
    run.t += dt;
    if (!run.dead) {
      const st = run.stations[run.cur];
      if (tr.phase === 'accel') {
        tr.v = Math.min(tr.cruise, tr.v + ACCEL * dt);
        if (tr.v >= tr.cruise) tr.phase = 'cruise';
      } else if (tr.phase === 'cruise') {
        // power stays on until the first brake touch of the segment; after that the train coasts
        if (tr.braking) { tr.powered = false; tr.v = Math.max(0, tr.v - line.decel * (isWet(st, tr.front) ? WET_FACTOR : 1) * dt); }
        else if (!tr.powered) tr.v = Math.max(0, tr.v - ROLL * dt);
      } else if (tr.phase === 'stopped') {
        tr.phaseT += dt;
        for (const p of st.passengers) p.boarded = clamp((tr.phaseT - 0.2) / 0.55, 0, 1);
        if (!tr.chimed && tr.phaseT >= DWELL - 0.35) { tr.chimed = true; Sfx.doors(); }
        if (tr.phaseT >= DWELL) depart();
      }
      if (tr.phase === 'accel' || tr.phase === 'cruise') {
        tr.front += tr.v * dt;
        if (st.kind === 'express') {
          if (tr.front > st.start + PLATFORM_LEN + 40) resolveSkip(st);
          else if (tr.v === 0 && tr.phase === 'cruise') die(tr.front > st.start - 40 ? st.name + ' was a skip station' : 'Stopped in the tunnel');
        } else if (tr.front > st.stop + st.goodTol) {
          die('Overshot ' + st.name);
        } else if (tr.v === 0 && tr.phase === 'cruise') {
          if (tr.front >= st.stop - st.goodTol) resolveStop(st);
          else if (tr.front > st.start - 40) die('Stopped short at ' + st.name);
          else die('Stopped in the tunnel');
        }
      }
    } else {
      run.deadT += dt;
      tr.v = Math.max(0, tr.v - 900 * dt);
      tr.front += tr.v * dt;
      if (run.deadT > 0.8 && state === 'playing') finishRun();
    }

    // sparks while braking at speed
    if (!run.dead && tr.braking && tr.phase === 'cruise' && tr.v > 80) {
      const yF = H * TRAIN_Y_FRAC;
      for (let i = 0; i < 2; i++) {
        const side = Math.random() < 0.5 ? -1 : 1;
        run.sparks.push({ x: CX + side * 17, y: yF + 20 + Math.random() * (TRAIN_LEN - 40), vx: side * (20 + Math.random() * 60), vy: 120 + Math.random() * 260, t: 0, life: 0.25 + Math.random() * 0.2 });
      }
    }
    for (const s of run.sparks) { s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; }
    run.sparks = run.sparks.filter((s) => s.t < s.life);

    // rain
    const st0 = run.stations[run.cur];
    const wet = !run.dead && st0 && isWet(st0, tr.front);
    run.rainA = lerp(run.rainA, wet ? 1 : 0, 1 - Math.exp(-dt * 3));
    if (run.rainA > 0.01) {
      for (const d of run.rain) {
        d.y += (d.spd + tr.v * 0.6) * dt;
        if (d.y > H + 20) { d.y = -30; d.x = Math.random() * LOGICAL_W; }
      }
    }

    for (const p of run.popups) p.t += dt;
    run.popups = run.popups.filter((p) => p.t < p.life);
    run.shake *= Math.exp(-dt * 7);
    Sfx.brake(tr.braking && !run.dead && tr.phase === 'cruise', tr.v);
  }

  function resolveStop(st) {
    const tr = run.train;
    const off = tr.front - st.stop;
    const perfect = Math.abs(off) <= st.perfTol;
    st.resolved = true; st.off = off; st.result = perfect ? 'P' : 'G';
    run.stops++; Save.d.totalStops++;
    let pts;
    if (perfect) {
      run.streak++; run.perfects++; run.bestStreak = Math.max(run.bestStreak, run.streak);
      pts = PTS_PERFECT + Math.min(run.streak - 1, STREAK_CAP);
      popup('PERFECT', { color: '#7cff9b', size: 36 });
      if (run.streak >= 2) popup('STREAK ×' + run.streak, { color: '#ffd166', size: 20, dy: 40, life: 1.3 });
      Sfx.perfect(); haptic('perfect');
    } else {
      run.streak = 0;
      pts = PTS_GOOD;
      popup('GOOD', { color: '#ffffff', size: 30 });
      popup((off > 0 ? '+' : '−') + (Math.abs(off) / 10).toFixed(1) + ' m', { color: '#c9d1e6', size: 16, dy: 36 });
      Sfx.good(); haptic('good');
    }
    run.points += pts;
    run.results.push(st.result);
    tr.phase = 'stopped'; tr.phaseT = 0; tr.chimed = false;
    syncHud();
  }

  function resolveSkip(st) {
    st.resolved = true; st.result = 'S';
    run.stops++; Save.d.totalStops++;
    run.points += PTS_SKIP;
    run.results.push('S');
    popup('SKIPPED', { color: '#ff8fa3', size: 30 });
    Sfx.skip(); haptic('good');
    run.cur++; ensureStations();
    run.train.cruise = cruiseFor(run.line, run.cur);
    run.train.phase = 'accel'; run.train.powered = true;
    syncHud();
  }

  function depart() {
    const tr = run.train;
    run.cur++; ensureStations();
    tr.cruise = cruiseFor(run.line, run.cur);
    tr.phase = 'accel'; tr.phaseT = 0; tr.powered = true;
    Save.save();
    syncHud();
  }

  function die(reason) {
    if (run.dead) return;
    run.dead = true; run.deadReason = reason; run.deadT = 0;
    run.results.push('X');
    run.shake = 16;
    run.train.braking = false;
    el.hint.classList.add('hidden');
    Sfx.fail(); haptic('fail');
  }

  function finishRun() {
    state = 'over';
    const line = run.line;
    const before = run.startTotal;
    const after = Save.d.totalStops;
    let bestLine = '';
    if (run.mode === 'play') {
      const best = Save.d.best[line.id] || 0;
      if (run.points > best) { Save.d.best[line.id] = run.points; bestLine = 'NEW BEST'; }
      else bestLine = 'BEST ' + fmt(best);
    } else {
      run.dailyResult = { day: dayNumber(), line: line.id, stops: run.stops, perfects: run.perfects, points: run.points, results: run.results.slice(0, 60) };
      Save.d.daily[todayKey()] = run.dailyResult;
      bestLine = 'DAILY #' + run.dailyResult.day + ' · ' + line.city.toUpperCase() + ' ' + line.name.toUpperCase();
    }
    Save.d.runs = (Save.d.runs || 0) + 1;
    Save.save();
    const newly = LINES.filter((l) => l.unlock > before && l.unlock <= after);
    let unlockLine;
    if (newly.length) unlockLine = 'New line unlocked: ' + newly.map((l) => l.city + ' · ' + l.name).join(', ');
    else {
      const nextL = LINES.find((l) => l.unlock > after);
      unlockLine = nextL ? 'Next line at ' + nextL.unlock + ' stops · you have ' + after : 'All lines unlocked';
    }
    showOver({
      eyebrow: 'END OF SERVICE', title: run.deadReason,
      stats: run.stops + ' stations · ' + run.perfects + ' perfect · ' + fmt(run.points) + ' pts',
      best: bestLine, strip: run.results, unlock: unlockLine, daily: run.dailyResult,
    });
  }

  // ---------- drawing ----------
  function draw() {
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    const cam = run ? run.train.front : demo.front;
    const toS = (y) => H * TRAIN_Y_FRAC - (y - cam);
    const line = run ? run.line : LINES[lineIndex];

    ctx.save();
    if (run && run.shake > 0.3) ctx.translate((Math.random() - 0.5) * run.shake, (Math.random() - 0.5) * run.shake);

    drawTunnel(cam, toS);
    if (run) {
      if (run.rainA > 0.01) { ctx.fillStyle = 'rgba(90,140,220,' + (0.14 * run.rainA) + ')'; ctx.fillRect(CX - TRACK_W / 2, 0, TRACK_W, H); }
      for (let i = Math.max(0, run.cur - 1); i <= Math.min(run.stations.length - 1, run.cur + 2); i++) drawStation(run.stations[i], toS, line);
    }
    drawTrain(toS, line);
    if (run) { drawSparks(); drawRain(); drawRadar(); drawPopups(); }

    // tunnel fog at the top so stations fade in instead of popping
    const fog = ctx.createLinearGradient(0, 0, 0, 130);
    fog.addColorStop(0, 'rgba(10,13,24,.95)'); fog.addColorStop(1, 'rgba(10,13,24,0)');
    ctx.fillStyle = fog; ctx.fillRect(0, 0, LOGICAL_W, 130);
    ctx.restore();
  }

  function drawTunnel(cam, toS) {
    ctx.fillStyle = '#0a0d18'; ctx.fillRect(0, 0, LOGICAL_W, H);
    ctx.fillStyle = '#151b2c'; ctx.fillRect(CX - TRACK_W / 2, 0, TRACK_W, H);
    ctx.fillStyle = '#1f2740'; ctx.fillRect(CX - TRACK_W / 2 - 3, 0, 3, H); ctx.fillRect(CX + TRACK_W / 2, 0, 3, H);
    const yMin = cam - H * (1 - TRAIN_Y_FRAC) - 60, yMax = cam + H * TRAIN_Y_FRAC + 60;
    ctx.fillStyle = '#232b45';
    for (let y = Math.floor(yMin / TIE_SPACING) * TIE_SPACING; y < yMax; y += TIE_SPACING) {
      const s = toS(y); ctx.fillRect(CX - TRACK_W / 2 + 6, s - 3, TRACK_W - 12, 6);
    }
    ctx.fillStyle = '#7c86a6'; ctx.fillRect(CX - 15, 0, 3, H); ctx.fillRect(CX + 12, 0, 3, H);
    for (let y = Math.floor(yMin / LAMP_SPACING) * LAMP_SPACING; y < yMax; y += LAMP_SPACING) {
      const s = toS(y);
      for (const side of [-1, 1]) {
        const x = CX + side * (TRACK_W / 2 + 16);
        const g = ctx.createRadialGradient(x, s, 0, x, s, 28);
        g.addColorStop(0, 'rgba(255,214,140,.32)'); g.addColorStop(1, 'rgba(255,214,140,0)');
        ctx.fillStyle = g; ctx.fillRect(x - 28, s - 28, 56, 56);
        ctx.fillStyle = '#ffd88c'; circle(x, s, 2.5);
      }
    }
  }

  function fitFont(text, maxW, size, weight) {
    for (let s = size; s >= 9; s -= 1) {
      ctx.font = weight + ' ' + s + 'px ' + FONT;
      if (ctx.measureText(text).width <= maxW) return s;
    }
    return 9;
  }

  function drawStation(st, toS, line) {
    const sTop = toS(st.start + PLATFORM_LEN), sBot = toS(st.start);
    if (sBot < -40 || sTop > H + 40) return;
    const h = sBot - sTop;
    const pl = CX - TRACK_W / 2, pr = CX + TRACK_W / 2;
    const express = st.kind === 'express';

    ctx.fillStyle = '#d9d3c4'; ctx.fillRect(0, sTop, pl, h); ctx.fillRect(pr, sTop, LOGICAL_W - pr, h);
    ctx.fillStyle = 'rgba(0,0,0,.07)';
    for (let y = sTop + 26; y < sBot; y += 26) { ctx.fillRect(0, y, pl, 1); ctx.fillRect(pr, y, LOGICAL_W - pr, 1); }
    if (express) {
      ctx.save(); ctx.beginPath(); ctx.rect(pl - 10, sTop, 10, h); ctx.rect(pr, sTop, 10, h); ctx.clip();
      ctx.fillStyle = '#fff'; ctx.fillRect(pl - 10, sTop, 10, h); ctx.fillRect(pr, sTop, 10, h);
      ctx.fillStyle = '#e63946';
      for (let y = sTop - 20; y < sBot + 20; y += 16) { ctx.beginPath(); ctx.moveTo(pl - 10, y); ctx.lineTo(pl, y - 8); ctx.lineTo(pl, y); ctx.lineTo(pl - 10, y + 8); ctx.fill(); ctx.beginPath(); ctx.moveTo(pr, y); ctx.lineTo(pr + 10, y - 8); ctx.lineTo(pr + 10, y); ctx.lineTo(pr, y + 8); ctx.fill(); }
      ctx.restore();
    } else {
      ctx.fillStyle = '#f2c744'; ctx.fillRect(pl - 10, sTop, 10, h); ctx.fillRect(pr, sTop, 10, h);
    }
    ctx.fillStyle = '#2a3149';
    ctx.fillRect(0, sTop - 4, pl, 4); ctx.fillRect(pr, sTop - 4, LOGICAL_W - pr, 4);
    ctx.fillRect(0, sBot, pl, 4); ctx.fillRect(pr, sBot, LOGICAL_W - pr, 4);

    if (!express) {
      const ys = toS(st.stop);
      ctx.fillStyle = hexA(line.color, 0.26); ctx.fillRect(pl, toS(st.stop + st.goodTol), TRACK_W, st.goodTol * 2);
      ctx.fillStyle = 'rgba(255,255,255,.42)'; ctx.fillRect(pl, toS(st.stop + st.perfTol), TRACK_W, st.perfTol * 2);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(pl, ys - 1.5, TRACK_W, 3);
      ctx.fillStyle = '#1b2033'; ctx.font = '800 11px ' + FONT; ctx.textBaseline = 'middle';
      ctx.textAlign = 'right'; ctx.fillText('STOP', pl - 16, ys);
      ctx.textAlign = 'left'; ctx.fillText('STOP', pr + 16, ys);
    } else {
      ctx.strokeStyle = 'rgba(230,57,70,.95)'; ctx.lineWidth = 4; ctx.lineJoin = 'round';
      for (let y = sBot - 22; y > sTop + 14; y -= 34) { ctx.beginPath(); ctx.moveTo(CX - 18, y + 8); ctx.lineTo(CX, y - 6); ctx.lineTo(CX + 18, y + 8); ctx.stroke(); }
    }

    // name sign on the left platform, tags on the right platform
    const maxW = pl - 30;
    const fs = fitFont(st.name, maxW, 14, '800');
    ctx.font = '800 ' + fs + 'px ' + FONT;
    const tw = ctx.measureText(st.name).width;
    const bw = tw + 22, bx = 10, by = sTop + h / 2 - 14;
    rr(bx, by, bw, 28, 8); ctx.fillStyle = express ? '#e63946' : '#1b2033'; ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(st.name, bx + 11, by + 14);
    if (express || st.kind === 'wet') {
      const tag = express ? 'NO STOP' : 'WET RAILS';
      ctx.font = '900 11px ' + FONT;
      const w2 = ctx.measureText(tag).width + 18;
      rr(LOGICAL_W - 10 - w2, by + 2, w2, 24, 7); ctx.fillStyle = express ? '#e63946' : '#2f7fd6'; ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillText(tag, LOGICAL_W - 10 - w2 + 9, by + 14);
    }

    // passengers, walking to the doors while the train dwells
    const tr = run.train;
    for (const p of st.passengers) {
      if (p.boarded >= 1) continue;
      const x0 = CX + p.side * (TRACK_W / 2 + p.d);
      const y0 = st.start + p.u * PLATFORM_LEN;
      let x = x0, y = y0, a = 1;
      if (p.boarded > 0) {
        const d1 = tr.front - TRAIN_LEN * 0.25, d2 = tr.front - TRAIN_LEN * 0.75;
        const dy = Math.abs(y0 - d1) < Math.abs(y0 - d2) ? d1 : d2;
        const t = p.boarded;
        x = lerp(x0, CX + p.side * (TRAIN_W / 2 + 3), t); y = lerp(y0, dy, t);
        a = 1 - Math.max(0, (t - 0.7) / 0.3);
      }
      const sy = toS(y);
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(0,0,0,.18)'; circle(x + 1, sy + 2, 5.5);
      ctx.fillStyle = p.c; circle(x, sy, 5.5);
      ctx.fillStyle = 'rgba(255,255,255,.35)'; circle(x - 1.5, sy - 1.5, 2);
      ctx.globalAlpha = 1;
    }
  }

  function drawTrain(toS, line) {
    const tr = run ? run.train : { front: demo.front, v: 160, braking: false, phase: 'cruise', phaseT: 0 };
    const yF = toS(tr.front), yB = toS(tr.front - TRAIN_LEN);
    const x = CX - TRAIN_W / 2;
    const braking = tr.braking && tr.phase === 'cruise' && !(run && run.dead);
    const doorsOpen = tr.phase === 'stopped' && tr.phaseT > 0.15 && tr.phaseT < DWELL - 0.25;

    const beam = ctx.createLinearGradient(0, yF, 0, yF - 190);
    beam.addColorStop(0, 'rgba(255,244,200,.20)'); beam.addColorStop(1, 'rgba(255,244,200,0)');
    ctx.fillStyle = beam;
    ctx.beginPath(); ctx.moveTo(x + 4, yF); ctx.lineTo(x + TRAIN_W - 4, yF); ctx.lineTo(x + TRAIN_W + 34, yF - 190); ctx.lineTo(x - 34, yF - 190); ctx.closePath(); ctx.fill();

    if (braking) {
      const g = ctx.createRadialGradient(CX, yB, 0, CX, yB, 60);
      g.addColorStop(0, 'rgba(255,60,60,.45)'); g.addColorStop(1, 'rgba(255,60,60,0)');
      ctx.fillStyle = g; ctx.fillRect(CX - 60, yB - 60, 120, 120);
    }

    ctx.fillStyle = 'rgba(0,0,0,.4)'; rr(x + 3, yF + 5, TRAIN_W, TRAIN_LEN, 11); ctx.fill();
    rr(x, yF, TRAIN_W, TRAIN_LEN, 11); ctx.fillStyle = line.color; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fillRect(CX - 5, yF + 18, 10, TRAIN_LEN - 36);
    ctx.fillStyle = 'rgba(0,0,0,.28)'; rr(x + 4, yF + 4, TRAIN_W - 8, 13, 5); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    for (let yy = yF + 26; yy < yB - 16; yy += 16) { ctx.fillRect(x + 3, yy, 5, 9); ctx.fillRect(x + TRAIN_W - 8, yy, 5, 9); }
    for (const f of [0.25, 0.75]) {
      const yy = yF + TRAIN_LEN * f - 10;
      ctx.fillStyle = doorsOpen ? 'rgba(255,248,214,.95)' : 'rgba(0,0,0,.38)';
      ctx.fillRect(x - 1, yy, 6, 20); ctx.fillRect(x + TRAIN_W - 5, yy, 6, 20);
    }
    ctx.fillStyle = '#fff8d6'; circle(x + 8, yF + 7, 3); circle(x + TRAIN_W - 8, yF + 7, 3);
    ctx.fillStyle = braking ? '#ff3b3b' : '#8a1c1c'; circle(x + 8, yB - 7, 3.2); circle(x + TRAIN_W - 8, yB - 7, 3.2);

    // front marker: the part that has to sit on the stop line
    ctx.strokeStyle = '#5ff2ff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - 16, yF); ctx.lineTo(x + TRAIN_W + 16, yF); ctx.stroke();
    ctx.fillStyle = '#5ff2ff';
    ctx.beginPath(); ctx.moveTo(x - 16, yF - 5); ctx.lineTo(x - 16, yF + 5); ctx.lineTo(x - 9, yF); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + TRAIN_W + 16, yF - 5); ctx.lineTo(x + TRAIN_W + 16, yF + 5); ctx.lineTo(x + TRAIN_W + 9, yF); ctx.fill();
  }

  // A thin "radar" on the right edge: the next stop line slides down toward the train
  // marker as it approaches, so a station beyond the top of the screen is never a surprise.
  function drawRadar() {
    const st = run.stations[run.cur];
    if (!st || run.dead) return;
    const x = LOGICAL_W - 11, yTrain = H * TRAIN_Y_FRAC, yTop = 118;
    const span = 1500; // world px shown by the bar
    const k = (yTrain - yTop) / span;
    ctx.fillStyle = 'rgba(255,255,255,.10)'; rr(x - 2, yTop - 6, 4, yTrain - yTop + 12, 2); ctx.fill();
    const rem = st.stop - run.train.front;
    if (rem > 0 && rem < span) {
      const y = yTrain - rem * k;
      if (st.kind !== 'express') {
        ctx.fillStyle = hexA(run.line.color, 0.5); ctx.fillRect(x - 3, y - st.goodTol * k, 6, st.goodTol * 2 * k);
      }
      ctx.fillStyle = st.kind === 'express' ? '#e63946' : st.kind === 'wet' ? '#5aa9ff' : '#ffffff';
      ctx.fillRect(x - 6, y - 1.5, 12, 3);
    } else if (rem >= span) {
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      ctx.beginPath(); ctx.moveTo(x, yTop - 12); ctx.lineTo(x - 4, yTop - 5); ctx.lineTo(x + 4, yTop - 5); ctx.fill();
    }
    ctx.fillStyle = '#5ff2ff'; rr(x - 4, yTrain - 6, 8, 12, 3); ctx.fill();
  }

  function drawSparks() {
    for (const s of run.sparks) {
      const a = 1 - s.t / s.life;
      ctx.fillStyle = 'rgba(255,' + Math.round(150 + 100 * a) + ',60,' + a + ')';
      ctx.fillRect(s.x - 1, s.y - 1, 2.5, 2.5);
    }
  }

  function drawRain() {
    if (run.rainA <= 0.01) return;
    ctx.strokeStyle = 'rgba(170,200,255,' + (0.35 * run.rainA) + ')'; ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (const d of run.rain) { ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 3, d.y + d.len); }
    ctx.stroke();
  }

  function drawPopups() {
    for (const p of run.popups) {
      const a = 1 - p.t / p.life;
      const s = p.t < 0.12 ? 0.5 + (p.t / 0.12) * 0.6 : 1.1 - Math.min(0.1, (p.t - 0.12) * 0.4);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(CX, H * TRAIN_Y_FRAC - 140 - p.dy - p.t * 34);
      ctx.scale(s, s);
      ctx.font = '900 ' + p.size + 'px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(0,0,0,.65)'; ctx.strokeText(p.text, 0, 0);
      ctx.fillStyle = p.color; ctx.fillText(p.text, 0, 0);
      ctx.restore();
    }
  }

  // ---------- UI ----------
  function show(node, on) { node.classList.toggle('hidden', !on); }

  function flag(text, cls) { const s = document.createElement('span'); s.className = 'flag ' + cls; s.textContent = text; return s; }
  function syncHud() {
    if (!run) return;
    const st = run.stations[run.cur];
    el.hudDot.style.background = run.line.color;
    el.hudLine.textContent = run.mode === 'daily' ? 'DAILY · ' + run.line.name : run.line.city + ' · ' + run.line.name;
    el.score.textContent = fmt(run.points);
    el.stops.textContent = run.stops + (run.stops === 1 ? ' STATION' : ' STATIONS');
    el.next.textContent = st ? st.name : '—';
    el.nextLabel.textContent = run.train.phase === 'stopped' ? 'AT' : 'NEXT';
    el.flags.textContent = '';
    if (st && st.kind === 'wet') el.flags.appendChild(flag('WET RAILS', 'wet'));
    if (st && st.kind === 'express') el.flags.appendChild(flag('SKIP · NO STOP', 'skip'));
    el.streak.textContent = run.streak >= 2 ? 'STREAK ×' + run.streak : '';
  }

  function renderMenu() {
    const line = LINES[lineIndex];
    const unlocked = line.unlock <= Save.d.totalStops;
    el.mDot.style.background = line.color;
    el.mCity.textContent = line.city.toUpperCase();
    el.mName.textContent = line.name;
    el.mStats.textContent = unlocked
      ? 'Best ' + fmt(Save.d.best[line.id] || 0) + ' · ' + fmt(Save.d.totalStops) + ' stops in total'
      : 'Locked · opens at ' + line.unlock + ' stops · you have ' + fmt(Save.d.totalStops);
    el.play.disabled = !unlocked;
    el.play.textContent = unlocked ? 'PLAY' : 'LOCKED';
    el.mDots.textContent = '';
    LINES.forEach((l, i) => {
      const s = document.createElement('span');
      if (i === lineIndex) s.className = 'on';
      else if (l.unlock > Save.d.totalStops) s.className = 'locked';
      el.mDots.appendChild(s);
    });
    const done = Save.d.daily[todayKey()];
    el.daily.innerHTML = done
      ? 'DAILY DONE<small>' + done.stops + ' STATIONS · ' + fmt(done.points) + ' PTS · SHARE</small>'
      : 'DAILY #' + dayNumber() + '<small>ONE TRY · SAME FOR EVERYONE</small>';
    el.soundBtn.textContent = 'Sound: ' + (Save.d.sound ? 'on' : 'off');
  }

  function showMenu() {
    state = 'menu'; run = null;
    show(el.hud, false); show(el.over, false); show(el.pause, false); show(el.help, false); show(el.menu, true);
    renderMenu();
  }

  function startRun(mode) {
    const line = mode === 'daily' ? LINES[(dayNumber() - 1) % LINES.length] : LINES[lineIndex];
    run = newRun(line, mode);
    state = 'playing';
    show(el.menu, false); show(el.over, false); show(el.pause, false); show(el.help, false); show(el.hud, true);
    show(el.hint, true); el.hint.classList.remove('on');
    syncHud();
    lastT = performance.now();
  }

  function stripText(results) {
    const map = { P: '🟩', G: '🟨', S: '⏩', X: '🟥' };
    const s = results.map((r) => map[r] || '').join('');
    return results.length > 40 ? Array.from(s).slice(0, 40).join('') + '…' : s;
  }
  function shareText(res) {
    const line = LINES.find((l) => l.id === res.line) || LINES[0];
    const url = location.href.split(/[?#]/)[0];
    return 'Next Stop 🚇 Daily #' + res.day + '\n' + line.city + ' · ' + line.name + '\n' +
      res.stops + ' stations · ' + res.perfects + ' perfect · ' + fmt(res.points) + ' pts\n' + stripText(res.results) + '\n' + url;
  }
  async function share(text) {
    try { if (navigator.share) { await navigator.share({ text }); return 'SHARED'; } }
    catch (e) { if (e && e.name === 'AbortError') return 'SHARE'; }
    try { await navigator.clipboard.writeText(text); return 'COPIED'; } catch (e) { /* ignore */ }
    return 'SHARE';
  }

  function showOver(o) {
    state = 'over';
    el.oEyebrow.textContent = o.eyebrow;
    el.oTitle.textContent = o.title;
    el.oStats.textContent = o.stats;
    el.oBest.textContent = o.best;
    el.oStrip.textContent = stripText(o.strip || []);
    el.oUnlock.textContent = o.unlock || '';
    show(el.oAgain, !o.daily); show(el.oShare, !!o.daily);
    el.oShare.textContent = 'SHARE';
    el.oShare.onclick = o.daily ? async () => { el.oShare.textContent = await share(shareText(o.daily)); } : null;
    show(el.hint, false); show(el.menu, false); show(el.pause, false); show(el.hud, true); show(el.over, true);
  }

  function showDailyDone(done) {
    const line = LINES.find((l) => l.id === done.line) || LINES[0];
    run = null;
    showOver({
      eyebrow: 'DAILY #' + done.day + ' · DONE', title: line.city + ' · ' + line.name,
      stats: done.stops + ' stations · ' + done.perfects + ' perfect · ' + fmt(done.points) + ' pts',
      best: 'COME BACK TOMORROW', strip: done.results, unlock: '', daily: done,
    });
    show(el.hud, false);
  }

  function pause() {
    if (state !== 'playing') return;
    state = 'paused';
    run.train.braking = false; el.hint.classList.remove('on');
    Sfx.brake(false, 0);
    show(el.pause, true);
  }
  function resume() {
    if (state !== 'paused') return;
    state = 'playing';
    show(el.pause, false);
    lastT = performance.now();
  }

  // ---------- input ----------
  function brakeOn(e) {
    if (e && e.preventDefault) e.preventDefault();
    Sfx.init(); Sfx.resume();
    if (state !== 'playing' || !run || run.dead) return;
    run.train.braking = true;
    run.hinted = true;
    el.hint.classList.add('on');
  }
  function brakeOff() {
    if (run) run.train.braking = false;
    el.hint.classList.remove('on');
    if (run && run.hinted) show(el.hint, false);
  }
  canvas.addEventListener('pointerdown', brakeOn);
  window.addEventListener('pointerup', brakeOff);
  window.addEventListener('pointercancel', brakeOff);
  window.addEventListener('blur', brakeOff);
  canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'Space' || e.code === 'ArrowDown') {
      e.preventDefault();
      if (state === 'playing') brakeOn();
      else if (state === 'paused') resume();
      else if (state === 'over' && run && run.mode === 'play') startRun('play');
      else if (state === 'menu' && !el.play.disabled) startRun('play');
    }
    if (e.code === 'Escape' && state === 'playing') pause();
  });
  window.addEventListener('keyup', (e) => { if (e.code === 'Space' || e.code === 'ArrowDown') brakeOff(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

  el.prev.addEventListener('click', () => { lineIndex = (lineIndex + LINES.length - 1) % LINES.length; Save.d.line = LINES[lineIndex].id; Save.save(); renderMenu(); });
  el.nextBtn.addEventListener('click', () => { lineIndex = (lineIndex + 1) % LINES.length; Save.d.line = LINES[lineIndex].id; Save.save(); renderMenu(); });
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
    let dt = (now - lastT) / 1000;
    lastT = now;
    if (!(dt > 0)) dt = 0;
    if (dt > 0.05) dt = 0.05;
    if (state === 'playing' || (state === 'over' && run)) update(dt);
    else if (state === 'menu') demo.front += 160 * dt;
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

  // Exposed for automated tests and tuning from the console.
  window.NextStop = {
    get state() { return state; }, get run() { return run; }, get lineIndex() { return lineIndex; },
    start: startRun, menu: showMenu, save: Save, lines: LINES,
    consts: { TRAIN_LEN, PLATFORM_LEN, STOP_FROM_END, ACCEL, ROLL, DWELL, WET_FACTOR, RAIN_LEAD, TRAIN_Y_FRAC },
    get H() { return H; },
  };
})();
