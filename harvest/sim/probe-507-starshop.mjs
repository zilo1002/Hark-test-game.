// Probe: star shop (v5.0.7) purchase flow — tables, buy/owned/poor, shared star wallet,
// normShop round-trip, hero/uniform/pet lookups, coin regression, and the new 3D models.
//   node sim/probe-507-starshop.mjs   (exit code 1 on any failure)
import { STAR_ITEMS, STAR_OUTFITS, STAR_PETS, STAR_UNIFORMS, STAR_DECOS, itemById, isStar, buy, toggle, isOn, normShop, heroStyle, uniformStyle, petById, starBalance } from '../js/shop.js';
import { defaults, totalStars, starsLeft } from '../js/save.js';
import * as M from '../js/models.js';
import { DECO_SPOTS } from '../js/home.js';
import { readFileSync } from 'node:fs';

let fails = 0;
const check = (name, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); if (!cond) fails++; };

// a save with N stars (spread over levels, 3 each) and 10,000 coins
const fresh = (stars = 180) => {
  const d = defaults(); d.stars = {}; let left = stars;
  for (let li = 0; li < 60 && left > 0; li++) { const s = Math.min(3, left); d.stars[li] = s; left -= s; }
  d.spent = 0; d.coins = 10000; return d;
};

// ---- 1. tables ---------------------------------------------------------------
check('star tables: 8 outfits + 2 pets + 2 uniforms + 2 decos = 14 items', STAR_ITEMS.length === 14 && STAR_OUTFITS.length === 8 && STAR_PETS.length === 2 && STAR_UNIFORMS.length === 2 && STAR_DECOS.length === 2, `got ${STAR_ITEMS.length}`);
const total = STAR_ITEMS.reduce((a, x) => a + x.starPrice, 0);
check('star total is 108', total === 108, `got ${total}`);
check('every star item 5–10 stars, unique id, found by itemById, isStar, no coin price',
  STAR_ITEMS.every((it) => it.starPrice >= 5 && it.starPrice <= 10 && itemById(it.id) === it && isStar(it) && typeof it.price !== 'number')
  && new Set(STAR_ITEMS.map((x) => x.id)).size === 14);
check('flagships starHat/moonHat are 10 stars', itemById('starHat').starPrice === 10 && itemById('moonHat').starPrice === 10);
check('coin items are not star items', !isStar(itemById('straw')) && itemById('straw').price === 50);

// ---- 2. buy a star outfit -----------------------------------------------------
const d = fresh(180);
check('start: 180 stars, 0 spent', totalStars(d) === 180 && starsLeft(d) === 180 && starBalance(d) === 180);
let r = buy(d, 'starHat');
check('buy starHat -> ok', r === 'ok', `got ${r}`);
check('spent 10, starsLeft 170 (shop + save agree)', d.spent === 10 && starsLeft(d) === 170 && starBalance(d) === 170, `spent=${d.spent} left=${starsLeft(d)}`);
check('owned + equipped in hat slot', d.shop.owned.includes('starHat') && d.shop.eq.hat === 'starHat' && isOn(d, 'starHat'));
check('heroStyle applies the star hat', heroStyle(d.shop.eq).hat === 'star');
r = buy(d, 'starHat');
check('buy starHat again -> owned, no double deduction', r === 'owned' && d.spent === 10, `got ${r} spent=${d.spent}`);
r = buy(d, 'moonHat');
check('buy moonHat -> ok, replaces starHat in the slot', r === 'ok' && d.spent === 20 && d.shop.eq.hat === 'moonHat' && heroStyle(d.shop.eq).hat === 'moon');
r = toggle(d, 'moonHat');
check('toggle moonHat off', r === 'off' && d.shop.eq.hat === null && !isOn(d, 'moonHat'));
r = toggle(d, 'moonHat');
check('toggle moonHat back on', r === 'on' && d.shop.eq.hat === 'moonHat');

// ---- 3. pet / uniform / deco --------------------------------------------------
r = buy(d, 'dogStar');
check('buy dogStar -> ok, pet set', r === 'ok' && d.shop.pet.dog === 'dogStar' && petById('dogStar').pet === 'dog' && d.spent === 30, `got ${r}`);
r = buy(d, 'u_star');
check('buy u_star -> ok, uniform set', r === 'ok' && d.shop.uni === 'u_star' && uniformStyle('u_star').hat === 'beanie' && d.spent === 40, `got ${r}`);
r = buy(d, 'starLamp');
check('buy starLamp -> ok, deco placed', r === 'ok' && d.shop.deco.includes('starLamp') && d.spent === 46, `got ${r}`);
r = buy(d, 'moonGate');
check('buy moonGate -> ok', r === 'ok' && d.shop.deco.includes('moonGate') && d.spent === 54, `got ${r}`);

