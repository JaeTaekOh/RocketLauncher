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
    const name = String(raw).replace(/^(rootProject\.ext\.|project\.ext\.|rootProject\.|project\.|ext\.)/, '').replace(/\.get$/, '');
    if (!/^[A-Za-z_][\w]*$/.test(name)) return null;
    const re = new RegExp('(?:^|[\\s{;.,(])' + name + '\\s*(?:=|:)?\\s*["\']?(\\d{2})\\b', 'm');
    const texts = gradles.map(p => F[p].text).concat(find(F, /(^|\/)gradle\.properties$/).map(p => F[p].text));
    for (const t of texts) { const m = t.match(re); if (m) return +m[1]; }
    return null;
  }
  const LISTING_LANG = l => { const x = String(l).toLowerCase(); return x.startsWith('en') ? 'en' : x.startsWith('ko') ? 'ko' : x.startsWith('th') ? 'th' : x.startsWith('zh') ? 'zh' : x.startsWith('hi') ? 'hi' : null; };
  /* 0.1.5: evidence that the app already has a store listing (store URLs, fastlane metadata, version history) and existing listing copy. */
  function listingOf(F, A) {
    const P = Object.keys(F), texts = P.filter(p => F[p].text != null && !F[p].code), all = texts.map(p => F[p].text).join('\n').slice(0, 800000);
    const L = { play: { evidence: [], copy: {} }, apple: { evidence: [], copy: {} }, privacyUrl: null, supportUrl: null };
    const pm = all.match(/play\.google\.com\/store\/apps\/details\?id=([\w.]+)/i);
    if (pm) { L.play.evidence.push('play-url'); L.play.url = 'https://play.google.com/store/apps/details?id=' + pm[1]; }
    const am = all.match(/(?:apps|itunes)\.apple\.com\/[^\s"'<>)]*?\/?id(\d{6,12})/i);
    if (am) { L.apple.evidence.push('apple-url'); L.apple.appId = am[1]; L.apple.url = 'https://apps.apple.com/app/id' + am[1]; }
    const rd = (p) => (F[p] && F[p].text || '').trim();
    for (const p of texts) {
      let m = p.match(/(?:^|\/)fastlane\/metadata\/android\/([^/]+)\/(title|short_description|full_description)\.txt$/i);
      if (m) { const l = LISTING_LANG(m[1]); if (l && rd(p)) { (L.play.copy[l] = L.play.copy[l] || {})[{ title: 'title', short_description: 'short', full_description: 'full' }[m[2].toLowerCase()]] = rd(p); } continue; }
      m = p.match(/(?:^|\/)fastlane\/metadata\/(?!android\/)([^/]+)\/(name|subtitle|description|keywords|privacy_url|support_url)\.txt$/i);
      if (m) {
        const k = m[2].toLowerCase(), v = rd(p);
        if (k === 'privacy_url' && /^https?:\/\//.test(v)) { L.privacyUrl = L.privacyUrl || v; continue; }
        if (k === 'support_url' && /^https?:\/\//.test(v)) { L.supportUrl = L.supportUrl || v; continue; }
        const l = LISTING_LANG(m[1]); if (l && v) (L.apple.copy[l] = L.apple.copy[l] || {})[k] = v;
      }
    }
    if (Object.keys(L.play.copy).length) L.play.evidence.push('fastlane-play');
    if (Object.keys(L.apple.copy).length) L.apple.evidence.push('fastlane-apple');
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
  const PRIV_URL_RE = /https?:\/\/[^\s"'<>)\]\\]*(privacy|개인정보|policy)[^\s"'<>)\]\\]*/gi;
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
    const out = []; const re = /(?:implementation|api|kapt|ksp)\s*\(?\s*(?:platform\()?\s*["']([^"']+)["']/g; let m;
    while ((m = re.exec(g))) out.push(m[1]);
    const re2 = /(?:implementation|api)\s*\(\s*libs\.([\w.]+)/g; while ((m = re2.exec(g))) out.push('libs.' + m[1]);
    return out;
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
    shopping: /\b(shop|shopping|online store|cart|deals?|coupons?|marketplace)\b|쇼핑|ร้านค้า|ช้อป|购物|शॉपिंग/i,
    tools: /\b(calculator|scanner|converter|utility|utilities|qr|flashlight|unit conver\w*|translat\w*|interpret\w*|dictionary|timer|stopwatch)\b|계산기|도구|번역|통역|사전|เครื่องคิดเลข|แปลภาษา|แปล|计算器|工具|翻译|翻譯|词典|कैलकुलेटर|अनुवाद/i,
    /* 0.2.4: music and social apps had no category of their own */
    music: /\b(music|songs?|playlists?|albums?|podcasts?|metronome|tuner|karaoke|lyrics|radio|musicians?|guitar|piano)\b|음악|노래|플레이리스트|เพลง|ดนตรี|音乐|歌曲|संगीत|गाना|गाने/i,
    social: /\b(social|friends?|chat|chatting|messag(e|es|ing)|posts?|feeds?|comments?|community|followers?|meet new people)\b|친구|채팅|커뮤니티|게시글|เพื่อน|แชท|ชุมชน|社交|好友|聊天|社区|दोस्त|चैट|सोशल/i,
    games: /\b(game|games|puzzle|arcade|high ?score)\b|게임|เกม|游戏|गेम/i,
    lifestyle: /\b(lifestyle|diary|habits?|daily)\b|일기|습관|ไลฟ์สไตล์|生活|日记|आदत/i
  };
  /* When only one category is clear, the second suggestion is a close neighbour (not always Productivity). */
  const CAT_NEXT = { navigation: 'travel', travel: 'navigation', finance: 'productivity', health: 'lifestyle', education: 'productivity', productivity: 'tools', photography: 'tools', food: 'lifestyle', shopping: 'lifestyle', tools: 'productivity', games: 'education', lifestyle: 'productivity', music: 'lifestyle', social: 'lifestyle' };

  function analyze(project) {
    const F = project.files; const P = Object.keys(F);
    const A = { name: project.name, source: project.source, fileCount: project.fileCount || P.length, read: [], android: null, ios: null, framework: 'unknown', platforms: { android: false, ios: false }, strings: {}, names: {}, sdk: {}, issues: [] };
    const note = p => p && A.read.push(p);

    // ---------- 프레임워크 ----------
    const pubspec = shortest(find(F, /(^|\/)pubspec\.yaml$/)), pkgJson = shortest(find(F, /(^|\/)package\.json$/)), appJson = shortest(find(F, /(^|\/)app\.json$/)), capCfg = shortest(find(F, /capacitor\.config\.(json|ts|js)$/));
    const pkg = (() => { try { return JSON.parse(txt(F, pkgJson)); } catch (e) { return null; } })();
    const deps = pkg ? Object.keys({ ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }) : [];
    if (pubspec) A.framework = 'flutter';
    else if (deps.includes('expo')) A.framework = 'expo';
    else if (deps.includes('react-native')) A.framework = 'react-native';
    else if (capCfg || deps.some(d => d.startsWith('@capacitor/'))) A.framework = 'capacitor';
    /* 0.2.4: Cordova (config.xml <widget>, package.json "cordova"), Bubblewrap TWA (twa-manifest.json) and Kotlin Multiplatform */
    const cdvPath = shortest(find(F, /(^|\/)config\.xml$/).filter(p => !/(^|\/)res\/xml\//.test(p) && /<widget\b/.test(F[p].text)));
    const cdv = cdvPath ? cordovaOf(F[cdvPath].text, pkg) : null;
    const twaPath = shortest(find(F, /(^|\/)twa-manifest\.json$/));
    const kmp = find(F, /\.gradle(\.kts)?$/).some(p => /kotlin\(\s*["']multiplatform["']\s*\)|org\.jetbrains\.kotlin\.multiplatform|libs\.plugins\.kotlin[.-]?[mM]ultiplatform/.test(stripCode(F[p].text)));
    if (A.framework === 'unknown') A.framework = cdv || deps.includes('cordova-android') || deps.includes('cordova-ios') || (pkg && pkg.cordova) ? 'cordova' : twaPath ? 'twa' : kmp ? 'kmp' : 'unknown';
    [pubspec, pkgJson, appJson, capCfg, cdvPath, twaPath].forEach(note);
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
    const appGradle = gradles.find(p => /com\.android\.application|id\s*\(?["']com\.android\.application|alias\(\s*libs\.plugins\.android[.-]?[aA]pplication\s*\)/.test(stripCode(F[p].text))) || gradles.find(p => /(^|\/)app\/build\.gradle/.test(p));
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
    if (manPath || appGradle || (expo && (expo.android || expoPlat.includes('android'))) || (cdv && cdv.android)) {
      A.platforms.android = true; if (A.framework === 'unknown') A.framework = 'android-native';
      const an = { permissions: [], features: [], activities: [], deps: [], cleartext: false, debuggable: false, allowBackup: null, adId: false, adsAppId: null };
      if (manPath) {
        note(manPath); const d = parseXml(F[manPath].text);
        if (d) {
          an.manifestPackage = d.documentElement.getAttribute('package');
          d.querySelectorAll('uses-permission, uses-permission-sdk-23').forEach(n => an.permissions.push(aAttr(n, 'name')));
          d.querySelectorAll('uses-feature').forEach(n => an.features.push(aAttr(n, 'name')));
          d.querySelectorAll('activity').forEach(n => an.activities.push(aAttr(n, 'name')));
          const app = d.querySelector('application');
          if (app) { an.label = aAttr(app, 'label'); an.cleartext = aAttr(app, 'usesCleartextTraffic') === 'true'; an.debuggable = aAttr(app, 'debuggable') === 'true'; an.allowBackup = aAttr(app, 'allowBackup'); an.iconRef = aAttr(app, 'icon'); }
          d.querySelectorAll('meta-data').forEach(n => { if (/ads\.APPLICATION_ID/.test(aAttr(n, 'name') || '')) an.adsAppId = aAttr(n, 'value'); });
        }
      }
      if (appGradle) {
        note(appGradle); const g = stripCode(F[appGradle].text);
        an.pkg = gradleVal(g, 'applicationId'); an.namespace = gradleVal(g, 'namespace');
        an.targetSdkRaw = gradleVal(g, 'targetSdk');
        an.minSdk = resolveSdk(gradleVal(g, 'minSdk'), F, gradles); an.targetSdk = resolveSdk(an.targetSdkRaw, F, gradles); an.compileSdk = resolveSdk(gradleVal(g, 'compileSdk'), F, gradles);
        an.versionCode = gradleVal(g, 'versionCode'); an.versionName = gradleVal(g, 'versionName'); an.deps = gradleDeps(g); an.gradlePath = appGradle;
        an.gradleKts = /\.kts$/.test(appGradle);
      }
      const toml = shortest(find(F, /libs\.versions\.toml$/)); if (toml) { note(toml); an.deps.push(...(F[toml].text.match(/module\s*=\s*"([^"]+)"/g) || []).map(s => s.replace(/.*"([^"]+)"/, '$1'))); }
      if (toml) { // libs.versions.targetSdk 같은 버전 카탈로그 값 풀기
        const tv = F[toml].text; const ver = k => { const m = tv.match(new RegExp('^\\s*' + k.replace(/[.\-]/g, '[.\\-_]?') + '\\s*=\\s*"?(\\d+)"?', 'mi')); return m ? +m[1] : null; };
        for (const k of ['minSdk', 'targetSdk', 'compileSdk']) if (!an[k] && appGradle) { const m = F[appGradle].text.match(new RegExp(k + '(?:Version)?\\s*=?\\s*libs\\.versions\\.([\\w.]+?)\\.get')); const v = m ? ver(m[1]) : ver(k) || ver(k.replace('Sdk', '-sdk')) || ver(k.replace('Sdk', '_sdk')); if (v) an[k] = v; }
      }
      if (expo && expo.android) { an.pkg = an.pkg || expo.android.package; an.permissions.push(...(expo.android.permissions || [])); an.versionCode = an.versionCode || expo.android.versionCode; }
      if (expo) for (const k of ['minSdk', 'targetSdk', 'compileSdk']) if (!an[k] && expoBP[k]) an[k] = expoBP[k];
      if (cdv) { an.pkg = an.pkg || cdv.androidId; an.versionName = an.versionName || cdv.version; an.versionCode = an.versionCode || cdv.versionCode; an.targetSdk = an.targetSdk || cdv.targetSdk; an.minSdk = an.minSdk || cdv.minSdk; if (!an.targetSdk) an.targetSdkRaw = an.targetSdkRaw || 'cordova-android default'; }
      /* Gradle values that only point somewhere else (flutter.versionName, flutterVersionCode.toInteger(), a variable) are resolved or left unread. */
      if (an.versionName != null && !/^\d/.test(String(an.versionName))) an.versionName = /flutter/i.test(an.versionName) && pubVer ? pubVer[1] : null;
      if (an.versionCode != null && !/^\d+$/.test(String(an.versionCode))) an.versionCode = /flutter/i.test(an.versionCode) && pubVer ? (pubVer[2] || null) : null;
      an.pkg = an.pkg || an.manifestPackage || an.namespace || null;
      an.permissions = [...new Set(an.permissions.filter(Boolean).map(p => p.startsWith('android.permission.') || p.includes('.') ? p : 'android.permission.' + p))];
      an.adId = an.permissions.includes('com.google.android.gms.permission.AD_ID');
      an.manifestPath = manPath;
      A.android = an;
    }

    // ---------- iOS ----------
    const plists = find(F, /(^|\/)Info\.plist$/).filter(p => !/(Tests?|Pods|\.framework)\//.test(p));
    const plistPath = plists.find(p => /ios\/Runner\//.test(p)) || shortest(plists);
    const pbx = shortest(find(F, /project\.pbxproj$/));
    if (plistPath || pbx || (expo && (expo.ios || expoPlat.includes('ios'))) || (cdv && cdv.ios)) {
      A.platforms.ios = true; if (A.framework === 'unknown' || A.framework === 'android-native') A.framework = A.platforms.android ? A.framework : 'ios-native';
      const io = { usage: {}, plistPath };
      if (plistPath) { note(plistPath); const pl = parsePlist(F[plistPath].text); io.plist = pl; io.displayName = pl.CFBundleDisplayName || pl.CFBundleName; for (const k in pl) if (/^NS\w+UsageDescription$/.test(k)) io.usage[k] = String(pl[k] || ''); io.gad = pl.GADApplicationIdentifier || null; }
      if (pbx) { note(pbx); const t = F[pbx].text; const g = k => (t.match(new RegExp(k + '\\s*=\\s*"?([^";]+)"?;')) || [])[1] || null; io.bundleId = g('PRODUCT_BUNDLE_IDENTIFIER'); io.version = g('MARKETING_VERSION'); io.build = g('CURRENT_PROJECT_VERSION'); io.deployment = g('IPHONEOS_DEPLOYMENT_TARGET'); }
      if (pbx) { const fam = (F[pbx].text.match(/TARGETED_DEVICE_FAMILY\s*=\s*"?([\d,]+)"?;/g) || []).join(' '); io.ipad = /[",=\s]2\b/.test(fam); }
      if (io.plist) { if (io.plist['UISupportedInterfaceOrientations~ipad']) io.ipad = true; if (io.plist.ITSAppUsesNonExemptEncryption !== undefined) io.encryption = io.plist.ITSAppUsesNonExemptEncryption; }
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
    A.appName = A.names.en || (A.ios && A.ios.displayName) || (expo && expo.name) || (cdv && cdv.name) || (pkg && (pkg.displayName || pkg.name)) || rm.title || project.name;
    if (!A.names.en) A.names.en = A.appName;
    A.tagline = { };
    for (const [lang, s] of Object.entries(A.strings)) { const t = s.tagline || s.app_tagline || s.slogan || s.app_description; if (t) A.tagline[lang === 'default' ? 'en' : lang] = t; }
    if (!A.tagline.en && project.meta && project.meta.description) A.tagline.en = project.meta.description;
    if (!A.tagline.en && rm.summary) A.tagline.en = rm.summary.split(/(?<=\.)\s/)[0].replace(/\.$/, '');
    /* 0.2.4: also locale files of JS / native apps (locales/ko.json, i18n/th.json, ko.lproj/Localizable.strings) */
    const fileLocales = P.map(p => (p.match(/(?:^|\/)(?:locales?|i18n|lang|langs|translations|l10n)\/([a-z]{2})(?:[-_][A-Za-z]{2,4})?\.json$/i) || p.match(/(?:^|\/)([a-z]{2})(?:[-_][A-Za-z]{2,4})?\.lproj\//i) || [])[1]).filter(Boolean).map(l => l.toLowerCase());
    A.locales = [...new Set(Object.keys(A.strings).map(l => l === 'default' ? 'en' : l).concat(fileLocales))];
    A.pkg = (A.android && A.android.pkg) || (A.ios && A.ios.bundleId) || null;
    A.version = (A.android && A.android.versionName) || (A.ios && A.ios.version) || (expo && expo.version) || (pubVer && pubVer[1]) || (cdv && cdv.version) || (pkg && pkg.version) || '1.0.0';

    // ---------- 연락처 ----------
    const lic = txt(F, shortest(find(F, /(^|\/)LICENSE/i)));
    const holder = (lic.match(/Copyright\s*(?:\(c\)|©)?\s*\d{4}(?:-\d{4})?\s+(.+)/i) || [])[1];
    const allText = Object.values(F).filter(v => v.text && !v.code).map(v => v.text).join('\n').slice(0, 600000);
    const email = (allText.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) || []).find(e => !/noreply|example\.com|users\.noreply|android\.com|apple\.com|googlegroups/.test(e));
    A.listing = listingOf(F, A);
    A.developer = { name: (holder || (project.meta && project.meta.owner) || '').trim() || null, email: email || null, policyFound: !!find(F, /privacy[^/]*\.(md|html)$/i).filter(p => !OLD_RE.test(p)).length || !!A.listing.privacyUrl, privacyUrl: A.listing.privacyUrl || null };

    // ---------- SDK ----------
    /* 0.2.4: comments do not count (a "// TODO: add Firebase Analytics" line is not analytics) */
    const codeHay = Object.keys(F).filter(p => F[p].code).map(p => stripCode(F[p].text)).join('\n').slice(0, 1500000);
    const pluginHay = txt(F, shortest(find(F, /capacitor\.plugins\.json$/))) + '\n' + txt(F, shortest(find(F, /capacitor\.config\.(json|ts|js)$/))) + '\n' + txt(F, shortest(find(F, /google-services\.json$/)));
    const hay = [(A.android && A.android.deps.join(' ')) || '', deps.join(' '), pubspecDeps(txt(F, pubspec)), stripHashComments(txt(F, shortest(find(F, /Podfile$/)))), txt(F, plistPath), (A.android && A.android.permissions.join(' ')) || '', JSON.stringify((A.ios && A.ios.usage) || {}), pluginHay, codeHay].join(' ');
    const Det = window.RLDetect;
    /* 0.2.3: an ad SDK counts only when it is really declared: Gradle / version-catalog dependencies, package.json dependencies, pubspec,
       Podfile / Package.swift, installed Capacitor/Cordova plugins, the AndroidManifest ads APPLICATION_ID meta-data or Info.plist
       GADApplicationIdentifier. A name that only appears in app code (a config placeholder, a comment, a bundled script) is a hint, not ads. */
    const AD_RE = /play-services-ads|google_mobile_ads|google-mobile-ads|\badmob\b|capacitor[\w-]*admob|admob-plus|Google-Mobile-Ads|GoogleMobileAds|GADApplicationIdentifier|applovin|unity-?ads|audience-network|FBAudienceNetwork|ironsource|chartboost|vungle|inmobi|mintegral|pangle/i;
    const declHay = [(A.android && A.android.deps.join(' ')) || '', deps.join(' '), pubspecDeps(txt(F, pubspec)), stripHashComments(txt(F, shortest(find(F, /Podfile$/)))), txt(F, shortest(find(F, /(^|\/)Package\.swift$/))),
      txt(F, shortest(find(F, /capacitor\.plugins\.json$/))), txt(F, shortest(find(F, /(^|\/)cordova_plugins\.js$/))), cdvPath ? [...txt(F, cdvPath).matchAll(/<plugin\s+name="([^"]+)"/g)].map(m => m[1]).join(' ') : ''].join(' ');
    const IAP_DECL = /com\.android\.billingclient|com\.android\.vending\.BILLING|\bin_app_purchase\b|flutter_inapp_purchase|purchases_flutter|react-native-iap|expo-iap|expo-in-app-purchases|react-native-purchases|@revenuecat|\bRevenueCat\b|cordova-plugin-purchase|capacitor[\w-]*(in-app-purchase|purchases?)\b|@capacitor-community\/in-app-purchases?|SwiftyStoreKit|\bpod\s+['"]Purchases['"]/i;
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
    /* 0.2.4: what the iOS build itself uses (cross-platform plugins, iOS / web code; Android-only Kotlin/Java and manifest permissions excluded),
       so an iOS purpose string is only required when the iOS app really asks for that permission. */
    if (A.ios) {
      const iosCode = Object.keys(F).filter(p => F[p].code && !/\.(kt|java)$/i.test(p)).map(p => stripCode(F[p].text)).join('\n').slice(0, 1500000);
      const iosHay = [deps.join(' '), pubspecDeps(txt(F, pubspec)), stripHashComments(txt(F, shortest(find(F, /Podfile$/)))), txt(F, shortest(find(F, /(^|\/)Package\.swift$/))), pluginHay, declHay, iosCode].join('\n');
      A.iosNeeds = {
        location: /\bgeolocator\b|(^|\s)location:\s|@capacitor\/geolocation|expo-location|react-native-geolocation|@react-native-community\/geolocation|cordova-plugin-geolocation|CLLocationManager|requestWhenInUseAuthorization|requestAlwaysAuthorization|navigator\s*\.\s*geolocation|getCurrentPosition|watchPosition/.test(iosHay),
        camera: /\bimage_picker\b|(^|\s)camera:\s|expo-camera|expo-image-picker|react-native-vision-camera|react-native-image-picker|react-native-camera|@capacitor\/camera|cordova-plugin-camera|mobile_scanner|AVCaptureDevice|AVCaptureSession|UIImagePickerController/.test(iosHay),
        contacts: /flutter_contacts|contacts_service|expo-contacts|react-native-contacts|@capacitor-community\/contacts|cordova-plugin-contacts|CNContactStore|import\s+Contacts\b/.test(iosHay),
        mic: /flutter_sound|speech_to_text|(^|\s)record:\s|react-native-voice|@react-native-voice|AVAudioRecorder|SFSpeechRecognizer|@capacitor-community\/speech-recognition|cordova-plugin-media-capture/.test(iosHay)
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
    const cfgCat = A.projectConfig && A.projectConfig.category && String(A.projectConfig.category).toLowerCase().replace(/[^a-z]/g, '');
    if (cfgCat && CATS[cfgCat]) A.categories = [cfgCat, ...A.categories.filter(c => c !== cfgCat)];
    if (!A.categories.length) A.categories = ['tools'];
    if (A.categories.length < 2) A.categories.push(CAT_NEXT[A.categories[0]] || 'productivity');
    A.categories = A.categories.slice(0, 3);

    /* 0.2.4: apps aimed at children (Google Play Families policy, App Store Kids category rules) */
    const kidsText = [rm.title, A.appName, rm.summary, rm.features.join(' '), ...Object.values(A.tagline)].join(' ');
    A.kids = /\b(kids?|children|toddlers?|preschool\w*|kindergarten|babies|little ones|ages? [2-9]\s*(-|to|–)\s*\d+)\b|어린이|유아|아이들|키즈|เด็กเล็ก|สำหรับเด็ก|儿童|孩子|幼儿|बच्चों|बच्चे/i.test(kidsText) && !/\bnot (for|directed (at|to)|meant for) (kids|children)\b/i.test(kidsText);

    // ---------- 그림 ----------
    const imgs = P.filter(p => F[p].dataUrl);
    const iconPath = imgs.find(p => /playstore/i.test(p)) || imgs.find(p => /AppIcon.*(1024|512@2x)/i.test(p)) || imgs.find(p => /mipmap-xxxhdpi\/ic_launcher\./i.test(p)) || imgs.find(p => /ic_launcher\./i.test(p)) || imgs.find(p => /AppIcon/i.test(p)) || imgs.find(p => /(^|\/)(icon|app-icon|appicon|logo)\.png$/i.test(p));
    A.icon = iconPath ? { path: iconPath, dataUrl: F[iconPath].dataUrl } : null;
    /* 0.2.3: the iOS and the Android icon separately, so a blank icon or two different icons can be flagged (pixels are checked by the MCP server) */
    A.icons = iconsByPlatform(F, imgs);
    A.screenshots = imgs.filter(p => /(screenshots?|phoneScreenshots|store)\//i.test(p)).sort().slice(0, 8).map(p => ({ path: p, dataUrl: F[p].dataUrl }));
    const colors = txt(F, shortest(find(F, /res\/values\/colors\.xml$/)));
    const cm = colors.match(/name="(?:brand|primary|colorPrimary|purple_500|accent)[^"]*"\s*>\s*#(?:FF)?([0-9a-f]{6})\b/i) || colors.match(/#(?:FF)?([0-9a-f]{6})\b/i);
    A.brandColor = cm ? '#' + cm[1].toLowerCase() : null;

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
    if (A.listing && A.listing.privacyWeak) add('privacyUrlUnsure', 'check', 'both', 'info', { urls: A.listing.privacyCandidates.map(c => c.url + ' (' + c.file + ')').join(', ') });
    if (!A.screenshots.length) add('noShots', 'warn', 'both', 'info');
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

  window.RLAnalyzer = { analyze, tracking, PLAY_TARGET, score, refreshIssues };

})();
