/* Rocket Launcher policy review (rules-029): Play target API floors by form factor,
   USE_FULL_SCREEN_INTENT as a check (not a block), and official dates re-checked 2026-11-26.
   Run: node test/fixes029.mjs */
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';

const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'rocketlauncher-029-'));
process.env.ROCKETLAUNCHER_HOME = HOME;
process.env.ROCKETLAUNCHER_LESSONS_API = 'http://127.0.0.1:9/api/lessons';
process.env.ROCKETLAUNCHER_VERIFY_URLS = '0';
process.env.ROCKETLAUNCHER_TODAY = '2026-11-26';
const E = await import('../lib/engine.mjs');
const { playTargetRequirement, REQ } = await import('../lib/release.mjs');

let pass = 0, failN = 0;
const check = (c, name, extra) => { if (c) { pass++; console.log('  ✓', name); } else { failN++; console.log('  ✗', name, extra !== undefined ? JSON.stringify(extra).slice(0, 700) : ''); } };
let n = 0;
function project(files) {
  const dir = path.join(HOME, 'fx-' + (++n));
  for (const [p, c] of Object.entries(files)) { if (c == null) continue; const f = path.join(dir, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, c); }
  return dir;
}

const GRADLE = (target, pkg = 'com.example.demo') => `plugins { id 'com.android.application' }
android { namespace "${pkg}"
  defaultConfig { applicationId "${pkg}"
    minSdk 24
    targetSdk ${target}
    versionCode 1
    versionName "1.0" } }
`;
const MANIFEST = (features = '', perms = '') => `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <uses-permission android:name="android.permission.INTERNET"/>
  ${perms}
  ${features}
  <application android:label="Demo">
    <activity android:name=".MainActivity" android:exported="true">
      <intent-filter>
        <action android:name="android.intent.action.MAIN"/>
        <category android:name="android.intent.category.LAUNCHER"/>
      </intent-filter>
    </activity>
  </application>
</manifest>
`;
const app = (target, { features = '', perms = '', extra = {} } = {}) => ({
  'settings.gradle': 'rootProject.name = "Demo"\ninclude(":app")\n',
  'app/build.gradle': GRADLE(target),
  'app/src/main/AndroidManifest.xml': MANIFEST(features, perms),
  'app/src/main/java/com/example/demo/MainActivity.java': 'package com.example.demo; class MainActivity {}',
  'README.md': '# Demo\n',
  ...extra
});

async function requirementsOf(files) {
  const { st } = await E.connect({ source: 'path', path: project(files), lang: 'en' }, { allowPath: true });
  const req = await E.release('requirements', st.id, {}, 'en');
  const row = id => (req.rows || []).find(r => r.id === id);
  return { st, req, row };
}

console.log('\n[029] playTargetRequirement helper');
check(JSON.stringify(playTargetRequirement([])) === JSON.stringify({ update: 36, existing: 35, kind: 'mobile' }), 'empty / phone → API 36');
check(playTargetRequirement(undefined).update === 36, 'undefined form factors → 36');
check(JSON.stringify(playTargetRequirement(['android_auto'])) === JSON.stringify({ update: 36, existing: 35, kind: 'mobile' }), 'Android Auto (phone companion) → API 36');
check(JSON.stringify(playTargetRequirement(['wear_os'])) === JSON.stringify({ update: 35, existing: 34, kind: 'wear_os' }), 'Wear-only → update 35 / existing 34');
check(JSON.stringify(playTargetRequirement(['android_automotive'])) === JSON.stringify({ update: 35, existing: 32, kind: 'automotive' }), 'Automotive-only → update 35 / existing 32');
check(JSON.stringify(playTargetRequirement(['tv'])) === JSON.stringify({ update: 34, existing: 33, kind: 'tv' }), 'TV-only → update 34 / existing 33');
check(playTargetRequirement(['wear_os', 'android_auto']).update === 36, 'Wear + Android Auto (phone module present) stays 36');
check(playTargetRequirement(['wear_os', 'tv']).update === 35 && playTargetRequirement(['wear_os', 'tv']).kind === 'mixed', 'Wear + TV exclusive mix uses max update 35');

