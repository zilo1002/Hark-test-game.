// v4.2 二次加工 second counter (DOM-free, shared with the sims).
// v4.3: NOTHING is free in a machine level. At the start there is only the raw counter; every machine, the 「加工品」
// counter (id PS), its 店员, two raw carriers (fields → raw counter), two 加工品 porters (trays → PS), a 收银升级 per
// counter and a per-machine upgrade path are buyable tiles generated here from each level's layout.
// Levels that only sold machine goods (7 / 9 / 19) now open with a raw counter too, so the first coins come from raw sales.
// v4.9.7: the output tray is gone. In every level with a processing machine, the machine's goods
// heap up on a flat wooden board (P_<goods>) next to the machine, and the 加工品搬运工 carry them
// from the board to a SECOND sale counter (店员 ×2, sales go straight into the wallet). Every farm
// kind that feeds a machine also gets a big raw board (R_<kind>) where a 田间采收工 heaps it for
// packaging; the 机器专员 takes full loads from that board. Ordinary levels get raw boards too,
// and their own carriers drop there. Raw crops keep their own counter. The second counter's spot
// is found automatically (nearest free stretch of the east side next to the raw counter); a level
// may pin it with `sale2: [x, y]`.
// v4.5: ONE dedicated feeder per machine (the first hire that fed it; it carries full worker loads, see world.js), any further
// hire that used to feed the same machine becomes a farm hand for the raw counter (so fewer generated raw carriers).
// Every processing level follows the same unlock: one raw counter at start; after buying a processor, a second processed-goods counter becomes available.
// v4.7 FIXED ROLES:  原料搬运工 only fields → raw counter; 机器专员 only that
// machine's crop → that machine (one tile, plus a paid tile for a 2nd per machine); 加工品搬运工 only tray → goods counter,
// one per machine (at least two on a single-machine 加工品 counter). The goods counter's porter + 店员 come right after
// its machine in the purchase order, so customers there never stand at an empty desk for long.
// v4.8: machines listed in CFG.v48.feed3 (they still starved > 15% with everything bought) get a paid tile for a 3rd 机器专员
// (x_h<machine>, after that machine's 2nd x_g<machine> in the purchase order, priced CFG.v48.feeder3 × the median hire).
import { CFG } from './config.js';

const cache = new WeakMap();
const ov = (a, b, m = 0) => a.x < b.x + b.w + m && a.x + a.w + m > b.x && a.y < b.y + b.h + m && a.y + a.h + m > b.y;
const R = (cx, cy, w, h) => ({ x: cx - w / 2, y: cy - h / 2, w, h });

// every rect a counter at (x, y) occupies (desk, unload zone, cash spot, customer queue to the east wall)
export function counterRects(x, y, W) {
  const K = CFG.counter;
  return [R(x, y, K.deskW, K.deskD), R(x + K.zoneDx, y + K.zoneDy, K.zoneW, K.zoneH), R(x + K.cashDx, y + K.cashDy, 40, 40),
          { x: x + K.serveDx - 8, y: y - 14, w: W - (x + K.serveDx) + 8, h: 28 }];
}
export function procRects(o) {
  const P = CFG.proc;
  return [R(o.x, o.y, P.bodyW, P.bodyD), R(o.x + P.zoneDx, o.y, P.zoneW, P.zoneH)];
}
function objRects(L, o) {
  if (o.type === 'counter') return counterRects(o.x, o.y, L.W);
  if (o.type === 'proc') return procRects(o).concat(o.tray ? [{ x: o.tray[0], y: o.tray[1], w: o.tray[2], h: o.tray[3] }] : []);
  if (o.type === 'tray') return [{ x: o.x, y: o.y, w: o.w, h: o.h }];
  if (o.type === 'stand') return [{ x: o.x - o.w / 2, y: o.y - o.h / 2, w: o.w, h: o.h }];
  if (o.type === 'field') return [{ x: o.x, y: o.y, w: o.w, h: o.h }];
  if (o.type === 'coop') return [{ x: o.x - 30, y: o.y - 30, w: o.w + 30, h: o.h + 30 }];
  return [];
}
function blockers(L, skip) {
  const out = [];
  for (const o of L.objects) if (o !== skip) for (const r of objRects(L, o)) out.push(r);
  const S = CFG.tile.size;
  for (const t of L.tiles) out.push(R(t.x, t.y, S + 6, S + 6));
  const d = L.deco || {};
  for (const h of d.hedges || []) out.push({ x: h[0], y: h[1], w: h[2], h: h[3] });
  for (const t of d.trees || []) out.push(R(t[0], t[1], 22, 22));
  if (d.barn) out.push(R(d.barn[0], d.barn[1], 80, 60));
  out.push(R(L.start[0], L.start[1], 24, 24));
  return out;
}
const inside = (L, r, m = 18) => r.x >= m && r.y >= m && r.x + r.w <= L.W - m && r.y + r.h <= L.H - m;

// v4.9.7: wooden stands are generated for every level, not just food workshops (54-60).
// A raw stand (R_<item>) heaps one farm kind for packaging; a processed stand (P_<item>)
// sits next to its machine and takes its output. New levels get them automatically from
// their own sources and procs — no per-level config.
const sourceObj = (o) => o.type === 'field' ? o.crop : o.type === 'coop' ? o.item : null;
// nearest free spot for a stand of (w, h) around (px, py): clear of every object, tile, queue lane and wall
function standSpot(L, stands, px, py, w = 64, h = 42) {
  const size = { w, h }, occupied = blockers(L, null).concat(stands.map((a) => R(a.x, a.y, a.w, a.h)));
  let best = null, score = 1e18;
  for (let x = 45; x <= L.W - 45; x += 16) for (let y = 45; y <= L.H - 45; y += 16) {
    const r = R(x, y, size.w, size.h);
    if (!inside(L, r, 18) || occupied.some((b) => ov(r, b, 3))) continue;
    const d = Math.hypot(x - px, y - py); if (d < score) { score = d; best = [x, y]; }
  }
  return best || [Math.min(L.W - 50, Math.max(50, px)), Math.min(L.H - 50, Math.max(50, py))];
}
function saveStand(L, stands, stand) { stands.push(stand); L.objects.push(stand); return stand; }

// v4.9.7: ordinary levels (no procs) get a big raw wooden stand per farm kind, visible
// from the start. The level's own carriers are NOT rerouted: in an earn level the counter
// must stay stocked for customers to buy, and routing the carriers to the board instead
// starves the counter — the bot then has to shuttle every load board -> counter itself and
// the level takes twice as long (L47 +3:48, L49 +3:16). The board is there for the player
// to heap and package on (the level-3 pattern); machine levels, where a feeder carries
// board -> machine, do route through it (see splitSales0 step 0.5 / 2b).
function addRawStands(L0) {
  const L = { ...L0, objects: L0.objects.map((o) => ({ ...o, items: o.items ? o.items.slice() : o.items })),
              tiles: L0.tiles.map((t) => ({ ...t, effect: { ...t.effect }, req: t.req ? t.req.slice() : t.req })) };
  const stands = [];
  const kinds = [...new Set(L.objects.filter((o) => o.type === 'field' || o.type === 'coop').map(sourceObj))];
  for (const item of kinds) {
    if (L.objects.some((o) => o.type === 'stand' && o.item === item)) continue;   // level 3's T1 stays
    const src = L.objects.filter((o) => (o.type === 'field' || o.type === 'coop') && sourceObj(o) === item);
    if (!src.length) continue;
    const x = Math.min(L.W - 90, Math.max(90, Math.max(...src.map((o) => o.x + o.w)) + 38));
    const y = src.reduce((n, o) => n + o.y + o.h / 2, 0) / src.length;
    const [sx, sy] = standSpot(L, stands, x, y, 120, 60);   // v4.9.7: the raw board is BIG (Jin: 一个大木台子) — a wide pile keeps 3-4 workers from stacking on one spot
    saveStand(L, stands, { id: `R_${item}`, type: 'stand', role: 'raw', item, x: sx, y: sy, w: 120, h: 60, cap: 300 });
  }
  return L;
}

