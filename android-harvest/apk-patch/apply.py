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

# ---- v6.1.0 椰风海岛 (宝宝 2026-11-19): new estate map + levels 76–90 with tropical fruit, seafood, palms ----
ISL = Path(__file__).parent / 'island'
patch('js/config.js', [
    ("export const isValley = (li) =>", (ISL / 'config.js.txt').read_text(encoding='utf-8') + "export const isValley = (li) =>"),
    ("  { id: 'night', name: '夜市', from: 60, size: 15 },", "  { id: 'night', name: '夜市', from: 60, size: 15 },\n  { id: 'island', name: '椰风海岛', from: 75, size: 15 },"),
])
patch('js/sales.js', [("  28: ['rainboots', 'fishballs'], 29: ['rainboots', 'fishballs', 'xiaolongbao'],\n",
    "  28: ['rainboots', 'fishballs'], 29: ['rainboots', 'fishballs', 'xiaolongbao'],\n"
    "  // v6.1.0 椰风海岛 76–90\n  30: ['mangopuree'], 31: ['spicycray'], 32: ['canpine'], 33: ['garlicscallop'], 34: ['mangocrepe'], 35: ['dragonjuice', 'kelpknot'],\n"
    "  36: ['coconutmilk', 'spicycray'], 37: ['coconutjelly'], 38: ['spicycray', 'garlicscallop', 'kelpknot'], 39: ['mangopuree', 'canpine', 'dragonjuice'],\n"
    "  40: ['spicycray', 'garlicscallop'], 41: ['coconutjelly', 'mangopuree'], 42: ['garlicscallop', 'dragonjuice', 'canpine'], 43: ['mangocrepe', 'spicycray'],\n"
    "  44: ['coconutmilk', 'spicycray', 'mangopuree'],\n")])
