/* Rocket Launcher 0.2.8 unit checks for the second BGAA report and the Gaddy report on 0.2.7:
   false positives: app-private storage (localStorage …) and an HTTP Accept "any" MIME value as user files; a media player as user videos;
   one named package lookup as the installed-apps list; a deletion URL kept in an app config file; i18n.js / localeFilters languages;
   a "title: / short: / full:" listing text file; store-folder screenshots over debug captures; applicationId from getProperty(key, default);
   precise location in the Data safety draft when ACCESS_FINE_LOCATION ships and location is sent.
   missed items: foreground service declaration with a video, Contains ads / Advertising ID answers that match a build without ads,
   coordinates sent straight to another company's server, the CarPlay entitlement.
   Run: node test/fixes028c.mjs */
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';

const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'rocketlauncher-028c-'));
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

const ENT = (k = '') => `<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict><key>com.apple.developer.applesignin</key><array><string>Default</string></array>${k}</dict></plist>`;
const CP_ENT = '<key>com.apple.developer.carplay-fueling</key><true/>';
const CP_SCENE = '<key>UIApplicationSceneManifest</key><dict><key>UISceneConfigurations</key><dict><key>CPTemplateApplicationSceneSessionRoleApplication</key><array/></dict></dict>';
const NO_ADS_PKG = JSON.stringify({ name: 'moodtune', version: '1.1.0', dependencies: { '@capacitor/core': '^7.0.0', '@capacitor/geolocation': '^7.1.8', '@capacitor/android': '^7.0.0', '@capacitor/ios': '^7.0.0' } });
const where = (r, sig) => Object.values(r.pa.quick_scan).flatMap(d => d.signals).filter(s => s.signal === sig).flatMap(s => s.where);
let r;

console.log('\n[A] BGAA: storage, player and package lookups are not user data');
r = await run(BGAA({ 'www/store.js': "export const save = v => { localStorage.setItem('k', v); sessionStorage.clear(); };\n", 'www/net.js': "export const get = u => fetch(u, { headers: { Accept: '*/*' } });\n" }));
check(!r.sigs.includes('FILES_AND_DOCS'), 'localStorage / sessionStorage / Accept */* → no FILES_AND_DOCS', where(r, 'FILES_AND_DOCS'));
check(!r.sigs.includes('VIDEOS'), 'ExoPlayer dependency for audio playback → no VIDEOS', where(r, 'VIDEOS'));
r = await run(BGAA({ 'www/attach.js': "export const html = () => `<input type=\"file\" accept=\"*/*\">`;\nexport async function pick() { return await showOpenFilePicker(); }\n" }));
check(r.sigs.includes('FILES_AND_DOCS'), 'a file picker for any type → FILES_AND_DOCS', r.sigs);
r = await run(BGAA({ 'android/app/src/main/java/com/example/Player.java': 'class Player { ExoPlayer p; MediaController c; }\n' }));
check(!r.sigs.includes('VIDEOS'), 'ExoPlayer + MediaController only → no VIDEOS', where(r, 'VIDEOS'));
r = await run(BGAA({ 'android/app/src/main/java/com/example/Clip.java': 'class Clip { ExoPlayer p; void pick() { Intent i = new Intent(Intent.ACTION_PICK, MediaStore.Video.Media.EXTERNAL_CONTENT_URI); } }\n' }));
check(r.sigs.includes('VIDEOS'), 'MediaStore.Video picking → VIDEOS', r.sigs);
r = await run(BGAA({ 'android/app/src/main/java/com/example/Nav.java': 'class Nav { boolean has(PackageManager pm) { try { pm.getPackageInfo("com.waze", 0); return true; } catch (Exception e) { return false; } } }\n' }));
check(!r.sigs.includes('APPS_ON_DEVICE'), 'getPackageInfo for one named app → no APPS_ON_DEVICE', where(r, 'APPS_ON_DEVICE'));
r = await run(BGAA({ 'android/app/src/main/java/com/example/Apps.java': 'class Apps { List l(PackageManager pm) { return pm.getInstalledPackages(0); } }\n' }));
check(r.sigs.includes('APPS_ON_DEVICE'), 'getInstalledPackages → APPS_ON_DEVICE', r.sigs);

