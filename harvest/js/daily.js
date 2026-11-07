// v4.0 每日挑战 (DOM-free, shared with sim/daily-ref.mjs).
// One challenge a day, picked from the local date: the layout and content of a level the player has
// already cleared (never level 1), remixed with one twist of the day. 3 minutes; the score is the money
// earned. Bronze / silver / gold thresholds come from what the balance bot earns in the same remix.
import { CFG } from './config.js';
import { DAILY_REF } from './daily-ref.js';
import { today } from './orders.js';

export const TWISTS = {
  rain:  { name: '雨天',     desc: '整局下雨，作物生长 +25%' },
  gold:  { name: '金色日',   desc: '金色作物多 4 倍' },
  vip:   { name: 'VIP 日',   desc: 'VIP 顾客多 3 倍（付双倍）' },
  rich:  { name: '开局有钱', desc: '开局就有 300 元' },
  swap:  { name: '今日换种', desc: '' },
  fast:  { name: '跑鞋日',   desc: '开局就穿跑鞋，走路更快' },
};
export const TWIST_IDS = Object.keys(TWISTS);
// field crops that can be swapped for one another (same kind of bed, no special model)
const SWAP = ['wheat', 'tulip', 'gold', 'rose', 'corn', 'berry'];

function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function nice(n) { const m = n >= 5000 ? 100 : n >= 1000 ? 50 : 10; return Math.max(m, Math.round(n / m) * m); }

export const dailyOpen = (data) => (data.unlocked || 0) >= CFG.daily.unlockAfter;

// the crop swap for a level (fixed per level so the reference table holds): {from: to}
export function swapMap(li) {
  const L = CFG.levels[li], used = new Set(), fed = new Set();
  for (const o of L.objects) if (o.type === 'proc') fed.add(o.in);
  for (const o of L.objects) if (o.type === 'field' && SWAP.includes(o.crop) && !fed.has(o.crop)) used.add(o.crop);
  const m = {}; const taken = new Set(L.objects.filter((o) => o.type === 'field').map((o) => o.crop));
  let k = li % SWAP.length;
  for (const c of used) {
    for (let j = 0; j < SWAP.length; j++) { const y = SWAP[(k + j) % SWAP.length]; if (!taken.has(y)) { m[c] = y; taken.add(y); k = (k + j + 1) % SWAP.length; break; } }
  }
  return m;
}

// the remixed level object
export function buildLevel(li, twist) {
  const L = JSON.parse(JSON.stringify(CFG.levels[li]));
  L.name = CFG.levels[li].name; L.tutorial = false;
  if (twist === 'swap') {
    const m = swapMap(li);
    for (const o of L.objects) {
      if (o.type === 'field' && m[o.crop]) o.crop = m[o.crop];
      if (o.type === 'counter') o.items = o.items.map((it) => m[it] || it);
    }
  }
  if (twist === 'gold') for (const o of L.objects) if (o.type === 'field') o.goldMul = 4;
  return L;
}

export function worldOpts(twist) {
  const o = {};
  if (twist === 'rain') o.rain = true;
  if (twist === 'vip') o.vipMul = 3;
  if (twist === 'rich') o.money = 300;
  if (twist === 'fast') o.speedUp = 25;
  return o;
}

