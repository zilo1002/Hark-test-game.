// Re-derive each level's par (3-star time) from the sharp bot: par = median time × 1.15, rounded to 10 s.
//   node sim/set-par.mjs            (rewrites js/config.js in place)
//   node sim/set-par.mjs --from=16  (only levels 16+, leaving earlier pars untouched)
//   node sim/set-par.mjs --only=7,10,12  (just those levels)
import fs from 'fs';
import { fileURLToPath } from 'url';
const { playLevel } = await import('./balance.mjs');
const { CFG } = await import('../js/config.js');
const cfgPath = fileURLToPath(new URL('../js/config.js', import.meta.url));
let s = fs.readFileSync(cfgPath, 'utf8');
const from = +((process.argv.find((a) => a.startsWith('--from=')) || '--from=1').split('=')[1]);
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean).map(Number);
CFG.levels.forEach((L, li) => {
  if (li + 1 < from) return;
  if (only.length && !only.includes(li + 1)) return;
  // v4.6 四季山谷: one par for all four seasons = the slowest season's median
  const med = (env) => [1, 2, 3].map((k) => playLevel(li, { stick: 1, think: 0.1 }, k * 1000 + li, env).time).sort((a, b) => a - b)[1];
  const r = Number.isInteger(L.valley) ? Math.max(...[0, 1, 2, 3].map((season) => med({ season }))) : med({});
  const par = Math.round(r * 1.15 / 10) * 10;
  s = s.replace(new RegExp(`(name: '${L.name}',[^\\n]*?par: )\\d+`), `$1${par}`);
  console.log(L.name, Math.round(r), '→ par', par);
});
fs.writeFileSync(cfgPath, s);
