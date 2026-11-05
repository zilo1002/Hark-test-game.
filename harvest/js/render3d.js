// Three.js renderer for 半亩·丰收. The world plane (x east, y south) maps to Three's XZ plane
// (X = x, Z = y, Y = height). A perspective camera looks down at ~53° from the south-east, so the
// screen keeps the old isometric directions (screen-right = +x −y, screen-down = +x +y).
// Everything numerous is instanced: every field (one InstancedMesh per colour variant + stubble),
// every pile, and all moving/stacked items (one InstancedMesh per item type, refilled each frame).
// A 2D overlay canvas on top carries labels, particles, the guide arrow and the joystick.
import * as THREE from '../vendor/three.module.min.js';
import { CFG } from './config.js';
import { COL, makeCanvas } from './sprites.js';
import { drawIcon } from './icons.js';
import { FONT, elastic, hash } from './util.js';
import { customerStyle } from './chars.js';
import * as M from './models.js';

const TAU = Math.PI * 2, PITCH = 0.84, SINP = Math.sin(PITCH), COSP = Math.cos(PITCH), R2 = Math.SQRT1_2;
const VIEW = { landW: 620, landH: 350, portW: 380, portH: 600, fov: 30 };
const QUALITY = [
  { name: 'low', pr: 1, shadow: 0, plantShadow: false, aa: false },
  { name: 'mid', pr: 1.5, shadow: 1024, plantShadow: false, aa: true },
  { name: 'high', pr: 2, shadow: 2048, plantShadow: true, aa: true },
];
const HERO = { shirt: '#FFFFFF', vest: '#C8352A', bowtie: true, pants: '#2D3A5A', hair: '#7A3E1D', sleeve: '#FFFFFF' };
const GARDENER = { shirt: '#F7F5EE', overalls: '#3567C8', pants: '#3567C8', hair: '#5A3414', hat: 'straw', sleeve: '#F7F5EE' };
const CARTER = { shirt: '#FFD23F', pants: '#4A5A8A', hair: '#3A2210', hat: 'cap', capColor: '#E8452C', sleeve: '#FFD23F' };
const VIP = { shirt: '#FFD23F', vest: '#E8B21E', pants: '#7A3E9D', hair: '#3A2210', sleeve: '#FFD23F', crown: true };
const GOLD_MAT = new THREE.MeshLambertMaterial({ color: 0xFFE46A, emissive: 0xB07800 });
const LUMBERJACK = { shirt: '#D9382A', vest: '#2D3A5A', pants: '#4A5A8A', hair: '#6B3A1E', hat: 'beanie', capColor: '#F29C0E', beard: '#7A3E1D', sleeve: '#D9382A' };
const MILKER = { shirt: '#FFFFFF', overalls: '#3BA7FF', pants: '#3BA7FF', hair: '#3A2210', hat: 'cap', capColor: '#FFFFFF', sleeve: '#FFFFFF' };
const CASHIER = { shirt: '#4CD08A', vest: '#2E8A5A', hair: '#3A2210', pants: '#2D3A5A', sleeve: '#4CD08A' };
const ITEM_CAP = 1800;

// write a Y-rotation + scale + translation matrix straight into an instance buffer
function put(arr, k, x, y, z, ang, s, sy = s) {
  const o = k * 16, c = Math.cos(ang) * s, sn = Math.sin(ang) * s;
  arr[o] = c; arr[o + 1] = 0; arr[o + 2] = -sn; arr[o + 3] = 0;
  arr[o + 4] = 0; arr[o + 5] = sy; arr[o + 6] = 0; arr[o + 7] = 0;
  arr[o + 8] = sn; arr[o + 9] = 0; arr[o + 10] = c; arr[o + 11] = 0;
  arr[o + 12] = x; arr[o + 13] = y; arr[o + 14] = z; arr[o + 15] = 1;
}
const angLerp = (a, b, k) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return a + d * k; };
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();