// ---- 4. poor / exact balance / never negative ---------------------------------
const poor = fresh(5);
r = buy(poor, 'starHat');
check('5 stars, buy 10-star hat -> poor, nothing changes', r === 'poor' && poor.spent === 0 && poor.shop.owned.length === 0, `got ${r}`);
const exact = fresh(10);
r = buy(exact, 'starHat');
check('exactly 10 stars, buy 10-star hat -> ok, balance 0', r === 'ok' && starsLeft(exact) === 0);
r = buy(exact, 'starScarf');
check('0 stars left, buy 5-star scarf -> poor, spent stays 10', r === 'poor' && exact.spent === 10 && starsLeft(exact) === 0, `got ${r}`);
check('unknown id -> unknown', buy(fresh(), 'no-such-item') === 'unknown');

// ---- 5. shared wallet: a star buy also shrinks the manor budget ---------------
const shared = fresh(180);
buy(shared, 'starHat');
check('manor sees the same spent counter (127-star manor would have 10 fewer to spend)', starsLeft(shared) === 170, `left=${starsLeft(shared)}`);

// ---- 6. normShop round-trip (save/load) keeps star goods ----------------------
const saved = JSON.parse(JSON.stringify(d));
const back = normShop(saved.shop);
check('round-trip keeps owned star items', ['starHat', 'moonHat', 'dogStar', 'u_star', 'starLamp', 'moonGate'].every((id) => back.owned.includes(id)), `owned=${back.owned.join(',')}`);
check('round-trip keeps equipped star hat + pet + uniform + decos', back.eq.hat === 'moonHat' && back.pet.dog === 'dogStar' && back.uni === 'u_star' && back.deco.includes('starLamp') && back.deco.includes('moonGate'));
const junk = normShop({ owned: ['starHat', 'dogStar', 'u_star', 'starLamp', 'bogus-id'], eq: { hat: 'starHat', top: 'bogus-id' }, deco: ['starLamp', 'bogus-id'], uni: 'u_star', pet: { dog: 'dogStar', cat: 'bogus-id' } });
check('normShop drops unknown ids but keeps star goods', junk.owned.includes('starHat') && !junk.owned.includes('bogus-id') && junk.eq.hat === 'starHat' && junk.eq.top === null && junk.deco.includes('starLamp') && junk.uni === 'u_star' && junk.pet.dog === 'dogStar' && junk.pet.cat === null);

// ---- 7. coin purchases untouched ----------------------------------------------
const coins = fresh(180);
r = buy(coins, 'straw');
check('buy coin hat straw -> ok, coins 9950, stars untouched', r === 'ok' && coins.coins === 9950 && coins.spent === 0 && starsLeft(coins) === 180, `got ${r} coins=${coins.coins}`);

// ---- 8. new 3D models ---------------------------------------------------------
let hatOk = false, moonOk = false;
try { const p = M.makePerson({ hat: 'star' }); hatOk = !!p && !!p.root && p.root.children.length > 0; } catch (e) { console.log('  star hat error:', e.message); }
try { const p = M.makePerson({ hat: 'moon' }); moonOk = !!p && !!p.root && p.root.children.length > 0; } catch (e) { console.log('  moon hat error:', e.message); }
check('makePerson star hat builds', hatOk);
check('makePerson moon hat builds', moonOk);
const lampGeo = M.decoGeo('starLamp'), gateGeo = M.decoGeo('moonGate'), benchGeo = M.decoGeo('bench');
const verts = (g) => (g.attributes && g.attributes.position ? g.attributes.position.count : 0);
check('decoGeo starLamp is a real model (not the bench fallback)', lampGeo !== benchGeo && verts(lampGeo) > 0, `verts=${verts(lampGeo)}`);
check('decoGeo moonGate is a real model (not the bench fallback)', gateGeo !== benchGeo && verts(gateGeo) > 0, `verts=${verts(gateGeo)}`);
check('decoGeo caches (same object twice)', M.decoGeo('starLamp') === lampGeo);

// ---- 9. estate spots + 2D draw functions --------------------------------------
check('DECO_SPOTS has starLamp + moonGate', Array.isArray(DECO_SPOTS.starLamp) && Array.isArray(DECO_SPOTS.moonGate), JSON.stringify(DECO_SPOTS.starLamp));
const homeSrc = readFileSync(new URL('../js/home.js', import.meta.url), 'utf8');
check('DECO2D has starLamp + moonGate draw functions', homeSrc.includes('starLamp(g, t)') && homeSrc.includes('moonGate(g)'));
check('decoHat draws star + moon hats on the estate farmer', homeSrc.includes("h === 'star'") && homeSrc.includes("h === 'moon'"));

console.log(fails === 0 ? '\nALL STAR SHOP CHECKS PASS' : `\n${fails} CHECK(S) FAILED`);
process.exit(fails === 0 ? 0 : 1);
