// 工具升级（纯逻辑）
import { TOOLS, toolCapForManor } from './config.js';
import { manorLevel, spend, emit } from './state.js';

export function toolInfo(s, key) {
  const t = TOOLS[key];
  const lv = s.tools[key];
  const cap = toolCapForManor(manorLevel(s));
  const maxed = lv >= 5;
  const locked = !maxed && lv >= cap;
  return {
    key, lv,
    name: t.name[lv - 1],
    effect: t.effect[lv - 1],
    nextName: maxed ? null : t.name[lv],
    nextEffect: maxed ? null : t.effect[lv],
    cost: maxed ? Infinity : t.cost[lv - 1],
    maxed, locked,
    needManor: locked ? (lv + 1 <= 3 ? 3 : lv + 1 === 4 ? 5 : 7) : null,
  };
}

export function upgradeTool(s, key) {
  const info = toolInfo(s, key);
  if (info.maxed || info.locked) return false;
  if (!spend(s, info.cost)) return false;
  s.tools[key]++;
  emit(s, { type: 'tool', key, lv: s.tools[key] });
  return true;
}
