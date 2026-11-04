// 半亩·丰收 — boot, main loop, level flow, event → juice mapping.
import { CFG } from './config.js';
import { World } from './world.js';
import { Renderer } from './render3d.js';
import { FX } from './fx.js';
import { Input } from './input.js';
import { Sound, Haptics } from './audio.js';
import * as Save from './save.js';
import { drawHome } from './home.js';
import { UI } from './ui.js';

const cv = document.getElementById('cv'), gl = document.getElementById('gl');
const R = new Renderer(cv, gl), fx = new FX(), input = new Input(cv), snd = new Sound(), hap = new Haptics();
let data = Save.load();
snd.on = data.settings.sound; hap.on = data.settings.vib;

let mode = 'home', world = null, guide = null, guideT = 0, saveT = 0, hudT = 0, time = 0, last = performance.now();
let modalOpen = false, cashFxT = 0, winDone = false, harvestFxT = 0, saleHapT = 0;
const restoredAt = {};            // session-only animation stamps for the home screen

const ITEM_BITS = { wheat: ['#F6CB4A', '#FFE07A', '#C9962A'], potato: ['#5DBB3A', '#9C6331', '#C98A4B'], egg: ['#FFF3D6', '#FFFFFF'], tomato: ['#EE4630', '#5DBB3A'],
                    tulip: ['#F2486E', '#FF8FB0', '#FFB3C8', '#5DBB3A'], rose: ['#E0283C', '#FF5A78', '#8E0E1E', '#3E8F25'], gold: ['#FFC21A', '#FFE16B', '#F29C0E', '#5DBB3A'] };

const ui = new UI({
  home: () => goHome(),
  play: () => { snd.unlock(); snd.play('tap'); const li = +ui.el.play.dataset.li || 0; start(li); },
  next: () => goHome(true),
  start: (li) => { snd.unlock(); start(li); },
  restore: (id) => restore(id),
  modal: (on) => { modalOpen = on; input.enabled = !on; if (on) snapshot(); },
  world: () => world,
  setting: (k, v) => { data.settings[k] = v; if (k === 'sound') { snd.on = v; if (v) snd.unlock(); } if (k === 'vib') { hap.on = v; if (v) hap.buzz(60, 255); } Save.save(data); },
  reset: () => { Save.wipe(); data = Save.load(); world = null; for (const k in restoredAt) delete restoredAt[k]; goHome(); },
  data: () => data,
  starSfx: (i) => { snd.blip(880 + i * 220, 0.18, 'triangle', 0.16); hap.tick(18, 0); },
});

input.onFirst = () => snd.unlock();

function resize() {
  R.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
  if (world) R.follow(0, true);
}
window.addEventListener('resize', resize);
resize();

function start(li) {
  const resume = data.cur && data.cur.li === li;
  world = new World(li);
  if (resume) { try { world.restore(data.cur); } catch (_) { world = new World(li); } }
  else data.cur = world.snapshot();
  data.played = true; Save.save(data);
  R.setWorld(world); R.setMode('play'); R.follow(0, true); fx.clear();
  mode = 'play'; winDone = false; guide = null; guideT = 0;
  ui.hideAll(); ui.showHUD(world); ui.banner(world);
  modalOpen = false; input.enabled = true; input.everMoved = resume || li > 0 ? input.everMoved : false;
}

function snapshot() { if (world && !world.won) { data.cur = world.snapshot(); Save.save(data); } }

function goHome(fromWin) {
  if (world && !world.won) snapshot();
  mode = 'home'; R.setMode('home'); ui.hideAll(); ui.el.banner.classList.add('hidden'); ui.showHome(data); fx.clear();
  input.enabled = true; modalOpen = false;
  if (fromWin) { /* stars freshly earned: nudge the cheapest affordable item */ }
}

function restore(id) {
  const m = CFG.meta.find((x) => x.id === id);
  if (!m || data.restored.includes(id)) return;
  snd.unlock();
  if (Save.starsLeft(data) < m.cost) { snd.play('full'); hap.tick(30, 0); return; }
  data.spent += m.cost; data.restored.push(id); restoredAt[id] = time;
  Save.save(data);
  snd.play('restore'); hap.pattern([30, 40, 30], [200, 255]);
  fx.confetti(R.W, R.H, 70);
  ui.renderHome(data);
}

function win() {
  const li = world.li, stars = world.stars();
  const prev = data.stars[li] || 0;
  data.stars[li] = Math.max(prev, stars);
  data.unlocked = Math.max(data.unlocked, li + 1);
  data.cur = null; Save.save(data);
  snd.play('win'); hap.pattern([70, 70, 70, 70, 260], [255, 255, 255]);
  fx.confetti(R.W, R.H, 200);
  setTimeout(() => ui.showWin(li, stars, world.winT, Math.max(0, stars - prev)), 650);
}