export class Renderer {
  constructor(overlay, glCanvas) {
    this.cv = overlay; this.g = overlay.getContext('2d'); this.glCanvas = glCanvas;
    this.W = 1; this.H = 1; this.dpr = 1; this.z = 1; this.time = 0; this.wt = 0;
    this.cam = { x: 0, y: 0 }; this.ox = 0; this.oy = 0; this.groundDirty = true; this.world = null;
    this.q = 2; this.qLocked = false; this.slowT = 0; this.fastT = 0; this.frameEma = 1 / 60; this.drops = 0;
    this.gl = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, powerPreference: 'high-performance', alpha: false });
    this.gl.setClearColor(new THREE.Color(COL.lawn2));
    this.gl.shadowMap.enabled = true; this.gl.shadowMap.type = THREE.PCFShadowMap;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(new THREE.Color('#A8DDF0'), 1400, 2600);
    this.camera = new THREE.PerspectiveCamera(VIEW.fov, 1, 20, 4000);
    this.hemi = new THREE.HemisphereLight(0xFFFFFF, 0x7AA850, 1.9); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xFFF4DD, 2.1);
    this.sun.castShadow = true; this.sun.shadow.bias = -0.0008; this.sun.shadow.normalBias = 0.6;
    this.scene.add(this.sun); this.scene.add(this.sun.target);
    this.vp = new THREE.Matrix4();
    this.levelRoot = null;
    this.items = {};
    for (const t of M.ITEM_TYPES) {
      const im = new THREE.InstancedMesh(M.itemGeo(t), M.vcMat(), ITEM_CAP);
      im.count = 0; im.frustumCulled = false; im.castShadow = true; im.receiveShadow = false;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.items[t] = im; this.scene.add(im);
    }
    this.cnt = {};
    // guide arrow on the ground next to the player
    const sh = new THREE.Shape(); sh.moveTo(12, 0); sh.lineTo(-2, -11); sh.lineTo(-2, -5); sh.lineTo(-12, -5); sh.lineTo(-12, 5); sh.lineTo(-2, 5); sh.lineTo(-2, 11); sh.closePath();
    this.arrowMesh = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.95, depthWrite: false }));
    this.arrowMesh.rotation.x = -Math.PI / 2; this.arrowMesh.renderOrder = 3; this.scene.add(this.arrowMesh);
    this.applyQuality(true);
  }

  // ---------------------------------------------------------------- sizing / quality / camera
  resize(w, h, dpr) {
    this.W = w; this.H = h; this.dpr = Math.min(dpr || 1, CFG.view.dprCap);
    this.cv.width = Math.round(w * this.dpr); this.cv.height = Math.round(h * this.dpr);
    this.applyQuality(true);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    const land = w >= h, vw = land ? VIEW.landW : VIEW.portW, vh = land ? VIEW.landH : VIEW.portH, tv = Math.tan(VIEW.fov * Math.PI / 360);
    this.dist = Math.max(vw / (2 * tv * (w / h)), vh * SINP / (2 * tv));
    this.z = (h / (2 * tv * this.dist));          // ≈ screen px per world unit at the target (labels, particles)
  }
  applyQuality(force) {
    const Q = QUALITY[this.q];
    this.gl.setPixelRatio(Math.min(this.dpr || 1, Q.pr));
    this.gl.setSize(this.W, this.H, false);
    this.sun.castShadow = Q.shadow > 0;
    if (Q.shadow && (force || this.sun.shadow.mapSize.x !== Q.shadow)) {
      this.sun.shadow.mapSize.set(Q.shadow, Q.shadow);
      if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    }
    if (this.levelRoot) this.levelRoot.traverse((o) => { if (o.userData.plant) o.castShadow = Q.plantShadow; });
    this.gl.shadowMap.needsUpdate = true;
  }
  // adaptive detail: called every frame with the raw frame time
  adapt(rawDt) {
    if (rawDt > 0.25) return;
    this.frameEma += (rawDt - this.frameEma) * 0.05;
    if (this.frameEma > 1 / 40) { this.slowT += rawDt; this.fastT = 0; if (this.slowT > 2 && this.q > 0) { this.q--; this.drops++; this.slowT = 0; this.frameEma = 1 / 60; this.applyQuality(); } }
    else if (this.frameEma < 1 / 57) { this.fastT += rawDt; this.slowT = 0; if (this.fastT > 12 && this.q < 2 && this.drops < 2) { this.q++; this.fastT = 0; this.applyQuality(); } }
    else { this.slowT = Math.max(0, this.slowT - rawDt); }
  }
  setMode(m) { this.glCanvas.style.visibility = m === 'play' ? 'visible' : 'hidden'; }
  camTarget(w = this.world) { const p = w.player, off = 26; return { x: p.x - off, y: p.y - off }; }
  clampCam() { const w = this.world, m = 70; this.cam.x = Math.min(w.W - m, Math.max(m, this.cam.x)); this.cam.y = Math.min(w.H - m, Math.max(m, this.cam.y)); }
  follow(dt, snap) {
    if (!this.world) return;
    const t = this.camTarget(), k = snap ? 1 : Math.min(1, dt * CFG.view.camLerp);
    this.cam.x += (t.x - this.cam.x) * k; this.cam.y += (t.y - this.cam.y) * k;
    this.clampCam();
  }
  placeCamera() {
    const d = this.dist, cx = this.cam.x + this.ox * 0.6, cy = this.cam.y + this.oy * 0.6;
    this.camera.position.set(cx + d * COSP * R2, d * SINP, cy + d * COSP * R2);
    this.camera.lookAt(cx, 0, cy);
    this.camera.updateMatrixWorld();
    this.vp.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    // sun + shadow box follow the view
    const S = this.dist * 0.62;
    this.sun.position.set(cx - 260, 520, cy - 110); this.sun.target.position.set(cx, 0, cy);
    const sc = this.sun.shadow.camera; sc.left = -S; sc.right = S; sc.top = S; sc.bottom = -S; sc.near = 50; sc.far = 1400; sc.updateProjectionMatrix();
  }
  // world (x, y, height) → overlay pixels
  proj(x, y, h = 0) {
    const e = this.vp.elements, X = x, Y = h, Z = y;
    const w = e[3] * X + e[7] * Y + e[11] * Z + e[15];
    const cx = (e[0] * X + e[4] * Y + e[8] * Z + e[12]) / w, cy = (e[1] * X + e[5] * Y + e[9] * Z + e[13]) / w;
    this._pw = w;            // ≤ 0: the point is behind the camera (its projection is garbage)
    if (w <= 1e-3) return [-1e5, -1e5];
    return [(cx * 0.5 + 0.5) * this.W, (0.5 - cy * 0.5) * this.H];
  }
  X(x, y, h = 0) { return this.proj(x, y, h)[0]; }
  Y(x, y, h = 0) { return this.proj(x, y, h)[1]; }
  // joystick (screen direction) → world direction, undoing the camera's 45° turn and foreshortening
  screenToWorld(jx, jy) {
    const m = Math.hypot(jx, jy); if (m < 1e-6) return [0, 0];
    const a = jx, b = jy / SINP;
    let dx = (a + b) * R2, dy = (b - a) * R2; const n = Math.hypot(dx, dy) || 1;
    return [dx / n * m, dy / n * m];
  }

  // ---------------------------------------------------------------- level build
  setWorld(w) {
    this.world = w; this.wt = w.t; this.stackLbl = null; this.comboScreen = null; this.fullAt = undefined;
    if (this.levelRoot) { this.scene.remove(this.levelRoot); this.levelRoot.traverse((o) => { if (o.isInstancedMesh) o.dispose(); else if (o.isMesh && o.userData.own) o.geometry.dispose(); if (o.material && o.userData.ownMat) { o.material.map?.dispose(); o.material.dispose(); } }); }
    const root = this.levelRoot = new THREE.Group(); this.scene.add(root);
    this.chars = new Map(); this.custPool = {}; this.tileObjs = new Map();
    this.buildGround(w);
    this.decoSlots = this.planDecos(w);
    this.buildEnv(w);
    this.buildDecos(w);
    this.buildFields(w);
    this.buildPiles(w);
    this.buildCoops(w);
    this.buildCounters(w);
    this.buildProcs(w);
    this.buildTiles(w);
    this.player = this.makeChar(w.player);
    const t = this.camTarget(w); this.cam.x = t.x; this.cam.y = t.y; this.clampCam();
    this.applyQuality();
    this.groundDirty = false;
  }
  buildGround(w) {
    const M0 = 1600;
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(w.W + M0 * 2, w.H + M0 * 2), new THREE.MeshLambertMaterial({ color: COL.lawn2 }));
    outer.rotation.x = -Math.PI / 2; outer.position.set(w.W / 2, -0.4, w.H / 2); outer.receiveShadow = true; outer.userData.own = outer.userData.ownMat = true;
    this.levelRoot.add(outer);
    const pad = 120, gw = w.W + pad * 2, gh = w.H + pad * 2;
    const k = Math.min(2, 2048 / Math.max(gw, gh));
    this.groundK = k; this.groundPad = pad;
    this.groundCanvas = makeCanvas(gw * k, gh * k);
    this.groundTex = new THREE.CanvasTexture(this.groundCanvas);
    this.groundTex.colorSpace = THREE.SRGBColorSpace; this.groundTex.anisotropy = 4;
    const gm = new THREE.Mesh(new THREE.PlaneGeometry(gw, gh), new THREE.MeshLambertMaterial({ map: this.groundTex }));
    gm.rotation.x = -Math.PI / 2; gm.position.set(w.W / 2, 0, w.H / 2); gm.receiveShadow = true; gm.userData.own = gm.userData.ownMat = true;
    this.levelRoot.add(gm);
    this.paintGround(w);
  }
  paintGround(w) {
    const g = this.groundCanvas.getContext('2d'), k = this.groundK, pad = this.groundPad, theme = w.deco.theme || 'garden';
    const R = (s) => hash(s * 7919 + w.li * 131);
    g.setTransform(k, 0, 0, k, pad * k, pad * k);
    g.fillStyle = COL.lawn2; g.fillRect(-pad, -pad, w.W + pad * 2, w.H + pad * 2);
    g.fillStyle = COL.lawn; g.fillRect(0, 0, w.W, w.H);
    for (let x = 0; x < w.W; x += 36) { g.fillStyle = (x / 36) % 2 ? 'rgba(255,255,255,0.06)' : 'rgba(40,110,20,0.06)'; g.fillRect(x, 0, 36, w.H); }
    for (let i = 0; i < 160; i++) { g.fillStyle = i % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(40,100,20,0.07)'; g.beginPath(); g.ellipse(R(i) * w.W, R(i + 500) * w.H, 14 + R(i + 900) * 30, 8 + R(i + 1300) * 16, 0, 0, TAU); g.fill(); }
    const pave = (x, y, pw, ph) => {
      if (theme === 'garden') {
        g.fillStyle = COL.paving2; g.fillRect(x - 2, y - 2, pw + 4, ph + 4); g.fillStyle = COL.paving; g.fillRect(x, y, pw, ph);
        g.strokeStyle = 'rgba(140,130,110,0.45)'; g.lineWidth = 1;
        for (let yy = y; yy <= y + ph; yy += 18) { g.beginPath(); g.moveTo(x, yy); g.lineTo(x + pw, yy); g.stroke(); }
        for (let yy = y, row = 0; yy < y + ph; yy += 18, row++) for (let xx = x + (row % 2) * 9; xx < x + pw; xx += 18) { g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx, Math.min(y + ph, yy + 18)); g.stroke(); }
      } else {
        g.fillStyle = '#D9C48E'; g.fillRect(x - 3, y - 3, pw + 6, ph + 6); g.fillStyle = '#E8D7A6'; g.fillRect(x, y, pw, ph);
        for (let i = 0; i < pw * ph / 260; i++) { g.fillStyle = i % 3 ? 'rgba(160,130,70,0.28)' : 'rgba(255,255,240,0.4)'; g.beginPath(); g.ellipse(x + R(i * 3 + x) * pw, y + R(i * 5 + y) * ph, 1.4 + R(i) * 2, 1 + R(i + 1) * 1.4, 0, 0, TAU); g.fill(); }
      }
    };
    for (const p of w.deco.paths || []) pave(...p);
    for (const c of w.counters) pave(c.cashPos.x - 28, c.y - 40, w.W - c.cashPos.x + 28 + pad, 132);
    for (const p of w.procs) pave(p.inZone.x - 8, p.y - 34, p.body.x + p.body.w - p.inZone.x + 18, 68);
    for (const f of w.fields) {
      const bed = f.hidden ? COL.soil : { tulip: '#3F8A2C', rose: '#3A7A28', gold: '#4F9A26', wheat: '#8E6A34', potato: COL.soil, log: '#4F8A26', corn: '#9A7438', pumpkin: '#8A5A30', berry: '#3F8A2C' }[f.item];
      const edge = f.hidden ? COL.soil2 : { tulip: '#2E6A1E', rose: '#2A5E1C', gold: '#3E8420', wheat: '#6E5026', potato: COL.soil2, log: '#3A6E1C', corn: '#76562A', pumpkin: '#6A4422', berry: '#2E6A1E' }[f.item];
      g.fillStyle = edge; g.fillRect(f.x - 6, f.y - 6, f.w + 12, f.h + 12);
      g.fillStyle = bed; g.fillRect(f.x - 3, f.y - 3, f.w + 6, f.h + 6);
      if (f.item === 'log' && !f.hidden) {   // forest floor: leaf litter + moss dots instead of furrows
        for (let i = 0; i < f.w * f.h / 180; i++) { g.fillStyle = i % 3 ? 'rgba(30,70,15,0.25)' : 'rgba(200,150,60,0.3)'; g.beginPath(); g.ellipse(f.x + R(i + 7000) * f.w, f.y + R(i + 7300) * f.h, 2 + R(i) * 3, 1.2 + R(i + 1) * 2, R(i + 2) * 3, 0, TAU); g.fill(); }
        continue;
      }
      g.strokeStyle = 'rgba(70,35,15,0.25)'; g.lineWidth = 2;
      for (let yy = f.y + f.gap / 2; yy < f.y + f.h; yy += Math.max(12, f.gap * 2)) { g.beginPath(); g.moveTo(f.x, yy); g.lineTo(f.x + f.w, yy); g.stroke(); }
    }
    for (const c of w.coops) {
      // hens: straw yard; bushes: soil; cows/sheep/apple trees: lush pasture; hives: a flower meadow
      const pal = { hen: ['#E9D08A', '#F4E2A8', 'rgba(200,150,60,0.25)'], bush: ['#B98A55', COL.soil, 'rgba(80,40,15,0.25)'],
                    cow: ['#5DA53A', '#8ED65A', 'rgba(40,110,20,0.3)'], sheep: ['#5DA53A', '#9BDB6A', 'rgba(40,110,20,0.3)'],
                    appletree: ['#4F9A26', '#7CCB3E', 'rgba(40,100,20,0.3)'], hive: ['#6CBF45', '#A8E070', 'rgba(255,255,255,0.55)'] }[c.producer] || ['#B98A55', COL.soil, 'rgba(80,40,15,0.25)'];
      g.fillStyle = pal[0]; g.fillRect(c.x - 26, c.y - 26, c.w + 26, c.h + 26);
      g.fillStyle = pal[1]; g.fillRect(c.x, c.y, c.w, c.h);
      for (let i = 0; i < 120; i++) { g.fillStyle = pal[2]; g.fillRect(c.x + R(i + 5000) * c.w, c.y + R(i + 5100) * c.h, 4, 1.4); }
      if (c.producer === 'hive') for (let i = 0; i < 90; i++) { g.fillStyle = ['#FFD23F', '#FF8FB0', '#FFFFFF', '#B07ACC'][i % 4]; g.beginPath(); g.arc(c.x + R(i + 5400) * c.w, c.y + R(i + 5500) * c.h, 2.2, 0, TAU); g.fill(); }
    }
    // shade along the far walls
    let gr = g.createLinearGradient(0, 0, 0, 40); gr.addColorStop(0, 'rgba(20,60,10,0.25)'); gr.addColorStop(1, 'rgba(20,60,10,0)'); g.fillStyle = gr; g.fillRect(0, 0, w.W, 40);
    gr = g.createLinearGradient(0, 0, 40, 0); gr.addColorStop(0, 'rgba(20,60,10,0.25)'); gr.addColorStop(1, 'rgba(20,60,10,0)'); g.fillStyle = gr; g.fillRect(0, 0, 40, w.H);
    this.groundTex.needsUpdate = true;
  }
  buildEnv(w) {
    const out = [], theme = w.deco.theme || 'garden', R = (s) => hash(s * 7919 + w.li * 131), SEG = 40;
    const wall = (x0, y0, x1, y1, pa, pb) => (theme === 'farm' ? M.Env.woodFence(out, x0, y0, x1, y1) : M.Env.stoneWall(out, x0, y0, x1, y1, pa, pb));
    const gates = w.gates().slice().sort((a, b) => a[0] - b[0]);
    for (let x = 0; x < w.W; x += SEG) wall(x, -6, Math.min(w.W, x + SEG), -6, x % 120 === 0, x + SEG >= w.W);
    for (let y = 0; y < w.H; y += SEG) wall(-6, y, -6, Math.min(w.H, y + SEG), y % 120 === 0, false);
    const gx = Math.round(w.W * 0.42 / 10) * 10;
    for (let x = 0; x < w.W; x += SEG) { if (x + SEG > gx && x < gx + 50) continue; wall(x, w.H + 6, Math.min(w.W, x + SEG), w.H + 6, x % 120 === 0, x + SEG >= w.W); }
    M.Env.gate(out, gx, w.H + 6, gx + 50, w.H + 6, false);
    let y = 0;
    for (const [a, b] of gates) { for (let yy = y; yy < a; yy += SEG) wall(w.W + 6, yy, w.W + 6, Math.min(a, yy + SEG), false, yy + SEG >= a); M.Env.gate(out, w.W + 6, a, w.W + 6, b, true); y = b; }
    for (let yy = y; yy < w.H; yy += SEG) wall(w.W + 6, yy, w.W + 6, Math.min(w.H, yy + SEG), false, yy + SEG >= w.H);
    // planting outside the walls
    M.Env.hedge(out, -20, -50, w.W + 40, 18); M.Env.hedge(out, -50, -20, 18, w.H + 40);
    M.Env.hedge(out, -20, w.H + 30, w.W + 40, 18);
    y = -20;
    for (const [a, b] of gates) { if (a - 40 > y) M.Env.hedge(out, w.W + 30, y, 18, a - 40 - y); y = b + 40; }
    if (y < w.H + 40) M.Env.hedge(out, w.W + 30, y, 18, w.H + 40 - y);
    for (let i = 0; i < 70; i++) {
      const side = i % 4, u = R(i + 40), far = i >= 30 ? 110 + R(i + 5) * 160 : 0;
      let x, yy;
      if (side === 0) { x = u * w.W; yy = -95 - R(i + 9) * 60 - far; } else if (side === 1) { x = -95 - R(i + 9) * 60 - far; yy = u * w.H; }
      else if (side === 2) { x = u * w.W; yy = w.H + 90 + R(i + 9) * 50 + far; } else { x = w.W + 90 + R(i + 9) * 50 + far; yy = u * w.H; if (gates.some(([a, b]) => yy > a - 70 && yy < b + 70)) continue; }
      if (this.decoSlots.some((d) => Math.hypot(d.x - x, d.y - yy) < 52)) continue;   // keep the 商店 decorations clear
      M.Env.tree(out, x, yy, R(i + 77) > 0.6 ? 'cone' : 'round', 0.9 + R(i + 3) * 0.5);
    }
    const dc = w.deco;
    for (const h of dc.hedges || []) M.Env.hedge(out, h[0], h[1], h[2], h[3], 16);
    for (const t of dc.trees || []) M.Env.tree(out, t[0], t[1], t[2], 1);
    for (const b of dc.bushes || []) M.Env.shrub(out, b[0], b[1], (b[0] + b[1]) % 3 ? '#FFFFFF' : '#FF8FB0');
    if (dc.barn) M.Env.barn(out, dc.barn[0], dc.barn[1]);
    // low wooden rims round the field beds
    for (const f of w.fields) {
      const c = f.item === 'wheat' || f.item === 'potato' || f.item === 'corn' || f.item === 'pumpkin' ? '#8E5627' : f.item === 'log' ? '#6B4A22' : '#2E6A1E';
      out.push(M.P(M.box(f.w + 14, 3, 4), c, [f.x + f.w / 2, 1.5, f.y - 5])); out.push(M.P(M.box(f.w + 14, 3, 4), c, [f.x + f.w / 2, 1.5, f.y + f.h + 5]));
      out.push(M.P(M.box(4, 3, f.h + 6), c, [f.x - 5, 1.5, f.y + f.h / 2])); out.push(M.P(M.box(4, 3, f.h + 6), c, [f.x + f.w + 5, 1.5, f.y + f.h / 2]));
    }
    const mesh = new THREE.Mesh(M.merge(out), M.vcMat()); mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.own = true;
    this.levelRoot.add(mesh);
  }
  // 商店 decorations: outside the fence, along the south side either side of the gate (the side
  // nearest the camera), then along the west side. Purely scenery: no collision, no gameplay.
  setDecos(ids) { this.decoIds = (ids || []).slice(); }
  setOutfit(style) { this.heroStyle = style; }
  // v3.6 制服: one set worn by every hired worker (null = each role's own look)
  setUniform(style) { this.uniform = style || null; }
  wLook(base) { return this.uniform ? { ...base, ...this.uniform } : base; }
  planDecos(w) {
    const ids = this.decoIds || [], out = [];
    if (!ids.length) return out;
    const gx = Math.round(w.W * 0.42 / 10) * 10 + 25, slots = [];
    for (let k = 1; k < 20; k++) for (const sgn of [-1, 1]) { const x = gx + sgn * (k * 74 - 6); if (x > 30 && x < w.W - 30) slots.push({ x, y: w.H + 72 }); }
    for (let y = w.H - 50; y > 40; y -= 80) slots.push({ x: -80, y });
    ids.forEach((id, i) => { if (slots[i]) out.push({ id, ...slots[i] }); });
    return out;
  }
  buildDecos(w) {
    this.decoObjs = [];
    for (const d of this.decoSlots) {
      const g = new THREE.Group(); g.position.set(d.x, 0, d.y); g.rotation.y = d.x < 0 ? Math.PI / 2 : 0.5;
      const m = new THREE.Mesh(M.decoGeo(d.id), M.vcMat()); m.castShadow = true; m.receiveShadow = true; g.add(m);
      let spin = null;
      if (d.id === 'windmill') { spin = new THREE.Mesh(M.windmillSails(), M.vcMat()); spin.position.set(0, 30, 9.6); spin.userData.own = true; g.add(spin); }
      g.scale.setScalar(1.15); this.levelRoot.add(g); this.decoObjs.push({ d, g, spin });
    }
  }
  buildFields(w) {
    this.fieldObjs = [];
    for (const f of w.fields) {
      const nv = M.cropVariants(f.item), meshes = [], slot = new Int32Array(f.n), vi = new Uint8Array(f.n), counts = new Array(nv).fill(0);
      for (let i = 0; i < f.n; i++) { const v = f.v[i] % nv; vi[i] = v; slot[i] = counts[v]++; }
      const grp = new THREE.Group(); this.levelRoot.add(grp);
      for (let v = 0; v < nv; v++) {
        const im = new THREE.InstancedMesh(M.cropGeo(f.item, v), M.vcMat(), Math.max(1, counts[v]));
        im.frustumCulled = false; im.receiveShadow = true; im.userData.plant = true; im.userData.own = false;
        im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); grp.add(im); meshes.push(im);
      }
      const stub = new THREE.InstancedMesh(M.stubbleGeo(f.item), M.vcMat(), f.n);
      stub.frustumCulled = false; stub.receiveShadow = true;
      const ang = new Float32Array(f.n), sz = new Float32Array(f.n), last = new Float32Array(f.n).fill(-1);
      for (let i = 0; i < f.n; i++) {
        ang[i] = hash(i * 13 + f.x) * TAU; sz[i] = 0.88 + hash(i * 7 + f.y) * 0.24;
        put(stub.instanceMatrix.array, i, f.px(i), 0, f.py(i), ang[i], 0);
      }
      stub.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      grp.add(stub);
      const gold = new THREE.InstancedMesh(M.cropGeo(f.item, 0), GOLD_MAT, 96);
      gold.count = 0; gold.frustumCulled = false; gold.castShadow = true; gold.instanceMatrix.setUsage(THREE.DynamicDrawUsage); grp.add(gold);
      const spr = M.makeSprinkler(); spr.root.position.set(f.x + f.w / 2, 0, f.y + f.h / 2); spr.root.visible = false; this.levelRoot.add(spr.root);
      this.fieldObjs.push({ f, grp, meshes, stub, gold, spr, goldPrev: new Uint8Array(f.n), stubOn: new Uint8Array(f.n), slot, vi, ang, sz, last, scale: (f.gap / 9) * ({ wheat: 1.3, tulip: 1.15, gold: 1.2, rose: 1.15, potato: 0.42, log: 0.95, corn: 1.3, pumpkin: 0.8, berry: 1.35 }[f.item] || 1) });
    }
  }
  updateFields() {
    for (const o of this.fieldObjs) {
      const f = o.f; o.grp.visible = !f.hidden; if (f.hidden) continue;
      const g = f.g, pop = f.pop, last = o.last, dirty = this._dirtyV || (this._dirtyV = []);
      dirty.length = 0; let stubDirty = false;
      const gs = o.scale, gold = f.gold, gp = o.goldPrev, garr = o.gold.instanceMatrix.array;
      let gk = 0; const spots = this.goldSpots;
      for (let i = 0; i < f.n; i++) {
        const gv = g[i];
        let s;
        if (gv >= 1) s = 1 + (pop[i] > 0 ? Math.sin(pop[i] * Math.PI) * 0.3 : 0);
        else s = gv < 0.55 ? 0 : 0.25 + 0.67 * (gv - 0.55) / 0.45;   // cut plants stay stubble for ~4 s
        if (gold[i]) {   // 金色作物: drawn in the gold mesh, sparkles on the overlay
          if (s > 0 && gk < 96) { const gss = s * o.sz[i] * gs * 1.3; put(garr, gk++, f.px(i), 0, f.py(i), o.ang[i] + this.time * 1.5, gss, gss); if (gv >= 1 && spots.length < 60) spots.push(f.px(i), f.py(i), i); }
        }
        if (gold[i] !== gp[i]) { gp[i] = gold[i]; last[i] = -1; }
        if (Math.abs(s - last[i]) < 0.006) continue;
        last[i] = s;
        const v = o.vi[i], ss = (gold[i] ? 0 : s) * o.sz[i] * gs;
        put(o.meshes[v].instanceMatrix.array, o.slot[i], f.px(i), 0, f.py(i), o.ang[i], ss, ss);
        // stubble only where the plant is short (a full plant hides it anyway: skip drawing it)
        const st = s < 0.75 ? 0.9 + o.sz[i] * 0.25 : 0;
        if ((st > 0) !== (o.stubOn[i] === 1)) { o.stubOn[i] = st > 0 ? 1 : 0; put(o.stub.instanceMatrix.array, i, f.px(i), 0, f.py(i), o.ang[i], st * gs, st * gs); stubDirty = true; }
        dirty[v] = true;
      }
      for (let v = 0; v < o.meshes.length; v++) if (dirty[v]) o.meshes[v].instanceMatrix.needsUpdate = true;
      o.gold.count = gk; if (gk) o.gold.instanceMatrix.needsUpdate = true;
      if (f.sprinkler) {
        const a = elastic((this.wt - f.sprinklerT) / 0.6); o.spr.root.visible = a > 0; o.spr.root.scale.setScalar(Math.max(0.001, a) * 1.2);
        o.spr.head.rotation.y = this.time * 2.2;
        this.sprinklers.push(o);
      }
      if (stubDirty) o.stub.instanceMatrix.needsUpdate = true;
    }
  }
  buildPiles(w) {
    this.pileObjs = w.piles.map((pl) => {
      const im = new THREE.InstancedMesh(M.itemGeo(pl.type), M.vcMat(), pl.cap + 64);
      im.count = 0; im.frustumCulled = false; im.castShadow = true; im.receiveShadow = true; im.userData.plant = true; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.levelRoot.add(im);
      return { pl, im, total: -1, any: true };
    });
  }
  updatePiles() {
    const L = CFG.pile.layer;
    for (const o of this.pileObjs) {
      const pl = o.pl; o.im.visible = !pl.owner.hidden; if (pl.owner.hidden) continue;
      let any = false; const b = pl.bump; for (let i = 0; i < b.length; i++) if (b[i] > 0) { any = true; break; }
      if (!any && !o.any && pl.total === o.total) continue;
      o.any = any; o.total = pl.total;
      const arr = o.im.instanceMatrix.array, hs = pl.hs, half = M.ITEM_HALF[pl.type] || 2.4, C = pl.cols;
      let k = 0;
      for (let i = 0; i < hs.length; i++) {
        const h = hs[i]; if (!h) continue;
        const cx = pl.x + ((i % C) + 0.5) * pl.cw, cy = pl.y + (((i / C) | 0) + 0.5) * pl.ch, bb = b[i];
        for (let j = 0; j < h && k < pl.cap + 64; j++) {
          const hv = hash(i * 64 + j), hv2 = hash(i * 64 + j + 31);
          const top = j === h - 1 ? bb * 3 : 0;
          put(arr, k++, cx + (hv - 0.5) * pl.cw * 0.6, j * L + half + top, cy + (hv2 - 0.5) * pl.ch * 0.6, hv * TAU, 1.05 + hv2 * 0.2);
        }
      }
      o.im.count = k; o.im.instanceMatrix.needsUpdate = true;
    }
  }
  buildCoops(w) {
    this.coopObjs = w.coops.map((c) => {
      const grp = new THREE.Group(); this.levelRoot.add(grp);
      const out = [];
      M.Env.woodFence(out, c.x - 26, c.y - 26, c.x + c.w, c.y - 26);
      M.Env.woodFence(out, c.x - 26, c.y - 26, c.x - 26, c.y + c.h);
      M.Env.woodFence(out, c.x + c.w, c.y - 26, c.x + c.w, c.y + 10);
      M.Env.woodFence(out, c.x - 26, c.y + c.h, c.x + 10, c.y + c.h);
      const fm = new THREE.Mesh(M.merge(out), M.vcMat()); fm.castShadow = true; fm.receiveShadow = true; fm.userData.own = true; grp.add(fm);
      const hens = c.hens.map((h) => {
        const g = new THREE.Group(); g.position.set(h.x, 0, h.y);
        g.rotation.y = h.side === 0 ? 0 : Math.PI / 2;
        if (c.producer === 'hen') {
          const nest = new THREE.Mesh(M.nestGeo(), M.vcMat()); nest.castShadow = true; nest.receiveShadow = true; g.add(nest);
          const hen = new THREE.Mesh(M.henGeo(), M.vcMat()); hen.position.y = 8.6; hen.castShadow = true; g.add(hen);
          g.userData.anim = hen;
        } else if (c.producer !== 'bush') {   // cow / sheep / hive / apple tree
          const geo = { cow: M.cowGeo, sheep: M.sheepGeo, hive: M.hiveGeo, appletree: M.appleTreeGeo }[c.producer];
          const m = new THREE.Mesh(this._prodGeo(c.producer, geo), M.vcMat()); m.castShadow = true; g.add(m);
          const k = { cow: 1.15, sheep: 1.15, hive: 1.15, appletree: 1.35 }[c.producer] || 1; m.scale.setScalar(k); m.userData.k = k;
          if (c.producer === 'cow' || c.producer === 'sheep') { const bucket = new THREE.Mesh(this._prodGeo('bucket', () => M.merge([M.P(M.cyl(3.4, 2.8, 5, 8), '#AEB6C2', [0, 2.5, 0]), M.P(M.cyl(3, 3, 0.4, 8), '#FFFFFF', [0, 4.9, 0])])), M.vcMat()); bucket.position.set(9, 0, 10); g.add(bucket); }
          g.userData.anim = m;
        } else {
          const b = new THREE.Mesh(M.bushGeo(), M.vcMat()); b.castShadow = true; g.add(b); b.scale.setScalar(1.3); g.userData.anim = b;
        }
        grp.add(g); return g;
      });
      return { c, grp, hens };
    });
  }
  _prodGeo(k, fn) { this._pg = this._pg || {}; return this._pg[k] || (this._pg[k] = fn()); }
  buildCounters(w) {
    this.counterObjs = w.counters.map((c) => {
      const grp = new THREE.Group(); grp.position.set(c.x, 0, c.y); this.levelRoot.add(grp);
      const out = []; M.Env.counter(out, { desk: { x: c.desk.x - c.x, y: c.desk.y - c.y, w: c.desk.w, h: c.desk.h } }, CFG.counter);
      const m = new THREE.Mesh(M.merge(out), M.vcMat()); m.castShadow = true; m.receiveShadow = true; m.userData.own = true; grp.add(m);
      const zone = this.decal(c.zone.w, c.zone.h, (g, W, H) => this.paintZone(g, W, H, '出售', null));
      zone.position.set(c.zone.cx, 0.3, c.zone.cy); this.levelRoot.add(zone);
      const cash = this.decal(42, 42, (g, W, H) => {
        g.fillStyle = 'rgba(40,52,60,0.55)'; g.beginPath(); g.roundRect(4, 4, W - 8, H - 8, 10); g.fill();
        g.setLineDash([12, 8]); g.strokeStyle = 'rgba(120,230,240,0.9)'; g.lineWidth = 4; g.beginPath(); g.roundRect(8, 8, W - 16, H - 16, 8); g.stroke();
      });
      cash.position.set(c.cashPos.x, 0.3, c.cashPos.y); this.levelRoot.add(cash);
      let cashier = null;
      return { c, grp, zone, cash, cashier };
    });
  }
  buildProcs(w) {
    this.procObjs = w.procs.map((p) => {
      const grp = new THREE.Group(); grp.position.set(p.x, 0, p.y); this.levelRoot.add(grp);
      const out = [], cols = M.PROC_COL[p.outItem] || M.PROC_COL.bouquet;
      M.Env.proc(out, { body: { x: p.body.x - p.x, y: p.body.y - p.y, w: p.body.w, h: p.body.h } }, CFG.proc, cols);
      const body = new THREE.Mesh(M.merge(out), M.vcMat()); body.castShadow = true; body.receiveShadow = true; body.userData.own = true; grp.add(body);
      const gear = new THREE.Mesh(M.merge([M.P(M.cyl(7, 7, 2, 10), '#FFD23F', [0, 0, 0], [0, 0, Math.PI / 2]), M.P(M.cyl(2.6, 2.6, 2.6, 8), '#7A5A10', [0, 0, 0], [0, 0, Math.PI / 2])]), M.vcMat());
      gear.position.set(p.body.w / 2 + 1.5, CFG.proc.bodyH * 0.5, 4); grp.add(gear);
      if (p.outItem === 'plank' || p.outItem === 'chair') {   // 锯木厂: a big round saw blade on top
        const blade = new THREE.Mesh(M.merge([M.P(M.cyl(11, 11, 1.2, 16), '#D8DEE6', [0, 0, 0], [Math.PI / 2, 0, 0]), M.P(M.cyl(3, 3, 1.6, 8), '#E8452C', [0, 0, 0], [Math.PI / 2, 0, 0]),
          ...Array.from({ length: 12 }, (_, i) => { const a = i / 12 * Math.PI * 2; return M.P(M.cone(1.6, 3, 3), '#AEB6C2', [Math.cos(a) * 11.6, Math.sin(a) * 11.6, 0], [0, 0, a - Math.PI / 2]); })]), M.vcMat());
        blade.position.set(-p.body.w / 2 + 16, CFG.proc.bodyH + 6, p.body.h / 2 - 6); blade.castShadow = true; grp.add(blade); grp.userData.blade = blade;
      }
      const sign = new THREE.Mesh(M.itemGeo(p.outItem), M.vcMat()); sign.position.set(4, CFG.proc.bodyH + 10, 0); sign.scale.setScalar(1.3); sign.castShadow = true; grp.add(sign);
      const puffs = [0, 1, 2].map(() => { const s = new THREE.Mesh(M.sph(1, 7, 5), new THREE.MeshLambertMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.8, depthWrite: false })); s.userData.ownMat = true; grp.add(s); return s; });
      const zone = this.decal(p.inZone.w, p.inZone.h, (g, W, H) => this.paintZone(g, W, H, null, p.inItem));
      zone.position.set(p.inZone.cx, 0.3, p.inZone.cy); this.levelRoot.add(zone);
      return { p, grp, body, gear, sign, puffs, zone };
    });
  }
  // flat textured plane lying on the ground (world size w×h), painted once with fn(g, W, H)
  decal(w, h, fn, res = 4) {
    const W = Math.ceil(w * res), H = Math.ceil(h * res), cv = makeCanvas(W, H), g = cv.getContext('2d');
    fn(g, W, H);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.renderOrder = 1; m.userData.own = m.userData.ownMat = true; m.userData.canvas = cv; m.userData.tex = tex; m.userData.res = res;
    return m;
  }
  paintZone(g, W, H, text, item) {
    g.fillStyle = 'rgba(160,240,255,0.32)'; g.beginPath(); g.roundRect(6, 6, W - 12, H - 12, 18); g.fill();
    g.setLineDash([22, 14]); g.strokeStyle = '#F2FEFF'; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); g.roundRect(8, 8, W - 16, H - 16, 16); g.stroke(); g.setLineDash([]);
    g.save(); g.translate(W / 2, H / 2); g.rotate(-Math.PI / 4);
    if (text) { g.font = FONT(H * 0.36); g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineWidth = H * 0.07; g.strokeStyle = '#1E5AA8'; g.strokeText(text, 0, 0); g.fillStyle = '#FFFFFF'; g.fillText(text, 0, 0); }
    if (item) { g.globalAlpha = 0.9; g.scale(H / 32, H / 32); drawIcon(g, item, 0); }
    g.restore();
  }
  buildTiles(w) {
    for (const t of w.tiles) {
      const S = CFG.tile.size;
      const m = this.decal(S, S, () => {}, 4);
      m.position.set(t.x, 0.5, t.y); m.renderOrder = 2; m.visible = false; this.levelRoot.add(m);
      this.tileObjs.set(t, { m, key: '' });
    }
  }
  paintTile(o, t, afford) {
    const cv = o.m.userData.canvas, g = cv.getContext('2d'), W = cv.width, H = cv.height, f = t.paid / t.price;
    g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(20,40,40,0.25)'; g.beginPath(); g.roundRect(10, 10, W - 14, H - 14, 22); g.fill();
    g.beginPath(); g.roundRect(4, 4, W - 12, H - 12, 22); g.fillStyle = afford ? 'rgba(63,208,218,0.9)' : 'rgba(54,66,76,0.6)'; g.fill();
    if (f > 0) { g.save(); g.beginPath(); g.roundRect(4, 4, W - 12, H - 12, 22); g.clip(); g.fillStyle = 'rgba(120,255,200,0.85)'; g.fillRect(4, 4 + (H - 12) * (1 - f), W, H); g.restore(); }
    g.setLineDash([16, 11]); g.strokeStyle = '#FFFFFF'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.roundRect(14, 14, W - 32, H - 32, 14); g.stroke(); g.setLineDash([]);
    g.save(); g.translate(W / 2 - 3, H / 2 - 6); g.rotate(-Math.PI / 4); g.scale(W / 38, W / 38); if (!afford) g.globalAlpha = 0.85; drawIcon(g, t.icon, 0); g.restore();
    o.m.userData.tex.needsUpdate = true;
  }

  // ---------------------------------------------------------------- characters
  makeChar(c) {
    let o;
    if (c.kind === 'player') {
      const pp = M.makePerson(this.heroStyle || HERO), mow = M.makeMower();
      mow.root.add(pp.root); this.levelRoot.add(mow.root);
      o = { c, pp, mow, ang: 0.8, root: mow.root };
    } else if (c.kind === 'worker' && c.loader) {
      const pp = M.makePerson(this.wLook(c.lumber ? LUMBERJACK : GARDENER)), ld = M.makeLoader(c.lumber ? 'log' : '');
      pp.root.position.set(0, 13, -1.5); pp.blob.visible = false; ld.root.add(pp.root);
      const root = new THREE.Group(); root.add(ld.root); this.levelRoot.add(root);
      const blob = new THREE.Mesh(M.BLOB_GEO, M.BLOB_MAT); blob.rotation.x = -Math.PI / 2; blob.position.y = 0.3; blob.scale.set(17, 21, 1); root.add(blob);
      o = { c, pp, ld, loader: true, ang: 0.8, root };
    } else if (c.kind === 'worker') {
      const pp = M.makePerson(this.wLook(c.cart ? (c.from && this.world.objs[c.from[0]] && this.world.objs[c.from[0]].producer === 'cow' ? MILKER : CARTER) : c.lumber ? LUMBERJACK : GARDENER));
      const root = new THREE.Group(); root.add(pp.root);
      let cart = null; if (c.cart) { cart = M.makeCart(); cart.root.position.set(0, 0, -20); root.add(cart.root); }
      this.levelRoot.add(root);
      o = { c, pp, cart, ang: 0.8, root };
    }
    this.chars.set(c, o);
    return o;
  }
  updateChar(o, dt) {
    const c = o.c, t = this.time, sp = Math.hypot(c.vx, c.vy);
    if (sp > 8) o.ang = angLerp(o.ang, Math.atan2(c.vx, c.vy), Math.min(1, dt * 12));
    const app = c.appearT !== undefined ? elastic((this.wt - c.appearT) / 0.6) : 1;
    o.root.visible = app > 0;
    o.root.position.set(c.x, 0, c.y); o.root.rotation.y = o.ang; o.root.scale.setScalar(Math.max(0.001, app) * 1.15);
    const cutting = this.wt - c.cutT < 0.22;
    const carry = c.stack.length + c.incoming > 0;
    if (c.kind === 'player') {
      const veh = c.vehicle;
      o.mow.root.children[0].visible = veh; for (const wl of o.mow.wheels) { wl.visible = veh; if (veh && c.moving) wl.rotation.x += dt * sp * 0.2; }
      o.pp.root.position.set(0, veh ? 9 : 0, veh ? -4 : 0);
      o.pp.blob.visible = !veh;
      M.posePerson(o.pp, { t, walk: c.walk, moving: c.moving && !veh, carry: carry && !veh, cutting: cutting && !veh, seated: veh, seed: 1, axe: c.cutItem === 'log' });
      if (veh) { o.pp.arms[0].rotation.set(-1.2, 0, 0.3); o.pp.arms[1].rotation.set(-1.2, 0, -0.3); o.pp.tool.visible = false; }
    } else if (o.loader) {
      M.posePerson(o.pp, { t, walk: c.walk, moving: false, carry: false, cutting: false, seated: true, seed: c.seed + 2 });
      o.pp.arms[0].rotation.set(-1.15, 0, 0.3); o.pp.arms[1].rotation.set(-1.15, 0, -0.3); o.pp.tool.visible = false;
      for (const wl of o.ld.wheels) if (c.moving) wl.rotation.x += dt * sp * 0.2;
      o.ld.body.position.y = c.moving ? Math.abs(Math.sin(c.walk * 1.5)) * 0.6 : 0;
      o.ld.root.rotation.x = cutting ? Math.sin(t * 30) * 0.015 : 0;
    } else {
      M.posePerson(o.pp, { t, walk: c.walk, moving: c.moving, carry: carry && !c.cart && !cutting, cutting: cutting && !c.cart, seed: c.seed + 2, showTool: !c.cart && !carry, axe: !!c.lumber });
      if (o.cart) for (const wl of o.cart.wheels) if (c.moving) wl.rotation.x += dt * sp * 0.3;
    }
  }
  stackFrame(c, o) {
    // where the stack sits: in the hands (walking), on the mower's rear deck, or on the cart bed
    const a = o ? o.ang : 0, fx = Math.sin(a), fz = Math.cos(a);
    if (c.kind === 'player' && c.vehicle) return { x: c.x - fx * 17, y: c.y - fz * 17, z: 16, cols: 3, spread: 7.5, fx, fz };
    if (c.kind === 'worker' && c.loader) return { x: c.x - fx * 17.8 * 1.15, y: c.y - fz * 17.8 * 1.15, z: 21.5, cols: 3, deep: 3, spread: 6.6, fx, fz };
    if (c.kind === 'worker' && c.cart) return { x: c.x - fx * 23, y: c.y - fz * 23, z: 15, cols: 2, spread: 7.5, fx, fz };
    const bob = c.moving ? Math.abs(Math.sin(c.walk)) * 1.8 : 0;
    // bigger loads hug a wider tower so a full 100+ stack stays a readable height
    const cols = c.cap > 220 ? 3 : c.cap > 70 ? 2 : 1, deep = c.cap > 70 ? 2 : 1;
    return { x: c.x + fx * (12 + (deep - 1) * 3), y: c.y + fz * (12 + (deep - 1) * 3), z: 22 + bob, cols, deep, spread: 6.5, fx, fz };
  }

  // ---------------------------------------------------------------- dynamic items
  beginItems() { for (const t in this.cnt) this.cnt[t] = 0; }
  item(type, x, y, z, ang = 0, s = 1) {
    const im = this.items[type]; if (!im) return;
    const k = this.cnt[type] || 0; if (k >= ITEM_CAP) return;
    put(im.instanceMatrix.array, k, x, z, y, ang, s); this.cnt[type] = k + 1;
  }
  itemTumble(type, x, y, z, rx, ry, s = 1) {
    const im = this.items[type]; if (!im) return;
    const k = this.cnt[type] || 0; if (k >= ITEM_CAP) return;
    _e.set(rx, ry, 0); _q.setFromEuler(_e); _m4.compose(_v.set(x, z, y), _q, _s.set(s, s, s));
    _m4.toArray(im.instanceMatrix.array, k * 16); this.cnt[type] = k + 1;
  }
  endItems() {
    for (const t of M.ITEM_TYPES) {
      const im = this.items[t], n = this.cnt[t] || 0;
      im.count = n;
      if (n) { im.instanceMatrix.clearUpdateRanges(); im.instanceMatrix.addUpdateRange(0, n * 16); im.instanceMatrix.needsUpdate = true; }
    }
  }
  drawStack(c, o, labels, isPlayer) {
    const n = c.stack.length, b = this.stackFrame(c, o), deep = b.deep || 1, per = b.cols * deep;
    const hts = this._hts || (this._hts = new Float32Array(12)); hts.fill(0);
    const t = this.time, sp = Math.hypot(c.vx, c.vy);
    const rx = b.fz, rz = -b.fx;          // right vector
    o.lean = (o.lean || 0) + ((c.moving ? -sp / 160 : 0) - (o.lean || 0)) * 0.12;
    let top = { x: b.x, y: b.y, z: b.z };
    for (let i = 0; i < n; i++) {
      const cell = i % per, col = cell % b.cols, row = (cell / b.cols) | 0, type = c.stack[i], step = CFG.items[type].step;
      const h = hts[cell]; hts[cell] += step;
      const bend = Math.pow(h, 1.35) * 0.018, wob = Math.sin(t * 2.4 + h * 0.02) * h * 0.01;
      const off = (col - (b.cols - 1) / 2) * b.spread + wob, dep = (row - (deep - 1) / 2) * b.spread;
      const x = b.x + rx * off + b.fx * (o.lean * bend * 2 + dep), y = b.y + rz * off + b.fz * (o.lean * bend * 2 + dep), z = b.z + h + (M.ITEM_HALF[type] || 2);
      this.item(type, x, y, z, o.ang + Math.PI / 2 + (hash(i) - 0.5) * 0.25, b.cols > 1 ? 1.0 : 1.15);
      if (i >= n - per) top = { x: b.x, y: b.y, z: Math.max(top.z, z + step) };
    }
    o.top = top;
    const full = c.stack.length + c.incoming >= c.cap;
    // v3.4: only the player's stack gets a count / MAX pill (worker counts all over the field read as
    // numbers flying around); it is anchored on the stack's base column, not the swaying top item
    if (n > 0 && isPlayer) labels.push({ k: 'stack', x: b.x, y: b.y, z: top.z + 6, n, full, big: true });
    if (isPlayer && n === 0) this.comboScreen = null;
    if (isPlayer) this.comboAnchor = n > 0 ? { x: top.x, y: top.y, z: top.z + 6, stack: true } : { x: c.x, y: c.y, z: 54, stack: false };
    else if (c.lv) labels.push({ k: 'lv', x: c.x, y: c.y, z: o.loader ? 50 : 50, lv: c.lv, pop: this.wt - c.lvT, name: c.crewName });
  }
  flyItem(f) {
    const p = Math.min(1, f.t / f.dur), e = p * p * (3 - 2 * p);
    let tx = f.tx, ty = f.ty, tz = f.tz;
    if (f.kind === 'stack') { const o = this.chars.get(f.ref); const s = o && o.top ? o.top : { x: f.ref.x, y: f.ref.y, z: 30 }; tx = s.x; ty = s.y; tz = s.z; }
    else if (f.kind === 'cust') { tx = f.ref.x; ty = f.ref.y; tz = 26 + f.ref.bag.length * 4; }
    const mx = (f.x0 + tx) / 2 + f.sx, my = (f.y0 + ty) / 2 + f.sy, u = 1 - e;
    const x = u * u * f.x0 + 2 * u * e * mx + e * e * tx, y = u * u * f.y0 + 2 * u * e * my + e * e * ty;
    const h = f.z0 + (tz - f.z0) * e + f.arc * 4 * p * (1 - p);
    this.itemTumble(f.type, x, y, h + 2, (1 - e) * (f.sx || 1) * 0.15 * 6, f.t * 7 + f.x0, 1);
  }

  // ---------------------------------------------------------------- frame
  draw(world, fx, guide, time, extra = {}) {
    const dt = Math.min(0.05, Math.max(0, time - this.time)); this.time = time; this.wt = world.t; this.frameDt = dt;
    if (this.world !== world) this.setWorld(world);
    if (this.groundDirty) { this.paintGround(world); this.groundDirty = false; }
    [this.ox, this.oy] = fx ? fx.shakeOffset() : [0, 0];
    this.placeCamera();
    const labels = this.labels || (this.labels = []); labels.length = 0;
    this.goldSpots = this.goldSpots || []; this.goldSpots.length = 0; this.sprinklers = this.sprinklers || []; this.sprinklers.length = 0;
    this.updateFields(); this.updatePiles();
    this.beginItems();
    // coops: hens bob when they lay, bushes shiver
    for (const o of this.coopObjs) {
      const c = o.c; o.grp.visible = !c.hidden;
      o.hens.forEach((g, i) => {
        const h = c.hens[i], a = i < c.n ? elastic((this.wt - h.appearT) / 0.6) : 0;
        g.visible = a > 0; if (!g.visible) return; g.scale.setScalar(a);
        const an = g.userData.anim;
        if (c.producer === 'hen') { an.position.y = 8.6 + h.lay * 3; an.scale.set(1 + h.lay * 0.12, 1 - h.lay * 0.1, 1); an.rotation.y = Math.sin(time * 1.7 + i) * 0.35; }
        else if (c.producer === 'cow' || c.producer === 'sheep') {   // a happy hop and a head-turn when a bottle / wool ball pops out
          const k = an.userData.k; an.position.y = h.lay * 2.4; an.scale.set(k * (1 + h.lay * 0.06), k * (1 - h.lay * 0.05), k); an.rotation.y = Math.sin(time * 0.9 + i * 1.7) * 0.25;
        } else if (c.producer === 'hive') { const k = an.userData.k; an.scale.set(k * (1 + h.lay * 0.08), k * (1 - h.lay * 0.06), k * (1 + h.lay * 0.08)); an.rotation.z = Math.sin(time * 20 + i) * h.lay * 0.05; }
        else if (c.producer === 'appletree') { const k = an.userData.k; an.rotation.z = Math.sin(time * 18 + i) * h.lay * 0.06; an.scale.setScalar(k); }
        else { an.scale.set(1.3 + h.lay * 0.1, 1.3 - h.lay * 0.08, 1.3 + h.lay * 0.1); }
      });
    }
    // counters: desk, zone, stock on the top, cash pile, cashier
    for (const o of this.counterObjs) {
      const c = o.c, a = c.hidden ? 0 : elastic((this.wt - c.appearT) / 0.6);
      o.grp.visible = o.zone.visible = o.cash.visible = a > 0; if (a <= 0) continue;
      const sq = 1 + c.bumpT * 0.05; o.grp.scale.set(a, a * sq, a); o.zone.scale.setScalar(a); o.cash.scale.setScalar(a);
      const K = CFG.counter, dsk = c.desk, n = Math.min(c.stock.length, 120);
      for (let k = 0; k < n; k++) {
        const col = k % 6, lay = (k / 6) | 0, type = c.stock[k], ix = col % 2, iy = (col / 2) | 0;
        this.item(type, dsk.x + 8 + ix * 14, dsk.y + 26 + iy * 12, K.deskH + 1 + lay * CFG.items[type].step * 0.8 + (M.ITEM_HALF[type] || 2), (k % 3) * 0.2 + 0.785, 0.85);
      }
      if (c.cash > 0.01) {
        const bv = world.L.bill || 5, m = Math.min(72, Math.ceil(c.cash / bv)), p = c.cashPos;
        for (let k = 0; k < m; k++) { const s = k % 6, lay = (k / 6) | 0; this.item('cash', p.x - 8 + (s % 2) * 14, p.y - 12 + ((s / 2) | 0) * 10, 1.6 + lay * 2.8, 0.785 + (hash(k) - 0.5) * 0.2, 0.85); }
      }
      if (c.cashier && !o.cashier) { o.cashier = M.makePerson(CASHIER); o.cashier.root.position.set(c.x + 4, 0, c.y - 44); o.cashier.root.rotation.y = 0.3; this.levelRoot.add(o.cashier.root); }
      if (o.cashier) M.posePerson(o.cashier, { t: time, walk: 0, moving: false, carry: false, seed: 4 });
    }
    // machines
    for (const o of this.procObjs) {
      const p = o.p, a = p.hidden ? 0 : elastic((this.wt - p.appearT) / 0.6);
      o.grp.visible = o.zone.visible = a > 0; if (a <= 0) continue;
      const sh = p.work ? Math.sin(time * 40) * 0.5 : 0;
      o.grp.scale.setScalar(a); o.body.position.x = sh; o.zone.scale.setScalar(a);
      if (p.work) o.gear.rotation.x += dt * 5;
      if (o.grp.userData.blade) o.grp.userData.blade.rotation.z -= dt * (p.work ? 14 : 1.2);
      o.sign.rotation.y = time * 0.8; o.sign.position.y = CFG.proc.bodyH + 10 + Math.sin(time * 2) * 1.2;
      o.puffs.forEach((s, i) => {
        const u = (time * 0.8 + i / 3) % 1; s.visible = p.work > 0;
        s.position.set(p.body.w / 2 - 11 + u * 6, CFG.proc.bodyH + 21 + u * 22, -p.body.h / 2 + 10); s.scale.setScalar(2.6 + u * 4); s.material.opacity = 0.75 * (1 - u);
      });
      if (p.buf > 0) labels.push({ k: 'buf', x: p.body.x, y: p.y, z: CFG.proc.bodyH + 30, n: p.buf });
    }
    for (const o of this.decoObjs || []) { if (o.spin) o.spin.rotation.z = time * 1.4; if (o.d.id === 'balloon') o.g.position.y = 2 + Math.sin(time * 1.2) * 2; }
    // unlock tiles
    for (const [t, o] of this.tileObjs) {
      const a = t.visible ? elastic((this.wt - t.appearT) / 0.6) : 0;
      o.m.visible = a > 0; if (a <= 0) continue;
      const afford = world.money >= t.price - t.paid;
      const key = `${afford}|${Math.round(t.paid / t.price * 60)}`;
      if (key !== o.key) { o.key = key; this.paintTile(o, t, afford); }
      o.m.scale.setScalar(a * (afford ? 1 + Math.sin(time * 6) * 0.04 : 1));
      labels.push({ k: 'tile', t, a, afford });
    }
    // characters
    for (const w of world.workers) {
      let o = this.chars.get(w) || this.makeChar(w);
      if (!!o.loader !== !!w.loader) { this.levelRoot.remove(o.root); o = this.makeChar(w); }
      this.updateChar(o, dt); this.drawStack(w, o, labels, false);
    }
    this.updateChar(this.player, dt); this.drawStack(world.player, this.player, labels, true);
    // customers (pooled figures)
    const pool = this.custPool, used = this._used || (this._used = {});
    for (const k in used) used[k] = 0;
    for (const cu of world.customers) {
      const key = cu.vip ? 'vip' : cu.hue;
      const list = pool[key] || (pool[key] = []), k = used[key] || 0; used[key] = k + 1;
      let o = list[k];
      if (!o) {
        const st = cu.vip ? VIP : customerStyle(cu.hue); const pp = M.makePerson({ ...st, sleeve: st.sleeve || st.dress || st.shirt, pigtails: !cu.vip && cu.hue % 3 === 2 });
        this.levelRoot.add(pp.root); o = list[k] = { pp, ang: -Math.PI / 2, cu: null };
      }
      if (o.cu !== cu) { o.cu = cu; o.ang = Math.atan2(cu.vx || -1, cu.vy || 0); }
      o.pp.root.visible = true; o.seen = true;
      if (cu.moving) o.ang = angLerp(o.ang, Math.atan2(cu.vx, cu.vy), Math.min(1, dt * 10)); else if (cu.state === 'wait') o.ang = angLerp(o.ang, -Math.PI / 2, Math.min(1, dt * 8));
      o.pp.root.position.set(cu.x, 0, cu.y); o.pp.root.rotation.y = o.ang;
      M.posePerson(o.pp, { t: time, walk: cu.walk, moving: cu.moving, carry: cu.bag.length > 0, seed: cu.hue });
      const fx2 = Math.sin(o.ang), fz2 = Math.cos(o.ang);
      if (cu.vip && cu.state !== 'out') labels.push({ k: 'vip', x: cu.x, y: cu.y, z: 56, item: cu.wish });
      for (let j = 0; j < Math.min(cu.bag.length, 12); j++) { const it = cu.bag[j]; this.item(it, cu.x + fx2 * 10, cu.y + fz2 * 10, 21 + j * CFG.items[it].step * 0.85 + (M.ITEM_HALF[it] || 2), o.ang + Math.PI / 2, 0.85); }
    }
    for (const h in pool) for (let k = used[h] || 0; k < pool[h].length; k++) { pool[h][k].pp.root.visible = false; pool[h][k].cu = null; }
    for (const f of world.fly) this.flyItem(f);
    if (fx) for (const o of fx.wbills) if (o.on && o.t >= 0) {
      const p = o.t / o.dur, x = o.x0 + (o.x1 - o.x0) * p, y = o.y0 + (o.y1 - o.y0) * p, h = 20 + 30 * 4 * p * (1 - p);
      this.itemTumble('bill', x, y, h, Math.sin(o.rot + p * 6) * 0.5, o.rot + p * 4, 1.1);
    }
    this.endItems();
    // guide arrow on the ground
    const pl = world.player;
    if (guide && Math.hypot(guide.x - pl.x, guide.y - pl.y) > 70) {
      const dx = guide.x - pl.x, dy = guide.y - pl.y, d = Math.hypot(dx, dy), r = 36 + Math.sin(time * 6) * 3;
      this.arrowMesh.visible = true; this.arrowMesh.position.set(pl.x + dx / d * r, 0.8, pl.y + dy / d * r);
      this.arrowMesh.rotation.set(-Math.PI / 2, 0, -Math.atan2(dy, dx));
    } else this.arrowMesh.visible = false;
    this.gl.render(this.scene, this.camera);
    // ---- overlay
    const g = this.g; g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); g.clearRect(0, 0, this.W, this.H);
    if (fx) this.fxWorld(fx);
    this.drawExtras(world);
    this.drawLabels(labels, world);
    if (guide) this.arrow(guide);
    if (fx) this.fxScreen(fx);
    if (extra.hand) this.hand(time);
  }

  // ---------------------------------------------------------------- overlay: labels, fx, guide
  label(text, x, y, px, fill = '#FFFFFF', stroke = '#3A2A14', align = 'center') {
    const g = this.g; g.font = FONT(px); g.textAlign = align; g.textBaseline = 'middle';
    g.lineJoin = 'round'; g.lineWidth = Math.max(2.5, px * 0.28); g.strokeStyle = stroke; g.strokeText(text, x, y); g.fillStyle = fill; g.fillText(text, x, y);
  }
  billIcon(x, y, w, h, rot = 0) {
    const g = this.g; g.save(); g.translate(x, y); g.rotate(rot);
    g.fillStyle = '#2F8F3A'; g.beginPath(); g.roundRect(-w / 2 + 1.5, -h / 2 + 1.5, w, h, h * 0.2); g.fill();
    g.fillStyle = '#57C35A'; g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, h * 0.2); g.fill();
    g.fillStyle = '#E9FFE0'; g.beginPath(); g.arc(0, 0, h * 0.28, 0, TAU); g.fill();
    g.restore();
  }
  drawLabels(labels, world) {
    const z = this.z, g = this.g, p = world.player;
    for (const L of labels) {
      if (L.k === 'tile') {
        const t = L.t, S = CFG.tile.size, [px, py] = this.proj(t.x + S * 0.3, t.y + S * 0.3, 1);
        const rem = Math.ceil(t.price - t.paid), txt = `${rem}`, fs = Math.max(12, 12 * z) * L.a;
        g.font = FONT(fs); const tw = g.measureText(txt).width, bw = fs * 1.5, bh = fs * 0.95, total = bw + 4 + tw;
        this.billIcon(px - total / 2 + bw / 2, py, bw, bh, -0.08);
        this.label(txt, px - total / 2 + bw + 4, py, fs, L.afford ? '#FFFFFF' : '#E8F4F6', L.afford ? '#0E6A78' : '#2A3440', 'left');
        if (L.afford || Math.hypot(p.x - t.x, p.y - t.y) < 140) {
          const [lx, ly] = this.proj(t.x - S * 0.5, t.y - S * 0.5, 2);
          this.label(t.buy ? `${t.label} +${t.buy}` : t.label, lx, ly, Math.max(11, 11 * z) * L.a, '#FFFFFF', '#1E3A44');
        }
      } else if (L.k === 'stack') {
        // ONE pill for the player's load: count, or MAX when full. Its screen position is smoothed
        // (no jitter from walk bob / camera lag / shake) and kept on screen; MAX pops in once when
        // the load fills and then stays steady (only a soft glow breathes), with a 去出售 line under it.
        const [tx0, ty0] = this.proj(L.x, L.y, L.z);
        const top = Math.min(this.H * 0.28, 104), tx = Math.min(this.W - 50, Math.max(50, tx0)), ty = Math.min(this.H - 60, Math.max(top, ty0));
        const S = this.stackLbl || (this.stackLbl = { x: tx, y: ty, full: false, fullT: -9, init: false });
        if (!S.init || Math.hypot(tx - S.x, ty - S.y) > this.H * 0.5) { S.x = tx; S.y = ty; S.init = true; }
        const kk = 1 - Math.exp(-(this.frameDt || 1 / 60) * 12); S.x += (tx - S.x) * kk; S.y += (ty - S.y) * kk;
        if (L.full && !S.full) S.fullT = this.time; S.full = L.full;
        const sx = Math.round(S.x), sy = Math.round(S.y), age = this.time - S.fullT;
        const pop = L.full && age < 0.35 ? 1 + Math.sin(age / 0.35 * Math.PI) * 0.35 : 1;
        const txt = L.full ? 'MAX' : `${L.n}`, px = Math.round(Math.max(14, 12.5 * z) * (L.full ? 1.25 : 1)) * pop;
        g.font = FONT(px); const tw = g.measureText(txt).width;
        if (L.full) { g.fillStyle = `rgba(255,90,60,${0.25 + 0.15 * Math.sin(this.time * 4)})`; g.beginPath(); g.roundRect(sx - tw / 2 - 12, sy - px * 0.95, tw + 24, px * 1.9, px * 0.95); g.fill(); }
        g.fillStyle = L.full ? '#FF4D3A' : 'rgba(30,30,30,0.55)';
        g.beginPath(); g.roundRect(sx - tw / 2 - 7, sy - px * 0.72, tw + 14, px * 1.44, px * 0.72); g.fill();
        this.label(txt, sx, sy, px, '#FFFFFF', L.full ? '#9E1B10' : '#1A1A1A');
        if (L.full && this.fullAt !== undefined && this.time - this.fullAt < 2.2) {
          g.globalAlpha = Math.min(1, (2.2 - (this.time - this.fullAt)) * 2);
          this.label('满了！去出售', sx, sy + px * 1.25, Math.max(11, 10 * z), '#FFE2DA', '#9E1B10'); g.globalAlpha = 1;
        }
        this.comboScreen = { x: sx, y: sy + px * 0.72 };
      } else if (L.k === 'lv') {   // 园丁成长 badge
        const [sx0, sy] = this.proj(L.x, L.y, L.z), sx = sx0 - 26 * Math.max(1, z * 0.8), pop = L.pop < 0.5 ? 1 + Math.sin(L.pop / 0.5 * Math.PI) * 0.6 : 1, px = Math.max(8, 7.5 * z) * pop;
        const txt = L.name || `Lv${L.lv}`; g.font = FONT(px); const tw = g.measureText(txt).width;
        g.fillStyle = L.lv >= 5 ? '#FF8A1E' : L.lv >= 3 ? '#FFC21A' : '#6FC3FF';
        g.beginPath(); g.roundRect(sx - tw / 2 - 5, sy - px * 0.7, tw + 10, px * 1.4, px * 0.7); g.fill();
        this.label(txt, sx, sy, px, '#FFFFFF', '#5A3A10');
      } else if (L.k === 'vip') {   // VIP thought bubble: the item + ×2
        const [sx, sy] = this.proj(L.x, L.y, L.z), s = Math.max(0.8, z * 0.8), bob = Math.sin(this.time * 3) * 2;
        g.save(); g.translate(sx, sy - 16 * s + bob);
        g.fillStyle = 'rgba(255,255,255,0.96)'; g.strokeStyle = '#E8B21E'; g.lineWidth = 2;
        g.beginPath(); g.roundRect(-24 * s, -13 * s, 48 * s, 26 * s, 13 * s); g.fill(); g.stroke();
        g.beginPath(); g.arc(-4 * s, 16 * s, 3 * s, 0, TAU); g.fill(); g.stroke(); g.beginPath(); g.arc(-1 * s, 22 * s, 1.8 * s, 0, TAU); g.fill();
        g.save(); g.translate(-10 * s, 0); g.scale(s * 0.85, s * 0.85); drawIcon(g, L.item, 0); g.restore();
        g.restore();
        this.label('×2', sx + 10 * s, sy - 16 * s + bob, 11 * s, '#FFD23F', '#8A4A00');
      } else if (L.k === 'buf') {
        const [sx, sy] = this.proj(L.x, L.y, L.z), px = Math.max(10, 9 * z);
        g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.roundRect(sx - px * 1.5, sy - px * 0.8, px * 3, px * 1.6, px * 0.8); g.fill();
        this.label(`${L.n}`, sx, sy, px, '#5A3414', '#FFFFFF');
      }
    }
  }
  // golden plant sparkles, sprinkler water arcs, 丰收狂热 meter
  drawExtras(world) {
    const g = this.g, z = this.z, t = this.time, sp = this.goldSpots;
    for (let k = 0; k < sp.length; k += 3) {
      const ph = t * 4 + sp[k + 2] * 1.7, a = 0.5 + 0.5 * Math.sin(ph);
      const [sx, sy] = this.proj(sp[k], sp[k + 1], 16 + Math.sin(ph * 0.5) * 3);
      if (sx < -20 || sy < -20 || sx > this.W + 20 || sy > this.H + 20) continue;
      const r = (2.5 + a * 4) * z;
      g.save(); g.translate(sx, sy); g.rotate(ph * 0.3); g.globalAlpha = 0.55 + a * 0.45; g.fillStyle = '#FFF6B0';
      g.beginPath(); for (let i = 0; i < 8; i++) { const rr = (i % 2 ? 0.22 : 1) * r; g.lineTo(Math.cos(i * Math.PI / 4) * rr, Math.sin(i * Math.PI / 4) * rr); } g.closePath(); g.fill();
      g.restore();
    }
    g.globalAlpha = 1;
    for (const o of this.sprinklers) {
      const f = o.f, hx = f.x + f.w / 2, hy = f.y + f.h / 2, R = Math.min(f.w, f.h) * 0.45, head = 24 * 1.2;
      g.fillStyle = 'rgba(150,215,255,0.8)';
      for (let j = 0; j < 3; j++) {
        const ang = t * 2.2 + j * TAU / 3, cx = Math.cos(ang), cy = Math.sin(ang);
        for (let i = 0; i < 12; i++) {
          const u = ((i / 12) + t * 0.9) % 1, d = R * u, h = head + 46 * u * (1 - u) * 2 - head * u;
          const [sx, sy] = this.proj(hx + cx * d, hy + cy * d, Math.max(0, h));
          g.globalAlpha = 0.85 - u * 0.45; g.beginPath(); g.arc(sx, sy, (1.4 + u * 1.4) * z, 0, TAU); g.fill();
        }
      }
      g.globalAlpha = 1;
    }
    // 丰收狂热 meter under the stack count (or over the head with empty hands)
    const A = this.comboAnchor, fever = world.feverT > 0;
    if (A && (world.combo > 0.01 || fever)) {
      let [sx, sy0] = this.proj(A.x, A.y, A.z), sy = sy0 - 6;
      if (A.stack && this.comboScreen) { sx = this.comboScreen.x; sy = this.comboScreen.y + 12 * Math.max(1, z * 0.9) + (world.player.stack.length + world.player.incoming >= world.player.cap && this.time - (this.fullAt ?? -9) < 2.2 ? 14 * Math.max(1, z) : 0); }
      const w = 64 * Math.max(1, z * 0.8), h = 8 * Math.max(1, z * 0.8), f = fever ? world.feverT / CFG.fever.dur : world.combo;
      g.fillStyle = 'rgba(30,30,30,0.6)'; g.beginPath(); g.roundRect(sx - w / 2 - 2, sy - h / 2 - 2, w + 4, h + 4, h); g.fill();
      const gr = g.createLinearGradient(sx - w / 2, 0, sx + w / 2, 0);
      if (fever) { const p = (t * 2) % 1; gr.addColorStop(0, '#FFD23F'); gr.addColorStop(p, '#FFFFFF'); gr.addColorStop(1, '#FF8A1E'); }
      else { gr.addColorStop(0, '#FF8A1E'); gr.addColorStop(1, '#FFD23F'); }
      g.fillStyle = gr; g.beginPath(); g.roundRect(sx - w / 2, sy - h / 2, Math.max(h, w * f), h, h / 2); g.fill();
      if (fever) this.label('丰收狂热!', sx, sy + h * 1.9, Math.max(11, 11 * z) * (1 + Math.sin(t * 10) * 0.06), '#FFE55A', '#8A3A00');
    }
  }
  fxWorld(fx) {
    const g = this.g, z = this.z;
    for (const o of fx.p) if (o.on) {
      const a = Math.min(1, o.life / o.max * 2);
      const [sx, sy] = this.proj(o.x, o.y, o.z);
      if (o.type === 'ring') {
        const k = 1 - o.life / o.max;
        g.strokeStyle = o.color; g.globalAlpha = 1 - k; g.lineWidth = 4 * z * (1 - k) + 1;
        g.beginPath(); g.ellipse(sx, sy, o.size * z * (0.3 + k) * 1.2, o.size * z * (0.3 + k) * 0.75, 0, 0, TAU); g.stroke(); g.globalAlpha = 1; continue;
      }
      g.globalAlpha = a; g.fillStyle = o.color;
      if (o.type === 'leaf' || o.type === 'conf' || o.type === 'petal') { g.save(); g.translate(sx, sy); g.rotate(o.rot); g.beginPath(); g.ellipse(0, 0, o.size * z, o.size * z * 0.5, 0, 0, TAU); g.fill(); g.restore(); }
      else if (o.type === 'star') { g.save(); g.translate(sx, sy); g.rotate(o.rot); g.beginPath(); for (let i = 0; i < 8; i++) { const r = (i % 2 ? 0.4 : 1) * o.size * z; g.lineTo(Math.cos(i * Math.PI / 4) * r, Math.sin(i * Math.PI / 4) * r); } g.closePath(); g.fill(); g.restore(); }
      else { g.beginPath(); g.arc(sx, sy, o.size * z, 0, TAU); g.fill(); }
      g.globalAlpha = 1;
    }
    // number popups: anchored where they spawned, rise a fixed 40–50 screen px with ease-out,
    // pop in, fade out; skipped (never clamped/thrown) when behind the camera or off screen
    for (const o of fx.txt) if (o.on) {
      const [sx, sy0] = this.proj(o.x, o.y, o.z);
      if (this._pw <= 1e-3 || sx < -60 || sx > this.W + 60 || sy0 < -60 || sy0 > this.H + 60) continue;
      const u = Math.min(1, o.age / 0.9), rise = (o.big ? 34 : 46) * (1 - (1 - u) * (1 - u)), k = o.life / o.max;
      const pop = o.age < 0.12 ? 0.7 + o.age / 0.12 * 0.45 : o.age < 0.22 ? 1.15 - (o.age - 0.12) / 0.1 * 0.15 : 1;
      const bump = o.bumpT > 0 ? 1 + o.bumpT * 1.2 : 1;
      g.globalAlpha = Math.min(1, k * 3);
      this.label(o.s, Math.round(sx), Math.round(sy0 - rise), Math.max(o.big ? 20 : 14, (o.big ? 19 : 13) * z) * pop * bump, o.color, '#2A2210');
      g.globalAlpha = 1;
    }
  }
  fxScreen(fx) {
    const g = this.g;
    for (const o of fx.bills) if (o.on && o.t >= 0) {
      const p = o.t / o.dur, e = p * p;
      const x = o.x0 + (o.tx - o.x0) * e + o.cx * Math.sin(p * Math.PI) * 0.5, y = o.y0 + (o.ty - o.y0) * e - Math.sin(p * Math.PI) * 40;
      const s = 1.3 - p * 0.5; this.billIcon(x, y, 22 * s, 13 * s, o.rot + p * 6);
    }
    for (const o of fx.conf) if (o.on) {
      g.save(); g.translate(o.x, o.y); g.rotate(o.rot); g.scale(1, Math.abs(Math.cos(o.rot * 1.7)) * 0.8 + 0.2);
      g.globalAlpha = Math.min(1, o.life); g.fillStyle = o.c; g.fillRect(-o.w / 2, -o.h / 2, o.w, o.h); g.restore();
    }
    g.globalAlpha = 1;
    if (fx.flash > 0) { g.fillStyle = `rgba(255,255,230,${fx.flash * 0.35})`; g.fillRect(0, 0, this.W, this.H); }
  }
  arrow(tg) {
    const g = this.g, z = Math.max(1, this.z), p = this.world.player, t = this.time;
    const bob = Math.abs(Math.sin(t * 5)) * 9;
    const [sx, sy] = this.proj(tg.x, tg.y, 46 + bob);
    const mL = 30, mR = this.W - 30, mT = 90, mB = this.H - 40, s = z * 1.1;
    const drawArrow = (x, y, ang) => {
      g.save(); g.translate(x, y); g.rotate(ang);
      g.beginPath(); g.moveTo(14 * s, 0); g.lineTo(-2 * s, -12 * s); g.lineTo(-2 * s, -5 * s); g.lineTo(-14 * s, -5 * s); g.lineTo(-14 * s, 5 * s); g.lineTo(-2 * s, 5 * s); g.lineTo(-2 * s, 12 * s); g.closePath();
      g.shadowColor = 'rgba(0,0,0,0.25)'; g.shadowBlur = 6 * s; g.shadowOffsetY = 3 * s;
      g.lineJoin = 'round'; g.fillStyle = '#FFFFFF'; g.fill(); g.shadowColor = 'transparent';
      g.lineWidth = 1.4 * s; g.strokeStyle = '#B8D4DE'; g.stroke();
      g.restore();
    };
    const near = Math.hypot(tg.x - p.x, tg.y - p.y) < 45;
    if (near) return;
    if (sx < mL || sx > mR || sy < mT || sy > mB) {
      const [px, py] = this.proj(p.x, p.y, 20), ddx = sx - px, ddy = sy - py;
      let k = 1;
      if (sx < mL) k = Math.min(k, (mL - px) / ddx); if (sx > mR) k = Math.min(k, (mR - px) / ddx);
      if (sy < mT) k = Math.min(k, (mT - py) / ddy); if (sy > mB) k = Math.min(k, (mB - py) / ddy);
      const pulse = 1 + Math.sin(t * 8) * 0.06;
      g.save(); g.translate(px + ddx * k, py + ddy * k); g.scale(pulse, pulse); drawArrow(0, 0, Math.atan2(ddy, ddx)); g.restore();
    } else drawArrow(sx, sy, Math.PI / 2);
  }
  hand(t) {
    const g = this.g, z = Math.max(1, this.z * 0.6);
    const bx = Math.min(this.W * 0.18, 110), by = this.H - Math.min(this.H * 0.22, 100);
    const cx = bx + Math.cos(t * 2.4) * 26 * z, cy = by + Math.sin(t * 2.4) * 14 * z;
    g.save(); g.translate(cx, cy + 18 * z); g.scale(z, z); g.rotate(-0.35);
    g.fillStyle = '#FFFFFF'; g.strokeStyle = '#3A2210'; g.lineWidth = 2.2; g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(-4, 0); g.lineTo(-4, -22); g.quadraticCurveTo(0, -27, 4, -22); g.lineTo(4, -8);
    g.quadraticCurveTo(8, -12, 11, -8); g.quadraticCurveTo(15, -11, 17, -6); g.quadraticCurveTo(21, -8, 22, -2);
    g.lineTo(21, 12); g.quadraticCurveTo(18, 22, 6, 22); g.lineTo(-2, 22); g.quadraticCurveTo(-10, 18, -13, 6); g.lineTo(-15, -2); g.quadraticCurveTo(-12, -6, -6, 0); g.closePath();
    g.fill(); g.stroke();
    g.restore();
  }
}