console.log('\n[029] official catalog dates re-checked 2026-11-26');
const byId = id => REQ.requirements.find(r => r.id === id);
check(byId('play.target_api_36').date === '2026-08-31' && byId('play.target_api_36').extension_until === '2026-11-01' && byId('play.target_api_36').value === 36, 'target API 36 date and ended extension');
check(byId('play.16kb_page_size').official_update_block_date === '2027-02-01' && byId('play.16kb_page_size').conservative === true, '16 KB official update block 2027-02-01, still conservative');
check(byId('apple.xcode_26').date === '2026-04-28' && byId('apple.xcode_26').value === 26, 'Xcode 26 since 2026-04-28');
check(byId('apple.min_target_ios13').date === '2026-09-09' && byId('apple.min_target_ios13').value === 13, 'min iOS 13 since 2026-09-09');
check(byId('apple.ios27_sdk').date === '2027-04-01' && byId('apple.ios27_sdk').date_precision === 'month' && byId('apple.ios27_sdk').min_target === 15, 'Xcode / iOS 27 SDK April 2027, month precision, min iOS 15');
check(byId('play.full_screen_intent') && byId('play.full_screen_intent').date === '2025-01-22' && byId('play.full_screen_intent').status === 'in_force', 'full-screen intent catalog row');
check(!JSON.stringify(REQ).includes('2026-09-11') && !JSON.stringify(REQ).includes('제30조') && !JSON.stringify(REQ).includes('제22조의2'), 'Korean 제30조 / 제22조의2 dates are not in the rule catalog');

console.log('\n[029] phone and form-factor projects');
{
  const r = await requirementsOf(app(35));
  check(r.row('play.target_api_36')?.severity === 'block', 'phone targetSdk 35 → block API 36', r.row('play.target_api_36'));
  check(!/Wear OS updates must target/.test(r.row('play.target_api_36')?.action || ''), 'phone action stays the generic API 36 wording');
  check(r.st.A.android?.formFactors == null || r.st.A.android?.formFactors.length === 0 || (r.st.A.issues || []).every(i => i.id !== 'fullScreenIntent'), 'phone fixture has no extra form factors / no FSI issue');
  const iss = (r.st.A.issues || []).find(i => i.id === 'targetSdk');
  check(iss && iss.sev === 'block' && iss.vars.need === 36, 'analyzer phone issue need=36', iss);
}
{
  const r = await requirementsOf(app(35, { features: '<uses-feature android:name="android.hardware.type.watch"/>' }));
  check((r.st.A.android?.formFactors || []).includes('wear_os'), 'watch feature → wear_os form factor', r.st.A.android?.formFactors);
  check(r.row('play.target_api_36')?.severity === 'ok', 'Wear-only targetSdk 35 → ok, not a block', r.row('play.target_api_36'));
  const iss = (r.st.A.issues || []).find(i => i.id === 'targetSdk');
  check(!iss, 'analyzer does not block Wear-only at 35', r.st.A.issues);
}
{
  const r = await requirementsOf(app(34, { features: '<uses-feature android:name="android.hardware.type.watch"/>' }));
  check(r.row('play.target_api_36')?.severity === 'block' && /35/.test(r.row('play.target_api_36')?.action || ''), 'Wear-only targetSdk 34 → block, ask for 35', r.row('play.target_api_36'));
  const iss = (r.st.A.issues || []).find(i => i.id === 'targetSdk');
  check(iss && iss.vars.need === 35, 'analyzer Wear issue need=35', iss);
}
{
  const r = await requirementsOf(app(34, { features: '<uses-feature android:name="android.software.leanback"/>', extra: { 'app/src/main/AndroidManifest.xml': MANIFEST('<uses-feature android:name="android.software.leanback"/>', '') } }));
  check((r.st.A.android?.formFactors || []).includes('tv'), 'leanback → tv form factor', r.st.A.android?.formFactors);
  check(r.row('play.target_api_36')?.severity === 'ok', 'TV-only targetSdk 34 → ok', r.row('play.target_api_36'));
}
{
  const r = await requirementsOf(app(33, { features: '<uses-feature android:name="android.software.leanback"/>' }));
  check(r.row('play.target_api_36')?.severity === 'block' && /34/.test(r.row('play.target_api_36')?.action || ''), 'TV-only targetSdk 33 → block, ask for 34', r.row('play.target_api_36'));
}
{
  const r = await requirementsOf(app(35, { features: '<uses-feature android:name="android.hardware.type.automotive"/>' }));
  check((r.st.A.android?.formFactors || []).includes('android_automotive'), 'automotive feature → form factor', r.st.A.android?.formFactors);
  check(r.row('play.target_api_36')?.severity === 'ok', 'Automotive-only targetSdk 35 → ok', r.row('play.target_api_36'));
}
{
  const r = await requirementsOf(app(35, { extra: { 'app/src/main/AndroidManifest.xml': MANIFEST('', '') .replace('</application>', '<meta-data android:name="com.google.android.gms.car.application" android:resource="@xml/automotive_app_desc"/></application>') } }));
  check((r.st.A.android?.formFactors || []).includes('android_auto'), 'car.application meta-data → android_auto', r.st.A.android?.formFactors);
  check(r.row('play.target_api_36')?.severity === 'block', 'Android Auto companion at 35 still needs 36 (mobile)', r.row('play.target_api_36'));
}

