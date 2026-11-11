// 3D 지형 지도: 실제 고도 데이터(assets/terrain.png) 위에 여정 경로를 입체적으로 그리고,
// 장면이 바뀔 때마다 카메라가 날아가며 이동 경로를 따라 빛나는 점이 움직입니다.
// WebGL을 쓸 수 없으면 아무것도 하지 않고 기존 SVG 지도가 그대로 남습니다.
import * as THREE from './vendor/three.module.min.js';

const BOUNDS = { lon0: 24, lon1: 42, lat0: 26.5, lat1: 41.5 }; // tools/build_terrain.py와 같아야 함
const HM_W = 1080, HM_H = 900;
const K = 10, COS = Math.cos(34 * Math.PI / 180), C_LON = 33, C_LAT = 34;
const EXAG = 1.8 / 1000; // 고도 과장 (1000m → 2.1 단위)
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const PAPER = new THREE.Color('#ebe8dc');
const GOLD = new THREE.Color('#c08a52');

const wrap = document.querySelector('.map-wrap');
const svgMap = document.getElementById('map');

function webglOK() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

const world = (lon, lat) => [(lon - C_LON) * K * COS, -(lat - C_LAT) * K];
const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

async function loadHeightmap() {
  const img = new Image();
  // decode()는 숨겨진 탭에서 늦게 끝날 수 있어 onload를 사용
  await new Promise((ok, fail) => { img.onload = ok; img.onerror = fail; img.src = 'assets/terrain.png'; });
  const c = document.createElement('canvas'); c.width = HM_W; c.height = HM_H;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, HM_W, HM_H).data;
  const elev = new Float32Array(HM_W * HM_H), water = new Uint8Array(HM_W * HM_H);
  for (let i = 0; i < HM_W * HM_H; i++) { elev[i] = d[i * 4] * 256 + d[i * 4 + 1] - 32768; water[i] = d[i * 4 + 2]; }
  return { elev, water };
}

// 고도(m) → 3D 높이. 바다는 수면(0) 아래로 깊이를 눌러서 투명한 물 아래 비치게 함
function heightOf(e, w) {
  if (w === 255) return -0.12 - Math.min(-Math.min(e, 0), 2500) / 2500 * 1.5;
  if (w === 160) return Math.max(e, -430) * EXAG * 0.6;
  // 1000m 이상은 완만하게 눌러 높은 산맥(타우루스 등)이 뾰족하게 솟지 않도록
  return (e < 0 ? e * 0.6 : e < 900 ? e : 900 + (e - 900) * .5) * EXAG;
}

