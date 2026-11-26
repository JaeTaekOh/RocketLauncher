/* Rocket Launcher 0.2.8 checks for the rc-028 copy pass: rows added in 0.2.8 are shown in the user's language (en stays the source),
   no internal _v/_k fields leak, the purpose-text row, the 96% cap sentence, and the reworded notes.
   Run: node test/fixes028e.mjs */
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';

const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'rocketlauncher-028e-'));
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
async function run(files, lang = 'en') {
  const { st } = await E.connect({ source: 'path', path: project(files), lang }, { allowPath: true });
  const [req, pv, pa, del] = await Promise.all(['requirements', 'privacy', 'policy', 'deletion'].map(t => E.release(t, st.id, {}, lang)));
  const row = (r, id) => (r.rows || []).find(x => x.id === id);
  const sigs = Object.values(pa.quick_scan).flatMap(d => d.signals.map(s => s.signal));
  return { st, req, pv, pa, del, row, sigs };
}

const GS = pk => JSON.stringify({ project_info: { project_id: 'p' }, client: pk.map(p => ({ client_info: { mobilesdk_app_id: '1:1:android:abc', android_client_info: { package_name: p } }, api_key: [{ current_key: 'AIza-not-a-real-key' }] })) });
const { ROWT, localizeRow } = await import('../lib/release-rows-i18n.mjs');
const { msg } = await import('../lib/messages.mjs');
const HANGUL = /[\uac00-\ud7a3]/;
const all = r => [...(r.req.rows || []), ...(r.pv.rows || [])];
const FILES = { 'android/app/google-services.json': GS(['com.example.moodtune', 'kr.old.field']), 'store/listing-ko.md': '# 등록정보\n\n배포 국가: 대한민국만\n' };

const en = await run(BGAA(FILES), 'en'), ko = await run(BGAA(FILES), 'ko');
const keyOf = r => r.id;
const newIds = new Set(Object.keys(ROWT.ko).map(k => k.split('#')[0]));
const enNew = all(en).filter(r => newIds.has(r.id)), koNew = all(ko).filter(r => newIds.has(r.id));
check(enNew.length >= 6, 'fixture produces at least 6 of the 0.2.8 rows', enNew.map(keyOf));
check(koNew.length === enNew.length, 'same 0.2.8 rows in ko and en', [enNew.map(keyOf), koNew.map(keyOf)]);
const notKo = koNew.filter(r => !HANGUL.test(r.finding) || (r.action && !HANGUL.test(r.action)));
check(!notKo.length, 'every 0.2.8 row is Korean in ko (finding and action)', notKo.map(r => [r.id, r.finding]));
check(!enNew.some(r => HANGUL.test(r.finding.replace(/대한민국만|미확인/g, ''))), 'en rows stay English', enNew.map(r => r.finding));
check(!JSON.stringify([en.req, en.pv, ko.req, ko.pv]).includes('"_v"') && !JSON.stringify([ko.req, ko.pv]).includes('"_k"'), 'no _v/_k in tool output');
const cnK = ko.row(ko.req, 'play.countries');
check(cnK && /대한민국만/.test(cnK.finding) && /Countries/.test(cnK.action), 'ko countries row keeps the value and the English console path', cnK);
const opK = ko.row(ko.req, 'play.old_package_name');
check(opK && /kr\.old\.field/.test(opK.finding) && HANGUL.test(opK.action), 'ko old package row keeps the package name', opK);
check(!JSON.stringify(ko.st.X || {}).includes('AIza'), 'no Firebase key kept in the state');
for (const L of ['th', 'zh', 'hi']) {
  const r = await run(BGAA(FILES), L), rows = all(r).filter(x => newIds.has(x.id));
  check(rows.length === enNew.length && rows.every((x, i) => x.finding !== enNew.find(e => e.id === x.id).finding), L + ': 0.2.8 rows translated', rows.map(x => [x.id, x.finding.slice(0, 60)]));
}
/* every language has every key, and the functions do not throw on empty values */
for (const L of ['ko', 'th', 'zh', 'hi']) {
  const miss = Object.keys(ROWT.ko).filter(k => !ROWT[L][k]);
  check(!miss.length, L + ': all 0.2.8 row keys present', miss);
  let bad = [];
  for (const [k, t] of Object.entries(ROWT[L])) { try { const V = new Proxy({}, { get: (o, k) => (k === 'mp' || k === 'hintOnly' ? true : 'X') }); const f = typeof t.f === 'function' ? t.f(V) : t.f, a = typeof t.a === 'function' ? t.a(V) : t.a; if (a !== undefined && (typeof a !== 'string' || /undefined|—/.test(a))) bad.push(k + ':a'); if (typeof f !== 'string' || /undefined|—/.test(f)) bad.push(k); } catch (e) { bad.push(k + ':' + e.message); } }
  check(!bad.length, L + ': row texts build with empty values, no "undefined", no em dash', bad);
}
check(localizeRow('ko', { id: 'play.countries', finding: 'x', _v: { c: 'A', file: 'f' } }).finding !== 'x' && localizeRow('ko', { id: 'old.row', finding: 'x' }).finding === 'x', 'rows without _v keep the English text (fallback)');
check(localizeRow('en', { id: 'play.countries', finding: 'x', _v: { c: 'A' } }).finding === 'x', 'en never replaced');

