// v5.1.7 庄园散步 probe: tap the estate lawn, the farmer walks there (not a teleport),
// the dog trails behind; taps on buildings / outside the lawn land on the nearest
// walkable point; it works on every manor page and with an old save.
import { setWalkTarget, updateWalk, walkState, resetWalk, walkObstacles } from '../js/home.js';

let pass = 0, fail = 0;
function check(name, ok, extra = '') {
  if (ok) { pass++; console.log(`PASS ${name}`); }
  else { fail++; console.log(`FAIL ${name} ${extra}`); }
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const fp = (s) => ({ x: s.fx, y: s.fy });   // walkState() -> point
// step the walk sim for `secs` of game time at 60 fps
function run(secs, page, save, night = false) {
  const n = Math.round(secs * 60);
  for (let i = 0; i < n; i++) updateWalk(1 / 60, page, save, night);
}
const save = { restored: ['manor', 'barn', 'windmill', 'pond', 'fountain', 'tree', 'well', 'gazebo', 'greenhouse'], shop: { deco: ['pond'], pet: { dog: 'dogShiba' } } };

// 1. tap a lawn point: the farmer walks there gradually, not a teleport
resetWalk();
let s0 = walkState();
setWalkTarget(300, 300, 1, save);
updateWalk(1 / 60, 1, save);
let s1 = walkState();
check('farmer does not teleport on first frame', dist(fp(s1), fp(s0)) < 5 && dist(fp(s1), { x: 300, y: 300 }) > 50, `moved=${dist(fp(s1), fp(s0)).toFixed(1)}`);
check('farmer is moving after a tap', s1.moving === true);
run(6, 1, save);
let s2 = walkState();
check('farmer arrives at the tapped point', dist(fp(s2), { x: 300, y: 300 }) < 3, `at=(${s2.fx.toFixed(1)},${s2.fy.toFixed(1)})`);
check('farmer stops on arrival', s2.moving === false);

// 2. the dog trails behind and ends close to the farmer
check('dog followed the farmer', dist({ x: s2.dx, y: s2.dy }, { x: 240, y: 224 }) > 10, `dog=(${s2.dx.toFixed(1)},${s2.dy.toFixed(1)})`);
check('dog stops a short gap behind the farmer', dist({ x: s2.dx, y: s2.dy }, { x: s2.fx, y: s2.fy }) <= 30, `gap=${dist({ x: s2.dx, y: s2.dy }, { x: s2.fx, y: s2.fy }).toFixed(1)}`);

// 3. tap on the manor house: the target lands beside it, not inside it
resetWalk();
const t3 = setWalkTarget(180, 150, 1, save);
check('tap on the manor lands outside it', Math.hypot(t3.x - 180, t3.y - 150) >= 29, `target=(${t3.x.toFixed(1)},${t3.y.toFixed(1)})`);

// 4. tap outside the lawn: clamped inside the walkable bounds
resetWalk();
const t4 = setWalkTarget(-50, 500, 1, save);
check('tap outside the lawn is clamped inside', t4.x >= 10 && t4.x <= 350 && t4.y >= 104 && t4.y <= 446, `target=(${t4.x},${t4.y})`);

// 5. facing: walk left -> face -1, walk right -> face 1
resetWalk();
setWalkTarget(60, 300, 1, save); run(3, 1, save);
check('farmer faces left when walking left', walkState().face === -1, `face=${walkState().face}`);
setWalkTarget(320, 300, 1, save); run(4, 1, save);
check('farmer faces right when walking right', walkState().face === 1, `face=${walkState().face}`);

// 6. page 2 and page 3: walking works, their buildings are obstacles too
resetWalk();
const t6 = setWalkTarget(180, 150, 2, { restored: ['lodge'], shop: { deco: [] } });
check('page 2 lodge is an obstacle', Math.hypot(t6.x - 180, t6.y - 150) >= 29, `target=(${t6.x.toFixed(1)},${t6.y.toFixed(1)})`);
setWalkTarget(300, 320, 2, { restored: ['lodge'], shop: { deco: [] } }); run(5, 2, { restored: ['lodge'], shop: { deco: [] } });
check('farmer walks on page 2', dist(fp(walkState()), { x: 300, y: 320 }) < 3, `at=(${walkState().fx.toFixed(1)},${walkState().fy.toFixed(1)})`);
resetWalk();
const t6b = setWalkTarget(92, 372, 3, { restored: [], shop: { deco: [] } });
check('page 3 lake is an obstacle', Math.hypot(t6b.x - 92, t6b.y - 372) >= 45, `target=(${t6b.x.toFixed(1)},${t6b.y.toFixed(1)})`);
setWalkTarget(300, 300, 3, { restored: [], shop: { deco: [] } }); run(5, 3, { restored: [], shop: { deco: [] } });
check('farmer walks on page 3', dist(fp(walkState()), { x: 300, y: 300 }) < 3, `at=(${walkState().fx.toFixed(1)},${walkState().fy.toFixed(1)})`);

// 7. night map: the market stall is an obstacle, walking still works
resetWalk();
const t7 = setWalkTarget(90, 420, 1, save, true);
check('night stall is an obstacle', Math.hypot(t7.x - 90, t7.y - 420) >= 19, `target=(${t7.x.toFixed(1)},${t7.y.toFixed(1)})`);
setWalkTarget(280, 380, 1, save, true); run(4, 1, save, true);
check('farmer walks on the night map', dist(fp(walkState()), { x: 280, y: 380 }) < 3, `at=(${walkState().fx.toFixed(1)},${walkState().fy.toFixed(1)})`);

// 8. old save (no shop, no restored): no crash, farmer still walks
resetWalk();
setWalkTarget(300, 300, 1, {});
run(5, 1, {});
check('old save without shop/restored still walks', dist(fp(walkState()), { x: 300, y: 300 }) < 3, `at=(${walkState().fx.toFixed(1)},${walkState().fy.toFixed(1)})`);
check('no obstacles without a save', walkObstacles(1, {}).length === 0);

// 9. the farmer walks round a building instead of through it: tap past the manor,
//    sample the path, no sample may sit inside the manor circle
resetWalk();
setWalkTarget(120, 130, 1, save);   // from (214,216) to (120,130): straight line passes near the manor (180,150)
let inside = false, minD = 1e9;
for (let i = 0; i < 60 * 6; i++) {
  updateWalk(1 / 60, 1, save);
  const st = walkState();
  const d = Math.hypot(st.fx - 180, st.fy - 150);
  if (d < minD) minD = d;
  if (d < 28) inside = true;
  if (!st.moving) break;
}
check('farmer never walks through the manor', !inside, `closest=${minD.toFixed(1)}`);
check('farmer still arrives past the manor', dist(fp(walkState()), { x: 120, y: 130 }) < 3, `at=(${walkState().fx.toFixed(1)},${walkState().fy.toFixed(1)})`);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
console.log('ALL MANOR-WALK CHECKS PASS');
