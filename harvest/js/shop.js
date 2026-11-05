// 商店 (v3.4): a persistent 金币 wallet earned by clearing levels, spent on purely cosmetic
// outfits for the farmer and decorations for the estate. DOM-free (shared with the sims/tests).
import { CFG } from './config.js';

// ---- how 金币 are earned -------------------------------------------------------------------
// every clear: 10 + 2% of what the level earned + 10 per star of this run;
// first time a star is earned on a level: +20 per new star.
// (balance sim, skilled bot, first clears 1–30 at 3★: ≈ 100–350 per level, ≈ 5,800 in all;
//  a replay pays ≈ 70–300, so the expensive pieces are worth coming back for)
export const COIN = { base: 10, earnShare: 0.02, perStar: 10, newStar: 20, migratePerStar: 40, migratePerLevel: 30 };
export function levelCoins(earned, stars, newStars) {
  return Math.round(COIN.base + Math.max(0, earned) * COIN.earnShare + stars * COIN.perStar + Math.max(0, newStars) * COIN.newStar);
}
// a save from before v3.4 starts with coins for the progress it already has
export function migrateCoins(totalStars, cleared) { return totalStars * COIN.migratePerStar + cleared * COIN.migratePerLevel; }

// ---- 服装: slots hat / top / neck / feet. style = overrides on the farmer's look ------------------
// (the default look is the white shirt + red vest + bow tie gardener; a 'top' replaces vest/bow tie)
export const OUTFITS = [
  { id: 'straw',    slot: 'hat',  name: '草帽',     price: 50,   style: { hat: 'straw' },                      sw: ['#F2CF6B', '#C8352A'] },
  { id: 'bootsY',   slot: 'feet', name: '小黄雨靴', price: 60,   style: { boots: '#FFC21A' },                  sw: ['#FFC21A'] },
  { id: 'overallB', slot: 'top',  name: '蓝背带裤', price: 80,   style: { vest: null, bowtie: false, shirt: '#FFF6E0', sleeve: '#FFF6E0', overalls: '#3567C8', pants: '#3567C8' }, sw: ['#3567C8', '#FFF6E0'] },
  { id: 'beanie',   slot: 'hat',  name: '毛线帽',   price: 90,   style: { hat: 'beanie', capColor: '#3BA7FF' }, sw: ['#3BA7FF', '#FFFFFF'] },
  { id: 'scarfR',   slot: 'neck', name: '红围巾',   price: 100,  style: { scarf: '#E8283C' },                  sw: ['#E8283C'] },
  { id: 'flowerC',  slot: 'hat',  name: '花环',     price: 140,  style: { hat: 'flower' },                     sw: ['#FF8FB0', '#FFE16B', '#FFFFFF'] },
  { id: 'overallP', slot: 'top',  name: '粉背带裤', price: 160,  style: { vest: null, bowtie: false, shirt: '#FFFFFF', sleeve: '#FFFFFF', overalls: '#FF7FAE', pants: '#FF7FAE' }, sw: ['#FF7FAE', '#FFFFFF'] },
  { id: 'bootsR',   slot: 'feet', name: '红皮靴',   price: 180,  style: { boots: '#C8352A' },                  sw: ['#C8352A'] },
  { id: 'cowboy',   slot: 'hat',  name: '牛仔帽',   price: 220,  style: { hat: 'cowboy' },                     sw: ['#A0622D', '#5A3414'] },
  { id: 'apron',    slot: 'top',  name: '碎花围裙', price: 260,  style: { vest: null, bowtie: false, shirt: '#FFE58A', sleeve: '#FFE58A', apron: '#FFFFFF', apronDot: '#FF6F92' }, sw: ['#FFE58A', '#FF6F92'] },
  { id: 'chef',     slot: 'hat',  name: '厨师帽',   price: 300,  style: { hat: 'chef' },                       sw: ['#FFFFFF', '#E6E6E6'] },
  { id: 'scarfRb',  slot: 'neck', name: '彩虹围巾', price: 420,  style: { scarf: 'rainbow' },                  sw: ['#FF4D4D', '#FFD23F', '#4CD08A', '#3BA7FF'] },
  { id: 'overallG', slot: 'top',  name: '森林绿工装', price: 480, style: { vest: null, bowtie: false, shirt: '#F2E8D0', sleeve: '#F2E8D0', overalls: '#3E9A4A', pants: '#3E9A4A' }, sw: ['#3E9A4A', '#F2E8D0'] },
  { id: 'bowRed',   slot: 'hat',  name: '大蝴蝶结', price: 520,  style: { hat: 'bow' },                        sw: ['#FF4D6D'] },
  { id: 'tux',      slot: 'top',  name: '金色礼服', price: 1200, style: { vest: '#E8B21E', bowtie: true, bowColor: '#7A3E9D', shirt: '#FFFFFF', sleeve: '#FFFFFF', pants: '#3A2A5A' }, sw: ['#E8B21E', '#7A3E9D'] },
  { id: 'bootsG',   slot: 'feet', name: '金靴子',   price: 1500, style: { boots: '#FFC21A', bootGold: true },  sw: ['#FFE16B', '#E8B21E'] },
  { id: 'crown',    slot: 'hat',  name: '金皇冠',   price: 2400, style: { hat: 'crown' },                      sw: ['#FFC21A', '#E8283C'] },
];
export const SLOTS = [['hat', '帽子'], ['top', '衣服'], ['neck', '围巾'], ['feet', '鞋子']];