// today's challenge for a save: { day, li, twist, name, desc, L, opts, tiers: [bronze, silver, gold], seed }
export function dailyFor(data, d = new Date()) {
  const day = typeof d === 'string' ? d : today(d);
  const cleared = Math.min(CFG.valley ? CFG.valley.from : CFG.levels.length, Math.max(CFG.daily.unlockAfter, data.unlocked || 0));   // v4.6: never a 四季山谷 level (its crops follow the picked season)
  const r = rng(hashStr('daily:' + day));
  let li = 1 + Math.floor(r() * (cleared - 1));            // a cleared level, never the tutorial
  let twist = TWIST_IDS[Math.floor(r() * TWIST_IDS.length)];
  if (twist === 'swap' && !Object.keys(swapMap(li)).length) twist = 'gold';
  // once today's challenge has been opened it stays the same all day (clearing more levels doesn't re-roll it)
  const D = data.daily;
  if (D && D.day === day && Number.isInteger(D.li) && D.li > 0 && D.li < (CFG.valley ? CFG.valley.from : CFG.levels.length) && TWISTS[D.twist]) { li = D.li; twist = D.twist; }
  const L = buildLevel(li, twist);
  const ref = DAILY_REF[`${li}:${twist}`] || Math.round(CFG.levels[li].goal.type === 'earn' ? CFG.levels[li].goal.n / CFG.levels[li].par * CFG.daily.time : 3000);
  const tiers = CFG.daily.tiers.map((f) => nice(ref * f));
  L.goal = { type: 'earn', n: tiers[2] };
  let desc = TWISTS[twist].desc;
  if (twist === 'swap') { const m = swapMap(li); desc = Object.entries(m).map(([a, b]) => `${CFG.items[a].name}田改种${CFG.items[b].name}`).join('，'); }
  return { day, li, twist, name: TWISTS[twist].name, desc, L, opts: worldOpts(twist), tiers, seed: hashStr('seed:' + day) % 100000 };
}

// ---- results (data.daily) ----------------------------------------------------------
export function dailyDefaults() { return { li: null, twist: null, day: '', best: 0, paid: 0, plays: 0, allBest: 0, allBestDay: '', hist: {} }; }
export function normDaily(d) {
  const b = dailyDefaults();
  if (!d || typeof d !== 'object') return b;
  const n = (v) => (typeof v === 'number' && isFinite(v) ? Math.max(0, Math.floor(v)) : 0);
  const hist = {};
  if (d.hist && typeof d.hist === 'object') for (const [k, v] of Object.entries(d.hist)) if (/^\d{4}-\d\d-\d\d$/.test(k)) hist[k] = n(v);
  const li = Number.isInteger(d.li) ? d.li : null, twist = typeof d.twist === 'string' && TWISTS[d.twist] ? d.twist : null;
  return { li, twist, day: typeof d.day === 'string' ? d.day : '', best: n(d.best), paid: Math.min(3, n(d.paid)), plays: n(d.plays), allBest: n(d.allBest), allBestDay: typeof d.allBestDay === 'string' ? d.allBestDay : '', hist };
}
// roll the per-day record over when the date changed
export function ensureDay(data, day, dc) {
  const D = data.daily;
  if (D.day !== day) { D.day = day; D.best = 0; D.paid = 0; D.plays = 0; D.li = dc ? dc.li : null; D.twist = dc ? dc.twist : null; return true; }
  if (dc && D.li == null) { D.li = dc.li; D.twist = dc.twist; return true; }
  return false;
}
export const tierOf = (score, tiers) => (score >= tiers[2] ? 3 : score >= tiers[1] ? 2 : score >= tiers[0] ? 1 : 0);
export const TIER_LABEL = ['', '铜牌', '银牌', '金牌'];

// record a finished run; pays 金币 for each tier reached for the first time today
export function recordDaily(data, dc, score) {
  ensureDay(data, dc.day, dc);
  const D = data.daily, tier = tierOf(score, dc.tiers);
  const prevBest = D.best, prevAll = D.allBest;
  D.plays++;
  if (score > D.best) D.best = score;
  if (score > D.allBest) { D.allBest = score; D.allBestDay = dc.day; }
  D.hist[dc.day] = D.best;
  const keys = Object.keys(D.hist).sort(); while (keys.length > 30) delete D.hist[keys.shift()];
  let coins = 0;
  for (let t = D.paid; t < tier; t++) coins += CFG.daily.coins[t];
  if (tier > D.paid) D.paid = tier;
  data.coins = (data.coins || 0) + coins;
  return { score, tier, coins, best: D.best, newBest: score > prevBest, allBest: D.allBest, newAll: score > prevAll && prevAll > 0, paid: D.paid };
}
