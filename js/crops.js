// 作物与田地逻辑：播种、生长、收割、开垦、解锁（纯逻辑）
import { CROPS, PLOT_UNLOCK_ORDER, PLOT_PRICES, FIELD_COLS, TOOLS } from './config.js';
import { cropById, seedCost, growSpeed, barnFree, emit, spend } from './state.js';

export function stageOf(p) {
  if (!p.crop) return -1;
  if (p.prog >= 1) return 2;
  return p.prog < 0.4 ? 0 : 1;
}
export const isRipe = p => p.crop && p.prog >= 1;
export const isEmpty = p => p.open && !p.crop;

export function growPlots(s, dt) {
  const sp = growSpeed(s);
  for (const p of s.plots) {
    if (!p.crop || p.prog >= 1) continue;
    const before = stageOf(p);
    p.prog = Math.min(1, p.prog + dt * sp / cropById[p.crop].time);
    const after = stageOf(p);
    if (after !== before) emit(s, { type: after === 2 ? 'ripe' : 'stage', plot: p.i });
  }
}

export function remainingSec(s, p) {
  if (!p.crop) return 0;
  return Math.max(0, (1 - p.prog) * cropById[p.crop].time / growSpeed(s));
}

export function plantOne(s, p, id, by = 'player') {
  if (!isEmpty(p) || !s.crops.includes(id)) return false;
  const cost = seedCost(s, id);
  if (!spend(s, cost)) return false;
  p.crop = id; p.prog = 0; p.last = id;
  s.stats.planted++;
  if (by !== 'player') s.stats.byWorker.planted++;
  s.hints.planted = true;
  emit(s, { type: 'plant', plot: p.i, crop: id, by });
  return true;
}

function areaPlots(s, p, area) {
  if (area === 'one') return [p];
  if (area === 'row') return [p, ...s.plots.filter(q => q.r === p.r && q !== p)];
  return [p, ...s.plots.filter(q => q !== p)];
}

// 玩家点空地：按锄头等级播种
export function playerPlant(s, p, id) {
  const area = TOOLS.hoe.area[s.tools.hoe - 1];
  let n = 0;
  for (const q of areaPlots(s, p, area)) if (isEmpty(q) && (!q.res || q === p) && plantOne(s, q, id)) n++;
  if (n) s.seed = id;
  return n;
}

// 收一块：进仓库（玩家）或进雇工的筐（返回件数）
export function harvestOne(s, p, rng = Math.random, by = 'player') {
  if (!isRipe(p)) return 0;
  const dbl = TOOLS.sickle.double[s.tools.sickle - 1];
  const n = by === 'player' && rng() < dbl ? 2 : 1;
  const id = p.crop;
  p.crop = null; p.prog = 0;
  s.stats.harvested += n;
  if (by !== 'player') s.stats.byWorker.harvested += n;
  s.hints.harvested = true;
  emit(s, { type: 'harvest', plot: p.i, crop: id, n, by });
  return { id, n };
}

export function playerHarvest(s, p, rng = Math.random) {
  const area = TOOLS.sickle.area[s.tools.sickle - 1];
  let total = 0, blocked = false;
  for (const q of areaPlots(s, p, area)) {
    if (!isRipe(q) || (q.res && q !== p)) continue;
    if (barnFree(s) <= 0) { blocked = true; break; }
    const got = harvestOne(s, q, rng, 'player');
    if (got) {
      const n = Math.min(got.n, barnFree(s));
      s.barn[got.id] = (s.barn[got.id] || 0) + n;
      total += n;
    }
  }
  if (blocked && !total) emit(s, { type: 'full' });
  return total;
}

export function nextPlotIndex(s) {
  for (const i of PLOT_UNLOCK_ORDER) if (!s.plots[i].open) return i;
  return -1;
}
export function nextPlotPrice(s) {
  const opened = PLOT_UNLOCK_ORDER.filter(i => s.plots[i].open).length;
  return opened < PLOT_PRICES.length ? PLOT_PRICES[opened] : Infinity;
}
export function buyPlot(s) {
  const i = nextPlotIndex(s);
  if (i < 0) return false;
  if (!spend(s, nextPlotPrice(s))) return false;
  s.plots[i].open = true;
  emit(s, { type: 'plotOpen', plot: i });
  return true;
}

export function nextCropToUnlock(s) {
  return CROPS.find(c => !s.crops.includes(c.id)) || null;
}
export function unlockCrop(s, id) {
  const c = cropById[id];
  if (!c || s.crops.includes(id)) return false;
  if (nextCropToUnlock(s).id !== id) return false;
  if (!spend(s, c.unlock)) return false;
  s.crops.push(id);
  s.seed = id;
  emit(s, { type: 'cropUnlock', crop: id });
  return true;
}

export function plotCenter(p) { return { x: p.c + 0.5, y: p.r + 0.5 }; }
export function plotStand(p) { return { x: p.c + 0.5, y: p.r + 0.9 }; }
export const COLS = FIELD_COLS;
