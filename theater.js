// 장소의 사건: 카드 목록 + 지도 사건 모드 + 일러스트 모션그래픽 재생기(극장).
(function () {
  const $ = id => document.getElementById(id);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const KIND = { battle: '전투', miracle: '이적', teaching: '말씀' };
  const ICON = { battle: '⚔', miracle: '✦', teaching: '❝' };
  // 장소 사건이 있는 인물만, 여정 순서대로
  const PEOPLE = (typeof journeys !== 'undefined' ? journeys : []).filter(j => placeEvents[j.id]).map(j => [j.id, j.name, j.en]);
  const BIBLE = 'https://www.bskorea.or.kr/bible/korbibReadpage.php';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let who = PEOPLE[0] ? PEOPLE[0][0] : 'joshua', kindFilter = 'all', mapMode = 'route';
  const list = () => (placeEvents[who] || []);
  const shown = () => list().filter(e => kindFilter === 'all' || e.kind === kindFilter);

  // ── 섹션 UI ─────────────────────────────────────────
  const tabs = $('ev-people'), chips = $('ev-kinds'), grid = $('ev-grid');
  function renderSection() {
    tabs.innerHTML = PEOPLE.map(([id, name, en]) => `<button type="button" data-who="${id}" aria-pressed="${id === who}"><b>${name}</b><small>${en}</small><em>${placeEvents[id].length}</em></button>`).join('');
    tabs.querySelectorAll('button').forEach(b => b.onclick = () => { setWho(b.dataset.who); });
    const kinds = ['all', ...new Set(list().map(e => e.kind))];
    if (!kinds.includes(kindFilter)) kindFilter = 'all';
    chips.innerHTML = kinds.map(k => `<button type="button" data-kind="${k}" aria-pressed="${k === kindFilter}">${k === 'all' ? '전체' : ICON[k] + ' ' + KIND[k]}</button>`).join('');
    chips.querySelectorAll('button').forEach(b => b.onclick = () => { kindFilter = b.dataset.kind; renderSection(); if (mapMode === 'events') showOnMap(); });
    grid.innerHTML = '';
    shown().forEach((e, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'ev-card ' + e.kind; b.style.setProperty('--i', i);
      b.innerHTML = `<span class="ev-thumb"><canvas width="480" height="270" aria-hidden="true"></canvas><span class="ev-play" aria-hidden="true">▶</span></span><span class="ev-meta"><span class="ev-kind">${ICON[e.kind]} ${KIND[e.kind]}</span><span class="ev-place">${esc(e.place)}</span></span><b>${esc(e.title)}</b><small>${esc(e.ref)}</small>`;
      b.setAttribute('aria-label', `${e.place} — ${e.title} (${KIND[e.kind]}) 모션그래픽 보기`);
      b.onclick = () => open(list().indexOf(e));
      grid.append(b);
      thumbObserver.observe(b.querySelector('canvas'));
      b.querySelector('canvas')._beat = e.beats[e.beats.length > 2 ? e.beats.length - 1 : 0];
    });
    $('ev-count').textContent = `${PEOPLE.find(p => p[0] === who)[1]} · ${shown().length}개의 사건`;
  }
  // 카드 썸네일: 화면에 보일 때 마지막 장면을 한 장 그림
  const thumbObserver = new IntersectionObserver(es => es.forEach(en => {
    if (!en.isIntersecting) return; thumbObserver.unobserve(en.target);
    const cv = en.target; requestAnimationFrame(() => SceneRenderer.drawBeat(cv.getContext('2d'), cv._beat, .55, 2));
  }), { rootMargin: '200px' });

  function setWho(id) {
    if (!placeEvents[id]) return; who = id; renderSection();
    if (mapMode === 'events') showOnMap();
  }

  // ── 지도 모드 ───────────────────────────────────────
  const modeBtns = document.querySelectorAll('[data-map-mode]');
  function setMapMode(m) {
    if (m === 'events' && !placeEvents[currentJourney]) m = 'route';
    mapMode = m;
    modeBtns.forEach(b => b.setAttribute('aria-pressed', b.dataset.mapMode === m));
    document.querySelector('.map-wrap').classList.toggle('events-mode', m === 'events');
    if (m === 'events') { if (placeEvents[currentJourney]) setWho(currentJourney); showOnMap(); }
    else if (window.Map3D) Map3D.hideEvents();
  }
  function showOnMap() {
    if (!window.Map3D) return;
    const items = shown();
    Map3D.showEvents(items, i => { const idx = list().indexOf(items[i]); Map3D.focusEvent(i); setTimeout(() => open(idx), reduced ? 0 : 700); });
  }
  modeBtns.forEach(b => b.onclick = () => setMapMode(b.dataset.mapMode));
  window.addEventListener('map3d-ready', () => { if (mapMode === 'events') showOnMap(); });

  let currentJourney = '';
  window.PlaceEvents = {
    onJourney(id) {
      if (id === currentJourney) return; currentJourney = id;
      const has = !!placeEvents[id];
      modeBtns.forEach(b => { if (b.dataset.mapMode === 'events') { b.disabled = !has; b.title = has ? '' : '여호수아와 예수님 여정에서 볼 수 있습니다'; } });
      if (has) setWho(id);
      if (mapMode === 'events') setMapMode(has ? 'events' : 'route');
    },
  };

  // ── 극장 (모션그래픽 재생기) ─────────────────────────
  const dlg = $('theater'), cv = $('th-canvas'), g = cv.getContext('2d');
  const prevCv = document.createElement('canvas'), pg = prevCv.getContext('2d');
  let ev = null, evIdx = 0, beat = 0, beatStart = 0, paused = false, pausedAt = 0, raf = 0, fadeStart = -1e9, ended = false;
  const beatDur = b => reduced ? 1e9 : Math.min(11, Math.max(6, 3.6 + b.text.length * .085)) * 1000;

  function sizeCanvas() {
    const r = cv.getBoundingClientRect(), w = Math.min(1600, Math.round(r.width * Math.min(devicePixelRatio, 2)));
    if (w && cv.width !== w) { cv.width = w; cv.height = Math.round(w * 9 / 16); prevCv.width = cv.width; prevCv.height = cv.height; }
  }
  function open(idx) {
    evIdx = idx; ev = list()[idx]; if (!ev) return;
    if (!dlg.open) dlg.showModal();
    $('th-eyebrow').textContent = `${ICON[ev.kind]} ${KIND[ev.kind]} · ${ev.place}`;
    $('th-title').textContent = ev.title;
    $('th-ref').textContent = ev.ref;
    $('th-progress').innerHTML = ev.beats.map(() => '<i><b></b></i>').join('');
    $('th-end').hidden = true; ended = false;
    $('th-end-summary').textContent = ev.summary;
    $('th-end-note').textContent = ev.note || '';
    $('th-end-ref').textContent = ev.ref;
    $('th-read').href = BIBLE;
    const nxt = list()[idx + 1]; $('th-next-ev').hidden = !nxt; if (nxt) $('th-next-ev').textContent = `다음 사건: ${nxt.title} →`;
    sizeCanvas(); go(0, true); setPaused(false);
    cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
  }
  function go(i, first) {
    if (!ev) return;
    if (i >= ev.beats.length) return finish();
    if (i < 0) i = 0;
    if (!first) { pg.clearRect(0, 0, prevCv.width, prevCv.height); pg.drawImage(cv, 0, 0); fadeStart = performance.now(); }
    beat = i; beatStart = performance.now(); pausedAt = beatStart; ended = false; $('th-end').hidden = true;
    const titleCard = $('th-titlecard'); titleCard.classList.toggle('show', i === 0);
    if (i === 0) { titleCard.classList.remove('anim'); void titleCard.offsetWidth; titleCard.classList.add('anim'); }
    setSubtitle(ev.beats[i].text, i === 0 ? 1400 : 300);
    $('th-progress').querySelectorAll('i').forEach((el, k) => { el.className = k < i ? 'done' : k === i ? 'now' : ''; el.style.setProperty('--d', beatDur(ev.beats[k]) + 'ms'); });
    $('th-count').textContent = `${i + 1} / ${ev.beats.length}`;
    $('th-prev').disabled = i === 0;
  }
  function setSubtitle(text, delay) {
    const el = $('th-sub'); el.setAttribute('aria-label', text);
    el.innerHTML = reduced ? esc(text) : [...text].map((c, k) => `<span style="--k:${k}">${c === ' ' ? ' ' : esc(c)}</span>`).join('');
    el.style.setProperty('--delay', delay + 'ms');
    el.classList.remove('in'); void el.offsetWidth; el.classList.add('in');
  }
  function finish() {
    ended = true; $('th-end').hidden = false; $('th-titlecard').classList.remove('show');
    $('th-progress').querySelectorAll('i').forEach(el => el.className = 'done');
    $('th-sub').classList.remove('in');
  }
  function setPaused(v) {
    const now = performance.now();
    if (v && !paused) pausedAt = now;
    if (!v && paused) beatStart += now - pausedAt;
    paused = v; $('th-play').textContent = v ? '▶' : '❚❚'; $('th-play').setAttribute('aria-label', v ? '재생' : '일시 정지');
    $('th-progress').classList.toggle('paused', v);
  }
  function loop(now) {
    if (!dlg.open) return;
    raf = requestAnimationFrame(loop);
    sizeCanvas();
    const b = ev.beats[beat], dur = beatDur(b);
    const el = (paused ? pausedAt : now) - beatStart;
    const p = reduced ? .6 : ended ? 1 : Math.min(1, el / dur);
    SceneRenderer.drawBeat(g, b, p, reduced ? 2 : now / 1000);
    // 이전 장면과 부드럽게 겹치며 전환 (빛 번짐 포함)
    const f = (now - fadeStart) / 900;
    if (f < 1) {
      g.save(); g.globalAlpha = 1 - f; g.drawImage(prevCv, 0, 0); g.restore();
      g.save(); g.globalCompositeOperation = 'screen'; g.fillStyle = `rgba(255,246,228,${Math.sin(f * Math.PI) * .35})`; g.fillRect(0, 0, cv.width, cv.height); g.restore();
    }
    if (!paused && !ended && !reduced && el >= dur) go(beat + 1);
  }

  $('th-prev').onclick = () => go(ended ? ev.beats.length - 1 : beat - 1);
  $('th-next').onclick = () => go(beat + 1);
  $('th-play').onclick = () => { if (ended) { go(0); setPaused(false); } else setPaused(!paused); };
  $('th-close').onclick = () => dlg.close();
  $('th-replay').onclick = () => { go(0); setPaused(false); };
  $('th-next-ev').onclick = () => open(evIdx + 1);
  dlg.addEventListener('close', () => { if (!dlg.open) cancelAnimationFrame(raf); }); // 닫힘 이벤트는 늦게 오므로, 그 사이 다시 열렸으면 그대로 둠
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(beat + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(beat - 1); }
    else if (e.key === ' ' && e.target.tagName !== 'BUTTON') { e.preventDefault(); $('th-play').click(); }
  });
  cv.addEventListener('click', () => { if (!ended) go(beat + 1); });

  renderSection();
  if (typeof journeys !== 'undefined') PlaceEvents.onJourney(journeys[typeof person === 'number' ? person : 0].id);
})();
