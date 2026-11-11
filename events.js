// 장소별 사건 데이터: 여정 경로와 별개로, 한 장소에서 일어난 전투·이적·말씀을 장면(beat) 단위로 정리합니다.
// 각 장면은 scene.js가 그리는 일러스트 설정(sky/layers/fx)과 자막(text)으로 이루어집니다.
// 자막은 성경 본문을 풀어 쓴 요약이며 본문 직접 인용이 아닙니다.
(function () {
  // ── 자주 쓰는 풍경 조합 ─────────────────────────────
  const hills = (y, depth, seed, amp = .07, extra = {}) => ({ type: 'hills', y, depth, seed, amp, ...extra });
  const canaan = (s = 1) => [hills(.6, .18, s, .09), hills(.68, .42, s + 4, .07), hills(.84, .78, s + 8, .05)];
  const galilee = (storm, s = 3) => [hills(.555, .16, s, .06), hills(.575, .3, s + 5, .035), { type: 'sea', y: .585, depth: .5, storm }];
  const valley = s => [hills(.58, .2, s, .1), hills(.66, .45, s + 2, .09)];
  const jerusalem = (lights, d = .48) => [{ type: 'city', x: .55, w: .7, y: .7, depth: d, seed: 31, lights }, { type: 'temple', x: .62, y: .62, s: .9, depth: d - .06 }];
  const near = (y = .9, s = 12) => hills(y, .92, s, .04, { rim: false });
  const jesus = (x, y, extra = {}) => ({ type: 'figure', kind: 'jesus', x, y, s: 1.35, depth: .95, ...extra });
  const man = (x, y, extra = {}) => ({ type: 'figure', x, y, s: 1.25, depth: .94, ...extra });

  window.placeEvents = {
    joshua: [
      {
        id: 'jordan', place: '요단 강', lon: 35.55, lat: 31.83, kind: 'miracle', title: '요단 강이 멈추다', ref: '여호수아 3–4장',
        summary: '추수 때라 강물이 넘쳐흐르던 요단 강에 언약궤를 멘 제사장들이 발을 들이자 물이 멈추고, 백성은 마른 땅으로 건넙니다. 열두 지파는 강에서 가져온 돌 열두 개로 기념비를 세웁니다.',
        beats: [
          { sky: 'dawn', text: '추수의 계절, 요단 강은 강둑까지 차올라 거세게 흐르고 있었습니다.', layers: [...valley(2), { type: 'river', y: .72, h: .07, depth: .6, part: 0 }, { type: 'tents', x: .25, w: .4, y: .86, n: 9, depth: .8, fires: true }, near(.92)], fx: [{ type: 'rays', strength: .6 }, { type: 'birds', y: .2 }, { type: 'motes', n: 30 }] },
          { sky: 'dawn', text: '언약궤를 멘 제사장들이 백성 앞에서 강을 향해 걸어 나갑니다.', layers: [...valley(2), { type: 'river', y: .72, h: .07, depth: .6, part: 0 }, { type: 'ark', x: .32, y: .86, s: 1.1, dx: [0, 1], move: .15 }, { type: 'crowd', x: .2, w: .3, y: .9, n: 26, s: .55, depth: .98 }], fx: [{ type: 'rays' }, { type: 'motes', n: 40 }], cam: { x0: -30, x1: 30 } },
          { sky: 'dawn', skyTo: 'divine', text: '제사장들의 발이 물가에 닿는 순간, 위에서 흘러오던 물이 멀리서 멈추어 섭니다.', layers: [...valley(2), { type: 'river', y: .72, h: .07, depth: .6, part: [.15, .7] }, { type: 'ark', x: .5, y: .78, s: .9, depth: .7 }], fx: [{ type: 'glow', x: .5, y: .66, r: .25, on: [.1, .6] }, { type: 'rays', strength: 1.3 }, { type: 'flash', at: .2, a: .4 }, { type: 'motes', n: 70 }] },
          { sky: 'divine', text: '온 백성이 마른 땅으로 건너고, 강에서 가져온 열두 돌로 기념비를 세웁니다.', layers: [...valley(5), { type: 'stones', x: .5, y: .82, s: 1.3, depth: .8 }, { type: 'crowd', x: .5, w: .9, y: .88, n: 40, s: .5, depth: .95, appear: [0, .6] }], fx: [{ type: 'rays' }, { type: 'birds', y: .18 }, { type: 'flare' }] },
        ],
      },
      {
        id: 'jericho', place: '여리고', lon: 35.444, lat: 31.871, kind: 'battle', title: '여리고 성이 무너지다', ref: '여호수아 6장',
        summary: '굳게 닫힌 여리고 성을 이스라엘은 엿새 동안 하루 한 바퀴, 일곱째 날에는 일곱 바퀴 돕니다. 나팔 소리와 함께 백성이 크게 외치자 성벽이 무너져 내리고, 정탐꾼을 숨겨 준 라합의 집안은 구원을 받습니다.',
        beats: [
          { sky: 'day', text: '종려나무 성읍 여리고. 성문은 굳게 닫혀 아무도 드나들지 못했습니다.', layers: [hills(.6, .2, 3, .08), { type: 'walls', x: .55, w: .6, y: .72, h: .16, depth: .5 }, { type: 'trees', kind: 'palm', xs: [.08, .16, .88, .95], y: .92, depth: .9, s: 1.2 }, near(.93)], fx: [{ type: 'birds', y: .22 }, { type: 'motes', n: 20 }] },
          { sky: 'day', text: '언약궤와 나팔 부는 제사장들을 따라, 백성은 엿새 동안 날마다 성을 한 바퀴 돕니다.', layers: [hills(.6, .2, 3, .08), { type: 'walls', x: .55, w: .6, y: .72, h: .16, depth: .5 }, { type: 'army', x: .2, w: .5, y: .86, n: 34, s: .5, depth: .85, march: [0, 1], dist: .35, horns: true }, { type: 'ark', x: .12, y: .9, s: .8, dx: [0, 1], move: .35 }], fx: [{ type: 'motes', n: 25 }], cam: { x0: -40, x1: 40 } },
          { sky: 'sunset', text: '일곱째 날 일곱 바퀴를 돈 뒤, 나팔 소리에 맞추어 백성이 크게 외칩니다.', layers: [hills(.62, .2, 3, .08), { type: 'walls', x: .58, w: .6, y: .72, h: .16, depth: .5 }, { type: 'army', x: .3, w: .55, y: .88, n: 44, s: .55, depth: .9, horns: true, shout: [.3, .5] }], fx: [{ type: 'rays' }, { type: 'shout', x: .3, y: .8, on: [.35, .5] }, { type: 'birds', y: .2 }] },
          { sky: 'sunset', text: '견고하던 성벽이 그 자리에서 무너져 내립니다. 라합과 그 가족은 약속대로 구원을 받습니다.', layers: [hills(.62, .2, 3, .08), { type: 'walls', x: .58, w: .6, y: .72, h: .16, depth: .5, collapse: [.05, .6] }, { type: 'army', x: .3, w: .55, y: .88, n: 44, s: .55, depth: .9, shout: 1 }], fx: [{ type: 'shake', on: { from: 1, to: 0, at: [.1, .6] }, amp: 12 }, { type: 'dust', x: .58, y: .72, on: [.1, .5] }, { type: 'rays', strength: 1.2 }, { type: 'flare' }] },
        ],
      },
      {
        id: 'ai', place: '아이', lon: 35.262, lat: 31.917, kind: 'battle', title: '아이 성의 패배와 승리', ref: '여호수아 7–8장',
        summary: '작은 성 아이와의 첫 싸움에서 이스라엘은 뜻밖에 패합니다. 바쳐야 할 물건을 몰래 감춘 아간의 죄가 드러난 뒤, 여호수아는 성 뒤에 복병을 두는 작전으로 다시 싸워 아이를 점령합니다.',
        beats: [
          { sky: 'day', text: '여리고 이후, 이스라엘은 작은 성 아이를 가볍게 여기고 적은 군사만 보냅니다.', layers: [...canaan(6).slice(0, 2), { type: 'walls', x: .7, w: .3, y: .66, h: .1, depth: .45, seed: 8 }, { type: 'army', x: .3, w: .3, y: .86, n: 18, s: .5, depth: .9, march: [0, 1], dist: .1 }, near()], fx: [{ type: 'birds' }] },
          { sky: 'dusk', text: '그러나 그들은 쫓겨 돌아오고, 백성의 마음은 물처럼 녹아내립니다.', layers: [...canaan(6).slice(0, 2), { type: 'walls', x: .7, w: .3, y: .66, h: .1, depth: .45, seed: 8 }, { type: 'army', x: .4, w: .4, y: .86, n: 18, s: .5, depth: .9, flee: [0, 1] }, man(.2, .92, { pose: 'kneel' })], fx: [{ type: 'motes', n: 20, color: '#b9b6e8' }] },
          { sky: 'night', text: '숨겨진 죄가 드러나 정리된 뒤, 여호수아는 밤사이 성 뒤편에 복병을 숨겨 둡니다.', layers: [...canaan(6).slice(0, 2), { type: 'walls', x: .62, w: .3, y: .66, h: .1, depth: .45, seed: 8, lights: true }, { type: 'army', x: .88, w: .2, y: .74, n: 16, s: .35, depth: .6, spears: true }, man(.2, .92, { staff: true })], fx: [{ type: 'motes', n: 30, color: '#a8c4ff' }] },
          { sky: 'dawn', text: '성의 군사가 쫓아 나오자 복병이 일어나 성을 차지하고, 연기가 하늘로 오릅니다.', layers: [...canaan(6).slice(0, 2), { type: 'walls', x: .62, w: .3, y: .66, h: .1, depth: .45, seed: 8, collapse: [.3, .9] }, { type: 'army', x: .3, w: .4, y: .86, n: 30, s: .5, depth: .9, shout: [.2, .4], banners: true }, man(.12, .93, { staff: true, raise: .6 })], fx: [{ type: 'smoke', x: .62, y: .62, on: [.2, .6] }, { type: 'embers', x: .62, y: .66, w: .3, on: [.3, .7] }, { type: 'rays' }] },
        ],
      },
      {
        id: 'gibeon', place: '기브온·벧호론', lon: 35.185, lat: 31.847, kind: 'battle', title: '해야 기브온 위에 머물라', ref: '여호수아 10:1–15',
        summary: '이스라엘과 화친한 기브온을 아모리의 다섯 왕이 공격하자, 여호수아는 밤새 행군해 기습합니다. 도망치는 적 위로 큰 우박이 쏟아지고, 여호수아의 기도에 해와 달이 머물러 승리가 이루어집니다.',
        beats: [
          { sky: 'night', text: '아모리의 다섯 왕이 연합해 기브온을 포위합니다. 여호수아는 밤새 길갈에서 올라갑니다.', layers: [...valley(9), { type: 'city', x: .7, w: .25, y: .66, depth: .45, lights: true, seed: 4 }, { type: 'army', x: .25, w: .4, y: .88, n: 34, s: .5, depth: .9, march: [0, 1], dist: .15 }], fx: [{ type: 'motes', n: 30, color: '#b0c8ff' }] },
          { sky: 'dawn', text: '새벽, 기습을 받은 적은 벧호론 비탈길로 흩어져 도망칩니다.', layers: [...valley(9), { type: 'chariots', x: .65, w: .4, y: .78, n: 4, s: .8, depth: .7 }, { type: 'army', x: .3, w: .45, y: .9, n: 36, s: .55, depth: .92, shout: [.1, .4], banners: true }], fx: [{ type: 'rays' }, { type: 'dust', x: .65, y: .78, on: [.2, .6] }], cam: { x0: 30, x1: -30 } },
          { sky: 'storm', text: '하늘에서 큰 우박이 쏟아져, 칼보다 우박에 쓰러진 적이 더 많았습니다.', clouds: 8, layers: [...valley(9), { type: 'chariots', x: .65, w: .45, y: .78, n: 4, s: .8, depth: .7 }], fx: [{ type: 'hail', on: [0, .3], x0: .35, w: .65 }, { type: 'lightning', on: 1 }, { type: 'wind' }] },
          { sky: 'divine', text: '여호수아가 기도하자, 해는 기브온 위에, 달은 아얄론 골짜기에 머물러 이스라엘이 승리합니다.', sun: [.5, .32], layers: [...valley(9), man(.5, .9, { s: 1.5, staff: true, raise: [0, .4] })], fx: [{ type: 'sunstill', moon: [.85, .3] }, { type: 'rays', strength: 1.4 }, { type: 'motes', n: 60 }, { type: 'flare' }] },
        ],
      },
      {
        id: 'lachish', place: '막게다·라기스', lon: 34.849, lat: 31.565, kind: 'battle', title: '남쪽 성읍들의 정복', ref: '여호수아 10:16–43',
        summary: '도망친 다섯 왕은 막게다 굴에 숨었다가 사로잡힙니다. 여호수아는 이어 립나, 라기스, 에글론, 헤브론, 드빌을 차례로 점령하여 가나안 남부를 평정합니다.',
        beats: [
          { sky: 'dusk', text: '다섯 왕은 막게다의 굴로 숨어들고, 여호수아는 큰 돌로 굴 입구를 막게 합니다.', layers: [...valley(13), { type: 'cave', x: .6, y: .82, s: 1.1, depth: .7 }, man(.3, .92, { spear: true }), man(.38, .93, { spear: true })], fx: [{ type: 'motes', n: 20 }] },
          { sky: 'day', text: '이스라엘은 남쪽으로 진군하여 견고한 성읍 라기스를 이틀 만에 점령합니다.', layers: [hills(.6, .2, 14, .09), { type: 'walls', x: .62, w: .45, y: .68, h: .14, depth: .5, seed: 13 }, { type: 'army', x: .3, w: .5, y: .88, n: 40, s: .5, depth: .9, march: [0, 1], dist: .1, banners: true }], fx: [{ type: 'birds' }] },
          { sky: 'sunset', text: '에글론과 헤브론, 드빌까지 남부의 성읍들이 차례로 이스라엘의 손에 들어옵니다.', layers: [hills(.62, .2, 15, .09), { type: 'city', x: .3, w: .2, y: .64, depth: .4, seed: 2 }, { type: 'city', x: .75, w: .2, y: .65, depth: .42, seed: 6 }, { type: 'army', x: .5, w: .6, y: .9, n: 44, s: .5, depth: .92 }], fx: [{ type: 'rays' }, { type: 'smoke', x: .75, y: .62, w: .03 }] },
          { sky: 'dusk', text: '여호수아는 온 이스라엘과 함께 길갈 진영으로 돌아옵니다.', layers: [...valley(16), { type: 'tents', x: .5, w: .8, y: .84, n: 12, depth: .75, fires: true }, man(.5, .94, { staff: true })], fx: [{ type: 'motes', n: 40 }, { type: 'birds', y: .2 }] },
        ],
      },
      {
        id: 'merom', place: '메롬 물가', lon: 35.42, lat: 33.0, kind: 'battle', title: '메롬 물가의 전투', ref: '여호수아 11:1–9', note: '메롬 물가의 정확한 위치는 확정되지 않았습니다.',
        summary: '하솔 왕 야빈이 북쪽 여러 왕을 모아 바닷가 모래처럼 많은 군대와 말과 병거로 메롬 물가에 진을 칩니다. 이스라엘은 갑자기 들이쳐 그들을 무찌르고, 말의 힘줄을 끊고 병거를 불사릅니다.',
        beats: [
          { sky: 'day', text: '북쪽의 왕들이 하솔 왕 야빈을 중심으로 모여 메롬 물가에 진을 칩니다.', layers: [hills(.56, .18, 20, .1), { type: 'sea', y: .66, depth: .4 }, { type: 'tents', x: .65, w: .55, y: .78, n: 14, depth: .6, seed: 9 }, { type: 'chariots', x: .5, w: .6, y: .9, n: 6, s: .9, depth: .88 }], fx: [{ type: 'birds' }, { type: 'rays', strength: .6 }] },
          { sky: 'day', text: '그 수가 바닷가의 모래처럼 많았고, 말과 병거도 셀 수 없었습니다.', layers: [hills(.56, .18, 20, .1), { type: 'army', x: .5, w: 1, y: .74, n: 70, s: .32, depth: .55, banners: true, bannerColor: '#5a4a8a' }, { type: 'chariots', x: .5, w: .9, y: .88, n: 7, s: .85, depth: .85 }], fx: [{ type: 'dust', x: .5, y: .82, on: .6 }], cam: { z0: 1.12, z1: 1.02 } },
          { sky: 'dawn', text: '두려워하지 말라는 말씀을 듣고, 여호수아와 군사들이 물가로 갑자기 들이칩니다.', layers: [hills(.56, .18, 20, .1), { type: 'sea', y: .66, depth: .4 }, { type: 'army', x: .3, w: .5, y: .9, n: 40, s: .55, depth: .92, march: [0, 1], dist: .2, shout: [.4, .6] }], fx: [{ type: 'rays', strength: 1.2 }, { type: 'flare' }] },
          { sky: 'sunset', text: '적은 흩어져 도망치고, 남겨진 병거들은 불타오릅니다.', layers: [hills(.58, .18, 20, .1), { type: 'chariots', x: .5, w: .7, y: .86, n: 5, s: .9, depth: .85, noHorses: true, burn: [0, .5] }], fx: [{ type: 'embers', x: .5, y: .84, w: .7, on: [0, .4] }, { type: 'smoke', x: .5, y: .78, w: .25, on: [.1, .5] }, { type: 'rays' }] },
        ],
      },
      {
        id: 'hazor', place: '하솔', lon: 35.567, lat: 33.017, kind: 'battle', title: '하솔이 불타다', ref: '여호수아 11:10–15',
        summary: '하솔은 이전부터 북쪽 모든 나라의 머리가 되는 큰 성이었습니다. 여호수아는 돌아와 하솔을 점령하고 불살랐으며, 이로써 가나안 북부의 저항이 꺾입니다.',
        beats: [
          { sky: 'day', text: '언덕 위의 큰 성 하솔. 북쪽 모든 나라의 머리 되는 도성이었습니다.', layers: [hills(.6, .2, 25, .07), hills(.7, .4, 26, .1), { type: 'walls', x: .5, w: .55, y: .64, h: .12, depth: .45, seed: 25 }, { type: 'city', x: .5, w: .5, y: .58, depth: .44, seed: 25 }, near(.92)], fx: [{ type: 'birds' }] },
          { sky: 'dusk', text: '메롬에서 돌아온 여호수아의 군대가 하솔을 에워쌉니다.', layers: [hills(.6, .2, 25, .07), hills(.7, .4, 26, .1), { type: 'walls', x: .5, w: .55, y: .64, h: .12, depth: .45, seed: 25, lights: true }, { type: 'army', x: .5, w: .9, y: .88, n: 50, s: .5, depth: .9, banners: true }], fx: [{ type: 'motes', n: 30 }] },
          { sky: 'night', text: '성은 함락되고, 하솔은 불길에 휩싸입니다.', layers: [hills(.6, .2, 25, .07), hills(.7, .4, 26, .1), { type: 'walls', x: .5, w: .55, y: .64, h: .12, depth: .45, seed: 25, collapse: [.4, 1] }], fx: [{ type: 'glow', x: .5, y: .6, r: .35, color: '#ff8a3a', a: .8 }, { type: 'embers', x: .5, y: .64, w: .55 }, { type: 'smoke', x: .5, y: .55, w: .2 }] },
          { sky: 'dawn', text: '여호수아는 모세에게 명령된 말씀을 하나도 빠뜨리지 않고 지켰다고 성경은 기록합니다.', layers: [...canaan(27), man(.5, .92, { s: 1.5, staff: true })], fx: [{ type: 'rays', strength: 1.1 }, { type: 'smoke', x: .8, y: .6, w: .05, on: .4 }, { type: 'birds' }, { type: 'flare' }] },
        ],
      },
      {
        id: 'shechem', place: '세겜', lon: 35.28, lat: 32.21, kind: 'teaching', title: '세겜에서의 언약', ref: '여호수아 24장',
        summary: '나이 많은 여호수아는 온 지파를 세겜에 모아 하나님이 행하신 일을 되새기고, 누구를 섬길지 오늘 택하라고 권합니다. 그는 자신과 집안은 여호와를 섬기겠다고 고백하고, 백성과 언약을 세운 뒤 큰 돌을 증거로 세웁니다.',
        beats: [
          { sky: 'sunset', text: '세월이 흘러, 나이 많은 여호수아가 이스라엘 온 지파를 세겜에 불러 모읍니다.', layers: [hills(.58, .15, 30, .12), { type: 'mountain', x: .25, y: .66, w: .4, h: .26, depth: .3 }, { type: 'mountain', x: .78, y: .66, w: .4, h: .24, depth: .32 }, { type: 'crowd', x: .5, w: 1, y: .82, n: 70, s: .42, depth: .8 }], fx: [{ type: 'rays' }, { type: 'birds' }] },
          { sky: 'sunset', text: '그는 아브라함부터 광야와 가나안까지, 하나님이 행하신 일을 하나하나 되새깁니다.', layers: [hills(.58, .15, 30, .12), { type: 'crowd', x: .5, w: 1, y: .84, n: 60, s: .46, depth: .82 }, man(.5, .78, { s: 1.4, staff: true, depth: .7 })], fx: [{ type: 'rays', strength: 1.1 }, { type: 'motes', n: 40 }] },
          { sky: 'dusk', text: '“오늘 섬길 이를 택하라. 나와 내 집은 여호와를 섬기겠다.” 그의 고백이 울려 퍼집니다. (요약)', layers: [hills(.6, .15, 30, .12), man(.5, .9, { s: 1.8, raise: [0, .4] }), { type: 'crowd', x: .5, w: 1, y: .96, n: 30, s: .6, depth: .98, raise: [.5, .8] }], fx: [{ type: 'glow', x: .5, y: .6, r: .2, a: .5 }, { type: 'motes', n: 50 }] },
          { sky: 'dusk', text: '백성은 언약을 맺고, 여호수아는 상수리나무 아래 큰 돌을 세워 증거로 삼습니다.', layers: [hills(.6, .15, 30, .12), { type: 'trees', kind: 'olive', xs: [.62], y: .86, depth: .8, s: 2.2 }, { type: 'stones', x: .45, y: .88, s: .7, depth: .85 }, near(.94)], fx: [{ type: 'motes', n: 40 }, { type: 'birds', y: .25 }] },
        ],
      },
    ],

    jesus: [
      {
        id: 'cana', place: '가나', lon: 35.34, lat: 32.75, kind: 'miracle', title: '물이 포도주가 되다', ref: '요한복음 2:1–11', note: '가나의 정확한 위치는 여러 후보지가 있습니다.',
        summary: '갈릴리 가나의 혼인 잔치에 포도주가 떨어지자, 예수님은 하인들에게 돌항아리 여섯 개에 물을 채우게 하십니다. 떠서 가져간 물은 좋은 포도주가 되었고, 요한복음은 이를 첫 표적이라 기록합니다.',
        beats: [
          { sky: 'sunset', text: '갈릴리 가나의 혼인 잔치. 마을은 축하의 노래로 가득합니다.', layers: [hills(.6, .2, 40, .08), { type: 'city', x: .5, w: .8, y: .72, depth: .5, seed: 40, lights: true }, { type: 'crowd', x: .5, w: .9, y: .9, n: 34, s: .55, depth: .92, raise: [.2, .5] }], fx: [{ type: 'rays' }, { type: 'motes', n: 50, color: '#ffd59a' }] },
          { sky: 'dusk', text: '그런데 잔치가 한창일 때 포도주가 떨어지고 맙니다.', layers: [hills(.6, .2, 40, .08), { type: 'city', x: .5, w: .8, y: .72, depth: .5, seed: 40, lights: true }, { type: 'figure', x: .38, y: .9, s: 1.25, depth: .94, veil: true }, jesus(.55, .9)], fx: [{ type: 'motes', n: 30 }] },
          { sky: 'dusk', text: '예수님은 하인들에게 돌항아리 여섯 개에 물을 아귀까지 채우라고 하십니다.', layers: [hills(.62, .2, 40, .08), { type: 'jars', x: .55, y: .9, s: 1.1, depth: .9, wine: 0 }, jesus(.18, .92)], fx: [{ type: 'motes', n: 30 }] },
          { sky: 'dusk', skyTo: 'sunset', text: '떠서 가져간 물은 가장 좋은 포도주가 되어 있었습니다. 예수님이 행하신 첫 표적입니다.', layers: [hills(.62, .2, 40, .08), { type: 'jars', x: .55, y: .9, s: 1.1, depth: .9, wine: [.05, .7] }, jesus(.18, .92, { glow: 1 })], fx: [{ type: 'glow', x: .55, y: .78, r: .3, on: [.1, .7], color: '#ffb0c0' }, { type: 'motes', n: 70, color: '#ffc7d2' }] },
        ],
      },
      {
        id: 'sychar', place: '수가 (야곱의 우물)', lon: 35.285, lat: 32.209, kind: 'teaching', title: '우물가의 여인', ref: '요한복음 4:1–42',
        summary: '사마리아 수가의 야곱의 우물에서, 예수님은 한낮에 물을 길으러 온 여인에게 물을 청하시고 영원히 목마르지 않는 생수에 대해 말씀하십니다. 여인은 마을로 달려가 사람들을 데려옵니다.',
        beats: [
          { sky: 'day', text: '사마리아 수가 근처, 오래된 야곱의 우물. 한낮의 햇볕이 뜨겁습니다.', sun: [.5, .1], layers: [hills(.58, .2, 44, .1), { type: 'mountain', x: .2, y: .64, w: .4, h: .2, depth: .3 }, { type: 'well', x: .55, y: .86, s: 1.1, depth: .85 }, jesus(.4, .9, { pose: 'kneel' }), near(.93)], fx: [{ type: 'rays', strength: .8 }] },
          { sky: 'day', text: '물동이를 든 사마리아 여인에게 예수님이 먼저 물을 청하십니다.', sun: [.5, .1], layers: [hills(.58, .2, 44, .1), { type: 'well', x: .5, y: .86, s: 1.1, depth: .85 }, jesus(.32, .9), { type: 'figure', x: .7, y: .9, s: 1.25, depth: .94, veil: true }], fx: [{ type: 'motes', n: 30 }] },
          { sky: 'day', skyTo: 'divine', text: '“이 물을 마시는 사람은 다시 목마르지만, 내가 주는 물은 영원히 솟는 샘이 된다.” (요약)', layers: [hills(.58, .2, 44, .1), { type: 'well', x: .5, y: .86, s: 1.1, depth: .85 }, jesus(.32, .9, { reach: 1, glow: 1 }), { type: 'figure', x: .7, y: .9, s: 1.25, depth: .94, veil: true }], fx: [{ type: 'glow', x: .5, y: .78, r: .18, on: [.2, .7], color: '#bfe8ff' }, { type: 'motes', n: 60, color: '#d6f0ff' }] },
          { sky: 'sunset', text: '여인은 물동이를 두고 마을로 달려가고, 많은 사마리아 사람이 예수님께 나아옵니다.', layers: [hills(.58, .2, 44, .1), { type: 'city', x: .75, w: .3, y: .7, depth: .5, seed: 44 }, { type: 'crowd', x: .55, w: .5, y: .88, n: 30, s: .5, depth: .88, appear: [0, .8] }], fx: [{ type: 'rays' }, { type: 'birds' }] },
        ],
      },
      {
        id: 'capernaum', place: '가버나움', lon: 35.575, lat: 32.881, kind: 'miracle', title: '지붕을 뚫고 내려온 중풍병자', ref: '마가복음 2:1–12',
        summary: '가버나움의 한 집에 사람들이 가득 모여 문 앞까지 빈틈이 없자, 네 사람이 중풍병자를 메고 지붕을 뜯어 내려보냅니다. 예수님은 그들의 믿음을 보시고 죄 사함을 선포하신 뒤, 그를 일어나 걸어가게 하십니다.',
        beats: [
          { sky: 'day', text: '갈릴리 바닷가 마을 가버나움. 예수님이 계신 집에 사람들이 몰려듭니다.', layers: [...galilee(0, 50), { type: 'city', x: .5, w: .9, y: .8, depth: .7, seed: 50 }, { type: 'crowd', x: .5, w: .8, y: .92, n: 40, s: .5, depth: .95 }], fx: [{ type: 'birds' }, { type: 'rays', strength: .5 }] },
          { sky: 'day', text: '네 사람이 중풍병자를 메고 왔지만, 문 앞까지 사람이 가득해 들어갈 수 없었습니다.', layers: [hills(.6, .2, 50, .06), { type: 'city', x: .5, w: .5, y: .78, depth: .6, seed: 51, s: 2 }, man(.2, .92, { pose: 'lying', s: 1.3 }), man(.12, .93), man(.28, .93), { type: 'crowd', x: .6, w: .5, y: .92, n: 24, s: .55, depth: .96 }], fx: [{ type: 'motes', n: 20 }] },
          { sky: 'day', text: '그들은 지붕을 뜯어 구멍을 내고, 병자가 누운 자리를 예수님 앞으로 달아 내립니다.', layers: [hills(.6, .2, 50, .06), { type: 'city', x: .5, w: .5, y: .78, depth: .6, seed: 51, s: 2 }, man(.5, .5, { pose: 'lying', s: 1.2, dy: [0, 1], rise: .3, depth: .7 })], fx: [{ type: 'beam', x: .5, y: .85, w: 120 }, { type: 'motes', n: 40 }] },
          { sky: 'divine', text: '“일어나 네 자리를 들고 걸어가라.” 그는 곧 일어나 모두가 보는 앞에서 걸어 나갑니다. (요약)', layers: [hills(.6, .2, 52, .06), jesus(.35, .92), man(.62, .92, { raise: [.2, .6] }), { type: 'crowd', x: .5, w: 1, y: .97, n: 30, s: .6, depth: .99, raise: [.4, .8] }], fx: [{ type: 'rays', strength: 1.2 }, { type: 'glow', x: .62, y: .75, r: .15, on: [.1, .5] }, { type: 'flare' }] },
        ],
      },
      {
        id: 'beatitudes', place: '팔복산 (전승지)', lon: 35.553, lat: 32.883, kind: 'teaching', title: '산 위에서 가르치시다', ref: '마태복음 5–7장', note: '팔복산은 전통적 기념 장소입니다.',
        summary: '예수님은 무리를 보시고 산에 올라 앉아 가르치십니다. 심령이 가난한 자, 애통하는 자, 온유한 자가 복이 있다는 말씀으로 시작해, 세상의 소금과 빛, 원수 사랑, 주기도, 반석 위의 집에 대해 말씀하십니다.',
        beats: [
          { sky: 'dawn', text: '갈릴리 바다가 내려다보이는 언덕. 무리가 예수님을 따라 산으로 올라옵니다.', layers: [...galilee(0, 55), hills(.7, .5, 56, .14), { type: 'crowd', x: .5, w: .9, y: .82, n: 60, s: .4, depth: .7 }], fx: [{ type: 'rays' }, { type: 'birds', y: .3 }, { type: 'motes', n: 30 }] },
          { sky: 'dawn', skyTo: 'day', text: '“심령이 가난한 사람, 슬퍼하는 사람, 온유한 사람은 복이 있다.” (요약)', layers: [...galilee(0, 55), hills(.72, .55, 56, .12), jesus(.5, .78, { pose: 'kneel', s: 1.4, depth: .75 }), { type: 'crowd', x: .5, w: 1, y: .92, n: 40, s: .55, depth: .95 }], fx: [{ type: 'rays', strength: 1.2 }, { type: 'motes', n: 50 }] },
          { sky: 'day', text: '“너희는 세상의 소금이요 빛이다. 등불은 등경 위에 두어 모두를 비춘다.” (요약)', layers: [...galilee(0, 57), { type: 'city', x: .78, w: .2, y: .6, depth: .3, seed: 57 }, hills(.75, .6, 58, .1), { type: 'trees', kind: 'olive', xs: [.12, .9], y: .92, depth: .9, s: 1.4 }], fx: [{ type: 'glow', x: .78, y: .56, r: .12, a: .6 }, { type: 'birds' }, { type: 'flare' }] },
          { sky: 'sunset', text: '“말씀을 듣고 행하는 사람은 반석 위에 집을 지은 지혜로운 사람과 같다.” 무리는 그 가르침에 놀랍니다. (요약)', layers: [...galilee(0, 55), hills(.72, .55, 56, .12), jesus(.5, .8, { s: 1.4, depth: .75, reach: .6 }), { type: 'crowd', x: .5, w: 1, y: .93, n: 44, s: .55, depth: .95 }], fx: [{ type: 'rays' }, { type: 'motes', n: 60 }] },
        ],
      },
      {
        id: 'storm', place: '갈릴리 바다', lon: 35.59, lat: 32.83, kind: 'miracle', title: '바람과 바다를 잔잔하게 하시다', ref: '마가복음 4:35–41',
        summary: '저녁에 제자들과 배를 타고 건너가실 때 큰 광풍이 일어 물결이 배에 들이칩니다. 고물에서 주무시던 예수님이 일어나 바람을 꾸짖고 바다에 잠잠하라 하시자 아주 잔잔해집니다.',
        beats: [
          { sky: 'dusk', text: '저녁 무렵, 예수님과 제자들은 배를 타고 갈릴리 바다 건너편으로 향합니다.', layers: [...galilee(0, 60), { type: 'boat', x: .45, y: .8, s: 1, depth: .85, storm: 0 }], fx: [{ type: 'motes', n: 30 }, { type: 'birds', y: .3 }] },
          { sky: 'storm', text: '갑자기 큰 광풍이 일어나 물결이 배 안으로 들이칩니다. 제자들은 두려움에 소리칩니다.', clouds: 8, layers: [...galilee(1, 60), { type: 'boat', x: .5, y: .8, s: 1.1, depth: .85, storm: 1 }], fx: [{ type: 'rain' }, { type: 'lightning' }, { type: 'wind' }, { type: 'shake', amp: 4 }] },
          { sky: 'storm', text: '고물에서 주무시던 예수님이 일어나 바람을 꾸짖으십니다. “잠잠하라, 고요하라.” (요약)', clouds: 8, layers: [...galilee(1, 60), { type: 'boat', x: .5, y: .82, s: 1.4, depth: .85, storm: 1, crew: 3 }, jesus(.5, .7, { s: 1.1, depth: .9, raise: [.3, .6] })], fx: [{ type: 'rain', on: { from: 1, to: .4, at: [.5, 1] } }, { type: 'wind' }, { type: 'glow', x: .5, y: .55, r: .2, on: [.4, .8] }] },
          { sky: 'storm', skyTo: 'sunset', skyAt: [0, .5], text: '바람이 그치고 바다는 아주 잔잔해집니다. 제자들은 “이분이 누구시기에” 하며 놀랍니다.', layers: [...galilee({ from: 1, to: 0, at: [0, .5] }, 60), { type: 'boat', x: .5, y: .8, s: 1.1, depth: .85, storm: { from: 1, to: 0, at: [0, .5] } }], fx: [{ type: 'rain', on: { from: .4, to: 0, at: [0, .3] } }, { type: 'rays', strength: [.3, .8] }, { type: 'flare' }, { type: 'birds', y: .3 }] },
        ],
      },
      {
        id: 'gerasa', place: '거라사 지방', lon: 35.65, lat: 32.83, kind: 'miracle', title: '군대 귀신 들린 사람', ref: '마가복음 5:1–20', note: '거라사(게르게사) 지방의 위치에는 여러 견해가 있습니다.',
        summary: '바다 건너 거라사 지방에서, 무덤 사이에 살며 쇠사슬로도 묶을 수 없던 사람이 예수님께 나아옵니다. 예수님이 더러운 귀신을 내쫓으시자 그는 옷을 입고 정신이 온전해져, 데가볼리에 이 일을 전합니다.',
        beats: [
          { sky: 'dusk', text: '바다 건너편 거라사 지방. 무덤가에서 밤낮 소리 지르던 사람이 있었습니다.', layers: [hills(.55, .2, 65, .14), { type: 'cave', x: .7, y: .84, s: .9, depth: .7 }, man(.4, .9, { raise: .8 }), near(.94)], fx: [{ type: 'wind', on: .5 }, { type: 'motes', n: 20, color: '#b8a8e0' }] },
          { sky: 'dusk', text: '그는 예수님을 보자 달려와 엎드립니다. 아무도 그를 쇠사슬로 묶어 둘 수 없었습니다.', layers: [hills(.55, .2, 65, .14), jesus(.62, .9), man(.42, .92, { pose: 'kneel' })], fx: [{ type: 'motes', n: 30 }] },
          { sky: 'dusk', skyTo: 'sunset', text: '예수님의 명령에 더러운 영들이 떠나가고, 비탈의 돼지 떼가 바다로 내리달립니다.', layers: [hills(.55, .2, 65, .14), { type: 'sea', y: .7, depth: .5 }, jesus(.62, .9, { reach: -1, glow: 1 }), man(.42, .92, { pose: 'kneel' })], fx: [{ type: 'flash', at: .25, a: .5 }, { type: 'wind', on: [0, .3] }, { type: 'glow', x: .5, y: .7, r: .2, on: [.2, .6] }] },
          { sky: 'sunset', text: '옷을 입고 온전해진 그는, 데가볼리 온 지역에 주께서 행하신 일을 전합니다.', layers: [hills(.58, .2, 66, .1), { type: 'city', x: .3, w: .3, y: .7, depth: .5, seed: 66 }, man(.6, .92, { staff: true })], fx: [{ type: 'rays' }, { type: 'birds' }, { type: 'flare' }] },
        ],
      },
      {
        id: 'nain', place: '나인', lon: 35.35, lat: 32.63, kind: 'miracle', title: '나인 성 과부의 아들', ref: '누가복음 7:11–17',
        summary: '나인 성문 가까이에서, 예수님은 과부의 외아들을 장사하러 나오는 행렬을 만나십니다. 울지 말라 하시고 관에 손을 대시며 청년에게 일어나라 하시자, 죽었던 청년이 일어나 앉아 말을 합니다.',
        beats: [
          { sky: 'dusk', text: '나인 성문 앞. 한 과부의 외아들을 장사하러 가는 슬픈 행렬이 나옵니다.', layers: [hills(.6, .22, 70, .1), { type: 'walls', x: .65, w: .4, y: .7, h: .1, depth: .5, seed: 70 }, { type: 'crowd', x: .55, w: .35, y: .9, n: 22, s: .55, depth: .92 }, man(.42, .93, { pose: 'lying', s: 1.1 })], fx: [{ type: 'motes', n: 20, color: '#c0b0e0' }] },
          { sky: 'dusk', text: '예수님은 그 어머니를 보시고 불쌍히 여기시며 “울지 말라” 하십니다. (요약)', layers: [hills(.6, .22, 70, .1), jesus(.3, .9), { type: 'figure', x: .5, y: .91, s: 1.25, depth: .94, veil: true, pose: 'kneel' }], fx: [{ type: 'motes', n: 40 }] },
          { sky: 'dusk', skyTo: 'divine', text: '관에 손을 대시고 말씀하십니다. “청년아, 일어나라.” (요약)', layers: [hills(.6, .22, 70, .1), jesus(.3, .9, { reach: 1, glow: 1 }), man(.55, .93, { pose: 'lying', s: 1.2 })], fx: [{ type: 'glow', x: .55, y: .85, r: .2, on: [.3, .8] }, { type: 'rays', strength: [.3, .9] }, { type: 'motes', n: 60 }] },
          { sky: 'divine', text: '죽었던 청년이 일어나 앉아 말을 하고, 예수님은 그를 어머니에게 돌려주십니다.', layers: [hills(.6, .22, 70, .1), man(.5, .92), { type: 'figure', x: .6, y: .92, s: 1.2, depth: .94, veil: true }, { type: 'crowd', x: .5, w: 1, y: .97, n: 30, s: .6, depth: .99, raise: [.3, .6] }], fx: [{ type: 'rays', strength: 1.2 }, { type: 'flare' }, { type: 'birds' }] },
        ],
      },
      {
        id: 'feeding', place: '벳새다 근처 빈 들', lon: 35.63, lat: 32.91, kind: 'miracle', title: '오병이어', ref: '요한복음 6:1–14 · 마가복음 6:30–44',
        summary: '날이 저물도록 말씀을 듣던 큰 무리에게 먹을 것이 없자, 예수님은 한 아이가 가져온 보리떡 다섯 개와 물고기 두 마리를 들고 축사하십니다. 남자만 오천 명이 배불리 먹고 남은 조각이 열두 바구니에 찼습니다.',
        beats: [
          { sky: 'sunset', text: '날이 저물어 가는 빈 들. 말씀을 듣던 수많은 사람에게 먹을 것이 없습니다.', layers: [...galilee(0, 75), hills(.68, .5, 76, .1), { type: 'crowd', x: .5, w: 1.1, y: .78, n: 90, s: .32, depth: .65 }, { type: 'crowd', x: .5, w: 1, y: .92, n: 30, s: .55, depth: .95 }], fx: [{ type: 'rays' }, { type: 'birds', y: .25 }] },
          { sky: 'sunset', text: '한 아이가 보리떡 다섯 개와 물고기 두 마리를 내어놓습니다.', layers: [...galilee(0, 75), hills(.7, .5, 76, .1), jesus(.4, .9), { type: 'figure', x: .55, y: .9, s: 1.25, depth: .94, pose: 'child' }, { type: 'baskets', x: .55, y: .93, s: .6, n: 1 }], fx: [{ type: 'motes', n: 40 }] },
          { sky: 'sunset', skyTo: 'divine', text: '예수님이 떡을 들어 감사 기도를 드리고 나누어 주시자, 떡이 끊임없이 나뉘어 갑니다.', layers: [...galilee(0, 75), hills(.7, .5, 76, .1), jesus(.5, .88, { raise: [0, .3], glow: 1 }), { type: 'baskets', x: .5, y: .96, s: .8, n: 12, grow: [.2, .9] }], fx: [{ type: 'glow', x: .5, y: .8, r: .25, on: [.1, .5], color: '#ffd68c' }, { type: 'motes', n: 70, color: '#ffe3a8' }, { type: 'rays', strength: 1.2 }] },
          { sky: 'dusk', text: '남자만 오천 명이 배불리 먹고, 남은 조각을 거두니 열두 바구니에 가득 찼습니다.', layers: [...galilee(0, 75), hills(.7, .5, 76, .1), { type: 'baskets', x: .5, y: .9, s: 1, n: 12 }, { type: 'crowd', x: .5, w: 1.1, y: .78, n: 70, s: .32, depth: .65 }], fx: [{ type: 'motes', n: 60 }, { type: 'birds', y: .28 }] },
        ],
      },
      {
        id: 'walking', place: '갈릴리 바다 위', lon: 35.6, lat: 32.86, kind: 'miracle', title: '물 위를 걸으시다', ref: '마태복음 14:22–33',
        summary: '오병이어 후 제자들을 먼저 배로 보내신 예수님은, 밤 사경에 바다 위를 걸어 제자들에게 오십니다. 베드로가 물 위로 걸어오다 바람을 보고 빠져 가자, 예수님이 손을 내밀어 붙잡으십니다.',
        beats: [
          { sky: 'night', text: '밤 깊은 시각, 제자들의 배는 거센 맞바람에 시달리고 있었습니다.', layers: [...galilee(.5, 80), { type: 'boat', x: .6, y: .78, s: .9, depth: .8, storm: .5 }], fx: [{ type: 'wind', on: .6 }, { type: 'motes', n: 20, color: '#aac4ff' }] },
          { sky: 'night', text: '새벽 무렵, 누군가 물 위를 걸어 다가옵니다. 제자들은 유령인 줄 알고 소리칩니다.', layers: [...galilee(.5, 80), { type: 'boat', x: .7, y: .78, s: .9, depth: .8, storm: .5 }, jesus(.25, .8, { s: 1, depth: .82, dx: [0, 1], move: .15 })], fx: [{ type: 'wind', on: .5 }, { type: 'glow', x: .3, y: .74, r: .12, a: .5 }] },
          { sky: 'night', text: '“안심하라, 나다.” 베드로가 배에서 내려 물 위를 걸어 예수님께로 갑니다. (요약)', layers: [...galilee(.6, 80), { type: 'boat', x: .78, y: .78, s: .9, depth: .8, storm: .6 }, jesus(.4, .82, { s: 1.1, depth: .84 }), man(.6, .84, { s: 1.05, depth: .85, dx: [0, 1], move: -.08 })], fx: [{ type: 'wind', on: .7 }, { type: 'glow', x: .4, y: .74, r: .14, a: .5 }] },
          { sky: 'night', skyTo: 'dawn', text: '바람을 보고 빠져 가던 베드로를 예수님이 붙잡으시고, 배에 오르시자 바람이 그칩니다.', layers: [...galilee({ from: .6, to: 0, at: [.3, .8] }, 80), jesus(.45, .82, { s: 1.15, depth: .84, reach: 1 }), man(.55, .88, { s: 1.05, depth: .85, pose: 'kneel' })], fx: [{ type: 'wind', on: { from: .7, to: 0, at: [.3, .7] } }, { type: 'glow', x: .5, y: .72, r: .2, on: [.2, .6] }, { type: 'rays', strength: [.5, 1] }] },
        ],
      },
      {
        id: 'philippi', place: '가이사랴 빌립보', lon: 35.694, lat: 33.248, kind: 'teaching', title: '“너희는 나를 누구라 하느냐”', ref: '마태복음 16:13–20',
        summary: '헤르몬 산 기슭 가이사랴 빌립보에서, 예수님은 제자들에게 사람들이 자신을 누구라 하는지, 너희는 누구라 하는지 물으십니다. 베드로는 주는 그리스도시요 살아 계신 하나님의 아들이라고 고백합니다.',
        beats: [
          { sky: 'day', text: '헤르몬 산 기슭, 샘이 솟는 가이사랴 빌립보. 바위 절벽 아래로 맑은 물이 흐릅니다.', layers: [{ type: 'mountain', x: .5, y: .62, w: .9, h: .4, depth: .2 }, hills(.66, .4, 85, .08), { type: 'cave', x: .7, y: .86, s: 1, depth: .7 }, { type: 'trees', kind: 'olive', xs: [.1, .3], y: .92, depth: .9, s: 1.3 }], fx: [{ type: 'birds' }, { type: 'rays', strength: .6 }] },
          { sky: 'day', text: '예수님이 물으십니다. “사람들은 나를 누구라 하느냐?” (요약)', layers: [{ type: 'mountain', x: .5, y: .62, w: .9, h: .4, depth: .2 }, hills(.66, .4, 85, .08), jesus(.35, .9), { type: 'crowd', x: .66, w: .35, y: .91, n: 11, s: .62, depth: .95 }], fx: [{ type: 'motes', n: 30 }] },
          { sky: 'sunset', text: '“그러면 너희는 나를 누구라 하느냐?” 잠시 정적이 흐릅니다. (요약)', layers: [{ type: 'mountain', x: .5, y: .62, w: .9, h: .4, depth: .2, glow: .4 }, hills(.66, .4, 85, .08), jesus(.4, .9, { s: 1.5 }), man(.62, .92)], fx: [{ type: 'rays' }, { type: 'motes', n: 40 }] },
          { sky: 'sunset', skyTo: 'divine', text: '베드로가 대답합니다. “주는 그리스도시요, 살아 계신 하나님의 아들이십니다.” (요약)', layers: [{ type: 'mountain', x: .5, y: .62, w: .9, h: .4, depth: .2, glow: [0, .8] }, hills(.66, .4, 85, .08), jesus(.4, .9, { s: 1.5, glow: 1 }), man(.62, .92, { pose: 'kneel' })], fx: [{ type: 'rays', strength: 1.3 }, { type: 'flare' }, { type: 'motes', n: 60 }] },
        ],
      },
      {
        id: 'transfig', place: '변화산 (다볼산 전승)', lon: 35.39, lat: 32.687, kind: 'miracle', title: '산 위에서 변화되시다', ref: '마태복음 17:1–8', note: '변화산은 다볼산과 헤르몬산 등 여러 전승이 있습니다.',
        summary: '예수님은 베드로와 야고보와 요한을 데리고 높은 산에 오르십니다. 그들 앞에서 얼굴이 해같이 빛나고 옷이 빛처럼 희어지며, 모세와 엘리야가 함께 나타납니다. 구름 속에서 “이는 내 사랑하는 아들이니 그의 말을 들으라”는 소리가 들립니다.',
        beats: [
          { sky: 'dawn', text: '예수님은 세 제자를 데리고 높은 산에 따로 오르십니다.', layers: [hills(.6, .15, 90, .08), { type: 'mountain', x: .5, y: .72, w: .7, h: .42, depth: .35 }, { type: 'crowd', x: .5, w: .12, y: .92, n: 4, s: .6, depth: .95 }], fx: [{ type: 'rays' }, { type: 'birds', y: .3 }] },
          { sky: 'divine', text: '그들 앞에서 예수님의 모습이 변하여, 얼굴은 해처럼 빛나고 옷은 빛처럼 희어집니다.', sun: [.5, .45], layers: [hills(.66, .3, 91, .06), jesus(.5, .8, { s: 1.6, depth: .8, glow: [0, .6] }), man(.25, .93, { pose: 'kneel' }), man(.75, .93, { pose: 'kneel' })], fx: [{ type: 'glow', x: .5, y: .62, r: .4, on: [0, .6], a: .9 }, { type: 'rays', strength: 1.6 }, { type: 'flash', at: .3, a: .4 }] },
          { sky: 'divine', text: '모세와 엘리야가 나타나 예수님과 함께 이야기합니다.', sun: [.5, .45], layers: [hills(.66, .3, 91, .06), jesus(.5, .8, { s: 1.6, depth: .8, glow: 1 }), man(.32, .82, { s: 1.4, depth: .78, staff: true }), man(.68, .82, { s: 1.4, depth: .78 })], fx: [{ type: 'glow', x: .5, y: .62, r: .4, a: .7 }, { type: 'motes', n: 70 }] },
          { sky: 'divine', text: '빛난 구름 속에서 소리가 들립니다. “이는 내 사랑하는 아들이니, 너희는 그의 말을 들으라.” (요약)', clouds: 9, layers: [hills(.66, .3, 91, .06), jesus(.5, .82, { s: 1.4, depth: .8 }), man(.3, .94, { pose: 'kneel' }), man(.7, .94, { pose: 'kneel' })], fx: [{ type: 'beam', x: .5, y: .8, w: 220 }, { type: 'rays', strength: 1.4 }, { type: 'flare' }] },
        ],
      },
      {
        id: 'bethesda', place: '베데스다 못', lon: 35.236, lat: 31.781, kind: 'miracle', title: '38년 된 병자', ref: '요한복음 5:1–9',
        summary: '예루살렘 양문 곁 행각 다섯이 있는 베데스다 못에는 많은 병자들이 누워 있었습니다. 예수님은 38년 동안 앓던 사람에게 낫고자 하느냐 물으시고, 일어나 자리를 들고 걸어가라 하십니다.',
        beats: [
          { sky: 'day', text: '예루살렘 양문 곁, 다섯 행각이 있는 베데스다 못. 많은 병자가 물가에 누워 있습니다.', layers: [{ type: 'city', x: .5, w: 1, y: .56, depth: .3, seed: 95 }, { type: 'pool', x: .5, y: .82, w: .8, s: 1, depth: .7 }, man(.25, .94, { pose: 'lying', s: 1 }), man(.75, .94, { pose: 'lying', s: 1 })], fx: [{ type: 'rays', strength: .6 }, { type: 'motes', n: 20 }] },
          { sky: 'day', text: '서른여덟 해 동안 병을 앓던 사람이 있었습니다. 그를 물에 넣어 줄 사람이 없었습니다.', layers: [{ type: 'pool', x: .5, y: .78, w: .9, s: 1.1, depth: .6 }, man(.45, .93, { pose: 'lying', s: 1.3 })], fx: [{ type: 'motes', n: 20, color: '#c8d8ff' }] },
          { sky: 'day', text: '예수님이 물으십니다. “낫고자 하느냐?” 그리고 말씀하십니다. “일어나 걸어가라.” (요약)', layers: [{ type: 'pool', x: .5, y: .78, w: .9, s: 1.1, depth: .6, stir: [.3, .8] }, jesus(.3, .92), man(.55, .93, { pose: 'lying', s: 1.3 })], fx: [{ type: 'glow', x: .55, y: .86, r: .15, on: [.4, .8] }, { type: 'motes', n: 40 }] },
          { sky: 'divine', text: '그 사람은 곧 나아서 자리를 들고 걸어갑니다. 그날은 안식일이었습니다.', layers: [{ type: 'pool', x: .5, y: .78, w: .9, s: 1.1, depth: .6 }, man(.55, .92, { raise: [.2, .5] })], fx: [{ type: 'rays', strength: 1.2 }, { type: 'flare' }, { type: 'birds' }] },
        ],
      },
      {
        id: 'siloam', place: '실로암 못', lon: 35.235, lat: 31.77, kind: 'miracle', title: '태어날 때부터 눈먼 사람', ref: '요한복음 9장',
        summary: '예수님은 나면서부터 눈먼 사람의 눈에 진흙을 바르시고 실로암 못에 가서 씻으라 하십니다. 그가 씻고 보게 되어 돌아오자 논쟁이 일어나고, 그는 예수님을 믿는다고 고백합니다.',
        beats: [
          { sky: 'dusk', text: '길가에 태어날 때부터 앞을 보지 못하는 사람이 앉아 있었습니다.', layers: [...jerusalem(true, .45), man(.55, .93, { pose: 'kneel' }), near(.95)], fx: [{ type: 'motes', n: 20 }] },
          { sky: 'dusk', text: '“나는 세상의 빛이다.” 예수님은 진흙을 이겨 그의 눈에 바르십니다. (요약)', layers: [...jerusalem(true, .45), jesus(.4, .92, { reach: 1, glow: 1 }), man(.58, .93, { pose: 'kneel' })], fx: [{ type: 'glow', x: .5, y: .78, r: .15, a: .5 }, { type: 'motes', n: 30 }] },
          { sky: 'dawn', text: '그는 실로암 못으로 가서 눈을 씻습니다.', layers: [{ type: 'pool', x: .5, y: .82, w: .7, s: .9, depth: .6 }, man(.5, .93, { pose: 'kneel' })], fx: [{ type: 'rays', strength: [.2, 1] }, { type: 'motes', n: 40 }] },
          { sky: 'dawn', skyTo: 'divine', text: '처음으로 세상을 보게 된 그의 눈에 빛이 쏟아져 들어옵니다.', layers: [hills(.62, .2, 98, .08), man(.5, .93, { s: 1.6, raise: [.2, .6] })], fx: [{ type: 'flash', at: .15, a: .9 }, { type: 'rays', strength: 1.6 }, { type: 'flare' }, { type: 'birds' }, { type: 'motes', n: 60 }] },
        ],
      },
      {
        id: 'bethany', place: '베다니', lon: 35.261, lat: 31.771, kind: 'miracle', title: '나사로야, 나오라', ref: '요한복음 11:1–44',
        summary: '베다니의 나사로가 죽어 무덤에 묻힌 지 나흘째, 예수님은 마르다에게 “나는 부활이요 생명이니”라고 말씀하십니다. 무덤 앞에서 눈물을 흘리시고 돌을 옮겨 놓게 하신 뒤, 큰 소리로 나사로를 부르시자 그가 걸어 나옵니다.',
        beats: [
          { sky: 'dusk', text: '예루살렘 가까운 마을 베다니. 나사로가 죽어 장사한 지 나흘이 지났습니다.', layers: [hills(.6, .2, 100, .1), { type: 'city', x: .3, w: .35, y: .7, depth: .5, seed: 100, lights: true }, { type: 'tomb', x: .75, y: .86, s: .7, depth: .7 }, near(.94)], fx: [{ type: 'motes', n: 20, color: '#c0b0e0' }] },
          { sky: 'dusk', text: '“나는 부활이요 생명이다. 나를 믿는 사람은 죽어도 살겠다.” (요약)', layers: [hills(.6, .2, 100, .1), jesus(.4, .92), { type: 'figure', x: .6, y: .93, s: 1.25, depth: .94, veil: true, pose: 'kneel' }], fx: [{ type: 'motes', n: 40 }, { type: 'glow', x: .4, y: .7, r: .15, a: .4 }] },
          { sky: 'dusk', text: '예수님은 눈물을 흘리시고, 무덤의 돌을 옮겨 놓으라고 하십니다.', layers: [hills(.6, .2, 100, .1), { type: 'tomb', x: .62, y: .9, s: .9, depth: .7, open: [.3, .9] }, jesus(.22, .93), { type: 'crowd', x: .3, w: .2, y: .95, n: 10, s: .55, depth: .97 }], fx: [{ type: 'motes', n: 30 }] },
          { sky: 'dusk', skyTo: 'divine', text: '“나사로야, 나오라.” 그러자 죽었던 나사로가 수의를 감은 채 걸어 나옵니다. (요약)', layers: [hills(.6, .2, 100, .1), { type: 'tomb', x: .62, y: .9, s: .9, depth: .7, open: 1 }, jesus(.22, .93, { raise: [0, .3], glow: 1 }), { type: 'figure', x: .62, y: .88, s: 1.1, depth: .75, glow: [.3, .8] }], fx: [{ type: 'shout', x: .25, y: .7, on: [0, .3] }, { type: 'rays', strength: 1.3 }, { type: 'motes', n: 60 }] },
        ],
      },
      {
        id: 'jericho-j', place: '여리고', lon: 35.444, lat: 31.866, kind: 'miracle', title: '바디매오와 삭개오', ref: '누가복음 18:35–19:10',
        summary: '여리고 길가에서 맹인 바디매오는 다윗의 자손 예수여 불쌍히 여기소서 외치다가 다시 보게 됩니다. 성 안에서는 키가 작은 세리장 삭개오가 뽕나무에 올라가 예수님을 보고, 그의 집에 머무시겠다는 말씀에 삶을 돌이킵니다.',
        beats: [
          { sky: 'day', text: '종려나무가 늘어선 여리고 길. 앞을 보지 못하는 바디매오가 길가에 앉아 있습니다.', layers: [hills(.58, .2, 105, .09), { type: 'road', y: .66 }, { type: 'trees', kind: 'palm', xs: [.08, .2, .82, .94], y: .9, depth: .85, s: 1.2 }, man(.3, .9, { pose: 'kneel' })], fx: [{ type: 'birds' }, { type: 'rays', strength: .5 }] },
          { sky: 'day', text: '“다윗의 자손 예수여, 저를 불쌍히 여겨 주십시오!” 예수님은 걸음을 멈추고 그를 다시 보게 하십니다. (요약)', layers: [hills(.58, .2, 105, .09), { type: 'road', y: .66 }, jesus(.55, .9, { reach: -1, glow: 1 }), man(.35, .92, { raise: [.3, .7] })], fx: [{ type: 'glow', x: .4, y: .7, r: .15, on: [.3, .7] }, { type: 'flash', at: .4, a: .4 }] },
          { sky: 'day', text: '성 안에서는 키가 작은 세리장 삭개오가 예수님을 보려고 뽕나무에 올라갑니다.', layers: [{ type: 'city', x: .3, w: .6, y: .68, depth: .45, seed: 106 }, { type: 'sycamore', x: .66, y: .92, s: 1, depth: .8, person: true }, { type: 'crowd', x: .4, w: .5, y: .94, n: 22, s: .55, depth: .95 }], fx: [{ type: 'birds' }] },
          { sky: 'sunset', text: '“오늘 네 집에 머물러야겠다.” 삭개오는 기뻐하며 소유를 나누고 잘못을 갚겠다고 고백합니다. (요약)', layers: [{ type: 'city', x: .5, w: .8, y: .7, depth: .45, seed: 106, lights: true }, jesus(.4, .92), man(.6, .93, { s: .95, raise: [.2, .5] })], fx: [{ type: 'rays' }, { type: 'motes', n: 50 }, { type: 'flare' }] },
        ],
      },
      {
        id: 'gethsemane', place: '겟세마네', lon: 35.24, lat: 31.779, kind: 'teaching', title: '겟세마네의 기도', ref: '마태복음 26:36–46',
        summary: '마지막 만찬 후, 예수님은 감람산 기슭 겟세마네 동산에서 제자들에게 깨어 있으라 하시고 조금 나아가 엎드려 기도하십니다. 할 수만 있다면 이 잔을 지나가게 해 달라 하시면서도, 아버지의 뜻대로 되기를 구하십니다.',
        beats: [
          { sky: 'night', text: '마지막 만찬을 마친 밤, 예수님은 제자들과 감람산 기슭 겟세마네로 가십니다.', layers: [...jerusalem(true, .35), hills(.78, .6, 110, .08), { type: 'trees', kind: 'olive', xs: [.1, .25, .75, .9], y: .92, depth: .85, s: 1.5 }], fx: [{ type: 'motes', n: 30, color: '#b0c8ff' }] },
          { sky: 'night', text: '“내 마음이 매우 고민되어 죽게 되었으니, 여기 머물러 나와 함께 깨어 있으라.” (요약)', layers: [hills(.7, .5, 110, .08), { type: 'trees', kind: 'olive', xs: [.15, .85], y: .92, depth: .85, s: 1.6 }, jesus(.5, .9, { glow: .4 }), { type: 'crowd', x: .3, w: .15, y: .94, n: 3, s: .6, depth: .96 }], fx: [{ type: 'motes', n: 30, color: '#b0c8ff' }] },
          { sky: 'night', text: '예수님은 조금 나아가 얼굴을 땅에 대고 기도하십니다. “내 뜻대로 마시고 아버지의 뜻대로 하옵소서.” (요약)', layers: [hills(.7, .5, 111, .08), { type: 'stones', x: .5, y: .94, s: .5, depth: .9 }, jesus(.5, .9, { pose: 'kneel', glow: .6 })], fx: [{ type: 'beam', x: .5, y: .9, w: 100, on: [.3, .8] }, { type: 'motes', n: 40, color: '#d0dcff' }] },
          { sky: 'night', text: '돌아와 보니 제자들은 잠들어 있었습니다. 멀리 횃불을 든 무리가 다가옵니다.', layers: [hills(.7, .5, 110, .08), { type: 'trees', kind: 'olive', xs: [.15, .85], y: .92, depth: .85, s: 1.6 }, jesus(.5, .9), { type: 'crowd', x: .3, w: .15, y: .94, n: 3, s: .6, depth: .96 }], fx: [{ type: 'embers', x: .85, y: .74, w: .1, on: .5 }, { type: 'glow', x: .85, y: .72, r: .08, color: '#ffaa55', a: .6 }] },
        ],
      },
      {
        id: 'tomb', place: '예루살렘 동산 무덤', lon: 35.23, lat: 31.778, kind: 'miracle', title: '부활의 아침', ref: '요한복음 20:1–18',
        summary: '십자가에 못 박히신 예수님은 동산의 새 무덤에 장사됩니다. 안식 후 첫날 이른 새벽, 막달라 마리아가 무덤에 갔을 때 돌이 옮겨져 있었고, 부활하신 예수님이 그녀의 이름을 부르십니다.',
        beats: [
          { sky: 'dusk', text: '골고다의 언덕 위로 어둠이 내려앉았습니다. 예수님은 동산의 새 무덤에 장사되십니다.', layers: [hills(.62, .2, 115, .14), { type: 'tomb', x: .65, y: .88, s: .9, depth: .7 }, { type: 'trees', kind: 'olive', xs: [.15], y: .92, depth: .85, s: 1.5 }], fx: [{ type: 'motes', n: 20, color: '#c0b0e0' }] },
          { sky: 'night', text: '안식일이 지나고, 아직 어두운 첫날 새벽. 마리아가 무덤을 찾아갑니다.', layers: [hills(.62, .2, 115, .14), { type: 'tomb', x: .65, y: .88, s: .9, depth: .7 }, { type: 'figure', x: .25, y: .92, s: 1.2, depth: .94, veil: true, dx: [0, 1], move: .1 }], fx: [{ type: 'motes', n: 30, color: '#b0c8ff' }] },
          { sky: 'night', skyTo: 'dawn', text: '무덤 입구를 막았던 큰 돌이 옮겨져 있고, 무덤은 비어 있었습니다.', layers: [hills(.62, .2, 115, .14), { type: 'tomb', x: .62, y: .9, s: 1, depth: .7, open: [.1, .7] }, { type: 'figure', x: .3, y: .93, s: 1.2, depth: .94, veil: true }], fx: [{ type: 'rays', strength: [.2, 1] }, { type: 'motes', n: 50 }] },
          { sky: 'dawn', skyTo: 'divine', text: '울고 있던 마리아를 누군가 이름으로 부릅니다. “마리아야.” 부활하신 예수님이셨습니다. (요약)', layers: [hills(.62, .2, 116, .12), { type: 'trees', kind: 'olive', xs: [.12, .9], y: .92, depth: .85, s: 1.4 }, jesus(.58, .9, { s: 1.5, glow: 1 }), { type: 'figure', x: .38, y: .92, s: 1.2, depth: .94, veil: true, pose: 'kneel' }], fx: [{ type: 'rays', strength: 1.5 }, { type: 'flare' }, { type: 'birds', y: .22 }, { type: 'motes', n: 80 }] },
        ],
      },
      {
        id: 'tiberias', place: '디베랴 바닷가', lon: 35.55, lat: 32.87, kind: 'miracle', title: '디베랴 바닷가의 아침', ref: '요한복음 21:1–17',
        summary: '부활 후 디베랴 바다에서 밤새 아무것도 잡지 못한 제자들에게, 바닷가에 선 예수님이 배 오른편에 그물을 던지라 하십니다. 그물에 큰 물고기 153마리가 가득 차고, 예수님은 숯불에 아침을 준비하시고 베드로에게 내 양을 먹이라 하십니다.',
        beats: [
          { sky: 'night', text: '부활 후의 어느 밤, 베드로와 제자들은 고기를 잡으러 나갔지만 아무것도 잡지 못합니다.', layers: [...galilee(.1, 120), { type: 'boat', x: .55, y: .78, s: .9, depth: .8, crew: 4 }], fx: [{ type: 'motes', n: 20, color: '#aac4ff' }] },
          { sky: 'dawn', text: '동틀 무렵, 바닷가에 선 누군가가 말합니다. “배 오른편에 그물을 던지라.” (요약)', layers: [...galilee(0, 120), { type: 'boat', x: .65, y: .78, s: .9, depth: .8, crew: 4 }, jesus(.2, .86, { s: 1.1, depth: .86 })], fx: [{ type: 'rays' }, { type: 'motes', n: 30 }] },
          { sky: 'dawn', text: '그물에 물고기가 가득 차 끌어올릴 수 없을 정도였습니다. 요한이 외칩니다. “주님이시다!”', layers: [...galilee(0, 120), { type: 'boat', x: .6, y: .8, s: 1.1, depth: .82, crew: 4 }], fx: [{ type: 'glow', x: .5, y: .84, r: .2, a: .6, color: '#d8f0ff' }, { type: 'motes', n: 70, color: '#e0f4ff' }, { type: 'rays', strength: 1.2 }, { type: 'flare' }] },
          { sky: 'sunset', text: '숯불 위에 생선과 떡이 놓인 아침 식사. 예수님은 베드로에게 세 번 물으시고, “내 양을 먹이라” 하십니다. (요약)', layers: [...galilee(0, 121), jesus(.4, .9), man(.6, .92, { pose: 'kneel' }), { type: 'altar', x: .5, y: .97, s: .35, fire: true, depth: .96 }], fx: [{ type: 'embers', x: .5, y: .93, w: .05 }, { type: 'rays' }, { type: 'birds', y: .3 }] },
        ],
      },
    ],
  };
})();
