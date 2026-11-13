// v5.0.9 manor maps: save compatibility, atomic map purchase, the cycle switcher,
// season-follows-map, the save invariant, and a drawHome smoke test (mock canvas).
// Run: node sim/probe-509-manor-maps.mjs  (exit 1 on any failure)
import assert from 'node:assert/strict';
import * as Shop from '../js/shop.js';
import { load, defaults, save as saveFn } from '../js/save.js';
import { forceSeason, valleySeason } from '../js/seasons.js';
import { World } from '../js/world.js';
import { drawHome } from '../js/home.js';

let n = 0;
const check = (name, fn) => { fn(); n++; console.log(`PASS ${name}`); };

// a data object with enough stars to buy both maps (36★) and every area open
const rich = () => {
  const d = defaults();
  d.unlocked = 67;
  for (let i = 0; i < 12; i++) d.stars[i] = 3;
  d.spent = 0;
  return d;
};

// ---- save compatibility -------------------------------------------------------
check('old save (no shop.maps, old homeMap shape) loads clean: maps [], festival maps kept', () => {
  const old = defaults();
  delete old.shop.maps;
  old.homeMap = { mode: 'calendar', season: null, festival: null };
  old.festivalMaps = ['xmas'];
  saveFn(old);
  const d = load();
  assert.deepEqual(d.shop.maps, []);
  assert.equal(d.homeMap.mode, 'calendar');
  assert.equal(d.homeMap.map, null);
  assert.deepEqual(d.festivalMaps, ['xmas']);
});

check('stale homeMap (map not owned) falls back to the default estate on load', () => {
  const s = defaults();
  s.shop.maps = [];
  s.homeMap = { mode: 'map', season: null, festival: null, map: 'night' };
  saveFn(s);
  const d = load();
  assert.equal(d.homeMap.mode, 'calendar');
  assert.equal(d.homeMap.map, null);
});

check('owned map survives load (no false fallback)', () => {
  const s = defaults();
  s.shop.maps = ['valley'];
  s.homeMap = { mode: 'map', season: null, festival: null, map: 'valley' };
  saveFn(s);
  const d = load();
  assert.equal(d.homeMap.mode, 'map');
  assert.equal(d.homeMap.map, 'valley');
});

check('shop.maps not an array normalizes to [] (no crash)', () => {
  const s = defaults();
  s.shop.maps = 'valley';
  saveFn(s);
  assert.deepEqual(load().shop.maps, []);
  const s2 = defaults();
  s2.shop.maps = ['valley', 'bogus', 'night', 'valley'];
  saveFn(s2);
  assert.deepEqual(load().shop.maps, ['valley', 'night']);
});

check('map id leaked into owned/deco is dropped (maps never live in deco)', () => {
  const s = defaults();
  s.shop.owned = ['mapValley'];
  s.shop.deco = ['mapValley'];
  saveFn(s);
  const d = load();
  assert.ok(!d.shop.owned.includes('mapValley'));
  assert.ok(!d.shop.deco.includes('mapValley'));
  assert.deepEqual(d.shop.maps, []);
});

check('illegal map id in homeMap falls back (strict whitelist)', () => {
  const s = defaults();
  s.shop.maps = ['valley'];
  s.homeMap = { mode: 'map', season: null, festival: null, map: 'haunted' };
  saveFn(s);
  assert.equal(load().homeMap.mode, 'calendar');
});

// ---- purchase (atomic, single source of truth) --------------------------------
check('buy valley: 15★ deducted once, maps=[valley], not in owned/deco', () => {
  const d = rich();
  assert.equal(Shop.buy(d, 'mapValley'), 'ok');
  assert.equal(d.spent, 15);
  assert.deepEqual(d.shop.maps, ['valley']);
  assert.ok(!d.shop.owned.includes('mapValley'));
  assert.ok(!d.shop.deco.includes('mapValley'));
  assert.equal(Shop.starBalance(d), 36 - 15);
});

check('duplicate buy returns owned, no double charge', () => {
  const d = rich();
  Shop.buy(d, 'mapValley');
  assert.equal(Shop.buy(d, 'mapValley'), 'owned');
  assert.equal(d.spent, 15);
  assert.deepEqual(d.shop.maps, ['valley']);
});

