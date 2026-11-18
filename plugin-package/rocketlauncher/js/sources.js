/* Rocket Launcher — 앱 프로젝트 가져오기: 샘플 / GitHub 공개 저장소 / ZIP / 폴더
   결과: { name, source, files: { [path]: { text } | { dataUrl } } }
   모든 파일은 브라우저 안에서만 읽고, 어디에도 올리지 않는다. */
(function () {
  'use strict';
  const TEXT_RE = [
    /(^|\/)AndroidManifest\.xml$/i, /\.gradle(\.kts)?$/i, /(^|\/)gradle\.properties$/i, /(^|\/)libs\.versions\.toml$/i,
    /(^|\/)res\/values[^/]*\/(strings|colors|themes)\.xml$/i,
    /(^|\/)Info\.plist$/i, /project\.pbxproj$/i, /PrivacyInfo\.xcprivacy$/i, /\.entitlements$/i, /(^|\/)Podfile$/i, /(^|\/)Package\.swift$/i,
    /(^|\/)pubspec\.yaml$/i, /(^|\/)package\.json$/i, /(^|\/)app\.json$/i, /(^|\/)app\.config\.(js|ts)$/i, /(^|\/)capacitor\.config\.(json|ts|js)$/i, /(^|\/)capacitor\.plugins\.json$/i,
    /(^|\/)eas\.json$/i, /(^|\/)README(\.[a-z]+)?$/i, /(^|\/)LICENSE(\.[a-z]+)?$/i, /(^|\/)privacy[^/]*\.(md|html)$/i,
    /fastlane\/metadata\/.*\.txt$/i, /(^|\/)fastlane\/(Appfile|Deliverfile)$/i, /(^|\/)variables\.gradle$/i, /AppIcon\.appiconset\/Contents\.json$/i, /(^|\/)lib\/l10n\/.*\.arb$/i,
    /(^|\/)(support|contact)[^/]*\.(md|html?)$/i, /(^|\/)(support|contact)\/index\.(md|html?)$/i,
    /* 0.2.0: release checks (Xcode version hints, CI images, AGP/Gradle versions, deletion / tester pages) */
    /* 0.2.4: Cordova config.xml, Bubblewrap twa-manifest.json, app locale files (locales/ko.json, i18n/th.json, ko.lproj) */
    /(^|\/)config\.xml$/i, /(^|\/)twa-manifest\.json$/i, /(^|\/)(locales?|i18n|lang|langs|translations|l10n)\/[a-z]{2}([-_][A-Za-z]{2,4})?\.json$/i, /(^|\/)[a-z]{2}([-_][A-Za-z]{2,4})?\.lproj\/(Localizable|InfoPlist)\.strings$/i,
    /(^|\/)\.?rocketlauncher\.json$/i, /(^|\/)\.xcode-version$/i, /(^|\/)\.github\/workflows\/[^/]+\.ya?ml$/i, /(^|\/)codemagic\.ya?ml$/i, /(^|\/)gradle-wrapper\.properties$/i,
    /(^|\/)[^/]*(delete|deletion|tester|testing|beta|join|opt-?in)[^/]*\.(html?|md)$/i, /(^|\/)(delete|deletion|delete-account|testers?|beta|join)\/index\.html?$/i,
    /* 0.2.5: Unity, Godot, .NET MAUI and NativeScript project files; saved store rejection notes */
    /(^|\/)ProjectSettings\/ProjectSettings\.asset$/i, /(^|\/)Packages\/manifest\.json$/i, /(^|\/)export_presets\.cfg$/i, /(^|\/)project\.godot$/i, /\.csproj$/i, /(^|\/)nativescript\.config\.[jt]s$/i,
    /(^|\/)[^/]*(reject|rejection|app-?review|review-?notes?|resolution-?center|policy-?violation)[^/]*\.(md|txt)$/i, /(^|\/)(app-?review|review-?notes?|rejections?)\/[^/]+\.(md|txt)$/i
  ];
  /* App source code: read a limited number of files so review checks can see runtime behavior
     (ad request settings, ATT prompt, secret storage, login gate, user-supplied API keys). */
  const CODE_RE = /\.(dart|kt|java|swift|m|mm|ts|tsx|js|jsx|mjs|cjs)$/i;
  const CODE_SKIP_RE = /(^|\/)(test|tests|__tests__|__mocks__|androidTest|spec|e2e|integration_test|third_party|vendor|dist|web|public|scripts|\.expo|\.next)\/|\.(min|test|spec|d)\.[jt]sx?$|(^|\/)[\w.-]+\.config\.[jt]s$/i;
  /* Capacitor / Cordova / Ionic packaged web assets hold the real app logic (often under assets/public or www). */
  const HYBRID_WEB_RE = /(^|\/)(src\/main\/assets(?:\/public)?|android\/app\/src\/main\/assets(?:\/public)?|(?:ios\/)?App\/App\/public|(^|\/)www)\//i;
  const HYBRID_INNER_SKIP = /(^|\/)(test|tests|__tests__|__mocks__|third_party|vendor)\/|\.(min|test|spec|d)\.[jt]sx?$/i;
  const CODE_HINT_RE = /main|app|ad|auth|login|sign|secure|storage|keychain|key|track|privacy|remote|config|setting|account|acct|ai|gemini|llm|chat|location|locate|geo|data|i18n|user|fire|delete|delet|fetch|nearby|car/i;
  const MAX_CODE = 150, MAX_CODE_SIZE = 200 * 1024;
  const IMG_RE = [
    /ic_launcher(_round|_foreground)?\.(png|webp)$/i, /ic_launcher-playstore\.png$/i, /playstore[^/]*\.png$/i,
    /AppIcon\.appiconset\/.*\.png$/i, /(^|\/)(icon|app-icon|appicon|logo)\.png$/i,
    /(^|\/)(screenshots?|fastlane\/metadata\/android\/[^/]+\/images\/phoneScreenshots|store)\/[^/]*\.(png|jpe?g|webp)$/i, /(^|\/)fastlane\/screenshots\/[^/]+\/[^/]*\.(png|jpe?g)$/i
  ];
  const SKIP_RE = /(^|\/)(node_modules|\.git|build|\.gradle|Pods|DerivedData|\.dart_tool|\.idea|intermediates|generated)\//;
  const MAX_TEXT = 400 * 1024, MAX_IMG = 4 * 1024 * 1024, MAX_FILES = 140;
  /* 0.2.0: native libraries (.so) for the Google Play 16 KB page-size check. Only ELF headers are read; nothing is uploaded. */
  const SO_RE = /\.so$/i, NATIVE_SRC_RE = /(^|\/)(CMakeLists\.txt|Android\.mk|Application\.mk)$|(^|\/)src\/main\/(cpp|jni)\//i;
  const NOTABLE_RE = /(^|\/)(google-services\.json|GoogleService-Info\.plist|key\.properties|assetlinks\.json|apple-app-site-association|app-ads\.txt)$|\.(jks|keystore|p12|p8|mobileprovision)$/i;
  const MAX_SO = 12, MAX_SO_SIZE = 40 * 1024 * 1024, LARGE_FILE = 20 * 1024 * 1024;
  /* 0.2.5: text files saved as UTF-16 (with a BOM) or in a legacy 8-bit encoding are decoded instead of becoming mojibake */
  function decodeText(u8) {
    if (u8.length >= 2 && u8[0] === 0xff && u8[1] === 0xfe) return new TextDecoder('utf-16le').decode(u8.subarray(2));
    if (u8.length >= 2 && u8[0] === 0xfe && u8[1] === 0xff) { const sw = new Uint8Array(u8.length - 2); for (let i = 2; i + 1 < u8.length; i += 2) { sw[i - 2] = u8[i + 1]; sw[i - 1] = u8[i]; } return new TextDecoder('utf-16le').decode(sw); }
    const b = u8.length >= 3 && u8[0] === 0xef && u8[1] === 0xbb && u8[2] === 0xbf ? u8.subarray(3) : u8;
    try { return new TextDecoder('utf-8', { fatal: true }).decode(b); } catch (e) { }
    let out = ''; for (let i = 0; i < b.length; i++) out += String.fromCharCode(b[i]); return out;   // Latin-1
  }
  /* Smallest LOAD segment alignment of an ELF file (bytes), its class (32/64) and machine; null if not ELF. */
  function elfAlign(u8) {
    if (!u8 || u8.length < 64 || u8[0] !== 0x7f || u8[1] !== 0x45 || u8[2] !== 0x4c || u8[3] !== 0x46) return null;
    const is64 = u8[4] === 2, le = u8[5] === 1, dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    const r16 = o => dv.getUint16(o, le), r32 = o => dv.getUint32(o, le), r64 = o => Number(dv.getBigUint64(o, le));
    const phoff = is64 ? r64(0x20) : r32(0x1c), phent = r16(is64 ? 0x36 : 0x2a), phnum = r16(is64 ? 0x38 : 0x2c);
    let min = null;
    for (let i = 0; i < phnum && i < 256; i++) {
      const o = phoff + i * phent; if (o + phent > u8.length) break;
      if (r32(o) !== 1) continue;                               // PT_LOAD
      const al = is64 ? r64(o + 0x30) : r32(o + 0x1c);
      min = min == null ? al : Math.min(min, al);
    }
    return { bits: is64 ? 64 : 32, machine: r16(0x12), align: min };
  }
  async function scanNatives(entries) {
    const libs = entries.filter(e => SO_RE.test(e.rel) && !SKIP_RE.test(e.rel));
    const out = { libs: [], unread: 0, nativeSrc: entries.some(e => NATIVE_SRC_RE.test(e.rel) && !SKIP_RE.test(e.rel)),
      /* paths only (never contents): config and key files that change when an app moves to another account */
      notable: entries.filter(e => NOTABLE_RE.test(e.rel) && !SKIP_RE.test(e.rel)).map(e => e.rel).slice(0, 40) };
    for (const e of libs.slice(0, MAX_SO)) {
      const abi = (e.rel.match(/(arm64-v8a|armeabi-v7a|armeabi|x86_64|x86)\//) || [])[1] || null;
      if (e.size > MAX_SO_SIZE) { out.unread++; out.libs.push({ path: e.rel, abi, align: null }); continue; }
      try { const h = elfAlign(await e.read()); out.libs.push({ path: e.rel, abi, bits: h && h.bits, align: h && h.align }); }
      catch (err) { out.unread++; out.libs.push({ path: e.rel, abi, align: null }); }
    }
    out.unread += Math.max(0, libs.length - MAX_SO); out.total = libs.length;
    /* 0.2.5: large files (ML models, videos, asset bundles) for the Play download-size check; sizes only, nothing is read */
    out.large = entries.filter(e => e.size >= LARGE_FILE && !SKIP_RE.test(e.rel) && !SO_RE.test(e.rel) && !/(^|\/)\.git\//.test(e.rel)).sort((a, b) => b.size - a.size).slice(0, 20).map(e => ({ path: e.rel, size: e.size }));
    return out;
  }

  function wanted(path) {
    if (SKIP_RE.test(path)) return null;
    if (TEXT_RE.some(r => r.test(path))) return 'text';
    if (IMG_RE.some(r => r.test(path))) return 'img';
    if (CODE_RE.test(path)) {
      if (HYBRID_WEB_RE.test(path)) return HYBRID_INNER_SKIP.test(path) ? null : 'code';
      if (!CODE_SKIP_RE.test(path)) return 'code';
    }
    return null;
  }
  function mime(path) { return /\.webp$/i.test(path) ? 'image/webp' : /\.jpe?g$/i.test(path) ? 'image/jpeg' : 'image/png'; }
  function u8ToDataUrl(u8, path) {
    return new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(new Blob([u8], { type: mime(path) })); });
  }
  /* 맨 위 공통 폴더 하나를 벗긴다 (repo-main/..., my-app/...) */
  function stripRoot(paths) {
    const tops = new Set(paths.map(p => p.split('/')[0]));
    if (tops.size === 1 && paths.every(p => p.includes('/'))) { const t = [...tops][0] + '/'; return p => p.slice(t.length); }
    return p => p;
  }
  /* 아이콘·스크린샷은 사이즈가 큰 해상도 하나만 남겨도 충분 → 같은 이름 중 xxxhdpi 우선 */
  function rank(path) { const m = path.match(/mipmap-(x*)hdpi/); return m ? m[1].length : 0; }

  async function fromEntries(entries, name, source, onStep) {
    // entries: [{path, size, read: async()=>Uint8Array}]
    const strip = stripRoot(entries.map(e => e.path));
    const natives = await scanNatives(entries.map(e => ({ ...e, rel: strip(e.path) })));
    let picked = entries.map(e => ({ ...e, rel: strip(e.path) })).map(e => ({ ...e, kind: wanted(e.rel) })).filter(e => e.kind);
    // 런처 아이콘은 가장 큰 밀도만
    const launchers = picked.filter(e => /mipmap-[^/]+\/ic_launcher(_round)?\.(png|webp)$/i.test(e.rel)).sort((a, b) => rank(b.rel) - rank(a.rel));
    const keepLaunch = new Set(launchers.slice(0, 2).map(e => e.rel));
    picked = picked.filter(e => !/mipmap-[^/]+\/ic_launcher/i.test(e.rel) || keepLaunch.has(e.rel));
    const code = picked.filter(e => e.kind === 'code' && e.size <= MAX_CODE_SIZE)
      .sort((a, b) => (CODE_HINT_RE.test(b.rel.split('/').pop()) - CODE_HINT_RE.test(a.rel.split('/').pop())) || (a.rel.split('/').length - b.rel.split('/').length) || a.rel.localeCompare(b.rel))
      .slice(0, MAX_CODE);
    picked = picked.filter(e => e.kind !== 'code').sort((a, b) => /(^|\/)\.?rocketlauncher\.json$/i.test(b.rel) - /(^|\/)\.?rocketlauncher\.json$/i.test(a.rel)).filter(e => (e.kind === 'text' ? e.size <= MAX_TEXT : e.size <= MAX_IMG)).slice(0, MAX_FILES).concat(code);
    const files = {};
    for (const e of picked) {
      onStep && onStep(e.rel);
      try {
        const u8 = await e.read();
        files[e.rel] = e.kind === 'text' ? { text: decodeText(u8) } : e.kind === 'code' ? { text: decodeText(u8), code: true } : { dataUrl: await u8ToDataUrl(u8, e.rel) };
      } catch (err) { console.warn('skip', e.rel, err); }
    }
    return { name, source, files, fileCount: entries.length, natives };
  }

  function sample() {
    const S = window.RL_SAMPLE; const files = {};
    for (const [p, v] of Object.entries(S.files)) files[p] = v.text != null ? { text: v.text } : { dataUrl: 'data:' + mime(p) + ';base64,' + v.b64 };
    return Promise.resolve({ name: S.name, source: { kind: 'sample' }, files, fileCount: Object.keys(files).length });
  }

  async function fromZipFile(file, onStep) {
    const buf = await file.arrayBuffer();
    const entries = window.RLZip.readZip(buf);
    return fromEntries(entries, file.name.replace(/\.zip$/i, ''), { kind: 'zip', name: file.name }, onStep);
  }
  async function fromFileList(list, onStep) {
    const arr = [...list];
    const entries = arr.map(f => ({ path: f.webkitRelativePath || f.name, size: f.size, read: async () => new Uint8Array(await f.arrayBuffer()) }));
    const top = (arr[0] && (arr[0].webkitRelativePath || '').split('/')[0]) || 'project';
    return fromEntries(entries, top, { kind: 'folder', name: top }, onStep);
  }

  function parseRepo(url) {
    const m = String(url).trim().match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/tree\/([^/]+)(?:\/(.*))?)?\/?$/i);
    if (!m) return null;
    return { owner: m[1], repo: m[2], branch: m[3] || null, sub: (m[4] || '').replace(/\/$/, '') };
  }
  /* Try the URL directly. On the local preview server only, retry through /gh. On a static host
     (GitHub Pages), /gh does not exist; raw file fetches that fail CORS fall back to the GitHub contents API. */
  function onLocalPreview() {
    try { return location.protocol.startsWith('http') && /^(localhost|127\.0\.0\.1)$/.test(location.hostname); } catch (e) { return false; }
  }
  function rawToContentsApi(url) {
    const m = String(url).match(/^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/);
    if (!m) return null;
    return 'https://api.github.com/repos/' + m[1] + '/' + m[2] + '/contents/' + m[4] + '?ref=' + encodeURIComponent(m[3]);
  }
  function b64ToU8(b64) {
    const bin = atob(String(b64).replace(/\s/g, ''));
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8;
  }
  async function ghFetch(url, as) {
    const tries = [url];
    if (onLocalPreview()) tries.push('/gh?u=' + encodeURIComponent(url));
    const viaApi = as === 'bin' ? rawToContentsApi(url) : null;
    if (viaApi) tries.push(viaApi);
    let lastErr;
    for (const u of tries) {
      try {
        const contents = u.indexOf('api.github.com') !== -1 && u.indexOf('/contents/') !== -1;
        const r = await fetch(u, { headers: (as === 'json' || contents) ? { Accept: 'application/vnd.github+json' } : {} });
        if (r.status === 403 || r.status === 429) { lastErr = new Error('rate'); continue; }
        if (r.status === 404) throw Object.assign(new Error('notfound'), { fatal: true });
        if (!r.ok) { lastErr = new Error('http ' + r.status); continue; }
        if (contents && as === 'bin') {
          const meta = await r.json();
          if (!meta || meta.encoding !== 'base64' || typeof meta.content !== 'string') { lastErr = new Error('contents'); continue; }
          return b64ToU8(meta.content);
        }
        return as === 'json' ? r.json() : new Uint8Array(await r.arrayBuffer());
      } catch (e) { if (e.fatal) throw e; lastErr = e; }
    }
    throw lastErr || new Error('network');
  }
  async function fromGitHub(url, onStep) {
    const R = parseRepo(url);
    if (!R) throw Object.assign(new Error('badurl'), { code: 'badurl' });
    onStep && onStep('github.com/' + R.owner + '/' + R.repo);
    let meta;
    try { meta = await ghFetch(`https://api.github.com/repos/${R.owner}/${R.repo}`, 'json'); }
    catch (e) { throw Object.assign(e, { code: e.message === 'notfound' ? 'notfound' : e.message === 'rate' ? 'rate' : 'network' }); }
    if (meta.private) throw Object.assign(new Error('private'), { code: 'notfound' });
    const branch = R.branch || meta.default_branch || 'main';
    const tree = await ghFetch(`https://api.github.com/repos/${R.owner}/${R.repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`, 'json');
    let blobs = (tree.tree || []).filter(n => n.type === 'blob');
    if (R.sub) blobs = blobs.filter(n => n.path.startsWith(R.sub + '/')).map(n => ({ ...n, path: n.path }));
    const entries = blobs.map(n => ({
      path: n.path, size: n.size || 0,
      read: () => ghFetch(`https://raw.githubusercontent.com/${R.owner}/${R.repo}/${encodeURIComponent(branch)}/${n.path.split('/').map(encodeURIComponent).join('/')}`, 'bin')
    }));
    const res = await fromEntries(entries.map(e => R.sub ? { ...e, path: e.path.slice(R.sub.length + 1) } : e).map((e, i) => ({ ...e, read: entries[i].read })), R.repo, { kind: 'github', url: `https://github.com/${R.owner}/${R.repo}`, branch }, onStep);
    res.meta = { description: meta.description || '', homepage: meta.homepage || '', owner: meta.owner && meta.owner.login, license: meta.license && meta.license.spdx_id, stars: meta.stargazers_count };
    return res;
  }
  window.RLSources = { sample, fromZipFile, fromFileList, fromGitHub, parseRepo, elfAlign };
})();
