// 界面：HUD、标签页、面板、底部弹层、提示、动效事件
import { CROPS, TOOLS, TOOL_ORDER, WORKERS, WORKER_ORDER, WORKER_LEVEL, MANOR_THRESHOLDS, MANOR_UNLOCKS } from './config.js';
import { cropById, barnUsed, barnCap, manorLevel, manorProgress, incomePerMin, seedCost, unitPrice, growSpeed } from './state.js';
import { isEmpty, isRipe, playerPlant, playerHarvest, buyPlot, nextPlotIndex, nextPlotPrice, nextCropToUnlock, unlockCrop, remainingSec } from './crops.js';
import { sellAll, sellItems, barnValue, priceTrend, canFulfil, fulfilOrder, swapOrder } from './market.js';
import { toolInfo, upgradeTool } from './tools.js';
import { hireWorker, upgradeWorkers, hireCost, levelCost, countOf, maxOf, isUnlocked } from './workers.js';
import { cropSVG, cropIcon, toolSVG, workerSVG, scenerySVG, coinSVG, tabIcons } from './art.js';
import { FieldView } from './field.js';
import * as fx from './fx.js';

const $ = (sel, root = document) => root.querySelector(sel);
const fmt = fx.fmt;

export class UI {
  constructor(s, hooks) {
    this.s = s;
    this.hooks = hooks; // { save, reset }
    this.tab = 'field';
    this.keys = {};
    this.lastEl = null;
    this.pendingCoins = 0;
    this.pendingBarn = 0;
    this.lastManorShown = manorLevel(s);
    fx.initFx($('#fx'));
    fx.setMotion(s.settings.motion);
    fx.fireflies($('#fireflies'));
    $('#scenery').innerHTML = scenerySVG();
    this.applyScenery(manorLevel(s), false);
    this.field = new FieldView($('#field'), (i, el) => this.onPlot(i, el));
    this.c = {
      coins: new fx.Counter($('#coins'), s.coins),
      barn: new fx.Counter($('#barnUsed'), barnUsed(s)),
      rate: new fx.Counter($('#perMin'), 0),
    };
    $('#coinIco').innerHTML = coinSVG;
    $('#barnIco').innerHTML = tabIcons.barn;
    $('#gearBtn').innerHTML = tabIcons.gear;
    for (const b of document.querySelectorAll('#tabs button')) {
      b.querySelector('.ti').innerHTML = tabIcons[b.dataset.tab];
      b.addEventListener('click', () => this.setTab(b.dataset.tab));
    }
    $('#gearBtn').addEventListener('click', () => this.openSettings());
    document.addEventListener('click', e => this.onAct(e));
    $('#sheet .backdrop').addEventListener('click', () => this.closeSheet());
    this.setTab('field');
  }

  // —— 标签页 ——
  setTab(t) {
    this.tab = t;
    for (const v of document.querySelectorAll('.view')) v.classList.toggle('active', v.id === 'view-' + t);
    for (const b of document.querySelectorAll('#tabs button')) b.classList.toggle('active', b.dataset.tab === t);
    this.keys = {};
    this.renderPanels(true);
  }

  // —— 点地块 ——
  onPlot(i, el) {
    const s = this.s;
    const p = s.plots[i];
    if (!p.open) {
      if (i === nextPlotIndex(s)) {
        if (buyPlot(s)) this.hooks.save();
        else { fx.shake(el); this.toast(`开垦这块要 ${fmt(nextPlotPrice(s))} 金币`); }
      }
      return;
    }
    if (isRipe(p)) {
      playerHarvest(s, p);
      return;
    }
    if (isEmpty(p)) {
      this.openSeeds(i);
      return;
    }
    fx.squash(el.querySelector('.cw'));
    this.toast(`${cropById[p.crop].name} · 还要 ${Math.ceil(remainingSec(s, p))} 秒`);
  }

