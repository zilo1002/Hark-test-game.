// 无界面平衡模拟：node sim/balance.mjs
// 模拟一个“普通玩家”：每 1~2 秒点一下，按顺序买东西，统计关键时间点
import { createState, barnUsed, barnCap, manorLevel, incomePerMin, cropById, seedCost } from '../js/state.js';
import { tick } from '../js/game.js';
import { isRipe, isEmpty, playerHarvest, playerPlant, buyPlot, nextPlotPrice, nextPlotIndex, nextCropToUnlock, unlockCrop } from '../js/crops.js';
import { sellAll, fulfilOrder, canFulfil } from '../js/market.js';
import { hireWorker, hireCost, countOf, isUnlocked, maxOf, upgradeWorkers, levelCost } from '../js/workers.js';
import { toolInfo, upgradeTool } from '../js/tools.js';

function mulberry(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function run(seed, minutes = 20, verbose = false) {
  const rng = mulberry(seed);
  const s = createState();
  s.started = true;
  const marks = {};
  const mark = (k) => { if (marks[k] == null) marks[k] = +(s.t / 60).toFixed(2); };
  let busy = 0, lastSell = 0;
  const playerActs = [];
  const dt = 0.1;
  let lastLog = 0;
  const bestCrop = () => {
    const opts = s.crops.filter(id => s.coins >= seedCost(s, id));
    opts.sort((a, b) => (cropById[b].price - cropById[b].seed) / cropById[b].time - (cropById[a].price - cropById[a].seed) / cropById[a].time);
    return opts[0];
  };
  const act = (cost, what) => { busy = cost * (0.7 + rng() * 0.8); playerActs.push({ t: s.t, what }); };
  while (s.t < minutes * 60) {
    tick(s, dt, rng);
    busy -= dt;
    if (manorLevel(s) >= 2) mark('manor2');
    if (busy > 0) continue;
    // 1 收割
    const ripe = s.plots.find(p => isRipe(p) && !p.res);
    if (ripe && barnUsed(s) < barnCap(s)) { playerHarvest(s, ripe, rng); act(0.9, 'harvest'); continue; }
    // 2 订单
    const o = s.orders.find(o => canFulfil(s, o));
    if (o && !countOf(s, 'butler')) { fulfilOrder(s, o.id, 'player', rng); act(2, 'order'); continue; }
    // 3 卖
    if (barnUsed(s) >= barnCap(s) * 0.5 || (barnUsed(s) > 0 && s.t - lastSell > 25 && !countOf(s, 'porter'))) {
      if (!countOf(s, 'porter') || barnUsed(s) >= barnCap(s) * 0.9) { sellAll(s); lastSell = s.t; act(2, 'sell'); continue; }
    }
    // 4 买（按顺序，买得起就买）
    const buys = [];
    // 先按“目标清单”攒钱买，清单完成后再买最便宜的
    const goals = ['harvester1', 'planter1', 'plot', 'porter1', 'crop', 'plot', 'crop', 'plot', 'harvester+', 'barn', 'plot', 'crop', 'planter+'];
    const done = s.botGoal || 0;
    const g = goals[done];
    const mk = (name) => {
      if (name === 'harvester1' || name === 'harvester+') return isUnlocked(s, 'harvester') ? [name, hireCost(s, 'harvester'), () => hireWorker(s, 'harvester')] : null;
      if (name === 'planter1' || name === 'planter+') return isUnlocked(s, 'planter') ? [name, hireCost(s, 'planter'), () => hireWorker(s, 'planter')] : null;
      if (name === 'porter1') return isUnlocked(s, 'porter') ? ['porter1', hireCost(s, 'porter'), () => hireWorker(s, 'porter')] : null;
      if (name === 'plot') return nextPlotIndex(s) >= 0 ? ['plot', nextPlotPrice(s), () => buyPlot(s)] : null;
      if (name === 'crop') { const nc = nextCropToUnlock(s); return nc ? ['crop:' + nc.id, nc.unlock, () => unlockCrop(s, nc.id)] : null; }
      if (name === 'barn') { const i = toolInfo(s, 'barn'); return ['barnLv', i.cost, () => upgradeTool(s, 'barn')]; }
    };
    if (g) {
      const it = mk(g);
      if (it) { if (s.coins >= it[1] && it[2]()) { s.botGoal = done + 1; if (!marks[it[0]]) mark(it[0]); act(1.5, 'buy'); continue; } }
      else if (g !== 'harvester1' && g !== 'planter1' && g !== 'porter1') s.botGoal = done + 1;
    } else {
      if (nextPlotIndex(s) >= 0) buys.push(['plot', nextPlotPrice(s) * 0.6, () => buyPlot(s)]);
      const nc = nextCropToUnlock(s); if (nc) buys.push(['crop:' + nc.id, nc.unlock * 0.5, () => unlockCrop(s, nc.id)]);
      for (const t of ['harvester', 'planter']) if (isUnlocked(s, t) && countOf(s, t) < Math.min(maxOf(s, t), 1 + Math.floor(s.plots.filter(p => p.open).length / 4))) buys.push([t + '+', hireCost(s, t), () => hireWorker(s, t)]);
      for (const t of ['harvester', 'planter', 'porter']) if (countOf(s, t) && s.wlv[t] < 3) buys.push([t + 'Lv', levelCost(s, t), () => upgradeWorkers(s, t)]);
      if (isUnlocked(s, 'butler') && !countOf(s, 'butler')) buys.push(['butler1', hireCost(s, 'butler'), () => hireWorker(s, 'butler')]);
      for (const k of ['barn', 'water', 'cart', 'sickle', 'hoe']) { const i = toolInfo(s, k); if (!i.maxed && !i.locked) buys.push([k + 'Lv', i.cost, () => upgradeTool(s, k)]); }
    }
    buys.sort((a, b) => a[1] - b[1]);
    const b = buys[0];
    if (b && s.coins >= b[1] / (b[0].startsWith('plot') ? 0.6 : b[0].startsWith('crop') ? 0.5 : 1) && b[2]()) {
      if (!b[0].endsWith('Lv') && !b[0].endsWith('+')) mark(b[0]);
      act(1.5, 'buy:' + b[0]); continue;
    }
    // 5 播种
    const empty = s.plots.find(p => isEmpty(p) && !p.res);
    const id = bestCrop();
    if (empty && id && (!countOf(s, 'planter') || rng() < 0.15)) { playerPlant(s, empty, id); act(1.2, 'plant'); continue; }
    busy = 0.5 + rng(); // 发呆
    if (verbose && s.t - lastLog >= 60) {
      lastLog = s.t;
      console.log(`${(s.t / 60).toFixed(0)}min coins=${s.coins} life=${s.lifetime} /min=${incomePerMin(s)} manor=${manorLevel(s)} plots=${s.plots.filter(p => p.open).length} crops=${s.crops.length} workers=${s.workers.map(w => w.type[0]).join('')}`);
    }
  }
  // 第 9~10 分钟玩家亲手操作占比
  const win = playerActs.filter(a => a.t >= 540 && a.t < 600 && !a.what.startsWith('buy'));
  return { marks, s, playerActs9to10: win.length, byWorker: s.stats.byWorker, stats: s.stats };
}

const res = [];
for (let seed = 1; seed <= 20; seed++) res.push(run(seed, 20, seed === 1));
const med = (arr) => { const a = arr.filter(x => x != null).sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : null; };
const keys = ['manor2', 'harvester1', 'planter1', 'porter1', 'plot', 'crop:radish', 'crop:cabbage', 'butler1'];
console.log('\n中位数（分钟，20 个种子）:');
for (const k of keys) console.log(`  ${k.padEnd(14)} ${med(res.map(r => r.marks[k]))}`);
console.log('  9~10 分钟玩家亲手操作次数（中位）:', med(res.map(r => r.playerActs9to10)));
// 自动化程度：10 分钟后复跑一个 seed，统计 10~11 分钟里雇工完成的比例
function automation(seed) {
  const r = run(seed, 10);
  const s = r.s; const before = { ...s.stats.byWorker }, allBefore = { h: s.stats.harvested, p: s.stats.planted, so: s.stats.sold };
  for (let i = 0; i < 600; i++) tick(s, 0.1); // 1 分钟完全不碰
  const h = s.stats.harvested - allBefore.h, p = s.stats.planted - allBefore.p;
  return { hands_off_min_harvested: h, planted: p, sold_by_workers: s.stats.byWorker.sold - before.sold, income_per_min: incomePerMin(s), workers: s.workers.map(w => w.type).join(',') };
}
console.log('\n第 10 分钟起完全不操作 1 分钟：');
for (const seed of [1, 2, 3]) console.log(' ', JSON.stringify(automation(seed)));
const r20 = res[0].s;
console.log('\n20 分钟时（seed1）: coins', r20.coins, 'lifetime', r20.lifetime, 'manor', manorLevel(r20), 'tools', JSON.stringify(r20.tools), 'wlv', JSON.stringify(r20.wlv));
