// 启动、主循环、存档节奏
import { AUTOSAVE_SEC, OFFLINE_MIN_SEC, OFFLINE_CAP_SEC } from './config.js';
import { tick, simulate } from './game.js';
import { load, save, applyOffline, wipe } from './save.js';
import { UI } from './ui.js';

const { state: s, fresh } = load();
let offline = fresh ? null : applyOffline(s);

const ui = new UI(s, {
  save: () => save(s),
  reset: () => { wipe(); location.reload(); },
});

// 防止下拉刷新 / 双指缩放
document.addEventListener('touchmove', e => { if (!e.target.closest('.scroll')) e.preventDefault(); }, { passive: false });
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('dblclick', e => e.preventDefault());

// 开始画面
const start = document.getElementById('start');
document.getElementById('startBtn').addEventListener('click', () => {
  start.classList.add('out');
  setTimeout(() => start.remove(), 700);
  s.started = true;
  running = true;
  last = performance.now();
  if (offline && offline.seconds >= OFFLINE_MIN_SEC) ui.showOffline(offline);
  offline = null;
  save(s);
});
if (!fresh) document.getElementById('startBtn').textContent = '回到地里';

let running = false;
let last = performance.now();
let saveAcc = 0;
function loop(now) {
  const real = (now - last) / 1000;
  last = now;
  if (running) {
    // 后台标签页恢复时，长间隔按离线处理
    if (real > 5) {
      const sum = simulate(s, Math.min(real, OFFLINE_CAP_SEC));
      s.rt.fx = [];
      if (sum.seconds >= OFFLINE_MIN_SEC) ui.showOffline({ ...sum, capped: real > OFFLINE_CAP_SEC });
    } else {
      const dt = Math.min(real, 0.25);
      tick(s, dt);
      saveAcc += dt;
      if (saveAcc >= AUTOSAVE_SEC) { saveAcc = 0; save(s); }
    }
  }
  ui.frame(Math.min(real, 0.1));
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') save(s);
  else if (running) {
    const sum = applyOffline(s, Date.now());
    if (sum && sum.seconds >= OFFLINE_MIN_SEC) ui.showOffline(sum);
    last = performance.now();
  }
});
addEventListener('pagehide', () => save(s));
