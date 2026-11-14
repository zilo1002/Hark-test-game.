// v5.1.9 probe: initial machines are pre-built — Jin: 现有的机器不用花金币，也不用框解锁.
// The initial (farm-fed) machine of a starting crop is built at t=0: no unlock frame,
// machine + processed stand (+ PS for the first machine) visible from the start.
// A chained second-stage machine (M2), a machine for a later crop (hidden source),
// and a field+machine bundled tile all keep their tile + coin price.
//   node sim/probe-519-machine-prebuilt.mjs
import { CFG } from '../js/config.js';
import { World } from '../js/world.js';

let bad = 0;
let nPrebuilt = 0, nM2 = 0, nLater = 0, nBundled = 0, nFree = 0;
const check = (name, ok, extra = '') => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${extra}`); if (!ok) bad++; };
const srcOf = (rawObjs, item) => rawObjs.filter((o) => (o.type === 'field' && o.crop === item) || (o.type === 'coop' && o.item === item));

for (let li = 0; li < CFG.levels.length; li++) {
  const raw = CFG.levels[li];
  const w = new World(li, { quiet: true, seed: 1 });
  const rawProcs = raw.objects.filter((o) => o.type === 'proc');
  const procs = w.procs;
  for (const rp of rawProcs) {
    const wp = procs.find((p) => p.id === rp.id);
    if (!wp) continue; // food levels drop procs outside FOOD_OUTPUTS
    const chained = rawProcs.some((q) => q.outTo === rp.id);
    const srcVisible = srcOf(raw.objects, rp.in).some((o) => !o.hidden);
    const tile = w.tiles.find((t) => t.effect && t.effect.show && t.effect.show.includes(rp.id));
    if (!tile) { check(`L${li + 1} ${rp.id}: has a machine tile`, false); continue; }
    if (chained) {
      nM2++;
      // M2 is gated by its tile + coin price. (In food levels the M2 model itself is
      // visible in config — hidden=false — but its output stand is hidden until the
      // tile is bought, so it cannot produce usable goods before purchase.)
      const stand = (w.stands || []).find((s) => s.id === `P_${rp.out}`);
      check(`L${li + 1} ${rp.id} M2: tile price>0, not prebuilt, output stand hidden`, tile.price > 0 && !tile.prebuilt && !tile.done && (!stand || stand.hidden), ` price=${tile.price} standHidden=${stand ? stand.hidden : '-'}`);
    } else if (!srcVisible) {
      nLater++;
      check(`L${li + 1} ${rp.id} later-crop: tile price>0, machine hidden, not prebuilt`, tile.price > 0 && wp.hidden && !tile.prebuilt && !tile.done, ` price=${tile.price}`);
    } else {
      const bundled = tile.effect.show.some((id) => raw.objects.some((o) => o.id === id && (o.type === 'field' || o.type === 'coop')));
      if (bundled) {
        nBundled++;
        check(`L${li + 1} ${rp.id} bundled: price>0, not prebuilt`, tile.price > 0 && !tile.prebuilt, ` price=${tile.price}`);
      } else if (rp.hidden) {
        // Initial by source but hidden in config: NOT pre-built — it keeps its
        // (free, v5.1.3) frame, which is how the player reveals it.
        nFree++;
        check(`L${li + 1} ${rp.id} free-frame: price 0, not prebuilt, machine hidden`, tile.price === 0 && !tile.prebuilt && !tile.done && wp.hidden, ` price=${tile.price}`);
      } else if (raw.foodLines) {
        // Food levels do NOT pre-build (v5.1.9): the player is the main
        // collector, and the free tile paces the early cash. Same free frame.
        nFree++;
        check(`L${li + 1} ${rp.id} free-frame (food): price 0, not prebuilt`, tile.price === 0 && !tile.prebuilt && !tile.done, ` price=${tile.price}`);
      } else {
        nPrebuilt++;
        const stand = (w.stands || []).find((s) => s.id === `P_${rp.out}`);
        check(`L${li + 1} ${rp.id} prebuilt: machine+stand visible, tile done, no frame`, !wp.hidden && (!stand || !stand.hidden) && tile.prebuilt && tile.done && tile.bought === 1 && !tile.visible, ` hidden=${wp.hidden} standHidden=${stand ? stand.hidden : '-'} tileDone=${tile.done} visible=${tile.visible}`);
      }
    }
  }
  // PS (processed counter) is visible iff the first machine is pre-built.
  const ps = (w.counters || []).find((c) => c.id === 'PS');
  if (ps && procs.length) {
    const firstTile = w.tiles.find((t) => t.effect && t.effect.show && t.effect.show.includes(procs[0].id));
    check(`L${li + 1}: PS visible iff first machine prebuilt`, ps.hidden === !firstTile?.prebuilt, ` psHidden=${ps.hidden} firstPrebuilt=${!!firstTile?.prebuilt}`);
  }
  // No visible free machine frame anywhere (the v5.1.3 0-price frame must be gone).
  const freeFrame = w.tiles.filter((t) => t.visible && t.price <= 0 && t.effect && t.effect.show && t.effect.show.some((id) => procs.some((p) => p.id === id)));
  check(`L${li + 1}: no visible free machine frame`, freeFrame.length === 0, freeFrame.length ? ` ${freeFrame.map((t) => t.id).join(',')}` : '');
  // The guide arrow must point at a real, purchasable frame — never a prebuilt/done tile.
  const g = w.guide();
  if (g && g.kind === 'tile') check(`L${li + 1}: guide points at a real visible frame`, g.obj.visible && !g.obj.done && !g.obj.prebuilt, ` tile=${g.obj.id}`);
}

// Old-save compat: a v5.1.3 save that bought the (then price-0) machine tile, and one
// that had not bought it yet, must both load cleanly — the machine is pre-built in
// either case and must not be built twice.
{
  const li = 14; // L15 — three starting machines, all pre-built
  const mk = () => new World(li, { quiet: true, seed: 1 });
  const probe = mk();
  const preTile = probe.tiles.find((t) => t.prebuilt);
  const machId = preTile.effect.show[0];
  const nProcs = probe.procs.length;
  const base = probe.snapshot();
  // (a) old save: machine tile bought in v5.1.3
  const saveBought = JSON.parse(JSON.stringify(base));
  saveBought.tiles.find((t) => t.id === preTile.id).bought = 1;
  const wA = mk();
  let threw = false;
  try { wA.restore(saveBought); } catch (e) { threw = true; console.log('  restore(bought) threw:', e.message); }
  check('old save (machine bought): restore ok, machine visible, no duplicate', !threw && wA.procs.length === nProcs && wA.procs.some((p) => p.id === machId && !p.hidden) && wA.tiles.find((t) => t.id === preTile.id).done);
  // (b) old save: machine tile NOT bought in v5.1.3
  const saveNot = JSON.parse(JSON.stringify(base));
  saveNot.tiles.find((t) => t.id === preTile.id).bought = 0;
  const wB = mk();
  threw = false;
  try { wB.restore(saveNot); } catch (e) { threw = true; console.log('  restore(not-bought) threw:', e.message); }
  check('old save (machine NOT bought): restore ok, machine pre-built visible', !threw && wB.procs.some((p) => p.id === machId && !p.hidden) && wB.tiles.find((t) => t.id === preTile.id).done);
}

console.log(`\nprebuilt=${nPrebuilt} freeFrame=${nFree} M2=${nM2} laterCrop=${nLater} bundled=${nBundled}  ${bad ? `FAILURES=${bad}` : 'ALL PASS'}`);
process.exit(bad ? 1 : 0);
