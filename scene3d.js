// 3D 장면 렌더러 + 1-bit 디더 셰이더.
// events.js의 장면 데이터(layers/fx)를 그대로 읽어 3D 물체로 바꿉니다.
//  - 2D의 x(가로 위치)와 depth(가까움)를 3D 거리·좌우 위치로 옮겨, 원래 구도를 유지합니다.
//  - 실제 조명과 그림자로 음영을 만든 뒤, 셰이더에서 밝기 → 8×8 Bayer 점 패턴, 깊이 경계 → 윤곽선으로 바꿉니다.
import * as THREE from './vendor/three.module.min.js';

const W = 960, H = 540, FOV = 36;
const INK = new THREE.Color('#16161a'), PAPER = new THREE.Color('#e9e6d6');
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const ramp = (p, r) => r == null ? 1 : ease(clamp((p - r[0]) / Math.max(1e-4, r[1] - r[0])));
function val(v, p, d = 0) { if (v == null) return d; if (typeof v === 'number') return v; if (Array.isArray(v)) return ramp(p, v); return (v.from ?? 0) + ((v.to ?? 1) - (v.from ?? 0)) * ramp(p, v.at || [0, 1]); }
function rng(seed) { let s = (seed * 2654435761) >>> 0 || 7; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

// 하늘 프리셋: 배경 위/아래 밝기, 해 방향(가로 0~1, 높이), 빛 세기, 주변광
const SKY = {
  dawn: { top: .25, bot: .85, sun: [.7, .08], key: 2.2, amb: .5 },
  day: { top: .55, bot: .95, sun: [.8, .6], key: 2.6, amb: .9 },
  sunset: { top: .2, bot: .95, sun: [.5, .05], key: 2.4, amb: .45 },
  dusk: { top: .08, bot: .55, sun: [.28, .03], key: 1.2, amb: .35, stars: .4 },
  night: { top: .02, bot: .18, sun: null, moon: [.76, .5], key: .7, amb: .25, stars: 1 },
  storm: { top: .1, bot: .3, sun: null, key: .5, amb: .5 },
  divine: { top: .6, bot: 1, sun: [.5, .4], key: 3, amb: 1.1 },
};

// ── 렌더러와 디더 후처리 ────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
renderer.setSize(W, H, false); renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
rt.depthTexture = new THREE.DepthTexture(W, H);
const post = new THREE.ShaderMaterial({
  uniforms: { tColor: { value: rt.texture }, tDepth: { value: rt.depthTexture }, near: { value: .5 }, far: { value: 700 }, lo: { value: .16 }, hi: { value: .8 }, invert: { value: 0 }, ink: { value: INK }, paper: { value: PAPER }, px: { value: new THREE.Vector2(1 / W, 1 / H) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }',
  fragmentShader: `
    uniform sampler2D tColor, tDepth; uniform float near, far, lo, hi, invert; uniform vec3 ink, paper; uniform vec2 px; varying vec2 vUv;
    float lin(vec2 uv){ float z=texture2D(tDepth,uv).x*2.-1.; return 2.*near*far/(far+near-z*(far-near)); }
    float b2(vec2 a){ a=floor(a); return fract(dot(a,vec2(.5,a.y*.75))); }
    float b4(vec2 a){ return b2(.5*a)*.25+b2(a); }
    float b8(vec2 a){ return b4(.5*a)*.25+b2(a); }
    void main(){
      vec3 c=texture2D(tColor,vUv).rgb;
      float l=pow(clamp(dot(c,vec3(.299,.587,.114)),0.,1.),.4545);
      l=smoothstep(lo,hi,l);
      bool on=l>b8(gl_FragCoord.xy)+.0078;
      // 깊이가 끊기는 곳 = 물체의 윤곽: 밝은 면엔 잉크선, 어두운 면엔 종이색 테두리
      float d=lin(vUv);
      if(d<far*.9){
        float dx=abs(lin(vUv+vec2(px.x,0.))-d)+abs(lin(vUv-vec2(px.x,0.))-d);
        float dy=abs(lin(vUv+vec2(0.,px.y))-d)+abs(lin(vUv-vec2(0.,px.y))-d);
        if(max(dx,dy)>d*.06+.05) on=l<.5;
      }
      if(invert>.5) on=!on;
      gl_FragColor=vec4(on?paper:ink,1.);
    }`,
  depthTest: false, depthWrite: false,
});
const postScene = new THREE.Scene(), postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post));

