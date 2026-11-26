/* Rocket Launcher 0.2.8 unit checks for the T-FLOW feedback on 0.2.7:
   ambiguous results: Data safety draft versus a prepared form in the project, "alternative" category shown as a second category,
   a privacy policy sentence that forbids ads counted as ads, an earlier-upload hint with no source;
   missed items: closed-test access, a debug-signed APK next to the Play build, Google sign-in with Play app signing, a leftover package name in
   google-services.json, the distribution countries named in the prepared listing.
   Run: node test/fixes028d.mjs */
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';

const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'rocketlauncher-028d-'));
process.env.ROCKETLAUNCHER_HOME = HOME;
process.env.ROCKETLAUNCHER_LESSONS_API = 'http://127.0.0.1:9/api/lessons';
process.env.ROCKETLAUNCHER_VERIFY_URLS = '0';
const E = await import('../lib/engine.mjs');

let pass = 0, failN = 0;
const check = (c, name, extra) => { if (c) { pass++; console.log('  ✓', name); } else { failN++; console.log('  ✗', name, extra !== undefined ? JSON.stringify(extra).slice(0, 700) : ''); } };
let n = 0;
function project(files) {
  const dir = path.join(HOME, 'fx-' + (++n));
  for (const [p, c] of Object.entries(files)) { if (c == null) continue; const f = path.join(dir, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, c); }
  return dir;
}
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const png = k => Buffer.concat([PNG, Buffer.from([k])]);   // distinct bytes per file (screenshots are de-duplicated by content)
const kv = (k, v) => `<key>${k}</key><string>${v}</string>`;
const PLIST = (extra = '') => `<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict>${kv('CFBundleDisplayName', 'Moodtune')}${kv('CFBundleShortVersionString', '1.1.0')}${kv('CFBundleVersion', '5')}<key>ITSAppUsesNonExemptEncryption</key><false/>${extra}<key>UIBackgroundModes</key><array><string>audio</string></array></dict></plist>`;
const LOC_KEYS = kv('NSLocationWhenInUseUsageDescription', 'Approximate location when you tap Weather picks.') + kv('NSLocationAlwaysAndWhenInUseUsageDescription', 'Only while you use the app. Not in the background.');
const CAM_KEY = kv('NSCameraUsageDescription', 'Take a photo of your shop to get song suggestions.');
const PBX = (sources = 'AppDelegate.swift') => `// !$*UTF8*$!
{ objects = {
  A1 /* AppDelegate.swift in Sources */ = {isa = PBXBuildFile; fileRef = F1 /* AppDelegate.swift */; };
  ${sources.includes('CarPlaySceneDelegate') ? 'A2 /* CarPlaySceneDelegate.swift in Sources */ = {isa = PBXBuildFile; fileRef = F2 /* CarPlaySceneDelegate.swift */; };' : ''}
  F1 /* AppDelegate.swift */ = {isa = PBXFileReference; path = AppDelegate.swift; sourceTree = "<group>"; };
  F2 /* CarPlaySceneDelegate.swift */ = {isa = PBXFileReference; path = CarPlaySceneDelegate.swift; sourceTree = "<group>"; };
  G1 = {isa = PBXGroup; children = ( F1 /* AppDelegate.swift */, F2 /* CarPlaySceneDelegate.swift */, ); };
  P1 = {isa = PBXProject; attributes = { LastUpgradeCheck = 0920; }; };
  S1 /* Sources */ = {isa = PBXSourcesBuildPhase; files = ( A1 /* AppDelegate.swift in Sources */, ${sources.includes('CarPlaySceneDelegate') ? 'A2 /* CarPlaySceneDelegate.swift in Sources */,' : ''} ); };
  B1 = {isa = XCBuildConfiguration; buildSettings = { IPHONEOS_DEPLOYMENT_TARGET = 15.0; PRODUCT_BUNDLE_IDENTIFIER = com.example.moodtune; MARKETING_VERSION = 1.1.0; CURRENT_PROJECT_VERSION = 5; TARGETED_DEVICE_FAMILY = "1,2"; }; };
}; }`;
const MANIFEST = (perms = '') => `<manifest xmlns:android="http://schemas.android.com/apk/res/android"><uses-permission android:name="android.permission.INTERNET"/><uses-permission android:name="android.permission.FOREGROUND_SERVICE"/><uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK"/><uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>${perms}<application android:label="@string/app_name" android:icon="@mipmap/ic_launcher"><activity android:name=".MainActivity" android:exported="true"/><service android:name=".PlayerService" android:foregroundServiceType="mediaPlayback" android:exported="false"/></application></manifest>`;
const GRADLE = `plugins { id 'com.android.application' }\nandroid { namespace "com.example.moodtune"\n defaultConfig { applicationId "com.example.moodtune"\n minSdk 24\n targetSdk 36\n versionCode 6\n versionName "1.1.0" } }\ndependencies { implementation "androidx.media3:media3-exoplayer:1.4.1" }\n`;
const WORKFLOW = `name: ios\non: workflow_dispatch\njobs:\n  build:\n    runs-on: macos-15\n    steps:\n      - name: Xcode 26\n        run: |\n          X=$(ls -d /Applications/Xcode_26*.app | grep -vi beta | sort -V | tail -1); [ -n "$X" ] || X=$(ls -d /Applications/Xcode_16*.app | sort -V | tail -1)\n          sudo xcode-select -s "$X/Contents/Developer"\n`;
const BGAA = (over = {}) => ({
  'package.json': JSON.stringify({ name: 'moodtune', version: '1.1.0', dependencies: { '@capacitor/core': '^7.0.0', '@capacitor/geolocation': '^7.1.8', '@capacitor/android': '^7.0.0', '@capacitor/ios': '^7.0.0' } }),
  'capacitor.config.json': JSON.stringify({ appId: 'com.example.moodtune', appName: 'Moodtune', webDir: 'www' }),
  'android/app/src/main/AndroidManifest.xml': MANIFEST(),
  'android/app/build.gradle': GRADLE,
  'android/app/src/main/res/values/strings.xml': '<resources><string name="app_name">Moodtune</string></resources>',
  'www/weather.js': "export async function here() { const nav = globalThis.navigator && globalThis.navigator.geolocation;\n  return new Promise((ok, no) => nav.getCurrentPosition(p => ok({ lat: p.coords.latitude, lon: p.coords.longitude }), no, { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 })); }\n",
  'www/update.js': "export function changelogDecision(last, current) {\n  if (!current) return { show: false, record: false };\n  if (!last) return { show: false, record: true };\n  return { show: last < current, record: true };\n}\n",
  'www/config.js': "export const CONFIG = {\n  privacyUrl: 'https://example.com/moodtune/privacy',\n  remoteConfigUrl: '',\n  adsEnabled: true,\n};\n",
  'www/notices.js': "import { CONFIG } from './config.js';\nexport async function loadRemote(fetchFn) { const url = CONFIG.remoteConfigUrl; if (!url) return {}; const r = await fetchFn(url); return r.json(); }\n",
  'www/ads.js': "// AdMob banner (off until production)\nimport { AdMob } from '@capacitor-community/admob';\nexport async function showBanner() { await AdMob.showBanner({ adId: 'ca-app-pub-xxx/yyy' }); }\n",
  'www/screens-venue.js': "export const html = () => `<input type=\"file\" id=\"fCam\" accept=\"image/*\" capture=\"environment\" hidden>`;\n",
  'www/account.js': "export async function deleteAccount() { await fetch('/api/account', { method: 'DELETE' }); }\nexport const appleLogin = () => SignInWithApple.authorize();\n",
  'ios/App/App/Info.plist': PLIST(LOC_KEYS + CAM_KEY),
  'ios/App/App.xcodeproj/project.pbxproj': PBX(),
  'ios/App/App/AppDelegate.swift': 'import UIKit\nimport Capacitor\n@UIApplicationMain class AppDelegate: UIResponder, UIApplicationDelegate { }\n',
  'ios/App/App/CarPlaySceneDelegate.swift': 'import CarPlay\nclass CarPlaySceneDelegate: UIResponder, CPTemplateApplicationSceneDelegate { var interfaceController: CPInterfaceController? }\n',
  'ios/App/App/App.entitlements': '<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict><key>com.apple.developer.applesignin</key><array><string>Default</string></array></dict></plist>',
  '.github/workflows/ios.yml': WORKFLOW,
  'metadata/screenshots/iphone/en/01-home.png': png(1), 'metadata/screenshots/iphone/en/02-player.png': png(2),
  'metadata/screenshots/iphone/ko/01-home.png': png(3), 'metadata/screenshots/iphone/ko/02-player.png': png(4),
  'metadata/screenshots/ipad/en/01-home.png': png(5), 'metadata/screenshots/ipad/en/02-player.png': png(6),
  'README.md': '# Moodtune\n\nBackground music for small shops.\n',
  ...over
});
const ids = st => (st.A.issues || []).map(i => i.id);
const issue = (st, id) => (st.A.issues || []).filter(i => i.id === id);
async function run(files) {
  const { st } = await E.connect({ source: 'path', path: project(files), lang: 'en' }, { allowPath: true });
  const [req, pv, pa, del] = await Promise.all(['requirements', 'privacy', 'policy', 'deletion'].map(t => E.release(t, st.id, {}, 'en')));
  const row = (r, id) => (r.rows || []).find(x => x.id === id);
  const sigs = Object.values(pa.quick_scan).flatMap(d => d.signals.map(s => s.signal));
  return { st, req, pv, pa, del, row, sigs };
}

