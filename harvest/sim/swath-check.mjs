// Clean-cut check: drive the player in straight lines through dense fields (stack capacity
// raised so it never fills) and assert that every ripe plant inside the harvest radius of the
// path was cut (zero leftovers) and nothing outside it was.
//   node sim/swath-check.mjs
import { CFG } from '../js/config.js';
import { World } from '../js/world.js';

const segDist2 = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L)) : 0;
  const qx = ax + dx * t - px, qy = ay + dy * t - py; return qx * qx + qy * qy;
};
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
process.exit(fails ? 1 : 0);