console.log('\n[B] BGAA: missed items');
r = await run(BGAA());
let fg = r.row(r.req, 'play.fgs_declaration');
check(fg && fg.severity === 'check' && /mediaPlayback/.test(fg.finding) && /video/.test(fg.action) && /13392821/.test(fg.source), 'mediaPlayback foreground service → declaration row with a video link', fg);
r = await run(BGAA({ 'android/app/src/main/AndroidManifest.xml': '<manifest xmlns:android="http://schemas.android.com/apk/res/android"><uses-permission android:name="android.permission.INTERNET"/><uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/><application android:label="@string/app_name"><activity android:name=".MainActivity" android:exported="true"/></application></manifest>' }));
check(!r.row(r.req, 'play.fgs_declaration'), 'no foreground service → no declaration row', r.row(r.req, 'play.fgs_declaration'));
r = await run(BGAA({ 'android/app/build.gradle': GRADLE.replace('targetSdk 36', 'targetSdk 33') }));
check(!r.row(r.req, 'play.fgs_declaration'), 'targetSdk 33 → no foreground service declaration row', r.row(r.req, 'play.fgs_declaration'));
r = await run(BGAA({ 'android/app/src/main/AndroidManifest.xml': MANIFEST('<uses-permission android:name="com.google.android.gms.permission.AD_ID" tools:node="remove"/>').replace('<manifest ', '<manifest xmlns:tools="http://schemas.android.com/tools" ') }));
let ad = r.row(r.req, 'play.ads_declaration');
check(ad && /AD_ID is removed/.test(ad.finding) && /Contains ads: No/.test(ad.action) && /Advertising ID: No/.test(ad.action), 'AD_ID removed + no ads SDK → answer Contains ads No / Advertising ID No', ad);
r = await run(BGAA({ 'package.json': NO_ADS_PKG.replace('"@capacitor/core"', '"@capacitor-community/admob": "^6.0.0", "@capacitor/core"') }));
check(!r.row(r.req, 'play.ads_declaration') && (r.st.A.sdk.ads || ids(r.st).includes('adsDeclare')), 'an ads SDK in dependencies → no "answer No" row (ads declaration instead)', [r.row(r.req, 'play.ads_declaration'), ids(r.st)]);
r = await run(BGAA({ 'www/ads.js': null }));
check(!r.row(r.req, 'play.ads_declaration'), 'no ads code at all and AD_ID not removed → no ads row', r.row(r.req, 'play.ads_declaration'));
const MET = "export async function wx(lat, lon) {\n  const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat.toFixed(2)}&lon=${lon.toFixed(2)}`;\n  const res = await fetch(url); return res.json();\n}\nexport const here = () => new Promise(ok => navigator.geolocation.getCurrentPosition(p => ok(wx(p.coords.latitude, p.coords.longitude))));\n";
r = await run(BGAA({ 'www/weather.js': MET }));
let tp = r.row(r.pv, 'loc.third_party');
check(tp && tp.severity === 'check' && /api\.met\.no/.test(tp.finding) && /www\/weather\.js/.test(tp.finding) && /ephemeral/.test(tp.action), 'coordinates sent to api.met.no → third-party location row', tp);
r = await run(BGAA({ 'rocketlauncher.json': JSON.stringify({ privacy_url: 'https://moodtune.app/privacy' }), 'www/weather.js': MET.replace('https://api.met.no/weatherapi/locationforecast/2.0/compact', 'https://api.moodtune.app/weather') }));
check(!r.row(r.pv, 'loc.third_party'), 'coordinates sent to the app\'s own domain → no third-party row', r.row(r.pv, 'loc.third_party'));
r = await run(BGAA({ 'www/nav.js': "export const open = (lat, lng) => window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);\n" }));
check(!r.row(r.pv, 'loc.third_party'), 'a Google Maps directions link → no third-party row', r.row(r.pv, 'loc.third_party'));
r = await run(BGAA({ 'ios/App/App/Info.plist': PLIST(LOC_KEYS), 'ios/App/App/ko.lproj/InfoPlist.strings': '"NSCameraUsageDescription" = "가게 사진을 찍어 추천을 받습니다.";\n' }));
check(issue(r.st, 'missingUsage').some(i => i.vars.key === 'NSCameraUsageDescription'), 'permission strings: a localized camera string without the Info.plist key is still flagged', issue(r.st, 'missingUsage'));

