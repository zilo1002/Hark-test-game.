// 商店 (v3.4): a persistent 金币 wallet earned by clearing levels, spent on purely cosmetic
// outfits for the farmer and decorations for the estate. DOM-free (shared with the sims/tests).
import { CFG } from './config.js';
import { currentFestival, FESTIVALS, FEST_IDS } from './festival.js';
import { valleySeason, currentSeason } from './seasons.js';

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
  // v4.0 B 节日限定 (fest: only buyable while that festival is on; owned ones stay)
  { id: 'pumpkinHat', slot: 'hat', name: '南瓜头', price: 260, fest: 'halloween', style: { hat: 'pumpkin' }, sw: ['#F2871E', '#3A2210'] },
  { id: 'santaHat',   slot: 'hat', name: '圣诞帽', price: 260, fest: 'xmas',      style: { hat: 'santa' },   sw: ['#E8283C', '#FFFFFF'] },
  { id: 'lionHat',    slot: 'hat', name: '舞狮帽', price: 320, fest: 'cny',       style: { hat: 'lion' },    sw: ['#E8283C', '#FFC21A'] },
  // v4.0 B 图鉴奖励 (book: the page that gives it; never sold)
  { id: 'bookHat',   slot: 'hat',  name: '图鉴大师帽', price: 0, book: 'crops',  style: { hat: 'scholar' },   sw: ['#2A2A3A', '#FFC21A'] },
  { id: 'goldScarf', slot: 'neck', name: '金穗围巾',   price: 0, book: 'golden', style: { scarf: '#FFC21A' }, sw: ['#FFC21A', '#F29C0E'] },
];
export const SLOTS = [['hat', '帽子'], ['top', '衣服'], ['neck', '围巾'], ['feet', '鞋子']];

// ---- 星星服装 (v5.0.7): bought with stars, not coins. starPrice instead of price;
// a 'top' replaces vest/bow tie (same rule as the coin tops above)
// 星星帽/月亮帽 are the shop's flagships (10★, new hat models in models.js)
export const STAR_OUTFITS = [
  { id: 'starHat',       slot: 'hat',  name: '星星帽',     starPrice: 10, style: { hat: 'star' },                                                                      sw: ['#2A2A5A', '#FFD23F'] },
  { id: 'moonHat',       slot: 'hat',  name: '月亮帽',     starPrice: 10, style: { hat: 'moon' },                                                                      sw: ['#1A1A3A', '#FFD23F'] },
  { id: 'starRain',      slot: 'hat',  name: '雨夜渔夫帽', starPrice: 6,  style: { hat: 'rain', capColor: '#2E6BFF' },                                                 sw: ['#2E6BFF'] },
  { id: 'starCap',       slot: 'hat',  name: '星空棒球帽', starPrice: 6,  style: { hat: 'cap', capColor: '#2A2A3A' },                                                  sw: ['#2A2A3A'] },
  { id: 'starScarf',     slot: 'neck', name: '星光围巾',   starPrice: 5,  style: { scarf: '#FFD23F' },                                                                  sw: ['#FFD23F'] },
  { id: 'starApron',     slot: 'top',  name: '丰收围裙',   starPrice: 6,  style: { vest: null, bowtie: false, shirt: '#FFF6E0', sleeve: '#FFF6E0', apron: '#FF8A3D', apronDot: '#FFD23F' }, sw: ['#FF8A3D', '#FFD23F'] },
  { id: 'starOveralls',  slot: 'top',  name: '星夜背带裤', starPrice: 7,  style: { vest: null, bowtie: false, shirt: '#FFF6E0', sleeve: '#FFF6E0', overalls: '#2A4A8A', pants: '#2A4A8A' },           sw: ['#2A4A8A', '#FFF6E0'] },
  { id: 'starBoots',     slot: 'feet', name: '夜市金靴',   starPrice: 8,  style: { boots: '#E8283C', bootGold: true },                                                   sw: ['#E8283C', '#FFD23F'] },
];

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
  // v4.0 B 节日限定
  { id: 'jackLamp',  name: '南瓜灯',   price: 240, fest: 'halloween' },
  { id: 'xmasTree',  name: '圣诞树',   price: 360, fest: 'xmas' },
  { id: 'redLamps',  name: '红灯笼串', price: 300, fest: 'cny' },
];

// ---- 星星装饰 (v5.0.7): bought with stars; drawn by DECO2D (home.js) on the estate and
// by DECO_PARTS (models.js) in levels / the shop preview; spotted by DECO_SPOTS (home.js)
export const STAR_DECOS = [
  { id: 'starLamp', name: '星星灯', starPrice: 6 },
  { id: 'moonGate', name: '月亮门', starPrice: 8 },
];

