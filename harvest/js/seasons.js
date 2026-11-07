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

// v4.6 四季山谷: there the player picks the season (saved in data.valley.season; first visit = this week's season)
export const isValleyLi = (li) => !!CFG.valley && li >= CFG.valley.from && li < CFG.valley.from + CFG.valley.n;
export const valleyOpen = (data) => !!CFG.valley && (data.unlocked || 0) >= CFG.valley.unlockAfter;
export function valleySeason(data) { const s = data && data.valley && data.valley.season; return Number.isInteger(s) ? s : currentSeason(); }
// the three crops of a season in the valley (and their products), for the switcher
export function valleyCrops(s) { const L = CFG.valley.lines[s]; return ['A', 'B', 'C'].map((k) => L[k].crop); }
