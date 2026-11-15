// Every crop newly introduced in levels 68–75 needs its own physical carryable 3D item.
// Render3D creates item meshes only from ITEM_TYPES; an unregistered item vanishes from stacks.
import { CFG } from '../js/config.js';
import * as M from '../js/models.js';
import assert from 'node:assert/strict';

const crops = [...new Set(CFG.levels.slice(67, 75)
  .flatMap((level) => level.objects.filter((o) => o.type === 'field').map((o) => o.crop)))];
assert(crops.includes('rubber'), `levels 68–75 should include the rubber crop: ${crops.join(', ')}`);
for (const crop of crops) {
  assert(M.ITEM_TYPES.includes(crop), `${crop} must have a registered physical item mesh`);
  const geo = M.itemGeo(crop);
  assert(geo.attributes.position.count > 0, `${crop} item geometry must contain vertices`);
}
const rubber = M.itemGeo('rubber').attributes.position.array;
const egg = M.itemGeo('egg').attributes.position.array;
assert(rubber.length !== egg.length || rubber.some((v, i) => v !== egg[i]), 'rubber must not fall back to the egg model');
console.log(`harvest item render check: PASS · levels 68–75 crops ${crops.join(', ')} all have physical item meshes`);
