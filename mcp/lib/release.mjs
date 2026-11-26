/* Rocket Launcher 0.2.3 — release checks.
   Every function here only reads the connected project and the bundled rule tables, and returns guidance.
   Nothing is submitted, uploaded, deleted or sent to a store. No API keys. */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, Analyzer, Detect, Gen, Flow } from './runtime.mjs';
import { rx, RECRUIT } from './release-i18n.mjs';

const readJson = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
export const REQ = readJson(path.join(ROOT, 'data', 'store-requirements.json')) || { verified_on: null, requirements: [], countries: [] };
export const PPI_DIR = path.join(ROOT, 'vendor', 'play-policy-insights');
const PPI = { config: readJson(path.join(PPI_DIR, 'resources', 'scanner_config.json')), policies: readJson(path.join(PPI_DIR, 'resources', 'policies.json')) };
export const ppiAvailable = () => !!(PPI.config && PPI.policies);

const STORE = { play: 'Google Play', apple: 'App Store' };
const SEV_ORDER = { block: 0, warn: 1, check: 2, ok: 3, info: 4 };
const req = id => REQ.requirements.find(r => r.id === id) || REQ.countries.find(r => r.id === id) || {};
const DAY = 86400000;
export const today = () => process.env.ROCKETLAUNCHER_TODAY || new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / DAY);
const isDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z'));
const vnum = s => String(s || '').split(/[^\d]+/).filter(Boolean).map(Number);
/* numeric version compare: 1.2 == 1.2.0 (App Store treats them as the same version) */
export const vcmp = (a, b) => { const x = vnum(a), y = vnum(b); for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d < 0 ? -1 : 1; } return 0; };
const bumpPatch = v => { const n = vnum(v); while (n.length < 3) n.push(0); n[2]++; return n.slice(0, 3).join('.'); };
const sortRows = rows => rows.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]);
const counts = rows => { const c = { block: 0, warn: 0, check: 0, ok: 0, info: 0 }; rows.forEach(r => c[r.severity]++); return c; };
const label = (L, rows) => rows.map(r => ({ ...r, severity_label: rx(L, 'sev.' + r.severity) }));