check('buy both maps: 35★ total, atomic', () => {
  const d = rich();
  assert.equal(Shop.buy(d, 'mapValley'), 'ok');
  assert.equal(Shop.buy(d, 'mapNight'), 'ok');
  assert.equal(d.spent, 35);
  assert.deepEqual(d.shop.maps, ['valley', 'night']);
  assert.equal(Shop.starBalance(d), 1);
});

check('buy before unlock returns locked, nothing deducted', () => {
  const d = rich();
  d.unlocked = 30; // valley opens after 45
  assert.equal(Shop.buy(d, 'mapValley'), 'locked');
  assert.equal(d.spent, 0);
  assert.deepEqual(d.shop.maps, []);
  d.unlocked = 50; // valley open, night (60) still locked
  assert.equal(Shop.buy(d, 'mapNight'), 'locked');
  assert.equal(Shop.buy(d, 'mapValley'), 'ok');
});

check('buy without enough stars returns poor, nothing deducted', () => {
  const d = rich();
  d.stars = { 0: 3, 1: 3 }; // 6★ only
  assert.equal(Shop.buy(d, 'mapValley'), 'poor');
  assert.equal(d.spent, 0);
  assert.deepEqual(d.shop.maps, []);
});

check('toggle / isOn never touch maps (a map is not worn or placed)', () => {
  const d = rich();
  Shop.buy(d, 'mapValley');
  assert.equal(Shop.toggle(d, 'mapValley'), 'locked');
  assert.equal(Shop.isOn(d, 'mapValley'), false);
  assert.deepEqual(d.shop.maps, ['valley']);
  assert.ok(!d.shop.deco.includes('mapValley'));
});

// ---- cycle switcher (pure helpers) --------------------------------------------
check('cycle order: default -> valley -> night -> festival -> default', () => {
  const d = rich();
  d.shop.maps = ['valley', 'night'];
  d.festivalMaps = ['xmas'];
  d.homeMap = { mode: 'calendar', season: null, festival: null, map: null };
  assert.deepEqual(Shop.ownedMapKeys(d), ['default', 'valley', 'night', 'xmas']);
  assert.equal(Shop.currentMapKey(d), 'default');
  assert.equal(Shop.nextMapKey(d), 'valley');
  d.homeMap = { mode: 'map', season: null, festival: null, map: 'valley' };
  assert.equal(Shop.nextMapKey(d), 'night');
  d.homeMap = { mode: 'map', season: null, festival: null, map: 'night' };
  assert.equal(Shop.nextMapKey(d), 'xmas');
  d.homeMap = { mode: 'festival', season: null, festival: 'xmas', map: null };
  assert.equal(Shop.currentMapKey(d), 'xmas');
  assert.equal(Shop.nextMapKey(d), 'default');
});

check('only one map: cycle list is [default], next is itself (button stays, hint instead)', () => {
  const d = defaults();
  assert.deepEqual(Shop.ownedMapKeys(d), ['default']);
  assert.equal(Shop.nextMapKey(d), 'default');
});

check('festival map not collected is not in the cycle, and is not the current map', () => {
  const d = rich();
  d.shop.maps = ['valley'];
  d.homeMap = { mode: 'festival', season: null, festival: 'xmas', map: null };
  assert.deepEqual(Shop.ownedMapKeys(d), ['default', 'valley']);
  assert.equal(Shop.currentMapKey(d), 'default');
});

check('button labels: icon + current map name (longest name still short)', () => {
  assert.equal(Shop.mapLabel('default'), '四季庄园');
  assert.equal(Shop.mapLabel('valley'), '山谷地图');
  assert.equal(Shop.mapLabel('night'), '夜市地图');
  assert.equal(Shop.mapLabel('xmas'), '圣诞节');
  assert.equal(Shop.mapIcon('default'), '🏡');
  assert.equal(Shop.mapIcon('valley'), '🌾');
  assert.equal(Shop.mapIcon('night'), '🏮');
  for (const k of ['default', 'valley', 'night', 'halloween', 'xmas', 'cny']) {
    const label = `${Shop.mapIcon(k)} ${Shop.mapLabel(k)} ⇄`;
    assert.ok(label.length <= 9, `button label too long: ${label}`);
  }
});

