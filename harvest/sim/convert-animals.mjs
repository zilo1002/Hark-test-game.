// Dev tool (not shipped): re-create harvest/models/{cow,sheep}.glb from Quaternius Farm Animal Pack FBX files.
// Needs `npm i three@0.170.0`; put Cow.fbx / Sheep.fbx one folder up from where you run it; usage: node convert-animals.mjs <outDir>
// Quaternius Farm Animal Pack FBX → GLB for 半亩·丰收: bake each material's colour (recoloured to the game
// palette) into a vertex-colour attribute so every animal is one skinned mesh / one draw call; keep all clips.
import fs from 'fs';
globalThis.self = globalThis; globalThis.window = globalThis;
globalThis.FileReader = class { readAsArrayBuffer(b){ b.arrayBuffer().then(a=>{this.result=a; this.onloadend&&this.onloadend();}); } readAsDataURL(b){ b.arrayBuffer().then(a=>{this.result='data:application/octet-stream;base64,'+Buffer.from(a).toString('base64'); this.onloadend&&this.onloadend();}); } };
const THREE = await import('three');
const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
const PAL = { Cow: { White: '#FFFFFF', Black: '#2A2A30', Pink: '#FFB3B8' }, Sheep: { White: '#FFFFFF', Black: '#3A3036' } };
const out = process.argv[2];
for (const name of ['Cow', 'Sheep']) {
  const buf = fs.readFileSync(`../${name}.fbx`);
  const obj = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
  obj.traverse((o) => {
    if (!o.isMesh) return;
    const mats = [].concat(o.material), g = o.geometry, n = g.attributes.position.count;
    const col = new Float32Array(n * 3), c = new THREE.Color();
    const groups = g.groups.length ? g.groups : [{ start: 0, count: g.index ? g.index.count : n, materialIndex: 0 }];
    for (const gr of groups) {
      const m = mats[gr.materialIndex]; c.set(PAL[name][m.name] || ('#' + m.color.getHexString()));
      for (let i = gr.start; i < gr.start + gr.count; i++) { const v = g.index ? g.index.getX(i) : i; col[v * 3] = c.r; col[v * 3 + 1] = c.g; col[v * 3 + 2] = c.b; }
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.clearGroups(); g.deleteAttribute('uv');
    o.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, name: 'vc' });
  });
  for (const a of obj.animations) a.name = a.name.replace(/^Armature\|/, '');
  const glb = await new GLTFExporter().parseAsync(obj, { binary: true, animations: obj.animations });
  fs.writeFileSync(`${out}/${name.toLowerCase()}.glb`, Buffer.from(glb));
  console.log(name, glb.byteLength, obj.animations.map((a) => a.name).join(','));
}
