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
# (6.1.6: the boy/girl switch is back — 宝宝 2026-11-19 — so the shop's 切换为男孩/女孩 button stays)

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
     "        const big = (M.ITEM_HALF[type] || 2) >= 3.3, towers = [[-7.5, -13], [7.5, -13], [-7.5, 13], [7.5, 13]];   // 6.1.5: 4 towers (宝宝: the white tissue box sits beside them)\n"
     "        if (!c.sale2) for (let j = 0; j < n; j++) {\n"
     "          const p = j % towers.length, k = (j / towers.length) | 0, cell = k % 4, lay = (k / 4) | 0, [tx, tz] = towers[p], sp = big ? 2.6 : 2.1;\n"
     "          this.item(type, c.x + tx + (cell % 2 ? sp : -sp), c.y + tz + ((cell / 2) | 0 ? sp * 0.86 : -sp * 0.86), K.deskH + 1 + lay * CFG.items[type].step * 0.8 + (M.ITEM_HALF[type] || 2), (j % 3) * 0.2 + 0.785, 0.85);\n"
     "        }\n"
     "        else for (let j = 0; j < n; j++) {\n"),
])
# 3) (6.1.2's forward lean of the carried stack was dropped in 6.1.5; hats got shorter brims instead)

# ---- v6.1.3 (宝宝 2026-11-19 10:16): "普通搬运工站着不干活；升级小车也就拿一点，还得等" ----
# a) the 加工品搬运工 waited at an emptied tray until he held 40% of his (truck-sized) load; now he leaves
#    after 3 s with whatever he has.
# b) a farmhand with a big basket waited until the whole basket fit on the wooden board; now he unloads
#    whatever fits, and while the board is full he goes back to harvesting instead of standing there.
patch('js/world.js', [
    ("      if (left === 0 && w.incoming === 0 && (have >= Math.ceil(w.cap * CFG.v47.porterGo) || (low && have >= CFG.v47.porterMin))) w.state = 'deliver';",
     "      if (left === 0 && w.incoming === 0 && have > 0) w.porterIdle = (w.porterIdle || 0) + dt; else w.porterIdle = 0;\n"
     "      if (left === 0 && w.incoming === 0 && (have >= Math.ceil(w.cap * CFG.v47.porterGo) || (low && have >= CFG.v47.porterMin) || w.porterIdle > 3)) { w.state = 'deliver'; w.porterIdle = 0; }"),
    ("    if (s.kind === 'stand') { const need = w.stack.length || w.cap; return s.pile.total + s.pile.pending + need <= s.pile.cap; }",
     "    if (s.kind === 'stand') { const need = w.stack.length || w.cap; return s.pile.total + s.pile.pending + (w.standCarrier ? Math.min(need, 30) : need) <= s.pile.cap; }"),
    ("        if (s.kind === 'stand' && s.pile.total + s.pile.pending + (w.stack.length || w.cap) > s.pile.cap) { w.blocked = s; continue; }",
     "        if (s.kind === 'stand' && s.pile.total + s.pile.pending + (w.standCarrier ? Math.min(w.stack.length || w.cap, 30) : (w.stack.length || w.cap)) > s.pile.cap) { w.blocked = s; continue; }"),
    ("    if (this.smart && !w.feedFor && !w.fullBatch && w.state === 'collect' && w.stack.length >= Math.ceil(w.cap * CFG.v46.holdAt)) {",
     "    if (this.smart && !w.feedFor && !w.fullBatch && !w.standCarrier && w.state === 'collect' && w.stack.length >= Math.ceil(w.cap * CFG.v46.holdAt)) {"),
    ("      else if (this.smart && anyTakes) { const o = this.deskSpot(w) || this.post(w, srcs); tx = o.x;",
     "      else if (this.smart && anyTakes && w.standCarrier && w.stack.length < w.cap) { w.state = 'collect'; }   // v6.1.3: board full → keep harvesting\n"
     "      else if (this.smart && anyTakes) { const o = this.deskSpot(w) || this.post(w, srcs); tx = o.x;"),
])
# c) the 加工品搬运工 / 理货员 picked up the machine's output one piece at a time and every new piece restarted
#    his wait, so with a slow machine he never left (and the goods counter sat empty). Now he leaves 4 s after
#    his first piece, or at once with 5+ when the goods counter is running low.
patch('js/world.js', [
    ("    } else if (w.clerk) w.clerkCollectAge = 0;\n",
     "    } else if (w.clerk) w.clerkCollectAge = 0;\n"
     "    if ((w.tally || w.porter) && w.state === 'collect' && w.stack.length > 0) {\n"
     "      w.holdAge = (w.holdAge || 0) + dt;\n"
     "      const sk = sinks[0], low = sk && sk.stock && sk.stock.length + sk.incoming < CFG.v47.porterLow;\n"
     "      if (w.incoming === 0 && (w.holdAge >= 4 || (low && w.stack.length >= CFG.v47.porterMin))) { w.state = 'deliver'; w.holdAge = 0; }\n"
     "    } else if (w.tally || w.porter) w.holdAge = 0;\n"),
])

