// Re-derive each level's par (3-star time) from the sharp bot: par = median time × 1.15, rounded to 10 s.
//   node sim/set-par.mjs   (rewrites js/config.js in place)
import fs from 'fs';
import { fileURLToPath } from 'url';
const { playLevel } = await import('./balance.mjs');
const { CFG } = await import('../js/config.js');
const cfgPath = fileURLToPath(new URL('../js/config.js', import.meta.url));
let s = fs.readFileSync(cfgPath, 'utf8');
CFG.levels.forEach((L, li) => {
  const r = [1, 2, 3].map((k) => playLevel(li, { stick: 1, think: 0.1 }, k * 1000 + li).time).sort((a, b) => a - b)[1];
  const par = Math.round(r * 1.15 / 10) * 10;
  s = s.replace(new RegExp(`(name: '${L.name}',[^\\n]*?par: )\\d+`), `$1${par}`);
  console.log(L.name, Math.round(r), '→ par', par);
});
fs.writeFileSync(cfgPath, s);
