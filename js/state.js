// 游戏状态与派生数值（纯逻辑，无 DOM）
import {
  START_COINS, CROPS, FIELD_COLS, FIELD_ROWS, START_PLOTS, MANOR_THRESHOLDS,
  TOOLS, INCOME_WINDOW,
} from './config.js';

export function createState() {
  const plots = [];
  for (let i = 0; i < FIELD_COLS * FIELD_ROWS; i++) {
    plots.push({ i, c: i % FIELD_COLS, r: Math.floor(i / FIELD_COLS), open: START_PLOTS.includes(i), crop: null, prog: 0, last: null, res: null });
  }
  const mult = {}, prev = {};
  for (const c of CROPS) { mult[c.id] = 1; prev[c.id] = 1; }
  return {
    v: 1,
    t: 0,
    coins: START_COINS,
    lifetime: 0,
    plots,
    crops: ['scallion'],
    barn: {},
    tools: { hoe: 1, sickle: 1, water: 1, cart: 1, barn: 1 },
    workers: [],
    wseq: 1,
    wlv: { planter: 1, harvester: 1, porter: 1, butler: 1 },
    autoSeed: 'last',
    seed: 'scallion',
    market: { mult, prev, next: 60 },
    orders: [],
    oseq: 1,
    swapAt: 0,
    stats: { harvested: 0, planted: 0, sold: 0, orders: 0, byWorker: { harvested: 0, planted: 0, sold: 0 } },
    hints: { planted: false, harvested: false, sold: false, hired: false },
    settings: { motion: 'auto' },
    manorSeen: 1,
    savedAt: Date.now(),
    started: false,
    rt: freshRuntime(),
  };
}

export function freshRuntime() {
  return { income: [], fx: [] };
}

export const cropById = Object.fromEntries(CROPS.map(c => [c.id, c]));

export function barnUsed(s) {
  let n = 0;
  for (const k in s.barn) n += s.barn[k];
  return n;
}
export function carried(s) {
  let n = 0;
  for (const w of s.workers) n += w.carryN || 0;
  return n;
}
export function barnCap(s) { return TOOLS.barn.cap[s.tools.barn - 1]; }
export function barnFree(s) { return barnCap(s) - barnUsed(s) - carried(s); }

export function manorLevel(s) {
  let lv = 1;
  for (let i = 0; i < MANOR_THRESHOLDS.length; i++) if (s.lifetime >= MANOR_THRESHOLDS[i]) lv = i + 1;
  return lv;
}
export function manorProgress(s) {
  const lv = manorLevel(s);
  if (lv >= MANOR_THRESHOLDS.length) return 1;
  const a = MANOR_THRESHOLDS[lv - 1], b = MANOR_THRESHOLDS[lv];
  return Math.min(1, (s.lifetime - a) / (b - a));
}

export function growSpeed(s) { return TOOLS.water.speed[s.tools.water - 1]; }
export function sellMult(s) { return TOOLS.cart.sell[s.tools.cart - 1]; }
export function seedCost(s, id) {
  return Math.max(1, Math.round(cropById[id].seed * (1 - TOOLS.hoe.seedDiscount[s.tools.hoe - 1])));
}
export function unitPrice(s, id) {
  return cropById[id].price * s.market.mult[id] * sellMult(s);
}

export function emit(s, ev) {
  if (s.rt.fx.length < 400) s.rt.fx.push(ev);
}

// 所有进账都走这里：金币、累计、滚动收入
export function earn(s, amt, src) {
  amt = Math.round(amt);
  if (amt <= 0) return 0;
  s.coins += amt;
  s.lifetime += amt;
  s.rt.income.push({ t: s.t, a: amt });
  return amt;
}

export function spend(s, amt) {
  if (s.coins < amt) return false;
  s.coins -= amt;
  return true;
}

export function incomePerMin(s) {
  const from = s.t - INCOME_WINDOW;
  const arr = s.rt.income;
  while (arr.length && arr[0].t < from) arr.shift();
  let sum = 0;
  for (const e of arr) sum += e.a;
  return Math.round(sum * 60 / INCOME_WINDOW);
}
