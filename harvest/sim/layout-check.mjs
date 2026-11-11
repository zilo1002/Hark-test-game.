// Sanity check for level layouts: tiles, zones, solids and fields must not overlap
// each other in ways that break play (a tile under a desk, a zone inside a field…).
//   node sim/layout-check.mjs
import { CFG } from '../js/config.js';
import { World } from '../js/world.js';

const ov = (a, b, m = 0) => a.x < b.x + b.w + m && a.x + a.w + m > b.x && a.y < b.y + b.h + m && a.y + a.h + m > b.y;
const R = (cx, cy, w, h) => ({ x: cx - w / 2, y: cy - h / 2, w, h });
let bad = 0;
CFG.levels.forEach((L, li) => {
  const w = new World(li, { quiet: true });
  // reveal everything so hidden objects are checked too
  for (const o of Object.values(w.objs)) o.hidden = false;
  w.rebuildSolids();
  const things = [];
  const S = CFG.tile.size;
  for (const t of w.tiles) {
    const showsHere = t.effect.show && t.effect.show.some((id) => { const o = w.objs[id]; return o && (o.kind === 'proc' || o.kind === 'counter') && Math.hypot(o.x - t.x, o.y - t.y) < 4; });
    if (!showsHere) things.push({ n: `tile ${t.id}`, r: R(t.x, t.y, S, S), t });
  }
  for (const c of w.counters) { things.push({ n: `${c.id} zone`, r: c.zone }); things.push({ n: `${c.id} cash`, r: R(c.cashPos.x, c.cashPos.y, 40, 40) }); things.push({ n: `${c.id} desk`, r: c.desk }); things.push({ n: `${c.id} queue`, r: { x: c.serve.x - 8, y: c.y - 12, w: w.W - c.serve.x + 8, h: 24 } }); }
  for (const p of w.procs) { things.push({ n: `${p.id} in`, r: p.inZone }); things.push({ n: `${p.id} body`, r: p.body }); }
  for (const f of w.fields) things.push({ n: `${f.id} field`, r: { x: f.x, y: f.y, w: f.w, h: f.h } });
  for (const f of w.ponds) things.push({ n: `${f.id} pond`, r: { x: f.X, y: f.Y, w: f.MW, h: f.MH } });   // v4.2: the full basin (the water grows into it)
  for (const p of w.procs) if (p.pile && p.outObj?.kind !== 'stand') things.push({ n: `${p.id} tray`, r: { x: p.pile.x, y: p.pile.y, w: p.pile.w, h: p.pile.h } });
  for (const t of w.trays || []) things.push({ n: `${t.id} tray`, r: { x: t.pile.x, y: t.pile.y, w: t.pile.w, h: t.pile.h } });
  for (const c of w.coops) things.push({ n: `${c.id} coop`, r: { x: c.x - 30, y: c.y - 30, w: c.w + 30, h: c.h + 30 } });
  for (const a of Object.values(w.objs)) if (a.kind === 'stand') things.push({ n: `${a.id} stand`, r: R(a.x, a.y, a.w, a.h) });
  (L.deco.hedges || []).forEach((h, i) => things.push({ n: `hedge${i}`, r: { x: h[0], y: h[1], w: h[2], h: h[3] } }));
  (L.deco.trees || []).forEach((t, i) => things.push({ n: `tree${i}`, r: R(t[0], t[1], 18, 18) }));
  if (L.deco.barn) things.push({ n: 'barn', r: R(L.deco.barn[0], L.deco.barn[1], 76, 56) });
  things.push({ n: 'start', r: R(L.start[0], L.start[1], 20, 20) });
  for (let i = 0; i < things.length; i++) for (let j = i + 1; j < things.length; j++) {
    const a = things[i], b = things[j];
    if (a.n.split(' ')[0] === b.n.split(' ')[0] && !a.n.startsWith('tile')) continue;   // parts of one object
    // v4.3: a tile that only appears once the tile on the same spot is bought (2nd hire, 收银升级 after its 店员)
    if (a.t && b.t && a.t.x === b.t.x && a.t.y === b.t.y && ((a.t.req || []).includes(b.t.id) || (b.t.req || []).includes(a.t.id))) continue;
    if (ov(a.r, b.r, 2)) { console.log(`L${li + 1} ${L.name}: ${a.n} overlaps ${b.n}`); bad++; }
  }
  for (const t of things) { const r = t.r; if (!t.n.includes('queue') && !t.n.startsWith('hedge') && (r.x < 16 || r.y < 16 || r.x + r.w > w.W - 16 || r.y + r.h > w.H - 16)) { console.log(`L${li + 1}: ${t.n} touches the wall`); bad++; } }
});
console.log(bad ? `${bad} problems` : 'layout OK');
