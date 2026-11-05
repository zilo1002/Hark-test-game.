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
import * as Shop from './shop.js';
import { Preview } from './preview3d.js';
import * as Crew from './crew.js';
import * as Orders from './orders.js';

const cv = document.getElementById('cv'), gl = document.getElementById('gl');
const R = new Renderer(cv, gl), fx = new FX(), input = new Input(cv), snd = new Sound(), hap = new Haptics();
let data = Save.load();
Orders.ensureOrders(data);
let ordBase = null, ordItems = new Set(), ordHudT = 0;
snd.on = data.settings.sound; hap.on = data.settings.vib;

let mode = 'home', world = null, guide = null, guideT = 0, saveT = 0, hudT = 0, time = 0, last = performance.now();
let feverFxT = 0, fullFxT = -9, goldFxT = -9;
let modalOpen = false, cashFxT = 0, winDone = false, harvestFxT = 0, saleHapT = 0;
const restoredAt = {};            // session-only animation stamps for the home screen

const ITEM_BITS = { wheat: ['#F6CB4A', '#FFE07A', '#C9962A'], potato: ['#5DBB3A', '#9C6331', '#C98A4B'], egg: ['#FFF3D6', '#FFFFFF'], tomato: ['#EE4630', '#5DBB3A'],
                    tulip: ['#F2486E', '#FF8FB0', '#FFB3C8', '#5DBB3A'], rose: ['#E0283C', '#FF5A78', '#8E0E1E', '#3E8F25'], gold: ['#FFC21A', '#FFE16B', '#F29C0E', '#5DBB3A'],
                    log: ['#9A5A2E', '#F2CF8A', '#5DBB3A', '#C99A5E'], corn: ['#FFD23F', '#6CCB3E', '#F2B529'], pumpkin: ['#F2871E', '#5DBB3A', '#FFAE58'], berry: ['#E8243C', '#5DBB3A', '#FFFFFF'],
                    fish: ['#BDE8FF', '#FFFFFF', '#4FA8F0', '#FF8A3D'], grape: ['#7A3EA8', '#8E4EC0', '#5DBB3A'], pepper: ['#E8302C', '#FFC21A', '#5DBB3A'] };

const ui = new UI({
  home: () => goHome(),
  play: () => { snd.unlock(); snd.play('tap'); const li = +ui.el.play.dataset.li || 0; start(li); },
  next: () => goHome(true),
  start: (li) => { snd.unlock(); start(li); },
  restore: (id) => restore(id),
  modal: (on) => { modalOpen = on; input.enabled = !on; if (on) snapshot(); },
  world: () => world,
  setting: (k, v) => { data.settings[k] = v; if (k === 'sound') { snd.on = v; if (v) snd.unlock(); } if (k === 'vib') { hap.on = v; if (v) hap.buzz(60, 255); } Save.save(data); },
  reset: () => { Save.wipe(); data = Save.load(); data.coins = 0; Save.save(data); applyLook(); world = null; for (const k in restoredAt) delete restoredAt[k]; goHome(); },
  data: () => data,
  starSfx: (i) => { snd.blip(880 + i * 220, 0.18, 'triangle', 0.16); hap.tick(18, 0); },
  tap: () => { snd.unlock(); snd.play('tap'); },
  // 商店
  shopOpen: () => { snd.unlock(); snd.play('tap'); ensurePreview(); },
  thumb: (it) => { try { return ensurePreview().thumb(it); } catch (_) { return ''; } },
  shopBuy: (id) => {
    const r = Shop.buy(data, id);
    if (r === 'ok') { Save.save(data); applyLook(); snd.play('restore'); hap.pattern([30, 40, 30], [200, 255]); fx.confetti(R.W, R.H, 60); }
    else { snd.play('full'); hap.tick(30, 0); }
    return r;
  },
  // 订单板 / 雇工
  orders: () => { snd.unlock(); snd.play('tap'); if (Orders.ensureOrders(data)) Save.save(data); },
  claim: (i) => {
    const r = Orders.claimOrder(data, i, Shop.itemById);
    if (r) { Save.save(data); applyLook(); snd.play('restore'); hap.pattern([30, 40, 30], [200, 255]); fx.confetti(R.W, R.H, 80); ui.renderHome(data); }
    return r;
  },
  swap: (i) => { const ok = Orders.swapOrder(data, i); if (ok) { Save.save(data); snd.play('appear'); } else snd.play('full'); return ok; },
  shopToggle: (id) => { const r = Shop.toggle(data, id); Save.save(data); applyLook(); snd.play(r === 'on' ? 'appear' : 'tap'); hap.tick(14, 0); return r; },
});

// 商店 look: the farmer's outfit (3D in levels) and the decorations (estate + level scenery)
let preview = null;
function ensurePreview() { if (!preview) { preview = new Preview(document.getElementById('shopPrev')); } return preview; }
function applyLook() { R.setOutfit(Shop.heroStyle(data.shop.eq)); R.setDecos(data.shop.deco); R.setUniform(Shop.uniformStyle(data.shop.uni)); }
applyLook();

input.onFirst = () => snd.unlock();