// ---- 装饰: shown on the home estate (both pages) and outside the fence in every level ------------
export const DECOS = [
  { id: 'bench',     name: '木长椅',   price: 60 },
  { id: 'lanterns',  name: '红灯笼',   price: 90 },
  { id: 'scarecrow', name: '稻草人',   price: 120 },
  { id: 'flowerbed', name: '花坛',     price: 160 },
  { id: 'pond',      name: '小池塘',   price: 260 },
  { id: 'swing',     name: '秋千',     price: 340 },
  { id: 'arch',      name: '花拱门',   price: 420 },
  { id: 'windmill',  name: '彩色风车', price: 560 },
  { id: 'fountain',  name: '大喷泉',   price: 800 },
  { id: 'balloon',   name: '热气球',   price: 1300 },
  { id: 'statue',    name: '金色雕像', price: 2000 },
  { id: 'rainbow',   name: '彩虹桥',   price: 2800 },
];

// ---- 制服 (v3.6): one set at a time, worn by every hired worker in levels -----------------------
// style overrides the worker's own look (gardener / carter / lumberjack / milker); beards stay.
const U0 = { vest: null, overalls: null, apron: null, bowtie: false };
export const UNIFORMS = [
  { id: 'u_red',    uni: true, name: '红色工装', price: 120, style: { ...U0, shirt: '#E8452C', sleeve: '#E8452C', pants: '#2D3A5A', hat: 'cap', capColor: '#FFFFFF' }, sw: ['#E8452C', '#FFFFFF'] },
  { id: 'u_green',  uni: true, name: '绿背带裤', price: 180, style: { ...U0, shirt: '#FFF6E0', sleeve: '#FFF6E0', overalls: '#3E9A4A', pants: '#3E9A4A', hat: 'straw' }, sw: ['#3E9A4A', '#F2CF6B'] },
  { id: 'u_yellow', uni: true, name: '明黄雨衣', price: 240, style: { ...U0, shirt: '#FFC21A', sleeve: '#FFC21A', pants: '#3567C8', hat: 'beanie', capColor: '#FFC21A' }, sw: ['#FFC21A', '#3567C8'] },
  { id: 'u_pink',   uni: true, name: '粉色围裙', price: 320, style: { ...U0, shirt: '#FFFFFF', sleeve: '#FFFFFF', apron: '#FF8FB0', apronDot: '#FFFFFF', pants: '#FF7FAE', hat: 'flower' }, sw: ['#FF8FB0', '#FFFFFF'] },
  { id: 'u_navy',   uni: true, name: '海军条纹', price: 450, style: { ...U0, shirt: '#FFFFFF', sleeve: '#FFFFFF', vest: '#2A4C9A', pants: '#2A4C9A', scarf: '#E8283C', hat: 'cap', capColor: '#2A4C9A' }, sw: ['#2A4C9A', '#E8283C'] },
  { id: 'u_gold',   uni: true, name: '金牌大师', price: 800, style: { ...U0, shirt: '#FFF6E0', sleeve: '#FFF6E0', vest: '#E8B21E', bowtie: true, bowColor: '#C8352A', pants: '#5A3414', hat: 'cowboy' }, sw: ['#E8B21E', '#C8352A'] },
];
// the default hired-hand look (the gardener) used for the 制服 preview
export const WORKER_BASE = { shirt: '#F7F5EE', overalls: '#3567C8', pants: '#3567C8', hair: '#5A3414', hat: 'straw', sleeve: '#F7F5EE' };
export const uniformStyle = (id) => { const u = UNIFORMS.find((x) => x.id === id); return u ? u.style : null; };