  // —— 统一点击分发 ——
  onAct(e) {
    const b = e.target.closest('[data-act]');
    if (!b || b.getAttribute('aria-disabled') === 'true') return;
    const s = this.s;
    const a = b.dataset.act, id = b.dataset.id;
    this.lastPos = fx.centerOf(b);
    const cardEl = b.closest('[data-card]');
    this.lastCardKey = cardEl ? cardEl.dataset.card : null;
    let ok = true;
    switch (a) {
      case 'plant': {
        const n = playerPlant(s, s.plots[this.seedPlot], id);
        if (!n) { ok = false; this.toast('金币不够买种子'); }
        this.closeSheet();
        break;
      }
      case 'unlockCrop': ok = unlockCrop(s, id); if (ok) { this.toast(`新种子：${cropById[id].name}`); if (this.seedPlot != null && $('#sheet').classList.contains('open')) this.openSeeds(this.seedPlot); } break;
      case 'sellAll': ok = sellAll(s) > 0; if (!ok) this.toast('仓库是空的'); break;
      case 'sellCrop': ok = sellItems(s, id, 1e9) > 0; break;
      case 'sellOne': ok = sellItems(s, id, 1) > 0; break;
      case 'fulfil': ok = fulfilOrder(s, +id) > 0; if (!ok) this.toast('货还不够'); break;
      case 'swap': ok = swapOrder(s, +id); if (!ok) this.toast('稍等再换'); break;
      case 'tool': ok = upgradeTool(s, id); break;
      case 'hire': ok = !!hireWorker(s, id); break;
      case 'wlevel': ok = upgradeWorkers(s, id); break;
      case 'autoSeed': s.autoSeed = id; this.keys = {}; break;
      case 'motion': s.settings.motion = id; fx.setMotion(id); this.openSettings(); break;
      case 'reset1': b.textContent = '再点一次，真的清空'; b.dataset.act = 'reset2'; return;
      case 'reset2': this.hooks.reset(); return;
      case 'close': this.closeSheet(); return;
      case 'goTab': this.setTab(id); return;
      default: return;
    }
    if (!ok) { const card = b.closest('.card') || b; fx.shake(card); }
    else this.hooks.save();
    this.renderPanels(true);
  }

  // —— 种子单 ——
  openSeeds(i) {
    const s = this.s;
    this.seedPlot = i;
    const area = TOOLS.hoe.area[s.tools.hoe - 1];
    const areaText = { one: '这一块', row: '这一整行', field: '整片空地' }[area];
    const next = nextCropToUnlock(s);
    let html = `<h3>播种 <small>· ${areaText}</small></h3><div class="seeds">`;
    for (const c of CROPS) {
      const have = s.crops.includes(c.id);
      if (have) {
        const t = c.time / growSpeed(s);
        const pm = (unitPrice(s, c.id) - seedCost(s, c.id)) / t * 60;
        html += `<button class="seed ${c.id === s.seed ? 'sel' : ''}" data-act="plant" data-id="${c.id}" data-cost="${seedCost(s, c.id)}">
          <span class="si">${cropIcon(c.id)}</span><span class="sn">${c.name}</span>
          <span class="sm">${Math.round(t)} 秒 · 卖 ${Math.round(unitPrice(s, c.id))}</span>
          <span class="sp">种子 ${seedCost(s, c.id)}<em>每块每分钟 ≈ ${Math.round(pm)}</em></span></button>`;
      } else if (next && c.id === next.id) {
        html += `<button class="seed lockd" data-act="unlockCrop" data-id="${c.id}" data-cost="${c.unlock}">
          <span class="si dim">${cropIcon(c.id)}</span><span class="sn">${c.name}</span>
          <span class="sm">${c.time} 秒 · 售价 ${c.price}</span><span class="sp gold">解锁 ${fmt(c.unlock)}</span></button>`;
      } else {
        html += `<div class="seed hidden"><span class="si dim">?</span><span class="sn">未知种子</span></div>`;
      }
    }
    html += '</div>';
    this.openSheet(html);
  }

