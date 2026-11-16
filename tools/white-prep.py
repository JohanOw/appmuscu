# Variante de gif-prep.py pour une animation sur fond BLANC (ex. elevation-laterale-machine.webp).
# Fond retiré par remplissage depuis les bords : seuls les pixels quasi blancs reliés au bord deviennent
# transparents (les blancs à l'intérieur du personnage sont gardés). Sans scipy : propagation numpy.
# Usage : python tools/white-prep.py <source> <Id_Exercice>   Sortie : img/mascotte/ex/<Id_Exercice>.webp
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageSequence

SIZE = 512
src, ex_id = sys.argv[1], sys.argv[2]
out = Path(__file__).resolve().parent.parent / 'img' / 'mascotte' / 'ex' / f'{ex_id}.webp'


def edge_fill(white):
    """Masque des pixels « white » connectés au bord (4-voisinage), par dilatations successives."""
    m = np.zeros_like(white)
    m[0, :], m[-1, :], m[:, 0], m[:, -1] = white[0, :], white[-1, :], white[:, 0], white[:, -1]
    while True:
        n = m.copy()
        n[1:, :] |= m[:-1, :]; n[:-1, :] |= m[1:, :]; n[:, 1:] |= m[:, :-1]; n[:, :-1] |= m[:, 1:]
        n &= white
        if (n == m).all():
            return m
        m = n


frames, durations = [], []
for fr in ImageSequence.Iterator(Image.open(src)):
    a = np.array(fr.convert('RGB')).astype(float)
    lo = a.min(axis=2)
    bg = edge_fill(lo > 225)
    # Bord adouci : pixels clairs voisins du fond partiellement transparents.
    near = np.zeros_like(bg)
    near[1:, :] |= bg[:-1, :]; near[:-1, :] |= bg[1:, :]; near[:, 1:] |= bg[:, :-1]; near[:, :-1] |= bg[:, 1:]
    alpha = np.where(bg, 0.0, 1.0)
    soft = near & ~bg & (lo > 170)
    alpha[soft] = np.clip((255 - lo[soft]) / 85, 0.3, 1)
    rgba = np.dstack([a, alpha * 255]).astype('uint8')
    frames.append(Image.fromarray(rgba, 'RGBA'))
    durations.append(fr.info.get('duration', 100))

boxes = [f.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox() for f in frames]
boxes = [x for x in boxes if x]
x0, y0 = min(b[0] for b in boxes), min(b[1] for b in boxes)
x1, y1 = max(b[2] for b in boxes), max(b[3] for b in boxes)
side = max(x1 - x0, y1 - y0)
cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
res = []
for f in frames:
    c = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    c.paste(f.crop((cx - side // 2, cy - side // 2, cx - side // 2 + side, cy - side // 2 + side)), (0, 0))
    res.append(c.resize((SIZE, SIZE), Image.LANCZOS))
res[0].save(out, save_all=True, append_images=res[1:], duration=durations, loop=0, quality=82, method=6)
print(out, len(res), 'images')
