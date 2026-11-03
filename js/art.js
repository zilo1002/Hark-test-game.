// 线描美术：作物、工具、雇工、景物（只返回 SVG 字符串，无 DOM）
import { cropById } from './state.js';

const IV = '#E8E1D2';
const GOLD = '#BFA57A';
const SAGE = '#8E9C7A';

const svg = (vb, body, cls = '') => `<svg class="${cls}" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="${IV}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

// —— 作物（viewBox 0 0 100 100，地面 y=86）——
const FOLIAGE = {
  scallion: `<path d="M44 86 C44 66 42 48 38 26"/><path d="M50 86 C50 62 51 42 52 18"/><path d="M56 86 C57 66 60 50 66 30"/><path d="M47 86 C46 70 44 58 30 44"/>`,
  radish: `<path d="M50 74 C44 60 36 52 28 48 C36 46 44 52 50 66"/><path d="M50 74 C56 58 64 50 72 46 C64 46 56 54 50 66"/><path d="M50 74 L50 50 C46 42 46 36 50 30 C54 36 54 42 50 50"/>`,
  cabbage: `<path d="M30 84 C24 70 30 58 42 56"/><path d="M70 84 C76 70 70 58 58 56"/><path d="M40 84 C34 74 38 62 50 60 C62 62 66 74 60 84"/>`,
  tomato: `<path d="M50 86 L50 22"/><path d="M62 86 L62 26" stroke-opacity=".45"/><path d="M50 40 C40 36 34 40 30 46 C38 48 44 46 50 42"/><path d="M50 56 C60 52 66 56 70 62 C62 64 56 62 50 58"/><path d="M50 30 C56 26 60 28 64 32"/>`,
  corn: `<path d="M50 86 L50 14"/><path d="M50 70 C40 60 30 58 18 62"/><path d="M50 58 C62 48 72 46 84 50"/><path d="M50 44 C42 36 36 34 26 34"/><path d="M50 30 C56 24 62 22 70 22"/>`,
  strawberry: `<path d="M50 86 C48 74 40 66 30 64 C34 72 40 78 50 80"/><path d="M50 86 C54 74 62 66 72 64 C68 72 60 78 50 80"/><path d="M50 82 C50 70 50 62 52 54"/><path d="M44 60 C48 52 56 52 60 58 C56 62 48 64 44 60"/>`,
  pumpkin: `<path d="M20 86 C30 80 40 80 46 74"/><path d="M80 84 C74 78 66 76 60 72"/><path d="M58 70 C66 62 76 64 78 72 C72 74 64 74 58 70"/><path d="M26 76 C22 70 22 64 28 62"/>`,
  truffle: `<path d="M18 86 C30 82 70 82 82 86"/><path d="M70 84 L72 58"/><path d="M72 66 C78 60 84 60 88 62 C84 68 78 68 72 66"/><path d="M71 60 C66 54 62 54 58 56 C62 60 66 62 71 60"/>`,
};
const FRUIT = {
  scallion: c => `<g stroke="${c}"><path d="M38 26 C37 22 36 20 34 18"/><path d="M52 18 L52 12"/><path d="M66 30 C68 26 70 24 72 22"/></g><path d="M42 86 C43 80 57 80 58 86" stroke="${IV}"/>`,
  radish: c => `<path d="M38 74 C38 66 62 66 62 74 C62 84 54 92 50 96 C46 92 38 84 38 74 Z" fill="${c}" fill-opacity=".18" stroke="${c}"/><path d="M44 78 L48 79 M53 84 L56 83" stroke="${c}" stroke-opacity=".6"/>`,
  cabbage: c => `<path d="M28 82 C22 62 36 46 50 46 C64 46 78 62 72 82 Z" fill="${c}" fill-opacity=".16" stroke="${c}"/><path d="M50 46 C44 58 44 72 50 82 M50 46 C56 58 56 72 50 82" stroke="${c}" stroke-opacity=".7"/><path d="M36 70 C42 64 46 64 50 66 M64 70 C58 64 54 64 50 66" stroke="${c}" stroke-opacity=".5"/>`,
  tomato: c => `<g stroke="${c}" fill="${c}" fill-opacity=".22"><circle cx="40" cy="52" r="8"/><circle cx="60" cy="70" r="9"/><circle cx="42" cy="74" r="6"/></g><path d="M37 45 L40 47 L43 45 M57 62 L60 64 L63 62" stroke="${SAGE}"/>`,
  corn: c => `<path d="M50 54 C42 46 42 28 50 20 C58 28 58 46 50 54 Z" fill="${c}" fill-opacity=".22" stroke="${c}"/><path d="M46 30 L54 30 M45 38 L55 38 M46 46 L54 46" stroke="${c}" stroke-opacity=".6"/><path d="M50 56 C40 50 36 38 38 26" stroke="${SAGE}"/><path d="M50 20 C48 14 46 10 42 8 M50 20 C52 14 56 10 58 8" stroke="${GOLD}" stroke-opacity=".8"/>`,
  strawberry: c => `<g stroke="${c}" fill="${c}" fill-opacity=".22"><path d="M30 66 C24 66 24 74 30 82 C36 74 36 66 30 66 Z"/><path d="M66 64 C60 64 60 72 66 80 C72 72 72 64 66 64 Z"/><path d="M50 70 C44 70 44 78 50 86 C56 78 56 70 50 70 Z"/></g><g fill="${IV}" stroke="none"><circle cx="29" cy="72" r=".9"/><circle cx="32" cy="76" r=".9"/><circle cx="65" cy="70" r=".9"/><circle cx="68" cy="74" r=".9"/><circle cx="49" cy="76" r=".9"/><circle cx="52" cy="80" r=".9"/></g>`,
  pumpkin: c => `<path d="M24 74 C24 56 76 56 76 74 C76 88 24 88 24 74 Z" fill="${c}" fill-opacity=".2" stroke="${c}"/><path d="M38 60 C32 66 32 82 38 86 M50 58 L50 87 M62 60 C68 66 68 82 62 86" stroke="${c}" stroke-opacity=".7"/><path d="M50 58 C50 52 52 48 56 46" stroke="${SAGE}"/><path d="M56 48 C62 44 64 50 60 52" stroke="${SAGE}" stroke-opacity=".7"/>`,
  truffle: c => `<path d="M30 84 C26 74 32 64 42 64 C46 58 56 58 58 66 C66 66 70 76 66 84 Z" fill="${c}" fill-opacity=".35" stroke="${c}"/><g fill="${IV}" fill-opacity=".5" stroke="none"><circle cx="40" cy="72" r="1"/><circle cx="48" cy="68" r="1"/><circle cx="56" cy="74" r="1"/><circle cx="46" cy="78" r="1"/><circle cx="60" cy="80" r="1"/></g><path d="M34 62 L32 56 M50 56 L50 50 M64 62 L67 57" stroke="${GOLD}" stroke-opacity=".7"/>`,
};

export function cropSVG(id, stage) {
  const c = cropById[id];
  let body;
  if (stage <= 0) {
    body = `<path d="M50 86 L50 72"/><path d="M50 76 C44 72 40 72 38 74 C42 78 46 78 50 76"/><path d="M50 74 C56 68 60 68 63 70 C60 75 55 75 50 74"/>`;
  } else if (stage === 1) {
    body = `<g transform="translate(50 86) scale(.72) translate(-50 -86)" stroke-opacity=".9">${FOLIAGE[id]}</g>`;
  } else {
    body = `<g stroke="${SAGE}">${FOLIAGE[id]}</g>${FRUIT[id](c.color)}`;
  }
  return svg('0 0 100 100', `<path d="M14 86.5 L86 86.5" stroke="#2C2A24"/>${body}`, 'crop s' + stage);
}

// 小图标（仓库/种子单）——只画果实部分
export function cropIcon(id) {
  const c = cropById[id];
  return svg('8 4 84 92', `<g stroke="${SAGE}" stroke-opacity=".8">${FOLIAGE[id]}</g>${FRUIT[id](c.color)}`, 'cicon');
}

// —— 工具（viewBox 0 0 48 48，等级越高细节越多，Lv5 描金）——
export function toolSVG(key, lv) {
  const g = lv >= 5 ? GOLD : IV;
  const band = lv >= 3 ? `<path d="M0 0" />` : '';
  let b = '';
  if (key === 'hoe') {
    const w = 8 + lv * 2.4;
    b = `<path d="M12 40 L32 12"/>` +
      `<path d="M30 10 L${30 + w * 0.45} ${12 - w * 0.2} L${34 + w * 0.6} ${22 + lv}" stroke="${g}"/>` +
      (lv >= 2 ? `<path d="M15 35.5 L18 37.5"/>` : '') +
      (lv >= 3 ? `<path d="M19 30 L22 32"/>` : '') +
      (lv >= 4 ? `<path d="M${36 + w * 0.3} 20 L${38 + w * 0.4} 26" stroke="${g}"/><path d="M8 42 C12 44 16 44 20 42" stroke-opacity=".5"/>` : '') +
      (lv >= 5 ? `<circle cx="32" cy="12" r="1.6" fill="${GOLD}" stroke="none"/>` : '');
  } else if (key === 'sickle') {
    const r = 9 + lv * 1.6;
    b = `<path d="M14 40 L22 30"/><path d="M22 30 C${22 + r * 0.2} ${30 - r * 1.3} ${22 + r * 1.6} ${30 - r * 1.2} ${22 + r * 1.5} ${30 - r * 0.2}" stroke="${g}"/>` +
      `<path d="M22 30 C${22 + r * 0.5} ${30 - r * 0.9} ${22 + r * 1.2} ${30 - r * 0.9} ${22 + r * 1.5} ${30 - r * 0.2}" stroke-opacity=".5"/>` +
      (lv >= 2 ? `<path d="M15.5 38 L18 39.8"/>` : '') +
      (lv >= 3 ? `<path d="M10 44 L14 40" stroke-opacity=".6"/>` : '') +
      (lv >= 4 ? `<path d="M8 20 L12 18 M7 26 L11 25" stroke="${GOLD}" stroke-opacity=".7"/>` : '');
  } else if (key === 'water') {
    if (lv <= 3) {
      const drops = lv + 1;
      b = `<path d="M10 22 L30 22 L28 40 L12 40 Z"/><path d="M30 26 L40 18"/><path d="M14 22 C14 14 26 14 26 22"/>` +
        Array.from({ length: drops }, (_, i) => `<path d="M${40 + i * 1.5} ${22 + i * 4} l0 2.5" stroke="${GOLD}"/>`).join('') +
        (lv >= 3 ? `<path d="M12 31 L28 31" stroke-opacity=".5"/>` : '');
    } else {
      b = `<path d="M24 44 L24 22"/><path d="M18 44 L30 44"/><circle cx="24" cy="20" r="3" stroke="${g}"/>` +
        `<path d="M10 16 C14 8 34 8 38 16" stroke="${GOLD}" stroke-opacity=".8"/><path d="M6 22 C10 6 38 6 42 22" stroke="${GOLD}" stroke-opacity=".45"/>` +
        (lv >= 5 ? `<path d="M3 28 C6 2 42 2 45 28" stroke="${GOLD}" stroke-opacity=".3"/>` : '');
    }
  } else if (key === 'cart') {
    if (lv === 1) b = `<path d="M12 22 L36 22 L32 40 L16 40 Z"/><path d="M14 28 L34 28 M15 34 L33 34" stroke-opacity=".5"/><path d="M16 22 C16 12 32 12 32 22"/>`;
    else if (lv === 2) b = `<path d="M10 24 L34 24 L30 34 L14 34 Z"/><circle cx="14" cy="39" r="4"/><path d="M30 30 L42 36 M30 34 L42 40"/>`;
    else b = `<path d="M6 22 L40 22 L38 32 L8 32 Z"/><circle cx="14" cy="37" r="5" stroke="${g}"/><circle cx="32" cy="37" r="5" stroke="${g}"/>` +
      `<path d="M40 26 L46 26"/>` + (lv >= 4 ? `<path d="M12 22 L14 14 L22 14 L22 22 M24 22 L24 12 L32 12 L34 22"/>` : `<path d="M14 22 L16 16 L26 16 L28 22"/>`) +
      (lv >= 5 ? `<path d="M18 10 L28 10" stroke="${GOLD}"/>` : '');
  } else if (key === 'barn') {
    const h = 10 + lv * 2;
    b = `<path d="M8 42 L8 ${42 - h} L24 ${30 - h} L40 ${42 - h} L40 42 Z"/><path d="M19 42 L19 32 L29 32 L29 42"/>` +
      (lv >= 2 ? `<path d="M19 32 L29 42 M29 32 L19 42" stroke-opacity=".5"/>` : '') +
      (lv >= 3 ? `<path d="M22 ${36 - h} L26 ${36 - h} L26 ${40 - h} L22 ${40 - h} Z" stroke="${g}"/>` : '') +
      (lv >= 4 ? `<path d="M42 42 L42 18 C42 12 48 12 48 18 L48 42" stroke-opacity=".8"/>` : '') +
      (lv >= 5 ? `<path d="M24 ${30 - h} L24 ${24 - h}" stroke="${GOLD}"/><path d="M24 ${24 - h} L29 ${26 - h} L24 ${28 - h}" stroke="${GOLD}"/>` : '');
  }
  return svg('0 0 48 48', b + band, 'tool lv' + lv);
}

// —— 雇工（viewBox 0 0 40 56，脚底 y=54）。四肢分组，CSS 做走路摆动 ——
export function workerSVG(type) {
  const hat = {
    planter: `<path d="M11 9 L20 3 L29 9 Z" stroke="${GOLD}"/>`,
    harvester: `<path d="M10 9.5 L20 2.5 L30 9.5 Z" stroke="${GOLD}"/><path d="M14 9.5 L26 9.5" stroke="${GOLD}" stroke-opacity=".5"/>`,
    porter: `<path d="M15.5 8 L24.5 8" stroke="${GOLD}"/><path d="M24.5 8 L27 10" stroke="${GOLD}"/>`,
    butler: `<path d="M16 6.5 L24 6.5 L23 3.5 L17 3.5 Z" stroke="${GOLD}"/><path d="M24 5 L28 4" stroke="${GOLD}" stroke-opacity=".7"/>`,
  }[type];
  const body = type === 'butler'
    ? `<path d="M20 16 L20 22"/><path d="M16 22 L24 22 L27 46 L13 46 Z" fill="#0E110F"/>`
    : `<path d="M20 16 L20 34"/><path d="M16 21 L24 21" stroke-opacity=".5"/>`;
  const legs = type === 'butler'
    ? `<g class="leg l"><path d="M17 46 L16 53"/></g><g class="leg r"><path d="M23 46 L24 53"/></g>`
    : `<g class="leg l"><path d="M20 34 L15 44 L14 53"/></g><g class="leg r"><path d="M20 34 L25 44 L26 53"/></g>`;
  const armR = {
    planter: `<g class="arm r"><path d="M20 20 L27 28 L29 33"/></g>`,
    harvester: `<g class="arm r"><path d="M20 20 L27 27 L30 30"/><path d="M30 30 C35 26 36 22 33 19" stroke="${GOLD}"/></g>`,
    porter: `<g class="arm r"><path d="M20 20 L26 17 L28 15"/></g>`,
    butler: `<g class="arm r"><path d="M21 23 L27 30"/><rect x="26" y="29" width="5" height="7" rx=".8" stroke="${GOLD}"/></g>`,
  }[type];
  const armL = `<g class="arm l"><path d="M20 20 L13 27 L11 32"/></g>`;
  let gear = '';
  if (type === 'planter') gear = `<g class="bag"><path d="M10 31 C8 36 9 40 13 40 C17 40 18 36 16 31 Z" stroke="${SAGE}"/><g class="fill"><circle cx="12" cy="36" r=".9" fill="${GOLD}" stroke="none"/><circle cx="14" cy="34" r=".9" fill="${GOLD}" stroke="none"/></g></g>`;
  if (type === 'harvester') gear = `<g class="basket"><path d="M4 30 L18 30 L16 38 L6 38 Z" stroke="${SAGE}"/><path d="M5 30 C7 25 15 25 17 30" stroke="${SAGE}" stroke-opacity=".6"/><g class="fill">${[0, 1, 2, 3, 4].map(i => `<circle class="f${i}" cx="${7 + i * 2}" cy="${29 - (i % 2)}" r="1.6" stroke="none" fill="${GOLD}"/>`).join('')}</g></g>`;
  if (type === 'porter') gear = `<g class="pole"><path d="M3 15 L37 13" stroke="${GOLD}"/><path d="M5 15 L5 24 M35 13 L35 22" stroke-opacity=".6"/><path d="M1 24 L9 24 L8 30 L2 30 Z" stroke="${SAGE}"/><path d="M31 22 L39 22 L38 28 L32 28 Z" stroke="${SAGE}"/><g class="fill"><path d="M2 24 C3 20 7 20 8 24 Z M32 22 C33 18 37 18 38 22 Z" fill="${GOLD}" fill-opacity=".8" stroke="none"/></g></g>`;
  if (type === 'butler') gear = `<path d="M18 26 L22 26" stroke="${GOLD}" stroke-opacity=".6"/>`;
  return svg('0 0 40 56', `<g class="fig">${legs}${body}${armL}${armR}<circle cx="20" cy="12" r="4"/>${hat}${gear}</g>`, 'wfig ' + type);
}

// —— 场地上的固定物：仓库、订单板、集市摊（viewBox 300×460，与场地同比例）——
export function groundSVG() {
  return `<svg viewBox="0 0 300 460" preserveAspectRatio="none" class="ground" fill="none" stroke="${IV}" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">
  <path d="M0 436 C80 430 220 440 300 434" stroke="#2C2A24" stroke-width="1"/>
  <path d="M0 446 C90 442 200 450 300 444" stroke="#2C2A24" stroke-width="1" stroke-dasharray="2 6"/>
  <g class="barnMark" transform="translate(10 400)" stroke-width="1.2">
    <path d="M2 30 L2 12 L18 2 L34 12 L34 30 Z" fill="#0E110F"/>
    <path d="M13 30 L13 20 L23 20 L23 30"/>
    <path d="M13 20 L23 30 M23 20 L13 30" stroke-opacity=".4"/>
  </g>
  <g class="board" transform="translate(138 406)" stroke-width="1.1">
    <path d="M4 24 L4 4 L20 4 L20 24"/><path d="M1 4 L23 4"/>
    <path d="M7 9 L17 9 M7 13 L15 13 M7 17 L16 17" stroke="${GOLD}" stroke-opacity=".6"/>
  </g>
  <g class="stall" transform="translate(268 398)" stroke-width="1.1">
    <path d="M0 10 L36 10 L32 2 L4 2 Z" stroke="${GOLD}" stroke-opacity=".8"/>
    <path d="M4 10 L4 34 M30 10 L30 34"/><path d="M2 22 L32 22"/>
  </g>