/* B-1, B-4, B-6, G-3 English */
const sig = all(en).find(r => /^ds\./.test(r.id) && /pattern match is not proof/.test(r.finding));
const hf = en.row(en.req, 'apple.hidden_features');
check(!hf || hf.severity === 'info' || /\(/.test(hf.finding), 'hidden features row names where flags were found', hf);
const pt = en.row(en.pv, 'perm.purpose_text');
check(pt && pt.severity === 'info' && /NSCameraUsageDescription/.test(pt.finding) && /only checks that the keys exist/.test(pt.action), 'Info.plist purpose texts → info row asking to re-read them', pt);
const ptK = ko.row(ko.pv, 'perm.purpose_text');
check(ptK && HANGUL.test(ptK.action) && /NSCameraUsageDescription/.test(ptK.finding), 'purpose text row in ko', ptK);
const noIos = await run(BGAA({ 'ios/App/App/Info.plist': null, 'ios/App/App.xcodeproj/project.pbxproj': null, 'ios/App/App/AppDelegate.swift': null, 'ios/App/App/CarPlaySceneDelegate.swift': null, 'ios/App/App/App.entitlements': null }));
check(!noIos.row(noIos.pv, 'perm.purpose_text'), 'no iOS project → no purpose text row');
void sig;
const rf = await run(BGAA({ 'www/flags.js': "import { getRemoteConfig, fetchAndActivate } from 'firebase/remote-config';\nexport const load = rc => fetchAndActivate(rc);\n" }), 'ko');
const rfRow = rf.row(rf.req, 'apple.hidden_features');
check(rfRow && rfRow.severity === 'warn' && /www\/flags\.js/.test(rfRow.finding) && HANGUL.test(rfRow.finding), 'remote config in code → warn names the file, in ko', rfRow);

/* T-2 the 96% cap */
for (const L of ['en', 'ko', 'th', 'zh', 'hi']) check(/96%/.test(msg(L, 'readyCap')) && !/—/.test(msg(L, 'readyCap')), L + ': 96% cap sentence');
const capRep = E.report(en.st, 'en');
check(en.st.A.readiness >= 96 ? /highest score/.test(capRep.summary) : !/highest score/.test(capRep.summary), 'cap sentence only at 96%', [en.st.A.readiness, capRep.summary]);

/* G-2 notes, G-7 category source, earlier-upload note in ko */
const koRep = E.report(ko.st, 'ko');
check(HANGUL.test(koRep.app.category_note || ''), 'ko category note', koRep.app.category_note);
check(/^suggested/.test(capRep.app.category_source) && /no category was found/.test(capRep.app.category_source), 'category source says nothing was found', capRep.app.category_source);

console.log(`\n${pass} passed, ${failN} failed`);
fs.rmSync(HOME, { recursive: true, force: true });
if (failN) process.exit(1);