function resize() {
  R.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
  if (world) R.follow(0, true);
}
window.addEventListener('resize', resize);
resize();

function start(li) {
  const resume = data.cur && data.cur.li === li;
  const crew = Crew.levelCrew(data.crew, li);   // 雇工: who works this level, with their 特长
  world = new World(li, { crew });
  if (resume) { try { world.restore(data.cur); } catch (_) { world = new World(li, { crew }); } }
  else data.cur = world.snapshot();
  Orders.ensureOrders(data); ordBase = Orders.cloneStats(world.stats); ordItems = Orders.levelItems(li);
  data.played = true; Save.save(data);
  R.setWorld(world); R.setMode('play'); R.follow(0, true); fx.clear();
  mode = 'play'; winDone = false; guide = null; guideT = 0;
  ui.hideAll(); ui.showHUD(world); ui.banner(world);
  modalOpen = false; input.enabled = true; input.everMoved = resume || li > 0 ? input.everMoved : false;
}

function snapshot() { if (world && !world.won) { credit(); data.cur = world.snapshot(); Save.save(data); } }

// v3.6: what happened in the level since the last call goes to the 订单 and the 雇工 XP
function credit() {
  if (!world || !ordBase) return;
  Orders.trackOrders(data, world.stats, ordBase); ordBase = Orders.cloneStats(world.stats);
  for (const w of world.workers) {
    if (!w.crewId) continue;
    const d = (w.done || 0) - (w.xpPaid || 0); if (d <= 0) continue;
    w.xpPaid = w.done;
    const up = Crew.addXp(data.crew, w.crewId, d);
    if (up > 0 && mode === 'play') { const m = data.crew.find((x) => x.id === w.crewId); ui.note(`${w.crewName} 升到 ${m.lv} 级！`, performance.now() / 1000); snd.play('appear'); }
  }
}

function goHome(fromWin) {
  if (world && !world.won) snapshot(); else if (world) { credit(); Save.save(data); }
  Orders.ensureOrders(data);
  mode = 'home'; R.setMode('home'); ui.hideAll(); ui.el.banner.classList.add('hidden'); ui.showHome(data); fx.clear();
  input.enabled = true; modalOpen = false;
  if (fromWin) { /* stars freshly earned: nudge the cheapest affordable item */ }
}

