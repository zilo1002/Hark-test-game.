// One saved pet choice must drive every scene; switching dog→cat replaces, never adds.
import assert from 'node:assert/strict';
import { PETS, STAR_PETS, petById, itemById, shopDefaults, normShop, toggle, equippedPets } from '../js/shop.js';
import { World } from '../js/world.js';
import * as Models from '../js/models.js';
import * as THREE from '../vendor/three.module.min.js';

const listed = [...PETS, ...STAR_PETS];
const ids = listed.map(p => p.id);

// Every shop pet, including the mottled cat with its separate palette, must resolve to a
// volumetric Three.js model (not an image/sprite/billboard standing in for the animal).
for (const item of listed) {
  const model = Models.makePet(item.pet, item.col);
  const expectedSpecies = ({ penguin: 'penguin', hedgehog: 'hedgehog', rabbit: 'rabbit', fox: 'fox', owl: 'owl' })[item.col.dollRole] || item.pet;
  assert.equal(model.kind, expectedSpecies, `${item.id}: correct 3D species`);
  let meshes = 0, sprites = 0, volumetric = 0, bodyPalettePresent = false;
  model.root.traverse(node => {
    if (node.isSprite) sprites++;
    if (!node.isMesh) return;
    meshes++;
    node.geometry.computeBoundingBox();
    const size = node.geometry.boundingBox.getSize(new THREE.Vector3());
    if (size.x > 0.01 && size.y > 0.01 && size.z > 0.01) volumetric++;
    const material = Array.isArray(node.material) ? node.material : [node.material];
    if (material.some(m => m.color && `#${m.color.getHexString().toLowerCase()}` === item.col.body.toLowerCase())) bodyPalettePresent = true;
  });
  assert.ok(meshes >= 20, `${item.id}: detailed mesh model (${meshes} meshes)`);
  assert.ok(volumetric >= 10, `${item.id}: solid depth geometry (${volumetric} volumetric meshes)`);
  assert.equal(sprites, 0, `${item.id}: no sprite/billboard actor`);
  if (item.id === 'catMottled') assert.equal(bodyPalettePresent, true, 'mottled cat uses its dark coat palette, not the owl-white palette');
}
assert.equal(new Set(ids).size, ids.length, 'shop pet catalog IDs are unique');
for (const duplicate of ['dogPlush', 'catPlush']) {
  assert.equal(PETS.some(p => p.id === duplicate), false, `${duplicate}: duplicate listing hidden`);
  assert.equal(itemById(duplicate)?.legacy, true, `${duplicate}: legacy saves still resolve`);
}

function sceneInputs(saved) {
  const selected = equippedPets({ shop: normShop(JSON.parse(JSON.stringify(saved))) });
  // These values are exactly what main.js feeds to the farm World and home mesh overlay.
  return {
    home: selected.active,
    farm: {
      dog: selected.active?.pet === 'dog' ? 'dog' : null,
      companion: selected.active && selected.active.pet !== 'dog' && !selected.active.col.shoulder
        ? { kind: selected.active.pet, id: selected.active.id, col: selected.active.col } : null,
      shoulderOwl: !!selected.active?.col?.shoulder,
    },
  };
}

for (const item of listed) {
  const data = { shop: { ...shopDefaults(), owned: ids.slice() } };
  assert.equal(toggle(data, item.id), 'on', `${item.id}: equip`);
  assert.equal(data.shop.pet.active, item.id, `${item.id}: unique current selection saved`);
  const { home, farm } = sceneInputs(data.shop);
  assert.equal(home?.id, item.id, `${item.id}: homepage resolves saved pet`);
  assert.equal(Number(!!farm.dog) + Number(!!farm.companion) + Number(farm.shoulderOwl), 1, `${item.id}: farm renders only one pet presentation`);
  if (item.pet === 'dog') assert.equal(farm.dog, 'dog', `${item.id}: dog retains fetch follower`);
  else if (item.col.shoulder) assert.equal(farm.shoulderOwl, true, `${item.id}: owl attaches to character`);
  else assert.equal(farm.companion?.id, item.id, `${item.id}: matching follower reaches farm`);
  const reloaded = normShop(JSON.parse(JSON.stringify(data.shop)));
  assert.deepEqual(reloaded.pet, { active: item.id, dog: item.pet === 'dog' ? item.id : null, cat: item.pet === 'cat' ? item.id : null }, `${item.id}: persists through reload`);
  assert.equal(toggle(data, item.id), 'off', `${item.id}: unequip`);
  assert.equal(equippedPets(data).active, null, `${item.id}: homepage and farm both become empty`);
}

const switching = { shop: { ...shopDefaults(), owned: ids.slice() } };
assert.equal(toggle(switching, 'dogWhite'), 'on');
assert.equal(sceneInputs(switching.shop).home?.id, 'dogWhite');
assert.equal(toggle(switching, 'catMottled'), 'on');
const afterSwitch = sceneInputs(switching.shop);
assert.equal(afterSwitch.home?.id, 'catMottled', 'homepage selects new cat');
assert.equal(afterSwitch.farm.dog, null, 'replaced dog is not separately spawned');
assert.equal(afterSwitch.farm.companion?.id, 'catMottled', 'farm companion is the new cat');
assert.equal(afterSwitch.farm.shoulderOwl, false);
const reopened = sceneInputs(normShop(JSON.parse(JSON.stringify(switching.shop))));
assert.equal(reopened.home?.id, 'catMottled', 're-entering home uses persisted cat');
assert.equal(reopened.farm.companion?.id, 'catMottled', 're-entering farm uses same persisted cat');

// Legacy saves could contain two slots. Normalize once to one active pet; no two-pet scene survives.
const legacy = normShop({ owned: ['dogWhite', 'catOrange'], pet: { dog: 'dogWhite', cat: 'catOrange' } });
assert.equal(legacy.pet.active, 'catOrange');
assert.equal(legacy.pet.dog, null);
assert.equal(legacy.pet.cat, 'catOrange');
assert.equal(Number(!!equippedPets({ shop: legacy }).dog) + Number(!!equippedPets({ shop: legacy }).cat), 1);
console.log(`PASS pet selection/sync: ${ids.length} listed pets, duplicate SKUs hidden, all persist, dog→cat replaces on home/farm/reload`);
