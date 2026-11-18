/* Rocket Launcher 0.2.3 tests: blank / mismatched icons, ad SDKs only from real declarations, navigation category,
   privacy URL source order and conflicts (with a local link check), store stage never defaulted to not_submitted.
   Local fixtures only; the link check talks to a server on 127.0.0.1. Run: node test/fixes023.mjs */
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import zlib from 'node:zlib'; import http from 'node:http';
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'rocketlauncher-023-'));
process.env.ROCKETLAUNCHER_HOME = HOME;
process.env.ROCKETLAUNCHER_LESSONS_API = '';
process.env.ROCKETLAUNCHER_VERIFY_URLS = '0';
const E = await import('../lib/engine.mjs');
const I = await import('../lib/icons.mjs');
const { Flow } = await import('../lib/runtime.mjs');
let pass = 0, failN = 0;
const check = (c, name, extra) => { if (c) { pass++; console.log('  ✓', name); } else { failN++; console.log('  ✗', name, extra !== undefined ? JSON.stringify(extra).slice(0, 700) : ''); } };

/* ---------- tiny PNG encoder for fixtures ---------- */
const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return b => { let c = 0xffffffff; for (const x of b) c = t[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }; })();
function chunk(type, data) { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, 'latin1'), data]); const c = Buffer.alloc(4); c.writeUInt32BE(CRC(td)); return Buffer.concat([l, td, c]); }
/* f(x, y) → [r, g, b, a]; colorType 6 = RGBA, 2 = RGB; filter 1 (Sub) on odd rows to exercise un-filtering */
function png(w, h, f, colorType = 6) {
  const ch = colorType === 6 ? 4 : 3, rows = [];
  for (let y = 0; y < h; y++) {
    const raw = Buffer.alloc(w * ch); for (let x = 0; x < w; x++) { const p = f(x, y); for (let k = 0; k < ch; k++) raw[x * ch + k] = p[k] ?? 255; }
    if (y % 2) { const o = Buffer.alloc(w * ch); for (let i = 0; i < raw.length; i++) o[i] = (raw[i] - (i >= ch ? raw[i - ch] : 0)) & 255; rows.push(Buffer.from([1]), o); } else rows.push(Buffer.from([0]), raw);
  }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = colorType;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]);
}
const SOLID = png(256, 256, () => [0x0f, 0x76, 0x6e, 255], 2);
/* "artwork": a white rocket-ish shape (triangle + circle) on a teal background */
const art = (x, y, s = 256) => { const u = x / s, v = y / s; const inTri = v > 0.15 && v < 0.75 && Math.abs(u - 0.5) < (v - 0.15) * 0.45; const inDot = (u - 0.5) ** 2 + (v - 0.82) ** 2 < 0.006; return inTri || inDot ? [255, 255, 255, 255] : [0x0f, 0x76, 0x6e, 255]; };
const ART = png(256, 256, (x, y) => art(x, y), 2);
/* the same artwork as a legacy Android icon: transparent margin around it */
const ART_PADDED = png(256, 256, (x, y) => { const m = 24; if (x < m || y < m || x >= 256 - m || y >= 256 - m) return [0, 0, 0, 0]; return art(x - m, y - m, 256 - 2 * m); });
/* a different design: dark orange with a horizontal bar */
const OTHER = png(256, 256, (x, y) => (y > 100 && y < 150) || (x > 20 && x < 60) ? [20, 20, 20, 255] : [240, 140, 20, 255], 2);
const NOISE_FLAT = png(128, 128, (x, y) => [100 + ((x * 7 + y * 13) % 3), 100, 100, 255], 2);   // near-uniform: tiny noise only

