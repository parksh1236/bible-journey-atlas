// 장면 일러스트 렌더러: 캔버스에 빛나는 하늘·역광 구름·빛줄기·실루엣 풍경을 코드로 그립니다.
// 각 장면(beat)은 { sky, skyTo, skyAt, sun, cam, layers:[...], fx:[...] } 형태의 데이터입니다.
// 값은 숫자 또는 [시작, 끝](장면 진행률 0~1 구간에서 0→1로 변함) 또는 {from,to,at}로 시간에 따라 움직입니다.
(function () {
  const W = 1600, H = 900;
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const ramp = (p, r) => r == null ? 1 : ease(clamp((p - r[0]) / Math.max(1e-4, r[1] - r[0])));
  function val(v, p, d = 0) {
    if (v == null) return d;
    if (typeof v === 'number') return v;
    if (Array.isArray(v)) return ramp(p, v);
    return lerp(v.from ?? 0, v.to ?? 1, ramp(p, v.at || [0, 1]));
  }
  const hashStr = t => { let h = 2166136261; for (const ch of t) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return (h >>> 0) % 100000 + 1; };
  function rng(seed) { let s = (seed * 2654435761) >>> 0 || 7; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  const hex = c => { c = c.replace('#', ''); return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)]; };
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

  // ── 하늘 프리셋 ─────────────────────────────────────
  const SKY = {
    dawn: { land: '#7d6a7e', stops: [[0, '#1b3066'], [.36, '#5873bb'], [.6, '#eaa6a3'], [.76, '#ffd7a6']], sun: [.7, .6], sunC: '#fff1cc', light: '#ffe4c8', shadow: '#7c7db8', dark: '#2a2443', haze: '#f2c2ab', stars: .15 },
    day: { land: '#6f9a52', stops: [[0, '#1c5cc8'], [.45, '#59a3ef'], [.76, '#c4e5ff']], sun: [.8, .15], sunC: '#ffffff', light: '#ffffff', shadow: '#9fbde6', dark: '#2a4658', haze: '#d3e9f7', stars: 0 },
    sunset: { land: '#7a4b4f', stops: [[0, '#19275a'], [.3, '#5a4a9c'], [.52, '#e2708b'], [.66, '#ffa65d'], [.75, '#ffe193']], sun: [.5, .66], sunC: '#fff5d2', light: '#ffd49c', shadow: '#895a91', dark: '#2b1c35', haze: '#f7a87e', stars: 0 },
    dusk: { land: '#3f3654', stops: [[0, '#0b1433'], [.4, '#2d3f82'], [.62, '#8a66a8'], [.76, '#f19b79']], sun: [.28, .73], sunC: '#ffdab2', light: '#f6b897', shadow: '#4a4988', dark: '#191730', haze: '#b98aa9', stars: .55 },
    night: { land: '#18213a', stops: [[0, '#030820'], [.5, '#0e1e4b'], [.78, '#243d76']], sun: null, moon: [.76, .17], sunC: '#dfe8ff', light: '#a6bbea', shadow: '#1c2a56', dark: '#060a1c', haze: '#2d4884', stars: 1 },
    storm: { land: '#2a3540', stops: [[0, '#141b27'], [.5, '#35455a'], [.78, '#5c6c7b']], sun: null, sunC: '#cfd8e2', light: '#8a99ab', shadow: '#222c3a', dark: '#0e131b', haze: '#4d5c6b', stars: 0 },
    divine: { land: '#93ad6a', stops: [[0, '#2a52b0'], [.45, '#84b8ef'], [.74, '#fff2d2']], sun: [.5, .28], sunC: '#ffffff', light: '#fff7e2', shadow: '#99b4df', dark: '#334968', haze: '#fbeaca', stars: 0 },
  };
  function palette(name) {
    const s = SKY[name] || SKY.day;
    return { ...s, land: hex(s.land), light: hex(s.light), shadow: hex(s.shadow), dark: hex(s.dark), haze: hex(s.haze), sunRGB: hex(s.sunC), top: hex(s.stops[0][1]), horizon: hex(s.stops[s.stops.length - 1][1]) };
  }
  function mixPal(a, b, k) {
    const o = { ...a };
    for (const key of ['land', 'light', 'shadow', 'dark', 'haze', 'sunRGB', 'top', 'horizon']) o[key] = mix(a[key], b[key], k);
    o.stars = lerp(a.stars || 0, b.stars || 0, k);
    return o;
  }

  // 장면별 캐시 (구름 스프라이트, 무작위 배치 등)
  const caches = new WeakMap();
  function cacheOf(beat) { let c = caches.get(beat); if (!c) { c = {}; caches.set(beat, c); } return c; }

  // ── 구름: 역광을 받은 적운 스프라이트 ─────────────────
  function cloudSprite(r, pal, sunDir, w, h, storm) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    const pad = h * .06, puffs = [];
    const n = 12 + Math.floor(r() * 10);
    for (let i = 0; i < n; i++) { // 위로 부풀어 오른 적운: 가운데가 높고 아래는 평평
      const u = r(), cx = pad + h * .2 + u * (w - 2 * pad - h * .4);
      const hump = Math.sin(Math.PI * (cx / w)) ** 1.3;
      const rad = Math.min(h * .36, Math.min(cx - pad, w - pad - cx), h * (.1 + .3 * hump * (.5 + r() * .7)));
      puffs.push([cx, Math.max(rad + pad, h * .8 - rad * (.4 + r() * .6) - hump * h * .2), rad]);
    }
    for (let i = 0; i < 8; i++) puffs.push([pad + h * .15 + r() * (w - 2 * pad - h * .3), h * .8 - h * .06, h * (.08 + r() * .07)]);
    const body = mix(pal.shadow, pal.light, storm ? .12 : .3);
    g.fillStyle = rgba(body);
    for (const [x, y, rad] of puffs) { // 단색 몸체(겹침 이음매가 보이지 않도록), 가장자리만 부드럽게
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, rgba(body, 1)); gr.addColorStop(.82, rgba(body, 1)); gr.addColorStop(1, rgba(body, 0));
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill();
    }
    g.globalCompositeOperation = 'source-atop';
    // 해 쪽에서 비치는 전체 빛
    const lg = g.createLinearGradient(w / 2 + sunDir[0] * w * .5, h / 2 + sunDir[1] * h * .9, w / 2 - sunDir[0] * w * .4, h / 2 - sunDir[1] * h * .6);
    lg.addColorStop(0, rgba(pal.light, storm ? .2 : .85)); lg.addColorStop(.55, rgba(pal.light, storm ? .04 : .15)); lg.addColorStop(1, rgba(pal.light, 0));
    g.fillStyle = lg; g.fillRect(0, 0, w, h);
    for (const [x, y, rad] of puffs) { // 뭉게뭉게 솟은 부분의 밝은 윗면
      const hx = x + sunDir[0] * rad * .45, hy = y - rad * .35 + sunDir[1] * rad * .3;
      const gr = g.createRadialGradient(hx, hy, 0, hx, hy, rad * .85);
      gr.addColorStop(0, rgba(pal.light, storm ? .12 : .55)); gr.addColorStop(1, rgba(pal.light, 0));
      g.fillStyle = gr; g.beginPath(); g.arc(hx, hy, rad * .85, 0, 7); g.fill();
    }
    const bot = g.createLinearGradient(0, h * .5, 0, h * .85);
    bot.addColorStop(0, 'rgba(0,0,0,0)'); bot.addColorStop(1, rgba(mix(pal.shadow, pal.dark, .35), .5));
    g.fillStyle = bot; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'destination-out'; // 아래 가장자리를 흐리게
    const fade = g.createLinearGradient(0, h * .74, 0, h * .86); fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(0,0,0,1)');
    g.fillStyle = fade; g.fillRect(0, h * .74, w, h * .26);
    return c;
  }
  function makeClouds(seed, n, pal, storm) {
    const r = rng(seed), sun = pal.sun || [.5, .2];
    return Array.from({ length: n }, () => {
      const depth = .04 + r() * .22, cw = (storm ? 520 : 300) + r() * 480, ch = cw * (.32 + r() * .14), x = r(), y = .02 + r() * (storm ? .3 : .34);
      const dir = [sun[0] - x, sun[1] - y], len = Math.hypot(...dir) || 1;
      return { x, y, depth, spr: cloudSprite(r, pal, [dir[0] / len, dir[1] / len], Math.round(cw), Math.round(ch), storm), speed: 3 + r() * 7 };
    });
  }

  // ── 실루엣 도구 ─────────────────────────────────────
  function person(g, x, y, s, col, o = {}) {
    g.fillStyle = col;
    if (o.kind === 'lying') {
      g.beginPath(); g.ellipse(x, y - s * .14, s * .62, s * .14, 0, 0, 7); g.fill();
      g.beginPath(); g.arc(x - s * .66, y - s * .2, s * .14, 0, 7); g.fill(); return;
    }
    const kneel = o.kind === 'kneel', child = o.kind === 'child';
    const k = child ? .62 : 1, top = y - s * (kneel ? 1.1 : 1.72) * k;
    g.beginPath(); g.arc(x, top, s * .13 * k, 0, 7); g.fill();
    g.beginPath();
    g.moveTo(x - s * .15 * k, top + s * .16 * k);
    g.quadraticCurveTo(x - s * .3 * k, y - s * .5 * k, x - s * (kneel ? .36 : .27) * k, y);
    g.lineTo(x + s * (kneel ? .36 : .27) * k, y);
    g.quadraticCurveTo(x + s * .3 * k, y - s * .5 * k, x + s * .15 * k, top + s * .16 * k);
    g.closePath(); g.fill();
    if (o.veil) { g.beginPath(); g.moveTo(x - s * .16, top - s * .06); g.quadraticCurveTo(x - s * .32, top + s * .5, x - s * .24, top + s * .8); g.lineTo(x - s * .05, top + s * .2); g.fill(); }
    if (o.raise) { // 두 팔을 들어 올림
      g.strokeStyle = col; g.lineWidth = s * .07; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x - s * .13, top + s * .28); g.lineTo(x - s * .34, top - s * .2 * o.raise); g.moveTo(x + s * .13, top + s * .28); g.lineTo(x + s * .34, top - s * .2 * o.raise); g.stroke();
    }
    if (o.reach) { // 한 팔을 앞으로 뻗음
      g.strokeStyle = col; g.lineWidth = s * .07; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x + s * .12 * o.reach, top + s * .3); g.lineTo(x + s * .52 * o.reach, top + s * .22); g.stroke();
    }
    if (o.staff) { g.strokeStyle = col; g.lineWidth = s * .045; g.beginPath(); g.moveTo(x + s * .3, y); g.lineTo(x + s * .36, top - s * .25); g.stroke(); }
    if (o.spear) { g.strokeStyle = col; g.lineWidth = s * .035; g.beginPath(); g.moveTo(x + s * .22, y - s * .1); g.lineTo(x + s * .3, top - s * .75); g.stroke(); g.beginPath(); g.moveTo(x + s * .3, top - s * .9); g.lineTo(x + s * .26, top - s * .7); g.lineTo(x + s * .34, top - s * .7); g.fill(); }
    if (o.horn) { g.strokeStyle = col; g.lineWidth = s * .06; g.beginPath(); g.moveTo(x + s * .08, top + s * .02); g.quadraticCurveTo(x + s * .4, top - s * .05, x + s * .55, top - s * .35); g.stroke(); }
  }
  function aura(g, x, y, r, c, a) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, rgba(c, a)); gr.addColorStop(.4, rgba(c, a * .35)); gr.addColorStop(1, rgba(c, 0));
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  // 깊이에 따른 대기 원근 색 (멀수록 하늘색에 녹음)
  // 멀리는 하늘빛에 녹고, 중간은 땅의 고유색(초록·황토), 가까이는 짙은 역광 실루엣