  openSettings() {
    const m = this.s.settings.motion;
    const chip = (id, t) => `<button class="chip ${m === id ? 'sel' : ''}" data-act="motion" data-id="${id}">${t}</button>`;
    this.openSheet(`<h3>设置</h3>
      <div class="setrow"><span>动效</span><div class="chips">${chip('auto', '跟随系统')}${chip('full', '完整')}${chip('reduced', '减弱')}</div></div>
      <p class="mute">存档保存在这台设备的浏览器里，每 10 秒自动保存。</p>
      <div class="setrow"><span>重置</span><button class="btn danger" data-act="reset1">清空存档，从头再种</button></div>
      <button class="btn wide" data-act="close">好</button>`);
  }

  showOffline(sum) {
    const mins = Math.round(sum.seconds / 60);
    const dur = mins >= 60 ? `${(mins / 60).toFixed(1)} 小时` : `${Math.max(1, mins)} 分钟`;
    const hired = this.s.workers.length > 0;
    const main = sum.earned > 0 ? `你不在时，雇工替你挣了 <b class="gold">${fmt(sum.earned)}</b> 金币`
      : hired ? '你不在时，雇工一直在地里忙' : '你不在时，地里的菜都长好了';
    this.openSheet(`<div class="offline"><h3>月色里过了 ${dur}${sum.capped ? '（最多计 2 小时）' : ''}</h3>
      <p class="big">${main}</p>
      ${sum.harvested > 0 ? `<p class="mute">另有 ${fmt(sum.harvested)} 件收成经他们的手</p>` : ''}
      <button class="btn wide gold" data-act="close">收下</button></div>`);
    if (sum.earned > 0) setTimeout(() => { const c = fx.centerOf($('#sheet .panel')); this.coinStream(c, sum.earned, 12, false); }, 300);
  }

  openSheet(html) {
    $('#sheet .panel').innerHTML = html;
    $('#sheet').classList.add('open');
    $('#sheet').setAttribute('aria-hidden', 'false');
  }
  closeSheet() {
    $('#sheet').classList.remove('open');
    $('#sheet').setAttribute('aria-hidden', 'true');
    this.seedPlot = null;
  }

  toast(text) {
    const t = $('#toast');
    t.textContent = text;
    t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
    clearTimeout(this.toastT);
    this.toastT = setTimeout(() => t.classList.remove('show'), 1800);
  }

  // —— 景物 ——
  applyScenery(lv, animate) {
    for (const el of document.querySelectorAll('#scenery .sc')) {
      const on = lv >= +el.dataset.min;
      if (on && !el.classList.contains('on')) {
        if (animate) el.classList.add('rise');
        el.classList.add('on');
      }
    }
  }

  // —— 面板 ——
  renderPanels(force) {
    const s = this.s;
    if (this.tab === 'market') this.renderMarket(force);
    if (this.tab === 'tools') this.renderTools(force);
    if (this.tab === 'workers') this.renderWorkers(force);
    if (this.tab === 'field') this.renderFieldExtras();
  }

