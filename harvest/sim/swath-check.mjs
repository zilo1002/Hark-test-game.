// Clean-cut check: drive the player in straight lines through dense fields (stack capacity
// raised so it never fills) and assert that every ripe plant inside the harvest radius of the
// path was cut (zero leftovers) and nothing outside it was.
// Then the stop-at-max check: with a small free capacity the player cuts exactly that many
// plants and the rest of the field stays standing.
//   node sim/swath-check.mjs
import { CFG } from '../js/config.js';
import { World } from '../js/world.js';

const segDist2 = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L)) : 0;
  const qx = ax + dx * t - px, qy = ay + dy * t - py; return qx * qx + qy * qy;
};
CFG.fever.perItem = 0;   // fever would widen the swath mid-run
let fails = 0, runs = 0;
for (const li of [0, 1, 4, 7, 13]) {
  const L = CFG.levels[li];
  for (const f0 of L.objects.filter((o) => o.type === 'field' && !o.hidden && !CFG.crops[o.crop].spill)) {
    for (const [dir, label] of [[[1, 0], 'east'], [[0, 1], 'south'], [[0.7071, 0.7071], 'diagonal']]) {
      const w = new World(li, { quiet: true, seed: 3 });
      w.solids = [];                                   // straight line, no steering
      const f = w.objs[f0.id], p = w.player;
      p.cap = 1e6; w.upg.cap = 1e6;
      const hr = p.harvestR;
      const ax = dir[0] ? f.x - 10 : f.x + f.w * 0.5, ay = dir[1] && !dir[0] ? f.y - 10 : (dir[0] && dir[1] ? f.y - 10 : f.y + f.h * 0.5);
      const sx = dir[0] && dir[1] ? f.x - 10 : ax;
      p.x = sx; p.y = ay;
      const pathA = [p.x, p.y];
      const len = Math.max(f.w, f.h) + 40;
      for (let t = 0; t < len / p.speed + 1; t += 1 / 60) {
        w.update(1 / 60, dir[0], dir[1]);
        if (p.x > f.x + f.w + 10 || p.y > f.y + f.h + 10) break;
      }
      const pathB = [p.x, p.y];
      let inside = 0, left = 0, wrong = 0;
      for (let i = 0; i < f.n; i++) {
        const d2 = segDist2(f.px(i), f.py(i), pathA[0], pathA[1], pathB[0], pathB[1]);
        const cut = f.cutAt[i] > -1;
        if (d2 <= (hr - 1.2) ** 2) { inside++; if (!cut) left++; }
        else if (d2 > (hr + 4) ** 2 && cut) wrong++;
      }
      runs++;
      const ok = left === 0 && wrong === 0 && inside > 20;
      if (!ok) fails++;
      console.log(`${ok ? 'OK  ' : 'FAIL'} 第${li + 1}关 ${f0.id} ${f0.crop} ${label.padEnd(8)} swath plants ${inside}, left uncut ${left}, cut outside swath ${wrong}`);
    }
  }
}
console.log(fails ? `\n${fails}/${runs} swaths left plants behind` : `\nall ${runs} swaths clean (zero leftovers)`);
// ---- stop at max capacity
let mfails = 0;
for (const li of [0, 1, 7]) {
  const L = CFG.levels[li], f0 = L.objects.find((o) => o.type === 'field' && !o.hidden);
  const w = new World(li, { quiet: true, seed: 5 }); w.solids = [];
  const f = w.objs[f0.id], p = w.player;
  const room = 37; p.cap = room;
  p.x = f.x - 10; p.y = f.y + f.h * 0.5;
  const ripe0 = f.ripe;
  for (let t = 0; t < 4; t += 1 / 60) { w.update(1 / 60, 1, 0); p.cap = room; }
  const cut = ripe0 - f.ripe - 0;   // regrowth within 4 s is impossible (grow ≥ 7 s)
  const ok = cut === room && p.stack.length + p.incoming === room && p.fullFlag;
  if (!ok) mfails++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} 第${li + 1}关 ${f0.id} at max: cap ${room}, cut ${cut}, carried ${p.stack.length + p.incoming}, plants left standing on the path ${f.ripe}`);
}
fails += mfails;
// ---- gardeners / loaders never cut while full, and always go back to unload
for (const li of [0, 7, 13]) {
  const w = new World(li, { quiet: true, seed: 9 });
  for (const t of w.tiles) if (!t.done) w.completeTile(t, true);
  let over = 0, cutFull = 0, trips = 0;
  const before = new Map();
  for (let i = 0; i < 60 * 90; i++) {
    for (const k of w.workers) before.set(k, { full: k.stack.length + k.incoming >= k.cap, cutT: k.cutT });
    w.update(1 / 60, 0, 0);
    for (const k of w.workers) { if (k.stack.length + k.incoming > k.cap) over++; const b = before.get(k); if (b.full && k.cutT !== b.cutT) cutFull++; }
  }
  for (const k of w.workers) trips += k.trips;
  const ok = over === 0 && cutFull === 0 && trips > 0;
  if (!ok) fails++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} 第${li + 1}关 workers (${w.workers.map((k) => (k.loader ? 'loader' : k.cart ? 'cart' : 'gardener') + ' Lv' + k.lv).join(', ')}): over-cap frames ${over}, cuts while full ${cutFull}, delivery trips ${trips}`);
}
process.exit(fails ? 1 : 0);
