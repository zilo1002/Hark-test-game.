#!/usr/bin/env python3
"""APK-only changes, applied to the copied game inside the build dir (the web game in harvest/ stays as is).
Every replacement must match, so a change in the web code that breaks a patch fails the build loudly."""
import shutil, sys
from pathlib import Path
here = Path(__file__).resolve().parent
dst = Path(sys.argv[1])          # build/assets/harvest
for sub in ('js', 'models'):
    for f in (here / sub).iterdir(): shutil.copy2(f, dst / sub / f.name)

def patch(rel, pairs):
    p = dst / rel; s = p.read_text(encoding='utf-8')
    for old, new in pairs:
        n = s.count(old)
        if n < 1: raise SystemExit(f'apk-patch: pattern not found in {rel}: {old[:70]!r}')
        s = s.replace(old, new)
    p.write_text(s, encoding='utf-8')

# one model for everyone: hero skin for the farm owner, staff skin for every employee
patch('js/models.js', [
    ("import * as THREE from '../vendor/three.module.min.js';", "import * as THREE from '../vendor/three.module.min.js';\nimport { attachPersonModel } from './person-glb.js';"),
    # tag the procedural body ("base") so the model can replace it while decorations stay
    ("  const mesh = (geo, c, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, M(c)); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; return m; };",
     "  const mesh = (geo, c, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, M(c)); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; return m; };\n  const BASE = (m) => { m.userData.base = true; return m; };"),
    ("    hip.add(mesh(cap(2.65, 4.6, 5, 16), o.pants || '#3A4A78', 0, -4.2, 0, 1.08, 0.92, 1.05));", "    hip.add(BASE(mesh(cap(2.65, 4.6, 5, 16), o.pants || '#3A4A78', 0, -4.2, 0, 1.08, 0.92, 1.05)));"),
    ("    } else hip.add(mesh(sph(1, 18, 12), o.shoes || '#5A3414', 0, -8.3, 1.15, 2.8, 1.25, 3.3));", "    } else hip.add(BASE(mesh(sph(1, 18, 12), o.shoes || '#5A3414', 0, -8.3, 1.15, 2.8, 1.25, 3.3)));"),
    ("  if (o.dress) torso.add(mesh(sph(1, 24, 18), o.dress, 0, 4.4, 0, 7.0, 5.8, 5.3));\n  else torso.add(mesh(cap(6.4, 4.0, 6, 18), o.vest || o.shirt || '#FFFFFF', 0, 5.2, 0, 1.05, 1.05, 0.92));",
     "  if (o.dress) torso.add(BASE(mesh(sph(1, 24, 18), o.dress, 0, 4.4, 0, 7.0, 5.8, 5.3)));\n  else torso.add(BASE(mesh(cap(6.4, 4.0, 6, 18), o.vest || o.shirt || '#FFFFFF', 0, 5.2, 0, 1.05, 1.05, 0.92)));"),
    ("    sh.add(mesh(cap(2.5, 3.8, 5, 16), o.sleeve || o.dress || o.shirt || '#FFFFFF', 0, -2.8, 0, 1.05, 1, 1.05));\n    sh.add(mesh(sph(2.4, 18, 12), skin, 0, -6.1, 0, 1.08, 0.92, 1.05));",
     "    sh.add(BASE(mesh(cap(2.5, 3.8, 5, 16), o.sleeve || o.dress || o.shirt || '#FFFFFF', 0, -2.8, 0, 1.05, 1, 1.05)));\n    sh.add(BASE(mesh(sph(2.4, 18, 12), skin, 0, -6.1, 0, 1.08, 0.92, 1.05)));"),
    ("  head.add(mesh(sph(7.7, 40, 28), skin, 0, 0, 0, 1.08, 1.04, 0.98));", "  head.add(BASE(mesh(sph(7.7, 40, 28), skin, 0, 0, 0, 1.08, 1.04, 0.98)));"),
    ("hm.castShadow = true; head.add(hm);", "hm.castShadow = true; BASE(hm); head.add(hm);"),
    ("  head.add(mesh(sph(6.6, 10, 7), hair, 0, -0.4, -2.6, 1.05, 1, 0.8));\n", "  head.add(BASE(mesh(sph(6.6, 10, 7), hair, 0, -0.4, -2.6, 1.05, 1, 0.8)));\n  const __faceFrom = head.children.length;\n"),
    ("  if (o.beard) head.add(", "  head.children.slice(__faceFrom).forEach((c) => c.traverse((m) => { if (m.isMesh) m.userData.base = true; }));\n  if (o.beard) head.add("),
    ("  if (o.pigtails) for (const s of [-1, 1]) head.add(mesh(sph(2.6, 7, 5), hair, s * 7.6, -0.8, -2.2));", "  if (o.pigtails) for (const s of [-1, 1]) head.add(BASE(mesh(sph(2.6, 7, 5), hair, s * 7.6, -0.8, -2.2)));"),
    # procedural clothes (vest panels, overalls, apron, boots) give way to the model's fitted ones
    ("  if (o.vest) {\n    torso.add(front(", "  const __g0 = torso.children.length;\n  if (o.vest) {\n    torso.add(front("),
    ("  if (o.bowtie) torso.add(", "  torso.children.slice(__g0).forEach((c) => { c.userData.garment = true; });\n  if (o.bowtie) torso.add("),
    ("    body.add(hip); legs.push(hip);\n  }\n  // torso", "    if (o.boots) hip.children.slice(1).forEach((c) => { c.userData.garment = true; });\n    body.add(hip); legs.push(hip);\n  }\n  // torso"),
    ("  return { root, body, legs, arms, torso, head, tool, axe, net, blob, o };\n}",
     "  const __pp = { root, body, legs, arms, torso, head, tool, axe, net, blob, o };\n  if (o.glbSkin) attachPersonModel(__pp, o.glbSkin);\n  return __pp;\n}"),
])
# v5.9.6: tag the hat pieces so the model can refit each hat round its (bigger) hair
patch('js/models.js', [
    ("  if (o.hat === 'beanie') {", "  const __hat0 = head.children.length;\n  if (o.hat === 'beanie') {"),
    ("  if (o.pigtails) for (const s of [-1, 1]) head.add(BASE(", "  head.children.slice(__hat0).forEach((c) => { c.userData.hat = true; });\n  if (o.pigtails) for (const s of [-1, 1]) head.add(BASE("),
])
# every pet gets the plush fur look (fuzzy body and head, fur strands), not only the cat
patch('js/models.js', [
    ("  const role = col.dollRole || '';", "  col = { ...col, fluffy: true };\n  const role = col.dollRole || '';"),
    ("const trunkGeo = species === 'cat' && col.fluffy ?", "const trunkGeo = col.fluffy ?"),
    ("  if (species === 'cat' && col.fluffy) addFurStrands(body, [0, 6.5, -0.8]", "  if (col.fluffy) addFurStrands(body, [0, dog ? 8.2 : bird ? 7.2 : 6.5, -0.8]"),
    ("const headGeo = species === 'cat' && col.fluffy ?", "const headGeo = col.fluffy ?"),
    ("  if (species === 'cat' && col.fluffy) addFurStrands(head, [0,0,0]", "  if (col.fluffy) addFurStrands(head, [0,0,0]"),
])
# the tortie plush cat uses her Hunyuan 3D model, skinned to the pet's pivots
patch('js/models.js', [
    ("import { attachPersonModel } from './person-glb.js';", "import { attachPersonModel } from './person-glb.js';\nimport { attachPetModel } from './pet-glb.js';"),
    ("  return { root, body, head, legs, tail, kind: species, blob, profileCat };", "  const __pet = { root, body, head, legs, tail, kind: species, blob, profileCat };\n  attachPetModel(__pet, col);\n  return __pet;"),
    # the 3D tortie looks left and right (yaw) and nods a little, instead of tilting its neck
    ("+ (s.moving ? 0 : Math.sin(t * 0.5) * 0.12), 0);", "+ (s.moving ? 0 : Math.sin(t * 0.5) * 0.12), 0);\n  if (pp.glbModel) head.rotation.set(s.moving ? 0.04 : Math.sin(t * 0.9) * 0.07, (pp.profileCat ? -Math.PI / 2 : 0) + (s.look || 0) + (s.moving ? Math.sin(t * 1.3) * 0.04 : Math.sin(t * 0.55) * 0.16 + Math.sin(t * 1.7) * 0.04), 0);"),
    ("for (const l of legs) l.rotation.x = 1.25; body.rotation.z = 1.25; body.position.y = 2.4 + Math.sin(t * 1.8) * 0.15; head.rotation.set(0, 0, -1.0 + Math.sin(t * 0.7) * 0.06);",
     "if (pp.glbModel && pp.profileCat) { for (const l of legs) l.rotation.x = 0.35; body.rotation.x = 1.3; body.position.y = 1.2 + Math.sin(t * 1.8) * 0.15; head.rotation.set(0, -Math.PI / 2, 0.9 + Math.sin(t * 0.7) * 0.06); }\n    else { for (const l of legs) l.rotation.x = 1.25; body.rotation.z = 1.25; body.position.y = 2.4 + Math.sin(t * 1.8) * 0.15; head.rotation.set(0, 0, (pp.glbModel ? -0.2 : -1.0) + Math.sin(t * 0.7) * 0.06); }"),
])
patch('js/render3d.js', [
    # 3D cat: head leads into turns and toward the player
    ('      if (sp > 6) o.ang = angLerp(o.ang, Math.atan2(d.vx, d.vy), Math.min(1, dt * 10));\n      else { const p = world.player; o.ang = angLerp(o.ang, Math.atan2(p.x - d.x, p.y - d.y), Math.min(1, dt * 3)); }\n      o.pp.root.position.set(d.x, 0, d.y); o.pp.root.rotation.y = o.ang + (o.pp.profileCat ? Math.PI / 2 : 0); o.pp.root.scale.setScalar(1.4);\n      M.posePet(o.pp, { t: time, walk: d.walk, moving: sp > 6, sit: sp <= 6 && !world.player.moving });',
     '      { const p = world.player, tgt = sp > 6 ? Math.atan2(d.vx, d.vy) : Math.atan2(p.x - d.x, p.y - d.y);\n        o.ang = angLerp(o.ang, tgt, Math.min(1, dt * (o.pp.glbModel ? (sp > 6 ? 5 : 2) : (sp > 6 ? 10 : 3))));\n        let dA = tgt - o.ang; dA = Math.atan2(Math.sin(dA), Math.cos(dA));   // the head turns toward where she is going before the body does\n        o.look = (o.look || 0) + (Math.max(-0.5, Math.min(0.5, dA * 1.0)) - (o.look || 0)) * Math.min(1, dt * 8); }\n      o.pp.root.position.set(d.x, 0, d.y); o.pp.root.rotation.y = o.ang + (o.pp.profileCat ? Math.PI / 2 : 0); o.pp.root.scale.setScalar(1.4);\n      M.posePet(o.pp, { t: time, walk: d.walk, moving: sp > 6, sit: sp <= 6 && !world.player.moving, look: o.look });'),
    ("M.makePerson(this.heroStyle || HERO)", "M.makePerson({ ...(this.heroStyle || HERO), glbSkin: 'hero' })"),
    ("M.makePerson(this.wLook(FISHER))", "M.makePerson({ ...this.wLook(FISHER), glbSkin: 'staff', glbOutfit: this.uniform || null })"),
    ("M.makePerson(this.wLook(c.lumber ? LUMBERJACK : GARDENER))", "M.makePerson({ ...this.wLook(c.lumber ? LUMBERJACK : GARDENER), glbSkin: 'staff', glbOutfit: this.uniform || null })"),
    ("const pp = M.makePerson(this.wLook(c.porter ? PORTER : c.cart ? (c.from && this.world.objs[c.from[0]] && this.world.objs[c.from[0]].producer === 'cow' ? MILKER : CARTER) : c.lumber ? LUMBERJACK : c.fisher ? FISHER : GARDENER));",
     "const pp = M.makePerson({ ...this.wLook(c.porter ? PORTER : c.cart ? (c.from && this.world.objs[c.from[0]] && this.world.objs[c.from[0]].producer === 'cow' ? MILKER : CARTER) : c.lumber ? LUMBERJACK : c.fisher ? FISHER : GARDENER), glbSkin: 'staff', glbOutfit: this.uniform || null });"),
    ("M.makePerson(CASHIER)", "M.makePerson({ ...CASHIER, glbSkin: 'staff', glbOutfit: this.uniform || null })"),
    ("M.makePerson(CASHIER2)", "M.makePerson({ ...CASHIER2, glbSkin: 'staff', glbOutfit: this.uniform || null })"),
])
patch('js/home3d.js', [("person = M.makePerson(look);", "person = M.makePerson({ ...look, glbSkin: 'hero' });")])
patch('js/preview3d.js', [("const pp = M.makePerson(personStyle);", "const pp = M.makePerson({ ...personStyle, glbSkin: what.uni !== undefined ? 'staff' : 'hero' });")])
# the farm owner has one look: no boy/girl switch in the shop
patch('js/shop.js', [("export const isBoyCharacter = (id) => String(id || '').startsWith('boy');", "export const isBoyCharacter = (id) => false;")])
patch('js/ui.js', [("    characterSwitch.classList.remove('hidden');", "    characterSwitch.classList.add('hidden');")])