export const itemById = (id) => OUTFITS.find((o) => o.id === id) || DECOS.find((d) => d.id === id) || UNIFORMS.find((u) => u.id === id);

export function shopDefaults() { return { owned: [], eq: { hat: null, top: null, neck: null, feet: null }, deco: [], uni: null }; }

// normalise whatever is in the save (old saves have nothing; drop unknown ids)
export function normShop(s) {
  const d = shopDefaults();
  if (!s || typeof s !== 'object') return d;
  d.owned = Array.isArray(s.owned) ? s.owned.filter((id) => itemById(id)) : [];
  for (const [k] of SLOTS) { const id = s.eq && s.eq[k]; const it = OUTFITS.find((o) => o.id === id); d.eq[k] = it && it.slot === k && d.owned.includes(id) ? id : null; }
  d.deco = Array.isArray(s.deco) ? s.deco.filter((id) => DECOS.some((x) => x.id === id) && d.owned.includes(id)) : [];
  d.uni = UNIFORMS.some((u) => u.id === s.uni) && d.owned.includes(s.uni) ? s.uni : null;
  return d;
}

// the farmer's look with the equipped outfit pieces applied
export const HERO_BASE = { shirt: '#FFFFFF', vest: '#C8352A', bowtie: true, pants: '#2D3A5A', hair: '#7A3E1D', sleeve: '#FFFFFF' };
export function heroStyle(eq) {
  const st = { ...HERO_BASE };
  for (const [k] of SLOTS) { const it = eq && OUTFITS.find((o) => o.id === eq[k]); if (it) Object.assign(st, it.style); }
  return st;
}

// buy / equip (pure: mutate the save object, return a result code)
export function buy(data, id) {
  const it = itemById(id); if (!it) return 'unknown';
  if (data.shop.owned.includes(id)) return 'owned';
  if ((data.coins || 0) < it.price) return 'poor';
  data.coins -= it.price; data.shop.owned.push(id);
  if (it.uni) data.shop.uni = id; else if (it.slot) data.shop.eq[it.slot] = id; else if (!data.shop.deco.includes(id)) data.shop.deco.push(id);   // new things go straight on
  return 'ok';
}
export function toggle(data, id) {
  const it = itemById(id); if (!it || !data.shop.owned.includes(id)) return 'locked';
  if (it.uni) { data.shop.uni = data.shop.uni === id ? null : id; return data.shop.uni ? 'on' : 'off'; }
  if (it.slot) { data.shop.eq[it.slot] = data.shop.eq[it.slot] === id ? null : id; return data.shop.eq[it.slot] ? 'on' : 'off'; }
  const i = data.shop.deco.indexOf(id);
  if (i >= 0) { data.shop.deco.splice(i, 1); return 'off'; }
  data.shop.deco.push(id); return 'on';
}
export const isOn = (data, id) => { const it = itemById(id); return !!it && (it.uni ? data.shop.uni === id : it.slot ? data.shop.eq[it.slot] === id : data.shop.deco.includes(id)); };
export const levelsTotal = () => CFG.levels.length;
