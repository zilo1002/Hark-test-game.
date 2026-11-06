// v4.0 B 图鉴 (collection book). DOM-free (shared with the tests).
// Four pages: 作物 (every crop and product), 动物 (farm animals + pets), 金色变种 (a golden version of
// every field crop, collected by cutting a golden plant of that kind), 工人 (the 雇工 roster).
// An entry is locked (a silhouette) until it is first collected and then shows how many so far.
// A finished page pays once: a limited outfit piece or 金币.
import { CFG } from './config.js';
import { ROSTER } from './crew.js';

export const ANIMALS = [
  { id: 'hen',   name: '母鸡', item: 'egg' },
  { id: 'cow',   name: '奶牛', item: 'milk' },
  { id: 'sheep', name: '绵羊', item: 'wool' },
  { id: 'hive',  name: '蜜蜂', item: 'honey' },
  { id: 'fish',  name: '小鱼', item: 'fish' },
  { id: 'dog',   name: '小狗', pet: 'dog' },
  { id: 'cat',   name: '小猫', pet: 'cat' },
];
export const GOLDEN = Object.keys(CFG.crops);            // field crops that can come up golden
export const CROPS = Object.keys(CFG.items);             // every crop and product
export const PAGES = [
  { id: 'crops',  name: '作物',     reward: { item: 'bookHat' },  rewardText: '图鉴大师帽' },
  { id: 'animal', name: '动物',     reward: { coins: 600 },       rewardText: '600 金币' },
  { id: 'golden', name: '金色变种', reward: { item: 'goldScarf' }, rewardText: '金穗围巾' },
  { id: 'crew',   name: '工人',     reward: { coins: 800 },       rewardText: '800 金币' },
];

export function bookDefaults() { return { c: {}, g: {}, seen: [], paid: [], filled: false }; }
const n0 = (v) => (typeof v === 'number' && isFinite(v) ? Math.max(0, Math.floor(v)) : 0);
export function normBook(b) {
  const d = bookDefaults();
  if (!b || typeof b !== 'object') return d;
  for (const k of CROPS) if (b.c && b.c[k]) d.c[k] = n0(b.c[k]);
  for (const k of GOLDEN) if (b.g && b.g[k]) d.g[k] = n0(b.g[k]);
  d.seen = Array.isArray(b.seen) ? b.seen.filter((k) => CROPS.includes(k)) : [];
  d.paid = Array.isArray(b.paid) ? b.paid.filter((k) => PAGES.some((p) => p.id === k)) : [];
  d.filled = !!b.filled;
  return d;
}

// what a level makes: field crops, coop produce, machine outputs
export function levelItems(L) {
  const out = new Set();
  for (const o of L.objects) { if (o.type === 'field') out.add(o.crop); if (o.type === 'coop') out.add(o.item); if (o.type === 'proc') out.add(o.out); }
  return [...out].filter((k) => CFG.items[k]);
}

// back-fill an older save once: everything made in a cleared level counts as discovered, and a level
// whose goal was "collect / make / sell N of X" proves at least N of X (the exact count is not in old saves)
export function backfill(data) {
  const B = data.book; if (B.filled) return false;
  B.filled = true;
  const cleared = Math.min(CFG.levels.length, data.unlocked || 0);
  for (let li = 0; li < cleared; li++) {
    const L = CFG.levels[li];
    for (const k of levelItems(L)) if (!B.seen.includes(k)) B.seen.push(k);
    const g = L.goal; if (g.item && (g.type === 'collect' || g.type === 'produce' || g.type === 'sell')) B.c[g.item] = Math.max(B.c[g.item] || 0, g.n);
  }
  return true;
}

export const cloneBookStats = (s) => ({ collected: { ...s.collected }, produced: { ...s.produced }, golden: { ...(s.golden || {}) } });
// add what happened in a level since `base`; returns the ids that were collected for the first time
export function trackBook(data, stats, base) {
  const B = data.book, fresh = [];
  const add = (k, d) => { if (d <= 0 || !CFG.items[k]) return; if (!B.c[k] && !B.seen.includes(k)) fresh.push(k); B.c[k] = (B.c[k] || 0) + d; };
  for (const k in stats.collected) add(k, (stats.collected[k] || 0) - ((base.collected || {})[k] || 0));
  for (const k in stats.produced) add(k, (stats.produced[k] || 0) - ((base.produced || {})[k] || 0));
  for (const k in (stats.golden || {})) {
    const d = stats.golden[k] - ((base.golden || {})[k] || 0); if (d <= 0 || !GOLDEN.includes(k)) continue;
    if (!B.g[k]) fresh.push('gold:' + k);
    B.g[k] = (B.g[k] || 0) + d;
  }
  return fresh;
}

// entries of a page: { id, name, kind, item?, count, got, sub }
export function pageEntries(data, page) {
  const B = data.book;
  if (page === 'crops') return CROPS.map((k) => ({ id: k, name: CFG.items[k].name, kind: 'item', item: k, count: B.c[k] || 0, got: (B.c[k] || 0) > 0 || B.seen.includes(k) }));
  if (page === 'golden') return GOLDEN.map((k) => ({ id: k, name: k === 'fish' ? '金锦鲤' : '金' + CFG.items[k].name, kind: 'gold', item: k, count: B.g[k] || 0, got: (B.g[k] || 0) > 0 }));
  if (page === 'animal') return ANIMALS.map((a) => {
    if (a.pet) { const own = (data.shop.owned || []).some((id) => id.startsWith(a.pet)); return { id: a.id, name: a.name, kind: 'animal', count: 0, got: own, sub: own ? '已领养' : '商店领养' }; }
    const c = B.c[a.item] || 0; return { id: a.id, name: a.name, kind: 'animal', item: a.item, count: c, got: c > 0 || B.seen.includes(a.item) };
  });
  if (page === 'crew') return ROSTER.map((r) => { const m = (data.crew || []).find((x) => x.id === r.id); const c = m ? m.done || 0 : 0; return { id: r.id, name: r.name, kind: 'crew', count: c, got: c > 0, lv: m ? m.lv : 1 }; });
  return [];
}
export function pageProgress(data, page) { const e = pageEntries(data, page); return { got: e.filter((x) => x.got).length, n: e.length }; }
export const pageDone = (data, page) => { const p = pageProgress(data, page); return p.got >= p.n; };
// 金币 / outfit for a finished page (once). Returns the reward or null.
export function claimPage(data, page, itemById) {
  const P = PAGES.find((p) => p.id === page); if (!P || data.book.paid.includes(page) || !pageDone(data, page)) return null;
  data.book.paid.push(page);
  if (P.reward.coins) data.coins = (data.coins || 0) + P.reward.coins;
  if (P.reward.item && itemById(P.reward.item) && !data.shop.owned.includes(P.reward.item)) {
    data.shop.owned.push(P.reward.item); const it = itemById(P.reward.item); if (it.slot) data.shop.eq[it.slot] = it.id;
  }
  return P.reward;
}
export const claimable = (data) => PAGES.filter((p) => !data.book.paid.includes(p.id) && pageDone(data, p.id)).map((p) => p.id);
export function bookTotals(data) { let got = 0, n = 0; for (const p of PAGES) { const q = pageProgress(data, p.id); got += q.got; n += q.n; } return { got, n }; }