# v5.9.1: a piece she already wears is previewed on its own over the farm look, so worn pieces don't all show the same full outfit
patch('js/ui.js', [
    ("      if (it.slot) { const eq = { ...d.shop.eq }; eq[it.slot] = it.id; return { kind: 'person', eq, character: d.character }; }",
     "      if (it.slot) { const worn = d.shop.eq[it.slot] === it.id, eq = worn ? {} : { ...d.shop.eq }; eq[it.slot] = it.id; return { kind: 'person', eq, character: d.character }; }"),
    ("    const eq = { ...d.shop.eq }; if (it && it.slot) eq[it.slot] = it.id;",
     "    const worn = it && it.slot && d.shop.eq[it.slot] === it.id, eq = worn ? {} : { ...d.shop.eq }; if (it && it.slot) eq[it.slot] = it.id;"),
])

# v5.9.2: every walking pet (not just the dog) trails the farmer round the estate, and turns the way it walks
patch('js/home.js', [
    ("    const x = pets.active.pet === 'dog' ? WALK.dx : 150, y = pets.active.pet === 'dog' ? WALK.dy : 238;",
     "    const x = WALK.dx, y = WALK.dy;"),
])
patch('js/home3d.js', [
    ("      const x = activePet.pet === 'dog' ? petX : 150;\n      const y = activePet.pet === 'dog' ? petY : 238;",
     "      const x = petX, y = petY;\n      if (dogMoving && Math.abs(x - (pet.__lx ?? x)) > 0.05) pet.__face = x > pet.__lx ? 1 : -1;\n      pet.__lx = x;"),
    ("      pet.root.rotation.y = -0.18;\n      M.posePet(pet, { t, walk: activePet.pet === 'dog' ? walk : t * 0.12, moving: activePet.pet === 'dog' && dogMoving, sit: activePet.pet !== 'dog' });",
     "      { const f = pet.__face || -1;   // the side-profile cat faces left at rest; turn her round to walk right\n        const want = pet.profileCat ? (dogMoving && f > 0 ? Math.PI - 0.18 : -0.18) : (dogMoving ? f * 1.15 : -0.18), cur = pet.__ry ?? -0.18;\n        pet.__ry = cur + (want - cur) * 0.18; pet.root.rotation.y = pet.__ry; }\n      M.posePet(pet, { t, walk, moving: dogMoving, sit: !dogMoving && activePet.pet !== 'dog' });"),
])

