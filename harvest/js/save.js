// localStorage save with a graceful in-memory fallback (private mode, blocked storage, file://).
import { CFG } from './config.js';

let memory = null;
let storage = null;
try {
  const s = window.localStorage, k = '__bh_probe__';
  s.setItem(k, '1'); s.removeItem(k); storage = s;
} catch (_) { storage = null; }

export const storageAvailable = () => !!storage;

export function defaults() {
  return { v: CFG.version, stars: {}, unlocked: 0, spent: 0, restored: [], restoredAt: {}, settings: { sound: true, vib: true }, cur: null, played: false };
}

export function load() {
  let raw = null;
  try { raw = storage ? storage.getItem(CFG.saveKey) : memory; } catch (_) { raw = memory; }
  if (!raw) return defaults();
  try {
    const d = JSON.parse(raw);
    const base = defaults();
    if (!d || typeof d !== 'object') return base;
    return { ...base, ...d, settings: { ...base.settings, ...(d.settings || {}) }, stars: d.stars || {}, restored: Array.isArray(d.restored) ? d.restored : [] };
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