# ---- v6.1.3 (宝宝 2026-11-19 10:24) ----
# d) 收银升级 puts a 2nd cashier behind the 加工品 counter; instead of a 2nd figure standing there, that
#    cashier now walks and carries finished goods to the counter (a 2nd porter), going back to the till
#    when there is nothing to carry.
# e) a machine whose unlock costs 0 gold builds itself the moment it becomes available (no 0-gold tile).
patch('js/world.js', [
    ("      const U = CFG.v43.cup; c.upLv++; c.serveRate *= U.serve; c.interval *= U.interval; c.clerks = 2;\n",
     "      const U = CFG.v43.cup; c.upLv++; c.serveRate *= U.serve; c.interval *= U.interval; c.clerks = 2;\n"
     "      if (c.cashier && !c.walkClerk && !c.helper) {   // v6.1.3: the 2nd cashier carries goods\n"
     "        const from = [...new Set(this.tiles.filter((x) => x.effect && x.effect.worker && (x.effect.worker.to || []).includes(id)).flatMap((x) => x.effect.worker.from || []))].filter((s) => this.objs[s]);\n"
     "        if (from.length) { const hw = this.addWorker(from, [id], c.x - 24, c.y - 6, false, null); hw.porter = true; hw.helper = true; c.helper = hw; this.refreshStats(); }\n"
     "      }\n"),
    ("  deskSpot(w) { const k = w.clerk && !w.porter && this.objs[w.to[0]];",
     "  deskSpot(w) { if (w.helper) { const h = this.objs[w.to[0]]; return h && !h.hidden ? { x: h.x - 24, y: h.y - 6 } : null; }\n"
     "    const k = w.clerk && !w.porter && this.objs[w.to[0]];"),
    ("      if (v && !t.visible && !silent) { t.appearT = this.t; this.emit('tileAppear', { x: t.x, y: t.y }); }\n      t.visible = v;\n    }\n",
     "      if (v && !t.visible && !silent) { t.appearT = this.t; this.emit('tileAppear', { x: t.x, y: t.y }); }\n      t.visible = v;\n    }\n"
     "    // v6.1.3 (宝宝): a 0-gold machine needs no unlock tile — build it as soon as it is available\n"
     "    const free = this.tiles.find((t) => t.visible && !t.done && !t.repeat && (t.price || 0) <= 0 && t.effect && t.effect.show && t.effect.show.some((id) => this.objs[id] && this.objs[id].kind === 'proc'));\n"
     "    if (free) { free.visible = false; this.completeTile(free, silent); }\n"),
])
patch('js/render3d.js', [
    ("      if (c.cashier && c.clerks === 2 && !o.clerk2) {",
     "      if (c.cashier && c.clerks === 2 && !o.clerk2 && !c.helper) {"),
])