// ── 공용 재질/형태 ─────────────────────────────────
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .9, ...o });
const mats = { robe: M('#5a5048'), robeJ: M('#e8e0cc'), skin: M('#8a6a50'), wood: M('#6a4a30'), stone: M('#b8a888'), dark: M('#0a0a0a'), ground: M('#a49070'), green: M('#5e6a40'), cloud: new THREE.MeshLambertMaterial({ color: '#ffffff' }), glow: new THREE.MeshBasicMaterial({ color: '#ffffff' }) };
const G = { robe: new THREE.CylinderGeometry(.17, .34, 1.45, 10), head: new THREE.SphereGeometry(.14, 10, 8), arm: new THREE.CylinderGeometry(.045, .045, .62, 6), staff: new THREE.CylinderGeometry(.03, .03, 1.9, 5) };
G.robe.translate(0, .725, 0); G.arm.translate(0, -.31, 0); G.staff.translate(0, .95, 0);
const shadowy = o => { o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };

// 2D 위치 → 3D: 가까움(depth)이 클수록 카메라에 가깝게
const distOf = d => 14 + Math.pow(1 - clamp(d ?? .5), 1.3) * 120;
const xOf = (x, D) => (x - .5) * D * 1.16;

function person(o, p) {
  const g = new THREE.Group(), jesus = o.kind === 'jesus';
  const body = new THREE.Mesh(G.robe, jesus ? mats.robeJ : mats.robe); g.add(body);
  const head = new THREE.Mesh(G.head, mats.skin); head.position.y = 1.6; g.add(head);
  const raise = val(o.raise, p, 0), reach = o.reach ? val(o.reach, p, 1) * (o.face ?? 1) : 0;
  for (const s of [-1, 1]) {
    const a = new THREE.Mesh(G.arm, jesus ? mats.robeJ : mats.robe); a.position.set(s * .2, 1.38, 0);
    a.rotation.z = s * (.15 + raise * 2.6); if (reach && s === Math.sign(reach)) { a.rotation.z = 0; a.rotation.x = -1.4; a.rotation.y = s * .2; }
    g.add(a);
  }
  if (o.staff) { const st = new THREE.Mesh(G.staff, mats.wood); st.position.set(.36, 0, .05); g.add(st); }
  if (o.pose === 'kneel') g.scale.y = .62;
  if (o.pose === 'child') g.scale.setScalar(.62);
  if (o.pose === 'lying') { g.rotation.z = Math.PI / 2; g.position.y = .3; }
  const glow = val(o.glow, p, jesus ? .7 : 0);
  if (glow > .02) { const h = new THREE.Mesh(new THREE.TorusGeometry(.26, .025, 6, 24), mats.glow); h.position.set(0, 1.64, -.08); h.scale.setScalar(.8 + glow * .3); h.userData.flat = true; g.add(h); const L = new THREE.PointLight('#fff2d0', 6 * glow, 9, 1.6); L.position.y = 1.8; g.add(L); }
  return shadowy(g);
}

