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
import * as A from './animals3d.js';
import { makeWoodCrate, makeCargoCrateStack, updateCargoCrateStack, hasPackableCargo, isPackableCargo, cargoCratePosition, cargoItemSlot } from './cargo-crate.js';

const H2 = Math.PI / 2, TAU = Math.PI * 2, PITCH = 0.84, SINP = Math.sin(PITCH), COSP = Math.cos(PITCH), R2 = Math.SQRT1_2;
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
const FISHER = { shirt: '#FFC21A', overalls: '#3567C8', pants: '#3567C8', hair: '#3A2210', hat: 'rain', capColor: '#FFC21A', sleeve: '#FFC21A', boots: '#2F8F3A' };
const CASHIER = { shirt: '#4CD08A', vest: '#2E8A5A', hair: '#3A2210', pants: '#2D3A5A', sleeve: '#4CD08A' };
const CASHIER2 = { shirt: '#FFFFFF', vest: '#E8452C', hair: '#6B3A1E', pants: '#2D3A5A', sleeve: '#FFFFFF', pigtails: true };
// v4.2 搬运工: carry machine goods from the output tray to the second counter
const PORTER = { shirt: '#FFFFFF', overalls: '#E8452C', pants: '#E8452C', hair: '#3A2210', hat: 'cap', capColor: '#FFD23F', sleeve: '#FFFFFF' };
const KOI_GOLD_MAT = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x8A5A00 });
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

