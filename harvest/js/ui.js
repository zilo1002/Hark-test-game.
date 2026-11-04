// DOM layer: HUD, banners, pause menu, home panel, level select, settings, win card.
import { CFG, goalText } from './config.js';
import { starsLeft, storageAvailable } from './save.js';

const $ = (id) => document.getElementById(id);

export class UI {
  constructor(h) {
    this.h = h;
    this.el = { hud: $('hud'), money: $('money'), coin: $('coin'), lv: $('lvBadge'), goal: $('goalText'), bar: $('goalBar'), num: $('goalNum'),
                tip: $('tip'), banner: $('banner'), home: $('home'), stars: $('starCount'), list: $('restoreList'), hint: $('restoreHint'),
                play: $('btnPlay'), levels: $('levels'), grid: $('levelGrid'), settings: $('settings'), win: $('win'), pause: $('pause') };
    this.lastMoney = -1; this.lastGoal = ''; this.stack = []; this.page = 0;
    // 花园庄园 (stars from levels 1–15) / 林场牧场 (levels 16–30): one star pool, two estates
    for (const b of $('homeTabs').children) b.onclick = () => { this.page = +b.dataset.p; this.renderHome(h.data()); };
    $('btnPause').onclick = () => this.openPause();
    $('btnResume').onclick = () => this.closeModal(this.el.pause);
    $('btnHome').onclick = () => { this.closeAll(); h.home(); };
    $('btnPSettings').onclick = () => this.openSettings();
    $('btnPLevels').onclick = () => this.openLevels();
    $('hGear').onclick = () => this.openSettings();
    $('btnLevels').onclick = () => this.openLevels();
    this.el.play.onclick = () => h.play();
    $('btnNext').onclick = () => { this.el.win.classList.add('hidden'); h.next(); };
    for (const m of [this.el.levels, this.el.settings, this.el.pause]) {
      m.addEventListener('click', (e) => { if (e.target === m || e.target.hasAttribute('data-close')) this.closeModal(m); });
    }
    $('optSound').onchange = (e) => h.setting('sound', e.target.checked);
    $('optVib').onchange = (e) => h.setting('vib', e.target.checked);
    const reset = $('btnReset');
    reset.onclick = () => {
      if (!reset.dataset.armed) { reset.dataset.armed = '1'; reset.textContent = '再点一次：确定清空所有进度'; setTimeout(() => { delete reset.dataset.armed; reset.textContent = '重置全部进度'; }, 3000); return; }
      delete reset.dataset.armed; reset.textContent = '重置全部进度';
      this.closeAll(); this.page = 0; this._auto2 = false; h.reset();
    };
  }
  // modals stack: settings opened from pause returns to pause
  openModal(m) { if (!this.stack.includes(m)) this.stack.push(m); for (const x of this.stack) x.classList.add('hidden'); m.classList.remove('hidden'); this.h.modal(true); }
  closeModal(m) {
    m.classList.add('hidden'); this.stack = this.stack.filter((x) => x !== m);
    const top = this.stack[this.stack.length - 1];
    if (top) top.classList.remove('hidden'); else this.h.modal(false);
  }
  closeAll() { for (const m of this.stack) m.classList.add('hidden'); this.stack = []; this.h.modal(false); }
  coinCenter() { const r = this.el.coin.getBoundingClientRect(); return { x: r.left + 24, y: r.top + r.height / 2 }; }
  bumpCoin() { const c = this.el.coin; c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); clearTimeout(this._bt); this._bt = setTimeout(() => c.classList.remove('bump'), 90); }

  showHUD(world) {
    this.el.home.classList.add('hidden'); this.el.hud.classList.remove('hidden');
    this.el.lv.textContent = `等级 ${world.li + 1}`;
    this.el.goal.textContent = `${world.L.name} · ${goalText(world.L.goal)}`;
    this.lastMoney = -1; this.lastGoal = '';
    this.updateHUD(world);
  }
  updateHUD(world) {
    const m = Math.floor(world.money);
    if (m !== this.lastMoney) { this.el.money.textContent = m.toLocaleString('en-US'); this.lastMoney = m; }
    const p = world.progress();
    const s = `${Math.floor(p.v)}/${p.n}`;
    if (s !== this.lastGoal) { this.el.bar.style.width = `${(p.f * 100).toFixed(1)}%`; this.el.num.textContent = s; this.lastGoal = s; }
  }
  banner(world) {
    const b = this.el.banner;
    $('bannerLv').textContent = `等级 ${world.li + 1} · ${world.L.name}`;
    $('bannerGoal').textContent = `目标：${goalText(world.L.goal)}`;
    b.classList.add('hidden'); void b.offsetWidth; b.classList.remove('hidden');
    clearTimeout(this._bn); this._bn = setTimeout(() => b.classList.add('hidden'), 2500);
  }
  tip(text) {
    if (!text) { this.el.tip.classList.add('hidden'); this._tip = ''; return; }
    if (text === this._tip) return;
    this._tip = text; this.el.tip.textContent = text; this.el.tip.classList.remove('hidden');
  }
  openPause() {
    const w = this.h.world();
    $('pauseInfo').textContent = w ? `等级 ${w.li + 1} · ${w.L.name} — ${goalText(w.L.goal)}` : '';
    this.openModal(this.el.pause);
  }

  showHome(data) {
    this.el.hud.classList.add('hidden'); this.tip(''); this.el.home.classList.remove('hidden');
    this.renderHome(data);
  }
  renderHome(data) {
    const left = starsLeft(data);
    this.el.stars.textContent = left;
    const L = CFG.levels.length;
    const next = data.cur ? data.cur.li : Math.min(data.unlocked, L - 1);
    const allDone = data.unlocked >= L && !data.cur;
    this.el.play.textContent = data.cur ? `继续 第 ${next + 1} 关` : allDone ? `全部通关！再玩第 ${L} 关` : `开始 第 ${next + 1} 关 · ${CFG.levels[next].name}`;
    this.el.play.dataset.li = next;
    const restored = new Set(data.restored);
    if (!this.page) this.page = 1;
    if (data.unlocked >= 15 && !this._auto2) { this._auto2 = true; this.page = 2; }   // once past level 15, open on the new farm
    const page = this.page, metas = CFG.meta.filter((m) => (m.page || 1) === page);
    for (const b of $('homeTabs').children) {
      const p = +b.dataset.p, todo = CFG.meta.filter((m) => (m.page || 1) === p && !restored.has(m.id)).length;
      b.classList.toggle('on', p === page);
      b.innerHTML = `${p === 1 ? '花园庄园' : '林场牧场'}${todo ? '' : '<em>✓</em>'}`;
    }
    $('restoreHead').textContent = page === 1 ? '用星星修复庄园' : '用星星建林场牧场';
    const cheapest = metas.filter((m) => !restored.has(m.id)).reduce((a, m) => Math.min(a, m.cost), 99);
    this.el.hint.textContent = metas.every((m) => restored.has(m.id)) ? (page === 1 ? '· 庄园修好啦！' : '· 牧场建好啦！') : left >= cheapest ? '· 点一下就能修' : page === 2 && data.unlocked < 15 ? '· 第 16 关起拿星星' : '· 过关拿星星';
    this.el.list.innerHTML = '';
    for (const m of metas) {
      const b = document.createElement('button');
      const done = restored.has(m.id), can = !done && left >= m.cost;
      b.className = 'rbtn' + (done ? ' done' : can ? ' can' : ' poor');
      b.innerHTML = `<span>${m.name}</span><small>${done ? '✓ 已修好' : '★ ' + m.cost}</small>`;
      b.onclick = () => this.h.restore(m.id);
      this.el.list.appendChild(b);
    }
  }
  openLevels() {
    const d = this.h.data(); const g = this.el.grid; g.innerHTML = '';
    CFG.levels.forEach((L, i) => {
      const b = document.createElement('button');
      const lock = i > d.unlocked && !(d.cur && d.cur.li === i);
      const st = d.stars[i] || 0;
      b.className = 'lvb' + (lock ? ' lock' : '') + (d.cur && d.cur.li === i ? ' cur' : '');
      b.innerHTML = `${i + 1}<em>${L.name}</em><small>${lock ? '<i class="lk"></i>' : '★'.repeat(st) + '☆'.repeat(3 - st)}</small>`;
      b.title = L.name;
      if (!lock) b.onclick = () => { this.closeAll(); this.h.start(i); };
      g.appendChild(b);
    });
    this.openModal(this.el.levels);
    // 30 levels: scroll the next level to play into view
    const tgt = g.children[Math.min(CFG.levels.length - 1, d.cur ? d.cur.li : d.unlocked)];
    if (tgt && tgt.scrollIntoView) tgt.scrollIntoView({ block: 'center', inline: 'nearest' });
  }
  openSettings() {
    const d = this.h.data();
    $('optSound').checked = d.settings.sound; $('optVib').checked = d.settings.vib;
    const vibOk = typeof navigator.vibrate === 'function';
    $('storeNote').textContent = (storageAvailable() ? '进度自动保存在本机浏览器。' : '这个浏览器不能保存进度，关掉页面后会从头开始。') + (vibOk ? '' : ' 这台设备不支持震动。');
    this.openModal(this.el.settings);
  }
  showWin(li, stars, t, earned) {
    $('winTitle').textContent = `第 ${li + 1} 关 完成！`;
    const is = $('winStars').children;
    for (let i = 0; i < 3; i++) { is[i].classList.remove('on'); setTimeout(() => { if (i < stars) { is[i].classList.add('on'); this.h.starSfx(i); } }, 350 + i * 320); }
    const mm = Math.floor(t / 60), ss = String(Math.floor(t % 60)).padStart(2, '0');
    $('winStat').innerHTML = `用时 <b>${mm}:${ss}</b>${earned > 0 ? ` · 新得 <b>★${earned}</b>` : ''}<br>拿星星回庄园修花园吧`;
    this.el.win.classList.remove('hidden');
  }
  hideAll() { this.closeAll(); this.el.win.classList.add('hidden'); }
}