console.log('\n[C] Gaddy: deletion URL, languages, listing, screenshots, package, precise location, CarPlay');
r = await run(BGAA({ 'www/app-config.js': "window.CFG = {\n  privacyUrl: 'https://moodtune.app/privacy',\n  deletionUrl: 'https://moodtune.app/delete-account',\n};\n" }));
check(r.st.A.deletionInfo && r.st.A.deletionInfo.url === 'https://moodtune.app/delete-account' && /app-config\.js$/.test(r.st.A.deletionInfo.urlSource), 'deletionUrl in an app config file → deletion URL found', r.st.A.deletionInfo);
r = await run(BGAA({ 'www/app-config.js': "window.CFG = { deletionUrl: 'https://example.com/delete' };\n" }));
check(!(r.st.A.deletionInfo && r.st.A.deletionInfo.url), 'an example.com placeholder deletion URL is ignored', r.st.A.deletionInfo);
r = await run(BGAA({ 'www/i18n.js': "var STR = {\n  en: { 'a.b': 'Hello' },\n  ko: { 'a.b': '안녕하세요' },\n};\n" }));
check(r.st.A.locales.includes('ko') && r.st.A.locales.includes('en'), 'i18n.js with en and ko dictionaries → ko in the app languages', r.st.A.locales);
r = await run(BGAA({ 'www/messages.js': "export const M = {\n  en: { hi: 'Hello' },\n};\n" }));
check(!r.st.A.locales.includes('ko') && r.st.A.locales.length === 1, 'one dictionary only → no extra languages', r.st.A.locales);
r = await run(BGAA({ 'android/app/build.gradle': GRADLE.replace('versionName "1.1.0" }', 'versionName "1.1.0" }\n androidResources { localeFilters += ["ko", "en"] }') }));
check(r.st.A.locales.includes('ko'), 'Gradle localeFilters ko → ko in the app languages', r.st.A.locales);
r = await run(BGAA({ 'artifacts/play/listing-ko-KR.txt': 'title: 무드튠\nshort: 가게에 맞는 배경 음악을 골라 드려요\n\nfull:\n무드튠은 작은 가게를 위한 배경 음악 앱입니다. 날씨와 시간에 맞춰 노래를 추천합니다.\n' }));
const pk = r.st.A.prepared && r.st.A.prepared.copy.ko;
check(pk && pk.title === '무드튠' && /배경 음악/.test(pk.short) && /작은 가게/.test(pk.full), 'listing-ko-KR.txt with title/short/full → prepared Korean listing', r.st.A.prepared && r.st.A.prepared.copy);
r = await run(BGAA({ 'artifacts/play/01-home-1080x1920.png': png(11), 'artifacts/play/02-list-1080x1920.png': png(12), 'artifacts/play/03-map-1080x1920.png': png(13), 'artifacts/screenshots/debug-run.png': png(14), 'metadata/screenshots/iphone/en/01-home.png': null, 'metadata/screenshots/iphone/en/02-player.png': null, 'metadata/screenshots/iphone/ko/01-home.png': null, 'metadata/screenshots/iphone/ko/02-player.png': null }));
const sp = r.st.A.screenshots.map(s => s.path);
check(sp.length === 3 && sp.every(p => p.startsWith('artifacts/play/')), 'store-folder screenshots (1080x1920) are used, the debug capture is not', sp);
r = await run(BGAA({ 'artifacts/screenshots/debug-run.png': png(14), 'artifacts/screenshots/debug-2.png': png(15), 'metadata/screenshots/iphone/en/01-home.png': null, 'metadata/screenshots/iphone/en/02-player.png': null, 'metadata/screenshots/iphone/ko/01-home.png': null, 'metadata/screenshots/iphone/ko/02-player.png': null }));
check(r.st.A.screenshots.length === 2, 'no store-folder screenshots → the screenshots folder is still used', r.st.A.screenshots.map(s => s.path));
r = await run(BGAA({ 'android/app/build.gradle': GRADLE.replace('applicationId "com.example.moodtune"', "applicationId accountProps.getProperty('appId', 'com.example.moodtune2')") }));
check(r.st.A.android.pkg === 'com.example.moodtune2', 'applicationId props.getProperty(key, default) → the default package', r.st.A.android.pkg);
r = await run(BGAA({ 'android/app/src/main/AndroidManifest.xml': MANIFEST('<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>'), 'www/weather.js': MET }));
let ds = r.pv.drafts.data_safety.rows.find(x => x.id === 'loc');
check(ds && /Precise location/.test(ds.playType), 'ACCESS_FINE_LOCATION + location sent → Data safety draft says Precise location', ds);
r = await run(BGAA({ 'www/weather.js': MET }));
ds = r.pv.drafts.data_safety.rows.find(x => x.id === 'loc');
check(ds && /Approximate location/.test(ds.playType), 'COARSE only → Data safety draft stays Approximate location', ds);
r = await run(BGAA({ 'ios/App/App/App.entitlements': ENT(CP_ENT), 'ios/App/App/Info.plist': PLIST(LOC_KEYS + CAM_KEY + CP_SCENE) }));
let cp = r.row(r.req, 'apple.carplay');
check(cp && cp.severity === 'check' && /provisioning profile/.test(cp.action) && /carplay/i.test(cp.source), 'CarPlay entitlement + scene → CarPlay entitlement check row', cp);
r = await run(BGAA({ 'ios/App/App/App.entitlements': ENT(CP_ENT), 'ios/App/App/CarPlaySceneDelegate.swift': null }));
cp = r.row(r.req, 'apple.carplay');
check(cp && cp.severity === 'warn', 'CarPlay entitlement without a CarPlay scene or code → warning', cp);
r = await run(BGAA());
check(!r.row(r.req, 'apple.carplay'), 'no CarPlay entitlement and CarPlay file not built → no CarPlay row', r.row(r.req, 'apple.carplay'));

console.log(`\n${pass} passed, ${failN} failed`);
fs.rmSync(HOME, { recursive: true, force: true });
if (failN) process.exit(1);
