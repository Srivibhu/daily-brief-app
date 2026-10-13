# Derive the night scene from the day art so both share one layout.
import numpy as np
from PIL import Image
day = np.asarray(Image.open('day.png').convert('RGB')).astype(np.float32)
H, W, _ = day.shape
r, g, b = day[..., 0], day[..., 1], day[..., 2]
lum = 0.299 * r + 0.587 * g + 0.114 * b
yy, xx = np.mgrid[0:H, 0:W]

# 1. moonlit base: darken and cool everything
night = day * np.array([0.26, 0.32, 0.48]) + np.array([6, 10, 24])

# 2. sky: bright, low-green-dominance pixels in the upper band (incl. clouds and sun) -> navy gradient + stars
sky = (yy < 215) & (((lum > 168) & ((g - b) < 28)) | ((lum > 150) & ((g - b) < 60) & (r > 200) & (xx > 900) & (yy < 200))) & ~((xx < 330) & (yy < 200) & (lum < 175))
grad = np.stack([np.interp(yy, [0, 215], [10, 26]), np.interp(yy, [0, 215], [14, 34]), np.interp(yy, [0, 215], [34, 64])], -1)
night[sky] = grad[sky]
rng = np.random.default_rng(7)
for _ in range(220):
    x, y = rng.integers(0, W), rng.integers(0, 200)
    if sky[y, x]:
        c = 235 if rng.random() > 0.2 else 180
        night[y, x] = [c, c, c - 15]
        if rng.random() > 0.9:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                if 0 <= x + dx < W and 0 <= y + dy < H and sky[y + dy, x + dx]: night[y + dy, x + dx] = [150, 155, 170]

# 3. moon where the sun was (pixel disc with craters and a soft halo)
mx, my, mr = 1052, 132, 30
d = np.sqrt((xx - mx) ** 2 + (yy - my) ** 2)
halo = sky & (d < mr + 26) & (d >= mr)
night[halo] = night[halo] * 0.7 + np.array([70, 78, 96]) * 0.3
disc = d < mr
night[disc] = [232, 228, 206]
for cx, cy, cr in ((-9, -6, 6), (8, 7, 7), (10, -10, 4), (-6, 12, 4)):
    m = np.sqrt((xx - mx - cx) ** 2 + (yy - my - cy) ** 2) < cr
    night[m & disc] = [205, 200, 176]

# 4. water stays moonlit: pale cyan pixels in the falls and pool get a cool lift
water = (b > 175) & (g > 165) & (b >= r) & (yy > 200)
night[water] = day[water] * np.array([0.42, 0.55, 0.72]) + np.array([8, 14, 30])

# 5. warm light: windows, door, lanterns (warm bright pixels in the day art) glow at night
warm = (r > 190) & (g > 140) & (b < 140) & (r - b > 70) & ~sky
glow = day[warm] * np.array([1.0, 0.86, 0.55])
night[warm] = np.clip(glow + np.array([30, 18, 0]), 0, 255)
# soft spill around lit windows
from PIL import ImageFilter
wm = Image.fromarray((warm * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(9))
spill = np.asarray(wm).astype(np.float32)[..., None] / 255.0
night = night + spill * np.array([70, 48, 12]) * 0.8

# 6. the egg's glass house glows softly
gx0, gy0, gx1, gy1 = 308, 255, 442, 398
house = (xx >= gx0) & (xx <= gx1) & (yy >= gy0) & (yy <= gy1)
eggglow = np.exp(-(((xx - 372) / 60.0) ** 2 + ((yy - 360) / 55.0) ** 2))
night = night + (house * eggglow)[..., None] * np.array([90, 72, 30])
egg = ((xx - 372) / 20.0) ** 2 + ((yy - 363) / 25.0) ** 2 < 1
night[egg] = day[egg] * np.array([0.92, 0.86, 0.66]) + np.array([10, 6, 0])

out = Image.fromarray(np.clip(night, 0, 255).astype(np.uint8))
out.save('night.png'); out.save('night.webp', quality=92)
Image.open('day.png').save('day.webp', quality=92)
print('ok', out.size)