// ---------------------------------------------------------------- tutorial tips
function tutorialTip() {
  if (!world || world.li !== 0 || world.won) return '';
  const p = world.player, s = world.stats;
  if (!input.everMoved) return '按住屏幕拖动，摇杆控制走路';
  if (s.unlocks > 0) return '';
  const cash = world.counters.reduce((a, c) => a + c.cash, 0);
  const onCounter = world.counters.some((c) => c.stock.length > 0);
  if (s.earned === 0 && p.stack.length === 0 && !onCounter) return '走进金色麦田，周围的麦子会自动割下';
  if (s.earned === 0 && !onCounter) return '背着麦子，走到「出售」台旁的虚线框';
  if (cash > 0.5 && world.money < 1) return '顾客付钱啦！走到深色格子上收钞票';
  if (world.money >= 1) return '站到青色虚线格子上，花钱解锁';
  return '';
}

// ---------------------------------------------------------------- events → juice
function handleEvents() {
  const ev = world.events; const coin = ui.coinCenter();
  for (const e of ev) {
    switch (e.type) {
      case 'pick': snd.play('pick'); break;
      case 'harvest':   // blooms burst up in a spray of petals and leaves
        if (e.who === 'player' || time - harvestFxT > 0.05) { harvestFxT = time; fx.burst(e.x, e.y, 10, Math.min(14, 3 + e.n * 2), ITEM_BITS[e.item] || ['#fff'], 70, 120, 2.2, 'petal', 0.7); }
        if (e.who === 'player') { snd.play('harvest'); hap.tick(16, 70, 235); }   // continuous strong rumble while cutting
        break;
      case 'drop': snd.play('drop'); break;
      case 'sale': fx.text(e.x, e.y, 50, `+${Math.round(e.amount)}`, '#B9FF7A'); snd.play('sale'); if (time - saleHapT > 0.18) { saleHapT = time; hap.buzz(34, 255); } break;
      case 'pay': for (let i = 0; i < Math.min(4, 1 + Math.floor(e.amount / 6)); i++) fx.wbill(e.x, e.y, e.tx + (Math.random() - 0.5) * 20, e.ty + (Math.random() - 0.5) * 8, i * 0.06); break;
      case 'cashierPay': for (let i = 0; i < 3; i++) fx.bill(R.X(e.x, e.y), R.Y(e.x, e.y, 30), coin.x, coin.y, i * 0.07); setTimeout(() => ui.bumpCoin(), 450); snd.play('coin'); break;
      case 'cash':
        if (time - cashFxT > 0.035) { cashFxT = time; fx.bill(R.X(e.x, e.y), R.Y(e.x, e.y, 4), coin.x, coin.y); setTimeout(() => ui.bumpCoin(), 470); }
        snd.play('coin'); hap.tick(10, 100, 170); break;
      case 'payTick': fx.wbill(world.player.x, world.player.y, e.x, e.y); snd.play('pay'); hap.tick(8, 110, 150); break;
      case 'unlock':
        fx.burst(e.x, e.y, 10, 46, ['#FF4D4D', '#FFD23F', '#3BA7FF', '#4CD08A', '#FF6FA8', '#FFFFFF'], 130, 170, 3.2, 'conf', 1.2);
        fx.burst(e.x, e.y, 20, 10, ['#FFF27A'], 60, 120, 4, 'star', 0.9);
        fx.ring(e.x, e.y, '#FFFFFF', 60); fx.shake(9, 0.32); fx.flash = 0.7;
        fx.text(e.x, e.y, 50, '解锁！', '#FFF27A', true);
        snd.play('unlock'); hap.pattern([50, 45, 90], [255, 255]); break;
      case 'tileAppear': snd.play('appear'); fx.ring(e.x, e.y, '#FFF27A', 36); break;
      case 'full': fx.text(world.player.x, world.player.y, 70, '满了！', '#FF6A4D'); snd.play('full'); hap.tick(30, 0, 200); break;
      case 'produce': fx.burst(e.x, e.y, 40, 4, ['#FFFFFF', '#FFE16B', '#FF8FB0'], 30, 60, 2.6, 'star', 0.7); break;
      case 'lay': break;
      case 'ground': R.groundDirty = true; break;
      case 'win': if (!winDone) { winDone = true; win(); } break;
    }
  }
  ev.length = 0;
}