  renderMarket(force) {
    const s = this.s;
    const next = nextCropToUnlock(s);
    const key = [s.crops.join(), s.orders.map(o => o.id).join(), s.market.next, next && next.id, s.tools.cart].join('|');
    const root = $('#marketPanel');
    if (key !== this.keys.market) {
      this.keys.market = key;
      let h = `<section class="card orders"><div class="ch"><h3>订单</h3><span class="mute">交付有赏钱</span></div>`;
      for (const o of s.orders) {
        h += `<div class="order" data-ok="order:${o.id}"><div class="ow">${o.who}</div><div class="oi">`;
        h += Object.keys(o.items).map(id => `<span class="it" data-ok="item:${o.id}:${id}"><i>${cropIcon(id)}</i>${cropById[id].name}<b data-b="need:${o.id}:${id}"></b></span>`).join('');
        h += `</div><div class="oa"><span class="rw">${coinSVG}<b>${fmt(o.reward)}</b></span><button class="btn gold sm" data-act="fulfil" data-id="${o.id}" data-okbtn="order:${o.id}">交付</button><button class="btn ghost sm" data-act="swap" data-id="${o.id}">换</button></div></div>`;
      }
      h += `</section><section class="card"><div class="ch"><h3>集市</h3><span class="mute">每 60 秒变价 ±15%</span></div>
        <button class="btn wide gold big" data-act="sellAll" data-okbtn="barnHas">全部卖出 <span class="sv">${coinSVG}<b data-b="barnValue"></b></span></button><div class="mlist">`;
      for (const id of s.crops) {
        const c = cropById[id];
        const tr = priceTrend(s, id);
        h += `<div class="mrow"><span class="mi">${cropIcon(id)}</span><span class="mn">${c.name}<small>存 <b data-b="have:${id}"></b></small></span>
          <span class="mp ${tr > 0 ? 'up' : tr < 0 ? 'down' : ''}"><b data-b="price:${id}"></b><i>${tr > 0 ? '↑' : tr < 0 ? '↓' : '·'}</i></span>
          <button class="btn sm ghost" data-act="sellOne" data-id="${id}" data-okbtn="have:${id}">卖 1</button><button class="btn sm" data-act="sellCrop" data-id="${id}" data-okbtn="have:${id}">全卖</button></div>`;
      }
      h += '</div>';
      if (next) h += `<button class="btn wide unlock" data-act="unlockCrop" data-id="${next.id}" data-cost="${next.unlock}"><span class="mi dim">${cropIcon(next.id)}</span>解锁新种子「${next.name}」· ${fmt(next.unlock)}</button>`;
      h += '</section>';
      root.innerHTML = h;
      if (!force) for (const el of root.querySelectorAll('.mp')) fx.bump(el, 1.15);
    }
    this.bind(root);
  }

  renderTools(force) {
    const s = this.s;
    const lv = manorLevel(s);
    const key = TOOL_ORDER.map(k => s.tools[k]).join() + '|' + lv;
    const root = $('#toolsPanel');
    if (key !== this.keys.tools) {
      this.keys.tools = key;
      let h = '';
      for (const k of TOOL_ORDER) {
        const i = toolInfo(s, k);
        h += `<section class="card tcard" data-card="tool:${k}" ${!i.maxed && !i.locked ? `data-cost-card="${i.cost}"` : ''}>
          <div class="ticon">${toolSVG(k, i.lv)}</div>
          <div class="tbody"><div class="tname">${i.name}<span class="lv">Lv ${i.lv}</span></div>
          <div class="pips">${[1, 2, 3, 4, 5].map(n => `<i class="${n <= i.lv ? 'on' : ''}"></i>`).join('')}</div>
          <div class="teff">${i.effect}</div>
          ${i.maxed ? '<div class="tnext gold">已满级</div>' : `<div class="tnext">下一级 ${i.nextName !== i.name ? '「' + i.nextName + '」' : ''}：${i.nextEffect}</div>`}</div>
          <div class="tact">${i.maxed ? '' : i.locked ? `<span class="mute small">庄园 Lv${i.needManor}<br>解锁</span>` : `<button class="btn gold" data-act="tool" data-id="${k}" data-cost="${i.cost}">升级<small>${coinSVG}${fmt(i.cost)}</small></button>`}</div></section>`;
      }
      root.innerHTML = h;
    }
    this.bind(root);
  }

