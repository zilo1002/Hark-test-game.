// Shared doll-series artwork for the home, farm world and shop previews.
// A single authored silhouette replaces overlapping body meshes, so clothes/accessories cannot z-fight or clip through one another.
const FILES = {
  farmer: 'farmer.png', baker: 'baker.png', maid: 'maid.png', fisher: 'fisher.png', rancher: 'rancher.png',
  cat_orange: 'cat_orange.png', cat_tortoise: 'cat_tortoise_plush.png', cat_tux: 'cat_tux.png',
  cat_tortoise_plush: 'cat_tortoise_plush.png', cat_plush: 'cat_new.webp',
  dog_shiba: 'dog_shiba.png', dog_white: 'dog_white.png', dog_plush: 'dog_white_plush.png',
  rabbit: 'rabbit_plush.png', frog: 'frog.png', penguin: 'penguin.png', hedgehog: 'hedgehog.png',
  fox: 'fox.png', owl: 'owl_plush.png', boy: 'boy_template.png', boy_sage: 'boy_sage.webp', boy_navy: 'boy_navy.webp',
};
const IMAGES = new Map(), CANVASES = new Set(), LISTENERS = new Map(), STYLE_CANVASES = new Map();
function repaint(rec) {
  const base = IMAGES.get(FILES[rec.role]);
  if (!base || !base.complete || !base.naturalWidth) return;
  paint(rec.canvas, base, rec.role, rec.style);
  for (const fn of LISTENERS.get(rec.canvas) || []) fn();
}
function imgFor(role) {
  const name = FILES[role];
  if (!name) return null;
  if (IMAGES.has(name)) return IMAGES.get(name);
  const img = new Image(); IMAGES.set(name, img);
  img.onload = () => {
    for (const rec of CANVASES) {
      if (rec.name === name || (name === FILES.owl && rec.role === 'farmer' && rec.style.owlCompanion)) repaint(rec);
    }
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('doll-art-ready', { detail: { role, name } }));
  };
  img.src = new URL(`../assets/dolls/${name}`, import.meta.url).href;
  return img;
}
function drawContained(ctx, img, w, h) {
  const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}