# v5.9.3: long-press a decoration on the estate and drag it where you want; let go to drop it there (saved at once)
patch('js/main.js', [
    ("// tap a dashed ring on the estate (装扮 mode) to build that spot with stars\ncv.addEventListener('pointerup', (e) => {\n  if (mode !== 'home' || modalOpen) return;",
     "let decoDrag = null, decoPress = null, decoDropped = false;\n"
     "cv.addEventListener('pointerdown', (e) => {\n"
     "  decoDropped = false; if (decoPress) { clearTimeout(decoPress.timer); decoPress = null; }\n"
     "  if (mode !== 'home' || modalOpen) return;\n"
     "  const hit = hitDeco(R.W, R.H, areaRect(), data, e.clientX, e.clientY); if (!hit) return;\n"
     "  const sx = e.clientX, sy = e.clientY;\n"
     "  decoPress = { sx, sy, timer: setTimeout(() => {\n"
     "    decoPress = null; homeTap = null;\n"
     "    if (!ui.build) ui.setBuild(true);\n"
     "    const pt = homePoint(R.W, R.H, areaRect(), sx, sy);\n"
     "    decoEdit = hit; decoDrag = { dx: hit.x - pt.x, dy: hit.y - pt.y };\n"
     "    try { navigator.vibrate && navigator.vibrate(25); } catch (_) {}\n"
     "    snd.play('tap');\n"
     "  }, 380) };\n"
     "});\n"
     "cv.addEventListener('pointermove', (e) => {\n"
     "  if (decoPress && Math.hypot(e.clientX - decoPress.sx, e.clientY - decoPress.sy) > 14) { clearTimeout(decoPress.timer); decoPress = null; }\n"
     "  if (!decoDrag || !decoEdit) return;\n"
     "  const pt = homePoint(R.W, R.H, areaRect(), e.clientX, e.clientY);\n"
     "  decoEdit.x = Math.max(8, Math.min(352, pt.x + decoDrag.dx)); decoEdit.y = Math.max(90, Math.min(430, pt.y + decoDrag.dy));\n"
     "});\n"
     "const endDecoDrag = () => {\n"
     "  if (decoPress) { clearTimeout(decoPress.timer); decoPress = null; }\n"
     "  if (!decoDrag) return;\n"
     "  decoDrag = null; decoDropped = true;\n"
     "  if (decoEdit) { Shop.moveDeco(data, decoEdit.uid, decoEdit.x, decoEdit.y); Save.save(data); applyLook(); }\n"
     "};\n"
     "cv.addEventListener('pointercancel', endDecoDrag);\n"
     "// tap a dashed ring on the estate (装扮 mode) to build that spot with stars\ncv.addEventListener('pointerup', (e) => {\n"
     "  endDecoDrag(); if (decoDropped) { decoDropped = false; return; }\n"
     "  if (mode !== 'home' || modalOpen) return;"),
])