# ---- v6.1.5 (宝宝 2026-11-19 10:38): shorter hat brims instead of leaning the stack; the staff cap's star sits on the cap ----
patch('js/models.js', [
    ("    head.add(mesh(cyl(8.4, 8.4, 0.9, 40), '#D2A85B', 0, 4.7, 0));",
     "    head.add(mesh(cyl(6.9, 6.9, 0.9, 40), '#D2A85B', 0, 4.7, 0));"),
    ("    head.add(mesh(box(8, 0.9, 6), o.capColor || '#3B7FE0', 0, 2.6, 8.4));",
     "    head.add(mesh(box(8, 0.9, 3.4), o.capColor || '#3B7FE0', 0, 2.6, 7.4));"),
    ("    head.add(mesh(cyl(10.5, 11.5, 1.1, 12), o.capColor || '#FFC21A', 0, 3.6, -1.4, 1, 1, 1.05));",
     "    head.add(mesh(cyl(9.2, 9.8, 1.1, 12), o.capColor || '#FFC21A', 0, 3.6, -1.4, 1, 1, 1.05));"),
    ("    head.add(mesh(cyl(9.1, 9.1, 0.9, 24), '#A0622D', 0, 4.9, 0, 1, 1, 0.82));\n    for (const side of [-1, 1]) head.add(mesh(sph(1.3, 16, 12), '#A0622D', side * 8.0, 5.2, 0, 1.5, 0.75, 2.5));",
     "    head.add(mesh(cyl(7.4, 7.4, 0.9, 24), '#A0622D', 0, 4.9, 0, 1, 1, 0.82));\n    for (const side of [-1, 1]) head.add(mesh(sph(1.3, 16, 12), '#A0622D', side * 6.6, 5.2, 0, 1.3, 0.75, 2.0));"),
    ("    head.add(mesh(box(15, 1.2, 15), '#2A2A3A', 0, 8.0, -0.4, 1, 1, 1));",
     "    head.add(mesh(box(13, 1.2, 13), '#2A2A3A', 0, 8.0, -0.4, 1, 1, 1));"),
    ("    head.add(mesh(box(8, 0.9, 6), '#2A2A5A', 0, 2.6, 8.4));",
     "    head.add(mesh(box(8, 0.9, 3.4), '#2A2A5A', 0, 2.6, 7.4));"),
    ("    st.position.set(0, 6.4, 7.6); st.scale.set(1, 1, 0.55); head.add(st);",
     "    st.position.set(0, 6.0, 6.75); st.rotation.x = -0.58; st.scale.set(1, 1, 0.45); head.add(st);   // 6.1.5: flat on the crown, not floating in front"),
    ("    head.add(mesh(box(8, 0.9, 6), '#1A1A3A', 0, 2.6, 8.4));",
     "    head.add(mesh(box(8, 0.9, 3.4), '#1A1A3A', 0, 2.6, 7.4));"),
])

# ---- v6.1.6 (宝宝 2026-11-19): the farm owner is her own Hunyuan girl (default look) or boy (切换为男孩/女孩),
# on a finer 14-bone skeleton; shop clothes are fitted onto the bare base body and replace the default look (hero-glb.js).
# Employees and customers keep the cat-ear maid model.
patch('js/models.js', [
    ("import { attachPersonModel } from './person-glb.js';", "import { attachPersonModel } from './person-glb.js';\nimport { attachHeroModel } from './hero-glb.js';"),
    ("  if (o.glbSkin) attachPersonModel(__pp, o.glbSkin);", "  if (o.glbSkin === 'hero' && attachHeroModel(__pp)) {}\n  else if (o.glbSkin) attachPersonModel(__pp, o.glbSkin);"),
])
# ---- v6.1.7 (宝宝 2026-11-19 22:12): the original farm owner (the cat-ear chibi maid) comes back as a third look, Q版.
# The shop switch cycles 女孩 → 男孩 → Q版 → 女孩; the Q版 owner wears the maid model in its original colours.
patch('js/shop.js', [("export const CHARACTER_IDS = ['girl', 'boy', 'boy_sage', 'boy_navy'];",
                      "export const CHARACTER_IDS = ['girl', 'boy', 'boy_sage', 'boy_navy', 'q'];")])