// ---- 庄园地图 (v5.0.9): bought with stars, switched on the home screen (never placed as decor).
// A map is a shop item with a `map` field; owned maps live in data.shop.maps (NOT in
// data.shop.owned / data.shop.deco), and homeMap.map must always be one of them.
// `thumb` is an existing deco id used for the shop / tray preview (a map has no 3D model).
export const MAPS = [
  { id: 'mapValley', name: '山谷地图', starPrice: 15, map: 'valley', unlockAfter: 45, icon: '🌾', thumb: 'windmill', desc: '庄园换上山谷的季节' },
  { id: 'mapNight',  name: '夜市地图', starPrice: 20, map: 'night',  unlockAfter: 60, icon: '🏮', thumb: 'lanterns', desc: '夜色庄园，灯笼与摊位' },
];
export const MAP_IDS = MAPS.map((m) => m.map);
export const mapById = (id) => MAPS.find((m) => m.id === id) || null;
export const mapByMap = (map) => MAPS.find((m) => m.map === map) || null;
// a map is buyable only once its area is open (valley after level 45, night market after level 60)
export const mapUnlocked = (data, map) => { const m = mapByMap(map); return !!m && (data.unlocked || 0) >= m.unlockAfter; };
export const mapOwned = (data, map) => Array.isArray(data.shop && data.shop.maps) && data.shop.maps.includes(map);
// the switcher's cycle list, in fixed order: the default estate, every owned map, every collected festival map
export const ownedMapKeys = (data) => {
  const keys = ['default'];
  for (const m of MAPS) if (mapOwned(data, m.map)) keys.push(m.map);
  for (const id of (data.festivalMaps || [])) if (FEST_IDS.includes(id) && !keys.includes(id)) keys.push(id);
  return keys;
};
// which map the home screen is on right now ('default' = 四季庄园, the calendar estate)
export const currentMapKey = (data) => {
  const hm = data.homeMap || {};
  if (hm.mode === 'map' && MAP_IDS.includes(hm.map) && mapOwned(data, hm.map)) return hm.map;
  if (hm.mode === 'festival' && FEST_IDS.includes(hm.festival) && (data.festivalMaps || []).includes(hm.festival)) return hm.festival;
  return 'default';
};
export const nextMapKey = (data) => {
  const keys = ownedMapKeys(data);
  return keys[(keys.indexOf(currentMapKey(data)) + 1) % keys.length];
};
export const mapLabel = (key) => {
  if (key === 'default') return '四季庄园';
  const m = mapByMap(key); if (m) return m.name;
  return FESTIVALS[key] ? FESTIVALS[key].name : key;
};
export const mapIcon = (key) => {
  if (key === 'default') return '🏡';
  const m = mapByMap(key); if (m) return m.icon;
  return FESTIVALS[key] ? FESTIVALS[key].icon : '🗺️';
};
// the estate's display season for the current map (pure; the frame loop and the season badge share it).
// Valley follows the valley's gameplay season; night follows the calendar week (but renders as night).
// Resolved through effectiveHomeMap, so a stale homeMap can never pick a season it does not own.
export const homeSeasonFor = (data) => {
  const hm = effectiveHomeMap(data);
  if (hm.mode === 'season') return hm.season;
  if (hm.mode === 'map' && hm.map === 'valley') return valleySeason(data);
  return currentSeason();
};
// save invariant: a non-default homeMap must point at something the player actually owns;
// anything else falls back to the default estate (calendar). Used by save.load and by the renderers,
// so a stale or hand-edited save can never leave the estate on a map the player does not own.
export const effectiveHomeMap = (data) => {
  const hm = (data.homeMap && typeof data.homeMap === 'object') ? data.homeMap : {};
  const cal = { mode: 'calendar', season: null, festival: null, map: null };
  if (hm.mode === 'season' && Number.isInteger(hm.season) && hm.season >= 0 && hm.season < 4) return { mode: 'season', season: hm.season, festival: null, map: null };
  if (hm.mode === 'festival' && FEST_IDS.includes(hm.festival) && (data.festivalMaps || []).includes(hm.festival)) return { mode: 'festival', season: null, festival: hm.festival, map: null };
  if (hm.mode === 'map' && MAP_IDS.includes(hm.map) && mapOwned(data, hm.map)) return { mode: 'map', season: null, festival: null, map: hm.map };
  return cal;
};