# v5.9.5: customers are chibi girls in their own colours; a short loading screen covers model loading at start-up
patch('js/render3d.js', [
    ("pigtails: !cu.vip && cu.hue % 3 === 2 });",
     "pigtails: !cu.vip && cu.hue % 3 === 2, glbSkin: cu.vip ? 'vip' : 'cust' + (cu.hue % 8), glbOutfit: null });"),
])

# v5.9.7: loading screen with a progress bar + 开始游戏, shop thumbnails pre-rendered on their own renderer, shop grid fills lazily
exec((here / 'loading.py.txt').read_text(encoding='utf-8'))

# v5.9.7 人员精简: simple levels (one machine) keep farmhands + 1 机器专员 + 1 加工品搬运工 + 普通售货员 (carries raw) + 店员;
# every level keeps one 加工品搬运工 per machine, and he rides the loader after the worker upgrade
patch('js/sales.js', [
    ("const out = L.foodLines ? splitFoodLevel(L) : splitSales0(L);", "const out = L.foodLines ? splitFoodLevel(L) : __slimStaff(splitSales0(L), CFG.levels.indexOf(L));"),
])
_sj = dst / 'js/sales.js'
_sj.write_text(_sj.read_text(encoding='utf-8') + (here / 'slim_staff.js.txt').read_text(encoding='utf-8'), encoding='utf-8')
patch('js/world.js', [
    ("if (!w.cart && !w.loader && !w.porter && (!this.L.foodCollectionTables || !w.feedFor))", "if (!w.cart && !w.loader && (!this.L.foodCollectionTables || !w.feedFor))"),
])

