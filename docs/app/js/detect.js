/* Rocket Launcher — account-deletion and location-sharing detection used by the analyzer
   and by MCP release checks. Patterns only; no network. */
(function () {
  'use strict';

  const DELETE_FN = /\b(deleteAccount|delete_account|deleteUser|delete_user|deleteAuthUser|deleteRemote|accountDeletion|DeleteAccount|purgeUserData|closeAccount|close_account|requestDelete|delete_profile|destroy_account|deactivateAccount|deactivate_account|withdrawAccount|withdrawMember|removeAccount|remove_account|wipeLocalAll|wipeLocal)\b|(?:currentUser|current_user|authUser|Auth\.auth\(\)\.currentUser|\buser)\s*\??\.?\s*delete\s*\(|\.deleteUser\s*\(|auth\.admin\.deleteUser|deleteUser\s*\(|FirebaseAuth[\s\S]{0,80}\.delete\s*\(/;
  const DELETE_HTTP = /method\s*:\s*['"]DELETE['"][\s\S]{0,200}\/?(?:api\/)?(?:users?|accounts?|me|profile)\b|['"]DELETE['"][\s\S]{0,100}\/?(?:api\/)?(?:users?|accounts?|me)|['"`]\/?(?:api\/)?(?:users?|accounts?|me|profile)['"`][\s\S]{0,120}\bDELETE\b/i;
  const DELETE_TEXT = /delete\s+(my\s+|your\s+)?account|account\s+deletion|close\s+(my\s+|your\s+)?account|deactivate\s+(my\s+|your\s+)?account|remove\s+(my\s+|your\s+)?account|회원\s*탈퇴|계정\s*삭제|계정\s*탈퇴|탈퇴하기|회원탈퇴|\b탈퇴\b|ลบบัญชี|ปิดบัญชี|ยกเลิกบัญชี|删除\s*(我的)?(账号|帐户|账户)|注销账号|खाता\s*(हटाएं|हटाएँ|डिलीट)/i;
  const DELETE_I18N = /['"][^'"]*(?:acct\.delete|account_?delete|delete_?account|deleteAccount|close_account|deactivate_account|withdraw_account|회원_?탈퇴|계정_?삭제)[^'"]*['"]\s*:/i;

  const LOC_TOKEN = /(?:\b(?:lat|lng|lon|latitude|longitude|coords?|coordinate|geopoint|cllocation|latlng|geolocator|fusedlocationproviderclient|fusedlocation|geolocation)\b|getCurrentPosition|watchPosition|[?&](?:lat|lng|lon|latitude|longitude)=)/i;
  const NET_TOKEN = /\b(?:fetch|axios|got\b|superagent|XMLHttpRequest|URLSession|HttpClient|Retrofit|OkHttp|CapacitorHttp|firestore|collection\s*\(|\.setData\s*\(|supabase|\.from\s*\()\b|http\.(?:get|post|put|patch|delete)\s*\(|\bdio\b/i;
  const WRAP_FETCH = /\b(?:getJson|postJson|putJson|apiGet|apiPost|requestJson|apiRequest|httpRequest|sendRequest|apiCall|env\.fetch|api\.(?:get|post|put|patch|delete))\s*\(/;
  const QUERY_SEND = /[?&](?:lat|lng|lon|latitude|longitude)=|['"`][^'"`]{0,80}\b(?:lat|lng|lon|latitude|longitude)=|encodeURIComponent\s*\(\s*(?:loc|pos|position|coords?|coordinate|location)\.(?:lat|lng|lon|latitude|longitude)/i;

  function kindsOfDeletion(t) {
    const kinds = [];
    if (DELETE_FN.test(t)) kinds.push('function_name');
    if (DELETE_HTTP.test(t)) kinds.push('http_delete');
    if (DELETE_I18N.test(t)) kinds.push('i18n');
    else if (DELETE_TEXT.test(t)) kinds.push('ui_text');
    return kinds;
  }

  function deletion(codeP, F, strings) {
    const files = [], kinds = [];
    for (const p of codeP || []) {
      const t = (F[p] && F[p].text) || '';
      const k = kindsOfDeletion(t);
      if (k.length) { files.push(p); k.forEach(x => kinds.push(x)); }
    }
    const strHay = typeof strings === 'string' ? strings : JSON.stringify(strings || {});
    if (DELETE_TEXT.test(strHay) || DELETE_I18N.test(strHay)) kinds.push('ui_text');
    const uniq = [...new Set(kinds)];
    const certain = uniq.some(k => k === 'function_name' || k === 'http_delete' || k === 'i18n' || k === 'ui_text');
    return { found: certain, confidence: certain ? 'certain' : (uniq.length ? 'uncertain' : null), kinds: uniq, files: [...new Set(files)].slice(0, 8) };
  }

  function locationFlow(codeP, F, hay) {
    const files = (codeP || []).map(p => ({ p, t: (F[p] && F[p].text) || '' }));
    const all = files.map(f => f.t).join('\n');
    const hayAll = (hay || '') + '\n' + all;
    const hasLoc = files.some(f => LOC_TOKEN.test(f.t)) || /ACCESS_(?:FINE_|COARSE_)?LOCATION|NSLocation|@capacitor\/geolocation|Geolocation|Geolocator|FusedLocation/i.test(hayAll);
    const hasNet = files.some(f => NET_TOKEN.test(f.t) || WRAP_FETCH.test(f.t)) || NET_TOKEN.test(hayAll) || WRAP_FETCH.test(hayAll);
    const kinds = [];
    let certain = false;
    for (const f of files) {
      const loc = LOC_TOKEN.test(f.t) || QUERY_SEND.test(f.t);
      const net = NET_TOKEN.test(f.t) || WRAP_FETCH.test(f.t);
      if (loc && net && QUERY_SEND.test(f.t)) { certain = true; kinds.push('query_string'); }
      else if (loc && net) { certain = true; kinds.push('same_file'); }
      if (WRAP_FETCH.test(f.t) && (LOC_TOKEN.test(f.t) || QUERY_SEND.test(f.t))) kinds.push('wrapper_fetch');
    }
    if (QUERY_SEND.test(all) && (NET_TOKEN.test(all) || WRAP_FETCH.test(all))) {
      certain = true;
      kinds.push('query_string');
      if (WRAP_FETCH.test(all)) kinds.push('wrapper_fetch');
    }
    if (/getCurrentPosition|watchPosition|@capacitor\/geolocation|navigator\s*\.\s*geolocation/i.test(all)) kinds.push('geolocation_plugin');
    const uniq = [...new Set(kinds)];
    if (certain) return { sent: true, confidence: 'certain', kinds: uniq };
    if (hasLoc && hasNet) return { sent: true, confidence: 'uncertain', kinds: [...uniq, 'co_occur'] };
    if (hasLoc) return { sent: false, confidence: 'certain', kinds: ['device_only'] };
    return { sent: false, confidence: null, kinds: [] };
  }

  const AUTH_RE = /firebase-auth|firebase_auth|FirebaseAuth|getAuth\s*\(|signInWith(?:Email|Popup|Credential|CustomToken)|@capacitor-firebase\/authentication|FirebaseAuthentication|firebase\.auth|initializeAuth|createUserWithEmail|play-services-auth|google_sign_in|google-signin|auth0|supabase|credentials-play-services|googleid/i;
  const CLOUD_RE = /firestore|firebase-database|firebase_database|getFirestore\s*\(|firebase\.firestore|firestore\.googleapis|@capacitor-firebase\/firestore|supabase|realm/i;
  const LOC_SDK_RE = /ACCESS_(?:FINE_|COARSE_)?LOCATION|play-services-location|geolocator|NSLocation|Geolocation|getCurrentPosition|@capacitor\/geolocation|FusedLocation|CLLocation|Geolocator|navigator\s*\.\s*geolocation/i;

  window.RLDetect = { deletion, locationFlow, AUTH_RE, CLOUD_RE, LOC_SDK_RE, DELETE_FN, DELETE_HTTP, DELETE_TEXT, DELETE_I18N };
})();
