# Rebuild the art on a true 3px grid: outline-preserving downsample, limited palette, then moss on
# the cliff walls beside the main falls, drawn pixel by pixel at the low resolution.
# usage: python3 pixelize.py in.png out.png [--moss] [--colors N]
import sys
import numpy as np
from PIL import Image

S = 3
src, dst = sys.argv[1], sys.argv[2]
moss = '--moss' in sys.argv
ncol = int(sys.argv[sys.argv.index('--colors') + 1]) if '--colors' in sys.argv else 96

im = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
H, W, _ = im.shape
h, w = (H + S - 1) // S, (W + S - 1) // S
pad = np.pad(im, ((0, h * S - H), (0, w * S - W), (0, 0)), mode='edge')
blocks = pad.reshape(h, S, w, S, 3).transpose(0, 2, 1, 3, 4).reshape(h, w, S * S, 3)
lum = blocks @ np.array([0.299, 0.587, 0.114])
mean = blocks.mean(2)
dark = lum < 72
ndark = dark.sum(2)
darkest = np.take_along_axis(blocks, lum.argmin(2)[..., None, None], 2)[:, :, 0]
low = np.where((ndark >= 3)[..., None], darkest, mean)  # keep the ink outlines

img = Image.fromarray(np.clip(low, 0, 255).astype(np.uint8))
q = np.asarray(img.quantize(colors=ncol, method=Image.Quantize.MEDIANCUT, kmeans=4, dither=Image.Dither.NONE).convert('RGB')).astype(np.int32)

if moss:
    rng = np.random.default_rng(11)
    r, g, b = q[..., 0], q[..., 1], q[..., 2]
    yy, xx = np.mgrid[0:h, 0:w]
    rock = (np.abs(r - 172) < 34) & (np.abs(g - 178) < 32) & (np.abs(b - 134) < 38) & (g >= r - 6)
    zone = (xx >= 140) & (xx <= 372) & (yy >= 80) & (yy <= 214) & ~((xx >= 214) & (xx <= 281))
    rock &= zone
    m = np.zeros((h, w), bool)
    # 1. drips under the mossy lip: first rock pixel in each column, hang down a few pixels
    for x in range(140, 373):
        col = np.nonzero(rock[:, x])[0]
        if not len(col): continue
        top = col[0]
        near = max(0, 1 - min(abs(x - 214), abs(x - 281)) / 60)  # longer near the falls (spray keeps it wet)
        n = int(rng.integers(1, 4) + (rng.random() < 0.25) * rng.integers(3, 9) + near * rng.integers(2, 14))
        m[top:top + n, x] |= rock[top:top + n, x]
    # 2. long strands along both edges of the main fall
    for x0, x1 in ((200, 214), (282, 296)):
        for x in range(x0, x1):
            if rng.random() < 0.55:
                col = np.nonzero(rock[:, x])[0]
                if not len(col): continue
                top = col[0]; n = int(rng.integers(12, 70))
                m[top:top + n, x] |= rock[top:top + n, x]
    # 3. organic patches from smooth noise: thick by the falls and under the lip, thinning out
    def noise(cell):
        gy, gx = h // cell + 2, w // cell + 2
        n = Image.fromarray((rng.random((gy, gx)) * 255).astype(np.uint8)).resize((gx * cell, gy * cell), Image.BICUBIC)
        return np.asarray(n).astype(np.float32)[:h, :w] / 255
    nz = noise(9) * 0.65 + noise(4) * 0.35
    d = np.minimum(np.abs(xx - 214), np.abs(xx - 281))
    wet = np.clip(1 - d / 55, 0, 1)
    tops = np.full(w, 999)
    for x in range(w):
        col = np.nonzero(rock[:, x])[0]
        if len(col): tops[x] = col[0]
    lip = np.clip(1 - (yy - tops[None, :]) / 40, 0, 1)
    want = 0.5 * wet + 0.4 * lip + 0.1 * wet * (yy > 150)
    m |= rock & (nz < want * 0.85)
    # 4. a few ivy vines hanging from the lip on the far faces
    for _ in range(14):
        x = int(rng.integers(145, 370))
        if abs(x - 214) < 8 or abs(x - 281) < 8 or tops[x] > 250: continue
        y = tops[x]; n = int(rng.integers(15, 45))
        for k in range(n):
            xs = x + int(round(np.sin(k / 6) * 1.2))
            if 0 <= y + k < h and rock[y + k, xs]: m[y + k, xs] = True
    # shade: light on top edge, dark underneath, mid inside, a few flecks
    up = np.roll(m, 1, 0); down = np.roll(m, -1, 0)
    MID, LIGHT, DARK, DEEP = (95, 138, 58), (134, 176, 74), (63, 98, 36), (38, 64, 24)
    q[m] = MID
    q[m & ~up] = LIGHT
    q[m & ~down] = DARK
    under = np.roll(m, 1, 0) & ~m & rock  # shadow line on the rock right below moss
    q[under] = DEEP
    fleck = m & (rng.random((h, w)) < 0.08)
    q[fleck] = LIGHT

out = np.repeat(np.repeat(q, S, 0), S, 1)[:H, :W]
Image.fromarray(out.astype(np.uint8)).save(dst)
print('ok', dst, (w, h))
