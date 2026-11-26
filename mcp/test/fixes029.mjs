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

const total = pass + failN;
console.log(`\n${pass}/${total} checks passed, ${failN} failed`);
if (failN) process.exit(1);