// ---- 宠物 (v4.0 B): a dog that follows the farmer in levels (and now and then fetches a ripe plant
// into the stack) and a cat that lounges on the estate. One of each at a time; colour variants.
export const PETS = [
  { id: 'dogShiba', pet: 'dog', name: '柴犬',   price: 450, col: { body: '#E89A44', belly: '#FFF3DC', ear: '#C8752A', nose: '#2A1A10' }, sw: ['#E89A44', '#FFF3DC'] },
  { id: 'dogWhite', pet: 'dog', name: '小白狗', price: 600, col: { body: '#F7F5EE', belly: '#FFFFFF', ear: '#D9B88A', nose: '#2A1A10', spot: '#5A3A22' }, sw: ['#F7F5EE', '#5A3A22'] },
  { id: 'catOrange', pet: 'cat', name: '橘猫',  price: 300, col: { body: '#F2A040', belly: '#FFF3DC', ear: '#E8823A', nose: '#FF8FA0', stripe: '#D9762A' }, sw: ['#F2A040', '#FFF3DC'] },
  { id: 'catTux',    pet: 'cat', name: '奶牛猫', price: 420, col: { body: '#2E2E36', belly: '#FFFFFF', ear: '#2E2E36', nose: '#FF8FA0' }, sw: ['#2E2E36', '#FFFFFF'] },
];

// ---- 星星宠物 (v5.0.7): colour variants only, no new models; one dog / one cat at a time
export const STAR_PETS = [
  { id: 'dogStar', pet: 'dog', name: '星空柴犬', starPrice: 10, col: { body: '#2A2A5A', belly: '#FFFFFF', ear: '#1A1A3A', nose: '#2A1A10', spot: '#FFD23F' }, sw: ['#2A2A5A', '#FFD23F'] },
  { id: 'catStar', pet: 'cat', name: '玄猫',     starPrice: 8,  col: { body: '#1A1A22', belly: '#2E2E36', ear: '#1A1A22', nose: '#FF8FA0', stripe: '#FFD23F' },            sw: ['#1A1A22', '#FFD23F'] },
];
export const petById = (id) => PETS.find((p) => p.id === id) || STAR_PETS.find((p) => p.id === id) || null;

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

// ---- 星星工装 (v5.0.7): U0 base + style override, no new models; all hired hands wear one set
export const STAR_UNIFORMS = [
  { id: 'u_lantern', uni: true, name: '夜市灯笼工装', starPrice: 8,  style: { ...U0, shirt: '#E8283C', sleeve: '#E8283C', pants: '#2D3A5A', hat: 'cap', capColor: '#FFC21A' }, sw: ['#E8283C', '#FFC21A'] },
  { id: 'u_star',    uni: true, name: '星空工装',     starPrice: 10, style: { ...U0, shirt: '#2A2A5A', sleeve: '#2A2A5A', vest: '#FFD23F', pants: '#2A2A5A', hat: 'beanie', capColor: '#FFD23F' }, sw: ['#2A2A5A', '#FFD23F'] },
];

// all star-shop goods, in shop order (clothes first — Jin asked for clothes — then pets, uniforms, decos, maps)
export const STAR_ITEMS = [...STAR_OUTFITS, ...STAR_PETS, ...STAR_UNIFORMS, ...STAR_DECOS, ...MAPS];
// a star-shop item is one with a starPrice (and no coin price); everything else is a coin item
export const isStar = (it) => !!it && typeof it.starPrice === 'number';
// the default hired-hand look (the gardener) used for the 制服 preview
export const WORKER_BASE = { shirt: '#F7F5EE', overalls: '#3567C8', pants: '#3567C8', hair: '#5A3414', hat: 'straw', sleeve: '#F7F5EE' };
export const uniformStyle = (id) => { const u = UNIFORMS.find((x) => x.id === id) || STAR_UNIFORMS.find((x) => x.id === id); return u ? u.style : null; };

export const itemById = (id) => OUTFITS.find((o) => o.id === id) || STAR_OUTFITS.find((o) => o.id === id) || DECOS.find((d) => d.id === id) || STAR_DECOS.find((d) => d.id === id) || MAPS.find((m) => m.id === id) || UNIFORMS.find((u) => u.id === id) || STAR_UNIFORMS.find((u) => u.id === id) || PETS.find((p) => p.id === id) || STAR_PETS.find((p) => p.id === id);
// a limited item can be bought only while its festival is on; a 图鉴 reward is never sold
export const onSale = (it) => !!it && !it.book && (!it.fest || currentFestival() === it.fest);
export const festName = (it) => (it && it.fest && FESTIVALS[it.fest] ? FESTIVALS[it.fest].name : '');

export function shopDefaults() { return { owned: [], eq: { hat: null, top: null, neck: null, feet: null }, deco: [], uni: null, pet: { dog: null, cat: null }, maps: [] }; }