</svg>`;
}

// —— 远景（viewBox 0 0 360 96），随庄园等级出现 ——
export function scenerySVG() {
    const lanterns = [0, 1, 2, 3, 4].map(i => {
    const x = 196 + i * 30 + (i % 2) * 4;
        return `<g class="lantern sc" data-min="${i < 3 ? 5 : 8}" style="--i:${i}" transform="translate(${x} ${30 + (i % 2) * 6})"><path d="M0 0 L0 6" stroke-opacity=".5"/><ellipse class="lglow" cx="0" cy="12" rx="9" ry="9" fill="url(#lg)" stroke="none"/><path d="M-3.5 6 L3.5 6 L4.5 11 L3.5 17 L-3.5 17 L-4.5 11 Z" stroke="${GOLD}"/><path d="M0 17 L0 21" stroke="${GOLD}" stroke-opacity=".6"/></g>`;
  }).join('');
  return `<svg viewBox="0 0 360 96" class="scenery" fill="none" stroke="${IV}" stroke-linecap="round" stroke-linejoin="round" stroke-width="1" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="mg"><stop offset="0" stop-color="${IV}" stop-opacity=".18"/><stop offset="1" stop-color="${IV}" stop-opacity="0"/></radialGradient>
    <radialGradient id="lg"><stop offset="0" stop-color="${GOLD}" stop-opacity=".5"/><stop offset="1" stop-color="${GOLD}" stop-opacity="0"/></radialGradient>
  </defs>
  <circle cx="318" cy="24" r="26" fill="url(#mg)" stroke="none"/>
  <circle cx="318" cy="24" r="9" stroke-opacity=".85"/>
  <path d="M0 70 C40 56 70 60 100 66 C130 52 170 50 200 62 C240 54 280 58 360 66" stroke-opacity=".22"/>
  <path d="M0 80 C60 72 120 76 180 74 C240 72 300 78 360 74" stroke-opacity=".35"/>
  <g class="pagoda sc" data-min="7" transform="translate(150 40)" stroke-opacity=".45"><path d="M0 26 L0 8 M-6 26 L6 26 M-8 10 L8 10 L0 4 Z M-7 18 L7 18 L0 12 Z"/></g>
  <g class="fence sc" data-min="2" stroke-opacity=".6">${Array.from({ length: 16 }, (_, i) => `<path d="M${8 + i * 22} 92 L${8 + i * 22} 80"/>`).join('')}<path d="M4 84 L356 84 M4 89 L356 89" stroke-opacity=".5"/></g>
  <g class="barn sc" data-min="3" transform="translate(22 46)"><path d="M0 38 L0 16 L18 4 L36 16 L36 38" fill="#0E110F"/><path d="M13 38 L13 26 L23 26 L23 38"/><path d="M13 26 L23 38 M23 26 L13 38" stroke-opacity=".4"/><path d="M15 12 L21 12 L21 17 L15 17 Z" stroke="${GOLD}" stroke-opacity=".8"/></g>
  <g class="willow sc" data-min="6" transform="translate(110 30)" stroke="${SAGE}" stroke-opacity=".7"><path d="M10 52 C10 36 8 22 12 10"/><path d="M12 12 C2 18 0 34 2 44 M12 12 C18 22 20 34 18 46 M11 18 C6 26 6 38 8 46 M12 16 C24 20 28 32 28 40"/></g>
  <g class="mill sc" data-min="4" transform="translate(86 26)"><path d="M-6 58 L-2 12 L2 12 L6 58" fill="#0E110F"/><g class="blades"><path d="M0 12 L0 -8 M0 12 L20 12 M0 12 L0 32 M0 12 L-20 12" stroke-width="1.1"/><path d="M0 -8 L4 -6 L4 8 M20 12 L18 16 L4 16 M0 32 L-4 30 L-4 16 M-20 12 L-18 8 L-4 8" stroke-opacity=".55"/></g><circle cx="0" cy="12" r="1.6" fill="${GOLD}" stroke="none"/></g>
  <path class="sc" data-min="5" d="M190 30 C230 22 290 26 340 32" stroke-opacity=".35"/>
  ${lanterns}
