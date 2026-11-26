/* Rocket Launcher 0.2.8 unit checks for T-FLOW false positives reported on 0.2.7:
   (1) play_policy_audit quick scan ignores permissions the app manifest removes with tools:node="remove";
   (2) the word "receipt" / "invoice" (goods receipt, 물품 인수증) is not PURCHASE_HISTORY without a store / payment context;
   (3) a microphone used only for SpeechRecognizer / Web Speech API (speech-to-text) is not "audio recordings collected" in the Data safety draft,
       and the draft carries a confirm-with-user note; real audio capture still is collected.
   Run: node test/fixes028.mjs */
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';

const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'rocketlauncher-028-'));
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
const NS = 'xmlns:android="http://schemas.android.com/apk/res/android" xmlns:tools="http://schemas.android.com/tools"';
const MANIFEST = (perms = '') => `<manifest ${NS}><uses-permission android:name="android.permission.INTERNET"/>${perms}<application android:label="@string/app_name" android:icon="@mipmap/ic_launcher"><activity android:name=".MainActivity" android:exported="true"/></application></manifest>`;
const GRADLE = `plugins { id 'com.android.application' }\nandroid { namespace "com.example.fx"\n defaultConfig { applicationId "com.example.fx"\n minSdk 24\n targetSdk 36\n versionCode 1\n versionName "1.0.0" } }\ndependencies { }\n`;
const STRINGS = '<?xml version="1.0" encoding="utf-8"?><resources><string name="app_name">GoodsNote</string></resources>';
const base = (more = {}, perms = '') => ({
  'app/src/main/AndroidManifest.xml': MANIFEST(perms),
  'app/build.gradle': GRADLE,
  'app/src/main/res/values/strings.xml': STRINGS,
  'README.md': '# Fixture\n\nA small warehouse utility.\n',
  ...more
});
const connect = async files => E.connect({ source: 'path', path: project(files), lang: 'en' }, { allowPath: true });
const sigs = pa => Object.values(pa.quick_scan).flatMap(d => d.signals.map(s => s.signal));
const sigWhere = (pa, id) => Object.values(pa.quick_scan).flatMap(d => d.signals).filter(s => s.signal === id).map(s => s.where.join(' '));
const policies = pa => Object.values(pa.quick_scan).flatMap(d => d.review_against.map(p => p.id));
const audit = async files => { const { st } = await connect(files); return { st, pa: await E.release('policy', st.id, {}, 'en') }; };

console.log('\n[1] permissions removed with tools:node="remove" are not policy signals');
const REMOVE = [
  '<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" tools:node="remove"/>',
  '<uses-permission tools:node="remove" android:name="android.permission.ACCESS_COARSE_LOCATION"/>',
  '<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"\n    tools:node="remove" />'
].join('');
let { st, pa } = await audit(base({}, REMOVE));
check(!sigs(pa).includes('PRECISE_LOCATION') && !sigs(pa).includes('APPROX_LOCATION'), 'no PRECISE_LOCATION / APPROX_LOCATION signal', sigs(pa));
check(!sigs(pa).includes('FILES_AND_DOCS'), 'no FILES_AND_DOCS signal from READ_EXTERNAL_STORAGE', sigWhere(pa, 'FILES_AND_DOCS'));
check(!policies(pa).includes('location_access_policy'), 'location policy not listed', policies(pa));
({ pa } = await audit(base({}, '<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/><uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>')));
check(sigs(pa).includes('PRECISE_LOCATION') && sigs(pa).includes('FILES_AND_DOCS'), 'declared (not removed) permissions are still flagged', sigs(pa));
check(policies(pa).includes('location_access_policy'), 'declared location still lists the location policy', policies(pa));
/* a library manifest adds the permission, the app manifest removes it → merged manifest has none */
({ pa } = await audit(base({
  'lib/build.gradle': "plugins { id 'com.android.library' }\n",
  'lib/src/main/AndroidManifest.xml': `<manifest ${NS}><uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/><uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/></manifest>`
}, REMOVE)));
check(!sigs(pa).includes('PRECISE_LOCATION') && !sigs(pa).includes('FILES_AND_DOCS'), 'library manifest copy removed by the app manifest is ignored too', sigs(pa));
/* a debug build-type manifest is a separate variant: its own declaration still counts */
({ pa } = await audit(base({
  'app/src/debug/AndroidManifest.xml': `<manifest ${NS}><uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/></manifest>`
}, REMOVE)));
check(sigs(pa).includes('PRECISE_LOCATION'), 'a src/debug manifest that declares the permission is still flagged', sigs(pa));
/* other permissions in the same manifest are untouched */
({ pa } = await audit(base({}, REMOVE + '<uses-permission android:name="android.permission.READ_CONTACTS"/>')));
check(sigs(pa).includes('CONTACTS') && policies(pa).includes('contacts_access_policy'), 'a permission that is not removed (READ_CONTACTS) is still flagged', sigs(pa));

