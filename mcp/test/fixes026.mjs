/* Rocket Launcher 0.2.6 unit checks for the field reports from two real Android launches (a Capacitor business app and a Korean
   fuel-price app with Android Auto): the submission guide with partial decisions, form factors, store languages from the prepared
   listing, the prepared feature graphic, deletion info in the review notes, the closed-test draft and category names.
   The sim fixtures 101-104 hold the projects. Run: node test/fixes026.mjs */
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), FX = path.join(HERE, 'sim', 'fixtures');
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'rocketlauncher-026-'));
process.env.ROCKETLAUNCHER_HOME = HOME; process.env.ROCKETLAUNCHER_LESSONS_API = 'http://127.0.0.1:9/api/lessons'; process.env.ROCKETLAUNCHER_VERIFY_URLS = '0';
const E = await import('../lib/engine.mjs'); const { Flow, Gen } = await import('../lib/runtime.mjs');
let pass = 0, failN = 0;
const check = (c, name, extra) => { if (c) { pass++; console.log('  ✓', name); } else { failN++; console.log('  ✗', name, extra !== undefined ? JSON.stringify(extra).slice(0, 500) : ''); } };
const connect = async (dir, extra = {}) => (await E.connect({ source: 'path', path: path.join(FX, dir), lang: 'en', ...extra }, { allowPath: true }));
const throwsCode = (f, code) => { try { f(); return false; } catch (e) { return e.code === code; } };
const stepOf = (g, id) => g.steps.find(s => s.id === id) || { fields: [] };
const field = (g, id, re) => (stepOf(g, id).fields.find(f => re.test(f.label)) || {}).value;

console.log('\n[1] submission guide with partial decisions (B9)');
let { st, report } = await connect('104-fuel-map-analysis-folder');
let g = E.guide(E.load(st.id), 'play', 'en');
check(Array.isArray(g.undecided) && g.undecided.includes('langs') && g.undecided.includes('form_factors'), 'guide runs before every decision is made and lists the open ones', g.undecided);
check(/still open/.test(g.note) && g.steps.some(s => s.final && s.locked), 'note names the open decisions; the final submit step stays locked', g.note);
check(field(g, 'p-create', /default lang/i) === '한국어 – ko-KR', 'default language = first listing language (Korean), not the conversation language', field(g, 'p-create', /default lang/i));
check(/Android Auto/.test(field(g, 'p-create', /form factors/i) || ''), 'Android Auto form factor shown in the create-app step', stepOf(g, 'p-create').fields);
check(field(g, 'p-content', /deletion/i) === 'https://simstudio.github.io/fuelmate/delete-account', 'Play deletion URL field uses the documented page, not a <your-site> placeholder', field(g, 'p-content', /deletion/i));
const gen0 = await E.generate(E.load(st.id), { lang: 'en' }, { allowPath: false });
check(gen0.undecided && gen0.undecided.includes('langs') && E.load(st.id).dec.langs === undefined && gen0.listing.ko && !gen0.listing.en, 'materials can be generated before every decision (recommended values, not saved as choices)', gen0.undecided);
const shotsOut = gen0.files.filter(f => /^graphics\/screenshot-/.test(f));
check(shotsOut.length === 6 && fs.readFileSync(path.join(gen0.folder, shotsOut[0])).equals(fs.readFileSync(path.join(FX, '104-fuel-map-analysis-folder', 'play/screenshots/01-home-nearby.png'))), 'prepared screenshots copied unchanged (not reframed)', shotsOut);
check(fs.readFileSync(path.join(gen0.folder, 'graphics/icon-512.png')).equals(fs.readFileSync(path.join(FX, '104-fuel-map-analysis-folder', 'play/icon-512.png'))), 'prepared 512 icon copied unchanged');
const ap0 = E.approve(E.load(st.id), 'play', 'yes', 'en');
check(ap0.approved && ap0.filled_with_recommended && ap0.filled_with_recommended.includes('form_factors'), 'approval works with open decisions and lists the ones filled with the recommended (shown) values', ap0.filled_with_recommended);

console.log('\n[2] form factors decision (B9)');
const D = E.decisions(E.load(st.id), 'en'), ff = D.decisions.find(d => d.key === 'form_factors');
check(ff && JSON.stringify(ff.recommended) === '["phone","android_auto"]' && ff.options.length === 2, 'form_factors decision: phone + Android Auto recommended, phone only as the other option', ff);
let r = E.decide(E.load(st.id), { choices: [{ key: 'form_factors', value: 'Phone, Android Auto' }] }, 'en');
check(JSON.stringify(E.load(st.id).dec.form_factors) === '["phone","android_auto"]', 'aliases accepted ("Phone, Android Auto" → [phone, android_auto])', E.load(st.id).dec.form_factors);
let rejected = false; try { E.decide(E.load(st.id), { choices: [{ key: 'form_factors', value: 'toaster' }] }, 'en'); } catch (e) { rejected = true; }
check(rejected && JSON.stringify(E.load(st.id).dec.form_factors) === '["phone","android_auto"]', 'unknown form factor rejected (saved value unchanged)');
check(JSON.stringify(Flow.normFormFactors(['wear os', 'Google TV'])) === '["phone","wear_os","tv"]' && JSON.stringify(Flow.normFormFactors('Android Automotive')) === '["phone","android_automotive"]', 'normFormFactors maps Wear OS / TV / Automotive names');

