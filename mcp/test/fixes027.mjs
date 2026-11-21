/* Rocket Launcher 0.2.7 unit checks for T-FLOW field reports on 0.2.6:
   (1) a privacy URL that answers HEAD 401 / GET 200 is reachable, not dead;
   (2) 401/403 after GET is unverified (미확인), not a hard failure, and policy content is not reported as "missing";
   (3) rocketlauncher.json default_language wins over values/strings.xml mapped to English;
   (4) CAMERA and RECORD_AUDIO appear in the Data safety draft.
   Local fixtures + a 127.0.0.1 server; one optional live check of the T-FLOW worker URL (skipped on network failure).
   Run: node test/fixes027.mjs */
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import http from 'node:http';

const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'rocketlauncher-027-'));
process.env.ROCKETLAUNCHER_HOME = HOME;
process.env.ROCKETLAUNCHER_LESSONS_API = 'http://127.0.0.1:9/api/lessons';
process.env.ROCKETLAUNCHER_VERIFY_URLS = '0';
const E = await import('../lib/engine.mjs');

let pass = 0, failN = 0;
const check = (c, name, extra) => { if (c) { pass++; console.log('  ✓', name); } else { failN++; console.log('  ✗', name, extra !== undefined ? JSON.stringify(extra).slice(0, 700) : ''); } };
const ids = st => (st.A.issues || []).map(i => i.id);
const field = (rows, id) => (rows || []).find(r => r.id === id);

let n = 0;
function project(files) {
  const dir = path.join(HOME, 'fx-' + (++n));
  for (const [p, c] of Object.entries(files)) { if (c == null) continue; const f = path.join(dir, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, c); }
  return dir;
}
const MANIFEST = (extraPerms = '') => `<manifest xmlns:android="http://schemas.android.com/apk/res/android"><uses-permission android:name="android.permission.INTERNET"/>${extraPerms}<application android:label="@string/app_name" android:icon="@mipmap/ic_launcher"><activity android:name=".MainActivity" android:exported="true"/></application></manifest>`;
const GRADLE = () => `plugins { id 'com.android.application' }\nandroid { namespace "com.example.fx"\n defaultConfig { applicationId "com.example.fx"\n minSdk 24\n targetSdk 36\n versionCode 1\n versionName "1.0.0" } }\ndependencies { implementation "com.google.firebase:firebase-auth:22.3.0" }\n`;
const STRINGS = '<?xml version="1.0" encoding="utf-8"?><resources><string name="app_name">ShiftNote</string></resources>';
const base = (more = {}, perms = '') => ({
  'app/src/main/AndroidManifest.xml': MANIFEST(perms),
  'app/build.gradle': GRADLE(),
  'app/src/main/res/values/strings.xml': STRINGS,
  'README.md': '# Fixture\n\nA small staff utility.\n',
  ...more
});
const connect = async (files, extra = {}) => E.connect({ source: 'path', path: project(files), lang: 'en', ...extra }, { allowPath: true });

function serve(handler) {
  const srv = http.createServer(handler);
  return new Promise(res => srv.listen(0, '127.0.0.1', () => res(srv)));
}

console.log('\n[1] privacy URL: HEAD 401 / GET 200 is reachable; 401/403 after GET is unverified; content findings follow what was actually read');
const POLICY_OK = '<!doctype html><html lang="ko"><body><h1>개인정보처리방침</h1><h2>보관과 삭제</h2><p>계정 정보는 삭제 요청 후 30일 이내에 지웁니다. 보관 기간은 회원 탈퇴 시까지입니다.</p></body></html>';
const POLICY_BARE = '<!doctype html><html><body><h1>Privacy</h1><p>We care about your data.</p></body></html>';