patch('js/ui.js', [
    ("const next = isBoyCharacter(d.character) ? 'girl' : 'boy';",
     "const next = isBoyCharacter(d.character) ? 'q' : d.character === 'q' ? 'girl' : 'boy';"),
    ("    characterSwitch.textContent = isBoyCharacter(d.character) ? '切换为女孩' : '切换为男孩';\n    characterSwitch.setAttribute('aria-label', `当前${isBoyCharacter(d.character) ? '男孩' : '女孩'}，点击切换为${isBoyCharacter(d.character) ? '女孩' : '男孩'}`);",
     "    { const cur = isBoyCharacter(d.character) ? '男孩' : d.character === 'q' ? 'Q版' : '女孩', nx = cur === '男孩' ? 'Q版' : cur === 'Q版' ? '女孩' : '男孩';\n      characterSwitch.textContent = '切换为' + nx; characterSwitch.setAttribute('aria-label', `当前${cur}，点击切换为${nx}`); }"),
])
patch('js/models.js', [
    ("  if (o.glbSkin === 'hero' && attachHeroModel(__pp)) {}",
     "  if (o.glbSkin === 'hero' && o.character === 'q') attachPersonModel(__pp, 'hero');\n  else if (o.glbSkin === 'hero' && attachHeroModel(__pp)) {}"),
])
# ---- v6.1.8 (宝宝 2026-11-19): 黑西装猫猫 in the shop for 2000 gold — on the boy it is his own Hunyuan suit model (hero-glb.js)
patch('js/shop.js', [("  { id: 'bootsG',   slot: 'feet',",
    "  { id: 'catSuit',  slot: 'top',  name: '黑西装猫猫', price: 2000, style: { catSuit: true, vest: '#1C1C22', bowtie: false, shirt: '#1C1C22', sleeve: '#1C1C22', pants: '#1C1C22' }, sw: ['#1C1C22', '#6B4A3A'] },\n  { id: 'bootsG',   slot: 'feet',")])
# ---- v6.2.0 (宝宝 2026-11-19 22:47): each look (女孩 / 男孩 / Q版) keeps its own clothes — switching no longer carries the
# girl's 黑西装 onto the boy (or back); a 一键脱下 button in the clothes shop takes everything off the current look.
patch('js/shop.js', [("  d.maps = Array.isArray(s.maps) ? [...new Set(s.maps.filter((id) => MAP_IDS.includes(id)))] : [];\n  return d;",
  "  d.maps = Array.isArray(s.maps) ? [...new Set(s.maps.filter((id) => MAP_IDS.includes(id)))] : [];\n"
  "  d.eqBy = {};\n  if (s.eqBy && typeof s.eqBy === 'object') for (const c of Object.keys(s.eqBy)) { const e = s.eqBy[c]; if (!e || typeof e !== 'object') continue; const o = {};\n"
  "    for (const [k] of SLOTS) { const id = e[k], it = itemById(id); o[k] = it && it.slot === k && d.owned.includes(id) ? id : null; } d.eqBy[c] = o; }\n  return d;")])
patch('js/main.js', [("  setCharacter: (character) => { data.character = Shop.CHARACTER_IDS.includes(character) ? character : 'girl';",
  "  undressAll: () => { for (const k in data.shop.eq) data.shop.eq[k] = null; Save.save(data); applyLook(); if (preview) preview.thumbs = {}; },\n"
  "  setCharacter: (character) => { { const sh = data.shop, prev = data.character || 'girl', nx = Shop.CHARACTER_IDS.includes(character) ? character : 'girl';\n"
  "      sh.eqBy = sh.eqBy || {}; sh.eqBy[prev] = { ...sh.eq }; sh.eq = { hat: null, top: null, neck: null, feet: null, ...(sh.eqBy[nx] || {}) }; }\n"
  "    data.character = Shop.CHARACTER_IDS.includes(character) ? character : 'girl';")])
patch('index.html', [('<button class="small swap hidden" id="characterSwitch">切换为男孩</button>',
  '<button class="small swap hidden" id="characterSwitch">切换为男孩</button><button class="small swap hidden" id="undressAll">一键脱下</button>')])
