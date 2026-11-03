// 存档：localStorage，自动存档 + 离线收益
import { SAVE_KEY, OFFLINE_CAP_SEC } from './config.js';
import { createState, freshRuntime } from './state.js';
import { resetWorkerJobs } from './workers.js';
import { simulate } from './game.js';

export function save(s) {
  try {
    s.savedAt = Date.now();
    const { rt, ...data } = s;
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) { return false; }
}

// 合并缺省字段，兼容旧存档
function merge(base, data) {
  for (const k in data) {
    if (data[k] && typeof data[k] === 'object' && !Array.isArray(data[k]) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) merge(base[k], data[k]);
    else base[k] = data[k];
  }
  return base;
}

export function load() {
  let raw = null;
  try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { /* 隐私模式 */ }
  if (!raw) return { state: createState(), fresh: true };
  try {
    const data = JSON.parse(raw);
    const s = merge(createState(), data);
    s.rt = freshRuntime();
    resetWorkerJobs(s);
    return { state: s, fresh: false };
  } catch (e) {
    return { state: createState(), fresh: true };
  }
}

export function applyOffline(s, now = Date.now()) {
  const away = Math.max(0, (now - (s.savedAt || now)) / 1000);
  const secs = Math.min(OFFLINE_CAP_SEC, away);
  if (secs < 1) return null;
  const sum = simulate(s, secs);
  s.rt.fx = [];
  s.rt.income = [];
  s.savedAt = now;
  return { ...sum, away, capped: away > OFFLINE_CAP_SEC };
}

export function wipe() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
}
