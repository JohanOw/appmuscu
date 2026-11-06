# Prépare une animation d'exercice pour l'appli :
# fond blanc retiré (seul le blanc relié au bord, pour garder les blancs du corps),
# image ramenée à 360 px, WebP animé en boucle avec les durées d'origine.
# Usage : python tools/anim-prep.py <source.gif|webp> <Id_Exercice>
# Sortie : img/mascotte/anim/<Id_Exercice>.webp
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageSequence

SIZE = 360
src, ex_id = sys.argv[1], sys.argv[2]
out = Path(__file__).resolve().parent.parent / 'img' / 'mascotte' / 'anim' / f'{ex_id}.webp'
out.parent.mkdir(parents=True, exist_ok=True)

im = Image.open(src)
frames, durations = [], []
for fr in ImageSequence.Iterator(im):
    rgb = fr.convert('RGB')
    w, h = rgb.size
    # Masque des pixels presque blancs, puis remplissage depuis le bord : 128 = fond.
    near = rgb.convert('L').point(lambda v: 255 if v >= 236 else 0)
    for x, y in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]:
        if near.getpixel((x, y)) == 255:
            ImageDraw.floodfill(near, (x, y), 128)
    bg = near.point(lambda v: 255 if v == 128 else 0)
    # Bord adouci d'un pixel pour éviter le liseré blanc.
    alpha = Image.eval(bg.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(0.8)), lambda v: 255 - v)
    rgba = rgb.convert('RGBA')
    rgba.putalpha(alpha)
    frames.append(rgba)
    durations.append(fr.info.get('duration', 100))

# Même recadrage pour toutes les images (union des contenus) pour éviter les sauts.
boxes = [f.getbbox() for f in frames if f.getbbox()]
x0, y0 = min(b[0] for b in boxes), min(b[1] for b in boxes)
x1, y1 = max(b[2] for b in boxes), max(b[3] for b in boxes)
side = max(x1 - x0, y1 - y0) + 16
cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
crop = (cx - side // 2, cy - side // 2, cx - side // 2 + side, cy - side // 2 + side)
res = [f.crop(crop).resize((SIZE, SIZE), Image.LANCZOS) for f in frames]
res[0].save(out, save_all=True, append_images=res[1:], duration=durations, loop=0, quality=82, method=6)
print(out, len(res), 'images', out.stat().st_size // 1024, 'Ko')