function restore(id) {
  const m = CFG.meta.find((x) => x.id === id);
  if (!m || data.restored.includes(id)) return;
  snd.unlock();
  if (m.page === 3 && data.unlocked < 38) { snd.play('full'); hap.tick(30, 0); return; }   // 湖畔酒庄 opens after level 38
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
  // 金币: every clear pays (more for a bigger farm and more stars); new stars pay a bonus
  credit();
  const coins = Shop.levelCoins(world.stats.earned, stars, Math.max(0, stars - prev));
  data.coins = (data.coins || 0) + coins;
  data.cur = null; Save.save(data);
  snd.play('win'); hap.pattern([70, 70, 70, 70, 260], [255, 255, 255]);
  fx.confetti(R.W, R.H, 200);
  setTimeout(() => ui.showWin(li, stars, world.winT, Math.max(0, stars - prev), coins), 650);
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
        if (e.who === 'player') { snd.play('harvest'); if (world.feverT > 0) hap.tick(18, 38, 255); else hap.tick(16, 70, 235); }   // continuous strong rumble while cutting (faster in fever)
        break;
      case 'drop': snd.play('drop'); break;
      case 'sale': ui.earn(e.amount, performance.now() / 1000); snd.play('sale'); if (time - saleHapT > 0.18) { saleHapT = time; hap.buzz(34, 255); } break;
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
        ui.note('解锁！', performance.now() / 1000);
        snd.play('unlock'); hap.pattern([50, 45, 90], [255, 255]); break;
      case 'tileAppear': snd.play('appear'); fx.ring(e.x, e.y, '#FFF27A', 36); break;
      case 'full':   // stack at max: cutting stops, the arrow swings to the counter. The MAX pill on the
        // stack says it (with a short 去出售 line); no floating text, and the ring/buzz at most every 3 s
        // so a load that hovers at the cap (drop one, pick one) can't spam it.
        guideT = 0; R.fullAt = time;
        if (time - fullFxT > 3) { fullFxT = time; fx.ring(world.player.x, world.player.y, '#FF6A4D', 50); snd.play('full'); hap.buzz(170, 255); }
        break;
      case 'golden':   // 金色作物
        fx.burst(e.x, e.y, 14, 26, ['#FFD23F', '#FFF27A', '#FFFFFF', '#F29C0E'], 110, 160, 3.2, 'star', 1.0);
        fx.ring(e.x, e.y, '#FFE55A', 46);
        if (e.who === 'player') { ui.earn(e.amount, performance.now() / 1000); ui.note('金色作物！', performance.now() / 1000);
          if (time - goldFxT > 0.25) { goldFxT = time; for (let i = 0; i < 4; i++) fx.bill(R.X(e.x, e.y), R.Y(e.x, e.y, 30), coin.x, coin.y, i * 0.05); setTimeout(() => ui.bumpCoin(), 450); snd.play('coin'); hap.pattern([60, 30, 110], [255, 255]); } }
        break;
      case 'fever':
        ui.note('丰收狂热！', performance.now() / 1000); fx.ring(e.x, e.y, '#FFD23F', 90); fx.flash = 0.6; fx.shake(6, 0.25);
        snd.play('unlock'); hap.pattern([40, 30, 40, 30, 120], [255, 255, 255]); break;
      case 'feverEnd': break;
      case 'workerLevel': ui.note(`雇工升级 Lv${e.lv}`, performance.now() / 1000); fx.burst(e.x, e.y, 40, 12, ['#9BFF6A', '#FFFFFF', '#FFD23F'], 50, 90, 2.6, 'star', 0.8); snd.play('appear'); break;
      case 'loaderUp': fx.burst(e.x, e.y, 10, 30, ['#FFC21A', '#FFFFFF', '#3BA7FF'], 100, 140, 3, 'conf', 1.0); ui.note('铲车!', performance.now() / 1000); break;
      case 'vipPay':   // VIP pays double: coin shower
        ui.note('VIP 付双倍！', performance.now() / 1000);
        fx.burst(e.x, e.y, 40, 22, ['#FFD23F', '#FFF27A', '#FFFFFF'], 90, 150, 3, 'star', 1.0);
        if (e.cashier) { for (let i = 0; i < 10; i++) fx.bill(R.X(e.x, e.y), R.Y(e.x, e.y, 30), coin.x, coin.y, i * 0.05); setTimeout(() => ui.bumpCoin(), 500); }
        else for (let i = 0; i < 10; i++) fx.wbill(e.x + 30, e.y, e.tx + (Math.random() - 0.5) * 24, e.ty + (Math.random() - 0.5) * 10, i * 0.05);
        snd.play('coin'); hap.pattern([40, 30, 60], [230, 255]); break;
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
    if (world.feverT > 0 && (feverFxT -= dt) <= 0) {   // golden sparkle trail
      feverFxT = 0.06; const p = world.player;
      fx.burst(p.x, p.y, 6, 3, ['#FFD23F', '#FFF27A', '#FFFFFF'], 25, 50, 2.4, 'star', 0.7);
    }
    fx.update(dt);
    R.follow(dt);
    guideT -= dt; if (guideT <= 0) { guide = world.guide(); guideT = 0.15; }
    const showHand = world.li === 0 && !input.everMoved && !world.won;
    R.draw(world, fx, world.won ? null : guide, time, { hand: showHand });
    input.draw(R.g, R.W, R.H, !modalOpen && !world.won);
    hudT -= dt; if (hudT <= 0) { ui.updateHUD(world); ui.tip(tutorialTip()); hudT = 0.1; }
    if ((ordHudT -= dt) <= 0) { ordHudT = 0.5; credit(); ui.orderHUD(Orders.hudOrder(data, ordItems)); }
    saveT += dt; if (saveT > 5) { saveT = 0; snapshot(); }
  } else {
    fx.update(dt);
    drawHome(R.g, R.W, R.H, { ...data, restoredAt }, time, R.dpr, R.W > R.H * 1.15, ui.page || 1);
    R.g.setTransform(R.dpr, 0, 0, R.dpr, 0, 0); R.fxScreen(fx);
    if (preview && ui.shopOpenNow()) {   // turntable preview inside the shop
      const c = preview.cv, w = c.clientWidth, h = c.clientHeight;
      if (w && h && (w !== preview.w || h !== preview.h)) preview.size(w, h);
      preview.show(ui.shopView()); preview.render(time);
    }
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
    shop: () => ui.openShop(), Shop, Crew, Orders, credit, orders: () => ui.openOrders(), crew: () => ui.openCrew(), applyLook, save: () => Save.save(data),
    // walk the bot into a field until the stack is tall (for screenshots of a cutting run)
    tallStack(n, extraCap = 0) {
      if (extraCap) { world.upg.cap += extraCap; world.refreshStats(); }
      const p = world.player; let g = null;
      for (let i = 0; i < 30 * 120 && p.stack.length + p.incoming < n; i++) {
        g = world.guide(); if (g && g.kind !== 'field' && g.kind !== 'pile') { const f = world.fields.find((q) => !q.hidden && q.ripe > 0); if (f) { const j = f.nearestRipe(p.x, p.y); g = { x: f.px(j), y: f.py(j) }; } }
        let ix = 0, iy = 0; if (g) { const ex = g.x - p.x, ey = g.y - p.y, e = Math.hypot(ex, ey) || 1; ix = ex / e; iy = ey / e; }
        world.update(1 / 30, ix, iy); world.events.length = 0;
      }
      R.follow(0, true); ui.updateHUD(world, true); ui.tip(''); ui.el.banner.classList.add('hidden');
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
      input.everMoved = true; R.follow(0, true); ui.updateHUD(world, true); ui.tip(''); ui.el.banner.classList.add('hidden');
      return { stack: p.stack.length, money: Math.round(world.money), t: Math.round(world.t), customers: world.customers.length };
    },
  };
}