console.log('\n[029] USE_FULL_SCREEN_INTENT is a check, not a block');
{
  const r = await requirementsOf(app(36, { perms: '<uses-permission android:name="android.permission.USE_FULL_SCREEN_INTENT"/>' }));
  const row = r.row('play.full_screen_intent');
  check(row && row.severity === 'check', 'FSI declared → check', row);
  check(row && /alarms or receiving phone or video calls/.test(row.action || row.finding || ''), 'FSI action mentions alarm/calling exception', row);
  const iss = (r.st.A.issues || []).find(i => i.id === 'fullScreenIntent');
  check(iss && iss.sev === 'check', 'analyzer FSI issue is check, not block', iss);
}
{
  const r = await requirementsOf(app(36));
  check(!r.row('play.full_screen_intent'), 'no FSI permission → no FSI row');
  check(!(r.st.A.issues || []).some(i => i.id === 'fullScreenIntent'), 'analyzer has no FSI issue without the permission');
}

console.log('\n[029] Korean locale still receives the FSI row');
{
  const { st } = await E.connect({ source: 'path', path: project(app(36, { perms: '<uses-permission android:name="android.permission.USE_FULL_SCREEN_INTENT"/>' })), lang: 'ko' }, { allowPath: true });
  const req = await E.release('requirements', st.id, {}, 'ko');
  const row = (req.rows || []).find(r => r.id === 'play.full_screen_intent');
  check(row && row.severity === 'check' && /USE_FULL_SCREEN_INTENT/.test(row.finding || ''), 'ko finding is localized or still names the permission', row);
}


/* 64-bit ELF with one PT_LOAD aligned to `align` bytes */
function elf(align) {
  const b = Buffer.alloc(64 + 56);
  b.write('\x7fELF', 0, 'latin1'); b[4] = 2; b[5] = 1; b[6] = 1;
  b.writeUInt16LE(3, 16); b.writeUInt16LE(183, 18); b.writeUInt32LE(1, 20);
  b.writeBigUInt64LE(64n, 32); b.writeUInt16LE(64, 52); b.writeUInt16LE(56, 54); b.writeUInt16LE(1, 56);
  b.writeUInt32LE(1, 64); b.writeBigUInt64LE(BigInt(align), 64 + 48);
  return b;
}

console.log('\n[029] 16 KB block message names the official 2027-02-01 date');
{
  const r = await requirementsOf({
    ...app(36),
    'app/src/main/jniLibs/arm64-v8a/libold.so': elf(4096)
  });
  const row = r.row('play.16kb_page_size');
  check(row?.severity === 'block', 'misaligned .so is still a block', row);
  check(/2027-02-01/.test(row?.action || row?.finding || ''), 'block message mentions official enforcement date 2027-02-01', row);
  check(row?.conservative === true, '16 KB stays conservative');
}

