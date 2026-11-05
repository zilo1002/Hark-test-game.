// DOM layer: HUD, banners, pause menu, home panel, level select, settings, win card.
import { CFG, goalText } from './config.js';
import { starsLeft, storageAvailable } from './save.js';
import { OUTFITS, DECOS, SLOTS, itemById, isOn } from './shop.js';

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
    // 商店
    this.el.shop = $('shop'); this.shopTab = 'outfit'; this.shopSel = null;
    $('btnShop').onclick = () => this.openShop();
    $('coinPill').onclick = () => this.openShop();
    for (const b of $('shopTabs').children) b.onclick = () => { this.shopTab = b.dataset.t; this.shopSel = null; this.renderShop(); h.tap(); };
    $('shopAct').onclick = () => {
      const it = this.shopSel && itemById(this.shopSel); if (!it) return;
      const d = h.data();
      if (!d.shop.owned.includes(it.id)) { const r = h.shopBuy(it.id); if (r !== 'ok') { const a = $('shopAct'); a.classList.remove('shake'); void a.offsetWidth; a.classList.add('shake'); } }
      else h.shopToggle(it.id);
      this.renderShop();
    };
    this.el.play.onclick = () => h.play();
    $('btnNext').onclick = () => { this.el.win.classList.add('hidden'); h.next(); };
    for (const m of [this.el.levels, this.el.settings, this.el.pause, this.el.shop]) {
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
    $('coinCount').textContent = (data.coins || 0).toLocaleString('en-US');
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
  // ---------------------------------------------------------------- 商店
  openShop() {
    const d = this.h.data();
    if (!this.shopSel) { const eq = d.shop.eq; this.shopSel = this.shopTab === 'outfit' ? (eq.hat || eq.top || OUTFITS[0].id) : (d.shop.deco[0] || DECOS[0].id); }
    this.openModal(this.el.shop);
    this.h.shopOpen();
    this.renderShop();
  }
  shopList() { return this.shopTab === 'outfit' ? OUTFITS : DECOS; }
  renderShop() {
    const d = this.h.data(), list = this.shopList();
    for (const b of $('shopTabs').children) b.classList.toggle('on', b.dataset.t === this.shopTab);
    if (!this.shopSel || !list.some((x) => x.id === this.shopSel)) this.shopSel = list[0].id;
    $('shopCoins').textContent = d.coins.toLocaleString('en-US'); $('coinCount').textContent = d.coins.toLocaleString('en-US');
    const g = $('shopGrid'); g.innerHTML = '';
    for (const it of list) {
      const b = document.createElement('button'), own = d.shop.owned.includes(it.id), on = isOn(d, it.id);
      b.className = 'sitem' + (own ? ' owned' : d.coins >= it.price ? ' can' : ' poor') + (on ? ' on' : '') + (it.id === this.shopSel ? ' sel' : '');
      b.dataset.id = it.id;
      const slot = it.slot ? SLOTS.find((x) => x[0] === it.slot)[1] : '';
      b.innerHTML = `<img alt="" src="${this.h.thumb(it) || ''}"><span>${it.name}</span><small>${own ? (on ? (it.slot ? '穿着中' : '已摆放') : '已拥有') : `<i class="gc"></i>${it.price}`}</small>`;
      b.title = slot ? `${slot} · ${it.name}` : it.name;
      b.onclick = () => { this.shopSel = it.id; this.h.tap(); this.renderShop(); };
      g.appendChild(b);
    }
    const it = itemById(this.shopSel), own = d.shop.owned.includes(it.id), on = isOn(d, it.id), a = $('shopAct');
    $('shopName').textContent = it.name;
    $('shopSub').textContent = it.slot ? `${SLOTS.find((x) => x[0] === it.slot)[1]}${own ? '' : ' · 买了自动穿上'}` : own ? (on ? '庄园和关卡里都看得到' : '收在仓库里') : '摆在庄园，关卡围栏外也有';
    a.className = 'small ' + (own ? (on ? 'off' : 'warm') : d.coins >= it.price ? 'warm' : 'poor');
    a.innerHTML = own ? (it.slot ? (on ? '脱下' : '穿上') : (on ? '收起来' : '摆出来')) : `购买 <i class="gc"></i>${it.price}`;
  }
  // what the preview shows: the farmer trying the selected piece on, or the selected decoration
  shopView() {
    const d = this.h.data(), it = itemById(this.shopSel || '');
    if (this.shopTab === 'deco') return { kind: 'deco', id: it && !it.slot ? it.id : DECOS[0].id };
    const eq = { ...d.shop.eq }; if (it && it.slot) eq[it.slot] = it.id;
    return { kind: 'person', eq };
  }
  shopOpenNow() { return !this.el.shop.classList.contains('hidden'); }
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
  showWin(li, stars, t, earned, coins = 0) {
    $('winTitle').textContent = `第 ${li + 1} 关 完成！`;
    const is = $('winStars').children;
    for (let i = 0; i < 3; i++) { is[i].classList.remove('on'); setTimeout(() => { if (i < stars) { is[i].classList.add('on'); this.h.starSfx(i); } }, 350 + i * 320); }
    const mm = Math.floor(t / 60), ss = String(Math.floor(t % 60)).padStart(2, '0');
    $('winStat').innerHTML = `用时 <b>${mm}:${ss}</b>${earned > 0 ? ` · 新得 <b>★${earned}</b>` : ''}<br>${coins > 0 ? `<span class="wcoin"><i class="gc"></i><b>+${coins}</b> 金币</span> · ` : ''}去商店换新衣服、新装饰吧`;
    this.el.win.classList.remove('hidden');
  }
  hideAll() { this.closeAll(); this.el.win.classList.add('hidden'); }
}