p = dst / 'js/models.js'; p.write_text(p.read_text(encoding='utf-8') + (ISL / 'models.js.txt').read_text(encoding='utf-8'), encoding='utf-8')
p = dst / 'js/sprites.js'; p.write_text(p.read_text(encoding='utf-8') + (ISL / 'sprites.js.txt').read_text(encoding='utf-8'), encoding='utf-8')
SEA = "['fish', 'crayfish', 'scallop', 'kelp'].includes(f.item)"
patch('js/render3d.js', [
    ("      const water = f.item === 'fish';", "      const water = " + SEA + ";"),
    ("fish: f.hidden ? '#8FBFD8' : '#3FA8E0', grape: '#9A7A4A', tomato: '#8A5A30', pepper: '#8A5A30' }[f.item];",
     "fish: f.hidden ? '#8FBFD8' : '#3FA8E0', grape: '#9A7A4A', tomato: '#8A5A30', pepper: '#8A5A30', crayfish: f.hidden ? '#8FBFD8' : '#3FA8E0', scallop: f.hidden ? '#8FBFD8' : '#3FA8E0', kelp: f.hidden ? '#8FBFD8' : '#3FA8E0', mango: '#4F8A26', pineapple: '#B8935A', dragonfruit: '#A07A4A', coconut: '#E8D29A' }[f.item];"),
    ("fish: '#B9B2A4', grape: '#76562A', tomato: '#6A4422', pepper: '#6A4422' }[f.item];",
     "fish: '#B9B2A4', grape: '#76562A', tomato: '#6A4422', pepper: '#6A4422', crayfish: '#B9B2A4', scallop: '#B9B2A4', kelp: '#B9B2A4', mango: '#3A6E1C', pineapple: '#8E6A34', dragonfruit: '#76562A', coconut: '#C9AE72' }[f.item];"),
    ("      if (f.item === 'fish') {   // pond: a stone bank", "      if (" + SEA + ") {   // pond: a stone bank"),
    ("    this.lawn = L ? L[0] : COL.lawn; this.lawn2 = L ? L[1] : COL.lawn2;",
     "    this.lawn = L ? L[0] : COL.lawn; this.lawn2 = L ? L[1] : COL.lawn2;\n    this.beach = !!(w.deco && w.deco.beach); if (this.beach) { this.lawn = '#A2DA6A'; this.lawn2 = '#48B6E4'; }   // v6.1.0 椰风海岛: the sea round the island"),
    ("    g.fillStyle = this.lawn || COL.lawn; g.fillRect(0, 0, w.W, w.H);",
     "    if (this.beach) {   // v6.1.0: a sand beach with a foam line between the island and the sea\n"
     "      g.fillStyle = '#F2DDA4'; g.beginPath(); g.roundRect(-96, -96, w.W + 192, w.H + 192, 60); g.fill();\n"
     "      g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 5; g.beginPath(); g.roundRect(-100, -100, w.W + 200, w.H + 200, 64); g.stroke();\n"
     "      for (let i = 0; i < 70; i++) { g.fillStyle = ['#FFFFFF', '#F8C8B0', '#E8B880'][i % 3]; g.beginPath(); g.ellipse(-80 + R(i + 4400) * (w.W + 160), i % 2 ? -50 + R(i + 4500) * 30 : w.H + 20 + R(i + 4500) * 30, 2.4, 1.6, R(i) * 3, 0, TAU); g.fill(); }\n"
     "    }\n    g.fillStyle = this.lawn || COL.lawn; g.fillRect(0, 0, w.W, w.H);"),
])
patch('js/home.js', [
    ("let HNIGHT = false;", "let HNIGHT = false;\n" + (ISL / 'home.js.txt').read_text(encoding='utf-8')),
    ("HSEASON, HNIGHT, page].join('|');", "HSEASON, HNIGHT, HISLAND, page].join('|');"),
    ("C = HNIGHT ? NIGHT_GROUND : (SEASON_GROUND", "C = HNIGHT ? NIGHT_GROUND : HISLAND ? ISLAND_GROUND : (SEASON_GROUND"),
    ("    if (inPlot(fx + fw / 2, fy + fh / 2, 150) || hsh(k) < 0.58) continue;", "    if (HISLAND || inPlot(fx + fw / 2, fy + fh / 2, 150) || hsh(k) < 0.58) continue;"),
    ("    if (inPlot(x, y, -6)) continue;\n", "    if (inPlot(x, y, -6) || (HISLAND && (i % 3 || y < ISEA_Y + 20))) continue;\n"),
    ("  // the lane out of the gate, down off the screen\n", "  if (HISLAND) islandSea(g, x0, x1, y0);\n  // the lane out of the gate, down off the screen\n"),
    ("if (p) pine(g, 1.1); else roundTree(g, 0, false);", "if (HISLAND) { if (y > ISEA_Y + 24) palm2d(g, x); } else if (p) pine(g, 1.1); else roundTree(g, 0, false);"),
    ("  HNIGHT = !!save.night;", "  HNIGHT = !!save.night; HISLAND = page === 4 && !HNIGHT;"),
])

# ---- v6.1.1 (宝宝 2026-11-19): 椰风海岛 is a 4th 装扮庄园 estate (15 pieces bought with stars), not a shop map ----
patch('js/config.js', [("    { id: 'winery',     name: '翻新湖畔酒庄', cost: 5, page: 3 },\n",
    "    { id: 'winery',     name: '翻新湖畔酒庄', cost: 5, page: 3 },\n"
    "    // page 4 (v6.1.1): the coconut-breeze island beach estate, opens once level 75 is cleared\n"
    "    { id: 'pier',       name: '修海边栈桥', cost: 2, page: 4 },\n"
    "    { id: 'umbrella',   name: '撑沙滩伞',   cost: 2, page: 4 },\n"
    "    { id: 'sandcastle', name: '堆沙堡',     cost: 2, page: 4 },\n"
    "    { id: 'surfboards', name: '立冲浪板',   cost: 2, page: 4 },\n"
    "    { id: 'torches',    name: '点草编火把', cost: 2, page: 4 },\n"
    "    { id: 'hammock',    name: '挂椰林吊床', cost: 2, page: 4 },\n"
    "    { id: 'crabs',      name: '引来小螃蟹', cost: 3, page: 4 },\n"
    "    { id: 'nets',       name: '晒扇贝渔网', cost: 3, page: 4 },\n"
    "    { id: 'fruitstand', name: '搭热带水果摊', cost: 3, page: 4 },\n"
    "    { id: 'crayboil',   name: '支小龙虾锅', cost: 3, page: 4 },\n"
    "    { id: 'sailboat',   name: '停小帆船',   cost: 3, page: 4 },\n"
    "    { id: 'lifeguard',  name: '建救生塔',   cost: 4, page: 4 },\n"
    "    { id: 'turtles',    name: '引来海龟',   cost: 4, page: 4 },\n"
    "    { id: 'tikibar',    name: '盖椰子吧台', cost: 4, page: 4 },\n"
    "    { id: 'resort',     name: '翻新椰风民宿', cost: 6, page: 4 },\n")])
