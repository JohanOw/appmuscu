"""Assemble les calques de la carte musculaire AppMuscu v2.3 (a lancer une fois, hors appli).
Entree : dossier produit par tools/muscle-map-prep.ps1 (rendu-0..3.png, zones.png).
Sortie : img/muscles/base.webp (tout blanc), l1/l2/l3.webp (cyan, or, rose, muscles seuls), zones.png.
La zone lombaire (groupe 10) n'est pas coloree dans les images sources : elle est teintee ici
a partir du rendu blanc (multiplication par la couleur du palier).
Usage : python tools/muscle-map-layers.py <dossier_rendus>"""
import sys, os, shutil
from PIL import Image
src = sys.argv[1]
out = os.path.join(os.path.dirname(__file__), '..', 'img', 'muscles')
os.makedirs(out, exist_ok=True)
zones = Image.open(os.path.join(src, 'zones.png')).convert('RGBA')
base = Image.open(os.path.join(src, 'rendu-0.png')).convert('RGBA')
W, H = zones.size
zp = zones.load(); bp = base.load()
TINT = {1: (45, 226, 230), 2: (255, 206, 45), 3: (255, 95, 162)}
for lv in (1, 2, 3):
    im = Image.open(os.path.join(src, f'rendu-{lv}.png')).convert('RGBA')
    p = im.load()
    o = Image.new('RGBA', (W, H)); op = o.load()
    for y in range(H):
        for x in range(W):
            r, g, b, a = zp[x, y]
            if not a: continue
            grp = (r - 8) // 16
            if grp == 10:
                br, bg, bb, ba = bp[x, y]
                L = (0.299 * br + 0.587 * bg + 0.114 * bb) / 255
                k = 0.3 + 0.7 * L
                cr, cg, cb = TINT[lv]
                op[x, y] = (int(cr * k), int(cg * k), int(cb * k), 255)
            else:
                op[x, y] = p[x, y]
    o.save(os.path.join(out, f'l{lv}.webp'), lossless=True, quality=100, method=6)
base.save(os.path.join(out, 'base.webp'), lossless=True, quality=100, method=6)
shutil.copy(os.path.join(src, 'zones.png'), os.path.join(out, 'zones.png'))
for f in sorted(os.listdir(out)):
    print(f, os.path.getsize(os.path.join(out, f)))