console.log('\n[2] receipt / invoice need a payment or store context for PURCHASE_HISTORY');
const GOODS = {
  'www/core.js': "const receipts = []; function addReceipt(r) { receipts.push(r); }\nfunction renderReceipt(r) { return '<h1>물품 인수증 receipt</h1>'; }\n",
  'www/docout.js': "export function printInvoice(inv) { return 'invoice ' + inv.no; }\n",
  'www/v-docs.js': "const label = 'goods receipt'; const order = { orderId: 12, customer: 'ACME' };\n"
};
({ pa } = await audit(base(GOODS)));
check(!sigs(pa).includes('PURCHASE_HISTORY'), 'goods receipt / invoice / orderId words alone → no PURCHASE_HISTORY', sigWhere(pa, 'PURCHASE_HISTORY'));
({ pa } = await audit(base({ ...GOODS, 'www/pay.js': "const total = order.total; // payment terms 30 days\nconst receipt = 1;\n" })));
check(!sigs(pa).includes('PURCHASE_HISTORY'), 'the word "payment" next to receipt is not enough (receipt needs a store / billing API)', sigWhere(pa, 'PURCHASE_HISTORY'));
({ pa } = await audit(base({ 'app/src/main/java/com/example/fx/Billing.kt': 'import com.android.billingclient.api.BillingClient\nclass B { val c = BillingClient.newBuilder(ctx) }\n' })));
check(sigs(pa).includes('PURCHASE_HISTORY'), 'BillingClient → PURCHASE_HISTORY still found', sigs(pa));
({ pa } = await audit(base({ 'www/iap.js': "const receipt = body.receipt; await validateReceipt(receipt);\n" })));
check(sigs(pa).includes('PURCHASE_HISTORY'), 'receipt next to validateReceipt (store receipt check) → PURCHASE_HISTORY', sigs(pa));
({ pa } = await audit(base({ 'www/shop.js': "async function pay() { await stripe.confirmPayment(); }\nconst orderHistory = await api.get('/orders'); // paid orders\n" })));
check(sigs(pa).includes('PURCHASE_HISTORY'), 'orderHistory next to payment code → PURCHASE_HISTORY', sigs(pa));
({ pa } = await audit(base({ 'www/orders.js': "const orderHistory = await api.get('/orders');\n" })));
check(!sigs(pa).includes('PURCHASE_HISTORY'), 'orderHistory with no payment context → not PURCHASE_HISTORY', sigs(pa));

