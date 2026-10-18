/* 사주 계산 엔진: 만세력(절기·음력 표) 위에서 원국, 오행, 강약, 용신, 일운, 하루 리듬을 계산한다. */
(function (root) {
  const STEM_H = '甲乙丙丁戊己庚辛壬癸', STEM_K = '갑을병정무기경신임계';
  const BR_H = '子丑寅卯辰巳午未申酉戌亥', BR_K = '자축인묘진사오미신유술해';
  const EL_K = ['목', '화', '토', '금', '수'], EL_H = ['木', '火', '土', '金', '水'];
  const BR_EL = [4, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4];
  const BR_MAIN = [9, 5, 0, 1, 4, 2, 3, 5, 6, 7, 4, 8];
  const SIP = [['비견', '겁재'], ['식신', '상관'], ['편재', '정재'], ['편관', '정관'], ['편인', '정인']];
  const SIP_ORDER = ['비견', '겁재', '식신', '상관', '편재', '정재', '편관', '정관', '편인', '정인'];
  const GROUP = ['비겁', '식상', '재성', '관성', '인성'];
  const HAP = [[0, 1], [2, 11], [3, 10], [4, 9], [5, 8], [6, 7]];
  const JIE = ['입춘', '경칩', '청명', '입하', '망종', '소서', '입추', '백로', '한로', '입동', '대설', '소한'];
  const ROLE = ['용신', '희신', '한신', '구신', '기신'];
  const ROLE_SCORE = { 용신: 1, 희신: 0.5, 한신: 0, 구신: -0.5, 기신: -1 };
  /* 지장간: 지지 속에 숨은 천간과 비중(여기·중기·정기) */
  const HIDDEN = [
    [[8, 0.3], [9, 0.7]], [[9, 0.3], [7, 0.2], [5, 0.5]], [[4, 0.2], [2, 0.2], [0, 0.6]], [[0, 0.3], [1, 0.7]],
    [[1, 0.3], [9, 0.2], [4, 0.5]], [[4, 0.2], [6, 0.2], [2, 0.6]], [[2, 0.3], [5, 0.2], [3, 0.5]], [[3, 0.3], [1, 0.2], [5, 0.5]],
    [[4, 0.2], [8, 0.2], [6, 0.6]], [[6, 0.3], [7, 0.7]], [[7, 0.3], [3, 0.2], [4, 0.5]], [[4, 0.2], [0, 0.2], [8, 0.6]],
  ];
  /* 지지 관계: 충 > 육합 > 삼합(반합) > 형 > 해 > 파 순으로 하나만 본다 */
  const SAMHAP = [[8, 0, 4], [2, 6, 10], [5, 9, 1], [11, 3, 7]];
  const HYUNG = [[2, 5], [5, 8], [2, 8], [1, 10], [10, 7], [1, 7], [0, 3]];
  const SELF_HYUNG = [4, 6, 9, 11];
  const PA = [[0, 9], [6, 3], [8, 5], [2, 11], [4, 1], [10, 7]];
  const HAE = [[0, 7], [1, 6], [2, 5], [3, 4], [8, 11], [9, 10]];
  const REL_LABEL = { 합: '합(合)', 충: '충(沖)', 삼합: '삼합(三合)', 형: '형(刑)', 해: '해(害)', 파: '파(破)' };
  /* 한국 서머타임(시계를 1시간 앞당긴 기간, 현지 시각) */
  const DST = [
    ['1948-06-01T00:00', '1948-09-13T00:00'], ['1949-04-03T00:00', '1949-09-11T00:00'], ['1950-04-01T00:00', '1950-09-10T00:00'],
    ['1951-05-06T00:00', '1951-09-09T00:00'], ['1955-05-05T00:00', '1955-09-09T00:00'], ['1956-05-20T00:00', '1956-09-30T00:00'],
    ['1957-05-05T00:00', '1957-09-22T00:00'], ['1958-05-04T00:00', '1958-09-21T00:00'], ['1959-05-03T00:00', '1959-09-20T00:00'],
    ['1960-05-01T00:00', '1960-09-18T00:00'], ['1987-05-10T02:00', '1987-10-11T03:00'], ['1988-05-08T02:00', '1988-10-09T03:00'],
  ];
  /* 표준시가 UTC+8:30이던 기간: 시계가 이미 서울 태양시에 가까워 시진 경계를 늦추지 않는다 */
  const KST830 = [['1908-04-01', '1911-12-31'], ['1954-03-21', '1961-08-09']];

  const pad = (n) => String(n).padStart(2, '0');
  const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const isTime = (s) => typeof s === 'string' && /^\d{2}:\d{2}$/.test(s);
  const parts = (s) => s.split('-').map(Number);
  const dayNum = (s) => { const [y, m, d] = parts(s); return Math.round(Date.UTC(y, m - 1, d) / 864e5); };
  const fromDayNum = (n) => { const d = new Date(n * 864e5); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
  const validDate = (s) => { if (!isDate(s)) return false; const [y, m, d] = parts(s); return fromDayNum(dayNum(s)) === `${y}-${pad(m)}-${pad(d)}`; };
  const addDays = (s, k) => fromDayNum(dayNum(s) + k);
  const stamp = (s, hm) => { const [y, m, d] = parts(s); const [h, mi] = (hm || '12:00').split(':').map(Number); return Date.UTC(y, m - 1, d, h, mi); };
  const mod = (a, n) => ((a % n) + n) % n;

  const dayIndex = (s) => mod(54 + dayNum(s) - dayNum('2000-01-01'), 60); // 2000-01-01 = 戊午日
  const sexagenary = (stem, branch) => { for (let i = 0; i < 60; i++) if (i % 10 === stem && i % 12 === branch) return i; return -1; };
  const elOfStem = (s) => Math.floor(s / 2);
  const sipsung = (me, other) => SIP[mod(elOfStem(other) - elOfStem(me), 5)][me % 2 === other % 2 ? 0 : 1];
  const pairIn = (list, a, b) => list.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  const relation = (a, b) => {
    if (a === b) return '동';
    if (Math.abs(a - b) === 6) return '충';
    return pairIn(HAP, a, b) ? '합' : '보통';
  };
  /* 원국 지지와 그날 지지의 관계(하나): 충·합·삼합·형·해·파 또는 null */
  const relation2 = (a, b) => {
    if (a === b) return SELF_HYUNG.includes(a) ? '형' : null;
    if (Math.abs(a - b) === 6) return '충';
    if (pairIn(HAP, a, b)) return '합';
    if (SAMHAP.some((g) => g.includes(a) && g.includes(b))) return '삼합';
    if (pairIn(HYUNG, a, b)) return '형';
    if (pairIn(HAE, a, b)) return '해';
    if (pairIn(PA, a, b)) return '파';
    return null;
  };
  const ganjiK = (i) => STEM_K[i % 10] + BR_K[i % 12];
  const ganjiH = (i) => STEM_H[i % 10] + BR_H[i % 12];

  /* ---------- 만세력 표 ---------- */
  function buildTerms(rows) {
    return rows.map((r) => {
      const [d, t] = String(r['시각']).split('T');
      return { at: stamp(d, t), date: d, time: t, idx: JIE.indexOf(r['절기']), name: r['절기'] };
    }).filter((x) => x.idx >= 0).sort((a, b) => a.at - b.at);
  }
  function lastTerm(terms, at, onlyIdx) {
    let lo = 0, hi = terms.length - 1, ans = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (terms[mid].at <= at) { ans = mid; lo = mid + 1; } else hi = mid - 1; }
    if (onlyIdx === undefined) return ans >= 0 ? terms[ans] : null;
    for (let i = ans; i >= 0; i--) if (terms[i].idx === onlyIdx) return terms[i];
    return null;
  }
  function nextTerm(terms, at) { return terms.find((t) => t.at > at) || null; }

  function buildLunar(rows) {
    const years = new Map();
    rows.forEach((r) => {
      const y = Number(r['음력연도']), leap = Number(r['윤달']);
      const lens = String(r['월길이']).split(',').map(Number);
      let start = dayNum(String(r['설날']));
      const months = [];
      let num = 1;
      lens.forEach((len, i) => {
        const isLeap = leap > 0 && i === leap;
        if (i > 0 && !isLeap) num += 1;
        months.push({ num: isLeap ? leap : num, leap: isLeap, len, start });
        start += len;
      });
      years.set(y, { y, months, end: start });
    });
    const list = [...years.values()].sort((a, b) => a.y - b.y);
    return {
      minY: list.length ? list[0].y : 0,
      maxY: list.length ? list[list.length - 1].y : 0,
      year: (y) => years.get(y) || null,
      toSolar(y, m, d, leap) {
        const Y = years.get(y); if (!Y) return null;
        const M = Y.months.find((x) => x.num === m && x.leap === !!leap);
        if (!M || d < 1 || d > M.len) return null;
        return fromDayNum(M.start + d - 1);
      },
      toLunar(s) {
        if (!isDate(s)) return null;
        const n = dayNum(s);
        for (const Y of list) {
          if (n < Y.months[0].start || n >= Y.end) continue;
          for (const M of Y.months) if (n >= M.start && n < M.start + M.len) return { y: Y.y, m: M.num, d: n - M.start + 1, leap: M.leap, len: M.len };
        }
        return null;
      },
    };
  }

  /* ---------- 원국 ---------- */
  /* shift: 시진 경계를 늦추는 분(서울 경도 보정). UTC+9 시대 30분, UTC+8:30 시대 0분 */
  function hourBranch(hm, shift = 30) { const [h, m] = hm.split(':').map(Number); return Math.floor(mod(h * 60 + m + 60 - shift, 1440) / 120); }

  /* 출생 시각 정리: 서머타임이면 1시간 빼고, 시대별 시진 보정 폭을 정한다 */
  function birthClock(solar, hm) {
    const inRange = (list, v) => list.some(([a, b]) => v >= a && v < b);
    const shift = KST830.some(([a, b]) => solar >= a && solar <= b) ? 0 : 30;
    if (!hm) return { solar, hm: null, shift, dst: false };
    const local = `${solar}T${hm}`;
    if (!inRange(DST, local)) return { solar, hm, shift, dst: false };
    const [h, m] = hm.split(':').map(Number);
    let t = h * 60 + m - 60, d = solar;
    if (t < 0) { t += 1440; d = addDays(solar, -1); }
    return { solar: d, hm: `${pad(Math.floor(t / 60))}:${pad(t % 60)}`, shift, dst: true, original: hm };
  }

  function pillars(terms, solar, hm, shift = 30) {
    const at = stamp(solar, hm || '12:00');
    const ipchun = lastTerm(terms, at, 0);
    const jie = lastTerm(terms, at);
    if (!ipchun || !jie) return null;
    const sajuYear = Number(ipchun.date.slice(0, 4));
    const year = mod(sajuYear - 4, 60);
    const mStem = mod((year % 10) * 2 + 2 + jie.idx, 10), mBranch = mod(2 + jie.idx, 12);
    const month = sexagenary(mStem, mBranch);
    let dayDate = solar;
    if (hm) { const [h, m] = hm.split(':').map(Number); if (h * 60 + m >= 24 * 60 - 60 + shift) dayDate = addDays(solar, 1); }
    const day = dayIndex(dayDate);
    let hour = null;
    if (hm) { const b = hourBranch(hm, shift); hour = sexagenary(mod((day % 10) * 2 + b, 10), b); }
    return { year, month, day, hour, sajuYear, jie, next: nextTerm(terms, at), at, shift };
  }

  function analyze(p) {
    const me = p.day % 10, meEl = elOfStem(me);
    const slots = [
      { key: 'hour', label: '시주', w: [1, 1] },
      { key: 'day', label: '일주', w: [0, 1.5] },
      { key: 'month', label: '월주', w: [1, 2.5] },
      { key: 'year', label: '연주', w: [1, 1] },
    ];
    const cols = slots.map((s) => {
      const v = p[s.key];
      if (v === null || v === undefined) return { ...s, known: false };
      const st = v % 10, br = v % 12;
      return {
        ...s, known: true, idx: v, stem: st, branch: br,
        stemEl: elOfStem(st), branchEl: BR_EL[br],
        stemSip: s.key === 'day' ? '일간(나)' : sipsung(me, st),
        branchSip: sipsung(me, BR_MAIN[br]),
        hidden: HIDDEN[br].map(([hs, hw]) => ({ stem: hs, w: hw, sip: sipsung(me, hs) })),
      };
    });
    const count = [0, 0, 0, 0, 0];
    const elW = [0, 0, 0, 0, 0];
    let total = 0;
    cols.forEach((c) => {
      if (!c.known) return;
      count[c.stemEl] += 1; count[c.branchEl] += 1;
      if (c.key !== 'day') { elW[c.stemEl] += c.w[0]; total += c.w[0]; }
      // 지지는 지장간 비중대로 나눠 센다
      HIDDEN[c.branch].forEach(([hs, hw]) => { elW[elOfStem(hs)] += c.w[1] * hw; });
      total += c.w[1];
    });
    const groupW = [0, 1, 2, 3, 4].map((g) => elW[mod(meEl + g, 5)]);
    const support = groupW[0] + groupW[4];
    const ratio = total ? support / total : 0.5;
    const strength = ratio >= 0.55 ? '신강' : ratio < 0.45 ? '신약' : '중화';

    // 억부: 강약에 따라 돕는 오행과 빼는 오행에 점수
    let eokYong;
    if (strength === '신강') {
      if (groupW[4] > groupW[0]) eokYong = mod(meEl + 2, 5);
      else eokYong = groupW[1] < groupW[3] ? mod(meEl + 1, 5) : mod(meEl + 3, 5);
    } else if (strength === '신약') {
      const drains = [1, 2, 3].map((g) => ({ g, w: groupW[g] })).sort((a, b) => b.w - a.w || a.g - b.g);
      eokYong = drains[0].g === 2 ? meEl : mod(meEl + 4, 5);
    } else {
      let min = Infinity;
      for (let i = 0; i < 5; i++) { const e = mod(meEl + i, 5); const w = elW[e] + (e === meEl ? 1 : 0); if (w < min) { min = w; eokYong = e; } }
    }
    const eokRoles = {};
    eokRoles[eokYong] = '용신'; eokRoles[mod(eokYong + 4, 5)] = '희신'; eokRoles[mod(eokYong + 1, 5)] = '한신';
    eokRoles[mod(eokYong + 2, 5)] = '구신'; eokRoles[mod(eokYong + 3, 5)] = '기신';
    const eok = [0, 1, 2, 3, 4].map((e) => ROLE_SCORE[eokRoles[e]]);

    // 조후: 태어난 계절의 차고 더움을 맞춘다(겨울엔 화, 여름엔 수)
    const mb = p.month % 12;
    const SEASON = { 11: ['겨울', 1, 0.5], 0: ['겨울', 1, 0.5], 1: ['겨울', 1, 0.45], 2: ['이른 봄', 1, 0.2],
      5: ['여름', 4, 0.45], 6: ['여름', 4, 0.5], 7: ['여름', 4, 0.45], 8: ['이른 가을', 4, 0.15] };
    let johu = null;
    const jw = [0, 0, 0, 0, 0];
    let wJ = 0;
    if (SEASON[mb]) {
      const [season, need, base] = SEASON[mb];
      const have = elW[need];
      wJ = base * Math.max(0, 1 - have / 3); // 이미 충분하면 조후 비중을 줄인다
      const feed = mod(need + 4, 5), opp = need === 1 ? 4 : 1, oppMom = mod(opp + 4, 5);
      jw[need] = 1; jw[feed] = 0.4; jw[opp] = -0.7; jw[oppMom] = -0.3;
      johu = { season, need, w: wJ, have };
    }
    const fin = [0, 1, 2, 3, 4].map((e) => (1 - wJ) * eok[e] + wJ * jw[e]);
    const order = [0, 1, 2, 3, 4].sort((x, y) => fin[y] - fin[x] || eok[y] - eok[x]);
    const roles = {};
    order.forEach((e, i) => { roles[e] = ROLE[i]; });
    const yong = order[0];
    const maxAbs = Math.max(...fin.map(Math.abs)) || 1;
    const elScore = fin.map((v, e) => 0.5 * ROLE_SCORE[roles[e]] + 0.5 * (v / maxAbs));
    return {
      me, meEl, cols, count, elW, groupW, ratio, strength, yong, roles, elScore, eokYong, johu,
      elOf: (r) => Number(Object.keys(roles).find((k) => roles[k] === r)),
    };
  }

  /* ---------- 대운 ---------- */
  /* 양남음녀는 순행, 음남양녀는 역행. 출생에서 다음(역행은 이전) 절입까지 날수 ÷ 3 = 대운 시작 나이 */
  function daeun(terms, pl, gender) {
    if (!pl || !pl.at) return null;
    const yang = (pl.year % 10) % 2 === 0;
    const fwd = (yang && gender !== '여') || (!yang && gender === '여');
    const ref = fwd ? nextTerm(terms, pl.at) : pl.jie;
    if (!ref) return null;
    const days = Math.abs(ref.at - pl.at) / 864e5;
    const start = days / 3; // 만 나이(년)
    const list = [];
    for (let k = 1; k <= 10; k++) {
      const idx = mod(pl.month + (fwd ? k : -k), 60);
      list.push({ k, idx, from: start + (k - 1) * 10, to: start + k * 10 });
    }
    return { fwd, start, startRound: Math.max(1, Math.round(start)), list, birthAt: pl.at };
  }
  function daeunAt(du, target) {
    if (!du) return null;
    const age = (stamp(target, '12:00') - du.birthAt) / (365.2425 * 864e5);
    const cur = du.list.find((x) => age >= x.from && age < x.to) || null;
    return { age, cur };
  }

  /* ---------- 일운 ---------- */
  function bucketOf(m) { return m >= 0.6 ? 0 : m >= 0.2 ? 1 : m > -0.2 ? 2 : m > -0.6 ? 3 : 4; }
  function elemMix(a, stem, branch) {
    const br = HIDDEN[branch].reduce((acc, [hs, hw]) => acc + hw * a.elScore[elOfStem(hs)], 0);
    return 0.6 * a.elScore[elOfStem(stem)] + 0.4 * br;
  }

  /* 일진 + 큰 흐름(대운·세운·월운)을 겹쳐 본다. du: daeun() 결과(없으면 대운 제외) */
  function daily(a, terms, target, du) {
    const tp = pillars(terms, target, '12:00');
    if (!tp) return null;
    const d = tp.day, st = d % 10, br = d % 12;
    const dayMix = elemMix(a, st, br);
    const links = [];
    a.cols.forEach((c) => {
      if (!c.known) return;
      const r = relation2(c.branch, br);
      if (r) links.push({ pillar: c.label[0], rel: r, label: REL_LABEL[r], id: `${c.label[0]}-${r}` });
    });
    const da = daeunAt(du, target);
    const flow = [
      da && da.cur ? { key: 'daeun', label: '대운', idx: da.cur.idx, w: 0.45, age: da.age, cur: da.cur } : null,
      { key: 'year', label: '세운', idx: tp.year, w: 0.3 },
      { key: 'month', label: '월운', idx: tp.month, w: 0.25 },
      { key: 'day', label: '일진', idx: d, w: 0 },
    ].filter(Boolean).map((f) => ({ ...f, sip: sipsung(a.me, f.idx % 10), role: a.roles[elOfStem(f.idx % 10)], mix: elemMix(a, f.idx % 10, f.idx % 12) }));
    const ctxW = d3.sum(flow, (f) => f.w);
    const ctxMix = ctxW ? d3.sum(flow, (f) => f.w * f.mix) / ctxW : 0;
    // 대운이 일진의 지지와 충·합하면 그날 흐름이 더 크게 흔들린다
    const du0 = flow.find((f) => f.key === 'daeun');
    const duRel = du0 ? relation2(du0.idx % 12, br) : null;
    const mix = 0.65 * dayMix + 0.35 * ctxMix + (duRel === '충' ? -0.1 : duRel === '합' || duRel === '삼합' ? 0.05 : 0);
    return {
      pillars: tp, idx: d, stem: st, branch: br, sip: sipsung(a.me, st), sipNo: SIP_ORDER.indexOf(sipsung(a.me, st)),
      mix, dayMix, ctxMix, duRel, bucket: bucketOf(mix), stemRole: a.roles[elOfStem(st)], branchRole: a.roles[BR_EL[br]], links, flow,
    };
  }
  const clampScore = (x) => Math.max(1, Math.min(5, Math.round(x * 2) / 2));

  /* ---------- 하루 리듬 ---------- */
  /* 황도·흑도 12신: 그날 일지로 청룡이 시작하는 시진을 정하고 순서대로 배치한다. */
  const GODS = [['청룡', 1], ['명당', 1], ['천형', 0], ['주작', 0], ['금궤', 1], ['천덕', 1], ['백호', 0], ['옥당', 1], ['천뢰', 0], ['현무', 0], ['사명', 1], ['구진', 0]];
  const GOD_START = [8, 10, 0, 2, 4, 6, 8, 10, 0, 2, 4, 6]; // 子午日 申, 丑未日 戌, 寅申日 子, 卯酉日 寅, 辰戌日 辰, 巳亥日 午
  function hourGod(dayBranch, hb) { const g = GODS[mod(hb - GOD_START[dayBranch], 12)]; return { name: g[0], yellow: !!g[1] }; }

  /* 생활 곡선: 기상 후 2.5시간 동안 올라가고, 깨어 있는 시간의 45% 지점에 식곤증, 잠들기 3시간 전부터 내려가며, 자는 동안은 낮다. */
  const smooth = (x) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
  function lifeCurve(h, wake, sleep) {
    const t = h * 60 + 30;
    const awakeLen = mod(sleep - wake, 1440) || 1440;
    const a = mod(t - wake, 1440);
    if (a >= awakeLen) return -16;
    const x = a / 60, L = awakeLen / 60;
    return -10 + 22 * smooth(x / 2.5) - 6 * Math.exp(-(((x - 0.45 * L) / 1.2) ** 2)) - 14 * smooth((x - (L - 3)) / 3);
  }
  const toMin = (hm, def) => { if (!isTime(hm)) return def; const [h, m] = hm.split(':').map(Number); return h * 60 + m; };

  function hourly(a, dy, natalDayBranch, target, life) {
    const nextIdx = dayIndex(addDays(target, 1));
    const wake = toMin(life && life.wake, 7 * 60), sleep = toMin(life && life.sleep, 23 * 60 + 30);
    const out = [];
    for (let h = 0; h < 24; h++) {
      const b = hourBranch(`${pad(h)}:30`);
      const dayStem = h === 23 ? nextIdx % 10 : dy.stem;
      const dayBranch = h === 23 ? nextIdx % 12 : dy.branch;
      const s = mod(dayStem * 2 + b, 10);
      const m = elemMix(a, s, b);
      const rel = relation(b, natalDayBranch);
      const god = hourGod(dayBranch, b);
      const lc = lifeCurve(h, wake, sleep);
      const v = 50 + 18 * m + (rel === '합' ? 8 : rel === '충' ? -10 : 0) + (god.yellow ? 8 : -8) + lc + 8 * dy.mix;
      out.push({ h, stem: s, branch: b, god, life: lc, value: Math.max(5, Math.min(97, v)) });
    }
    return out;
  }
  function blocks(hours) {
    return [0, 1, 2, 3, 4, 5].map((i) => ({ i, from: i * 4, to: i * 4 + 4, base: d3.mean(hours.slice(i * 4, i * 4 + 4), (x) => x.value) }));
  }
  /* 흐름 이어가기: 기록한 차이(최근 기록일수록 가중)를 이후 시간대에 반영하고, 한 구간 멀어질 때마다 80%로 줄인다. */
  function adjust(bl, edits, editable) {
    const edited = bl.filter((b) => editable[b.i] && edits[b.i] >= 0);
    if (!edited.length) return { list: bl.map((b) => ({ ...b, value: b.base, state: 'base' })), dev: 0, last: -1 };
    const last = edited[edited.length - 1].i;
    let sw = 0, sd = 0;
    edited.forEach((b) => { const w = Math.pow(0.6, last - b.i); sw += w; sd += w * (edits[b.i] - b.base); });
    const dev = sd / sw;
    const list = bl.map((b) => {
      if (editable[b.i] && edits[b.i] >= 0) return { ...b, value: edits[b.i], state: 'edited' };
      if (b.i > last) return { ...b, value: Math.max(3, Math.min(98, b.base + dev * Math.pow(0.8, b.i - last))), state: 'adjusted' };
      return { ...b, value: b.base, state: 'base' };
    });
    return { list, dev, last };
  }

  /* 분야별 시간 리듬: 각 시진의 천간·지지가 내 일간에 대해 어떤 십성 그룹인지에 따라 분야 친화도를 더한다.
     그룹 순서: 비겁, 식상, 재성, 관성, 인성 */
  const AFFINITY = {
    money: [-10, 8, 14, 0, -4],
    stock: [-12, 10, 12, -4, -6],
    exam: [0, -4, -10, 8, 14],
    work: [-2, -8, 4, 14, 6],
    'love-m': [-10, 6, 14, -2, 0],
    'love-f': [-2, -8, 6, 14, 0],
  };
  const groupOf = (me, stem) => mod(elOfStem(stem) - elOfStem(me), 5);
  function categoryHourly(a, hours, code, gender, catScore, natalDayBranch) {
    const key = code === 'love' ? (gender === '여' ? 'love-f' : 'love-m') : code;
    const aff = AFFINITY[key];
    return hours.map((x) => {
      const sg = groupOf(a.me, x.stem), bg = groupOf(a.me, BR_MAIN[x.branch]);
      let v = x.value + 0.7 * aff[sg] + 0.3 * aff[bg] + 6 * (catScore - 3);
      if (code === 'love' && relation(x.branch, natalDayBranch) === '합') v += 6;
      return { ...x, value: Math.max(5, Math.min(97, v)) };
    });
  }

  root.Saju = {
    STEM_H, STEM_K, BR_H, BR_K, EL_K, EL_H, BR_EL, BR_MAIN, hourGod, lifeCurve, JIE, ROLE, SIP_ORDER, GROUP, categoryHourly,
    pad, isDate, isTime, validDate, addDays, dayIndex, ganjiK, ganjiH, elOfStem, sipsung, relation, hourBranch,
    buildTerms, buildLunar, pillars, analyze, daily, clampScore, hourly, blocks, adjust, bucketOf,
    HIDDEN, REL_LABEL, relation2, birthClock, daeun, daeunAt, elemMix,
  };
})(typeof window !== 'undefined' ? window : globalThis);