// ---------------------------------------------------------------- loop
function frame(now) {
  const rawDt = (now - last) / 1000;
  let dt = Math.min(0.05, rawDt); last = now; time += dt;
  // adaptive detail: on a slow device, draw fewer plants per frame (fields switch to LOD)
  if (mode === 'play') R.adapt(rawDt);   // dynamic quality: drop pixel ratio / shadows on slow devices
  if (mode === 'play' && world) {
    const [jx, jy] = modalOpen ? [0, 0] : input.vector();
    const [ix, iy] = R.screenToWorld(jx, jy);
    let left = dt;
    if (!modalOpen) while (left > 1e-4) { const s = Math.min(left, 1 / 60); world.update(s, world.won ? 0 : ix, world.won ? 0 : iy); left -= s; }
    handleEvents();
    fx.update(dt);
    R.follow(dt);
    guideT -= dt; if (guideT <= 0) { guide = world.guide(); guideT = 0.15; }
    const showHand = world.li === 0 && !input.everMoved && !world.won;
    R.draw(world, fx, world.won ? null : guide, time, { hand: showHand });
    input.draw(R.g, R.W, R.H, !modalOpen && !world.won);
    hudT -= dt; if (hudT <= 0) { ui.updateHUD(world); ui.tip(tutorialTip()); hudT = 0.1; }
    saveT += dt; if (saveT > 5) { saveT = 0; snapshot(); }
  } else {
    fx.update(dt);
    drawHome(R.g, R.W, R.H, { ...data, restoredAt }, time, R.dpr, R.W > R.H * 1.15);
    R.g.setTransform(R.dpr, 0, 0, R.dpr, 0, 0); R.fxScreen(fx);
  }
  requestAnimationFrame(frame);
}

document.addEventListener('visibilitychange', () => { if (document.hidden) snapshot(); else last = performance.now(); });
window.addEventListener('pagehide', snapshot);

// first visit drops straight into level 1 like the ad; returning players land on the farm
if (!data.played) start(0); else goHome();
requestAnimationFrame((t) => { last = t; frame(t); });

// ---- ?debug: hooks for automated screenshots / testing (not used in normal play) ----
if (typeof location !== 'undefined' && /[?&]debug/.test(location.search)) {
  window.__dbg = {
    get world() { return world; }, get data() { return data; }, R, fx, ui, hap,
    quality: (q) => { if (q !== undefined) { R.q = q; R.drops = 9; R.applyQuality(); } return ['low', 'mid', 'high'][R.q]; },
    start: (li) => { data.cur = null; start(li); },
    home: () => goHome(), restore: (id) => restore(id),
    // walk the bot into a field until the stack is tall (for screenshots of a cutting run)
    tallStack(n, extraCap = 0) {
      if (extraCap) { world.upg.cap += extraCap; world.refreshStats(); }
      const p = world.player; let g = null;
      for (let i = 0; i < 30 * 120 && p.stack.length + p.incoming < n; i++) {
        g = world.guide(); if (g && g.kind !== 'field' && g.kind !== 'pile') { const f = world.fields.find((q) => !q.hidden && q.ripe > 0); if (f) { const j = f.nearestRipe(p.x, p.y); g = { x: f.px(j), y: f.py(j) }; } }
        let ix = 0, iy = 0; if (g) { const ex = g.x - p.x, ey = g.y - p.y, e = Math.hypot(ex, ey) || 1; ix = ex / e; iy = ey / e; }
        world.update(1 / 30, ix, iy); world.events.length = 0;
      }
      R.follow(0, true); ui.updateHUD(world); ui.tip(''); ui.el.banner.classList.add('hidden');
      return p.stack.length + p.incoming;
    },
    // run the guide-following bot for `secs` of game time; stopAt: stop moving after that many seconds
    bot(secs, stopAt = 1e9, reveal) {
      if (reveal) for (const t of world.tiles) if (!t.done && (reveal === 'all' || reveal.includes(t.id))) world.completeTile(t, true);
      const p = world.player; let g = null, th = 0;
      for (let i = 0; i < secs * 30; i++) {
        th -= 1 / 30; if (th <= 0) { g = world.guide(); th = 0.1; }
        if (g && (g.kind === 'pile' || g.kind === 'field')) g = world.guide() || g;
        let ix = 0, iy = 0;
        if (i < stopAt * 30 && g && Math.hypot(g.x - p.x, g.y - p.y) > 3) { const wp = world.steer(p, g.x, g.y); const ex = wp.x - p.x, ey = wp.y - p.y, e = Math.hypot(ex, ey) || 1; ix = ex / e; iy = ey / e; }
        world.update(1 / 30, ix, iy); world.events.length = 0;
      }
      input.everMoved = true; R.follow(0, true); ui.updateHUD(world); ui.tip(''); ui.el.banner.classList.add('hidden');
      return { stack: p.stack.length, money: Math.round(world.money), t: Math.round(world.t), customers: world.customers.length };
    },
  };
}