let n = 0;
function project(files) {
  const dir = path.join(HOME, 'fx-' + (++n));
  for (const [p, c] of Object.entries(files)) { if (c == null) continue; const f = path.join(dir, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, c); }
  return dir;
}
const MANIFEST = (extra = '') => `<manifest xmlns:android="http://schemas.android.com/apk/res/android"><uses-permission android:name="android.permission.INTERNET"/><application android:label="Fixture" android:icon="@mipmap/ic_launcher">${extra}<activity android:name=".MainActivity" android:exported="true"/></application></manifest>`;
const GRADLE = (deps = '') => `plugins { id 'com.android.application' }\nandroid { namespace "com.example.fx"\n defaultConfig { applicationId "com.example.fx"\n minSdk 24\n targetSdk 36\n versionCode 1\n versionName "1.0.0" } }\ndependencies { ${deps} }\n`;
const PLIST = (extra = '') => `<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0"><dict><key>CFBundleIdentifier</key><string>com.example.fx</string><key>CFBundleDisplayName</key><string>Fixture</string>${extra}<key>ITSAppUsesNonExemptEncryption</key><false/></dict></plist>`;
const ICONSET = '{"images":[{"filename":"AppIcon-512@2x.png","idiom":"universal","platform":"ios","size":"1024x1024"}],"info":{"author":"xcode","version":1}}';
const base = (more = {}) => ({ 'app/src/main/AndroidManifest.xml': MANIFEST(), 'app/build.gradle': GRADLE(), 'ios/App/App/Info.plist': PLIST(), 'README.md': '# Fixture\n\nA small utility app.\n', ...more });
const connect = async (files, extra = {}) => E.connect({ source: 'path', path: project(files), ...extra }, { allowPath: true });
const ids = st => st.A.issues.map(i => i.id);