// v4.8 the machines of a level that get a paid 3rd 机器专员 (CFG.v48.feed3: a list, or per season for a valley level)
export function feed3Of(L) {
  const f = CFG.v48.feed3[L.name];
  return !f ? [] : Array.isArray(f) ? f : f[L.season] || [];
}
export function splitSales(L) {
  if (cache.has(L)) return cache.get(L);
  const out = L.foodLines ? splitFoodLevel(L) : splitSales0(L); cache.set(L, out); return out;
}

// Food levels use player-facing collection tables instead of a second customer cashier.
// Farms fill one raw table per crop; each machine specialist takes a full load from its
// matching raw/intermediate table; machine outputs go to a distinct finished-goods table.
const FOOD_OUTPUTS = {
  8: ['bread', 'jam'], 9: ['juice', 'jam'], 10: ['pie', 'teasnack'],
  11: ['bread', 'juice'], 12: ['chips', 'popcorn'], 13: ['pie', 'jam', 'bread'], 14: ['xiaolongbao', 'pie'], // v5.0.5: 13 keeps 'bread' — the wheat line is L59's only visible starting field; without it the level is empty
  // v5.0.6 night market 61–67 (valley 15–21): the final outputs each level sells. The
  // two-stage chain (65) lists only 'wine' — include() walks back to the gjuice machine.
  // WITHOUT an entry here splitFoodLevel deletes the whole level (the L59 empty-level bug).
  15: ['chips'], 16: ['popcorn', 'ketchup'], 17: ['smoked', 'bread'], 18: ['juice', 'jam', 'icecream'],
  19: ['wine'], 20: ['xiaolongbao', 'chips', 'teasnack'], 21: ['xiaolongbao', 'pie', 'gjuice'],
};
function splitFoodLevel(L0) {
  const L = { ...L0, objects: L0.objects.map((o) => ({ ...o, items: o.items?.slice() })),
    tiles: L0.tiles.map((t) => ({ ...t, effect: { ...t.effect, show: t.effect?.show?.slice(), cashier: t.effect?.cashier?.slice(), proc: t.effect?.proc?.map((x) => ({ ...x })), worker: t.effect?.worker ? { ...t.effect.worker, from: t.effect.worker.from?.slice(), to: t.effect.worker.to?.slice() } : undefined }, req: t.req?.slice() })) };
  const byId = Object.fromEntries(L.objects.map((o) => [o.id, o]));
  const allowed = new Set(FOOD_OUTPUTS[L.valley] || []);
  const procs0 = L.objects.filter((o) => o.type === 'proc');
  const keepProc = new Set();
  const include = (item) => {
    const p = procs0.find((q) => q.out === item);
    if (!p || keepProc.has(p.id)) return;
    keepProc.add(p.id);
    const prior = procs0.find((q) => q.out === p.in);
    if (prior) include(prior.out);
  };
  for (const item of allowed) include(item);
  const procs = procs0.filter((p) => keepProc.has(p.id));
  const neededRaw = new Set(procs.map((p) => p.in).filter((item) => !procs.some((q) => q.out === item)));
  const sources = L.objects.filter((o) => ['field', 'coop'].includes(o.type) && neededRaw.has(sourceObj(o)));
  const keepObjectIds = new Set([...sources.map((o) => o.id), ...procs.map((p) => p.id)]);
  const outItems = [...new Set(procs.map((p) => p.out))];
  // Replaced processing trays become output collection stands; do not reserve their former footprint.
  for (const p of procs) delete p.tray;
  const main = L.objects.find((o) => o.type === 'counter' && o.id === 'C1') || L.objects.find((o) => o.type === 'counter');
  if (main) { main.items = [...new Set(sources.map(sourceObj))]; main.hidden = false; main.foodManualSupply = true; }   // v4.9.9: raw only — processed goods get their own dedicated counter (PS) below
  const removedObjects = new Set(L.objects.filter((o) => !keepObjectIds.has(o.id) && o !== main).map((o) => o.id));
  L.objects = L.objects.filter((o) => !removedObjects.has(o.id));
  // Keep common upgrades/cashier, and only machine/plot unlocks still attached to retained objects.
  // Keep the ordinary upgrades and unlocks that still describe retained objects. Re-anchor
  // branches whose former prerequisite was a removed food line to the opening upgrade, so
  // deleting an over-complex recipe cannot strand a later retained machine behind a dead tile.
  let tiles = L.tiles.filter((t) => !t.effect.worker).map((t) => {
    const e = { ...t.effect };
    if (e.show) e.show = e.show.filter((id) => keepObjectIds.has(id));
    if (e.proc) e.proc = e.proc.filter((x) => keepProc.has(x.id));
    if (e.procUp && !keepProc.has(e.procUp)) delete e.procUp;
    return { ...t, effect: e, req: t.req?.slice(), reqAny: t.reqAny?.slice() };
  }).filter((t) => {
    const e = t.effect;
    return !(e.show && e.show.length === 0) && !(e.proc && e.proc.length === 0) &&
      !(e.show === undefined && !e.up && !e.cashier && !e.vehicle && !e.upgradeWorkers && !e.proc && !e.procUp && !e.hens && !e.sprinkler && !e.feeder && !e.counterUp);
  });
  if (!tiles.length) tiles = [{ id: 'food_start', x: L.start[0] - 60, y: L.start[1], price: 1, icon: 'cap', label: '开工', effect: { up: { key: 'cap', v: 0 } } }];
  const rootTile = tiles.find((t) => t.effect.up) || tiles[0];
  let validIds = new Set(tiles.map((t) => t.id));
  tiles = tiles.map((t) => {
    let req = (t.req || []).filter((id) => validIds.has(id));
    if (t !== rootTile && (t.req || []).length && !req.length) req = [rootTile.id];
    let reqAny = (t.reqAny || []).filter((id) => validIds.has(id));
    if ((t.reqAny || []).length && !reqAny.length) reqAny = [];
    return { ...t, req: req.length ? req : undefined, reqAny: reqAny.length ? reqAny : undefined };
  });
  // Ensure every retained source and processor has a real reveal tile. A hidden source gate
  // or machine gate is a prerequisite to its staff tile and collection stand.
  const reveal = (id) => tiles.find((t) => t.effect.show?.includes(id));
  const addGate = (id, label, icon) => {
    const o = L.objects.find((x) => x.id === id);
    const tile = { id: `food_unlock_${id}`, x: o?.x ?? L.start[0], y: o?.y ?? L.start[1], price: Math.max(100, (rootTile.price || 100) * 1.2), icon, label, req: [rootTile.id], effect: { show: [id] } };
    tiles.push(tile); return tile;
  };
  for (const src of sources) if (src.hidden && !reveal(src.id)) addGate(src.id, '解锁原料田', 'plot');
  for (const proc of procs) if (!reveal(proc.id)) addGate(proc.id, '解锁加工机', proc.out);
  // Restore all references after inserting the new gates.
  validIds = new Set(tiles.map((t) => t.id));
  tiles = tiles.map((t) => { const req = (t.req || []).filter((id) => validIds.has(id)); const reqAny = (t.reqAny || []).filter((id) => validIds.has(id)); return { ...t, req: req.length ? req : undefined, reqAny: reqAny.length ? reqAny : undefined }; });
  const tileForObject = (id) => tiles.find((t) => t.effect.show?.includes(id));
  // v5.1.3: the initial (farm-fed) machine is free — Jin: 初始机器不用金币解锁.
  // A chained (second-stage) machine keeps its coin price. This covers a config
  // reveal tile (e.g. L59 tile 'b' for M1) as well as a generated food_unlock gate.
  // ONLY zero a tile that reveals the machine alone — a tile bundling a field
  // with the machine keeps its price (the field is the real cost; see the
  // machine-level rule above, L45 'c'/'e').
  for (const proc of procs) {
    if (procs.some((q) => q.outTo === proc.id)) continue; // chained — keep its price
    const tile = tileForObject(proc.id);
    if (tile && tile.effect && tile.effect.show && tile.effect.show.length === 1 && tile.effect.show[0] === proc.id) tile.price = 0;
  }
  const cropKinds = [...new Set(sources.map(sourceObj))];
  const stands = [];
  for (const item of cropKinds) {
    const src = sources.filter((o) => sourceObj(o) === item);
    const x = Math.min(L.W - 90, Math.max(90, Math.max(...src.map((o) => o.x + o.w)) + 38));
    const y = src.reduce((n, o) => n + o.y + o.h / 2, 0) / src.length;
    const id = `R_${item}`;
    const [sx, sy] = standSpot(L, stands, x, y);
    saveStand(L, stands, { id, type: 'stand', role: 'raw', item, x: sx, y: sy, w: 64, h: 42, cap: 700 });
  }
  for (const item of outItems) {
    const p = procs.find((q) => q.out === item);
    const id = `P_${item}`;
    const [sx, sy] = standSpot(L, stands, Math.min(L.W - 105, p.x + 76), p.y + 56);
    const stand = saveStand(L, stands, { id, type: 'stand', role: 'processed', item, x: sx, y: sy, w: 64, h: 42, cap: 500, hidden: true });
    p.outTo = id;
    const unlock = tileForObject(p.id);
    if (unlock) unlock.effect.show = [...new Set([...(unlock.effect.show || []), id])];
  }
  // v4.9.9: a dedicated processed-goods counter (PS, only processed goods). The food
  // workshops used to sell raw + processed on one shared counter (C1) and the player
  // had to carry every finished good there by hand. PS sits near C1 — same free-space
  // search as splitSales0 (near the raw counter, close to the machines), with a
  // whole-map fallback — and is revealed with the first machine unlock. A dedicated
  // tally clerk (below) stocks it; the raw counter keeps selling raw goods only.
  let sale = null, firstMachineTile = null;
  if (main) {
    const bl = blockers(L, null), K = CFG.counter;
    let best = null, bs = 1e18;
    const score = (x, y) => Math.abs(y - main.y) + Math.abs(x - main.x) * 2 + Math.min(...procs.map((p) => Math.hypot(p.x - x, p.y - y))) * 0.5;
    const tryAt = (x, y, gap) => {
      if (x + K.serveDx > L.W - 40 || x + K.cashDx - 20 < 20) return;
      const rs = counterRects(x, y, L.W);
      if (!rs.slice(0, 3).every((r) => inside(L, r, 20))) return;
      if (rs.some((r, k) => bl.some((b) => ov(r, b, k === 0 ? gap : 8)))) return;
      const sc = score(x, y); if (sc < bs) { bs = sc; best = [x, y]; }
    };
    for (const gap of [34, 22, 12]) { if (best) break;
      for (let dx = -80; dx <= 80; dx += 10) for (let y = 60; y <= L.H - 100; y += 10) tryAt(main.x + dx, y, gap); }
    if (!best) for (let x = 45; x <= L.W - 45; x += 16) for (let y = 45; y <= L.H - 45; y += 16) tryAt(x, y, 3);
    const psPos = best || [Math.min(L.W - 50, Math.max(50, main.x)), Math.min(L.H - 50, Math.max(50, main.y + 120))];
    if (!best) console.warn(`[sales] ${L.name}: no clear spot for the processed counter, using ${psPos}`);
    sale = { id: 'PS', type: 'counter', items: [...outItems], x: psPos[0], y: psPos[1], hidden: true, sale2: true };
    L.objects.push(sale);
    firstMachineTile = tileForObject(procs[0].id);
    if (firstMachineTile) firstMachineTile.effect.show = [...new Set([...(firstMachineTile.effect.show || []), sale.id])];
    // v5.1.0 (A): the level's original cashier keeps only the processed counter
    // (PS); the raw counter (C1) gets its own regular salesperson (food_clerk,
    // added below). One clerk no longer serves both desks.
    for (const t of tiles) if (t.effect.cashier && t.effect.cashier.length) t.effect = { ...t.effect, cashier: [sale.id] };
  }
  L.tiles = tiles; // keep procedural hire tiles in the placement blockers as they are added.
  const first = tiles[0];
  const gen = [];
  const add = (t) => { tiles.push(t); gen.push(t); return t; };
  const hirePrice = Math.max(80, Math.min(240, Math.round((L.tiles.find((t) => t.effect.up)?.price || 160) * 1.8 / 10) * 10));
  // One farmhand per field/co-op; every crop type shares its own raw table.
  for (const src of sources) {
    const item = sourceObj(src), stand = stands.find((x) => x.role === 'raw' && x.item === item);
    const gate = tileForObject(src.id);
    const req = gate ? [gate.id] : [first.id];
    const pos = spot(L, stand.x - 10, stand.y + 55);
    add({ id: `food_farm_${src.id}`, x: pos[0], y: pos[1], price: hirePrice, icon: src.type === 'coop' ? 'cart' : 'worker', label: '田间采收工', req,
      effect: { worker: { from: [src.id], to: [stand.id], raw: true, standCarrier: true, fullBatch: true } } });
  }
  // v5.1.1 (C) chain specialist: in a two-stage food chain (M1 -> M2, where
  // M1's output is M2's input), ONE worker feeds both machines, rotating
  // between them (see workerAI updateChainTarget). It REPLACES the two single
  // specialists (food_machine_M1 + food_machine_M2) — Jin confirmed 2026-11-13:
  // hire one chain specialist and that's enough, no need for two singles.
  // Price is a single specialist x1.5 (cheaper than two at 2x, one fewer worker).
  // Single-stage machines (M3, M4) keep one specialist each, as before.
  // NOTE: machine levels (splitSales0) have no chain tile — there M2 is fed
  // directly by M1's output (world.js chain branch), so no M2 feeder exists to
  // replace and a chain worker would have no second feeding task.
  // A chain pair is (M1, M2) with M1.out === M2.in.
  const chainNext = new Map(); // M1.id -> M2 proc
  for (const p of procs) { const q = procs.find((r) => r !== p && r.in === p.out); if (q) chainNext.set(p.id, q); }
  const chainSecond = new Set([...chainNext.values()].map((q) => q.id));
  // Exactly one full-batch machine specialist per processor, including intermediate stages.
  for (const proc of procs) {
    if (chainSecond.has(proc.id)) continue; // second stage is covered by the chain tile
    const source = stands.find((x) => x.item === proc.in && (x.role === 'raw' || x.role === 'processed'));
    const machineTile = tileForObject(proc.id);
    if (!source || !machineTile) continue;
    const upstream = procs.find((q) => q.out === proc.in);
    const upstreamTile = upstream && tileForObject(upstream.id);
    const pos = spot(L, proc.x - 80, proc.y + 65);
    const m2 = chainNext.get(proc.id);
    if (m2) {
      // Chain tile for (M1=proc, M2=m2): feeds M1 from its source stand and
      // M2 from its (processed) source stand, rotating. Replaces both singles.
      const source2 = stands.find((x) => x.item === m2.in && (x.role === 'raw' || x.role === 'processed'));
      const machineTile2 = tileForObject(m2.id);
      if (!source2 || !machineTile2) continue;
      add({ id: `food_chain_${proc.id}`, x: pos[0], y: pos[1], price: r10(hirePrice * 1.5), icon: 'worker', label: '链式专员',
        req: [...new Set([machineTile2.id, machineTile.id])],
        fromSingle: [`food_machine_${proc.id}`, `food_machine_${m2.id}`],
        effect: { worker: { from: [source.id, source2.id], to: [proc.id, m2.id], feeder: [proc.id, m2.id], fullBatch: true } } });
      continue;
    }
    add({ id: `food_machine_${proc.id}`, x: pos[0], y: pos[1], price: hirePrice, icon: 'worker', label: '机器专员',
      req: [...new Set([machineTile.id, ...(upstreamTile ? [upstreamTile.id] : [])])],
      effect: { worker: { from: [source.id], to: [proc.id], feeder: proc.id, fullBatch: true } } });
  }
  // v4.9.9: one dedicated processed-goods tally clerk per food level — takes finished
  // goods from the processed boards to the dedicated processed counter (PS), never to
  // the shared raw counter. One clerk covers all the level's processed boards and
  // leaves with whatever is on them (no batch gate), so the boards stay clear while
  // the player is busy elsewhere. Requires the first machine unlock (same as PS).
  if (sale) {
    const boards = [...new Set(procs.map((p) => p.outTo))];
    const pos = spot(L, procs[0].x - 90, procs[0].y + 100);
    add({ id: 'food_tally', x: pos[0], y: pos[1], price: hirePrice, icon: 'porter', label: '加工品理货员',
      req: firstMachineTile ? [firstMachineTile.id] : [first.id],
      effect: { worker: { from: boards, to: [sale.id], tally: true } } });
  }
  // v5.1.0 (A): a regular salesperson for the raw counter (C1) only. Every food
  // level gets one (single- and two-machine alike); req is the first machine
  // unlock so it can be hired soon after the level opens. No counterUp for it.
  // v5.1.2 (A补): the clerk also CARRIES raw goods — from the raw wooden stands
  // (R_<crop>) to C1. In food levels nobody stocks C1 except the player, so while
  // Jin is busy with the machines the raw counter runs dry and regular customers
  // leave. Raw carrier (raw: true) — it is NOT a feeder, NOT a
  // porter, and NOT a tally clerk: it carries no `tally` flag, because the sim
  // checks use `tally` to mean the processed-goods tally clerk (delivers to PS
  // only); flagging the clerk as tally would misidentify it. Only raw goods, only when the counter needs topping
  // up (sinkOpen's rawLow/rawFull gate). Cashier stays — one tile, two jobs, no
  // extra hire. Old saves get the carrying automatically: restore() re-applies
  // the current tile effect for every bought tile.
  // v5.1.4: fullBatch — Jin: 一次拿满、一次放满. The clerk waits for a full
  // load (cap items) and drops it all on C1 at once, then goes back for another
  // full load; no more partial dribbles. It also rides a loader now (see
  // world.js): when workers upgrade to trucks, the clerk upgrades too.
  // `clerk: true` marks the carrying worker: its carrying capacity stays fixed
  // at base 50 (see world.js) — a loader would otherwise let it hoard up to 180
  // raw goods while the counter only ever needs ~50, starving the machine
  // feeders' buffer and slowing the processed counter (fit: L13/L22/L51/L52 PS
  // front wait +0.4-0.5 s over the limit, v5.1.1 baseline was 37/37). The loader
  // gives it speed and the truck look; the cap stays 50 so every batch stays
  // fillable from a deep raw stand (same rule as the v5.1.1 chain specialist).
  if (sale && main) {
    const pos = spot(L, main.x - 90, main.y + 100);
    const rawStands = stands.filter((x) => x.role === 'raw' && main.items.includes(x.item)).map((x) => x.id);
    const eff = { cashier: [main.id] };
    if (rawStands.length) eff.worker = { from: rawStands, to: [main.id], raw: true, clerk: true, fullBatch: true };
    add({ id: 'food_clerk', x: pos[0], y: pos[1], price: hirePrice, icon: 'cashier', label: '普通售货员',
      req: firstMachineTile ? [firstMachineTile.id] : [first.id],
      effect: eff });
  }
  // v5.0.8: food machines get the same two-tier upgrade path as machine levels
  // (procUp Lv1 ×0.42, Lv2 ×0.7, cumulative ×0.294). A config `proc` tile that sped
  // up several machines becomes one procUp path per machine (same as splitSales0
  // step 4); machines with no upgrade get their own path (step 7). No one-time
  // `proc` tile is left behind — a single upgrade system for every machine.
  // The k>0 sibling tiles carry `fromProc` (the original tile id) so an old save
  // that bought the single tile keeps its upgrade on every machine (see restore()).
  const upgraded = new Set();
  for (const t of tiles.slice()) {
    if (!t.effect.proc) continue;
    const ids = t.effect.proc.map((pe) => pe.id).filter((id) => procs.some((p) => p.id === id));
    if (!ids.length) continue;
    const price = Math.round(t.price * CFG.procUp.price / Math.sqrt(ids.length));
    ids.forEach((id, k) => {
      upgraded.add(id);
      let u = t;
      if (k > 0) {
        const p = procs.find((q) => q.id === id);
        const sp = spot(L, p.x + 10, p.y + 80);
        u = add({ id: 'u_' + id, x: sp[0], y: sp[1], icon: t.icon, label: t.label, fromProc: t.id });
      }
      u.price = price; u.effect = { procUp: id }; u.repeat = { times: CFG.v43.mup.times, mul: CFG.v43.mup.mul };
      u.req = (u.req || []).filter((r) => r !== t.id || u === t);
      if (k > 0) u.req = [];
      const mt = tileForObject(id);
      if (mt && mt !== u && !(u.req || []).includes(mt.id)) u.req = [...(u.req || []), mt.id];
    });
  }
  for (const p of procs) {
    if (upgraded.has(p.id)) continue;
    const mt = tileForObject(p.id);
    const sp = spot(L, p.x + 10, p.y + 80);
    add({ id: 'u_' + p.id, x: sp[0], y: sp[1], price: r10(hirePrice * CFG.v43.mup.base), icon: 'gear',
          label: '快' + (MNAME[p.out] || '机器'), req: mt ? [mt.id] : [first.id],
          repeat: { times: CFG.v43.mup.times, mul: CFG.v43.mup.mul }, effect: { procUp: p.id } });
  }
  // Keep every tile's prerequisite references valid and place the new hires early after the starter tile.
  const ids = new Set(tiles.map((t) => t.id));
  tiles = tiles.filter((t) => (t.req || []).every((id) => ids.has(id)));
  L.tiles = tiles.length ? [tiles[0], ...gen, ...tiles.filter((t) => t !== tiles[0] && !gen.includes(t))] : gen;
  L.foodCollectionTables = true;
  if (sale) L.sale2 = 'PS';
  L.objects = L.objects.map((o) => o.type === 'proc' ? { ...o, tray: undefined } : o);
  return L;
}

