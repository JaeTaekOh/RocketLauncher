/* Rocket Launcher 0.2.8 unit checks for BGAA false positives reported on 0.2.7 (Capacitor app, Android + iOS shell):
   (1) microphone: a `record: false` key in JS is not the Flutter `record` package, and the word "record" is not audio;
   (2) location: COARSE-only Android + enableHighAccuracy:false is approximate; the Always Info.plist key alone is not an Always request;
   (3) CarPlay: a CarPlay Swift file listed in project.pbxproj but in no Sources build phase is not shipped;
   (4) Xcode: `Xcode_26*.app` in a CI workflow is Xcode 26; LastUpgradeCheck 0920 (Capacitor template) is not the build Xcode;
   (5) screenshots in device / locale sub-folders are found, iPad ones included;
   (6) an empty `remoteConfigUrl: ''` is not remote feature flags.
   The true positives of the same project stay: PrivacyInfo.xcprivacy missing, Sign in with Apple token revoke, foreground service,
   ad SDK names in code, and a missing camera purpose string when the web view opens the camera.
   Optional: the real BGAA folder (ROCKETLAUNCHER_REAL_BGAA, default /workspace/bgaa-relaunch) is read in place, read-only.
   Run: node test/fixes028b.mjs */
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';

const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'rocketlauncher-028b-'));
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

console.log('\n[A] BGAA-shaped project: the nine false positives are gone');
let r = await run(BGAA());
check(!issue(r.st, 'missingUsage').some(i => i.vars.key === 'NSMicrophoneUsageDescription'), '(1) no missing NSMicrophoneUsageDescription (JS `record: false` is not the Flutter record package)', issue(r.st, 'missingUsage'));
check(!r.st.A.iosNeeds.mic && !r.st.A.sdk.audioCapture, '(1) iOS mic need and audio capture are false', [r.st.A.iosNeeds, r.st.A.sdk.audioCapture]);
check(!r.row(r.pv, 'ds.audio') && !r.sigs.includes('AUDIO'), '(2) no ds.audio warning / AUDIO signal from the word "record"', r.sigs);
check(!r.sigs.includes('PRECISE_LOCATION') && r.sigs.includes('APPROX_LOCATION'), '(3) COARSE-only + enableHighAccuracy:false → approximate, not precise location', r.sigs);
check(!r.row(r.pv, 'loc.always_mismatch') && r.row(r.pv, 'loc.always_key_only') && r.row(r.pv, 'loc.always_key_only').severity === 'info', '(4) Always key without an Always request → info, not a warning', (r.pv.rows || []).filter(x => /^loc\./.test(x.id)));
check(!ids(r.st).includes('carplay'), '(5) CarPlay file taken out of the Sources build phase → no CarPlay warning', ids(r.st));
const xc = r.row(r.req, 'apple.xcode_26');
check(xc && xc.severity === 'ok' && /26/.test(xc.finding), '(6) Xcode_26*.app in the CI workflow → Xcode 26 ok', xc);
check(!/9\.2/.test(JSON.stringify(r.req.rows)), '(6) LastUpgradeCheck 0920 is not reported as the build Xcode', xc && xc.finding);
check(!ids(r.st).includes('noShots') && r.st.A.screenshots.length >= 2, '(7) screenshots in metadata/screenshots/iphone/en are found', r.st.A.screenshots.map(s => s.path));
check(!r.st.A.screenshots.some(s => /ipad/i.test(s.path)), '(7) iPad pictures are not mixed into phone screenshots', r.st.A.screenshots.map(s => s.path));
check(!ids(r.st).includes('ipadShots') && r.st.A.ipadScreenshots >= 1, '(8) iPad screenshots present → no ipadShots warning', [ids(r.st), r.st.A.ipadScreenshots]);
const hf = r.row(r.req, 'apple.hidden_features');
check(hf && hf.severity !== 'warn', "(9) remoteConfigUrl: '' (empty) → no remote feature flag warning", hf);