// ---- season follows the map (manor only) ---------------------------------------
check('valley map season = data.valley.season; night map season = calendar week', () => {
  forceSeason(0); // calendar week = spring
  const d = defaults();
  d.shop.maps = ['valley', 'night']; // the test data owns both maps (else the invariant falls back)
  d.valley = { season: 2 }; // player picked autumn for the valley
  d.homeMap = { mode: 'map', season: null, festival: null, map: 'valley' };
  assert.equal(Shop.homeSeasonFor(d), 2);
  d.homeMap = { mode: 'map', season: null, festival: null, map: 'night' };
  assert.equal(Shop.homeSeasonFor(d), 0);
  d.homeMap = { mode: 'calendar', season: null, festival: null, map: null };
  assert.equal(Shop.homeSeasonFor(d), 0);
  d.homeMap = { mode: 'season', season: 3, festival: null, map: null };
  assert.equal(Shop.homeSeasonFor(d), 3);
  forceSeason(null);
});

check('valley level season follows data.valley.season, not the manor map', () => {
  forceSeason(0);
  const d = defaults();
  d.valley = { season: 2 };
  d.homeMap = { mode: 'map', season: null, festival: null, map: 'night' }; // manor is on the night map
  const w = new World(45, { quiet: true, season: valleySeason(d) }); // L46, first valley level
  assert.equal(w.season, 2, 'valley level still runs in autumn while the manor shows night');
  forceSeason(null);
});

// ---- drawHome smoke test (mock 2D context) --------------------------------------
const makeCtx = () => {
  const calls = [];
  const gradient = { addColorStop() {} };
  const ctx = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'createRadialGradient' || prop === 'createLinearGradient') return (...a) => { calls.push(['gradient', prop]); return gradient; };
      if (prop === 'measureText') return () => ({ width: 0 });
      return (...a) => { calls.push(['call', prop, ...a]); };
    },
    set(_t, prop, v) { calls.push(['set', prop, v]); return true; },
  });
  return { ctx, calls };
};
let currentCtx = null;
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => currentCtx }) };
const runHome = (save) => {
  const { ctx, calls } = makeCtx();
  currentCtx = ctx;
  drawHome(ctx, 800, 600, save, 1.5, 1, { x: 0, y: 56, w: 800, h: 544 }, 1);
  return calls;
};
const hasSet = (calls, prop, val) => calls.some((c) => c[0] === 'set' && c[1] === prop && c[2] === val);
const hasGradient = (calls) => calls.some((c) => c[0] === 'gradient');

check('drawHome night: overlay + glow run, fireflies run, no crash', () => {
  const d = { ...defaults(), season: 1, night: true, fest: null, build: false };
  const calls = runHome(d);
  assert.ok(hasSet(calls, 'fillStyle', 'rgba(10,20,48,0.22)'), 'night tint overlay drawn');
  assert.ok(hasGradient(calls), 'night glow (radial gradient) drawn');
  assert.ok(hasSet(calls, 'fillStyle', '#FFE27A'), 'fireflies drawn');
});

check('drawHome day: no night overlay, no fireflies', () => {
  const d = { ...defaults(), season: 0, night: false, fest: null, build: false };
  const calls = runHome(d);
  assert.ok(!hasSet(calls, 'fillStyle', 'rgba(10,20,48,0.22)'), 'no night tint in the day');
  assert.ok(!hasSet(calls, 'fillStyle', '#FFE27A'), 'no fireflies in the day');
});

check('drawHome valley (autumn lock): renders, no night overlay', () => {
  const d = { ...defaults(), season: 2, night: false, fest: null, build: false };
  const calls = runHome(d);
  assert.ok(!hasSet(calls, 'fillStyle', 'rgba(10,20,48,0.22)'));
});

console.log(`ALL MANOR-MAP CHECKS PASS (${n} checks)`);
