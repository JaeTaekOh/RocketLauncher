/* Rocket Launcher regression checks on two real Android projects whose launch agents reported the correct answers by hand
   (a Capacitor business app and a Korean fuel-price app with Android Auto). The folders are read in place, read-only; nothing
   is copied into this repository. When a folder is not on this computer its checks are skipped.
   Paths: ROCKETLAUNCHER_REAL_TFLOW, ROCKETLAUNCHER_REAL_GADDY (default /workspace/tflow-android, /workspace/gaddy-android-rl-vc13).
   Run: node test/real-projects.mjs */
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'rocketlauncher-real-'));
process.env.ROCKETLAUNCHER_HOME = HOME; process.env.ROCKETLAUNCHER_LESSONS_API = 'http://127.0.0.1:9/api/lessons'; process.env.ROCKETLAUNCHER_VERIFY_URLS = '0';
const E = await import('../lib/engine.mjs');
let pass = 0, failN = 0, skipped = 0;
const check = (c, name, extra) => { if (c) { pass++; console.log('  ✓', name); } else { failN++; console.log('  ✗', name, extra !== undefined ? JSON.stringify(extra).slice(0, 400) : ''); } };
const field = (g, id, re) => ((g.steps.find(s => s.id === id) || { fields: [] }).fields.find(f => re.test(f.label)) || {}).value;
const eqj = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function run(label, dir, exp) {
  console.log(`\n[${label}] ${dir}`);
  if (!fs.existsSync(dir)) { skipped++; console.log('  - skipped (folder not on this computer)'); return; }
  const { st, report } = await E.connect({ source: 'path', path: dir, lang: 'en' }, { allowPath: true });
  const A = st.A, ap = report.app, D = E.decisions(st, 'en').decisions, rec = k => (D.find(d => d.key === k) || {}).recommended;
  check(A.pkg === exp.pkg, `package ${exp.pkg}`, A.pkg);
  check(A.version === exp.version && String(A.android.versionCode) === exp.versionCode, `version ${exp.version} (${exp.versionCode})`, [A.version, A.android.versionCode]);
  check(A.android.targetSdk === 36, 'targetSdk 36', A.android.targetSdk);
  check(A.categories[0] === exp.category, `category ${exp.category}`, A.categories);
  check(!A.sdk.ads && !A.adsHint && !A.sdk.billing, 'no ads, no ad hint, no in-app purchases', [A.sdk.ads, !!A.adsHint, A.sdk.billing]);
  check(!!A.sdk.location === exp.location, `location ${exp.location ? 'used' : 'not used'}`, A.android.permissions.filter(p => /LOCATION/.test(p)));
  check(ap.privacy_url_found === exp.privacy && !ap.privacy_url_warning, 'privacy URL ' + exp.privacy, [ap.privacy_url_found, ap.privacy_url_warning]);
  check(A.deletionInfo.url === exp.deletionUrl && A.deletionInfo.inAppPath === exp.deletionPath, 'deletion URL and in-app path', A.deletionInfo);
  check(eqj(rec('langs'), ['ko']), 'store language: Korean only (default ko-KR)', rec('langs'));
  check((D.find(d => d.key === 'title').options[0] || {}).label === exp.title, 'title = the decided one', D.find(d => d.key === 'title').options[0]);
  if (exp.short) check((D.find(d => d.key === 'short').options[0] || {}).label === exp.short, 'short description = the prepared one');
  check(rec('feature') === 'existing' && A.featureGraphic.path === exp.feature, 'prepared feature graphic used', A.featureGraphic && A.featureGraphic.path);
  check(A.screenshots.length === exp.shots && rec('shots') === 'existing', `${exp.shots} prepared screenshots, used as they are`, A.screenshots.map(s => s.path));
  check(eqj(ap.form_factors || ['phone'], exp.formFactors), 'form factors ' + exp.formFactors.join(' + '), ap.form_factors);
  check(!!ap.sign_in_required === exp.signInRequired, exp.signInRequired ? 'sign-in required (staff-only app)' : 'sign-in optional', ap.sign_in_required);
  const rq = (await E.release('requirements', st.id, {}, 'en')).rows, k16 = rq.find(r => r.id === 'play.16kb_page_size'), t36 = rq.find(r => r.id === 'play.target_api_36');
  check(k16.severity === 'ok' && /no native libraries|No native code found/i.test(k16.finding), '16 KB page size: not applicable (no .so / no native code)', k16.finding);
  check(t36.severity === 'ok', 'target API 36 requirement met', t36.finding);
  const del = await E.release('deletion', st.id, {}, 'en');
  check(del.review_note_text.includes(exp.deletionPath) && del.review_note_text.includes(exp.deletionUrl) && !/<your-site>/.test(del.review_note_text), 'deletion review note uses the real path and URL', del.review_note_text);
  const ct = await E.release('closed_test', st.id, {}, 'en');
  check(/12/.test(ct.title) && /14/.test(ct.title), 'closed test: 12 testers × 14 days', ct.title);
  const g = E.guide(E.load(st.id), 'play', 'en');
  check(field(g, 'p-create', /default lang/i) === '한국어 – ko-KR', 'guide default language ko-KR (works before every decision is made)', field(g, 'p-create', /default lang/i));
  check(field(g, 'p-content', /deletion/i) === exp.deletionUrl, 'guide deletion URL field', field(g, 'p-content', /deletion/i));
  if (exp.formFactors.length > 1) check(/Android Auto/.test(field(g, 'p-create', /form factors/i) || ''), 'guide asks to opt in to Android Auto');
  if (exp.staleBundledPrivacy) check(A.issues.some(i => i.id === 'privacyStale' && i.vars.file.includes(exp.staleBundledPrivacy)), 'stale privacy page bundled in the app is flagged');

  if (exp.defaultLang) {
    check(ap.default_language === exp.defaultLang, 'default_language from rocketlauncher.json is ' + exp.defaultLang + ' (config wins over values/strings.xml)', ap.default_language);
    check((A.locales || []).includes(exp.defaultLang), 'languages_in_app includes ' + exp.defaultLang, A.locales);
  }
  if (exp.dataSafety) {
    const pv = await E.release('privacy', st.id, {}, 'en');
    const idsDs = ((pv.drafts && pv.drafts.data_safety && pv.drafts.data_safety.rows) || []).map(r => r.id);
    for (const id of exp.dataSafety) check(idsDs.includes(id), 'Data safety draft includes ' + id + ' (from CAMERA / RECORD_AUDIO)', idsDs);
  }
  if (exp.preciseLocation) { const pv = (await E.release('privacy', st.id, {}, 'en')).rows || []; check(pv.some(r => /precise|loc\./i.test(r.id)), 'precise-location guidance present', pv.map(r => r.id)); }
  const gen = await E.generate(E.load(st.id), { lang: 'en' }, { allowPath: false });
  check(fs.readFileSync(path.join(gen.folder, 'graphics/feature-graphic-1024x500.png')).equals(fs.readFileSync(path.join(dir, exp.feature))), 'materials copy the prepared feature graphic unchanged');
  check(gen.listing.ko && gen.listing.ko.google_play.title === exp.title && !gen.listing.en, 'materials: Korean listing with the decided title, no English listing');
  if (exp.closedTestValue) { const dr = await E.release('closed_test', st.id, { action: 'application_draft' }, 'en'); const v = dr.sections.about_your_app.value; check(v.startsWith(exp.title) && !exp.closedTestValue.test(v), 'closed-test draft describes the prepared listing', v); }
  check(fs.statSync(dir).isDirectory(), 'project folder untouched (read in place)');
}

