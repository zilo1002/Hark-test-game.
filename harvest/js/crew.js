// 雇工 (v3.6): a persistent roster of named hired hands. The workers you hire inside a level are
// these people (rotating by level, so everyone gets work). Each has one 特长 that grows with
// their 等级 (Lv1 +5% → Lv10 +30%), and earns XP for every item they deliver in a level.
// DOM-free: shared with the sims.

export const TRAITS = {
  quick:  { name: '快手', desc: '割得更快、装卸更快' },
  strong: { name: '大力', desc: '一次背得更多' },
  steady: { name: '稳重', desc: '走得更快、少卡顿' },
  handy:  { name: '勤快', desc: '走路和背量各加一半' },
};
export const ROSTER = [
  { id: 'afu',     name: '阿福', trait: 'quick' },
  { id: 'xiaoman', name: '小满', trait: 'strong' },
  { id: 'tiezhu',  name: '铁柱', trait: 'steady' },
  { id: 'chunni',  name: '春妮', trait: 'handy' },
  { id: 'dazhuang',name: '大壮', trait: 'strong' },
  { id: 'qiuyue',  name: '秋月', trait: 'quick' },
];
export const CREW = { maxLv: 10, b1: 0.05, b10: 0.30, xpK: 250 };

// bonus fraction of a member's 特长 at a level
export const traitBonus = (lv) => CREW.b1 + (CREW.b10 - CREW.b1) * (Math.max(1, Math.min(CREW.maxLv, lv)) - 1) / (CREW.maxLv - 1);
// XP to go from lv → lv+1 (items delivered): 250, 1000, 2250 … 20250 (≈ 71k to Lv10)
export const xpNeed = (lv) => CREW.xpK * lv * lv;

// multipliers on a worker's stats for a member at a level (all ≥ 1, at most +30%)
export function crewMul(trait, lv) {
  const b = traitBonus(lv), m = { speed: 1, cap: 1, rate: 1, reach: 1 };
  if (trait === 'quick') { m.rate = 1 + b; m.reach = 1 + b * 0.5; }
  else if (trait === 'strong') m.cap = 1 + b;
  else if (trait === 'steady') m.speed = 1 + b;
  else if (trait === 'handy') { m.speed = 1 + b / 2; m.cap = 1 + b / 2; }
  return m;
}

export function crewDefaults() { return ROSTER.map((r) => ({ id: r.id, lv: 1, xp: 0, done: 0 })); }
export function normCrew(c) {
  const d = crewDefaults();
  if (!Array.isArray(c)) return d;
  for (const m of d) {
    const s = c.find((x) => x && x.id === m.id); if (!s) continue;
    m.lv = Math.max(1, Math.min(CREW.maxLv, Math.floor(+s.lv || 1)));
    m.xp = Math.max(0, Math.floor(+s.xp || 0)); m.done = Math.max(0, Math.floor(+s.done || 0));
    if (m.lv >= CREW.maxLv) m.xp = 0;
  }
  return d;
}
// who works the i-th hire slot of level li
export const memberFor = (li, i) => ROSTER[(li + i) % ROSTER.length];
// the crew a level gets: [{ id, name, trait, lv, mul }] by hire slot
export function levelCrew(crew, li, slots = 6) {
  const out = [];
  for (let i = 0; i < slots; i++) {
    const r = memberFor(li, i), s = (crew || []).find((x) => x.id === r.id) || { lv: 1 };
    out.push({ id: r.id, name: r.name, trait: r.trait, lv: s.lv, mul: crewMul(r.trait, s.lv) });
  }
  return out;
}
// add XP to a member; returns the number of levels gained
export function addXp(crew, id, n) {
  const m = crew.find((x) => x.id === id); if (!m || n <= 0) return 0;
  m.done += n; let up = 0;
  if (m.lv >= CREW.maxLv) return 0;
  m.xp += n;
  while (m.lv < CREW.maxLv && m.xp >= xpNeed(m.lv)) { m.xp -= xpNeed(m.lv); m.lv++; up++; }
  if (m.lv >= CREW.maxLv) m.xp = 0;
  return up;
}
