/* 배경 금화 4개 — WebGL 셰이더로 그린 금속 금화.
   - 금화마다 작은 WebGL 캔버스 하나. 광선과 원기둥의 교차로 앞면·뒷면·옆면을 찾고,
     미리 만든 노멀맵(돋을새김 테두리, 구슬 링, 홈, 각인 한자, 무광 질감)으로 표면 굴곡을 준다.
   - 금속 반사(프레넬)와 스튜디오 조명 환경(왼쪽 위 소프트박스, 오른쪽 주황 림 라이트)으로 색을 낸다.
   - 떠 있는 움직임은 CSS 애니메이션(재렌더 없음), 스크롤 회전은 각도가 바뀔 때만 다시 그린다. */
(() => {
  const host = document.getElementById('sj-coins');
  const root = document.querySelector('.sj');
  if (!host || !root) return;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 노멀맵(표면 굴곡) 만들기 ---------- */
  const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
  const vnoise = (x, y) => {
    const ix = Math.floor(x), iy = Math.floor(y); let fx = x - ix, fy = y - iy;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
  const fbm = (x, y) => { let s = 0, a = 0.5; for (let i = 0; i < 4; i++) { s += a * vnoise(x, y); x *= 2.03; y *= 2.03; a *= 0.5; } return s; };
  const ss = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

  function normalMap(glyph, N) {
    const gc = document.createElement('canvas'); gc.width = gc.height = N;
    const g = gc.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, N, N);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `800 ${Math.round(N * 0.5)}px "Noto Serif KR","Noto Serif CJK KR","Songti SC","Apple SD Gothic Neo",serif`;
    if ('filter' in g) g.filter = `blur(${Math.max(1, N / 220)}px)`;
    g.fillText(glyph, N / 2, N / 2 + N * 0.02);
    const gd = g.getImageData(0, 0, N, N).data;
    const H = new Float32Array(N * N);
    const BEADS = 72;
    for (let y = 0; y < N; y++) {
      const qy = ((y + 0.5) / N) * 2 - 1; // 행 0 = 아래(텍스처 v=0)
      for (let x = 0; x < N; x++) {
        const qx = ((x + 0.5) / N) * 2 - 1;
        const r = Math.hypot(qx, qy);
        let h = ss(0.862, 0.9, r) * 0.06; // 바깥 테두리 돋을새김
        h -= Math.exp(-(((r - 0.8) / 0.009) ** 2)) * 0.012; // 안쪽 홈
        const ang = Math.atan2(qy, qx);
        let a = (ang / (Math.PI * 2)) * BEADS; a = a - Math.floor(a) - 0.5;
        const bd = Math.hypot(a * (Math.PI * 2 / BEADS) * 0.835, r - 0.835);
        if (bd < 0.02) h += 0.028 * Math.cos((bd / 0.02) * Math.PI / 2) ** 2; // 구슬 장식
        if (r < 0.74) h += (gd[((N - 1 - y) * N + x) * 4] / 255) * 0.032; // 각인 글자
        h += (fbm(qx * 9 + 3, qy * 9) - 0.5) * 0.007 + (fbm(qx * 42, qy * 42 + 7) - 0.5) * 0.0028; // 무광 질감·잔 흠집
        H[y * N + x] = h;
      }
    }
    const out = new Uint8Array(N * N * 4);
    const st = 2 / N;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const i = y * N + x;
        const hx = (H[y * N + Math.min(N - 1, x + 1)] - H[y * N + Math.max(0, x - 1)]) / (2 * st);
        const hy = (H[Math.min(N - 1, y + 1) * N + x] - H[Math.max(0, y - 1) * N + x]) / (2 * st);
        let nx = -hx, ny = -hy, nz = 1;
        const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
        out[i * 4] = Math.round((nx * 0.5 + 0.5) * 255);
        out[i * 4 + 1] = Math.round((ny * 0.5 + 0.5) * 255);
        out[i * 4 + 2] = Math.round((nz * 0.5 + 0.5) * 255);
        out[i * 4 + 3] = Math.round(Math.max(0, Math.min(1, (H[i] + 0.02) / 0.09)) * 255);
      }
    }
    return out;
  }

  /* ---------- 셰이더 ---------- */
  const VS = 'attribute vec2 p;varying vec2 vUv;void main(){vUv=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
  const FS = `
precision highp float;
varying vec2 vUv;
uniform vec2 uRes; uniform float uR; uniform vec3 uRot; uniform sampler2D uNrm; uniform float uSS;
mat3 rY(float a){float c=cos(a),s=sin(a);return mat3(c,0.,-s,0.,1.,0.,s,0.,c);}
mat3 rX(float a){float c=cos(a),s=sin(a);return mat3(1.,0.,0.,0.,c,s,0.,-s,c);}
mat3 rZ(float a){float c=cos(a),s=sin(a);return mat3(c,s,0.,-s,c,0.,0.,0.,1.);}
vec3 env(vec3 d){
  float up=d.y*.5+.5;
  vec3 c=mix(vec3(.035,.022,.014),vec3(.26,.15,.065),up);
  vec3 k=normalize(vec3(-.55,.62,.56)); float kd=max(dot(d,k),0.);
  c+=vec3(3.1,2.7,2.1)*pow(kd,26.)+vec3(.85,.66,.44)*pow(kd,4.)*.7;
  vec3 o=normalize(vec3(.95,-.12,.28)); c+=vec3(1.55,.62,.2)*pow(max(dot(d,o),0.),5.);
  vec3 f=normalize(vec3(-.2,-.9,.4)); c+=vec3(.22,.11,.045)*pow(max(dot(d,f),0.),2.);
  return c;
}
vec4 shade(vec2 p){
  mat3 R=rZ(uRot.z)*rX(uRot.y)*rY(uRot.x);
  mat3 Ri=rY(-uRot.x)*rX(-uRot.y)*rZ(-uRot.z);
  vec3 ro=Ri*vec3(p,4.), rd=Ri*vec3(0.,0.,-1.);
  float TH=.085, tHit=1e9; float kind=0.;
  if(abs(rd.z)>1e-5){
    float t1=(TH-ro.z)/rd.z; vec3 q1=ro+rd*t1; if(t1>0.&&dot(q1.xy,q1.xy)<=1.){tHit=t1;kind=1.;}
    float t2=(-TH-ro.z)/rd.z; vec3 q2=ro+rd*t2; if(t2>0.&&t2<tHit&&dot(q2.xy,q2.xy)<=1.){tHit=t2;kind=2.;}
  }
  float A=dot(rd.xy,rd.xy);
  if(A>1e-6){float B=dot(ro.xy,rd.xy),C=dot(ro.xy,ro.xy)-1.,D=B*B-A*C;
    if(D>0.){float t=(-B-sqrt(D))/A; vec3 q=ro+rd*t; if(t>0.&&t<tHit&&abs(q.z)<=TH){tHit=t;kind=3.;}}}
  if(kind<.5) return vec4(0.);
  vec3 q=ro+rd*tHit; vec3 nl; float ao=1.;
  if(kind<2.5){
    float sg=kind<1.5?1.:-1.;
    vec2 uv=q.xy*.5+.5; if(sg<0.) uv.x=1.-uv.x;
    vec4 t=texture2D(uNrm,uv);
    nl=normalize(t.rgb*2.-1.); if(sg<0.){nl.x=-nl.x; nl.z=-nl.z;}
    ao=.7+.3*t.a;
    float r=length(q.xy);
    nl=normalize(mix(nl,vec3(q.xy/max(r,1e-4),.3*sg),smoothstep(.955,1.,r)*.9));
  } else {
    float ph=atan(q.y,q.x); vec3 rad=vec3(cos(ph),sin(ph),0.), tg=vec3(-sin(ph),cos(ph),0.);
    float rd2=sin(ph*170.);
    nl=normalize(rad+tg*rd2*.32+vec3(0.,0.,1.)*smoothstep(TH*.5,TH,abs(q.z))*sign(q.z)*.9);
    ao=.78+.22*(rd2*.5+.5);
  }
  vec3 n=R*nl, v=vec3(0.,0.,1.);
  vec3 F0=vec3(1.,.74,.32);
  float ndv=max(dot(n,v),0.);
  vec3 F=F0+(1.-F0)*pow(1.-ndv,5.);
  vec3 rf=reflect(-v,n);
  vec3 a1=normalize(cross(rf,vec3(.001,1.,.002))); vec3 a2=cross(rf,a1);
  float rg=.3;
  vec3 spec=env(rf)*.36+(env(normalize(rf+a1*rg))+env(normalize(rf-a1*rg))+env(normalize(rf+a2*rg))+env(normalize(rf-a2*rg)))*.16;
  vec3 col=F*spec*ao+F0*env(n)*.05*ao;
  col=(col*(2.51*col+.03))/(col*(2.43*col+.59)+.14);
  col=pow(clamp(col,0.,1.),vec3(1./2.2));
  return vec4(col,1.);
}
void main(){
  vec2 frag=vUv*uRes; vec4 acc=vec4(0.);
  if(uSS>1.5){
    for(int i=0;i<2;i++)for(int j=0;j<2;j++){vec2 o=(vec2(float(i),float(j))-.5)*.5; acc+=shade((frag+o-uRes*.5)/uR);}
    acc*=.25;
  } else acc=shade((frag-uRes*.5)/uR);
  vec2 p=(frag-uRes*.5)/uR;
  float d=length(p-vec2(.13,-.2));
  float sh=.45*smoothstep(1.32,.5,d)*(1.-acc.a);
  gl_FragColor=vec4(acc.rgb,acc.a+sh);
}`;

  function makeGL(canvas, nrm, N) {
    const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) return null;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
    const vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return null;
    const pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
    gl.useProgram(pr);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, N, N, 0, gl.RGBA, gl.UNSIGNED_BYTE, nrm);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const u = (n) => gl.getUniformLocation(pr, n);
    return { gl, uRes: u('uRes'), uR: u('uR'), uRot: u('uRot'), uSS: u('uSS'), uNrm: u('uNrm') };
  }

  /* ---------- 금화 배치 ---------- */
  // [가로, 세로(화면 비율), 크기 배율, 기본 회전(좌우), 깊이 흐림(px), 글자, 위상]
  const SPEC = [[0.95, 0.42, 1, -0.6, 0, '財', 0], [0.03, 0.74, 0.58, 0.55, 1, '福', 1.7], [0.2, 0.12, 0.32, -0.4, 3, '祿', 3.1], [0.75, 0.92, 0.2, 0.7, 5, '金', 4.4]];
  const SPEC_SMALL = [[1.0, 0.36, 1, -0.6, 0, '財', 0], [0.0, 0.72, 0.58, 0.55, 1, '福', 1.7], [0.22, 0.1, 0.32, -0.4, 3, '祿', 3.1], [0.8, 0.92, 0.2, 0.7, 4, '金', 4.4]];
  const maps = {};
  // 스크롤 대비 이동 속도: 본문(1)과 일부러 어긋나게. 대·중은 빠르게, 소·극소는 느리게 흘러 시차가 생김
  const PARALLAX = [0.55, 1.35, 0.25, 0.12];
  function placeAll() {
    const s = scrolled();
    const Hh = host.clientHeight || window.innerHeight;
    coins.forEach((c) => {
      let y = c.y0 - (reduce ? 0 : s * c.speed);
      // 한 번 지나간 금화는 다시 나타나지 않는다(반복 없음)
      c.outer.style.visibility = y < -c.size || y > Hh ? 'hidden' : '';
      c.outer.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
    });
  }
  let placeQueued = false;
  const queuePlace = () => { if (!placeQueued) { placeQueued = true; requestAnimationFrame(() => { placeQueued = false; placeAll(); }); } };
  let coins = [];

  function build() {
    host.replaceChildren();
    const W = host.clientWidth || window.innerWidth, H = host.clientHeight || window.innerHeight;
    const small = W < 640;
    const base = small ? Math.min(W * 0.28, H * 0.14) : Math.min(W * 0.12, H * 0.19); // 이전의 약 70% 크기
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    coins = (small ? SPEC_SMALL : SPEC).map(([x, y, k, a, blur, glyph, ph], i) => {
      const r = base * k, size = Math.ceil(r * 2.7);
      const wrap = document.createElement('div');
      wrap.className = 'sj-coin';
      wrap.style.cssText = `width:${size}px;height:${size}px;${blur ? `filter:blur(${blur}px);` : ''}animation-duration:${6 + i * 1.3}s;animation-delay:${-ph}s`;
      // 바깥 층: 스크롤 시차 이동(JS), 안쪽 층: 떠 있는 흔들림(CSS)
      const outer = document.createElement('div');
      outer.className = 'sj-coin-p';
      outer.style.cssText = `left:${x * W - size / 2}px;top:0;width:${size}px;height:${size}px`;
      const cv = document.createElement('canvas');
      cv.width = Math.round(size * dpr); cv.height = Math.round(size * dpr);
      wrap.append(cv); outer.append(wrap); host.append(outer);
      const N = k === 1 ? 384 : 256;
      return { g: null, cv, outer, size, y0: y * H - size / 2, speed: PARALLAX[i], glyph, N, r: r * dpr, a0: a, a, target: a, ph, pitch: 0.14 * (i % 2 ? -1 : 1), roll: -0.12 + i * 0.05, dirty: true };
    });
  }
  // 노멀맵 계산이 무거워 금화 하나씩 나눠 준비(첫 화면을 막지 않도록)
  function prepare(i, gen) {
    if (gen !== buildGen || i >= coins.length) return;
    const c = coins[i];
    const key = `${c.glyph}${c.N}`;
    if (!maps[key]) maps[key] = normalMap(c.glyph, c.N);
    c.g = makeGL(c.cv, maps[key], c.N);
    if (c.g) { updateTargets(); c.a = c.target; render(c, 2); c.dirty = false; }
    setTimeout(() => prepare(i + 1, gen), 16);
  }
  let buildGen = 0;

  function render(c, ss) {
    const { gl } = c.g;
    gl.viewport(0, 0, c.cv.width, c.cv.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(c.g.uRes, c.cv.width, c.cv.height);
    gl.uniform1f(c.g.uR, c.r);
    gl.uniform3f(c.g.uRot, c.a, c.pitch, c.roll);
    gl.uniform1f(c.g.uSS, ss);
    gl.uniform1i(c.g.uNrm, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  const scrolled = () => Math.max(0, -root.getBoundingClientRect().top);
  function updateTargets() {
    const s = scrolled();
    coins.forEach((c, i) => { c.target = c.a0 + 0.36 * Math.sin(s / 1040 + c.ph) * (i % 2 ? -1 : 1); /* 스크롤 1040px마다 한 주기(이전의 절반 속도) */ });
  }

  let running = false, idle = 0;
  function frame() {
    if (!host.isConnected) { running = false; return; }
    let moving = false;
    coins.forEach((c) => {
      if (!c.g) return;
      const d = c.target - c.a;
      if (Math.abs(d) > 0.0008) { c.a += d * 0.14; moving = true; render(c, 1); c.dirty = true; }
    });
    if (moving) { idle = 0; requestAnimationFrame(frame); return; }
    // 멈추면 한 번 고화질(4배 샘플)로 다시 그리고 쉼
    coins.forEach((c) => { if (c.g && c.dirty) { render(c, 2); c.dirty = false; } });
    running = false;
  }
  function kick() { if (!running) { running = true; requestAnimationFrame(frame); } }

  function init() {
    build();
    placeAll();
    buildGen += 1;
    const gen = buildGen;
    setTimeout(() => prepare(0, gen), 30);
  }
  init();
  let rt = 0;
  window.addEventListener('resize', () => { if (!host.isConnected) return; clearTimeout(rt); rt = setTimeout(init, 200); });
  document.addEventListener('scroll', () => { if (!host.isConnected) return; queuePlace(); updateTargets(); if (reduce) { coins.forEach((c) => { if (c.g) { c.a = c.target; render(c, 2); } }); } else kick(); }, { capture: true, passive: true });
})();
