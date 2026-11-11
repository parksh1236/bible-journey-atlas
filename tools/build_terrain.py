"""성경 지도 3D 지형용 높이맵 생성기.

AWS Open Data Terrain Tiles(terrarium 인코딩, Mapzen)에서 동지중해~레반트 영역 타일을
내려받아 등장방형(위경도 격자) 한 장의 PNG로 합칩니다.
출력 PNG: R*256+G = 고도(m)+32768, B = 255면 바다(외해와 연결된 0m 이하 지역).
사용: python3 tools/build_terrain.py   (결과: dist/assets/terrain.png)
"""
import io, math, os, urllib.request
from collections import deque
import numpy as np
from PIL import Image

LON0, LON1, LAT0, LAT1 = 24.0, 42.0, 26.5, 41.5   # 지도 범위 (app3d.js의 BOUNDS와 같아야 함)
W, H = 1080, 900                                  # 출력 격자 크기 (1/60도)
Z = 7
URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
CACHE = os.path.join(os.path.dirname(__file__), '.tile-cache')

def tx(lon): return (lon + 180) / 360 * 2**Z
def ty(lat):
    r = math.radians(lat)
    return (1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * 2**Z

def tile(x, y):
    os.makedirs(CACHE, exist_ok=True)
    p = os.path.join(CACHE, f'{Z}-{x}-{y}.png')
    if not os.path.exists(p):
        with urllib.request.urlopen(URL.format(z=Z, x=x, y=y), timeout=30) as r:
            open(p, 'wb').write(r.read())
    a = np.asarray(Image.open(p).convert('RGB')).astype(np.float64)
    return a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768

x0, x1 = int(tx(LON0)), int(tx(LON1))
y0, y1 = int(ty(LAT1)), int(ty(LAT0))
mosaic = np.zeros(((y1 - y0 + 1) * 256, (x1 - x0 + 1) * 256))
for y in range(y0, y1 + 1):
    for x in range(x0, x1 + 1):
        mosaic[(y - y0) * 256:(y - y0 + 1) * 256, (x - x0) * 256:(x - x0 + 1) * 256] = tile(x, y)

lons = LON0 + (np.arange(W) + .5) / W * (LON1 - LON0)
lats = LAT1 - (np.arange(H) + .5) / H * (LAT1 - LAT0)
px = ((lons + 180) / 360 * 2**Z - x0) * 256
py = (np.array([ty(l) for l in lats]) - y0) * 256
elev = mosaic[np.clip(py.astype(int), 0, mosaic.shape[0] - 1)[:, None], np.clip(px.astype(int), 0, mosaic.shape[1] - 1)[None, :]]

# 외해와 연결된 0m 이하만 바다로 표시 (요단 골짜기 등 저지대는 육지로 남김)
def idx(lon, lat): return (int((LAT1 - lat) / (LAT1 - LAT0) * H), int((lon - LON0) / (LON1 - LON0) * W))
def flood(mask, seeds):
    out = np.zeros_like(mask); q = deque()
    for lon, lat in seeds:
        p = idx(lon, lat)
        if mask[p]: out[p] = True; q.append(p)
    while q:
        r, c = q.popleft()
        for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            rr, cc = r + dr, c + dc
            if 0 <= rr < H and 0 <= cc < W and mask[rr, cc] and not out[rr, cc]:
                out[rr, cc] = True; q.append((rr, cc))
    return out
# 바다 시작점: 지중해·에게해·홍해·수에즈만·아카바만·흑해
sea = flood(elev <= 0, [(30, 34), (25, 38), (35, 27), (32.6, 29.5), (34.75, 28.2), (35, 41.45), (31, 41.45), (39, 41.45), (41, 41.45), (37.5, 41.45)])
# 호수: 사해(수면 약 -430m)와 갈릴리 바다(약 -210m)
lake = flood(elev < -395, [(35.5, 31.5)]) | flood(elev < -207, [(35.59, 32.82)])
water = np.where(sea, 255, np.where(lake, 160, 0)).astype(np.uint8)
print('sea%', sea.mean(), 'lake px', lake.sum())

v = np.clip(np.round(elev) + 32768, 0, 65535).astype(np.uint32)
out = np.dstack([(v >> 8).astype(np.uint8), (v & 255).astype(np.uint8), water])
dst = os.path.join(os.path.dirname(__file__), '..', 'dist', 'assets', 'terrain.png')
Image.fromarray(out, 'RGB').save(dst, optimize=True)
print('saved', dst, out.shape, 'elev', elev.min(), elev.max())