console.log('\n[029] FGS specialUse / geofence / BOOT_COMPLETED / mediaProcessing');
{
  const svc = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <uses-permission android:name="android.permission.INTERNET"/>
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE_SPECIAL_USE"/>
  <application android:label="Demo">
    <activity android:name=".MainActivity" android:exported="true"/>
    <service android:name=".OddService" android:foregroundServiceType="specialUse" android:exported="false"/>
  </application>
</manifest>`;
  const r = await requirementsOf({ ...app(36), 'app/src/main/AndroidManifest.xml': svc });
  const row = r.row('play.fgs_special_use');
  check(row?.severity === 'block', 'specialUse without property → block', row);
}
{
  const man = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <uses-permission android:name="android.permission.INTERNET"/>
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE_SPECIAL_USE"/>
  <application android:label="Demo">
    <activity android:name=".MainActivity" android:exported="true"/>
    <service android:name=".OddService" android:foregroundServiceType="specialUse" android:exported="false">
      <property android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE" android:value="demo"/>
    </service>
  </application>
</manifest>`;
  const r = await requirementsOf({ ...app(36), 'app/src/main/AndroidManifest.xml': man });
  check(!r.row('play.fgs_special_use') || r.row('play.fgs_special_use').severity === 'ok', 'specialUse with property is not a block', r.row('play.fgs_special_use'));
}
{
  const man = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <uses-permission android:name="android.permission.INTERNET"/>
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION"/>
  <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
  <application android:label="Demo">
    <activity android:name=".MainActivity" android:exported="true"/>
    <service android:name=".GeoService" android:foregroundServiceType="location" android:exported="false"/>
  </application>
</manifest>`;
  const r = await requirementsOf({
    ...app(36),
    'app/src/main/AndroidManifest.xml': man,
    'app/src/main/java/com/example/demo/Geo.java': 'import com.google.android.gms.location.GeofencingClient;\nclass Geo { GeofencingClient c; void add() { c.addGeofences(null, null); } }\n'
  });
  const row = r.row('play.fgs_geofencing');
  check(row?.severity === 'warn', 'location FGS + GeofencingClient → warn (date conflict, not a block)', row);
  check(/2026-08-26|2027-01-27/.test(row?.action || ''), 'geofence warning mentions the two official dates', row);
}
{
  const man = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <uses-permission android:name="android.permission.INTERNET"/>
  <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK"/>
  <application android:label="Demo">
    <activity android:name=".MainActivity" android:exported="true"/>
    <service android:name=".PlayerService" android:foregroundServiceType="mediaPlayback" android:exported="false"/>
    <receiver android:name=".BootReceiver" android:exported="true">
      <intent-filter><action android:name="android.intent.action.BOOT_COMPLETED"/></intent-filter>
    </receiver>
  </application>
</manifest>`;
  const r = await requirementsOf({ ...app(36), 'app/src/main/AndroidManifest.xml': man });
  const row = r.row('play.fgs_boot_completed');
  check(row?.severity === 'warn', 'BOOT_COMPLETED + mediaPlayback FGS → warn, not a block', row);
}
{
  const man = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <uses-permission android:name="android.permission.INTERNET"/>
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PROCESSING"/>
  <application android:label="Demo">
    <activity android:name=".MainActivity" android:exported="true"/>
    <service android:name=".Transcode" android:foregroundServiceType="mediaProcessing" android:exported="false"/>
  </application>
</manifest>`;
  const r = await requirementsOf({ ...app(36), 'app/src/main/AndroidManifest.xml': man });
  const row = r.row('play.fgs_media_processing');
  check(row?.severity === 'warn', 'mediaProcessing without onTimeout → warn', row);
  check(/onTimeout/.test(row?.finding || row?.action || ''), 'mentions onTimeout', row);
}

console.log('\n[029] store AI assets and age rating are checks, not blocks');
{
  const r = await requirementsOf(app(36));
  check(r.row('play.store_ai_assets')?.severity === 'check', 'store AI asset declaration is a check', r.row('play.store_ai_assets'));
  check(!r.row('play.fgs_special_use'), 'plain app has no specialUse block');
  check(!r.row('play.fgs_geofencing'), 'plain app has no geofence warning');
}

console.log('\n[029] country gaps: KR warn, CN/IN only when listed, no wrong law dates');
{
  const { parseListedCountries, countryPolicyGaps } = await import('../lib/release.mjs');
  check(parseListedCountries('대한민국만').includes('KR') && !parseListedCountries('대한민국만').includes('CN'), 'parse Korea-only');
  check(parseListedCountries('Korea, China, India').join(',') === 'KR,CN,IN', 'parse KR/CN/IN', parseListedCountries('Korea, China, India'));
}
{
  const r = await requirementsOf(app(36));
  const kr = r.row('kr.privacy_in_app');
  // default country list includes KR; a plain app may or may not be "personal data"
  check(!r.row('cn.icp'), 'China ICP is not shown when CN is not listed');
  check(!r.row('in.dpdp'), 'India DPDP is not shown when IN is not listed');
  check(!/2026-09-11|제30조|제22조의2/.test(JSON.stringify(r.req.rows || [])), 'requirement rows do not use the wrong Korean amendment dates');
}
{
  const files = {
    ...app(36),
    'store/listing-ko.md': '# 등록정보\n\n배포 국가: 대한민국, 중국, 인도, 태국\n',
    'README.md': '# Demo loan\n\nApply for a personal loan. Instant cash loans.\n',
    'app/build.gradle': GRADLE(36) + "\ndependencies { implementation 'com.google.firebase:firebase-analytics:22.0.0' }\n",
    'app/src/main/java/com/example/demo/Ai.java': 'import com.google.ai.generativelanguage.v1beta; class Ai { void m() { GenerativeModel g; } }\n',
    'app/src/main/res/values/strings.xml': '<resources><string name="app_name">Demo</string></resources>\n'
  };
  const { st } = await E.connect({ source: 'path', path: project(files), lang: 'en' }, { allowPath: true });
  const req = await E.release('requirements', st.id, {}, 'en');
  const row = id => (req.rows || []).find(x => x.id === id);
  check(row('kr.privacy_in_app') && row('kr.privacy_in_app').severity === 'warn', 'KR in-app privacy is a warning (not a block)', row('kr.privacy_in_app'));
  check(!/2026-09-11|제30조|제22조의2/.test((row('kr.privacy_in_app')?.finding || '') + (row('kr.privacy_in_app')?.action || '')), 'KR privacy text avoids the wrong article dates', row('kr.privacy_in_app'));
  check(row('cn.icp')?.severity === 'warn', 'CN listed and no ICP → warn, not a block', row('cn.icp'));
  check(row('in.dpdp')?.severity === 'warn', 'IN listed + personal/loan app → DPDP warning (full duties 2027-05-14)', row('in.dpdp'));
  const cc = await E.release('countries', st.id, { countries: ['KR', 'CN', 'IN', 'TH'] }, 'en');
  const cr = id => (cc.rows || []).find(x => x.id === id);
  check(cr('cn.icp')?.severity === 'warn', 'country_check also reports CN ICP', cr('cn.icp'));
  check(cr('in.dpdp')?.severity === 'warn', 'country_check also reports IN DPDP', cr('in.dpdp'));
  check(cr('kr.privacy_in_app')?.severity === 'warn' || cr('kr.privacy_in_app')?.severity === 'check', 'country_check reports KR in-app privacy', cr('kr.privacy_in_app'));
}
{
  const files = {
    ...app(36),
    'store/listing.md': 'Distribution countries: China\n',
    'app/src/main/res/values/strings.xml': '<resources><string name="icp">京ICP备12345678号</string><string name="beian">https://beian.miit.gov.cn/</string></resources>\n'
  };
  const r = await requirementsOf(files);
  check(r.row('cn.icp')?.severity === 'ok', 'ICP number in strings → ok', r.row('cn.icp'));
}
{
  const files = {
    ...app(36),
    'README.md': '# Casino\n\nReal-money sports betting and casino games.\n',
    'store/listing.md': 'Distribution countries: India only\n'
  };
  const r = await requirementsOf(files);
  check(r.row('in.money_games')?.severity === 'warn', 'India + gambling keywords → warn, not a block', r.row('in.money_games'));
}
{
  const r = await requirementsOf({
    ...app(36),
    'ios/App/App/Info.plist': '<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict><key>CFBundleDisplayName</key><string>Demo</string></dict></plist>\n',
    'ios/App/App.xcodeproj/project.pbxproj': 'IPHONEOS_DEPLOYMENT_TARGET = 15.0;\nPRODUCT_BUNDLE_IDENTIFIER = com.example.demo;\nMARKETING_VERSION = 1.0;\nCURRENT_PROJECT_VERSION = 1;\nTARGETED_DEVICE_FAMILY = "1,2";\n',
    '.xcode-version': '27.0\n'
  });
  const row = r.row('apple.ios27_launch_screen');
  check(row?.severity === 'warn', 'Xcode 27 without launch screen key → warn', row);
  check(r.row('apple.age_rating_questionnaire')?.severity === 'check', 'updated age rating questionnaire is a check', r.row('apple.age_rating_questionnaire'));
}

const total = pass + failN;
console.log(`\n${pass}/${total} checks passed, ${failN} failed`);
if (failN) process.exit(1);