console.log('\n[B] the true positives of the same project stay');
check(ids(r.st).includes('privacyManifest') && r.row(r.pv, 'xcprivacy.missing'), 'PrivacyInfo.xcprivacy missing is still flagged', ids(r.st));
check(r.row(r.del, 'siwa_revoke'), 'Sign in with Apple token revoke on deletion is still flagged', (r.del.rows || []).map(x => x.id));
check(ids(r.st).includes('fgs') && r.pa.quick_scan.permissions_and_apis.review_against.some(p => p.id === 'foreground_services_policy'), 'foreground service (mediaPlayback) declaration is still flagged', ids(r.st));
check(ids(r.st).includes('adsCodeOnly') || ids(r.st).includes('adsDeclare') || r.st.A.sdk.ads, 'ad SDK names in code are still reported', ids(r.st));
check(r.sigs.includes('APPROX_LOCATION') && r.pa.quick_scan.permissions_and_apis.review_against.some(p => p.id === 'location_access_policy'), 'location policy still listed (approximate location is still location)', r.sigs);
check(r.st.A.iosNeeds.camera, 'web view camera (<input capture>) still needs the camera purpose string', r.st.A.iosNeeds);
r = await run(BGAA({ 'ios/App/App/Info.plist': PLIST(LOC_KEYS) }));
check(issue(r.st, 'missingUsage').some(i => i.vars.key === 'NSCameraUsageDescription'), 'missing NSCameraUsageDescription is flagged when the web view opens the camera', issue(r.st, 'missingUsage'));

console.log('\n[C] no over-correction: the real cases are still caught');
r = await run(BGAA({ 'www/rec.js': "export async function rec() { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); return new MediaRecorder(s); }\n" }));
check(issue(r.st, 'missingUsage').some(i => i.vars.key === 'NSMicrophoneUsageDescription'), 'getUserMedia audio + MediaRecorder without NSMicrophoneUsageDescription → flagged', issue(r.st, 'missingUsage'));
check(r.sigs.includes('AUDIO'), 'MediaRecorder → AUDIO signal', r.sigs);
r = await run(BGAA({ 'pubspec.yaml': 'name: x\ndependencies:\n  flutter:\n    sdk: flutter\n  record: ^5.1.0\n' }));
check(r.st.A.iosNeeds.mic, 'Flutter `record:` pubspec dependency still needs the microphone', r.st.A.iosNeeds);
r = await run(BGAA({ 'www/rec2.js': "// voice memo\nconst btn = document.querySelector('#record'); btn.onclick = () => recorder.startRecording(); const permission = 'microphone';\n" }));
check(r.sigs.includes('AUDIO'), '"record" next to startRecording / microphone code → AUDIO signal', r.sigs);
r = await run(BGAA({ 'android/app/src/main/AndroidManifest.xml': MANIFEST('<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>') }));
check(r.sigs.includes('PRECISE_LOCATION'), 'ACCESS_FINE_LOCATION declared → precise location', r.sigs);
r = await run(BGAA({ 'www/weather.js': "navigator.geolocation.getCurrentPosition(ok, no, { enableHighAccuracy: true });\n" }));
check(r.sigs.includes('PRECISE_LOCATION'), 'enableHighAccuracy: true → precise location even with COARSE only', r.sigs);
r = await run(BGAA({ 'ios/App/App/Loc.swift': 'import CoreLocation\nclass Loc { let m = CLLocationManager(); func go() { m.requestAlwaysAuthorization() } }\n' }));
check(r.row(r.pv, 'loc.always_mismatch') && r.row(r.pv, 'loc.always_mismatch').severity === 'warn', 'requestAlwaysAuthorization in code → Always mismatch warning', (r.pv.rows || []).filter(x => /^loc\./.test(x.id)));
r = await run(BGAA({ 'ios/App/App.xcodeproj/project.pbxproj': PBX('AppDelegate.swift CarPlaySceneDelegate.swift') }));
check(ids(r.st).includes('carplay'), 'CarPlay file in the Sources build phase without the entitlement → CarPlay warning', ids(r.st));
r = await run(BGAA({ 'ios/App/App/Info.plist': PLIST(LOC_KEYS + CAM_KEY + '<key>UIApplicationSceneManifest</key><dict><key>UISceneConfigurations</key><dict><key>CPTemplateApplicationSceneSessionRoleApplication</key><array/></dict></dict>') }));
check(ids(r.st).includes('carplay'), 'CarPlay scene role in Info.plist → CarPlay warning', ids(r.st));
r = await run(BGAA({ '.github/workflows/ios.yml': WORKFLOW.replace(/Xcode_26\*/g, 'Xcode_16.4').replace('Xcode 26', 'Xcode 16') }));
const xc2 = r.row(r.req, 'apple.xcode_26');
check(xc2 && xc2.severity === 'block', 'Xcode_16.4.app in CI → Xcode 26 requirement blocks', xc2);
r = await run(BGAA({ 'metadata/screenshots/ipad/en/01-home.png': null, 'metadata/screenshots/ipad/en/02-player.png': null }));
check(ids(r.st).includes('ipadShots'), 'iPad supported and no iPad screenshots → ipadShots warning', ids(r.st));
r = await run(BGAA({ 'www/config.js': "export const CONFIG = { remoteConfigUrl: 'https://example.github.io/moodtune/remote.json' };\n" }));
check((r.row(r.req, 'apple.hidden_features') || {}).severity === 'warn', 'a filled-in remote config URL → hidden features warning', r.row(r.req, 'apple.hidden_features'));
r = await run(BGAA({ 'www/rc.js': "import { getRemoteConfig, fetchAndActivate } from 'firebase/remote-config';\nconst rc = getRemoteConfig(app); await fetchAndActivate(rc);\n" }));
check((r.row(r.req, 'apple.hidden_features') || {}).severity === 'warn', 'Firebase Remote Config → hidden features warning', r.row(r.req, 'apple.hidden_features'));