  renderWorkers(force) {
    const s = this.s;
    const lv = manorLevel(s);
    const key = WORKER_ORDER.map(t => countOf(s, t) + ':' + s.wlv[t]).join() + '|' + lv + '|' + s.autoSeed + '|' + s.crops.length;
    const root = $('#workersPanel');
    if (key !== this.keys.workers) {
      this.keys.workers = key;
      let h = '';
      for (const t of WORKER_ORDER) {
        const W = WORKERS[t];
        const wl = s.wlv[t], L = wl - 1;
        const n = countOf(s, t), max = maxOf(s, t);
        if (!isUnlocked(s, t)) {
          h += `<section class="card wcard lockd"><div class="wfigbox dim">${workerSVG(t)}</div><div class="tbody"><div class="tname">${W.name}</div><div class="teff mute">${W.desc}</div><div class="tnext">庄园 Lv${W.manor} 可雇</div></div></section>`;
          continue;
        }
        let stat = `步速 ${WORKER_LEVEL.speed[L]} · 动作 ${WORKER_LEVEL.work[L]} 秒`;
        if (t === 'harvester') stat += ` · 筐 ${WORKER_LEVEL.basket[L]} 件`;
        if (t === 'porter') stat += ` · 一担 ${WORKER_LEVEL.porterCap[L]} 件`;
        if (t === 'butler') stat += ` · 赏钱 +${Math.round(WORKER_LEVEL.butlerBonus[L] * 100)}%`;
        const hc = hireCost(s, t), lc = levelCost(s, t);
        h += `<section class="card wcard" data-card="w:${t}" ${n < max ? `data-cost-card="${hc}"` : ''}>
          <div class="wfigbox">${workerSVG(t)}<span class="cnt">×${n}</span></div>
          <div class="tbody"><div class="tname">${W.name}<span class="lv">Lv ${wl}</span></div>
          <div class="teff">${W.desc}</div><div class="tnext">${stat}</div>
          <div class="wbtns">
            ${n < max ? `<button class="btn gold" data-act="hire" data-id="${t}" data-cost="${hc}">雇一个<small>${coinSVG}${fmt(hc)}</small></button>` : `<span class="mute small">已雇满 ${max} 人</span>`}
            ${wl < 5 ? `<button class="btn" data-act="wlevel" data-id="${t}" data-cost="${lc}" ${n ? '' : 'aria-disabled="true"'}>全员升级<small>${coinSVG}${fmt(lc)}</small></button>` : '<span class="gold small">已满级</span>'}
          </div>`;
        if (t === 'planter') {
          h += `<div class="chips seedpick"><span class="mute small">播种：</span><button class="chip ${s.autoSeed === 'last' ? 'sel' : ''}" data-act="autoSeed" data-id="last">跟上一茬</button>` +
            s.crops.map(id => `<button class="chip ${s.autoSeed === id ? 'sel' : ''}" data-act="autoSeed" data-id="${id}">${cropById[id].name}</button>`).join('') + '</div>';
        }
        h += '</div></section>';
      }
      root.innerHTML = h;
    }
    this.bind(root);
  }

  renderFieldExtras() {
    const s = this.s;
    const used = barnUsed(s);
    const qs = $('#quickSell');
    const v = barnValue(s);
    qs.classList.toggle('show', used > 0);
    qs.classList.toggle('can', used >= barnCap(s) * 0.5);
    $('#qsVal').textContent = fmt(v);
    // 新手提示
    let hint = '';
    const h = s.hints;
    if (!h.planted) hint = '点一块空地，撒下第一把种子';
    else if (!h.harvested) hint = '等它长成，泛起微光时，点一下收割';
    else if (!h.sold) hint = '收成进了仓库——点下方「全部卖出」换金币';
    else if (!h.hired && isUnlocked(s, 'harvester')) hint = s.coins >= hireCost(s, 'harvester') ? '钱够了，去「雇工」雇个收割工，看他替你干活' : `攒到 ${fmt(hireCost(s, 'harvester'))} 金币，就能雇第一个收割工`;
    else if (!h.hired) hint = '庄园再升一级，就能雇人了';
    const he = $('#hint');
    if (he.textContent !== hint) { he.textContent = hint; he.classList.toggle('show', !!hint); }
  }