console.log('\n[3] store languages from the prepared listing (B3, B5)');
const langs = D.decisions.find(d => d.key === 'langs');
check(JSON.stringify(langs.recommended) === '["ko"]' && JSON.stringify(langs.options[0].value) === '["ko"]', 'Korean-only listing → ["ko"] recommended and offered first', langs.options.slice(0, 3));
check(langs.options.some(o => JSON.stringify(o.value) === '["en"]') && langs.options.some(o => JSON.stringify(o.value) === '["ko","en"]'), 'English-only and Korean + English are still offered');
const title = D.decisions.find(d => d.key === 'title'), short = D.decisions.find(d => d.key === 'short');
check(title.options[0].label === '주유메이트 - 가장 쉬운 주유소 찾기' && /Korean/.test(title.options[0].detail), 'decided Korean title is option 0 (shown in the store language)', title.options[0]);
check(/^로그인 없이/.test(short.options[0].label) && short.options.every(o => o.label.length >= 15), 'prepared Korean short description is option 0; feature headings are not offered as a short description', short.options);
const L = Gen.listing(st.A, 'ko', 'friendly');
check(L.prepared && L.prepared.full && /■ 4가지 유종/.test(L.full), 'prepared full description is used as is', L.full.slice(0, 80));
check(JSON.stringify(Flow.recLangs({ prepared: { listingLangs: ['ko', 'en'], langs: ['ko'], defaultLang: 'ko', files: [] } })) === '["ko","en"]' && JSON.stringify(Flow.recLangs({})) === '["en"]', 'recLangs: listing_languages wins; nothing prepared → English');

console.log('\n[4] prepared feature graphic and screenshots (B6)');
const feat = D.decisions.find(d => d.key === 'feature');
check(feat.recommended === 'existing' && feat.options[0].detail === 'play/feature-graphic-1024x500.png', 'existing feature graphic offered and recommended', feat.options[0]);
check(st.A.screenshots.length === 6 && st.A.screenshots.every(s => s.path.startsWith('play/screenshots/')), 'duplicate screenshots/ set not counted twice (6, from play/)', st.A.screenshots.map(s => s.path));
check(report.app.feature_graphic_found === 'play/feature-graphic-1024x500.png' && report.app.screenshots.length === 6, 'report shows the feature graphic and screenshot paths');

