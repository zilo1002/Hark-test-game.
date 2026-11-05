// localStorage save with a graceful in-memory fallback (private mode, blocked storage, file://).
import { CFG } from './config.js';
import { shopDefaults, normShop, migrateCoins } from './shop.js';
import { crewDefaults, normCrew } from './crew.js';
import { ordersDefaults, normOrders } from './orders.js';
import { dailyDefaults, normDaily } from './daily.js';
import { bookDefaults, normBook, backfill } from './book.js';

let memory = null;
let storage = null;
try {
  const s = window.localStorage, k = '__bh_probe__';
  s.setItem(k, '1'); s.removeItem(k); storage = s;
} catch (_) { storage = null; }

export const storageAvailable = () => !!storage;

export function defaults() {
  return { v: CFG.version, stars: {}, unlocked: 0, spent: 0, restored: [], restoredAt: {}, settings: { sound: true, vib: true }, cur: null, played: false, coins: 0, shop: shopDefaults(), crew: crewDefaults(), orders: ordersDefaults(), daily: dailyDefaults(), book: { ...bookDefaults(), filled: true } };
}

export function load() {
  let raw = null;
  try { raw = storage ? storage.getItem(CFG.saveKey) : memory; } catch (_) { raw = memory; }
  if (!raw) return defaults();
  try {
    const d = JSON.parse(raw);
    const base = defaults();
    if (!d || typeof d !== 'object') return base;
    const out = { ...base, ...d, settings: { ...base.settings, ...(d.settings || {}) }, stars: d.stars || {}, restored: Array.isArray(d.restored) ? d.restored : [] };
    // v3.4 商店: saves from before the shop get 金币 for the stars and levels they already have;
    // everything else in the save is kept as it was
    if (typeof d.coins !== 'number' || !isFinite(d.coins)) out.coins = migrateCoins(totalStars(out), Math.min(out.unlocked || 0, CFG.levels.length));
    out.coins = Math.max(0, Math.floor(out.coins));
    out.shop = normShop(d.shop);
    // v3.6: 雇工 roster and 订单板 (older saves start with a fresh Lv1 crew and today's orders)
    out.crew = normCrew(d.crew); out.orders = normOrders(d.orders);
    // v4.0: 每日挑战 records (older saves start empty); an unknown in-progress env is simply re-rolled
    out.daily = normDaily(d.daily);
    // v4.0 B: 图鉴 (older saves are back-filled once from their cleared levels and the 雇工 records)
    out.book = normBook(d.book); backfill(out);
    if (out.cur && typeof out.cur !== 'object') out.cur = null;
    return out;
  } catch (_) { return defaults(); }
}

export function save(data) {
  const raw = JSON.stringify(data);
  memory = raw;
  try { if (storage) storage.setItem(CFG.saveKey, raw); } catch (_) { /* quota or blocked: keep memory copy */ }
}

export function wipe() {
  memory = null;
  try { if (storage) storage.removeItem(CFG.saveKey); } catch (_) { /* ignore */ }
}

export function totalStars(d) { return Object.values(d.stars).reduce((a, b) => a + (b || 0), 0); }
export function starsLeft(d) { return totalStars(d) - (d.spent || 0); }
