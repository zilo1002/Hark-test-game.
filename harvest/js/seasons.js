// v4.0 四季与天气 (DOM-free, shared with the tests).
// The season follows the real calendar: one season per real week, 春→夏→秋→冬 (a full year every
// 4 weeks, the same for every player, like the daily orders). ?debug can force one.
import { CFG } from './config.js';

let forced = null;
export function forceSeason(s) { forced = Number.isInteger(s) && s >= 0 && s < 4 ? s : null; }

function dayIndex(d) {
  const [y, m, dd] = CFG.season.epoch;
  const a = new Date(y, m, dd), b = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((b - a) / 86400000);   // calendar days (DST-safe)
}
// { i: 0–3, name: '春', full: '春天', crops: [...], day: 1–7 (day of this season), left: days until it changes }
export function seasonInfo(d = new Date()) {
  const D = CFG.season.days, k = dayIndex(d);
  const w = Math.floor(k / D), day = k - w * D;
  const i = forced !== null ? forced : ((w % 4) + 4) % 4;
  const S = CFG.seasons[i];
  return { i, id: S.id, name: S.name, full: S.full, crops: S.crops, day: day + 1, left: D - day, forced: forced !== null };
}
export const currentSeason = () => seasonInfo().i;

// a normal level run is rainy 1 time in 5 (level 1 never: it is the tutorial)
export function rollRain(li, r = Math.random) { return li > 0 && r() < CFG.rain.chance; }

export const cropNames = (list) => list.map((c) => (CFG.items[c] ? CFG.items[c].name : c));
