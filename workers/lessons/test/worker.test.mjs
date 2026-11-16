/* Local tests for the lessons Worker with an in-memory KV. Run: node workers/lessons/test/worker.test.mjs */
import vm from 'node:vm'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import worker, { validate, validateCorrection, adminStats } from '../src/index.js';
const HERE = path.dirname(fileURLToPath(import.meta.url));
let pass = 0, failN = 0; const check = (c, n, x) => { if (c) { pass++; console.log('  ✓', n); } else { failN++; console.log('  ✗', n, x !== undefined ? JSON.stringify(x).slice(0, 400) : ''); } };
const store = new Map(), puts = [];
const env = { ADMIN_TOKEN: 'test-admin-token', LESSONS: { async get(k, t) { const v = store.get(k); return v == null ? null : t === 'json' ? JSON.parse(v) : v; }, async put(k, v, o) { puts.push([k, v, o]); store.set(k, v); } } };
const ctx = { waitUntil() { } };
let origin = 0; globalThis.fetch = async () => { origin++; return new Response('site'); };
const req = (method, body, h = {}, url = 'https://example.test/api/lessons') => new Request(url, { method, body: body == null ? undefined : typeof body === 'string' ? body : JSON.stringify(body), headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.9', ...h } });
const call = async r => { const res = await worker.fetch(r, env, ctx); const t = await res.text(); let j = null; try { j = JSON.parse(t); } catch { } return { s: res.status, j, h: res.headers, t }; };

console.log('[worker] validation');
check(validate({ v: 1, store: 'apple', codes: ['4.8'], advice_id: '4.8' }), 'allowlisted payload accepted');
check(!validate({ store: 'apple', codes: ['4.8'], advice_id: '4.8', letter: 'Hello, we reviewed MyApp' }), 'unknown field (letter) rejected');
check(!validate({ store: 'apple', codes: ['Guideline 4.8 - we reviewed MySecretApp'], advice_id: '4.8' }), 'free-text code rejected');
check(!validate({ store: 'apple', codes: ['4.8'], advice_id: 'Please add ATT now' }), 'free-text advice id rejected');
check(!validate({ store: 'play', codes: ['play-my-app-name'], advice_id: 'play-target-api' }), 'unknown play code rejected');
check(!validate({ store: 'play', codes: [], advice_id: '4.8' }), 'advice id from the other store rejected');
check(!validate({ store: 'apple', codes: [], advice_id: 'apple-codes' }), 'generic code advice without codes rejected');
check(!validate({ store: 'apple', codes: ['4.8'], advice_id: '4.8', app: 'com.secret.bundle' }), 'bundle id field rejected');
check(!validate([1, 2]) && !validate('x') && !validate(null), 'non-objects rejected');

/* Same verdicts as the client validator in js/lessons.js */
const c = { window: {} }; vm.createContext(c); vm.runInContext(fs.readFileSync(path.join(HERE, '..', '..', '..', 'js', 'lessons.js'), 'utf8'), c);
const CL = c.window.RLLessons;
const cases = [{ store: 'apple', codes: ['5.1.1(v)'], advice_id: '5.1.1' }, { store: 'apple', codes: ['ITMS-90683'], advice_id: 'ITMS-90683' }, { store: 'play', codes: ['play-target-api'], advice_id: 'play-target-api' }, { store: 'apple', codes: ['x'], advice_id: '2.1' }, { store: 'apple', codes: [], advice_id: 'builtin-apple-511' }, { store: 'play', codes: [], advice_id: 'builtin-apple-511' }, { event: 'passed', store: 'apple', codes: ['4.8'], advice_id: '4.8' }, { event: 'oops', store: 'apple', codes: [], advice_id: '4.8' }];
check(cases.every(p => !!validate(p) === !!CL.validShare(p)), 'worker and client validators agree', cases.map(p => [!!validate(p), !!CL.validShare(p)]));

console.log('[worker] routes');
let r = await call(req('GET', null, {}, 'https://example.test/2/'));
check(r.t === 'site' && origin === 1, 'non-API path passes through to the origin');
r = await call(req('GET', null, {}, 'https://example.test/api/lessonsX'));
check(r.t === 'site', '/api/lessonsX passes through');
r = await call(req('GET'));
check(r.s === 200 && Array.isArray(r.j.lessons) && r.j.lessons.length === 0 && /max-age/.test(r.h.get('Cache-Control')), 'GET empty feed with Cache-Control', r);

console.log('[worker] POST');
r = await call(req('POST', { v: 1, event: 'rejected', store: 'apple', codes: ['4.8'], advice_id: '4.8' }, { Origin: 'http://localhost' }));
check(r.s === 202 && r.h.get('Access-Control-Allow-Origin') === 'http://localhost', 'POST accepted, CORS for localhost', r.s);
await call(req('POST', { v: 1, event: 'rejected', store: 'apple', codes: ['4.8'], advice_id: '4.8' }));
await call(req('POST', { v: 1, event: 'passed', store: 'apple', codes: ['4.8'], advice_id: '4.8' }));
r = await call(req('GET'));
const row = r.j.lessons[0];
check(row && row.count === 2 && row.passed === 1 && row.title === 'Design - Login services' && /Sign in with Apple/.test(row.advice) && /^\d{4}-\d{2}-\d{2}$/.test(row.last_seen), 'aggregated count/passed, title+advice from the fixed table', row);
check(Object.keys(JSON.parse(store.get('feed:v1')).rows).length === 1, 'one aggregate row, not one row per user');
r = await call(req('POST', { store: 'apple', codes: ['4.8'], advice_id: '4.8', letter: 'Dear Jane, MySecretApp (com.secret.bundle) jane@x.example' }));
check(r.s === 400, 'POST with letter text → 400');
check(![...store.values()].some(v => /MySecretApp|secret\.bundle|jane|Dear/.test(v)) && !puts.some(p => /203\.0\.113\.9/.test(p[0] + p[1])), 'nothing from the rejected body or the IP is stored');
r = await call(req('POST', 'x'.repeat(5000)));
check(r.s === 413, 'oversized body → 413');
r = await call(req('POST', '{"store":"apple"', {}));
check(r.s === 400, 'broken JSON → 400');
r = await call(new Request('https://example.test/api/lessons', { method: 'POST', body: 'a=b', headers: { 'Content-Type': 'text/plain' } }));
check(r.s === 415, 'non-JSON → 415');
check(puts.filter(p => p[0].startsWith('rl:')).every(p => p[2] && p[2].expirationTtl === 3600 && /^rl:[0-9a-f]{24}$/.test(p[0])), 'rate-limit keys are hashed and expire in 1 hour');

console.log('[worker] test id + rate limit + CORS');
r = await call(req('POST', { store: 'apple', codes: ['9.9'], advice_id: 'test' }));
check(r.s === 202, 'test advice id accepted');
r = await call(req('GET')); check(!r.j.lessons.some(x => x.advice_id === 'test'), 'test lessons are not in the public feed');
r = await call(req('GET', null, {}, 'https://example.test/api/lessons?test=1')); check(r.j.lessons.length === 1 && r.j.lessons[0].advice_id === 'test' && r.h.get('Cache-Control') === 'no-store', 'test feed visible only with ?test=1');
let last; for (let i = 0; i < 40; i++) last = await call(req('POST', { store: 'apple', codes: [], advice_id: 'test' }, { 'CF-Connecting-IP': '198.51.100.7' }));
check(last.s === 429, 'rate limit → 429 after 30 posts per hour');
r = await call(req('OPTIONS', null, { Origin: 'http://localhost' })); check(r.s === 204 && r.h.get('Access-Control-Allow-Origin') === 'http://localhost', 'preflight OK for localhost');
r = await call(req('GET', null, { Origin: 'https://evil.example' })); check(!r.h.get('Access-Control-Allow-Origin'), 'no CORS for other origins');
r = await call(req('DELETE')); check(r.s === 405, 'other methods → 405');


console.log('[worker] corrections + admin');
check(validateCorrection({ v: 1, check_id: 'account_deletion', wrong_verdict: 'missing', corrected_verdict: 'present', framework: 'capacitor', language: 'js', pattern_kinds: ['function_name', 'i18n'] }), 'correction payload accepted');
check(!validateCorrection({ v: 1, check_id: 'account_deletion', wrong_verdict: 'missing', corrected_verdict: 'present', framework: 'capacitor', language: 'js', path: 'app/src/main.js' }), 'correction with path field rejected');
check(!validateCorrection({ v: 1, check_id: 'account_deletion', wrong_verdict: 'missing', corrected_verdict: 'present', framework: 'capacitor', language: 'js', evidence: 'acct.js:128' }), 'correction with evidence field rejected');
check(!validateCorrection({ v: 1, check_id: 'account_deletion', wrong_verdict: 'missing', corrected_verdict: 'present', framework: 'MyApp', language: 'js' }), 'unknown framework rejected');
check(!validateCorrection({ v: 1, check_id: 'account_deletion', wrong_verdict: 'missing', corrected_verdict: 'present', framework: 'capacitor', language: 'js', pattern_kinds: ['eval(code)'] }), 'free-text pattern kind rejected');
check(!validateCorrection({ v: 1, check_id: 'account_deletion', wrong_verdict: 'present', corrected_verdict: 'present', framework: 'capacitor', language: 'js' }), 'same verdict rejected');
r = await call(req('POST', { v: 1, check_id: 'location_sharing', wrong_verdict: 'device', corrected_verdict: 'server', framework: 'capacitor', language: 'js', pattern_kinds: ['query_string', 'wrapper_fetch'] }, { 'CF-Connecting-IP': '203.0.113.50' }, 'https://example.test/api/corrections'));
check(r.s === 202 && r.j.ok && r.j.counted, 'POST /api/corrections accepted', r);
r = await call(req('POST', { v: 1, check_id: 'account_deletion', wrong_verdict: 'missing', corrected_verdict: 'present', framework: 'flutter', language: 'dart', pattern_kinds: ['i18n'] }, { 'CF-Connecting-IP': '203.0.113.50' }, 'https://example.test/api/corrections'));
check(r.s === 202, 'second correction counted');
r = await call(req('POST', { v: 1, check_id: 'account_deletion', wrong_verdict: 'missing', corrected_verdict: 'present', framework: 'capacitor', language: 'js', code: 'deleteAccount()' }, { 'CF-Connecting-IP': '203.0.113.50' }, 'https://example.test/api/corrections'));
check(r.s === 400, 'correction with code field → 400');
check(![...store.values()].some(v => /deleteAccount\(\)|acct\.js|MyApp|gaddy/i.test(v)), 'correction store has no code or paths');
r = await call(req('GET', null, {}, 'https://example.test/admin'));
check(r.s === 200 && /Admin token/.test(r.t) && /Rocket Launcher/.test(r.t), 'GET /admin returns the sign-in page');
r = await call(req('GET', null, {}, 'https://example.test/api/admin/stats'));
check(r.s === 401, 'admin stats without token → 401');
r = await call(req('GET', null, { Authorization: 'Bearer wrong' }, 'https://example.test/api/admin/stats'));
check(r.s === 401, 'admin stats with wrong token → 401');
r = await call(req('GET', null, { Authorization: 'Bearer test-admin-token' }, 'https://example.test/api/admin/stats'));
check(r.s === 200 && r.j.corrections.events === 2 && r.j.corrections.top[0].count >= 1 && r.j.corrections.recent.length === 2, 'admin stats show counts, top checks, recent 50', r.j);
check(r.j.lessons && typeof r.j.lessons.events === 'number', 'admin stats include lesson counts');
const snap = adminStats({ rows: { a: { count: 3, passed: 1 } }, updated: '2026-11-17' }, { rows: { 'account_deletion|missing|present': { check_id: 'account_deletion', wrong_verdict: 'missing', corrected_verdict: 'present', count: 4, last_seen: '2026-11-17' } }, recent: [{ check_id: 'account_deletion', wrong_verdict: 'missing', corrected_verdict: 'present', framework: 'capacitor', language: 'js', pattern_kinds: ['i18n'], day: '2026-11-17' }], updated: '2026-11-17' });
check(snap.lessons.events === 3 && snap.corrections.events === 4 && snap.corrections.top[0].check_id === 'account_deletion', 'adminStats aggregates lessons and corrections');

console.log(`\n${pass} passed, ${failN} failed`); process.exit(failN ? 1 : 0);