console.log('\n[1] icons: blank / near-uniform detection and iOS ↔ Android match');
const dec = I.decodePng(ART_PADDED);
check(dec.width === 256 && dec.data[3] === 0 && dec.data[(128 * 256 + 128) * 4 + 3] === 255, 'pure-JS PNG decoder reads RGBA with Sub filter and alpha');
const u = async b => I.uniformity(await I.pixels(b));
check((await u(SOLID)).blank && (await u(SOLID)).unique_colors === 1, 'solid color icon → blank', await u(SOLID));
check((await u(NOISE_FLAT)).blank, 'near-uniform icon (tiny noise only) → blank', await u(NOISE_FLAT));
check(!(await u(ART)).blank && !(await u(OTHER)).blank, 'icons with artwork → not blank');
const durl = b => 'data:image/png;base64,' + b.toString('base64');
let ic = await I.iconCheck({ ios: { path: 'i.png', dataUrl: durl(ART) }, android: { path: 'a.png', dataUrl: durl(ART_PADDED) } });
check(ic.match.similar, 'same artwork, full-bleed vs padded legacy icon → match', ic.match);
ic = await I.iconCheck({ ios: { path: 'i.png', dataUrl: durl(ART) }, android: { path: 'a.png', dataUrl: durl(OTHER) } });
check(!ic.match.similar, 'different designs → mismatch', ic.match);
let { st, report } = await connect(base({ 'ios/App/App/Assets.xcassets/AppIcon.appiconset/Contents.json': ICONSET, 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png': SOLID, 'app/src/main/res/mipmap-xxxhdpi/ic_launcher.png': ART }));
check(report.app.icon_found === true && report.app.icon_check.ios.blank === true && report.app.icon_check.ios.average_color === '#0F766E', 'report: icon found but the iOS 1024 icon is flagged blank (#0F766E)', report.app.icon_check);
const blankIss = st.A.issues.find(i => i.id === 'iconBlank');
check(blankIss && blankIss.sev === 'warn' && blankIss.plat === 'ios' && report.issues.some(i => /no artwork/.test(i.title)), 'iconBlank warning on the App Store side', st.A.issues);
check(ids(st).includes('iconMismatch'), 'iOS (blank) vs Android (artwork) → iconMismatch warning');
check(st.A.icon.path.includes('mipmap-xxxhdpi'), 'store graphics use the icon with artwork, not the blank one', st.A.icon.path);
({ st } = await connect(base({ 'ios/App/App/Assets.xcassets/AppIcon.appiconset/Contents.json': ICONSET, 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png': ART, 'app/src/main/res/mipmap-xxxhdpi/ic_launcher.png': ART_PADDED })));
check(!ids(st).includes('iconBlank') && !ids(st).includes('iconMismatch'), 'matching real icons → no icon warnings', ids(st));
check(['en', 'ko', 'th', 'zh', 'hi'].every(l => ['iconBlank', 'iconMismatch', 'adsCodeOnly', 'privacyUrlConflict', 'privacyUrlUnsure', 'privacyUrlDead'].every(k => globalThis.window.RL_I18N[l]['iss.' + k + '.t'] && globalThis.window.RL_I18N[l]['iss.' + k + '.w'])), 'new issue texts in en/ko/th/zh/hi');

console.log('\n[2] ads: only real declarations count; code-only mentions are info');
const CFG_JS = "window.APP = { adsEnabled: false, ads: { provider: 'admob', appId: 'ca-app-pub-0000000000000000~0000000000' } };\n";
({ st, report } = await connect(base({ 'app/src/main/assets/public/app-config.js': CFG_JS, 'app/src/main/assets/public/vendor/x/ads.min.js': 'var a="google-mobile-ads admob";' })));
check(st.A.sdk.ads === false && !ids(st).includes('adsDeclare') && !ids(st).includes('adsNpa'), 'admob only in bundled app config JS → no ads, no adsDeclare / adsNpa warnings', ids(st));
/* 0.2.6: adsEnabled: false → the leftover block is reported as switched off (ads_disabled), not as a hint */
check(!st.A.issues.some(i => i.id === 'adsCodeOnly') && report.app.ads_disabled && /app-config\.js/.test(report.app.ads_disabled.files.join(',')), 'ads block switched off (adsEnabled: false) → no hint, reported as ads_disabled', report.app.ads_disabled);
({ st, report } = await connect(base({ 'app/src/main/assets/public/app-config.js': CFG_JS.replace('adsEnabled: false, ', ''), 'app/src/main/assets/public/vendor/x/ads.min.js': 'var a="google-mobile-ads admob";' })));
const hint = st.A.issues.find(i => i.id === 'adsCodeOnly');
check(hint && hint.sev === 'tip' && /app-config\.js/.test(hint.vars.files) && !/vendor/.test(hint.vars.files) && report.app.ads_hint, 'string-only match → info-level hint naming the file (vendor bundle ignored)', hint);
({ st } = await connect(base({ 'app/src/main/AndroidManifest.xml': MANIFEST('<meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="ca-app-pub-0~0"/>') })));
check(st.A.sdk.ads && ids(st).includes('adsDeclare'), 'AndroidManifest ads APPLICATION_ID → ads');
({ st } = await connect(base({ 'app/build.gradle': GRADLE("implementation 'com.google.android.gms:play-services-ads:23.2.0'") })));
check(st.A.sdk.ads, 'Gradle play-services-ads dependency → ads');
({ st } = await connect(base({ 'ios/App/App/Info.plist': PLIST('<key>GADApplicationIdentifier</key><string>ca-app-pub-0~0</string>') })));
check(st.A.sdk.ads && ids(st).includes('adsNpa'), 'Info.plist GADApplicationIdentifier → ads');
({ st } = await connect(base({ 'package.json': JSON.stringify({ name: 'fx', dependencies: { '@capacitor/core': '6.0.0', '@capacitor-community/admob': '6.0.0' } }) })));
check(st.A.sdk.ads, 'package.json @capacitor-community/admob dependency → ads');
({ st } = await connect(base({ 'ios/Podfile': "platform :ios, '15.0'\n# pod 'Google-Mobile-Ads-SDK'  (later)\npod 'FirebaseAuth'\n" })));
check(!st.A.sdk.ads, 'commented-out pod in Podfile → no ads');

console.log('\n[3] category: navigation for fuel / map apps in several languages');
const catOf = async readme => (await connect(base({ 'README.md': readme }))).st.A.categories;
let c = await catOf('# 가디 — 가장 쉬운 주유소 찾기\n\n주변 주유소 유가를 지도에서 보고 길찾기를 내비 앱으로 넘겨요.\n\nApp Store, Google Play 출시 예정.\n');
check(c[0] === 'navigation' && !c.includes('shopping'), 'Korean gas-station app → navigation first (App Store mention is not shopping)', c);
c = await catOf('# PumpFinder\n\nFind the cheapest petrol and diesel at gas stations near me, with a map and route to the station.\n');
check(c[0] === 'navigation', 'English fuel / gas station app → navigation', c);
c = await catOf('# ปั๊มใกล้ฉัน\n\nเช็คราคาน้ำมันและแผนที่ปั๊มน้ำมันใกล้ตัว\n');
check(c[0] === 'navigation', 'Thai fuel price app (น้ำมัน, แผนที่) → navigation', c);
c = await catOf('# Unit Calc\n\nA calculator and unit converter.\n');
check(c[0] === 'tools' && !c.includes('navigation'), 'calculator stays tools', c);
const nav = globalThis.window.RLGen.CAT.navigation;
check(nav.play === 'Maps & Navigation' && nav.apple === 'Navigation' && ['en', 'ko', 'th', 'zh', 'hi'].every(l => nav[l] && nav.benefit[l]), 'navigation maps to Play "Maps & Navigation" / Apple "Navigation" in five languages');
({ st } = await connect(base({ 'rocketlauncher.json': JSON.stringify({ category: 'travel' }), 'README.md': '# Fuel\n\nGas station map.\n' })));
check(st.A.categories[0] === 'travel', 'project config category wins', st.A.categories);

console.log('\n[4] privacy URL: source order, old folders skipped, disagreements reported');
({ st, report } = await connect(base({ 'old-site/privacy.html': '<link rel="canonical" href="https://old.example-app.net/privacy.html">', 'site-old/x/privacy.html': '<a href="https://older.example-app.net/privacy">p</a>', 'README.md': '# Fixture\n\nPrivacy: https://new.example-app.net/privacy\n' })));
check(report.app.privacy_url_found === 'https://new.example-app.net/privacy' && !ids(st).includes('privacyUrlConflict'), 'README URL used; archived old-site / site-old pages ignored', report.app);
({ st, report } = await connect(base({ 'site/privacy.html': '<link rel="canonical" href="https://legacy.example-app.net/privacy.html">', 'README.md': '# Fixture\n\nNo link here.\n' })));
check(report.app.privacy_url_found === null && report.app.privacy_url_candidates.length === 1 && /not adopted/.test(report.app.privacy_url_warning) && ids(st).includes('privacyUrlUnsure'), 'URL only in a loose website page → not adopted silently; candidate + confirm warning', report.app);
check(st.A.developer.policyFound, 'a local policy page still counts as having a policy');
({ st, report } = await connect(base({ 'app.json': JSON.stringify({ expo: { name: 'Fixture', extra: { privacyUrl: 'https://app.example-app.net/privacy' } } }), 'README.md': '# Fixture\n\nPrivacy: https://readme.example-app.net/privacy\n' })));
check(report.app.privacy_url_found === 'https://app.example-app.net/privacy' && ids(st).includes('privacyUrlConflict') && report.app.privacy_url_candidates.length === 2 && /disagree/.test(report.app.privacy_url_warning), 'app config beats README; both reported with a conflict warning', report.app);
({ st, report } = await connect(base({ 'rocketlauncher.json': JSON.stringify({ privacy_url: 'https://cfg.example-app.net/privacy' }), 'fastlane/metadata/en-US/privacy_url.txt': 'https://meta.example-app.net/privacy\n', 'README.md': '# Fixture\n\nPrivacy: https://cfg.example-app.net/privacy\n' })));
check(report.app.privacy_url_found === 'https://cfg.example-app.net/privacy' && /project config/.test(report.app.privacy_url_source) && ids(st).includes('privacyUrlConflict'), 'project config first; store metadata that disagrees is still reported', report.app);
/* reachability: HEAD with timeout against a local server (404 → check issue, 200 → fine) */
const srv = http.createServer((q, r) => { r.statusCode = /missing/.test(q.url) ? 404 : 200; r.end(q.method === 'HEAD' ? undefined : 'ok'); });
await new Promise(res => srv.listen(0, '127.0.0.1', res)); const port = srv.address().port;
process.env.ROCKETLAUNCHER_VERIFY_URLS = '1';
({ st, report } = await connect(base({ 'rocketlauncher.json': JSON.stringify({ privacy_url: `http://127.0.0.1:${port}/missing-privacy` }) })));
check(ids(st).includes('privacyUrlDead') && report.app.privacy_url_candidates[0].http_status === 404, 'privacy URL answering 404 → "does not open" check', report.app);
({ st, report } = await connect(base({ 'rocketlauncher.json': JSON.stringify({ privacy_url: `http://127.0.0.1:${port}/privacy` }) })));
check(!ids(st).includes('privacyUrlDead') && report.app.privacy_url_found.endsWith('/privacy'), 'privacy URL answering 200 → no warning');
({ st } = await connect(base({ 'rocketlauncher.json': JSON.stringify({ privacy_url: 'http://127.0.0.1:9/privacy' }) })));
check(!ids(st).includes('privacyUrlDead'), 'network failure is not fatal and not reported as a dead page');
process.env.ROCKETLAUNCHER_VERIFY_URLS = '0'; srv.close();

console.log('\n[5] store stage: recorded states are respected; unknown is never not_submitted');
check(Flow.stageFromState('WAITING_FOR_REVIEW') === 'in_review' && Flow.stageFromState('IN_REVIEW') === 'in_review' && Flow.stageFromState('READY_FOR_SALE') === 'live' && Flow.stageFromState('METADATA_REJECTED') === 'rejected' && Flow.stageFromState('PREPARE_FOR_SUBMISSION') === 'not_submitted' && Flow.stageFromState('whatever') === null, 'App Store Connect states map to stages');
({ st, report } = await connect(base({ 'rocketlauncher.json': JSON.stringify({ app_store_state: 'WAITING_FOR_REVIEW' }) })));
check(st.dec['stage:apple'] === 'in_review' && st.review.apple && st.review.apple.status === 'in_review' && report.store_stage['App Store'].recommended === 'in_review' && /project config/.test(report.store_stage['App Store'].recorded), 'App Store Connect state in project config → App Store = in review (recorded)', report.store_stage);
check(report.store_stage['Google Play'].recommended === 'unknown' && !st.dec['stage:play'], 'the other store stays unknown — please confirm');
({ st } = await connect(base({ 'rocketlauncher.json': JSON.stringify({ store_stage: { apple: 'rejected' } }) }), { store_stage: { apple: 'live' } }));
check(st.dec['stage:apple'] === 'live', 'store_stage passed by the user wins over the config');
/* an earlier project for the same app recorded "in review": recommended, not silently set, never replaced by not_submitted */
const prev = (await connect(base({}), { store_stage: { apple: 'in_review', play: 'not_submitted' } })).st;
({ st, report } = await connect(base({})));
const as = report.store_stage['App Store'];
check(as.recommended === 'in_review' && new RegExp(prev.id).test(as.recorded) && !st.dec['stage:apple'], 'earlier project for the same app was in review → recommended in_review (asked, not assumed)', as);
check(report.store_stage['Google Play'].recommended === 'unknown', 'an earlier not_submitted is not carried over as a fact', report.store_stage['Google Play']);
const d = E.decide(st, { accept_all_recommended: true }, 'en');
check(!st.dec['stage:apple'] && !st.dec['stage:play'] && d.stage_not_picked, 'accept-all never picks a stage that is unknown or only recorded elsewhere');
const re = E.load(prev.id);
check(E.report(re, 'en').store_stage['App Store'].recommended === 'in_review', 'a project with a recorded in_review stage never shows not_submitted as the recommendation');
const sample = (await E.connect({ source: 'sample' }, { allowPath: true })).st;
check(E.report(sample, 'en').store_stage['Google Play'].recommended === 'not_submitted', 'the demo sample is still a known first submit');

console.log(`\n${pass} passed, ${failN} failed`);
fs.rmSync(HOME, { recursive: true, force: true });
process.exit(failN ? 1 : 0);
