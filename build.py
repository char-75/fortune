"""src/ 조각을 합쳐 index.html 한 파일로 만든다: python3 build.py"""
import json, pathlib
S = pathlib.Path(__file__).parent / 'src'
r = lambda n: (S / n).read_text(encoding='utf-8')
data = json.dumps(json.loads(r('data.json')), ensure_ascii=False, separators=(',', ':'))
out = (r('page.html') + f'<script type="application/json" id="sj-data">{data}</script>\n'
       '<script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js"></script>\n'
       '<script>\n' + r('shim.js') + '</script>\n'
       + ''.join(f'<script>{r(n)}</script>\n' for n in ['saju.js', 'ziwei.js', 'app.js', 'coins.js'])
       + r('tail.html'))
(S.parent / 'index.html').write_text(out, encoding='utf-8')
print('built', len(out.encode()), 'bytes')
