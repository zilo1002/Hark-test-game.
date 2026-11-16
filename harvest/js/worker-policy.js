// Keep field workers near crops long enough to gather a useful load between regrowth cycles,
// but cap the partial-load wait so a sparse crop cannot leave a carrier visibly idle too long.
// Producer piles stay on their existing quick route; pond workers retain a bounded respawn window.
export function collectWaitLimit(worker, sources, cfg) {
  const pond = (sources || []).some((source) => source && source.kind === 'pond');
  if (pond) {
    const spawn = cfg.pond?.levels?.[0]?.rate || 5;
    return Math.min(6, Math.max(4, spawn + 1));
  }
  if (worker.porter || worker.feedFor) return 1.5;
  let regrow = 0;
  for (const source of sources || []) {
    if (source && source.kind === 'field') regrow = Math.max(regrow, (cfg.crops[source.item]?.grow || 0));
  }
  return regrow > 0 ? Math.min(6, Math.max(3.5, regrow + 1.5)) : 1.5;
}