  // 数字绑定 + 买得起状态
  bind(root) {
    const s = this.s;
    for (const el of root.querySelectorAll('[data-b]')) {
      const [k, a, b] = el.dataset.b.split(':');
      let v;
      if (k === 'have') v = s.barn[a] || 0;
      else if (k === 'price') v = Math.round(unitPrice(s, a));
      else if (k === 'barnValue') v = barnValue(s);
      else if (k === 'need') { const o = s.orders.find(o => o.id === +a); el.textContent = o ? `${Math.min(s.barn[b] || 0, o.items[b])}/${o.items[b]}` : ''; continue; }
      if (!el._c) { el._c = new fx.Counter(el, v); el._c.render(); }
      if (el._c.target !== v && v > el._c.target) fx.bump(el, 1.15);
      el._c.set(v);
    }
    for (const el of root.querySelectorAll('[data-ok]')) {
      const [k, a, b] = el.dataset.ok.split(':');
      let ok = false;
      if (k === 'order') { const o = s.orders.find(o => o.id === +a); ok = !!o && canFulfil(s, o); }
      if (k === 'item') { const o = s.orders.find(o => o.id === +a); ok = !!o && (s.barn[b] || 0) >= o.items[b]; }
      el.classList.toggle('ok', ok);
    }
    for (const el of root.querySelectorAll('[data-okbtn]')) {
      const [k, a] = el.dataset.okbtn.split(':');
      let ok = true;
      if (k === 'order') { const o = s.orders.find(o => o.id === +a); ok = !!o && canFulfil(s, o); }
      if (k === 'have') ok = (s.barn[a] || 0) > 0;
      if (k === 'barnHas') ok = barnUsed(s) > 0;
      el.classList.toggle('can', ok && k !== 'have');
      el.setAttribute('aria-disabled', ok ? 'false' : 'true');
    }
    for (const el of root.querySelectorAll('[data-cost]')) {
      const can = s.coins >= +el.dataset.cost && el.getAttribute('aria-disabled') !== 'true';
      el.classList.toggle('can', can);
      el.classList.toggle('poor', !can);
    }
    for (const el of root.querySelectorAll('[data-cost-card]')) el.classList.toggle('can', s.coins >= +el.dataset.costCard);
  }

  // —— 每帧 ——
  frame(dt) {
    const s = this.s;
    this.handleFx();
    this.field.update(s);
    // HUD
    this.c.coins.set(Math.max(0, s.coins - this.pendingCoins));
    this.c.barn.set(Math.max(0, barnUsed(s) - this.pendingBarn));
    this.c.rate.set(incomePerMin(s));
    for (const k in this.c) this.c[k].step(dt);
    $('#barnCap').textContent = fmt(barnCap(s));
    $('#barnBox').classList.toggle('full', barnUsed(s) >= barnCap(s));
    const lv = manorLevel(s);
    $('#manorLv').textContent = lv;
    $('#manorBar').style.transform = `scaleX(${manorProgress(s).toFixed(4)})`;
    $('#manorNext').textContent = lv < MANOR_THRESHOLDS.length ? `下一级 ${fmt(MANOR_THRESHOLDS[lv])}` : '满级';
    // 节流刷新面板
    this.acc = (this.acc || 0) + dt;
    if (this.acc > 0.12) {
      this.acc = 0; this.renderPanels(false); this.badges();
      if ($('#sheet').classList.contains('open')) this.bind($('#sheet .panel'));
    }
  }

  badges() {
    const s = this.s;
    const mk = s.orders.some(o => canFulfil(s, o));
    const tl = TOOL_ORDER.some(k => { const i = toolInfo(s, k); return !i.maxed && !i.locked && s.coins >= i.cost; });
    const wk = WORKER_ORDER.some(t => isUnlocked(s, t) && countOf(s, t) < maxOf(s, t) && s.coins >= hireCost(s, t));
    $('#tabs [data-tab=market]').classList.toggle('dot', mk);
    $('#tabs [data-tab=tools]').classList.toggle('dot', tl);
    $('#tabs [data-tab=workers]').classList.toggle('dot', wk);
  }