const ALPHA_BOUNDS = new WeakMap();
function drawBoyAtFarmerScale(ctx, img, w, h) {
  // New boy art files have tight full-height framing, while the original farmer sprite
  // reserves 224 transparent pixels above the hat. Normalize the visible bounds so boy
  // templates fit the same home crop and the same in-level sprite scale as the girl.
  let b = ALPHA_BOUNDS.get(img);
  if (!b) {
    const scan = document.createElement('canvas'); scan.width = img.naturalWidth; scan.height = img.naturalHeight;
    const sg = scan.getContext('2d', { willReadFrequently: true }); sg.drawImage(img, 0, 0);
    const d = sg.getImageData(0, 0, scan.width, scan.height).data;
    let x0=scan.width,y0=scan.height,x1=-1,y1=-1;
    for(let y=0;y<scan.height;y++) for(let x=0;x<scan.width;x++) if(d[(y*scan.width+x)*4+3]>8) { x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y); }
    b = x1>=x0 ? [x0,y0,x1+1,y1+1] : [0,0,img.naturalWidth,img.naturalHeight]; ALPHA_BOUNDS.set(img,b);
  }
  const [x0,y0,x1,y1]=b, sw=x1-x0, sh=y1-y0;
  const visibleH=288, visibleW=Math.min(w-16, sw*visibleH/sh), scale=visibleH/sh;
  const dw=sw*scale, dx=(w-dw)/2;
  ctx.drawImage(img,x0,y0,sw,sh,dx,h-visibleH,dw,visibleH);
}
export function dollRole(style = {}) {
  if (style.dollRole && FILES[style.dollRole]) return style.dollRole;
  if (String(style.character || '').startsWith('boy') && FILES[style.character]) return style.character;
  if (style.hat === 'rain' || style.boots || style.eyeColor === '#6586B9') return 'fisher';
  if (style.hat === 'chef' || style.dress || style.apron) return style.hat === 'chef' ? 'baker' : 'maid';
  if (style.beard || style.hat === 'cowboy' || style.hat === 'beanie') return 'rancher';
  return 'farmer';
}
function hexRgb(c) { const n = parseInt(String(c || '#4F79A9').replace('#',''), 16); return [(n >> 16)&255,(n >> 8)&255,n&255]; }
function recolor(canvas, region, target, predicate) {
  if (!target) return;
  const ctx = canvas.getContext('2d', { willReadFrequently: true }), d = ctx.getImageData(0,0,canvas.width,canvas.height), [tr,tg,tb] = hexRgb(target);
  const [x0,y0,x1,y1] = region;
  for (let y=y0;y<y1;y++) for(let x=x0;x<x1;x++) { const i=(y*canvas.width+x)*4, r=d.data[i],g=d.data[i+1],b=d.data[i+2],a=d.data[i+3]; if(a<12 || !predicate(r,g,b)) continue; const l=(r+g+b)/765, k=.48+l*.72; d.data[i]=Math.min(255,tr*k); d.data[i+1]=Math.min(255,tg*k); d.data[i+2]=Math.min(255,tb*k); }
  ctx.putImageData(d,0,0);
}
function drawHat(ctx, hat, color='#D2A85B') {
  if (!hat || hat === 'straw') {
    ctx.fillStyle='#D7AD61'; ctx.beginPath(); ctx.ellipse(128,247,121,19,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#E9C77D'; ctx.beginPath(); ctx.roundRect(66,190,124,62,22); ctx.fill();
    ctx.fillStyle='#C88643'; ctx.fillRect(68,237,120,10);
    ctx.fillStyle='#F2DDA9'; ctx.fillRect(72,240,112,3);
    ctx.fillStyle='#FFF8EA'; for(let i=0;i<7;i++){const a=i*Math.PI*2/7;ctx.beginPath();ctx.ellipse(194+Math.cos(a)*10,237+Math.sin(a)*10,5,8,a,0,Math.PI*2);ctx.fill();}
    ctx.fillStyle='#F3C744';ctx.beginPath();ctx.arc(194,237,5.5,0,Math.PI*2);ctx.fill();
  } else if (hat==='cap' || hat==='rain') {
    ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(128,238,91,16,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.roundRect(74,195,108,51,27);ctx.fill();
  } else if (hat==='beanie') {
    ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(66,196,124,62,30);ctx.fill();ctx.fillRect(68,239,120,12);ctx.beginPath();ctx.arc(128,193,11,0,Math.PI*2);ctx.fill();
  } else if (hat==='cowboy') {
    ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(128,242,120,20,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.roundRect(82,188,92,68,22);ctx.fill();ctx.fillStyle='#7B472A';ctx.fillRect(80,237,96,7);
  } else if (hat==='flower') {
    ctx.fillStyle='#FFF9E8';for(let i=0;i<8;i++){const a=i*Math.PI/4;ctx.beginPath();ctx.ellipse(184+Math.cos(a)*8,229+Math.sin(a)*8,4,7,a,0,Math.PI*2);ctx.fill();}ctx.fillStyle='#F4C542';ctx.beginPath();ctx.arc(184,229,4,0,Math.PI*2);ctx.fill();
  } else if (hat==='chef') {
    ctx.fillStyle='#FFFFFF'; ctx.beginPath();ctx.roundRect(77,182,102,61,24);ctx.fill();ctx.beginPath();ctx.arc(91,184,21,0,Math.PI*2);ctx.arc(128,170,25,0,Math.PI*2);ctx.arc(166,184,21,0,Math.PI*2);ctx.fill();ctx.fillStyle='#D7D0C5';ctx.fillRect(79,235,98,6);
  } else if (hat==='bow') {
    ctx.fillStyle=color||'#E83F61';ctx.beginPath();ctx.ellipse(107,221,22,14,-.35,0,Math.PI*2);ctx.ellipse(149,221,22,14,.35,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(128,221,9,0,Math.PI*2);ctx.fill();
  } else if (hat==='crown') {
    ctx.fillStyle='#FFC21A';ctx.beginPath();ctx.moveTo(78,246);ctx.lineTo(84,206);ctx.lineTo(108,225);ctx.lineTo(128,190);ctx.lineTo(149,225);ctx.lineTo(174,206);ctx.lineTo(178,246);ctx.closePath();ctx.fill();ctx.fillRect(80,244,96,10);
  } else if (hat==='pumpkin') {
    ctx.fillStyle='#F2871E';ctx.beginPath();ctx.ellipse(128,225,54,36,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#4A8B35';ctx.fillRect(124,180,8,14);ctx.fillStyle='#2A1A10';ctx.beginPath();ctx.moveTo(101,219);ctx.lineTo(113,226);ctx.lineTo(102,230);ctx.closePath();ctx.moveTo(143,226);ctx.lineTo(155,219);ctx.lineTo(154,230);ctx.closePath();ctx.fill();
  }
}
const PET_ROLES = new Set(['cat_orange','cat_tortoise','cat_tux','cat_tortoise_plush','cat_plush','dog_shiba','dog_white','dog_plush','rabbit','frog','penguin','hedgehog','fox','owl']);
function paint(canvas, img, role, style) {
  const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);
  if (String(role).startsWith('boy')) drawBoyAtFarmerScale(ctx,img,canvas.width,canvas.height);
  else drawContained(ctx,img,canvas.width,canvas.height);
  // Re-tint the doll's clothing only; preserve facial features, fur, shadows and fabric texture.
  if(role==='farmer' || String(role).startsWith('boy')) {
    recolor(canvas,[58,360,203,490],style.overalls || style.pants,(r,g,b)=>b>r*1.12 && b>g*1.01 && g>r*.88);
    // The face and chin extend below y=322 on the doll artwork; keep shirt tint to the torso/sleeve band.
    recolor(canvas,[70,365,190,435],style.shirt || style.sleeve,(r,g,b)=>r>165 && g>145 && b>125 && Math.max(r,g,b)-Math.min(r,g,b)<85);
  }
  // Boy templates already include their own fitted hat/cap; overlaying the old low-poly hat would cover the face.
  if(role==='farmer' && style.hat && style.hat !== false) drawHat(ctx, style.hat || 'straw', style.capColor || '#D2A85B');
  else if(role!=='farmer' && style.addHat) drawHat(ctx,style.hat,style.capColor);
  if((role==='farmer' || String(role).startsWith('boy')) && style.apron) {
    ctx.fillStyle=style.apron; ctx.beginPath(); ctx.moveTo(86,365); ctx.lineTo(170,365); ctx.lineTo(192,466); ctx.quadraticCurveTo(128,493,64,466); ctx.closePath(); ctx.fill();
    ctx.fillStyle=style.apronDot || '#FF6F92'; for(const [x,y] of [[96,402],[129,416],[158,394],[110,447],[150,455]]) {ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fill();}
  }
  if((role==='farmer' || String(role).startsWith('boy')) && style.owlCompanion) {
    const owl=imgFor('owl'); if(owl && owl.complete && owl.naturalWidth) ctx.drawImage(owl,174,300,52,64);
  }
}
export function dollCanvas(style = {}, role = dollRole(style)) {
  role = FILES[role] ? role : 'farmer';
  const key = `${role}:${JSON.stringify(style, Object.keys(style).sort())}`;
  if(STYLE_CANVASES.has(key)) return STYLE_CANVASES.get(key);
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=PET_ROLES.has(role)?320:512;
  const rec={canvas,role,style:{...style},name:FILES[role]}; CANVASES.add(rec); STYLE_CANVASES.set(key,canvas);
  const img=imgFor(role); if(img && img.complete && img.naturalWidth) paint(canvas,img,role,style);
  return canvas;
}
export function onDollCanvas(canvas, callback) { const ls=LISTENERS.get(canvas)||[];ls.push(callback);LISTENERS.set(canvas,ls); }
export function petDollRole(kind, col = {}) {
  if (col.dollRole && PET_ROLES.has(col.dollRole)) return col.dollRole;
  if (kind === 'cat') return col.patch ? 'cat_tortoise_plush' : (col.body === '#2E2E36' ? 'cat_tux' : 'cat_orange');
  if (kind === 'dog') return (col.body === '#F7F5EE' || col.body === '#FFFFFF') ? 'dog_white' : 'dog_shiba';
  if (kind === 'rabbit') return 'rabbit';
  if (kind === 'penguin') return 'penguin';
  if (kind === 'hedgehog') return 'hedgehog';
  if (kind === 'fox') return 'fox';
  if (kind === 'owl') return 'owl';
  if (kind === 'frog') return 'frog';
  return null;
}
export function petCanvas(kind, col = {}) {
  const role = petDollRole(kind, col);
  if (role) return dollCanvas({}, role);
  const blank = document.createElement('canvas'); blank.width = 256; blank.height = 320; return blank;
}
const THUMB_BOUNDS = new WeakMap();
export function dollThumbnail(canvas, size = 128) {
  if (!canvas) return '';
  const out = document.createElement('canvas'); out.width = size; out.height = size;
  const ctx = out.getContext('2d');
  let bounds = THUMB_BOUNDS.get(canvas);
  if (!bounds) {
    const src = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height).data;
    let x0 = canvas.width, y0 = canvas.height, x1 = -1, y1 = -1;
    for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
      if (src[(y * canvas.width + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    bounds = x1 >= x0 ? [x0, y0, x1 + 1, y1 + 1] : [0, 0, canvas.width, canvas.height];
    THUMB_BOUNDS.set(canvas, bounds);
  }
  const [x0, y0, x1, y1] = bounds, sw = x1 - x0, sh = y1 - y0, pad = 8;
  const scale = Math.min((size - pad * 2) / sw, (size - pad * 2) / sh);
  const w = sw * scale, h = sh * scale;
  ctx.drawImage(canvas, x0, y0, sw, sh, (size - w) / 2, (size - h) / 2, w, h);
  return out.toDataURL('image/png');
}
