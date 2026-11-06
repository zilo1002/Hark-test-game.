// v4.2 鱼塘 check (replaces the swath check for fish): on every level with a pond
//  - fish never leave the water, schools stay together when calm and scatter from a fast farmer
//  - sweeping the net catches only fish inside its radius, never more than the stack has room for
//  - a pond levels up exactly at the catch thresholds (bigger water, more fish), respawns back to its stock
//  - 渔夫 chase schools and deliver (trips > 0, never over capacity)
//   node sim/pond-check.mjs
import { CFG } from '../js/config.js';
import { World } from '../js/world.js';

let fails = 0;
const ok = (c, msg) => { console.log(`${c ? 'OK  ' : 'FAIL'} ${msg}`); if (!c) fails++; };
const fishLevels = CFG.levels.map((L, i) => (L.objects.some((o) => o.type === 'field' && o.crop === 'fish') ? i : -1)).filter((i) => i >= 0);
console.log('fish levels:', fishLevels.map((i) => i + 1).join(', '));
// a level with only the player in it (the auto-hired machine staff and fishermen would catch fish too);
// every pond revealed; all = also buy every tile (feeder, 增氧机 …)
function solo(li, seed, all) {
  const w = new World(li, { quiet: true, seed });
  for (const t of w.tiles) if (!t.done && (all || (t.effect.show && t.effect.show.some((id) => w.objs[id] && w.objs[id].kind === 'pond')))) w.completeTile(t, true);
  w.workers.length = 0; w.money = 0;
  return w;
}
for (const li of fishLevels) {
  const tag = `第${li + 1}关 ${CFG.levels[li].name}`;
  // 1) idle swim: containment + cohesion
  {
    const w = solo(li, 7, true);
    w.player.x = w.W - 40; w.player.y = w.H - 40;
    let out = 0, spread = 0, k = 0;
    for (let i = 0; i < 60 * 20; i++) {
      w.update(1 / 60, 0, 0);
      if (i % 30) continue;
      for (const pd of w.ponds) { if (pd.hidden) continue;
        for (const f of pd.fish) if (f.x < pd.x || f.x > pd.x + pd.w || f.y < pd.y || f.y > pd.y + pd.h) out++;
        for (const s of pd.schools) { const fs = pd.fish.filter((f) => pd.schools[f.s] === s); if (fs.length < 4) continue; spread += fs.reduce((a, f) => a + Math.hypot(f.x - s.cx, f.y - s.cy), 0) / fs.length; k++; } }
    }
    ok(out === 0 && spread / k < 30, `${tag} swim: fish outside the water ${out}, mean distance to school centre ${(spread / k).toFixed(1)}`);
  }
  // 2) a fast farmer scatters a school; it regroups within a few seconds
  {
    const w = solo(li, 11); const pd = w.ponds.find((p) => !p.hidden), p = w.player;
    for (let i = 0; i < 120; i++) w.update(1 / 60, 0, 0);
    p.cap = 0;   // no room: nothing is caught, so the school stays whole
    const s = pd.schools[0]; const fs = () => pd.fish.filter((f) => f.s === 0);
    const sp0 = fs().reduce((a, f) => a + Math.hypot(f.vx, f.vy), 0) / fs().length;
    p.x = s.cx - 60; p.y = s.cy; let maxSp = 0;
    for (let i = 0; i < 40; i++) { w.update(1 / 60, 1, 0); p.cap = 0; maxSp = Math.max(maxSp, fs().reduce((a, f) => a + Math.hypot(f.vx, f.vy), 0) / fs().length); }
    p.x = w.W - 30; p.y = w.H - 30; p.vx = p.vy = 0;
    for (let i = 0; i < 60 * 4; i++) w.update(1 / 60, 0, 0);
    const d = fs().reduce((a, f) => a + Math.hypot(f.x - pd.schools[0].cx, f.y - pd.schools[0].cy), 0) / fs().length;
    ok(maxSp > sp0 * 1.6 && d < 30, `${tag} scatter: calm speed ${sp0.toFixed(0)} → darting ${maxSp.toFixed(0)}, regrouped spread ${d.toFixed(1)}`);
  }
  // 3) catch inside the net only, capped by the room on the stack
  {
    const w = solo(li, 13); const pd = w.ponds.find((p) => !p.hidden), p = w.player;
    for (let i = 0; i < 60; i++) w.update(1 / 60, 0, 0);
    p.x = pd.x + pd.w + 20; p.y = pd.y + pd.h / 2;
    const room = 9; p.cap = room; let bad = 0;
    for (let i = 0; i < 60 * 6; i++) {
      const sc = pd.bestSchool(p.x, p.y, 0.2); const dx = sc ? sc.x - p.x : 0, dy = sc ? sc.y - p.y : 0, dd = Math.hypot(dx, dy) || 1;
      const before = pd.fish.map((f) => [f.id, Math.hypot(f.x - p.x, f.y - p.y)]);
      w.update(1 / 60, dx / dd * 0.5, dy / dd * 0.5); p.cap = room;
      const left = new Set(pd.fish.map((f) => f.id));
      for (const [id, d] of before) if (!left.has(id) && d > p.harvestR + 8) bad++;
    }
    ok(bad === 0 && p.stack.length + p.incoming === room && p.fullFlag, `${tag} net: caught outside the net ${bad}, carried ${p.stack.length + p.incoming}/${room}`);
  }
  // 4) level-ups at the thresholds, respawn back to stock
  {
    const w = solo(li, 17); const pd = w.ponds.find((p) => !p.hidden), p = w.player;
    p.cap = 1e6; w.upg.cap = 1e6; const area0 = pd.w * pd.h, lv = [];
    for (let i = 0; i < 60 * 120 && pd.lv < CFG.pond.levels.length; i++) {
      const sc = pd.bestSchool(p.x, p.y, 0.3); const dx = sc ? sc.x - p.x : 0, dy = sc ? sc.y - p.y : 0, dd = Math.hypot(dx, dy) || 1;
      const l0 = pd.lv; w.update(1 / 60, dx / dd * 0.55, dy / dd * 0.55); p.cap = 1e6;
      if (pd.lv !== l0) lv.push(pd.caught);
    }
    const th = CFG.pond.levels.slice(1).map((L) => L.at);
    const atOk = lv.length === th.length && lv.every((c, i) => c >= th[i] && c < th[i] + 15);
    p.x = w.W - 30; p.y = w.H - 30; for (let i = 0; i < 60 * 20; i++) w.update(1 / 60, 0, 0);
    ok(atOk && pd.w * pd.h > area0 * 1.4 && pd.fish.length === pd.N, `${tag} levels: up at ${lv.join(' / ')} (thresholds ${th.join(' / ')}), area ×${(pd.w * pd.h / area0).toFixed(2)}, stock ${pd.fish.length}/${pd.N}`);
  }
  // 5) 渔夫
  {
    const w = new World(li, { quiet: true, seed: 19 }); for (const t of w.tiles) if (!t.done) w.completeTile(t, true);
    const fishers = w.workers.filter((k) => k.fisher); let over = 0;
    for (let i = 0; i < 60 * 90; i++) { w.update(1 / 60, 0, 0); for (const k of fishers) if (k.stack.length + k.incoming > k.cap) over++; }
    const trips = fishers.reduce((a, k) => a + k.trips, 0);
    ok(fishers.length > 0 && trips > fishers.length && over === 0, `${tag} 渔夫 ×${fishers.length}: delivery trips ${trips}, over-cap frames ${over}`);
  }
}
console.log(fails ? `\n${fails} pond checks failed` : '\nall pond checks passed');
process.exit(fails ? 1 : 0);