const srv = await serve((q, r) => {
  const u = q.url || '/';
  if (q.method === 'HEAD') {
    /* T-FLOW worker behaviour: HEAD is rejected with 401, GET of the same path is 200. */
    if (/^\/(privacy|bare|blocked)(\?|$)/.test(u)) { r.statusCode = 401; r.setHeader('Content-Type', 'application/json'); r.end(); return; }
    if (/^\/missing(\?|$)/.test(u)) { r.statusCode = 404; r.end(); return; }
    r.statusCode = 200; r.end(); return;
  }
  if (/^\/privacy(\?|$)/.test(u)) { r.statusCode = 200; r.setHeader('Content-Type', 'text/html; charset=utf-8'); r.end(POLICY_OK); return; }
  if (/^\/bare(\?|$)/.test(u)) { r.statusCode = 200; r.setHeader('Content-Type', 'text/html; charset=utf-8'); r.end(POLICY_BARE); return; }
  if (/^\/blocked(\?|$)/.test(u)) { r.statusCode = 401; r.setHeader('Content-Type', 'application/json'); r.end('{"err":"no"}'); return; }
  if (/^\/missing(\?|$)/.test(u)) { r.statusCode = 404; r.end('no'); return; }
  r.statusCode = 200; r.end('ok');
});
const port = srv.address().port;
process.env.ROCKETLAUNCHER_VERIFY_URLS = '1';

let { st, report } = await connect(base({ 'rocketlauncher.json': JSON.stringify({ privacy_url: `http://127.0.0.1:${port}/privacy`, login_required: true }) }));
check(!ids(st).includes('privacyUrlDead') && !ids(st).includes('privacyUrlUnverified') && !report.app.privacy_url_warning, 'HEAD 401 + GET 200 → reachable, no dead/unverified warning', { issues: ids(st), warn: report.app.privacy_url_warning, cand: report.app.privacy_url_candidates, fetched: st.A.listing && st.A.listing.privacyFetched });
check(st.A.listing && st.A.listing.privacyFetched && /보관|삭제|retention|delet/i.test(st.A.listing.privacyBody || ''), 'GET body is stored for policy content checks', (st.A.listing && (st.A.listing.privacyBody || '')).slice(0, 200));
let del = await E.release('deletion', st.id, {}, 'en');
let ret = field(del.rows, 'retention');
check(ret && ret.severity === 'ok' && /mentions deletion or retention/i.test(ret.finding || ''), 'retention is ok when the fetched page talks about 보관/삭제', ret);

({ st, report } = await connect(base({ 'rocketlauncher.json': JSON.stringify({ privacy_url: `http://127.0.0.1:${port}/bare`, login_required: true }) })));
del = await E.release('deletion', st.id, {}, 'en');
ret = field(del.rows, 'retention');
check(st.A.listing && st.A.listing.privacyFetched && ret && ret.severity === 'warn' && /Not found in the privacy policy/i.test(ret.finding || ''), 'page was read and has no retention section → "not found" is a real content finding', ret);

({ st, report } = await connect(base({ 'rocketlauncher.json': JSON.stringify({ privacy_url: `http://127.0.0.1:${port}/blocked`, login_required: true }) })));
check(ids(st).includes('privacyUrlUnverified') && !ids(st).includes('privacyUrlDead'), 'HEAD 401 + GET 401 → unverified (미확인), not a dead page', { issues: ids(st), warn: report.app.privacy_url_warning, cand: report.app.privacy_url_candidates });
check(/미확인|could not be verified/i.test(report.app.privacy_url_warning || ''), 'warning says the URL could not be verified', report.app.privacy_url_warning);
del = await E.release('deletion', st.id, {}, 'en');
ret = field(del.rows, 'retention');
check(ret && ret.severity === 'check' && /미확인|could not verify/i.test(ret.finding || '') && !/Not found in the privacy policy/i.test(ret.finding || ''), 'unread policy → retention is unverified, not "missing"', ret);

({ st, report } = await connect(base({ 'rocketlauncher.json': JSON.stringify({ privacy_url: `http://127.0.0.1:${port}/missing` }) })));
check(ids(st).includes('privacyUrlDead') && !ids(st).includes('privacyUrlUnverified') && report.app.privacy_url_candidates[0].http_status === 404, 'GET 404 → still a dead page', report.app);

process.env.ROCKETLAUNCHER_VERIFY_URLS = '0';
({ st } = await connect(base({ 'rocketlauncher.json': JSON.stringify({ privacy_url: `http://127.0.0.1:${port}/privacy`, login_required: true }) })));
del = await E.release('deletion', st.id, {}, 'en');
ret = field(del.rows, 'retention');
check(ret && ret.severity === 'check' && /미확인|could not verify/i.test(ret.finding || ''), 'URL verification off and no local policy file → retention unverified, not "missing"', ret);
srv.close();