</svg>`;
}

// 金币、小图标
export const coinSVG = `<svg viewBox="0 0 20 20" class="coin" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="8" fill="#0E110F" stroke="${GOLD}" stroke-width="1.5"/><rect x="7.6" y="7.6" width="4.8" height="4.8" fill="none" stroke="${GOLD}" stroke-width="1.2" transform="rotate(45 10 10)"/></svg>`;

export const tabIcons = {
  field: svg('0 0 24 24', `<path d="M3 18 L21 18 M3 14 L21 14"/><path d="M8 14 C8 9 6 7 4 6 M12 14 L12 6 M16 14 C16 9 18 7 20 6"/>`),
  market: svg('0 0 24 24', `<path d="M3 9 L21 9 L19 4 L5 4 Z"/><path d="M5 9 L5 20 M19 9 L19 20 M3 20 L21 20"/><path d="M9 20 L9 14 L15 14 L15 20"/>`),
  tools: svg('0 0 24 24', `<path d="M5 20 L15 8"/><path d="M14 6 L19 5 L18 11"/><path d="M15 8 L17 10"/>`),
  workers: svg('0 0 24 24', `<circle cx="12" cy="6" r="2.4"/><path d="M7 9 L12 5 L17 9" stroke="${GOLD}"/><path d="M12 9 L12 15 L9 21 M12 15 L15 21 M12 11 L8 14 M12 11 L16 14"/>`),
  gear: svg('0 0 24 24', `<circle cx="12" cy="12" r="3"/><path d="M12 3 L12 6 M12 18 L12 21 M3 12 L6 12 M18 12 L21 12 M5.6 5.6 L7.8 7.8 M16.2 16.2 L18.4 18.4 M5.6 18.4 L7.8 16.2 M16.2 7.8 L18.4 5.6"/>`),
  barn: svg('0 0 24 24', `<path d="M4 20 L4 10 L12 4 L20 10 L20 20 Z"/><path d="M9 20 L9 14 L15 14 L15 20"/>`),
};
