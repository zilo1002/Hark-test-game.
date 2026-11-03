// 半亩·丰收 — boot, main loop, level flow, event → juice mapping.
import { CFG } from './config.js';
import { World } from './world.js';
import { Renderer } from './render.js';
import { FX } from './fx.js';
import { Input } from './input.js';
import { Sound, Haptics } from './audio.js';
import * as Save from './save.js';
import { drawHome } from './home.js';
import { UI } from './ui.js';

const cv = document.getElementById('cv');
const R = new Renderer(cv), fx = new FX(), input = new Input(cv), snd = new Sound(), hap = new Haptics();
let data = Save.load();
snd.on = data.settings.sound; hap.on = data.settings.vib;

let mode = 'home', world = null, guide = null, guideT = 0, saveT = 0, hudT = 0, time = 0, last = performance.now();
let modalOpen = false, cashFxT = 0, winDone = false;
const restoredAt = {};            // session-only animation stamps for the home screen

const ITEM_BITS = { wheat: ['#F6CB4A', '#FFE07A', '#5DBB3A'], potato: ['#5DBB3A', '#9C6331', '#C98A4B'], egg: ['#FFF3D6', '#FFFFFF'], tomato: ['#EE4630', '#5DBB3A'] };

const ui = new UI({
  home: () => goHome(),
  play: () => { snd.unlock(); snd.play('tap'); const li = +ui.el.play.dataset.li || 0; start(li); },
  next: () => goHome(true),
  start: (li) => { snd.unlock(); start(li); },
  restore: (id) => restore(id),
  modal: (on) => { modalOpen = on; input.enabled = !on; },
  setting: (k, v) => { data.settings[k] = v; if (k === 'sound') { snd.on = v; if (v) snd.unlock(); } if (k === 'vib') { hap.on = v; if (v) hap.tick(20, 0); } Save.save(data); },
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
  R.setWorld(world); R.follow(0, true); fx.clear();
  mode = 'play'; winDone = false; guide = null; guideT = 0;
  ui.hideAll(); ui.showHUD(world); ui.banner(world);
  modalOpen = false; input.enabled = true; input.everMoved = resume || li > 0 ? input.everMoved : false;
}

function snapshot() { if (world && !world.won) { data.cur = world.snapshot(); Save.save(data); } }

function goHome(fromWin) {
  if (world && !world.won) snapshot();
  mode = 'home'; ui.hideAll(); ui.showHome(data); fx.clear();
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
  snd.play('restore'); hap.pattern([20, 30, 20]);
  fx.confetti(R.W, R.H, 70);
  ui.renderHome(data);
}

function win() {
  const li = world.li, stars = world.stars();
  const prev = data.stars[li] || 0;
  data.stars[li] = Math.max(prev, stars);
  data.unlocked = Math.max(data.unlocked, li + 1);
  data.cur = null; Save.save(data);
  snd.play('win'); hap.pattern([40, 60, 40, 60, 80]);
  fx.confetti(R.W, R.H, 200);
  setTimeout(() => ui.showWin(li, stars, world.winT, Math.max(0, stars - prev)), 650);
}

// ---------------------------------------------------------------- tutorial tips
function tutorialTip() {
  if (!world || world.li !== 0 || world.won) return '';
  const p = world.player, s = world.stats;
  if (!input.everMoved) return '按住屏幕任意处拖动，就能走路';
  if (s.unlocks > 0) return '';
  const cash = world.counters.reduce((a, c) => a + c.cash, 0);
  if (s.earned === 0 && p.stack.length === 0 && !world.counters.some((c) => c.stock > 0)) return '走进金黄的麦田，自动收割';
  if (s.earned === 0 && world.counters.every((c) => c.stock === 0)) return '背着麦子，走到摊位前的白框里';
  if (cash > 0.5 && world.money < 1) return '顾客付钱啦！走过去捡起钞票';
  if (world.money >= 1) return '站到虚线格子上，花钱开新田';
  return '';
}

// ---------------------------------------------------------------- events → juice
function handleEvents() {
  const ev = world.events; const coin = ui.coinCenter();
  for (const e of ev) {
    switch (e.type) {
      case 'pick': snd.play('pick'); break;
      case 'harvest':
        fx.burst(e.x, e.y, 8, 6, ITEM_BITS[e.item] || ['#fff'], 50, 70, 2, 'leaf', 0.55);
        if (e.who === 'player') snd.play('harvest');
        break;
      case 'drop': snd.play('drop'); break;
      case 'sale': fx.text(e.x, e.y, 66, `+$${Math.round(e.amount)}`, '#B9FF7A'); snd.play('sale'); break;
      case 'pay': for (let i = 0; i < Math.min(4, 1 + Math.floor(e.amount / 6)); i++) fx.wbill(e.x, e.y, e.tx + (Math.random() - 0.5) * 20, e.ty + (Math.random() - 0.5) * 8, i * 0.06); break;
      case 'cashierPay': for (let i = 0; i < 3; i++) fx.bill(R.X(e.x), R.Y(e.y, 30), coin.x, coin.y, i * 0.07); setTimeout(() => ui.bumpCoin(), 450); snd.play('coin'); break;
      case 'cash':
        if (time - cashFxT > 0.035) { cashFxT = time; fx.bill(R.X(e.x), R.Y(e.y, 4), coin.x, coin.y); setTimeout(() => ui.bumpCoin(), 470); }
        snd.play('coin'); hap.tick(6, 110); break;
      case 'payTick': fx.wbill(world.player.x, world.player.y, e.x, e.y); snd.play('pay'); hap.tick(5, 120); break;
      case 'unlock':
        fx.burst(e.x, e.y, 10, 46, ['#FF4D4D', '#FFD23F', '#3BA7FF', '#4CD08A', '#FF6FA8', '#FFFFFF'], 130, 170, 3.2, 'conf', 1.2);
        fx.burst(e.x, e.y, 20, 10, ['#FFF27A'], 60, 120, 4, 'star', 0.9);
        fx.ring(e.x, e.y, '#FFFFFF', 60); fx.shake(9, 0.32); fx.flash = 0.7;
        fx.text(e.x, e.y, 60, '解锁！', '#FFF27A', true);
        snd.play('unlock'); hap.pattern([30, 40, 30]); break;
      case 'tileAppear': snd.play('appear'); fx.ring(e.x, e.y, '#FFF27A', 36); break;
      case 'full': fx.text(world.player.x, world.player.y, 70, '满了！', '#FF6A4D'); snd.play('full'); hap.tick(25, 0); break;
      case 'produce': fx.burst(e.x + 22, e.y, 62, 3, ['#FFFFFF', '#EEEEEE'], 10, 40, 4, 'dot', 0.8); break;
      case 'lay': break;
      case 'ground': R.groundDirty = true; break;
      case 'win': if (!winDone) { winDone = true; win(); } break;
    }
  }
  ev.length = 0;
}

// ---------------------------------------------------------------- loop
function frame(now) {
  let dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
  if (mode === 'play' && world) {
    const [ix, iy] = modalOpen ? [0, 0] : input.vector();
    let left = dt;
    while (left > 1e-4) { const s = Math.min(left, 1 / 60); world.update(s, world.won ? 0 : ix, world.won ? 0 : iy); left -= s; }
    handleEvents();
    fx.update(dt);
    R.follow(dt);
    guideT -= dt; if (guideT <= 0) { guide = world.guide(); guideT = 0.15; }
    const showHand = world.li === 0 && !input.everMoved && !world.won;
    R.draw(world, fx, world.won ? null : guide, time, { hand: showHand });
    input.draw(R.g);
    hudT -= dt; if (hudT <= 0) { ui.updateHUD(world); ui.tip(tutorialTip()); hudT = 0.1; }
    saveT += dt; if (saveT > 5) { saveT = 0; snapshot(); }
  } else {
    fx.update(dt);
    drawHome(R.g, R.W, R.H, { ...data, restoredAt }, time, R.dpr);
    R.fxScreen(fx);
  }
  requestAnimationFrame(frame);
}

document.addEventListener('visibilitychange', () => { if (document.hidden) snapshot(); else last = performance.now(); });
window.addEventListener('pagehide', snapshot);

// first visit drops straight into level 1 like the ad; returning players land on the farm
if (!data.played) start(0); else goHome();
requestAnimationFrame((t) => { last = t; frame(t); });
