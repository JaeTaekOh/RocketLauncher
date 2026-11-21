/* Rocket Launcher — 프로젝트 정적 분석 (매니페스트·gradle·Info.plist·strings·README 등)
   네트워크·API 키 없이 브라우저 안에서만 동작한다. */
(function () {
  'use strict';
  const PLAY_TARGET = 36;          // 2026-08-31부터 신규 앱·업데이트 targetSdk 36 이상 (Play Console 도움말)
  const IOS_SDK_NOTE = 26;         // 2026-04부터 iOS 26 SDK(Xcode 26)로 빌드해야 업로드 가능

  const find = (files, re) => Object.keys(files).filter(p => re.test(p) && files[p].text != null);
  const shortest = arr => arr.slice().sort((a, b) => a.length - b.length)[0];
  const txt = (files, p) => (p && files[p] && files[p].text) || '';
  /* 0.2.4: C-style comments (Gradle, Kotlin, Java, Swift, Dart, JS/TS) removed; quoted strings and template literals are kept, so URLs survive. */
  const stripCode = s => String(s || '').replace(/("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`)|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (m, q) => q || '');

  function parseXml(s) { try { const d = new DOMParser().parseFromString(s, 'application/xml'); return d.querySelector('parsererror') ? null : d; } catch (e) { return null; } }
  function aAttr(el, name) { return el.getAttribute('android:' + name) ?? el.getAttributeNS('http://schemas.android.com/apk/res/android', name); }

  function parseStrings(s) {
    const out = {}; const d = parseXml(s); if (!d) return out;
    d.querySelectorAll('string').forEach(n => { out[n.getAttribute('name')] = n.textContent.replace(/\\'/g, "'").replace(/\\n/g, '\n').trim(); });
    return out;
  }
  function parsePlist(s) {
    const out = {}; const d = parseXml(s); if (!d) return out;
    const dict = d.querySelector('plist > dict'); if (!dict) return out;
    const kids = [...dict.children];
    for (let i = 0; i < kids.length; i++) if (kids[i].tagName === 'key') {
      const v = kids[i + 1]; if (!v) continue;
      out[kids[i].textContent] = v.tagName === 'string' ? v.textContent : v.tagName === 'true' ? true : v.tagName === 'false' ? false : v.tagName === 'array' ? [...v.children].map(c => c.textContent) : v.textContent;
    }
    return out;
  }
  function gradleVal(g, key) {
    const m = g.match(new RegExp('\\b' + key + '(?:Version)?\\s*(?:=|\\s)\\s*(?:Integer\\.parseInt\\()?["\']?([\\w.\\-]+)["\']?')); return m ? m[1] : null;
  }
  /* 0.1.5: resolve SDK levels that point at a variable (rootProject.ext.targetSdkVersion, variables.gradle, gradle.properties).
     Returns a number, or null when the value cannot actually be read (for example flutter.targetSdkVersion). */
  function resolveSdk(raw, F, gradles) {
    if (raw == null) return null;
    if (/^\d+$/.test(raw)) return +raw;
    if (/^flutter\./.test(raw)) return null;
    /* 0.2.5: project.targetSdkVersion.toInteger() / "as int" (gradle.properties values are strings) */
    const name = String(raw).replace(/^(rootProject\.ext\.|project\.ext\.|rootProject\.|project\.|ext\.)/, '').replace(/\.(get|toInteger|toString)$/, '').replace(/\.(toInteger|get)$/, '');
    if (!/^[A-Za-z_][\w]*$/.test(name)) return null;
    /* 0.2.6: where the value is defined comes first (Capacitor variables.gradle `ext { targetSdkVersion = 36 }`, the root build.gradle ext block,
       gradle.properties), and a fallback in a ternary of another module (`hasProperty('x') ? rootProject.ext.x : 35`) is never a definition. */
    const re = new RegExp('(?:^|[\\s{;,(])(?:ext\\.|project\\.ext\\.|rootProject\\.ext\\.)?' + name + '\\s*(?:=|:)?\\s*["\']?(\\d{2})\\b', 'm');
    const rank = p => /(^|\/)variables\.gradle$/.test(p) ? 0 : /(^|\/)gradle\.properties$/.test(p) ? 2 : /(^|\/)(android\/)?build\.gradle(\.kts)?$/.test(p) && !/\/app\//.test(p) ? 1 : 3;
    const files = gradles.concat(find(F, /(^|\/)gradle\.properties$/)).sort((a, b) => rank(a) - rank(b) || a.length - b.length);
    for (const p of files) for (const line of stripCode(F[p].text).split(/\r?\n/)) { if (/\?[^:]*:/.test(line) || /hasProperty|findProperty/.test(line)) continue; const m = line.match(re); if (m) return +m[1]; }
    return null;
  }
  const REJECT_FILE_RE = /(^|\/)[^/]*(reject|rejection|app-?review|review-?notes?|resolution-?center|policy-?violation)[^/]*\.(md|txt)$|(^|\/)(app-?review|review-?notes?|rejections?)\/[^/]+\.(md|txt)$/i;
  const LISTING_LANG = l => { const x = String(l).toLowerCase(); return x.startsWith('en') ? 'en' : x.startsWith('ko') ? 'ko' : x.startsWith('th') ? 'th' : x.startsWith('zh') ? 'zh' : x.startsWith('hi') ? 'hi' : null; };
  /* 0.1.5: evidence that the app already has a store listing (store URLs, fastlane metadata, version history) and existing listing copy. */
  function listingOf(F, A) {
    const P = Object.keys(F), texts = P.filter(p => F[p].text != null && !F[p].code), all = texts.map(p => F[p].text).join('\n').slice(0, 800000);
    const L = { play: { evidence: [], copy: {} }, apple: { evidence: [], copy: {} }, privacyUrl: null, supportUrl: null }, other = { play: new Set(), apple: new Set() };
    const pm = all.match(/play\.google\.com\/store\/apps\/details\?id=([\w.]+)/i);
    if (pm) { L.play.evidence.push('play-url'); L.play.url = 'https://play.google.com/store/apps/details?id=' + pm[1]; }
    const am = all.match(/(?:apps|itunes)\.apple\.com\/[^\s"'<>)]*?\/?id(\d{6,12})/i);
    if (am) { L.apple.evidence.push('apple-url'); L.apple.appId = am[1]; L.apple.url = 'https://apps.apple.com/app/id' + am[1]; }
    const rd = (p) => (F[p] && F[p].text || '').trim();
    for (const p of texts) {
      let m = p.match(/(?:^|\/)fastlane\/metadata\/android\/([^/]+)\/(title|short_description|full_description)\.txt$/i);
      if (m) { const l = LISTING_LANG(m[1]); if (l && rd(p)) { (L.play.copy[l] = L.play.copy[l] || {})[{ title: 'title', short_description: 'short', full_description: 'full' }[m[2].toLowerCase()]] = rd(p); } else if (!l && rd(p)) other.play.add(m[1].toLowerCase().split(/[-_]/)[0]); continue; }
      m = p.match(/(?:^|\/)fastlane\/metadata\/(?!android\/)([^/]+)\/(name|subtitle|description|keywords|privacy_url|support_url)\.txt$/i);
      if (m) {
        const k = m[2].toLowerCase(), v = rd(p);
        if (k === 'privacy_url' && /^https?:\/\//.test(v)) { L.privacyUrl = L.privacyUrl || v; continue; }
        if (k === 'support_url' && /^https?:\/\//.test(v)) { L.supportUrl = L.supportUrl || v; continue; }
        const l = LISTING_LANG(m[1]); if (l && v) (L.apple.copy[l] = L.apple.copy[l] || {})[k] = v; else if (!l && v && m[1].toLowerCase() !== 'default') other.apple.add(m[1].toLowerCase().split(/[-_]/)[0]);
      }
      /* 0.2.5: a saved store rejection message (App Review / Resolution Center, Play Console policy e-mail) */
      if (REJECT_FILE_RE.test(p) && !OLD_RE.test(p)) {
        const t = rd(p).slice(0, 20000);
        if (/\b(rejected|rejection|not approved|was removed|suspended)\b|반려|거절|리젝|ปฏิเสธ|被拒|拒绝|驳回|अस्वीकार/i.test(t)) {
          if (/App Store|App Review|Resolution Center|Guideline\s+\d|ITMS-\d|App Store Connect|TestFlight/i.test(t)) L.apple.rejectNote = L.apple.rejectNote || p;
          if (/Google Play|Play Console|Play policy|Developer Program Polic|Data safety|policy declaration/i.test(t)) L.play.rejectNote = L.play.rejectNote || p;
        }
      }
    }
    /* 0.2.5: listings in languages outside the five UI languages (Arabic, Hebrew, Persian, Japanese, …) are listings too */
    L.play.otherLangs = [...other.play]; L.apple.otherLangs = [...other.apple];
    if (Object.keys(L.play.copy).length || L.play.otherLangs.length) L.play.evidence.push('fastlane-play');
    if (Object.keys(L.apple.copy).length || L.apple.otherLangs.length) L.apple.evidence.push('fastlane-apple');
    if (P.some(p => /(^|\/)fastlane\/(Deliverfile|metadata\/review_information)/i.test(p))) L.apple.evidence.push('fastlane-deliver');
    if (P.some(p => /(^|\/)fastlane\/metadata\/android\/[^/]+\/changelogs\//i.test(p))) L.play.evidence.push('play-changelogs');
    const vc = A.android && +A.android.versionCode; if (vc >= 2) L.play.weak = 'versionCode ' + vc;
    const bn = A.ios && +(A.ios.build || (A.ios.plist && A.ios.plist.CFBundleVersion)); if (bn >= 2) L.apple.weak = 'build ' + bn;
    /* an App Store Connect app record mentioned in the docs ("App Store app 1234567890", "Apple ID: 1234567890") = the app exists there */
    const aid = !L.apple.appId && all.match(/(?:App Store(?: Connect)?(?: app)?(?: record)?|Apple ID|ASC app)\s*(?:id|ID|#|:)?\s*:?\s*(\d{9,10})\b/);
    if (aid) L.apple.weak = 'App Store Connect app ' + aid[1] + (L.apple.weak ? ', ' + L.apple.weak : '');
    privacyCandidates(F, A, L);
    if (A.projectConfig && /^https?:\/\//.test(A.projectConfig.support_url || '')) L.supportUrl = A.projectConfig.support_url;
    L.play.langs = Object.keys(L.play.copy); L.apple.langs = Object.keys(L.apple.copy);
    return L;
  }
  /* 0.2.6: store-listing copy the developer already prepared: play/ or store/ text files (title.txt, short-description-ko.txt,
     full_description.txt …), fastlane/metadata/android/<locale>/, and listing drafts in Markdown (listing-ko.md, STORE.md) with
     headings ("## 앱 이름", "## Short description") or "Title: …" lines. Also the default language and category they name. */
  const SCRIPT_LANG = t => { const s = String(t || ''); return /[\uAC00-\uD7A3]/.test(s) ? 'ko' : /[\u0E00-\u0E7F]/.test(s) ? 'th' : /[\u0900-\u097F]/.test(s) ? 'hi' : /[\u3040-\u30FF]/.test(s) ? 'ja' : /[\u4E00-\u9FFF]/.test(s) ? 'zh' : /[A-Za-z]/.test(s) ? 'en' : null; };
  const LANG_NAME = [[/\b(ko|ko[-_]kr)\b|korean|한국어|韩语|เกาหลี/i, 'ko'], [/\b(th|th[-_]th)\b|thai|태국어|ภาษาไทย|泰语/i, 'th'], [/\b(zh|zh[-_](cn|tw|hans|hant))\b|chinese|중국어|中文|简体/i, 'zh'], [/\b(hi|hi[-_]in)\b|hindi|힌디어|हिन्दी|हिंदी/i, 'hi'], [/\b(en|en[-_](us|gb))\b|english|영어|อังกฤษ|英语/i, 'en']];
  const langFromText = v => { for (const [re, l] of LANG_NAME) if (re.test(String(v || ''))) return l; return null; };
  const LISTING_DIR = /(^|\/)(play|store|listing|listings|store[-_]?listing|google[-_]?play|playstore|play[-_]?store|metadata|marketing|aso)\//i;
  const LISTING_MD = /(^|\/)([^/]*listing[^/]*|store|store[-_]?(listing|info|facts)|play[-_]?(store|listing|console)|google[-_]?play)\.md$/i;
  const KIND_RE = { title: /(^|[\/_.-])(title|app[-_]?name|app[-_]?title)([-_.][a-z]{2}([-_][a-z]{2,4})?)?\.txt$/i, short: /(^|[\/_.-])(short[-_ ]?desc(ription)?|short)([-_.][a-z]{2}([-_][a-z]{2,4})?)?\.txt$/i,
    full: /(^|[\/_.-])(full[-_ ]?desc(ription)?|long[-_ ]?desc(ription)?|description)([-_.][a-z]{2}([-_][a-z]{2,4})?)?\.txt$/i };
  const HEAD_KIND = [[/^(앱 ?이름|앱 ?제목|app ?name|app ?title|title|name|ชื่อแอป|应用名称|ऐप का नाम)(?![\w])/i, 'title'], [/^(간단한 ?설명|짧은 ?설명|short ?description|คำอธิบายแบบย่อ|简短说明|简短描述|संक्षिप्त विवरण)/i, 'short'], [/^(자세한 ?설명|상세 ?설명|full ?description|long ?description|description|คำอธิบายแบบเต็ม|完整说明|详细描述|पूरा विवरण)/i, 'full']];
  const clean = v => String(v || '').replace(/\*\*|__|`/g, '').replace(/^\s*[-*]\s+/, '').trim();
  const refersToFile = v => /\.(txt|md|py|json)\b/i.test(v) && String(v).length < 240 || /^(see|보세요|참고)\b/i.test(String(v).trim());
  function featuresOf(full) {
    const out = [];
    for (const l of String(full || '').split(/\r?\n/)) {
      const m = l.match(/^\s*(?:[■□▶▷◆◇●○•✔✓★☆※▪◼️-]|\d+[.)]|#{2,4})\s*(.+)$/u); if (!m) continue;
      let f = m[1].trim(); if (/^(이용 안내|권한|permissions?|contact|문의)/i.test(f)) continue;
      const c = f.search(/[:：]/); if (c > 1 && c < 40) f = f.slice(0, c); f = f.replace(/[.。]$/, '').trim();
      if (f.length >= 2 && f.length <= 80 && !out.includes(f)) out.push(f);
    }
    return out.slice(0, 8);
  }
  function preparedListing(F, cfg) {
    const R = { copy: {}, files: [], langs: [], defaultLang: null, category: null, categoryFile: null, features: {} };
    const put = (l, k, v, file) => { v = String(v || '').replace(/\r\n/g, '\n').trim(); if (!l || !v || l === 'ja') return; const c = R.copy[l] = R.copy[l] || {}; if (c[k]) return; if (k === 'title' && v.length > 50) return; if (k === 'short' && v.length > 120) return; if (k === 'full' && v.length < 40) return; c[k] = v; (c.files = c.files || {})[k] = file; if (!R.files.includes(file)) R.files.push(file); };
    const fileLang = p => { const m = p.match(/[-_.]([a-z]{2})(?:[-_]([A-Za-z]{2,4}))?\.(txt|md)$/i) || p.match(/(?:^|\/)([a-z]{2})(?:[-_][A-Za-z]{2,4})?\/[^/]+$/i); const l = m && m[1].toLowerCase(); return l && /^(ko|en|th|zh|hi|ja)$/.test(l) ? l : null; };
    const P = Object.keys(F).filter(p => F[p].text != null && !F[p].code && !OLD_RE.test(p));
    /* 1. plain text files, one field each */
    for (const p of P) {
      if (!/\.txt$/i.test(p)) continue;
      const fl = p.match(/(?:^|\/)fastlane\/metadata\/android\/([^/]+)\/(title|short_description|full_description)\.txt$/i);
      if (fl) { const l = LISTING_LANG(fl[1]); if (l) put(l, { title: 'title', short_description: 'short', full_description: 'full' }[fl[2].toLowerCase()], F[p].text, p); continue; }
      if (/(^|\/)fastlane\//i.test(p) || REJECT_FILE_RE.test(p)) continue;
      if (!LISTING_DIR.test(p) && !/desc(ription)?[^/]*\.txt$/i.test(p)) continue;
      const kind = ['short', 'full', 'title'].find(k => KIND_RE[k].test(p)); if (!kind) continue;
      put(fileLang(p) || SCRIPT_LANG(F[p].text), kind, F[p].text, p);
    }
    /* 2. Markdown listing drafts: headed sections, then "Key: value" lines */
    const mds = P.filter(p => LISTING_MD.test(p) || (LISTING_DIR.test(p) && /(listing|store|description)[^/]*\.md$/i.test(p))).sort((a, b) => /listing/i.test(b) - /listing/i.test(a) || a.length - b.length);
    for (const p of mds) {
      const t = F[p].text.replace(/\r\n/g, '\n'), fl = fileLang(p);
      const parts = t.split(/^#{1,4}\s+/m).slice(1);
      for (const part of parts) {
        const nl = part.indexOf('\n'), head = (nl < 0 ? part : part.slice(0, nl)).replace(/\(.*?\)/g, '').trim(), body = nl < 0 ? '' : part.slice(nl + 1);
        const hk = HEAD_KIND.find(([re]) => re.test(head)); if (!hk) continue;
        const fence = body.match(/```[^\n]*\n([\s\S]*?)```/);
        let v = fence ? fence[1] : body.split(/\n\s*\n/).map(x => x.trim()).find(Boolean) || '';
        v = hk[1] === 'full' ? v.trim() : clean(v.split('\n').map(clean).filter(Boolean).join(' '));
        if (!v || refersToFile(v)) continue;
        put(fl || SCRIPT_LANG(v), hk[1], v, p);
      }
      for (const line of t.split('\n')) {
        const kv = line.match(/^\s*[-*]?\s*\**\s*(title|app ?name|app ?title|display ?title|앱 ?이름|앱 ?제목|short ?description|간단한 ?설명)\s*\**\s*(?:\([^)]*\))?\s*[:：]\s*(.+)$/i);
        if (kv) { const v = clean(kv[2]); if (v && !refersToFile(v)) put(SCRIPT_LANG(v.replace(/\([^)]*\)/g, '')) || fl, /short|간단/i.test(kv[1]) ? 'short' : 'title', v, p); }
        const dl = !R.defaultLang && line.match(/(default (store )?language|primary language|기본 ?언어)\s*\**\s*[:：]?\s*\**\s*([^\n·|]+)/i);
        if (dl) R.defaultLang = langFromText(dl[3]);
        const ct = !R.category && line.match(/(?:^|[\s/])(?:app )?(category|카테고리)\s*\**\s*[:：]\s*(.+)$/i);
        if (ct) { const k = catKey(clean(ct[2]).replace(/\*\*/g, '')); if (k) { R.category = k; R.categoryFile = p; } }
      }
    }
    R.langs = Object.keys(R.copy).filter(l => R.copy[l].title || R.copy[l].short || R.copy[l].full);
    for (const l of R.langs) { const f = featuresOf(R.copy[l].full); if (f.length) R.features[l] = f; }
    const cfgLang = cfg && (cfg.default_language || cfg.listing_default_language);
    if (cfgLang) R.defaultLang = langFromText(cfgLang) || R.defaultLang;
    if (!R.defaultLang && R.langs.length === 1) R.defaultLang = R.langs[0];
    if (!R.defaultLang && R.langs.length) R.defaultLang = R.langs.slice().sort((a, b) => Object.keys(R.copy[b]).length - Object.keys(R.copy[a]).length)[0];
    if (cfg && Array.isArray(cfg.listing_languages)) { const ls = cfg.listing_languages.map(langFromText).filter(Boolean); if (ls.length) R.listingLangs = [...new Set(ls)]; }
    return R.langs.length || R.defaultLang || R.category || R.listingLangs ? R : null;
  }
  /* 0.2.6: the account-deletion path and web page the developer already wrote down (rocketlauncher.json, README, listing drafts),
     so guidance and review notes use them instead of a generic "Settings > Delete account" and a placeholder URL. */
  const DEL_WORD = /(삭제|탈퇴|delete|deletion|ลบ|删除|注销|हटा)/i;
  const DEL_URL_RE = /https?:\/\/[^\s"'<>)\]`*]+/g;
  function deletionInfoOf(F, A) {
    const cfg = A.projectConfig || {}, out = { url: null, urlSource: null, inAppPath: null, pathSource: null };
    const cu = cfg.account_deletion_url || cfg.deletion_url || cfg.delete_account_url, cp = cfg.account_deletion_path || cfg.deletion_path || cfg.in_app_deletion_path;
    if (/^https?:\/\//.test(cu || '')) { out.url = String(cu); out.urlSource = cfg._file || 'rocketlauncher.json'; }
    if (cp) { out.inAppPath = String(cp).slice(0, 120); out.pathSource = cfg._file || 'rocketlauncher.json'; }
    const P = Object.keys(F).filter(p => F[p].text != null && !F[p].code && !OLD_RE.test(p) && /\.(md|txt)$|(^|\/)README[^/]*$/i.test(p));
    const rank = p => /(^|\/)README[^/]*$/i.test(p) ? (p.includes('/') ? 2 : 0) : LISTING_MD.test(p) || LISTING_DIR.test(p) ? 1 : 3;
    P.sort((a, b) => rank(a) - rank(b) || a.length - b.length);
    for (const p of P) {
      for (const line of F[p].text.split(/\r?\n/)) {
        if (!out.url) for (const m of line.matchAll(DEL_URL_RE)) { const u = m[0].replace(/[.,;:]+$/, ''); if (/delet|withdraw|탈퇴|remove-?account|account-?removal/i.test(u) && !/<your-site>|example\.|localhost|play\.google\.com|support\.google\.com|developer\.apple\.com/i.test(u)) { out.url = u; out.urlSource = p; break; } }
        if (!out.inAppPath && DEL_WORD.test(line)) {
          const m = line.replace(/`/g, '').match(/((?:[^\s>→›»＞:：(（*][^>→›»＞\n:：(（*]{0,40}?\s*(?:->|>|→|›|»|＞)\s*)+[^>→›»＞\n:：(（*.,;]{1,40})/);
          if (m) { const segs = m[1].split(/\s*(?:->|>|→|›|»|＞)\s*/).map(x => x.trim()).filter(Boolean); if (segs.length >= 2 && DEL_WORD.test(segs[segs.length - 1]) && segs.every(x => x.length <= 40)) { segs[0] = segs[0].replace(/^(앱 ?안에서(는)?|in the app,?|in-app:?)\s*/i, ''); out.inAppPath = segs.join(' > '); out.pathSource = p; } }
        }
      }
      if (out.url && out.inAppPath) break;
    }
    return out.url || out.inAppPath ? out : null;
  }
  /* 0.2.6: every privacy page in the project, including copies bundled inside the app (assets / www / public), with the package ids and
     operator it names. A page that names another package or another operator than the current one is stale. */
  const BUNDLED_PAGE = /(^|\/)(src\/main\/assets|www|public|App\/App\/public|assets\/public)\//i;
  const PKG_IN_TEXT = /\b((?:com|kr|net|org|io|app|co|dev|me|jp|th|cn|in)\.[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+)\b/gi;
  const LIB_PKG = /^(com\.(google|android|apple|facebook|squareup|github)|org\.(w3|apache|jetbrains)|io\.(flutter|reactivex))\./i;
  function operatorOf(html) {
    const t = String(html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
    let m = t.match(/(?:operated|run|provided|published|developed|maintained) by\s+([^.,;<\n]{2,60}?)(?:\s*[.,;(]|\s+(?:in|from|and)\s)/i) || t.match(/\b(?:operator|developer|controller)\s*[:：]\s*([^.,;<\n]{2,60})/i) || t.match(/운영자\s*[:：]\s*([^.,;<\n]{2,60})/);
    if (m) return m[1].trim();
    const i = t.search(/(?:이|가)\s*운영(합니다|하는|함)/); if (i < 0) return null;
    let pre = t.slice(Math.max(0, i - 80), i); pre = pre.split(/[”"」』:：.。!\n]/).pop().replace(/^\s*[은는이가]\s+/, '').trim().replace(/^\S+[은는]\s+(?=\S)/, '');
    return pre.length >= 2 ? pre : null;
  }
  const normOp = v => String(v || '').toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  function privacyPagesOf(F, A) {
    const pages = Object.keys(F).filter(p => F[p].text != null && /(^|\/)[^/]*privacy[^/]*\.(html?|md)$/i.test(p)).map(p => {
      const t = F[p].text, pkgs = [...new Set([...t.matchAll(PKG_IN_TEXT)].map(m => m[1]).filter(x => !LIB_PKG.test(x) && !/\.(html?|css|js|png|svg|json|md|com|kr|net|org|io)$/i.test(x)))];
      return { path: p, bundled: BUNDLED_PAGE.test(p), old: OLD_RE.test(p), pkgs, operator: operatorOf(t) };
    });
    if (!pages.length) return [];
    const ids = [A.android && A.android.pkg, A.ios && A.ios.bundleId].filter(Boolean);
    const current = pages.filter(x => ids.some(id => x.pkgs.includes(id)));
    const curOps = new Set(current.map(x => normOp(x.operator)).filter(Boolean));
    for (const x of pages) {
      x.stale = [];
      if (ids.length && x.pkgs.length && !ids.some(id => x.pkgs.includes(id))) x.stale.push('names ' + x.pkgs.slice(0, 3).join(', ') + ' instead of ' + ids.join(' / '));
      if (x.operator && curOps.size && !curOps.has(normOp(x.operator))) x.stale.push('operator "' + x.operator + '" differs from "' + current.find(c => c.operator).operator + '"');
    }
    return pages;
  }
  /* 0.2.3: iOS = the 1024 App Store icon of AppIcon.appiconset (from Contents.json, else by file name); Android = Play / xxxhdpi launcher icon. */
  function iconsByPlatform(F, imgs) {
    const pick = p => p ? { path: p, dataUrl: F[p].dataUrl } : null;
    const sets = imgs.filter(p => /AppIcon[^/]*\.appiconset\/[^/]+\.png$/i.test(p) && !/(^|\/)(Pods|build|DerivedData)\//.test(p));
    let ios = null;
    for (const c of find(F, /AppIcon[^/]*\.appiconset\/Contents\.json$/)) {
      let j = null; try { j = JSON.parse(F[c].text); } catch (e) { }
      const dir = c.replace(/Contents\.json$/, '');
      const im = ((j && j.images) || []).filter(x => x.filename && (x.size === '1024x1024' || x.idiom === 'ios-marketing') && !x.appearances).map(x => dir + x.filename).find(p => F[p] && F[p].dataUrl);
      if (im) { ios = im; break; }
    }
    ios = ios || sets.find(p => /1024|512@2x|marketing/i.test(p)) || sets.slice().sort((a, b) => b.length - a.length)[0] || null;
    const and = imgs.find(p => /ic_launcher-playstore\.png$|(^|\/)playstore[^/]*\.png$/i.test(p)) || imgs.find(p => /mipmap-xxxhdpi\/ic_launcher\.(png|webp)$/i.test(p)) || imgs.find(p => /mipmap-[^/]+\/ic_launcher\.(png|webp)$/i.test(p)) || null;
    return { ios: pick(ios), android: pick(and) };
  }
  /* 0.2.3: privacy policy URL candidates, best source first:
     0 project config (rocketlauncher.json) · 1 store metadata (fastlane privacy_url) · 2 app config (app.json, Info.plist, strings, capacitor
     config, config scripts) · 3 the current README · 4 any other page (weak: only a hint). Archived / old / backup / build folders are skipped.
     Candidates that disagree are all reported with a warning; a URL seen only in a loose page is never adopted silently. */
  const OLD_RE = /(^|\/)(archive|archived|archives|old|backup|backups|bak|dist|build|out|legacy|deprecated|previous|prev|site-old|old-site|_old|[^/]*[-_.](old|bak|backup|orig|copy))\/|\.(bak|orig|old)$|(^|\/)[^/]*[-_.](old|backup)\.[a-z]+$/i;
  const PRIV_URL_RE = /https?:\/\/[^\s"'<>)\]\\`*]*(privacy|개인정보|policy)[^\s"'<>)\]\\`*]*/gi;
  const THIRD_PARTY = /(apple|google|firebase|android|admob|policies\.google|facebook|github|w3|schema|cloudflare|opinet|kakao|naver|microsoft)\.(com|org|io|co\.kr)|developer\.|example\.|<your-site>|localhost|127\.0\.0\.1/i;
  /* 0.2.4: pages a developer hosts on a shared domain are the developer's own (GitHub Pages, Google Sites, Notion, Firebase Hosting) */
  const OWN_HOST = /^https?:\/\/([\w-]+\.github\.io\/|sites\.google\.com\/(view|site)\/|[\w-]+\.notion\.site\/|[\w-]+\.web\.app\/|[\w-]+\.firebaseapp\.com\/|[\w-]+\.pages\.dev\/|[\w-]+\.netlify\.app\/|[\w-]+\.vercel\.app\/)/i;
  const normUrl = u => String(u).replace(/[.,;:]+$/, '').replace(/#.*$/, '').replace(/\/+$/, '').replace(/^(https:\/\/[^/]+)/, m => m.toLowerCase());
  function privacyCandidates(F, A, L) {
    const C = [], push = (url, file, priority, source) => { if (!url || !/^https?:\/\//i.test(url) || (priority > 0 && THIRD_PARTY.test(url) && !OWN_HOST.test(url))) return; const u = normUrl(url); if (!C.some(c => c.url === u && c.file === file)) C.push({ url: u, file, priority, source }); };
    const cfg = A.projectConfig;
    if (cfg && cfg.privacy_url) push(String(cfg.privacy_url), cfg._file || 'rocketlauncher.json', 0, 'project config');
    const P = Object.keys(F).filter(p => F[p].text != null && !OLD_RE.test(p));
    for (const p of P) if (/fastlane\/metadata\/[^/]+\/privacy_url\.txt$/i.test(p)) push(F[p].text.trim(), p, 1, 'store metadata');
    const urlsIn = t => (String(t).match(PRIV_URL_RE) || []).filter(u => /privacy|개인정보/i.test(u));
    const appCfg = P.filter(p => /(^|\/)(app\.json|app\.config\.[jt]s|capacitor\.config\.(json|ts|js)|Info\.plist|strings\.xml|[^/]*\.arb)$/i.test(p) || (F[p].code && /(^|\/)[^/]*(config|constants?|settings|env|links?)[^/]*\.[cm]?[jt]sx?$|\.(dart|kt|swift)$/i.test(p) && !BUNDLED_RE.test(p)));
    for (const p of appCfg) urlsIn(F[p].text).forEach(u => push(u, p, 2, 'app config'));
    const rd = shortest(P.filter(p => /(^|\/)README(\.md)?$/i.test(p)));
    if (rd) urlsIn(F[rd].text).forEach(u => push(u, rd, 3, 'README'));
    for (const p of P) if (!F[p].code && p !== rd && !appCfg.includes(p) && !/privacy_url\.txt$/i.test(p) && p !== (cfg && cfg._file)) urlsIn(F[p].text).forEach(u => push(u, p, 4, 'other file'));
    C.sort((a, b) => a.priority - b.priority);
    L.privacyCandidates = C.slice(0, 8);
    const strong = C.filter(c => c.priority <= 3), urls = [...new Set(C.map(c => c.url))];
    L.privacyUrl = strong.length ? strong[0].url : null;
    L.privacySource = strong.length ? strong[0].source + ' (' + strong[0].file + ')' : null;
    /* disagreement: any other URL, except loose pages contradicting an explicit project config */
    const others = L.privacyUrl ? C.filter(c => c.url !== L.privacyUrl) : [];
    L.privacyConflict = others.length > 0 && !(strong[0].priority === 0 && others.every(c => c.priority === 4));
    L.privacyWeak = !L.privacyUrl && C.length > 0;
  }
  /* 0.2.4: Cordova config.xml — id / version / android-versionCode / ios-CFBundleVersion attributes, SDK preferences, <platform> entries
     (the platforms/ folder is usually not committed), plus package.json "cordova.platforms". */
  function cordovaOf(x, pkg) {
    const d = parseXml(x), w = d && d.querySelector('widget'); if (!w) return null;
    const pref = n => { const e = [...d.querySelectorAll('preference')].find(e => (e.getAttribute('name') || '').toLowerCase() === n.toLowerCase()); return e ? e.getAttribute('value') : null; };
    const plats = new Set([...d.querySelectorAll('platform')].map(e => e.getAttribute('name')).concat((pkg && pkg.cordova && pkg.cordova.platforms) || []));
    const num = v => (v && /^\d+$/.test(v) ? +v : null);
    return { id: w.getAttribute('id'), androidId: w.getAttribute('android-packageName') || w.getAttribute('id'), iosId: w.getAttribute('ios-CFBundleIdentifier') || w.getAttribute('id'),
      version: w.getAttribute('version'), versionCode: w.getAttribute('android-versionCode'), iosBuild: w.getAttribute('ios-CFBundleVersion'),
      targetSdk: num(pref('android-targetSdkVersion')), minSdk: num(pref('android-minSdkVersion')), iosDeployment: pref('deployment-target'),
      android: plats.has('android'), ios: plats.has('ios'), name: (d.querySelector('widget > name') || {}).textContent || null };
  }
  /* 0.2.4: SDK levels set through the expo-build-properties plugin in app.json */
  function expoBuildProps(expo) {
    const pl = (expo.plugins || []).find(x => Array.isArray(x) && x[0] === 'expo-build-properties'), a = (pl && pl[1] && pl[1].android) || {};
    const n = v => (v != null && /^\d+$/.test(String(v)) ? +v : null);
    return { minSdk: n(a.minSdkVersion), targetSdk: n(a.targetSdkVersion), compileSdk: n(a.compileSdkVersion) };
  }
  function gradleDeps(g) {
    g = stripCode(g);
    /* 0.2.5: flavor / build-type configurations count too (freeImplementation, "paidImplementation"(...), releaseApi); debug / test ones do not ship */
    const out = [], ship = c => !/^(debug|test|androidTest|testFixtures|testDebug|testRelease)/i.test(c || '');
    const re = /\b(\w*?)(implementation|Implementation|api|Api|kapt|ksp)["']?\s*\(?\s*(?:platform\()?\s*["']([^"']+)["']/g; let m;
    while ((m = re.exec(g))) if (ship(m[1])) out.push(m[3]);
    const re2 = /\b(\w*?)(implementation|Implementation|api|Api)["']?\s*\(\s*(?:platform\()?\s*libs\.([\w.]+)/g; while ((m = re2.exec(g))) if (ship(m[1])) out.push('libs.' + m[3]);
    return out;
  }
  /* 0.2.5: the defaultConfig { } block of a module (product flavors listed before it may set their own applicationId) */
  function blockOf(g, name) {
    const i = g.search(new RegExp('\\b' + name + '\\s*\\{')); if (i < 0) return null;
    let j = g.indexOf('{', i), depth = 0;
    for (let k = j; k < g.length; k++) { if (g[k] === '{') depth++; else if (g[k] === '}' && --depth === 0) return g.slice(j + 1, k); }
    return g.slice(j + 1);
  }
  /* 0.2.5: game engines and other cross-platform toolkits keep ids and versions in their own project files */
  function unityOf(t) {
    const v = k => (t.match(new RegExp('^\\s*' + k + ':\\s*(.+?)\\s*$', 'm')) || [])[1] || null;
    const sub = (k, plat) => { const m = t.match(new RegExp('^(\\s*)' + k + ':\\s*\\n((?:\\1\\s+[^\\n]*\\n?)*)', 'm')); return m ? ((m[2].match(new RegExp('^\\s*' + plat + ':\\s*(.+?)\\s*$', 'm')) || [])[1] || null) : null; };
    const andId = sub('applicationIdentifier', 'Android'), iosId = sub('applicationIdentifier', 'iPhone') || sub('applicationIdentifier', 'iOS');
    const tgt = v('AndroidTargetSdkVersion');
    return { kind: 'unity', name: v('productName'), android: andId ? { pkg: andId, versionName: v('bundleVersion'), versionCode: v('AndroidBundleVersionCode'), minSdk: +v('AndroidMinSdkVersion') || null,
      targetSdk: tgt && +tgt > 0 ? +tgt : null, targetSdkRaw: tgt && +tgt > 0 ? null : 'AndroidTargetSdkVersion: ' + (tgt || '—') + ' (Unity: highest installed SDK)' } : null,
      ios: iosId ? { bundleId: iosId, version: v('bundleVersion'), build: sub('buildNumber', 'iPhone') || sub('buildNumber', 'iOS'), deployment: v('iOSTargetOSVersionString') } : null };
  }
  function godotOf(t, proj) {
    const out = { kind: 'godot', name: ((proj || '').match(/^config\/name\s*=\s*"([^"]*)"/m) || [])[1] || null, android: null, ios: null };
    const presets = String(t).split(/^\[preset\.\d+\]\s*$/m).slice(1);
    for (const b of presets) {
      const g = k => { const m = b.match(new RegExp('^' + k.replace(/[/.]/g, '\\$&') + '\\s*=\\s*"?([^"\\n]*)"?\\s*$', 'm')); return m ? m[1].trim() : null; };
      const plat = g('platform'), n = x => (x && /^\d+$/.test(x) ? +x : null);
      if (/^Android$/i.test(plat || '')) { const ts = g('gradle_build/target_sdk') || g('target_sdk'); out.android = { pkg: g('package/unique_name'), versionName: g('version/name'), versionCode: g('version/code'), minSdk: n(g('gradle_build/min_sdk')), targetSdk: n(ts), targetSdkRaw: n(ts) ? null : 'gradle_build/target_sdk ' + (ts ? '"' + ts + '"' : 'empty') + ' (Godot default)' }; }
      if (/^iOS$/i.test(plat || '')) out.ios = { bundleId: g('application/bundle_identifier'), version: g('application/short_version'), build: g('application/version'), deployment: g('application/min_ios_version') };
    }
    return out;
  }
  function mauiOf(t) {
    const v = k => (t.match(new RegExp('<' + k + '(?:\\s[^>]*)?>\\s*([^<]+?)\\s*</' + k + '>')) || [])[1] || null;
    const tf = v('TargetFrameworks') || v('TargetFramework') || '';
    const id = v('ApplicationId');
    return { kind: 'maui', name: v('ApplicationTitle'), android: /-android/.test(tf) ? { pkg: id, versionName: v('ApplicationDisplayVersion'), versionCode: v('ApplicationVersion') } : null,
      ios: /-(ios|maccatalyst)/.test(tf) ? { bundleId: id, version: v('ApplicationDisplayVersion'), build: v('ApplicationVersion') } : null };
  }
  function readme(s) {
    if (!s) return { title: '', summary: '', features: [] };
    const lines = s.split(/\r?\n/);
    const title = ((lines.find(l => /^#\s+/.test(l)) || '').replace(/^#\s+/, '')).replace(/[*_`]/g, '').trim();
    let summary = ''; let i = lines.findIndex(l => /^#\s+/.test(l)) + 1;
    for (; i < lines.length; i++) { const l = lines[i].trim(); if (!l) { if (summary) break; continue; } if (/^[#!\[<|-]/.test(l)) { if (summary) break; continue; } summary += (summary ? ' ' : '') + l; }
    const features = []; let inF = false;
    for (const l of lines) {
      if (/^#+\s*(features?|기능|주요 기능|ฟีเจอร์)/i.test(l)) { inF = true; continue; }
      if (inF && /^#+\s/.test(l)) break;
      if (inF && /^\s*[-*]\s+/.test(l)) features.push(l.replace(/^\s*[-*]\s+/, '').replace(/[*_`]/g, '').trim());
    }
    return { title, summary: summary.replace(/[*_`]/g, ''), features: features.slice(0, 8) };
  }
  const has = (hay, re) => re.test(hay);
  /* Bundled, generated or minified scripts never count as evidence on their own. */
  const BUNDLED_RE = /(^|\/)(node_modules|vendor|vendors|third_party|dist|build|generated|bundle|bundles|\.next|\.expo|Pods)\/|\.(min|bundle|chunk)\.[cm]?js$|(^|\/)(cordova|cordova_plugins|native-bridge|polyfills?)\.js$/i;
  const stripHashComments = s => String(s || '').replace(/(^|\s)#[^\n]*/g, '$1');
  /* pubspec.yaml: only the dependencies / dev_dependencies blocks, without comments */
  function pubspecDeps(y) {
    const out = []; let on = false;
    for (const l of stripHashComments(y).split(/\r?\n/)) { if (/^\S/.test(l)) on = /^(dependencies|dev_dependencies|dependency_overrides)\s*:/.test(l); else if (on) out.push(l); }
    return out.join('\n');
  }

  /* Category keywords in en / ko / th / zh / hi (+ a few common others). English stems use word boundaries so "store" in
     "App Store" or "map" inside another word does not count. 0.2.3: navigation (maps, routes, fuel / gas stations, parking, EV charging). */
  const CATS = {
    navigation: /\b(navigation|navigate|navi|maps?|directions?|routes?|routing|gps|nearby|near me|gas stations?|petrol|fuel|gasoline|diesel|lpg|filling stations?|service stations?|ev charg\w*|charging stations?|parking|traffic|commute)\b|주유소|주유|유가|기름값|휘발유|경유|충전소|주차|지도|길찾기|길 안내|내비|네비|교통|น้ำมัน|ปั๊ม|แผนที่|นำทาง|เส้นทาง|ที่จอดรถ|สถานีชาร์จ|加油站|油价|汽油|柴油|充电站|停车|地图|导航|導航|路线|पेट्रोल|डीज़ल|ईंधन|नक्शा|मैप|नेविगेशन|रास्ता|ガソリン|地図|ナビ/i,
    finance: /\b(budget\w*|expenses?|ledger|money|receipts?|spending|finance|financial|wallet|invest\w*|stocks?|crypto)\b|가계부|예산|지출|영수증|งบ|รายจ่าย|ใบเสร็จ|记账|预算|बजट|ख़र्च/i,
    health: /\b(health|fitness|workouts?|steps|sleep|hydration|diet|calories?|meditation)\b|건강|운동|수면|สุขภาพ|ออกกำลัง|健康|健身|स्वास्थ्य|फिटनेस/i,
    education: /\b(learn\w*|study|quiz\w*|vocab\w*|lessons?|courses?|flashcards?|exam)\b|공부|학습|단어|เรียน|学习|पढ़ाई|सीख/i,
    productivity: /\b(todo|to-do|tasks?|notes?|calendar|planner|reminders?|memo)\b|할 ?일|메모|일정|โน้ต|待办|笔记|日程|नोट्स|रिमाइंडर/i,
    photography: /\b(photos?|camera|filters?|edit image|selfie)\b|사진|ภาพถ่าย|照片|相机|फ़ोटो/i,
    travel: /\b(travel\w*|trips?|hotels?|flights?|tour\w*|sightseeing|itinerar\w*)\b|여행|숙소|เที่ยว|ท่องเที่ยว|โรงแรม|旅行|酒店|यात्रा|होटल/i,
    food: /\b(recipes?|food|restaurants?|menus?|cafe|coffee|cooking)\b|요리|음식|메뉴|맛집|อาหาร|ร้านอาหาร|美食|菜谱|餐厅|खाना|रेसिपी/i,
    shopping: /\b(shop|shopping|online store|cart|deals?|coupons?|marketplace|buy and sell|e-?commerce|checkout|tickets?)\b|쇼핑|ร้านค้า|ช้อป|购物|शॉपिंग/i,
    tools: /\b(calculator|scanner|scan|scans|scanning|pdf|converter|utility|utilities|qr|flashlight|unit conver\w*|translat\w*|interpret\w*|dictionary|timer|stopwatch|vpn|proxy|launcher|clicker|measur\w*|ruler|compass)\b|계산기|도구|번역|통역|사전|เครื่องคิดเลข|แปลภาษา|แปล|计算器|工具|翻译|翻譯|词典|कैलकुलेटर|अनुवाद/i,
    /* 0.2.4: music and social apps had no category of their own */
    music: /\b(music|songs?|playlists?|albums?|podcasts?|metronome|tuner|karaoke|lyrics|radio|musicians?|guitar|piano)\b|음악|노래|플레이리스트|เพลง|ดนตรี|音乐|歌曲|संगीत|गाना|गाने/i,
    social: /\b(social|friends?|chat|chatting|messag(e|es|ing)|posts?|feeds?|comments?|community|followers?|meet new people)\b|친구|채팅|커뮤니티|게시글|เพื่อน|แชท|ชุมชน|社交|好友|聊天|社区|दोस्त|चैट|सोशल/i,
    games: /\b(game|games|puzzle|arcade|high ?score)\b|게임|เกม|游戏|गेम/i,
    lifestyle: /\b(lifestyle|diary|habits?|daily)\b|일기|습관|ไลฟ์สไตล์|生活|日记|आदत/i,
    /* 0.2.6: business apps (staff / field-work tools, quotations, invoices, work reports; Play "Business", App Store "Business") */
    business: /\b(business|b2b|crm|invoices?|invoicing|quotations?|work orders?|work reports?|field (service|work|staff|team|crew)s?|employees?|staff[- ]only|workforce|timesheets?|time ?clock|inventory|erp|point of sale|sales team|client management|job ?sites?)\b|업무|직원|견적서|견적|인수증|작업 ?보고서|현장 ?관리|거래처|고객사|사내|기업용|비즈니스|ธุรกิจ|พนักงาน|ใบเสนอราคา|ใบแจ้งหนี้|商务|商业|业务|员工|报价单|发票|व्यवसाय|बिज़नेस|कर्मचारी|इनवॉइस/i,
    /* 0.2.5: weather apps (Play "Weather", App Store "Weather") */
    weather: /\b(weather|forecasts?|rain radar|radar|temperature|humidity|uv index|air quality)\b|날씨|일기예보|미세먼지|기온|สภาพอากาศ|พยากรณ์อากาศ|天气|天氣|气温|मौसम/i
  };
  /* When only one category is clear, the second suggestion is a close neighbour (not always Productivity). */
  const CAT_NEXT = { navigation: 'travel', travel: 'navigation', finance: 'productivity', health: 'lifestyle', education: 'productivity', productivity: 'tools', photography: 'tools', food: 'lifestyle', shopping: 'lifestyle', tools: 'productivity', games: 'education', lifestyle: 'productivity', music: 'lifestyle', social: 'lifestyle', weather: 'lifestyle', business: 'productivity' };
  /* 0.2.6: a category written by the developer (rocketlauncher.json "category", a store-listing draft) as Rocket Launcher's key, the
     Play Console / App Store Connect name, or a common local name ("Maps & Navigation", "Business", "비즈니스 (Business)", "지도 및 내비게이션"). */
  const CAT_ALIAS = { mapsnavigation: 'navigation', maps: 'navigation', navigation: 'navigation', business: 'business', finance: 'finance', healthfitness: 'health', health: 'health', medical: 'health',
    education: 'education', productivity: 'productivity', photography: 'photography', photo: 'photography', travellocal: 'travel', travel: 'travel', fooddrink: 'food', food: 'food', shopping: 'shopping',
    tools: 'tools', utilities: 'tools', utility: 'tools', musicaudio: 'music', music: 'music', social: 'social', socialnetworking: 'social', games: 'games', game: 'games', casual: 'games',
    lifestyle: 'lifestyle', weather: 'weather', 비즈니스: 'business', 업무: 'business', 지도및내비게이션: 'navigation', 지도내비게이션: 'navigation', 지도: 'navigation', 내비게이션: 'navigation', 금융: 'finance',
    쇼핑: 'shopping', 도구: 'tools', 생산성: 'productivity', 교육: 'education', 건강및피트니스: 'health', 건강: 'health', 여행및지역정보: 'travel', 여행: 'travel', 식음료: 'food', 음식: 'food', 날씨: 'weather',
    소셜: 'social', 음악및오디오: 'music', 음악: 'music', 사진: 'photography', 게임: 'games', 라이프스타일: 'lifestyle', ธุรกิจ: 'business', 商务: 'business', 商业: 'business', व्यवसाय: 'business' };
  function catKey(v) {
    if (v == null || v === '') return null;
    const raw = String(v).toLowerCase().replace(/_and_|\band\b/g, ' '), k = x => CAT_ALIAS[String(x).replace(/[^\p{L}]/gu, '')] || null;
    return k(raw) || [...raw.matchAll(/\(([^)]+)\)/g)].map(m => k(m[1])).find(Boolean) || raw.replace(/\([^)]*\)/g, ' ').split(/[\/,|·;]| or | 또는 /).map(k).find(Boolean) || null;
  }

  function analyze(project) {
    const F = project.files; const P = Object.keys(F);
    const A = { name: project.name, source: project.source, fileCount: project.fileCount || P.length, read: [], android: null, ios: null, framework: 'unknown', platforms: { android: false, ios: false }, strings: {}, names: {}, sdk: {}, issues: [] };
    const note = p => p && A.read.push(p);

    // ---------- 프레임워크 ----------
    /* 0.2.5: in a monorepo the app's package.json is the one with mobile framework dependencies, not the workspace root */
    const MOBILE_DEP = /^(expo|react-native|@capacitor\/(core|android|ios)|cordova-(android|ios)|@nativescript\/core|@ionic\/(angular|react|vue))$/;
    const pkgOf = p => { try { return JSON.parse(txt(F, p)); } catch (e) { return null; } }, depsOf = j => (j ? Object.keys({ ...(j.dependencies || {}), ...(j.devDependencies || {}) }) : []);
    const pkgJsons = find(F, /(^|\/)package\.json$/).filter(p => !BUNDLED_RE.test(p)).sort((a, b) => a.length - b.length);
    const pkgJson = pkgJsons.find(p => depsOf(pkgOf(p)).some(d => MOBILE_DEP.test(d))) || pkgJsons[0];
    const appRoot = pkgJson ? pkgJson.replace(/package\.json$/, '') : '';
    const pubspec = shortest(find(F, /(^|\/)pubspec\.yaml$/)), appJson = shortest(find(F, /(^|\/)app\.json$/).filter(p => p.startsWith(appRoot))) || shortest(find(F, /(^|\/)app\.json$/)), capCfg = shortest(find(F, /capacitor\.config\.(json|ts|js)$/));
    const pkg = pkgOf(pkgJson);
    const deps = depsOf(pkg);
    if (pubspec) A.framework = 'flutter';
    else if (deps.includes('expo')) A.framework = 'expo';
    else if (deps.includes('react-native')) A.framework = 'react-native';
    else if (capCfg || deps.some(d => d.startsWith('@capacitor/'))) A.framework = 'capacitor';
    /* 0.2.4: Cordova (config.xml <widget>, package.json "cordova"), Bubblewrap TWA (twa-manifest.json) and Kotlin Multiplatform */
    const cdvPath = shortest(find(F, /(^|\/)config\.xml$/).filter(p => !/(^|\/)res\/xml\//.test(p) && /<widget\b/.test(F[p].text)));
    const cdv = cdvPath ? cordovaOf(F[cdvPath].text, pkg) : null;
    const twaPath = shortest(find(F, /(^|\/)twa-manifest\.json$/));
    const kmp = find(F, /\.gradle(\.kts)?$/).some(p => /kotlin\(\s*["']multiplatform["']\s*\)|org\.jetbrains\.kotlin\.multiplatform|libs\.plugins\.kotlin[.-]?[mM]ultiplatform/.test(stripCode(F[p].text)));
    if (A.framework === 'unknown' && (deps.includes('@nativescript/core') || find(F, /(^|\/)nativescript\.config\.[jt]s$/).length)) A.framework = 'nativescript';
    if (A.framework === 'unknown') A.framework = cdv || deps.includes('cordova-android') || deps.includes('cordova-ios') || (pkg && pkg.cordova) ? 'cordova' : twaPath ? 'twa' : kmp ? 'kmp' : 'unknown';
    /* 0.2.5: Unity (ProjectSettings.asset), Godot (export_presets.cfg) and .NET MAUI (*.csproj with UseMaui) */
    const unityPath = shortest(find(F, /(^|\/)ProjectSettings\/ProjectSettings\.asset$/)), godotPath = shortest(find(F, /(^|\/)export_presets\.cfg$/));
    const mauiPath = shortest(find(F, /\.csproj$/).filter(p => /<UseMaui>\s*true\s*<\/UseMaui>/i.test(F[p].text)));
    const nsCfg = shortest(find(F, /(^|\/)nativescript\.config\.[jt]s$/));
    let ext = null;
    if (A.framework === 'unknown' && unityPath) { ext = unityOf(F[unityPath].text); A.framework = 'unity'; }
    else if (A.framework === 'unknown' && godotPath) { ext = godotOf(F[godotPath].text, txt(F, shortest(find(F, /(^|\/)project\.godot$/)))); A.framework = 'godot'; }
    else if (A.framework === 'unknown' && mauiPath) { ext = mauiOf(F[mauiPath].text); A.framework = 'maui'; }
    else if (A.framework === 'nativescript' && nsCfg) { const id = (stripCode(F[nsCfg].text).match(/\bid\s*:\s*['"`]([\w.\-]+)['"`]/) || [])[1]; ext = { kind: 'nativescript', android: null, ios: id ? { bundleId: id } : null, pkg: id || null }; }
    [pubspec, pkgJson, appJson, capCfg, cdvPath, twaPath, unityPath, godotPath, mauiPath, nsCfg].forEach(note);
    /* Flutter keeps the version in pubspec.yaml ("version: 1.3.0+13"); Gradle and Xcode only point at it. */
    const pubVer = pubspec ? (txt(F, pubspec).match(/^version:\s*["']?(\d[\w.\-]*?)(?:\+(\d+))?["']?\s*$/m) || null) : null;
    /* 0.2.3: optional project config written by the developer (rocketlauncher.json or .rocketlauncher.json at the project root):
       { "privacy_url", "support_url", "category", "store_stage": { "play", "apple" }, "app_store_state", "play_state" } */
    const cfgPath = shortest(find(F, /(^|\/)\.?rocketlauncher\.json$/i).filter(p => !OLD_RE.test(p)));
    if (cfgPath) { try { const j = JSON.parse(F[cfgPath].text); if (j && typeof j === 'object') { A.projectConfig = { ...j, _file: cfgPath }; note(cfgPath); } } catch (e) { A.projectConfigError = cfgPath; } }

    // ---------- Android ----------
    const manifests = find(F, /AndroidManifest\.xml$/).filter(p => !/(debug|test|androidTest)\//.test(p));
    const manPath = manifests.find(p => /app\/src\/main\//.test(p)) || shortest(manifests.filter(p => /src\/main\//.test(p))) || shortest(manifests);
    const gradles = find(F, /\.gradle(\.kts)?$/);
    const appGradle = gradles.find(p => /com\.android\.application|id\s*\(?["']com\.android\.application|alias\(\s*libs\.plugins\.android[.-]?[aA]pplication\s*\)/.test(stripCode(F[p].text))) || gradles.find(p => /(^|\/)app\/build\.gradle/.test(p)) || gradles.find(p => /(^|\/)App_Resources\/Android\/app\.gradle$/.test(p));
    let expo = null; try { expo = appJson ? (JSON.parse(txt(F, appJson)).expo || null) : null; } catch (e) { }
    /* 0.2.4: dynamic Expo config (app.config.js / .ts) without app.json: plain string / number literals only, nothing is executed */
    const appCfgJs = shortest(find(F, /(^|\/)app\.config\.[jt]s$/));
    if (appCfgJs && A.framework === 'expo') {
      const t = stripCode(txt(F, appCfgJs)), lit = (re) => (t.match(re) || [])[1], blk = k => (t.match(new RegExp('\\b' + k + '\\s*:\\s*\\{([^{}]*)\\}')) || [])[1] || '';
      const sv = (s, k) => (s.match(new RegExp('\\b' + k + '\\s*:\\s*[\'"`]([^\'"`$]+)[\'"`]')) || [])[1], nv = (s, k) => (s.match(new RegExp('\\b' + k + '\\s*:\\s*(\\d+)\\b')) || [])[1];
      const andB = blk('android'), iosB = blk('ios'), top = t.replace(/\b(android|ios|web|extra|plugins)\s*:\s*\{[^{}]*\}/g, '');
      const dyn = { name: sv(top, 'name'), version: sv(top, 'version'), android: andB ? { package: sv(andB, 'package'), versionCode: nv(andB, 'versionCode') } : undefined, ios: iosB ? { bundleIdentifier: sv(iosB, 'bundleIdentifier'), buildNumber: sv(iosB, 'buildNumber') } : undefined };
      expo = expo ? { ...dyn, ...expo, android: { ...(dyn.android || {}), ...(expo.android || {}) }, ios: { ...(dyn.ios || {}), ...(expo.ios || {}) } } : dyn;
      note(appCfgJs);
    }
    /* 0.2.4: an Expo app builds for iOS and Android unless expo.platforms says otherwise (app.json often has no android / ios block). */
    const expoPlat = expo && (A.framework === 'expo' || expo.android || expo.ios) ? (Array.isArray(expo.platforms) ? expo.platforms : ['ios', 'android']) : [];
    const expoBP = expo ? expoBuildProps(expo) : {};
    if (manPath || appGradle || (expo && (expo.android || expoPlat.includes('android'))) || (cdv && cdv.android) || (ext && ext.android)) {
      A.platforms.android = true; if (A.framework === 'unknown') A.framework = 'android-native';
      const an = { permissions: [], features: [], activities: [], deps: [], cleartext: false, debuggable: false, allowBackup: null, adId: false, adsAppId: null, removedPermissions: [] };
      if (manPath) {
        note(manPath); const d = parseXml(F[manPath].text);
        if (d) {
          an.manifestPackage = d.documentElement.getAttribute('package');
          /* 0.2.6: tools:node="remove" (manifest merger) takes a permission out of the merged manifest, also one added by a library */
          d.querySelectorAll('uses-permission, uses-permission-sdk-23').forEach(n => { const nm = aAttr(n, 'name'), tn = (n.getAttribute('tools:node') || '').toLowerCase(); if (tn === 'remove' || tn === 'removeall') an.removedPermissions.push(nm); else an.permissions.push(nm); });
          d.querySelectorAll('uses-feature').forEach(n => { if (!/^remove/i.test(n.getAttribute('tools:node') || '')) an.features.push(aAttr(n, 'name')); });
          d.querySelectorAll('activity').forEach(n => an.activities.push(aAttr(n, 'name')));
          const app = d.querySelector('application');
          if (app) { an.label = aAttr(app, 'label'); an.cleartext = aAttr(app, 'usesCleartextTraffic') === 'true'; an.debuggable = aAttr(app, 'debuggable') === 'true'; an.allowBackup = aAttr(app, 'allowBackup'); an.iconRef = aAttr(app, 'icon'); }
          d.querySelectorAll('meta-data').forEach(n => { if (/ads\.APPLICATION_ID/.test(aAttr(n, 'name') || '')) an.adsAppId = aAttr(n, 'value'); });
          an.metaData = [...d.querySelectorAll('meta-data')].map(n => aAttr(n, 'name')).filter(Boolean);
          an.categories = [...d.querySelectorAll('category')].map(n => aAttr(n, 'name')).filter(Boolean);
          /* 0.2.5: <uses-sdk> (used only when no Gradle module sets the SDK levels: MAUI, old Ant projects) and declared services */
          const us = d.querySelector('uses-sdk'); if (us) { an.manifestTarget = aAttr(us, 'targetSdkVersion'); an.manifestMin = aAttr(us, 'minSdkVersion'); }
          an.services = [...d.querySelectorAll('service')].map(n => ({ name: aAttr(n, 'name'), permission: aAttr(n, 'permission'), fgsType: aAttr(n, 'foregroundServiceType') }));
        }
      }
      /* 0.2.5: local Android library modules (com.android.library) merge their manifest permissions into the app */
      for (const lg of gradles) {
        if (lg === appGradle || !/com\.android\.library|libs\.plugins\.android[.-]?[lL]ibrary/.test(stripCode(F[lg].text))) continue;
        const lm = lg.replace(/[^/]*$/, '') + 'src/main/AndroidManifest.xml'; if (!F[lm] || lm === manPath) continue;
        const d = parseXml(F[lm].text); if (!d) continue; note(lm);
        d.querySelectorAll('uses-permission, uses-permission-sdk-23').forEach(n => an.permissions.push(aAttr(n, 'name')));
        d.querySelectorAll('service').forEach(n => (an.services = an.services || []).push({ name: aAttr(n, 'name'), permission: aAttr(n, 'permission'), fgsType: aAttr(n, 'foregroundServiceType') }));
      }
      an.services = an.services || [];
      if (appGradle) {
        note(appGradle); const g = stripCode(F[appGradle].text), dc = blockOf(g, 'defaultConfig') || '', gv = k => gradleVal(dc, k) || gradleVal(g, k);
        an.pkg = gv('applicationId'); an.namespace = gradleVal(g, 'namespace');
        an.targetSdkRaw = gv('targetSdk');
        an.minSdk = resolveSdk(gv('minSdk'), F, gradles); an.targetSdk = resolveSdk(an.targetSdkRaw, F, gradles); an.compileSdk = resolveSdk(gradleVal(g, 'compileSdk'), F, gradles);
        an.versionCode = gv('versionCode'); an.versionName = gv('versionName'); an.deps = gradleDeps(g); an.gradlePath = appGradle;
        an.gradleKts = /\.kts$/.test(appGradle);
      }
      const toml = shortest(find(F, /libs\.versions\.toml$/)); if (toml) { note(toml); an.deps.push(...(F[toml].text.match(/module\s*=\s*"([^"]+)"/g) || []).map(s => s.replace(/.*"([^"]+)"/, '$1'))); }
      if (toml) { // libs.versions.targetSdk 같은 버전 카탈로그 값 풀기
        const tv = F[toml].text; const ver = k => { const m = tv.match(new RegExp('^\\s*' + k.replace(/[.\-]/g, '[.\\-_]?') + '\\s*=\\s*"?(\\d+)"?', 'mi')); return m ? +m[1] : null; };
        for (const k of ['minSdk', 'targetSdk', 'compileSdk']) if (!an[k] && appGradle) { const m = F[appGradle].text.match(new RegExp(k + '(?:Version)?\\s*=?\\s*libs\\.versions\\.([\\w.]+?)\\.get')); const v = m ? ver(m[1]) : ver(k) || ver(k.replace('Sdk', '-sdk')) || ver(k.replace('Sdk', '_sdk')); if (v) an[k] = v; }
      }
      if (!appGradle && an.manifestTarget && /^\d+$/.test(an.manifestTarget)) { an.targetSdk = +an.manifestTarget; an.minSdk = an.minSdk || (+an.manifestMin || null); }
      if (ext && ext.android) { const x = ext.android; an.pkg = an.pkg || x.pkg; an.versionName = an.versionName || x.versionName; an.versionCode = an.versionCode || x.versionCode; an.minSdk = an.minSdk || x.minSdk; if (!an.targetSdk) { an.targetSdk = x.targetSdk || null; if (!an.targetSdk && x.targetSdkRaw) an.targetSdkRaw = x.targetSdkRaw; } }
      if (ext && ext.pkg) an.pkg = an.pkg || ext.pkg;
      if (expo && expo.android) { an.pkg = an.pkg || expo.android.package; an.permissions.push(...(expo.android.permissions || [])); an.versionCode = an.versionCode || expo.android.versionCode; }
      if (expo) for (const k of ['minSdk', 'targetSdk', 'compileSdk']) if (!an[k] && expoBP[k]) an[k] = expoBP[k];
      if (cdv) { an.pkg = an.pkg || cdv.androidId; an.versionName = an.versionName || cdv.version; an.versionCode = an.versionCode || cdv.versionCode; an.targetSdk = an.targetSdk || cdv.targetSdk; an.minSdk = an.minSdk || cdv.minSdk; if (!an.targetSdk) an.targetSdkRaw = an.targetSdkRaw || 'cordova-android default'; }
      /* Gradle values that only point somewhere else (flutter.versionName, flutterVersionCode.toInteger(), a variable) are resolved or left unread. */
      if (an.versionName != null && !/^\d/.test(String(an.versionName))) an.versionName = /flutter/i.test(an.versionName) && pubVer ? pubVer[1] : null;
      if (an.versionCode != null && !/^\d+$/.test(String(an.versionCode))) an.versionCode = /flutter/i.test(an.versionCode) && pubVer ? (pubVer[2] || null) : null;
      an.pkg = an.pkg || an.manifestPackage || an.namespace || null;
      /* 0.2.6: an application id has at least two dot-separated parts ("is" from a stray "applicationId is …" text is not one) */
      const okPkg = v => /^[A-Za-z][\w]*(\.[A-Za-z_][\w]*)+$/.test(String(v || '')) && !/^(rootProject|project|ext|libs|flutter)\./.test(v);
      if (an.pkg && !okPkg(an.pkg)) an.pkg = [an.manifestPackage, an.namespace, cdv && cdv.androidId, expo && expo.android && expo.android.package].find(okPkg) || null;
      const fullPerm = p => p.startsWith('android.permission.') || p.includes('.') ? p : 'android.permission.' + p;
      const removed = new Set(an.removedPermissions.filter(Boolean).map(fullPerm));
      an.removedPermissions = [...removed];
      an.permissions = [...new Set(an.permissions.filter(Boolean).map(fullPerm))].filter(p => !removed.has(p));
      an.adId = an.permissions.includes('com.google.android.gms.permission.AD_ID');
      an.manifestPath = manPath;
      /* 0.2.6: the built AAB / APK (when the project has one) is what Play receives: its manifest confirms or fills the source values */
      const bin = ((project.natives && project.natives.binaries) || []).find(b => b.manifest && (b.manifest.targetSdk || b.manifest.package));
      if (bin) {
        const m = bin.manifest; an.built = { file: bin.path, kind: bin.kind, targetSdk: m.targetSdk || null, minSdk: m.minSdk || null, package: m.package || null, versionCode: m.versionCode || null, versionName: m.versionName || null };
        /* order of truth: the built file wins over values read (or guessed) from source; a difference is reported, not hidden */
        const src = 'built ' + bin.kind.toUpperCase() + ' (' + bin.path + ')'; an.builtMismatch = [];
        const take = (k, v, raw) => { if (v == null || v === '') return; if (an[k] != null && an[k] !== '' && String(an[k]) !== String(v)) an.builtMismatch.push({ field: k, source: an[k], built: v }); an[k] = v; if (raw) an[raw] = src; };
        take('targetSdk', m.targetSdk, 'targetSdkRaw'); take('pkg', m.package); take('versionCode', m.versionCode);
        if (m.versionName) { if (an.versionName && an.versionName !== m.versionName) an.builtMismatch.push({ field: 'versionName', source: an.versionName, built: m.versionName }); an.builtVersionName = m.versionName; }
      }
      /* 0.2.6: form factors beyond phones (Play Console > Advanced settings > Form factors needs an opt-in for each) */
      const md = an.metaData || [], cats = an.categories || [], feats = an.features;
      an.formFactors = [
        (md.includes('com.google.android.gms.car.application') || an.deps.some(x => /^androidx\.car\.app:app(:|$)/.test(x)) || find(F, /res\/xml\/automotive_app_desc\.xml$/).length) && !feats.includes('android.hardware.type.automotive') ? 'android_auto' : null,
        feats.includes('android.hardware.type.automotive') || an.deps.some(x => /androidx\.car\.app:app-automotive/.test(x)) ? 'android_automotive' : null,
        feats.includes('android.hardware.type.watch') ? 'wear_os' : null,
        feats.includes('android.software.leanback') || cats.includes('android.intent.category.LEANBACK_LAUNCHER') ? 'tv' : null
      ].filter(Boolean);
      A.android = an;
    }

    // ---------- iOS ----------
    /* 0.2.5: app extensions (widgets, share / notification extensions) and watch apps have their own Info.plist; the app's own plist wins */
    const plistsAll = find(F, /(^|\/)Info\.plist$/).filter(p => !/(Tests?|Pods|\.framework)\//.test(p));
    const isExt = p => /<key>(NSExtension|WKApplication|WKWatchKitApp|WKCompanionAppBundleIdentifier)<\/key>/.test(F[p].text);
    const plists = plistsAll.filter(p => !isExt(p)).length ? plistsAll.filter(p => !isExt(p)) : plistsAll;
    const plistPath = plists.find(p => /ios\/Runner\//.test(p)) || shortest(plists);
    const pbx = shortest(find(F, /project\.pbxproj$/));
    if (plistPath || pbx || (expo && (expo.ios || expoPlat.includes('ios'))) || (cdv && cdv.ios) || (ext && ext.ios)) {
      A.platforms.ios = true; if (A.framework === 'unknown' || A.framework === 'android-native') A.framework = A.platforms.android ? A.framework : 'ios-native';
      const io = { usage: {}, plistPath };
      if (plistPath) { note(plistPath); const pl = parsePlist(F[plistPath].text); io.plist = pl; io.displayName = pl.CFBundleDisplayName || pl.CFBundleName; for (const k in pl) if (/^NS\w+UsageDescription$/.test(k)) io.usage[k] = String(pl[k] || ''); io.gad = pl.GADApplicationIdentifier || null; }
      if (pbx) { note(pbx); const t = F[pbx].text; const g = k => (t.match(new RegExp(k + '\\s*=\\s*"?([^";]+)"?;')) || [])[1] || null; io.bundleId = g('PRODUCT_BUNDLE_IDENTIFIER');
        /* 0.2.5: several targets (widget, watch app, extensions): the app is the bundle id the others extend (the shortest one) */
        const ids = [...new Set([...t.matchAll(/PRODUCT_BUNDLE_IDENTIFIER\s*=\s*"?([^";$]+)"?;/g)].map(m => m[1].trim()).filter(x => !/Tests$/i.test(x)))];
        if (ids.length > 1) io.bundleId = ids.sort((a, b) => a.length - b.length)[0]; io.version = g('MARKETING_VERSION'); io.build = g('CURRENT_PROJECT_VERSION'); io.deployment = g('IPHONEOS_DEPLOYMENT_TARGET'); }
      if (pbx) { const fam = (F[pbx].text.match(/TARGETED_DEVICE_FAMILY\s*=\s*"?([\d,]+)"?;/g) || []).join(' '); io.ipad = /[",=\s]2\b/.test(fam); }
      if (io.plist) { if (io.plist['UISupportedInterfaceOrientations~ipad']) io.ipad = true; if (io.plist.ITSAppUsesNonExemptEncryption !== undefined) io.encryption = io.plist.ITSAppUsesNonExemptEncryption; }
      if (ext && ext.ios) { const x = ext.ios; io.bundleId = io.bundleId || x.bundleId; io.version = io.version || x.version; io.build = io.build || x.build; io.deployment = io.deployment || x.deployment; }
      if (cdv) { io.bundleId = io.bundleId || cdv.iosId; io.version = io.version || cdv.version; io.build = io.build || cdv.iosBuild; io.deployment = io.deployment || cdv.iosDeployment; }
      /* Xcode build settings that point at Flutter's pubspec version */
      if (io.version && /^\$/.test(io.version)) io.version = /FLUTTER_BUILD_NAME/.test(io.version) && pubVer ? pubVer[1] : null;
      if (io.build && /^\$/.test(io.build)) io.build = /FLUTTER_BUILD_NUMBER/.test(io.build) && pubVer ? (pubVer[2] || null) : null;
      if (expo && expo.ios) {
        io.buildNumber = expo.ios.buildNumber; io.build = io.build || expo.ios.buildNumber;
        io.bundleId = io.bundleId || expo.ios.bundleIdentifier; const ip = expo.ios.infoPlist || {};
        for (const k in ip) if (/^NS\w+UsageDescription$/.test(k)) io.usage[k] = String(ip[k] || '');
        if (ip.ITSAppUsesNonExemptEncryption !== undefined) io.encryption = ip.ITSAppUsesNonExemptEncryption;
        if (expo.ios.config && expo.ios.config.usesNonExemptEncryption !== undefined) io.encryption = expo.ios.config.usesNonExemptEncryption;
        if (expo.ios.supportsTablet) io.ipad = true;
      }
      const xps = find(F, /PrivacyInfo\.xcprivacy$/);
      io.privacyManifest = !!xps.length;
      if (xps.length) {
        const xpPath = xps.find(p => /(^|\/)ios\//.test(p)) || shortest(xps), xt = F[xpPath].text, xpl = parsePlist(xt);
        io.xcprivacy = { path: xpPath, tracking: xpl.NSPrivacyTracking === true ? true : xpl.NSPrivacyTracking === false ? false : null,
          domains: Array.isArray(xpl.NSPrivacyTrackingDomains) ? xpl.NSPrivacyTrackingDomains.map(x => String(x).trim()).filter(Boolean) : [],
          types: [...new Set(xt.match(/NSPrivacyCollectedDataType(?!Linked|Tracking|Purpose|s\b)[A-Za-z]+/g) || [])] };
      }
      io.appleSignIn = find(F, /\.entitlements$/).some(p => /applesignin/.test(F[p].text));
      io.vpnEntitlement = find(F, /\.entitlements$/).some(p => /com\.apple\.developer\.networking\.networkextension[\s\S]*?(packet-tunnel-provider|app-proxy-provider)|com\.apple\.developer\.networking\.vpn\.api/.test(F[p].text));
      io.carplayEntitlement = find(F, /\.entitlements$/).some(p => /com\.apple\.developer\.carplay/.test(F[p].text));
      io.deploymentNum = io.deployment ? parseFloat(io.deployment) : null;
      A.ios = io;
    }

    // ---------- 문자열·이름 ----------
    find(F, /res\/values(-[\w+-]+)?\/strings\.xml$/).forEach(p => {
      if (/(debug|test)\//.test(p)) return; note(p);
      const q = (p.match(/values-([\w+-]+)\//) || [])[1]; const lang = q ? q.replace(/^b\+/, '').split(/[-+]r?/)[0] : 'default';
      A.strings[lang] = Object.assign(A.strings[lang] || {}, parseStrings(F[p].text));
    });
    find(F, /lib\/l10n\/.*\.arb$/).forEach(p => { note(p); try { const lang = ((p.match(/_([a-z]{2,3})(?:[_-][A-Za-z]+)*\.arb$/i) || [])[1] || 'default').toLowerCase(); const j = JSON.parse(F[p].text); A.strings[lang] = Object.assign(A.strings[lang] || {}, Object.fromEntries(Object.entries(j).filter(([k]) => !k.startsWith('@')))); } catch (e) { } });
    const def = A.strings.default || A.strings.en || {};
    const labelRef = A.android && A.android.label;
    const labelKey = labelRef && labelRef.startsWith('@string/') ? labelRef.slice(8) : 'app_name';
    for (const [lang, s] of Object.entries(A.strings)) if (s[labelKey]) A.names[lang === 'default' ? 'en' : lang] = s[labelKey];
    if (labelRef && !labelRef.startsWith('@')) A.names.en = labelRef;
    const rm = readme(txt(F, shortest(find(F, /(^|\/)README(\.md)?$/i)))); if (rm.title) note(shortest(find(F, /(^|\/)README(\.md)?$/i)));
    A.readme = rm;
    A.appName = A.names.en || (A.ios && A.ios.displayName) || (expo && expo.name) || (cdv && cdv.name) || (ext && ext.name) || (pkg && (pkg.displayName || pkg.name)) || rm.title || project.name;
    if (!A.names.en) A.names.en = A.appName;
    A.tagline = { };
    for (const [lang, s] of Object.entries(A.strings)) { const t = s.tagline || s.app_tagline || s.slogan || s.app_description; if (t) A.tagline[lang === 'default' ? 'en' : lang] = t; }
    /* 0.2.6: prepared store copy (short description) is the app's own pitch; a README that describes the folder itself is not */
    A.prepared = preparedListing(F, A.projectConfig);
    { const txt = Object.keys(F).filter(p => F[p].text != null && /\.(md|txt|csv|json)$/i.test(p) && !/(^|\/)(node_modules|build|dist)\//.test(p));
      const pick = re => txt.filter(p => re.test(p.split('/').pop())).sort((a, b) => a.length - b.length)[0] || null;
      A.preparedForms = { dataSafety: pick(/data[-_ ]?safety/i), contentRating: pick(/content[-_ ]?rating|iarc/i), forms: pick(/play[-_ ]?forms|console[-_ ]?forms/i) };
      if (A.preparedForms.forms && !A.preparedForms.dataSafety && /data ?safety|데이터 ?보안/i.test(F[A.preparedForms.forms].text)) A.preparedForms.dataSafety = A.preparedForms.forms;
      if (A.preparedForms.forms && !A.preparedForms.contentRating && /content ?rating|콘텐츠 ?등급|IARC/i.test(F[A.preparedForms.forms].text)) A.preparedForms.contentRating = A.preparedForms.forms; }
    /* 0.2.6: the app is only for invited / approved users (staff apps): sign-in is required for review, not optional */
    { const RESTRICT = /(직원 ?전용|임직원 ?전용|사내 ?전용|승인을 받아야|관리자의? ?승인|employees? only|staff only|for (our |company )?employees|invite[- ]only|invitation only|requires? (an )?(admin|administrator|manager) approval|internal (use|app) only)/i;
      const cfgAcc = A.projectConfig && (A.projectConfig.login_required ?? A.projectConfig.sign_in_required);
      const texts = [...Object.values((A.prepared && A.prepared.copy) || {}).flatMap(c => [c.short, c.full]).filter(Boolean).map(t => ['listing', t]), ...Object.keys(F).filter(p => /(^|\/)README[^/]*\.md$/i.test(p) && F[p].text).map(p => [p, F[p].text])];
      const hit = texts.find(([, t]) => RESTRICT.test(t));
      if (cfgAcc != null) A.accessRestricted = cfgAcc ? { source: 'project config' } : null;
      else if (hit) A.accessRestricted = { source: hit[0] === 'listing' ? 'prepared store listing' : hit[0], text: (hit[1].match(RESTRICT) || [])[0] }; }
    if (A.prepared) for (const l of A.prepared.langs) { const c = A.prepared.copy[l]; if (c.short) A.tagline[l] = c.short.replace(/[.。]$/, ''); if (c.title && !A.names[l]) A.names[l] = c.title.split(/\s+[-–:|]\s+/)[0].trim(); }
    const metaReadme = /\b(analysis folder|reconstructed (for|from)|not a buildable|this folder (is|contains)|this repo(sitory)? (is|contains)|for rocket launcher)\b|분석(용)? 폴더/i;
    if (metaReadme.test(rm.summary)) { rm.summary = ''; A.readmeIsMeta = true; }
    if (!A.tagline.en && project.meta && project.meta.description) A.tagline.en = project.meta.description;
    if (!A.tagline.en && rm.summary) A.tagline.en = rm.summary.split(/(?<=\.)\s/)[0].replace(/\.$/, '');
    /* 0.2.4: also locale files of JS / native apps (locales/ko.json, i18n/th.json, ko.lproj/Localizable.strings) */
    const fileLocales = P.map(p => (p.match(/(?:^|\/)(?:locales?|i18n|lang|langs|translations|l10n)\/([a-z]{2})(?:[-_][A-Za-z]{2,4})?\.json$/i) || p.match(/(?:^|\/)([a-z]{2})(?:[-_][A-Za-z]{2,4})?\.lproj\//i) || [])[1]).filter(Boolean).map(l => l.toLowerCase());
    /* 0.2.7: rocketlauncher.json default_language (and a prepared listing) wins over mapping values/strings.xml "default" to English */
    const defLang = (A.prepared && A.prepared.defaultLang) || 'en';
    if (A.strings.default) {
      const labelVal = A.strings.default[labelKey];
      if (labelVal && !A.names[defLang]) A.names[defLang] = labelVal;
    }
    A.locales = [...new Set([defLang, ...Object.keys(A.strings).map(l => l === 'default' ? defLang : l), ...fileLocales])];
    A.pkg = (A.android && A.android.pkg) || (A.ios && A.ios.bundleId) || null;
    A.version = (A.android && (A.android.builtVersionName || A.android.versionName)) || (A.ios && A.ios.version) || (expo && expo.version) || (pubVer && pubVer[1]) || (cdv && cdv.version) || (pkg && pkg.version) || '1.0.0';

    // ---------- 연락처 ----------
    const lic = txt(F, shortest(find(F, /(^|\/)LICENSE/i)));
    const holder = (lic.match(/Copyright\s*(?:\(c\)|©)?\s*\d{4}(?:-\d{4})?\s+(.+)/i) || [])[1];
    const allText = Object.values(F).filter(v => v.text && !v.code).map(v => v.text).join('\n').slice(0, 600000);
    const email = (allText.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) || []).find(e => !/noreply|example\.com|users\.noreply|android\.com|apple\.com|googlegroups/.test(e));
    A.listing = listingOf(F, A);
    A.developer = { name: (holder || (project.meta && project.meta.owner) || '').trim() || null, email: email || null, policyFound: !!find(F, /privacy[^/]*\.(md|html)$/i).filter(p => !OLD_RE.test(p)).length || !!A.listing.privacyUrl, privacyUrl: A.listing.privacyUrl || null };
    A.deletionInfo = deletionInfoOf(F, A);
    A.privacyPages = privacyPagesOf(F, A);

    // ---------- SDK ----------
    /* 0.2.4: comments do not count (a "// TODO: add Firebase Analytics" line is not analytics) */
    const codeHay = Object.keys(F).filter(p => F[p].code).map(p => stripCode(F[p].text)).join('\n').slice(0, 1500000);
    const pluginHay = txt(F, shortest(find(F, /capacitor\.plugins\.json$/))) + '\n' + txt(F, shortest(find(F, /capacitor\.config\.(json|ts|js)$/))) + '\n' + txt(F, shortest(find(F, /google-services\.json$/)));
    const hay = [(A.android && A.android.deps.join(' ')) || '', deps.join(' '), pubspecDeps(txt(F, pubspec)), stripHashComments(txt(F, shortest(find(F, /Podfile$/)))), txt(F, plistPath), (A.android && A.android.permissions.join(' ')) || '', JSON.stringify((A.ios && A.ios.usage) || {}), pluginHay, codeHay].join(' ');
    const Det = window.RLDetect;
    /* 0.2.3: an ad SDK counts only when it is really declared: Gradle / version-catalog dependencies, package.json dependencies, pubspec,
       Podfile / Package.swift, installed Capacitor/Cordova plugins, the AndroidManifest ads APPLICATION_ID meta-data or Info.plist
       GADApplicationIdentifier. A name that only appears in app code (a config placeholder, a comment, a bundled script) is a hint, not ads. */
    const AD_RE = /play-services-ads|google_mobile_ads|google-mobile-ads|\badmob\b|capacitor[\w-]*admob|admob-plus|Google-Mobile-Ads|GoogleMobileAds|GADApplicationIdentifier|applovin|unity-?ads|audience-network|FBAudienceNetwork|ironsource|chartboost|vungle|inmobi|mintegral|pangle|com\.unity\.ads\b|com\.google\.ads\.mobile\b|com\.unity\.services\.levelplay|com\.ironsource/i;
    const declHay = [(A.android && A.android.deps.join(' ')) || '', deps.join(' '), pubspecDeps(txt(F, pubspec)), stripHashComments(txt(F, shortest(find(F, /Podfile$/)))), txt(F, shortest(find(F, /(^|\/)Package\.swift$/))),
      txt(F, shortest(find(F, /capacitor\.plugins\.json$/))), txt(F, shortest(find(F, /(^|\/)cordova_plugins\.js$/))), cdvPath ? [...txt(F, cdvPath).matchAll(/<plugin\s+name="([^"]+)"/g)].map(m => m[1]).join(' ') : '',
      /* 0.2.5: Unity packages (Packages/manifest.json) and NuGet packages of a .NET MAUI project */
      txt(F, shortest(find(F, /(^|\/)Packages\/manifest\.json$/))), mauiPath ? [...txt(F, mauiPath).matchAll(/<PackageReference\s+Include="([^"]+)"/g)].map(m => m[1]).join(' ') : ''].join(' ');
    const IAP_DECL = /com\.android\.billingclient|com\.android\.vending\.BILLING|\bin_app_purchase\b|flutter_inapp_purchase|purchases_flutter|react-native-iap|expo-iap|expo-in-app-purchases|react-native-purchases|@revenuecat|\bRevenueCat\b|cordova-plugin-purchase|capacitor[\w-]*(in-app-purchase|purchases?)\b|@capacitor-community\/in-app-purchases?|SwiftyStoreKit|\bpod\s+['"]Purchases['"]|com\.unity\.purchasing|Plugin\.InAppBilling/i;
    const adsDeclared = has(declHay, AD_RE) || !!(A.android && A.android.adsAppId) || !!(A.ios && A.ios.gad);
    const adsCodeFiles = adsDeclared ? [] : Object.keys(F).filter(p => F[p].code && !BUNDLED_RE.test(p) && AD_RE.test(F[p].text)).slice(0, 5);
    A.sdk = {
      ads: adsDeclared,
      analytics: has(hay, /firebase-analytics|firebase_analytics|\/analytics|FirebaseAnalytics|amplitude|mixpanel/i),
      crash: has(hay, /crashlytics|sentry|bugsnag/i),
      auth: has(hay, (Det && Det.AUTH_RE) || /firebase-auth|firebase_auth|play-services-auth|google_sign_in|google-signin|auth0|supabase\.auth\.|credentials-play-services|googleid/i),
      googleSignIn: has(hay, /play-services-auth|google_sign_in|google-signin|googleid|GoogleAuthProvider|signInWithPopup/i),
      cloudDb: has(hay, (Det && Det.CLOUD_RE) || /firestore|firebase-database|firebase_database|supabase|SyncConfiguration|flexibleSync|realm\.mongodb/i),
      /* 0.2.4: in-app purchases from real declarations (Play Billing, StoreKit, IAP plugins), not any "billing" / "purchases" word */
      billing: has(declHay + ' ' + ((A.android && A.android.permissions.join(' ')) || ''), IAP_DECL) || has(codeHay, /\bBillingClient\b|import\s+StoreKit\b|\bSKPaymentQueue\b|\bSKProductsRequest\b|\bProduct\.products\s*\(|\bAppStore\.sync\s*\(/),
      location: has(hay, (Det && Det.LOC_SDK_RE) || /LOCATION|play-services-location|geolocator|NSLocation|Geolocation|@capacitor\/geolocation/i),
      camera: has(hay, /permission\.CAMERA|camera-camera2|camerax|NSCameraUsageDescription|image_picker|expo-camera/i),
      ocr: has(hay, /text-recognition|mlkit|vision/i),
      photos: has(hay, /READ_MEDIA_IMAGES|READ_EXTERNAL_STORAGE|NSPhotoLibrary/i),
      notifications: has(hay, /POST_NOTIFICATIONS|firebase-messaging|firebase_messaging|notifications/i),
      localDb: has(hay, /room-runtime|sqflite|realm|sqlite|coredata|hive/i),
      contacts: has(hay, /READ_CONTACTS|NSContacts/i),
      mic: has(hay, /RECORD_AUDIO|NSMicrophone/i)
    };
    A.adsHint = adsCodeFiles.length ? { files: adsCodeFiles } : null;
    /* 0.2.6: a leftover ads config block that is explicitly switched off (adsEnabled: false, ads: { enabled: false }) is not even a hint */
    const ADS_OFF = /\b(ads_?enabled|enable_?ads|show_?ads|ads_?on|use_?ads)\s*[:=]\s*(false|0|['"]false['"])\b|\bads\s*[:=]\s*\{[^{}]*\benabled\s*:\s*false\b|\bADS_ENABLED\s*=\s*false\b/i;
    const cfgAds = A.projectConfig && (A.projectConfig.ads === false || A.projectConfig.contains_ads === false || A.projectConfig.has_ads === false);
    if (A.adsHint && (cfgAds || A.adsHint.files.every(p => ADS_OFF.test(stripCode(F[p].text))))) { A.adsDisabled = { files: A.adsHint.files, source: cfgAds ? 'project config' : 'ads switched off in code' }; A.adsHint = null; }
    /* 0.2.5: auto-renewing subscriptions (vs one-time products), ad consent (Google UMP / an IAB TCF CMP) and attribution SDKs that use the IDFA */
    A.sdk.subscriptions = A.sdk.billing && (has(declHay, /purchases_flutter|react-native-purchases|@revenuecat|\bRevenueCat\b|\bpod\s+['"]Purchases['"]|adapty|qonversion|superwall/i)
      || has(codeHay, /ProductType\.SUBS\b|SkuType\.SUBS\b|\.autoRenewable\b|SubscriptionStoreView|\.subscription\??\.subscriptionPeriod|subscriptionPeriod|Product\.SubscriptionInfo|subscriptionOfferDetails|\bSKProductSubscriptionPeriod\b|ProductType\.subs\b|['"]subs['"]/));
    A.sdk.consent = has(declHay + ' ' + codeHay, /user-messaging-platform|UserMessagingPlatform|\bUMPConsent|ConsentInformation|ConsentForm|ConsentRequestParameters|requestConsentInfoUpdate|AdsConsent|admob[\w-]*consent|@capacitor-community\/admob|didomi|onetrust|usercentrics|sourcepoint|consentmanager|quantcast|IABTCF_|AppLovinPrivacySettings\.setHasUserConsent|setHasUserConsent|MetaData\(.*gdpr\.consent/i);
    A.sdk.attribution = has(declHay + ' ' + codeHay, /appsflyer|AppsFlyerLib|com\.adjust\.sdk|\bAdjust(Sdk|Config)\b|react-native-adjust|adjust_sdk|\bpod\s+['"]Adjust['"]|io\.branch|react-native-branch|flutter_branch_sdk|\bBranch\.getInstance|\bpod\s+['"]Branch['"]|kochava|singular-?sdk|\bSingular\b|tenjin/i);
    /* 0.2.4: what the iOS build itself uses (cross-platform plugins, iOS / web code; Android-only Kotlin/Java and manifest permissions excluded),
       so an iOS purpose string is only required when the iOS app really asks for that permission. */
    if (A.ios) {
      const iosCode = Object.keys(F).filter(p => F[p].code && !/\.(kt|java)$/i.test(p)).map(p => stripCode(F[p].text)).join('\n').slice(0, 1500000);
      const iosHay = [deps.join(' '), pubspecDeps(txt(F, pubspec)), stripHashComments(txt(F, shortest(find(F, /Podfile$/)))), txt(F, shortest(find(F, /(^|\/)Package\.swift$/))), pluginHay, declHay, iosCode].join('\n');
      A.iosNeeds = {
        location: /\bgeolocator\b|(^|\s)location:\s|@capacitor\/geolocation|expo-location|react-native-geolocation|@react-native-community\/geolocation|cordova-plugin-geolocation|CLLocationManager|requestWhenInUseAuthorization|requestAlwaysAuthorization|navigator\s*\.\s*geolocation|getCurrentPosition|watchPosition/.test(iosHay),
        camera: /\bimage_picker\b|(^|\s)camera:\s|expo-camera|expo-image-picker|react-native-vision-camera|react-native-image-picker|react-native-camera|@capacitor\/camera|cordova-plugin-camera|mobile_scanner|AVCaptureDevice|AVCaptureSession|UIImagePickerController/.test(iosHay),
        contacts: /flutter_contacts|contacts_service|expo-contacts|react-native-contacts|@capacitor-community\/contacts|cordova-plugin-contacts|CNContactStore|import\s+Contacts\b/.test(iosHay),
        mic: /flutter_sound|speech_to_text|(^|\s)record:\s|react-native-voice|@react-native-voice|AVAudioRecorder|SFSpeechRecognizer|@capacitor-community\/speech-recognition|cordova-plugin-media-capture/.test(iosHay),
        /* 0.2.5: HealthKit needs NSHealthShareUsageDescription (read) / NSHealthUpdateUsageDescription (write) */
        health: /HKHealthStore|import\s+HealthKit\b|(^|\s)health:\s|react-native-health\b|@kingstinct\/react-native-healthkit|capacitor-health|cordova-plugin-health|@capgo\/capacitor-health/.test(iosHay)
      };
    }
    A.sdk.appleSignIn = !!(A.ios && A.ios.appleSignIn) || has(hay, /sign_in_with_apple|apple-authentication|AuthenticationServices|ASAuthorizationAppleIDProvider|appleAuth|AppleAuthProvider/i);
    A.sdk.thirdPartyLogin = A.sdk.googleSignIn || has(hay, /flutter_facebook_auth|facebook-login|FBSDKLoginKit|react-native-fbsdk|kakao[\w.-]*(login|user|auth)|kakao_flutter_sdk|naveridlogin|flutter_naver_login|line-sdk|LineSDK|flutter_line_sdk|twitter_login|react-native-app-auth/i);
    A.review = reviewSignals(A, F, hay);

    // ---------- 카테고리 ----------
    /* Weighted corpus: the app name / README title count 3×, tagline and features 2×, README body, in-app strings and
       permission purpose texts 1×. A project config "category" always wins. */
    const rmBody = txt(F, shortest(find(F, /(^|\/)README(\.md)?$/i))).replace(/https?:\/\/\S+/g, ' ').slice(0, 6000);
    const weighted = [[[rm.title, A.appName].join(' '), 3], [[rm.summary, rm.features.join(' '), ...Object.values(A.tagline)].join(' '), 2],
      [[rmBody, ...Object.values(def), ...Object.values((A.ios && A.ios.usage) || {}), A.pkg || ''].join(' '), 1]];
    const scores = Object.entries(CATS).map(([k, re]) => [k, weighted.reduce((sum, [text, w]) => sum + w * Math.min(12, (String(text).match(new RegExp(re.source, 'gi')) || []).length), 0)]);
    /* a location permission plus map/fuel words is a strong navigation signal */
    const nav = scores.find(x => x[0] === 'navigation'); if (nav[1] > 0 && A.sdk.location) nav[1] += 2;
    scores.sort((a, b) => b[1] - a[1]);
    /* weak side matches (one stray word) do not become suggestions; the top category always does */
    const topScore = scores[0][1];
    A.categories = scores.filter((s, i) => s[1] > 0 && (i === 0 || s[1] >= Math.max(2, topScore * 0.2))).map(s => s[0]);
    if (A.sdk.ocr) A.categories = A.categories.filter(c => c !== 'photography');
    /* 0.2.6: the developer's own category (rocketlauncher.json, else a prepared store-listing draft) always comes first, in any naming */
    const cfgRaw = A.projectConfig && A.projectConfig.category, cfgCat = catKey(cfgRaw);
    if (cfgRaw && !cfgCat) A.categoryConfigUnknown = String(cfgRaw).slice(0, 60);
    const ownCat = cfgCat || (A.prepared && A.prepared.category) || null;
    if (ownCat && CATS[ownCat]) { A.categories = [ownCat, ...A.categories.filter(c => c !== ownCat)]; A.categorySource = cfgCat ? 'project config (' + (A.projectConfig._file || 'rocketlauncher.json') + ')' : 'store listing draft (' + A.prepared.categoryFile + ')'; }
    if (!A.categories.length) A.categories = ['tools'];
    if (A.categories.length < 2) A.categories.push(CAT_NEXT[A.categories[0]] || 'productivity');
    A.categories = A.categories.slice(0, 3);

    /* 0.2.4: apps aimed at children (Google Play Families policy, App Store Kids category rules) */
    const kidsText = [rm.title, A.appName, rm.summary, rm.features.join(' '), ...Object.values(A.tagline)].join(' ');
    A.kids = /\b(kids?|children|toddlers?|preschool\w*|kindergarten|babies|little ones|ages? [2-9]\s*(-|to|–)\s*\d+)\b|어린이|유아|아이들|키즈|เด็กเล็ก|สำหรับเด็ก|儿童|孩子|幼儿|बच्चों|बच्चे/i.test(kidsText) && !/\bnot (for|directed (at|to)|meant for) (kids|children)\b/i.test(kidsText);

    /* 0.2.5: policy areas with their own store rules, from the app's own description (name, README, tagline, listing copy) */
    const policyText = [kidsText, rmBody.slice(0, 3000), ...Object.values(A.listing.play.copy || {}).map(c => [c.title, c.short, c.full].join(' ')), ...Object.values(A.listing.apple.copy || {}).map(c => [c.name, c.subtitle, c.description].join(' '))].join(' ');
    A.policy = {
      loans: /\b(personal loans?|instant loans?|cash loans?|payday loans?|quick loans?|micro-?loans?|loan app|borrow (money|cash)|lending app|apply for a loan|get a loan|credit line)\b|대출 신청|비상금 대출|소액 대출|เงินกู้|สินเชื่อส่วนบุคคล|กู้เงิน|贷款申请|借款|网贷|पर्सनल लोन|लोन ऐप|तुरंत लोन/i.test(policyText) && !/\b(loan|mortgage|emi|interest) calculator\b|대출 계산기|คำนวณสินเชื่อ|贷款计算器|लोन कैलकुलेटर/i.test(policyText),
      gambling: /\b(casinos?|sportsbooks?|sports betting|betting|wagers?|wagering|poker|roulette|blackjack|baccarat|slot machines?|real[- ]money (games?|gaming)|lottery|lotto)\b|카지노|도박|베팅|스포츠토토|คาสิโน|การพนัน|แทงบอล|พนัน|赌博|博彩|赌场|彩票|投注|जुआ|सट्टा|कैसीनो/i.test(policyText),
      alarm: /\b(alarms?|alarm clock|wake[- ]?up|calendar)\b|알람|자명종|캘린더|นาฬิกาปลุก|ปฏิทิน|闹钟|日历|अलार्म|कैलेंडर/i.test([rm.title, A.appName, rm.summary].join(' ')),
      aiChat: !!(A.review && A.review.aiApi) && /\b(chat\w*|assistant|companion|chatbot|talk to|conversation)\b|채팅|대화|챗봇|แชท|聊天|对话|चैट/i.test(policyText)
    };

    // ---------- 그림 ----------
    const imgs = P.filter(p => F[p].dataUrl);
    const iconPath = imgs.find(p => /playstore/i.test(p)) || imgs.find(p => /(^|\/)(play|store|fastlane)\/[^/]*(icon)[-_]?512[^/]*\.png$/i.test(p)) || imgs.find(p => /AppIcon.*(1024|512@2x)/i.test(p)) || imgs.find(p => /mipmap-xxxhdpi\/ic_launcher\./i.test(p)) || imgs.find(p => /ic_launcher\./i.test(p)) || imgs.find(p => /AppIcon/i.test(p)) || imgs.find(p => /(^|\/)(icon|app-icon|appicon|logo)\.png$/i.test(p));
    A.icon = iconPath ? { path: iconPath, dataUrl: F[iconPath].dataUrl } : null;
    /* 0.2.3: the iOS and the Android icon separately, so a blank icon or two different icons can be flagged (pixels are checked by the MCP server) */
    A.icons = iconsByPlatform(F, imgs);
    /* 0.2.6: an existing feature graphic (1024×500) and store icon are kept apart from screenshots; the same picture saved in two folders
       (play/screenshots and screenshots) counts once. */
    const FEATURE_RE = /(^|\/)[^/]*(feature[-_ ]?graphic|featureGraphic|feature[-_]?1024|1024[x×]500)[^/]*\.(png|jpe?g)$/i, STORE_ICON_RE = /(^|\/)[^/]*(icon|logo)[-_]?(512|1024)[^/]*\.png$|(^|\/)(play[-_]?)?store[-_]?icon[^/]*\.png$/i;
    const fg = imgs.filter(p => FEATURE_RE.test(p) && !OLD_RE.test(p)).sort((a, b) => /(^|\/)(play|store|fastlane)\//i.test(b) - /(^|\/)(play|store|fastlane)\//i.test(a) || a.length - b.length)[0];
    A.featureGraphic = fg ? { path: fg, dataUrl: F[fg].dataUrl } : null;
    const seenShot = new Set(), shotRank = p => /(^|\/)(play|store|fastlane)\//i.test(p) ? 0 : 1;
    const shotPaths = imgs.filter(p => /(screenshots?|phoneScreenshots|store)\//i.test(p) && !FEATURE_RE.test(p) && !STORE_ICON_RE.test(p) && !/(^|\/)(icon|app-icon|appicon|logo)\.png$/i.test(p) && !/(^|\/)(tablet|tenInch|sevenInch|wear|tv)[^/]*\//i.test(p))
      .sort((a, b) => shotRank(a) - shotRank(b) || a.localeCompare(b)).filter(p => { const k = F[p].dataUrl; if (seenShot.has(k)) return false; seenShot.add(k); return true; });
    A.screenshotsTotal = shotPaths.length;
    A.screenshots = shotPaths.slice(0, 8).map(p => ({ path: p, dataUrl: F[p].dataUrl }));
    const colors = txt(F, shortest(find(F, /res\/values\/colors\.xml$/)));
    const cm = colors.match(/name="(?:brand|primary|colorPrimary|purple_500|accent)[^"]*"\s*>\s*#(?:FF)?([0-9a-f]{6})\b/i) || colors.match(/#(?:FF)?([0-9a-f]{6})\b/i);
    A.brandColor = cm ? '#' + cm[1].toLowerCase() : null;

    /* 0.2.5: big files bundled into the Android base module (Play: 200 MB compressed download limit; larger content goes into Play Asset Delivery packs) */
    const packDirs = find(F, /\.gradle(\.kts)?$/).filter(p => /com\.android\.asset-pack|libs\.plugins\.android[.-]?asset[.-]?pack/i.test(stripCode(F[p].text))).map(p => p.replace(/[^/]*$/, ''));
    A.largeFiles = ((project.natives && project.natives.large) || []).filter(f => !packDirs.some(d => d && f.path.startsWith(d)) && !/(^|\/)(ios|docs?|tests?|samples?|screenshots?|design|raw-?assets|\.github)\//i.test(f.path));
    A.issues = checks(A);
    score(A);
    return A;
  }

  /* ---------- App review signals from code and metadata (general App Store review lessons) ---------- */
  function reviewSignals(A, F, hay) {
    const codeP = Object.keys(F).filter(p => F[p].code);
    const code = codeP.map(p => F[p].text).join('\n').slice(0, 4000000);
    const any = code + '\n' + hay;
    const io = A.ios, R = {};
    // Ads: non-personalized requests (npa=1) and remote on/off flags
    R.npa = /["']npa["']\s*[:,=\]]\s*["']?1|\bnpa\s*=\s*["']?1|nonPersonalizedAds\s*:\s*true|requestNonPersonalizedAdsOnly\s*:\s*true|setRequestNonPersonalizedAdsOnly|NonPersonalized(Ads)?\s*=\s*true/i.test(code);
    R.remoteAds = !!A.sdk.ads && (/firebase[-_]?remote[-_]?config|remoteConfig|RemoteConfig/.test(any) && /(ads?_?enabled|show_?ads|enable_?ads|ad_?flag|ads_?on)/i.test(code));
    // Tracking: ATT usage string, ATT request in code, PrivacyInfo, App Store Connect usesIdfa
    R.attString = !!(io && io.usage.NSUserTrackingUsageDescription && String(io.usage.NSUserTrackingUsageDescription).trim());
    R.attCode = /requestTrackingAuthorization|ATTrackingManager|AppTrackingTransparency\.|app_tracking_transparency|expo-tracking-transparency|react-native-tracking-transparency|requestTrackingPermissionsAsync|requestTrackingAuthorizationWithCompletionHandler/.test(any);
    const allMeta = Object.keys(F).filter(p => F[p].text != null && !F[p].code).map(p => F[p].text).join('\n');
    R.usesIdfa = /usesIdfa["']?\s*[:=]\s*true/i.test(allMeta + code) ? true : /usesIdfa["']?\s*[:=]\s*false/i.test(allMeta + code) ? false : null;
    const xp = io && io.xcprivacy;
    R.manifestTracking = !!(xp && xp.tracking === true);
    R.trackingDomains = xp ? xp.domains.length : 0;
    // Secret storage: Keychain (or a cross-platform plugin that uses it on iOS) vs Android-only storage
    R.iosKeychain = /Keychain|kSecClass|SecItemAdd|SecItemCopyMatching|flutter_secure_storage|expo-secure-store|react-native-keychain|react-native-encrypted-storage|KeychainAccess|SAMKeychain|capacitor-secure-storage|@aparajita\/capacitor-secure-storage|secure_storage|KeychainSwift/i.test(any);
    R.androidOnlySecrets = /encrypted_shared_preferences|EncryptedSharedPreferences|androidx\.security[:.]security-crypto|MasterKey(s)?\.Builder|AndroidKeyStore/.test(any);
    // User-supplied AI API keys (bring your own key)
    const ai = /generativelanguage\.googleapis|google_generative_ai|@google\/generative-ai|@google\/genai|aistudio\.google|GenerativeModel\(|api\.openai\.com|\bopenai\b|api\.anthropic\.com|anthropic|dart_openai|langchain/i.test(any);
    const keyEntry = /(enter|paste|your|user'?s?|own)\s+(\w+\s+)?api[\s_-]?key|api[\s_-]?key\s*(field|input|setting|controller|textfield)|apiKey(Controller|Field|Input|TextField|Setting)|setApiKey|saveApiKey|byok|bring your own key|API ?키|คีย์ API|API 密钥|API कुंजी/i.test(any + '\n' + JSON.stringify(A.strings || {}));
    R.byok = ai && keyEntry;
    R.aiApi = ai;
    /* 0.2.5: user-generated content / AI output needs a way to report and block (Play UGC + AI-generated content policy, App Store 1.2) */
    const uiText = code + '\n' + JSON.stringify(A.strings || {}) + '\n' + ((A.readme && [A.readme.summary, A.readme.features.join(' ')].join(' ')) || '');
    R.moderation = /\breport(Post|User|Content|Comment|Message|Abuse|Inappropriate|Response|Answer)\b|report_(post|user|content|comment|abuse)|\bblockUser\b|block_user|flag(Content|Post|Comment|Message|Response)\b|\bmoderat(e|ion|or)\b|contentFilter|profanity|report (this )?(post|user|comment|message|content|response|answer)s?|block (this )?users?|신고|차단|รายงานเนื้อหา|บล็อกผู้ใช้|举报|屏蔽|रिपोर्ट करें|ब्लॉक करें/i.test(uiText);
    /* 0.2.5: subscription terms: a Terms of Use / EULA link (Apple 3.1.2: title, length, price, terms and privacy links) */
    const allTxt = Object.keys(F).filter(p => F[p].text != null).map(p => F[p].text).join('\n').slice(0, 3000000);
    R.terms = /https?:\/\/[^\s"'<>)]*(terms|tos\b|eula|legal\/internet-services\/itunes\/dev\/stdeula|이용약관)|\bterms of (use|service)\b|\bEULA\b|이용약관|ข้อกำหนดการใช้งาน|使用条款|服务条款|उपयोग की शर्तें/i.test(allTxt) || Object.keys(F).some(p => /(^|\/)(terms|eula|tos)[^/]*\.(md|html?)$/i.test(p));
    // Login gate: the first screen is a sign-in screen (core features may need login, Guideline 5.1.1(v))
    R.loginGate = /initialRoute\s*:\s*['"]\/?(login|signin|sign-in|auth|welcome-login)['"]|startDestination\s*=\s*["'](login|signin|sign_in|auth)["']|home\s*:\s*(const\s+)?(Login|SignIn|Auth)\w*(Screen|Page|View)\b|initialRouteName\s*=\s*["'](Login|SignIn|Auth)\w*["']|rootViewController\s*=\s*(Login|SignIn)\w*|WindowGroup\s*\{\s*(Login|SignIn)\w*View/.test(code) || /(requires?|must)\s+(a\s+)?(log ?in|sign[ -]?in)|login (is )?required|sign[- ]in (is )?required/i.test((A.readme && A.readme.summary) || '');
    // Location: does code send coordinates off the device? Conservative when uncertain.
    const loc = (window.RLDetect && window.RLDetect.locationFlow(codeP, F, hay)) || { sent: false, confidence: null, kinds: [] };
    R.locationSent = !!loc.sent;
    R.locationConfidence = loc.confidence;
    R.locationKinds = loc.kinds || [];
    const del = (window.RLDetect && window.RLDetect.deletion(codeP, F, A.strings)) || { found: false, confidence: null, kinds: [], files: [] };
    R.deletionInApp = !!del.found;
    R.deletionConfidence = del.confidence;
    R.deletionKinds = del.kinds || [];
    R.deletionFiles = del.files || [];
    // CarPlay
    R.carplay = /CPTemplateApplicationScene|CPInterfaceController|import\s+CarPlay|flutter_carplay|react-native-carplay|CPTemplateApplicationSceneSessionRoleApplication/.test(any);
    // Store metadata in the repo (fastlane): iOS = fastlane/metadata/<locale>/, Android = fastlane/metadata/android/
    const meta = Object.keys(F).filter(p => /fastlane\/metadata\//i.test(p) && F[p].text != null);
    const iosMeta = meta.filter(p => !/fastlane\/metadata\/android\//i.test(p));
    const field = (list, re) => list.filter(p => re.test(p)).map(p => ({ path: p, text: F[p].text }));
    const FREE = /\bfree\b|무료|ฟรี|免费|免費|मुफ़्त|मुफ्त|फ्री/i, BRANDS = /\b(google|android|iphone|ipad|apple|app store|play store|facebook|instagram|whatsapp|tiktok|youtube|chatgpt|gemini)\b/i;
    R.freeInMeta = field(iosMeta, /(subtitle|keywords)\.txt$/i).filter(x => FREE.test(x.text) || BRANDS.test(x.text)).map(x => x.path);
    R.androidInIosMeta = field(iosMeta, /(description|subtitle|keywords|promotional_text|release_notes|name)\.txt$/i).filter(x => /android|android auto|google play/i.test(x.text)).map(x => x.path);
    R.adsInCopy = field(meta, /(description|subtitle|keywords|promotional_text|release_notes|title|short_description|full_description|changelogs\/[^/]+)\.txt$/i)
      .filter(x => /\b(ads?|advert\w*|admob|banner ads?)\b|광고|โฆษณา|广告|विज्ञापन/i.test(x.text)).map(x => x.path);
    const supUrl = field(iosMeta, /support_url\.txt$/i).map(x => x.text.trim()).find(Boolean);
    R.supportUrl = supUrl || null;
    R.supportUrlHome = !!supUrl && /^https?:\/\/[^/]+\/?(index\.html?)?$/i.test(supUrl);
    const sup = Object.keys(F).filter(p => /(^|\/)(support|contact)([^/]*\.(md|html?)|\/index\.(md|html?))$/i.test(p) && F[p].text != null && !F[p].code);
    R.supportPage = sup[0] || null;
    R.supportNoContact = sup.length > 0 && !sup.some(p => /mailto:|[\w.+-]+@[\w-]+\.[\w.]+|<form\b|tel:|wa\.me|line\.me|m\.me\//i.test(F[p].text));
    return R;
  }

  /* ---------- 검수 규칙: id·심각도·플랫폼·수정안 종류 (문구는 i18n 'iss.<id>.*') ---------- */
  function checks(A) {
    const out = []; const add = (id, sev, plat, fix, vars) => out.push({ id, sev, plat, fix: fix || null, vars: vars || {} });
    const an = A.android, io = A.ios, s = A.sdk;
    if (an) {
      /* Only a value that was actually read can block. An unread value ("—") is a warning to check, never a must-fix. */
      if (an.targetSdk && an.targetSdk < PLAY_TARGET) add('targetSdk', 'block', 'android', 'patch-gradle', { cur: an.targetSdk, need: PLAY_TARGET });
      else if (!an.targetSdk) add('targetSdkUnread', 'warn', 'android', 'info', { raw: an.targetSdkRaw || '—', need: PLAY_TARGET });
      if (an.debuggable) add('debuggable', 'block', 'android', 'patch-manifest-debug');
      if (an.cleartext) add('cleartext', 'warn', 'android', 'patch-manifest-cleartext');
      if (an.permissions.some(p => /READ_MEDIA_IMAGES|READ_MEDIA_VIDEO/.test(p))) add('photoPerm', 'warn', 'android', 'patch-manifest-photo');
      if (an.permissions.some(p => /ACCESS_BACKGROUND_LOCATION/.test(p))) add('bgLocation', 'block', 'android', 'declare');
      if (an.permissions.some(p => /READ_SMS|RECEIVE_SMS|READ_CALL_LOG|PROCESS_OUTGOING_CALLS/.test(p))) add('smsCall', 'block', 'android', 'declare');
      if (an.permissions.some(p => /QUERY_ALL_PACKAGES|MANAGE_EXTERNAL_STORAGE|REQUEST_INSTALL_PACKAGES/.test(p))) add('specialPerm', 'block', 'android', 'declare');
      if (an.permissions.some(p => /FOREGROUND_SERVICE/.test(p))) add('fgs', 'warn', 'android', 'declare');
      /* 0.2.5: Android 14+ (targetSdk 34): every foreground service needs android:foregroundServiceType and the matching FOREGROUND_SERVICE_<TYPE> permission */
      if (an.permissions.includes('android.permission.FOREGROUND_SERVICE') && (!an.targetSdk || an.targetSdk >= 34)) {
        const svc = an.services || [], typed = svc.filter(x => x.fgsType);
        const missingPerm = typed.flatMap(x => String(x.fgsType).split('|')).filter(t => t && t !== 'shortService').map(t => 'android.permission.FOREGROUND_SERVICE_' + t.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase()).filter(p => !an.permissions.includes(p));
        const untyped = svc.filter(x => !x.fgsType && !x.permission).map(x => x.name);
        const hasTypePerm = an.permissions.some(p => /FOREGROUND_SERVICE_[A-Z]/.test(p));
        if (missingPerm.length || (!typed.length && (untyped.length || !hasTypePerm))) add('fgsType', 'warn', 'android', 'info', { services: untyped.join(', ') || '—', perms: [...new Set(missingPerm)].join(', ') || '—' });
      }
      if (an.permissions.includes('android.permission.USE_EXACT_ALARM') && !(A.policy && A.policy.alarm)) add('exactAlarm', 'warn', 'android', 'info');
      if ((an.services || []).some(x => /BIND_ACCESSIBILITY_SERVICE/.test(x.permission || ''))) add('accessibilityService', 'block', 'android', 'info');
      const bigMB = Math.round((A.largeFiles || []).reduce((n, f) => n + f.size, 0) / 1048576);
      if (bigMB >= 150) add('largeAssets', 'warn', 'android', 'info', { mb: bigMB, files: A.largeFiles.slice(0, 3).map(f => f.path + ' (' + Math.round(f.size / 1048576) + ' MB)').join(', ') });
      if (an.permissions.some(p => /^android\.permission\.health\./.test(p))) add('healthConnect', 'warn', 'android', 'info', { perms: an.permissions.filter(p => /^android\.permission\.health\./.test(p)).map(p => p.replace('android.permission.health.', '')).join(', ') });
      if (s.ads || an.adId) add('adsDeclare', 'warn', 'android', 'declare');
      else if (A.adsHint) add('adsCodeOnly', 'tip', 'both', 'info', { files: A.adsHint.files.join(', ') });
      add('closedTest', 'tip', 'android', 'info', { testers: 12, days: 14 });
    }
    const R = A.review || {};
    if (s.auth && !R.deletionInApp && R.deletionConfidence !== 'uncertain') add('accountDeletion', 'block', 'both', 'gen-deletion');
    if (s.auth && !R.deletionInApp && R.deletionConfidence === 'uncertain') add('accountDeletionUnsure', 'check', 'both', 'gen-deletion');
    if (s.location && R.locationSent && R.locationConfidence === 'uncertain') add('locationConfirm', 'check', 'both', 'info');
    if (!A.developer.policyFound) add('privacyPolicy', 'block', 'both', 'gen-privacy');
    // Support URL: a page where an official contact method is visible right away (Guideline 1.5)
    if (R.supportNoContact) add('supportNoContact', 'block', 'both', 'info', { file: R.supportPage });
    if (R.supportUrlHome) add('supportUrlHome', 'warn', io ? 'ios' : 'both', 'info', { url: R.supportUrl });
    if (!A.developer.email) add('supportContact', 'warn', 'both', 'info');
    if (R.adsInCopy && R.adsInCopy.length) add('adsInCopy', 'warn', 'both', 'info', { files: R.adsInCopy.join(', ') });
    /* 0.2.5: policy areas and SDK combinations with their own store rules */
    if (s.ads && !s.consent) add('adsConsent', 'warn', 'both', 'info');
    if (s.subscriptions && !R.terms) add('subscriptionTerms', 'warn', 'both', 'info');
    const P2 = A.policy || {};
    if (P2.loans) add('loanPolicy', 'warn', 'both', 'info');
    if (P2.gambling) add('gambling', 'warn', 'both', 'info');
    const vpnAnd = an && (an.services || []).some(x => /BIND_VPN_SERVICE/.test(x.permission || '')), vpnIos = io && io.vpnEntitlement;
    if (vpnAnd || vpnIos) add('vpnService', 'warn', vpnAnd && vpnIos ? 'both' : vpnAnd ? 'android' : 'ios', 'info');
    const ugc = (A.categories && A.categories[0] === 'social' && (s.cloudDb || s.auth)) || P2.aiChat;
    if (ugc && !R.moderation) add('ugcModeration', 'warn', 'both', 'info', { kind: P2.aiChat ? 'AI' : 'UGC' });
    if (io) {
      for (const [k, v] of Object.entries(io.usage)) if (!String(v).trim()) add('emptyUsage', 'block', 'ios', 'patch-plist', { key: k });
      /* 0.2.4: camera, location, contacts and microphone purpose strings, from what the iOS app itself uses. Expo without an ios/ folder is
         skipped: Expo's config plugins add a default purpose string for its own modules at build time. */
      const need = A.iosNeeds || { camera: s.camera }, U = io.usage;
      if (!(A.framework === 'expo' && !io.plistPath)) {
        if (need.camera && !('NSCameraUsageDescription' in U)) add('missingUsage', 'block', 'ios', 'patch-plist', { key: 'NSCameraUsageDescription' });
        if (need.location && !('NSLocationWhenInUseUsageDescription' in U) && !('NSLocationAlwaysAndWhenInUseUsageDescription' in U)) add('missingUsage', 'block', 'ios', 'patch-plist', { key: 'NSLocationWhenInUseUsageDescription' });
        if (need.contacts && !('NSContactsUsageDescription' in U)) add('missingUsage', 'block', 'ios', 'patch-plist', { key: 'NSContactsUsageDescription' });
        if (need.mic && !('NSMicrophoneUsageDescription' in U)) add('missingUsage', 'block', 'ios', 'patch-plist', { key: 'NSMicrophoneUsageDescription' });
        if (need.health && !('NSHealthShareUsageDescription' in U) && !('NSHealthUpdateUsageDescription' in U)) add('missingUsage', 'block', 'ios', 'patch-plist', { key: 'NSHealthShareUsageDescription' });
      }
      if (!io.privacyManifest) add('privacyManifest', 'block', 'ios', 'gen-xcprivacy');
      /* Tracking: ATT usage string, ATT prompt in code, PrivacyInfo (NSPrivacyTracking + domains), the App Privacy form and
         runtime ad requests must tell one story from the first submit. Default and recommended: no tracking + npa=1.
         Never recommend "has ads → add ATT". */
      const tr = tracking(A);
      if (tr.state === 'mixed') {
        add('trackingMismatch', 'block', 'ios', 'choose-tracking', { found: tr.found.join(', '), missing: tr.missing.join(', ') });
        if (R.manifestTracking && !R.trackingDomains) add('itms91064', 'block', 'ios', 'info');
        if (R.attString && !R.attCode) add('attNoPrompt', 'block', 'ios', 'info');
      } else if (tr.state === 'tracking') add('trackingAligned', 'warn', 'ios', 'info');
      else if ((s.ads || io.gad) && !R.npa) add('adsNpa', 'warn', 'ios', 'choose-tracking');
      else if (s.ads || io.gad) add('adsNpaOk', 'tip', 'ios', 'info');
      /* 0.2.5: attribution SDKs read the IDFA / fingerprint unless configured otherwise: declare tracking (ATT) or turn IDFA collection off */
      if (tr.state === 'none' && s.attribution) add('trackingSdk', 'warn', 'ios', 'info');
      if (R.remoteAds) add('remoteAds', 'warn', 'both', 'info');
      if (s.thirdPartyLogin && !s.appleSignIn) add('loginOption', 'block', 'ios', 'choose-login');
      if (s.auth && R.loginGate) add('loginGate', 'warn', 'ios', 'info');
      if (s.auth) add('demoAccount', 'tip', 'ios', 'info');
      if (R.androidOnlySecrets && !R.iosKeychain) add('iosSecretStorage', 'block', 'ios', 'info');
      if (R.byok) add('byok', 'warn', 'ios', 'info');
      if (io.encryption === undefined && io.plistPath) add('encryption', 'warn', 'ios', 'patch-plist-encryption');
      if (io.ipad) add('ipadShots', 'warn', 'ios', 'info');
      if (R.carplay && !io.carplayEntitlement) add('carplay', 'warn', 'ios', 'info');
      if (R.freeInMeta && R.freeInMeta.length) add('freeInMeta', 'warn', 'ios', 'info', { files: R.freeInMeta.join(', ') });
      if (R.androidInIosMeta && R.androidInIosMeta.length) add('androidInIosCopy', 'warn', 'ios', 'info', { files: R.androidInIosMeta.join(', ') });
      if (io.deploymentNum && io.deploymentNum < 15) add('iosDeployment', 'tip', 'ios', 'info', { cur: io.deployment });
      add('iosSdk', 'tip', 'ios', 'info', { sdk: IOS_SDK_NOTE });
    }
    if (!A.icon) add('noIcon', 'warn', 'both', 'gen-icon');
    /* 0.2.4: an app for children with ads or analytics: Families-certified ad SDKs only, no advertising ID; Apple Kids apps allow no third-party ads or analytics */
    if (A.kids && (s.ads || s.analytics || (an && an.adId))) add('kidsPolicy', 'warn', 'both', 'info', { sdks: [s.ads && 'ads', s.analytics && 'analytics'].filter(Boolean).join(', ') });
    if (!an && A.adsHint) add('adsCodeOnly', 'tip', 'both', 'info', { files: A.adsHint.files.join(', ') });
    /* 0.2.3: pixel results come from the MCP server (A.iconCheck); the web app has none and skips these. */
    const ic = A.iconCheck;
    if (ic) {
      for (const k of ['ios', 'android']) if (ic[k] && ic[k].blank) add('iconBlank', 'warn', k, 'gen-icon', { file: ic[k].path, color: ic[k].average_color });
      /* 0.2.4: the App Store icon must be opaque (ITMS-90717: no transparency) */
      if (ic.ios && !ic.ios.blank && ic.ios.transparent_share > 0.001) add('iconAlpha', 'warn', 'ios', 'info', { file: ic.ios.path, share: Math.round(ic.ios.transparent_share * 100) });
      if (ic.match && !ic.match.similar) add('iconMismatch', 'warn', 'both', 'info', { ios: ic.ios.path, android: ic.android.path, dist: ic.match.hash_distance });
    }
    if (A.listing && A.listing.privacyConflict) add('privacyUrlConflict', 'warn', 'both', 'info', { urls: A.listing.privacyCandidates.map(c => c.url + ' (' + c.file + ')').join(', ') });
    if (A.listing && A.listing.privacyDead) add('privacyUrlDead', 'check', 'both', 'info', { url: A.listing.privacyUrl });
    if (A.listing && A.listing.privacyUnverified) {
      const ck = ((A.listing.privacyCandidates || []).find(c => c.url === A.listing.privacyUrl) || {}).check || {};
      add('privacyUrlUnverified', 'check', 'both', 'info', { url: A.listing.privacyUrl, status: ck.status != null ? String(ck.status) : (ck.error || 'unknown') });
    }
    if (A.listing && A.listing.privacyWeak) add('privacyUrlUnsure', 'check', 'both', 'info', { urls: A.listing.privacyCandidates.map(c => c.url + ' (' + c.file + ')').join(', ') });
    if (!A.screenshots.length) add('noShots', 'warn', 'both', 'info');
    /* 0.2.6: a privacy page (often a copy bundled inside the app) that names another package or operator */
    (A.privacyPages || []).filter(x => x.stale && x.stale.length && !x.old).slice(0, 3).forEach(x => add('privacyStale', 'warn', 'both', 'info', { file: x.path + (x.bundled ? ' (bundled in the app)' : ''), why: x.stale.join('; ') }));
    if (A.appName && A.appName.length > 30) add('longName', 'warn', 'both', 'choose-name', { len: A.appName.length });
    const order = { block: 0, warn: 1, check: 2, tip: 3 };
    return out.sort((a, b) => (order[a.sev] ?? 9) - (order[b.sev] ?? 9));
  }

  /* Tracking state of the iOS app: 'none' (no tracking anywhere), 'tracking' (ATT string + ATT prompt + PrivacyInfo tracking + domains
     all present) or 'mixed' (some but not all — the state that causes ITMS-91064 or a Guideline 2.1 rejection). */
  function tracking(A) {
    const R = A.review || {};
    const parts = [['NSUserTrackingUsageDescription', !!R.attString], ['ATT prompt in code', !!R.attCode], ['NSPrivacyTracking=true', !!R.manifestTracking], ['NSPrivacyTrackingDomains', R.trackingDomains > 0]];
    if (R.usesIdfa === true || R.usesIdfa === false) parts.push(['usesIdfa=true', R.usesIdfa === true]);
    const found = parts.filter(p => p[1]).map(p => p[0]), missing = parts.filter(p => !p[1]).map(p => p[0]);
    const state = !found.length ? 'none' : !missing.length ? 'tracking' : 'mixed';
    return { state, found, missing };
  }

  function score(A) {
    const blocks = A.issues.filter(i => i.sev === 'block').length, warns = A.issues.filter(i => i.sev === 'warn').length, checks = A.issues.filter(i => i.sev === 'check').length;
    /* Unverified risky passes (needs-confirmation) are not treated as a clean pass. */
    A.readiness = Math.max(18, Math.min(96, 100 - blocks * 9 - warns * 4 - checks * 3 - (A.icon ? 0 : 6) - (A.screenshots.length ? 0 : 6)));
    return A.readiness;
  }
  function refreshIssues(A) { A.issues = checks(A); score(A); return A; }

  window.RLAnalyzer = { analyze, tracking, PLAY_TARGET, score, refreshIssues, catKey };

})();
