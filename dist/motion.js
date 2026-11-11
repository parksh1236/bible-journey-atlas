// 모션 그래픽: 스크롤 등장, 장면 전환 애니메이션, 숫자 카운트업, 히어로 시차 효과.
// 움직임 줄이기(prefers-reduced-motion)를 켠 사용자에게는 내용만 바꾸고 애니메이션은 생략합니다.
(function () {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const q = (s, r = document) => r.querySelector(s), qa = (s, r = document) => [...r.querySelectorAll(s)];
  const ease = t => 1 - Math.pow(1 - t, 3);
  document.documentElement.classList.add(reduced ? 'motion-off' : 'motion-on');

  // 같은 요소에 애니메이션 클래스를 다시 붙여 재생
  function replay(el, cls = 'swap') { if (!el || reduced) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

  // 제목을 글자 단위로 나눠 차례로 떠오르게
  function splitChars(el) {
    if (!el || reduced) return;
    const text = el.textContent; el.setAttribute('aria-label', text);
    el.innerHTML = [...text].map((c, i) => c === ' ' ? ' ' : `<span class="ch" aria-hidden="true" style="--i:${i}">${c}</span>`).join('');
  }

  // 숫자 카운트업 (예: "1,234 <em>km</em>")
  function countUp(el, dur = 1100) {
    if (!el || reduced) return;
    const html = el.innerHTML, m = html.match(/^([\d,]+)(.*)$/s); if (!m) return;
    const target = +m[1].replace(/,/g, ''), rest = m[2], t0 = performance.now(), pad = /^0\d/.test(m[1]) ? m[1].length : 0;
    const tick = now => { const t = Math.min(1, (now - t0) / dur); el.innerHTML = (pad ? String(Math.round(target * ease(t))).padStart(pad, '0') : Math.round(target * ease(t)).toLocaleString('ko-KR')) + rest; if (t < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }

  // ── 스크롤 등장 ─────────────────────────────────────
  const io = 'IntersectionObserver' in window && !reduced ? new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: .12, rootMargin: '0px 0px -40px 0px' }) : null;
  function reveal(sel) { qa(sel).forEach(el => { el.classList.add('reveal'); io ? io.observe(el) : el.classList.add('in'); }); }
  reveal('.section-label, .people, .workspace, .story-row, .detail-heading, .distance-grid, .detail-tabs, .place-panels, #timeline, footer');

  // ── 상단 읽기 진행 막대 ─────────────────────────────
  const bar = document.createElement('div'); bar.className = 'scroll-progress'; bar.setAttribute('aria-hidden', 'true'); document.body.append(bar);
  const onScroll = () => { const h = document.documentElement; bar.style.transform = `scaleX(${h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight)})`; };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  // ── 히어로 시차(마우스를 따라 그림이 살짝 움직임) ─────
  const art = q('.intro-art');
  if (art && !reduced && matchMedia('(pointer:fine)').matches) {
    q('.intro').addEventListener('pointermove', e => {
      const r = art.getBoundingClientRect(), x = (e.clientX - r.left - r.width / 2) / r.width, y = (e.clientY - r.top - r.height / 2) / r.height;
      art.style.setProperty('--px', x.toFixed(3)); art.style.setProperty('--py', y.toFixed(3));
    });
  }

  // ── 렌더마다 호출: 장면/인물 전환 애니메이션 ─────────
  let last = { person: -1, step: -1, theme: '' };
  window.Motion = {
    onRender(person, step, theme) {
      const personChanged = person !== last.person, listChanged = personChanged || theme !== last.theme, stepChanged = step !== last.step || personChanged;
      if (stepChanged) {
        splitChars(q('#event-title'));
        replay(q('.story-row'));
        replay(q('.place-panels'));
        qa('#distances strong').forEach(s => countUp(s));
        replay(q('#detail-counter'));
      }
      if (personChanged) {
        replay(q('.journey-info'));
        countUp(q('#stopcount'), 700);
      }
      if (listChanged && !reduced) {
        qa('#timeline .event-card').forEach((c, i) => { c.style.setProperty('--i', i); c.classList.add('stagger'); });
      }
      // 사람 버튼의 활성 표시를 매번 다시 그리므로, 바뀐 경우에만 반짝임
      if (personChanged) replay(q('.person.active'), 'pop');
      last = { person, step, theme };
    }
  };
})();
