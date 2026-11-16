/* Rocket Launcher 0.2.0 release-check tests: a fixture app with location, ads, sign-in, Swift required-reason APIs,
   a 4 KB-aligned native library and a tester opt-in page. Run: node test/release.mjs */
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'rocketlauncher-release-'));
process.env.ROCKETLAUNCHER_HOME = HOME;
process.env.ROCKETLAUNCHER_TODAY = '2026-11-17';
process.env.ROCKETLAUNCHER_LESSONS_API = process.env.ROCKETLAUNCHER_LESSONS_API || '';
const E = await import('../lib/engine.mjs');
const RL = await import('../lib/release.mjs');
let pass = 0, failN = 0;
const check = (c, name, extra) => { if (c) { pass++; console.log('  ✓', name); } else { failN++; console.log('  ✗', name, extra !== undefined ? JSON.stringify(extra).slice(0, 500) : ''); } };
const NON_EN = /[\uAC00-\uD7A3\u0E00-\u0E7F\u4E00-\u9FFF\u0900-\u097F]/;

/* 64-bit ELF with one PT_LOAD aligned to `align` bytes */
function elf(align) {
  const b = Buffer.alloc(64 + 56);
  b.write('\x7fELF', 0, 'latin1'); b[4] = 2; b[5] = 1; b[6] = 1;
  b.writeUInt16LE(3, 16); b.writeUInt16LE(183, 18); b.writeUInt32LE(1, 20);
  b.writeBigUInt64LE(64n, 32); b.writeUInt16LE(64, 52); b.writeUInt16LE(56, 54); b.writeUInt16LE(1, 56);
  b.writeUInt32LE(1, 64); b.writeBigUInt64LE(BigInt(align), 64 + 48);
  return b;
}
const APP = path.join(HOME, 'fuelapp');
const W = (p, c) => { fs.mkdirSync(path.dirname(path.join(APP, p)), { recursive: true }); fs.writeFileSync(path.join(APP, p), c); };
W('README.md', '# FuelFinder\n\nFind the cheapest fuel near you.\n\n## Features\n- Nearby fuel prices on a map\n- Price alerts\n');
W('settings.gradle.kts', 'rootProject.name = "FuelFinder"\ninclude(":app")\n');
W('build.gradle.kts', 'plugins { id("com.android.application") version "8.3.0" apply false }\n');
W('app/build.gradle.kts', `plugins { id("com.android.application") }
android { namespace = "com.example.fuelfinder"; compileSdk = 34
  defaultConfig { applicationId = "com.example.fuelfinder"; minSdk = 24; targetSdk = 34; versionCode = 7; versionName = "1.2" } }
dependencies {
  implementation("com.google.android.gms:play-services-ads:23.2.0")
  implementation("com.google.firebase:firebase-auth")
  implementation("com.google.android.gms:play-services-auth:21.2.0")
  implementation("com.google.android.gms:play-services-location:21.3.0")
  implementation("com.google.firebase:firebase-config")
}
`);
W('app/src/main/AndroidManifest.xml', `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <uses-permission android:name="android.permission.INTERNET" />
  <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
  <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
  <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
  <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
  <application android:label="FuelFinder">
    <meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="ca-app-pub-3940256099942544~3347511713" />
    <activity android:name=".MainActivity" android:exported="true" />
  </application>
</manifest>
`);
W('app/src/main/java/com/example/fuelfinder/MainActivity.kt', `package com.example.fuelfinder
class MainActivity { fun send(lat: Double, lng: Double) { api.post("https://api.example.com/nearby", mapOf("lat" to lat, "lng" to lng)) }
  val minVersion = remoteConfig.getString("min_version") }
`);
W('app/src/main/res/values/strings.xml', '<resources><string name="app_name">FuelFinder</string></resources>\n');
W('app/src/main/jniLibs/arm64-v8a/libold.so', elf(4096));
W('app/src/main/jniLibs/arm64-v8a/libnew.so', elf(16384));
W('app/google-services.json', '{"project_info":{"project_id":"placeholder"}}');
W('ios/Runner/Info.plist', `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict>
<key>CFBundleDisplayName</key><string>FuelFinder</string>
<key>NSLocationWhenInUseUsageDescription</key><string>Shows fuel stations near you.</string>
<key>NSUserTrackingUsageDescription</key><string>Used for ads.</string>
<key>GADApplicationIdentifier</key><string>ca-app-pub-3940256099942544~1458002511</string>
</dict></plist>
`);
W('ios/Runner.xcodeproj/project.pbxproj', 'PRODUCT_BUNDLE_IDENTIFIER = com.example.fuelfinder;\nMARKETING_VERSION = 1.2.0;\nCURRENT_PROJECT_VERSION = 3;\nIPHONEOS_DEPLOYMENT_TARGET = 12.0;\nLastUpgradeCheck = 1540;\n');
W('ios/Runner/AppDelegate.swift', 'import UIKit\nlet d = UserDefaults.standard\nlet up = ProcessInfo.processInfo.systemUptime\n// creationDate in a comment must not count\n');
W('ios/Runner/PrivacyInfo.xcprivacy', '<plist><dict><key>NSPrivacyTracking</key><false/><key>NSPrivacyAccessedAPITypes</key><array><dict><key>NSPrivacyAccessedAPIType</key><string>NSPrivacyAccessedAPICategoryUserDefaults</string></dict></array></dict></plist>\n');
W('.xcode-version', '15.4\n');
W('docs/testers.html', '<html><body><a href="https://play.google.com/apps/testing/com.example.fuelfinder">Join</a></body></html>');
W('docs/privacy.html', '<html><body>We use your location to show nearby stations.</body></html>');