// ── 레이어 → 3D 물체 ─────────────────────────────────
const B = {
  figure(o, p) { const D = distOf(o.depth ?? .9), g = person(o, p); const s = (o.s ?? 1) / 1.3 * 1.8; g.scale.multiplyScalar(s); g.position.x = xOf(o.x + val(o.dx, p, 0) * (o.move ?? 0), D); g.position.z = -D; g.position.y += val(o.dy, p, 0) * (o.rise ?? 0) * -12 + (o.pose === 'lying' ? .3 * s : 0) + (o.y < .6 ? (0.86 - o.y) * D * .6 : 0); g.rotation.y = (o.x - .5) * -.4; return g; },
  crowd(o, p) {
    const g = new THREE.Group(), D = distOf(o.depth ?? .75), r = rng(o.seed ?? 21), n = o.n ?? 30, appear = val(o.appear, p, 1);
    for (let i = 0; i < n; i++) { const k = r(); if (k > appear) { r(); r(); r(); continue; } const a = r(), b = r(), v = r(); const f = person({ raise: o.raise ? val(o.raise, p) * (v > .5 ? 1 : 0) : 0, pose: v < .12 ? 'child' : v < .2 ? 'kneel' : null }, p); f.scale.multiplyScalar((o.s ?? .5) / .62 * 1.5); const dd = D + (b - .5) * D * .25; f.position.set(xOf(o.x - o.w / 2 + a * o.w, dd), 0, -dd); f.rotation.y = (r() - .5) * 1.5; g.add(f); }
    return g;
  },
  boat(o, p, t) {
    const g = new THREE.Group(), D = distOf(o.depth ?? .85), s = (o.s ?? 1) * 1.6, storm = val(o.storm, p);
    const hull = new THREE.Mesh(new THREE.BoxGeometry(5, .7, 1.5), mats.wood); hull.position.y = -.15; g.add(hull); for (const e of [-1, 1]) { const tip = new THREE.Mesh(new THREE.ConeGeometry(.75, 1.2, 4), mats.wood); tip.rotation.z = -e * Math.PI / 2; tip.rotation.x = Math.PI / 4; tip.scale.z = 1.4; tip.position.set(e * 3.1, -.15, 0); g.add(tip); }
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, 4.5), mats.wood); mast.position.y = 2.2; g.add(mast);
    if (o.sail !== false) { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(2.2 + storm, 1); sh.lineTo(0, 4); const sail = new THREE.Mesh(new THREE.ShapeGeometry(sh), M('#d8d0c0', { side: THREE.DoubleSide })); sail.position.set(.05, .3, 0); sail.rotation.y = -.5; g.add(sail); }
    for (let i = 0; i < (o.crew ?? 5); i++) { const f = person({ raise: storm > .5 && i % 2 ? .8 : 0 }, p); f.scale.setScalar(.7); f.position.set(-1.8 + i * .9, -.1, 0); g.add(f); }
    g.scale.setScalar(s); g.position.set(xOf(o.x + val(o.dx, p, 0) * (o.move ?? 0), D), .2 + Math.sin(t * 1.5) * (.1 + storm * .5), -D);
    g.rotation.z = Math.sin(t * (1.2 + storm * 2)) * (.04 + storm * .2); g.rotation.y = .25;
    return shadowy(g);
  },
  city(o, p) {
    const g = new THREE.Group(), D = distOf(o.depth ?? .55), r = rng(o.seed ?? 11), w = o.w * D * 1.16, s = (o.s ?? 1);
    for (let x = -w / 2; x < w / 2;) { const hw = (3 + r() * 5) * s, hh = (2.5 + r() * 5) * s, hd = (3 + r() * 4) * s; const m = new THREE.Mesh(new THREE.BoxGeometry(hw, hh, hd), mats.stone); m.position.set(xOf(o.x, D) + x + hw / 2, hh / 2, -D - r() * 6); g.add(m); if (r() < .12) { const dm = new THREE.Mesh(new THREE.SphereGeometry(hw * .38, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mats.stone); dm.position.set(m.position.x, hh, m.position.z); g.add(dm); } if (o.lights && r() > .4) { const wl = new THREE.Mesh(new THREE.PlaneGeometry(.6 * s, .8 * s), mats.glow); wl.userData.flat = true; wl.position.set(m.position.x, hh * .55, m.position.z + hd / 2 + .02); g.add(wl); } x += hw * (.8 + r() * .3); }
    return shadowy(g);
  },
  temple(o) { const g = new THREE.Group(), D = distOf(o.depth ?? .5), s = (o.s ?? 1) * 8; const a = new THREE.Mesh(new THREE.BoxGeometry(5 * s, .9 * s, 3 * s), mats.stone); a.position.y = .45 * s; const b = new THREE.Mesh(new THREE.BoxGeometry(1.8 * s, 2.2 * s, 1.8 * s), mats.stone); b.position.y = 2 * s; g.add(a, b); g.position.set(xOf(o.x, D), 0, -D); return shadowy(g); },
  jars(o, p, t) {
    const g = new THREE.Group(), D = distOf(.9), s = (o.s ?? 1) * 1.1, wine = val(o.wine, p, 0);
    const prof = [[0, 0], [.32, .02], [.42, .4], [.36, .85], [.24, 1.05], [.26, 1.12]].map(([x, y]) => new THREE.Vector2(x, y));
    const jg = new THREE.LatheGeometry(prof, 16);
    for (let i = 0; i < 6; i++) { const j = new THREE.Mesh(jg, mats.stone); j.position.x = (i - 2.5) * .95; j.scale.setScalar(1.3); g.add(j); const k = clamp(wine * 1.4 - i * .08); const top = new THREE.Mesh(new THREE.CircleGeometry(.3, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(1 - k * .92) })); top.rotation.x = -Math.PI / 2; top.position.set(j.position.x, 1.42, 0); top.userData.flat = true; g.add(top); }
    g.scale.setScalar(s); g.position.set(xOf(o.x, D), 0, -D + 4); return shadowy(g);
  },
  baskets(o, p) { const g = new THREE.Group(), D = distOf(.9), n = Math.round((o.n ?? 12) * val(o.grow, p, 1)); for (let i = 0; i < n; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(.45, .32, .35, 12), mats.wood); b.position.set(((i % 6) - 2.5) * 1.1, .18, Math.floor(i / 6) * 1.1); const br = new THREE.Mesh(new THREE.SphereGeometry(.36, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M('#e8d8a8', { emissive: '#665030' })); br.position.set(b.position.x, .35, b.position.z); g.add(b, br); } g.scale.setScalar((o.s ?? 1) * 1.2); g.position.set(xOf(o.x, D), 0, -D + 3); return shadowy(g); },
  tomb(o, p) {
    const g = new THREE.Group(), D = distOf(o.depth ?? .7) * .6, s = (o.s ?? 1) * 5, open = val(o.open, p, 0);
    const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mats.stone); hill.scale.set(1.6 * s, 1.1 * s, 1 * s); g.add(hill);
    const door = new THREE.Mesh(new THREE.CircleGeometry(.32 * s, 20, 0, Math.PI), open > 0 ? mats.glow : mats.dark); door.position.set(0, 0, .99 * s); door.userData.flat = open > 0; g.add(door);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(.36 * s, .36 * s, .14 * s, 24), mats.stone); st.rotation.x = Math.PI / 2; st.position.set(open * .8 * s, .36 * s, 1.05 * s); st.rotation.y = 0; g.add(st);
    if (open > 0) { const L = new THREE.PointLight('#fff1cf', 30 * open, 40, 1.4); L.position.set(0, .3 * s, 1.4 * s); g.add(L); }
    g.position.set(xOf(o.x, D), 0, -D); return shadowy(g);
  },
  pool(o, p, t) { const g = new THREE.Group(), D = distOf(o.depth ?? .7) * .5, w = (o.w ?? .5) * 30; const wt = new THREE.Mesh(new THREE.PlaneGeometry(w, 5), M('#4a6a78', { roughness: .2, metalness: .3 })); wt.rotation.x = -Math.PI / 2; wt.position.y = .05; g.add(wt); for (let i = 0; i < 9; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, 6), mats.stone); c.position.set(-w / 2 + i * w / 8, 3, -3.5); g.add(c); } const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1, .5, 1.6), mats.stone); roof.position.set(0, 6.2, -3.5); g.add(roof); g.position.set(xOf(o.x, D), 0, -D); return shadowy(g); },
  well(o) { const g = new THREE.Group(), D = distOf(.85); const c = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 18, 1, true), mats.stone); c.position.y = .5; c.material.side = THREE.DoubleSide; g.add(c); for (const x of [-1, 1]) { const po = new THREE.Mesh(new THREE.BoxGeometry(.15, 2.4, .15), mats.wood); po.position.set(x * .9, 1.2, 0); g.add(po); } const bar = new THREE.Mesh(new THREE.BoxGeometry(2, .15, .15), mats.wood); bar.position.y = 2.4; g.add(bar); g.scale.setScalar((o.s ?? 1) * 1.2); g.position.set(xOf(o.x, D), 0, -D); return shadowy(g); },
  trees(o, p, t) {
    const g = new THREE.Group(), D = distOf(o.depth ?? .8), s = (o.s ?? 1) * 1.6;
    for (const [i, tx] of (o.xs || [.1]).entries()) {
      const tr = new THREE.Group();
      if (o.kind === 'palm') { const tk = new THREE.Mesh(new THREE.CylinderGeometry(.12, .2, 5.5, 6), mats.wood); tk.position.y = 2.75; tk.rotation.z = .08; tr.add(tk); for (let f = 0; f < 8; f++) { const fr = new THREE.Mesh(new THREE.BoxGeometry(2.4, .05, .4), mats.green); fr.position.y = 5.5; fr.rotation.y = f / 8 * Math.PI * 2; fr.rotation.z = -.45 + Math.sin(t + f) * .03; fr.geometry.translate(1.2, 0, 0); tr.add(fr); } }
      else { const tk = new THREE.Mesh(new THREE.CylinderGeometry(.18, .26, 2.2, 6), mats.wood); tk.position.y = 1.1; tr.add(tk); for (const [dx, dy, r] of [[0, 2.8, 1.3], [-1, 2.4, 1], [1.1, 2.4, 1], [-.4, 3.4, .9], [.5, 3.3, .9]]) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), mats.green); b.position.set(dx, dy, 0); tr.add(b); } }
      tr.scale.setScalar(s * (.85 + (i % 3) * .12)); const dd = D * (1 + (i % 2) * .08); tr.position.set(xOf(tx, dd), 0, -dd); g.add(tr);
    }
    return shadowy(g);
  },
  sycamore(o, p) { const g = B.trees({ xs: [o.x], depth: o.depth ?? .8, s: (o.s ?? 1) * 2.2, kind: 'olive' }, p, 0); if (o.person) { const f = person({}, p); f.scale.setScalar(.8); const D = distOf(o.depth ?? .8); f.position.set(xOf(o.x, D) - 1.6, 5.2, -D + 1.6); g.add(shadowy(f)); } return g; },
  mountain(o, p) { const D = distOf(o.depth ?? .35) * 1.4, m = new THREE.Mesh(new THREE.ConeGeometry(o.w * D * .6, o.h * D * 1.2, 24, 4), mats.stone); m.position.set(xOf(o.x, D), o.h * D * .6, -D); const glow = val(o.glow, p, 0); if (glow > .05) m.material = M('#d8c8a8', { emissive: new THREE.Color().setScalar(glow * .5) }); m.receiveShadow = true; return m; },
  cave(o) { const g = new THREE.Group(), D = distOf(o.depth ?? .7) * .7, s = (o.s ?? 1) * 4; const r = new THREE.Mesh(new THREE.DodecahedronGeometry(1.4 * s, 1), mats.stone); r.scale.y = .7; g.add(r); const d = new THREE.Mesh(new THREE.CircleGeometry(.5 * s, 16, 0, Math.PI), mats.dark); d.position.set(0, 0, 1.25 * s); g.add(d); g.position.set(xOf(o.x, D), 0, -D); return shadowy(g); },
  stones(o) { const g = new THREE.Group(), D = distOf(o.depth ?? .8) * .7, r = rng(5); for (let i = 0; i < 12; i++) { const st = new THREE.Mesh(new THREE.DodecahedronGeometry(.35 + r() * .25, 0), mats.stone); st.position.set((r() - .5) * 2.4, .3 + Math.floor(i / 5) * .45, (r() - .5) * 1.2); g.add(st); } g.scale.setScalar((o.s ?? 1) * 1.6); g.position.set(xOf(o.x, D), 0, -D); return shadowy(g); },
  altar(o) { const g = B.stones({ ...o, s: (o.s ?? 1) * .8 }); if (o.fire) { const f = new THREE.Mesh(new THREE.ConeGeometry(.5, 1.4, 8), mats.glow); f.userData.flat = true; f.position.y = 2; g.children.length && g.add(f); const L = new THREE.PointLight('#ffb060', 8, 12); L.position.y = 2.5; g.add(L); } return g; },
  road(o) { const m = new THREE.Mesh(new THREE.PlaneGeometry(6, 200), M('#c8b490')); m.rotation.x = -Math.PI / 2; m.position.set(0, .02, -100); m.receiveShadow = true; return m; },
};