patch('js/home.js', [
    ("let HNIGHT = false;\n", "let HNIGHT = false;\n" + (ISL / 'estate.js.txt').read_text(encoding='utf-8')),
    ("page === 3 ? SPOTS3 : page === 2 ? SPOTS2 : SPOTS", "page === 4 ? SPOTS4 : page === 3 ? SPOTS3 : page === 2 ? SPOTS2 : SPOTS"),
    ("center = page === 3 ? 'winery'", "center = page === 4 ? 'resort' : page === 3 ? 'winery'"),
    ("  if (page === 3) out.push({ x: 92, y: 372, r: 46 });   // the lake", "  if (page === 3 || page === 4) out.push({ x: 92, y: 372, r: 46 });   // the lake / lagoon"),
    ("  const P2 = page === 2, P3 = page === 3;\n  const spots = P3 ? SPOTS3", "  const P2 = page === 2, P3 = page === 3, P4 = page === 4;\n  const spots = P4 ? SPOTS4 : P3 ? SPOTS3"),
    ("draw = P3 ? DRAW3", "draw = P4 ? DRAW4 : P3 ? DRAW3"),
    ("center = P3 ? 'winery'", "center = P4 ? 'resort' : P3 ? 'winery'"),
    ("  if (P3) {   // the lake, and a cobbled lane up to the winery\n    lake(g, t);", "  if (P4) lagoon(g, t);\n  if (P3) {   // the lake, and a cobbled lane up to the winery\n    lake(g, t);"),
    ("if (P3) winery(g, done, t);", "if (P4) islandHouse(g, done, t); else if (P3) winery(g, done, t);"),
    ("const SPOT_R = { manor: 30, lodge: 30, winery: 30,", "const SPOT_R = { manor: 30, lodge: 30, winery: 30, resort: 30, pier: 0, sailboat: 0, turtles: 0,"),
])
patch('js/ui.js', [
    ("const TABS = { 1: '花园庄园', 2: '林场牧场', 3: '湖畔酒庄' };", "const TABS = { 1: '花园庄园', 2: '林场牧场', 3: '湖畔酒庄', 4: '椰风海岛' };"),
    ("this.page = 3; }   // once past level 38, open on the lakeside winery",
     "this.page = 3; }   // once past level 38, open on the lakeside winery\n    if (data.unlocked >= 75 && !this._auto4) { this._auto2 = this._auto3 = this._auto4 = true; this.page = 4; }   // v6.1.1: past level 75, open on the island"),
    ("!((m.page || 1) === 3 && data.unlocked < 38));", "!((m.page || 1) === 3 && data.unlocked < 38) && !((m.page || 1) === 4 && data.unlocked < 75));"),
    ("    const locked3 = page === 3 && data.unlocked < 38;", "    const locked3 = (page === 3 && data.unlocked < 38) || (page === 4 && data.unlocked < 75);"),
    ("page === 2 ? '牧场建好啦！' : '酒庄建好啦！')", "page === 2 ? '牧场建好啦！' : page === 4 ? '海岛建好啦！' : '酒庄建好啦！')"),
    ("this.page = 0; this._auto2 = this._auto3 = false;", "this.page = 0; this._auto2 = this._auto3 = this._auto4 = false;"),
    ("locked3 ? '过第 38 关开放'", "locked3 ? (page === 4 ? '过第 75 关开放' : '过第 38 关开放')"),
])
patch('js/main.js', [("  if (m.page === 3 && data.unlocked < 38) {", "  if ((m.page === 3 && data.unlocked < 38) || (m.page === 4 && data.unlocked < 75)) {")])
patch('index.html', [('<button data-p="3">湖畔酒庄</button></div>', '<button data-p="3">湖畔酒庄</button><button data-p="4">椰风海岛</button></div>')])

