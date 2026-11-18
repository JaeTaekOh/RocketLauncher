/* Rocket Launcher simulation / regression corpus.
   Every folder in test/sim/fixtures/ is a small synthetic app project plus expected.json with the correct answers.
   Each one is connected through the real tool code path (engine.connect → analyzer, icon check, stage, release checks;
   privacy drafts through engine.release('privacy')), compared field by field, and summarized as a scorecard.
   Offline: no link checks, shared lessons pointed at a dead local port, a temporary data folder.
   Run: npm run sim   (from mcp/)  ·  options: --json <file> (save the scorecard) · --only <id-substring> · --verbose · --actual <file> (everything the tool reported, per fixture)
   Known limitations (documented in known-limitations.json) are reported but do not fail the run. */
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'rocketlauncher-sim-'));
process.env.ROCKETLAUNCHER_HOME = HOME;
process.env.ROCKETLAUNCHER_VERIFY_URLS = '0';
process.env.ROCKETLAUNCHER_LESSONS_API = 'http://127.0.0.1:9/api/lessons';
const E = await import('../../lib/engine.mjs');
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const ONLY = arg('--only'), JSON_OUT = arg('--json'), VERBOSE = process.argv.includes('--verbose'), ACTUAL_OUT = arg('--actual');
const FIX = path.join(HERE, 'fixtures');
const KNOWN = fs.existsSync(path.join(HERE, 'known-limitations.json')) ? JSON.parse(fs.readFileSync(path.join(HERE, 'known-limitations.json'), 'utf8')) : {};
const sorted = a => [...(a || [])].sort();
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* What Rocket Launcher answered, in the same shape as expected.json */
async function actualOf(dir, exp) {
  /* Large files (model / asset sizes) are created at run time as sparse files in a temporary copy, so the corpus stays tiny on disk */
  if (exp._sparse) {
    const tmp = path.join(HOME, 'sparse-' + path.basename(dir)); fs.cpSync(dir, tmp, { recursive: true });
    for (const [p, size] of Object.entries(exp._sparse)) { const f = path.join(tmp, p); fs.mkdirSync(path.dirname(f), { recursive: true }); const fd = fs.openSync(f, 'w'); fs.ftruncateSync(fd, size); fs.closeSync(fd); }
    dir = tmp;
  }
  let res;
  try { res = await E.connect({ source: 'path', path: dir, lang: 'en' }, { allowPath: true }); }
  catch (e) { return { error: e.code || 'error', message: e.message }; }
  const { st, report } = res, A = st.A, ids = new Set(A.issues.map(i => i.id));
  let rq = null; try { rq = Object.fromEntries((await E.release('requirements', st.id, {}, 'en')).rows.map(r => [r.id, r.severity])); } catch (e) { rq = { error: e.message }; }
  let ds = null; try { ds = (await E.release('privacy', st.id, {}, 'en')).drafts.data_safety; } catch (e) { ds = { error: e.message }; }
  const IC = A.iconCheck || {};
  /* 0.2.6: optional checks (expected.json "extra"): prepared listing, store languages, graphics, deletion info, built binaries, form factors, guide */
  let extra;
  if (exp.extra) {
    const D = E.decisions(st, 'en'), dk = k => D.decisions.find(x => x.key === k), rec = k => (dk(k) || {}).recommended;
    let gp = null; try { gp = E.guide(E.load(st.id), 'play', 'en'); } catch (e) { gp = { error: e.code || e.message }; }
    let ct = null; try { ct = await E.release('closed_test', st.id, { action: 'application_draft' }, 'en'); } catch (e) { ct = { error: e.message }; }
    let del = null; try { del = await E.release('deletion', st.id, {}, 'en'); } catch (e) { del = { error: e.message }; }
    const field = (step, re) => { const s = gp && gp.steps && gp.steps.find(x => x.id === step); const f = s && s.fields.find(x => re.test(x.label)); return f ? f.value : null; };
    const an = A.android || {};
    extra = {
      screenshots: A.screenshots.length, feature_graphic: !!A.featureGraphic, feature_rec: rec('feature') ?? null,
      prepared_title: (A.prepared && A.prepared.defaultLang && (A.prepared.copy[A.prepared.defaultLang] || {}).title) || null,
      prepared_default_lang: (A.prepared && A.prepared.defaultLang) || null, rec_langs: rec('langs') ?? null,
      title_rec_label: ((dk('title') || { options: [] }).options[0] || {}).label || null,
      category_source: A.categorySource ? A.categorySource.split(' (')[0] : null,
      deletion_url: (A.deletionInfo && A.deletionInfo.url) || null, deletion_path: (A.deletionInfo && A.deletionInfo.inAppPath) || null,
      deletion_note_placeholder: del && del.review_note_text ? /<your-site>|\[/.test(del.review_note_text) : null,
      built_target: (an.built && an.built.targetSdk) || null, binaries: ((st.X && st.X.natives && st.X.natives.binaries) || []).length,
      form_factors: an.formFactors && an.formFactors.length ? ['phone', ...an.formFactors] : [], form_factors_rec: rec('form_factors') ?? null,
      privacy_stale: (A.privacyPages || []).filter(x => x.stale && x.stale.length && !x.old).map(x => x.path).sort(),
      removed_permissions: sorted((an.removedPermissions || []).map(x => String(x).replace(/^android\.permission\./, ''))),
      guide_partial: !!(gp && gp.steps && gp.undecided && gp.undecided.length), guide_default_lang: field('p-create', /default lang/i),
      guide_form_factors: field('p-create', /form factors/i), guide_deletion_url: field('p-content', /deletion/i),
      closed_test_value: ct && ct.sections ? ct.sections.about_your_app.value : null
    };
  }
  return {
    extra,
    error: null,
    name: A.appName || null, framework: A.framework, requirements: rq, platforms: sorted(Object.keys(A.platforms).filter(k => A.platforms[k])),
    package: A.pkg || null, version: A.version || null, versionCode: A.android && A.android.versionCode != null ? String(A.android.versionCode) : null,
    targetSdk: (A.android && A.android.targetSdk) || null, category: A.categories[0],
    stage: Object.fromEntries(Object.entries({ play: 'Google Play', apple: 'App Store' }).filter(([, n]) => report.store_stage[n]).map(([k, n]) => [k, report.store_stage[n].recommended])),
    ads: !!A.sdk.ads, ads_hint: !!A.adsHint, iap: !!A.sdk.billing, sdk: A.sdk,
    data_safety: ds && ds.rows ? sorted(ds.rows.map(r => r.id)) : ds,
    privacy_url: report.app.privacy_url_found, privacy_conflict: !!(A.listing && A.listing.privacyConflict), privacy_weak: !!(A.listing && A.listing.privacyWeak),
    icon: { found: !!A.icon, ios_blank: IC.ios ? !!IC.ios.blank : null, android_blank: IC.android ? !!IC.android.blank : null, mismatch: IC.match ? !IC.match.similar : null },
    app_langs: sorted(A.locales), listing_langs: { play: sorted([...((A.listing && A.listing.play.langs) || []), ...((A.listing && A.listing.play.otherLangs) || [])]), apple: sorted([...((A.listing && A.listing.apple.langs) || []), ...((A.listing && A.listing.apple.otherLangs) || [])]) },
    issues: [...ids].sort()
  };
}
/* Compare one fixture → list of { field, expected, actual, ok } */
function compare(exp, act) {
  const out = [], push = (field, e, a, ok) => out.push({ field, expected: e, actual: a, ok: ok === undefined ? eq(e, a) : ok });
  if (exp.error || act.error) { push('error', exp.error || null, act.error || null); if (exp.error || act.error) return out; }
  for (const k of ['name', 'framework', 'package', 'version', 'versionCode', 'targetSdk', 'category', 'ads', 'ads_hint', 'iap', 'privacy_url', 'privacy_conflict', 'privacy_weak']) if (k in exp) push(k, exp[k], act[k]);
  if ('platforms' in exp) push('platforms', sorted(exp.platforms), act.platforms);
  if ('data_safety' in exp) push('data_safety', sorted(exp.data_safety), act.data_safety);
  if ('app_langs' in exp) push('app_langs', sorted(exp.app_langs), act.app_langs);
  for (const [k, v] of Object.entries(exp.stage || {})) push('stage.' + k, v, act.stage[k] ?? null);
  for (const [k, v] of Object.entries(exp.sdk || {})) push('sdk.' + k, v, !!act.sdk[k]);
  for (const [k, v] of Object.entries(exp.icon || {})) push('icon.' + k, v, act.icon[k]);
  for (const [k, v] of Object.entries(exp.listing_langs || {})) push('listing_langs.' + k, sorted(v), act.listing_langs[k]);
  for (const [k, v] of Object.entries(exp.requirements || {})) push('requirements.' + k, v, (act.requirements || {})[k] ?? null);
  /* extra: exact value, or {"match": "regex"} / {"no_match": "regex"} for strings */
  for (const [k, v] of Object.entries(exp.extra || {})) {
    const a = (act.extra || {})[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && ('match' in v || 'no_match' in v)) push('extra.' + k, v, a, a != null && ('match' in v ? new RegExp(v.match, 'i').test(String(a)) : true) && ('no_match' in v ? !new RegExp(v.no_match, 'i').test(String(a)) : true));
    else push('extra.' + k, v, a ?? null);
  }
  for (const id of exp.issues_present || []) push('issue+' + id, true, act.issues.includes(id));
  for (const id of exp.issues_absent || []) push('issue-' + id, false, act.issues.includes(id));
  return out;
}
const group = f => f.replace(/^issue[+-].*/, 'issues').replace(/^(stage|sdk|icon|listing_langs|requirements|extra)\..*/, '$1');

const dirs = fs.readdirSync(FIX).filter(d => fs.existsSync(path.join(FIX, d, 'expected.json')) && (!ONLY || d.includes(ONLY))).sort();
const perField = {}, mismatches = [], known = [], perFixture = [], ACT = {};
for (const d of dirs) {
  const exp = JSON.parse(fs.readFileSync(path.join(FIX, d, 'expected.json'), 'utf8'));
  const act = await actualOf(path.join(FIX, d), exp); ACT[d] = act;
  const rows = compare(exp, act);
  let bad = 0;
  for (const r of rows) {
    const g = group(r.field), pf = perField[g] = perField[g] || { ok: 0, total: 0, known: 0 };
    pf.total++; if (r.ok) { pf.ok++; continue; }
    const why = KNOWN[d + ':' + r.field] || KNOWN['*:' + r.field];
    if (why) { pf.known++; known.push({ fixture: d, ...r, reason: why }); } else { bad++; mismatches.push({ fixture: d, ...r }); }
  }
  perFixture.push({ fixture: d, checks: rows.length, failed: bad, ok: rows.filter(r => r.ok).length });
  if (VERBOSE) console.log(d, JSON.stringify(act).slice(0, 1500));
}
/* Every issue a fixture produced and every framework label must have texts in all five languages */
const I18N = globalThis.window.RL_I18N, LANGS = ['en', 'ko', 'th', 'zh', 'hi'], seenIssues = new Set(), seenFw = new Set();
if (ACTUAL_OUT) fs.writeFileSync(ACTUAL_OUT, JSON.stringify(ACT, null, 1));
for (const d of dirs) { const a = ACT[d]; if (!a || a.error) continue; a.issues.forEach(i => seenIssues.add(i)); seenFw.add(a.framework); }
const missingTexts = [];
for (const id of seenIssues) for (const l of LANGS) for (const k of ['t', 'w']) if (!I18N[l]['iss.' + id + '.' + k]) missingTexts.push(`iss.${id}.${k} (${l})`);
for (const fw of seenFw) for (const l of LANGS) if (!I18N[l]['fw.' + fw]) missingTexts.push(`fw.${fw} (${l})`);
perField.i18n = { ok: missingTexts.length ? 0 : 1, total: 1, known: 0 };
if (missingTexts.length) mismatches.push({ fixture: '*', field: 'i18n', expected: 'texts in en/ko/th/zh/hi', actual: missingTexts.slice(0, 20), ok: false });
const total = Object.values(perField).reduce((s, x) => s + x.total, 0), ok = Object.values(perField).reduce((s, x) => s + x.ok, 0);
console.log(`\nRocket Launcher simulation: ${dirs.length} fixtures, ${ok}/${total} checks correct (${(100 * ok / Math.max(1, total)).toFixed(1)}%)\n`);
console.log('field'.padEnd(16), 'correct'.padStart(9), '  accuracy');
for (const [k, v] of Object.entries(perField).sort()) console.log(k.padEnd(16), `${v.ok}/${v.total}`.padStart(9), `  ${(100 * v.ok / v.total).toFixed(0)}%${v.known ? ` (${v.known} known limitation${v.known > 1 ? 's' : ''})` : ''}`);
if (mismatches.length) { console.log('\nMismatches:'); for (const m of mismatches) console.log(`  ✗ ${m.fixture} ${m.field}: expected ${JSON.stringify(m.expected)}, got ${JSON.stringify(m.actual)}`); }
if (known.length) { console.log('\nKnown limitations (not failures):'); for (const m of known) console.log(`  ~ ${m.fixture} ${m.field}: ${m.reason}`); }
console.log(`\n${ok} correct, ${mismatches.length} mismatched, ${known.length} known limitations`);
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ date: new Date().toISOString(), version: (await import('../../lib/tools.mjs')).VERSION, fixtures: dirs.length, checks: total, correct: ok, per_field: perField, per_fixture: perFixture, mismatches, known }, null, 2) + '\n');
fs.rmSync(HOME, { recursive: true, force: true });
process.exit(mismatches.length ? 1 : 0);