const MNAME = { bouquet: '花束机', crate: '蛋箱机', ketchup: '番茄酱机', basket: '花篮机', perfume: '香水机', plank: '锯木机', chair: '木椅机',
  cheese: '奶酪机', icecream: '冰淇淋机', popcorn: '爆米花机', jam: '果酱机', pie: '南瓜派烤炉', yarn: '毛线机', juice: '榨汁机', flour: '磨坊',
  bread: '面包烤炉', smoked: '熏鱼房', gjuice: '葡萄榨汁机', wine: '橡木酒桶', chips: '薯条炸锅' };
const r10 = (v) => Math.max(10, Math.round(v / 10) * 10);
// nearest free spot for a tile around (px, py): clear of every object, tile, queue lane and wall
function spot(L, px, py) {
  const bl = blockers(L, null), S = CFG.tile.size + 6;
  let best = null, bs = 1e18;
  for (let x = 40; x <= L.W - 40; x += 10) for (let y = 40; y <= L.H - 40; y += 10) {
    const r = R(x, y, S, S);
    if (!inside(L, r, 22) || bl.some((b) => ov(r, b, 5))) continue;
    const d = Math.hypot(x - px, y - py); if (d < bs) { bs = d; best = [x, y]; }
  }
  if (!best) console.warn(`[sales] ${L.name}: no room for a tile near ${px},${py}`);
  return best || [px, py];
}
function splitSales0(L0) {
  const procs0 = L0.objects.filter((o) => o.type === 'proc');
  if (!procs0.length) return addRawStands(L0);   // v4.9.7: ordinary levels get raw boards too
  const L = { ...L0, objects: L0.objects.map((o) => ({ ...o, items: o.items ? o.items.slice() : o.items })),
              tiles: L0.tiles.map((t) => ({ ...t, effect: { ...t.effect }, req: t.req ? t.req.slice() : t.req })) };
  const obj = Object.fromEntries(L.objects.map((o) => [o.id, o]));
  const procs = L.objects.filter((o) => o.type === 'proc');
  const T = procs.filter((p) => obj[p.outTo] && obj[p.outTo].type === 'counter');
  if (!T.length) return L0;
  const made = new Set(T.map((p) => p.out));
  const V = CFG.v43;
  // the level's price scale: median hire price
  const hires = L0.tiles.filter((t) => t.effect.worker).map((t) => t.price).sort((a, b) => a - b);
  const s = hires.length ? hires[hires.length >> 1] : 200;
  // 0.5) v4.9.7 wooden stands: a big raw board per farm kind that feeds a machine, and a
  // processed board next to each terminal machine that takes its output (the old tray
  // stuck to the machine is gone). Same system as the food workshops and level 3.
  const stands = [];
  const farmFed = procs.filter((p) => !procs.some((q) => q.outTo === p.id));
  const neededRaw = [...new Set(farmFed.map((p) => p.in))];
  const rStand = {};
  for (const item of neededRaw) {
    const existing = L.objects.find((o) => o.type === 'stand' && o.role === 'raw' && o.item === item);
    if (existing) { rStand[item] = existing; continue; }
    const src = L.objects.filter((o) => (o.type === 'field' || o.type === 'coop') && sourceObj(o) === item);
    if (!src.length) continue;
    const x = Math.min(L.W - 90, Math.max(90, Math.max(...src.map((o) => o.x + o.w)) + 38));
    const y = src.reduce((n, o) => n + o.y + o.h / 2, 0) / src.length;
    const [sx, sy] = standSpot(L, stands, x, y, 120, 60);   // v4.9.7: the raw board is BIG — a wide pile keeps 3-4 workers from stacking on one spot
    rStand[item] = saveStand(L, stands, { id: `R_${item}`, type: 'stand', role: 'raw', item, x: sx, y: sy, w: 120, h: 60, cap: 700 });
  }
  const pStand = {};
  for (const p of T) {
    // Two machines can make the same goods (level 42: two smokehouses) — they share one board.
    let stand = L.objects.find((o) => o.type === 'stand' && o.role === 'processed' && o.item === p.out);
    if (!stand) {
      const [sx, sy] = standSpot(L, stands, Math.min(L.W - 105, p.x + 76), p.y + 56);
      stand = saveStand(L, stands, { id: `P_${p.out}`, type: 'stand', role: 'processed', item: p.out, x: sx, y: sy, w: 64, h: 42, cap: 500, hidden: true });
    }
    pStand[p.id] = stand;
    p.outTo = stand.id;
  }
  for (const p of procs) delete p.tray;   // no machine keeps a tray once it has a board
  // 0) a level that only sold machine goods: its counter takes the raw input too (the first coins come from raw sales)
  let main = L.objects.filter((o) => o.type === 'counter').find((c) => c.items.some((it) => made.has(it))) || obj[T[0].outTo];
  if (!main.items.some((it) => !made.has(it))) {
    const rawIn = [...new Set(procs.filter((p) => !procs.some((q) => q.outTo === p.id)).map((p) => p.in))];
    main.items = [...rawIn, ...main.items];
  }
  // 1) (v4.9.7: output trays are gone — every terminal machine's goods heap on its
  // processed board next to it, created in step 0.5 above.)
  // 2) the 「加工品」 counter PS: not built at the start, bought from a tile once a machine is there
  // Processing levels always get a separate processed-goods counter after the first machine is unlocked.
  let pos = L0.sale2;
  if (!pos) {
    const bl = blockers(L, null), K = CFG.counter;
    let best = null, bs = 1e18;
    for (const gap of [34, 22, 12]) { if (best) break;
    for (let dx = -80; dx <= 80; dx += 10) for (let y = 60; y <= L.H - 100; y += 10) {
      const x = main.x + dx;
      if (x + K.serveDx > L.W - 40 || x + K.cashDx - 20 < 20) continue;
      const rs = counterRects(x, y, L.W);
      if (!rs.slice(0, 3).every((r) => inside(L, r, 20))) continue;
      if (rs.some((r, k) => bl.some((b) => ov(r, b, k === 0 ? gap : 8)))) continue;   // keep a walkway round the desk
      const dp = Math.min(...T.map((p) => Math.hypot(p.x - x, p.y - y)));
      const sc = Math.abs(y - main.y) + Math.abs(dx) * 2 + dp * 0.5;
      if (sc < bs) { bs = sc; best = [x, y]; }
    } }
    pos = best;
  }
  if (!pos) { console.warn(`[sales] ${L0.name}: no room for a second counter`); return L0; }
  const sale = { id: 'PS', type: 'counter', items: [...made], x: pos[0], y: pos[1], hidden: true, sale2: true };
  L.objects.push(sale); obj.PS = sale;
  for (const c of L.objects) if (c.type === 'counter' && c !== sale) c.items = c.items.filter((it) => !made.has(it));
  // v4.9.7: a terminal machine's outTo is its processed board (set in step 0.5), not PS —
  // the porter carries board -> PS.
  const dead = new Set(L.objects.filter((c) => c.type === 'counter' && !c.items.length).map((c) => c.id));
  if (dead.size) {
    L.objects = L.objects.filter((o) => !dead.has(o.id));
    for (const t of L.tiles) {
      const e = t.effect;
      if (e.cashier) e.cashier = e.cashier.filter((id) => !dead.has(id));
      if (e.show) e.show = e.show.filter((id) => !dead.has(id));
      if (e.worker) e.worker = { ...e.worker, to: e.worker.to.filter((id) => !dead.has(id)) };
    }
  }
  const rawC = L.objects.filter((o) => o.type === 'counter' && o !== sale);
  const rawItems = new Set(rawC.flatMap((c) => c.items));
  const rawSrc = L.objects.filter((o) => (o.type === 'field' || o.type === 'coop') && rawItems.has(o.type === 'field' ? o.crop : o.item)).map((o) => o.id);
  const first = L.tiles[0];
  const gen = [];                     // generated tiles, pushed into L.tiles as they are placed (so spots never collide)
  const add = (t) => { L.tiles.push(t); gen.push(t); return t; };
  // 2b) v4.5 one dedicated feeder per machine fed from the farm (a machine fed by another machine needs none)
  const srcOf = (item) => L.objects.filter((o) => (o.type === 'field' && o.crop === item) || (o.type === 'coop' && o.item === item)).map((o) => o.id);
  const chained = new Set(procs.filter((p) => procs.some((q) => q.outTo === p.id)).map((p) => p.id));
  const needFeeder = [], feedTile = {};
  for (const p of procs) {
    if (chained.has(p.id)) continue;
    const hires = L.tiles.filter((t) => t.effect.worker && t.effect.worker.to.includes(p.id));
    const src = srcOf(p.in);
    if (hires.length) feedTile[p.id] = hires[0];
    hires.forEach((t, k) => {
      const w0 = t.effect.worker;
      t.effect = { ...t.effect, worker: k === 0 ? { from: rStand[p.in] ? [rStand[p.in].id] : (src.length ? src : w0.from), to: [p.id], feeder: p.id }
                                                : { from: rawSrc.length ? rawSrc : w0.from, to: rawC.map((c) => c.id), raw: true } };
    });
    if (!hires.length && src.length) needFeeder.push([p, src]);
  }
  // 2c) v4.9.7 farmhands: they heap the field/coop output onto the raw board so the 机器专员
  // always find a full load there. (Same role as the food workshops' 田间采收工, but without
  // `raw: true`, so they never count as raw carriers to a counter — staff-check /
  // labour-check recognise `standCarrier` as its own role.)
  // v4.9.9: one farmhand per field/co-op (Jin: 4 fields → 4 people). Each farmhand works
  // its own field and heaps that field's kind onto the raw board. Replaces the v4.9.7
  // rule (one per feeder-slot of the kind + 1 spare = 3-4 per kind).
  const farmTiles = [];
  for (const item of neededRaw) {
    const stand = rStand[item]; if (!stand) continue;
    const src = srcOf(item);
    const coop = src.every((id) => obj[id].type === 'coop');
    src.forEach((srcId, k) => {
      const sp = spot(L, stand.x - 10, stand.y + 55 + k * 40);
      farmTiles.push(add({ id: `x_rf_${item}_${k + 1}`, x: sp[0], y: sp[1], price: r10(s * V.raw[0] * 0.4), icon: coop ? 'cart' : 'worker', label: '田间采收工',   // v4.9.7: 0.4x price — a farmhand only hauls field -> board (one short leg); at full worker price the bot spends the whole opening saving up for them and the machines start late (L15 casual 3:35 -> 5:44, machines 0% starved)
        req: k === 0 ? [first.id] : [`x_rf_${item}_${k}`],
        // v4.9.7: NO fullBatch — a farmhand that waits for a full 150-item load while the
        // field regrows leaves the board empty and the machine starved (L22 24%); it
        // delivers a partial load whenever the field is temporarily bare, so the board
        // stays stocked in a steady trickle instead of rare big bursts.
        effect: { worker: { from: [srcId], to: [stand.id], standCarrier: true } } }));
    });
  }
  // 3) machines: every machine is hidden until bought; a machine without a tile gets one on its own spot
  const mTile = {};
  for (const p of procs) {
    const st = L.tiles.find((t) => t.effect.show && t.effect.show.includes(p.id));
    if (st) { mTile[p.id] = st; continue; }
    p.hidden = true;
    const feeder = procs.find((q) => q.outTo === p.id);
    const prebuilt = Object.values(mTile).filter((t) => t.id.startsWith('m_')).length;
    mTile[p.id] = add({ id: 'm_' + p.id, x: p.x, y: p.y, price: r10(s * (prebuilt ? V.machine2 : V.machine)), icon: p.out, label: MNAME[p.out] || '加工机',
                        req: feeder ? [mTile[feeder.id].id] : [first.id], effect: { show: [p.id] } });
  }
  // v5.1.3: the initial (farm-fed) machine is free — Jin: 初始机器不用金币解锁.
  // A chained (second-stage) machine keeps its coin price. This covers both a
  // config reveal tile and a generated m_ tile (no tile reveals two machines,
  // so zeroing one machine's tile cannot free another).
  // ONLY zero a tile that reveals the machine alone. Some tiles bundle a field
  // with the machine (L45 'c' 挖鱼塘 shows ['P1','M3'], 'e' 温室番茄 shows
  // ['T1','M4']) — those tiles are really about unlocking the field/area, and
  // zeroing them would give the field away free too and break the level's
  // progression (L45 casual bot stalls at 9 unlocks, times out). They keep
  // their price; the machine inside is unlocked when the field is bought.
  for (const p of procs) {
    if (procs.some((q) => q.outTo === p.id)) continue; // chained — keep its price
    const t = mTile[p.id];
    if (t.effect && t.effect.show && t.effect.show.length === 1 && t.effect.show[0] === p.id) t.price = 0;
  }
  for (const p of procs) p.hidden = true;
  // v4.9.7: a terminal machine's processed board appears with the machine itself.
  for (const p of T) {
    const stand = pStand[p.id]; if (!stand) continue;
    const tile = mTile[p.id];
    tile.effect = { ...tile.effect, show: [...new Set([...(tile.effect.show || []), stand.id])] };
  }
  // Show both category stands as soon as the first processing machine unlocks.
  // Goods still route to the processed stand automatically; its porter hire remains a separate staff tile.
  const firstMachineTile = mTile[procs[0].id];
  firstMachineTile.effect = { ...firstMachineTile.effect, show: [...new Set([...(firstMachineTile.effect.show || []), sale.id])] };
  for (const [p, src] of needFeeder) {
    const sp = spot(L, p.x - 90, p.y + 60);
    feedTile[p.id] = add({ id: 'x_f' + p.id, x: sp[0], y: sp[1], price: r10(s * V.raw[0]), icon: 'worker', label: '机器专员', req: [mTile[p.id].id],
          effect: { worker: { from: rStand[p.in] ? [rStand[p.in].id] : src, to: [p.id], feeder: p.id } } });
  }
  // v4.7 every other farm hire is a 原料搬运工: it only harvests what the raw counter sells and only drops there
  const rawIds = rawC.map((c) => c.id);
  for (const t of L.tiles) {
    const wk = t.effect.worker; if (!wk || wk.feeder || wk.porter || wk.standCarrier) continue;   // v4.9.7: farmhands keep their board route
    const from = wk.from.filter((id) => rawSrc.includes(id));
    t.effect = { ...t.effect, worker: { from: from.length ? from : rawSrc.length ? rawSrc : wk.from, to: rawIds, raw: true } };
  }
  // v4.7 a paid tile for a 2nd 机器专员 per farm-fed machine (waits for the first)
  const feed2 = [];
  for (const p of procs) {
    const ft = feedTile[p.id]; if (!ft) continue;
    const sp = spot(L, p.x - 90, p.y + 100);
    feed2.push(add({ id: 'x_g' + p.id, x: sp[0], y: sp[1], price: r10(s * CFG.v47.feeder2), icon: 'worker', label: '机器专员',
                     req: [ft.id], effect: { worker: { ...ft.effect.worker, to: [p.id], feeder: p.id } } }));
  }
  // v4.8 a paid tile for a 3rd 机器专员, only on the machines CFG.v48.feed3 lists for this level (machines that still starve
  // with everything else bought, per sim/fit-check.mjs); it waits for that machine's 2nd 专员
  const feed3 = [], f3 = feed3Of(L0);
  for (const g of feed2) {
    const p = obj[g.effect.worker.feeder]; if (!f3.includes(p.id)) continue;
    const sp = spot(L, p.x - 90, p.y + 140);
    feed3.push(add({ id: 'x_h' + p.id, x: sp[0], y: sp[1], price: r10(s * CFG.v48.feeder3), icon: 'worker', label: '机器专员',
                     req: [g.id], effect: { worker: { ...g.effect.worker } } }));
  }
  // hires feeding a machine, and every upgrade of it, wait for that machine
  const needM = (t, ids) => { for (const id of ids) { const mt = mTile[id]; if (mt && mt !== t && !(t.req || []).includes(mt.id)) t.req = [...(t.req || []), mt.id]; } };
  for (const t of L.tiles) if (t.effect.worker) needM(t, t.effect.worker.to.filter((id) => obj[id] && obj[id].type === 'proc').slice(0, 1));
  // 4) per-machine upgrade paths (a 快机器 tile that sped up several machines becomes one path per machine)
  const upgraded = new Set();
  for (const t of L.tiles.slice()) {
    if (!t.effect.proc) continue;
    const ids = t.effect.proc.map((pe) => pe.id), price = Math.round(t.price * CFG.procUp.price / Math.sqrt(ids.length));
    ids.forEach((id, k) => {
      upgraded.add(id);
      let u = t;
      if (k > 0) { const p = obj[id], sp = spot(L, p.x + 10, p.y + 80); u = add({ id: 'u_' + id, x: sp[0], y: sp[1], icon: t.icon, label: t.label }); }
      u.price = price; u.effect = { procUp: id }; u.repeat = { times: V.mup.times, mul: V.mup.mul }; u.req = (u.req || []).filter((r) => r !== t.id || u === t);
      if (k > 0) u.req = [];
      needM(u, [id]);
    });
  }
  // 5) the 加工品 counter tile, raw carriers, porters
  const termTiles = T.map((p) => mTile[p.id].id);
  const ps = null; // counter is revealed by the first processing-machine unlock above
  const isRawHire = (t) => t.effect.worker && t.effect.worker.to.length && t.effect.worker.to.every((id) => rawC.some((c) => c.id === id));
  const rawHires = L.tiles.filter(isRawHire).length;
  const rawT = [];
  if (rawSrc.length && rawHires < 2) {
    const c0 = rawC[0], sp = spot(L, c0.x - 120, c0.y + 40);
    const coop = rawSrc.every((id) => obj[id].type === 'coop');
    for (let k = rawHires; k < 2; k++) {
      rawT.push(add({ id: 'x_r' + (k + 1), x: sp[0], y: sp[1], price: r10(s * V.raw[Math.min(k - rawHires, V.raw.length - 1)]), icon: coop ? 'cart' : 'worker', label: '原料搬运工',
                      req: rawT.length ? [rawT[rawT.length - 1].id] : [first.id], effect: { worker: { from: rawSrc, to: rawC.map((c) => c.id), raw: true } } }));
    }
  }
  // A raw item can also feed a processor and be sold unchanged (e.g. winter logs in 山谷集市).
  // General raw hires may cover all fields, but existing hires can already be fully assigned to other crops.
  // Add one dedicated carrier for each raw counter item with no source coverage; never leave it machine-only.
  const rawCovered = new Set(L.tiles.filter(isRawHire).flatMap((t) => t.effect.worker.from)
    .map((id) => obj[id]).filter(Boolean).map((o) => o.type === 'field' ? o.crop : o.item));
  const rawKinds = [...new Set(rawSrc.map((id) => { const o = obj[id]; return o.type === 'field' ? o.crop : o.item; }))];
  let rawSeq = Math.max(rawT.length, ...L.tiles.map((t) => /^x_r(\d+)$/.test(t.id) ? +t.id.slice(3) : 0));
  for (const item of rawKinds) {
    if (rawCovered.has(item)) continue;
    const from = rawSrc.filter((id) => { const o = obj[id]; return (o.type === 'field' ? o.crop : o.item) === item; });
    const c0 = rawC.find((c) => c.items.includes(item)) || rawC[0];
    const sp = spot(L, c0.x - 120, c0.y + 40);
    const id = 'x_r' + (++rawSeq), hires = L.tiles.filter(isRawHire), prev = rawT[rawT.length - 1] || hires[hires.length - 1];
    const coop = from.every((src) => obj[src].type === 'coop');
    const tile = add({ id, x: sp[0], y: sp[1], price: r10(s * V.raw[Math.min(rawSeq - 1, V.raw.length - 1)]), icon: coop ? 'cart' : 'worker', label: '原料搬运工',
      req: [prev ? prev.id : first.id], effect: { worker: { from, to: rawC.map((c) => c.id), raw: true } } });
    rawT.push(tile); rawCovered.add(item);
  }
  // v4.7 人员适配: one 加工品搬运工 per finished-goods machine, with at least two for a separate goods counter.
  const nP = Math.max(T.length, 2) + (L0.extraPorters || 0);
  const por = [];
  for (let k = 0; k < nP; k++) {
    const p = T[k % T.length], st = pStand[p.id];
    const sp = st ? spot(L, st.x + 10, st.y + 55) : spot(L, p.x + 80, p.y + 60);   // v4.9.7: porter tile by its machine's board, not the old tray
    const req = k >= T.length ? [por[k - T.length].id] : [mTile[p.id].id];
    por.push(add({ id: 'x_p' + (k + 1), x: sp[0], y: sp[1], price: r10(s * V.porter[k < T.length ? 0 : 1]), icon: 'porter', label: '加工品搬运工',
                   req, effect: { worker: { from: [p.id, ...T.filter((q) => q !== p).map((q) => q.id)], to: [sale.id], porter: true, tray: p.id } } }));
  }
  // v4.9.9 理货员: in levels with two or more terminal machines, one dedicated clerk
  // stands by the machine specialists and shuttles finished goods from the processed
  // boards to the goods counter. Why not just another porter: a porter is tied to one
  // machine's board and waits there until a fair batch (60) heaps up — so with two
  // machines the boards pile up while Jin is busy elsewhere. The tally clerk covers
  // ALL the level's boards and leaves with whatever is on them (no batch gate), so
  // the boards stay clear. One per level, only where T.length >= 2.
  let tally = null;
  if (T.length >= 2) {
    const boards = [...new Set(T.map((p) => pStand[p.id]))];
    const sp = spot(L, T[0].x - 90, T[0].y + 100);
    tally = add({ id: 'x_tally', x: sp[0], y: sp[1], price: r10(s * V.porter[0]), icon: 'porter', label: '理货员',
                  req: [mTile[T[0].id].id],
                  effect: { worker: { from: boards.map((b) => b.id), to: [sale.id], tally: true } } });
  }
  // 6) 店员 + 收银升级 (the upgrade waits on the clerk, on the same spot)
  const cup = (id, at, ids, clerk) => add({ id, x: at.x, y: at.y, price: r10(s * V.cup.base), icon: 'register', label: '收银升级', req: [clerk],
                                            repeat: { times: V.cup.times, mul: V.cup.mul }, effect: { counterUp: ids } });
  let pc = null, pu = null;
  const existingCashiers = L.tiles.filter((t) => t.effect.cashier && t.effect.cashier.length);
  if (existingCashiers.length && !L0.separateProcessedCashier) {
    // v5.1.0 (A): the original cashier keeps only the processed counter (PS);
    // the raw counters get their own regular salesperson (x_rc, below).
    for (const t of existingCashiers) t.effect = { ...t.effect, cashier: [sale.id] };
  } else {
    // Food workshops may explicitly give the busy processed counter its own cashier.
    const spC = spot(L, sale.x + CFG.counter.cashDx - 30, sale.y + CFG.counter.cashDy + 50);
    pc = add({ id: 'x_pc', x: spC[0], y: spC[1], price: r10(s * V.clerk), icon: 'cashier', label: '加工品店员', req: [firstMachineTile.id], effect: { cashier: [sale.id] } });
    pu = cup('x_pu', pc, [sale.id], 'x_pc');
  }
  const ups = [];
  for (const t of L.tiles.slice()) if (t.effect.cashier && t !== pc && t.effect.cashier.length) ups.push(cup('x_cu' + t.id, t, t.effect.cashier.slice(), t.id));
  // v5.1.0 (A): a regular salesperson for the raw counters (C1, C2) only — every
  // machine level gets one (single- and two-machine alike), including levels that
  // had no cashier of their own (the x_pc branch above). No counterUp for it;
  // the upgrade stays with the processed counter's cashier. Price is 0.5x the
  // median hire: the raw counter sells cheaper goods, and a cheaper clerk is
  // affordable as soon as the machines are fed, so the raw counter is automated
  // without stalling the opening purchases.
  let rc = null;
  if (rawC.length) {
    const spR = spot(L, main.x + CFG.counter.cashDx - 30, main.y + CFG.counter.cashDy + 50);
    // v5.1.2 (A补): cashier ONLY in machine levels — no carrying. Raw carriers
    // already stock the raw counters from the fields here, so the clerk's job
    // is the cash. Carrying from the stands was tried and REVERTED: the clerk
    // and the machine feeders share the single raw stand (L13 R_tomato, L51
    // R_rose), and the clerk taking from it starved the feeders and slowed
    // PS front wait +0.4s (fit 35/37: L13 B 3.3s, L51 A 2.6s). A surplus
    // gate (stand must hold clerk load + 3-5 feeder batches) could not fix
    // it either — it either let the clerk take and slow PS, or left the
    // clerk idle 100% (fit idle limit) and delivering 0 in L26. Food levels
    // keep the carrying (food_clerk): there C1 has no other stocker at all.
    rc = add({ id: 'x_rc', x: spR[0], y: spR[1], price: r10(s * 0.5), icon: 'cashier', label: '普通售货员', req: [firstMachineTile.id], effect: { cashier: rawC.map((c) => c.id) } });
  }
  // 7) machines that never had an upgrade get their own path
  const mups = [];
  for (const p of procs) if (!upgraded.has(p.id)) {
    const sp = spot(L, p.x + 10, p.y + 80);
    mups.push(add({ id: 'u_' + p.id, x: sp[0], y: sp[1], price: r10(s * V.mup.base), icon: 'gear', label: '快' + (MNAME[p.out] || '机器'),
                    req: [mTile[p.id].id], repeat: { times: V.mup.times, mul: V.mup.mul }, effect: { procUp: p.id } }));
  }
  // 8) purchase order (the guide arrow / balance bot buys the first affordable tile in this order):
  //    first tile → farmhands (so the raw boards are stocked before the first machine) → machines without a tile of their own
  //    → [processed porter 1, raw carrier 1] after the first processing machine (both stands appear with it)
  //    finished-goods machine → the level's own tiles → clerk, 2nd carrier, 2nd porter → 收银升级 → new machine upgrades
  const genSet = new Set(gen);
  const orig = L.tiles.filter((t) => !genSet.has(t));
  const mGen = gen.filter((t) => t.id.startsWith('m_'));
  let order = [orig[0], ...farmTiles, ...mGen, ...orig.slice(1)];
  const firstTerm = order.findIndex((t) => termTiles.includes(t.id));
  // Hire the first porter promptly after the machine; both stands already appear at machine unlock.
  order.splice(firstTerm + 1, 0, por[0], ...(tally ? [tally] : []), ...(pc ? [pc] : []), ...(rawT[0] ? [rawT[0]] : []));
  T.forEach((p, k) => { if (!k) return; const i = order.indexOf(mTile[p.id]); if (i >= 0) order.splice(i + 1, 0, por[k]); else order.push(por[k]); });
  // v5.1.0 (A): x_rc goes after the machine specialists (feed2/feed3) — the raw
  // counter's clerk is hired once the machines are fed. Hiring it right after
  // the first machine cost L15 casual 1s past par; hiring it here keeps the
  // balance at baseline, and its 0.5x price means it is affordable as soon as
  // the specialists are in, so the raw counter is automated before the
  // processed counter gets busy (L27 fit-check).
  order.push(...gen.filter((t) => t.id.startsWith('x_f')), ...rawT.slice(1), ...por.slice(T.length), ...feed2, ...feed3, ...(rc ? [rc] : []), ...(pu ? [pu] : []), ...ups, ...gen.filter((t) => t.id.startsWith('u_')));
  const seen = new Set(); L.tiles = order.filter((t) => t && !seen.has(t) && seen.add(t));
  for (const t of gen) if (!seen.has(t)) L.tiles.push(t);
  L.sale2 = 'PS';
  return L;
}
