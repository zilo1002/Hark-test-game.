// DOM layer: HUD, banners, pause menu, home panel, level select, settings, win card.
import { CFG, goalText } from './config.js';
import { starsLeft, storageAvailable } from './save.js';
import { OUTFITS, DECOS, UNIFORMS, PETS, SLOTS, itemById, isOn, onSale, festName } from './shop.js';
import { PAGES, pageEntries, pageProgress, pageDone, claimable, bookTotals } from './book.js';
import { festivalInfo, nextFestival, FESTIVALS, FEST_IDS } from './festival.js';
import { ROSTER, TRAITS, traitBonus, xpNeed, CREW } from './crew.js';
import { orderText, orderDone, TIER_NAME } from './orders.js';
import { seasonInfo, cropNames, isValleyLi, valleyOpen, valleySeason, valleyCrops } from './seasons.js';
import { dailyOpen, dailyFor, ensureDay, TIER_LABEL } from './daily.js';
import { MODES } from './layout.js';

const $ = (id) => document.getElementById(id);
const TABS = { 1: '花园庄园', 2: '林场牧场', 3: '湖畔酒庄' };
const QNAME = { auto: '自动', 0: '低', 1: '中', 2: '高' };
// horizontal swipe on an element → cb(+1 | -1)
function swipe(el, cb) {
  let x0 = null, y0 = 0;
  el.addEventListener('pointerdown', (e) => { x0 = e.clientX; y0 = e.clientY; });
  el.addEventListener('pointerup', (e) => { if (x0 === null) return; const dx = e.clientX - x0, dy = e.clientY - y0; x0 = null; if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) cb(dx < 0 ? 1 : -1); });
  el.addEventListener('pointercancel', () => { x0 = null; });
}