const SEASON_LAWN = [['#86D34A', '#76C43C'], null, ['#A8B848', '#97A63C'], ['#DCE8EE', '#CBDCE4']];   // 春 夏(default) 秋 冬
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
    this.dist = Math.max(vw / (2 * tv * (w / h)), vh * SINP / (2 * tv)) * (this.viewZoom || 1);   // v4.1: a little closer on tablets
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
    if (rawDt > 0.25 || this.qLocked) return;   // v4.1: a quality picked in 设置 stays put
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
    this.applyMood(w);
    this.chars = new Map(); this.custPool = {}; this.tileObjs = new Map();
    this.buildGround(w);
    this.decoSlots = this.planDecos(w);
    this.buildEnv(w);
    this.buildDecos(w);
    this.buildFields(w);
    this.buildPonds(w);
    this.buildPiles(w);
    this.buildCoops(w);
    this.buildCounters(w);
    this.buildProcs(w);
    this.buildTiles(w);
    this.player = this.makeChar(w.player);
    this.dogObj = null;
    if (w.dog) { const pp = M.makePet('dog', this.petCol || { body: '#E89A44', belly: '#FFF3DC', ear: '#C8752A', nose: '#2A1A10' }); this.levelRoot.add(pp.root); this.dogObj = { pp, ang: 0.8 }; }
    const t = this.camTarget(w); this.cam.x = t.x; this.cam.y = t.y; this.clampCam();
    this.applyQuality();
    this.groundDirty = false;
  }
  // v3.7 夜间农场: moonlit lighting (dark blue sky/fog, dim cool light); every other level the sunny default
  // v4.0 四季: lawn colours per season (null season = the default summer green); rain: a softer, greyer light
  applyMood(w) {
    const night = !!(w.deco && w.deco.night), rain = !!w.rain;
    this.night = night; this.rain = rain; this.season = Number.isInteger(w.season) ? w.season : null;
    const L = this.season === null ? null : SEASON_LAWN[this.season];
    this.lawn = L ? L[0] : COL.lawn; this.lawn2 = L ? L[1] : COL.lawn2;
    this.gl.setClearColor(new THREE.Color(night ? '#0E1A3A' : this.lawn2));
    this.scene.fog.color.set(night ? '#101C40' : rain ? '#AEBCC8' : this.season === 3 ? '#DCEAF2' : '#A8DDF0'); this.scene.fog.near = night ? 1100 : 1400; this.scene.fog.far = night ? 2400 : 2600;
    this.hemi.color.set(night ? 0x8FA4E8 : rain ? 0xDCE6F0 : 0xFFFFFF); this.hemi.groundColor.set(night ? 0x24304A : 0x7AA850); this.hemi.intensity = night ? 1.25 : rain ? 1.75 : 1.9;
    this.sun.color.set(night ? 0xB8C8FF : rain ? 0xE8EEF5 : 0xFFF4DD); this.sun.intensity = night ? 1.0 : rain ? 1.55 : 2.1;
  }
  buildGround(w) {
    const M0 = 1600;
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(w.W + M0 * 2, w.H + M0 * 2), new THREE.MeshLambertMaterial({ color: this.lawn2 || COL.lawn2 }));
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
    g.fillStyle = this.lawn2 || COL.lawn2; g.fillRect(-pad, -pad, w.W + pad * 2, w.H + pad * 2);
    g.fillStyle = this.lawn || COL.lawn; g.fillRect(0, 0, w.W, w.H);
    for (let x = 0; x < w.W; x += 36) { g.fillStyle = (x / 36) % 2 ? 'rgba(255,255,255,0.06)' : 'rgba(40,110,20,0.06)'; g.fillRect(x, 0, 36, w.H); }
    for (let i = 0; i < 160; i++) { g.fillStyle = i % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(40,100,20,0.07)'; g.beginPath(); g.ellipse(R(i) * w.W, R(i + 500) * w.H, 14 + R(i + 900) * 30, 8 + R(i + 1300) * 16, 0, 0, TAU); g.fill(); }
    // v4.0 四季 on the lawn: spring daisies, autumn leaf litter, winter snow drifts (painted once, under everything)
    const se = this.fest === 'xmas' ? 3 : this.season;
    if (se === 0) for (let i = 0; i < w.W * w.H / 900; i++) { g.fillStyle = ['#FFFFFF', '#FFD9E8', '#FFE97A', '#FF8FB0'][i % 4]; g.beginPath(); g.arc(R(i + 9100) * (w.W + pad * 2) - pad, R(i + 9400) * (w.H + pad * 2) - pad, 1.6 + R(i + 9700) * 1.2, 0, TAU); g.fill(); }
    if (se === 2) for (let i = 0; i < w.W * w.H / 500; i++) { g.fillStyle = ['#E8871E', '#C8551E', '#F6C343', '#B8742A'][i % 4]; g.globalAlpha = 0.75; g.beginPath(); g.ellipse(R(i + 9100) * (w.W + pad * 2) - pad, R(i + 9400) * (w.H + pad * 2) - pad, 3 + R(i + 9700) * 2, 1.6 + R(i) * 1.2, R(i + 3) * 3, 0, TAU); g.fill(); }
    if (se === 3) { for (let i = 0; i < 90; i++) { g.fillStyle = i % 2 ? 'rgba(255,255,255,0.75)' : 'rgba(200,220,235,0.5)'; g.beginPath(); g.ellipse(R(i + 9100) * (w.W + pad * 2) - pad, R(i + 9400) * (w.H + pad * 2) - pad, 20 + R(i + 9700) * 40, 10 + R(i) * 16, 0, 0, TAU); g.fill(); } }
    g.globalAlpha = 1;
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
    for (const p of w.procs) {
      pave(p.inZone.x - 8, p.y - 34, p.body.x + p.body.w - p.inZone.x + 18, 68);
      if (p.pile) { const t = p.pile; pave(t.x - 6, t.y - 6, t.w + 12, t.h + 12); g.strokeStyle = 'rgba(255,255,255,0.7)'; g.setLineDash([5, 4]); g.lineWidth = 1.6; g.strokeRect(t.x - 2, t.y - 2, t.w + 4, t.h + 4); g.setLineDash([]); }
    }
    for (const t of w.trays || []) {   // v4.8.4: raw-goods tray, same dashed outline as a machine tray
      const pl = t.pile; pave(pl.x - 6, pl.y - 6, pl.w + 12, pl.h + 12); g.strokeStyle = 'rgba(255,255,255,0.7)'; g.setLineDash([5, 4]); g.lineWidth = 1.6; g.strokeRect(pl.x - 2, pl.y - 2, pl.w + 4, pl.h + 4); g.setLineDash([]);
    }
    // v4.9.5: wooden stands are flat boards lying on the ground (same board as the 3D mesh);
    // paint the planks here too so the top-down map shows wood. Hidden stands are skipped —
    // the ground repaints when they are revealed (world emits 'ground' on show).
    const woodBoard = (x, y, pw, ph, seed) => {
      g.fillStyle = '#5E3A1A'; g.fillRect(x - 2, y - 2, pw + 4, ph + 4);   // dark edge
      g.fillStyle = '#7A4A22'; g.fillRect(x, y, pw, ph);                    // dark base (the seams)
      const n = Math.max(3, Math.round(pw / 10));
      for (let i = 0; i < n; i++) {
        g.fillStyle = i % 2 ? '#A86D37' : '#C8874A';
        g.fillRect(x + 1 + i * (pw - 2) / n, y + 1, (pw - 2) / n - 1.2, ph - 2);
      }
      for (let i = 0; i < 30; i++) { g.fillStyle = i % 2 ? 'rgba(90,50,20,0.3)' : 'rgba(255,220,160,0.3)'; g.fillRect(x + R(seed + i * 7) * pw, y + R(seed + i * 13) * ph, 2, 1); }
    };
    for (const a of Object.values(w.objs)) if (a.kind === 'stand' && !a.hidden) woodBoard(a.x - a.w / 2, a.y - a.h / 2, a.w, a.h, a.x * 1000 + a.y);
    // v4.2 鱼塘: the full basin is a damp grassy hollow; the water (and its stone-edged shore) grows with the pond level
    for (const pd of w.ponds) {
      g.fillStyle = 'rgba(70,130,40,0.35)'; g.fillRect(pd.X - 4, pd.Y - 4, pd.MW + 8, pd.MH + 8);
      for (let i = 0; i < pd.MW * pd.MH / 300; i++) { g.fillStyle = i % 3 ? 'rgba(40,100,20,0.25)' : 'rgba(200,230,140,0.3)'; g.fillRect(pd.X + R(i + 6100) * pd.MW, pd.Y + R(i + 6300) * pd.MH, 1.4, 4); }
      g.setLineDash([8, 6]); g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1.5; g.strokeRect(pd.X - 4, pd.Y - 4, pd.MW + 8, pd.MH + 8); g.setLineDash([]);
      const x = pd.x, y = pd.y, pw = pd.w, ph = pd.h;
      g.fillStyle = '#B9B2A4'; g.beginPath(); g.roundRect(x - 7, y - 7, pw + 14, ph + 14, 16); g.fill();
      g.fillStyle = '#E3D3A8'; g.beginPath(); g.roundRect(x - 4, y - 4, pw + 8, ph + 8, 13); g.fill();
      if (pd.hidden) { g.fillStyle = '#9C7A50'; g.beginPath(); g.roundRect(x, y, pw, ph, 10); g.fill(); continue; }
      const gr2 = g.createRadialGradient(x + pw / 2, y + ph / 2, 10, x + pw / 2, y + ph / 2, Math.max(pw, ph) * 0.7);
      gr2.addColorStop(0, '#2A86C8'); gr2.addColorStop(1, '#5CC0EE'); g.fillStyle = gr2; g.beginPath(); g.roundRect(x, y, pw, ph, 10); g.fill();
      for (let i = 0; i < pw * ph / 300; i++) { g.strokeStyle = i % 3 ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.34)'; g.lineWidth = 1.2; g.beginPath(); g.ellipse(x + 8 + R(i + 8100) * (pw - 16), y + 8 + R(i + 8300) * (ph - 16), 4 + R(i) * 7, 1.4 + R(i + 1) * 1.6, 0, 0, Math.PI); g.stroke(); }
      for (let i = 0; i < 10 + pd.lv * 3; i++) { const e = i % 4, u = 0.1 + R(i + 8600) * 0.8; const lx = e === 0 ? x + u * pw : e === 1 ? x + pw - 7 : e === 2 ? x + u * pw : x + 7, ly = e === 0 ? y + 7 : e === 1 ? y + u * ph : e === 2 ? y + ph - 7 : y + u * ph;
        g.fillStyle = '#4FAE32'; g.beginPath(); g.arc(lx, ly, 5, 0.5, TAU - 0.2); g.lineTo(lx, ly); g.fill(); if (i % 3 === 0) { g.fillStyle = '#FF8FB0'; g.beginPath(); g.arc(lx + 1, ly - 1, 2, 0, TAU); g.fill(); } }
    }
    for (const f of w.fields) {
      const water = f.item === 'fish';
      const bed = f.hidden && !water ? COL.soil : { tulip: '#3F8A2C', rose: '#3A7A28', gold: '#4F9A26', wheat: '#8E6A34', potato: COL.soil, log: '#4F8A26', corn: '#9A7438', pumpkin: '#8A5A30', berry: '#3F8A2C',
        fish: f.hidden ? '#8FBFD8' : '#3FA8E0', grape: '#9A7A4A', tomato: '#8A5A30', pepper: '#8A5A30' }[f.item];
      const edge = f.hidden && !water ? COL.soil2 : { tulip: '#2E6A1E', rose: '#2A5E1C', gold: '#3E8420', wheat: '#6E5026', potato: COL.soil2, log: '#3A6E1C', corn: '#76562A', pumpkin: '#6A4422', berry: '#2E6A1E',
        fish: '#B9B2A4', grape: '#76562A', tomato: '#6A4422', pepper: '#6A4422' }[f.item];
      g.fillStyle = edge; g.fillRect(f.x - 6, f.y - 6, f.w + 12, f.h + 12);
      g.fillStyle = bed; g.fillRect(f.x - 3, f.y - 3, f.w + 6, f.h + 6);
      if (water) {   // pond: a deeper middle, light ripples and sparkles, lily pads by the bank (a dug pond fills when bought)
        if (f.hidden) continue;
        const gr2 = g.createRadialGradient(f.x + f.w / 2, f.y + f.h / 2, 10, f.x + f.w / 2, f.y + f.h / 2, Math.max(f.w, f.h) * 0.7);
        gr2.addColorStop(0, '#2A86C8'); gr2.addColorStop(1, '#5CC0EE'); g.fillStyle = gr2; g.fillRect(f.x - 3, f.y - 3, f.w + 6, f.h + 6);
        for (let i = 0; i < f.w * f.h / 260; i++) { g.strokeStyle = i % 3 ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.4)'; g.lineWidth = 1.2; g.beginPath(); g.ellipse(f.x + R(i + 8100) * f.w, f.y + R(i + 8300) * f.h, 4 + R(i) * 7, 1.4 + R(i + 1) * 1.6, 0, 0, Math.PI); g.stroke(); }
        for (let i = 0; i < 14; i++) { const e = i % 4, u = R(i + 8600); const lx = e === 0 ? f.x + u * f.w : e === 1 ? f.x + f.w - 6 : e === 2 ? f.x + u * f.w : f.x + 6, ly = e === 0 ? f.y + 6 : e === 1 ? f.y + u * f.h : e === 2 ? f.y + f.h - 6 : f.y + u * f.h;
          g.fillStyle = '#4FAE32'; g.beginPath(); g.arc(lx, ly, 5, 0.5, TAU - 0.2); g.lineTo(lx, ly); g.fill(); if (i % 3 === 0) { g.fillStyle = '#FF8FB0'; g.beginPath(); g.arc(lx + 1, ly - 1, 2, 0, TAU); g.fill(); } }
        continue;
      }
      if (f.item === 'grape' && !f.hidden) {   // vineyard: straw-coloured aisles between the rows
        for (let r = 0; r < f.rows; r++) { const yy = f.y + (r + 0.5) * f.gy; g.fillStyle = '#5E8A2E'; g.fillRect(f.x - 3, yy - 4, f.w + 6, 8); }
        continue;
      }
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
    M.setSeason(Number.isInteger(w.season) ? w.season : null);
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
      if (this.fest === 'xmas' && (Math.hypot(x - gx - 25, yy - w.H - 150) < 95 || Math.hypot(x + 120, yy - w.H * 0.35) < 70)) continue;   // and the 圣诞树
      M.Env.tree(out, x, yy, R(i + 77) > 0.6 ? 'cone' : 'round', 0.9 + R(i + 3) * 0.5);
    }
    const dc = w.deco;
    for (const h of dc.hedges || []) M.Env.hedge(out, h[0], h[1], h[2], h[3], 16);
    for (const t of dc.trees || []) M.Env.tree(out, t[0], t[1], t[2], 1);
    for (const b of dc.bushes || []) M.Env.shrub(out, b[0], b[1], (b[0] + b[1]) % 3 ? '#FFFFFF' : '#FF8FB0');
    if (dc.barn) M.Env.barn(out, dc.barn[0], dc.barn[1]);
    // low wooden rims round the field beds
    for (const f of w.fields) {
      if (f.item === 'grape') M.Env.trellis(out, f);
      if (f.item === 'fish') {   // pond: a stone bank instead of a wooden rim, reeds in the corners
        const st = '#C9C2B2';
        out.push(M.P(M.box(f.w + 16, 3.4, 6), st, [f.x + f.w / 2, 1.7, f.y - 5])); out.push(M.P(M.box(f.w + 16, 3.4, 6), st, [f.x + f.w / 2, 1.7, f.y + f.h + 5]));
        out.push(M.P(M.box(6, 3.4, f.h + 6), st, [f.x - 5, 1.7, f.y + f.h / 2])); out.push(M.P(M.box(6, 3.4, f.h + 6), st, [f.x + f.w + 5, 1.7, f.y + f.h / 2]));
        for (const [cx, cy] of [[f.x + 4, f.y + 4], [f.x + f.w - 4, f.y + 4], [f.x + 4, f.y + f.h - 4], [f.x + f.w - 4, f.y + f.h - 4]]) for (let k = 0; k < 5; k++) { const a = k * 1.3; out.push(M.P(M.cyl(0.5, 0.7, 10 + (k % 3) * 3, 4), '#5DA53A', [cx + Math.cos(a) * 3, 5 + (k % 3) * 1.5, cy + Math.sin(a) * 3])); if (k % 2 === 0) out.push(M.P(M.cap(0.9, 2.2, 2, 5), '#8E5627', [cx + Math.cos(a) * 3, 11 + (k % 3) * 3, cy + Math.sin(a) * 3])); }
        continue;
      }
      const c = f.item === 'wheat' || f.item === 'potato' || f.item === 'corn' || f.item === 'pumpkin' || f.item === 'grape' || f.item === 'tomato' || f.item === 'pepper' ? '#8E5627' : f.item === 'log' ? '#6B4A22' : '#2E6A1E';
      out.push(M.P(M.box(f.w + 14, 3, 4), c, [f.x + f.w / 2, 1.5, f.y - 5])); out.push(M.P(M.box(f.w + 14, 3, 4), c, [f.x + f.w / 2, 1.5, f.y + f.h + 5]));
      out.push(M.P(M.box(4, 3, f.h + 6), c, [f.x - 5, 1.5, f.y + f.h / 2])); out.push(M.P(M.box(4, 3, f.h + 6), c, [f.x + f.w + 5, 1.5, f.y + f.h / 2]));
    }
    for (const gh of dc.greenhouse || []) M.Env.greenhouseFrame(out, ...gh);
    for (const l of dc.lanterns || []) M.Env.lantern(out, l[0], l[1]);
    this.buildFestival(out, w, gx, gates);
    const mesh = new THREE.Mesh(M.merge(out), M.vcMat()); mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.own = true;
    this.levelRoot.add(mesh);
    // v3.7 greenhouse glass: one see-through mesh (no depth write, so plants and people under it stay visible)
    if ((dc.greenhouse || []).length) {
      const gl = []; for (const gh of dc.greenhouse) M.Env.greenhouseGlass(gl, ...gh);
      const gm = new THREE.Mesh(M.merge(gl), new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }));
      gm.renderOrder = 4; gm.userData.own = gm.userData.ownMat = true; this.levelRoot.add(gm);
    }
    // v3.7 night lanterns: unlit glowing globes + a soft warm pool of light on the ground
    this.lanternGlow = [];
    if ((dc.lanterns || []).length) {
      const globes = [];
      for (const l of dc.lanterns) globes.push(M.P(M.sph(3.4, 9, 7), '#FFE08A', [l[0] + 8, 23.6, l[1]], [0, 0, 0], [1, 1.2, 1]), M.P(M.cyl(2.4, 2.4, 1, 8), '#2A2A30', [l[0] + 8, 19.4, l[1]]));
      const gm = new THREE.Mesh(M.merge(globes), new THREE.MeshBasicMaterial({ vertexColors: true })); gm.userData.own = gm.userData.ownMat = true; this.levelRoot.add(gm);
      for (const l of dc.lanterns) {
        const pool = this.decal(150, 150, (g, W, H) => { const gr = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2); gr.addColorStop(0, 'rgba(255,200,110,0.32)'); gr.addColorStop(0.45, 'rgba(255,180,90,0.12)'); gr.addColorStop(1, 'rgba(255,170,60,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); }, 1.4);
        pool.material.blending = THREE.AdditiveBlending; pool.position.set(l[0] + 8, 0.35, l[1]); this.levelRoot.add(pool); this.lanternGlow.push({ x: l[0] + 8, y: l[1], m: pool });
      }
    }
  }
  // v4.0 B 节日: pumpkin lanterns (万圣节), a big tree + snow drifts (圣诞), strings of red lanterns (春节),
  // all outside the fence (no gameplay), mostly on the south / west sides the camera looks across
  buildFestival(out, w, gx, gates) {
    const f = this.fest; if (!f) return;
    const clear = (x, y, r = 40) => !this.decoSlots.some((d) => Math.hypot(d.x - x, d.y - y) < r);
    const farm = (w.deco.theme || 'garden') === 'farm', top = farm ? 17 : 20.5;
    // at every open sale desk (where the player keeps coming back): a lantern / tree / string of lanterns
    for (const c of w.counters) {
      if (c.hidden) continue;
      if (f === 'halloween') { M.Fest.jackLantern(out, c.x - 4, c.y - 25, 0.7, 0.8, CFG.counter.deskH); M.Fest.jackLantern(out, c.x + 28, c.y - 46, 1.5, 0.8); }
      else if (f === 'xmas') { M.Fest.xmasTree(out, c.x + 32, c.y - 54, 0.8); M.Fest.snowMound(out, c.x + 32, c.y - 54, 16); }
      else if (f === 'cny') M.Fest.lanternString(out, c.x - 26, c.y - 50, 74, 0, 1.6);
    }
    // on top of the wall pillars (北 / 西 / 南 every 120): pumpkins (万圣节) or a red lantern (春节)
    if (f === 'halloween' || f === 'cny') {
      const put = (x, y) => { if (f === 'halloween') M.Fest.jackLantern(out, x, y, 0.75, 0.8, top); else { out.push(M.P(M.sph(3.6, 8, 6), '#E8283C', [x, top + 4, y], [0, 0, 0], [1, 1.15, 1]), M.P(M.cyl(2, 2, 1, 6), '#FFC21A', [x, top + 8.4, y]), M.P(M.cyl(2, 2, 1, 6), '#FFC21A', [x, top - 0.2, y])); } };
      for (let x = 0; x <= w.W; x += 120) { put(x, -6); if (x < gx - 20 || x > gx + 70) put(x, w.H + 6); }
      for (let y = 120; y < w.H; y += 120) put(-6, y);
    }
    if (f === 'halloween') {
      let k = 0;
      for (let x = 40; x < w.W - 20; x += 95) { if (x > gx - 30 && x < gx + 80) continue; if (clear(x, w.H + 34)) M.Fest.jackLantern(out, x, w.H + 34, 1.15 + (k % 2) * 0.25, 0.6); k++; }
      for (let y = 50; y < w.H; y += 110) M.Fest.jackLantern(out, -34, y, 1.2, 1.3);
      for (let x = 80; x < w.W; x += 160) M.Fest.jackLantern(out, x, -32, 1.1, 0.3);
      M.Fest.jackLantern(out, gx - 16, w.H + 28, 1.6, 0.7); M.Fest.jackLantern(out, gx + 66, w.H + 28, 1.6, 0.4);
    } else if (f === 'xmas') {
      M.Fest.xmasTree(out, gx + 25, w.H + 150, 1.6);
      M.Fest.xmasTree(out, -120, w.H * 0.35, 1.1);
      for (let i = 0; i < 26; i++) { const u = hash(i * 31 + 7), side = i % 3; const x = side === 0 ? u * w.W : side === 1 ? -40 - hash(i) * 30 : u * w.W, y = side === 0 ? w.H + 40 + hash(i + 3) * 40 : side === 1 ? u * w.H : -40 - hash(i) * 20; if (clear(x, y, 34)) M.Fest.snowMound(out, x, y, 10 + hash(i + 9) * 12); }
    } else if (f === 'cny') {
      const xs = []; for (let x = 20; x < w.W; x += 130) { if (x > gx - 40 && x < gx + 90) continue; xs.push(x); }
      for (let i = 0; i + 1 < xs.length; i++) if (xs[i + 1] - xs[i] < 200) M.Fest.lanternString(out, xs[i], w.H + 26, xs[i + 1] - xs[i], 0);
      for (let x = 20; x + 130 < w.W; x += 260) M.Fest.lanternString(out, x, -26, 130, 0);
      for (let y = 30; y + 120 < w.H; y += 240) M.Fest.lanternString(out, -26, y, 0, 120);
      M.Fest.lanternString(out, gx - 14, w.H + 26, 78, 0);
    }
  }
  // 商店 decorations: outside the fence, along the south side either side of the gate (the side
  // nearest the camera), then along the west side. Purely scenery: no collision, no gameplay.
  setDecos(ids) { this.decoIds = (ids || []).slice(); }
  // v4.0 B: the festival on now (scenery in every level) and the dog's colours (null = no dog)
  setFestival(id) { this.fest = id || null; }
  setPet(col) { this.petCol = col || null; }
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
        ang[i] = f.item === 'grape' ? (hash(i * 13 + f.x) - 0.5) * 0.08 : hash(i * 13 + f.x) * TAU; sz[i] = 0.88 + hash(i * 7 + f.y) * 0.24;
        put(stub.instanceMatrix.array, i, f.px(i), 0, f.py(i), ang[i], 0);
      }
      stub.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      grp.add(stub);
      const gold = new THREE.InstancedMesh(M.cropGeo(f.item, 0), GOLD_MAT, 96);
      gold.count = 0; gold.frustumCulled = false; gold.castShadow = true; gold.instanceMatrix.setUsage(THREE.DynamicDrawUsage); grp.add(gold);
      const spr = M.makeSprinkler(); spr.root.position.set(f.x + f.w / 2, 0, f.y + f.h / 2); spr.root.visible = false; this.levelRoot.add(spr.root);
      this.fieldObjs.push({ f, grp, meshes, stub, gold, spr, goldPrev: new Uint8Array(f.n), stubOn: new Uint8Array(f.n), slot, vi, ang, sz, last, scale: (f.gap / 9) * ({ wheat: 1.3, tulip: 1.15, gold: 1.2, rose: 1.15, potato: 0.42, log: 0.95, corn: 1.3, pumpkin: 0.8, berry: 1.85, apple: 1.35, fish: 0.68, grape: 1.3, tomato: 1.15, pepper: 1.15 }[f.item] || 1) });
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
  // ---------------------------------------------------------------- v4.2 鱼塘
  // one InstancedMesh per species for every fish of every pond (refilled each frame: ≤ ~170 matrices);
  // a stone bank + reeds round the current water (rebuilt when the pond levels up); the 投喂器 post
  buildPonds(w) {
    this.pondObjs = [];
    this.fishIM = null;
    if (!w.ponds.length) return;
    const cap = w.ponds.length * 100;
    this.fishIM = [0, 1, 2, 3].map((sp) => {
      const im = new THREE.InstancedMesh(M.swimFishGeo(sp), sp === 3 ? KOI_GOLD_MAT : M.vcMat(), cap);
      im.count = 0; im.frustumCulled = false; im.castShadow = false; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.levelRoot.add(im);
      return im;
    });
    for (const pd of w.ponds) this.pondObjs.push({ pd, bank: null, lv: -1, feeder: null });
  }
  pondBank(o) {
    const pd = o.pd;
    if (o.bank) { this.levelRoot.remove(o.bank); o.bank.geometry.dispose(); }
    const out = [], st = '#C9C2B2', st2 = '#B3AB98', x = pd.x, y = pd.y, w = pd.w, h = pd.h;
    // rounded stones along the four banks
    const stones = (x0, y0, x1, y1) => { const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.round(L / 13)); for (let i = 0; i <= n; i++) { const u = i / n, k = hash(i * 7 + x0 * 3 + y0); out.push(M.P(M.sph(4.6 + k * 1.6, 7, 4), k > 0.5 ? st : st2, [x0 + (x1 - x0) * u, 1.2, y0 + (y1 - y0) * u], [0, k * 3, 0], [1.2, 0.55, 1])); } };
    stones(x - 7, y - 7, x + w + 7, y - 7); stones(x - 7, y + h + 7, x + w + 7, y + h + 7); stones(x - 7, y - 7, x - 7, y + h + 7); stones(x + w + 7, y - 7, x + w + 7, y + h + 7);
    for (const [cx, cy] of [[x + 6, y + 6], [x + w - 6, y + 6], [x + 6, y + h - 6], [x + w - 6, y + h - 6]]) for (let k = 0; k < 6; k++) { const a = k * 1.1; out.push(M.P(M.cyl(0.5, 0.7, 10 + (k % 3) * 3, 4), '#5DA53A', [cx + Math.cos(a) * 3.4, 5 + (k % 3) * 1.5, cy + Math.sin(a) * 3.4])); if (k % 2 === 0) out.push(M.P(M.cap(0.9, 2.2, 2, 5), '#8E5627', [cx + Math.cos(a) * 3.4, 11 + (k % 3) * 3, cy + Math.sin(a) * 3.4])); }
    o.bank = new THREE.Mesh(M.merge(out), M.vcMat()); o.bank.castShadow = true; o.bank.receiveShadow = true; o.bank.userData.own = true; this.levelRoot.add(o.bank);
    o.lv = pd.lv;
  }
  updatePonds() {
    if (!this.fishIM) return;
    const cnt = [0, 0, 0, 0], t = this.time;
    for (const o of this.pondObjs) {
      const pd = o.pd;
      if (o.lv !== pd.lv) this.pondBank(o);
      if (pd.feeder && !o.feeder) {
        const F = pd.feeder, fx = Math.min(pd.x + pd.w + 12, Math.max(pd.x - 12, F.x)), fy = Math.min(pd.y + pd.h + 12, Math.max(pd.y - 12, F.y));
        o.feeder = new THREE.Mesh(M.feederGeo(), M.vcMat()); o.feeder.castShadow = true; o.feeder.position.set(fx, 0, fy);
        o.feeder.rotation.y = Math.atan2(pd.x + pd.w / 2 - fx, pd.y + pd.h / 2 - fy); o.feeder.userData.own = true; this.levelRoot.add(o.feeder);
      }
      if (o.feeder) { const F = pd.feeder, fx = Math.min(pd.x + pd.w + 12, Math.max(pd.x - 12, F.x)), fy = Math.min(pd.y + pd.h + 12, Math.max(pd.y - 12, F.y)); o.feeder.position.set(fx, 0, fy); o.feeder.scale.setScalar(Math.max(0.001, elastic((this.wt - pd.feederT) / 0.6)) * (1 + (pd.feeding > 0 ? Math.sin(t * 18) * 0.03 : 0))); }
      if (pd.hidden) continue;
      if (pd.sprinkler) this.sprinklers.push({ f: pd });
      const app = Math.max(0, Math.min(1, (this.wt - pd.appearT) / 0.5));
      for (const f of pd.fish) {
        const sp = f.gold ? 3 : f.sp, im = this.fishIM[sp], k = cnt[sp]++;
        const sw = Math.sin(f.ph) * (f.sc > 0 ? 0.35 : 0.2), size = (sp === 0 ? 1.2 : sp === 1 ? 1.42 : 1.58) * (0.9 + (f.id % 7) * 0.03) * (pd.appearT > 0 ? 0.4 + 0.6 * app : 1);
        put(im.instanceMatrix.array, k, f.x, 1.2 + Math.sin(f.ph * 0.5) * 0.25, f.y, Math.atan2(f.vx, f.vy) + sw, size);
      }
    }
    for (let sp = 0; sp < 4; sp++) { const im = this.fishIM[sp]; im.count = cnt[sp]; if (cnt[sp]) im.instanceMatrix.needsUpdate = true; }
  }
  buildPiles(w) {
    this.pileObjs = w.piles.map((pl) => {
      const im = new THREE.InstancedMesh(M.itemGeo(pl.type), M.vcMat(), pl.cap + 64);
      im.count = 0; im.frustumCulled = false; im.castShadow = true; im.receiveShadow = true; im.userData.plant = true; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.levelRoot.add(im);
      let stand = null;
      if (pl.owner.kind === 'stand') {
        const grp = new THREE.Group(); grp.position.set(pl.owner.x, 0, pl.owner.y);
        const out = []; M.Env.stockStand(out, pl.owner.w, pl.owner.h);
        const board = new THREE.Mesh(M.merge(out), M.vcMat()); board.castShadow = true; board.receiveShadow = true; board.userData.own = true; grp.add(board);
        this.levelRoot.add(grp); stand = { grp, board, baseH: 2 }; pl.baseH = 2;
      }
      return { pl, im, stand, total: -1, any: true };
    });
  }
  updatePiles() {
    const L = CFG.pile.layer;
    for (const o of this.pileObjs) {
      const pl = o.pl; o.im.visible = !pl.owner.hidden; if (o.stand) o.stand.grp.visible = !pl.owner.hidden; if (pl.owner.hidden) continue;
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
          // v4.8.6: the newest layer pops in small and grows as its bump settles, so a
          // fresh delivery reads as a little "thunk" instead of silently appearing.
          const grow = j === h - 1 ? 1 - bb * 0.45 : 1;
          put(arr, k++, cx + (hv - 0.5) * pl.cw * 0.6, (pl.baseH || 0) + j * L + half + top, cy + (hv2 - 0.5) * pl.ch * 0.6, hv * TAU, (1.05 + hv2 * 0.2) * grow);
        }
      }
      o.im.count = k; o.im.instanceMatrix.needsUpdate = true;
    }
  }
  buildCoops(w) {
    this.animals = []; this.procAnimals = false;
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
          const k = { cow: 1.15, sheep: 1.15, hive: 1.15, appletree: 1.35 }[c.producer] || 1;
          const ani = A.makeAnimal(c.producer, this.animals.length + 1);   // v4.4 animated Quaternius cow / sheep
          let m;
          if (ani) { m = ani.root; m.userData.ani = ani; this.animals.push(ani); }
          else { if (c.producer === 'cow' || c.producer === 'sheep') this.procAnimals = true; const geo = { cow: M.cowGeo, sheep: M.sheepGeo, hive: M.hiveGeo, appletree: M.appleTreeGeo }[c.producer]; m = new THREE.Mesh(this._prodGeo(c.producer, geo), M.vcMat()); m.castShadow = true; }
          g.add(m); m.scale.setScalar(k); m.userData.k = k;
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
      const zone = this.decal(c.zone.w, c.zone.h, (g, W, H) => this.paintZone(g, W, H, c.sale2 ? '加工品' : '出售', null));
      zone.position.set(c.zone.cx, 0.3, c.zone.cy); this.levelRoot.add(zone);
      // Six small open crates fit the blue counter top; they appear only when it holds
      // boxable harvest, so the crop stays visible and retains its real item identity.
      const crateSlots = [];
      const crateScale = 0.30;
      for (const x of [-7.5, 7.5]) for (const z of [-21, 0, 21]) {
        const crate = makeWoodCrate(); crate.scale.setScalar(crateScale);
        crate.position.set(x, CFG.counter.deskH, z);
        crate.visible = false; grp.add(crate); crateSlots.push(crate);
      }
      const cash = this.decal(42, 42, (g, W, H) => {
        g.fillStyle = 'rgba(40,52,60,0.55)'; g.beginPath(); g.roundRect(4, 4, W - 8, H - 8, 10); g.fill();
        g.setLineDash([12, 8]); g.strokeStyle = 'rgba(120,230,240,0.9)'; g.lineWidth = 4; g.beginPath(); g.roundRect(8, 8, W - 16, H - 16, 8); g.stroke();
      });
      cash.position.set(c.cashPos.x, 0.3, c.cashPos.y); this.levelRoot.add(cash);
      let cashier = null;
      return { c, grp, zone, cash, cashier, crateSlots };
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
      if (p.outItem === 'flour') {   // 磨坊: a little tower with turning sails on the front face
        const tw = new THREE.Mesh(M.merge([M.P(M.cyl(7, 9, 16, 8), '#FFF3DC', [0, 8, 0]), M.P(M.cone(9.4, 9, 8), '#E8452C', [0, 20.5, 0])]), M.vcMat());
        tw.position.set(-p.body.w / 2 + 12, CFG.proc.bodyH, 0); tw.castShadow = true; grp.add(tw);
        const sails = new THREE.Mesh(M.windmillSails(), M.vcMat()); sails.scale.setScalar(1.25); sails.position.set(-p.body.w / 2 + 12, CFG.proc.bodyH + 14, 9.5); sails.castShadow = true; grp.add(sails); grp.userData.sails = sails;
      } else if (p.outItem === 'bread') {   // 面包房: a brick dome oven with a glowing mouth
        const ov = new THREE.Mesh(M.merge([M.P(M.sph(11, 10, 8), '#C8553A', [0, 0, 0], [0, 0, 0], [1, 0.8, 1]), M.P(M.sph(9, 9, 6), '#D9714E', [0, 2, 0], [0, 0, 0], [0.9, 0.8, 0.9]),
          M.P(M.box(9, 6, 3), '#3A1A10', [0, 1.5, 9.6]), M.P(M.box(7, 4, 3.2), '#FFB040', [0, 1, 9.8]), M.P(M.cyl(2, 2.4, 9, 7), '#8E3A26', [5, 9, -4])]), M.vcMat());
        ov.position.set(-p.body.w / 2 + 16, CFG.proc.bodyH, 2); ov.castShadow = true; grp.add(ov);
      } else if (p.outItem === 'smoked') {   // 熏鱼房 (v3.7b: bigger and clearly readable): a plank smoke shed with a tall red gable roof,
        // a fat stone chimney and a row of fish hanging under the front eave
        const X = -p.body.w / 2 + 22, Y = CFG.proc.bodyH, D = p.body.h - 4, SW = 34, WH = 14, half = SW / 2 + 5, pitch = 0.62, rise = Math.tan(pitch) * half;
        const slab = half / Math.cos(pitch) + 1.5, parts = [
          M.P(M.box(SW, WH, D - 6), '#7A4A2A', [X, Y + WH / 2, 0]),
          ...[-12, -6, 0, 6, 12].map((dx) => M.P(M.box(1.2, WH, D - 5.4), '#5A3418', [X + dx, Y + WH / 2, 0])),
          M.P(M.box(10, 9, 0.8), '#2A1A10', [X, Y + 4.5, (D - 6) / 2 + 0.2]),
          M.P(M.box(slab, 2.6, D + 6), '#D2452E', [X - half / 2, Y + WH + rise / 2, 0], [0, 0, pitch]),
          M.P(M.box(slab, 2.6, D + 6), '#B8361F', [X + half / 2, Y + WH + rise / 2, 0], [0, 0, -pitch]),
          M.P(M.box(2.4, 2.4, D + 7), '#FFE0A8', [X, Y + WH + rise + 0.6, 0]),
          M.P(M.cyl(1, 1, 1, 3), '#8E5A34', [X, Y + WH + rise * 0.34, (D - 6) / 2 + 0.1], [-H2, 0, 0], [half * 0.98, 0.6, rise * 0.68]),
          M.P(M.box(8, 22, 8), '#9AA0AA', [X + 10, Y + WH + rise + 2, -D / 2 + 9]), M.P(M.box(10, 2.4, 10), '#5A5E68', [X + 10, Y + WH + rise + 13, -D / 2 + 9]),
          M.P(M.box(SW + 8, 0.8, 0.8), '#3A2A1E', [X, Y + WH - 1, D / 2 + 1.8]),
          ...[-15, -9, -3, 3, 9, 15].map((dx) => M.P(M.sph(1, 6, 4), dx % 2 ? '#E0882E' : '#C8702A', [X + dx, Y + WH - 6, D / 2 + 1.8], [0, 0, H2], [4.4, 1.7, 1.6])),
        ];
        const sh = new THREE.Mesh(M.merge(parts), M.vcMat()); sh.castShadow = true; grp.add(sh);
        grp.userData.chimney = [X + 10, Y + WH + rise + 15, -D / 2 + 9];
      } else if (p.outItem === 'wine') {   // 酿酒坊 (v3.7b): two big oak barrels with iron hoops lying in a cradle, and a tap
        const Y = CFG.proc.bodyH, parts = [];
        for (const [x, z, r] of [[-p.body.w / 2 + 14, -8, 9], [-p.body.w / 2 + 14, 10, 9], [-p.body.w / 2 + 14, 1, 7.5]]) {
          const y = Y + r + (z === 1 ? 14 : 1);
          parts.push(M.P(M.cyl(r, r, 18, 12), '#B8743E', [x + 6, y, z], [0, 0, H2]), M.P(M.cyl(r * 0.86, r * 0.86, 18.4, 12), '#8E5627', [x + 6, y, z], [0, 0, H2]));
          parts.push(M.P(M.cyl(r, r, 18.2, 12), '#C8874A', [x + 6, y, z], [0, 0, H2], [0.92, 1, 0.92]));
          for (const dx of [-6.5, 6.5]) parts.push(M.P(M.cyl(r + 0.5, r + 0.5, 1.4, 12), '#3A3A44', [x + 6 + dx, y, z], [0, 0, H2]));
          parts.push(M.P(M.cyl(1, 1, 3, 6), '#D8B060', [x + 15.6, y - r * 0.4, z], [0, 0, H2]));
        }
        parts.push(M.P(M.box(22, 2, 26), '#6E4524', [-p.body.w / 2 + 20, Y + 1, 1]));
        const br = new THREE.Mesh(M.merge(parts), M.vcMat()); br.castShadow = true; grp.add(br);
      }
      const sign = new THREE.Mesh(M.itemGeo(p.outItem), M.vcMat()); sign.position.set(p.outItem === 'smoked' ? 19 : 4, CFG.proc.bodyH + 10, 0); sign.scale.setScalar(1.3); sign.castShadow = true; grp.add(sign);
      const puffs = [0, 1, 2].map(() => { const s = new THREE.Mesh(M.sph(1, 7, 5), new THREE.MeshLambertMaterial({ color: p.outItem === 'smoked' ? 0x9A9AA4 : 0xFFFFFF, transparent: true, opacity: 0.8, depthWrite: false })); s.userData.ownMat = true; grp.add(s); return s; });
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
      const pp = M.makePerson(this.wLook(c.porter ? PORTER : c.cart ? (c.from && this.world.objs[c.from[0]] && this.world.objs[c.from[0]].producer === 'cow' ? MILKER : CARTER) : c.lumber ? LUMBERJACK : c.fisher ? FISHER : GARDENER));
      const root = new THREE.Group(); root.add(pp.root);
      let cart = null; if (c.cart) { cart = M.makeCart(); cart.root.position.set(0, 0, -20); root.add(cart.root); }
      this.levelRoot.add(root);
      o = { c, pp, cart, ang: 0.8, root };
    }
    if (o && o.root) {
      o.crate = makeCargoCrateStack();
      const rear = c.kind === 'player' ? -17 : c.loader || c.cart ? -19 : 12;
      const y = c.kind === 'player' && c.vehicle ? 5 : c.loader ? 7 : c.cart ? 2 : 8;
      o.crate.position.set(0, y, rear); o.crate.visible = false;
      o.root.add(o.crate);
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
    const actionAge = this.wt - c.cutT;
    const fishing = c.cutItem === 'fish' && actionAge >= 0 && actionAge < 0.72;
    const cutting = fishing || actionAge < 0.22;
    const actionProgress = fishing ? actionAge / 0.72 : 0;
    const carry = c.stack.length + c.incoming > 0;
    // v4.8.6: bend-to-set-down — a stack change while not cutting/fishing is a pickup or
    // a drop, so bow once (0.45 s sine). Trigger lives on the render object only.
    const stackN = c.stack.length;
    if (o.lastStackN !== undefined && stackN !== o.lastStackN && !cutting && !fishing && !c.vehicle) o.bendT = this.wt;
    o.lastStackN = stackN;
    const bendAge = this.wt - (o.bendT ?? -99);
    const bend = bendAge >= 0 && bendAge < 0.45 ? Math.sin((bendAge / 0.45) * Math.PI) : 0;
    const packed = hasPackableCargo(c.stack, c.incomingItems);
    if (o.crate) {
      const packCounts = Object.create(null);
      for (const item of c.stack) if (isPackableCargo(item)) packCounts[item] = (packCounts[item] || 0) + 1;
      for (const [item, count] of Object.entries(c.incomingItems || {})) if (isPackableCargo(item)) packCounts[item] = (packCounts[item] || 0) + count;
      updateCargoCrateStack(o.crate, packCounts);
      o.crate.visible = packed;
      const pulse = Math.max(0, Math.min(1, c.packPulse || 0));
      const flourish = pulse > 0 ? 1 + Math.sin((1 - pulse) * Math.PI * 5) * 0.08 * pulse : 1;
      // Keep freshly packed harvest visually legible at normal camera distance; the
      // player's crate should read as a real basket, while worker stacks remain compact.
      o.crate.scale.setScalar((c.kind === 'player' ? 0.74 : 0.62) * flourish);
      if (pulse > 0) c.packPulse = Math.max(0, pulse - dt * 2.8);
    }
    if (c.kind === 'player') {
      const veh = c.vehicle;
      o.mow.root.children[0].visible = veh; for (const wl of o.mow.wheels) { wl.visible = veh; if (veh && c.moving) wl.rotation.x += dt * sp * 0.2; }
      o.pp.root.position.set(0, veh ? 9 : 0, veh ? -4 : 0);
      o.pp.blob.visible = !veh;
      M.posePerson(o.pp, { t, walk: c.walk, moving: c.moving && !veh, carry: carry && !veh, cutting: cutting && !veh, fishing: fishing && !veh, actionProgress, seated: veh, seed: 1, axe: c.cutItem === 'log', net: c.cutItem === 'fish', bend: veh ? 0 : bend });
      if (veh) { o.pp.arms[0].rotation.set(-1.2, 0, 0.3); o.pp.arms[1].rotation.set(-1.2, 0, -0.3); o.pp.tool.visible = false; }
    } else if (o.loader) {
      M.posePerson(o.pp, { t, walk: c.walk, moving: false, carry: false, cutting: false, seated: true, seed: c.seed + 2 });
      o.pp.arms[0].rotation.set(-1.15, 0, 0.3); o.pp.arms[1].rotation.set(-1.15, 0, -0.3); o.pp.tool.visible = false;
      for (const wl of o.ld.wheels) if (c.moving) wl.rotation.x += dt * sp * 0.2;
      o.ld.body.position.y = c.moving ? Math.abs(Math.sin(c.walk * 1.5)) * 0.6 : 0;
      o.ld.root.rotation.x = cutting ? Math.sin(t * 30) * 0.015 : 0;
    } else {
      M.posePerson(o.pp, { t, walk: c.walk, moving: c.moving, carry: carry && !c.cart && !cutting, cutting: cutting && !c.cart, fishing: fishing && !c.cart, actionProgress, seed: c.seed + 2, showTool: !c.cart && !carry, axe: !!c.lumber, net: !!c.fisher, bend });
      if (o.cart) for (const wl of o.cart.wheels) if (c.moving) wl.rotation.x += dt * sp * 0.3;
    }
  }
  stackFrame(c, o) {
    // where the stack sits: in the hands (walking), on the mower's rear deck, or on the cart bed
    const a = o ? o.ang : 0, fx = Math.sin(a), fz = Math.cos(a);
    if (c.kind === 'player' && c.vehicle) return { x: c.x - fx * 17, y: c.y - fz * 17, z: 16, cols: 3, spread: 7.5, fx, fz };
    if (c.kind === 'worker' && c.loader) return { x: c.x - fx * 17.8 * 1.15, y: c.y - fz * 17.8 * 1.15, z: 21.5, cols: 3, deep: 3, spread: 6.6, fx, fz };
    if (c.kind === 'worker' && c.cart) return { x: c.x - fx * 23, y: c.y - fz * 23, z: 15, cols: 2, spread: 7.5, fx, fz };
    // A stacked load has a little weight: vertical bounce follows the gait while its base
    // sways against the carrier's turn, making the layers read as physical objects in 3D.
    const bob = c.moving ? 1.15 + Math.abs(Math.sin(c.walk)) * 2.1 : Math.sin(this.time * 2.1 + (c.seed || 0)) * 0.16;
    const sway = c.moving ? Math.sin(c.walk * 0.5) * 1.25 : Math.sin(this.time * 1.7 + (c.seed || 0)) * 0.25;
    // v4.9.6: the bag is no longer small (cap to 150) — every on-foot load spreads over a full 4×3
    // basket instead of a single skinny column, so a full load reads as a plump pile, not a needle.
    const cols = 4, deep = 3;
    return { x: c.x + fx * (12 + (deep - 1) * 3) + fz * sway, y: c.y + fz * (12 + (deep - 1) * 3) - fx * sway, z: 22 + bob, cols, deep, spread: 6.5, fx, fz, sway };
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
  crateCargoPoint(o, type, slot, counts = null) {
    const crate = o && o.crate;
    if (!crate || !isPackableCargo(type)) return null;
    if (!counts) {
      counts = Object.create(null);
      for (const item of o.c?.stack || []) if (isPackableCargo(item)) counts[item] = (counts[item] || 0) + 1;
      for (const [item, n] of Object.entries(o.c?.incomingItems || {})) if (isPackableCargo(item)) counts[item] = (counts[item] || 0) + n;
    }
    const slotPos = cargoItemSlot(type, slot, counts);
    if (!slotPos) return null;
    crate.updateWorldMatrix(true, false);
    const p = crate.localToWorld(_v.set(slotPos.x, slotPos.y, slotPos.z));
    return { x: p.x, y: p.z, z: p.y };
  }
  drawStack(c, o, labels, isPlayer) {
    const n = c.stack.length, base = this.stackFrame(c, o), packed = hasPackableCargo(c.stack, c.incomingItems);
    const b = base, deep = b.deep || 1, per = b.cols * deep;
    const hts = this._hts || (this._hts = new Float32Array(12)); hts.fill(0);
    const t = this.time, sp = Math.hypot(c.vx, c.vy);
    const rx = b.fz, rz = -b.fx;          // right vector
    o.lean = (o.lean || 0) + ((c.moving ? -sp / 160 : 0) - (o.lean || 0)) * 0.12;
    let top = { x: b.x, y: b.y, z: b.z };
    const packedCounts = Object.create(null), packedOrdinals = Object.create(null);
    for (const type of c.stack) if (isPackableCargo(type)) packedCounts[type] = (packedCounts[type] || 0) + 1;
    for (const [type, count] of Object.entries(c.incomingItems || {})) if (isPackableCargo(type)) packedCounts[type] = (packedCounts[type] || 0) + count;
    for (let i = 0; i < n; i++) {
      const type = c.stack[i], step = CFG.items[type].step;
      if (packed && isPackableCargo(type)) {
        const ordinal = packedOrdinals[type] || 0; packedOrdinals[type] = ordinal + 1;
        const pos = this.crateCargoPoint(o, type, ordinal, packedCounts);
        if (pos) this.item(type, pos.x, pos.y, pos.z + (M.ITEM_HALF[type] || 2), o.ang + Math.PI / 2, type === 'apple' || type === 'berry' || type === 'grape' ? 0.58 : 0.46);
        continue;
      }
      const cell = i % per, col = cell % b.cols, row = (cell / b.cols) | 0;
      const h = hts[cell];
      // v4.9.6: stack by the true visual top, not the hand-tuned step — the next item rests on the
      // solid top of the one below (half height + bulk top), so mixed goods never float; where the
      // step is smaller the load keeps its dense nestled look (the rise is capped, never stretched).
      const half = M.ITEM_HALF[type] || 2, topOff = (M.ITEM_TOP && M.ITEM_TOP[type]) ?? half;
      hts[cell] += Math.min(step, half + topOff);
      const bend = Math.pow(h, 1.35) * 0.018, wob = Math.sin(t * 2.4 + h * 0.02) * h * 0.01;
      const off = (col - (b.cols - 1) / 2) * b.spread + wob, dep = (row - (deep - 1) / 2) * b.spread;
      const layerSway = c.moving ? Math.sin(c.walk * 0.5 + h * 0.018) * Math.min(1.2, h * 0.008) : 0;
      const x = b.x + rx * (off + layerSway) + b.fx * (o.lean * bend * 2 + dep), y = b.y + rz * (off + layerSway) + b.fz * (o.lean * bend * 2 + dep), z = b.z + h + (M.ITEM_HALF[type] || 2);
      const headingSway = c.moving ? Math.sin(c.walk + i * 0.12) * 0.025 : 0;
      this.item(type, x, y, z, o.ang + Math.PI / 2 + headingSway + (hash(i) - 0.5) * 0.25, b.cols > 1 ? 1.0 : 1.15);
      if (i >= n - per) top = { x: b.x, y: b.y, z: Math.max(top.z, z + topOff) };
    }
    o.top = top;
    const full = c.stack.length + c.incoming >= c.cap;
    // v3.4: only the player's stack gets a count / MAX pill (worker counts all over the field read as
    // numbers flying around); it is anchored on the stack's base column, not the swaying top item
    // v3.7 写死: the player's count / MAX is a fixed HUD badge (ui.js #stackBadge), not a label on the stack
    void full;
    if (isPlayer && n === 0) this.comboScreen = null;
    if (isPlayer) this.comboAnchor = n > 0 ? { x: top.x, y: top.y, z: top.z + 6, stack: true } : { x: c.x, y: c.y, z: 54, stack: false };
    else if (c.lv) labels.push({ k: 'lv', x: c.x, y: c.y, z: o.loader ? 50 : 50, lv: c.lv, pop: this.wt - c.lvT, name: c.crewName });
    if (!isPlayer && c.waitReason && c.stack.length > 0) labels.push({ k: 'workerWait', x: c.x, y: c.y, z: 64, text: `${c.waitReason} ${c.stack.length}/${c.batchCap || c.cap}` });
  }
  flyItem(f) {
    const p = Math.min(1, f.t / f.dur), e = p * p * (3 - 2 * p);
    let tx = f.tx, ty = f.ty, tz = f.tz;
    if (f.kind === 'stack') {
      const o = this.chars.get(f.ref);
      if (isPackableCargo(f.type) && o && o.crate) {
        const target = this.crateCargoPoint(o, f.type, f.crateSlot || 0);
        if (target) { tx = target.x; ty = target.y; tz = target.z; }
      } else { const s = o && o.top ? o.top : { x: f.ref.x, y: f.ref.y, z: 30 }; tx = s.x; ty = s.y; tz = s.z; }
    }
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
    this.updateFields(); this.updatePiles(); this.updatePonds();
    for (const pd of world.ponds) labels.push({ k: 'pond', pd });
    this.beginItems();
    // coops: hens bob when they lay, bushes shiver
    for (const o of this.coopObjs) {
      const c = o.c; o.grp.visible = !c.hidden;
      o.hens.forEach((g, i) => {
        const h = c.hens[i], a = i < c.n ? elastic((this.wt - h.appearT) / 0.6) : 0;
        g.visible = a > 0; if (!g.visible) return; g.scale.setScalar(a);
        const an = g.userData.anim;
        if (c.producer === 'hen') { an.position.y = 8.6 + h.lay * 3; an.scale.set(1 + h.lay * 0.12, 1 - h.lay * 0.1, 1); an.rotation.y = Math.sin(time * 1.7 + i) * 0.35; }
        else if (an.userData.ani) {   // v4.4 animated model: Idle / Walk (a short stroll) and a Jump when a bottle / wool ball pops out
          const ani = an.userData.ani, k = an.userData.k;
          if (h.lay > 0.9 && !(ani.lastLay > 0.9)) A.hop(ani); ani.lastLay = h.lay;
          A.step(ani, dt); an.scale.set(k * (1 + h.lay * 0.04), k * (1 - h.lay * 0.03), k);
          if (ani.wool) ani.wool.scale.setScalar(ani.woolS * (1 - h.lay * 0.45));   // shorn for a moment, wool puffs regrow
        } else if (c.producer === 'cow' || c.producer === 'sheep') {   // a happy hop and a head-turn when a bottle / wool ball pops out
          const k = an.userData.k; an.position.y = h.lay * 2.4; an.scale.set(k * (1 + h.lay * 0.06), k * (1 - h.lay * 0.05), k); an.rotation.y = Math.sin(time * 0.9 + i * 1.7) * 0.25;
        } else if (c.producer === 'hive') { const k = an.userData.k; an.scale.set(k * (1 + h.lay * 0.08), k * (1 - h.lay * 0.06), k * (1 + h.lay * 0.08)); an.rotation.z = Math.sin(time * 20 + i) * h.lay * 0.05; }
        else if (c.producer === 'appletree') { const k = an.userData.k; an.rotation.z = Math.sin(time * 18 + i) * h.lay * 0.06; an.scale.setScalar(k); }
        else { an.scale.set(1.3 + h.lay * 0.1, 1.3 - h.lay * 0.08, 1.3 + h.lay * 0.1); }
      });
    }
    if (this.animals && this.animals.length) A.updateMixers(this.animals, dt);
    // counters: desk, zone, stock on the top, cash pile, cashier
    for (const o of this.counterObjs) {
      const c = o.c, a = c.hidden ? 0 : elastic((this.wt - c.appearT) / 0.6);
      o.grp.visible = o.zone.visible = o.cash.visible = a > 0; if (a <= 0) continue;
      const sq = 1 + c.bumpT * 0.05; o.grp.scale.set(a, a * sq, a); o.zone.scale.setScalar(a); o.cash.scale.setScalar(a);
      const K = CFG.counter, dsk = c.desk;
      const boxed = c.stock.filter((type) => isPackableCargo(type)).slice(0, 24);
      const loose = c.stock.filter((type) => !isPackableCargo(type)).concat(c.stock.filter((type) => isPackableCargo(type)).slice(24));
      for (let i = 0; i < o.crateSlots.length; i++) o.crateSlots[i].visible = i < Math.ceil(boxed.length / 4);
      // Four actual goods per open crate, in small layers so apples, tomatoes and fish remain
      // individually recognizable above the warm slatted sides. This changes no stock/count.
      const crateCenters = [[-7.5, -21], [7.5, -21], [-7.5, 0], [7.5, 0], [-7.5, 21], [7.5, 21]];
      for (let k = 0; k < boxed.length; k++) {
        const crate = (k / 4) | 0, cell = k % 4, [cx, cz] = crateCenters[crate];
        const type = boxed[k], ix = cell % 2, iz = (cell / 2) | 0;
        this.item(type, c.x + cx + (ix ? 2.1 : -2.1), c.y + cz + (iz ? 1.8 : -1.8), K.deskH + 2.2 + (M.ITEM_HALF[type] || 2), (k % 3) * 0.2 + 0.785, 0.55);
      }
      for (let k = 0; k < Math.min(loose.length, 120); k++) {
        const col = k % 6, lay = (k / 6) | 0, type = loose[k], ix = col % 2, iy = (col / 2) | 0;
        this.item(type, dsk.x + 8 + ix * 14, dsk.y + 26 + iy * 12, K.deskH + 1 + lay * CFG.items[type].step * 0.8 + (M.ITEM_HALF[type] || 2), (k % 3) * 0.2 + 0.785, 0.85);
      }
      if (c.cash > 0.01) {
        const bv = world.L.bill || 5, m = Math.min(72, Math.ceil(c.cash / bv)), p = c.cashPos;
        for (let k = 0; k < m; k++) { const s = k % 6, lay = (k / 6) | 0; this.item('cash', p.x - 8 + (s % 2) * 14, p.y - 12 + ((s / 2) | 0) * 10, 1.6 + lay * 2.8, 0.785 + (hash(k) - 0.5) * 0.2, 0.85); }
      }
      if (c.cashier && !o.cashier) { o.cashier = M.makePerson(CASHIER); o.cashier.root.position.set(c.x + 4, 0, c.y - 44); o.cashier.root.rotation.y = 0.3; this.levelRoot.add(o.cashier.root); }
      if (o.cashier) M.posePerson(o.cashier, { t: time, walk: 0, moving: false, carry: false, seed: 4 });
      if (c.cashier && c.clerks === 2 && !o.clerk2) { o.clerk2 = M.makePerson(CASHIER2); o.clerk2.root.position.set(c.x - 24, 0, c.y - 6); o.clerk2.root.rotation.y = Math.PI / 2; this.levelRoot.add(o.clerk2.root); }
      if (o.clerk2) { o.clerk2.root.scale.setScalar(a * 1.15); M.posePerson(o.clerk2, { t: time + 1.3, walk: 0, moving: false, carry: c.stock.length > 0 && (time % 2) < 1, seed: 6 }); }
      if (o.cashier && c.clerks === 2) o.cashier.root.scale.setScalar(a * 1.15);
    }
    // machines
    for (const o of this.procObjs) {
      const p = o.p, a = p.hidden ? 0 : elastic((this.wt - p.appearT) / 0.6);
      o.grp.visible = o.zone.visible = a > 0; if (a <= 0) continue;
      // v4.8.6: intake/produce feedback, render-side only. buf rising = the machine just
      // swallowed a batch (group gulps); buf falling = a finished piece just popped out
      // (body jolt). Spin speeds ease toward their targets so the works wind down
      // instead of stopping dead when p.work drops.
      if (o.lastBuf === undefined) o.lastBuf = p.buf;
      if (p.buf > o.lastBuf) o.swallowT = time;
      if (p.buf < o.lastBuf) o.produceT = time;
      o.lastBuf = p.buf;
      const swallow = o.swallowT !== undefined ? Math.max(0, 1 - (time - o.swallowT) / 0.3) : 0;
      const produce = o.produceT !== undefined ? Math.max(0, 1 - (time - o.produceT) / 0.25) : 0;
      const sh = p.work ? Math.sin(time * 40) * 0.5 : 0;
      o.grp.scale.setScalar(a * (1 + swallow * 0.08)); o.body.position.x = sh + produce * 1.6 * Math.sin(time * 55); o.zone.scale.setScalar(a);
      o.gearSpeed = (o.gearSpeed || 0) + ((p.work ? 5 : 0) - (o.gearSpeed || 0)) * Math.min(1, dt * 4);
      o.gear.rotation.x += dt * o.gearSpeed;
      if (o.grp.userData.blade) { o.bladeSpeed = (o.bladeSpeed || 0) + ((p.work ? 14 : 1.2) - (o.bladeSpeed || 0)) * Math.min(1, dt * 4); o.grp.userData.blade.rotation.z -= dt * o.bladeSpeed; }
      if (o.grp.userData.sails) { o.sailSpeed = (o.sailSpeed || 0) + ((p.work ? 4 : 0.6) - (o.sailSpeed || 0)) * Math.min(1, dt * 4); o.grp.userData.sails.rotation.z -= dt * o.sailSpeed; }
      o.sign.rotation.y = time * 0.8; if (p.outItem === 'smoked') o.sign.position.x = 19; o.sign.position.y = CFG.proc.bodyH + 10 + Math.sin(time * 2) * 1.2;
      o.puffs.forEach((s, i) => {
        const u = (time * 0.8 + i / 3) % 1; s.visible = p.work > 0;
        const ch = o.grp.userData.chimney;
        if (ch) s.position.set(ch[0] + u * 5, ch[1] + 2 + u * 22, ch[2]); else s.position.set(p.body.w / 2 - 11 + u * 6, CFG.proc.bodyH + 21 + u * 22, -p.body.h / 2 + 10);
        s.scale.setScalar(2.6 + u * 4); s.material.opacity = 0.75 * (1 - u);
      });
      if (p.buf > 0) labels.push({ k: 'buf', x: p.body.x, y: p.y, z: CFG.proc.bodyH + 30, n: p.buf });
    }
    for (const lg of this.lanternGlow || []) lg.m.material.opacity = 0.85 + 0.15 * Math.sin(time * 5 + lg.x * 0.1) * Math.sin(time * 3.3 + lg.y);
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
    if (this.dogObj && world.dog) {   // v4.0 B 宠物狗
      const d = world.dog, o = this.dogObj, sp = Math.hypot(d.vx, d.vy);
      if (sp > 6) o.ang = angLerp(o.ang, Math.atan2(d.vx, d.vy), Math.min(1, dt * 10));
      else if (d.state === 'follow') { const p = world.player; o.ang = angLerp(o.ang, Math.atan2(p.x - d.x, p.y - d.y), Math.min(1, dt * 3)); }
      o.pp.root.position.set(d.x, 0, d.y); o.pp.root.rotation.y = o.ang; o.pp.root.scale.setScalar(1.4);
      M.posePet(o.pp, { t: time, walk: d.walk, moving: sp > 6, sit: sp <= 6 && !world.player.moving });
      if (d.carry) { const fx = Math.sin(o.ang), fz = Math.cos(o.ang); this.item(d.carry, d.x + fx * 14.5, d.y + fz * 14.5, 15, o.ang, 0.85); }
    }
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
        const rem = Math.ceil(t.price - t.paid), txt = `${rem}`, fs = Math.max(12, 12 * z);   // v3.7: fixed size, no pop-in scaling
        g.font = FONT(fs); const tw = g.measureText(txt).width, bw = fs * 1.5, bh = fs * 0.95, total = bw + 4 + tw;
        this.billIcon(px - total / 2 + bw / 2, py, bw, bh, -0.08);
        this.label(txt, px - total / 2 + bw + 4, py, fs, L.afford ? '#FFFFFF' : '#E8F4F6', L.afford ? '#0E6A78' : '#2A3440', 'left');
        if (L.afford || Math.hypot(p.x - t.x, p.y - t.y) < 140) {
          const [lx, ly] = this.proj(t.x - S * 0.5, t.y - S * 0.5, 2);
          this.label(t.buy ? `${t.label} +${t.buy}` : t.label, lx, ly, Math.max(11, 11 * z), '#FFFFFF', '#1E3A44');
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
        const [sx0, sy] = this.proj(L.x, L.y, L.z), sx = Math.round(sx0 - 26 * Math.max(1, z * 0.8)), px = Math.max(8, 7.5 * z);   // v3.7: no level-up pop
        const txt = L.name || `Lv${L.lv}`; g.font = FONT(px); const tw = g.measureText(txt).width;
        g.fillStyle = L.lv >= 5 ? '#FF8A1E' : L.lv >= 3 ? '#FFC21A' : '#6FC3FF';
        g.beginPath(); g.roundRect(sx - tw / 2 - 5, sy - px * 0.7, tw + 10, px * 1.4, px * 0.7); g.fill();
        this.label(txt, sx, sy, px, '#FFFFFF', '#5A3A10');
      } else if (L.k === 'workerWait') {
        const [sx, sy] = this.proj(L.x, L.y, L.z), px = Math.max(9, 8.5 * z);
        g.font = FONT(px); const tw = g.measureText(L.text).width, ww = tw + px * 1.1, hh = px * 1.65;
        g.fillStyle = 'rgba(38,57,62,0.86)'; g.beginPath(); g.roundRect(sx - ww / 2, sy - hh / 2, ww, hh, hh / 2); g.fill();
        this.label(L.text, sx, sy, px, '#FFF3C4', '#24353A');
      } else if (L.k === 'vip') {   // VIP thought bubble: the item + ×2
        const [sx, sy] = this.proj(L.x, L.y, L.z), s = Math.max(0.8, z * 0.8), bob = 0;   // v3.7: no bobbing
        g.save(); g.translate(sx, sy - 16 * s + bob);
        g.fillStyle = 'rgba(255,255,255,0.96)'; g.strokeStyle = '#E8B21E'; g.lineWidth = 2;
        g.beginPath(); g.roundRect(-24 * s, -13 * s, 48 * s, 26 * s, 13 * s); g.fill(); g.stroke();
        g.beginPath(); g.arc(-4 * s, 16 * s, 3 * s, 0, TAU); g.fill(); g.stroke(); g.beginPath(); g.arc(-1 * s, 22 * s, 1.8 * s, 0, TAU); g.fill();
        g.save(); g.translate(-10 * s, 0); g.scale(s * 0.85, s * 0.85); drawIcon(g, L.item, 0); g.restore();
        g.restore();
        this.label('×2', sx + 10 * s, sy - 16 * s + bob, 11 * s, '#FFD23F', '#8A4A00');
      } else if (L.k === 'pond') {   // v4.2 鱼塘 level: a small fixed bar by the pond (写死: no tween, updates in place)
        const pd = L.pd; if (pd.hidden) continue;
        const [sx0, sy0] = this.proj(pd.X + pd.MW * 0.5, pd.Y - 8, 2); if (sx0 < -80 || sy0 < -40 || sx0 > this.W + 80 || sy0 > this.H + 40) continue;
        const px = Math.max(9, 8 * z), nx = pd.next(), max = !nx;
        const prev = CFG.pond.levels[pd.lv - 1].at, f = max ? 1 : Math.min(1, (pd.caught - prev) / (nx - prev));
        const sp = CFG.pond.species[Math.min(pd.lv, CFG.pond.species.length) - 1].name;
        const txt = `鱼塘 Lv${pd.lv} · ${sp}`, tail = max ? '满级' : `${pd.caught}/${nx}`;
        g.font = FONT(px); const tw = g.measureText(txt).width, bw = Math.round(px * 6), tw2 = g.measureText(tail).width, W2 = tw + bw + tw2 + px * 2.2;
        const sx = Math.round(Math.min(this.W - W2 / 2 - 6, Math.max(W2 / 2 + 6, sx0))), sy = Math.round(sy0);   // kept on screen
        if (sy < this.H * 0.17 + 30) continue;   // never under the goal panel / coin pill
        g.fillStyle = 'rgba(20,60,90,0.62)'; g.beginPath(); g.roundRect(sx - W2 / 2, sy - px * 0.85, W2, px * 1.7, px * 0.85); g.fill();
        let x = sx - W2 / 2 + px * 0.6;
        this.label(txt, x, sy, px, '#FFFFFF', '#14405A', 'left'); x += tw + px * 0.5;
        g.fillStyle = 'rgba(255,255,255,0.25)'; g.beginPath(); g.roundRect(x, sy - px * 0.3, bw, px * 0.6, px * 0.3); g.fill();
        g.fillStyle = max ? '#FFD23F' : '#7FE0FF'; g.beginPath(); g.roundRect(x, sy - px * 0.3, Math.max(px * 0.6, bw * f), px * 0.6, px * 0.3); g.fill();
        x += bw + px * 0.5; this.label(tail, x, sy, px, max ? '#FFE27A' : '#E8F8FF', '#14405A', 'left');
      } else if (L.k === 'buf') {
        const [sx, sy] = this.proj(L.x, L.y, L.z), px = Math.max(10, 9 * z);
        g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.roundRect(sx - px * 1.5, sy - px * 0.8, px * 3, px * 1.6, px * 0.8); g.fill();
        this.label(`${L.n}`, sx, sy, px, '#5A3414', '#FFFFFF');
      }
    }
  }
  // golden plant sparkles, sprinkler water arcs, 丰收狂热 meter
  // v4.0 四季 / 雨: light screen-space particles over the scene (petals in spring, leaves in autumn, snow in
  // winter; rain streaks on rainy runs). Few, cheap, no allocation; fewer still at low quality.
  drawWeather(g, t) {
    const W = this.W, H = this.H, lo = this.q === 0, se = this.fest === 'xmas' ? 3 : this.season;   // v4.0 B 圣诞: it snows
    if (se === 0 || se === 2 || se === 3) {
      const n = (se === 3 ? 46 : 26) >> (lo ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const sp = (se === 3 ? 26 : 34) + hash(k * 3 + 1) * 30, fall = (t * sp + hash(k * 5 + 2) * (H + 40)) % (H + 40) - 20;
        const x = (hash(k * 7 + 3) * (W + 60) - 30 + Math.sin(t * (0.6 + hash(k) * 0.8) + k) * 24 + t * (se === 3 ? 4 : 14)) % (W + 60);
        const y = fall, sz = (se === 3 ? 1.6 + hash(k * 11) * 2.2 : 3 + hash(k * 11) * 2.4) * Math.max(1, this.z * 0.6);
        g.globalAlpha = se === 3 ? 0.9 : 0.85;
        if (se === 3) { g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(x, y, sz, 0, TAU); g.fill(); continue; }
        g.fillStyle = se === 0 ? (k % 3 ? '#FFB8D0' : '#FFFFFF') : ['#E8871E', '#C8551E', '#F6C343'][k % 3];
        g.save(); g.translate(x, y); g.rotate(t * (1 + hash(k) * 2) + k); g.beginPath(); g.ellipse(0, 0, sz, sz * 0.5, 0, 0, TAU); g.fill(); g.restore();
      }
      g.globalAlpha = 1;
    }
    if (this.rain) {
      const n = lo ? 40 : 80; g.strokeStyle = 'rgba(210,230,255,0.55)'; g.lineWidth = 1.3; g.beginPath();
      for (let k = 0; k < n; k++) {
        const y = (t * (520 + hash(k * 13) * 180) + hash(k * 17 + 1) * (H + 60)) % (H + 60) - 30, x = (hash(k * 19 + 2) * (W + 80) - 40 - (y * 0.18)) ;
        g.moveTo(x, y); g.lineTo(x - 4, y + 16);
      }
      g.stroke();
    }
  }
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
    // v3.7 夜间农场: fireflies drifting round the lanterns and over the fields
    if (this.night && this.lanternGlow && this.lanternGlow.length) {
      const L = this.lanternGlow;
      for (let k = 0; k < 56; k++) {
        const c = L[k % L.length], r = 30 + hash(k * 3 + 1) * 80, a0 = hash(k * 5 + 2) * TAU, sp = 0.25 + hash(k * 7 + 3) * 0.35;
        const x = c.x + Math.cos(a0 + t * sp) * r + Math.sin(t * 1.3 + k) * 8, y = c.y + Math.sin(a0 + t * sp * 0.8) * r * 0.8, h = 10 + hash(k * 11) * 26 + Math.sin(t * 2 + k) * 4;
        const [sx, sy] = this.proj(x, y, h);
        if (sx < -10 || sy < -10 || sx > this.W + 10 || sy > this.H + 10) continue;
        const bl = 0.35 + 0.65 * Math.max(0, Math.sin(t * 2.6 + k * 1.7)), rr = Math.max(1.2, 1.4 * z);
        g.globalAlpha = bl * 0.35; g.fillStyle = '#FFF59A'; g.beginPath(); g.arc(sx, sy, rr * 3.2, 0, TAU); g.fill();
        g.globalAlpha = bl; g.fillStyle = '#FFFDE0'; g.beginPath(); g.arc(sx, sy, rr, 0, TAU); g.fill();
      }
      g.globalAlpha = 1;
    }
    this.drawWeather(g, t);
    // v4.2 鱼塘: soft rings where fish break the surface, pellets falling from the 投喂器
    for (const pd of world.ponds) {
      if (pd.hidden || !pd.fish.length) continue;
      g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = Math.max(1, 1.1 * z);
      for (let k = 0; k < 6; k++) {
        const ph = t * 0.9 + k / 6, cyc = Math.floor(ph), u = ph - cyc, f = pd.fish[Math.floor(hash(cyc * 13 + k * 7 + pd.X) * pd.fish.length) % pd.fish.length];
        if (!f) continue; const [sx, sy] = this.proj(f.x, f.y, 0.6); if (sx < -20 || sy < -20 || sx > this.W + 20 || sy > this.H + 20) continue;
        g.globalAlpha = (1 - u) * 0.7; g.beginPath(); g.ellipse(sx, sy, (3 + u * 9) * z, (1.8 + u * 5) * z, 0, 0, TAU); g.stroke();
      }
      g.globalAlpha = 1;
      if (pd.feeder && pd.feeding > 0) {
        const fp = pd.feedPt(); g.fillStyle = '#C8902A';
        for (let k = 0; k < 14; k++) { const u = (t * 1.6 + k / 14) % 1, a = hash(k * 5) * TAU, r = 4 + hash(k * 9) * 16; const [sx, sy] = this.proj(fp.x + Math.cos(a) * r, fp.y + Math.sin(a) * r, 20 * (1 - u)); g.globalAlpha = 0.9; g.beginPath(); g.arc(sx, sy, 1.3 * z, 0, TAU); g.fill(); }
        g.globalAlpha = 1;
      }
    }
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
    const fever = world.feverT > 0;
    if (world.combo > 0.01 || fever) {
      // v3.7 写死: the meter sits at a fixed spot just above the bottom HUD (stack badge), it never follows the stack
      const sx = Math.round(this.W / 2), sy = Math.round(this.H - 84);
      const w = 64 * Math.max(1, z * 0.8), h = 8 * Math.max(1, z * 0.8), f = fever ? world.feverT / CFG.fever.dur : world.combo;
      g.fillStyle = 'rgba(30,30,30,0.6)'; g.beginPath(); g.roundRect(sx - w / 2 - 2, sy - h / 2 - 2, w + 4, h + 4, h); g.fill();
      const gr = g.createLinearGradient(sx - w / 2, 0, sx + w / 2, 0);
      if (fever) { const p = (t * 2) % 1; gr.addColorStop(0, '#FFD23F'); gr.addColorStop(p, '#FFFFFF'); gr.addColorStop(1, '#FF8A1E'); }
      else { gr.addColorStop(0, '#FF8A1E'); gr.addColorStop(1, '#FFD23F'); }
      g.fillStyle = gr; g.beginPath(); g.roundRect(sx - w / 2, sy - h / 2, Math.max(h, w * f), h, h / 2); g.fill();
      void z;
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
