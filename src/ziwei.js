/* 자미두수 명반 엔진: 음력 생년월일·시진·성별로 12궁, 14주성, 보좌·살성, 생년사화, 대한을 세우고
   운세 날짜의 유년·유월·유일 명궁과 유일사화를 계산한다. 지지 번호: 子0 丑1 寅2 … 亥11 */
(function (root) {
  const mod = (a, n) => ((a % n) + n) % n;
  const BR_K = '자축인묘진사오미신유술해', BR_H = '子丑寅卯辰巳午未申酉戌亥';
  const STEM_K = '갑을병정무기경신임계', STEM_H = '甲乙丙丁戊己庚辛壬癸';
  const MAIN = ['자미', '천기', '태양', '무곡', '천동', '염정', '천부', '태음', '탐랑', '거문', '천상', '천량', '칠살', '파군'];
  const AUX = ['좌보', '우필', '문창', '문곡', '천괴', '천월', '녹존', '경양', '타라', '화성', '영성', '지공', '지겁'];
  const PAL = ['명궁', '형제궁', '부처궁', '자녀궁', '재백궁', '질액궁', '천이궁', '교우궁', '관록궁', '전택궁', '복덕궁', '부모궁'];
  const HUA = ['화록', '화권', '화과', '화기'];
  const SIHUA = [
    ['염정', '파군', '무곡', '태양'], ['천기', '천량', '자미', '태음'], ['천동', '천기', '문창', '염정'],
    ['태음', '천동', '천기', '거문'], ['탐랑', '태음', '우필', '천기'], ['무곡', '탐랑', '천량', '문곡'],
    ['태양', '무곡', '태음', '천동'], ['거문', '태양', '문곡', '문창'], ['천량', '자미', '좌보', '무곡'],
    ['파군', '거문', '태음', '탐랑'],
  ];
  const NAYIN = '금화목토금화수토금목수토화목수'; // 60갑자 두 개씩, 15쌍 주기
  const JU = { 수: 2, 목: 3, 금: 4, 토: 5, 화: 6 };
  const JU_NAME = { 2: '수이국', 3: '목삼국', 4: '금사국', 5: '토오국', 6: '화육국' };
  const KUI = [1, 0, 11, 11, 1, 0, 1, 6, 3, 3], YUE = [7, 8, 9, 9, 7, 8, 7, 2, 5, 5];
  const LU = [2, 3, 5, 6, 5, 6, 8, 9, 11, 0];
  const MINGZHU = ['탐랑', '거문', '녹존', '문곡', '염정', '무곡', '파군', '무곡', '염정', '문곡', '녹존', '거문'];
  const SHENZHU = ['화성', '천상', '천량', '천동', '문창', '천기', '화성', '천상', '천량', '천동', '문창', '천기'];

  const sexagenary = (s, b) => { for (let i = 0; i < 60; i++) if (i % 10 === s && i % 12 === b) return i; return -1; };
  const effMonth = (m, d, leap) => (leap && d > 15 ? (m % 12) + 1 : m); // 윤달: 15일까지는 그 달, 16일부터 다음 달

  function chart({ y, m, d, leap, hb, gender }) {
    const month = effMonth(m, d, leap);
    const yStem = mod(y - 4, 10), yBranch = mod(y - 4, 12);
    const ming = mod(2 + (month - 1) - hb, 12);
    const shen = mod(2 + (month - 1) + hb, 12);
    const stemOf = (b) => mod((yStem % 5) * 2 + 2 + mod(b - 2, 12), 10);
    const mingGz = sexagenary(stemOf(ming), ming);
    const juEl = NAYIN[Math.floor(mingGz / 2) % 15];
    const ju = JU[juEl];
    let x = 0; while ((d + x) % ju !== 0) x++;
    const q = (d + x) / ju;
    const z = mod(q + 1 + (x % 2 ? -x : x), 12);
    const f = mod(4 - z, 12);
    const pos = {
      자미: z, 천기: mod(z - 1, 12), 태양: mod(z - 3, 12), 무곡: mod(z - 4, 12), 천동: mod(z - 5, 12), 염정: mod(z - 8, 12),
      천부: f, 태음: mod(f + 1, 12), 탐랑: mod(f + 2, 12), 거문: mod(f + 3, 12), 천상: mod(f + 4, 12), 천량: mod(f + 5, 12), 칠살: mod(f + 6, 12), 파군: mod(f + 10, 12),
      좌보: mod(4 + month - 1, 12), 우필: mod(10 - (month - 1), 12), 문창: mod(10 - hb, 12), 문곡: mod(4 + hb, 12),
      천괴: KUI[yStem], 천월: YUE[yStem], 녹존: LU[yStem], 경양: mod(LU[yStem] + 1, 12), 타라: mod(LU[yStem] - 1, 12),
      지공: mod(11 - hb, 12), 지겁: mod(11 + hb, 12),
    };
    const fireStart = [2, 6, 10].includes(yBranch) ? [1, 3] : [8, 0, 4].includes(yBranch) ? [2, 10] : [5, 9, 1].includes(yBranch) ? [3, 10] : [9, 10];
    pos.화성 = mod(fireStart[0] + hb, 12); pos.영성 = mod(fireStart[1] + hb, 12);
    const natalHua = {};
    SIHUA[yStem].forEach((s, i) => { natalHua[s] = i; });
    const yang = yStem % 2 === 0;
    const dir = (yang && gender !== '여') || (!yang && gender === '여') ? 1 : -1;
    const palaces = [];
    for (let b = 0; b < 12; b++) {
      const k = mod(ming - b, 12);
      const dk = mod((b - ming) * dir, 12);
      palaces.push({
        branch: b, stem: stemOf(b), name: PAL[k], k,
        main: MAIN.filter((s) => pos[s] === b), aux: AUX.filter((s) => pos[s] === b),
        limit: [ju + dk * 10, ju + dk * 10 + 9], isShen: b === shen,
      });
    }
    return {
      y, m: month, d, hb, gender, yStem, yBranch, ming, shen, ju, juName: JU_NAME[ju], pos, natalHua, palaces, dir,
      mingzhu: MINGZHU[ming], shenzhu: SHENZHU[yBranch],
      palaceOf: (k) => palaces[mod(ming - k, 12)],
    };
  }

  function daily(c, { y, m, d, leap, dayStem }) {
    const month = effMonth(m, d, leap);
    const yearP = mod(y - 4, 12);
    const doujun = mod(yearP - (c.m - 1) + c.hb, 12);
    const monthP = mod(doujun + month - 1, 12);
    const dayP = mod(monthP + d - 1, 12);
    const hua = SIHUA[dayStem].map((s, i) => ({ star: s, hua: i, pos: c.pos[s] }));
    const age = y - c.y + 1;
    const limitIdx = age >= c.ju ? Math.floor((age - c.ju) / 10) : -1;
    const limitP = limitIdx >= 0 ? mod(c.ming + c.dir * limitIdx, 12) : null;
    // 대한 사화(대한궁 천간)와 유년 사화(그해 천간)
    const limitHua = limitP === null ? [] : SIHUA[c.palaces[limitP].stem].map((s, i) => ({ star: s, hua: i, pos: c.pos[s], src: '대한' }));
    const yearHua = SIHUA[mod(y - 4, 10)].map((s, i) => ({ star: s, hua: i, pos: c.pos[s], src: '유년' }));
    return {
      yearP, monthP, dayP, hua, age, limitP, limitHua, yearHua,
      at: (k) => mod(dayP - k, 12), // 유일 기준 k번째 궁(0 명궁, 4 재백, 8 관록 …)의 지지
    };
  }

  root.Ziwei = { BR_K, BR_H, STEM_K, STEM_H, MAIN, AUX, PAL, HUA, SIHUA, chart, daily, effMonth };
})(typeof window !== 'undefined' ? window : globalThis);
