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
    ("  return { root, body, legs, arms, torso, head, tool, axe, net, blob, o };\n}",
     "  const __pp = { root, body, legs, arms, torso, head, tool, axe, net, blob, o };\n  if (o.glbSkin) attachPersonModel(__pp, o.glbSkin);\n  return __pp;\n}"),
])
patch('js/render3d.js', [
    ("M.makePerson(this.heroStyle || HERO)", "M.makePerson({ ...(this.heroStyle || HERO), glbSkin: 'hero' })"),
    ("M.makePerson(this.wLook(FISHER))", "M.makePerson({ ...this.wLook(FISHER), glbSkin: 'staff' })"),
    ("M.makePerson(this.wLook(c.lumber ? LUMBERJACK : GARDENER))", "M.makePerson({ ...this.wLook(c.lumber ? LUMBERJACK : GARDENER), glbSkin: 'staff' })"),
    ("const pp = M.makePerson(this.wLook(c.porter ? PORTER : c.cart ? (c.from && this.world.objs[c.from[0]] && this.world.objs[c.from[0]].producer === 'cow' ? MILKER : CARTER) : c.lumber ? LUMBERJACK : c.fisher ? FISHER : GARDENER));",
     "const pp = M.makePerson({ ...this.wLook(c.porter ? PORTER : c.cart ? (c.from && this.world.objs[c.from[0]] && this.world.objs[c.from[0]].producer === 'cow' ? MILKER : CARTER) : c.lumber ? LUMBERJACK : c.fisher ? FISHER : GARDENER), glbSkin: 'staff' });"),
    ("M.makePerson(CASHIER)", "M.makePerson({ ...CASHIER, glbSkin: 'staff' })"),
    ("M.makePerson(CASHIER2)", "M.makePerson({ ...CASHIER2, glbSkin: 'staff' })"),
])
patch('js/home3d.js', [("person = M.makePerson(look);", "person = M.makePerson({ ...look, glbSkin: 'hero' });")])
patch('js/preview3d.js', [("const pp = M.makePerson(personStyle);", "const pp = M.makePerson({ ...personStyle, glbSkin: what.uni !== undefined ? 'staff' : 'hero' });")])
# the farm owner has one look: no boy/girl switch in the shop
patch('js/shop.js', [("export const isBoyCharacter = (id) => String(id || '').startsWith('boy');", "export const isBoyCharacter = (id) => false;")])
patch('js/ui.js', [("    characterSwitch.classList.remove('hidden');", "    characterSwitch.classList.add('hidden');")])
print('apk-patch applied')