const NO_ADS_PKG = JSON.stringify({ name: 'moodtune', version: '1.1.0', dependencies: { '@capacitor/core': '^7.0.0', '@capacitor/geolocation': '^7.1.8', '@capacitor/android': '^7.0.0', '@capacitor/ios': '^7.0.0' } });

const zip = entries => {   // minimal stored (uncompressed) zip
  const parts = [], cd = []; let off = 0;
  for (const [name, data] of entries) {
    const nb = Buffer.from(name), db = Buffer.from(data), h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt32LE(db.length, 18); h.writeUInt32LE(db.length, 22); h.writeUInt16LE(nb.length, 26);
    parts.push(h, nb, db);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt32LE(db.length, 20); c.writeUInt32LE(db.length, 24); c.writeUInt16LE(nb.length, 28); c.writeUInt32LE(off, 42);
    cd.push(c, nb); off += 30 + nb.length + db.length;
  }
  const cdb = Buffer.concat(cd), e = Buffer.alloc(22); e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(entries.length, 8); e.writeUInt16LE(entries.length, 10); e.writeUInt32LE(cdb.length, 12); e.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cdb, e]);
};
const FORM = rows => `# Play forms\n\n## 6. Data safety\n\n| Category | Type | Collected | Shared | Ephemeral | Required? | Purposes |\n|---|---|---|---|---|---|---|\n${rows.map(([c, t, y]) => `| ${c} | ${t} | ${y || 'Yes'} | No | No | Optional | App functionality |`).join('\n')}\n\nNot collected: audio.\n`;
const GS = pk => JSON.stringify({ project_info: { project_id: 'p' }, client: pk.map(p => ({ client_info: { mobilesdk_app_id: '1:1:android:abc', android_client_info: { package_name: p } }, api_key: [{ current_key: 'AIza-not-a-real-key' }] })) });
const gsOf = r => r.st.A.googleServices;
let r;

