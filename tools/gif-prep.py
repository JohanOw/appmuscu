# Prépare un personnage animé d'exercice (GIF sur fond vert) pour l'appli :
# fond vert retiré (incrustation), liseré vert neutralisé, recadrage commun à toutes les images,
# carré de 512 px, WebP animé en boucle avec les durées d'origine.
# Usage : python tools/gif-prep.py <source.gif> <Id_Exercice>
# Sortie : img/mascotte/ex/<Id_Exercice>.webp
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageSequence

SIZE = 512
src, ex_id = sys.argv[1], sys.argv[2]
out = Path(__file__).resolve().parent.parent / 'img' / 'mascotte' / 'ex' / f'{ex_id}.webp'
out.parent.mkdir(parents=True, exist_ok=True)

frames, durations = [], []
for fr in ImageSequence.Iterator(Image.open(src)):
    a = np.array(fr.convert('RGB')).astype(float)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    # Écart du vert sur le plus fort des deux autres canaux : grand = fond.
    k = g - np.maximum(r, b)
    alpha = np.clip(1 - (k - 60) / 90, 0, 1)
    # Débordement vert sur les bords : vert ramené au niveau des autres canaux.
    a[..., 1] = np.where((k > 0) & (alpha < 1), np.maximum(r, b), g)
    rgba = np.dstack([a, alpha * 255]).astype('uint8')
    frames.append(Image.fromarray(rgba, 'RGBA'))
    durations.append(fr.info.get('duration', 100))

boxes = [f.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox() for f in frames]
boxes = [x for x in boxes if x]
x0, y0 = min(x[0] for x in boxes), min(x[1] for x in boxes)
x1, y1 = max(x[2] for x in boxes), max(x[3] for x in boxes)
side = max(x1 - x0, y1 - y0) + 12
cx = (x0 + x1) // 2
# Pieds calés en bas du carré : le personnage repose sur le sol du décor.
crop = (cx - side // 2, y1 + 6 - side, cx - side // 2 + side, y1 + 6)
res = [f.crop(crop).resize((SIZE, SIZE), Image.LANCZOS) for f in frames]
res[0].save(out, save_all=True, append_images=res[1:], duration=durations, loop=0, quality=82, method=6)
print(out.name, len(res), 'images', out.stat().st_size // 1024, 'Ko')