// ── 장면 조립 ────────────────────────────────────────
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(FOV, W / H, .5, 700);
let built = null;

function skyMesh(a, b) {
  const geo = new THREE.SphereGeometry(600, 32, 16);
  const mat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: { top: { value: a }, bot: { value: b } }, vertexShader: 'varying float h; void main(){ h=normalize(position).y; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }', fragmentShader: 'uniform float top, bot; varying float h; void main(){ float v=mix(bot,top,smoothstep(0.,.5,h)); v=pow(v,2.2); gl_FragColor=vec4(vec3(v),1.); }' });
  const m = new THREE.Mesh(geo, mat); m.renderOrder = -1; return m;
}

function build(beat) {
  const root = new THREE.Group(), dyn = [];
  const sk = SKY[beat.sky] || SKY.day, sk2 = beat.skyTo ? SKY[beat.skyTo] : null;
  const sky = skyMesh(sk.top, sk.bot); root.add(sky);
  const sunPos = beat.sun || sk.sun || (sk2 && sk2.sun) || sk.moon || [.5, .4];
  const az = (sunPos[0] - .5) * 1.4, el = Math.max(.04, sunPos[1] * 1.1);
  const sunDir = new THREE.Vector3(Math.sin(az), Math.sin(el), -Math.cos(az)).normalize();
  const key = new THREE.DirectionalLight('#ffffff', sk.key); key.position.copy(sunDir).multiplyScalar(150); key.target.position.set(0, 0, -40);
  key.castShadow = true; key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 10, far: 400 }); key.shadow.bias = -.0008; key.shadow.normalBias = .04;
  root.add(key, key.target);
  const amb = new THREE.HemisphereLight('#ffffff', '#666666', sk.amb + .35); root.add(amb);
  // 해/달 원반 (윤곽선 없는 빛)
  if (sk.sun || sk.moon || (sk2 && sk2.sun)) { const disc = new THREE.Mesh(new THREE.SphereGeometry(14, 16, 12), mats.glow); disc.position.copy(sunDir).multiplyScalar(560); root.add(disc); }
  // 별
  if (sk.stars || (beat.fx || []).some(f => f.type === 'stars2')) { const r = rng(9), pts = []; for (let i = 0; i < 1400; i++) { const a = r() * Math.PI * 2, h = .05 + r() * .9; pts.push(Math.cos(a) * 550 * Math.cos(h), 550 * Math.sin(h), Math.sin(a) * 550 * Math.cos(h)); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); root.add(new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false, depthWrite: false }))); }
  // 구름: 빛을 받는 공 덩어리
  const nc = beat.clouds ?? 6, rc = rng((beat.text || '').length + 3);
  for (let i = 0; i < nc; i++) { const c = new THREE.Group(); for (let k = 0; k < 9; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(8 + rc() * 10, 10, 8), mats.cloud); b.position.set((k - 4) * 9 + rc() * 6, rc() * 8 + Math.sin(k / 8 * Math.PI) * 10, rc() * 8); c.add(b); } c.position.set((rc() - .5) * 700, 90 + rc() * 120, -300 - rc() * 200); c.scale.y = .6; root.add(c); dyn.push(t => { c.position.x += .03; }); }

  const layers = beat.layers || [];
  const hasSea = layers.some(l => l.type === 'sea'), seaNear = hasSea && layers.some(l => l.type === 'boat' || (l.type === 'figure' && (l.depth ?? .9) < .9));
  // 땅: 가까이는 평평, 멀수록 언덕이 솟음
  const seed = (layers.find(l => l.type === 'hills') || {}).seed ?? 3, rh = rng(seed);
  const ph = [rh() * 9, rh() * 9, rh() * 9];
  const gGeo = new THREE.PlaneGeometry(900, 900, 160, 160); gGeo.rotateX(-Math.PI / 2);
  const gp = gGeo.attributes.position;
  const shoreZ = seaNear ? 40 : -28 - (hasSea ? 0 : 1e4);
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i), z = gp.getZ(i), far = clamp((-z - 60) / 200);
    let y = (Math.sin(x * .012 + ph[0]) * .6 + Math.sin(x * .031 + ph[1]) * .3 + Math.sin(z * .02 + ph[2]) * .2 + .4) * far * 38 * (.6 + rh() * .04) + Math.sin(x * .3) * Math.cos(z * .27) * .15;
    if (hasSea && z < shoreZ && z > -260) y = Math.min(y, -1.2); // 바다 자리는 수면 아래로
    gp.setY(i, y);
  }
  gGeo.computeVertexNormals();
  const ground = new THREE.Mesh(gGeo, mats.ground); ground.receiveShadow = true; root.add(ground);
  if (hasSea) {
    const sea = layers.find(l => l.type === 'sea');
    const sGeo = new THREE.PlaneGeometry(900, seaNear ? 330 : 232, 90, 40); sGeo.rotateX(-Math.PI / 2); sGeo.translate(0, 0, seaNear ? -125 : -28 - 116);
    const base = Float32Array.from(sGeo.attributes.position.array);
    const water = new THREE.Mesh(sGeo, M('#3a4c58', { roughness: .25, metalness: .4 })); water.receiveShadow = true; root.add(water);
    dyn.push((t, p) => { const s = val(sea.storm, p), a = sGeo.attributes.position; for (let i = 0; i < a.count; i++) { const x = base[i * 3], z = base[i * 3 + 2]; a.setY(i, (Math.sin(x * .25 + t * 1.6) + Math.sin(z * .35 - t * 1.3)) * (.06 + s * .7)); } a.needsUpdate = true; sGeo.computeVertexNormals(); });
  }
  // 레이어 물체 (시간에 따라 바뀌는 것은 매 프레임 다시 만듦)
  const animated = l => ['figure', 'boat', 'jars', 'baskets', 'tomb', 'crowd', 'trees'].includes(l.type) && JSON.stringify(l).match(/\[|from|storm|dx|raise|appear|wine|grow|open|glow/);
  const dynGroup = new THREE.Group(); root.add(dynGroup);
  for (const l of layers) { if (!B[l.type] || animated(l)) continue; root.add(B[l.type](l, 0, 0)); }
  const anim = layers.filter(l => B[l.type] && animated(l));
  dyn.push((t, p) => { dynGroup.children.forEach(c => c.traverse(m => m.geometry && m.geometry !== G.robe && m.geometry !== G.head && m.geometry !== G.arm && m.geometry !== G.staff && m.geometry.dispose())); dynGroup.clear(); for (const l of anim) dynGroup.add(B[l.type](l, p, t)); });
  // 효과
  for (const f of beat.fx || []) {
    if (f.type === 'glow') { const D = 18, s = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), mats.glow); s.position.set(xOf(f.x, D), (0.9 - f.y) * D * .7, -D); s.userData.flat = true; root.add(s); const L = new THREE.PointLight('#fff0d0', 0, 30, 1.5); L.position.copy(s.position); root.add(L); dyn.push((t, p) => { const k = val(f.on, p, 1); s.visible = false; L.intensity = k * 25; }); }
    if (f.type === 'beam') { const D = 16, b = new THREE.Mesh(new THREE.CylinderGeometry(.6, 1.4, 40, 16, 1, true), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .5, depthWrite: false })); b.position.set(xOf(f.x, D), 20, -D); b.userData.flat = true; root.add(b); dyn.push((t, p) => { b.visible = val(f.on, p, 1) > .2; }); }
    if (f.type === 'motes' || f.type === 'embers') { const r = rng(4), pts = []; for (let i = 0; i < (f.n ?? 60); i++) pts.push((r() - .5) * 40, r() * 12, -6 - r() * 30); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); const P = new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: 3, sizeAttenuation: false })); root.add(P); dyn.push(t => { P.position.y = (t * .4) % 3; }); }
    if (f.type === 'rain') { const r = rng(8), pts = []; for (let i = 0; i < 700; i++) { const x = (r() - .5) * 60, y = r() * 25, z = -4 - r() * 40; pts.push(x, y, z, x - .3, y - 1.2, z); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); const R = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#ffffff' })); root.add(R); dyn.push((t, p) => { R.position.y = -((t * 14) % 12); R.visible = val(f.on, p, 1) > .3; }); }
  }
  return { root, dyn, flashes: (beat.fx || []).filter(f => f.type === 'flash' || f.type === 'lightning'), shake: (beat.fx || []).find(f => f.type === 'shake'), sky2: sk2, sky1: sk, sky, amb, key };
}