console.log('\n[A] ambiguous results');
r = await run(BGAA({ 'store/play-forms.md': FORM([['Photos and videos', 'Photos'], ['Location', 'Approximate location'], ['Personal info', 'Phone number (customers)'], ['Personal info', 'Address (customer addresses)'], ['Files and docs', 'Files and docs (PDF)']]) }));
let m = r.row(r.pv, 'ds.prepared_missing');
check(m && /Phone number/.test(m.finding) && /Address/.test(m.finding) && /Files and docs/.test(m.finding) && !/Photos|Approximate/.test(m.finding), 'prepared form lists phone, address, files that the draft lacks → ds.prepared_missing', [m, r.pv.drafts.data_safety.rows.map(x => x.id)]);
check(!r.row(r.pv, 'ds.prepared_extra'), 'a draft that is a subset of the form → no ds.prepared_extra', r.row(r.pv, 'ds.prepared_extra'));
r = await run(BGAA({ 'store/play-forms.md': FORM([['Personal info', 'Name'], ['Personal info', 'Email address']]) }));
let ex = r.row(r.pv, 'ds.prepared_extra');
check(ex && /loc/.test(ex.finding) && /photos/.test(ex.finding), 'the draft lists location and photos that the prepared form does not → ds.prepared_extra', ex);
r = await run(BGAA({ 'store/play-forms.md': FORM([['Location', 'Approximate location'], ['Photos and videos', 'Photos'], ['Personal info', 'Phone number', 'No']]) }));
check(!r.row(r.pv, 'ds.prepared_missing') && !r.row(r.pv, 'ds.prepared_extra'), 'form and draft agree (a "No" row does not count) → no prepared_* rows', [r.row(r.pv, 'ds.prepared_missing'), r.row(r.pv, 'ds.prepared_extra')]);
r = await run(BGAA());
check(!r.row(r.pv, 'ds.prepared_missing') && !r.row(r.pv, 'ds.prepared_extra'), 'no prepared Data safety form → no prepared_* rows', (r.pv.rows || []).map(x => x.id));