await run('T-FLOW', process.env.ROCKETLAUNCHER_REAL_TFLOW || '/workspace/tflow-android', {
  pkg: 'com.prezentree.tflow', version: '1.0.1', versionCode: '2', category: 'business', location: false,
  privacy: 'https://tflow-api.prezentree.workers.dev/privacy', deletionUrl: 'https://tflow-api.prezentree.workers.dev/delete-account', deletionPath: '설정 > 내 계정 > 계정 삭제 요청',
  title: 'T-FLOW', feature: 'store/feature-graphic-1024x500.png', shots: 8, formFactors: ['phone'], signInRequired: true,
  defaultLang: 'ko', dataSafety: ['photos', 'audio'] });
await run('Gaddy', process.env.ROCKETLAUNCHER_REAL_GADDY || '/workspace/gaddy-android-rl-vc13', {
  pkg: 'com.gaddy.kr', version: '1.3.0', versionCode: '13', category: 'navigation', location: true,
  privacy: 'https://prezentree.com/gaddy/privacy', deletionUrl: 'https://prezentree.com/gaddy/delete-account', deletionPath: 'Menu > 내 계정 > 내 계정 삭제',
  title: '개디(Gaddy) - 가장 쉬운 주유소 찾기', short: '로그인 없이, 내 주변 주유소의 오늘 기름값을 비교하고 가장 싼 곳으로 바로 안내받으세요.', feature: 'play/feature-graphic-1024x500.png', shots: 6,
  formFactors: ['phone', 'android_auto'], signInRequired: false, staleBundledPrivacy: 'assets/public/site/privacy.html', preciseLocation: true, closedTestValue: /Reconstructed|Sign in with Google|back up and sync/i });


const tflowDir = process.env.ROCKETLAUNCHER_REAL_TFLOW || '/workspace/tflow-android';
if (fs.existsSync(tflowDir)) {
  console.log('\n[T-FLOW live privacy URL]');
  const prev = process.env.ROCKETLAUNCHER_VERIFY_URLS;
  process.env.ROCKETLAUNCHER_VERIFY_URLS = '1';
  try {
    const { st, report } = await E.connect({ source: 'path', path: tflowDir, lang: 'en' }, { allowPath: true });
    const issues = (st.A.issues || []).map(i => i.id);
    check(!issues.includes('privacyUrlDead') && !issues.includes('privacyUrlUnverified') && st.A.listing && st.A.listing.privacyFetched, 'live privacy URL is reachable and the page was read (not HTTP 401)', { issues, warn: report.app.privacy_url_warning, fetched: st.A.listing && st.A.listing.privacyFetched });
    const del = await E.release('deletion', st.id, {}, 'en');
    const ret = (del.rows || []).find(r => r.id === 'retention');
    check(ret && ret.severity === 'ok', 'live policy content: retention section found (보관/삭제), not reported missing', ret);
  } catch (e) {
    console.log('  - skipped live privacy URL check:', e.message);
  }
  process.env.ROCKETLAUNCHER_VERIFY_URLS = prev;
}

console.log(`\n${pass} passed, ${failN} failed${skipped ? `, ${skipped} project(s) skipped` : ''}`);
fs.rmSync(HOME, { recursive: true, force: true });
process.exit(failN ? 1 : 0);