const depthCol = (pal, d, extra = 0) => { d = clamp(d + extra); return d < .55 ? mix(pal.haze, pal.land, Math.pow(d / .55, .9)) : mix(pal.land, pal.dark, Math.pow((d - .55) / .45, 1.1) * .92); };
const stoneCol = (pal, d) => mix(depthCol(pal, d), mix(hex('#d9c29a'), pal.light, .3), .38 * (1 - d * .6));

  // ── 레이어 그리기 ────────────────────────────────────
  const L = {
    hills(g, o, pal, p, t, c) {
      if (!c.pts) {
        const r = rng(o.seed ?? 3); c.pts = [];
        const n = 80, f1 = 1 + r() * 2, f2 = 4 + r() * 5, ph = r() * 9, ph2 = r() * 9;
        for (let i = 0; i <= n; i++) {
          const u = i / n, v = .55 + .3 * Math.sin(u * Math.PI * f1 + ph) + .15 * Math.sin(u * Math.PI * f2 + ph2) + (r() - .5) * .05;
          c.pts.push([-250 + u * (W + 500), v]);
        }
      }
      const y = o.y * H, amp = (o.amp ?? .08) * H, col = o.color ? hex(o.color) : depthCol(pal, o.depth ?? .5);
      g.beginPath(); g.moveTo(-250, H + 60);
      for (const [x, v] of c.pts) g.lineTo(x, y - v * amp);
      g.lineTo(W + 250, H + 60); g.closePath();
      const gr = g.createLinearGradient(0, y - amp, 0, H);
      gr.addColorStop(0, rgba(col)); gr.addColorStop(1, rgba(mix(col, pal.dark, .5)));
      g.fillStyle = gr; g.fill();
      if (o.rim !== false && pal.sun) { // 능선의 빛 테두리
        g.save(); g.strokeStyle = rgba(pal.light, .4 * (1 - (o.depth ?? .5))); g.lineWidth = 2; g.beginPath();
        c.pts.forEach(([x, v], i) => i ? g.lineTo(x, y - v * amp) : g.moveTo(x, y - v * amp)); g.stroke(); g.restore();
      }
    },
    mountain(g, o, pal, p, t) {
      const x = o.x * W, y = o.y * H, w = o.w * W, h = o.h * H, col = depthCol(pal, o.depth ?? .35);
      g.beginPath(); g.moveTo(x - w / 2, y); g.quadraticCurveTo(x - w * .2, y - h * .6, x - w * .04, y - h); g.quadraticCurveTo(x + w * .05, y - h * 1.02, x + w * .1, y - h * .9);
      g.quadraticCurveTo(x + w * .25, y - h * .5, x + w / 2, y); g.closePath();
      const gr = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
      gr.addColorStop(0, rgba(mix(col, pal.light, .25))); gr.addColorStop(.5, rgba(col)); gr.addColorStop(1, rgba(mix(col, pal.dark, .3)));
      g.fillStyle = gr; g.fill();
      const glow = val(o.glow, p);
      if (glow) { g.save(); g.globalCompositeOperation = 'lighter'; aura(g, x, y - h, w * .5, pal.sunRGB, .5 * glow); g.restore(); }
    },
    sea(g, o, pal, p, t, c) {
      const y = o.y * H, storm = val(o.storm, p);
      const gr = g.createLinearGradient(0, y, 0, H);
      gr.addColorStop(0, rgba(mix(pal.horizon, pal.haze, .3))); gr.addColorStop(.25, rgba(mix(pal.haze, pal.shadow, .5 + storm * .3)));
      gr.addColorStop(1, rgba(mix(pal.shadow, pal.dark, .55 + storm * .3)));
      g.fillStyle = gr; g.fillRect(-250, y, W + 500, H - y + 60);
      // 물결선
      g.save(); g.beginPath(); g.rect(-250, y, W + 500, H); g.clip();
      for (let i = 0; i < 26; i++) {
        const k = i / 26, yy = y + (H - y) * k * k + 2, a = 2 + k * (10 + storm * 40);
        g.strokeStyle = rgba(mix(pal.light, pal.haze, .4), (.08 + k * .12) * (1 - storm * .3));
        g.lineWidth = 1 + k * 2; g.beginPath();
        for (let x = -250; x <= W + 250; x += 20) {
          const yv = yy + Math.sin(x * (.012 - k * .006) + t * (1 + storm * 2) + i * 1.7) * a;
          x === -250 ? g.moveTo(x, yv) : g.lineTo(x, yv);
        }
        g.stroke();
        if (storm > .3 && i % 3 === 0) { // 흰 물마루
          g.fillStyle = rgba([235, 240, 245], .25 * storm);
          for (let x = -250; x < W + 250; x += 90) { const yv = yy + Math.sin(x * .01 + t * 3 + i) * a; g.fillRect(x + Math.sin(t + i + x) * 20, yv - 3, 30 + k * 40, 3 + k * 4); }
        }
      }
      // 햇빛 반짝임 기둥
      const sx = (pal.sun ? pal.sun[0] : pal.moon ? pal.moon[0] : .5) * W;
      if ((pal.sun || pal.moon) && storm < .7) {
        g.globalCompositeOperation = 'lighter';
        if (!c.gl) { const r = rng(9); c.gl = Array.from({ length: 160 }, () => [r(), r(), r()]); }
        for (const [a, b, ph] of c.gl) {
          const k = b * b, yy = y + 2 + k * (H - y), spread = 30 + k * 260, x = sx + (a - .5) * 2 * spread;
          const fl = .5 + .5 * Math.sin(t * 4 + ph * 30);
          g.fillStyle = rgba(pal.sunRGB, (.55 - k * .3) * fl * (1 - storm));
          g.fillRect(x, yy, 8 + k * 40, 1.5 + k * 3);
        }
      }
      g.restore();
    },
    river(g, o, pal, p, t) {
      const y = o.y * H, h = o.h * H, part = val(o.part, p), cx = (o.x ?? .5) * W;
      const gap = part * W * .22;
      const col = mix(pal.haze, pal.shadow, .5);
      g.fillStyle = rgba(mix(col, pal.dark, .2));
      g.fillRect(-250, y, W + 500, h);
      g.fillStyle = rgba(col);
      g.beginPath(); g.rect(-250, y, cx - gap - -250, h); g.rect(cx + gap, y, W + 250 - cx - gap, h); g.fill();
      if (part > .01) { // 마른 강바닥과 쌓인 물 벽
        g.fillStyle = rgba(mix(hex('#b49a74'), pal.dark, .35)); g.fillRect(cx - gap, y + 4, gap * 2, h - 4);
        g.save(); g.globalCompositeOperation = 'lighter';
        for (const side of [-1, 1]) {
          const ex = cx + side * gap; const gr = g.createLinearGradient(ex, 0, ex - side * 40, 0);
          gr.addColorStop(0, rgba(pal.light, .5 * part)); gr.addColorStop(1, rgba(pal.light, 0)); g.fillStyle = gr;
          g.fillRect(Math.min(ex, ex - side * 40), y - 18 * part, 40, h + 18 * part);
        }
        g.restore();
      }
      g.strokeStyle = rgba(pal.light, .25); g.lineWidth = 1.5;
      for (let i = 0; i < 5; i++) { g.beginPath(); for (let x = -250; x < W + 250; x += 24) { if (Math.abs(x - cx) < gap) { g.moveTo(x + 24, y); continue; } const yy = y + h * (i + .5) / 5 + Math.sin(x * .02 + t * 2 + i) * 2; g.lineTo(x, yy); } g.stroke(); }
    },
    dunes(g, o, pal) {
      const y = o.y * H; for (let i = 0; i < 3; i++) {
        const col = mix(mix(hex('#d8b07a'), pal.haze, .45 - i * .15), pal.dark, (o.depth ?? .4) * .5 + i * .18);
        g.fillStyle = rgba(col); g.beginPath(); g.moveTo(-250, H + 50);
        for (let x = -250; x <= W + 250; x += 40) g.lineTo(x, y + i * 40 - Math.sin(x * .004 + i * 2) * 30 - Math.sin(x * .011 + i) * 12);
        g.lineTo(W + 250, H + 50); g.fill();
      }
    },
    walls(g, o, pal, p, t, c) {
      const x = o.x * W, w = o.w * W, y = o.y * H, h = (o.h ?? .12) * H, col = stoneCol(pal, o.depth ?? .6);
      const fall = val(o.collapse, p);
      if (!c.blocks) {
        const r = rng(o.seed ?? 5); c.blocks = [];
        const cols = 14;
        for (let i = 0; i < cols; i++) {
          const bx = x - w / 2 + i * w / cols, tower = i % 4 === 1, bh = h * (tower ? 1.45 : 1) * (.95 + r() * .1);
          c.blocks.push({ bx, bw: w / cols + 1, bh, tower, dx: (r() - .5) * 60, dy: 60 + r() * 120, rot: (r() - .5) * .9, d: r() * .3 });
        }
      }
      g.save();
      for (const b of c.blocks) {
        const f = clamp((fall - b.d) / .7), ff = f * f;
        const hh = b.bh * (1 - ff * .62); // 무너진 뒤에도 잔해가 남음
        g.save();
        g.translate(b.bx + b.bw / 2 + b.dx * ff, y - hh); g.rotate(b.rot * ff * .5);
        g.fillStyle = rgba(mix(col, pal.dark, ff * .15)); g.fillRect(-b.bw / 2, 0, b.bw, hh);
        // 성가퀴
        if (ff < .5) for (let k = 0; k < 3; k++) g.fillRect(-b.bw / 2 + k * b.bw / 3, -h * .06, b.bw / 5, h * .06);
        g.fillStyle = rgba(pal.light, .18); g.fillRect(-b.bw / 2, 0, b.bw * .15, hh);
        if (b.tower && o.lights) { g.fillStyle = rgba(hex('#ffcf7a'), .8); g.fillRect(-3, b.bh * .25, 6, 9); }
        g.restore();
      }
      g.restore();
      if (fall > .05) { // 먼지 구름
        g.save(); for (let i = 0; i < 9; i++) { const dx = x - w / 2 + w * i / 8, r = 60 + 140 * fall; aura(g, dx + Math.sin(t + i) * 20, y - 20 - fall * 40, r, mix(hex('#c9ad88'), pal.haze, .4), .3 * Math.min(1, fall * 2) * (1 - fall * .5)); } g.restore();
      }
    },
    city(g, o, pal, p, t, c) {
      const x = o.x * W, w = o.w * W, y = o.y * H, col = stoneCol(pal, o.depth ?? .55), s = o.s ?? 1;
      if (!c.houses) {
        const r = rng(o.seed ?? 11); c.houses = []; let cx = x - w / 2;
        while (cx < x + w / 2) { const hw = (30 + r() * 50) * s, hh = (25 + r() * 55) * s; c.houses.push([cx, hw, hh, r() < .12, r(), r()]); cx += hw * (.7 + r() * .3); }
      }
      for (const [hx, hw, hh, dome, a, b] of c.houses) {
        g.fillStyle = rgba(mix(col, pal.dark, a * .15)); g.fillRect(hx, y - hh, hw, hh + 2);
        if (dome) { g.beginPath(); g.arc(hx + hw / 2, y - hh, hw * .38, Math.PI, 0); g.fill(); }
        g.fillStyle = rgba(pal.light, .15); g.fillRect(hx, y - hh, hw, 3);
        if (o.lights && b > .4) { g.fillStyle = rgba(hex('#ffd38a'), .55 + .3 * Math.sin(t * 2 + a * 9)); g.fillRect(hx + hw * .3, y - hh * .6, 5 * s, 7 * s); }
      }
    },
    temple(g, o, pal) {
      const x = o.x * W, y = o.y * H, s = o.s ?? 1, col = stoneCol(pal, o.depth ?? .5);
      g.fillStyle = rgba(col); g.fillRect(x - 220 * s, y - 40 * s, 440 * s, 40 * s); g.fillRect(x - 80 * s, y - 140 * s, 160 * s, 100 * s);
      g.fillStyle = rgba(pal.light, .22); g.fillRect(x - 80 * s, y - 140 * s, 160 * s, 4 * s); g.fillRect(x - 220 * s, y - 40 * s, 440 * s, 3 * s);
    },
    tents(g, o, pal, p, t, c) {
      const x = o.x * W, w = o.w * W, y = o.y * H, n = o.n ?? 8, s = o.s ?? 1, col = depthCol(pal, o.depth ?? .6);
      if (!c.t) { const r = rng(o.seed ?? 4); c.t = Array.from({ length: n }, (_, i) => [x - w / 2 + w * (i + r() * .6) / n, (.7 + r() * .6) * s, r()]); }
      for (const [tx, ts, a] of c.t) {
        g.fillStyle = rgba(mix(col, pal.dark, a * .2)); g.beginPath(); g.moveTo(tx - 40 * ts, y); g.lineTo(tx, y - 38 * ts); g.lineTo(tx + 44 * ts, y); g.fill();
        g.fillStyle = rgba(pal.light, .2); g.beginPath(); g.moveTo(tx - 40 * ts, y); g.lineTo(tx, y - 38 * ts); g.lineTo(tx - 10 * ts, y); g.fill();
        if (o.fires && a > .5) { g.save(); g.globalCompositeOperation = 'lighter'; aura(g, tx + 50 * ts, y - 6, 26 * ts, hex('#ffae55'), .6 + .2 * Math.sin(t * 7 + a * 9)); g.restore(); }
      }
    },
    trees(g, o, pal, p, t) {
      const col = rgba(depthCol(pal, o.depth ?? .8, .05)), s = o.s ?? 1, y = o.y * H;
      g.fillStyle = col; g.strokeStyle = col;
      for (const [i, tx] of (o.xs || [.1]).entries()) {
        const x = tx * W, k = s * (.85 + (i % 3) * .12), sway = Math.sin(t * .8 + i) * 4 * k;
        if (o.kind === 'palm') {
          g.lineWidth = 9 * k; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 18 * k, y - 110 * k, x + 8 * k + sway, y - 200 * k); g.stroke();
          const tx2 = x + 8 * k + sway, ty = y - 200 * k; g.lineWidth = 5 * k;
          for (let f = 0; f < 8; f++) { const a = -Math.PI + f / 7 * Math.PI + Math.sin(t + f) * .04; g.beginPath(); g.moveTo(tx2, ty); g.quadraticCurveTo(tx2 + Math.cos(a) * 60 * k, ty + Math.sin(a) * 50 * k - 25 * k, tx2 + Math.cos(a) * 105 * k, ty + Math.sin(a) * 40 * k + 30 * k); g.stroke(); }
        } else {
          g.lineWidth = 8 * k; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x - 10 * k, y - 40 * k, x + 4 * k, y - 70 * k); g.stroke();
          for (const [dx, dy, r] of [[0, -95, 48], [-40, -80, 36], [42, -82, 38], [-18, -120, 32], [22, -118, 30]]) { g.beginPath(); g.arc(x + dx * k + sway * .5, y + dy * k, r * k, 0, 7); g.fill(); }
        }
      }
    },
    boat(g, o, pal, p, t) {
      const x = (o.x + val(o.dx, p) * (o.move ?? 0)) * W, y = o.y * H, s = o.s ?? 1, storm = val(o.storm, p);
      const rock = Math.sin(t * (1.2 + storm * 2)) * (.03 + storm * .18);
      const col = rgba(depthCol(pal, o.depth ?? .85, .05));
      g.save(); g.translate(x, y + Math.sin(t * 1.5) * (3 + storm * 14)); g.rotate(rock);
      g.fillStyle = col; g.beginPath(); g.moveTo(-150 * s, -30 * s); g.quadraticCurveTo(0, 30 * s, 160 * s, -36 * s); g.lineTo(130 * s, -8 * s); g.quadraticCurveTo(0, 22 * s, -125 * s, -6 * s); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(-150 * s, -30 * s); g.quadraticCurveTo(0, 18 * s, 160 * s, -36 * s); g.lineTo(150 * s, -26 * s); g.quadraticCurveTo(0, 26 * s, -140 * s, -22 * s); g.fill();
      g.lineWidth = 5 * s; g.strokeStyle = col; g.beginPath(); g.moveTo(10 * s, -20 * s); g.lineTo(14 * s, -200 * s); g.stroke();
      if (o.sail !== false) { g.beginPath(); g.moveTo(16 * s, -195 * s); g.quadraticCurveTo(80 * s + storm * 30 * s, -120 * s, 20 * s, -40 * s); g.closePath(); g.fillStyle = rgba(mix(pal.light, pal.shadow, .45), .85); g.fill(); }
      for (let i = 0; i < (o.crew ?? 5); i++) person(g, (-100 + i * 42) * s, -14 * s, 38 * s, col, { raise: storm > .5 && i % 2 ? .8 : 0 });
      g.restore();
    },
    figure(g, o, pal, p, t) {
      const x = (o.x + val(o.dx, p, 0) * (o.move ?? 0)) * W, y = (o.y + val(o.dy, p, 0) * (o.rise ?? 0)) * H, s = (o.s ?? 1) * 110;
      const col = depthCol(pal, o.depth ?? .9, .05);
      const glow = val(o.glow, p, o.kind === 'jesus' ? .7 : 0);
      if (glow) { g.save(); g.globalCompositeOperation = 'lighter'; aura(g, x, y - s * 1.05, s * 1.5, pal.sunRGB.map(v => Math.min(255, v + 10)), .32 * glow); aura(g, x, y - s * 1.6, s * .45, [255, 248, 228], .5 * glow); g.restore(); }
      const robe = o.kind === 'jesus' ? mix(col, pal.light, .3) : col;
      person(g, x, y, s, rgba(robe), { kind: o.pose, raise: val(o.raise, p, 0), reach: o.reach ? val(o.reach, p, 1) * (o.face ?? 1) : 0, staff: o.staff, veil: o.veil, spear: o.spear, horn: o.horn });
      g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = rgba(pal.light, .45); g.lineWidth = 1.6; // 역광 윤곽
      g.beginPath(); g.moveTo(x + s * .14, y - s * 1.55); g.quadraticCurveTo(x + s * .3, y - s * .5, x + s * .27, y); g.stroke(); g.restore();
    },
    crowd(g, o, pal, p, t, c) {
      const x = o.x * W, w = o.w * W, y = o.y * H, n = o.n ?? 30, s = (o.s ?? .5) * 110, col = depthCol(pal, o.depth ?? .75, .04);
      const appear = val(o.appear, p, 1);
      if (!c.ppl) { const r = rng(o.seed ?? 21); c.ppl = Array.from({ length: n }, () => [r(), r(), r(), r()]).sort((a, b) => a[1] - b[1]); }
      for (const [a, b, k, v] of c.ppl) {
        if (k > appear) continue;
        const px = x - w / 2 + a * w, py = y + b * s * .5, ss = s * (.8 + b * .35);
        person(g, px + Math.sin(t * .7 + k * 9) * 1.5, py, ss, rgba(mix(col, pal.dark, b * .25)), { kind: v < .12 ? 'child' : v < .2 ? 'kneel' : null, raise: o.raise ? val(o.raise, p) * (v > .5 ? 1 : 0) : 0, veil: v > .7 && v < .85 });
      }
    },
    army(g, o, pal, p, t, c) {
      const march = val(o.march, p, 0) * (o.dist ?? 0);
      const x = (o.x + march) * W, w = o.w * W, y = o.y * H, n = o.n ?? 40, s = (o.s ?? .45) * 110, col = depthCol(pal, o.depth ?? .8, .05);
      const flee = val(o.flee, p, 0);
      if (!c.sol) { const r = rng(o.seed ?? 33); c.sol = Array.from({ length: n }, () => [r(), r(), r()]).sort((a, b) => a[1] - b[1]); }
      for (const [a, b, k] of c.sol) {
        const px = x - w / 2 + a * w + Math.sin(t * 6 + k * 20) * (march ? 2 : 0) + flee * (a - .5) * 300 * k, py = y + b * s * .4;
        person(g, px, py + Math.abs(Math.sin(t * 6 + k * 30)) * (march ? -3 : 0), s * (.85 + b * .3), rgba(mix(col, pal.dark, b * .2)), { spear: o.spears !== false && k > .3, horn: o.horns && k < .2, raise: o.shout ? val(o.shout, p) * (k > .5 ? 1 : 0) : 0 });
      }
      if (o.banners) { g.fillStyle = rgba(hex(o.bannerColor || '#a8443a'), .85); for (let i = 0; i < 3; i++) { const bx = x - w / 3 + i * w / 3, by = y - s * 2.4; g.fillRect(bx, by - 70, 3, 90); g.beginPath(); g.moveTo(bx + 3, by - 70); g.quadraticCurveTo(bx + 30, by - 64 + Math.sin(t * 3 + i) * 6, bx + 50, by - 58); g.lineTo(bx + 3, by - 40); g.fill(); } }
    },
    ark(g, o, pal, p, t) {
      const x = (o.x + val(o.dx, p, 0) * (o.move ?? 0)) * W, y = o.y * H, s = o.s ?? 1, col = depthCol(pal, .9, .05);
      for (const dx of [-70, -25, 25, 70]) person(g, x + dx * s, y, 70 * s, rgba(col));
      g.save(); g.globalCompositeOperation = 'lighter'; aura(g, x, y - 115 * s, 120 * s, hex('#ffd98c'), .55 + .15 * Math.sin(t * 2)); g.restore();
      g.fillStyle = rgba(hex('#d6a94e')); g.fillRect(x - 50 * s, y - 130 * s, 100 * s, 38 * s);
      g.fillStyle = rgba(hex('#f4d488')); g.fillRect(x - 54 * s, y - 136 * s, 108 * s, 8 * s);
      g.strokeStyle = rgba(hex('#8a6a2e')); g.lineWidth = 5 * s; g.beginPath(); g.moveTo(x - 110 * s, y - 102 * s); g.lineTo(x + 110 * s, y - 102 * s); g.stroke();
      g.fillStyle = rgba(hex('#f0cf7c')); for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(x + sx * 40 * s, y - 136 * s); g.quadraticCurveTo(x + sx * 10 * s, y - 175 * s, x + sx * 2 * s, y - 150 * s); g.lineTo(x + sx * 28 * s, y - 136 * s); g.fill(); }
    },
    well(g, o, pal) {
      const x = o.x * W, y = o.y * H, s = o.s ?? 1, col = depthCol(pal, .85, .05);
      g.fillStyle = rgba(col); g.fillRect(x - 70 * s, y - 70 * s, 140 * s, 70 * s);
      g.beginPath(); g.ellipse(x, y - 70 * s, 70 * s, 18 * s, 0, 0, 7); g.fillStyle = rgba(mix(col, pal.light, .25)); g.fill();
      g.beginPath(); g.ellipse(x, y - 70 * s, 55 * s, 12 * s, 0, 0, 7); g.fillStyle = rgba(pal.dark); g.fill();
      g.fillStyle = rgba(col); g.fillRect(x - 64 * s, y - 160 * s, 8 * s, 90 * s); g.fillRect(x + 56 * s, y - 160 * s, 8 * s, 90 * s); g.fillRect(x - 70 * s, y - 166 * s, 140 * s, 8 * s);
    },
    jars(g, o, pal, p, t) {
      const x = o.x * W, y = o.y * H, s = o.s ?? 1, wine = val(o.wine, p, 0), col = depthCol(pal, .85, .05);
      for (let i = 0; i < 6; i++) {
        const jx = x + (i - 2.5) * 72 * s;
        g.fillStyle = rgba(mix(col, pal.light, .15)); g.beginPath(); g.moveTo(jx - 22 * s, y - 120 * s); g.quadraticCurveTo(jx - 44 * s, y - 60 * s, jx - 24 * s, y); g.lineTo(jx + 24 * s, y); g.quadraticCurveTo(jx + 44 * s, y - 60 * s, jx + 22 * s, y - 120 * s); g.fill();
        const k = clamp(wine * 1.4 - i * .08);
        g.beginPath(); g.ellipse(jx, y - 120 * s, 22 * s, 6 * s, 0, 0, 7); g.fillStyle = rgba(mix(hex('#8fc6e0'), hex('#8e1d3a'), k)); g.fill();
        if (k > 0 && k < 1) { g.save(); g.globalCompositeOperation = 'lighter'; aura(g, jx, y - 122 * s, 50 * s, hex('#ff8fa6'), .6 * Math.sin(k * Math.PI)); g.restore(); }
      }
    },
    baskets(g, o, pal, p, t) {
      const x = o.x * W, y = o.y * H, s = o.s ?? 1, n = Math.round((o.n ?? 12) * val(o.grow, p, 1)), col = depthCol(pal, .85, .05);
      for (let i = 0; i < n; i++) {
        const bx = x + ((i % 6) - 2.5) * 70 * s, by = y + Math.floor(i / 6) * 34 * s;
        g.save(); g.globalCompositeOperation = 'lighter'; aura(g, bx, by - 40 * s, 60 * s, hex('#ffd68c'), .35); g.restore();
        g.fillStyle = rgba(hex('#e8c98a')); g.beginPath(); g.arc(bx, by - 34 * s, 24 * s, Math.PI, 0); g.fill();
        g.fillStyle = rgba(mix(hex('#8b6a3d'), col, .4)); g.beginPath(); g.moveTo(bx - 32 * s, by - 34 * s); g.lineTo(bx + 32 * s, by - 34 * s); g.lineTo(bx + 24 * s, by); g.lineTo(bx - 24 * s, by); g.fill();
      }
    },
    tomb(g, o, pal, p, t) {
      const x = o.x * W, y = o.y * H, s = o.s ?? 1, open = val(o.open, p, 0), col = depthCol(pal, .7, .05);
      g.fillStyle = rgba(col); g.beginPath(); g.moveTo(x - 300 * s, y); g.quadraticCurveTo(x - 260 * s, y - 260 * s, x, y - 280 * s); g.quadraticCurveTo(x + 280 * s, y - 250 * s, x + 320 * s, y); g.fill();
      g.fillStyle = rgba(pal.dark); g.beginPath(); g.arc(x, y - 70 * s, 70 * s, Math.PI, 0); g.lineTo(x + 70 * s, y); g.lineTo(x - 70 * s, y); g.fill();
      if (open > 0) { g.save(); g.globalCompositeOperation = 'lighter'; aura(g, x, y - 60 * s, 260 * s * open, hex('#fff1cf'), .9 * open);
        for (let i = 0; i < 9; i++) { const a = -Math.PI * (.15 + i / 8 * .7); g.fillStyle = rgba(hex('#fff3d8'), .08 * open); g.beginPath(); g.moveTo(x, y - 60 * s); g.lineTo(x + Math.cos(a - .05) * 700, y - 60 * s + Math.sin(a - .05) * 700); g.lineTo(x + Math.cos(a + .05) * 700, y - 60 * s + Math.sin(a + .05) * 700); g.fill(); }
        g.restore(); }
      const sx = x + open * 150 * s; g.fillStyle = rgba(mix(col, pal.light, .15)); g.beginPath(); g.arc(sx, y - 72 * s, 78 * s, 0, 7); g.fill();
      g.strokeStyle = rgba(pal.dark, .4); g.lineWidth = 3; g.beginPath(); g.arc(sx, y - 72 * s, 60 * s, 0, 7); g.stroke();
    },
    pool(g, o, pal, p, t) {
      const x = o.x * W, y = o.y * H, w = (o.w ?? .5) * W, s = o.s ?? 1, col = depthCol(pal, .7, .05), stir = val(o.stir, p, 0);
      g.fillStyle = rgba(mix(pal.haze, pal.shadow, .4)); g.fillRect(x - w / 2, y - 30 * s, w, 60 * s);
      g.strokeStyle = rgba(pal.light, .35 + stir * .4); g.lineWidth = 2;
      for (let i = 0; i < 4; i++) { g.beginPath(); for (let px = x - w / 2; px < x + w / 2; px += 16) g.lineTo(px, y - 20 * s + i * 14 * s + Math.sin(px * .03 + t * (2 + stir * 5) + i) * (2 + stir * 6)); g.stroke(); }
      g.fillStyle = rgba(col); const n = 9;
      for (let i = 0; i < n; i++) { const cx = x - w / 2 + i * w / (n - 1); g.fillRect(cx - 8 * s, y - 230 * s, 16 * s, 200 * s); }
      g.fillRect(x - w / 2 - 20, y - 250 * s, w + 40, 24 * s);
    },
    sycamore(g, o, pal, p, t) {
      const x = o.x * W, y = o.y * H, s = o.s ?? 1, col = rgba(depthCol(pal, .85, .05));
      g.fillStyle = col; g.strokeStyle = col; g.lineWidth = 26 * s; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + 10 * s, y - 160 * s); g.moveTo(x + 10 * s, y - 140 * s); g.lineTo(x - 90 * s, y - 230 * s); g.moveTo(x + 10 * s, y - 150 * s); g.lineTo(x + 110 * s, y - 240 * s); g.stroke();
      for (const [dx, dy, r] of [[0, -300, 120], [-130, -260, 90], [140, -270, 95], [-60, -340, 80], [70, -350, 80]]) { g.beginPath(); g.arc(x + dx * s + Math.sin(t + dx) * 3, y + dy * s, r * s, 0, 7); g.fill(); }
      if (o.person) person(g, x - 70 * s, y - 228 * s, 48 * s, rgba(mix(depthCol(pal, .85), pal.light, .25)));
    },
    stones(g, o, pal) {
      const x = o.x * W, y = o.y * H, s = o.s ?? 1, col = depthCol(pal, .8, .05);
      const pos = [[-60, 0, 30], [-5, 0, 32], [52, 0, 30], [-88, 0, 22], [86, 0, 24], [-34, -42, 28], [22, -44, 28], [-62, -30, 18], [60, -34, 20], [-6, -82, 26], [-40, -76, 16], [30, -80, 16]];
      for (const [dx, dy, r] of pos) { g.fillStyle = rgba(mix(col, pal.light, .12)); g.beginPath(); g.ellipse(x + dx * s, y + (dy - r * .7) * s, r * 1.2 * s, r * .8 * s, 0, 0, 7); g.fill(); g.fillStyle = rgba(pal.light, .2); g.beginPath(); g.ellipse(x + (dx - r * .3) * s, y + (dy - r) * s, r * .5 * s, r * .25 * s, 0, 0, 7); g.fill(); }
    },
    chariots(g, o, pal, p, t, c) {
      const x = o.x * W, w = o.w * W, y = o.y * H, n = o.n ?? 5, s = o.s ?? 1, col = rgba(depthCol(pal, o.depth ?? .75, .05)), burn = val(o.burn, p, 0);
      g.fillStyle = col; g.strokeStyle = col;
      for (let i = 0; i < n; i++) {
        const cx = x - w / 2 + w * (i + .5) / n, k = s * (1 - (i % 2) * .12), cy = y + (i % 2) * 12;
        g.lineWidth = 4 * k; g.beginPath(); g.arc(cx, cy - 28 * k, 26 * k, 0, 7); g.stroke();
        g.fillRect(cx - 30 * k, cy - 70 * k, 50 * k, 34 * k);
        if (!o.noHorses) { g.beginPath(); g.ellipse(cx - 85 * k, cy - 52 * k, 34 * k, 15 * k, 0, 0, 7); g.fill(); g.beginPath(); g.moveTo(cx - 112 * k, cy - 58 * k); g.lineTo(cx - 130 * k, cy - 92 * k); g.lineTo(cx - 116 * k, cy - 96 * k); g.lineTo(cx - 100 * k, cy - 62 * k); g.fill();
          g.lineWidth = 4 * k; for (const lx of [-108, -96, -74, -62]) { g.beginPath(); g.moveTo(cx + lx * k, cy - 45 * k); g.lineTo(cx + lx * k + Math.sin(t * 8 + lx) * 4, cy); g.stroke(); } }
        if (burn > 0) { g.save(); g.globalCompositeOperation = 'lighter'; aura(g, cx, cy - 60 * k, 90 * k * burn, hex('#ff8a3a'), .7 * burn); g.restore(); g.fillStyle = col; }
      }
    },
    altar(g, o, pal, p, t) {
      const x = o.x * W, y = o.y * H, s = o.s ?? 1, col = depthCol(pal, .85, .05);
      for (let r = 0; r < 4; r++) for (let i = 0; i < 4 - r; i++) { g.fillStyle = rgba(mix(col, pal.light, (i + r) % 2 * .1)); g.beginPath(); g.ellipse(x + (i - (3 - r) / 2) * 44 * s, y - 18 * s - r * 30 * s, 24 * s, 16 * s, 0, 0, 7); g.fill(); }
      if (o.fire) { g.save(); g.globalCompositeOperation = 'lighter'; aura(g, x, y - 150 * s, 110 * s, hex('#ffa64a'), .7 + .15 * Math.sin(t * 9)); g.restore(); }
    },
    cave(g, o, pal) {
      const x = o.x * W, y = o.y * H, s = o.s ?? 1, col = depthCol(pal, .7, .05);
      g.fillStyle = rgba(col); g.beginPath(); g.moveTo(x - 280 * s, y); g.lineTo(x - 200 * s, y - 230 * s); g.lineTo(x + 160 * s, y - 250 * s); g.lineTo(x + 300 * s, y); g.fill();
      g.fillStyle = rgba(pal.dark); g.beginPath(); g.moveTo(x - 80 * s, y); g.quadraticCurveTo(x - 70 * s, y - 140 * s, x, y - 140 * s); g.quadraticCurveTo(x + 80 * s, y - 130 * s, x + 90 * s, y); g.fill();
    },
    road(g, o, pal) {
      const y = o.y * H, col = mix(hex('#d8c09a'), pal.haze, .35);
      g.fillStyle = rgba(mix(col, pal.dark, .25)); g.beginPath(); g.moveTo(W * .44, y); g.lineTo(W * .56, y); g.lineTo(W * .9, H + 40); g.lineTo(W * .1, H + 40); g.fill();
    },
  };

  // ── 효과 ─────────────────────────────────────────────
  const FX = {
    rays(g, o, pal, p, t) {
      const src = o.at ? [o.at[0] * W, o.at[1] * H] : pal.sun ? [pal.sun[0] * W, pal.sun[1] * H] : null; if (!src) return;
      const st = val(o.strength, p, 1); g.save(); g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + t * .03 + Math.sin(i * 7.1) * .2, wdt = .03 + .05 * Math.abs(Math.sin(i * 3.3)), len = 1800;
        const gr = g.createLinearGradient(src[0], src[1], src[0] + Math.cos(a) * len, src[1] + Math.sin(a) * len);
        gr.addColorStop(0, rgba(pal.sunRGB, .16 * st * (.5 + .5 * Math.sin(t * .5 + i)))); gr.addColorStop(1, rgba(pal.sunRGB, 0));
        g.fillStyle = gr; g.beginPath(); g.moveTo(src[0], src[1]); g.lineTo(src[0] + Math.cos(a - wdt) * len, src[1] + Math.sin(a - wdt) * len); g.lineTo(src[0] + Math.cos(a + wdt) * len, src[1] + Math.sin(a + wdt) * len); g.fill();
      }
      g.restore();
    },
    beam(g, o, pal, p, t) { // 하늘에서 내려오는 빛기둥
      const x = o.x * W, k = val(o.on, p, 1); if (!k) return; g.save(); g.globalCompositeOperation = 'lighter';
      const gr = g.createLinearGradient(x - 120, 0, x + 120, 0); gr.addColorStop(0, rgba(pal.sunRGB, 0)); gr.addColorStop(.5, rgba([255, 247, 225], .35 * k)); gr.addColorStop(1, rgba(pal.sunRGB, 0));
      g.fillStyle = gr; g.beginPath(); g.moveTo(x - 60, 0); g.lineTo(x + 60, 0); g.lineTo(x + (o.w ?? 160), (o.y ?? .8) * H); g.lineTo(x - (o.w ?? 160), (o.y ?? .8) * H); g.fill(); g.restore();
    },
    motes(g, o, pal, p, t, c) {
      if (!c.m) { const r = rng(o.seed ?? 77); c.m = Array.from({ length: o.n ?? 60 }, () => [r(), r(), r(), r()]); }
      const col = o.color ? hex(o.color) : pal.sunRGB; g.save(); g.globalCompositeOperation = 'lighter';
      for (const [a, b, k, ph] of c.m) {
        const x = ((a + Math.sin(t * .2 + ph * 9) * .02) % 1) * W, y = (((b - t * (.01 + k * .025)) % 1) + 1) % 1 * H;
        const tw = .4 + .6 * Math.sin(t * 2 + ph * 20); aura(g, x, y, 3 + k * 9, col, .5 * tw * val(o.on, p, 1));
      }
      g.restore();
    },
    rain(g, o, pal, p, t, c) {
      const k = val(o.on, p, 1); if (k <= 0) return;
      if (!c.r) { const r = rng(5); c.r = Array.from({ length: 420 }, () => [r(), r(), r()]); }
      g.save(); g.strokeStyle = rgba(hex('#c8d4e2'), .32 * k); g.lineWidth = 1.2; g.beginPath();
      for (const [a, b, s] of c.r) { if (s > k) continue; const x = (a * (W + 400) - 200 + t * 300) % (W + 400) - 200, y = ((b + t * (1.8 + s)) % 1) * (H + 60) - 30; g.moveTo(x, y); g.lineTo(x - 14, y + 38); }
      g.stroke(); g.restore();
    },
    lightning(g, o, pal, p, t) {
      const k = val(o.on, p, 1), period = 3.2, ph = t % period; if (k <= 0 || ph > .35) return;
      const seed = Math.floor(t / period), r = rng(seed + 3), x0 = (.2 + r() * .6) * W;
      g.save(); g.fillStyle = rgba([220, 230, 255], (.35 - ph) * .8 * k); g.fillRect(0, 0, W, H);
      g.strokeStyle = rgba([245, 248, 255], .95 * k); g.lineWidth = 3; g.shadowColor = '#cfe0ff'; g.shadowBlur = 25; g.beginPath(); let x = x0, y = 0; g.moveTo(x, y);
      while (y < H * .55) { x += (r() - .5) * 80; y += 30 + r() * 40; g.lineTo(x, y); } g.stroke(); g.restore();
    },
    hail(g, o, pal, p, t, c) {
      const k = val(o.on, p, 1); if (k <= 0) return;
      if (!c.h) { const r = rng(15); c.h = Array.from({ length: 110 }, () => [r(), r(), r()]); }
      g.save(); g.globalCompositeOperation = 'lighter';
      for (const [a, b, s] of c.h) { if (s > k) continue; const x = (o.x0 ?? .3) * W + a * (o.w ?? .7) * W + ((t * 120 * (1 + s)) % 200), y = ((b + t * (.6 + s * .5)) % 1) * H * (o.yMax ?? .8);
        g.strokeStyle = rgba([210, 230, 255], .25); g.lineWidth = 3; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 30, y - 70); g.stroke(); aura(g, x, y, 7 + s * 6, [235, 245, 255], .9); }
      g.restore();
    },
    sunstill(g, o, pal, p, t) { // 해가 머무름: 해 주위의 고리와 큰 광륜
      const src = pal.sun ? [pal.sun[0] * W, pal.sun[1] * H] : [W / 2, H * .3], k = val(o.on, p, 1);
      g.save(); g.globalCompositeOperation = 'lighter'; aura(g, src[0], src[1], 420 * k, pal.sunRGB, .55 * k);
      for (let i = 0; i < 4; i++) { const ph = (t * .25 + i / 4) % 1; g.strokeStyle = rgba(pal.sunRGB, (1 - ph) * .45 * k); g.lineWidth = 3; g.beginPath(); g.arc(src[0], src[1], 80 + ph * 520, 0, 7); g.stroke(); }
      g.restore();
      if (o.moon) { g.save(); g.globalAlpha = .7 * k; g.fillStyle = '#eef1ff'; g.beginPath(); g.arc(o.moon[0] * W, o.moon[1] * H, 30, 0, 7); g.fill(); g.restore(); }
    },
    dust(g, o, pal, p, t) { const k = val(o.on, p, 1); if (k <= 0) return; for (let i = 0; i < 8; i++) aura(g, (o.x + (i - 4) * .04) * W + Math.sin(t + i) * 30, o.y * H - k * 40 * (i % 3), 120 + 180 * k, mix(hex('#c9ad88'), pal.haze, .4), .35 * k); },
    smoke(g, o, pal, p, t) { const k = val(o.on, p, 1); if (k <= 0) return; for (let i = 0; i < 14; i++) { const ph = ((t * .08 + i / 14) % 1); aura(g, (o.x + Math.sin(i * 3) * (o.w ?? .1)) * W + ph * 80, o.y * H - ph * H * .6, 80 + ph * 220, mix(hex('#3a3034'), pal.haze, .25 + ph * .4), .4 * (1 - ph) * k); } },
    embers(g, o, pal, p, t, c) {
      const k = val(o.on, p, 1); if (k <= 0) return;
      if (!c.e) { const r = rng(44); c.e = Array.from({ length: 90 }, () => [r(), r(), r()]); }
      g.save(); g.globalCompositeOperation = 'lighter';
      for (const [a, b, s] of c.e) { const ph = (b + t * (.15 + s * .2)) % 1, x = (o.x - (o.w ?? .3) / 2 + a * (o.w ?? .3)) * W + Math.sin(t * 2 + a * 20) * 20, y = o.y * H - ph * H * .7; aura(g, x, y, 4 + s * 6, hex('#ffa046'), (1 - ph) * k); }
      g.restore();
    },
    glow(g, o, pal, p, t) { const k = val(o.on, p, 1); if (k <= 0) return; g.save(); g.globalCompositeOperation = 'lighter'; aura(g, o.x * W, o.y * H, (o.r ?? .15) * W * (1 + .05 * Math.sin(t * 3)), o.color ? hex(o.color) : [255, 240, 205], (o.a ?? .7) * k); g.restore(); },
    shout(g, o, pal, p, t) { const k = val(o.on, p, 1); if (k <= 0) return; g.save(); for (let i = 0; i < 5; i++) { const ph = (t * .6 + i / 5) % 1; g.strokeStyle = rgba(pal.light, (1 - ph) * .5 * k); g.lineWidth = 4; g.beginPath(); g.ellipse(o.x * W, o.y * H, 60 + ph * 700, 20 + ph * 220, 0, Math.PI, 0); g.stroke(); } g.restore(); },
    flash(g, o, pal, p) { const k = 1 - Math.abs(clamp((p - o.at) / .06, -1, 1)); if (k > 0) { g.fillStyle = rgba([255, 250, 238], k * (o.a ?? .85)); g.fillRect(0, 0, W, H); } },
    birds(g, o, pal, p, t, c) {
      if (!c.b) { const r = rng(o.seed ?? 8); c.b = Array.from({ length: o.n ?? 9 }, () => [r(), r(), r()]); }
      g.save(); g.strokeStyle = rgba(mix(pal.dark, pal.shadow, .3), .8); g.lineWidth = 2.2; g.lineCap = 'round';
      for (const [a, b, s] of c.b) { const x = ((a + t * (.015 + s * .01)) % 1.2 - .1) * W, y = (o.y ?? .25) * H + b * 120 + Math.sin(t + a * 9) * 8, wg = Math.sin(t * 8 + a * 30) * 6, sz = 8 + s * 8;
        g.beginPath(); g.moveTo(x - sz, y - wg); g.quadraticCurveTo(x - sz * .4, y - sz * .4, x, y); g.quadraticCurveTo(x + sz * .4, y - sz * .4, x + sz, y - wg); g.stroke(); }
      g.restore();
    },
    wind(g, o, pal, p, t) { const k = val(o.on, p, 1); if (k <= 0) return; g.save(); g.strokeStyle = rgba(pal.light, .18 * k); g.lineWidth = 2; for (let i = 0; i < 22; i++) { const y = (i * 53 % H), x = ((t * 900 + i * 337) % (W + 600)) - 300; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 120, y - 10, x + 260, y + 4); g.stroke(); } g.restore(); },
    flare(g, o, pal) {
      const src = pal.sun ? [pal.sun[0] * W, pal.sun[1] * H] : null; if (!src) return;
      const cx = W / 2, cy = H / 2; g.save(); g.globalCompositeOperation = 'lighter';
      [[.3, 40, .12], [.55, 18, .2], [.8, 70, .07], [1.25, 30, .12], [1.5, 110, .05]].forEach(([k, r, a], i) => {
        const x = src[0] + (cx - src[0]) * k * 2, y = src[1] + (cy - src[1]) * k * 2;
        aura(g, x, y, r, i % 2 ? [160, 220, 255] : [255, 210, 160], a * (o.a ?? 1) * 2.4);
      });
      const st = g.createLinearGradient(src[0] - 600, 0, src[0] + 600, 0); // 부드러운 가로 광선
      st.addColorStop(0, rgba(pal.sunRGB, 0)); st.addColorStop(.5, rgba(pal.sunRGB, .22)); st.addColorStop(1, rgba(pal.sunRGB, 0));
      g.fillStyle = st; g.beginPath(); g.ellipse(src[0], src[1], 600, 5, 0, 0, 7); g.fill();
      g.restore();
    },
  };

  // ── 장면 그리기 ──────────────────────────────────────
  function drawSky(g, pal, name, alpha) {
    const s = SKY[name] || SKY.day; g.save(); g.globalAlpha = alpha;
    const gr = g.createLinearGradient(0, 0, 0, H * .8); for (const [k, c] of s.stops) gr.addColorStop(k, c);
    g.fillStyle = gr; g.fillRect(0, 0, W, H); g.restore();
  }
  function drawBeat(g, beat, p, t) {
    const c = cacheOf(beat);
    let pal = palette(beat.sky);
    let k2 = 0;
    if (beat.skyTo) { k2 = ramp(p, beat.skyAt || [.3, .8]); pal = mixPal(pal, palette(beat.skyTo), k2); }
    if (beat.sun !== undefined) pal.sun = beat.sun;
    if (k2 > .5 && beat.skyTo && SKY[beat.skyTo].sun && beat.sun === undefined) pal.sun = SKY[beat.skyTo].sun;
    if (!pal.sun && beat.skyTo && SKY[beat.skyTo].sun && k2 > 0 && beat.sun === undefined) pal.sun = SKY[beat.skyTo].sun;

    // 카메라: 아주 천천히 다가가며 옆으로 흐름 (Ken Burns)
    const cam = beat.cam || {}, zoom = lerp(cam.z0 ?? 1.02, cam.z1 ?? 1.1, ease(p)), panX = lerp(cam.x0 ?? -20, cam.x1 ?? 20, p), panY = lerp(cam.y0 ?? 0, cam.y1 ?? -8, p);
    let shake = 0; (beat.fx || []).forEach(f => { if (f.type === 'shake') shake = Math.max(shake, val(f.on, p, 1) * (f.amp ?? 10)); });
    const sx = shake ? Math.sin(t * 61) * shake : 0, sy = shake ? Math.cos(t * 47) * shake : 0;
    const scale = g.canvas.width / W;
    // 깊이 d(0=하늘, 1=가장 가까움)에 따라 확대·이동량을 달리해 시차(패럴랙스)를 만듦
    const apply = d => { const z = 1 + (zoom - 1) * (.3 + d), tx = W / 2 + sx * d + z * (-W / 2 + panX * d), ty = H / 2 + sy * d + z * (-H / 2 + panY * d); g.setTransform(scale * z, 0, 0, scale * z, scale * tx, scale * ty); };
    g.save();
    // 하늘
    apply(0); drawSky(g, pal, beat.sky, 1); if (beat.skyTo) drawSky(g, pal, beat.skyTo, k2);
    // 별
    if (pal.stars > .01) {
      if (!c.stars) { const r = rng(99); c.stars = Array.from({ length: 220 }, () => [r(), r() * .6, r(), r()]); }
      for (const [a, b, s, ph] of c.stars) { g.fillStyle = rgba([235, 240, 255], pal.stars * (.3 + .7 * Math.abs(Math.sin(t * (.5 + s) + ph * 9)))); g.fillRect(a * W, b * H, 1 + s * 1.6, 1 + s * 1.6); }
    }
    // 해 / 달
    if (pal.sun) { g.save(); g.globalCompositeOperation = 'lighter'; const [x, y] = [pal.sun[0] * W, pal.sun[1] * H]; aura(g, x, y, 520, pal.sunRGB, .35); aura(g, x, y, 140, pal.sunRGB, .7); aura(g, x, y, 46, [255, 255, 250], 1); g.restore(); }
    const moon = (SKY[beat.sky] || {}).moon || (beat.skyTo && SKY[beat.skyTo].moon);
    if (moon && (pal.stars > .3)) { const [x, y] = [moon[0] * W, moon[1] * H]; g.save(); g.globalCompositeOperation = 'lighter'; aura(g, x, y, 160, [190, 210, 255], .35); g.restore(); g.fillStyle = '#f3f4ff'; g.beginPath(); g.arc(x, y, 34, 0, 7); g.fill(); g.fillStyle = 'rgba(200,210,240,.35)'; g.beginPath(); g.arc(x - 9, y - 6, 8, 0, 7); g.arc(x + 10, y + 9, 6, 0, 7); g.fill(); }

    // 구름: 하늘 프리셋마다 한 벌씩 만들어 두고, 하늘이 바뀌면 서로 겹쳐 전환
    const nClouds = beat.clouds ?? 6;
    if (nClouds) {
      const sets = [[beat.sky, 1 - k2]]; if (beat.skyTo) sets.push([beat.skyTo, k2]);
      for (const [name, alpha] of sets) {
        if (alpha <= .01) continue;
        const key = 'cl_' + name;
        if (!c[key]) { const pp = palette(name); if (beat.sun !== undefined) pp.sun = beat.sun; c[key] = makeClouds(beat.seed ?? hashStr(beat.text || name), name === 'storm' ? nClouds + 3 : nClouds, pp, name === 'storm'); }
        for (const cl of c[key]) {
          apply(cl.depth);
          const x = ((cl.x * (W + 900) + t * cl.speed) % (W + 900)) - 450;
          g.globalAlpha = alpha; g.drawImage(cl.spr, x - cl.spr.width / 2, cl.y * H); g.globalAlpha = 1;
        }
      }
    }
    apply(.05);
    for (const f of beat.fx || []) if (f.type === 'rays' || f.type === 'sunstill' || f.type === 'beam') FX[f.type](g, f, pal, p, t, cacheOf(f));

    // 풍경 레이어 (멀리 → 가까이)
    const layers = (beat.layers || []).slice().sort((a, b) => (a.depth ?? .5) - (b.depth ?? .5));
    for (const ly of layers) { const fn = L[ly.type]; if (!fn) continue; apply(ly.depth ?? .5); fn(g, ly, pal, p, t, cacheOf(ly)); }

    // 앞쪽 효과
    apply(1);
    for (const f of beat.fx || []) { if (['rays', 'sunstill', 'beam', 'shake', 'flare', 'flash'].includes(f.type)) continue; const fn = FX[f.type]; if (fn) fn(g, f, pal, p, t, cacheOf(f)); }
    apply(.2); for (const f of beat.fx || []) if (f.type === 'flare') FX.flare(g, f, pal, p, t);

    // 후처리: 화면 아래 어둡게(비네팅) + 해 쪽 따뜻한 빛 번짐
    g.setTransform(scale, 0, 0, scale, 0, 0);
    const vg = g.createRadialGradient(W / 2, H * .45, H * .35, W / 2, H * .5, W * .75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, rgba(pal.dark, .55));
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    if (pal.sun) { g.save(); g.globalCompositeOperation = 'screen'; const gr = g.createRadialGradient(pal.sun[0] * W, pal.sun[1] * H, 0, pal.sun[0] * W, pal.sun[1] * H, W * .8); gr.addColorStop(0, rgba(pal.sunRGB, .22)); gr.addColorStop(1, rgba(pal.sunRGB, 0)); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.restore(); }
    for (const f of beat.fx || []) if (f.type === 'flash') FX.flash(g, f, pal, p, t);
    g.restore();
  }

  window.SceneRenderer = { W, H, drawBeat };
})();