function dispose(o) { o.traverse(m => { if (m.geometry && ![G.robe, G.head, G.arm, G.staff].includes(m.geometry)) m.geometry.dispose(); if (m.material && !Object.values(mats).includes(m.material)) (Array.isArray(m.material) ? m.material : [m.material]).forEach(x => x.dispose()); }); }

// 깊이 경계 없는 빛 물체(해·광채·창문)는 윤곽선이 생기지 않도록 깊이를 쓰지 않음
function flatten(o) { o.traverse(m => { if (m.userData.flat && m.material) { m.material = m.material === mats.glow ? mats.glowNoDepth || (mats.glowNoDepth = new THREE.MeshBasicMaterial({ color: '#ffffff', depthWrite: false })) : m.material; m.renderOrder = 2; } }); }

window.Scene3D = {
  canvas: renderer.domElement,
  render(beat, p, t) {
    if (!built || built.beat !== beat) { if (built) { scene.remove(built.root); dispose(built.root); } built = build(beat); built.beat = beat; scene.add(built.root); }
    built.dyn.forEach(f => f(t, p)); flatten(built.root);
    // 하늘 전환 (예: 폭풍 → 노을)
    if (built.sky2) { const k = ramp(p, beat.skyAt || [.3, .8]); built.sky.material.uniforms.top.value = built.sky1.top + (built.sky2.top - built.sky1.top) * k; built.sky.material.uniforms.bot.value = built.sky1.bot + (built.sky2.bot - built.sky1.bot) * k; built.amb.intensity = built.sky1.amb + (built.sky2.amb - built.sky1.amb) * k; built.key.intensity = built.sky1.key + (built.sky2.key - built.sky1.key) * k; }
    // 카메라: 천천히 다가가며 옆으로 흐르는 돌리
    const cam = beat.cam || {}, e = ease(p), z = 1 + ((cam.z0 ?? 1.02) + ((cam.z1 ?? 1.1) - (cam.z0 ?? 1.02)) * e - 1) * 40;
    const sx = built.shake ? val(built.shake.on, p, 1) * (built.shake.amp ?? 8) * .02 : 0;
    camera.position.set(((cam.x0 ?? -20) + ((cam.x1 ?? 20) - (cam.x0 ?? -20)) * e) * .06 + Math.sin(t * 50) * sx, 3.2 + Math.cos(t * 43) * sx, -z + 6);
    camera.lookAt(camera.position.x * .5, 1.2, -60);
    // 반전 섬광 (번개·빛)
    let inv = 0; for (const f of built.flashes) { if (f.type === 'flash' && Math.abs(p - f.at) < .015) inv = 1; if (f.type === 'lightning' && val(f.on, p, 1) > .3 && (t % 3.2) < .1) inv = 1; }
    post.uniforms.invert.value = inv;
    const dz = beat.dither || {}; post.uniforms.lo.value = dz.lo ?? .16; post.uniforms.hi.value = dz.hi ?? .8;
    renderer.setRenderTarget(rt); renderer.render(scene, camera);
    renderer.setRenderTarget(null); renderer.render(postScene, postCam);
    return renderer.domElement;
  },
};
window.dispatchEvent(new Event('scene3d-ready'));