console.log('\n[2] default_language in rocketlauncher.json wins over default strings.xml mapped to English');
({ st, report } = await connect(base({ 'rocketlauncher.json': JSON.stringify({ default_language: 'ko-KR', category: 'Business' }) })));
check(report.app.default_language === 'ko', 'report.app.default_language is ko from config', report.app.default_language);
check((st.A.locales || []).includes('ko') && JSON.stringify(st.A.locales) !== JSON.stringify(['en']), 'languages_in_app includes ko, not English-only from values/strings.xml', st.A.locales);
const recLangs = (E.decisions(st, 'en').decisions.find(d => d.key === 'langs') || {}).recommended;
check(JSON.stringify(recLangs) === '["ko"]', 'store language recommendation is Korean only', recLangs);

console.log('\n[3] Data safety draft includes CAMERA and RECORD_AUDIO');
({ st } = await connect(base({}, '<uses-permission android:name="android.permission.CAMERA"/><uses-permission android:name="android.permission.RECORD_AUDIO"/>')));
const pv = await E.release('privacy', st.id, {}, 'en');
const dsIds = ((pv.drafts && pv.drafts.data_safety && pv.drafts.data_safety.rows) || []).map(r => r.id);
const photos = (pv.drafts.data_safety.rows || []).find(r => r.id === 'photos');
const audio = (pv.drafts.data_safety.rows || []).find(r => r.id === 'audio');
check(dsIds.includes('photos') && dsIds.includes('audio'), 'draft rows include photos and audio', dsIds);
check(photos && /Photos and videos/.test(photos.playType) && /Photos/.test(photos.playType), 'CAMERA → Play "Photos and videos › Photos"', photos);
check(audio && /Audio files/.test(audio.playType) && /Voice or sound recordings/.test(audio.playType), 'RECORD_AUDIO → Play "Audio files › Voice or sound recordings"', audio);

console.log('\n[4] unverified issue texts exist in all five languages');
const I18N = globalThis.window.RL_I18N;
check(['en', 'ko', 'th', 'zh', 'hi'].every(l => I18N[l]['iss.privacyUrlUnverified.t'] && I18N[l]['iss.privacyUrlUnverified.w']), 'iss.privacyUrlUnverified in en/ko/th/zh/hi');

console.log('\n[5] live T-FLOW privacy URL (optional; skipped if the worker is unreachable)');
process.env.ROCKETLAUNCHER_VERIFY_URLS = '1';
const LIVE = 'https://tflow-api.prezentree.workers.dev/privacy';
try {
  const head = await fetch(LIVE, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'Rocket-Launcher-link-check' } });
  const got = await fetch(LIVE, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36', Accept: 'text/html' } });
  check(head.status === 401 && got.status === 200, 'live worker still answers HEAD 401 and GET 200 (the 0.2.6 false-positive shape)', { head: head.status, get: got.status });
  ({ st, report } = await connect(base({ 'rocketlauncher.json': JSON.stringify({ privacy_url: LIVE, login_required: true }) })));
  check(!ids(st).includes('privacyUrlDead') && !ids(st).includes('privacyUrlUnverified') && st.A.listing.privacyFetched, 'live URL through the real verify path is reachable and the body is read', { issues: ids(st), warn: report.app.privacy_url_warning, status: st.A.listing && (st.A.listing.privacyCandidates || []).map(c => c.check) });
  del = await E.release('deletion', st.id, {}, 'en');
  ret = field(del.rows, 'retention');
  check(ret && ret.severity === 'ok', 'live T-FLOW policy (보관/삭제) → retention ok, not missing', ret);
} catch (e) {
  console.log('  - skipped live T-FLOW URL check:', e.message);
}

process.env.ROCKETLAUNCHER_VERIFY_URLS = '0';
console.log(`\n${pass} passed, ${failN} failed`);
fs.rmSync(HOME, { recursive: true, force: true });
process.exit(failN ? 1 : 0);
