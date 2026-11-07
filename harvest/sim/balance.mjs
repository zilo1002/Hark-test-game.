// Headless balance sim for 半亩·丰收.
// Runs the real game logic (js/world.js) with a bot that follows the in-game guide
// arrow (walk to the suggested target with the joystick), and reports when each tile
// is bought and when each level's goal completes.
//   node sim/balance.mjs            # summary for both bot profiles
//   node sim/balance.mjs --verbose  # every unlock
import { CFG, goalText } from '../js/config.js';
import { World } from '../js/world.js';
import { levelCrew, crewDefaults } from '../js/crew.js';

const verbose = process.argv.includes('--verbose');
const only = process.argv.find((a) => a.startsWith('--level='));
const DT = 1 / 30, LIMIT = 900;
// v3.6 雇工: default = no roster bonus (same as a fresh Lv1 crew minus its +5%); --crew=1 / --crew=10 runs with the roster at that level
const crewArg = process.argv.find((a) => a.startsWith('--crew='));
const crewLv = crewArg ? +crewArg.split('=')[1] : 0;
// v4.0: default = neutral season, no rain (the numbers below are the balance reference); --season=0..3 / --rain to compare
const seaArg = process.argv.find((a) => a.startsWith('--season='));
const ENV = { season: seaArg ? +seaArg.split('=')[1] : null, rain: process.argv.includes('--rain') };
// v4.0 B: --pet runs with the 宠物狗 (default: no pet, so the reference numbers stay the same)
if (process.argv.includes('--pet')) ENV.pet = 'dog';
const crewFor = (li) => crewLv ? levelCrew(crewDefaults().map((m) => ({ ...m, lv: crewLv })), li) : null;

const PROFILES = {
  sharp:  { stick: 1.0, think: 0.1, label: '熟练（跟着箭头，满速）' },
  casual: { stick: 0.8, think: 0.7, label: '休闲（80% 摇杆，0.7 秒反应）' },
};

// v4.3: the bot walks the workers' A* path (World.botWay; the old corner-steer could wedge on a desk corner)
export function botWay(w, p, target) { return w.botWay(p, target); }

export function playLevel(li, prof, seed, env = {}) {   // env: per-call override (v4.6: { season } for the 四季山谷)
  const w = new World(li, { quiet: true, seed, crew: crewFor(li), ...ENV, ...env });
  const p = w.player;
  let target = null, think = 0, ix = 0, iy = 0;
  const unlocks = [];
  const bought = new Map(w.tiles.map((t) => [t, 0]));
  while (!w.won && w.t < LIMIT) {
    think -= DT;
    if (think <= 0) { target = w.guide(); think = prof.think; }
    if (target && (target.kind === 'pile' || target.kind === 'field' || target.kind === 'pond')) target = w.guide() || target; // keep chasing the field
    ix = iy = 0;
    if (target) {
      const stop = target.kind === 'tile' ? 4 : target.kind === 'pile' || target.kind === 'field' || target.kind === 'pond' ? 2 : 6;
      if (Math.hypot(target.x - p.x, target.y - p.y) > stop) {
        const wp = botWay(w, p, target);
        const dx = wp.x - p.x, dy = wp.y - p.y, d = Math.hypot(dx, dy) || 1;
        ix = dx / d * prof.stick; iy = dy / d * prof.stick;
      }
    }
    w.update(DT, ix, iy);
    for (const t of w.tiles) if (t.bought !== bought.get(t)) {
      bought.set(t, t.bought);
      unlocks.push({ t: w.t, id: t.id, label: t.label, n: t.bought, price: t.repeat ? Math.round(t.price0 * Math.pow(t.repeat.mul, t.bought - 1)) : t.price0 });
    }
  }
  const total = w.tiles.reduce((n, t) => n + (t.repeat ? t.repeat.times : 1), 0);   // v4.9: share of all purchases made at the clear
  return { won: w.won, time: w.won ? w.winT : w.t, stars: w.stars(), unlocks, built: unlocks.length / Math.max(1, total), money: w.money, workers: w.workers.length, vehicle: p.vehicle, world: env.keepWorld ? w : undefined };
}

const fmt = (s) => { s = Math.round(s); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

if (import.meta.url === `file://${process.argv[1]}`) {
  let bad = 0;
  for (const [key, prof] of Object.entries(PROFILES)) {
    console.log(`\n=== ${prof.label} ===`);
    let cum = 0; const ms = {};
    for (let li = 0; li < CFG.levels.length; li++) {
      if (only && +only.split('=')[1] !== li + 1) continue;
      const L = CFG.levels[li];
      const runs = [1, 2, 3].map((s) => playLevel(li, prof, s * 1000 + li));
      runs.sort((a, b) => a.time - b.time);
      const r = runs[1];
      const first = r.unlocks[0];
      if (li === 0 && first) ms.firstUnlock = first.t;
      const wk = r.unlocks.find((u) => u.label === '雇园丁');
      if (wk && ms.firstWorker === undefined) { ms.firstWorker = cum + wk.t; ms.firstWorkerRel = `${L.name} +${fmt(wk.t)}`; }
      const veh = r.unlocks.find((u) => u.label === '割草机');
      if (veh && ms.vehicle === undefined) { ms.vehicle = cum + veh.t; ms.vehicleRel = `${L.name} +${fmt(veh.t)}`; }
      // v4.9 全建好才过关 (CFG.v49.fullBuild): from level `from` on the sharp bot must have made ≥ checkShare of all purchases
      const FB = CFG.v49.fullBuild, fb = key === 'sharp' && li + 1 >= FB.from, built = Math.min(...runs.map((x) => x.built));
      if (!r.won || (fb && built < FB.checkShare)) bad++;
      console.log(`第${li + 1}关 ${L.name.padEnd(5, '　')} 「${goalText(L.goal)}」 ${r.won ? '完成' : '未完成'} ${fmt(r.time)} (3 seeds: ${runs.map((x) => fmt(x.time)).join(' / ')})  par ${fmt(L.par)} → ${r.stars}★  解锁 ${r.unlocks.length} 次  首次解锁 ${first ? fmt(first.t) : '-'}${li + 1 >= FB.from ? `  过关时已建 ${runs.map((x) => Math.round(x.built * 100) + '%').join(' / ')}${fb && built < FB.checkShare ? ' ← 不到 ' + Math.round(FB.checkShare * 100) + '%!' : ''}` : ''}`);
      if (verbose) for (const u of r.unlocks) console.log(`     ${fmt(u.t).padStart(5)}  ${u.id} ${u.label}${u.n > 1 ? ' #' + u.n : ''}  $${u.price}`);
      cum += r.time;
    }
    console.log(`--- 总时长 ${fmt(cum)}`);
    console.log(`--- 第一次解锁 ${fmt(ms.firstUnlock ?? -1)}（第1关） | 第一个园丁 ${ms.firstWorkerRel ?? '-'}（累计 ${fmt(ms.firstWorker ?? 0)}） | 割草机 ${ms.vehicleRel ?? '-'}（累计 ${fmt(ms.vehicle ?? 0)}）`);
  }
  if (bad) { console.log(`--- ${bad} 个关卡没通关或过关时没建好`); process.exitCode = 1; }
}
