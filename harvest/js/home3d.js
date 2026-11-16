// Live volumetric actors for the estate screen. Unlike a canvas portrait, this renders the
// same posed Three.js geometry directly, with perspective lighting and real depth.
import * as THREE from '../vendor/three.module.min.js';
import * as M from './models.js';

let renderer, scene, camera, currentKey = '', person, pet;
function init() {
  if (renderer) return;
  const canvas = document.getElementById('home3d');
  if (!canvas) return;
  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xFFF9EE, 0x78875B, 2.0));
  const key = new THREE.DirectionalLight(0xFFF1D8, 2.2); key.position.set(-90, 140, 180); scene.add(key);
  const fill = new THREE.DirectionalLight(0xD9E8FF, 0.75); fill.position.set(100, 40, -80); scene.add(fill);
  camera = new THREE.OrthographicCamera(0, 1, 1, 0, -1000, 1000);
  camera.position.set(0, 0, 500); camera.lookAt(0, 0, 0);
}
function setActors(look, activePet) {
  const key = JSON.stringify([look, activePet && [activePet.id, activePet.pet, activePet.col]]);
  if (key === currentKey) return;
  currentKey = key;
  if (person) { scene.remove(person.root); person = null; }
  if (pet) { scene.remove(pet.root); pet = null; }
  person = M.makePerson(look);
  person.blob.visible = false;
  scene.add(person.root);
  if (activePet && !(activePet.col && activePet.col.shoulder)) {
    pet = M.makePet(activePet.pet, activePet.col);
    pet.blob.visible = false;
    scene.add(pet.root);
  }
}
export function renderHome3d({ W, H, dpr, layout, t, look, personX = 190, personY = 390, facing = 1, moving = false, walk = 0, pet: activePet, petX = 150, petY = 238, dogMoving = false }) {
  try {
    init(); if (!renderer) return;
    setActors(look, activePet);
    const { s, ox, oy } = layout;
    const sizeChanged = renderer.domElement.width !== Math.round(W * dpr) || renderer.domElement.height !== Math.round(H * dpr);
    if (sizeChanged) { renderer.setPixelRatio(dpr); renderer.setSize(W, H, false); }
    camera.left = 0; camera.right = W; camera.top = H; camera.bottom = 0; camera.updateProjectionMatrix();
    const px = ox + personX * s, py = oy + personY * s;
    person.root.position.set(px, H - py, -py * 0.01);
    person.root.scale.setScalar(s * 1.02);
    person.root.rotation.y = facing < 0 ? -0.30 : 0.30;
    M.posePerson(person, { t, walk, moving, carry: false, seed: 4 });
    if (pet) {
      const x = activePet.pet === 'dog' ? petX : 150;
      const y = activePet.pet === 'dog' ? petY : 238;
      pet.root.position.set(ox + x * s, H - (oy + y * s), -(oy + y * s) * 0.01 + 0.1);
      pet.root.scale.setScalar(s * (activePet.pet === 'dog' ? 0.70 : 0.76));
      pet.root.rotation.y = -0.18;
      M.posePet(pet, { t, walk: activePet.pet === 'dog' ? walk : t * 0.12, moving: activePet.pet === 'dog' && dogMoving, sit: activePet.pet !== 'dog' });
    }
    renderer.render(scene, camera);
  } catch (err) {
    // Keep the home canvas usable on devices where WebGL is lost; next frame retries init/render.
    if (renderer) { try { renderer.dispose(); } catch (_) {} renderer = null; scene = null; camera = null; currentKey = ''; person = pet = null; }
    console.warn('home 3D actors unavailable', err);
  }
}