# v5.9.8 (宝宝 2026-11-19): the walking 普通售货员 replaces the frozen desk figure at the raw counter —
# no extra cashier standing by the processed-goods counter "像反应不过来一样". Money still goes straight in.
patch('js/world.js', [
    ("      if (e.worker.clerk) { w.clerk = true; this.refreshStats(); }",
     "      if (e.worker.clerk) { w.clerk = true; this.refreshStats(); for (const id of (e.worker.to || [])) if (this.objs[id]) this.objs[id].walkClerk = true; }"),
])
patch('js/render3d.js', [
    ("      if (c.cashier && !o.cashier) { o.cashier = M.makePerson(",
     "      if (c.walkClerk && o.cashier) { this.levelRoot.remove(o.cashier.root); o.cashier = null; o.noDesk = true; }\n      if (c.cashier && !c.walkClerk && !o.cashier) { o.cashier = M.makePerson("),
])
# v6.0.0 (宝宝 2026-11-19): the farmer's head is too big for a shoulder owl, so the owl stands on top of the head / hat.
patch('js/models.js', [("    body.add(owl.root);\n  }", "    body.add(owl.root); root.userData.owl = owl.root;\n  }")])
patch('js/ui.js', [("'已停在农夫肩头'", "'站在农夫头顶'"), ("'带上后会停在农夫肩头'", "'带上后会站在农夫头顶（帽子上）'")])
patch('js/shop.js', [("name: '白绒肩头猫头鹰'", "name: '白绒头顶猫头鹰'")])
print('apk-patch applied')
