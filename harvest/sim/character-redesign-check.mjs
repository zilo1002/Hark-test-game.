// Regression coverage for the shared character/pet models used by both gameplay and shop previews.
import assert from 'node:assert/strict';
import * as M from '../js/models.js';
import * as THREE from '../vendor/three.module.min.js';
import {
  OUTFITS, STAR_OUTFITS, UNIFORMS, STAR_UNIFORMS, PETS, STAR_PETS,
  HERO_BASE, WORKER_BASE, heroStyle, shopDefaults, buy, toggle,
} from '../js/shop.js';

const outfits = [...OUTFITS, ...STAR_OUTFITS];
const uniforms = [...UNIFORMS, ...STAR_UNIFORMS];
const pets = [...PETS, ...STAR_PETS];
const count = { outfits: 0, uniforms: 0, pets: 0 };
function checkBounds(root, label) {
  root.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(root);
  assert.ok(Number.isFinite(b.min.x) && Number.isFinite(b.max.y) && Number.isFinite(b.max.z), `${label}: finite bounds`);
  assert.ok(b.max.y > b.min.y, `${label}: positive height`);
  return b;
}

// Every shop outfit is resolved through the same heroStyle + makePerson route as gameplay.
for (const item of outfits) {
  const style = heroStyle({ [item.slot]: item.id });
  const pp = M.makePerson(style);
  assert.ok(pp.head.scale.x >= 1.3 && pp.head.scale.y >= 1.3, `${item.id}: shared chibi head proportions are applied`);
  const b = checkBounds(pp.root, `outfit ${item.id}`);
  assert.ok(b.max.y - b.min.y > 30 && b.max.y - b.min.y < 65, `${item.id}: person stays within expected silhouette`);
  M.posePerson(pp, { t: 1, walk: 0.7, moving: true, carry: false, seed: 1 });
  count.outfits++;
}

// Every worker uniform is instantiated with its complete override on the shared person model.
for (const item of uniforms) {
  const pp = M.makePerson({ ...WORKER_BASE, ...item.style });
  checkBounds(pp.root, `uniform ${item.id}`);
  M.posePerson(pp, { t: 1, walk: 0.7, moving: true, carry: true, seed: 2 });
  count.uniforms++;
}

// All coin/star pets use the same catalogue colour object and shared preview/game model path.
for (const item of pets) {
  const pp = M.makePet(item.pet, item.col);
  checkBounds(pp.root, `pet ${item.id}`);
  M.posePet(pp, { t: 1, walk: 0.7, moving: true, sit: item.pet === 'dog', lounge: item.pet === 'cat' });
  count.pets++;

  // Preserve the existing purchase/redemption price and equip flow for each pet.
  const data = { coins: 100000, stars: { test: 100 }, spent: 0, unlocked: 80, shop: shopDefaults() };
  const beforeCoins = data.coins, beforeSpent = data.spent;
  assert.equal(buy(data, item.id), 'ok', `${item.id}: remains purchasable`);
  assert.equal(data.coins, beforeCoins - (item.price || 0), `${item.id}: coin redemption unchanged`);
  assert.equal(data.spent, beforeSpent + (item.starPrice || 0), `${item.id}: star redemption unchanged`);
  assert.equal(data.shop.pet[item.pet], item.id, `${item.id}: equips into its existing pet slot`);
  assert.equal(toggle(data, item.id), 'off', `${item.id}: existing equip toggle still works`);
  assert.equal(data.shop.pet[item.pet], null, `${item.id}: existing unequip behavior still works`);
}

// Simultaneous equipped slots remain composable (shop preview and live player use this exact style).
const combo = heroStyle({ hat: outfits.find((x) => x.slot === 'hat')?.id, top: outfits.find((x) => x.slot === 'top')?.id,
  neck: outfits.find((x) => x.slot === 'neck')?.id, feet: outfits.find((x) => x.slot === 'feet')?.id });
checkBounds(M.makePerson(combo).root, 'combined equipped outfit');
assert.deepEqual(heroStyle({}), HERO_BASE, 'base style remains available');
console.log(`PASS shared character redesign: ${count.outfits} outfits, ${count.uniforms} uniforms, ${count.pets} pets; purchase/equip behavior preserved`);
