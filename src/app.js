(() => {
  const S = window.Saju;
  /* replaceChildren/append에 null·false가 섞여도 'null' 글자가 찍히지 않게 */
  ['replaceChildren', 'append'].forEach((fn) => {
    const orig = Element.prototype[fn];
    Element.prototype[fn] = function (...kids) { return orig.apply(this, kids.filter((k) => k !== null && k !== undefined && k !== false)); };
  });
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const WEEK = '일월화수목금토';
  const CATS = [
    { code: 'total', name: '총운' }, { code: 'money', name: '재물운' }, { code: 'stock', name: '주식운' },
    { code: 'exam', name: '시험합격운' }, { code: 'love', name: '애정운' }, { code: 'work', name: '직장운' },
  ];
  const ROLE_CLASS = { 용신: 'r0', 희신: 'r1', 한신: 'r2', 구신: 'r3', 기신: 'r4' };
  const LEVEL = (v) => (v >= 65 ? 0 : v >= 40 ? 1 : 2);
  const LEVEL_K = ['높음', '보통', '낮음'];

  const h = (tag, attrs = {}, ...kids) => {
    const e = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else e.setAttribute(k, v === true ? '' : v);
    });
    kids.flat().forEach((k) => { if (k !== null && k !== undefined && k !== false) e.append(k instanceof Node ? k : document.createTextNode(String(k))); });
    return e;
  };
  const cite = (tag, src, field, where, text, cls) => h(tag, { class: cls, 'data-source': src, 'data-field': field, 'data-where': where, text });
  const elVar = (e) => `--el: var(--sj-el${e})`;

  const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${S.pad(d.getMonth() + 1)}-${S.pad(d.getDate())}`; };
  const parts = (s) => s.split('-').map(Number);
  const weekday = (s) => { const [y, m, d] = parts(s); return WEEK[new Date(y, m - 1, d).getDay()]; };
  const longDate = (s) => { const [y, m, d] = parts(s); return `${y}년 ${m}월 ${d}일 (${weekday(s)})`; };
  const lunarText = (l) => (l ? `음력 ${l.y}년 ${l.leap ? '윤' : ''}${l.m}월 ${l.d}일` : '');

  /* ---------- 데이터 캐시 ---------- */
  const cache = {};
  const table = (id, build) => {
    const d = dash.data(id);
    if (d.status !== 'ok') return null;
    if (!cache[id] || cache[id].src !== d.data) cache[id] = { src: d.data, val: build ? build(d.data) : d.data };
    return cache[id].val;
  };
  const rowById = (rows, id) => (rows || []).find((r) => r.id === id);

  /* ---------- 기본값 ---------- */
  const setDefaults = () => {
    const p = dash.params();
    const n = {};
    if (!S.validDate(p.date)) n.date = todayStr();
    if (p.gender !== '남' && p.gender !== '여') n.gender = '남';
    if (p.birthCal !== 'solar' && p.birthCal !== 'lunar') n.birthCal = 'solar';
    if (Object.keys(n).length) dash.setParams(n);
  };
  setDefaults();

  /* ---------- 데이트피커 ---------- */
  const ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>';
  function makePicker(root, cfg) {
    root.innerHTML = `<div class="dp-field"><input class="dp-input" type="text" inputmode="numeric" enterkeyhint="done" placeholder="예: 19900515" aria-label="${cfg.label}" autocomplete="off"><button type="button" class="dp-btn" aria-label="${cfg.label} 달력 열기" aria-haspopup="dialog">${ICON}</button></div><div class="dp-pop" role="dialog" aria-label="${cfg.label} 달력" hidden></div>`;
    const input = $('.dp-input', root), btn = $('.dp-btn', root), pop = $('.dp-pop', root);
    const view = { y: 2000, m: 1, mi: 0 };

    const setViewFromValue = () => {
      const v = cfg.value();
      const L = cfg.lunar();
      if (cfg.mode() === 'lunar') {
        let y, m, leap;
        if (v.date && S.isDate(v.date)) { [y, m] = parts(v.date); leap = v.leap; }
        else { const l = L && L.toLunar(todayStr()); y = l ? l.y - cfg.defaultBack : 1990; m = 1; leap = false; }
        const Y = L && L.year(y);
        view.y = y; view.mi = Y ? Math.max(0, Y.months.findIndex((x) => x.num === m && x.leap === !!leap)) : 0;
      } else {
        const s = v.date && S.validDate(v.date) ? v.date : null;
        if (s) [view.y, view.m] = parts(s);
        else { const [ty] = parts(todayStr()); view.y = ty - cfg.defaultBack; view.m = cfg.defaultBack ? 1 : parts(todayStr())[1]; }
      }
    };

    const shift = (k) => {
      if (cfg.mode() === 'lunar') {
        const L = cfg.lunar(); if (!L) return;
        let Y = L.year(view.y); let mi = view.mi + k;
        if (mi < 0) { Y = L.year(view.y - 1); if (!Y) return; view.y -= 1; mi = Y.months.length - 1; }
        else if (Y && mi >= Y.months.length) { Y = L.year(view.y + 1); if (!Y) return; view.y += 1; mi = 0; }
        view.mi = mi;
      } else {
        let m = view.m + k, y = view.y;
        if (m < 1) { m = 12; y -= 1; } if (m > 12) { m = 1; y += 1; }
        if (y < cfg.minY || y > cfg.maxY) return;
        view.y = y; view.m = m;
      }
      render();
    };

    function render() {
      const lunarMode = cfg.mode() === 'lunar';
      const L = cfg.lunar();
      const v = cfg.value();
      pop.replaceChildren();
      const prev = h('button', { type: 'button', class: 'dp-nav', 'aria-label': '이전 달', text: '‹' });
      const next = h('button', { type: 'button', class: 'dp-nav', 'aria-label': '다음 달', text: '›' });
      prev.addEventListener('click', () => shift(-1));
      next.addEventListener('click', () => shift(1));
      const minY = lunarMode && L ? Math.max(cfg.minY, L.minY) : cfg.minY;
      const maxY = lunarMode && L ? Math.min(cfg.maxY, L.maxY) : cfg.maxY;
      const ySel = h('select', { class: 'dp-sel', 'aria-label': '연도' });
      for (let y = maxY; y >= minY; y--) ySel.append(new Option(`${y}년`, String(y)));
      ySel.value = String(view.y);
      const mSel = h('select', { class: 'dp-sel', 'aria-label': '월' });
      const today = todayStr();
      const grid = h('div', { class: 'dp-grid', role: 'grid' });
      const week = h('div', { class: 'dp-week' }, ...WEEK.split('').map((w) => h('span', { text: w })));
      let foot = '';

      if (lunarMode) {
        const Y = L && L.year(view.y);
        if (!Y) { pop.append(h('p', { class: 'sj-hint', text: '음력 달력을 불러오는 중이에요.' })); return; }
        Y.months.forEach((M, i) => mSel.append(new Option(`${M.leap ? '윤' : ''}${M.num}월`, String(i))));
        mSel.value = String(view.mi);
        const M = Y.months[view.mi];
        const startSolar = S.addDays('1970-01-01', M.start);
        const offset = WEEK.indexOf(weekday(startSolar));
        for (let i = 0; i < offset; i++) grid.append(h('span'));
        for (let d = 1; d <= M.len; d++) {
          const solar = S.addDays(startSolar, d - 1);
          const [, sm, sd] = parts(solar);
          const val = `${view.y}-${S.pad(M.num)}-${S.pad(d)}`;
          const sel = v.date === val && !!v.leap === M.leap;
          const b = h('button', { type: 'button', class: `dp-day${(offset + d - 1) % 7 === 0 ? ' sun' : ''}${solar === today ? ' today' : ''}`, 'aria-selected': sel ? 'true' : 'false', 'aria-label': `음력 ${M.leap ? '윤' : ''}${M.num}월 ${d}일, 양력 ${sm}월 ${sd}일` },
            h('span', { class: 'n', text: d }), h('span', { class: 's', text: `${sm}.${sd}` }));
          b.addEventListener('click', () => { cfg.pick(val, M.leap); close(); });
          grid.append(b);
        }
        foot = `음력 ${view.y}년 ${M.leap ? '윤' : ''}${M.num}월 · ${M.len === 30 ? '큰달 30일' : '작은달 29일'} · 작은 숫자는 양력`;
      } else {
        for (let m = 1; m <= 12; m++) mSel.append(new Option(`${m}월`, String(m)));
        mSel.value = String(view.m);
        const first = `${view.y}-${S.pad(view.m)}-01`;
        const offset = WEEK.indexOf(weekday(first));
        const days = new Date(view.y, view.m, 0).getDate();
        for (let i = 0; i < offset; i++) grid.append(h('span'));
        for (let d = 1; d <= days; d++) {
          const val = `${view.y}-${S.pad(view.m)}-${S.pad(d)}`;
          const l = L ? L.toLunar(val) : null;
          const sub = l ? (l.d === 1 ? `${l.leap ? '윤' : ''}${l.m}월` : `${l.d}`) : '';
          const b = h('button', { type: 'button', class: `dp-day${(offset + d - 1) % 7 === 0 ? ' sun' : ''}${val === today ? ' today' : ''}`, 'aria-selected': v.date === val ? 'true' : 'false', 'aria-label': `${view.y}년 ${view.m}월 ${d}일${l ? `, ${lunarText(l)}` : ''}` },
            h('span', { class: 'n', text: d }), h('span', { class: 's', text: sub }));
          b.addEventListener('click', () => { cfg.pick(val, false); close(); });
          grid.append(b);
        }
        foot = L ? '작은 숫자는 음력 날짜' : '';
      }
      ySel.addEventListener('change', () => {
        view.y = Number(ySel.value);
        if (lunarMode) { const Y = L.year(view.y); view.mi = Math.min(view.mi, Y ? Y.months.length - 1 : 0); }
        render();
      });
      mSel.addEventListener('change', () => { if (lunarMode) view.mi = Number(mSel.value); else view.m = Number(mSel.value); render(); });
      const todayBtn = h('button', { type: 'button', text: '오늘로 이동' });
      todayBtn.addEventListener('click', () => {
        if (lunarMode) { const l = L && L.toLunar(today); if (l) { view.y = l.y; view.mi = L.year(l.y).months.findIndex((x) => x.num === l.m && x.leap === l.leap); } }
        else [view.y, view.m] = parts(today);
        render();
      });
      pop.append(h('div', { class: 'dp-headrow' }, prev, ySel, mSel, next), week, grid, h('div', { class: 'dp-foot' }, h('span', { text: foot }), todayBtn));
    }
    const open = () => { setViewFromValue(); render(); pop.hidden = false; btn.setAttribute('aria-expanded', 'true'); };
    const close = () => { pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
    btn.addEventListener('click', () => (pop.hidden ? open() : close()));
    document.addEventListener('pointerdown', (e) => { if (!pop.hidden && !root.contains(e.target)) close(); });
    root.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pop.hidden) { close(); btn.focus(); } });
    const parseText = () => {
      const t = input.value.trim().replace(/[./\s년월일]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      const m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/) || t.match(/^(\d{4})(\d{2})(\d{2})$/);
      if (!m) return null;
      const val = `${m[1]}-${S.pad(Number(m[2]))}-${S.pad(Number(m[3]))}`;
      return cfg.mode() === 'lunar' || S.validDate(val) ? val : null;
    };
    const commitText = (soft) => {
      const val = parseText();
      if (val) { if (val !== cfg.value().date) cfg.pick(val, cfg.value().leap); }
      else if (!soft) sync(true);
    };
    // 모바일 키보드는 change가 늦게 오거나 오지 않을 수 있어 입력 중에도 완성된 날짜면 바로 반영
    input.addEventListener('input', () => commitText(true));
    input.addEventListener('change', () => commitText(false));
    input.addEventListener('blur', () => commitText(false));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { commitText(false); input.blur(); } });
    let shown = null;
    function sync(force) {
      const v = cfg.value();
      if (force || input !== document.activeElement) input.value = v.date || '';
      const key = `${cfg.mode()}|${v.date}|${v.leap}`;
      if (!pop.hidden && key !== shown) render();
      shown = key;
    }
    return { sync };
  }

  /* ---------- 입력 연결 ---------- */
  const lunarTable = () => table('lunar', (rows) => S.buildLunar(rows));
  const termTable = () => table('terms', (rows) => S.buildTerms(rows));

  const birthPicker = makePicker($('#pk-birth'), {
    label: '생년월일', minY: 1900, maxY: Number(todayStr().slice(0, 4)), defaultBack: 30,
    mode: () => (dash.params().birthCal === 'lunar' ? 'lunar' : 'solar'),
    value: () => ({ date: dash.params().birth || null, leap: !!dash.params().birthLeap }),
    lunar: lunarTable,
    pick: (date, leap) => dash.setParams({ birth: date, birthLeap: !!leap }),
  });
  const datePicker = makePicker($('#pk-date'), {
    label: '운세 확인 날짜', minY: 1901, maxY: 2100, defaultBack: 0,
    mode: () => 'solar', value: () => ({ date: dash.params().date || null, leap: false }), lunar: lunarTable,
    pick: (date) => dash.setParams({ date }),
  });

  $$('[data-cal]').forEach((b) => b.addEventListener('click', () => {
    const p = dash.params();
    const to = b.dataset.cal;
    if (to === p.birthCal) return;
    const L = lunarTable();
    let birth = p.birth || null, leap = false;
    if (birth && L) {
      if (to === 'lunar' && S.validDate(birth)) { const l = L.toLunar(birth); if (l) { birth = `${l.y}-${S.pad(l.m)}-${S.pad(l.d)}`; leap = l.leap; } }
      else if (to === 'solar') { const [y, m, d] = parts(birth); birth = L.toSolar(y, m, d, !!p.birthLeap) || null; }
    }
    dash.setParams({ birthCal: to, birth, birthLeap: leap });
  }));
  $('#in-leap').addEventListener('change', (e) => dash.setParams({ birthLeap: e.target.checked }));
  const timeIn = $('#in-time');
  const commitTime = () => {
    const v = timeIn.value;
    if (S.isTime(v.slice(0, 5))) { if (v.slice(0, 5) !== dash.params().birthTime) dash.setParams({ birthTime: v.slice(0, 5), timeUnknown: false }); }
    else if (!v && dash.params().birthTime) dash.setParams({ birthTime: null });
  };
  // iOS는 시간 선택기를 닫을 때 blur가 change보다 먼저 올 수 있어 input·change·blur 모두에서 반영
  ['input', 'change', 'blur'].forEach((ev) => timeIn.addEventListener(ev, commitTime));
  $('#in-unk').addEventListener('change', (e) => dash.setParams({ timeUnknown: e.target.checked }));
  [['#in-wake', 'wake'], ['#in-sleep', 'sleep']].forEach(([sel, key]) => {
    const el = $(sel);
    const commit = () => { const v = el.value.slice(0, 5); if (S.isTime(v) && v !== dash.params()[key]) dash.setParams({ [key]: v }); };
    ['input', 'change', 'blur'].forEach((ev) => el.addEventListener(ev, commit));
  });
  const lifeOf = (p) => ({ wake: S.isTime(p.wake) ? p.wake : '07:00', sleep: S.isTime(p.sleep) ? p.sleep : '23:30' });
  $$('[data-g]').forEach((b) => b.addEventListener('click', () => dash.setParams({ gender: b.dataset.g })));
  $$('[data-step]').forEach((b) => b.addEventListener('click', () => {
    const cur = S.validDate(dash.params().date) ? dash.params().date : todayStr();
    const next = S.addDays(cur, Number(b.dataset.step));
    if (next >= '1901-01-01' && next <= '2100-12-31') dash.setParams({ date: next });
  }));
  $('#btn-today').addEventListener('click', () => dash.setParams({ date: todayStr() }));


  /* ---------- 내 정보 접기/펴기 ---------- */
  let pfOpen = null; // null: 처음 상태를 데이터로 정함
  const setPf = (open) => {
    pfOpen = open;
    $('#pf-form').hidden = !open;
    const t = $('#pf-toggle');
    t.textContent = open ? '닫기' : '편집';
    t.setAttribute('aria-expanded', String(open));
  };
  $('#pf-toggle').addEventListener('click', () => setPf(!pfOpen));
  $('#pf-done').addEventListener('click', () => {
    setPf(false);
    if (!dash.params().profileDone) dash.setParams({ profileDone: true, date: todayStr() });
    requestAnimationFrame(() => requestAnimationFrame(() => $('#datecard').scrollIntoView({ block: 'start', behavior: 'smooth' })));
  });
  /* 고른 날짜는 30분이 지나면 오늘로 돌아간다 (탭으로 돌아왔을 때도 확인) */
  setInterval(() => dash.resetDateIfStale(), 20000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) dash.resetDateIfStale(); });

  /* ---------- 하루 리듬 상태 ---------- */
  const RCATS = [
    { code: 'total', name: '총운', param: 'rhythm' },
    { code: 'money', name: '재물운', param: 'rhythmMoney' },
    { code: 'stock', name: '주식운', param: 'rhythmStock' },
    { code: 'exam', name: '시험합격운', param: 'rhythmExam' },
    { code: 'love', name: '애정운', param: 'rhythmLove' },
    { code: 'work', name: '직장운', param: 'rhythmWork' },
  ];
  let rhythmModel = null;
  let drag = null; // { code, edits }
  const editsFor = (code) => {
    if (drag && drag.code === code) return drag.edits;
    const p = dash.params();
    const rc = RCATS.find((r) => r.code === code);
    const list = Array.isArray(p[rc.param]) && p.rhythmDate === p.date ? p[rc.param] : [];
    return [0, 1, 2, 3, 4, 5].map((i) => (typeof list[i] === 'number' ? list[i] : -1));
  };
  const commitEdits = (code, edits) => {
    const rc = RCATS.find((r) => r.code === code);
    const p = dash.params();
    const next = { rhythmDate: p.date, [rc.param]: edits.map((v) => (v >= 0 ? Math.round(v) : -1)) };
    if (p.rhythmDate !== p.date) RCATS.forEach((r) => { if (r.code !== code) next[r.param] = []; });
    dash.setParams(next);
  };
  $('#rh-reset').addEventListener('click', () => {
    drag = null;
    const n = { rhythmDate: null };
    RCATS.forEach((r) => { n[r.param] = []; });
    dash.setParams(n);
  });

  /* ---------- 계산 ---------- */
  function resolveBirth(p, L) {
    if (!p.birth) return { none: true };
    if (p.birthCal === 'lunar') {
      if (!S.isDate(p.birth)) return { err: '날짜를 YYYY-MM-DD 형식으로 입력해 주세요.' };
      if (!L) return { pending: true };
      const [y, m, d] = parts(p.birth);
      if (y < L.minY || y > L.maxY) return { err: `음력은 ${L.minY}~${L.maxY}년까지 변환할 수 있어요.` };
      const solar = L.toSolar(y, m, d, !!p.birthLeap);
      if (!solar) {
        const Y = L.year(y);
        if (p.birthLeap && Y && !Y.months.some((x) => x.leap && x.num === m)) return { err: `음력 ${y}년에는 윤${m}월이 없어요.` };
        return { err: `음력 ${y}년 ${p.birthLeap ? '윤' : ''}${m}월에는 ${d}일이 없어요.` };
      }
      return { solar, lunar: { y, m, d, leap: !!p.birthLeap } };
    }
    if (!S.validDate(p.birth)) return { err: '존재하지 않는 날짜예요.' };
    if (p.birth < '1900-02-05') return { err: '1900년 입춘 이후 출생만 계산할 수 있어요.' };
    return { solar: p.birth, lunar: L ? L.toLunar(p.birth) : null };
  }

  function categoryScores(dy, p, data) {
    const gcode = p.gender === '여' ? 'love-f' : 'love-m';
    return CATS.map((c) => {
      const row = rowById(data.fortunes, `s${dy.sipNo}-${c.code === 'love' ? gcode : c.code}`);
      const yrow = rowById(data.yongsin, `y${dy.bucket}-${c.code}`);
      let s = (row ? Number(row['점수']) : 3) + (yrow ? Number(yrow['가감']) : 0);
      dy.links.forEach((l) => { const r = rowById(data.branch, l.id); if (r && String(r['분야']).split(',').includes(c.name)) s += Number(r['가감']); });
      return S.clampScore(s);
    });
  }
  const overallOf = (scores) => Math.round((d3.mean(scores) / 5) * 100);

  /* ---------- 그리기: 입력 ---------- */
  function drawInputs(p, L, birth, pl, bc) {
    $$('[data-cal]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cal === (p.birthCal || 'solar'))));
    $$('[data-g]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.g === p.gender)));
    $('#leap-wrap').hidden = p.birthCal !== 'lunar';
    $('#in-leap').checked = !!p.birthLeap;
    $('#in-unk').checked = !!p.timeUnknown;
    timeIn.disabled = !!p.timeUnknown;
    if (timeIn !== document.activeElement) timeIn.value = p.birthTime || '';
    const life = lifeOf(p);
    if ($('#in-wake') !== document.activeElement) $('#in-wake').value = life.wake;
    if ($('#in-sleep') !== document.activeElement) $('#in-sleep').value = life.sleep;
    birthPicker.sync(); datePicker.sync();

    const hb = $('#hint-birth');
    hb.classList.toggle('bad', !!birth.err);
    if (birth.err) hb.textContent = birth.err;
    else if (birth.solar && p.birthCal === 'lunar') hb.textContent = `${lunarText(birth.lunar)} → 양력 ${longDate(birth.solar)}`;
    else if (birth.solar && birth.lunar) hb.textContent = `${lunarText(birth.lunar)}`;
    else hb.textContent = p.birthCal === 'lunar' ? '음력 날짜를 고르세요. 윤달이면 윤달에 체크하세요.' : '';

    const hasTime = !p.timeUnknown && S.isTime(p.birthTime);
    const ht = $('#hint-time');
    if (p.timeUnknown) ht.textContent = '시주 없이 연·월·일주로 풀이합니다.';
    else if (hasTime) {
      const c = bc && bc.hm ? bc : { hm: p.birthTime, shift: 30 };
      const b = S.hourBranch(c.hm, c.shift);
      ht.textContent = `${S.BR_K[b]}시(${S.BR_H[b]}時) 출생${c.dst ? ` · 서머타임 기간이라 1시간 빼서 ${c.hm}로 계산` : ''}`;
    }
    else ht.textContent = '시간을 넣으면 시주까지 분석해요.';

    // 내 정보 요약
    const complete = !!birth.solar && (p.timeUnknown || hasTime);
    if (pfOpen === null) setPf(!complete || !p.profileDone);
    if (birth.none || birth.err) { if (!pfOpen) setPf(true); }
    const badge = $('#pf-badge');
    if (birth.solar && pl) {
      const me = pl.day % 10;
      badge.className = 'sj-pf-badge';
      badge.setAttribute('style', elVar(S.elOfStem(me)));
      badge.textContent = S.STEM_H[me];
      const [y, m, d] = parts(birth.solar);
      const calTxt = p.birthCal === 'lunar' ? `음력 ${birth.lunar.y}.${birth.lunar.leap ? '윤' : ''}${birth.lunar.m}.${birth.lunar.d} (양력 ${y}.${m}.${d})` : `양력 ${y}.${m}.${d}`;
      $('#pf-title').textContent = `${calTxt}${hasTime ? ` ${p.birthTime}` : ''}생 · ${p.gender === '여' ? '여성' : '남성'}`;
      $('#pf-detail').textContent = `일주 ${S.ganjiK(pl.day)}(${S.ganjiH(pl.day)}) · ${S.STEM_K[me]}${S.EL_K[S.elOfStem(me)]} 일간${hasTime ? '' : ' · 태어난 시간 모름'} · 기상 ${lifeOf(p).wake} 취침 ${lifeOf(p).sleep}`;
    } else {
      badge.className = 'sj-pf-badge none'; badge.removeAttribute('style'); badge.textContent = '?';
      $('#pf-title').textContent = birth.err ? '생년월일을 확인해 주세요' : '내 정보를 입력해 주세요';
      $('#pf-detail').textContent = '생년월일과 태어난 시간, 성별로 사주를 세웁니다.';
    }
    $('#pf-done').disabled = !birth.solar;
    $('#pf-saved').textContent = !complete ? '입력하는 즉시 이 화면에 반영돼요.' : p.profileDone ? '이 브라우저에 저장됐어요. 완료를 누르면 접힙니다.' : '다 넣었으면 완료를 눌러 주세요. 운세 볼 날짜가 나타나요.';
  }

  function drawDateCard(p, L, week) {
    const tl = L && S.validDate(p.date) ? L.toLunar(p.date) : null;
    $('#dt-big').textContent = S.validDate(p.date) ? `${longDate(p.date)}${p.date === todayStr() ? ' · 오늘' : ''}` : '';
    $('#dt-sub').textContent = S.validDate(p.date) ? `${tl ? lunarText(tl) : ''}${tl ? ' · ' : ''}일진 ${S.ganjiK(S.dayIndex(p.date))}(${S.ganjiH(S.dayIndex(p.date))})일` : '';
    if (!S.validDate(p.date)) return;
    const today = todayStr();
    $('#dt-week').replaceChildren(...[-3, -2, -1, 0, 1, 2, 3].map((k) => {
      const d = S.addDays(p.date, k);
      const [, , dd] = parts(d);
      const di = S.dayIndex(d);
      const sc = week ? week.get(d) : null;
      const b = h('button', { type: 'button', class: `sj-wd${weekday(d) === '일' ? ' sun' : ''}${d === today ? ' today' : ''}`, 'aria-pressed': k === 0 ? 'true' : 'false', 'aria-label': `${longDate(d)}${sc !== null && sc !== undefined ? `, 종합 ${sc}점` : ''}` },
        h('span', { class: 'w', text: d === today ? '오늘' : weekday(d) }),
        h('span', { class: 'n', text: dd }),
        h('span', { class: 'g', text: S.ganjiK(di) }),
        sc !== null && sc !== undefined ? h('span', { class: 'sc' }, h('i', { class: sc >= 70 ? 'hi' : sc < 55 ? 'lo' : '' }), sc) : null);
      b.addEventListener('click', () => dash.setParams({ date: d }));
      return b;
    }));
  }

  /* ---------- 그리기: 결과 ---------- */
  const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.85 6.05 6.6.78-4.88 4.53 1.3 6.53L12 17.2l-5.87 3.29 1.3-6.53L2.55 9.43l6.6-.78z"/></svg>';
  function stars(score) {
    const wrap = h('span', { class: 'sj-stars', 'aria-hidden': 'true' });
    for (let k = 0; k < 5; k++) {
      const fill = Math.max(0, Math.min(1, score - k));
      const s = h('span', { class: 'sj-star' });
      s.innerHTML = STAR.replace('<svg', '<svg class="bg"');
      const fg = h('span', { class: 'fg', style: `width:${fill * 100}%` });
      fg.innerHTML = STAR;
      s.append(fg);
      wrap.append(s);
    }
    return wrap;
  }

  /* 기록을 반영한 남은 시간 점수: 남은 시간대의 조정된 리듬이 예측보다 12점 높거나 낮을 때마다 별 1개만큼 오르내림 */
  function remainingScores(all, scores) {
    const p = dash.params();
    const isToday = p.date === todayStr();
    const hr = new Date().getHours();
    return CATS.map((c, i) => {
      const adj = all[c.code];
      const last = Math.max(all.total.last, adj.last);
      if (last < 0) return null;
      const rest = adj.list.filter((d) => d.i > last && (!isToday || d.i * 4 > hr));
      if (!rest.length) return null;
      const diff = d3.mean(rest, (d) => d.value - adj.origin[d.i].base);
      if (Math.abs(diff) < 1) return null;
      return { score: S.clampScore(scores[i] + diff / 12), diff, from: rest[0].from };
    });
  }
  const remainChip = (r, day) => (r ? h('span', { class: `sj-remain ${r.score < day ? 'down' : r.score > day ? 'up' : ''}`, title: `${r.from}시 이후 남은 시간대에 내 기록을 반영한 점수` }, `남은 시간 ${r.score.toFixed(1)} ${r.score < day ? '▼' : r.score > day ? '▲' : ''}`) : null);

  function ctxText(dy) {
    const du = dy.flow.find((f) => f.key === 'daeun');
    const tone = (m) => (m >= 0.35 ? '든든하게 받쳐 주는' : m >= 0.1 ? '조금 도와주는' : m > -0.1 ? '무난한' : m > -0.35 ? '다소 버거운' : '거스르는');
    const head = du ? `지금 지나는 대운 ${S.ganjiK(du.idx)}(${du.sip})와 올해·이달의 기운은 나에게 ${tone(dy.ctxMix)} 흐름이고` : `올해·이달의 기운은 나에게 ${tone(dy.ctxMix)} 흐름이고`;
    const rel = dy.duRel === '충' ? ', 대운과 이날 지지가 충돌해 변동이 커질 수 있어요.' : dy.duRel === '합' || dy.duRel === '삼합' ? ', 대운과 이날 지지가 합을 이뤄 흐름이 매끄러워요.' : '';
    return `${head}${rel ? rel : ', 이날의 일진이 그 위에 더해집니다.'}`;
  }

  function drawHero(p, dy, scores, overall, data, parts2, remain) {
    $('#hero-score').replaceChildren(String(overall), h('small', { text: '/ 100' }));
    $('#hero-split').textContent = parts2.zw === null ? `사주 ${parts2.saju} · 자미두수는 태어난 시간 필요` : `사주 ${parts2.saju} · 자미두수 ${parts2.zw}`;
    $('#hero-date').textContent = `${longDate(p.date)} · ${S.ganjiK(dy.idx)}(${S.ganjiH(dy.idx)})일`;
    const totalRow = rowById(data.fortunes, `s${dy.sipNo}-total`);
    const yRow = rowById(data.yongsin, `y${dy.bucket}-total`);
    $('#hero-sum').replaceChildren(
      '이날은 나에게 ', h('b', { text: dy.sip }), '의 기운이 들어오는 날입니다. 키워드는 ',
      cite('b', 'fortunes', '키워드', `id=s${dy.sipNo}-total`, totalRow ? totalRow['키워드'] : ''),
      '. 그날의 천간은 내 사주에서 ', h('span', { class: `sj-role ${ROLE_CLASS[dy.stemRole]}`, text: dy.stemRole }),
      ', 지지는 ', h('span', { class: `sj-role ${ROLE_CLASS[dy.branchRole]}`, text: dy.branchRole }),
      `에 해당합니다. ${ctxText(dy)} 이를 합쳐 전체 흐름은 '`, cite('span', 'yongsin', '구분', `id=y${dy.bucket}-total`, yRow ? yRow['구분'] : ''), `'으로 봅니다.`,
    );
    $('#hero-minis').replaceChildren(...CATS.map((c, i) => h('a', { class: 'sj-mini', href: `#f-${c.code}`, style: `--sj-accent:${dash.colors[i]}` },
      h('b', { text: c.name }), h('span', { text: scores[i].toFixed(1) }), stars(scores[i]))));
    $('#hero-flow').replaceChildren(...dy.flow.map((f) => {
      const kw = rowById(data.fortunes, `s${S.SIP_ORDER.indexOf(f.sip)}-total`);
      return h('div', {},
        h('span', { class: 'k', text: `${f.label}${f.key === 'daeun' ? ` (만 ${Math.round(f.cur.from)}~${Math.round(f.cur.to) - 1}세)` : f.key === 'year' ? ' (올해)' : f.key === 'month' ? ' (이번 달)' : ' (이날)'}` }),
        h('span', { class: 'v', text: `${S.ganjiK(f.idx)} ${S.ganjiH(f.idx)}` }),
        h('span', { class: 'd' }, `${f.sip} · `, cite('span', 'fortunes', '키워드', `id=s${S.SIP_ORDER.indexOf(f.sip)}-total`, kw ? kw['키워드'] : ''), ' ', h('span', { class: `sj-role ${ROLE_CLASS[f.role]}`, text: f.role })));
    }));
    $('#sj-lead').textContent = `${longDate(p.date)}의 종합 운세 지수는 ${overall}점입니다. ${dy.sip}의 날로, ${dy.mix >= 0.2 ? '내게 필요한 기운이 들어와 흐름이 좋습니다' : dy.mix > -0.2 ? '큰 굴곡 없이 무난한 흐름입니다' : '기운이 엇갈려 신중함이 필요한 흐름입니다'}.`;
  }

  function drawFortunes(p, dy, scores, data, zi, remain) {
    const gcode = p.gender === '여' ? 'love-f' : 'love-m';
    CATS.forEach((c, i) => {
      const card = $(`#f-${c.code}`);
      card.style.setProperty('--sj-accent', dash.colors[i]);
      const id = `s${dy.sipNo}-${c.code === 'love' ? gcode : c.code}`;
      const row = rowById(data.fortunes, id);
      const yid = `y${dy.bucket}-${c.code}`;
      const yrow = rowById(data.yongsin, yid);
      const links = dy.links.filter((l) => { const r = rowById(data.branch, l.id); return r && String(r['분야']).split(',').includes(c.name); });
      const main = h('div', {}, h('p', { class: 'sj-cap sj-muted', style: 'margin-bottom:4px', text: `${dy.sip}의 날 · ${c.code === 'love' ? (p.gender === '여' ? '여성' : '남성') + ' 기준' : '기본 흐름'}` }),
        cite('p', 'fortunes', '내용', `id=${id}`, row ? row['내용'] : ''));
      const side = h('div', { class: 'sj-fc-side' },
        zi ? zwBox(zi.c, zi.zd, c, zi.scores[i], data) : null,
        h('div', { class: 'sj-fc-sub' },
          h('div', { class: 't' }, h('b', { class: 'sj-zw-tag saju', text: '사주' }), '내 사주와의 궁합 ', h('span', { class: `sj-role ${ROLE_CLASS[yrow ? yrow['관계'] : '한신']}` }, cite('span', 'yongsin', '관계', `id=${yid}`, yrow ? yrow['관계'] : ''))),
          cite('p', 'yongsin', '내용', `id=${yid}`, yrow ? yrow['내용'] : '')),
        ...links.map((l) => {
          const r = rowById(data.branch, l.id);
          return h('div', { class: 'sj-fc-sub' }, h('div', { class: 't' }, `${l.pillar}지와 ${l.label}`), cite('p', 'branch', '내용', `id=${l.id}`, r['내용']));
        }),
        h('div', { class: 'sj-fc-tips' },
          h('div', {}, h('span', { class: 'k', text: '주의' }), cite('span', 'fortunes', '주의', `id=${id}`, row ? row['주의'] : '')),
          h('div', {}, h('span', { class: 'k', text: '조언' }), cite('span', 'fortunes', '조언', `id=${id}`, row ? row['조언'] : ''))));
      if (c.code === 'stock') side.append(h('p', { class: 'sj-cap sj-muted', text: '재미로 보는 운세예요. 실제 투자 판단의 근거로 쓰지 마세요.' }));
      card.replaceChildren(
        h('div', { class: 'sj-fc-head' },
          h(c.code === 'total' ? 'h2' : 'h3', {}, h('span', { class: 'o', text: `0${i + 1}` }), c.name),
          h('div', { class: 'sj-score', 'aria-label': `${c.name} ${scores[i]}점, 5점 만점` }, stars(scores[i]), h('b', { text: scores[i].toFixed(1) }), h('span', { class: 'sj-cap sj-muted', text: zi ? `/ 5 · 사주 ${zi.saju[i].toFixed(1)} · 자미 ${zi.scores[i].toFixed(1)}` : '/ 5' }))),
        h('div', { class: 'sj-fc-body' }, main, side));
    });
  }

  function drawNatal(p, birth, pl, a, data, bc) {
    $('#pillars').replaceChildren(...a.cols.map((c) => {
      if (!c.known) {
        return h('div', { class: 'sj-pl' }, h('span', { class: 'lb', text: c.label }), h('span', { class: 'sp', text: '' }),
          h('div', { class: 'sj-ch unk' }, h('span', { class: 'hz', text: '?' }), h('span', { class: 'kr', text: '시간 모름' })),
          h('div', { class: 'sj-ch unk' }, h('span', { class: 'hz', text: '?' }), h('span', { class: 'kr', text: '' })), h('span', { class: 'sp', text: '' }));
      }
      return h('div', { class: 'sj-pl' },
        h('span', { class: 'lb', text: c.label }),
        h('span', { class: 'sp', text: c.stemSip }),
        h('div', { class: `sj-ch${c.key === 'day' ? ' me' : ''}`, style: elVar(c.stemEl) }, h('span', { class: 'hz', text: S.STEM_H[c.stem] }), h('span', { class: 'kr', text: `${S.STEM_K[c.stem]} · ${S.EL_K[c.stemEl]}` })),
        h('div', { class: 'sj-ch', style: elVar(c.branchEl) }, h('span', { class: 'hz', text: S.BR_H[c.branch] }), h('span', { class: 'kr', text: `${S.BR_K[c.branch]} · ${S.EL_K[c.branchEl]}` })),
        h('span', { class: 'sp', text: c.branchSip }));
    }));
    const t = pl.jie;
    const [, jm, jd] = parts(t.date);
    $('#natal-meta').replaceChildren(
      h('span', { text: `양력 ${longDate(birth.solar)}${S.isTime(p.birthTime) && !p.timeUnknown ? ` ${p.birthTime}` : ''}${birth.lunar ? ` · ${lunarText(birth.lunar)}` : ''}` }),
      h('span', { text: `${t.name}(${jm}월 ${jd}일 ${t.time}) 이후 출생 → ${S.BR_K[(2 + t.idx) % 12]}월(${S.BR_H[(2 + t.idx) % 12]}月), 사주 연도 ${pl.sajuYear}년` }),
      h('span', { text: `${p.gender === '여' ? '여성' : '남성'} · 일주 ${S.ganjiK(pl.day)}(${S.ganjiH(pl.day)})` }),
      bc && bc.dst ? h('span', { text: `서머타임 기간 출생: 입력한 ${bc.original}에서 1시간 빼 ${bc.hm}(표준시)로 계산했어요.` }) : null,
      bc && bc.hm && bc.shift === 0 ? h('span', { text: '표준시가 UTC+8:30이던 시기라 시진 경계를 늦추지 않고 계산했어요(자시 23:00~01:00).' }) : null);

    const known = a.cols.filter((c) => c.known).length * 2;
    $('#els').replaceChildren(...[0, 1, 2, 3, 4].map((e) => h('div', { class: 'sj-el', style: elVar(e) },
      h('span', { class: 'nm' }, S.EL_K[e], h('small', { text: S.EL_H[e] })),
      h('span', { class: 'tr' }, h('i', { style: `width:${(a.count[e] / known) * 100}%` })),
      h('span', { class: 'ct' }, `${a.count[e]}개 `, h('span', { class: `sj-role ${ROLE_CLASS[a.roles[e]]}`, text: a.roles[e] })))));
    const missing = [0, 1, 2, 3, 4].filter((e) => a.count[e] === 0).map((e) => S.EL_K[e]);
    const most = [0, 1, 2, 3, 4].reduce((m, e) => (a.count[e] > a.count[m] ? e : m), 0);
    $('#els-note').textContent = `${known}글자 중 ${S.EL_K[most]}(${S.EL_H[most]})이 가장 많고${missing.length ? `, ${missing.join('·')}이(가) 없습니다` : ', 다섯 오행을 모두 갖추고 있습니다'}. 나의 일간은 ${S.EL_K[a.meEl]}(${S.EL_H[a.meEl]})입니다.`;

    const sRow = rowById(data.strength, a.strength);
    $('#strength').replaceChildren(
      h('div', { style: 'display:flex;align-items:baseline;gap:var(--cds-gap-sm);flex-wrap:wrap;margin-bottom:var(--cds-gap-sm)' },
        cite('span', 'strength', '구분', `id=${a.strength}`, sRow ? sRow['구분'] : a.strength, 'sj-big'),
        h('span', { class: 'sj-cap sj-muted', text: `나를 돕는 기운 ${Math.round(a.ratio * 100)}% · 빼는 기운 ${100 - Math.round(a.ratio * 100)}%` })),
      h('div', { class: 'sj-meter', style: 'margin-bottom:var(--cds-gap-md)' }, h('i', { style: `width:${a.ratio * 100}%` }), h('b', { style: 'left:50%' })),
      cite('p', 'strength', '설명', `id=${a.strength}`, sRow ? sRow['설명'] : '', 'sj-para'),
      h('p', { class: 'sj-para', style: 'margin-top:var(--cds-gap-sm)' },
        `강약만 보면(억부) ${S.EL_K[a.eokYong]}(${S.EL_H[a.eokYong]})이 필요합니다. `,
        a.johu && a.johu.w >= 0.08
          ? `여기에 ${a.johu.season}에 태어나 ${a.johu.need === 1 ? '사주가 차가워 따뜻한 화(火)' : '사주가 뜨거워 식혀 줄 수(水)'}가 필요한 조후를 ${Math.round(a.johu.w * 100)}% 비중으로 함께 봤어요. `
          : '태어난 계절의 한난(차고 더움)은 크게 치우치지 않아 강약 위주로 봅니다. ',
        '그래서 내 사주에 가장 필요한 오행, 즉 ', h('b', { text: `용신은 ${S.EL_K[a.yong]}(${S.EL_H[a.yong]})` }), '이고, ',
        `그다음으로 반가운 희신은 ${S.EL_K[a.elOf('희신')]}, 가장 꺼리는 기신은 ${S.EL_K[a.elOf('기신')]}입니다. 운세 점수는 그날과 대운·세운의 오행이 이 중 무엇에 해당하는지에 따라 오르내립니다.`));

    const st = rowById(data.stems, `g${a.me}`);
    $('#stem').replaceChildren(
      h('div', { style: 'display:flex;align-items:center;gap:var(--cds-gap-md);margin-bottom:var(--cds-gap-sm)' },
        h('div', { class: 'sj-ch me', style: `${elVar(a.meEl)};padding:var(--cds-pad-xs) var(--cds-pad-md);text-align:center` }, h('span', { class: 'hz' }, cite('span', 'stems', '한자', `id=g${a.me}`, st ? st['한자'] : ''))),
        h('div', {}, cite('p', 'stems', '일간', `id=g${a.me}`, st ? st['일간'] : '', 'sj-big'), h('p', { class: 'sj-cap sj-muted' }, '상징: ', cite('span', 'stems', '상징', `id=g${a.me}`, st ? st['상징'] : '')))),
      cite('p', 'stems', '성향', `id=g${a.me}`, st ? st['성향'] : '', 'sj-para'),
      h('dl', { class: 'sj-kv', style: 'margin-top:var(--cds-gap-md)' },
        h('dt', { text: '강점' }), h('dd', {}, cite('span', 'stems', '강점', `id=g${a.me}`, st ? st['강점'] : '')),
        h('dt', { text: '보완점' }), h('dd', {}, cite('span', 'stems', '보완', `id=g${a.me}`, st ? st['보완'] : ''))));
  }

  function drawDaeun(du, dy, a, data) {
    const box = $('#daeun');
    if (!box) return;
    if (!du) { box.replaceChildren(h('p', { class: 'sj-cap sj-muted', text: '대운을 계산할 수 없어요.' })); return; }
    const cur = dy.flow.find((f) => f.key === 'daeun');
    box.replaceChildren(
      h('p', { class: 'sj-sec-note', text: `${du.fwd ? '순행' : '역행'} · 대운수 ${du.startRound} (출생 후 ${du.fwd ? '다음' : '이전'} 절입까지 ${Math.round(du.start * 3)}일 ÷ 3 ≈ 만 ${du.start.toFixed(1)}세에 첫 대운 시작) · 대운은 10년마다 바뀌는 큰 흐름이에요.` }),
      h('div', { class: 'sj-du' }, ...du.list.slice(0, 9).map((x) => {
        const st = x.idx % 10, br = x.idx % 12, role = a.roles[S.elOfStem(st)], sip = S.sipsung(a.me, st);
        const on = cur && cur.idx === x.idx;
        return h('div', { class: `sj-du-cell${on ? ' on' : ''}` },
          h('span', { class: 'age', text: `만 ${Math.round(x.from)}세` }),
          h('span', { class: 'gz', text: S.ganjiH(x.idx) }),
          h('span', { class: 'kr', text: S.ganjiK(x.idx) }),
          h('span', { class: 'sip', text: sip }),
          h('span', { class: `sj-role ${ROLE_CLASS[role]}`, text: role }));
      })),
      cur ? h('p', { class: 'sj-para' }, '지금은 ', h('b', { text: `${S.ganjiK(cur.idx)}(${S.ganjiH(cur.idx)}) 대운` }),
        `(만 ${Math.round(cur.cur.from)}~${Math.round(cur.cur.to) - 1}세)을 지나고 있어요. 대운 천간이 나에게 ${cur.sip}이고 ${cur.role}에 해당해, 이 10년은 `,
        cur.mix >= 0.35 ? '전반적으로 기운이 받쳐 주는 시기' : cur.mix >= 0.05 ? '무난하게 힘이 실리는 시기' : cur.mix > -0.2 ? '좋고 나쁨이 섞인 시기' : '힘을 아끼며 내실을 다질 시기',
        '로 봅니다. 이 흐름이 매일의 운세 점수에도 반영돼요.') : h('p', { class: 'sj-para', text: '아직 첫 대운이 시작되기 전이라 대운은 점수에 넣지 않았어요.' }));
  }

  function drawLucky(a, data) {
    const yid = `e${a.yong}`, gid = `e${a.elOf('기신')}`;
    const y = rowById(data.elements, yid), g = rowById(data.elements, gid);
    if (!y || !g) return;
    $('#lucky-body').replaceChildren(h('div', { class: 'sj-lucky' },
      h('div', { style: 'display:grid;gap:var(--cds-gap-sm)' },
        h('div', { style: 'display:flex;align-items:center;gap:var(--cds-gap-md)' },
          h('span', { class: 'sj-pf-badge', style: elVar(a.yong), text: S.EL_H[a.yong] }),
          h('div', {}, h('p', { class: 'sj-big', text: `용신 ${S.EL_K[a.yong]}` }), h('p', { class: 'sj-cap sj-muted', text: '가까이할수록 운이 열리는 기운' }))),
        cite('p', 'elements', '설명', `id=${yid}`, y['설명'], 'sj-para')),
      h('dl', { class: 'sj-kv' },
        h('dt', { text: '행운의 색' }), h('dd', {}, h('span', { class: 'sj-swatch', style: elVar(a.yong) }), cite('span', 'elements', '행운색', `id=${yid}`, y['행운색'])),
        h('dt', { text: '좋은 방향' }), h('dd', {}, cite('span', 'elements', '방향', `id=${yid}`, y['방향'])),
        h('dt', { text: '행운의 숫자' }), h('dd', {}, cite('span', 'elements', '숫자', `id=${yid}`, y['숫자'])),
        h('dt', { text: '추천 음식' }), h('dd', {}, cite('span', 'elements', '음식', `id=${yid}`, y['음식'])),
        h('dt', { text: '추천 활동' }), h('dd', {}, cite('span', 'elements', '활동', `id=${yid}`, y['활동'])),
        h('dt', { text: '줄일 색' }), h('dd', {}, h('span', { class: 'sj-swatch', style: elVar(a.elOf('기신')) }), cite('span', 'elements', '행운색', `id=${gid}`, g['행운색']), h('span', { class: 'sj-muted sj-cap', text: ` (기신 ${S.EL_K[a.elOf('기신')]}의 색)` })))));
  }

  /* ---------- 하루 리듬 ---------- */
  function editableFlags(date) {
    const t = todayStr();
    if (date < t) return [true, true, true, true, true, true];
    if (date > t) return [false, false, false, false, false, false];
    const hr = new Date().getHours();
    return [0, 1, 2, 3, 4, 5].map((i) => i * 4 <= hr);
  }

  function buildRhythm(p, a, dy, scores, zi, data) {
    const natalDay = a.cols[1].branch;
    let total = S.hourly(a, dy, natalDay, p.date, lifeOf(p));
    if (zi) total = total.map((x) => ({ ...x, value: Math.max(5, Math.min(97, x.value + 5 * (zwPalaceScore(zi.c, null, x.branch, data) - 3))) }));
    const hours = { total };
    CATS.slice(1).forEach((c, k) => { hours[c.code] = S.categoryHourly(a, total, c.code, p.gender, scores[k + 1], natalDay); });
    const bl = {};
    Object.keys(hours).forEach((k) => { bl[k] = S.blocks(hours[k]); });
    return { hours, bl, editable: editableFlags(p.date), scores };
  }

  function openFlags() {
    const p = dash.params();
    const t = todayStr();
    if (p.date !== t) return [true, true, true, true, true, true];
    const hr = new Date().getHours();
    return [0, 1, 2, 3, 4, 5].map((i) => i * 4 > hr);
  }
  function adjustAll() {
    const m = rhythmModel;
    const open = openFlags();
    const tot = S.adjust(m.bl.total, editsFor('total'), m.editable, open);
    const out = { total: { ...tot, origin: m.bl.total } };
    CATS.slice(1).forEach((c) => {
      const shifted = m.bl[c.code].map((b, i) => ({ ...b, base: Math.max(3, Math.min(98, b.base + 0.5 * (tot.list[i].value - tot.list[i].base))) }));
      out[c.code] = { ...S.adjust(shifted, editsFor(c.code), m.editable, open), origin: m.bl[c.code] };
    });
    return out;
  }

  function drawChart(box, code, adj, hours, opts) {
    const m = rhythmModel;
    const accent = opts.accent;
    const W = Math.max(240, box.clientWidth || 500), H = opts.height;
    const mg = { t: 22, r: 6, b: 26, l: opts.compact ? 6 : 30 };
    const x = d3.scaleBand([0, 1, 2, 3, 4, 5], [mg.l, W - mg.r]).padding(0.26);
    const y = d3.scaleLinear([0, 100], [H - mg.b, mg.t]);
    const hx = d3.scaleLinear([0, 24], [mg.l + x.step() * x.paddingOuter(), W - mg.r - x.step() * x.paddingOuter()]);
    const svg = d3.create('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', `${opts.name} 시간대별 리듬`);
    svg.append('g').selectAll('line').data([0, 50, 100]).join('line')
      .attr('x1', mg.l).attr('x2', W - mg.r).attr('y1', (d) => y(d)).attr('y2', (d) => y(d)).attr('stroke', 'var(--cds-chart-grid)');
    if (!opts.compact) {
      svg.append('g').selectAll('text').data([0, 50, 100]).join('text')
        .attr('x', mg.l - 6).attr('y', (d) => y(d)).attr('dy', '0.32em').attr('text-anchor', 'end').attr('fill', 'var(--color-fg-muted)').style('font-size', 'var(--cds-font-size-caption)').text((d) => d);
    }
    svg.append('g').selectAll('text').data(adj.list).join('text')
      .attr('x', (d) => x(d.i) + x.bandwidth() / 2).attr('y', H - mg.b + 17).attr('text-anchor', 'middle').attr('fill', 'var(--color-fg-muted)').style('font-size', opts.compact ? '10px' : 'var(--cds-font-size-caption)')
      .text((d) => (opts.compact ? `${d.from}시` : `${d.from}–${d.to}시`));

    const shiftOf = (hr) => { const i = Math.floor(hr / 4); return adj.list[i].value - adj.origin[i].base; };
    const line = d3.line().x((d) => hx(d.h + 0.5)).y((d) => y(Math.max(2, Math.min(99, d.value + shiftOf(d.h)))));
    svg.append('path').attr('d', line(hours)).attr('fill', 'none').attr('stroke', 'var(--color-fg-muted)').attr('stroke-width', 1.5).attr('stroke-linejoin', 'round').attr('stroke-linecap', 'round').attr('opacity', 0.5);

    const bw = Math.min(x.bandwidth(), opts.compact ? 40 : 72);
    const cols = svg.append('g').selectAll('g').data(adj.list).join('g').attr('class', 'col');
    cols.each(function (d) {
      const g = d3.select(this);
      const cx = x(d.i) + x.bandwidth() / 2;
      const orig = adj.origin[d.i].base;
      if (Math.abs(d.value - orig) >= 1) {
        g.append('rect').attr('x', cx - bw / 2).attr('width', bw).attr('y', y(orig)).attr('height', y(0) - y(orig)).attr('rx', 4)
          .attr('fill', 'none').attr('stroke', 'var(--cds-chart-muted)').attr('stroke-dasharray', '4 3');
      }
      const changed = d.state === 'edited' || Math.abs(d.value - orig) >= 1;
      g.append('rect').attr('x', cx - bw / 2).attr('width', bw).attr('y', y(d.value)).attr('height', Math.max(0, y(0) - y(d.value))).attr('rx', 4)
        .attr('fill', changed ? accent : 'var(--cds-chart-muted)').attr('opacity', d.state === 'edited' ? 1 : changed ? 0.42 : 1);
      if (m.editable[d.i]) g.append('rect').attr('x', cx - bw / 2 + 4).attr('width', bw - 8).attr('y', y(d.value) - 2).attr('height', 4).attr('rx', 2).attr('fill', 'var(--color-fg)');
      g.append('text').attr('x', cx).attr('y', y(d.value) - 8).attr('text-anchor', 'middle').attr('fill', 'var(--color-fg)')
        .style('font-size', opts.compact ? '10px' : 'var(--cds-font-size-caption)').style('font-variant-numeric', 'tabular-nums').text(Math.round(d.value));
      g.append('rect').attr('class', 'hit').attr('x', x(d.i)).attr('width', x.bandwidth()).attr('y', mg.t).attr('height', y(0) - mg.t).attr('fill', 'transparent').attr('rx', 4);
      if (m.editable[d.i]) g.attr('tabindex', 0).attr('role', 'slider').attr('aria-label', `${opts.name} ${d.from}시부터 ${d.to}시 기록`).attr('aria-valuemin', 0).attr('aria-valuemax', 100).attr('aria-valuenow', Math.round(d.value));
      else g.style('cursor', 'default');
    });

    if (opts.today) {
      const now = new Date(); const t = now.getHours() + now.getMinutes() / 60;
      svg.append('line').attr('x1', hx(t)).attr('x2', hx(t)).attr('y1', mg.t - 8).attr('y2', y(0)).attr('stroke', 'var(--cds-chart-reference)').attr('stroke-dasharray', '3 3');
      if (!opts.compact) svg.append('text').attr('x', hx(t)).attr('y', mg.t - 12).attr('text-anchor', t > 20 ? 'end' : t < 2 ? 'start' : 'middle').attr('fill', 'var(--color-fg-muted)').style('font-size', 'var(--cds-font-size-caption)').text(`지금 ${S.pad(now.getHours())}:${S.pad(now.getMinutes())}`);
    }

    const tip = h('div', { class: 'sj-tip', hidden: true });
    box.replaceChildren(svg.node(), tip);

    const valueAt = (ev) => { const r = svg.node().getBoundingClientRect(); return Math.max(0, Math.min(100, Math.round(y.invert(((ev.clientY - r.top) / r.height) * H)))); };
    cols.on('pointerdown', function (ev, d) {
      if (!m.editable[d.i]) return;
      ev.preventDefault();
      drag = { code, edits: editsFor(code).slice() };
      drag.edits[d.i] = valueAt(ev);
      drawAllRhythm();
      const onMove = (e) => { drag.edits[d.i] = valueAt(e); drawAllRhythm(); };
      const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); const e2 = drag.edits; drag = null; commitEdits(code, e2); };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    });
    cols.on('keydown', (ev, d) => {
      if (!m.editable[d.i]) return;
      const step = ev.key === 'ArrowUp' || ev.key === 'ArrowRight' ? 5 : ev.key === 'ArrowDown' || ev.key === 'ArrowLeft' ? -5 : 0;
      if (!step) return;
      ev.preventDefault();
      const e = editsFor(code).slice();
      const cur = e[d.i] >= 0 ? e[d.i] : Math.round(adj.list[d.i].value);
      e[d.i] = Math.max(0, Math.min(100, cur + step));
      commitEdits(code, e);
    });
    cols.on('pointermove', (ev, d) => {
      if (drag) { tip.hidden = true; return; }
      const r = box.getBoundingClientRect();
      tip.replaceChildren(
        h('div', { class: 'k', text: `${opts.name} · ${d.from}시 – ${d.to}시` }),
        h('div', { text: `예측 ${Math.round(adj.origin[d.i].base)}` }),
        h('div', { class: 'k', text: godsOf(d.i).map((g) => `${S.BR_K[g.branch]}시 ${g.name}(${g.yellow ? '황도' : '흑도'})`).join(' · ') }),
        d.state === 'edited' ? h('div', { text: `내 기록 ${Math.round(d.value)}` }) : Math.abs(d.value - adj.origin[d.i].base) >= 1 ? h('div', { text: `조정된 예측 ${Math.round(d.value)}` }) : null,
        m.editable[d.i] ? h('div', { class: 'k', text: '끌어서 기록' }) : null);
      tip.hidden = false;
      tip.style.left = `${Math.min(r.width - tip.offsetWidth - 4, Math.max(4, ev.clientX - r.left + 12))}px`;
      tip.style.top = `${Math.max(0, ev.clientY - r.top - tip.offsetHeight - 8)}px`;
    });
    cols.on('pointerleave', () => { tip.hidden = true; });
  }

  let lastData = null;
  let lastScores = [3, 3, 3, 3, 3];
  let lastRemain = null;
  function drawAllRhythm() {
    const m = rhythmModel;
    if (!m || !lastData) return;
    const data = lastData;
    const p = dash.params();
    const all = adjustAll();
    lastRemain = remainingScores(all, lastScores);
    const isToday = p.date === todayStr();
    const anyEditable = m.editable.some(Boolean);
    const anyEdits = RCATS.some((r) => editsFor(r.code).some((v) => v >= 0));
    $('#rh-note').textContent = !anyEditable
      ? '아직 오지 않은 날이라 예측 리듬만 보여 드려요. 날짜가 되면 지난 시간대를 직접 기록할 수 있어요.'
      : isToday
        ? '지금 시각까지의 시간대는 막대를 위아래로 끌거나 −/+ 버튼으로 실제 컨디션을 기록하세요. 기록한 흐름이 이후 시간대로 이어지고, 멀어질수록 원래 예측으로 돌아옵니다.'
        : '지난 날이라 모든 시간대를 기록할 수 있어요. 기록한 흐름이 이후 시간대로 이어지고, 멀어질수록 원래 예측으로 돌아옵니다.';
    const accent = 'var(--sj-gold)';
    $('#rh-legend').replaceChildren(
      h('span', {}, h('i', { style: 'background:var(--cds-chart-muted)' }), '예측'),
      h('span', {}, h('i', { style: `background:${accent}` }), '내 기록'),
      h('span', {}, h('i', { style: `background:${accent};opacity:.4` }), '조정된 예측'));
    $('#rh-reset').hidden = !anyEdits;

    // 총운
    const tot = all.total;
    drawChart($('#rh-chart'), 'total', tot, m.hours.total, { height: 240, accent, name: '총운', today: isToday });
    const msg = $('#rh-msg');
    const later = tot.list.filter((d) => d.state === 'adjusted');
    const peakOf = (list) => list.reduce((b, d) => (d.value > b.value ? d : b), list[0]);
    const lowOf = (list) => list.reduce((b, d) => (d.value < b.value ? d : b), list[0]);
    if (tot.last >= 0) {
      const dv = Math.round(tot.dev);
      msg.textContent = `기록한 컨디션이 예측보다 평균 ${dv > 0 ? '+' : ''}${dv}점 ${dv >= 0 ? '높게' : '낮게'} 흘러가고 있어요. ${later.length ? `그래서 ${later[0].from}시 이후 리듬을 ${Math.abs(dv) < 3 ? '거의 그대로 유지했어요' : `${dv > 0 ? '올려' : '낮춰'} 잡았어요(멀어질수록 원래 흐름으로 돌아옵니다)`}. 남은 시간 중 가장 좋은 때는 ${peakOf(later).from}시 무렵입니다.` : '남은 시간대가 없어 오늘 기록으로 마무리됩니다.'}`;
    } else {
      const pk = peakOf(tot.list), lw = lowOf(tot.list);
      msg.textContent = `이날은 ${pk.from}–${pk.to}시에 기운이 가장 높고(${Math.round(pk.value)}), ${lw.from}–${lw.to}시에 가장 낮아요(${Math.round(lw.value)}). 중요한 일은 높은 시간대에, 휴식과 정리는 낮은 시간대에 배치해 보세요.`;
    }
    $('#rh-blocks').replaceChildren(...tot.list.map((d) => {
      const lv = LEVEL(d.value);
      const rid = `b${d.i}-${lv}`;
      const r = rowById(data.rhythm, rid);
      const ed = m.editable[d.i];
      const kids = [
        h('div', { class: 'tm' }, cite('b', 'rhythm', '시간대', `id=${rid}`, r ? r['시간대'] : `${d.from}–${d.to}시`),
          h('span', { text: d.state === 'edited' ? '내 기록' : d.state === 'adjusted' ? '기록 반영 조정' : ed ? '예측 · 기록 가능' : '예측' }),
          h('span', { class: 'sj-gods' }, ...godsOf(d.i).map((g) => h('i', { class: g.yellow ? 'y' : 'b', text: `${S.BR_K[g.branch]}시 ${g.name}` })))),
        h('p', { class: 'tx' }, h('span', { class: `sj-lv ${lv === 0 ? 'hi' : lv === 2 ? 'lo' : ''}` }, cite('span', 'rhythm', '수준', `id=${rid}`, r ? r['수준'] : '')), cite('span', 'rhythm', '문구', `id=${rid}`, r ? r['문구'] : '')),
      ];
      kids.push(ed ? stepper('total', d) : h('div', { class: 'ed' }, h('output', { text: Math.round(d.value) })));
      return h('div', { class: 'sj-block' }, ...kids);
    }));

    // 분야별
    CATS.slice(1).forEach((c, k) => {
      const card = $(`#rh-${c.code}`);
      const col = 'var(--sj-gold)';
      card.style.setProperty('--sj-accent', col);
      const adj = all[c.code];
      const pool = isToday ? adj.list.filter((d) => !m.editable[d.i] || d.i * 4 + 4 > new Date().getHours()) : adj.list;
      const pk = peakOf(pool.length ? pool : adj.list);
      const lv = LEVEL(pk.value);
      const tipRow = rowById(data.rhythm, `c-${c.code}-${lv}`);
      const own = editsFor(c.code).some((v) => v >= 0);
      const rem = lastRemain ? lastRemain[k + 1] : null;
      const box = h('div', { class: 'sj-chart', 'data-source': 'rhythm' });
      card.replaceChildren(
        h('div', { class: 'sj-rsub-head' }, h('h3', {}, c.name, ' ', h('span', { class: 'sj-cap sj-muted', text: `하루 ${lastScores[k + 1].toFixed(1)}` }), ' ', remainChip(rem, lastScores[k + 1])),
          h('span', { class: 'sj-cap sj-muted', text: `${isToday ? '남은 시간 중 ' : ''}최고 ${pk.from}–${pk.to}시 · ${Math.round(pk.value)}` })),
        box,
        h('p', {}, h('span', { class: `sj-lv ${lv === 0 ? 'hi' : lv === 2 ? 'lo' : ''}` }, cite('span', 'rhythm', '수준', `id=c-${c.code}-${lv}`, tipRow ? tipRow['수준'] : '')), cite('span', 'rhythm', '문구', `id=c-${c.code}-${lv}`, tipRow ? tipRow['문구'] : '')),
        own ? h('p', { class: 'sj-muted', text: `직접 기록한 값과 예측의 차이 ${Math.round(adj.dev) > 0 ? '+' : ''}${Math.round(adj.dev)}점을 이후 시간대에 반영했어요.` }) : null);
      drawChart(box, c.code, adj, m.hours[c.code], { height: 170, accent: col, name: c.name, compact: true, today: isToday });
    });
  }

  function godsOf(i) {
    const seen = new Map();
    rhythmModel.hours.total.slice(i * 4, i * 4 + 4).forEach((x) => { if (!seen.has(x.branch)) seen.set(x.branch, { branch: x.branch, ...x.god }); });
    return [...seen.values()];
  }

  function stepper(code, d) {
    const minus = h('button', { type: 'button', 'aria-label': `${d.from}시 시간대 5 낮추기`, text: '−' });
    const plus = h('button', { type: 'button', 'aria-label': `${d.from}시 시간대 5 높이기`, text: '+' });
    const bump = (k) => { const e = editsFor(code).slice(); const cur = e[d.i] >= 0 ? e[d.i] : Math.round(d.value); e[d.i] = Math.max(0, Math.min(100, cur + k)); commitEdits(code, e); };
    minus.addEventListener('click', () => bump(-5)); plus.addEventListener('click', () => bump(5));
    return h('div', { class: 'ed' }, minus, h('output', { text: Math.round(d.value) }), plus);
  }


  /* ---------- 자미두수 ---------- */
  const Z = window.Ziwei;
  const ZW_K = { total: [0], money: [4], stock: [4, 10], exam: [8, 11], love: [2], work: [8] }; // 유일 명궁 기준 궁 순번
  const ZW_LAYOUT = [[5, 6, 7, 8], [4, null, null, 9], [3, null, null, 10], [2, 1, 0, 11]];
  const HUA_SHORT = ['록', '권', '과', '기'];
  let zwSelected = null;

  function buildZiwei(p, bc, L) {
    if (!bc || !bc.hm || !L) return null;
    let solar = bc.solar;
    const [hh, mm] = bc.hm.split(':').map(Number);
    if (hh * 60 + mm >= 24 * 60 - 60 + bc.shift) solar = S.addDays(solar, 1);
    const lb = L.toLunar(solar);
    if (!lb) return null;
    return { chart: Z.chart({ y: lb.y, m: lb.m, d: lb.d, leap: lb.leap, hb: S.hourBranch(bc.hm, bc.shift), gender: p.gender }), lunar: lb };
  }
  function zwDailyOf(c, L, date, dayStem) {
    const lt = L ? L.toLunar(date) : null;
    return lt ? Z.daily(c, { y: lt.y, m: lt.m, d: lt.d, leap: lt.leap, dayStem }) : null;
  }
  const starRow = (data, n) => rowById(data.zwstars, n);
  const huaGain = (data, i) => { const r = rowById(data.zwhua, `h${i}-total`); return r ? Number(r['가감']) : 0; };

  function zwPalaceScore(c, zd, b, data) {
    const pal = c.palaces[b];
    let main = pal.main, borrowed = false;
    if (!main.length) { main = c.palaces[(b + 6) % 12].main; borrowed = true; }
    let s = 3;
    if (main.length) s += d3.mean(main, (n) => Number((starRow(data, n) || {})['점수'] || 0)) * (borrowed ? 0.5 : 1);
    s += Math.max(-1, Math.min(1, d3.sum(pal.aux, (n) => Number((starRow(data, n) || {})['점수'] || 0))));
    [...pal.main, ...pal.aux].forEach((n) => { const h = c.natalHua[n]; if (h !== undefined) s += 0.5 * huaGain(data, h); });
    if (zd) {
      zd.hua.forEach((x) => { if (x.pos === b) s += huaGain(data, x.hua); });
      zd.yearHua.forEach((x) => { if (x.pos === b) s += 0.6 * huaGain(data, x.hua); });
      zd.limitHua.forEach((x) => { if (x.pos === b) s += 0.4 * huaGain(data, x.hua); });
    }
    return s;
  }
  function zwScores(c, zd, data) {
    const sc = (k) => zwPalaceScore(c, zd, zd.at(k), data);
    return CATS.map((cat) => {
      if (cat.code === 'total') return S.clampScore(0.6 * sc(0) + 0.4 * d3.mean([sc(4), sc(8), sc(6)]));
      if (cat.code === 'exam') return S.clampScore(0.6 * sc(8) + 0.4 * sc(11));
      if (cat.code === 'stock') return S.clampScore(0.6 * sc(4) + 0.4 * sc(10));
      return S.clampScore(sc(ZW_K[cat.code][0]));
    });
  }
  const mergeScores = (saju, zw) => (zw ? saju.map((s, i) => S.clampScore((s + zw[i]) / 2)) : saju);

  function zwBox(c, zd, cat, zscore, data) {
    const k = ZW_K[cat.code][0];
    const b = zd.at(k);
    const pal = c.palaces[b];
    let main = pal.main, borrowed = false;
    if (!main.length) { main = c.palaces[(b + 6) % 12].main; borrowed = true; }
    const dailyHua = zd.hua.filter((x) => x.pos === b);
    const bigHua = [...zd.yearHua, ...zd.limitHua].filter((x) => x.pos === b);
    const natal = [...pal.main, ...pal.aux].filter((n) => c.natalHua[n] !== undefined);
    const good = pal.aux.filter((n) => Number((starRow(data, n) || {})['점수']) > 0);
    const bad = pal.aux.filter((n) => Number((starRow(data, n) || {})['점수']) < 0);
    return h('div', { class: 'sj-fc-sub sj-zw-sub' },
      h('div', { class: 't' }, h('b', { class: 'sj-zw-tag', text: '자미두수' }), `유일 ${Z.PAL[k]} · ${Z.BR_K[b]}(${Z.BR_H[b]})궁`, h('span', { class: 'sj-zw-sc', text: `${zscore.toFixed(1)} / 5` })),
      borrowed ? h('p', { class: 'sj-cap sj-muted', text: main.length ? `주성이 없는 빈 궁이라 맞은편 ${c.palaces[(b + 6) % 12].name}의 ${main.join('·')}을(를) 빌려 봅니다.` : '주성이 없는 빈 궁입니다.' }) : null,
      ...main.map((n) => h('p', {}, h('b', { text: `${n} ` }), cite('span', 'zwstars', cat.name, `id=${n}`, (starRow(data, n) || {})[cat.name] || ''))),
      dailyHua.length ? dailyHua.map((x) => h('p', {}, h('span', { class: `sj-hua h${x.hua}`, text: `유일 ${x.star}${Z.HUA[x.hua]}` }), ' ', cite('span', 'zwhua', '내용', `id=h${x.hua}-${cat.code}`, (rowById(data.zwhua, `h${x.hua}-${cat.code}`) || {})['내용'] || ''))) : null,
      bigHua.length ? h('p', { class: 'sj-cap sj-muted' }, '큰 흐름 ', ...bigHua.map((x) => h('span', { class: `sj-hua o h${x.hua}`, text: `${x.src} ${x.star}${Z.HUA[x.hua]}` })),
        bigHua.some((x) => x.hua === 3) ? ' — 올해·대한의 화기가 걸려 있어 이 분야는 무리한 확장보다 지키는 쪽이 좋아요.' : ' — 올해·대한의 좋은 사화가 이 분야를 받쳐 줍니다.') : null,
      good.length || bad.length || natal.length ? h('p', { class: 'sj-cap sj-muted' },
        good.length ? `길성 ${good.join('·')}` : '', good.length && bad.length ? ' · ' : '', bad.length ? `살성 ${bad.join('·')}` : '',
        natal.length ? `${good.length || bad.length ? ' · ' : ''}생년 ${natal.map((n) => n + Z.HUA[c.natalHua[n]]).join('·')}` : '') : null);
  }

  function drawZiwei(p, zw, zd, zwOverall, data) {
    const sec = $('#ziwei');
    if (!zw) {
      $('#zw-grid').replaceChildren(h('p', { class: 'sj-empty', style: 'grid-column:1/-1', text: '태어난 시간을 입력하면 자미두수 명반을 세울 수 있어요. 명궁 위치가 출생 시진으로 정해지기 때문이에요.' }));
      $('#zw-detail').replaceChildren();
      return;
    }
    const c = zw.chart;
    if (zwSelected === null || zwSelected === undefined) zwSelected = c.ming;
    const dayNameAt = (b) => (zd ? Z.PAL[((zd.dayP - b) % 12 + 12) % 12] : '');
    const cells = [];
    ZW_LAYOUT.forEach((row, r) => row.forEach((b, col) => {
      if (b === null) {
        if (r === 1 && col === 1) cells.push(zwCenter(p, zw, zd, zwOverall));
        return;
      }
      const pal = c.palaces[b];
      const isDay = zd && zd.dayP === b;
      const isLimit = zd && zd.limitP === b;
      const cell = h('button', { type: 'button', class: `sj-zw-cell${isDay ? ' day' : ''}${isLimit ? ' limit' : ''}${zwSelected === b ? ' sel' : ''}`, style: `grid-row:${r + 1};grid-column:${col + 1}`, 'aria-pressed': zwSelected === b ? 'true' : 'false', 'aria-label': `${pal.name} ${Z.BR_K[b]}궁, ${pal.main.join(' ') || '주성 없음'}` },
        h('span', { class: 'hd' }, h('b', { text: pal.name }), pal.isShen ? h('i', { text: '신' }) : null, h('span', { class: 'gz', text: `${Z.STEM_H[pal.stem]}${Z.BR_H[b]}` })),
        h('span', { class: 'mn' }, ...(pal.main.length ? pal.main : ['—']).map((n) => h('span', { class: 'st' }, n,
          c.natalHua[n] !== undefined ? h('i', { class: `sj-hua h${c.natalHua[n]}`, text: HUA_SHORT[c.natalHua[n]] }) : null,
          zd ? zd.hua.filter((x) => x.star === n).map((x) => h('i', { class: `sj-hua o h${x.hua}`, title: `유일 ${Z.HUA[x.hua]}`, text: HUA_SHORT[x.hua] })) : null))),
        h('span', { class: 'ax' }, ...pal.aux.map((n) => h('span', { class: Number((starRow(data, n) || {})['점수']) < 0 ? 'bad' : '' }, n,
          c.natalHua[n] !== undefined ? h('i', { class: `sj-hua h${c.natalHua[n]}`, text: HUA_SHORT[c.natalHua[n]] }) : null,
          zd ? zd.hua.filter((x) => x.star === n).map((x) => h('i', { class: `sj-hua o h${x.hua}`, text: HUA_SHORT[x.hua] })) : null))),
        h('span', { class: 'ft' }, h('span', { text: `${pal.limit[0]}–${pal.limit[1]}세` }), h('span', { class: 'dn', text: isDay ? '오늘 명궁' : dayNameAt(b) ? `유일 ${dayNameAt(b).replace('궁', '')}` : '' })));
      cell.addEventListener('click', () => { zwSelected = b; drawZiwei(p, zw, zd, zwOverall, data); });
      cells.push(cell);
    }));
    $('#zw-grid').replaceChildren(...cells);

    // 선택한 궁 해설
    const b = zwSelected;
    const pal = c.palaces[b];
    const prow = rowById(data.zwpalaces, `p${pal.k}`);
    let main = pal.main, borrowed = false;
    if (!main.length) { main = c.palaces[(b + 6) % 12].main; borrowed = true; }
    $('#zw-detail').replaceChildren(
      h('div', { class: 'sj-zw-dh' },
        h('p', { class: 'sj-big', text: `${pal.name} · ${Z.STEM_K[pal.stem]}${Z.BR_K[b]}궁` }),
        h('p', { class: 'sj-cap sj-muted' }, cite('span', 'zwpalaces', '의미', `id=p${pal.k}`, prow ? prow['의미'] : ''), ` · 대한 ${pal.limit[0]}–${pal.limit[1]}세${pal.isShen ? ' · 신궁(身宮)' : ''}`)),
      borrowed ? h('p', { class: 'sj-cap sj-muted', text: main.length ? `주성이 없는 빈 궁이라 맞은편 ${c.palaces[(b + 6) % 12].name}의 별을 빌려 해석합니다.` : '주성이 없는 빈 궁입니다.' }) : null,
      ...main.map((n) => {
        const r = starRow(data, n) || {};
        return h('div', { class: 'sj-zw-star' },
          h('p', {}, h('b', { text: `${n}(${r['한자'] || ''}) ` }), h('span', { class: 'sj-cap sj-muted' }, cite('span', 'zwstars', '키워드', `id=${n}`, r['키워드'] || '')),
            c.natalHua[n] !== undefined ? h('span', { class: `sj-hua h${c.natalHua[n]}`, style: 'margin-left:6px', text: `생년 ${Z.HUA[c.natalHua[n]]}` }) : null),
          cite('p', 'zwstars', '성격', `id=${n}`, r['성격'] || '', 'sj-para'));
      }),
      pal.aux.length ? h('dl', { class: 'sj-kv', style: 'margin-top:var(--cds-gap-sm)' }, ...pal.aux.flatMap((n) => {
        const r = starRow(data, n) || {};
        return [h('dt', { text: `${n}` }), h('dd', {}, cite('span', 'zwstars', '성격', `id=${n}`, r['성격'] || ''))];
      })) : null);
    sec.dataset.ready = '1';
  }

  function zwCenter(p, zw, zd, zwOverall) {
    const c = zw.chart, lb = zw.lunar;
    const yang = c.yStem % 2 === 0;
    return h('div', { class: 'sj-zw-center', style: 'grid-row:2 / span 2;grid-column:2 / span 2' },
      h('p', { class: 'sj-cap sj-muted', text: '자미두수 명반' }),
      h('p', { class: 'sj-zw-cbig', text: c.juName }),
      h('p', { text: `음력 ${lb.y}년 ${lb.leap ? '윤' : ''}${lb.m}월 ${lb.d}일 ${S.BR_K[c.hb]}시` }),
      h('p', { text: `${Z.STEM_K[c.yStem]}${Z.BR_K[c.yBranch]}년생 · ${yang ? '양' : '음'}${p.gender === '여' ? '녀' : '남'} · 대한 ${c.dir > 0 ? '순행' : '역행'}` }),
      h('p', { text: `명주 ${c.mingzhu} · 신주 ${c.shenzhu}` }),
      zd ? h('p', { class: 'sj-muted', text: `${zd.age}세 · 대한 ${Z.BR_K[zd.limitP] || '-'}궁 · 유년 ${Z.BR_K[zd.yearP]}궁 · 유일 ${Z.BR_K[zd.dayP]}궁` }) : null,
      zwOverall !== null ? h('p', { class: 'sj-zw-cscore' }, h('span', { text: '이날 자미두수 지수 ' }), h('b', { text: zwOverall })) : null);
  }

  /* ---------- 메인 ---------- */
  const DS = ['terms', 'lunar', 'fortunes', 'yongsin', 'branch', 'stems', 'elements', 'strength', 'rhythm', 'zwstars', 'zwhua', 'zwpalaces'];
  let animated = false;

  dash.onData(() => {
    const p = dash.params();
    const L = lunarTable();
    const birth = resolveBirth(p, L);
    const terms = termTable();
    const hm = p.timeUnknown || !S.isTime(p.birthTime) ? null : p.birthTime;
    const bc = birth.solar ? S.birthClock(birth.solar, hm) : null;
    const pl = birth.solar && terms ? S.pillars(terms, bc.solar, bc.hm, bc.shift) : null;
    drawInputs(p, L, birth, pl, bc);

    const result = $('#sj-result'), empty = $('#sj-empty');
    const showEmpty = (...kids) => { result.hidden = true; empty.hidden = false; empty.replaceChildren(...kids); };
    const ready = !!birth.solar && !!p.profileDone;
    $('#datecard').hidden = !ready;

    if (!ready && birth.solar) {
      showEmpty('정보를 다 넣었으면 위의 완료를 눌러 주세요. 운세 볼 날짜와 오늘의 운세가 나타나요.');
      $('#sj-lead').textContent = '내 정보를 한 번 입력해 두면, 날짜만 골라 그날의 운세와 하루 리듬을 볼 수 있어요.';
      rhythmModel = null;
      return;
    }
    if (birth.none || birth.err || birth.pending) {
      drawDateCard(p, L, null);
      showEmpty(birth.pending ? '음력 달력을 불러오는 중이에요.' : '위의 내 정보에 생년월일을 입력하면 운세가 나타납니다.');
      $('#sj-lead').textContent = '내 정보를 한 번 입력해 두면, 날짜만 골라 그날의 운세와 하루 리듬을 볼 수 있어요.';
      rhythmModel = null;
      return;
    }
    const states = DS.map((id) => dash.data(id).status);
    if (states.some((s) => s === 'loading')) { drawDateCard(p, L, null); showEmpty(h('span', { class: 'dash-skeleton', style: 'display:inline-block;width:12rem' }, ' ')); return; }
    if (states.some((s) => s !== 'ok')) { drawDateCard(p, L, null); showEmpty(h('div', { class: 'sj-fail', text: 'Failed to load' })); return; }

    const data = {};
    DS.forEach((id) => { data[id] = dash.data(id).data; });
    lastData = data;
    if (!pl || !S.validDate(p.date)) { drawDateCard(p, L, null); showEmpty('계산할 수 없는 날짜예요. 1900년 이후 날짜를 입력해 주세요.'); return; }
    const a = S.analyze(pl);
    const du = S.daeun(terms, pl, p.gender);
    const dy = S.daily(a, terms, p.date, du);
    if (!dy) { drawDateCard(p, L, null); showEmpty('운세 날짜는 1901~2100년 사이로 골라 주세요.'); return; }

    const zw = buildZiwei(p, bc, L);
    const zwFor = (date, ddy) => {
      if (!zw) return null;
      const zd = zwDailyOf(zw.chart, L, date, ddy.stem);
      return zd ? { c: zw.chart, zd, scores: zwScores(zw.chart, zd, data) } : null;
    };
    const week = new Map();
    [-3, -2, -1, 0, 1, 2, 3].forEach((k) => {
      const d = S.addDays(p.date, k);
      const dd = S.daily(a, terms, d, du);
      if (!dd) return;
      const z = zwFor(d, dd);
      week.set(d, overallOf(mergeScores(categoryScores(dd, p, data), z ? z.scores : null)));
    });
    drawDateCard(p, L, week);

    result.hidden = false; empty.hidden = true;
    const sajuScores = categoryScores(dy, p, data);
    const zi = zwFor(p.date, dy);
    if (zi) zi.saju = sajuScores;
    const scores = mergeScores(sajuScores, zi ? zi.scores : null);
    const overall = overallOf(scores);
    rhythmModel = buildRhythm(p, a, dy, scores, zi, data);
    lastScores = scores;
    const remain = null;
    drawHero(p, dy, scores, overall, data, { saju: overallOf(sajuScores), zw: zi ? overallOf(zi.scores) : null }, remain);
    drawFortunes(p, dy, scores, data, zi, remain);
    drawAllRhythm();
    drawNatal(p, birth, pl, a, data, bc);
    drawDaeun(du, dy, a, data);
    drawZiwei(p, zw, zi ? zi.zd : null, zi ? overallOf(zi.scores) : null, data);

    if (!animated) {
      animated = true;
    }
  });


  /* 스크롤 등장: 카드가 화면에 들어올 때 한 번 아래에서 떠오른다 */
  (() => {
    if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const els = $$('.sj-card, .sj-empty');
    const io = new IntersectionObserver((entries) => {
      let n = 0;
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const el = en.target;
        io.unobserve(el);
        el.style.setProperty('--rv-d', `${Math.min(n++, 4) * 80}ms`);
        el.classList.add('sj-rv-in');
        // 끝나면 transform을 걷어 내 유리 블러가 그대로 보이게
        setTimeout(() => { el.classList.add('sj-rv-done'); el.classList.remove('sj-rv'); }, 1400);
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0 });
    els.forEach((el) => { el.classList.add('sj-rv'); io.observe(el); });
  })();
  /* 고정 메뉴: 지금 보고 있는 섹션을 표시하고, 메뉴 안에서 그 항목이 보이게 스크롤 */
  const navLinks = $$('.sj-result > .sj-nav a');
  const navTargets = navLinks.map((l) => document.getElementById(l.getAttribute('href').slice(1))).filter(Boolean);
  let navCur = null;
  const navUpdate = () => {
    const y = 110;
    let cur = null;
    navTargets.forEach((t) => { const r = t.getBoundingClientRect(); if (r.height && r.top - y <= 0) cur = t.id; });
    if (!cur && navTargets.length) cur = navTargets[0].id;
    if (cur === navCur) return;
    navCur = cur;
    navLinks.forEach((l) => {
      const on = l.getAttribute('href') === `#${cur}`;
      l.classList.toggle('on', on);
      if (on) { const nav = l.parentElement; const lx = l.offsetLeft - nav.clientWidth / 2 + l.clientWidth / 2; nav.scrollTo({ left: lx, behavior: 'smooth' }); }
    });
  };
  let navQ = false;
  document.addEventListener('scroll', () => { if (!navQ) { navQ = true; requestAnimationFrame(() => { navQ = false; navUpdate(); }); } }, { capture: true, passive: true });
  dash.onData(() => requestAnimationFrame(navUpdate));

  /* 스크롤에 따라 카드 테두리 회전: 카드가 화면 위로 한 화면 높이만큼 움직이면 한 바퀴 */
  const rimReduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let rimQueued = false;
  const rimUpdate = () => {
    rimQueued = false;
    const vh = window.innerHeight || 800;
    $$('.sj-card').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) return;
      const ang = `${Math.round((((r.top + r.height / 2) / vh) * 360) / 4) * 4}deg`; // 4도 단위로만 갱신해 다시 그리기 횟수를 줄임
      if (el.style.getPropertyValue('--rim-angle') !== ang) el.style.setProperty('--rim-angle', ang);
    });
  };
  window.sjRimUpdate = () => { if (!rimQueued) { rimQueued = true; requestAnimationFrame(rimUpdate); } };
  if (!rimReduce) {
    document.addEventListener('scroll', window.sjRimUpdate, { capture: true, passive: true });
    window.addEventListener('resize', window.sjRimUpdate);
    dash.onData(() => window.sjRimUpdate());
  }

  $$('.sj-nav a, #hero-minis').forEach((n) => n.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;
    const el = document.getElementById(link.getAttribute('href').slice(1));
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
})();