const conn = async files => E.connect({ source: 'path', path: project(files), lang: 'en' }, { allowPath: true });
let c = await conn(BGAA({ 'rocketlauncher.json': JSON.stringify({ category: 'Business' }) }));
check(c.report.app.category_source && /rocketlauncher\.json/.test(c.report.app.category_source) && /first category comes from/.test(c.report.app.category_note) && /not categories you chose/.test(c.report.app.category_note), 'category from the project config → the report says only the first is yours', c.report.app);
c = await conn(BGAA({ 'store/listing-ko.md': '# T\n\n- 앱 / 카테고리: **비즈니스 (Business)** (대안: 생산성)\n' }));
check(c.st.A.categories[0] === 'business' && /not categories you chose|suggestions/.test(c.report.app.category_note), 'a listing draft "비즈니스 (대안: 생산성)" → business first, the alternative is a suggestion', [c.st.A.categories, c.report.app.category_note]);
c = await conn(BGAA());
check(/^guessed/.test(c.report.app.category_source) && /suggestions/.test(c.report.app.category_note), 'no stated category → all categories are suggestions', c.report.app);

const pol = t => BGAA({ 'privacy.md': '# Privacy\n\n' + t + '\n', 'package.json': NO_ADS_PKG.replace('"@capacitor/core"', '"@capacitor-community/admob": "^6.0.0", "@capacitor/core"') });
c = await conn(pol('We collect your name and email. We do not use your data for advertising. Your data is never sold.'));
check(c.st.X.policy.read && c.st.X.policy.ads === false, 'a policy sentence that forbids advertising is not an ads mention', c.st.X.policy);
c = await conn(pol('광고에 사용하지 않습니다. 이름과 이메일을 수집합니다.'));
check(c.st.X.policy.read && c.st.X.policy.ads === false, 'Korean "광고에 사용하지 않습니다" is not an ads mention', c.st.X.policy);
c = await conn(pol('The app shows ads from AdMob. The advertising ID is used for ad delivery.'));
check(c.st.X.policy.ads === true, 'a policy that says the app shows ads → ads mention', c.st.X.policy);
c = await conn(pol('We do not sell your data. The app shows ads from AdMob.'));
check(c.st.X.policy.ads === true, 'a negation in another sentence does not hide a real ads sentence', c.st.X.policy);

c = await conn(BGAA());
check(c.report.store_stage['Google Play'].earlier_upload_hint === 'versionCode 6' && /Not verified \(미확인\)/.test(c.report.store_stage['Google Play'].earlier_upload_hint_note), 'versionCode ≥ 2 hint comes with a "not verified" note', c.report.store_stage['Google Play']);
c = await conn(BGAA({ 'android/app/build.gradle': GRADLE.replace('versionCode 6', 'versionCode 1') }));
check(!c.report.store_stage['Google Play'].earlier_upload_hint && !c.report.store_stage['Google Play'].earlier_upload_hint_note, 'versionCode 1 → no earlier-upload hint and no note', c.report.store_stage['Google Play']);

console.log('\n[B] missed items');
r = await run(BGAA());
let ct = r.row(r.req, 'play.closed_test_access');
check(ct && ct.severity === 'info' && /same Google account/.test(ct.finding) && /Countries/.test(ct.action) && /9845334/.test(ct.source), 'stage not live → closed-test access row (group, same account, country)', ct);
r = await run(BGAA({ 'rocketlauncher.json': JSON.stringify({ store_stage: { play: 'live' } }) }));
check(!r.row(r.req, 'play.closed_test_access'), 'stage live → no closed-test access row', r.row(r.req, 'play.closed_test_access'));