console.log('\n[5] deletion info (A3, B7)');
const del = await E.release('deletion', st.id, {}, 'en');
check(/Menu > 내 계정 > 내 계정 삭제/.test(del.review_note_text) && /simstudio\.github\.io\/fuelmate\/delete-account/.test(del.review_note_text) && !/<your-site>|\[/.test(del.review_note_text), 'review note text uses the documented in-app path and web page', del.review_note_text);
check(del.in_app_path === 'Menu > 내 계정 > 내 계정 삭제' && /Delete account URL/.test(del.play_console_field), 'deletion check returns in_app_path and the Play Console field', del);
const notes = await E.release('notes', st.id, {}, 'en');
check(/Menu > 내 계정 > 내 계정 삭제/.test(notes.play_review_notes) && !/<your-site>/.test(notes.play_review_notes), 'reviewer notes carry the same path and URL', notes.play_review_notes);

console.log('\n[6] closed-test draft (B10)');
const ct = await E.release('closed_test', st.id, { action: 'application_draft' }, 'en');
const v = ct.sections.about_your_app.value;
check(/^주유메이트 - 가장 쉬운 주유소 찾기: 로그인 없이/.test(v) && /4가지 유종/.test(v) && !/Reconstructed|Sign in with Google|back up and sync/i.test(v), 'value = prepared title, short description and features (not the meta README, not "Google sign-in backup")', v);
check(/prepared store listing \(ko\)/.test(ct.listing_source || ''), 'listing_source names the prepared files', ct.listing_source);

console.log('\n[7] stale bundled privacy page (B8) and ads switched off (B2)');
const stale = st.A.issues.find(i => i.id === 'privacyStale');
check(stale && /assets\/public\/site\/privacy\.html \(bundled in the app\)/.test(stale.vars.file) && /com\.sim\.oldfuel/.test(stale.vars.why) && /operator "Sample Labs" differs from "Example Studio"/.test(stale.vars.why), 'bundled privacy page naming an old package and operator → privacyStale', stale);
const I18N = globalThis.window.RL_I18N;
check(['en', 'ko', 'th', 'zh', 'hi'].every(l => ['iss.privacyStale.t', 'iss.privacyStale.w', 'dec.form_factors', 'dec.form_factors.d', 'feat.existing'].every(k => I18N[l][k])), 'new texts in en/ko/th/zh/hi');
check(!st.A.sdk.ads && !st.A.adsHint && report.app.ads_disabled && report.app.ads_disabled.source === 'ads switched off in code', 'AdMob block with adsEnabled: false → no ads, no hint, reported as ads_disabled', report.app.ads_disabled);
check(st.A.pkg === 'com.sim.fuelmate', '"applicationId is ..." in a gradle comment is not read as the package (B1)', st.A.pkg);

console.log('\n[8] generate with the existing feature graphic');
E.decide(E.load(st.id), { choices: [{ key: 'stage:play', value: 'not_submitted' }], accept_all_recommended: true }, 'en');
const gen = await E.generate(E.load(st.id), { lang: 'en' }, { allowPath: false });
const fg = path.join(gen.folder, 'graphics', 'feature-graphic-1024x500.png');
check(fs.existsSync(fg) && fs.readFileSync(fg).equals(fs.readFileSync(path.join(FX, '104-fuel-map-analysis-folder', 'play', 'feature-graphic-1024x500.png'))), 'generated materials copy the prepared feature graphic byte for byte');
check(gen.listing.ko && gen.listing.ko.google_play.title === '주유메이트 - 가장 쉬운 주유소 찾기' && !gen.listing.en, 'listing is Korean only', Object.keys(gen.listing));
g = E.guide(E.load(st.id), 'play', 'en');
check(!g.undecided && /Phone \+ Android Auto/.test(field(g, 'p-create', /form factors/i) || ''), 'after the decisions: no undecided list, form factors kept', g.undecided);

console.log('\n[9] T-FLOW-like project: targetSdk, removed permissions, built AAB, category (A1, A2, A4, A5)');
({ st, report } = await connect('101-capacitor-business-variables-ternary'));
check(st.A.android.targetSdk === 36 && !/hasProperty/.test(st.A.android.targetSdkRaw || ''), 'targetSdk 36 from variables.gradle; the plugin ternary fallback (35) is ignored', st.A.android.targetSdkRaw);
check(!st.A.android.permissions.some(p => /LOCATION|EXTERNAL_STORAGE/.test(p)) && !st.A.sdk.location, 'tools:node="remove" permissions are not counted', st.A.android.permissions);
check(report.app.built_binary && report.app.built_binary.targetSdk === 36 && /app-release\.aab$/.test(report.app.built_binary.file), 'built AAB manifest read (targetSdk 36)', report.app.built_binary);
const rq = await E.release('requirements', st.id, {}, 'en'), k16 = rq.rows.find(x => x.id === 'play.16kb_page_size');
check(k16.severity === 'ok' && /contains no native libraries/.test(k16.finding), '16 KB: the built bundle has no .so → does not apply', k16.finding);
check(st.A.categories[0] === 'business' && /store listing draft/.test(report.app.category_source), 'Business category from the listing draft', report.app.category_source);
check(report.app.sign_in_required && E.decisions(st, 'en').decisions.find(d => d.key === 'access').recommended === 'required', 'staff-only listing ("회사 직원 전용", approval needed) → sign-in required recommended', report.app.sign_in_required);
check(!/Signing in is optional/.test((await E.release('notes', st.id, {}, 'en')).play_review_notes), 'reviewer notes do not claim sign-in is optional');

console.log('\n[10] rocketlauncher.json overrides');
({ st, report } = await connect('103-config-category-language-deletion'));
check(st.A.categories[0] === 'business' && /project config/.test(report.app.category_source), 'category "Business" from rocketlauncher.json wins', report.app);
check(report.app.account_deletion && report.app.account_deletion.url === 'https://simstudio.github.io/shiftnote/account/delete' && report.app.account_deletion.in_app_path === 'Settings > Account > Delete account', 'account_deletion_url / account_deletion_path from rocketlauncher.json', report.app.account_deletion);
check(JSON.stringify(E.decisions(st, 'en').decisions.find(d => d.key === 'langs').recommended) === '["ko"]', 'default_language ko-KR → Korean store listing recommended');
const RT = await import('../lib/runtime.mjs');
const catOf = c => { const A = RT.Analyzer.catKey ? RT.Analyzer.catKey(c) : null; return A; };
if (RT.Analyzer.catKey) check(['Maps & Navigation', 'MAPS_AND_NAVIGATION', '지도/내비게이션', 'Navigation'].every(c => catOf(c) === 'navigation') && catOf('Business') === 'business' && catOf('비즈니스') === 'business' && catOf('Toaster apps') == null, 'category names: Play, Apple, constant and Korean forms map to one key', ['Maps & Navigation', 'MAPS_AND_NAVIGATION', '지도/내비게이션', 'Business', '비즈니스'].map(catOf));
const tmp = path.join(HOME, 'badcat'); fs.cpSync(path.join(FX, '103-config-category-language-deletion'), tmp, { recursive: true });
fs.writeFileSync(path.join(tmp, 'rocketlauncher.json'), JSON.stringify({ category: 'Toaster apps' }));
const bad = (await E.connect({ source: 'path', path: tmp, lang: 'en' }, { allowPath: true })).report;
check(/not a known store category/.test(bad.app.category_warning || ''), 'unknown category in rocketlauncher.json → category_warning', bad.app.category_warning);

console.log(`\n${pass} passed, ${failN} failed`);
fs.rmSync(HOME, { recursive: true, force: true });
process.exit(failN ? 1 : 0);
