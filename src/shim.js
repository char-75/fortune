/* 대시보드 API 대신 쓰는 작은 어댑터: 데이터는 페이지에 내장, 입력값은 이 브라우저에만 저장 */
/* 열 때는 항상 맨 위에서: 주소의 #섹션과 브라우저의 스크롤 복원을 쓰지 않는다 (카톡 인앱 브라우저 등) */
try { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; } catch (e) { /* 무시 */ }
if (location.hash) { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* 무시 */ } }
window.dash = (() => {
  const DATA = JSON.parse(document.getElementById('sj-data').textContent);
  const DEFAULTS = { profileDone: false, dateAt: null, birth: null, birthCal: 'solar', birthLeap: false, birthTime: null, timeUnknown: false, gender: '남', date: null,
    rhythmDate: null, rhythm: [], rhythmMoney: [], rhythmStock: [], rhythmExam: [], rhythmLove: [], rhythmWork: [], wake: '07:00', sleep: '23:30' };
  const KEY = 'todays-fortune-v1';
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { saved = {}; }
  const RESET_MS = 30 * 60 * 1000; // 고른 날짜는 30분 뒤 오늘로 초기화
  const today = () => { const d = new Date(); const z = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };
  if (!(saved.date && saved.dateAt && Date.now() - saved.dateAt < RESET_MS)) { delete saved.date; delete saved.dateAt; }
  if (saved.birth && saved.profileDone === undefined) saved.profileDone = true; // 예전에 저장한 정보는 입력 완료로 본다
  let params = { ...DEFAULTS, ...saved };
  const subs = [];
  let queued = false;
  const fire = () => { queued = false; subs.forEach((f) => { try { f(); } catch (e) { console.error(e); } }); };
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(fire); } };
  let lastW = window.innerWidth;
  window.addEventListener('resize', () => { if (Math.abs(window.innerWidth - lastW) > 2) { lastW = window.innerWidth; queue(); } });
  return {
    data: (id) => (DATA[id] ? { status: 'ok', data: DATA[id], refreshing: false, meta: [] } : { status: 'missing', data: [] }),
    params: () => params,
    setParams(o) {
      if ('date' in o && o.date !== params.date) o = { ...o, dateAt: o.date && o.date !== today() ? Date.now() : null };
      params = { ...params, ...o };
      try { localStorage.setItem(KEY, JSON.stringify(params)); } catch (e) { /* 저장 불가 환경 */ }
      queue();
    },
    resetDateIfStale() {
      const t = today();
      const stale = params.dateAt ? Date.now() - params.dateAt >= RESET_MS : params.date && params.date !== t;
      if (stale && params.date !== t) this.setParams({ date: t });
      else if (stale) { params = { ...params, dateAt: null }; }
    },
    resetParams() { params = { ...DEFAULTS }; queue(); },
    onData(f) { subs.push(f); try { f(); } catch (e) { console.error(e); } },
    colors: ['#e9bd52', '#e9bd52', '#e9bd52', '#e9bd52', '#e9bd52', '#e9bd52', '#e9bd52', '#e9bd52'],
    setLink(name) { try { history.replaceState(null, '', '#' + name); } catch (e) { /* 무시 */ } },
    refresh() {},
  };
})();