function init(hm) {
  const { elev, water } = hm;
  const sample = (lon, lat) => {
    const fx = (lon - BOUNDS.lon0) / (BOUNDS.lon1 - BOUNDS.lon0) * HM_W - .5;
    const fy = (BOUNDS.lat1 - lat) / (BOUNDS.lat1 - BOUNDS.lat0) * HM_H - .5;
    const x = Math.max(0, Math.min(HM_W - 2, Math.floor(fx))), y = Math.max(0, Math.min(HM_H - 2, Math.floor(fy)));
    const tx = Math.min(1, Math.max(0, fx - x)), ty = Math.min(1, Math.max(0, fy - y));
    const h = (i) => heightOf(elev[i], water[i]);
    const i = y * HM_W + x;
    return (h(i) * (1 - tx) + h(i + 1) * tx) * (1 - ty) + (h(i + HM_W) * (1 - tx) + h(i + HM_W + 1) * tx) * ty;
  };
  const groundAt = (lon, lat) => Math.max(sample(lon, lat), 0.02);

  // ── 렌더러 / 장면 ─────────────────────────────────────
  const host = document.createElement('div'); host.className = 'map3d';
  const canvas = document.createElement('canvas'); canvas.setAttribute('aria-hidden', 'true');
  const overlay = document.createElement('div'); overlay.className = 'm3-overlay';
  const regions = document.createElement('div'); regions.className = 'm3-regions'; regions.setAttribute('aria-hidden', 'true');
  const pins = document.createElement('div'); pins.className = 'm3-pins'; pins.setAttribute('role', 'group'); pins.setAttribute('aria-label', '여정 장소 선택');
  const caption = document.createElement('div'); caption.className = 'm3-caption'; caption.setAttribute('aria-hidden', 'true');
  const hint = document.createElement('div'); hint.className = 'm3-hint'; hint.textContent = '드래그로 회전 · ⌘/Ctrl + 스크롤로 확대 · Shift + 드래그로 이동';
  overlay.append(regions, pins, caption, hint);
  host.append(canvas, overlay);
  svgMap.after(host);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  scene.background = PAPER.clone();
  scene.fog = new THREE.Fog(PAPER, 60, 200);
  const camera = new THREE.PerspectiveCamera(34, 16 / 9, .5, 900);

  scene.add(new THREE.HemisphereLight('#fff6e4', '#7d8a70', 1.35));
  const sun = new THREE.DirectionalLight('#fff1d6', 2.3); sun.position.set(-60, 70, -40); scene.add(sun);

  // ── 지형 메시 ─────────────────────────────────────────
  const W = (BOUNDS.lon1 - BOUNDS.lon0) * K * COS, D = (BOUNDS.lat1 - BOUNDS.lat0) * K;
  const SX = 539, SY = 449;
  const geo = new THREE.PlaneGeometry(W, D, SX, SY); geo.rotateX(-Math.PI / 2);
  const offX = world((BOUNDS.lon0 + BOUNDS.lon1) / 2, 0)[0], offZ = world(0, (BOUNDS.lat0 + BOUNDS.lat1) / 2)[1];
  geo.translate(offX, 0, offZ);
  const pos = geo.attributes.position, colors = new Float32Array(pos.count * 3);
  const cSage = new THREE.Color('#bfcb9c'), cGreen = new THREE.Color('#a9bd83'), cSand = new THREE.Color('#e6d4a6'),
    cBrown = new THREE.Color('#b8a27c'), cRock = new THREE.Color('#9a8a70'), cSnow = new THREE.Color('#f3efe4'),
    cShelf = new THREE.Color('#a8c2bd'), cDeep = new THREE.Color('#6d8e93'), cLake = new THREE.Color('#86b1b6');
  const col = new THREE.Color(), tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const cx = i % (SX + 1), cy = Math.floor(i / (SX + 1));
    const px = Math.round(cx / SX * (HM_W - 1)), py = Math.round(cy / SY * (HM_H - 1));
    const k = py * HM_W + px, e = elev[k], w = water[k];
    pos.setY(i, heightOf(e, w));
    const lon = BOUNDS.lon0 + px / HM_W * (BOUNDS.lon1 - BOUNDS.lon0), lat = BOUNDS.lat1 - py / HM_H * (BOUNDS.lat1 - BOUNDS.lat0);
    if (w === 255) { col.copy(cShelf).lerp(cDeep, smooth(0, 1800, -e)); }
    else if (w === 160) col.copy(cLake);
    else {
      // 건조도: 남쪽(애굽·시내·네게브)과 동쪽 사막은 모래색, 지중해 연안 북쪽은 초록빛
      let arid = Math.max(smooth(33.2, 30.6, lat), smooth(36.6, 38.6, lon) * smooth(36.8, 33.5, lat));
      // 나일 삼각주·골짜기: 낮은 땅일수록 초록 (경계는 부드럽게)
      const delta = smooth(45, 8, e) * smooth(29.6, 30.2, lon) * smooth(32.5, 32.1, lon) * smooth(29.9, 30.3, lat);
      const valley = smooth(140, 60, e) * smooth(.45, .15, Math.abs(lon - 31.1 + (30 - lat) * .05)) * smooth(30.3, 30, lat);
      const nile = Math.max(delta, valley);
      arid *= 1 - nile;
      col.copy(cSage).lerp(cGreen, nile).lerp(cSand, arid);
      col.lerp(tmp.copy(cBrown), smooth(250, 1300, e) * .75);
      col.lerp(cRock, smooth(1300, 2500, e) * .8);
      col.lerp(cSnow, smooth(2600, 3300, e));
      const n = (Math.sin(px * 12.9898 + py * 78.233) * 43758.5453) % 1; // 미세한 질감 노이즈
      col.offsetHSL(0, 0, (n - .5) * .025);
    }
    colors.set([col.r, col.g, col.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .93, metalness: 0 }));
  scene.add(terrain);

  // ── 물 표면 (셰이더: 잔물결 + 해안선 하이라이트) ──────────
  const maskData = new Uint8Array(HM_W * HM_H * 4);
  for (let i = 0; i < HM_W * HM_H; i++) {
    maskData[i * 4] = water[i] === 255 ? 255 : 0;
    maskData[i * 4 + 1] = Math.min(255, Math.max(0, -elev[i] / 12));
    maskData[i * 4 + 3] = 255;
  }
  const maskTex = new THREE.DataTexture(maskData, HM_W, HM_H, THREE.RGBAFormat);
  maskTex.magFilter = maskTex.minFilter = THREE.LinearFilter; maskTex.needsUpdate = true;
  const waterMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uMask: { value: maskTex }, uTime: { value: 0 }, uFog: { value: PAPER }, uNear: { value: 60 }, uFar: { value: 200 } },
    vertexShader: `varying vec2 vUv; varying float vDist; varying vec3 vW;
      void main(){ vUv=uv; vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vec4 mv=viewMatrix*w; vDist=-mv.z; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform sampler2D uMask; uniform float uTime; uniform vec3 uFog; uniform float uNear; uniform float uFar;
      varying vec2 vUv; varying float vDist; varying vec3 vW;
      void main(){
        vec4 m=texture2D(uMask,vec2(vUv.x,1.-vUv.y)); if(m.r<.5) discard;
        float depth=m.g;
        vec3 shallow=vec3(.80,.89,.86), deep=vec3(.55,.70,.72);
        vec3 c=mix(shallow,deep,smoothstep(0.,.6,depth));
        float rip=sin(vW.x*1.7+uTime*.9)*sin(vW.z*1.3-uTime*.7)+sin((vW.x+vW.z)*.6+uTime*.5);
        c+=rip*.018;
        float shore=1.-smoothstep(.5,.62,m.r);
        c=mix(c,vec3(.97,.96,.9),shore*.85);
        float a=mix(.62,.86,smoothstep(0.,.5,depth));
        c=mix(c,uFog,smoothstep(uNear,uFar,vDist));
        gl_FragColor=vec4(c,a);
      }`
  });
  const waterGeo = new THREE.PlaneGeometry(W, D, 1, 1); waterGeo.rotateX(-Math.PI / 2); waterGeo.translate(offX, 0, offZ);
  const waterMesh = new THREE.Mesh(waterGeo, waterMat); waterMesh.renderOrder = 1; scene.add(waterMesh);

  // ── 공용 텍스처: 빛 번짐(글로우) ───────────────────────
  const glowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, 'rgba(255,240,205,1)'); r.addColorStop(.25, 'rgba(240,190,120,.7)'); r.addColorStop(1, 'rgba(220,150,80,0)');
    g.fillStyle = r; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();

  // 선택된 장소의 빛기둥 + 퍼지는 고리
  const beamMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 } },
    vertexShader: `varying float vY; void main(){ vY=uv.y; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `varying float vY; uniform float uTime; uniform float uOpacity;
      void main(){ float a=(1.-vY)*(1.-vY)*.4; a*=.8+.2*sin(uTime*3.+vY*12.); gl_FragColor=vec4(1.,.78,.48,a*uOpacity); }`
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(.1, .32, 7, 24, 1, true), beamMat);
  beam.geometry.translate(0, 3.5, 0); scene.add(beam);
  const ringMat = new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const rings = [0, 1].map(() => { const r = new THREE.Mesh(new THREE.RingGeometry(.9, 1.05, 48), ringMat.clone()); r.rotation.x = -Math.PI / 2; scene.add(r); return r; });

  // 이동하는 빛(여행자) + 꼬리
  const traveler = new THREE.Group();
  const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  head.scale.set(2.6, 2.6, 1); traveler.add(head);
  const core = new THREE.Mesh(new THREE.SphereGeometry(.2, 16, 12), new THREE.MeshBasicMaterial({ color: '#fff3dc' }));
  traveler.add(core); scene.add(traveler);
  const trail = Array.from({ length: 14 }, (_, i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .55 * (1 - i / 14) }));
    const sc = 1.6 * (1 - i / 16); s.scale.set(sc, sc, 1); scene.add(s); return s;
  });

  // ── 지역 이름 ─────────────────────────────────────────
  const regionDefs = [[31.6, 33.4, '지 중 해', 'sea big'], [30.3, 28.9, '애 굽', ''], [33.9, 29.2, '시 내 반 도', ''], [35.85, 30.9, '가 나 안', ''],
    [37.6, 34.6, '아 람', ''], [33.2, 38.9, '소 아 시 아', ''], [40.4, 36.4, '메 소 포 타 미 아', ''], [38.6, 29.4, '아 라 비 아', ''],
    [33.6, 35.05, '구브로', 'small'], [35.55, 31.42, '사해', 'small sea'], [35.75, 32.78, '갈릴리 바다', 'small sea'], [35.2, 27.6, '홍 해', 'sea'], [26, 38.6, '에 게 해', 'sea']];
  const regionEls = regionDefs.map(([lon, lat, t, cls]) => {
    const e = document.createElement('span'); e.className = 'm3-region ' + cls; e.textContent = t; regions.append(e);
    const [x, z] = world(lon, lat); return { e, v: new THREE.Vector3(x, Math.max(groundAt(lon, lat), 0) + .3, z) };
  });

  // ── 카메라 조작 ───────────────────────────────────────
  const cam = { target: new THREE.Vector3(10, 0, 10), dist: 120, theta: 0.18, phi: 0.92 };
  let tween = null;
  function applyCam() {
    const { target, dist, theta, phi } = cam;
    camera.position.set(target.x + dist * Math.sin(phi) * Math.sin(theta), target.y + dist * Math.cos(phi), target.z + dist * Math.sin(phi) * Math.cos(theta));
    camera.lookAt(target);
    scene.fog.near = dist * .9; scene.fog.far = dist * 3.2;
    waterMat.uniforms.uNear.value = scene.fog.near; waterMat.uniforms.uFar.value = scene.fog.far;
  }
  function flyTo(to, dur = 1800) {
    const from = { target: cam.target.clone(), dist: cam.dist, theta: cam.theta, phi: cam.phi };
    if (reduced) dur = 0;
    tween = { from, to: { target: to.target ?? from.target, dist: to.dist ?? from.dist, theta: to.theta ?? from.theta, phi: to.phi ?? from.phi, arc: to.arc ?? 0 }, t0: performance.now(), dur };
  }
  function stepTween(now) {
    if (!tween) return;
    const t = tween.dur ? Math.min(1, (now - tween.t0) / tween.dur) : 1, k = easeInOut(t), { from, to } = tween;
    cam.target.lerpVectors(from.target, to.target, k);
    cam.dist = from.dist + (to.dist - from.dist) * k + Math.sin(Math.PI * t) * to.arc; // 멀리 이동할 땐 살짝 떠올랐다 내려옴
    cam.theta = from.theta + (to.theta - from.theta) * k;
    cam.phi = from.phi + (to.phi - from.phi) * k;
    if (t >= 1) tween = null;
  }

  let drag = null; const touches = new Map(); let pinch = null;
  canvas.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch') { touches.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (touches.size === 2) pinch = null; }
    drag = { x: e.clientX, y: e.clientY, pan: e.shiftKey || e.button === 2, id: e.pointerId };
    canvas.setPointerCapture(e.pointerId); tween = null; host.classList.add('dragging'); idleSince = performance.now();
  });
  canvas.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch' && touches.has(e.pointerId)) {
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size >= 2) {
        const [a, b] = [...touches.values()], d = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
        if (pinch) { cam.dist = THREE.MathUtils.clamp(cam.dist * pinch.d / d, 8, 220); cam.theta -= ang - pinch.ang; }
        pinch = { d, ang }; return;
      }
    }
    if (!drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
    if (drag.pan) {
      const s = cam.dist / canvas.clientHeight * 1.1, c = Math.cos(cam.theta), si = Math.sin(cam.theta);
      cam.target.x -= (dx * c + dy * si) * s; cam.target.z -= (-dx * si + dy * c) * s;
    } else {
      cam.theta -= dx * .006; cam.phi = THREE.MathUtils.clamp(cam.phi - dy * .005, .25, 1.32);
    }
  });
  const endDrag = e => { touches.delete(e.pointerId); pinch = null; if (drag && drag.id === e.pointerId) drag = null; host.classList.remove('dragging'); };
  canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  let hintTimer;
  canvas.addEventListener('wheel', e => {
    if (!(e.ctrlKey || e.metaKey)) { hint.classList.add('show'); clearTimeout(hintTimer); hintTimer = setTimeout(() => hint.classList.remove('show'), 1600); return; }
    e.preventDefault(); tween = null; cam.dist = THREE.MathUtils.clamp(cam.dist * Math.exp(e.deltaY * .0025), 8, 220);
  }, { passive: false });

  // ── 여정 데이터 반영 ──────────────────────────────────
  let routeKey = '', curve = null, stopU = [], stops3 = [], routeTube = null, routeLine = null, pinEls = [], stems = [];
  let curU = 0, travel = null, activeIdx = 0, overview = null, zoom = 1, onChoose = () => {}, lastStep = -1, lastPerson = -1;
  const TUBE_N = 900, RADIAL = 6;
  const tubeMat = new THREE.MeshStandardMaterial({ color: GOLD, emissive: '#b8743a', emissiveIntensity: .55, roughness: .4, transparent: true });
  const lineMat = new THREE.LineDashedMaterial({ color: '#a8743f', dashSize: .6, gapSize: .5, transparent: true, opacity: .55 });
  const stemMat = new THREE.MeshBasicMaterial({ color: '#5b6b55', transparent: true, opacity: .55 });

  function buildRoute(j) {
    [routeTube, routeLine, ...stems].forEach(o => { if (o) { scene.remove(o); o.geometry.dispose(); } });
    stops3 = j.stops.map((s, i) => {
      const dup = j.stops.slice(0, i).filter(a => a[1] === s[1] && a[2] === s[2]).length;
      const [x, z] = world(s[1], s[2]); return { v: new THREE.Vector3(x, groundAt(s[1], s[2]), z), dup };
    });
    curve = new THREE.CurvePath();
    for (let i = 1; i < stops3.length; i++) {
      const a = stops3[i - 1].v.clone().add(new THREE.Vector3(0, .25, 0)), b = stops3[i].v.clone().add(new THREE.Vector3(0, .25, 0));
      const len = a.distanceTo(b), mid = a.clone().lerp(b, .5);
      if (len < .05) { mid.x += 1.2; mid.z -= .6; } // 같은 장소 재방문: 작은 고리
      mid.y = Math.max(a.y, b.y) + .6 + Math.min(len, 60) * .16;
      curve.add(new THREE.QuadraticBezierCurve3(a, mid, b));
    }
    const lens = curve.getCurveLengths(), total = lens[lens.length - 1] || 1;
    stopU = stops3.map((_, i) => i === 0 ? 0 : lens[i - 1] / total);
    routeTube = new THREE.Mesh(new THREE.TubeGeometry(curve, TUBE_N, .13, RADIAL, false), tubeMat); routeTube.renderOrder = 2;
    const pts = curve.getSpacedPoints(TUBE_N);
    routeLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat); routeLine.computeLineDistances();
    scene.add(routeLine, routeTube);
    stems = stops3.map(({ v }) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, 1.1, 6), stemMat); m.position.set(v.x, v.y + .55, v.z); scene.add(m); return m;
    });
    pins.replaceChildren();
    pinEls = j.stops.map((s, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'm3-pin';
      b.innerHTML = `<span class="n">${i + 1}</span>${stops3[i].dup ? '' : `<span class="lbl">${s[0]}</span>`}`;
      b.setAttribute('aria-label', `${i + 1}. ${s[0]}: ${s[3]}`);
      b.onclick = () => { if (!b.classList.contains('dim')) onChoose(i); };
      pins.append(b); return b;
    });
    // 여정 전체가 들어오는 시점
    const box = new THREE.Box3(); stops3.forEach(s => box.expandByPoint(s.v));
    const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
    overview = { target: new THREE.Vector3(center.x, 0, center.z + size.z * .06), dist: Math.max(size.x * 1.25, size.z * 1.5, 22) + 18 };
  }
  const setTubeU = u => routeTube.geometry.setDrawRange(0, Math.floor(THREE.MathUtils.clamp(u, 0, 1) * TUBE_N) * RADIAL * 6);

  function focusDist(i) {
    const prev = stops3[Math.max(0, i - 1)].v, len = prev.distanceTo(stops3[i].v);
    return THREE.MathUtils.clamp(len * 1.1 + 30, 34, Math.max(overview.dist, 40)) / zoom;
  }
  function focus(i, dur, arc = 0) {
    const v = stops3[i].v, prev = stops3[Math.max(0, i - 1)].v;
    const target = new THREE.Vector3().copy(v).lerp(prev, .22); target.y = v.y * .5;
    flyTo({ target, dist: focusDist(i), theta: cam.theta + (reduced ? 0 : .06), phi: .9, arc }, dur);
  }

  function showCaption(j, i) {
    const s = j.stops[i];
    let km = 0; for (let k = 1; k <= i; k++) km += gc(j.stops[k - 1], j.stops[k]);
    caption.innerHTML = `<span class="c-num">${String(i + 1).padStart(2, '0')}</span><span class="c-body"><small>${s[0]} · ${s[5]}</small><b>${s[3]}</b><em>누적 연결선 <i data-km="${Math.round(km)}">0</i> km</em></span>`;
    caption.classList.remove('in'); void caption.offsetWidth; caption.classList.add('in');
    const el = caption.querySelector('[data-km]'), target = +el.dataset.km, t0 = performance.now(), from = +(caption.dataset.km || 0);
    caption.dataset.km = target;
    const tick = now => { const t = reduced ? 1 : Math.min(1, (now - t0) / 1400); el.textContent = Math.round(from + (target - from) * easeInOut(t)).toLocaleString('ko-KR'); if (t < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }
  const gc = (a, b) => { const r = Math.PI / 180, dlat = (b[2] - a[2]) * r, dlon = (b[1] - a[1]) * r; const h = Math.sin(dlat / 2) ** 2 + Math.cos(a[2] * r) * Math.cos(b[2] * r) * Math.sin(dlon / 2) ** 2; return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)); };

  function render({ j, vis, step, person, dim, choose }) {
    onChoose = choose;
    const key = j.id;
    const visSet = new Set(vis.map(v => v.i));
    const changed = key !== routeKey || step !== lastStep;
    if (key !== routeKey) {
      routeKey = key; buildRoute(j); curU = 0; travel = null; zoom = 1; setTubeU(0);
      // 인물 전환: 전체 여정을 위에서 보여 준 뒤 첫 장면으로 내려감
      cam.target.copy(overview.target); cam.dist = overview.dist * 1.35; cam.phi = .62; cam.theta = .12;
      flyTo({ ...overview, phi: .82, theta: .2 }, 1600);
      setTimeout(() => { if (routeKey === key && activeIdx === step) { travelTo(step); focus(step, 1900); } }, reduced ? 0 : 1500);
      lastPerson = person;
    } else if (step !== lastStep) {
      const far = Math.abs(stopU[step] - curU) > .25;
      travelTo(step); focus(step, far ? 2300 : 1800, far ? overview.dist * .25 : 0);
    }
    if (changed) showCaption(j, step);
    lastStep = step; activeIdx = step;
    pinEls.forEach((b, i) => {
      b.classList.toggle('active', i === step); b.classList.toggle('dim', !visSet.has(i));
      b.setAttribute('aria-pressed', i === step); b.tabIndex = visSet.has(i) ? 0 : -1;
    });
    tubeMat.opacity = dim ? .45 : 1; lineMat.opacity = dim ? .25 : .55;
  }
  function travelTo(i) {
    const to = stopU[i];
    if (reduced) { curU = to; setTubeU(to); travel = null; return; }
    travel = { from: curU, to, t0: performance.now(), dur: THREE.MathUtils.clamp(Math.abs(to - curU) * 5200, 700, 2200) };
  }

  // ── 매 프레임 ─────────────────────────────────────────
  const v3 = new THREE.Vector3();
  let running = false, inView = true, idleSince = performance.now(), beamOn = 0;
  function project(v, el, extraY = 0, offsetX = 0) {
    v3.set(v.x, v.y + extraY, v.z).project(camera);
    const hidden = v3.z > 1 || Math.abs(v3.x) > 1.15 || Math.abs(v3.y) > 1.15;
    el.style.transform = `translate(${((v3.x + 1) / 2 * canvas.clientWidth + offsetX).toFixed(1)}px, ${((1 - v3.y) / 2 * canvas.clientHeight).toFixed(1)}px)`;
    el.style.visibility = hidden ? 'hidden' : '';
    return v3.z;
  }
  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    const t = now / 1000;
    stepTween(now);
    // 아무 조작이 없으면 아주 천천히 회전 (살아 있는 지도 느낌)
    if (!reduced && !drag && !tween && now - idleSince > 6000) cam.theta += .00035;
    applyCam();
    if (travel) {
      const k = Math.min(1, (now - travel.t0) / travel.dur); curU = travel.from + (travel.to - travel.from) * easeInOut(k);
      if (k >= 1) travel = null;
    }
    if (curve) {
      setTubeU(curU);
      const p = curve.getPoint(Math.min(.9999, Math.max(0, curU)));
      traveler.position.copy(p);
      const moving = !!travel;
      head.material.opacity = moving ? 1 : .55 + .2 * Math.sin(t * 2.4);
      trail.forEach((s, i) => {
        const dir = travel ? Math.sign(travel.to - travel.from) || 1 : 1;
        s.position.copy(curve.getPoint(THREE.MathUtils.clamp(curU - dir * (i + 1) * .0045, 0, .9999)));
        s.visible = moving;
      });
      const a = stops3[activeIdx];
      if (a) {
        beamOn += ((travel ? 0 : 1) - beamOn) * .06;
        beam.position.copy(a.v); beamMat.uniforms.uOpacity.value = beamOn; beamMat.uniforms.uTime.value = t;
        rings.forEach((r, i) => {
          const ph = ((t * .55 + i * .5) % 1);
          r.position.set(a.v.x, a.v.y + .06, a.v.z); r.scale.setScalar(.4 + ph * 2.6); r.material.opacity = (1 - ph) * .8 * beamOn;
        });
      }
      // 화면에서 가까이 겹치는 라벨은 숨김 (선택된 장소 라벨이 우선)
      const placed = [];
      const order = pinEls.map((b, i) => i).sort((x, y) => (y === activeIdx) - (x === activeIdx));
      order.forEach(i => {
        const b = pinEls[i], z = project(stops3[i].v, b, 1.1, stops3[i].dup * 26);
        b.style.zIndex = i === activeIdx ? 999 : Math.round((1 - z) * 500);
        const sx = (v3.x + 1) / 2 * canvas.clientWidth + stops3[i].dup * 26, sy = (1 - v3.y) / 2 * canvas.clientHeight;
        const clash = placed.some(p => Math.abs(p[0] - sx) < 70 && Math.abs(p[1] - sy) < 15);
        b.classList.toggle('nolabel', clash && i !== activeIdx);
        if (!clash && !b.classList.contains('dim')) placed.push([sx, sy]);
      });
    }
    waterMat.uniforms.uTime.value = t;
    regionEls.forEach(r => { project(r.v, r.e); });
    renderer.render(scene, camera);
  }
  function setRunning(v) { if (v === running) return; running = v; if (v) requestAnimationFrame(frame); }
  new IntersectionObserver(es => { inView = es[0].isIntersecting; setRunning(inView && !document.hidden); }, { rootMargin: '100px' }).observe(host);
  document.addEventListener('visibilitychange', () => setRunning(inView && !document.hidden));

  function resize() {
    const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(host); resize();
  applyCam(); setRunning(true);

  wrap.classList.add('is-3d');
  host.classList.add('ready');

  return {
    render, _cam: cam,
    zoom(f) { zoom = THREE.MathUtils.clamp(zoom * f, .4, 3); flyTo({ dist: THREE.MathUtils.clamp(cam.dist / f, 8, 220) }, 500); idleSince = performance.now(); },
    reset() { zoom = 1; if (overview) flyTo({ ...overview, phi: .82, theta: .2 }, 1400); idleSince = performance.now(); },
  };
}

if (wrap && svgMap && webglOK()) {
  loadHeightmap().then(hm => {
    window.Map3D = init(hm);
    window.dispatchEvent(new Event('map3d-ready'));
  }).catch(err => { console.warn('3D 지도를 불러오지 못해 평면 지도를 사용합니다.', err); });
}