patch('style.css', [("#characterSwitch:focus-visible {", "#undressAll { margin: 7px 0 0 8px; min-height: 42px; padding: 7px 14px; border-radius: 13px; background: linear-gradient(#FFFFFF, #E4E0D6); box-shadow: 0 3px 0 #A9A294; color: #5A4A3A; font-size: 15px; font-weight: 900; touch-action: manipulation; }\n#characterSwitch:focus-visible {")])
patch('js/ui.js', [("    $('shopAct').onclick = () => {",
  "    $('undressAll').onclick = () => { this.h.undressAll(); this.renderShop(); this.h.tap(); };\n    $('shopAct').onclick = () => {"),
  ("    characterSwitch.classList.remove('hidden');",
   "    characterSwitch.classList.remove('hidden');\n    { const u = $('undressAll'); u.classList.toggle('hidden', this.shopTab !== 'outfit' || !Object.values(d.shop.eq).some(Boolean)); }")])
# ---- v6.2.0 (宝宝 2026-11-19 22:50): more shoes to swap — snug on the body like the boots
patch('js/shop.js', [("  { id: 'bootsG',   slot: 'feet',",
  "  { id: 'shoeW',    slot: 'feet', name: '小白球鞋', price: 120, style: { boots: '#F4F4F0' }, sw: ['#F4F4F0', '#9AA8B8'] },\n"
  "  { id: 'shoeMint', slot: 'feet', name: '薄荷帆布鞋', price: 140, style: { boots: '#7FD6B9' }, sw: ['#7FD6B9', '#FFFFFF'] },\n"
  "  { id: 'shoePink', slot: 'feet', name: '粉兔兔鞋', price: 160, style: { boots: '#FF9CC0' }, sw: ['#FF9CC0', '#FFFFFF'] },\n"
  "  { id: 'shoeBlk',  slot: 'feet', name: '黑亮皮鞋', price: 200, style: { boots: '#1C1C22' }, sw: ['#1C1C22', '#6B6B78'] },\n"
  "  { id: 'bootsG',   slot: 'feet',")])
# ---- v6.2.1 (宝宝 2026-11-20 00:55): after buying or switching look the shop grid no longer flashes broken-image icons —
# a picture still being drawn keeps the item's last picture (or stays blank), then swaps in when ready
patch('js/ui.js', [
  ("<img alt=\"\" data-th=\"${it.id}\" src=\"${(this.h.thumbCached ? this.h.thumbCached(it) : this.h.thumb(it)) || ''}\">",
   "<img alt=\"\" data-th=\"${it.id}\" src=\"${(() => { const u = this.h.thumbCached ? this.h.thumbCached(it) : this.h.thumb(it); const L = this.__lastTh || (this.__lastTh = {}); if (u) { L[it.id] = u; return u; } return L[it.id] ? L[it.id] + '#old' : 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='; })()}\">"),
  ("pend = [...g.querySelectorAll('img[data-th]')].filter((im) => !im.getAttribute('src'));",
   "pend = [...g.querySelectorAll('img[data-th]')].filter((im) => { const s = im.getAttribute('src') || ''; return !s || s.endsWith('#old') || s.startsWith('data:image/gif'); });"),
  ("try { im.src = this.h.thumb(x) || ''; } catch (_) {}",
   "try { const u = this.h.thumb(x); if (u) { im.src = u; (this.__lastTh || (this.__lastTh = {}))[x.id] = u; } } catch (_) {}"),
])
# ---- v6.2.2 (宝宝 2026-11-20 01:10): the straw hat's brim edge stood up like a halo — lay it flat round the brim
patch('js/models.js', [("    head.add(mesh(tor(6.6, 0.28, 6, 40), '#F5D996', 0, 5.0, 0));",
  "    { const rim = mesh(tor(6.6, 0.28, 6, 40), '#F5D996', 0, 5.0, 0); rim.rotation.x = Math.PI / 2; head.add(rim); }")])
print('apk-patch applied')
