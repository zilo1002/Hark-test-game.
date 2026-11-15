// Decoration placement/storage regression checks: repeat coin buys create instances,
// old saves migrate, storage can restore, only stored coin decorations sell at half price.
import assert from 'node:assert/strict';
import * as Shop from '../js/shop.js';
import { DECO_SPOTS } from '../js/home.js';

for (const id of [...Shop.DECOS, ...Shop.STAR_DECOS].map(x => x.id)) {
  assert.ok(DECO_SPOTS[id], `${id} has an estate position and can be selected on the map`);
}
const d = { shop: Shop.shopDefaults(), coins: 1000, stars: { earned: 100 }, spent: 0, unlocked: 60 };
assert.equal(Shop.buy(d, 'bench'), 'ok');
assert.equal(Shop.buy(d, 'bench'), 'ok', 'coin decorations can be purchased repeatedly');
assert.equal(d.shop.decoInstances.filter(x => x.id === 'bench').length, 2);
const [first, second] = d.shop.decoInstances;
assert.equal(Shop.moveDeco(d, first.uid, 120, 220), true);
assert.equal(first.x, 120); assert.equal(first.y, 220);
assert.equal(Shop.storeDeco(d, first.uid), true);
assert.equal(first.stored, true);
assert.deepEqual(Shop.sellStoredDeco(d, first.uid), { ok: true, amount: 30 });
assert.equal(d.coins, 910, 'purchase price 60 is deducted before the 30-coin sale');
assert.equal(d.shop.owned.includes('bench'), true, 'one remaining copy keeps ownership');
assert.equal(Shop.storeDeco(d, second.uid), true);
assert.deepEqual(Shop.sellStoredDeco(d, second.uid), { ok: true, amount: 30 });
assert.equal(d.shop.owned.includes('bench'), false, 'last sold copy clears ownership');
assert.equal(Shop.sellStoredDeco(d, second.uid).ok, false, 'sold copy cannot pay twice');
assert.equal(Shop.buy(d, 'starLamp'), 'ok');
const star = d.shop.decoInstances.find(x => x.id === 'starLamp');
assert.equal(Shop.storeDeco(d, star.uid), true);
assert.deepEqual(Shop.sellStoredDeco(d, star.uid), { ok: false, amount: 0 }, 'star decor is not sellable');
const legacyShop = Shop.normShop({ owned: ['bench'], deco: ['bench'] });
const legacy = { shop: legacyShop };
assert.equal(legacyShop.decoInstances.length, 1);
assert.equal(legacyShop.decoInstances[0].stored, false);
assert.equal(Shop.placeDeco(legacy, legacyShop.decoInstances[0].uid), false, 'already placed legacy item cannot be double placed');
assert.equal(Shop.storeDeco(legacy, legacyShop.decoInstances[0].uid), true);
assert.equal(Shop.placeDeco(legacy, legacyShop.decoInstances[0].uid), true, 'stored legacy item can be placed again');
console.log('decoration warehouse checks: PASS · all decor clickable · repeated coin buys · move/store/place/sell · 50% refund · star decor protected · legacy save migration');