  // 金币流：从 from 飞到金币计数器
  coinStream(from, amt, nCoins, hold = true) {
    const target = fx.centerOf($('#coinsBox .coin') || $('#coinsBox'));
    const n = Math.max(3, Math.min(nCoins || Math.round(3 + Math.log2(1 + amt)), 14));
    if (!fx.motion.full) { fx.bump($('#coinsBox')); return; }
    if (hold) this.pendingCoins += amt;
    let left = amt;
    for (let k = 0; k < n; k++) {
      const share = k === n - 1 ? left : Math.floor(amt / n);
      left -= share;
      const jitter = { x: from.x + (Math.random() - 0.5) * 30, y: from.y + (Math.random() - 0.5) * 16 };
      fx.fly(coinSVG, jitter, target, {
        delay: k * 55, dur: 560 + Math.random() * 160, lift: 60 + Math.random() * 60, cls: 'flyer coinf',
        onArrive: () => { if (hold) this.pendingCoins = Math.max(0, this.pendingCoins - share); fx.bump($('#coinsBox')); },
      });
    }
    fx.floatText('+' + fmt(amt), from.x, from.y - 10, 'gold bigf');
  }

  itemsToBarn(from, id, n, delay = 0) {
    const target = fx.centerOf($('#barnBox'));
    if (!fx.motion.full) { fx.bump($('#barnBox')); return; }
    this.pendingBarn += n;
    fx.fly(`<i class="ficon">${cropIcon(id)}</i>`, from, target, {
      delay, dur: 620, lift: 80, cls: 'flyer cropf',
      onArrive: () => { this.pendingBarn = Math.max(0, this.pendingBarn - n); fx.bump($('#barnBox')); },
    });
  }

  originOf(fallback) {
    const p = this.lastPos;
    this.lastPos = null;
    return p || fallback;
  }

