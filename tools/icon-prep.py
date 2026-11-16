# Usage (depuis la racine du projet) : python tools/icon-prep.py
# Icônes depuis img/icons/icone yeahbuddy.jfif : recadrage sur le carré noir, coins blancs passés en noir
# (iOS et Android appliquent leur propre arrondi), puis 180 / 192 / 512 px.
import numpy as np
from PIL import Image
im = Image.open('img/icons/icone yeahbuddy.jfif').convert('RGB').resize((1024, 1024), Image.LANCZOS)
a = np.array(im)
lo = a.min(axis=2)
ys, xs = np.where(lo < 200)
a = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1].copy()
white = a.min(axis=2) > 60  # tout ce qui n'est pas noir, relié au bord = coin blanc (et liseré gris)
m = np.zeros_like(white); m[0, :], m[-1, :], m[:, 0], m[:, -1] = white[0, :], white[-1, :], white[:, 0], white[:, -1]
while True:
    n = m.copy(); n[1:] |= m[:-1]; n[:-1] |= m[1:]; n[:, 1:] |= m[:, :-1]; n[:, :-1] |= m[:, 1:]; n &= white
    if (n == m).all(): break
    m = n
a[m] = 0
h, w = a.shape[:2]; s = max(h, w)
c = np.zeros((s, s, 3), 'uint8'); c[(s - h) // 2:(s - h) // 2 + h, (s - w) // 2:(s - w) // 2 + w] = a
src = Image.fromarray(c)
for size in (180, 192, 512):
    src.resize((size, size), Image.LANCZOS).save(f'img/icons/icon-{size}.png', optimize=True)
print('carré', s, 'px avant réduction')
