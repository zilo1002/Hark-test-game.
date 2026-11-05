// v4.0 B 节日活动 (DOM-free, shared with the tests).
// Festivals follow the local calendar date (the same dates for everyone). While one is on, its
// scenery shows in every level and on the estate, a banner on the home panel counts the days left, and
// its limited 商店 items can be bought. Owned limited items stay forever. ?debug can force one.
import { today } from './orders.js';

// lunar new year (正月初一), for the 春节 window (±7 days)
const LNY = ['2026-02-17', '2027-02-06', '2028-01-26', '2029-02-13', '2030-02-03', '2031-01-23', '2032-02-11', '2033-01-31', '2034-02-19', '2035-02-08'];

export const FESTIVALS = {
  halloween: { id: 'halloween', name: '万圣节', icon: '🎃', md: [[10, 25], [11, 7]], desc: '南瓜灯点亮田野' },
  xmas:      { id: 'xmas',      name: '圣诞节', icon: '🎄', md: [[12, 18], [1, 2]],  desc: '下雪啦，圣诞树亮起来' },
  cny:       { id: 'cny',       name: '春节',   icon: '🏮', lunar: 7,             desc: '挂起红灯笼，舞狮贺新春' },
};
export const FEST_IDS = Object.keys(FESTIVALS);

const day0 = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const DAY = 86400000;
const diff = (a, b) => Math.round((day0(b) - day0(a)) / DAY);   // calendar days from a to b
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };

// the window [start, end] (inclusive dates) of festival f that contains d, or null
function windowFor(f, d) {
  const y = d.getFullYear();
  if (f.lunar) {
    for (const s of LNY) { const c = parse(s), a = new Date(c.getTime() - f.lunar * DAY), b = new Date(c.getTime() + f.lunar * DAY); if (diff(a, d) >= 0 && diff(d, b) >= 0) return [day0(a), day0(b)]; }
    return null;
  }
  const [[m0, d0], [m1, d1]] = f.md;
  for (const yy of [y - 1, y]) {   // a window may run over new year (圣诞 Dec 18 → Jan 2)
    const a = new Date(yy, m0 - 1, d0), b = new Date(m1 < m0 ? yy + 1 : yy, m1 - 1, d1);
    if (diff(a, d) >= 0 && diff(d, b) >= 0) return [a, b];
  }
  return null;
}

let forced = null;
export function forceFestival(id) { forced = id === null || id === undefined ? null : FESTIVALS[id] ? id : null; return forced; }

// { id, name, icon, desc, left: days left including today, end: 'YYYY-MM-DD', forced } or null
export function festivalInfo(d = new Date()) {
  if (forced) { const f = FESTIVALS[forced], w = windowFor(f, d); return { ...f, left: w ? diff(d, w[1]) + 1 : 7, end: w ? today(w[1]) : '', forced: true }; }
  for (const id of FEST_IDS) { const f = FESTIVALS[id], w = windowFor(f, d); if (w) return { ...f, left: diff(d, w[1]) + 1, end: today(w[1]), forced: false }; }
  return null;
}
export const currentFestival = () => { const f = festivalInfo(); return f ? f.id : null; };
// the next festival that starts after d (for the shop note): { id, name, inDays }
export function nextFestival(d = new Date()) {
  let best = null;
  for (let k = 1; k <= 400 && !best; k++) { const x = new Date(d.getTime() + k * DAY); for (const id of FEST_IDS) if (windowFor(FESTIVALS[id], x) && !windowFor(FESTIVALS[id], new Date(x.getTime() - DAY))) { best = { id, name: FESTIVALS[id].name, inDays: k }; break; } }
  return best;
}
export { windowFor };