/* ---------- code scan at connect time (stored as st.X) ---------- */
const stripComments = s => s.replace(/("(?:\\.|[^"\\])*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (m, q) => q || '');
const RR = {   /* Apple required-reason API categories → default reason codes */
  NSPrivacyAccessedAPICategoryUserDefaults: { reason: 'CA92.1', code: /\b(NS)?UserDefaults\b/, deps: /\bshared_preferences\b|@capacitor\/preferences|react-native-default-preference/ },
  NSPrivacyAccessedAPICategoryFileTimestamp: { reason: 'C617.1', code: /\b(creationDate|modificationDate|contentModificationDateKey|creationDateKey|NSFileCreationDate|NSFileModificationDate|getattrlist|fileModificationDate)\b/ },
  NSPrivacyAccessedAPICategorySystemBootTime: { reason: '35F9.1', code: /\b(systemUptime|mach_absolute_time)\b/ },
  NSPrivacyAccessedAPICategoryDiskSpace: { reason: 'E174.1', code: /\b(volumeAvailableCapacity\w*|NSFileSystemFreeSize|NSFileSystemSize|statfs|statvfs)\b/, deps: /\bdisk_space\b|react-native-device-info/ },
  NSPrivacyAccessedAPICategoryActiveKeyboards: { reason: '54BD.1', code: /\bactiveInputModes\b/ }
};
const DELETE_CODE = /\b(deleteAccount|delete_account|deleteUser|accountDeletion|DeleteAccount|purgeUserData|closeAccount|requestDelete|delete_profile|destroy_account)\b|currentUser\??(!)?\.delete\(|\buser\??(!)?\.delete\(/;
const DELETE_TEXT = /delete (my |your )?account|account deletion|계정 ?삭제|회원 ?탈퇴|ลบบัญชี|删除(账号|帐户|账户)|खाता (हटाएं|हटाएँ|डिलीट)/i;
const FORCE_UPDATE = /\b(min_?version|minimum_?version|min_supported_version|force_?update|forceUpdate|latest_?version|latestVersion|required_?version|minVersion|minimumVersion)\b/i;
const UPDATE_LIBS = /\bupgrader\b|\bin_app_update\b|react-native-version-check|sp-react-native-in-app-updates|com\.google\.android\.play:app-update|AppUpdateManager|new_version_plus/;
const REMOTE_FLAGS = /firebase_remote_config|firebase-config|RemoteConfig|remoteConfig|launchdarkly|growthbook|statsig/;
const OPTIN_PAGE = /(tester|testing|beta|join|opt-?in)/i;
const POLICY_FILE = /privacy/i;

/* 0.2.8: <uses-permission ... tools:node="remove"/> (manifest merger) */
const PERM_TAG = /<uses-permission(?:-sdk-23)?\b[^>]*>/g;
const permTag = t => ({ name: (t.match(/android:name\s*=\s*["']([^"']+)["']/) || [])[1] || null, removed: /tools:node\s*=\s*["'](remove|removeAll)["']/i.test(t) });
/* 0.2.8: words like receipt / invoice / orderId are ordinary in business apps (goods receipt, delivery slip). They only count as PURCHASE_HISTORY
   next to a store or payment context in the same file; real billing APIs (BillingClient, purchaseToken, ...) always count. */
const STORE_PAY_CTX = /BillingClient|StoreKit|SKPaymentQueue|in_app_purchase|inAppPurchase|in-app[ -]purchase|purchaseToken|react-native-iap|RNIap|RevenueCat|purchases_flutter|verifyReceipt|appStoreReceipt|validateReceipt|receipt[-_]?data|Stripe|PayPal|payment_intent|PaymentSheet/i;
const ORDER_PAY_CTX = /\b(payment|payments|paid|checkout|billing|stripe|paypal|purchase|purchases)\b|결제/i;
function contextOk(id, pat, c) {
  if (id !== 'PURCHASE_HISTORY') return true;
  if (pat === 'receipt' || pat === 'invoice') return STORE_PAY_CTX.test(c);
  if (pat === 'orderId' || pat === 'orderHistory') return ORDER_PAY_CTX.test(c);
  return true;
}
export function scanProject(project, A) {
  const F = project.files || {}, P = Object.keys(F), text = p => (F[p] && F[p].text) || '';
  const codeP = P.filter(p => F[p].code), textP = P.filter(p => F[p].text != null);
  const X = { v: 1, natives: project.natives || null, notable: (project.natives && project.natives.notable) || [] };
  /* build tool versions */
  const gradleTxt = P.filter(p => /\.gradle(\.kts)?$|libs\.versions\.toml$|gradle\.properties$/.test(p)).map(text).join('\n');
  const m1 = gradleTxt.match(/com\.android\.tools\.build:gradle:([\d.]+)/) || gradleTxt.match(/id\s*\(?\s*["']com\.android\.(?:application|library)["']\s*\)?\s*version\s*["']([\d.]+)/) || gradleTxt.match(/^\s*(?:agp|androidGradlePlugin|android-gradle-plugin|androidGradle)\s*=\s*"([\d.]+)"/m);
  const ndk = gradleTxt.match(/ndkVersion\s*=?\s*["']([\d.]+)/);
  let pkg = null; try { const pj = P.filter(p => /(^|\/)package\.json$/.test(p)).sort((a, b) => a.length - b.length)[0]; pkg = pj ? JSON.parse(text(pj)) : null; } catch { }
  const deps = pkg ? { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) } : {};
  const pubspec = text(P.filter(p => /(^|\/)pubspec\.yaml$/.test(p)).sort((a, b) => a.length - b.length)[0]);
  const xcodeHints = [];
  P.filter(p => /(^|\/)\.xcode-version$/.test(p)).forEach(p => { const v = text(p).trim().match(/^(\d+(?:\.\d+)*)/); if (v) xcodeHints.push({ file: p, version: v[1] }); });
  P.filter(p => /\.github\/workflows\/|codemagic\.ya?ml$/.test(p)).forEach(p => { const t = text(p); for (const re of [/xcode-version:\s*['"]?(\d+(?:\.\d+)*)/g, /Xcode_(\d+(?:\.\d+)*)\.app/g, /\bxcode:\s*['"]?(\d+(?:\.\d+)*)/g]) { let m; while ((m = re.exec(t))) xcodeHints.push({ file: p, version: m[1] }); } });
  P.filter(p => /(^|\/)eas\.json$/.test(p)).forEach(p => { const m = text(p).match(/xcode-(\d+(?:\.\d+)*)/); if (m) xcodeHints.push({ file: p, version: m[1] }); });
  const pbx = P.find(p => /project\.pbxproj$/.test(p)); const luc = pbx && text(pbx).match(/LastUpgradeCheck\s*=\s*(\d{4})/);
  X.build = { agp: m1 ? m1[1] : null, ndk: ndk ? ndk[1] : null, reactNative: deps['react-native'] || null, expo: deps.expo || null, flutter: !!pubspec,
    xcodeHints, lastUpgradeCheck: luc ? `${+luc[1].slice(0, 2)}.${+luc[1][2]}` : null };
  /* Google Play Policy Insights signals (Apache-2.0 data from android/skills), same matching as its scanner.py */
  const sig = {}, urls = new Set();
  if (PPI.config) {
    const exts = PPI.config.supported_extensions || [];
    /* 0.2.8: a permission the app manifest takes out with tools:node="remove" is not in the merged manifest: no signal from any source manifest
       that is not a build-type / flavor manifest (src/debug etc. still add their own copy for that variant). */
    const manifests = P.filter(p => F[p].text != null && /(^|\/)AndroidManifest\.xml$/.test(p)), isVariant = p => /(^|\/)src\/(?!main\/)[^/]+\/AndroidManifest\.xml$/.test(p);
    const removedPerms = new Set();
    for (const p of manifests) if (!isVariant(p)) for (const t of text(p).replace(/<!--[\s\S]*?-->/g, '').match(PERM_TAG) || []) { const r = permTag(t); if (r.removed && r.name) removedPerms.add(r.name); }
    for (const p of P.filter(p => F[p].text != null && (F[p].code || /AndroidManifest\.xml$|\.gradle(\.kts)?$/.test(p)))) {
      let c = text(p);
      if (/(^|\/)AndroidManifest\.xml$/.test(p) && !isVariant(p)) c = c.replace(PERM_TAG, t => { const r = permTag(t); return r.removed || removedPerms.has(r.name) ? '' : t; });
      for (const m of c.matchAll(/"(https?:\/\/[^"]+)"/g)) if (/privacy|support|delete|terms|policy/i.test(m[1])) urls.add(m[1]);
      c = /\.xml$/i.test(p) ? c.replace(/<!--[\s\S]*?-->/g, '') : exts.some(e => p.toLowerCase().endsWith(e)) || /\.swift$|\.m$/.test(p) ? stripComments(c) : c;
      for (const [cat, signals] of Object.entries(PPI.config.signal_categories || {})) for (const [id, pats] of Object.entries(signals)) {
        const hit = pats.find(x => c.includes(x) && contextOk(id, x, c)); if (!hit) continue;
        const k = cat === 'data_sources' ? id : cat; (sig[k] = sig[k] || []).length < 4 && sig[k].push(`${p} (${hit})`);
      }
    }
  }
  X.signals = sig; X.urls = [...urls].slice(0, 20);
  /* Apple required-reason APIs */
  const iosCode = codeP.filter(p => /\.(swift|m|mm)$/.test(p));
  const depHay = [JSON.stringify(Object.keys(deps)), pubspec, text(P.find(p => /(^|\/)Podfile$/.test(p)))].join('\n');
  X.reasons = {};
  for (const [cat, r] of Object.entries(RR)) {
    const files = iosCode.filter(p => r.code.test(stripComments(text(p)))).slice(0, 4);
    const dep = r.deps && r.deps.test(depHay);
    if (files.length || dep) X.reasons[cat] = { reason: r.reason, files, from_sdk: !!dep };
  }
  const xp = P.filter(p => /PrivacyInfo\.xcprivacy$/.test(p));
  X.manifestApis = [...new Set(xp.flatMap(p => text(p).match(/NSPrivacyAccessedAPICategory\w+/g) || []))];
  /* account deletion — function names, HTTP DELETE, i18n keys, and UI strings */
  const del = (Detect && Detect.deletion(codeP, F, A.strings)) || { found: false, kinds: [], files: [], confidence: null };
  X.deletion = {
    code: (del.files || []).slice(0, 8),
    text: !!(del.found || (del.kinds || []).some(k => k === 'ui_text' || k === 'i18n')),
    kinds: del.kinds || [],
    confidence: del.confidence,
    pages: textP.filter(p => /\.(html?|md)$/i.test(p) && /delet/i.test(p)).slice(0, 5),
    /* 0.2.6: also a deletion URL written in the README, a listing draft or rocketlauncher.json, not only one in code */
    urls: [...new Set([...(A.deletionInfo && A.deletionInfo.url ? [A.deletionInfo.url] : []), ...[...urls].filter(u => /delet/i.test(u))])].slice(0, 5),
    path: A.deletionInfo && A.deletionInfo.inAppPath || null, url: A.deletionInfo && A.deletionInfo.url || null,
    path_source: A.deletionInfo && A.deletionInfo.pathSource || null, url_source: A.deletionInfo && A.deletionInfo.urlSource || null
  };
  const loc = (Detect && Detect.locationFlow(codeP, F, '')) || { sent: false, confidence: null, kinds: [] };
  X.location = { sent: !!loc.sent, confidence: loc.confidence, kinds: loc.kinds || [] };
  /* privacy policy content: local files, plus the live page body when connect() was able to read it (0.2.7).
     If the only policy is a remote URL and that page was not read, content findings stay unverified — never "missing". */
  const pol = textP.filter(p => POLICY_FILE.test(p.split('/').pop()) && /\.(html?|md)$/i.test(p));
  const localTxt = pol.map(text).join('\n'), remoteTxt = (A.listing && A.listing.privacyBody) || '';
  const polTxt = [localTxt, remoteTxt].filter(t => t && t.trim()).join('\n');
  const read = !!polTxt.trim();
  X.policy = { files: pol.slice(0, 5), read, unread: !read && !!(A.listing && A.listing.privacyUrl),
    source: localTxt.trim() ? 'local' : (remoteTxt.trim() ? 'url' : null),
    location: read && /location|위치|ตำแหน่ง|位置|स्थान/i.test(polTxt), ads: read && /advert|ads\b|admob|광고|โฆษณา|广告|विज्ञापन/i.test(polTxt),
    deletion: read && /delet|retention|retain|삭제|보관|ลบ|删除|保留|हटा/i.test(polTxt), thai: read && /[\u0E00-\u0E7F]/.test(polTxt) };
  /* force update and remote flags */
  X.forceUpdate = { code: codeP.filter(p => FORCE_UPDATE.test(text(p))).slice(0, 5), lib: UPDATE_LIBS.test(depHay + gradleTxt + codeP.map(text).join('\n').slice(0, 300000)) };
  X.remoteFlags = REMOTE_FLAGS.test(depHay + gradleTxt + codeP.slice(0, 60).map(text).join('\n'));
  /* tester opt-in pages in the repo */
  X.optinPages = textP.filter(p => /\.(html?|md)$/i.test(p) && OPTIN_PAGE.test(p.split('/').pop() + ' ' + p)).slice(0, 5).map(p => ({ path: p, ...optinCheck(text(p)) }));
  X.scannedAt = new Date().toISOString();
  return X;
}

/* ---------- in-app browser / opt-in page check ---------- */
export function optinCheck(html) {
  const s = String(html || '');
  return {
    play_test_link: /play\.google\.com\/apps\/(internaltest|testing)\//i.test(s),
    play_store_link: /play\.google\.com\/store\/apps\/details/i.test(s),
    external_browser_escape: /intent:\/\/|googlechrome:\/\/|openExternalBrowser=1|x-safari-https?:/i.test(s) || /open in (chrome|(your |an external )?browser)|chrome(으)?로 열기|브라우저로 열기|เปิดใน ?(chrome|เบราว์เซอร์)|在 ?chrome ?中打开|在浏览器中打开|chrome में खोलें|ब्राउज़र में खोलें/i.test(s),
    inapp_detection: /\bLine\/|FBAN|FBAV|Instagram|KAKAOTALK|in-?app browser|webview/i.test(s),
    mentions_14_days: /14/.test(s)
  };
}

/* ---------- H1: store requirements and deadlines ---------- */
export function requirements(st, L, opts = {}) {
  const A = st.A, X = st.X, an = A.android, io = A.ios, T = opts.today || today(), rows = [];
  const add = (id, severity, finding, action, extra = {}) => {
    const r = req(id); const days = r.date && isDate(r.date) ? daysBetween(T, r.date) : null;
    rows.push({ id, store: r.store === 'play' ? STORE.play : r.store === 'apple' ? STORE.apple : 'both', severity, rule: r.rule, finding, action: action || undefined,
      status: r.status, date: r.date || undefined, days_left: days !== null && days > 0 ? days : undefined, conservative: r.conservative || undefined,
      source: r.source, verified_on: r.verified_on, ...extra });
  };
  const stage = k => Flow.stageOf(st.dec, k);
  if (an) {
    const B = an.built && an.built.targetSdk ? an.built : null;
    /* 0.2.6: the built AAB / APK is what Play checks; when it disagrees with the source, the built value is reported */
    const t = B && an.targetSdk && B.targetSdk !== an.targetSdk ? B.targetSdk : an.targetSdk;
    const bt = B ? (B.targetSdk === an.targetSdk ? ` (the built ${B.kind.toUpperCase()} ${B.file} says the same)` : ` in the built ${B.kind.toUpperCase()} ${B.file}${an.targetSdk ? `; the source says ${an.targetSdk}, rebuild before uploading` : ''}`) : '';
    if (t && t < 36) add('play.target_api_36', 'block', `targetSdk is ${t}${bt}.`, 'Raise targetSdk (and compileSdk) to 36 and test the app on Android 16.');
    else if (t) add('play.target_api_36', 'ok', `targetSdk is ${t}${bt}.`);
    else add('play.target_api_36', 'warn', `targetSdk could not be read (${an.targetSdkRaw || 'not set'}).`, 'Check the targetSdk your build actually uses; it must be 36 or higher.');
    if (stage('play') === 'live' && t && t < 35) add('play.existing_api_35', 'block', `The live app targets ${t}.`, 'Ship an update that targets 36; until then new users on newer Android cannot install it.');
    /* 16 KB */
    if (!X) add('play.16kb_page_size', 'warn', rx(L, 'req.rescan'), 'Connect the app again.');
    else {
      const N0 = X.natives || { libs: [], unread: 0, nativeSrc: false, total: 0 };
      /* 0.2.6: with a built AAB / APK in the project, its own native libraries decide (that is what Play checks); source folders only explain */
      const bins = (N0.binaries || []).filter(b => !b.error);
      const N = bins.length ? { ...N0, libs: N0.libs.filter(l => l.binary), nativeSrc: false } : { ...N0, libs: N0.libs.filter(l => !l.binary) };
      const bad = N.libs.filter(l => l.bits === 64 && l.align != null && l.align < 16384), unread = N.libs.filter(l => l.align == null);
      const binNote = bins.length ? ` Checked inside the built ${bins.map(b => `${b.kind.toUpperCase()} ${b.path} (${b.libs} native librar${b.libs === 1 ? 'y' : 'ies'}${b.abis.length ? ': ' + b.abis.join(', ') : ''})`).join('; ')}.` : '';
      const hybrid = !bins.length && (['react-native', 'expo', 'flutter', 'unity', 'godot', 'maui', 'nativescript'].includes(A.framework) || X.build.reactNative || X.build.flutter);
      const agpOld = X.build.agp && vcmp(X.build.agp, '8.5.1') < 0 && !(bins.length && !N.libs.length);
      if (bad.length) add('play.16kb_page_size', 'block', `${bad.length} 64-bit native librar${bad.length > 1 ? 'ies are' : 'y is'} aligned to ${Math.min(...bad.map(l => l.align))} bytes: ${bad.slice(0, 4).map(l => l.path).join(', ')}.${binNote}`, 'Rebuild or update these libraries with 16 KB ELF alignment (NDK r28+, AGP 8.5.1+), then check the App bundle explorer in Play Console.', { files: bad.map(l => l.path) });
      else if (N.nativeSrc || unread.length || hybrid || agpOld) add('play.16kb_page_size', 'warn',
        [N.nativeSrc ? 'The project builds native code (CMake / ndk-build).' : '', hybrid ? `${A.framework} apps ship native libraries at build time.` : '', unread.length ? `${unread.length} native librar${unread.length > 1 ? 'ies' : 'y'} could not be read.` : '', agpOld ? `Android Gradle Plugin ${X.build.agp} is older than 8.5.1.` : ''].filter(Boolean).join(' '),
        'Use AGP 8.5.1+ and NDK r28+, update React Native / Flutter / game engines and native SDKs to 16 KB-ready versions, then confirm "Supports 16 KB" in Play Console > App bundle explorer.');
      else if (N.libs.length) add('play.16kb_page_size', 'ok', `${N.libs.length} native librar${N.libs.length > 1 ? 'ies are' : 'y is'} 16 KB aligned.${binNote}`);
      else if (bins.length) add('play.16kb_page_size', 'ok', `The built app contains no native libraries (.so), so 16 KB page size does not apply.${binNote}`);
      else add('play.16kb_page_size', 'ok', 'No native code found (Java/Kotlin only apps already support 16 KB).');
    }
    add('play.app_registration', 'check', 'Rocket Launcher cannot see Play Console.', 'Open the Play Console home page and register any app it lists as unregistered. The developer account must be verified.');
    add('play.trader_status', 'check', 'Every developer account must declare trader / non-trader.', 'Play Console > Manage account > Account details > About you. Not distributing in the EEA/UK: non-trader is allowed.');
    if (stage('play') !== 'live') add('play.closed_testing_personal', 'info', 'Applies to new personal developer accounts only.', 'Track it with rocketlauncher_closed_test.');
    if (A.sdk.location || A.sdk.contacts) add('play.contacts_location_policy_2027', 'check', `The app uses ${[A.sdk.location && 'location', A.sdk.contacts && 'contacts'].filter(Boolean).join(' and ')}.`, 'Re-check the permission declarations against the updated policy before 2027-01-27.');
  }
  if (io) {
    const hints = (X && X.build.xcodeHints) || [], vers = hints.map(h => h.version), maxV = vers.sort(vcmp).pop();
    if (maxV && vcmp(maxV, '26') < 0) add('apple.xcode_26', 'block', `Build config uses Xcode ${maxV} (${hints.map(h => h.file).join(', ')}).`, 'Switch the build machine or CI image to Xcode 26 or later.');
    else if (maxV) add('apple.xcode_26', 'ok', `Build config uses Xcode ${maxV}.`);
    else add('apple.xcode_26', 'check', `No Xcode version found in the project${X && X.build.lastUpgradeCheck ? ` (project last opened with Xcode ${X.build.lastUpgradeCheck})` : ''}.`, 'Archive with Xcode 26 or later (iOS 26 SDK). For Expo / EAS, use a build image with Xcode 26.');
    const dep = io.deploymentNum;
    if (dep && dep < 13) add('apple.min_target_ios13', 'block', `Deployment target is iOS ${io.deployment}.`, 'Raise IPHONEOS_DEPLOYMENT_TARGET to 13 or later (15 is needed from April 2027).');
    else if (dep) add('apple.min_target_ios13', 'ok', `Deployment target is iOS ${io.deployment}.`);
    add('apple.ios27_sdk', dep && dep < 15 ? 'warn' : 'info', dep && dep < 15 ? `Deployment target iOS ${io.deployment} is below 15.` : 'Plan the move to Xcode 27 before April 2027.', 'From April 2027: build with the iOS 27 SDK and target iOS 15 or later.');
    if (!io.privacyManifest) add('apple.privacy_manifest_reasons', 'block', 'No PrivacyInfo.xcprivacy in the app.', 'Add one (rocketlauncher_privacy_check drafts it, including required-reason APIs).');
    else if (X) {
      const missing = Object.keys(X.reasons).filter(c => !X.manifestApis.includes(c));
      if (missing.length) add('apple.privacy_manifest_reasons', 'block', `Required-reason APIs used but not declared: ${missing.map(c => c.replace('NSPrivacyAccessedAPICategory', '')).join(', ')}.`, 'Add them to NSPrivacyAccessedAPITypes with an approved reason (rocketlauncher_privacy_check has the entries).');
      else add('apple.privacy_manifest_reasons', 'ok', 'PrivacyInfo.xcprivacy covers the required-reason APIs found in the code.');
    } else add('apple.privacy_manifest_reasons', 'warn', rx(L, 'req.rescan'));
    if (io.encryption === undefined) add('apple.export_compliance', 'warn', 'ITSAppUsesNonExemptEncryption is not set.', 'Set it to NO (false) if the app only uses HTTPS and OS encryption; otherwise answer the export questions in App Store Connect.');
    else add('apple.export_compliance', 'ok', `ITSAppUsesNonExemptEncryption = ${io.encryption}.`);
    add('apple.age_rating_social_media', 'check', 'Answer the social media capability question in the age rating questionnaire.', 'No public feed or discovery of other users\' posts → answer No.');
    add('apple.age_rating_location_dating', 'check', A.sdk.location ? 'The app uses location. Showing nearby places is not "Shared Location"; sharing a user\'s location with other people is.' : 'Answer the new Shared Location and Dating & Relationships questions.', 'App Store Connect > App Information > Age Rating. Required with the next update; every app by 2027-01-12.');
    if (X && X.remoteFlags) add('apple.hidden_features', 'warn', 'The app uses remote config / feature flags.', 'List every feature that can be turned on remotely in the review notes (Guideline 2.5.19); keep store graphics free of prices and unverifiable claims (2.3.14).');
    else add('apple.hidden_features', 'info', 'No remote feature flags found.', 'Describe every feature in the review notes (Guideline 2.5.19).');
    add('apple.iphone_duo_screenshots', 'info', 'Upcoming screenshot size.', 'When you move to the iOS 27.1 SDK, add iPhone Duo screenshots. Never upload screenshots with an alpha channel.');
  }
  if (A.sdk.auth) {
    const d = deletionStatus(st);
    const sev = d.inApp && d.web ? 'ok' : 'block';
    if (an) add('play.account_deletion', sev, d.summary, sev === 'ok' ? undefined : 'Run rocketlauncher_account_deletion_check.');
    if (io) add('apple.account_deletion', d.inApp ? 'ok' : 'block', d.summary, d.inApp ? undefined : 'Run rocketlauncher_account_deletion_check.');
  }
  sortRows(rows);
  const c = counts(rows);
  return { title: rx(L, 'req.title'), summary: rx(L, 'req.summary', { ...c, date: REQ.verified_on }), counts: c, rules_verified_on: REQ.verified_on, today: T,
    rows: label(L, rows), rescan_needed: !X || undefined,
    note: 'Dates come from data/store-requirements.json (one table with the official source and the date each rule was checked). Where sources disagree (16 KB pages), Rocket Launcher applies the earliest date.' };
}

/* ---------- H6: account deletion ---------- */
function deletionStatus(st) {
  const A = st.A, X = st.X || {}, D = { code: [], text: false, pages: [], urls: [], kinds: [], confidence: null, ...(X.deletion || {}) };
  const DI = A.deletionInfo || {};
  if (DI.url && !D.urls.includes(DI.url)) D.urls = [DI.url, ...D.urls];
  D.path = D.path || DI.inAppPath || null; D.url = D.url || DI.url || null; D.path_source = D.path_source || DI.pathSource || null; D.url_source = D.url_source || DI.urlSource || null;
  const generated = !!(st.generated && A.sdk.auth);   // generate_store_materials made account-deletion-<lang>.html
  const R = A.review || {}, corr = (st.corrections || {}).account_deletion;
  let inApp = D.code.length > 0 || D.text || !!R.deletionInApp || !!D.path;
  let confidence = D.confidence || R.deletionConfidence || (inApp ? 'certain' : null);
  if (corr && corr.actual === 'present') { inApp = true; confidence = 'certain'; }
  if (corr && corr.actual === 'missing') { inApp = false; confidence = 'certain'; }
  const web = D.pages.length > 0 || D.urls.length > 0 || generated;
  const missing = [!inApp && 'no in-app "Delete account" path found', !web && 'no web deletion page or URL found'].filter(Boolean);
  return { inApp, web, generated, D, missing, confidence, corrected: !!(corr && corr.actual),
    summary: missing.length ? `Missing: ${missing.join('; ')}.` : 'In-app path and web page found.' };
}
export function deletionCheck(st, L) {
  const A = st.A, X = st.X, sig = (X && X.signals) || {};
  const accountSignals = !!(sig.USER_ACCOUNT || sig.ACCOUNT_DELETION);
  if (!A.sdk.auth && !accountSignals) return { title: rx(L, 'del.title'), summary: rx(L, 'del.notNeeded'), required: false };
  const d = deletionStatus(st), rows = [];
  const inSev = d.inApp ? 'ok' : (d.confidence === 'uncertain' ? 'check' : 'block');
  rows.push({ id: 'in_app', severity: inSev, what: 'Delete account inside the app (Play + App Store 5.1.1(v)).',
    finding: d.inApp ? `Found: ${[d.D.path ? `path "${d.D.path}" (${d.D.path_source})` : '', ...d.D.code, d.D.text ? 'a "Delete account" text' : '', ...((d.D.kinds || []).map(k => 'pattern:' + k)), d.corrected ? 'overridden by a correction report' : ''].filter(Boolean).join(', ')}` : (d.confidence === 'uncertain' ? 'Not certain — please confirm there is an in-app Delete account path.' : 'Not found.'),
    in_app_path: d.D.path || undefined,
    action: d.inApp ? undefined : 'Add Settings > Delete account. It must delete the account and its data (not just sign out), ask once for confirmation and say how long deletion takes.',
    source: 'https://developer.apple.com/support/offering-account-deletion-in-your-app/' });
  rows.push({ id: 'web', severity: d.web ? 'ok' : (A.platforms.android ? 'block' : 'warn'), what: 'A web page where users can request deletion without the app (Google Play requires it; enter the URL in Play Console > App content > Data safety).',
    finding: d.web ? `Found: ${[...d.D.urls, ...d.D.pages, d.generated ? 'account-deletion page from rocketlauncher_generate_store_materials' : ''].filter(Boolean).join(', ')}` : 'Not found.',
    url: d.D.url || undefined,
    action: d.web ? undefined : 'rocketlauncher_generate_store_materials makes account-deletion-<lang>.html. Host it (for example on GitHub Pages, free) and paste its URL in Play Console.',
    source: 'https://support.google.com/googleplay/android-developer/answer/13327111' });
  if (X && X.policy && X.policy.unread) {
    rows.push({ id: 'retention', severity: 'check', what: 'The privacy policy says what is deleted, what is kept and for how long.',
      finding: 'Could not verify (미확인): the privacy policy page was not read, so no finding is made about its contents. Confirm that it says what is deleted, what is kept and for how long.',
      action: 'Open the live privacy URL and confirm the retention section, or add a local copy of the policy in the project.',
      source: 'https://support.google.com/googleplay/android-developer/answer/13327111' });
  } else {
    rows.push({ id: 'retention', severity: X && X.policy.deletion ? 'ok' : 'warn', what: 'The privacy policy says what is deleted, what is kept and for how long.',
      finding: X && X.policy.deletion ? 'The privacy policy mentions deletion or retention.' : 'Not found in the privacy policy.', action: X && X.policy.deletion ? undefined : 'Add a short "Deleting your account" section (the generated privacy policy has one).',
      source: 'https://support.google.com/googleplay/android-developer/answer/13327111' });
  }
  if (A.ios && (A.sdk.appleSignIn || (A.ios && A.ios.appleSignIn))) rows.push({ id: 'siwa_revoke', severity: 'warn', what: 'Sign in with Apple: when an account is deleted, revoke the user\'s Apple tokens (REST API).',
    finding: 'Sign in with Apple is enabled.', action: 'Call Apple\'s token revocation endpoint from your server when the account is deleted.', source: 'https://developer.apple.com/support/offering-account-deletion-in-your-app/' });
  /* 0.2.6: the real path and URL when the project names them; placeholders only for what is unknown */
  const notes = `Account deletion: in the app, open ${d.D.path ? d.D.path : '[the in-app path, e.g. Settings > Delete account]'} (the account and its data are deleted). On the web: ${d.D.url || '[https://<your-site>/account-deletion.html]'}.`;
  sortRows(rows); const c = counts(rows);
  return { title: rx(L, 'del.title'), summary: d.missing.length ? rx(L, 'del.missing', { missing: d.missing.join('; ') }) : rx(L, 'del.ok'), required: true, counts: c, rows: label(L, rows),
    review_note_text: notes, in_app_path: d.D.path || null, deletion_url: d.D.url || null, play_console_field: 'Play Console > Policy and programs > App content > Data safety > "Delete account URL"' + (d.D.url ? ': ' + d.D.url : '') };
}

/* ---------- H3: privacy consistency + drafts ---------- */
function reasonsXml(X) {
  const cats = new Set(['NSPrivacyAccessedAPICategoryUserDefaults', ...Object.keys((X && X.reasons) || {})]);
  return [...cats].map(c => `\t\t<dict>\n\t\t\t<key>NSPrivacyAccessedAPIType</key><string>${c}</string>\n\t\t\t<key>NSPrivacyAccessedAPITypeReasons</key><array><string>${(RR[c] || {}).reason || 'CA92.1'}</string></array>\n\t\t</dict>`).join('\n');
}
export function privacyCheck(st, L) {
  const A = st.A, X = st.X, an = A.android || null, io = A.ios || null, R = A.review || {}, rows = [];
  const add = (id, severity, finding, action, source) => rows.push({ id, severity, finding, action: action || undefined, source: source || undefined });
  const perms = (an && an.permissions) || [], usage = (io && io.usage) || {};
  const fine = perms.some(p => /ACCESS_FINE_LOCATION/.test(p)), coarse = perms.some(p => /ACCESS_COARSE_LOCATION/.test(p)), bg = perms.some(p => /ACCESS_BACKGROUND_LOCATION/.test(p));
  const po = Flow.privacyOpts(A, st.dec);
  const locCorr = (st.corrections || {}).location_sharing;
  let sent = !!(R.locationSent || (X && X.location && X.location.sent) || po.location === 'server');
  let locConf = R.locationConfidence || (X && X.location && X.location.confidence) || null;
  if (locCorr && locCorr.actual === 'server') { sent = true; locConf = 'certain'; }
  if (locCorr && locCorr.actual === 'device') { sent = false; locConf = 'certain'; }
  /* location */
  if (A.sdk.location) {
    if (io && !usage.NSLocationWhenInUseUsageDescription && !usage.NSLocationAlwaysAndWhenInUseUsageDescription) add('loc.ios_string', 'block', 'Location is used but Info.plist has no NSLocationWhenInUseUsageDescription.', 'Add a purpose string that says why (for example "Shows fuel stations near you.").', 'https://developer.apple.com/documentation/bundleresources/information-property-list/nslocationwheninuseusagedescription');
    if (io && usage.NSLocationAlwaysAndWhenInUseUsageDescription && !bg && an) add('loc.always_mismatch', 'warn', 'iOS asks for Always location, Android does not ask for background location.', 'Use When In Use on iOS unless the feature really needs background location.');
    if (bg) add('loc.background', 'block', 'ACCESS_BACKGROUND_LOCATION is declared.', 'Remove it unless a core feature needs it; otherwise fill the Play location permissions declaration with a video.', 'https://support.google.com/googleplay/android-developer/answer/9799150');
    if (sent && st.dec.location === 'device') add('loc.datasafety_device', 'block', 'The code sends location to a server, but the Data safety answer says it stays on the device.', 'Answer that location is collected (app functionality) in Data safety and App Privacy.', 'https://support.google.com/googleplay/android-developer/answer/10787469');
    if (sent && fine) add('loc.precise', 'warn', 'ACCESS_FINE_LOCATION is declared and location is sent to the server.', 'In Data safety declare "Precise location" (not only Approximate), or use ACCESS_COARSE_LOCATION if approximate is enough.', 'https://support.google.com/googleplay/android-developer/answer/10787469');
    if (X && X.policy && X.policy.unread) add('loc.policy', 'check', 'Could not verify (미확인): the privacy policy page was not read, so no finding is made about whether it mentions location.', 'Open the live privacy URL and confirm it covers location, or add a local copy of the policy in the project.');
    else if (X && X.policy && !X.policy.location) add('loc.policy', 'warn', 'The privacy policy does not mention location.', 'Say what location is used for, whether it is sent and how long it is kept.');
    if (sent && locConf === 'uncertain' && !locCorr) {
      add('loc.confirm', 'check', 'Location looks like it may leave the device (coordinates appear near a network call), but this is not certain.', 'Confirm whether coordinates are sent off the device. If they are, declare location as collected in Data safety and App Privacy; if they stay on the device, confirm that.');
    } else if (!rows.some(r => r.id.startsWith('loc.'))) {
      add('loc.ok', 'ok', `Location: ${sent ? 'sent to the server' : 'used on the device'}${locCorr ? ' (from a correction report)' : locConf === 'certain' ? '' : ' (please confirm)'}; permission texts and declarations line up.`);
    }
  }
  /* tracking / ATT / ads */
  if (io) {
    const tr = Analyzer.tracking(A);
    if (tr.state === 'mixed') add('att.mixed', 'block', `Tracking setup is mixed. Found: ${tr.found.join(', ')}. Missing: ${tr.missing.join(', ')}.`, 'Pick one story: no tracking (remove the ATT string/prompt, NSPrivacyTracking=false, non-personalized ads) or full tracking (prompt before any tracking + string + manifest + App Privacy "Yes").', 'https://developer.apple.com/app-store/user-privacy-and-data-use/');
    else if (tr.state === 'tracking') add('att.tracking', 'warn', 'The app tracks users with ATT.', 'App Privacy must say "Yes, we track"; the prompt must appear before any tracking and the app must work if the user declines.');
    else if (A.sdk.ads && !R.npa) add('att.npa', 'warn', 'Ads without ATT: ad requests should be non-personalized.', 'Request non-personalized ads (npa=1) and answer "No, we do not track" in App Privacy.');
    else add('att.ok', 'ok', A.sdk.ads ? 'Ads are non-personalized and there is no ATT prompt: consistent.' : 'No tracking.');
  }
  if (A.sdk.ads && X && X.policy && X.policy.unread) add('ads.policy', 'check', 'Could not verify (미확인): the privacy policy page was not read, so no finding is made about whether it mentions advertising.', 'Open the live privacy URL and confirm it covers ads, or add a local copy of the policy in the project.');
  else if (A.sdk.ads && X && X.policy && X.policy.read && !X.policy.ads) add('ads.policy', 'warn', 'The app shows ads but the privacy policy does not mention advertising.', 'Mention the ad provider and the advertising ID in the privacy policy.');
  /* photos */
  if (perms.some(p => /READ_MEDIA_IMAGES|READ_MEDIA_VIDEO/.test(p))) add('photo.play', 'warn', 'READ_MEDIA_IMAGES / READ_MEDIA_VIDEO are declared.', 'Use the Android photo picker unless photo access is the app\'s core purpose, then remove the permissions (or file the Photo and Video Permissions declaration).', 'https://support.google.com/googleplay/android-developer/answer/14115180');
  if (io && A.sdk.photos && !usage.NSPhotoLibraryUsageDescription && !usage.NSPhotoLibraryAddUsageDescription && perms.some(p => /READ_MEDIA_IMAGES|READ_EXTERNAL_STORAGE/.test(p))) add('photo.ios_string', 'warn', 'Android reads photos but Info.plist has no photo library purpose string.', 'Use PHPicker (no permission) or add NSPhotoLibraryUsageDescription.');
  /* Google scanner signals that Data safety does not cover */
  const items = Gen.dataSafety(A, 'en', po), declared = JSON.stringify(items.rows).toLowerCase();
  if (X && X.signals) {
    const map = { CONTACTS: 'contacts', CALENDAR: 'calendar', HEALTH: 'health', FITNESS: 'fitness', SMS_CALL_LOG: 'sms', PHOTOS: 'photo', VIDEOS: 'video', AUDIO: 'audio', PHONE: 'phone' };
    for (const [k, word] of Object.entries(map)) if (k === 'AUDIO' && A.sdk.speechOnly && !declared.includes(word)) add('ds.audio_speech', 'check', `The app only uses speech-to-text (${X.signals.AUDIO[0]}); audio is not stored or sent, so the Data safety draft does not declare audio recordings.`, items.confirm, 'https://support.google.com/googleplay/android-developer/answer/10787469');
    else if (X.signals[k] && !declared.includes(word)) add('ds.' + k.toLowerCase(), 'warn', `Google's scanner patterns found ${k.toLowerCase().replace(/_/g, ' ')} access (${X.signals[k][0]}), but the Data safety draft does not list it.`, 'If this data leaves the device, add it to Data safety and App Privacy; if it stays on the device, you can leave it out.', 'https://support.google.com/googleplay/android-developer/answer/10787469');
  }
  /* 0.2.6: every privacy page, including copies bundled inside the app, must name this app and its current operator */
  for (const x of A.privacyPages || []) if (x.stale && x.stale.length && !x.old) add('policy.stale', 'warn', `${x.path}${x.bundled ? ' (bundled inside the app)' : ''}: ${x.stale.join('; ')}.`,
    x.bundled ? 'Update the bundled copy (or point the in-app link at the live privacy URL) and rebuild; users and reviewers can open this page from inside the app.' : 'Update this page or move it out of the project (archive/ folders are ignored).');
  /* PrivacyInfo required reasons */
  if (io) {
    const used = Object.keys((X && X.reasons) || {}), declaredApis = (X && X.manifestApis) || [];
    const miss = used.filter(c => !declaredApis.includes(c));
    if (!io.privacyManifest) add('xcprivacy.missing', 'block', 'No PrivacyInfo.xcprivacy.', 'Add the draft below to the app target.', 'https://developer.apple.com/documentation/bundleresources/privacy-manifest-files');
    else if (miss.length) add('xcprivacy.reasons', 'block', `Required-reason APIs used but not declared: ${miss.join(', ')}.`, 'Add the entries from privacy_manifest_reasons below.', 'https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api');
    else if (X) add('xcprivacy.ok', 'ok', 'PrivacyInfo.xcprivacy declares the required-reason APIs found in the code.');
    const sdkFrom = Object.entries((X && X.reasons) || {}).filter(([, v]) => v.from_sdk).map(([k]) => k);
    if (sdkFrom.length) add('xcprivacy.sdk', 'info', `Plugins that use required-reason APIs: ${sdkFrom.join(', ')}.`, 'Update these SDKs to versions that ship their own privacy manifest (Apple\'s commonly used SDK list).', 'https://developer.apple.com/support/third-party-SDK-requirements/');
  }
  sortRows(rows); const c = counts(rows);
  const appleItems = []; for (const r of items.rows) appleItems.push(r);
  const xc = io ? Gen.xcprivacy(A, po).replace(/\t<key>NSPrivacyAccessedAPITypes<\/key>\n\t<array>[\s\S]*?\n\t<\/array>\n<\/dict>/, `\t<key>NSPrivacyAccessedAPITypes</key>\n\t<array>\n${reasonsXml(X)}\n\t</array>\n</dict>`) : undefined;
  return { title: rx(L, 'pv.title'), summary: rx(L, 'pv.summary', c), counts: c, rows: label(L, rows),
    drafts: {
      data_safety: { rows: items.rows, not_collected: items.notCollected, confirm_with_user: items.confirm || undefined, note: 'Paste into Play Console > App content > Data safety. Data that never leaves the device is not "collected".' },
      app_privacy: io ? { tracking: po.tracking ? 'Yes, we track' : 'No, we do not track', data: items.rows.map(r => ({ type: r.label, purposes: r.purposes, linked_to_user: !!r.linked, used_for_tracking: !!r.tracking })) } : undefined,
      privacy_manifest_reasons: io ? Object.fromEntries(Object.entries((X && X.reasons) || { NSPrivacyAccessedAPICategoryUserDefaults: { reason: 'CA92.1', files: [] } }).map(([k, v]) => [k, { reason: v.reason, found_in: v.files.length ? v.files : (v.from_sdk ? ['plugin dependency'] : []) }])) : undefined,
      privacy_manifest: xc
    },
    rescan_needed: !X || undefined };
}

/* ---------- H4: Google Play Policy Insights ---------- */
const PPI_DOMAINS = {
  permissions_and_apis: { policies: ['location_access_policy', 'photo_video_access_policy', 'contacts_access_policy', 'sms_call_log_policy', 'all_files_access_policy', 'package_visibility_policy', 'audio_recording_policy', 'files_and_docs_policy', 'exact_alarm_policy', 'foreground_services_policy', 'accessibility_api_policy', 'target_api_level'],
    signals: ['PRECISE_LOCATION', 'APPROX_LOCATION', 'CONTACTS', 'SMS_CALL_LOG', 'PHOTOS', 'VIDEOS', 'AUDIO', 'FILES_AND_DOCS', 'APPS_ON_DEVICE', 'exact_alarm', 'foreground_service', 'accessibility'] },
  user_account: { policies: ['account_deletion', 'login_credentials'], signals: ['USER_ACCOUNT', 'ACCOUNT_DELETION'] },
  data_safety: { policies: ['data_safety_section', 'prominent_disclosure_policy'], signals: ['NAME', 'EMAIL', 'PHONE', 'ADDRESS', 'HEALTH', 'FITNESS', 'CREDIT_DEBIT_BANK_ACCOUNT_NUMBER', 'PURCHASE_HISTORY', 'APP_INTERACTIONS', 'CRASH_LOGS', 'DEVICE_ID', 'USER_GENERATED_CONTENT', 'network_transmission'] }
};
const PERM_POLICY = [[/ACCESS_(FINE|COARSE|BACKGROUND)_LOCATION/, 'location_access_policy'], [/READ_MEDIA_(IMAGES|VIDEO)/, 'photo_video_access_policy'], [/READ_CONTACTS|WRITE_CONTACTS/, 'contacts_access_policy'],
  [/READ_SMS|RECEIVE_SMS|SEND_SMS|READ_CALL_LOG|PROCESS_OUTGOING_CALLS/, 'sms_call_log_policy'], [/MANAGE_EXTERNAL_STORAGE/, 'all_files_access_policy'], [/QUERY_ALL_PACKAGES/, 'package_visibility_policy'],
  [/RECORD_AUDIO/, 'audio_recording_policy'], [/SCHEDULE_EXACT_ALARM|USE_EXACT_ALARM/, 'exact_alarm_policy'], [/FOREGROUND_SERVICE/, 'foreground_services_policy'], [/BIND_ACCESSIBILITY_SERVICE/, 'accessibility_api_policy']];
export function policyAudit(st, L) {
  const A = st.A, X = st.X;
  const attribution = { name: 'Play Policy Insights', by: 'Google LLC (The Android Open Source Project)', license: 'Apache-2.0', upstream: 'https://github.com/android/skills/tree/main/play/play-policy-insights', bundled_at: PPI_DIR, notice: path.join(PPI_DIR, 'NOTICE') };
  if (!A.android) return { title: rx(L, 'pa.title'), summary: rx(L, 'pa.noAndroid'), applies: false, attribution };
  const P = PPI.policies || {}, sig = (X && X.signals) || {}, perms = A.android.permissions || [];
  const pol = id => P[id] ? { id, name: P[id].name, url: (P[id].urls || [])[0] } : { id };
  const domains = {};
  for (const [dom, def] of Object.entries(PPI_DOMAINS)) {
    const found = def.signals.filter(s => sig[s]).map(s => ({ signal: s, where: sig[s] }));
    const policies = new Set(found.length ? [] : []);
    for (const [re, id] of PERM_POLICY) if (def.policies.includes(id) && perms.some(p => re.test(p))) policies.add(id);
    if (dom === 'permissions_and_apis' && A.android.targetSdk && A.android.targetSdk < 36) policies.add('target_api_level');
    if (dom === 'user_account' && (A.sdk.auth || sig.USER_ACCOUNT)) { policies.add('account_deletion'); policies.add('login_credentials'); }
    if (dom === 'data_safety') policies.add('data_safety_section');
    if (dom === 'data_safety' && found.length && !sig.disclosure && (sig.PRECISE_LOCATION || sig.CONTACTS || sig.PHOTOS)) policies.add('prominent_disclosure_policy');
    domains[dom] = { signals: found, review_against: [...policies].map(pol) };
  }
  const n = Object.values(domains).reduce((s, d) => s + d.review_against.length, 0);
  return { title: rx(L, 'pa.title'), summary: rx(L, 'pa.summary', { n }), applies: true, quick_scan: domains,
    login_for_review: A.sdk.auth ? 'If any feature needs sign-in, add working review credentials in Play Console > App content > App access (Rocket Launcher never stores passwords).' : 'No sign-in found: answer "All functionality is available without special access" in App access.',
    full_audit: ppiAvailable() ? {
      skill: path.join(PPI_DIR, 'SKILL.md'),
      how: 'For the complete audit, ask your AI agent to read and follow this SKILL.md with app_dir set to the Android app folder. It runs locally with Python 3 (standard library only) and writes its report to a .scratch folder in the workspace. Its report step also reads the app\'s public Play Store page when one exists and continues without it when offline. Free; no account or key.',
      other_ways: ['npx skills add android/skills --skill play-policy-insights', 'Android Studio: Code > Inspect for Play Policy Insights (lint)']
    } : { missing: 'The bundled skill folder was not found.' },
    caution: 'Google: AI can make mistakes. The audit is a checklist to review, not a Play review decision.',
    attribution, rescan_needed: !X || undefined };
}

/* ---------- H2: closed test 12 × 14 ---------- */
const NEED_TESTERS = 12, NEED_DAYS = 14;
const LABEL_RE = /^[^\n]{1,60}$/;
export function closedTestRecord(st, { testers, feedback, account_type, test_started }) {
  const C = st.closedTest = st.closedTest || { testers: {}, feedback: [], account_type: null };
  let n = 0;
  if (account_type) C.account_type = account_type;
  if (test_started && isDate(test_started)) C.test_started = test_started;
  for (const t of testers || []) {
    const lab = String(t.label || '').trim();
    if (!LABEL_RE.test(lab)) throw new Error('Each tester needs a short label (a nickname or initials; no e-mail needed).');
    if (t.opted_in && !isDate(t.opted_in)) throw new Error(`opted_in must be YYYY-MM-DD (${lab}).`);
    if (t.opted_out && !isDate(t.opted_out)) throw new Error(`opted_out must be YYYY-MM-DD (${lab}).`);
    const cur = C.testers[lab] || { history: [] };
    if (t.opted_in) { if (cur.opted_in && cur.opted_out && t.opted_in > cur.opted_out) cur.history.push({ opted_in: cur.opted_in, opted_out: cur.opted_out }); cur.opted_in = t.opted_in; if (!t.opted_out && cur.opted_out && cur.opted_out < t.opted_in) delete cur.opted_out; }
    if (t.opted_out) cur.opted_out = t.opted_out;
    if (t.remove) { delete C.testers[lab]; n++; continue; }
    C.testers[lab] = cur; n++;
  }
  for (const f of feedback || []) if (f && f.text) C.feedback.push({ date: isDate(f.date) ? f.date : today(), text: String(f.text).slice(0, 500), from: f.from ? String(f.from).slice(0, 60) : undefined });
  return n;
}
export function closedTestStatus(st, L, T = today()) {
  const C = st.closedTest || { testers: {}, feedback: [] }, A = st.A;
  if (C.account_type && C.account_type !== 'personal_new') return { title: rx(L, 'ct.title'), summary: rx(L, 'ct.notNeeded'), required: false };
  const list = Object.entries(C.testers).map(([label, t]) => {
    const active = !!t.opted_in && !(t.opted_out && t.opted_out >= t.opted_in);
    const days = active ? Math.max(0, daysBetween(t.opted_in, T)) : 0;
    return { label, opted_in: t.opted_in || null, opted_out: active ? undefined : t.opted_out, active, continuous_days: days, qualifies: active && days >= NEED_DAYS, restarted: t.history && t.history.length ? t.history.length : undefined };
  }).sort((a, b) => (a.opted_in || '9').localeCompare(b.opted_in || '9'));
  const active = list.filter(t => t.active), q = list.filter(t => t.qualifies).length;
  let left, earliest = null;
  if (active.length >= NEED_TESTERS) { earliest = addDays(active[NEED_TESTERS - 1].opted_in, NEED_DAYS); if (earliest < T) earliest = T; left = q >= NEED_TESTERS ? '' : rx(L, 'ct.left.days', { date: earliest, days: daysBetween(T, earliest) }); }
  else { earliest = addDays(T, NEED_DAYS); left = rx(L, 'ct.left.need', { n: NEED_TESTERS - active.length, date: earliest }); }
  const warnings = [];
  if (active.length < NEED_TESTERS + 3) warnings.push('Recruit 15–20 testers: anyone who leaves restarts their 14 days, and the 12 must be opted in on the day you apply.');
  if (list.some(t => t.restarted)) warnings.push('Some testers left and joined again; only their latest continuous period counts.');
  if ((C.feedback || []).length < 3) warnings.push('Google also looks at engagement. Ask testers to really use the app and send feedback (Play testing feedback or your own channel); log it with action=record so the application draft can summarize it.');
  warnings.push('Store nicknames only. Rocket Launcher keeps this list on this computer and never needs testers\' e-mails.');
  const ready = q >= NEED_TESTERS;
  return { title: rx(L, 'ct.title'), summary: ready ? rx(L, 'ct.ready') : rx(L, 'ct.summary', { q, left }), required: C.account_type ? true : 'only for personal Play accounts created after 2023-11-13 (pass account_type)',
    ready_to_apply: ready, qualified_testers: q, active_testers: active.length, earliest_apply_date: ready ? T : earliest, today: T, testers: list, feedback_logged: (C.feedback || []).length,
    warnings, next: ready ? 'Draft the application with action=application_draft, then the user applies in Play Console.' : 'Share the recruiting message (action=recruit_copy) and record opt-ins with action=record.',
    source: req('play.closed_testing_personal').source, app: A && A.appName };
}
export function closedTestDraft(st, L, T = today()) {
  const A = st.A, S = closedTestStatus(st, L, T), C = st.closedTest || { feedback: [] };
  /* 0.2.6: the developer's prepared store listing (default language) describes the app; a README about the project folder does not */
  const P = A.prepared, pl = P && (P.defaultLang && P.copy[P.defaultLang] ? P.defaultLang : P.langs[0]), pc = pl ? P.copy[pl] : null;
  const feats = ((pl && P.features[pl]) || (Gen.features ? Gen.features(A, pl || 'en') : [])).slice(0, 5).map(f => (typeof f === 'string' ? f : f.title || f.t || '')).filter(Boolean);
  const pitch = (pc && pc.short) || (A.tagline && (A.tagline[pl] || A.tagline.en)) || '[one-sentence value]', appTitle = (pc && pc.title) || A.appName;
  const fb = (C.feedback || []).slice(-8).map(f => `- ${f.date}: ${f.text}`).join('\n') || '- [summarize what testers reported]';
  const cat = (A.categories || [])[0] || 'app';
  return {
    title: rx(L, 'ct.title'), ready_to_apply: S.ready_to_apply, status: S.summary,
    note: 'Draft answers for Play Console > Dashboard > Apply for production. Edit them so they are true; the user submits the form. Google reviews within about 7 days.',
    sections: {
      about_your_closed_test: {
        recruiting: 'How easy was it to recruit testers? → [pick the option that is true]',
        engagement: `${S.active_testers} testers were opted in; ${S.qualified_testers} stayed in for 14+ days in a row. Testers used the main features: ${feats.join('; ') || '[list the main features]'}. [Say whether their usage matched how real users will use the app and any differences.]`,
        feedback_summary: `Feedback was collected through Google Play testing feedback and [your channel]. Main points:\n${fb}`
      },
      about_your_app: {
        target_audience: `[Who it is for, as specific as possible — for example: drivers in Thailand who want the cheapest ${cat === 'travel' ? 'route' : 'nearby option'}.]`,
        value: `${appTitle}: ${pitch}${feats.length ? ' Main features: ' + feats.join('; ') + '.' : ''}`,
        installs_first_year: '[pick an honest estimate]'
      },
      about_your_production_readiness: {
        changes_from_test: '[List what you changed after the closed test: fixed crashes, clearer texts, performance, etc.]',
        why_ready: `The app ran for ${S.qualified_testers >= NEED_TESTERS ? '14+' : '[n]'} days with ${S.active_testers} testers without blocking issues, the reported problems are fixed, the store listing, Data safety and content rating are complete, and the pre-launch report shows no critical issues. [Edit to match reality.]`
      }
    },
    listing_source: pc ? `prepared store listing (${pl}): ${Object.values(pc.files || {}).filter((v, i, a) => a.indexOf(v) === i).join(', ')}` : undefined,
    source: req('play.closed_testing_personal').source
  };
}
export function recruitCopy(st, link) {
  const app = (st.A && st.A.appName) || 'my app', l = link || '[opt-in link from Play Console > Closed testing > Testers > "Join on the web"]';
  return Object.fromEntries(Object.entries(RECRUIT).map(([k, v]) => [k, v.replace('{app}', app).replace('{link}', l)]));
}
export function optinReport(html, where) {
  const c = html && typeof html === 'object' ? html : optinCheck(html), rows = [];
  rows.push({ id: 'link', severity: c.play_test_link ? 'ok' : 'block', finding: c.play_test_link ? 'Play opt-in link found.' : 'No Play testing opt-in link (play.google.com/apps/testing/<package>) found.' });
  rows.push({ id: 'in_app_browser', severity: c.external_browser_escape ? 'ok' : 'warn', finding: c.external_browser_escape ? 'The page helps people leave in-app browsers (Open in Chrome / intent link / LINE openExternalBrowser=1).' : 'No way out of in-app browsers found.',
    action: c.external_browser_escape ? undefined : 'Add an "Open in Chrome" button (intent://… or a plain instruction), and add ?openExternalBrowser=1 to links you share in LINE.',
    evidence: 'Developer field reports: the Play opt-in can fail inside LINE, Facebook or Instagram in-app browsers. Google does not document this.' });
  rows.push({ id: 'days', severity: c.mentions_14_days ? 'ok' : 'warn', finding: c.mentions_14_days ? 'The page tells testers about the 14 days.' : 'The page does not say testers must stay opted in for 14 days.', action: c.mentions_14_days ? undefined : 'Add: "Please stay in the test for 14 days in a row."' });
  return { checked: where, rows: sortRows(rows) };
}

/* ---------- H5: reviewer notes ---------- */
export function reviewerNotes(st, L, { default_location, demo_account, extra } = {}) {
  const A = st.A, X = st.X || {}, io = A.ios || {}, an = A.android || {}, d = st.dec || {};
  const l0 = 'en', base = Flow.reviewNotes(A, d, l0);
  const lines = [base];
  if (A.sdk.location) lines.push(`Location: the app uses location only to ${'[say why, e.g. show fuel stations near you]'}. ${default_location ? `If location is denied or the reviewer is outside our service area, the app shows ${default_location} by default so every feature can be tested.` : '[Reviewers are usually in the US. Say what the app shows outside your service area, or add a default region so reviewers can test every feature.]'}`);
  const perms = Object.entries(io.usage || {}).map(([k, v]) => `${k}: ${v || '[purpose]'}`);
  if (perms.length) lines.push('Permissions requested and why:\n' + perms.map(x => '- ' + x).join('\n'));
  lines.push(X.remoteFlags ? 'Remote configuration is used only for [list: e.g. minimum version, prices of public data]. No features are hidden or enabled after review (Guideline 2.5.19).' : 'All features are visible in this build. There are no hidden or remotely enabled features (Guideline 2.5.19).');
  if (extra) lines.push(String(extra).slice(0, 1500));
  const needLogin = Flow.loginRequired(A, d) || demo_account === 'needed';
  const playAccess = needLogin ? 'Some functionality is restricted. Add instructions in Play Console > App content > App access: username [review account], password [type it only in Play Console], plus any steps (for example a one-time code that is not needed for this account).'
    : 'All functionality is available without special access.';
  const stores = Flow.storesOf(A).map(k => STORE[k]).join(' + ');
  const checklist = [
    needLogin ? 'Create a working review account that never expires and needs no 2-step code. Type its password only in the console.' : 'No demo account needed: the core features work without signing in.',
    A.sdk.location ? 'Make sure the app works for a reviewer outside your country (default region or demo data).' : null,
    A.sdk.auth ? 'Point to the in-app "Delete account" path in the notes.' : null,
    (A.review || {}).byok ? 'Attach a review-only API key in the notes field of the console (never in code or chat).' : null
  ].filter(Boolean);
  return { title: rx(L, 'rn.title'), summary: rx(L, 'rn.summary', { stores }), language_note: 'Notes are in English because store reviewers read English.',
    apple_review_notes: A.ios ? lines.join('\n\n') : undefined,
    play_app_access: A.android ? playAccess : undefined,
    play_review_notes: A.android ? lines.filter(x => !/Guideline 2\.5\.19/.test(x)).join('\n\n') : undefined,
    checklist };
}

/* ---------- H7: move the app to another developer account (neutral: two paths) ---------- */
const SECRET_LIKE = /-----BEGIN|\b(store|key)?pass(word|wd)?\s*[:=]|\bpwd\s*[:=]|\bsecret\s*[:=]|\btoken\s*[:=]|[A-Za-z0-9+/]{40,}={0,2}/i;
export function moveRecord(st, { key_backup_location }) {
  const v = String(key_backup_location || '').trim();
  if (!v) throw new Error('key_backup_location is empty.');
  if (v.length > 200 || SECRET_LIKE.test(v)) throw new Error('This looks like a secret (password, key or token). Save only WHERE the backup is kept, for example "1Password vault: Android keys" or "USB drive in the office safe". Never paste the key or its passwords.');
  st.move = { ...(st.move || {}), key_backup_location: v, recorded_at: today() };
  return st.move;
}
export function movePlan(st, L, { path: chosen, has_ads, account_type, stores: only } = {}) {
  const A = st.A, X = st.X || {}, S = A.sdk || {}, notable = X.notable || [];
  const ads = has_ads === undefined ? !!(S.ads || (A.ios && A.ios.gad)) : !!has_ads;
  const storesHere = Flow.storesOf(A).filter(k => !only || only.includes(k));
  const play = storesHere.includes('play'), apple = storesHere.includes('apple');
  const push = !!S.notifications && /firebase-messaging|firebase_messaging|aps-environment|APNs/i.test(JSON.stringify(A.android && A.android.deps || []) + JSON.stringify(A.ios || {}));
  const files = re => notable.filter(p => re.test(p));
  const keyNote = st.move && st.move.key_backup_location ? `Recorded backup location: ${st.move.key_backup_location}.` : 'Record WHERE the signing key backup is kept with action=record_key_location (location only, never the key or passwords).';
  const step = (id, title, detail, extra = {}) => ({ id, title, detail, ...extra });

  const transfer = { id: 'transfer', name: 'Transfer the existing app', keeps: ['Package name / bundle ID', 'Installs, ratings and reviews', 'Existing users get updates normally', 'Play App Signing key (moves with the app)'],
    costs: ['Both accounts must be in good standing; Play needs the registration transaction ID of BOTH accounts', 'Firebase, AdMob, Google Analytics and Google Cloud links do not move: relink by hand', 'Play test tracks / tester lists do not move', 'Apple: the app must meet the transfer criteria; TestFlight data and some services do not move', 'Support replies in about 2 business days (Play)'],
    steps: [
      play && step('play_ids', 'Find both Play registration transaction IDs', 'Old and new owner: search mail for "Developer registration fee" or open Google Payments > Activity > "Google Play Developer". Formats: ….token.…, 0.G.…, Registration-…, PDS.….', { source: 'https://support.google.com/googleplay/android-developer/answer/6230247' }),
      play && step('play_request', 'Request the transfer (the old owner does this)', 'Use the app transfer request in Play Console help (Users and permissions is not a transfer). Have the target account ready; Google replies in about 2 business days.', { source: 'https://support.google.com/googleplay/android-developer/answer/6230247' }),
      apple && step('apple_check', 'Check Apple\'s transfer criteria', 'Account Holder: App Store Connect > the app > App Information > Transfer App. The app must meet every app transfer criterion first.', { source: 'https://developer.apple.com/help/app-store-connect/transfer-an-app/overview-of-app-transfer' }),
      apple && step('apple_request', 'Start the transfer with the recipient\'s Team ID and Account Holder Apple Account', 'The recipient accepts within 60 days.', { source: 'https://developer.apple.com/help/app-store-connect/transfer-an-app/initiate-an-app-transfer' }),
      step('relink', 'Relink services in the new account', ['Firebase: add the new owner as project Owner, or move the project to the new Google account', play && 'Link the app again in Play Console > Setup > Linked services (Google Cloud / Firebase)', S.analytics && 'Google Analytics: grant access to the new owner', ads && 'AdMob (only because the app shows ads): link the app to the new AdMob account and update app-ads.txt'].filter(Boolean).join('; ') + '.'),
      step('testers', 'Recreate test tracks', 'Tester lists do not move; set up internal/closed testing again.'),
      step('key', 'Signing key backup', keyNote)
    ].filter(Boolean) };

  const needsCT = !account_type || account_type === 'personal_new';
  const newReg = { id: 'new_registration', name: 'Register again as a new app', keeps: ['Nothing is shared with the old app: clean start in the new account', 'No dependency on the old account or support tickets'],
    costs: ['Starts with 0 installs, ratings and reviews', 'Existing users must install the new app (old app cannot update into it)', 'New personal Play accounts must run the 12 testers × 14 days closed test before production', 'The old app name may stay taken on the App Store until the old app is removed'],
    steps: [
      step('ids', 'Choose a new package name / bundle ID', `Old: ${A.pkg || '(not found)'}. Play package names are never reusable; Apple bundle IDs are not reusable once a build was uploaded. Update applicationId / namespace, PRODUCT_BUNDLE_IDENTIFIER (and app.json / pubspec settings).`, { files: files(/AndroidManifest|build\.gradle|project\.pbxproj|app\.json/) }),
      step('signing', 'Create a new upload key and enroll in Play App Signing', 'Generate a new upload keystore for the new app (Android Studio > Generate Signed Bundle), enroll in Play App Signing, and for iOS let Xcode create new certificates and profiles in the new team. ' + keyNote, { source: 'https://support.google.com/googleplay/android-developer/answer/9842756', key_files_found: files(/\.(jks|keystore|p12|p8|mobileprovision)$|key\.properties$/) }),
      step('firebase', 'Create a new Firebase project and config', 'Register the new package / bundle ID, download new google-services.json and GoogleService-Info.plist, replace the old ones' + (S.googleSignIn ? ', and add the new SHA-1 and SHA-256 (upload key AND Play app signing key) for Google Sign-In' : '') + '.', { files: files(/google-services\.json|GoogleService-Info\.plist/) }),
      files(/assetlinks\.json|apple-app-site-association/).length ? step('links', 'Update App Links / Universal Links', 'Put the new package name + SHA-256 in assetlinks.json and the new Team ID + bundle ID in apple-app-site-association.', { files: files(/assetlinks\.json|apple-app-site-association/) }) : null,
      push ? step('push', 'Push notifications', 'Upload a new APNs key from the new team to the new Firebase project; FCM works with the new config.') : null,
      S.billing ? step('iap', 'In-app products (only because the app sells something)', 'Create the products / subscriptions again in the new app; purchases from the old app do not carry over — plan restore by account if needed.') : null,
      ads ? step('admob', 'AdMob (optional: only because the app shows ads)', 'Add the new app in AdMob, replace the app ID and ad unit IDs, and publish app-ads.txt on the developer website.', { optional: true, files: files(/app-ads\.txt/) }) : null,
      play && needsCT ? step('closed_test', 'Closed test: 12 testers × 14 days (new personal Play accounts)', 'Track it with rocketlauncher_closed_test.', { source: req('play.closed_testing_personal').source }) : null,
      step('listing', 'Recreate the store listings', 'Name, descriptions, screenshots, Data safety, App Privacy, content rating, privacy policy and deletion URLs: rocketlauncher_generate_store_materials makes them again.'),
      step('old_app', 'Plan the old app', 'Show existing users an in-app notice with a link to the new app, then unpublish/remove it (rocketlauncher_remove_app_guide). Do this only when the owner decides.')
    ].filter(Boolean) };
  const p = chosen === 'transfer' ? transfer : chosen === 'new_registration' ? newReg : null;
  return { title: rx(L, 'mv.title'), summary: p ? rx(L, chosen === 'transfer' ? 'mv.transfer' : 'mv.new') : rx(L, 'mv.neutral'), chosen: p ? p.id : null,
    paths: p ? undefined : [transfer, newReg].map(x => ({ id: x.id, name: x.name, keeps: x.keeps, costs: x.costs })), plan: p || undefined,
    ads_step: ads ? 'included (the app shows ads)' : 'not included (no ads found; pass has_ads=true if the app will show ads)',
    notable_files: notable.length ? notable : undefined,
    safety: 'Rocket Launcher only plans. It never moves, deletes, creates accounts or changes permissions, and it never reads or copies keys or passwords.' };
}

/* ---------- M1: unpublish / delete guide ---------- */
export function removeGuide(L, store) {
  const play = { store: STORE.play, unpublish: ['Before you start: accept the latest Developer Distribution Agreement and turn off Managed publishing for the app.', 'Play Console > the app > Test and release > Setup > Advanced settings > App availability > Unpublish.', 'Existing users keep the app and still receive updates you publish; new users cannot find or install it.', 'You can publish it again later.'],
    delete: ['Unpublish first. Self-service deletion needs: the app unpublished, nothing in review, fewer than 1,000 active devices (used in the last 30 days), not rejected, blocked or suspended.',
      'Monetized apps (paid, in-app purchases or subscriptions) can be deleted this way only if they have zero lifetime installs; otherwise contact Play support.',
      'Only the account owner: Test & release > Advanced settings > App availability > Delete app. Enter the package name and the developer registration transaction ID.',
      'Transaction ID: search the owner\'s mail for "Developer registration fee" or Google Payments > Activity. Formats: ….token.…, 0.G.…, Registration-…, PDS.…. Remove the first part ("0.G.", or the digits before "token" / "Registration") before entering it.',
      'You can restore it within 7 days; after that it is permanent. A deleted app cannot be transferred.',
      'Package name: freed for anyone only if the app had zero lifetime installs; with any installs it can never be reused, not even by you.'],
    source: 'https://support.google.com/googleplay/android-developer/answer/9859350', delete_source: 'https://support.google.com/googleplay/android-developer/answer/16483176' };
  const apple = { store: STORE.apple, unpublish: ['App Store Connect > the app > Pricing and Availability > remove it from sale in all countries.', 'It disappears from the App Store for new users; people who already installed it keep it. You can make it available again later.'],
    delete: ['First remove it from sale everywhere and remove in-app purchases.', 'Not possible while the app is Ready for Review, Waiting for Review, In Review, Metadata Rejected or Rejected.', 'App Store Connect > the app > App Information > Remove App.', 'You lose the app name (others can take it); the SKU can never be reused; the bundle ID cannot be reused if a build was ever uploaded.', 'It can be restored later from the "Removed Apps" filter if the name is still free.'],
    source: 'https://developer.apple.com/help/app-store-connect/create-an-app-record/remove-an-app/' };
  return { title: rx(L, 'rm.title'), summary: rx(L, 'rm.summary'), guides: [(!store || store === 'play') && play, (!store || store === 'apple') && apple].filter(Boolean) };
}

/* ---------- M2/M3: version and build numbers, force-update safety ---------- */
const readable = v => v != null && /^\d+(\.\d+)*$/.test(String(v).trim());
async function storeLookup(bundleId, country) {
  try {
    const r = await fetch(`https://itunes.apple.com/lookup?bundleId=${encodeURIComponent(bundleId)}${country ? '&country=' + encodeURIComponent(country) : ''}`, { signal: AbortSignal.timeout(8000) });
    const j = await r.json(); const x = j.results && j.results[0];
    return x ? { found: true, version: x.version, released: x.currentVersionReleaseDate } : { found: false };
  } catch (e) { return { error: String(e.message || e) }; }
}
export async function versionSync(st, L, args = {}, others = []) {
  const A = st.A, an = A.android || null, io = A.ios || null, rows = [];
  const add = (id, severity, finding, action) => rows.push({ id, severity, finding, action: action || undefined });
  const V = st.versions = st.versions || { used: [], codes: [], builds: [] };
  for (const v of args.used_versions || []) if (readable(v) && !V.used.includes(String(v))) V.used.push(String(v));
  for (const c of args.used_version_codes || []) if (Number.isInteger(+c) && !V.codes.includes(+c)) V.codes.push(+c);
  const cur = { android_versionName: an && an.versionName, android_versionCode: an && an.versionCode, ios_version: io && io.version, ios_build: io && io.build, app: A.version };
  if (an && an.versionName && !readable(an.versionName)) add('android.name_unreadable', 'info', `versionName is "${an.versionName}" (set at build time).`, 'Check the value your build tool injects (pubspec.yaml / app.json).');
  if (io && io.version && !readable(io.version)) add('ios.version_unreadable', 'info', `MARKETING_VERSION is "${io.version}" (set at build time).`, 'Check the value your build tool injects (pubspec.yaml / app.json).');
  const vA = an && readable(an.versionName) ? an.versionName : null, vI = io && readable(io.version) ? io.version : null;
  if (vA && vI && vcmp(vA, vI) !== 0) add('cross_platform', 'warn', `Android ${vA} and iOS ${vI} differ.`, 'Use the same version name on both stores so support and force-update rules stay simple.');
  else if (vA && vI) add('cross_platform', 'ok', `Android and iOS both use ${vA}.`);
  const planned = args.planned_version && readable(args.planned_version) ? String(args.planned_version) : null;
  const all = [...V.used, vA, vI].filter(Boolean);
  for (const u of V.used) for (const w of [planned, vI].filter(Boolean)) if (u !== w && vcmp(u, w) === 0) add('apple_equivalent', 'block', `"${w}" and "${u}" are the same version for Apple.`, `App Store Connect treats ${u} and ${w} as one version; pick a higher one.`);
  if (planned) {
    const max = V.used.length ? [...V.used].sort(vcmp).pop() : null;
    if (max && vcmp(planned, max) <= 0) add('planned_not_higher', 'block', `Planned ${planned} is not higher than ${max}, which was already used.`, `Use ${bumpPatch(max)} or higher.`);
    else add('planned', 'ok', `Planned version ${planned} is new.`);
  }
  if (an && an.versionCode) {
    const vc = +an.versionCode, maxC = V.codes.length ? Math.max(...V.codes) : null;
    if (maxC != null && vc <= maxC) add('version_code', 'block', `versionCode ${vc} is not higher than ${maxC}, already uploaded.`, `Set versionCode to ${maxC + 1} or higher (Play rejects reused or lower codes).`);
  }
  if (io && io.build && readable(io.build)) add('ios_build', 'info', `iOS build number is ${io.build}.`, 'Each upload for the same version needs a higher build number.');
  /* other apps (e.g. country variants) */
  const family = others.map(o => ({ project: o.id, name: o.A && o.A.appName, android: o.A && o.A.android && o.A.android.versionName, ios: o.A && o.A.ios && o.A.ios.version })).filter(o => o.name);
  const famVers = family.flatMap(f => [f.android, f.ios]).filter(readable);
  if (family.length) {
    const hi = [...famVers, ...all].filter(readable).sort(vcmp).pop();
    if (famVers.some(v => vA && vcmp(v, vA) !== 0) || famVers.some(v => vI && vcmp(v, vI) !== 0)) add('family', 'warn', `Related apps use other versions: ${family.map(f => `${f.name} ${[f.android, f.ios].filter(Boolean).join('/')}`).join(', ')}.`, `To keep them in sync, release the next update of all of them as ${bumpPatch(hi)}.`);
    else add('family', 'ok', 'Related apps use the same version.');
  }
  const next = bumpPatch([...all, ...famVers, planned].filter(readable).sort(vcmp).pop() || A.version || '1.0.0');
  /* force update */
  let store = args.store_visible ? { version: String(args.store_visible), from: 'you' } : null;
  if (!store && args.check_store && io && io.bundleId) { const r = await storeLookup(io.bundleId, args.country); if (r.found) store = { version: r.version, from: 'App Store lookup (free, public)', released: r.released }; else if (r.error) add('store_lookup', 'info', `App Store lookup failed: ${r.error}.`); else add('store_lookup', 'info', 'The app was not found on the App Store (not released yet, or not in that country).'); }
  const X = st.X || {};
  const fu = X.forceUpdate || { code: [], lib: false };
  if (fu.code.length || fu.lib) add('force_update.found', 'info', `Force-update logic found${fu.code.length ? ': ' + fu.code.join(', ') : ''}${fu.lib ? ' (update library)' : ''}.`);
  for (const [k, sev] of [['server_min_version', 'block'], ['server_latest_version', 'warn']]) {
    const v = args[k]; if (!v) continue;
    if (!store) add(k, 'warn', `${k} = ${v}, but the version visible in the store is unknown.`, 'Pass store_visible (or check_store=true for iOS). Raise the server value only after the new build is live in every store and country.');
    else if (vcmp(v, store.version) > 0) add(k, sev, `${k} ${v} is higher than the store version ${store.version} (${store.from}).`, sev === 'block' ? 'Users would be forced to update to a version they cannot download yet. Lower it until the new build is live everywhere (Play rollouts and Apple phased release take days).' : 'Users would be asked to update to a version they cannot download yet.');
    else add(k, 'ok', `${k} ${v} ≤ store version ${store.version}.`);
  }
  sortRows(rows); const c = counts(rows);
  return { title: rx(L, 'vs.title'), summary: rx(L, 'vs.summary', { issues: c.block + c.warn, next }), counts: c, rows: label(L, rows), current: cur, suggested_next: { version: next, android_versionCode: an && an.versionCode ? Math.max(+an.versionCode, ...(V.codes.length ? V.codes : [0])) + 1 : undefined },
    used_versions: V.used, used_version_codes: V.codes, related_apps: family.length ? family : undefined, store_visible: store || undefined, force_update_rule: rx(L, 'vs.forceUpdate') };
}

/* ---------- M5: country rules ---------- */
export function countryCheck(st, L, { countries, developer_country } = {}) {
  const A = st.A, X = st.X || {}, S = A.sdk || {}, R = A.review || {}, rows = [];
  const want = (countries && countries.length ? countries : ['KR', 'EU', 'TH']).map(c => String(c).toUpperCase());
  const po = Flow.privacyOpts(A, st.dec), sent = R.locationSent || po.location === 'server';
  const storesHere = Flow.storesOf(A);
  const dev = developer_country ? String(developer_country).toUpperCase() : null;
  const personal = S.auth || S.analytics || S.crash || S.ads || (S.location && sent) || S.cloudDb;
  for (const r of REQ.countries.filter(r => want.includes(r.country))) {
    if (r.store !== 'both' && !storesHere.includes(r.store)) continue;
    let sev, finding;
    switch (r.applies) {
      case 'location_sent':
        if (!S.location) { sev = 'ok'; finding = 'The app does not use location.'; }
        else if (R.locationSent || (st.dec || {}).location === 'server') { sev = 'warn'; finding = 'Location is sent to a server.'; }
        else if ((st.dec || {}).location === 'device') { sev = 'ok'; finding = 'Location stays on the device: no report needed.'; }
        else { sev = 'check'; finding = 'The app uses location; decide whether it is sent to a server.'; }
        break;
      case 'developer_in_kr':
        if (!dev) { sev = 'check'; finding = 'Only if the developer is based in South Korea (pass developer_country).'; }
        else if (dev === 'KR') { sev = 'warn'; finding = 'The developer is based in South Korea.'; }
        else { sev = 'ok'; finding = `The developer is based in ${dev}: not required.`; }
        break;
      case 'games_entertainment':
        if ((A.categories || []).some(c => /game|entertain/i.test(c))) { sev = 'check'; finding = `Category: ${A.categories[0]}.`; } else { sev = 'info'; finding = 'Not a game / entertainment app.'; }
        break;
      case 'personal_data':
        if (!personal) { sev = 'ok'; finding = 'No personal data collection found.'; }
        else if (!X.policy || !X.policy.files.length) { sev = 'warn'; finding = 'The app handles personal data; no privacy policy file found in the project.'; }
        else if (!X.policy.thai) { sev = 'warn'; finding = 'The privacy policy has no Thai version.'; }
        else { sev = 'ok'; finding = 'A Thai privacy policy was found.'; }
        break;
      default: sev = 'check'; finding = 'Applies to every developer account.';
    }
    rows.push({ id: r.id, country: r.country, store: r.store === 'both' ? 'both' : STORE[r.store], severity: sev, finding, rule: r.rule, source: r.source, also: r.also, verified_on: r.verified_on });
  }
  sortRows(rows); const c = counts(rows);
  return { title: rx(L, 'cc.title'), summary: rx(L, 'cc.summary', { n: rows.filter(r => !['ok', 'info'].includes(r.severity)).length }), countries: want, counts: c, rows: label(L, rows),
    note: 'Legal summaries, not legal advice. Check the source before acting.' };
}

/* ---------- report / guide wiring ---------- */
export function releaseChecks(st, L) {
  const q = requirements(st, L), p = privacyCheck(st, L), d = deletionCheck(st, L);
  const all = [...q.rows, ...p.rows, ...(d.rows || [])];
  const c = counts(all);
  return { summary: rx(L, 'rc.note', c), counts: c, rules_verified_on: REQ.verified_on,
    must_fix: all.filter(r => r.severity === 'block').map(r => ({ id: r.id, finding: r.finding, action: r.action, source: r.source })),
    to_check: all.filter(r => r.severity === 'warn').map(r => ({ id: r.id, finding: r.finding, action: r.action })),
    needs_confirmation: all.filter(r => r.severity === 'check').map(r => ({ id: r.id, finding: r.finding, action: r.action })),
    rescan_needed: !st.X || undefined };
}
export function guideStep(st, L) {
  const r = releaseChecks(st, L);
  return { id: 'release-checks', title: rx(L, 'rc.step.t'), detail: rx(L, 'rc.step.d'), status: r.counts.block || r.counts.check ? 'todo' : 'done', counts: r.counts,
    items: r.must_fix.map(x => `${x.finding}${x.action ? ' → ' + x.action : ''}`),
    tools: ['rocketlauncher_check_requirements', 'rocketlauncher_privacy_check', 'rocketlauncher_account_deletion_check', 'rocketlauncher_reviewer_notes'] };
}


/* ---------- correction reports (0.2.2) ---------- */
const CHECK_ACTUAL = {
  account_deletion: ['present', 'missing'],
  location_sharing: ['server', 'device'],
  auth: ['present', 'missing'],
  cloud_db: ['present', 'missing']
};
export const CORRECTION_CHECKS = CHECK_ACTUAL;

export function inferredVerdict(st, check_id) {
  const A = st.A || {}, R = A.review || {}, d = deletionStatus(st);
  if (check_id === 'account_deletion') return d.inApp ? 'present' : 'missing';
  if (check_id === 'location_sharing') {
    const sent = !!(R.locationSent || (st.X && st.X.location && st.X.location.sent) || (st.dec || {}).location === 'server');
    return sent ? 'server' : 'device';
  }
  if (check_id === 'auth') return A.sdk && A.sdk.auth ? 'present' : 'missing';
  if (check_id === 'cloud_db') return A.sdk && A.sdk.cloudDb ? 'present' : 'missing';
  return 'unknown';
}

export function applyCorrections(st) {
  const A = st.A; if (!A) return st;
  A.review = A.review || {};
  for (const [id, c] of Object.entries(st.corrections || {})) {
    if (!c || !CHECK_ACTUAL[id] || !CHECK_ACTUAL[id].includes(c.actual)) continue;
    if (id === 'account_deletion') { A.review.deletionInApp = c.actual === 'present'; A.review.deletionConfidence = 'certain'; A.review.deletionOverridden = true; }
    if (id === 'location_sharing') {
      A.review.locationSent = c.actual === 'server'; A.review.locationConfidence = 'certain'; A.review.locationOverridden = true;
      st.dec = st.dec || {}; st.dec.location = c.actual;
    }
    if (id === 'auth' && A.sdk) A.sdk.auth = c.actual === 'present';
    if (id === 'cloud_db' && A.sdk) A.sdk.cloudDb = c.actual === 'present';
  }
  if (Analyzer.refreshIssues) Analyzer.refreshIssues(A);
  return st;
}

export function patternKindsOf(st, check_id) {
  const R = (st.A && st.A.review) || {}, X = st.X || {};
  if (check_id === 'account_deletion') return [...new Set([...(R.deletionKinds || []), ...((X.deletion && X.deletion.kinds) || [])])];
  if (check_id === 'location_sharing') return [...new Set([...(R.locationKinds || []), ...((X.location && X.location.kinds) || [])])];
  return [];
}

export function langKindOf(st) {
  const files = Object.keys((st.projectFiles) || (st.A && st.A._files) || {});
  const code = ((st.X && st.X.deletion && st.X.deletion.code) || []).join(' ') + ' ' + files.join(' ');
  if (/\.dart(\b|$)/i.test(code)) return 'dart';
  if (/\.(kt|java)(\b|$)/i.test(code)) return 'kotlin';
  if (/\.(swift|m|mm)(\b|$)/i.test(code)) return 'swift';
  if (/\.(tsx|ts)(\b|$)/i.test(code)) return 'ts';
  if (/\.(jsx|js|mjs)(\b|$)/i.test(code)) return 'js';
  const fw = (st.A && st.A.framework) || '';
  if (fw === 'flutter') return 'dart';
  if (fw === 'react-native' || fw === 'capacitor' || fw === 'cordova' || fw === 'ionic') return 'js';
  return 'unknown';
}