// normalise whatever is in the save (old saves have nothing; drop unknown ids).
// Maps are tracked ONLY in `maps` (never in owned/deco): a map id that leaked into
// owned/deco (e.g. a hand-edited save) is dropped here, so a map can never be placed as decor.
export function normShop(s) {
  const d = shopDefaults();
  if (!s || typeof s !== 'object') return d;
  d.owned = Array.isArray(s.owned) ? s.owned.filter((id) => { const it = itemById(id); return it && !it.map; }) : [];
  for (const [k] of SLOTS) { const id = s.eq && s.eq[k]; const it = itemById(id); d.eq[k] = it && it.slot === k && d.owned.includes(id) ? id : null; }
  d.deco = Array.isArray(s.deco) ? s.deco.filter((id) => { const it = itemById(id); return it && !it.map && !it.slot && !it.uni && !it.pet && d.owned.includes(id); }) : [];
  d.uni = (() => { const u = itemById(s.uni); return u && u.uni && d.owned.includes(s.uni) ? s.uni : null; })();
  for (const k of ['dog', 'cat']) { const id = s.pet && s.pet[k], p = petById(id); d.pet[k] = p && p.pet === k && d.owned.includes(id) ? id : null; }
  d.maps = Array.isArray(s.maps) ? [...new Set(s.maps.filter((id) => MAP_IDS.includes(id)))] : [];
  return d;
}

// the farmer's look with the equipped outfit pieces applied
export const HERO_BASE = { shirt: '#FFFFFF', vest: '#C8352A', bowtie: true, pants: '#2D3A5A', hair: '#7A3E1D', sleeve: '#FFFFFF' };
export function heroStyle(eq) {
  const st = { ...HERO_BASE };
  for (const [k] of SLOTS) { const it = eq && itemById(eq[k]); if (it && it.slot === k) Object.assign(st, it.style); }
  return st;
}

// star balance (same formula as save.js starsLeft, computed here so shop.js stays
// cycle-free: save.js imports shop.js, so shop.js must not import save.js)
export const starBalance = (data) => Object.values(data.stars || {}).reduce((a, b) => a + (b || 0), 0) - (data.spent || 0);

// buy / equip (pure: mutate the save object, return a result code)
export function buy(data, id) {
  const it = itemById(id); if (!it) return 'unknown';
  if (it.map) {
    // maps: owned in data.shop.maps only (never owned/deco); one purchase, atomic star deduction.
    // The caller Save.saves immediately after 'ok', so a re-entered game can never see a
    // half-bought map or a refunded star balance.
    if (mapOwned(data, it.map)) return 'owned';
    if (!mapUnlocked(data, it.map)) return 'locked';
    if (starBalance(data) < it.starPrice) return 'poor';
    data.spent = (data.spent || 0) + it.starPrice;
    if (!Array.isArray(data.shop.maps)) data.shop.maps = [];
    data.shop.maps.push(it.map);
    return 'ok';
  }
  if (data.shop.owned.includes(id)) return 'owned';
  if (it.book) return 'reward';
  if (!onSale(it)) return 'closed';
  // validate first, mutate once: a failed buy never touches either wallet (atomic in
  // this synchronous flow; the caller Save.saves immediately after 'ok', so a
  // re-entered game can never see a half-bought item or a refunded star balance)
  if (isStar(it)) {
    if (starBalance(data) < it.starPrice) return 'poor';
    data.spent = (data.spent || 0) + it.starPrice;
  } else {
    if ((data.coins || 0) < it.price) return 'poor';
    data.coins -= it.price;
  }
  data.shop.owned.push(id);
  if (it.pet) data.shop.pet[it.pet] = id;
  else if (it.uni) data.shop.uni = id; else if (it.slot) data.shop.eq[it.slot] = id; else if (!data.shop.deco.includes(id)) data.shop.deco.push(id);   // new things go straight on
  return 'ok';
}
export function toggle(data, id) {
  const it = itemById(id); if (!it || !data.shop.owned.includes(id)) return 'locked';
  if (it.map) return 'locked';   // maps are switched on the home screen, never placed / worn
  if (it.pet) { data.shop.pet[it.pet] = data.shop.pet[it.pet] === id ? null : id; return data.shop.pet[it.pet] ? 'on' : 'off'; }
  if (it.uni) { data.shop.uni = data.shop.uni === id ? null : id; return data.shop.uni ? 'on' : 'off'; }
  if (it.slot) { data.shop.eq[it.slot] = data.shop.eq[it.slot] === id ? null : id; return data.shop.eq[it.slot] ? 'on' : 'off'; }
  const i = data.shop.deco.indexOf(id);
  if (i >= 0) { data.shop.deco.splice(i, 1); return 'off'; }
  data.shop.deco.push(id); return 'on';
}
export const isOn = (data, id) => { const it = itemById(id); if (!it || it.map) return false; return it.pet ? data.shop.pet[it.pet] === id : it.uni ? data.shop.uni === id : it.slot ? data.shop.eq[it.slot] === id : data.shop.deco.includes(id); };
export const levelsTotal = () => CFG.levels.length;
