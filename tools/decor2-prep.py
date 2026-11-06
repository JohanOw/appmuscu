# Prépare le décor 2 (salle avec baie vitrée) : image de fond + calque des tubes néon,
# animé par la même pulsation CSS que le décor 1.
# Usage : python tools/decor2-prep.py "bank/mascotte/exercices/decors 2.png"
# Sortie : img/mascotte/ex-decor2.webp et img/mascotte/ex-neon2.webp
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

root = Path(__file__).resolve().parent.parent / 'img' / 'mascotte'
im = Image.open(sys.argv[1]).convert('RGB')
hsv = np.array(im.convert('HSV')).astype(int)
H, S, V = hsv[..., 0] * 360 // 255, hsv[..., 1], hsv[..., 2]
yy, xx = np.mgrid[:V.shape[0], :V.shape[1]]
cyan = (H > 160) & (H < 210) & (((S > 90) & (V > 200)) | ((yy < 170) & (S > 60) & (V > 160)))
pink = (H > 285) & (H < 345) & (S > 60) & (V > 210)
m = cyan | pink
m &= ~((xx > 258) & (xx < 815) & (yy > 95) & (yy < 445))  # ciel derrière la vitre
tubes = ~(xx > 860) & ~(yy > 200) | ((yy <= 460) & ((abs(xx - 245) < 10) | (abs(xx - 830) < 10)))
m &= tubes
alpha = Image.fromarray((m * 255).astype('uint8')).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(0.7))
neon = im.convert('RGBA')
neon.putalpha(alpha)
im.save(root / 'ex-decor2.webp', quality=80, method=6)
neon.save(root / 'ex-neon2.webp', quality=85, method=6)
print('ok', round(m.mean() * 100, 2), '% de pixels néon')