console.log('\n[release] fixture connect');
const { st, report } = await E.connect({ source: 'path', path: APP, store_stage: 'not_submitted' }, { allowPath: true });
const id = st.id;
check(st.X && st.X.natives && st.X.natives.libs.length === 2, 'native libraries read', st.X && st.X.natives);
check(st.X.notable.some(p => /google-services\.json$/.test(p)), 'notable config file listed by path');
check(report.release_checks && report.release_checks.counts.block > 0, 'get_report includes release_checks', report.release_checks);
check(!NON_EN.test(JSON.stringify(report.release_checks)), 'release_checks default English');

console.log('\n[H1] requirements');
const q = await E.release('requirements', id, {}, 'en');
const row = k => q.rows.find(r => r.id === k) || {};
check(row('play.target_api_36').severity === 'block', 'targetSdk 34 → must fix');
check(row('play.16kb_page_size').severity === 'block' && /libold\.so/.test(row('play.16kb_page_size').finding) && !/libnew/.test(row('play.16kb_page_size').finding), '4 KB-aligned .so flagged, 16 KB one passes', row('play.16kb_page_size'));
check(row('play.16kb_page_size').conservative === true, '16 KB rule marked conservative');
check(row('apple.xcode_26').severity === 'block' && /15\.4/.test(row('apple.xcode_26').finding), '.xcode-version 15.4 → Xcode 26 must fix');
check(row('apple.min_target_ios13').severity === 'block', 'iOS 12 deployment → must fix');
check(row('apple.privacy_manifest_reasons').severity === 'block' && /SystemBootTime/.test(row('apple.privacy_manifest_reasons').finding) && !/FileTimestamp/.test(row('apple.privacy_manifest_reasons').finding), 'undeclared systemUptime found, commented API ignored', row('apple.privacy_manifest_reasons'));
check(q.rows.every(r => r.source && /^https:\/\//.test(r.source) && r.verified_on), 'every row has a source URL and verified_on');
check(row('play.target_api_36').days_left === undefined || row('play.target_api_36').days_left >= 0, 'days_left never negative');

console.log('\n[H3] privacy');
const p = await E.release('privacy', id, {}, 'en');
const pr = k => p.rows.find(r => r.id === k);
check(pr('loc.background') && pr('loc.background').severity === 'block', 'background location flagged');
check(pr('att.mixed') && pr('att.mixed').severity === 'block', 'mixed ATT setup flagged');
check(pr('photo.play'), 'READ_MEDIA_IMAGES → photo picker advice');
check(pr('xcprivacy.reasons'), 'missing required-reason entry flagged');
check(/NSPrivacyAccessedAPICategorySystemBootTime[\s\S]*35F9\.1/.test(p.drafts.privacy_manifest) && /CA92\.1/.test(p.drafts.privacy_manifest), 'xcprivacy draft has UserDefaults + SystemBootTime reasons');
check(Array.isArray(p.drafts.data_safety.rows) && p.drafts.app_privacy, 'Data safety + App Privacy drafts');

console.log('\n[H4] policy audit');
const pa = await E.release('policy', id, {}, 'en');
check(pa.applies && pa.quick_scan.permissions_and_apis.review_against.some(x => x.id === 'location_access_policy'), 'location policy listed');
check(pa.full_audit && fs.existsSync(pa.full_audit.skill), 'bundled SKILL.md path exists');
check(pa.attribution.license === 'Apache-2.0' && fs.existsSync(pa.attribution.notice), 'Apache-2.0 attribution + NOTICE');

console.log('\n[H5] reviewer notes');
const rn = await E.release('notes', id, { default_location: 'Bangkok' }, 'en');
check(/Bangkok/.test(rn.apple_review_notes) && /2\.5\.19/.test(rn.apple_review_notes), 'notes: default location + no hidden features');
check(/Remote configuration/.test(rn.apple_review_notes), 'remote config disclosed');
check(rn.play_app_access && !/password\s*[:=]\s*\w/i.test(JSON.stringify(rn)), 'no password values in notes');

console.log('\n[H6] deletion');
const d = await E.release('deletion', id, {}, 'en');
check(d.required && d.rows.find(r => r.id === 'in_app').severity === 'block', 'sign-in without delete path → must fix');
W('app/src/main/java/com/example/fuelfinder/Account.kt', 'fun deleteAccount() { user?.delete() }\n');
W('docs/delete-account.html', '<html>Delete your account</html>');

console.log('\n[H2] closed test');
let ct = await E.release('closed_test', id, { action: 'status', account_type: 'personal_new' }, 'en');
check(ct.required === true && ct.qualified_testers === 0, 'personal_new → required');
const testers = Array.from({ length: 13 }, (_, k) => ({ label: 'T' + (k + 1), opted_in: '2026-11-01' }));
ct = await E.release('closed_test', id, { action: 'record', testers }, 'en');
check(ct.qualified_testers === 13 && ct.ready_to_apply, '13 testers since 11-01 → ready on 11-17', ct);
ct = await E.release('closed_test', id, { action: 'record', testers: [{ label: 'T1', opted_out: '2026-11-10' }, { label: 'T2', opted_out: '2026-11-10' }] }, 'en');
check(ct.qualified_testers === 11 && !ct.ready_to_apply, 'two drop-outs → 11, not ready');
ct = await E.release('closed_test', id, { action: 'record', testers: [{ label: 'T1', opted_in: '2026-11-12' }] }, 'en');
check(ct.qualified_testers === 11 && ct.earliest_apply_date === '2026-11-26', 'rejoin restarts the 14 days (earliest 11-26)', ct.earliest_apply_date);
check(ct.testers.find(t => t.label === 'T1').restarted === 1, 'restart recorded');
let threw = false; try { await E.release('closed_test', id, { action: 'record', testers: [{ label: 'X', opted_in: '17/11/2026' }] }, 'en'); } catch { threw = true; }
check(threw, 'bad date refused');
const draft = await E.release('closed_test', id, { action: 'application_draft' }, 'en');
check(draft.sections && draft.sections.about_your_closed_test && /14\+ days/.test(draft.sections.about_your_closed_test.engagement), 'application draft');
const rc = await E.release('closed_test', id, { action: 'recruit_copy', opt_in_link: 'https://play.google.com/apps/testing/com.example.fuelfinder' }, 'en');
check(['en', 'ko', 'th', 'zh', 'hi'].every(l => rc.messages[l] && rc.messages[l].includes('FuelFinder') && rc.messages[l].includes('apps/testing')), 'recruit copy in 5 languages');
const op = await E.release('closed_test', id, { action: 'check_optin_page' }, 'en');
check(op.pages && op.pages[0].rows.find(r => r.id === 'in_app_browser').severity === 'warn', 'opt-in page without in-app-browser escape → warn', op);
const op2 = await E.release('closed_test', id, { action: 'check_optin_page', html: '<a href="https://play.google.com/apps/testing/x?openExternalBrowser=1">Join</a> Stay 14 days' }, 'en');
check(op2.rows.every(r => r.severity === 'ok'), 'good opt-in page passes');

console.log('\n[H7] move plan');
let mv = await E.release('move', id, {}, 'en');
check(!mv.chosen && mv.paths.length === 2 && mv.paths.map(x => x.id).join() === 'transfer,new_registration', 'no path → both paths, neutral');
mv = await E.release('move', id, { path: 'new_registration', has_ads: false }, 'en');
const ids = mv.plan.steps.map(s => s.id);
check(['ids', 'signing', 'firebase', 'closed_test', 'listing'].every(x => ids.includes(x)), 'new registration covers ids, signing, Firebase, closed test, listing', ids);
check(!ids.includes('admob'), 'no AdMob step when the app has no ads');
mv = await E.release('move', id, { path: 'new_registration', has_ads: true }, 'en');
check(mv.plan.steps.find(s => s.id === 'admob').optional === true, 'AdMob step optional, only with ads');
mv = await E.release('move', id, { path: 'transfer' }, 'en');
check(mv.chosen === 'transfer' && mv.plan.steps.some(s => s.id === 'play_ids'), 'transfer plan');
threw = false; try { await E.release('move', id, { key_backup_location: 'storePassword=hunter2' }, 'en'); } catch { threw = true; }
check(threw, 'secret-looking key location refused');
mv = await E.release('move', id, { key_backup_location: 'password manager vault: Android keys' }, 'en');
check(mv.key_backup_location === 'password manager vault: Android keys', 'key backup location saved');

console.log('\n[M1] remove guide');
const rg = E.removeGuide('play', 'en');
check(rg.guides.length === 1 && rg.guides[0].delete.some(x => /1,000 active devices/.test(x)) && rg.guides[0].delete.some(x => /zero lifetime installs/.test(x)), 'Play delete conditions');
check(E.removeGuide(undefined, 'en').guides.length === 2, 'both stores');

console.log('\n[M2/M3] versions');
let vs = await E.release('version', id, { used_versions: ['1.2'] }, 'en');
check(vs.rows.some(r => r.id === 'apple_equivalent' && r.severity === 'block'), 'iOS 1.2.0 vs used 1.2 → same version for Apple', vs.rows);
check(vs.rows.find(r => r.id === 'cross_platform').severity === 'ok', '1.2 == 1.2.0 across platforms');
vs = await E.release('version', id, { used_version_codes: [9], server_min_version: '1.3.0', store_visible: '1.2.0' }, 'en');
check(vs.rows.some(r => r.id === 'version_code' && r.severity === 'block'), 'versionCode not higher → must fix');
check(vs.rows.some(r => r.id === 'server_min_version' && r.severity === 'block'), 'force-update above store version → must fix');
check(vs.suggested_next.android_versionCode === 10, 'next versionCode 10');

console.log('\n[M5] countries');
const cc = await E.release('countries', id, { developer_country: 'TH' }, 'en');
const cr = k => cc.rows.find(r => r.id === k) || {};
check(['warn', 'check'].includes(cr('kr.lbs_report').severity), 'KR LBS: location used, not yet answered on-device → shown', cr('kr.lbs_report'));
check(cr('kr.apple_seller_info').severity === 'ok', 'KR seller info: TH developer → not required');
check(cr('th.pdpa').severity === 'warn', 'TH PDPA: no Thai policy → warn');
const cko = await E.release('countries', id, {}, 'ko');
check(/[\uAC00-\uD7A3]/.test(cko.title), 'Korean title');

console.log('\n[guide] release-checks step');
await E.decide(E.load(id), { accept_all_recommended: true }, 'en');
const g = E.guide(E.load(id), 'play', 'en');
const gi = g.steps.findIndex(s => s.id === 'release-checks'), fi = g.steps.findIndex(s => s.final);
check(gi >= 0 && (fi < 0 || gi < fi), 'release-checks step before the final step');

console.log('\n[data] rule table');
check(RL.REQ.verified_on && RL.REQ.requirements.every(r => r.source && r.verified_on && r.rule), 'every rule has rule text, source, verified_on');
const all = JSON.stringify(RL.REQ);
check(!/13628312|9888072|9898842/.test(all), 'unresolved Play help links dropped');


console.log('\n[0.2.2] hybrid web assets, deletion, location, firebase, corrections');
const HYB = path.join(HOME, 'hybridapp');
const WH = (p, c) => { fs.mkdirSync(path.dirname(path.join(HYB, p)), { recursive: true }); fs.writeFileSync(path.join(HYB, p), c); };
WH('app/src/main/AndroidManifest.xml', `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="com.example.nearby">
  <uses-sdk android:minSdkVersion="24" android:targetSdkVersion="35"/>
  <uses-permission android:name="android.permission.INTERNET"/>
  <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
  <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
  <application android:label="Nearby Places"><activity android:name=".MainActivity" android:exported="true"/></application>
</manifest>
`);
WH('app/src/main/assets/capacitor.config.json', '{"appId":"com.example.nearby","appName":"Nearby Places","webDir":"public"}');
WH('app/src/main/assets/capacitor.plugins.json', `[
  {"pkg":"@capacitor-firebase/authentication","classpath":"io.example.FirebaseAuthenticationPlugin"},
  {"pkg":"@capacitor/geolocation","classpath":"com.capacitorjs.plugins.geolocation.GeolocationPlugin"}
]`);
WH('app/src/main/assets/public/auth.js', `
function deleteAuthUser() { return prov.deleteUser(); }
function currentName() { return auth.currentUser && auth.currentUser.displayName; }
function currentEmail() { return auth.currentUser && auth.currentUser.email; }
`);
WH('app/src/main/assets/public/account.js', `
function runDelete() {
  return D.deleteAccount(env).then(function () { return U.deleteRemote(env, u, auth.getToken); }).then(function () { return auth.deleteAuthUser(); }).then(wipeLocalAll);
}
`);
WH('app/src/main/assets/public/data.js', `
function deleteAccount(env) {
  return env.fetch('api/account', { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } });
}
function nearby(env, loc) {
  var path = 'api/places/nearby?lat=' + encodeURIComponent(loc.lat) + '&lng=' + encodeURIComponent(loc.lng);
  return getJson(env, path);
}
function getJson(env, path) { return env.fetch(path).then(function (r) { return r.json(); }); }
`);
WH('app/src/main/assets/public/locate.js', `
function here() {
  if (plugin && plugin.getCurrentPosition) return plugin.getCurrentPosition({ enableHighAccuracy: true });
  return navigator.geolocation.getCurrentPosition(function (p) { return p; });
}
`);
WH('app/src/main/assets/public/i18n.js', `var STR = { 'acct.delete': '내 계정 삭제', 'acct.title': 'My account' };`);
WH('app/src/main/assets/public/sync.js', `
var fb = (cfg.firebase || {});
var base = (fb.firestoreBase || 'https://firestore.googleapis.com/v1').replace(/\\/+$/, '');
function pull(uid) { return env.fetch(base + '/projects/' + fb.projectId + '/databases/(default)/documents/users/' + uid); }
`);
WH('server/places-proxy.mjs', `export function handle(req) { if (req.url.startsWith('/api/places/nearby')) return nearby(req); }\n`);
WH('README.md', '# Nearby Places\nSign in to save favourites. Location is used to list places nearby.\n');

const hyb = await E.connect({ source: 'path', path: HYB, store_stage: 'not_submitted' }, { allowPath: true });
const hid = hyb.st.id, HA = hyb.st.A, HX = hyb.st.X;
check(HA.framework === 'capacitor', 'hybrid: capacitor framework', HA.framework);
check(HA.sdk.auth, 'hybrid: Firebase Auth detected from web JS / plugins', HA.sdk);
check(HA.sdk.cloudDb, 'hybrid: Firestore detected from web JS', HA.sdk);
check(HA.sdk.location, 'hybrid: location SDK detected');
check(HA.review.deletionInApp === true, 'hybrid: in-app deletion found', HA.review);
check(HA.review.locationSent === true && HA.review.locationConfidence === 'certain', 'hybrid: location sent to server (certain)', HA.review);
check((HA.review.locationKinds || []).includes('query_string') && (HA.review.locationKinds || []).includes('wrapper_fetch'), 'hybrid: lat/lng query string + wrapper fetch', HA.review.locationKinds);
check(!HA.issues.some(i => i.id === 'accountDeletion' && i.sev === 'block'), 'hybrid: no false missing-deletion block');
const hd = await E.release('deletion', hid, {}, 'en');
check(hd.rows.find(r => r.id === 'in_app').severity === 'ok', 'hybrid deletion check: in-app ok', hd.rows);
const hp = await E.release('privacy', hid, {}, 'en');
const locRow = hp.rows.find(r => r.id === 'loc.ok' || r.id === 'loc.precise' || r.id === 'loc.confirm');
check(locRow && locRow.id !== 'loc.confirm' && /sent to the server/i.test(locRow.finding || hp.rows.map(x => x.finding).join(' ') + JSON.stringify(hp.drafts && hp.drafts.data_safety)), 'hybrid privacy: location treated as sent', locRow);
check(hp.drafts.data_safety.rows.some(r => /location/i.test(JSON.stringify(r))), 'hybrid Data safety draft includes location');
check(hp.drafts.data_safety.rows.some(r => /email|user id|name/i.test(JSON.stringify(r).toLowerCase())), 'hybrid Data safety draft includes Firebase Auth types', hp.drafts.data_safety.rows);

/* correction: start from an app that looks like device-only, then override */
const COR = path.join(HOME, 'corrapp');
const WC = (p, c) => { fs.mkdirSync(path.dirname(path.join(COR, p)), { recursive: true }); fs.writeFileSync(path.join(COR, p), c); };
WC('app/src/main/AndroidManifest.xml', `<?xml version="1.0" encoding="utf-8"?>
<manifest package="com.example.corr"><uses-sdk android:minSdkVersion="24" android:targetSdkVersion="35"/>
  <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
  <application android:label="Corr"><activity android:name=".MainActivity" android:exported="true"/></application>
</manifest>`);
WC('app/build.gradle.kts', 'dependencies { implementation("com.google.firebase:firebase-auth") }\nandroid { defaultConfig { applicationId = "com.example.corr"; minSdk = 24; targetSdk = 35 } }\n');
WC('app/src/main/java/com/example/corr/MainActivity.kt', 'class MainActivity { fun locate() { fusedClient.lastLocation } }\n');
const cor = await E.connect({ source: 'path', path: COR, store_stage: 'not_submitted' }, { allowPath: true });
const cid = cor.st.id;
check(cor.st.A.sdk.auth && !cor.st.A.review.deletionInApp, 'correction fixture: auth without deletion');
check(cor.st.A.sdk.location && !cor.st.A.review.locationSent, 'correction fixture: location not sent', cor.st.A.review);
const beforeReady = cor.st.A.readiness;
const dMiss = await E.release('deletion', cid, {}, 'en');
check(dMiss.rows.find(r => r.id === 'in_app').severity === 'block', 'correction: deletion starts as missing');
const got = E.reportCorrection(E.load(cid), { check_id: 'account_deletion', actual: 'present', evidence: 'src/settings.kt:40' }, 'en');
check(got.applied && got.actual === 'present' && got.previous === 'missing', 'correction applied locally', got);
check(got.shared === false, 'correction not sent when lessons API is unset', got.shared);
const dAfter = await E.release('deletion', cid, {}, 'en');
check(dAfter.rows.find(r => r.id === 'in_app').severity === 'ok', 'correction: in-app deletion now ok');
check(typeof got.readiness === 'number' && got.readiness >= beforeReady, 'correction recalculated readiness', { before: beforeReady, after: got.readiness });
const locC = E.reportCorrection(E.load(cid), { check_id: 'location_sharing', actual: 'server', evidence: 'src/net.kt:12' }, 'en');
check(locC.applied && locC.previous === 'device', 'location correction previous was device', locC);
const pAfter = await E.release('privacy', cid, {}, 'en');
check(pAfter.drafts.data_safety.rows.some(r => /location/i.test(JSON.stringify(r))), 'location correction flows into Data safety draft');
/* evidence must not appear in a share payload even when API is on */
process.env.ROCKETLAUNCHER_LESSONS_API = 'http://127.0.0.1:9/api/lessons';
const { shareCorrection, correctionsApi } = await import('../lib/shared.mjs');
const payload = shareCorrection({ check_id: 'account_deletion', wrong_verdict: 'missing', corrected_verdict: 'present', framework: 'capacitor', language: 'js', pattern_kinds: ['function_name', 'i18n', 'http://evil', 'src/app.js'] });
check(payload && payload.check_id === 'account_deletion' && payload.corrected_verdict === 'present', 'share payload built');
check(payload && JSON.stringify(payload).indexOf('src/') === -1 && JSON.stringify(payload).indexOf('evil') === -1 && JSON.stringify(payload).indexOf('Corr') === -1, 'share payload has no paths, no dropped kinds, no app name', payload);
check(correctionsApi({ ROCKETLAUNCHER_LESSONS_API: 'https://example.test/api/lessons' }) === 'https://example.test/api/corrections', 'corrections URL derived from lessons URL');
check(correctionsApi({ ROCKETLAUNCHER_LESSONS_API: '' }) === '', 'empty lessons API disables correction sharing');
process.env.ROCKETLAUNCHER_LESSONS_API = '';

fs.rmSync(HOME, { recursive: true, force: true });
console.log(`\nrelease: ${pass} passed, ${failN} failed`);
process.exit(failN ? 1 : 0);
