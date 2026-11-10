// Keep hired field workers near crops long enough to gather a proper load between regrowth cycles.
// Producer piles stay on their existing quick route; pond workers get a bounded respawn window so
// a temporarily empty school does not send a nearly empty raw-fish load to the smokehouse.
export function collectWaitLimit(worker, sources, cfg) {
  const pond = (sources || []).some((source) => source && source.kind === 'pond');
  if (pond) {
    const spawn = cfg.pond?.levels?.[0]?.rate || 5;
    return Math.min(12, Math.max(7, spawn + 2));
  }
  if (worker.porter || worker.feedFor) return 1.5;
  let regrow = 0;
  for (const source of sources || []) {
    if (source && source.kind === 'field') regrow = Math.max(regrow, (cfg.crops[source.item]?.grow || 0));
  }
  return regrow > 0 ? Math.min(12, Math.max(3.5, regrow + 1.5)) : 1.5;
}
