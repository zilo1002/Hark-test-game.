// 商店 preview: a small Three.js turntable (its own canvas + renderer, created the first time
// the shop opens) showing the farmer in the chosen outfit, or a decoration model. It also renders
// the item thumbnails once (cached data URLs) with the same 3D models the game uses.
import * as THREE from '../vendor/three.module.min.js';
import * as M from './models.js';
import { heroStyle } from './shop.js';

export class Preview {
  constructor(canvas) {
    this.cv = canvas;
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.gl.setClearColor(0x000000, 0);
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight(0xFFFFFF, 0x8AB860, 2.0));
    const sun = new THREE.DirectionalLight(0xFFF4DD, 2.2); sun.position.set(30, 60, 50); this.scene.add(sun);
    this.cam = new THREE.PerspectiveCamera(30, 1, 1, 1000);
    this.stage = new THREE.Group(); this.scene.add(this.stage);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(20, 21, 3, 28), new THREE.MeshLambertMaterial({ color: 0x8ED65A }));
    disc.position.y = -1.5; this.scene.add(disc); this.disc = disc;
    this.key = ''; this.obj = null; this.thumbs = {};
  }
  size(w, h) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.gl.setPixelRatio(dpr); this.gl.setSize(w, h, false); this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); this.w = w; this.h = h;
  }
  _clear() { if (this.obj) { this.stage.remove(this.obj); this.obj = null; } }
  // what: { kind: 'person', eq } | { kind: 'deco', id }
  show(what) {
    const key = JSON.stringify(what);
    if (key === this.key) return; this.key = key; this._clear();
    if (what.kind === 'person') {
      const pp = M.makePerson(heroStyle(what.eq)); pp.blob.visible = false; this.pp = pp; this.obj = pp.root;
      this.view = { y: 20, dist: 112, look: 19 };
    } else {
      const g = new THREE.Group(); g.add(new THREE.Mesh(M.decoGeo(what.id), M.vcMat()));
      if (what.id === 'windmill') { const s = new THREE.Mesh(M.windmillSails(), M.vcMat()); s.position.set(0, 30, 9.6); g.add(s); this.sails = s; } else this.sails = null;
      const box = new THREE.Box3().setFromObject(g), sz = box.getSize(new THREE.Vector3()), hgt = Math.max(sz.y, sz.x * 0.75);
      this.obj = g; this.pp = null; this.view = { y: hgt * 0.5, dist: hgt * 2.6 + 30, look: box.min.y + sz.y * 0.5 };
    }
    this.stage.add(this.obj);
  }
  render(t) {
    if (!this.obj) return;
    this.stage.rotation.y = 0.5 + Math.sin(t * 0.6) * 0.65;
    if (this.pp) M.posePerson(this.pp, { t, walk: 0, moving: false, carry: false, seed: 1 });
    if (this.sails) this.sails.rotation.z = t * 1.4;
    const v = this.view;
    this.cam.position.set(0, v.look + v.dist * 0.28, v.dist); this.cam.lookAt(0, v.look, 0);
    this.disc.visible = true;
    this.gl.render(this.scene, this.cam);
  }
  // thumbnails: hats/scarves framed on the head and shoulders, tops/feet on the whole figure
  thumb(item) {
    if (this.thumbs[item.id]) return this.thumbs[item.id];
    const ow = this.w, oh = this.h; this.size(96, 96);
    const keep = this.key; this.key = '';
    if (item.slot) {
      this.show({ kind: 'person', eq: { [item.slot]: item.id } });
      M.posePerson(this.pp, { t: 0, walk: 0, moving: false, carry: false, seed: 1 });
      const close = item.slot !== 'top', look = { hat: 31, neck: 24, feet: 5, top: 17 }[item.slot], dist = { hat: 62, neck: 54, feet: 50, top: 78 }[item.slot];
      this.stage.rotation.y = 0.45; this.disc.visible = !close;
      this.cam.position.set(0, look + dist * 0.22, dist); this.cam.lookAt(0, look, 0);
    } else {
      this.show({ kind: 'deco', id: item.id });
      const v = this.view; this.stage.rotation.y = 0.5; this.disc.visible = false;
      this.cam.position.set(0, v.look + v.dist * 0.3, v.dist * 0.85); this.cam.lookAt(0, v.look, 0);
    }
    this.gl.render(this.scene, this.cam);
    const url = this.cv.toDataURL('image/png');
    this.thumbs[item.id] = url;
    this.key = ''; this._clear(); if (ow) this.size(ow, oh); this.keyRestore = keep;
    return url;
  }
}
