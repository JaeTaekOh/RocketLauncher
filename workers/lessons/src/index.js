/* Rocket Launcher shared review lessons — Cloudflare Worker for the configured lessons API only.
   POST: one anonymized lesson event { v:1, event:"rejected"|"passed", store, codes, advice_id } → increments an aggregate count.
   GET : the aggregated feed { lessons:[{ store, codes, advice_id, title, advice, count, passed, last_seen }] }.
   POST /api/corrections: anonymized check-correction event (check id, verdicts, framework, language, pattern kinds).
   GET  /admin and GET /api/admin/stats: admin-only counts (ADMIN_TOKEN).
   Privacy: strict allowlist (unknown fields are rejected, never stored or logged); no per-user rows; titles / advice come only
   from the fixed table (src/table.js, generated from js/lessons.js). IPs are only used as a salted hash for a 1-hour
   rate-limit key that expires on its own. Bodies are never logged. Unmatched paths are passed to the origin untouched. */
import { TABLE, PLAY_IDS } from './table.js';

const PATH = /^\/api\/lessons\/?$/;
const CORR_PATH = /^\/api\/corrections\/?$/;
const ADMIN_PATH = /^\/admin\/?$/;
const ADMIN_STATS = /^\/api\/admin\/stats\/?$/;
const MAX_BODY = 2048, MAX_ROWS = 600, RL_LIMIT = 30, RL_TTL = 3600;
const FEED_KEY = 'feed:v1', TEST_KEY = 'feed:test';
const RE_GUIDE = /^\d{1,2}\.\d{1,2}(\.\d{1,2})?(\((?:[a-z]|[ivx]{1,4})\))?$/, RE_ITMS = /^ITMS-\d{5}$/;
const ALLOWED = ['v', 'event', 'store', 'codes', 'advice_id'];
/* localhost is always allowed (local web tool). Add production web origins via CORS_ORIGINS (comma-separated) at deploy. */
const ORIGIN_OK = (o, env) => {
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(o)) return true;
  const extra = String((env && env.CORS_ORIGINS) || '').split(',').map(s => s.trim()).filter(Boolean);
  return extra.includes(o);
};

const codeOk = (store, c) => typeof c === 'string' && c.length <= 16 && (store === 'apple' ? (RE_GUIDE.test(c) || RE_ITMS.test(c)) : PLAY_IDS.includes(c));
/* Same rules as validShare in js/lessons.js, plus the test-only advice id "test" (kept apart, never in the public feed). */
export function validate(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return null;
  if (Object.keys(p).some(k => !ALLOWED.includes(k))) return null;
  if (p.v !== undefined && p.v !== 1) return null;
  const event = p.event === undefined ? 'rejected' : p.event;
  if (event !== 'rejected' && event !== 'passed') return null;
  if (p.store !== 'apple' && p.store !== 'play') return null;
  if (typeof p.advice_id !== 'string') return null;
  const test = p.advice_id === 'test', E = TABLE[p.advice_id];
  if (!test && (!E || E.store !== p.store)) return null;
  if (!Array.isArray(p.codes) || p.codes.length > 6 || !p.codes.every(c => codeOk(p.store, c))) return null;
  const codes = [...new Set(p.codes)].sort();
  if (p.advice_id === 'apple-codes' && !codes.length) return null;
  return { event, store: p.store, codes, advice_id: p.advice_id, test };
}

function cors(req, env) {
  const o = req.headers.get('Origin') || '';
  return ORIGIN_OK(o, env) ? { 'Access-Control-Allow-Origin': o, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' } : { Vary: 'Origin' };
}
const json = (req, env, status, body, extra) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff', ...cors(req, env), ...(extra || {}) } });

async function readDoc(env, key) { try { const d = await env.LESSONS.get(key, 'json'); return d && typeof d.rows === 'object' ? d : { v: 1, rows: {} }; } catch { return { v: 1, rows: {} }; } }
function feedOf(doc, test) {
  const lessons = Object.values(doc.rows).map(r => {
    const E = TABLE[r.advice_id] || { title: 'test', advice: 'test' };
    return { store: r.store, codes: r.codes, advice_id: r.advice_id, title: E.title, advice: E.advice, count: r.count | 0, passed: r.passed | 0, last_seen: r.last_seen };
  }).filter(x => test || TABLE[x.advice_id]).sort((a, b) => b.count - a.count);
  return { v: 1, source: 'rocket-launcher', note: 'Aggregated, anonymized store-review lessons. Titles and advice come from Rocket Launcher\'s fixed table.', updated: doc.updated || null, lessons };
}
async function sha(s) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].slice(0, 12).map(x => x.toString(16).padStart(2, '0')).join(''); }