  // —— 逻辑事件 → 动效 ——
  handleFx() {
    const s = this.s;
    const evs = s.rt.fx;
    if (!evs.length) return;
    s.rt.fx = [];
    let hIdx = 0, pIdx = 0;
    const onField = this.tab === 'field';
    for (const ev of evs) {
      switch (ev.type) {
        case 'harvest': {
          if (!onField) break;
          const pos = this.field.plotScreen(ev.plot, 0.55);
          const c = cropById[ev.crop];
          fx.particles(pos.x, pos.y, c.color, 9, 40);
          fx.particles(pos.x, pos.y, '#BFA57A', 4, 30);
          if (ev.by === 'player') {
            fx.popAt(`<i class="ficon">${cropIcon(ev.crop)}</i>`, pos.x, pos.y - 6, hIdx * 70);
            this.itemsToBarn({ x: pos.x, y: pos.y - 14 }, ev.crop, ev.n, hIdx * 70 + 230);
            fx.floatText(ev.n > 1 ? `双倍 +${ev.n}` : `+${ev.n} ${c.name}`, pos.x, pos.y - 20, ev.n > 1 ? 'gold' : '');
          }
          hIdx++;
          break;
        }
        case 'wSpark': {
          if (!onField) break;
          const w = s.workers.find(w => w.id === ev.id);
          if (w) {
            const p = this.field.toScreen(w.x, w.y - 0.42);
            fx.sparkle(p.x, p.y); fx.floatText('!', p.x + 8, p.y - 4, 'gold bang');
            if (ev.plot != null && ev.crop) {
              const from = this.field.plotScreen(ev.plot, 0.55);
              const to = this.field.toScreen(w.x - 0.12 * w.dir, w.y - 0.2);
              const el = this.field.workerEl(w.id);
              fx.fly(`<i class="ficon">${cropIcon(ev.crop)}</i>`, from, to, { dur: 420, lift: 40, cls: 'flyer cropf', scale: 0.7, onArrive: () => el && fx.bump(el.querySelector('.bob'), 1.12) });
            }
          }
          break;
        }
        case 'deposit': {
          if (!onField) break;
          const b = this.field.barnScreen();
          fx.squash(this.field.root.querySelector('.barnMark'));
          const w = s.workers.find(w => w.id === ev.id);
          const ids = Object.keys(s.barn);
          for (let k = 0; k < Math.min(ev.n, 5); k++) this.itemsToBarn(b, ids[k % ids.length] || 'scallion', k === Math.min(ev.n, 5) - 1 ? ev.n - k : 1, k * 80);
          break;
        }
        case 'sell': {
          let from;
          if (ev.by === 'porter') { if (!onField) { fx.bump($('#coinsBox')); break; } from = this.field.stallScreen(); }
          else from = this.originOf(onField ? fx.centerOf($('#quickSell')) : { x: innerWidth / 2, y: innerHeight / 2 });
          this.coinStream(from, ev.amt);
          break;
        }
        case 'order': {
          let from = ev.by === 'butler' ? (onField ? this.field.boardScreen() : null) : this.originOf(null);
          if (!from) { fx.bump($('#coinsBox')); this.toast(`管家交了「${ev.who}」的订单 +${fmt(ev.amt)}`); break; }
          fx.burst(from.x, from.y, { n: 12, r: 50 });
          this.coinStream(from, ev.amt);
          if (ev.by !== 'butler') this.toast(`「${ev.who}」很满意`);
          break;
        }
        case 'plant': {
          if (!onField) break;
          const el = this.field.plotEl(ev.plot);
          const top = this.field.plotScreen(ev.plot, 0.05), ground = this.field.plotScreen(ev.plot, 0.78);
          const d = pIdx * 50;
          pIdx++;
          if (!fx.motion.full) break;
          fx.fly('<i class="seedf"></i>', { x: ground.x, y: top.y - 20 }, ground, {
            delay: d, dur: 300, lift: 0, cls: 'flyer',
            onArrive: () => { fx.puff(ground.x, ground.y); fx.squash(el.querySelector('.cw'), true); },
          });
          break;
        }
        case 'stage': if (onField) fx.squash(this.field.plotEl(ev.plot).querySelector('.cw')); break;
        case 'ripe': {
          if (!onField) break;
          const el = this.field.plotEl(ev.plot);
          fx.squash(el.querySelector('.cw'), true);
          const p = this.field.plotScreen(ev.plot, 0.4);
          fx.particles(p.x, p.y, '#BFA57A', 5, 26, 'dot tiny');
          break;
        }
        case 'plotOpen': {
          const p = this.field.plotScreen(ev.plot, 0.5);
          fx.burst(p.x, p.y, { n: 16, r: 70 });
          fx.puff(p.x, p.y + 20);
          fx.squash(this.field.plotEl(ev.plot), true);
          fx.floatText('开垦！', p.x, p.y - 16, 'gold bigf');
          break;
        }
        case 'cropUnlock': { const p = this.originOf({ x: innerWidth / 2, y: innerHeight / 2 }); fx.burst(p.x, p.y, { n: 18, r: 80 }); fx.floatText('新种子！', p.x, p.y - 20, 'gold bigf'); break; }
        case 'hire': {
          const p = this.originOf(null);
          if (p) { fx.burst(p.x, p.y, { n: 16, r: 70 }); fx.floatText(`+1 ${WORKERS[ev.wtype].name}`, p.x, p.y - 24, 'gold bigf'); }
          this.toast(`${WORKERS[ev.wtype].name}到岗了——回田地看看`);
          break;
        }
        case 'wlevel':
        case 'tool': {
          const p = this.originOf(null);
          if (p) {
            fx.burst(p.x, p.y, { n: 18, r: 80 });
            fx.floatText(`Lv ${ev.lv}!`, p.x, p.y - 26, 'gold lvf');
            const key = this.lastCardKey;
            if (key) requestAnimationFrame(() => { const card = document.querySelector(`[data-card="${key}"]`); if (card) { fx.squash(card); card.classList.add('flash'); setTimeout(() => card.classList.remove('flash'), 700); } });
          }
          break;
        }
        case 'manor': {
          const sub = MANOR_UNLOCKS[ev.lv] ? '解锁：' + MANOR_UNLOCKS[ev.lv] : '';
          fx.levelBurst(document.body, `庄园 Lv ${ev.lv}`, sub);
          setTimeout(() => this.applyScenery(ev.lv, true), 500);
          fx.bump($('#manorBox'), 1.3);
          this.keys = {};
          break;
        }
        case 'full': this.toast('仓库满了——去集市卖掉，或升级仓库'); fx.shake($('#barnBox')); break;
      }
    }
  }
}
