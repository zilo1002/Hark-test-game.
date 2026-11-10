// Explicit pause-menu save: persist a resumable snapshot of the active non-daily run.
export function saveRun(data, world, { credit = () => {}, persist = () => ({ persisted: false }) } = {}) {
  if (!world) return { saved: false, resumable: false, persisted: false, reason: 'no-active-run' };
  credit();
  if (world.daily || world.won) {
    const receipt = persist(data) || {};
    return { saved: true, resumable: false, persisted: receipt.persisted === true, reason: world.daily ? 'daily-run' : 'run-ended' };
  }
  data.cur = world.snapshot();
  const receipt = persist(data) || {};
  return { saved: true, resumable: true, persisted: receipt.persisted === true, reason: 'run-snapshot' };
}