const CERT_DBG = Buffer.concat([Buffer.from('0\x82\x01\x00 CN=Android Debug, O=Android, C=US'), Buffer.alloc(40, 7)]);
const CERT_OWN = Buffer.concat([Buffer.from('0\x82\x01\x00 CN=Moodtune Release, O=Example, C=KR'), Buffer.alloc(40, 7)]);
const apkFile = cert => zip([['AndroidManifest.xml', Buffer.alloc(8)], ['classes.dex', Buffer.alloc(64, 1)], ['META-INF/CERT.RSA', cert]]);
r = await run(BGAA({ 'preview/moodtune-debug.apk': apkFile(CERT_DBG) }));
let da = r.row(r.req, 'play.debug_apk_signature');
check(da && da.severity === 'check' && /moodtune-debug\.apk/.test(da.finding) && /uninstall/.test(da.action), 'debug-signed APK in the project → signing conflict row', [da, ((r.st.X.natives || {}).binaries || []).map(b => [b.path, b.debugSigned, b.error])]);
r = await run(BGAA({ 'dist/moodtune-release.apk': apkFile(CERT_OWN) }));
check(!r.row(r.req, 'play.debug_apk_signature'), 'an APK signed with another key → no signing conflict row', r.row(r.req, 'play.debug_apk_signature'));
r = await run(BGAA());
check(!r.row(r.req, 'play.debug_apk_signature'), 'no APK → no signing conflict row', r.row(r.req, 'play.debug_apk_signature'));

r = await run(BGAA({ 'android/app/build.gradle': GRADLE.replace('dependencies {', 'dependencies { implementation "com.google.android.gms:play-services-auth:21.0.0"\n') }));
let gl = r.row(r.req, 'play.app_signing_google_login');
check(gl && gl.severity === 'check' && /SHA-1/.test(gl.action) && /app signing/i.test(gl.action), 'Google sign-in on Android → Play app signing fingerprint row', gl);
r = await run(BGAA());
check(!r.row(r.req, 'play.app_signing_google_login'), 'no Google sign-in → no app signing row', r.row(r.req, 'play.app_signing_google_login'));

r = await run(BGAA({ 'android/app/google-services.json': GS(['com.example.moodtune', 'kr.old.field']) }));
let op = r.row(r.req, 'play.old_package_name');
check(op && /kr\.old\.field/.test(op.finding) && /never be used again/.test(op.action) && !/AIza/.test(JSON.stringify(r.st.X)), 'google-services.json lists another package → "never reuse" row, no key in the state', op);
r = await run(BGAA({ 'android/app/google-services.json': GS(['com.example.moodtune']) }));
check(!r.row(r.req, 'play.old_package_name') && !r.row(r.req, 'play.google_services_package'), 'google-services.json with only this package → no row', (r.req.rows || []).map(x => x.id));
r = await run(BGAA({ 'android/app/google-services.json': GS(['com.example.moodtune', 'com.example.moodtune.debug']) }));
check(!r.row(r.req, 'play.old_package_name'), 'a .debug suffix client is not an old package', r.row(r.req, 'play.old_package_name'));
r = await run(BGAA({ 'android/app/google-services.json': GS(['kr.old.field']) }));
let gp = r.row(r.req, 'play.google_services_package');
check(gp && gp.severity === 'warn' && /no client for com\.example\.moodtune/.test(gp.finding), 'google-services.json without this package → warning', gp);

r = await run(BGAA({ 'store/listing-ko.md': '# 등록정보\n\n패키지: `com.example.moodtune` · 기본 언어: **한국어 (ko-KR)** · 배포 국가: 대한민국만 · 비공개 테스트\n' }));
let cn = r.row(r.req, 'play.countries');
check(cn && cn.severity === 'info' && /대한민국만/.test(cn.finding) && /Countries/.test(cn.action), 'prepared listing "배포 국가: 대한민국만" → countries row', cn);
r = await run(BGAA({ 'store/listing-en.md': '# Listing\n\nDistribution countries: Thailand, Vietnam\n' }));
check(r.row(r.req, 'play.countries') && /Thailand, Vietnam/.test(r.row(r.req, 'play.countries').finding), 'English "Distribution countries: Thailand, Vietnam" → countries row', r.row(r.req, 'play.countries'));
r = await run(BGAA());
check(!r.row(r.req, 'play.countries'), 'no prepared countries → no countries row', r.row(r.req, 'play.countries'));

console.log(`\n${pass} passed, ${failN} failed`);
fs.rmSync(HOME, { recursive: true, force: true });
if (failN) process.exit(1);