console.log('\n[3] speech-to-text only: no "audio recordings collected", confirm-with-user note');
const MIC = '<uses-permission android:name="android.permission.RECORD_AUDIO"/>';
const ds = async files => { const { st } = await connect(files); const pv = await E.release('privacy', st.id, {}, 'en'); return { st, pv, rows: pv.drafts.data_safety.rows || [], d: pv.drafts.data_safety }; };
let r = await ds(base({ 'app/src/main/java/com/example/fx/Voice.kt': 'import android.speech.SpeechRecognizer\nimport android.speech.RecognizerIntent\nclass V { val r = SpeechRecognizer.createSpeechRecognizer(ctx) }\n' }, MIC));
check(!r.rows.some(x => x.id === 'audio'), 'SpeechRecognizer + RECORD_AUDIO → no audio row', r.rows.map(x => x.id));
check(r.st.A.sdk.speechOnly === true, 'sdk.speechOnly detected', { speech: r.st.A.sdk.speechToText, cap: r.st.A.sdk.audioCapture });
check((r.d.not_collected || []).some(x => x.id === 'audio' && /text input/i.test(x.note)), 'not-collected entry notes text input', r.d.not_collected);
check(/confirm/i.test(r.d.confirm_with_user || ''), 'draft carries a confirm-with-user note', r.d.confirm_with_user);
const chk = (r.pv.rows || r.pv.checks || []).find(x => x.id === 'ds.audio_speech');
check(chk && chk.severity === 'check', 'the "scanner found audio but draft does not list it" warning becomes a confirm check', (r.pv.rows || []).map(x => x.id));
check(!(r.pv.rows || []).some(x => x.id === 'ds.audio'), 'no ds.audio warning', (r.pv.rows || []).map(x => x.id));
r = await ds(base({ 'www/voice.js': "const R = window.SpeechRecognition || window.webkitSpeechRecognition; const rec = new R(); rec.onresult = e => { input.value = e.results[0][0].transcript; };\n" }, MIC));
check(!r.rows.some(x => x.id === 'audio') && r.st.A.sdk.speechOnly, 'Web Speech API + RECORD_AUDIO → no audio row', r.rows.map(x => x.id));
const { Gen } = await import('../lib/runtime.mjs');
const enNote = Gen.dataSafety(r.st.A, 'en', {}).confirm;
for (const l of ['ko', 'th', 'zh', 'hi']) {
  const d = Gen.dataSafety(r.st.A, l, {});
  check(d.confirm && d.confirm !== enNote && d.notCollected.some(x => x.id === 'audio' && x.note), `confirm note and not-collected note exist in ${l}`, d.confirm);
}
/* real capture or storage still counts as collected */
for (const [name, code] of [
  ['MediaRecorder next to SpeechRecognizer', 'val rec = MediaRecorder(); val s = SpeechRecognizer.createSpeechRecognizer(ctx)\n'],
  ['AudioRecord next to SpeechRecognizer', 'val a = AudioRecord(src, 16000, ch, fmt, buf); val s = SpeechRecognizer.createSpeechRecognizer(ctx)\n'],
  ['recorder plugin next to speech_to_text', 'dependencies: flutter_sound, speech_to_text\n']
]) {
  r = await ds(base({ 'app/src/main/java/com/example/fx/Rec.kt': code }, MIC));
  check(r.rows.some(x => x.id === 'audio') && !r.st.A.sdk.speechOnly && !r.d.confirm_with_user, `${name} → audio recordings collected`, r.rows.map(x => x.id));
}
r = await ds(base({ 'www/rec.js': "const s = await navigator.mediaDevices.getUserMedia({ audio: true }); const rec = new MediaRecorder(s); const t = new webkitSpeechRecognition();\n" }, MIC));
check(r.rows.some(x => x.id === 'audio'), 'getUserMedia audio + MediaRecorder → collected', r.rows.map(x => x.id));
r = await ds(base({}, MIC));
check(r.rows.some(x => x.id === 'audio') && !r.d.confirm_with_user, 'RECORD_AUDIO alone (no speech API) → still collected (0.2.7 behavior)', r.rows.map(x => x.id));
r = await ds(base({ 'www/voice.js': "const rec = new webkitSpeechRecognition();\n" }, MIC.replace('/>', ' tools:node="remove"/>')));
check(!r.rows.some(x => x.id === 'audio') && !r.d.confirm_with_user, 'RECORD_AUDIO removed + speech code → no audio row and no confirm note', r.rows.map(x => x.id));

console.log(`\n${pass} passed, ${failN} failed`);
fs.rmSync(HOME, { recursive: true, force: true });
process.exit(failN ? 1 : 0);
