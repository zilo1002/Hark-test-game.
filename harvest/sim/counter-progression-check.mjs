// Verify the counter progression and automatic worker routing across every level.
// Before a sellable processed-goods machine unlocks, a processing level has one ordinary counter.
// The machine unlock reveals both category counters; the porter hire starts automatic tray delivery.
import { CFG } from '../js/config.js';
import { World } from '../js/world.js';

let errors = 0, processing = 0, ordinaryOnly = 0;
const fail = (level, msg) => { errors++; console.error(`FAIL 第${level}关 ${CFG.levels[level - 1].name}: ${msg}`); };
const visible = (w) => w.counters.filter((c) => !c.hidden);
function buyReadyExcept(w, id) {
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const t of w.tiles) if (t.visible && !t.done && t.id !== id) {
      w.completeTile(t, true); progressed = true;
    }
  }
}

for (let i = 0; i < CFG.levels.length; i++) {
  if (CFG.levels[i].foodLines) continue;   // v4.9.9: food levels have a dedicated processed counter + tally clerk (not a porter); food-levels-check covers that flow
  const w = new World(i, { quiet: true, seed: 173 + i }), L = w.L, label = i + 1;
  const initial = visible(w), terminal = w.procs.filter((p) => p.pile);   // v4.9.7: a terminal machine's pile lives on its processed board (outObj is the stand, not a counter)
  if (!terminal.length) {
    ordinaryOnly++;
    if (w.counters.some((c) => c.sale2)) fail(label, 'non-processing level has a processed counter');
    buyReadyExcept(w, '__no-processor__');
    continue;
  }
  processing++;
  const raw = w.counters.find((c) => !c.sale2), goods = w.counters.find((c) => c.sale2);
  if (!raw || !goods) { fail(label, 'missing ordinary or generated processed counter'); continue; }
  const made = new Set(terminal.map((p) => p.outItem));
  const firstMachine = terminal[0];
  // v5.1.9: a pre-built first machine is unlocked from t=0, so its processed
  // counter is visible from t=0 too — that is the unlock, not a leak. The
  // check below only requires PS hidden when the first machine still needs
  // its unlock tile. NOTE: PS is revealed by the first machine overall
  // (procs[0]), not the first terminal machine — in a chain level the first
  // terminal machine is M2 (chained, never pre-built), but PS is still
  // revealed because M1 is pre-built.
  const firstProc = w.procs[0];
  const prebuiltFirst = firstProc && w.tiles.some((t) => t.prebuilt && t.effect?.show?.includes(firstProc.id));
  if (prebuiltFirst) {
    if (initial.length !== 2 || !initial.includes(raw) || !initial.includes(goods) || goods.hidden) fail(label, 'pre-built first machine should reveal the processed counter at start');
  } else if (initial.length !== 1 || initial[0] !== raw || !goods.hidden) fail(label, 'processed counter is visible before processing unlock');
  if (raw.items.some((item) => made.has(item))) fail(label, 'processed goods appear on ordinary counter before unlock');
  if (w.tiles.some((t) => t.id === 'x_ps')) fail(label, 'processed counter still requires a separate paid purchase');
  const machineUnlock = w.tiles.find((t) => t.effect?.show?.includes(firstMachine.id));
  const unlock = w.tiles.find((t) => t.effect?.worker?.porter && t.effect.worker.to.includes(goods.id));
  if (!machineUnlock) fail(label, 'first terminal machine has no unlock tile');
  if (!unlock) fail(label, 'first processed-goods porter hire is missing');
  if (!machineUnlock || !unlock) continue;

  buyReadyExcept(w, unlock.id);
  if (!unlock.visible) fail(label, 'could not unlock first terminal machine in generated purchase flow');
  w.completeTile(machineUnlock, true);
  if (firstMachine.hidden) fail(label, 'first terminal machine did not unlock');
  if (visible(w).length !== 2 || goods.hidden) fail(label, 'both category counters did not appear with first machine unlock');
  if (!unlock.done) w.completeTile(unlock, true);
  if (goods.hidden) fail(label, 'processed counter became hidden after porter hire');

  if ([...made].some((item) => !goods.items.includes(item))) fail(label, 'processed counter missing terminal product');
  if (raw.items.some((item) => made.has(item))) fail(label, 'terminal processed goods remain on ordinary counter');
  for (const t of w.tiles) {
    const role = t.effect?.worker;
    if (!role) continue;
    if (role.porter && (!role.to.includes(goods.id) || role.to.includes(raw.id))) fail(label, `${t.id} porter not routed only to processed counter`);
    if (role.raw && (!role.to.includes(raw.id) || role.to.includes(goods.id))) fail(label, `${t.id} raw carrier not routed only to ordinary counter`);
  }
}
// Legacy in-progress saves stored counters by position only. When two ordinary stands merge,
// their different crops must survive and be restored to the single current counter.
const legacy = new World(10, { quiet: true, seed: 29 }); // L11 used to split eggs and potatoes
legacy.restore({ li: 10, t: 12, money: 0, tiles: [], stack: [], cash: [11, 17],
  stock: [['egg', 'egg'], ['potato', 'potato']], buf: [], ponds: [] });
const migratedStock = legacy.counters.flatMap((c) => c.stock);
const migratedCash = legacy.counters.reduce((sum, c) => sum + c.cash, 0);
if (!migratedStock.includes('egg') || !migratedStock.includes('potato')) fail(11, 'legacy counter inventory did not migrate');
if (migratedCash !== 28) fail(11, `legacy counter cash did not migrate intact (${migratedCash})`);
const currentSave = legacy.snapshot();
if (!Array.isArray(currentSave.counterIds) || !Array.isArray(currentSave.counterItems)) fail(11, 'new snapshot lacks counter identity metadata');
// An older one-counter processing level saved raw and processed stock together; split it
// between today's ordinary and processed counters without dropping either kind.
const legacyProcessing = new World(31, { quiet: true, seed: 30 }); // L32, formerly one shared counter
legacyProcessing.restore({ li: 31, t: 12, money: 0, tiles: [], stack: [], cash: [0],
  stock: [['wheat', 'bread']], buf: [], ponds: [] });
const rawDesk = legacyProcessing.counters.find((c) => !c.sale2), productDesk = legacyProcessing.counters.find((c) => c.sale2);
if (!rawDesk?.stock.includes('wheat') || !productDesk?.stock.includes('bread')) fail(32, 'legacy mixed counter stock did not split to the matching desks');

console.log(`counter progression: ${errors ? `${errors} failures` : 'PASS'} · ${processing} processing levels audited · ${ordinaryOnly} ordinary-only levels audited · legacy save migration audited`);
if (errors) process.exitCode = 1;
