// Regression coverage for the shared character/pet models used by both gameplay and shop previews.
import assert from 'node:assert/strict';
import * as M from '../js/models.js';
import * as THREE from '../vendor/three.module.min.js';
import {
  OUTFITS, STAR_OUTFITS, UNIFORMS, STAR_UNIFORMS, PETS, STAR_PETS,
  HERO_BASE, WORKER_BASE, heroStyle, shopDefaults, buy, toggle, normShop, petById, itemById, equippedPets,
} from '../js/shop.js';
import { World } from '../js/world.js';

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
  assert.equal(data.shop.pet.active, item.id, `${item.id}: equips as the single active pet`);
  assert.equal(data.shop.pet[item.pet], item.id, `${item.id}: compatibility alias matches active species`);
  assert.equal(data.shop.pet[item.pet === 'dog' ? 'cat' : 'dog'], null, `${item.id}: cannot equip a second pet`);
  assert.equal(toggle(data, item.id), 'off', `${item.id}: existing equip toggle still works`);
  assert.equal(data.shop.pet.active, null, `${item.id}: toggle off clears the single active pet`);
}

// Every visible character/pet must be a volumetric mesh, never a sprite, textured billboard or cutout.
function assertTrue3D(root, label) {
  const bounds = checkBounds(root, label), size = bounds.getSize(new THREE.Vector3());
  assert.ok(size.x > 1 && size.y > 1 && size.z > 1, `${label}: nonzero depth as well as width/height`);
  let meshes = 0;
  root.traverse(node => {
    assert.equal(node.isSprite, undefined, `${label}: no sprite billboard`);
    if (node.isMesh) {
      meshes++;
      for (const mat of (Array.isArray(node.material) ? node.material : [node.material])) {
        assert.equal(mat?.map || null, null, `${label}: mesh material has no image texture`);
      }
      assert.ok(node.geometry?.attributes?.position?.count > 0, `${label}: real geometry vertices`);
    }
  });
  assert.ok(meshes > 5, `${label}: composed from multiple 3D meshes`);
}
const person3d = M.makePerson(heroStyle({}, 'girl'));
assertTrue3D(person3d.root, 'girl character');
const owl3d = M.makePerson({ ...heroStyle({}, 'girl'), owlCompanion: true });
assertTrue3D(owl3d.root, 'shoulder owl and farmer');
for (const item of pets) assertTrue3D(M.makePet(item.pet, item.col).root, `pet ${item.id}`);

// The former catPlush and catMottled shared the same cutout role, so only one stays in the catalog.
assert.equal(PETS.some(x => x.id === 'catPlush'), false, 'duplicate tortoiseshell cat removed from shop catalogue');
assert.equal(itemById('catPlush')?.legacy, true, 'old catPlush save remains readable');
assert.equal(buy({ coins: 10000, stars: {}, spent: 0, unlocked: 0, shop: shopDefaults() }, 'catPlush'), 'retired', 'legacy duplicate cannot be rebought');
assert.equal(PETS.some(x => x.id === 'dogPlush'), false, 'duplicate white-dog SKU removed from catalogue');
assert.equal(itemById('dogPlush')?.legacy, true, 'old dogPlush save remains readable');
assert.equal(buy({ coins: 10000, stars: {}, spent: 0, unlocked: 0, shop: shopDefaults() }, 'dogPlush'), 'retired', 'legacy dog duplicate cannot be rebought');
const legacy = normShop({ owned: ['dogPlush'], pet: { dog: 'dogPlush' } });
assert.deepEqual(legacy.pet, { active: 'dogPlush', dog: 'dogPlush', cat: null }, 'legacy dog equip migrates into single active selection');
assert.equal(petById(legacy.pet.active)?.pet, 'dog', 'legacy equipped dog retains dog behavior');
const legacyCat = normShop({ owned: ['catPlush'], pet: { cat: 'catPlush' } });
assert.equal(equippedPets({ shop: legacyCat }).active?.id, 'catPlush', 'legacy cat equip remains loadable');

assert.equal(heroStyle({}, 'boy').dollRole, 'boy', 'boy farmer uses the matching doll template');
assert.equal(heroStyle({}, 'girl').dollRole, 'farmer', 'girl farmer template remains the default');

// A newly selected cat replaces the dog, and the single normalized selection drives the farm.
const switching = { coins: 99999, stars: { test: 100 }, spent: 0, unlocked: 80, shop: { ...shopDefaults(), owned: pets.map(p => p.id) } };
assert.equal(toggle(switching, 'dogWhite'), 'on');
assert.equal(equippedPets(switching).dog?.id, 'dogWhite');
assert.equal(toggle(switching, 'catMottled'), 'on');
const reloaded = normShop(JSON.parse(JSON.stringify(switching.shop)));
const active = equippedPets({ shop: reloaded });
assert.equal(active.active?.id, 'catMottled');
assert.equal(active.dog, null, 'cat selection removes old dog from the active state');
assert.equal(active.cat?.id, 'catMottled');
const farm = new World(0, { pet: active.dog ? 'dog' : null, companion: { kind: active.active.pet, id: active.active.id, col: active.active.col }, quiet: true, seed: 19 });
assert.equal(farm.dog, null, 'farm does not spawn the replaced dog');
assert.equal(farm.companion?.id, 'catMottled', 'farm uses the newly equipped cat');

for (const item of pets) {
  const one = { shop: { ...shopDefaults(), owned: pets.map(p => p.id), pet: { active: item.id, dog: item.pet === 'dog' ? item.id : null, cat: item.pet === 'cat' ? item.id : null } } };
  const selected = equippedPets({ shop: normShop(JSON.parse(JSON.stringify(one.shop))) });
  const companion = selected.active && selected.active.pet !== 'dog' && !selected.active.col.shoulder
    ? { kind: selected.active.pet, id: selected.active.id, col: selected.active.col } : null;
  const world = new World(0, { pet: selected.active?.pet === 'dog' ? 'dog' : null, companion, quiet: true, seed: 19 });
  if (item.pet === 'dog') assert.equal(world.dog?.state, 'follow', `${item.id}: dog retains follow/fetch behavior`);
  else if (item.col.shoulder) assert.equal(world.companion, null, `${item.id}: shoulder owl is not duplicated as a follower`);
  else assert.equal(world.companion?.id, item.id, `${item.id}: farm uses selected species`);
}

// Simultaneous equipped slots remain composable (shop preview and live player use this exact style).
const combo = heroStyle({ hat: outfits.find((x) => x.slot === 'hat')?.id, top: outfits.find((x) => x.slot === 'top')?.id,
  neck: outfits.find((x) => x.slot === 'neck')?.id, feet: outfits.find((x) => x.slot === 'feet')?.id });
checkBounds(M.makePerson(combo).root, 'combined equipped outfit');
assert.deepEqual(heroStyle({}), HERO_BASE, 'base style remains available');
console.log(`PASS shared character redesign: ${count.outfits} outfits, ${count.uniforms} uniforms, ${count.pets} listed pets; purchase/equip behavior preserved`);