export class UI {
  constructor(h) {
    this.h = h;
    this.el = { hud: $('hud'), money: $('money'), coin: $('coin'), lv: $('lvBadge'), goal: $('goalText'), bar: $('goalBar'), num: $('goalNum'),
                tip: $('tip'), banner: $('banner'), home: $('home'), stars: $('starCount'), list: $('restoreList'), hint: $('restoreHint'),
                play: $('btnPlay'), levels: $('levels'), grid: $('levelGrid'), settings: $('settings'), win: $('win'), pause: $('pause'),
                menu: $('menu'), env: $('envInfo'), buildUI: $('build') };
    this.lastMoney = -1; this.lastGoal = ''; this.stack = []; this.page = 0; this.build = false; this.trayTab = 'build'; this.lvPage = -1;
    const tapped = (fn) => () => { h.tap(); fn(); };
    // v4.1 home: estate + 开始游戏 / 选择关卡; top-right 商店 · 设置 · 声音; bottom-right ★ = 装扮庄园
    for (const b of $('homeTabs').children) b.onclick = () => { this.page = +b.dataset.p; h.tap(); this.renderHome(h.data()); };
    for (const b of $('trayTabs').children) b.onclick = () => { this.trayTab = b.dataset.t; h.tap(); this.renderHome(h.data()); };
    $('btnBuild').onclick = tapped(() => this.setBuild(true));
    $('btnBuildDone').onclick = tapped(() => this.setBuild(false));
    $('hSound').onclick = () => { const on = !h.data().settings.sound; h.setting('sound', on); if (on) h.tap(); this.renderSound(); };
    $('hShop').onclick = () => this.openShop();
    $('coinPill').onclick = () => this.openShop();
    $('starPill').onclick = tapped(() => this.setBuild(true));
    $('envChip').onclick = tapped(() => this.openEnv());
    $('hGear').onclick = tapped(() => this.openMenu());
    // 设置 baskets
    $('mDaily').onclick = () => this.openDaily();
    $('mOrders').onclick = () => this.openOrders();
    $('mBook').onclick = () => this.openBook();
    $('mCrew').onclick = () => this.openCrew();
    $('mBuild').onclick = tapped(() => { this.closeAll(); this.setBuild(true); });
    $('mEnv').onclick = tapped(() => this.openEnv());
    $('mMode').onclick = tapped(() => this.openSettings('mode'));
    $('mQual').onclick = tapped(() => this.openSettings('qual'));
    $('mSave').onclick = tapped(() => this.openSettings());
    $('btnPause').onclick = () => this.openPause();
    $('btnResume').onclick = () => this.closeModal(this.el.pause);
    $('btnPRestart').onclick = () => { h.restart(); };
    $('btnPSettings').onclick = () => this.openSettings();
    $('btnPExit').onclick = () => { this.closeAll(); h.home(); };
    $('btnPSave').onclick = () => {
      h.tap(); const result = h.save(); const status = $('pauseSaveInfo');
      status.textContent = !result || !result.saved ? '当前没有可保存的关卡' : !result.persisted ? '浏览器本机存储不可用，刷新后可能无法续玩' : result.resumable ? '存档已保存，可继续本局' : result.reason === 'daily-run' ? '每日挑战不支持中途续存' : '本局已结束';
      status.classList.remove('hidden');
    };
    $('btnLevels').onclick = () => { h.tap(); this.openLevels(); };
    // v4.1 / v4.6: one tab per area (CFG.areas: 1–15 / 16–30 / 31–45 / 四季山谷 46–60)
    $('lvTabs').innerHTML = CFG.areas.map((A, i) => `<button data-p="${i}">${A.name}<em>${A.from + 1}–${A.from + A.size}</em></button>`).join('');
    for (const b of $('lvTabs').children) b.onclick = () => { this.lvPage = +b.dataset.p; h.tap(); this.renderLevels(); };
    // v4.6 四季山谷 season switchers (level select + pause): 春 夏 秋 冬
    const seaBtns = (el, restart) => { el.innerHTML = CFG.seasons.map((S, i) => `<button data-s="${i}" class="s${i}">${S.name}</button>`).join('');
      for (const b of el.children) b.onclick = () => { const v = +b.dataset.s; h.valleySeason(v, restart); this.renderSeasonRow(); if (!restart) this.renderLevels(); }; };
    seaBtns($('lvSeaBtns'), false); seaBtns($('pSeaBtns'), true);
    $('btnValley').onclick = () => { h.tap(); this.openLevels(CFG.areas.length - 1); };
    $('lvGo').onclick = () => { const li = +$('lvGo').dataset.li; this.closeAll(); h.start(li); };
    swipe($('levelGrid').parentNode, (d) => { const n = Math.max(0, Math.min(CFG.areas.length - 1, this.lvPage + d)); if (n !== this.lvPage) { this.lvPage = n; h.tap(); this.renderLevels(); } });
    // 商店
    this.el.shop = $('shop'); this.shopTab = 'outfit'; this.shopSel = null;
    for (const b of $('shopTabs').children) b.onclick = () => { this.shopTab = b.dataset.t; this.shopSel = null; this.renderShop(); h.tap(); };
    $('shopAct').onclick = () => {
      const it = this.shopSel && itemById(this.shopSel); if (!it) return;
      const d = h.data();
      if (!d.shop.owned.includes(it.id)) { const r = h.shopBuy(it.id); if (r !== 'ok') { const a = $('shopAct'); a.classList.remove('shake'); void a.offsetWidth; a.classList.add('shake'); } }
      else h.shopToggle(it.id);
      this.renderShop();
    };
    // 订单板 / 雇工 / 图鉴 / 每日挑战
    this.el.orders = $('orders'); this.el.crew = $('crew');
    this.el.book = $('book'); this.bookPage = 'crops';
    for (const b of $('bookTabs').children) b.onclick = () => { this.bookPage = b.dataset.p; h.tap(); this.renderBook(); };
    $('bookClaim').onclick = () => { const r = h.bookClaim(this.bookPage); if (r) this.renderBook(); };
    this.el.daily = $('daily'); this.el.dres = $('dailyRes');
    $('btnDailyGo').onclick = () => { this.closeAll(); h.dailyStart(); };
    $('btnDrAgain').onclick = () => { this.el.dres.classList.add('hidden'); h.dailyStart(); };
    $('btnDrHome').onclick = () => { this.el.dres.classList.add('hidden'); h.home(); };
    this.el.play.onclick = () => h.play();
    $('btnNext').onclick = () => { this.el.win.classList.add('hidden'); h.next(); };
    for (const m of [this.el.levels, this.el.settings, this.el.pause, this.el.shop, this.el.orders, this.el.crew, this.el.daily, this.el.book, this.el.menu, this.el.env]) {
      m.addEventListener('click', (e) => { if ((e.target === m && !m.classList.contains('dock')) || (e.target.closest && e.target.closest('[data-close]'))) this.closeModal(m); });
    }
    $('optSound').onchange = (e) => { h.setting('sound', e.target.checked); this.renderSound(); };
    $('optVib').onchange = (e) => h.setting('vib', e.target.checked);
    for (const b of $('optQual').children) b.onclick = () => { h.setting('quality', b.dataset.q === 'auto' ? 'auto' : +b.dataset.q); h.tap(); this.renderSettings(); };
    for (const b of $('optMode').children) b.onclick = () => { h.setting('mode', b.dataset.m); h.tap(); this.renderSettings(); };
    const reset = $('btnReset');
    reset.onclick = () => {
      if (!reset.dataset.armed) { reset.dataset.armed = '1'; reset.textContent = '再点一次：确定清空所有进度'; setTimeout(() => { delete reset.dataset.armed; reset.textContent = '重置全部进度'; }, 3000); return; }
      delete reset.dataset.armed; reset.textContent = '重置全部进度';
      this.closeAll(); this.page = 0; this._auto2 = this._auto3 = false; this.setBuild(false, true); h.reset();
    };
  }
  renderSound() { const on = !!this.h.data().settings.sound; $('hSound').classList.toggle('muted', !on); $('hSound').setAttribute('aria-label', on ? '声音：开' : '声音：关'); }
  // ★ 装扮庄园: build spots with stars, place / store decorations, switch the three estates
  setBuild(on, quiet) {
    this.build = !!on;
    this.el.buildUI.classList.toggle('hidden', !on || this.el.home.classList.contains('hidden'));
    this.el.home.classList.toggle('building', !!on);
    document.body.classList.toggle('inbuild', !!on);
    if (!quiet) { this.renderHome(this.h.data()); this.h.layout(); }
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
  bumpCoin() { }   // v3.7 写死: the money pill no longer bounces
  // recent earnings, shown as one fixed "+N" line under the money pill (sums the last 2.5 s)
  earn(amount, now) { (this._earn || (this._earn = [])).push([now, amount]); }
  // short static message above the stack badge (unlock / fever / level-ups): no motion, just shown then hidden
  note(text, now) { this._note = text; this._noteT = now; }

  showHUD(world) {
    this.el.home.classList.add('hidden'); this.el.hud.classList.remove('hidden'); $('hudBottom').classList.remove('hidden');
    this.el.buildUI.classList.add('hidden'); this.dock();
    this._earn = []; this._note = ''; this._hudAt = -1e9; this._earnS = null; this._stackS = null; this._noteS = null;
    this.el.lv.textContent = world.daily ? '3:00' : `等级 ${world.li + 1}`;
    this.el.lv.classList.toggle('timer', !!world.daily); this._tm = '';
    this.el.goal.textContent = world.daily ? `每日挑战 · ${world.daily.name}` : `${world.L.name} · ${goalText(world.L.goal)}`;
    this.lastMoney = -1; this.lastGoal = '';
    // v4.0: fixed season / rain pills under the goal (only when they matter in this level)
    const sc = world.seasonCrops(), se = $('envSeason');
    if (sc.length) { const S = CFG.seasons[world.season]; se.textContent = `${S.name} · ${cropNames(sc).join(' ')} 生长+${Math.round(CFG.season.bonus * 100)}%`; se.className = `sea s${world.season}`; }
    else se.className = 'sea hidden';
    $('envRain').classList.toggle('hidden', !world.rain);
    this.updateHUD(world);
  }
  updateHUD(world, force) {
    // v3.7 写死: values update in place, at most ~4× per second, so digits never flicker or roll
    const now = performance.now() / 1000;
    if (!force && now - (this._hudAt || -1e9) < 0.25) return;
    this._hudAt = now;
    const p0 = world.player, n0 = p0.stack.length + p0.incoming, full = n0 >= p0.cap && p0.stack.length > 0;
    const st = full ? 'MAX · 去出售' : `${p0.stack.length}/${p0.cap}`;
    if (st !== this._stackS) { const b = $('stackBadge'); b.textContent = st; b.classList.toggle('full', full); this._stackS = st; }
    const E = this._earn || []; while (E.length && now - E[0][0] > 2.5) E.shift();
    const sum = Math.round(E.reduce((a, x) => a + x[1], 0)), es = sum > 0 ? `+${sum.toLocaleString('en-US')}` : '';
    if (es !== this._earnS) { const e = $('earn'); e.textContent = es || '\u00a0'; e.classList.toggle('on', !!es); this._earnS = es; }
    const ns = this._note && now - this._noteT < 1.8 ? this._note : '';
    if (ns !== this._noteS) { const e = $('hudNote'); e.textContent = ns || '\u00a0'; e.classList.toggle('on', !!ns); this._noteS = ns; }
    const m = Math.floor(world.money);
    if (m !== this.lastMoney) { this.el.money.textContent = m.toLocaleString('en-US'); this.lastMoney = m; }
    if (world.daily) {   // 每日挑战: the level badge is the countdown, the bar is money earned vs the gold mark
      const left = Math.max(0, Math.ceil(world.timeLimit - world.t)), tm = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
      if (tm !== this._tm) { this.el.lv.textContent = tm; this.el.lv.classList.toggle('hurry', left <= 20); this._tm = tm; }
      const e = Math.floor(world.won ? world.score : world.stats.earned), T = world.daily.tiers, tier = e >= T[2] ? 3 : e >= T[1] ? 2 : e >= T[0] ? 1 : 0;
      const s2 = `${e.toLocaleString('en-US')}${tier ? ' · ' + TIER_LABEL[tier] : ''}`;
      if (s2 !== this.lastGoal) { this.el.bar.style.width = `${Math.min(100, e / T[2] * 100).toFixed(1)}%`; this.el.num.textContent = s2; this.lastGoal = s2; }
      return;
    }
    const p = world.progress();
    const s = `${Math.floor(p.v)}/${p.n}`;
    if (s !== this.lastGoal) { this.el.bar.style.width = `${(p.f * 100).toFixed(1)}%`; this.el.num.textContent = s; this.lastGoal = s; }
  }
  // small, unobtrusive line under the goal bar: the order this level can advance
  orderHUD(o) {
    const e = $('ordHud');
    if (!o) { if (this._oh !== '') { e.classList.add('hidden'); this._oh = ''; } return; }
    const done = o.prog >= o.n, txt = done ? `订单完成 ✓ 回庄园领取` : `订单 · ${orderText(o)}  ${Math.floor(o.prog)}/${o.n}`;
    if (txt === this._oh) return;
    this._oh = txt; e.textContent = txt; e.classList.toggle('done', done); e.classList.remove('hidden');
  }
  banner(world) {
    const b = this.el.banner;
    $('bannerLv').textContent = world.daily ? `每日挑战 · ${world.L.name}` : `等级 ${world.li + 1} · ${world.L.name}`;
    $('bannerGoal').textContent = world.daily ? `${world.daily.name}：${world.daily.desc} · 3 分钟` : `目标：${goalText(world.L.goal)}${world.valley ? ` · 四季山谷·${CFG.seasons[world.season].full}` : ''}${world.rain ? ' · 今天下雨，生长 +25%' : ''}`;
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
    $('pauseSaveInfo').classList.add('hidden');
    $('pauseSaveInfo').textContent = '';
    $('pauseInfo').textContent = !w ? '' : w.daily ? `每日挑战 · ${w.L.name} — ${w.daily.name}（重新开始会重开本局）` : `等级 ${w.li + 1} · ${w.L.name} — ${goalText(w.L.goal)}`;
    $('pSea').classList.toggle('hidden', !(w && !w.daily && w.valley));
    this.renderSeasonRow();
    this.openModal(this.el.pause);
  }

  showHome(data) {
    this.el.hud.classList.add('hidden'); $('hudBottom').classList.add('hidden'); this.tip(''); this.el.home.classList.remove('hidden');
    this.el.buildUI.classList.toggle('hidden', !this.build);
    this.renderHome(data); this.dock();
  }
  // two-pane 双屏 (duo, landscape): the 设置 baskets stay docked in the right pane on the farm screen
  dock() {
    const on = document.body.classList.contains('twopane') && !this.el.home.classList.contains('hidden') && !this.build;
    const m = this.el.menu;
    if (on) { m.classList.add('dock'); if (!this.stack.length) m.classList.remove('hidden'); this.renderMenu(); }
    else if (m.classList.contains('dock')) { m.classList.remove('dock'); if (!this.stack.includes(m)) m.classList.add('hidden'); }
  }
  renderHome(data) {
    const left = starsLeft(data);
    this.el.stars.textContent = left; $('starCount2').textContent = left;
    $('coinCount').textContent = (data.coins || 0).toLocaleString('en-US');
    this.renderSound();
    const L = CFG.levels.length;
    const next = data.cur ? data.cur.li : Math.min(data.unlocked, L - 1);
    const allDone = data.unlocked >= L && !data.cur;
    this.el.play.querySelector('span').textContent = data.cur ? '继续游戏' : '开始游戏';
    $('playSub').textContent = allDone ? `全部通关！再玩第 ${L} 关` : `第 ${next + 1} 关 · ${CFG.levels[next].name}`;
    this.el.play.dataset.li = next;
    $('btnValley').classList.toggle('hidden', !valleyOpen(data));   // v4.6 四季山谷 entry on the home screen
    const restored = new Set(data.restored);
    if (!this.page) this.page = 1;
    if (data.unlocked >= 15 && !this._auto2) { this._auto2 = true; this.page = 2; }   // once past level 15, open on the new farm
    if (data.unlocked >= 38 && !this._auto3) { this._auto2 = this._auto3 = true; this.page = 3; }   // once past level 38, open on the lakeside winery
    const page = this.page, metas = CFG.meta.filter((m) => (m.page || 1) === page);
    const canAny = CFG.meta.some((m) => !restored.has(m.id) && left >= m.cost && !((m.page || 1) === 3 && data.unlocked < 38));
    for (const b of $('homeTabs').children) {
      const p = +b.dataset.p, todo = CFG.meta.filter((m) => (m.page || 1) === p && !restored.has(m.id)).length;
      b.classList.toggle('on', p === page);
      b.innerHTML = `${TABS[p]}${todo ? '' : '<em>✓</em>'}`;
    }
    const locked3 = page === 3 && data.unlocked < 38;
    const cheapest = metas.filter((m) => !restored.has(m.id)).reduce((a, m) => Math.min(a, m.cost), 99);
    const doneN = metas.filter((m) => restored.has(m.id)).length;
    this.el.hint.textContent = metas.every((m) => restored.has(m.id)) ? (page === 1 ? '庄园修好啦！' : page === 2 ? '牧场建好啦！' : '酒庄建好啦！')
      : locked3 ? '过第 38 关开放' : left >= cheapest ? '点卡片或庄园上的虚线圈，用星星建造' : page === 2 && data.unlocked < 15 ? '第 16 关起拿星星' : '过关拿星星';
    $('buildHint').textContent = `${doneN}/${metas.length}`;
    // 季节 / 节日: a tiny badge by the title (tap for details)
    const hm = data.homeMap || { mode: 'calendar', season: null, festival: null };
    const chosenSeason = hm.mode === 'season' && Number.isInteger(hm.season) ? hm.season : seasonInfo().i;
    const shownFestival = hm.mode === 'festival' && FEST_IDS.includes(hm.festival) && (data.festivalMaps || []).includes(hm.festival) ? FESTIVALS[hm.festival] : (hm.mode === 'calendar' ? festivalInfo() : null);
    for (const id of ['seasonBadge', 'seasonBadge2']) { const sb = $(id); sb.textContent = CFG.seasons[chosenSeason].name; sb.className = `sbadge s${chosenSeason}`; }
    const fb = $('festBadge'); if (shownFestival) { fb.className = `fbadge ${shownFestival.id}`; fb.textContent = shownFestival.name.slice(0, 1); } else fb.className = 'fbadge hidden';
    // red dots: 订单 ready / 图鉴 reward → their tile, and the 设置 icon; a spot you can afford → the ★ button
    const O = data.orders, ordReady = !!(O && O.list.some((o) => !o.claimed && orderDone(o))), bookReady = claimable(data).length > 0;
    $('ordDot').classList.toggle('hidden', !ordReady); $('bookDot').classList.toggle('hidden', !bookReady);
    $('gearDot').classList.toggle('hidden', !(ordReady || bookReady));
    $('buildDot').classList.toggle('hidden', !canAny || this.build); $('mBuildDot').classList.toggle('hidden', !canAny);
    for (const b of $('trayTabs').children) b.classList.toggle('on', b.dataset.t === this.trayTab);
    this.el.list.innerHTML = '';
    if (this.trayTab === 'deco') this.renderDecoTray(data);
    else for (const m of metas) {
      const b = document.createElement('button');
      const done = restored.has(m.id), can = !done && !locked3 && left >= m.cost;
      b.className = 'rbtn' + (done ? ' done' : can ? ' can' : ' poor');
      b.innerHTML = `<span>${m.name}</span><small>${done ? '✓ 已建好' : (locked3 ? '未开放 ★' : '★ ') + m.cost}</small>`;
      b.onclick = () => this.h.restore(m.id);
      this.el.list.appendChild(b);
    }
    if (this.el.menu.classList.contains('dock') || !this.el.menu.classList.contains('hidden')) this.renderMenu();
  }
  // 装饰 tray: every decoration you own can be put out on the estate or stored; the rest link to the shop
  renderDecoTray(data) {
    const own = new Set(data.shop.owned), list = DECOS.filter((it) => own.has(it.id) || (!it.fest && !it.book) || onSale(it));
    $('restoreHint').textContent = '摆出来的装饰在庄园和关卡围栏外都看得到';
    for (const it of list) {
      const b = document.createElement('button'), o = own.has(it.id), on = isOn(data, it.id);
      b.className = 'rbtn deco' + (on ? ' done on' : o ? '' : ' poor');
      b.innerHTML = `<img alt="" src="${this.h.thumb(it) || ''}"><span>${it.name}</span><small>${o ? (on ? '✓ 摆着' : '收着 · 点一下摆出') : `<i class="gc"></i>${it.price} 去商店`}</small>`;
      b.onclick = () => { if (o) { this.h.shopToggle(it.id); this.renderHome(this.h.data()); } else { this.shopTab = 'deco'; this.shopSel = it.id; this.openShop(); } };
      this.el.list.appendChild(b);
    }
  }
  // ---------------------------------------------------------------- 设置 (baskets)
  openMenu() { this.renderMenu(); if (this.el.menu.classList.contains('dock')) return; this.openModal(this.el.menu); }
  renderMenu() {
    const d = this.h.data(), O = d.orders;
    if (!dailyOpen(d)) $('mDailySub').textContent = `过第 ${CFG.daily.unlockAfter} 关开放`;
    else { const D = d.daily, td = D && D.day === dailyFor(d).day ? D : null; $('mDailySub').textContent = td && td.best ? `今日最佳 ${td.best.toLocaleString('en-US')}${td.paid ? ' · ' + TIER_LABEL[td.paid] : ''}` : '今天还没挑战'; }
    $('mDaily').classList.toggle('lock', !dailyOpen(d));
    const ready = O ? O.list.filter((o) => !o.claimed && orderDone(o)).length : 0, open = O ? O.list.filter((o) => !o.claimed).length : 0;
    $('mOrdSub').textContent = ready ? `${ready} 张可以领取` : `${open} 张进行中`;
    const T = bookTotals(d); $('mBookSub').textContent = claimable(d).length ? '有奖励可以领' : `已收录 ${T.got}/${T.n}`;
    $('mCrewSub').textContent = `${ROSTER.length} 人 · 最高 ${Math.max(1, ...d.crew.map((m) => m.lv || 1))} 级`;
    const left = starsLeft(d); $('mBuildSub').textContent = `★ ${left} · 建造和摆装饰`;
    const si = seasonInfo(), fi = festivalInfo();
    $('mEnvT').textContent = fi ? `${si.full} · ${fi.name}` : si.full;
    $('mEnvSub').textContent = fi ? `${fi.name}还剩 ${fi.left} 天` : `${cropNames(si.crops).join(' ')} +${Math.round(CFG.season.bonus * 100)}%`;
    const L = this.h.layoutInfo(); $('mModeSub').textContent = d.settings.mode && d.settings.mode !== 'auto' ? MODES[d.settings.mode] : `自动 · ${MODES[L.detected]}`;
    $('mQualSub').textContent = QNAME[d.settings.quality ?? 'auto'];
    $('mSaveSub').textContent = `震动${d.settings.vib ? '开' : '关'} · 重置进度`;
  }
  openEnv() {
    const si = seasonInfo(), fi = festivalInfo(), nf = nextFestival(), data = this.h.data();
    const hm = data.homeMap || { mode: 'calendar', season: null, festival: null };
    const modes = [
      ['calendar', '跟随日历'],
      ...CFG.seasons.map((S, i) => [`season:${i}`, S.full]),
    ];
    const modeRoot = $('homeMapModes');
    modeRoot.innerHTML = modes.map(([key, label]) => {
      const active = key === 'calendar' ? hm.mode === 'calendar' : hm.mode === 'season' && hm.season === Number(key.split(':')[1]);
      return `<button class="${active ? 'on' : ''}" data-home-map="${key}">${label}</button>`;
    }).join('');
    for (const b of modeRoot.children) b.onclick = () => {
      const key = b.dataset.homeMap;
      if (key === 'calendar') this.h.homeMap('calendar');
      else this.h.homeMap('season', +key.split(':')[1]);
      this.closeAll(); this.renderHome(this.h.data());
    };
    const owned = (data.festivalMaps || []).filter((id) => FEST_IDS.includes(id));
    const festRoot = $('festivalMapChoices');
    $('festivalMapTitle').classList.toggle('hidden', !owned.length);
    festRoot.classList.toggle('hidden', !owned.length);
    festRoot.innerHTML = owned.map((id) => {
      const f = FESTIVALS[id], active = hm.mode === 'festival' && hm.festival === id;
      return `<button class="${active ? 'on' : ''}" data-festival-map="${id}">${f.icon} ${f.name}</button>`;
    }).join('');
    for (const b of festRoot.children) b.onclick = () => {
      this.h.homeMap('festival', b.dataset.festivalMap);
      this.closeAll(); this.renderHome(this.h.data());
    };
    $('homeMapNote').textContent = owned.length ? '节日地图解锁后会一直保留；主页地图只改变庄园外观，不影响关卡效果。' : '先在节日活动期间进入游戏，即可永久收藏该节日地图。切换只影响庄园外观，不影响关卡效果。';
    $('seasonText').textContent = `${si.full}（第 ${si.day} 天）· 当季 ${cropNames(si.crops).join(' ')} 生长 +${Math.round(CFG.season.bonus * 100)}% · ${si.left <= 1 ? '明天换季' : `${si.left} 天后换季`}`;
    const fb = $('festBanner');
    if (fi) { fb.className = `fest ${fi.id}`; $('festBadge2').textContent = fi.name.slice(0, 1); $('festText').textContent = `${fi.name}活动 · ${fi.desc} · ${fi.left <= 1 ? '今天最后一天' : `还剩 ${fi.left} 天`} · 商店有限定`; }
    else fb.className = 'fest hidden';
    $('festNext').textContent = nf ? `下一个节日：${nf.name}（${nf.inDays} 天后）` : '';
    this.openModal(this.el.env);
  }
  // ---------------------------------------------------------------- 商店
  openShop() {
    const d = this.h.data();
    if (!this.shopSel) { const eq = d.shop.eq; this.shopSel = this.shopTab === 'outfit' ? (eq.hat || eq.top || OUTFITS[0].id) : this.shopTab === 'uni' ? (d.shop.uni || UNIFORMS[0].id) : this.shopTab === 'pet' ? (d.shop.pet.dog || d.shop.pet.cat || PETS[0].id) : (d.shop.deco[0] || DECOS[0].id); }
    this.openModal(this.el.shop);
    this.h.shopOpen();
    this.renderShop();
  }
  // limited items are listed only while their festival is on (or once owned); 图鉴 rewards only once earned
  shopList() {
    const d = this.h.data(), own = (it) => d.shop.owned.includes(it.id);
    const L = this.shopTab === 'outfit' ? OUTFITS : this.shopTab === 'uni' ? UNIFORMS : this.shopTab === 'pet' ? PETS : DECOS;
    return L.filter((it) => (!it.fest && !it.book) || own(it) || (it.fest && onSale(it)));
  }
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
      const tag = it.fest ? `<em class="lim">${festName(it)}限定</em>` : it.book ? '<em class="lim bk">图鉴</em>' : '';
      b.innerHTML = `${tag}<img alt="" src="${this.h.thumb(it) || ''}"><span>${it.name}</span><small>${own ? (on ? (it.slot || it.uni ? '穿着中' : it.pet ? '陪着你' : '已摆放') : '已拥有') : `<i class="gc"></i>${it.price}`}</small>`;
      b.title = slot ? `${slot} · ${it.name}` : it.name;
      b.onclick = () => { this.shopSel = it.id; this.h.tap(); this.renderShop(); };
      g.appendChild(b);
    }
    const it = itemById(this.shopSel), own = d.shop.owned.includes(it.id), on = isOn(d, it.id), a = $('shopAct');
    $('shopName').textContent = it.name;
    const petSub = it.pet === 'dog' ? (own ? (on ? '关卡里跟着你，偶尔叼来作物' : '在家休息') : '关卡里跟着你跑，偶尔叼来附近的作物放进背篓') : it.pet === 'cat' ? (own ? (on ? '在庄园里晒太阳' : '在家休息') : '在庄园门前懒洋洋地晒太阳') : '';
    $('shopSub').textContent = it.pet ? petSub : (it.fest && !own ? `${festName(it)}限定 · 活动结束就买不到了 · ` : '') + (it.uni ? (own ? (on ? '所有雇工都穿着' : '一次只能穿一套') : '买了雇工们马上换上') : it.slot ? `${SLOTS.find((x) => x[0] === it.slot)[1]}${own ? '' : ' · 买了自动穿上'}` : own ? (on ? '庄园和关卡里都看得到' : '收在仓库里') : '摆在庄园，关卡围栏外也有');
    a.className = 'small ' + (own ? (on ? 'off' : 'warm') : d.coins >= it.price ? 'warm' : 'poor');
    a.innerHTML = own ? (it.slot || it.uni ? (on ? '脱下' : '穿上') : it.pet ? (on ? '让它休息' : '带上它') : (on ? '收起来' : '摆出来')) : `购买 <i class="gc"></i>${it.price}`;
    const nf = nextFestival(), fi = festivalInfo();
    $('shopHow').textContent = this.shopTab === 'pet' ? '小狗：关卡里跟着你，大约每 9 秒叼回 1–2 个附近成熟的作物（背篓满了就只跟着）。小猫：庄园里的装饰伙伴。各一只，可以随时换。'
      : fi ? `${fi.name}限定商品只在活动期间（还剩 ${fi.left} 天）出售，买下的永久保留。` : `过关就能拿金币：每关保底 10 + 本关收入的 2% + 每颗星 10；第一次拿到的星星每颗再 +20。${nf ? `下一个节日：${nf.name}（${nf.inDays} 天后）。` : ''}`;
  }
  // what the preview shows: the farmer trying the selected piece on, or the selected decoration
  shopView() {
    const d = this.h.data(), it = itemById(this.shopSel || '');
    if (this.shopTab === 'pet') return { kind: 'pet', id: it && it.pet ? it.id : PETS[0].id };
    if (this.shopTab === 'deco') return { kind: 'deco', id: it && !it.slot && !it.uni && !it.pet ? it.id : DECOS[0].id };
    if (this.shopTab === 'uni') { const u = it && it.uni ? it : UNIFORMS[0]; return { kind: 'person', uni: u.id, style: u.style }; }
    const eq = { ...d.shop.eq }; if (it && it.slot) eq[it.slot] = it.id;
    return { kind: 'person', eq };
  }
  // ---------------------------------------------------------------- 订单板
  openOrders() { this.h.orders(); this.openModal(this.el.orders); this.renderOrders(); }
  renderOrders() {
    const d = this.h.data(), O = d.orders, box = $('ordList'); box.innerHTML = '';
    $('ordCoins').textContent = (d.coins || 0).toLocaleString('en-US');
    O.list.forEach((o, i) => {
      const row = document.createElement('div'), done = orderDone(o);
      row.className = 'ord' + (o.claimed ? ' claimed' : done ? ' done' : '');
      const tk = o.ticket && itemById(o.ticket);
      row.innerHTML = `<div class="oi"><div class="ow">${o.who} 想要</div><div class="ot"><span class="tier t${o.tier}">${TIER_NAME[o.tier]}</span>${orderText(o)}</div>`
        + `<div class="ob"><i style="width:${Math.min(100, o.prog / o.n * 100).toFixed(1)}%"></i></div><div class="op">${Math.floor(o.prog).toLocaleString('en-US')} / ${o.n.toLocaleString('en-US')}</div></div>`
        + `<div class="or"><i class="gc"></i>${o.coins}${tk ? `<small>+ 兑换券：${tk.name}</small>` : ''}</div><div class="oa"></div>`;
      const act = row.querySelector('.oa');
      if (o.claimed) act.innerHTML = '<button class="small off" disabled>已领取</button>';
      else {
        const c = document.createElement('button'); c.className = 'small ' + (done ? 'warm claim' : 'poor'); c.textContent = done ? '领取' : '进行中';
        c.onclick = () => { if (!done) return; const r = this.h.claim(i); if (r) this.renderOrders(); };
        act.appendChild(c);
        if (!done && !O.swapped) { const sw = document.createElement('button'); sw.className = 'small swap'; sw.textContent = '换一张'; sw.onclick = () => { this.h.swap(i); this.renderOrders(); }; act.appendChild(sw); }
      }
      box.appendChild(row);
    });
    $('ordNote').textContent = `每天 3 张新订单，在任何关卡里卖出 / 做出的东西都算数。${O.swapped ? '今天已经换过 1 张了。' : '每天可以换掉 1 张。'}`;
  }
  // ---------------------------------------------------------------- 雇工
  openCrew() { this.h.tap(); this.openModal(this.el.crew); this.renderCrew(); }
  renderCrew() {
    const d = this.h.data(), box = $('crewList'); box.innerHTML = '';
    const cols = ['#3B8FE0', '#E8452C', '#4CB24E', '#F29C0E', '#B07ACC', '#FF6F92'];
    ROSTER.forEach((r, k) => {
      const m = d.crew.find((x) => x.id === r.id) || { lv: 1, xp: 0, done: 0 }, T = TRAITS[r.trait], max = m.lv >= CREW.maxLv;
      const row = document.createElement('div'); row.className = 'cw'; row.dataset.id = r.id;
      row.innerHTML = `<div class="ca" style="background:${cols[k % cols.length]}">${r.name[0]}</div><div class="ci"><div class="cn">${r.name}<b>${m.lv} 级</b></div>`
        + `<div class="ct">特长「${T.name}」 ${T.desc} +${Math.round(traitBonus(m.lv) * 100)}%</div>`
        + `<div class="cb"><i style="width:${max ? 100 : Math.min(100, m.xp / xpNeed(m.lv) * 100).toFixed(1)}%"></i></div>`
        + `<div class="cx">${max ? '满级！' : `经验 ${m.xp} / ${xpNeed(m.lv)}`} · 共送货 ${m.done.toLocaleString('en-US')} 件</div></div>`;
      box.appendChild(row);
    });
  }
  // ---------------------------------------------------------------- 图鉴
  openBook(page) { if (page) this.bookPage = page; this.h.bookOpen(); this.openModal(this.el.book); this.renderBook(); }
  renderBook() {
    const d = this.h.data(), P = this.bookPage, cols = ['#3B8FE0', '#E8452C', '#4CB24E', '#F29C0E', '#B07ACC', '#FF6F92'];
    for (const b of $('bookTabs').children) { const q = pageProgress(d, b.dataset.p), done = q.got >= q.n; b.classList.toggle('on', b.dataset.p === P); b.innerHTML = `${PAGES.find((x) => x.id === b.dataset.p).name} <em>${done ? '✓' : `${q.got}/${q.n}`}</em>`; }
    const T = bookTotals(d); $('bookTot').textContent = `已收录 ${T.got} / ${T.n}`;
    const g = $('bookGrid'); g.innerHTML = '';
    pageEntries(d, P).forEach((e, k) => {
      const b = document.createElement('div'); b.className = 'bent' + (e.got ? '' : ' lock') + (e.kind === 'gold' && e.got ? ' gold' : ''); b.dataset.id = e.id;
      const pic = e.kind === 'crew' ? `<div class="ava" style="background:${cols[k % cols.length]}">${e.name[0]}</div>` : `<img alt="" src="${this.h.bookThumb(e.kind === 'gold' ? 'gold' : e.kind === 'animal' ? 'animal' : 'item', e.id) || ''}">`;
      const n = e.count.toLocaleString('en-US');
      const sub = !e.got ? '未收集' : e.sub ? e.sub : e.kind === 'crew' ? `送货 ${n} · ${e.lv} 级` : e.kind === 'gold' ? `金色 ×${n}` : e.count ? `收获 ${n}` : '已发现';
      b.innerHTML = `${pic}<span>${e.got ? e.name : '？？？'}</span><small>${sub}</small>`;
      g.appendChild(b);
    });
    const page = PAGES.find((x) => x.id === P), paid = d.book.paid.includes(P), done = pageDone(d, P), q = pageProgress(d, P), c = $('bookClaim');
    $('bookReward').textContent = paid ? `本页已集齐，奖励「${page.rewardText}」已领取` : done ? `本页集齐！奖励：${page.rewardText}` : `集齐本页（还差 ${q.n - q.got} 个）奖励：${page.rewardText}${page.reward.item ? '（限定）' : ''}`;
    c.className = 'small ' + (done && !paid ? 'warm' : 'off'); c.textContent = paid ? '已领取' : '领取'; c.disabled = !(done && !paid);
  }
  // ---------------------------------------------------------------- 每日挑战
  openDaily() {
    const d = this.h.data();
    if (!dailyOpen(d)) { this.h.locked(); const b = $('mDaily'); b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); return; }
    this.h.tap();
    const dc = dailyFor(d); if (ensureDay(d, dc.day, dc)) this.h.save();
    const D = d.daily;
    $('dailyCoins').textContent = (d.coins || 0).toLocaleString('en-US');
    $('dailyLevel').textContent = `${dc.day.slice(5).replace('-', '月')}日 · ${dc.L.name}（第 ${dc.li + 1} 关的庄园）`;
    $('dailyTwist').textContent = `今日变化「${dc.name}」：${dc.desc}`;
    $('dailyTiers').innerHTML = dc.tiers.map((t, i) => `<div class="dtier t${i + 1}${D.paid > i ? ' got' : ''}">${TIER_LABEL[i + 1]}<b>${t.toLocaleString('en-US')}</b><small><i class="gc"></i>${CFG.daily.coins[i]}</small></div>`).join('');
    $('dailyBest').textContent = `今日最佳 ${D.best.toLocaleString('en-US')}（挑战 ${D.plays} 次） · 历史最佳 ${D.allBest.toLocaleString('en-US')}${D.allBestDay ? `（${D.allBestDay.slice(5)}）` : ''}`;
    this.openModal(this.el.daily);
  }
  showDailyRes(r, dc) {
    $('drTitle').textContent = r.tier ? `${TIER_LABEL[r.tier]}！` : '时间到！';
    const m = $('drMedal'); m.className = `medal m${r.tier}`; m.textContent = r.tier ? TIER_LABEL[r.tier].slice(0, 1) : '—';
    const next = r.tier < 3 ? `离${TIER_LABEL[r.tier + 1]}还差 ${(dc.tiers[r.tier] - r.score).toLocaleString('en-US')}` : '今天的最高档拿到啦';
    $('drStat').innerHTML = `3 分钟赚到 <b>${r.score.toLocaleString('en-US')}</b>${r.newBest && r.score > 0 ? ' · 新纪录' : ''}<br>今日最佳 <b>${r.best.toLocaleString('en-US')}</b> · 历史最佳 <b>${r.allBest.toLocaleString('en-US')}</b>`
      + `<br>${r.coins > 0 ? `<span class="wcoin"><i class="gc"></i><b>+${r.coins}</b> 金币</span> · ` : ''}${next}`;
    this.el.dres.classList.remove('hidden');
  }
  shopOpenNow() { return !this.el.shop.classList.contains('hidden'); }
  openLevels(page) {
    const d = this.h.data(), cur = Math.min(CFG.levels.length - 1, d.cur ? d.cur.li : d.unlocked);
    this.lvPage = Number.isInteger(page) ? page : Math.max(0, CFG.areas.findIndex((A) => cur >= A.from && cur < A.from + A.size));
    this.openModal(this.el.levels); this.renderLevels();
  }
  // 45 levels in three pages by estate (1–15 / 16–30 / 31–45): tabs + swipe
  renderLevels() {
    const d = this.h.data(), g = this.el.grid, P = this.lvPage; g.innerHTML = '';
    for (const b of $('lvTabs').children) b.classList.toggle('on', +b.dataset.p === P);
    const A = CFG.areas[P];
    for (let i = A.from; i < A.from + A.size; i++) {
      if (i >= CFG.levels.length) {   // v4.6: planned slots of an area (四季山谷 54–60)
        const b = document.createElement('button'); b.className = 'lvb lock soon'; b.innerHTML = `<b>${i + 1}</b><em>即将开放</em><small><i class="lk"></i></small>`; g.appendChild(b); continue;
      }
      const L = CFG.levels[i], b = document.createElement('button');
      const lock = i > d.unlocked && !(d.cur && d.cur.li === i), st = d.stars[i] || 0;
      b.className = 'lvb' + (lock ? ' lock' : '') + (d.cur && d.cur.li === i ? ' cur' : '');
      b.innerHTML = `<b>${i + 1}</b><em>${L.name}</em><small>${lock ? '<i class="lk"></i>' : '★'.repeat(st) + '☆'.repeat(3 - st)}</small>`;
      b.title = L.name;
      if (!lock) b.onclick = () => { this.closeAll(); this.h.start(i); };
      g.appendChild(b);
    }
    const next = Math.min(CFG.levels.length - 1, d.cur ? d.cur.li : d.unlocked), go = $('lvGo');
    go.dataset.li = next; go.textContent = `${d.cur ? '继续' : '开始'} 第 ${next + 1} 关`;
    const got = Object.values(d.stars).reduce((a, x) => a + x, 0);
    $('lvNote').textContent = `已得 ★${got} / ${CFG.levels.length * 3} · 左右滑动换页`;
    // v4.6 四季山谷: season switcher above the grid (locked until level 45 is cleared)
    const vr = $('lvSea'); vr.classList.toggle('hidden', !A.seasons);
    if (A.seasons) { const open = valleyOpen(d); vr.classList.toggle('locked', !open); this.renderSeasonRow(); if (!open) $('lvSeaNote').textContent = `过第 ${CFG.valley.unlockAfter} 关开放 · 在这里可以自由切换春夏秋冬`; }
  }
  // the 四季山谷 switchers: highlight the picked season and say what grows in it
  renderSeasonRow() {
    const d = this.h.data(), s = valleySeason(d), S = CFG.seasons[s];
    for (const id of ['lvSeaBtns', 'pSeaBtns']) for (const b of $(id).children) b.classList.toggle('on', +b.dataset.s === s);
    const txt = `${S.full}：${cropNames(valleyCrops(s)).join(' · ')} 生长 +${Math.round(CFG.season.bonus * 100)}%`;
    if (valleyOpen(d)) $('lvSeaNote').textContent = `${txt}${d.cur && isValleyLi(d.cur.li) ? ' · 换季后进行中的关卡会重新开始' : ''}`;
    const w = this.h.world();
    $('pSeaNote').textContent = w && w.valley && w.season !== s ? `${txt} · 下一局生效` : `${txt} · 点别的季节会换季并重新开始本关`;
  }
  openSettings(focus) {
    this.renderSettings();
    this.openModal(this.el.settings);
    const t = focus === 'mode' ? $('optMode') : focus === 'qual' ? $('optQual') : null;
    if (t && t.scrollIntoView) t.previousElementSibling.scrollIntoView({ block: 'start' });
  }
  renderSettings() {
    const d = this.h.data();
    $('optSound').checked = d.settings.sound; $('optVib').checked = d.settings.vib;
    const q = d.settings.quality ?? 'auto', m = d.settings.mode || 'auto', L = this.h.layoutInfo();
    for (const b of $('optQual').children) b.classList.toggle('on', String(q) === b.dataset.q);
    for (const b of $('optMode').children) b.classList.toggle('on', m === b.dataset.m);
    $('modeDet').textContent = `· 这台设备检测为「${MODES[L.detected]}」`;
    const vibOk = typeof navigator.vibrate === 'function' || !!window.AndroidHaptics;
    $('storeNote').textContent = (storageAvailable() ? '进度自动保存在本机。' : '这个浏览器不能保存进度，关掉页面后会从头开始。') + (vibOk ? '' : ' 这台设备不支持震动。');
    this.renderSound();
  }
  showWin(li, stars, t, earned, coins = 0) {
    $('winTitle').textContent = `第 ${li + 1} 关 完成！`;
    const is = $('winStars').children;
    for (let i = 0; i < 3; i++) { is[i].classList.remove('on'); setTimeout(() => { if (i < stars) { is[i].classList.add('on'); this.h.starSfx(i); } }, 350 + i * 320); }
    const mm = Math.floor(t / 60), ss = String(Math.floor(t % 60)).padStart(2, '0');
    $('winStat').innerHTML = `用时 <b>${mm}:${ss}</b>${earned > 0 ? ` · 新得 <b>★${earned}</b>` : ''}<br>${coins > 0 ? `<span class="wcoin"><i class="gc"></i><b>+${coins}</b> 金币</span> · ` : ''}去商店换新衣服、新装饰吧`;
    this.el.win.classList.remove('hidden');
  }
  hideAll() { this.closeAll(); this.el.win.classList.add('hidden'); this.el.dres.classList.add('hidden'); }
}