console.log('\n[D] real BGAA folder (optional; skipped if missing)');
const REAL = process.env.ROCKETLAUNCHER_REAL_BGAA || '/workspace/bgaa-relaunch';
if (fs.existsSync(path.join(REAL, 'ios-shell'))) {
  const { st } = await E.connect({ source: 'path', path: REAL, lang: 'en' }, { allowPath: true });
  const [req, pv, pa, del] = await Promise.all(['requirements', 'privacy', 'policy', 'deletion'].map(t => E.release(t, st.id, {}, 'en')));
  const I = ids(st), rows = [...req.rows, ...pv.rows, ...del.rows], bad = id => rows.some(x => x.id === id && /warn|block|check/.test(x.severity));
  const sg = Object.values(pa.quick_scan).flatMap(d => d.signals.map(s => s.signal));
  check(!I.includes('carplay') && !I.includes('ipadShots') && !I.includes('noShots') && !issue(st, 'missingUsage').some(i => i.vars.key === 'NSMicrophoneUsageDescription'), 'real BGAA: no carplay / ipadShots / noShots / missing mic string', I);
  check(!bad('loc.always_mismatch') && !bad('ds.audio') && !bad('apple.hidden_features') && !bad('apple.xcode_26') && !sg.includes('PRECISE_LOCATION') && !sg.includes('AUDIO'), 'real BGAA: no Always mismatch, ds.audio, hidden features, Xcode, precise location, audio signal', [sg, rows.filter(x => /warn|block|check/.test(x.severity)).map(x => x.id)]);
  check(I.includes('privacyManifest') && bad('xcprivacy.missing') && bad('siwa_revoke') && I.includes('fgs') && I.includes('adsCodeOnly') && I.includes('byok'), 'real BGAA: true positives stay (PrivacyInfo, SIWA revoke, foreground service, ads in code, own AI key)', I);
} else console.log('  - skipped (folder not on this computer)');

console.log(`\n${pass} passed, ${failN} failed`);
fs.rmSync(HOME, { recursive: true, force: true });
process.exit(failN ? 1 : 0);