async function handleGet(req, env, ctx) {
  const url = new URL(req.url), test = url.searchParams.get('test') === '1';
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const ck = new Request(url.origin + '/api/lessons?cache=v1');
  if (!test && cache) { const hit = await cache.match(ck); if (hit) { const r = new Response(hit.body, hit); Object.entries(cors(req, env)).forEach(([k, v]) => r.headers.set(k, v)); return r; } }
  const body = feedOf(await readDoc(env, test ? TEST_KEY : FEED_KEY), test);
  const res = json(req, env, 200, body, { 'Cache-Control': test ? 'no-store' : 'public, max-age=900, s-maxage=600' });
  if (!test && cache) { const c = new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=600' } }); ctx.waitUntil(cache.put(ck, c)); }
  return res;
}

async function handlePost(req, env) {
  const len = Number(req.headers.get('Content-Length') || 0);
  if (len > MAX_BODY) return json(req, env, 413, { error: 'too_large' });
  if (!/application\/json/i.test(req.headers.get('Content-Type') || '')) return json(req, env, 415, { error: 'json_only' });
  let text = '';
  try { const buf = await req.arrayBuffer(); if (buf.byteLength > MAX_BODY) return json(req, env, 413, { error: 'too_large' }); text = new TextDecoder().decode(buf); } catch { return json(req, env, 400, { error: 'invalid' }); }
  let p; try { p = JSON.parse(text); } catch { return json(req, env, 400, { error: 'invalid' }); }
  text = null;
  const ok = validate(p); p = null;   // drop the original object right away; only the validated copy is used
  if (!ok) return json(req, env, 400, { error: 'invalid' });
  /* Rate limit: hashed (IP + hour), 1-hour TTL. No IP is ever stored in clear or kept longer. */
  const hour = Math.floor(Date.now() / 3600e3), ip = req.headers.get('CF-Connecting-IP') || 'none';
  const rk = 'rl:' + await sha(ip + '|' + hour + '|' + (env.RL_SALT || 'rocket-launcher-lessons'));
  const used = Number(await env.LESSONS.get(rk)) || 0;
  if (used >= RL_LIMIT) return json(req, env, 429, { error: 'rate_limited' }, { 'Retry-After': '3600' });
  await env.LESSONS.put(rk, String(used + 1), { expirationTtl: RL_TTL });
  const key = ok.test ? TEST_KEY : FEED_KEY, doc = await readDoc(env, key);
  const rowKey = ok.store + '|' + ok.advice_id + '|' + ok.codes.join(',');
  const day = new Date().toISOString().slice(0, 10);
  let r = doc.rows[rowKey];
  if (!r) {
    if (Object.keys(doc.rows).length >= MAX_ROWS) return json(req, env, 202, { ok: true, counted: false });
    r = doc.rows[rowKey] = { store: ok.store, codes: ok.codes, advice_id: ok.advice_id, count: 0, passed: 0, first_seen: day, last_seen: day };
  }
  if (ok.event === 'passed') r.passed = (r.passed | 0) + 1; else { r.count = (r.count | 0) + 1; r.last_seen = day; }
  doc.updated = day;
  await env.LESSONS.put(key, JSON.stringify(doc));
  return json(req, env, 202, { ok: true, counted: true });
}


const CORR_KEY = 'corrections:v1', CORR_MAX = 800, CORR_RECENT = 200, CORR_LIMIT = 30;
const CHECK_OK = { account_deletion: ['present', 'missing'], location_sharing: ['server', 'device'], auth: ['present', 'missing'], cloud_db: ['present', 'missing'] };
const FW_OK = ['capacitor', 'cordova', 'ionic', 'flutter', 'react-native', 'expo', 'android', 'ios', 'unknown'];
const LANG_OK = ['dart', 'kotlin', 'java', 'swift', 'js', 'ts', 'unknown'];
const KIND_OK = ['function_name','http_delete','i18n','ui_text','query_string','wrapper_fetch','geolocation_plugin','same_file','co_occur','sdk_api','user_report','device_only'];
const CORR_ALLOWED = ['v', 'check_id', 'wrong_verdict', 'corrected_verdict', 'framework', 'language', 'pattern_kinds'];

export function validateCorrection(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return null;
  if (Object.keys(p).some(k => !CORR_ALLOWED.includes(k))) return null;
  if (p.v !== undefined && p.v !== 1) return null;
  if (!CHECK_OK[p.check_id]) return null;
  if (!CHECK_OK[p.check_id].includes(p.wrong_verdict) || !CHECK_OK[p.check_id].includes(p.corrected_verdict)) return null;
  if (p.wrong_verdict === p.corrected_verdict) return null;
  const framework = FW_OK.includes(p.framework) ? p.framework : (p.framework === undefined ? 'unknown' : null);
  const language = LANG_OK.includes(p.language) ? p.language : (p.language === undefined ? 'unknown' : null);
  if (!framework || !language) return null;
  if (p.pattern_kinds !== undefined && !Array.isArray(p.pattern_kinds)) return null;
  if (Array.isArray(p.pattern_kinds) && (p.pattern_kinds.length > 8 || p.pattern_kinds.some(k => typeof k !== 'string' || !KIND_OK.includes(k)))) return null;
  const pattern_kinds = [...new Set(p.pattern_kinds || [])];
  return { check_id: p.check_id, wrong_verdict: p.wrong_verdict, corrected_verdict: p.corrected_verdict, framework, language, pattern_kinds };
}

async function readCorr(env) {
  try { const d = await env.LESSONS.get(CORR_KEY, 'json'); return d && typeof d === 'object' ? { v: 1, rows: d.rows && typeof d.rows === 'object' ? d.rows : {}, recent: Array.isArray(d.recent) ? d.recent : [], updated: d.updated || null } : { v: 1, rows: {}, recent: [], updated: null }; }
  catch { return { v: 1, rows: {}, recent: [], updated: null }; }
}

async function rateLimit(req, env, bucket) {
  const hour = Math.floor(Date.now() / 3600e3), ip = req.headers.get('CF-Connecting-IP') || 'none';
  const rk = 'rl:' + bucket + ':' + await sha(ip + '|' + hour + '|' + (env.RL_SALT || 'rocket-launcher-lessons'));
  const used = Number(await env.LESSONS.get(rk)) || 0;
  if (used >= CORR_LIMIT) return false;
  await env.LESSONS.put(rk, String(used + 1), { expirationTtl: RL_TTL });
  return true;
}

async function handleCorrectionPost(req, env) {
  const len = Number(req.headers.get('Content-Length') || 0);
  if (len > MAX_BODY) return json(req, env, 413, { error: 'too_large' });
  if (!/application\/json/i.test(req.headers.get('Content-Type') || '')) return json(req, env, 415, { error: 'json_only' });
  let text = '';
  try { const buf = await req.arrayBuffer(); if (buf.byteLength > MAX_BODY) return json(req, env, 413, { error: 'too_large' }); text = new TextDecoder().decode(buf); } catch { return json(req, env, 400, { error: 'invalid' }); }
  let p; try { p = JSON.parse(text); } catch { return json(req, env, 400, { error: 'invalid' }); }
  text = null;
  const ok = validateCorrection(p); p = null;
  if (!ok) return json(req, env, 400, { error: 'invalid' });
  if (!await rateLimit(req, env, 'corr')) return json(req, env, 429, { error: 'rate_limited' }, { 'Retry-After': '3600' });
  const doc = await readCorr(env);
  const rowKey = ok.check_id + '|' + ok.wrong_verdict + '|' + ok.corrected_verdict;
  const day = new Date().toISOString().slice(0, 10);
  let r = doc.rows[rowKey];
  if (!r) {
    if (Object.keys(doc.rows).length >= CORR_MAX) return json(req, env, 202, { ok: true, counted: false });
    r = doc.rows[rowKey] = { check_id: ok.check_id, wrong_verdict: ok.wrong_verdict, corrected_verdict: ok.corrected_verdict, count: 0, first_seen: day, last_seen: day };
  }
  r.count = (r.count | 0) + 1; r.last_seen = day;
  doc.recent = [{ check_id: ok.check_id, wrong_verdict: ok.wrong_verdict, corrected_verdict: ok.corrected_verdict, framework: ok.framework, language: ok.language, pattern_kinds: ok.pattern_kinds, day }, ...doc.recent].slice(0, CORR_RECENT);
  doc.updated = day;
  await env.LESSONS.put(CORR_KEY, JSON.stringify(doc));
  return json(req, env, 202, { ok: true, counted: true });
}

function adminOk(req, env) {
  const token = String((env && env.ADMIN_TOKEN) || '');
  if (!token) return false;
  const h = req.headers.get('Authorization') || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  const got = (m && m[1]) || req.headers.get('X-Admin-Token') || '';
  return got === token;
}

export function adminStats(lessonsDoc, corrDoc) {
  const lessonRows = lessonsDoc && lessonsDoc.rows ? Object.values(lessonsDoc.rows) : [];
  const lessonCount = lessonRows.reduce((n, r) => n + (r.count | 0), 0);
  const passedCount = lessonRows.reduce((n, r) => n + (r.passed | 0), 0);
  const rows = corrDoc && corrDoc.rows ? Object.values(corrDoc.rows) : [];
  const correctionCount = rows.reduce((n, r) => n + (r.count | 0), 0);
  const top = [...rows].sort((a, b) => (b.count | 0) - (a.count | 0)).slice(0, 20).map(r => ({ check_id: r.check_id, wrong_verdict: r.wrong_verdict, corrected_verdict: r.corrected_verdict, count: r.count | 0, last_seen: r.last_seen }));
  const recent = ((corrDoc && corrDoc.recent) || []).slice(0, 50);
  return { v: 1, lessons: { events: lessonCount, passed: passedCount, distinct: lessonRows.length, updated: (lessonsDoc && lessonsDoc.updated) || null }, corrections: { events: correctionCount, distinct: rows.length, updated: (corrDoc && corrDoc.updated) || null, top, recent } };
}

function adminPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>Rocket Launcher — lessons admin</title>
  <style>
    :root { --ink:#171717; --muted:#6B6B6B; --hair:#E8E8E8; --accent:#F4A261; }
    body { margin:0; font:16px/1.5 Geist, "IBM Plex Sans", system-ui, sans-serif; color:var(--ink); background:#fff; }
    main { max-width:860px; margin:0 auto; padding:32px 20px 64px; }
    h1 { font-size:22px; font-weight:600; margin:0 0 8px; }
    h2 { font-size:16px; margin:28px 0 10px; }
    p, label { color:var(--muted); }
    input[type=password] { width:min(100%,320px); padding:8px 10px; border:1px solid var(--hair); border-radius:8px; font:inherit; }
    button { margin-left:8px; padding:8px 14px; border:0; border-radius:8px; background:#171717; color:#fff; font:inherit; cursor:pointer; }
    .cards { display:flex; gap:12px; flex-wrap:wrap; margin:16px 0; }
    .card { flex:1; min-width:160px; border:1px solid var(--hair); border-radius:12px; padding:14px 16px; }
    .card b { display:block; font-size:28px; }
    table { width:100%; border-collapse:collapse; font-size:14px; }
    th, td { text-align:left; padding:8px 6px; border-bottom:1px solid var(--hair); vertical-align:top; }
    .err { color:#B85A17; }
  </style>
</head>
<body>
  <main>
    <h1>Rocket Launcher shared lessons</h1>
    <p>Owner view of anonymized review lessons and check-correction reports. Nothing here includes app names, code, or paths.</p>
    <p id="gate">
      <label>Admin token <input id="token" type="password" autocomplete="current-password"></label>
      <button type="button" id="go">Open</button>
    </p>
    <p id="msg" class="err" hidden></p>
    <section id="dash" hidden>
      <div class="cards">
        <div class="card"><b id="l-events">0</b> lesson events</div>
        <div class="card"><b id="l-passed">0</b> later passed</div>
        <div class="card"><b id="c-events">0</b> correction reports</div>
      </div>
      <h2>Top miscorrected checks</h2>
      <table><thead><tr><th>Check</th><th>Was</th><th>Corrected to</th><th>Count</th><th>Last seen</th></tr></thead><tbody id="top"></tbody></table>
      <h2>Recent 50 reports</h2>
      <table><thead><tr><th>Day</th><th>Check</th><th>Was</th><th>Corrected to</th><th>Framework</th><th>Language</th><th>Patterns</th></tr></thead><tbody id="recent"></tbody></table>
    </section>
  </main>
  <script>
    const $ = id => document.getElementById(id);
    async function load() {
      const token = $('token').value.trim();
      $('msg').hidden = true;
      const r = await fetch('/api/admin/stats', { headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' } });
      if (!r.ok) { $('msg').textContent = r.status === 401 ? 'That token was not accepted.' : 'Could not load stats.'; $('msg').hidden = false; return; }
      const d = await r.json();
      try { sessionStorage.setItem('rl-admin', token); } catch (e) {}
      $('dash').hidden = false;
      $('l-events').textContent = d.lessons.events;
      $('l-passed').textContent = d.lessons.passed;
      $('c-events').textContent = d.corrections.events;
      $('top').innerHTML = (d.corrections.top || []).map(x => '<tr><td>'+x.check_id+'</td><td>'+x.wrong_verdict+'</td><td>'+x.corrected_verdict+'</td><td>'+x.count+'</td><td>'+(x.last_seen||'')+'</td></tr>').join('') || '<tr><td colspan="5">None yet</td></tr>';
      $('recent').innerHTML = (d.corrections.recent || []).map(x => '<tr><td>'+(x.day||'')+'</td><td>'+x.check_id+'</td><td>'+x.wrong_verdict+'</td><td>'+x.corrected_verdict+'</td><td>'+(x.framework||'')+'</td><td>'+(x.language||'')+'</td><td>'+(x.pattern_kinds||[]).join(', ')+'</td></tr>').join('') || '<tr><td colspan="7">None yet</td></tr>';
    }
    $('go').onclick = load;
    $('token').addEventListener('keydown', e => { if (e.key === 'Enter') load(); });
    try { const s = sessionStorage.getItem('rl-admin'); if (s) { $('token').value = s; load(); } } catch (e) {}
  </script>
</body>
</html>`;
}

async function handleAdminStats(req, env) {
  if (!adminOk(req, env)) return json(req, env, 401, { error: 'unauthorized' }, { 'Cache-Control': 'no-store' });
  const lessons = await readDoc(env, FEED_KEY);
  const corr = await readCorr(env);
  return json(req, env, 200, adminStats(lessons, corr), { 'Cache-Control': 'no-store' });
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    try {
      if (ADMIN_PATH.test(url.pathname)) {
        if (req.method === 'GET' || req.method === 'HEAD') return new Response(adminPage(), { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } });
        return json(req, env, 405, { error: 'method' }, { Allow: 'GET' });
      }
      if (ADMIN_STATS.test(url.pathname)) {
        if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req, env) });
        if (req.method === 'GET' || req.method === 'HEAD') return await handleAdminStats(req, env);
        return json(req, env, 405, { error: 'method' }, { Allow: 'GET, OPTIONS' });
      }
      if (CORR_PATH.test(url.pathname)) {
        if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req, env) });
        if (req.method === 'POST') return await handleCorrectionPost(req, env);
        return json(req, env, 405, { error: 'method' }, { Allow: 'POST, OPTIONS' });
      }
      if (!PATH.test(url.pathname)) return fetch(req);   // never take over site pages
      if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req, env) });
      if (req.method === 'GET' || req.method === 'HEAD') return await handleGet(req, env, ctx);
      if (req.method === 'POST') return await handlePost(req, env);
      return json(req, env, 405, { error: 'method' }, { Allow: 'GET, POST, OPTIONS' });
    } catch (e) {
      console.error('lessons worker error', e && e.name);   // never the body
      return json(req, env, 500, { error: 'server' });
    }
  }
};
