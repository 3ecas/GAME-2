/* Hop — pull back, release, land on the next platform.
   A square, some platforms, a slingshot. Gravity, spin, bounce and slide. Nothing else.
   Side-view 2D, one thumb, portrait, playable on mute, works offline. No dependencies, no build step. */
(() => {
  'use strict';

  // ---------- data & constants ----------
  const DATA = window.HOP_DATA;
  const T = DATA.tuning;
  const THEMES = DATA.themes;
  const SQUARE = DATA.square;
  const KEY = 'hop.v3';
  const LAUNCH_UTC = Date.UTC(2026, 8, 29);
  const LOGICAL_W = 390;
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

  // ---------- persistence ----------
  const Save = {
    d: { best: 0, totalPlatforms: 0, daily: {}, sound: true, runs: 0 },
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
    score(n) { this.tone(520, 0.08, 'sine', 0.16); this.tone(n > 1 ? 1040 : 780, 0.18, 'sine', 0.16, 0.08); },
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

  // ---------- course ----------
  const themeFor = (i) => Math.floor(i / T.THEME_LEN) % THEMES.length;
  const theme = () => THEMES[run.theme];

  function newRun(mode, demo) {
    const seed = mode === 'daily' ? hashStr('hop3:' + todayKey()) : (Math.random() * 4294967296) >>> 0;
    const r = {
      mode, demo: !!demo, seed, rng: mulberry32(seed), t: 0,
      score: 0, results: [], plats: [], cur: 0, startBest: Save.d.best,
      ball: { x: 0, y: 0, vx: 0, vy: 0, ang: 0, av: 0, state: 'rest', plat: 0, hit: false, sx: 1, sy: 1, restT: 0 },
      aim: null, acc: 0, cam: { x: -T.BALL_SCREEN_X, y: -600 * T.BALL_SCREEN_Y }, popups: [], parts: [], shake: 0,
      dead: false, deadReason: '', deadT: 0, theme: 0, themeFrom: 0, themeMix: 1, hinted: false, demoT: 0, demoV: null, dailyResult: null,
    };
    while (r.plats.length < 7) spawnPlat(r);
    r.cam.y = -H * T.BALL_SCREEN_Y;
    return r;
  }

  // Platforms are placed so the next one is always reachable from anywhere on the previous one at full pull.
  function spawnPlat(r) {
    const i = r.plats.length, prev = r.plats[i - 1];
    if (!prev) { r.plats.push({ i, x: -60, w: 120, top: 0, theme: 0 }); return; }
    const diff = clamp(i / T.RAMP, 0, 1), rng = r.rng;
    const w = lerp(lerp(T.W_START[0], T.W_END[0], diff), lerp(T.W_START[1], T.W_END[1], diff), rng());
    let dy = lerp(lerp(T.DY_START[0], T.DY_END[0], diff), lerp(T.DY_START[1], T.DY_END[1], diff), rng());
    if (prev.top + dy < -T.TOP_RANGE || prev.top + dy > T.TOP_RANGE) dy = -dy;
    const reach = (h) => { const v = T.V_MAX, g = T.G; return (v / g) * Math.sqrt(Math.max(0, v * v - 2 * g * h)); };
    let gapMax = 0.72 * reach(-dy) - prev.w - w / 2;
    if (gapMax < 50) { dy = 60; gapMax = 0.72 * reach(-dy) - prev.w - w / 2; }
    const gapWant = lerp(lerp(T.GAP_START[0], T.GAP_END[0], diff), lerp(T.GAP_START[1], T.GAP_END[1], diff), rng());
    const gap = clamp(gapWant, 40, Math.max(40, gapMax));
    r.plats.push({ i, x: prev.x + prev.w + gap, w, top: prev.top + dy, theme: themeFor(i) });
  }
  function ensurePlats() { while (run.plats.length < run.cur + 7) spawnPlat(run); }
  function nearPlats() { return run.plats.slice(Math.max(0, run.cur - 1), run.cur + 5); }
  function fallLine() { let m = -Infinity; for (const p of nearPlats()) m = Math.max(m, p.top); return m + T.FALL_MARGIN; }

  // ---------- physics (fixed step; y grows downward) ----------
  function stepBall(b, dt) {
    const S = T.SIZE, half = S / 2;
    if (b.state === 'air') {
      const px = b.x, py = b.y;
      b.vy += T.G * dt;
      b.x += b.vx * dt; b.y += b.vy * dt; b.ang += b.av * dt;
      const plats = nearPlats();
      if (b.vy > 0) {
        for (const p of plats) {
          if (py <= p.top && b.y >= p.top) {
            const k = (p.top - py) / (b.y - py || 1);
            const lx = px + (b.x - px) * k;
            if (lx >= p.x && lx <= p.x + p.w) {
              b.x = lx; b.y = p.top; b.plat = p.i;
              if (b.vy > T.BOUNCE_MIN_VY) { b.vy = -b.vy * T.BOUNCE; b.vx *= T.BOUNCE_FRICTION; b.av = b.vx / half; return 'bounce'; }
              b.vy = 0; b.state = 'slide'; b.av = b.vx / half; return 'land';
            }
          }
        }
      }
      for (const p of plats) {
        const overlapY = b.y > p.top + 2 && b.y - S < p.top + T.PLAT_TH;
        if (!overlapY) continue;
        if (px + half <= p.x && b.x + half > p.x) { b.x = p.x - half; b.vx = -Math.abs(b.vx) * 0.25; b.hit = true; return 'side'; }
        if (px - half >= p.x + p.w && b.x - half < p.x + p.w) { b.x = p.x + p.w + half; b.vx = Math.abs(b.vx) * 0.25; b.hit = true; return 'side'; }
      }
      if (b.y > fallLine()) { b.state = 'fall'; return 'fall'; }
    } else if (b.state === 'slide') {
      const dec = T.SLIDE_DECEL * dt;
      if (Math.abs(b.vx) <= dec) b.vx = 0; else b.vx -= Math.sign(b.vx) * dec;
      b.x += b.vx * dt; b.ang += (b.vx / half) * dt;
      const p = run.plats[b.plat];
      if (b.x < p.x || b.x > p.x + p.w) { b.state = 'air'; b.vy = 0; return 'edge'; }
      if (b.vx === 0) { b.state = 'rest'; return 'rest'; }
    }
    return null;
  }
  function launchWith(vx, vy) {
    const b = run.ball;
    b.vx = vx; b.vy = vy; b.state = 'air'; b.hit = false;
    const sp = Math.hypot(vx, vy);
    b.av = (sp / (T.SIZE / 2)) * 0.7 * (vx >= 0 ? 1 : -1);
    run.acc = 0;
    b.sx = 0.85; b.sy = 1.15;
    const p = run.plats[b.plat];
    squares(b.x, p ? p.top : b.y, 5, hexA(theme().ink, 0.35), 90, 14);
    Sfx.aim(-1); Sfx.launch(sp / T.V_MAX); haptic('tap');
  }
  // Pure: plays a launch from the current resting position and reports where it ends up.
  function simulateLaunch(vx, vy) {
    const src = run.ball;
    const b = { x: src.x, y: src.y, vx, vy, ang: 0, av: 0, state: 'air', plat: src.plat, hit: false };
    let t = 0, ev = null, side = false;
    while (t < 8) {
      ev = stepBall(b, T.STEP); t += T.STEP;
      if (ev === 'side') side = true;
      if (ev === 'rest' || ev === 'fall') break;
    }
    return { state: b.state, x: b.x, plat: b.plat, side, t };
  }
  // A launch that comes to rest on platform j, as near its middle as the scan finds. Null if none.
  function solveLaunch(j) {
    const p = run.plats[j]; if (!p) return null;
    const cx = p.x + p.w / 2;
    let best = null;
    for (const deg of [45, 55, 65, 75]) {
      const a = deg * RAD;
      for (let i = 4; i <= 100; i += 1) {
        const v = (i / 100) * T.V_MAX, vx = v * Math.cos(a), vy = -v * Math.sin(a);
        const res = simulateLaunch(vx, vy);
        if (res.state !== 'rest' || res.plat !== j) continue;
        const err = Math.abs(res.x - cx);
        if (!best || err < best.err) best = { vx, vy, err };
        if (err < 3) return best;
      }
    }
    return best;
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

  function onEvent(ev) {
    const b = run.ball;
    if (ev === 'bounce') { b.sy = 0.7; b.sx = 1.25; squares(b.x, b.y, 4, hexA(theme().ink, 0.3), 70, 10); Sfx.bounce(Math.abs(b.vy) / T.BOUNCE); }
    else if (ev === 'land') { b.sy = 0.82; b.sx = 1.12; Sfx.bounce(140); }
    else if (ev === 'side') { Sfx.bounce(300); }
    else if (ev === 'fall') die(b.hit ? 'Hit the side of a platform' : b.x < run.plats[run.cur + 1].x ? 'Fell short' : 'Overshot');
    else if (ev === 'rest') resolveRest();
  }
  function resolveRest() {
    const b = run.ball;
    const j = b.plat;
    b.restT = 0;
    if (j > run.cur) {
      const gained = j - run.cur;
      run.score += gained;
      for (let k = 0; k < gained; k++) run.results.push('N');
      popup(gained > 1 ? '+' + gained + '  long jump' : '+1', b.x, b.y - 54, { size: gained > 1 ? 18 : 24, spaced: gained > 1 });
      if (!run.demo) { Save.d.totalPlatforms += gained; if (run.score > Save.d.best) Save.d.best = run.score; }
      run.cur = j; ensurePlats();
      const th = run.plats[run.cur].theme;
      if (th !== run.theme) { run.themeFrom = run.theme; run.theme = th; run.themeMix = 0; }
      Sfx.score(gained); haptic('score');
    }
    syncHud();
  }

  function update(dt) {
    const b = run.ball;
    run.t += dt;
    if (!run.dead) {
      if (b.state === 'rest') {
        b.restT += dt;
        const pull = run.aim ? aimVector({ x: run.aim.x - run.aim.sx, y: run.aim.y - run.aim.sy }) : null;
        const pow = pull ? pull.pow : 0;
        b.sx += (1 + 0.12 * pow - b.sx) * (1 - Math.exp(-dt * 14)); b.sy += (1 - 0.18 * pow - b.sy) * (1 - Math.exp(-dt * 14));
        const flat = Math.round(b.ang / (Math.PI / 2)) * (Math.PI / 2);
        b.ang += (flat - b.ang) * (1 - Math.exp(-dt * 14));
        if (run.demo) {
          if (!run.demoV && b.restT > 0.6) { const v = solveLaunch(run.cur + 1); if (v) { run.demoV = { vx: v.vx * (1 + (Math.random() - 0.5) * 0.05), vy: v.vy * (1 + (Math.random() - 0.5) * 0.05) }; run.demoT = 0; } }
          if (run.demoV) {
            run.demoT += dt;
            const k = clamp(run.demoT / 0.45, 0, 1), sp = Math.hypot(run.demoV.vx, run.demoV.vy), L = (sp / T.V_MAX) * T.DRAG_MAX * k;
            run.aim = { sx: 200, sy: 500, x: 200 - run.demoV.vx / sp * L, y: 500 - run.demoV.vy / sp * L };
            if (run.demoT > 0.75) { run.aim = null; launchWith(run.demoV.vx, run.demoV.vy); run.demoV = null; }
          }
        }
      } else if (b.state === 'air' || b.state === 'slide') {
        run.acc += dt;
        while (run.acc >= T.STEP) {
          run.acc -= T.STEP;
          const ev = stepBall(b, T.STEP);
          if (ev) { onEvent(ev); if (ev === 'rest' || ev === 'fall') break; }
        }
        b.sx += (1 - b.sx) * (1 - Math.exp(-dt * 10)); b.sy += (1 - b.sy) * (1 - Math.exp(-dt * 10));
      }
    } else {
      run.deadT += dt;
      if (b.state === 'fall') { b.vy += T.G * dt; b.y += b.vy * dt; b.x += b.vx * dt * 0.3; b.ang += b.av * dt; }
      if (run.demo && run.deadT > 1.4) { run = newRun('play', true); return; }
      if (!run.demo && run.deadT > 0.8 && state === 'playing') finishRun();
    }

    const camX = b.x - T.BALL_SCREEN_X;
    const anchorY = b.state === 'rest' || b.state === 'slide' ? b.y : Math.min(b.y, run.plats[run.cur].top);
    const camY = anchorY - H * T.BALL_SCREEN_Y;
    run.cam.x += (camX - run.cam.x) * (1 - Math.exp(-dt * 6));
    run.cam.y += (camY - run.cam.y) * (1 - Math.exp(-dt * 4));
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
    const before = run.startBest, after = Save.d.best;
    let bestLine = run.score >= after && run.score > before ? 'NEW BEST' : 'BEST ' + fmt(after);
    if (run.mode === 'daily') {
      run.dailyResult = { day: dayNumber(), score: run.score, results: run.results.slice(0, 60) };
      Save.d.daily[todayKey()] = run.dailyResult;
      bestLine = 'DAILY #' + run.dailyResult.day + (run.score > before ? ' · NEW BEST' : '');
    }
    Save.d.runs = (Save.d.runs || 0) + 1;
    Save.save();
    showOver({
      eyebrow: run.deadReason === 'Overshot' || run.deadReason === 'Fell short' ? 'Missed' : 'Bump', title: run.deadReason,
      stats: run.score + (run.score === 1 ? ' platform' : ' platforms'),
      best: bestLine, strip: run.results, unlock: '', daily: run.dailyResult,
    });
  }

  // ---------- drawing: flat rectangles only ----------
  function col(key) { return run.themeMix >= 1 ? THEMES[run.theme][key] : mixHex(THEMES[run.themeFrom][key], THEMES[run.theme][key], run.themeMix); }

  function draw() {
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    const cx = run.cam.x, cy = run.cam.y;
    ctx.save();
    if (run.shake > 0.3) ctx.translate((Math.random() - 0.5) * run.shake, (Math.random() - 0.5) * run.shake);
    ctx.fillStyle = col('bg'); ctx.fillRect(0, 0, LOGICAL_W, H);
    ctx.fillStyle = col('plat');
    for (let j = Math.max(0, run.cur - 3); j < run.plats.length; j++) {
      const p = run.plats[j];
      if (p.x - cx > LOGICAL_W + 40) break;
      if (p.x + p.w - cx < -40) continue;
      ctx.fillRect(p.x - cx, p.top - cy, p.w, T.PLAT_TH);
    }
    const b = run.ball, ink = col('ink');
    if (run.aim) drawAim(b, cx, cy, ink);
    drawSquare(b.x - cx, b.y - cy - T.SIZE / 2, b.sx, b.sy, b.ang);
    drawParticles(cx, cy);
    drawPopups(cx, cy, ink);
    ctx.restore();
  }
  // The pull: a thin band in the direction of the finger, and a dashed line the way the square will go.
  function drawAim(b, cx, cy, ink) {
    const v = aimVector({ x: run.aim.x - run.aim.sx, y: run.aim.y - run.aim.sy });
    const ox = b.x - cx, oy = b.y - cy - T.SIZE / 2;
    ctx.lineCap = 'butt';
    if (!v) return;
    const dx = v.vx / T.V_MAX, dy = v.vy / T.V_MAX; // direction × power
    ctx.strokeStyle = hexA(SQUARE, 0.7); ctx.lineWidth = 3; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox - dx * T.DRAG_MAX, oy - dy * T.DRAG_MAX); ctx.stroke();
    ctx.strokeStyle = hexA(THEMES[run.theme].ink, 0.45); ctx.lineWidth = 3; ctx.setLineDash([7, 6]);
    ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + dx * 110, oy + dy * 110); ctx.stroke();
    ctx.setLineDash([]);
  }
  // The square: one flat fill, rotating with its spin. Squash is applied in world axes before the rotation.
  function drawSquare(x, y, sx, sy, ang) {
    const S = T.SIZE, half = S / 2;
    ctx.save(); ctx.translate(x, y); ctx.scale(sx, sy); ctx.rotate(ang);
    ctx.fillStyle = SQUARE; ctx.fillRect(-half, -half, S, S);
    ctx.fillStyle = 'rgba(59,58,74,.25)'; ctx.fillRect(half * 0.3, -2, 4, 4);
    ctx.restore();
  }
  function drawParticles(cx, cy) {
    for (const p of run.parts) {
      const a = 1 - p.t / p.life;
      ctx.save(); ctx.globalAlpha = a; ctx.translate(p.x - cx, p.y - cy); ctx.rotate(p.rot);
      ctx.fillStyle = p.color; ctx.fillRect(-p.r, -p.r, p.r * 2, p.r * 2);
      ctx.restore();
    }
  }
  function drawPopups(cx, cy, ink) {
    for (const p of run.popups) {
      const a = 1 - p.t / p.life;
      const s = p.t < 0.12 ? 0.7 + (p.t / 0.12) * 0.3 : 1;
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
    el.score.textContent = fmt(run.score);
    const len = el.score.textContent.length;
    el.score.classList.toggle('mid', len === 5);
    el.score.classList.toggle('long', len > 5);
    el.combo.textContent = '';
    el.best.textContent = 'Best ' + fmt(Math.max(Save.d.best, run.score));
    el.mode.textContent = (run.mode === 'daily' ? 'Daily · ' : '') + THEMES[run.theme].name;
    applyTheme(THEMES[run.theme]);
  }
  function renderMenu() {
    el.mStats.textContent = 'Best ' + fmt(Save.d.best) + '  ·  ' + fmt(Save.d.totalPlatforms) + ' platforms in total';
    const done = Save.d.daily[todayKey()];
    el.daily.innerHTML = done ? 'Daily done<small>' + fmt(done.score) + ' platforms · share</small>' : 'Daily #' + dayNumber() + '<small>one try · same for everyone</small>';
    el.soundBtn.textContent = 'Sound: ' + (Save.d.sound ? 'on' : 'off');
  }
  function showMenu() {
    state = 'menu';
    run = newRun('play', true);
    applyTheme(THEMES[0]);
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
    const s = results.map((r) => (r === 'X' ? '🟥' : '🟩')).join('');
    return results.length > 40 ? Array.from(s).slice(0, 40).join('') + '…' : s;
  }
  function shareText(res) {
    const url = location.href.split(/[?#]/)[0];
    return 'Hop ◼ Daily #' + res.day + '\n' + res.score + ' platforms\n' + stripText(res.results) + '\n' + url;
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
    (o.strip || []).slice(0, 60).forEach((r) => { const d = document.createElement('span'); d.className = r === 'X' ? 'x' : 'n'; el.oStrip.appendChild(d); });
    show(el.oAgain, !o.daily); show(el.oShare, !!o.daily);
    el.oShare.textContent = 'Share';
    el.oShare.onclick = o.daily ? async () => { el.oShare.textContent = await share(shareText(o.daily)); } : null;
    show(el.hint, false); show(el.menu, false); show(el.pause, false); show(el.hud, true); show(el.over, true);
  }
  function showDailyDone(done) {
    run = newRun('play', true);
    showOver({ eyebrow: 'Daily #' + done.day + ' · done', title: done.score + ' platforms', stats: '', best: 'COME BACK TOMORROW', strip: done.results, unlock: '', daily: done });
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
    simulateLaunch, solveLaunch, aimVector,
    launch(vx, vy) { if (!run || run.dead || run.ball.state !== 'rest') return false; launchWith(vx, vy); return true; },
  };
})();