print('apk-patch applied')

# ---- v6.1.2 (宝宝 2026-11-19 10:02) ----
# 1) "普通售货员不干活": the walking clerk stood by the raw board holding a load while the raw counter sat
#    between its 30/80 top-up marks. Now he tops the counter up whenever a batch fits (up to rawFull + 40),
#    and when there is nothing to carry he stands at the desk (north end, where the old desk figure stood)
#    facing the customers, instead of loitering by the board.
patch('js/world.js', [
    ("    const n = this.rawStock(s);\n    if (!this.procs.length) return n < CFG.counter.stockMax;\n",
     "    const n = this.rawStock(s);\n    if (!this.procs.length) return n < CFG.counter.stockMax;\n"
     "    if (w.clerk && !w.porter) return n + Math.max(1, Math.min(w.stack.length || w.cap, w.cap)) <= CFG.v46.rawFull + 40;\n"),
    ("          if (!counter.sale2 && this.procs.length) room = Math.min(room, CFG.v46.rawFull + 4 - this.rawStock(counter));",
     "          if (!counter.sale2 && this.procs.length) room = Math.min(room, CFG.v46.rawFull + 40 - this.rawStock(counter));"),
    ("  idlePost(w, srcs) {\n",
     "  deskSpot(w) { const k = w.clerk && !w.porter && this.objs[w.to[0]]; return k && k.kind === 'counter' && !k.hidden ? { x: k.x + 4, y: k.y - 44 } : null; }\n"
     "  idlePost(w, srcs) {\n    { const d = this.deskSpot(w); if (d) return d; }\n"),
    ("      else if (this.smart && anyTakes) { const o = this.post(w, srcs); tx = o.x;",
     "      else if (this.smart && anyTakes) { const o = this.deskSpot(w) || this.post(w, srcs); tx = o.x;"),
])
patch('js/render3d.js', [
    ("    if (sp > 8) o.ang = angLerp(o.ang, Math.atan2(c.vx, c.vy), Math.min(1, dt * 12));\n    const app =",
     "    if (sp > 8) o.ang = angLerp(o.ang, Math.atan2(c.vx, c.vy), Math.min(1, dt * 12));\n"
     "    else if (c.clerk && this.world.deskSpot) { const d = this.world.deskSpot(c); if (d && Math.hypot(d.x - c.x, d.y - c.y) < 26) o.ang = angLerp(o.ang, 0.3, Math.min(1, dt * 6)); }   // v6.1.2: the clerk at the desk faces the till\n"
     "    const app ="),
])
# 2) the raw counter's single crop sits as 6 even towers (4 for big goods) that grow upward together,
#    instead of one 4x3 block in the middle. The processed counter keeps its tall single stack.
patch('js/render3d.js', [
    ("        const type = singleKind[0], n = Math.min(c.stock.length, 120);\n        for (let j = 0; j < n; j++) {\n",
     "        const type = singleKind[0], n = Math.min(c.stock.length, 120);\n"
     "        const big = (M.ITEM_HALF[type] || 2) >= 3.3, towers = big ? [[-7.5, -13], [7.5, -13], [-7.5, 13], [7.5, 13]] : [[-7.5, -21], [7.5, -21], [-7.5, 0], [7.5, 0], [-7.5, 21], [7.5, 21]];\n"
     "        if (!c.sale2) for (let j = 0; j < n; j++) {\n"
     "          const p = j % towers.length, k = (j / towers.length) | 0, cell = k % 4, lay = (k / 4) | 0, [tx, tz] = towers[p], sp = big ? 2.6 : 2.1;\n"
     "          this.item(type, c.x + tx + (cell % 2 ? sp : -sp), c.y + tz + ((cell / 2) | 0 ? sp * 0.86 : -sp * 0.86), K.deskH + 1 + lay * CFG.items[type].step * 0.8 + (M.ITEM_HALF[type] || 2), (j % 3) * 0.2 + 0.785, 0.85);\n"
     "        }\n"
     "        else for (let j = 0; j < n; j++) {\n"),
])
# 3) the carried stack leans out in front of the big chibi head and any hat (and the owl) instead of
#    passing through them: above chest height every layer is pushed forward far enough to clear the face,
#    and above the hat's lower edge far enough to clear the hat's front.
patch('js/render3d.js', [
    ("    let top = { x: b.x, y: b.y, z: b.z };\n",
     "    let top = { x: b.x, y: b.y, z: b.z };\n"
     "    const clr = b.sway !== undefined && o.pp && o.pp.glbModel ? this.headClear(o) : null, nearF = 12 + (deep - 1) * 3 - (deep - 1) / 2 * b.spread;\n"),
    ("      const headingSway = c.moving ? Math.sin(c.walk + i * 0.12) * 0.025 : 0;\n      this.item(type, x, y, z,",
     "      let px = x, py = y;\n"
     "      if (clr) {\n"
     "        const need = (f) => Math.max(0, f + half + 1 - nearF), sm = (a, b2, v) => Math.max(0, Math.min(1, (v - a) / (b2 - a)));\n"
     "        const push = Math.max(need(clr.face) * sm(clr.chin - 6, clr.chin + 6, z), clr.hat ? need(clr.hat) * sm(clr.hatBot - 14, clr.hatBot, z) : 0);\n"
     "        px += b.fx * push; py += b.fz * push;\n"
     "      }\n"
     "      const headingSway = c.moving ? Math.sin(c.walk + i * 0.12) * 0.025 : 0;\n      this.item(type, px, py, z,"),
    ("  drawStack(c, o, labels, isPlayer) {\n",
     "  // v6.1.2: how far forward the model's face and its hat / owl reach (world units, cached per look)\n"
     "  headClear(o) {\n"
     "    const pp = o.pp, head = pp.head, key = head.children.length + ':' + (pp.o && pp.o.hat || '');\n"
     "    if (o._clr && o._clrKey === key) return o._clr;\n"
     "    const s = (o.root ? o.root.scale.x : 1) * pp.root.scale.x || 1.15;\n"
     "    const clr = { face: 15.8 * s, chin: 24 * s, hat: 0, hatBot: 1e9 };\n"
     "    pp.root.updateMatrixWorld(true);\n"
     "    const inv = new THREE.Matrix4().copy(pp.root.matrixWorld).invert(), bb = new THREE.Box3();\n"
     "    for (const ch of head.children) {\n"
     "      if (!ch.userData.hat && !(pp.root.userData.owl && ch === pp.root.userData.owl)) continue;\n"
     "      ch.traverse((m) => { if (!m.isMesh) return; bb.setFromObject(m); if (bb.isEmpty()) return; bb.applyMatrix4(inv);\n"
     "        if (bb.max.z * s > clr.face) { clr.hat = Math.max(clr.hat, bb.max.z * s); clr.hatBot = Math.min(clr.hatBot, bb.min.y * s); } });\n"
     "    }\n"
     "    if (clr.hat <= clr.face) clr.hat = 0;\n"
     "    o._clr = clr; o._clrKey = key; return clr;\n"
     "  }\n"
     "  drawStack(c, o, labels, isPlayer) {\n"),
])
