/* Rocket Launcher MCP — 흐름 엔진. 웹 앱과 같은 분석기·생성기·흐름 모듈을 쓰고, 상태는 로컬 JSON 으로 저장한다.
   어떤 함수도 스토어에 제출하지 않는다. 제출은 사용자가 콘솔에서 직접 한다. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { Analyzer, Gen, Gfx, Flow, Sources, Zip, CFG, tr, hasGraphics, Lessons } from './runtime.mjs';
import { msg } from './messages.mjs';
import { withLessons, relevantLessons, listLessons } from './lessons.mjs';
import { shareLesson, shareCorrection } from './shared.mjs';
import * as RL from './release.mjs';
import { iconCheck } from './icons.mjs';

/* Texts come in five languages; English is the default whenever lang is omitted or unknown. */
export const LANGS = ['en', 'ko', 'th', 'zh', 'hi'];
export const HOME = process.env.ROCKETLAUNCHER_HOME || path.join(os.homedir(), '.rocketlauncher');
const PROJ = path.join(HOME, 'projects');
/* 'ko' → ko, 'zh-TW' / 'zh-CN' / 'zh-Hans' / 'zh-Hant' → zh, 'th_TH' → th; anything else → en */
export const normLang = l => { const p = String(l || '').trim().toLowerCase().split(/[-_]/)[0]; return LANGS.includes(p) ? p : 'en'; };
const STORE_NAME = { play: 'Google Play', apple: 'App Store' };
const BIN_DIRS = new Set(['dist', 'build', 'release', 'outputs']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'build', '.gradle', 'Pods', 'DerivedData', '.dart_tool', '.idea', 'intermediates', 'generated', '.expo', '.next', 'dist', '.cxx']);

export class UserError extends Error { constructor(m, code) { super(m); this.code = code || 'user'; } }

/* ---------- 저장 ---------- */
const idOk = id => typeof id === 'string' && /^[a-z0-9][\w.-]{2,80}$/i.test(id);
const dirOf = id => path.join(PROJ, id);
function save(st) { fs.mkdirSync(dirOf(st.id), { recursive: true }); st.updatedAt = new Date().toISOString(); fs.writeFileSync(path.join(dirOf(st.id), 'state.json'), JSON.stringify(st)); }
export function load(id, lang) {
  if (!idOk(id)) throw new UserError(msg(normLang(lang), 'noProject', { id }), 'noProject');
  const f = path.join(dirOf(id), 'state.json');
  if (!fs.existsSync(f)) throw new UserError(msg(normLang(lang), 'noProject', { id }), 'noProject');
  const st = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (st.corrections) RL.applyCorrections(st);
  return st;
}
const T = lang => (k, v) => tr(lang, k, v);
const appName = (st, lang) => Gen.nameOf(st.A, lang);

/* ---------- 1. 연결 + 분석 ---------- */
async function walkDir(root) {
  const top = path.basename(path.resolve(root)) || 'project'; const out = [];
  async function walk(dir, rel) {
    let ents; try { ents = await fs.promises.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      if (out.length > 20000) return;
      const abs = path.join(dir, e.name), r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) await walk(abs, r); else if (BIN_DIRS.has(e.name)) await walkBins(abs, r, 0); }
      else if (e.isFile()) {
        let size = 0; try { size = (await fs.promises.stat(abs)).size; } catch { continue; }
        out.push({ name: e.name, webkitRelativePath: top + '/' + r, size, arrayBuffer: async () => { const b = await fs.promises.readFile(abs); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); } });
      }
    }
  }
  /* 0.2.6: build output folders are skipped, except built app bundles / APKs (dist/app-release.aab, build/outputs/bundle/…) */
  let binDirs = 0;
  async function walkBins(dir, rel, depth) {
    if (depth > 6 || ++binDirs > 400) return;
    let ents; try { ents = await fs.promises.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const abs = path.join(dir, e.name), r = rel + '/' + e.name;
      if (e.isDirectory()) { if (!['intermediates', 'tmp', 'node_modules', '.git', 'generated', 'kotlin', 'cxx', '.cxx'].includes(e.name)) await walkBins(abs, r, depth + 1); }
      else if (e.isFile() && /\.(aab|apk)$/i.test(e.name)) { let size = 0; try { size = (await fs.promises.stat(abs)).size; } catch { continue; } out.push({ name: e.name, webkitRelativePath: top + '/' + r, size, arrayBuffer: async () => { const b = await fs.promises.readFile(abs); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); } }); }
    }
  }
  await walk(path.resolve(root), '');
  return out;
}
export async function connect({ source, github_url, path: p, lang, store_stage }, { allowPath }) {
  const L = normLang(lang); const t = T(L);
  let project;
  try {
    if (source === 'sample') project = await Sources.sample();
    else if (source === 'github') project = await Sources.fromGitHub(github_url || '');
    else if (source === 'path') {
      if (!allowPath) throw new UserError(msg(L, 'pathDisabled'), 'pathDisabled');
      const abs = path.resolve(String(p || '').replace(/^~(?=$|\/)/, os.homedir()));
      const stat = fs.statSync(abs);
      if (stat.isFile() && /\.zip$/i.test(abs)) { const b = fs.readFileSync(abs); project = await Sources.fromZipFile({ name: path.basename(abs), arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }); }
      else if (stat.isDirectory()) project = await Sources.fromFileList(await walkDir(abs));
      else throw new UserError(t('err.noapp'), 'noapp');
    } else throw new UserError('source must be sample | github | path', 'badsource');
  } catch (e) {
    if (e instanceof UserError) throw e;
    if (e.code === 'ENOENT') throw new UserError(String(e.message), 'notfound');
    throw new UserError(t('err.' + (e.code || 'generic')) + (e.code ? '' : ' (' + e.message + ')'), e.code || 'generic');
  }
  const A = Analyzer.analyze(project);
  if (!A.platforms.android && !A.platforms.ios) throw new UserError(t('err.noapp'), 'noapp');
  /* 0.2.3: icon pixels (blank / solid icon, iOS ↔ Android match), privacy URL reachability, stage recorded for the same app earlier */
  try { A.iconCheck = await iconCheck(A.icons); } catch (e) { A.iconCheck = null; }
  /* never build store graphics from a blank icon when the other platform has real artwork */
  const IC = A.iconCheck;
  if (IC && A.icon) for (const [a, b] of [['ios', 'android'], ['android', 'ios']]) if (IC[a] && IC[a].blank && A.icon.path === IC[a].path && IC[b] && !IC[b].blank && A.icons[b]) A.icon = { ...A.icons[b] };
  if (source !== 'sample') await verifyPrivacyUrls(A);
  if (source !== 'sample') A.stageRecords = earlierStages(A);
  Analyzer.refreshIssues(A);
  A.brandColor = A.brandColor || (hasGraphics ? await Gfx.avgColor(A.icon && A.icon.dataUrl) : '#2f6f5e');
  const id = Flow.slugOf(A).toLowerCase().replace(/[^a-z0-9.-]+/g, '-').slice(0, 40).replace(/^[^a-z0-9]+/, 'app') + '-' + crypto.randomBytes(5).toString('hex');
  const st = { id, v: 1, createdAt: new Date().toISOString(), lang: L, sample: source === 'sample', source: project.source, A, dec: {}, approved: {}, review: {}, generated: null };
  /* 0.2.0: code scan for release checks (native libraries, required-reason APIs, deletion path, policy signals). Paths only, never secrets. */
  try { st.X = RL.scanProject(project, A); } catch (e) { st.X = null; st.scanError = String(e.message || e); }
  /* A stage written in the project config (store_stage / app_store_state / play_state) is the developer's own record: it is used
     unless store_stage is passed here. A stage from an earlier Rocket Launcher project is only recommended (the user confirms). */
  for (const k of Flow.storesOf(A)) {
    const r = Flow.stageRecorded({ ...A, stageRecords: null }, k);
    if (r && !(store_stage && (typeof store_stage === 'string' || store_stage[k] != null))) { st.dec['stage:' + k] = r.stage; st.stageSource = { ...(st.stageSource || {}), [k]: r.source }; syncStage(st, k); }
  }
  /* Optional store_stage: a stage for every store ('live') or per store ({ play: 'live', apple: 'in_review' }). Never guessed silently. */
  if (store_stage) {
    for (const k of Flow.storesOf(A)) {
      const v = typeof store_stage === 'string' ? store_stage : store_stage[k];
      if (v == null) continue;
      if (!Flow.STAGES.includes(v)) throw new UserError(msg(L, 'badValue', { key: 'store_stage.' + k, val: JSON.stringify(v) }), 'badValue');
      st.dec['stage:' + k] = v; syncStage(st, k);
    }
  }
  save(st);
  return { st, report: report(st, L) };
}

/* 0.2.7: probe a privacy URL. Browser-like headers; HEAD first, then GET if HEAD is not OK
   (Cloudflare Workers often answer HEAD with 401 while GET returns 200). 4 s timeout, never fatal.
   404/410/5xx → dead. 401/403 or a network failure → unverified (미확인), not a hard failure.
   Off with ROCKETLAUNCHER_VERIFY_URLS=0. */
const URL_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,ko;q=0.8,th;q=0.7,zh;q=0.6,hi;q=0.5'
};
const urlDead = s => s === 404 || s === 410 || (s >= 500 && s <= 599);
const urlBlocked = s => s === 401 || s === 403;
async function probeUrl(u) {
  const go = m => fetch(u, { method: m, redirect: 'follow', signal: AbortSignal.timeout(4000), headers: URL_HEADERS });
  const readBody = async r => { try { return (await r.text()).slice(0, 500000); } catch { return null; } };
  try {
    let head = null;
    try { head = await go('HEAD'); } catch { head = null; }
    const needGet = !head || !head.ok;
    const r = needGet ? await go('GET') : head;
    let body = null;
    if (r.ok && needGet) body = await readBody(r);
    else if (r.ok && !needGet) { try { const g = await go('GET'); if (g.ok) body = await readBody(g); } catch { } }
    return { status: r.status, ok: r.ok, unverified: !r.ok && (urlBlocked(r.status) || r.status == null), body };
  } catch (e) {
    return { status: null, ok: false, unverified: true, error: String(e && (e.cause && e.cause.code || e.name) || e).slice(0, 60) };
  }
}
async function verifyPrivacyUrls(A) {
  const L = A.listing; if (!L || !(L.privacyCandidates || []).length || process.env.ROCKETLAUNCHER_VERIFY_URLS === '0') return;
  const urls = [...new Set(L.privacyCandidates.map(c => c.url))].slice(0, 4), res = {};
  await Promise.all(urls.map(async u => { res[u] = await probeUrl(u); }));
  L.privacyCandidates.forEach(c => { const ckv = res[c.url]; if (!ckv) return; c.check = { status: ckv.status, ok: ckv.ok, unverified: !!ckv.unverified, error: ckv.error, has_body: !!ckv.body }; });
  const chosen = L.privacyUrl && res[L.privacyUrl];
  L.privacyDead = !!(chosen && chosen.status && urlDead(chosen.status));
  L.privacyUnverified = !!(chosen && !L.privacyDead && !chosen.ok);
  L.privacyBody = (chosen && chosen.body) || null;
  L.privacyFetched = !!(chosen && chosen.ok && chosen.body);
}
/* The same app (same package / bundle id) connected earlier on this computer with a stage the user chose or a review in progress. */
function earlierStages(A) {
  const out = {}; if (!A.pkg) return out;
  let best = null;
  for (const id of listProjects()) {
    let o; try { o = JSON.parse(fs.readFileSync(path.join(dirOf(id), 'state.json'), 'utf8')); } catch { continue; }
    if (!o || !o.A || o.A.pkg !== A.pkg || o.sample) continue;
    if (!best || String(o.updatedAt || '') > String(best.updatedAt || '')) best = o;
  }
  if (!best) return out;
  for (const k of ['play', 'apple']) {
    const R = (best.review || {})[k], d = (best.dec || {})['stage:' + k];
    const fromReview = R && ({ in_review: 'in_review', submitted: 'in_review', rejected: 'rejected', fixing: 'rejected', live: 'live', approved: 'live' })[R.status];
    const stage = fromReview || (d && Flow.STAGES.includes(d) && d !== 'not_submitted' ? d : null);
    if (stage) out[k] = { stage, source: 'earlier Rocket Launcher project ' + best.id + (best.updatedAt ? ' (' + String(best.updatedAt).slice(0, 10) + ')' : '') };
  }
  return out;
}

/* ---------- stage helpers (0.1.5) ---------- */
/* A store already in review or rejected outside Rocket Launcher starts in that review state; a store moved back to "not submitted" / "live" drops it. */
function syncStage(st, k) {
  const s = st.dec['stage:' + k], R = st.review[k];
  if (R && !R.external && R.status !== 'none') return;   // a review Rocket Launcher tracked itself is never overwritten
  if (s === 'in_review') st.review[k] = { status: 'in_review', round: 1, external: true };
  else if (s === 'rejected') st.review[k] = { status: 'rejected', round: 1, external: true };
  else delete st.review[k];
}
/* Keep-values that are no longer allowed (stage went back to first submit) are cleared so they are asked again. */
function dropStaleKeep(st) {
  const list = Flow.decisions(st.A, st.dec);
  for (const [k, v] of Object.entries(st.dec)) if (v === 'keep') { const d = list.find(x => x.key === k); if (!d || !d.keep) delete st.dec[k]; }
  for (const k of Object.keys(st.dec)) if (k.startsWith('binary:') && !list.find(x => x.key === k)) delete st.dec[k];
}
/* Values filled by accept_all_recommended follow the recommendation when a stage changes; values the user picked are kept. */
function refreshAuto(st) {
  const list = Flow.decisions(st.A, st.dec);
  for (const k of st.auto || []) { const d = list.find(x => x.key === k); if (!d) { delete st.dec[k]; continue; } st.dec[k] = Flow.recValue(d); }
  st.auto = (st.auto || []).filter(k => st.dec[k] !== undefined);
}
/* 0.2.8: short notes in the connect report, in the user's language */
const NOTES = {
  en: { catOwn: 'The first category comes from {src}. The others are only suggestions; they are not categories you chose.', catGuess: 'All categories are suggestions from the app text; pick one.',
    earlier: 'Not verified (미확인): this comes from a version number or ID found in the project, not from the store console. It is not proof that an upload happened.',
    built: 'The built file differs from the source files (differs_from_source lists the source value and the built value). The built values are used; rebuild if the source is newer. A value that matches one of the product flavors is not counted as a difference.' },
  ko: { catOwn: '첫 번째 카테고리는 {src}에서 가져왔어요. 나머지는 추천일 뿐, 직접 고른 카테고리가 아니에요.', catGuess: '모든 카테고리는 앱 문구를 보고 추천한 거예요. 하나를 골라 주세요.',
    earlier: '미확인: 스토어 콘솔이 아니라 프로젝트에 있는 버전 번호나 ID에서 나온 힌트예요. 업로드했다는 증거가 아니에요.',
    built: '빌드 파일이 소스 파일과 달라요(differs_from_source에 소스 값과 빌드 값이 있어요). 빌드 값을 써요. 소스가 더 새로우면 다시 빌드해요. 제품 플레이버 값 중 하나와 같으면 차이로 세지 않아요.' },
  th: { catOwn: 'หมวดหมู่แรกมาจาก {src} ที่เหลือเป็นเพียงคำแนะนำ ไม่ใช่หมวดหมู่ที่คุณเลือก', catGuess: 'ทุกหมวดหมู่เป็นคำแนะนำจากข้อความในแอป เลือกหนึ่งหมวด',
    earlier: 'ยังไม่ยืนยัน (미확인): มาจากหมายเลขเวอร์ชันหรือ ID ในโปรเจกต์ ไม่ใช่จากคอนโซลของสโตร์ จึงไม่ได้พิสูจน์ว่าเคยอัปโหลด',
    built: 'ไฟล์บิลด์ต่างจากซอร์ส (differs_from_source แสดงค่าในซอร์สและค่าในบิลด์) จะใช้ค่าจากบิลด์ ถ้าซอร์สใหม่กว่าให้บิลด์ใหม่ ค่าที่ตรงกับ product flavor ใดก็ตามไม่นับว่าต่าง' },
  zh: { catOwn: '第一个类别来自 {src}，其余只是建议，不是你选的类别。', catGuess: '所有类别都是根据应用文字给出的建议，请选一个。',
    earlier: '未确认（미확인）：这来自项目里的版本号或 ID，不是来自商店控制台，不能证明已经上传过。',
    built: '构建文件与源码不同（differs_from_source 列出了源码值和构建值），以构建值为准；如果源码更新，请重新构建。与某个产品变体（flavor）相同的值不算差异。' },
  hi: { catOwn: 'पहली कैटेगरी {src} से ली गई है। बाकी सिर्फ़ सुझाव हैं, आपकी चुनी हुई कैटेगरी नहीं।', catGuess: 'सारी कैटेगरी ऐप के टेक्स्ट से सुझाई गई हैं; एक चुनें।',
    earlier: 'पुष्टि नहीं (미확인): यह प्रोजेक्ट के वर्ज़न नंबर या ID से आया है, स्टोर कंसोल से नहीं। यह अपलोड होने का सबूत नहीं है।',
    built: 'बिल्ड फ़ाइल सोर्स से अलग है (differs_from_source में सोर्स और बिल्ड दोनों मान हैं)। बिल्ड वाले मान इस्तेमाल होते हैं; सोर्स नया हो तो फिर से बिल्ड करें। किसी product flavor से मेल खाने वाला मान अंतर नहीं गिना जाता।' }
};
const note = (L, k, v) => ((NOTES[L] || NOTES.en)[k] || NOTES.en[k]).replace(/\{(\w+)\}/g, (m, x) => (v && v[x] !== undefined ? String(v[x]) : m));
const EV = { 'play-url': 'Google Play link', 'apple-url': 'App Store link', 'fastlane-play': 'fastlane Play metadata', 'fastlane-apple': 'fastlane App Store metadata', 'fastlane-deliver': 'fastlane deliver', 'play-changelogs': 'Play release notes' };
function stageInfo(st, L) {
  const t = T(L), o = {};
  for (const k of Flow.storesOf(st.A)) {
    const h = Flow.stageHints(st.A, k), cur = Flow.stageOf(st.dec, k), rec = Flow.stageRec(st.A, k, st.dec);
    o[STORE_NAME[k]] = { key: 'stage:' + k, current: cur, current_label: cur ? t('stage.' + cur) : null, recommended: rec,
      recommended_label: rec === 'unknown' ? 'unknown — please confirm' : t('stage.' + rec),
      recorded: cur && st.stageSource && st.stageSource[k] ? st.stageSource[k] : h.recorded ? `${h.recorded.stage} (${h.recorded.source})` : undefined,
      evidence: h.evidence.map(e => EV[e] || e), earlier_upload_hint: h.weak || undefined, earlier_upload_hint_note: h.weak ? note(L, 'earlier') : undefined, store_url: h.url || undefined };
  }
  return o;
}
const undecidedStages = st => Flow.storesOf(st.A).filter(k => !Flow.stageOf(st.dec, k));
function stageNext(st, L) {
  const u = undecidedStages(st);
  if (u.length) return msg(L, 'stageFirst', { keys: u.map(k => 'stage:' + k).join(', '), rec: u.map(k => { const r = Flow.stageRec(st.A, k, st.dec); return `${STORE_NAME[k]} = ${r === 'unknown' ? 'unknown — please confirm' : r}`; }).join(', ') });
  const ks = Flow.storesOf(st.A);
  const rj = ks.filter(k => st.review[k] && st.review[k].status === 'rejected' && !st.review[k].text);
  if (rj.length) return msg(L, 'nextRejected', { store: rj.map(k => 'store=' + k).join(', ') });
  const ir = ks.filter(k => st.review[k] && st.review[k].external && st.review[k].status === 'in_review');
  if (ir.length) return msg(L, 'nextInReview', { store: ir.map(k => STORE_NAME[k]).join(', ') });
  const lv = ks.filter(k => Flow.stageOf(st.dec, k) === 'live');
  if (lv.length) return msg(L, 'nextLive', { store: lv.map(k => STORE_NAME[k]).join(', ') });
  return null;
}

/* ---------- 2. 분석 보고 ---------- */
export function report(st, lang) {
  const L = normLang(lang || st.lang), t = T(L), A = st.A, issues = Flow.issuesFor(A, st.dec);
  const c = { block: 0, warn: 0, check: 0, tip: 0 }; issues.forEach(i => c[i.sev]++);
  return {
    project_id: st.id,
    summary: msg(L, 'connected', { name: appName(st, L), ready: A.readiness }) + (A.readiness >= 96 ? msg(L, 'readyCap') : '') + ' ' + msg(L, 'counts', c),
    app: { name: appName(st, L), package: A.pkg || null, version: A.version, platforms: Object.keys(A.platforms).filter(k => A.platforms[k]), framework: A.framework,
      targetSdk: (A.android && A.android.targetSdk) || null, categories: A.categories.map(k => Gen.CAT[k] ? `${Gen.CAT[k][L][1]} (${Gen.CAT[k].play})` : k),
      category_source: A.categorySource || undefined, category_note: /^(project config|store listing)/.test(A.categorySource || '') ? note(L, 'catOwn', { src: A.categorySource }) : note(L, 'catGuess'),
      sdks: Object.entries(A.sdk).filter(([, v]) => v).map(([k]) => k), default_language: (A.prepared && A.prepared.defaultLang) || null, languages_in_app: A.locales, icon_found: !!A.icon, screenshots_found: A.screenshots.length,
      source: st.source, privacy_url_found: (A.developer && A.developer.privacyUrl) || null, ...privacyInfo(A), icon_check: A.iconCheck || undefined,
      ads_hint: A.adsHint ? { note: 'An ad SDK name appears only in app code, not in any dependency or native config; not treated as ads.', files: A.adsHint.files } : undefined,
      ...extraInfo(A) },
    store_stage: stageInfo(st, L),
    readiness: A.readiness, counts: c,
    issues: issues.map(i => ({ key: i.fix && i.fix !== 'info' ? Flow.issueKey(i) : null, severity: t('sev.' + i.sev), sev: i.sev, store: i.plat === 'android' ? 'Google Play' : i.plat === 'ios' ? 'App Store' : 'both',
      title: t('iss.' + i.id + '.t', i.vars), why: t('iss.' + i.id + '.w', i.vars), ai_fix: i.fix && i.fix !== 'info' ? t('iss.' + i.id + '.f', i.vars) : null })),
    release_checks: releaseSafe(st, L),
    ...learned(st, L),
    next: stageNext(st, L) || msg(L, 'nextDecide', { n: Flow.decisions(A, st.dec).length })
  };
}
/* 0.2.6: where the less obvious facts came from, so a wrong value can be traced and overridden in rocketlauncher.json */
function extraInfo(A) {
  const P = A.prepared, an = A.android || {}, D = A.deletionInfo || {};
  return {
    category_source: A.categorySource || 'suggested from the app name, text and libraries; no category was found in rocketlauncher.json or a store listing draft (please confirm, or set "category" in rocketlauncher.json)',
    sign_in_required: A.accessRestricted ? { source: A.accessRestricted.source, evidence: A.accessRestricted.text || undefined, note: 'The app is only for approved users, so reviewers need a demo account (App access: restricted).' } : undefined,
    needs_confirmation: (() => { const n = [];
      if (!A.categorySource) n.push('category (guessed)');
      if (!(A.prepared && (A.prepared.defaultLang || A.prepared.listingLangs))) n.push('store languages and default language (no prepared listing or default_language found; English is only a suggestion)');
      if (A.platforms.android && !(A.android && A.android.targetSdk)) n.push('targetSdk (not readable from source or a built file)');
      if (A.sdk.auth && !(A.deletionInfo && A.deletionInfo.url)) n.push('account deletion web URL (not found)');
      return n.length ? n : undefined; })(),
    category_warning: A.categoryConfigUnknown ? `rocketlauncher.json category "${A.categoryConfigUnknown}" is not a known store category; set it to a Google Play category name such as "Business" or "Maps & Navigation".` : undefined,
    ads_disabled: A.adsDisabled ? { note: 'An ad SDK is mentioned but switched off (or rocketlauncher.json says ads: false); not treated as ads.', source: A.adsDisabled.source, files: A.adsDisabled.files || undefined } : undefined,
    built_binary: an.built ? { file: an.built.file, kind: an.built.kind, targetSdk: an.built.targetSdk || undefined, package: an.built.package || undefined, versionCode: an.built.versionCode || undefined, versionName: an.built.versionName || undefined, differs_from_source: an.builtMismatch && an.builtMismatch.length ? an.builtMismatch : undefined, note: an.builtMismatch && an.builtMismatch.length ? note(L, 'built') : undefined } : undefined,
    form_factors: an.formFactors && an.formFactors.length ? ['phone', ...an.formFactors] : undefined,
    feature_graphic_found: A.featureGraphic ? A.featureGraphic.path : undefined,
    prepared_forms: A.preparedForms && Object.values(A.preparedForms).some(Boolean) ? Object.fromEntries(Object.entries(A.preparedForms).filter(([, v]) => v)) : undefined,
    screenshots: A.screenshots.length ? A.screenshots.map(x => x.path) : undefined,
    prepared_listing: P && P.files.length ? { files: P.files, default_language: P.defaultLang || undefined, languages: P.langs, titles: Object.fromEntries(Object.entries(P.copy).filter(([, c]) => c.title).map(([l, c]) => [l, c.title])) } : undefined,
    account_deletion: D.url || D.inAppPath ? { url: D.url || undefined, url_source: D.urlSource || undefined, in_app_path: D.inAppPath || undefined, path_source: D.pathSource || undefined } : undefined
  };
}
function privacyInfo(A) {
  const L = A.listing || {}, C = L.privacyCandidates || [];
  if (!C.length) return {};
  return { privacy_url_source: L.privacySource || undefined,
    privacy_url_candidates: C.length > 1 || L.privacyConflict || L.privacyWeak || L.privacyDead || L.privacyUnverified ? C.map(c => ({ url: c.url, file: c.file, source: c.source, ...(c.check ? { http_status: c.check.status, reachable: c.check.ok, unverified: c.check.unverified || undefined } : {}) })) : undefined,
    privacy_url_warning: L.privacyConflict ? 'Privacy policy URLs in the project disagree; the one from the most authoritative source is shown. Confirm which is current (or set privacy_url in rocketlauncher.json).'
      : L.privacyWeak ? 'A privacy URL was found only in a loose website file, not in the app config, store metadata or README, so it was not adopted. Confirm it is current (or set privacy_url in rocketlauncher.json).'
      : L.privacyDead ? 'The privacy policy URL did not respond with a page (HTTP ' + ((C.find(c => c.url === L.privacyUrl) || {}).check || {}).status + '). Check it before submitting.'
      : L.privacyUnverified ? 'The privacy policy URL could not be verified (미확인, HTTP ' + (((C.find(c => c.url === L.privacyUrl) || {}).check || {}).status || 'unknown') + '). Confirm that the link opens; no finding was made about the page contents.'
      : undefined };
}
function releaseSafe(st, L) { try { return RL.releaseChecks(st, L); } catch (e) { return { error: 'Release checks could not run: ' + e.message }; } }
/* Lessons learned on this machine from earlier store reviews (any project). Warnings or reminders only; built-in checks stay the default. */
function learned(st, L) {
  const rel = relevantLessons(st.A, Flow.stores(st.A, st.dec), L);
  return rel.length ? { learned_lessons: rel, learned_note: msg(L, 'learnedNote', { n: rel.length }) } : {};
}
const withLearnedNotes = (notes, rel) => { const x = Lessons.reviewNoteLines(rel || []); return x.length ? [notes, ...x].filter(Boolean).join('\n\n') : notes; };

/* ---------- 3. 결정 ---------- */
const STYLE = { icon: ['original', 'brand', 'light'], feature: ['split', 'shot', 'minimal'] };
function optionList(st, d, L) {
  const A = st.A, t = T(L), C = Flow.chosen(A, st.dec);
  if (d.group === 'stage') { const b = d.key.startsWith('binary:') ? 'binary.' : 'stage.'; return d.opts.map(o => ({ value: o, label: t(b + o), detail: t(b + o + '.d') })); }
  const base = optionBase(st, d, L, A, t, C);
  if (!d.keep) return base;
  const cur = d.key === 'privacy' ? (A.developer && A.developer.privacyUrl) || t('opt.keep.d') : t('opt.keep.d');
  const k = { value: 'keep', label: t('opt.keep'), detail: cur };
  return d.keepRec === false ? [...base, k] : [k, ...base];
}
function optionBase(st, d, L, A, t, C) {
  if (d.group === 'fix') {
    const is = d.issue, p = Gen.patches(A, L)[is.fix];
    return d.opts.map(o => ({ value: o, label: t('opt.' + o), detail: o === 'apply' ? t('iss.' + is.id + '.f', is.vars) + (p ? ` → ${p.file}` : '') : o === 'later' ? t('opt.later.d') : t('opt.' + o + '.d') }));
  }
  switch (d.key) {
    case 'stores': return d.opts.map(o => ({ value: o, label: t('store.' + o) }));
    /* 0.2.6: shown in the store's (first listing) language when the conversation language is not one of the listing languages */
    case 'title': { const ll = C.langs.includes(L) ? L : C.langs[0], tag = ll !== L ? ` · ${t('lang.' + ll)}` : ''; return C.listing(ll).titles.map((v, k) => ({ value: k, label: v, detail: `${v.length}/30${tag}` })); }
    case 'short': { const ll = C.langs.includes(L) ? L : C.langs[0], tag = ll !== L ? ` · ${t('lang.' + ll)}` : ''; return C.listing(ll).shorts.map((v, k) => ({ value: k, label: v, detail: `${v.length}/80${tag}` })); }
    case 'tone': return ['friendly', 'pro'].map(o => ({ value: o, label: t('tone.' + o), detail: Gen.listing(A, L, o).full.split('\n')[0].slice(0, 120) }));
    case 'category': return A.categories.map((c, k) => ({ value: k, label: Gen.CAT[c][L][1], detail: `Play: ${Gen.CAT[c].play} · Apple: ${Gen.CAT[c].apple}` }));
    case 'langs': { const nm = v => v.map(l => t('lang.' + l)).join(' + ');
      /* 0.2.6: the languages of the prepared listing come first (a Korean-only listing is offered as Korean only), then single languages */
      const rec = (d.recLangs || Flow.DEFAULT_LANGS).slice(), P = A.prepared, base = [];
      const push = (value, label, detail) => { if (!base.some(o => JSON.stringify(o.value) === JSON.stringify(value))) base.push({ value, label, ...(detail ? { detail } : {}) }); };
      if (JSON.stringify(rec) !== JSON.stringify(Flow.DEFAULT_LANGS)) push(rec, nm(rec), P && P.files.length ? 'prepared store listing: ' + P.files.slice(0, 3).join(', ') : undefined);
      push(Flow.DEFAULT_LANGS.slice(), JSON.stringify(rec) === JSON.stringify(Flow.DEFAULT_LANGS) ? t('dec.langs.rec') : nm(Flow.DEFAULT_LANGS));
      ['ko', 'th', 'zh', 'hi'].forEach(l => push([l], nm([l])));
      ['ko', 'th', 'zh', 'hi'].forEach(l => push(rec[0] === l ? [l, 'en'] : ['en', l], nm(rec[0] === l ? [l, 'en'] : ['en', l])));
      push(LANGS.slice(), nm(LANGS));
      return base; }
    case 'form_factors': { const FF = { phone: 'Phone', tablet: 'Tablet', android_auto: 'Android Auto', android_automotive: 'Android Automotive OS', wear_os: 'Wear OS', tv: 'Google TV', chromebook: 'Chromebook' };
      const rec = (d.recFF || ['phone']).slice(); return [{ value: rec, label: rec.map(f => FF[f]).join(' + '), detail: 'Found in the app: ' + rec.slice(1).map(f => FF[f]).join(', ') + '. Play Console > Test and release > Advanced settings > Form factors' }, { value: ['phone'], label: 'Phone only', detail: 'Do not opt in to ' + rec.slice(1).map(f => FF[f]).join(', ') }]; }
    case 'icon': return [...(d.existing ? [{ value: 'existing', label: t('icon.existing'), detail: A.icon.path }] : []), ...STYLE.icon.map((s, k) => ({ value: k, label: t('icon.' + s), detail: '512×512 · rocketlauncher_preview_graphics kind=icons' }))];
    case 'feature': return [...(A.featureGraphic ? [{ value: 'existing', label: t('feat.existing'), detail: A.featureGraphic.path }] : []), ...STYLE.feature.map((s, k) => ({ value: k, label: t('feat.' + s), detail: '1024×500 · rocketlauncher_preview_graphics kind=feature' }))];
    case 'shots': return [...(d.existing ? [{ value: 'existing', label: t('shots.existing'), detail: A.screenshots.map(x => x.path).join(', ') }] : []), { value: 'ok', label: t('opt.useThese'), detail: A.screenshots.length ? t('dec.shots.d', { n: A.screenshots.length }) + ' ' + A.screenshots.map(x => x.path).join(', ') : t('dec.shots.none') }];
    case 'privacy': return [{ value: 'ok', label: t('opt.approve'), detail: t('dec.privacy.d') + ' (' + C.langs.map(l => `privacy-policy-${l}.html`).join(', ') + ')' }];
    case 'safety': { const ds = Gen.dataSafety(A, L, Flow.privacyOpts(A, st.dec));
      return [{ value: 'ok', label: t('opt.approve'), detail: ds.rows.map(r => `${r.label}: ${r.purposes}${r.shared ? ' · shared' : ''}${r.tracking ? ' · tracking' : ''}`).concat(ds.notCollected.map(r => `${r.label}: ${r.note}`)).concat(ds.confirm ? [ds.confirm] : []).join(' / ') }]; }
    case 'access': case 'location': return d.opts.map(o => ({ value: o, label: t(d.key + '.' + o), detail: t(d.key + '.' + o + '.d') }));
    case 'rating': { const r = Gen.rating(A, L); return [{ value: 'ok', label: t('opt.approve'), detail: `Play: ${r.result.play} · App Store: ${r.result.apple}` }]; }
    case 'track': return d.opts.map(o => ({ value: o, label: t('track.' + o), detail: t('track.' + o + '.d') }));
  }
  return [];
}
function decisionTitle(d, L) {
  const t = T(L);
  if (d.group === 'fix') return { title: t('iss.' + d.issue.id + '.t', d.issue.vars), why: t('iss.' + d.issue.id + '.w', d.issue.vars), severity: t('sev.' + d.issue.sev) };
  if (d.key.startsWith('stage:')) {
    const h = d.hints || { evidence: [] };
    const hint = h.evidence.length ? ' ' + t('stage.hint', { ev: h.evidence.map(e => EV[e] || e).join(', '), rec: t('stage.' + d.opts[d.rec]) }) : '';
    return { title: t('dec.stage.' + d.store), why: t('dec.stage.d') + hint + (h.weak ? ' ' + t('stage.hintWeak', { weak: h.weak }) : ''), required: true, ask_user: d.ask || undefined };
  }
  if (d.key.startsWith('binary:')) return { title: `${STORE_NAME[d.store]}: ${t('dec.binary')}`, why: t('dec.binary.d') };
  return { title: t('dec.' + d.key), why: d.key === 'shots' ? '' : t('dec.' + d.key + '.d') };
}
export function decisions(st, lang, onlyOpen) {
  const L = normLang(lang || st.lang); const list = Flow.decisions(st.A, st.dec);
  const out = list.map(d => {
    const opts = optionList(st, d, L), rec = Flow.recValue(d), cur = st.dec[d.key];
    return { key: d.key, group: d.group, ...decisionTitle(d, L), options: opts.map(o => ({ ...o, recommended: JSON.stringify(o.value) === JSON.stringify(rec) || undefined })), recommended: rec, decided: cur !== undefined, current: cur };
  });
  const open = out.filter(d => !d.decided);
  const sn = stageNext(st, L);
  return { project_id: st.id, store_stage: stageInfo(st, L), open_count: open.length, total: out.length, decisions: onlyOpen ? open : out, ...learned(st, L),
    next: undecidedStages(st).length ? sn : open.length ? msg(L, 'openLeft', { n: open.length }) : (sn && !/rocketlauncher_get_decisions/.test(sn) ? sn : msg(L, 'allDecided')) };
}
function validate(st, d, val, L) {
  const bad = () => { throw new UserError(msg(L, 'badValue', { key: d.key, val: JSON.stringify(val) }), 'badValue'); };
  if (val === 'keep') { if (!d.keep) bad(); return 'keep'; }
  if (d.opts) { if (!d.opts.includes(val)) bad(); return val; }
  const C = Flow.chosen(st.A, st.dec);
  const idx = n => { const k = Number(val); if (!Number.isInteger(k) || k < 0 || k >= n) bad(); return k; };
  switch (d.key) {
    case 'title': return idx(C.listing(L).titles.length);
    case 'short': return idx(C.listing(L).shorts.length);
    case 'category': return idx(st.A.categories.length);
    case 'icon': if (val === 'existing') { if (!st.A.icon) bad(); return 'existing'; } return idx(3);
    case 'feature': if (val === 'existing') { if (!st.A.featureGraphic) bad(); return 'existing'; } return idx(3);
    case 'form_factors': { const v = Flow.normFormFactors(val); if (!v) bad(); return v; }
    case 'langs': { const a = Array.isArray(val) ? [...new Set(val)] : bad(); if (!a.length || a.some(x => !LANGS.includes(x))) bad(); return a; }
    case 'shots': if (val === 'existing' && st.A.screenshots.length) return 'existing'; if (val !== 'ok') bad(); return 'ok';
    case 'privacy': case 'safety': case 'rating': if (val !== 'ok') bad(); return 'ok';
  }
  bad();
}
export function decide(st, { choices, accept_all_recommended }, lang) {
  const L = normLang(lang || st.lang); const applied = []; let list = Flow.decisions(st.A, st.dec);
  /* Stage choices first (they change which other decisions exist), then the rest. */
  const cs = [...(choices || [])].sort((a, b) => (/^stage:/.test(b.key) ? 1 : 0) - (/^stage:/.test(a.key) ? 1 : 0));
  for (const c of cs) {
    const d = list.find(x => x.key === c.key); if (!d) throw new UserError(msg(L, 'unknownKey', { key: c.key }), 'unknownKey');
    st.dec[d.key] = validate(st, d, c.value, L); applied.push({ key: d.key, value: st.dec[d.key] });
    st.auto = (st.auto || []).filter(k => k !== d.key);
    if (d.group === 'stage') { if (d.key.startsWith('stage:')) syncStage(st, d.store); dropStaleKeep(st); refreshAuto(st); list = Flow.decisions(st.A, st.dec); }
  }
  let skipped = [];
  if (accept_all_recommended) {
    /* A stage with hints of an existing listing is never picked for the user; a stage without hints may default to not_submitted. */
    skipped = list.filter(d => d.group === 'stage' && d.ask && st.dec[d.key] === undefined).map(d => d.key);
    for (const d of list) if (d.group === 'stage' && !d.ask && st.dec[d.key] === undefined) { st.dec[d.key] = Flow.recValue(d); applied.push({ key: d.key, value: st.dec[d.key], recommended: true }); if (d.key.startsWith('stage:')) syncStage(st, d.store); }
    list = Flow.decisions(st.A, st.dec);
    /* While a store's stage is still open, nothing else is filled: the right defaults (keep the live listing, production track) depend on it. */
    if (!undecidedStages(st).length) list.forEach(d => { if (st.dec[d.key] === undefined) { st.dec[d.key] = Flow.recValue(d); st.auto = [...new Set([...(st.auto || []), d.key])]; applied.push({ key: d.key, value: st.dec[d.key], recommended: true }); } });
  }
  list = Flow.decisions(st.A, st.dec);
  if (applied.length) { st.approved = {}; st.generated = null; }   // 결정이 바뀌면 이전 승인·자료는 무효
  save(st);
  const left = list.filter(d => st.dec[d.key] === undefined).map(d => d.key);
  const sn = stageNext(st, L);
  return { project_id: st.id, applied, open_count: left.length, open_keys: left, stage_not_picked: skipped.length ? msg(L, 'stageAsk', { keys: skipped.join(', ') }) : undefined,
    next: undecidedStages(st).length ? sn : left.length ? msg(L, 'openLeft', { n: left.length }) : (sn && !/rocketlauncher_get_decisions/.test(sn) ? sn : msg(L, 'allDecided')) };
}
/* 0.2.6: no tool waits for every decision. Open ones are filled with their recommended values for this run (not saved as the user's
   choice) and listed, so the agent can confirm them with the user. */
function withRecommended(st) {
  const dec = { ...st.dec }, undecided = [];
  for (let pass = 0; pass < 3; pass++) Flow.decisions(st.A, dec).forEach(d => { if (dec[d.key] === undefined) { dec[d.key] = Flow.recValue(d); if (!undecided.includes(d.key)) undecided.push(d.key); } });
  return { dec, undecided };
}

/* ---------- 4. 그래픽 ---------- */
const b64 = u => u.split(',')[1];
async function graphics(st, L, kinds) {
  if (!hasGraphics) return null;
  const A = st.A, brand = A.brandColor || '#2f6f5e', C = Flow.chosen(A, st.dec), out = {};
  const icons = await Gfx.icons(A, brand); out.icons = icons.map(i => i.dataUrl);
  const iconUrl = out.icons[Number.isInteger(st.dec.icon) ? st.dec.icon : 0];
  if (kinds.includes('feature')) {
    const nm = C.title(L).split(/ [-–:] /)[0], tg = C.short(L).replace(/[.。]$/, '');
    out.features = await Promise.all(STYLE.feature.map(s => Gfx.feature(A, L, s, brand, iconUrl, nm, tg)));
  }
  if (kinds.includes('screenshots')) out.shots = await Gfx.shots(A, L, brand, Gen.features(A, L), 'play');
  return out;
}
export async function preview(st, kind, lang) {
  const L = normLang(lang || st.lang);
  const g = await graphics(st, L, [kind]);
  if (!g) return { note: msg(L, 'noGraphics'), images: [] };
  const dir = path.join(dirOf(st.id), 'previews'); fs.mkdirSync(dir, { recursive: true });
  const t = T(L); const imgs = [];
  const put = (name, url, label) => { const f = path.join(dir, name); fs.writeFileSync(f, Buffer.from(b64(url), 'base64')); imgs.push({ file: f, label, data: b64(url) }); };
  if (kind === 'icons') g.icons.forEach((u, k) => put(`icon-${k}-${STYLE.icon[k]}.png`, u, `${k}: ${t('icon.' + STYLE.icon[k])} (512×512)`));
  else if (kind === 'feature') g.features.forEach((u, k) => put(`feature-${k}-${STYLE.feature[k]}-${L}.png`, u, `${k}: ${t('feat.' + STYLE.feature[k])} (1024×500)`));
  else g.shots.forEach((u, k) => put(`screenshot-${k + 1}-${L}.png`, u, `${k + 1} (1080×1920)`));
  return { images: imgs };
}

/* ---------- 5. 스토어 자료 ---------- */
export async function generate(st, { output_dir, lang }, { allowPath }) {
  const L = normLang(lang || st.lang), t = T(L);
  const { dec: filled, undecided } = withRecommended(st), userDec = st.dec;
  st.dec = filled;
  try { const out = await generateWith(st, L, t, output_dir, allowPath); if (undecided.length) { out.undecided = undecided; out.summary += ' ' + msg(L, 'guidePartial', { n: undecided.length, keys: undecided.join(', ') }); } return out; }
  finally { st.dec = userDec; save(st); }
}
async function generateWith(st, L, t, output_dir, allowPath) {
  const A = st.A, C = Flow.chosen(A, st.dec), stores = Flow.stores(A, st.dec);
  const files = Flow.textFiles(A, st.dec, L, t);
  const rel = relevantLessons(A, stores, L);
  const nf = files.find(f => f.path === 'forms/app-review-notes.txt'); if (nf) nf.data = withLearnedNotes(String(nf.data).trimEnd(), rel) + '\n';
  const g = await graphics(st, L, ['feature', 'screenshots']);
  /* "keep" = the live store graphic stays; nothing new is made for it. */
  if (g) {
    if (st.dec.icon === 'existing' && A.icon) files.push({ path: 'graphics/icon-512.png', data: Buffer.from(b64(A.icon.dataUrl), 'base64') });
    else if (st.dec.icon !== 'keep') files.push({ path: 'graphics/icon-512.png', data: Buffer.from(b64(g.icons[Number.isInteger(st.dec.icon) ? st.dec.icon : 0]), 'base64') });
    if (st.dec.feature === 'existing' && A.featureGraphic) files.push({ path: 'graphics/feature-graphic-1024x500' + (/\.jpe?g$/i.test(A.featureGraphic.path) ? '.jpg' : '.png'), data: Buffer.from(b64(A.featureGraphic.dataUrl), 'base64') });
    else if (st.dec.feature !== 'keep') files.push({ path: 'graphics/feature-graphic-1024x500.png', data: Buffer.from(b64(g.features[Number.isInteger(st.dec.feature) ? st.dec.feature : 0]), 'base64') });
    if (st.dec.shots === 'existing') A.screenshots.forEach((s, k) => files.push({ path: `graphics/screenshot-${k + 1}-${path.basename(s.path).replace(/^\d+[-_]?/, '')}`, data: Buffer.from(b64(s.dataUrl), 'base64') }));
    else if (st.dec.shots !== 'keep') g.shots.forEach((s, k) => files.push({ path: `graphics/screenshot-${k + 1}-1080x1920-${L}.png`, data: Buffer.from(b64(s), 'base64') }));
  }
  files.push({ path: 'README.txt', data: `Rocket Launcher — ${A.appName} (${A.pkg || ''})\n${new Date().toISOString().slice(0, 10)}\n\n${t('zip.readme')}\n\nFeedback: ${CFG.feedbackUrl}\n` });
  const base = output_dir && allowPath ? path.resolve(String(output_dir).replace(/^~(?=$|\/)/, os.homedir())) : path.join(dirOf(st.id), 'store-materials');
  const slug = Flow.slugOf(A), folder = path.join(base, 'rocketlauncher-' + slug);
  fs.rmSync(folder, { recursive: true, force: true });
  for (const f of files) { const p = path.join(folder, f.path); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, f.data); }
  const zipBlob = Zip.writeZip(files.map(f => ({ path: f.path, data: typeof f.data === 'string' ? f.data : new Uint8Array(f.data) })));
  const zipBuf = Buffer.from(await zipBlob.arrayBuffer()); const zipPath = folder + '.zip'; fs.writeFileSync(zipPath, zipBuf);
  st.generated = { at: new Date().toISOString(), folder, zip: zipPath, lang: L }; save(st);
  const listing = {}, keepListing = C.keep.title || C.keep.short;
  if (keepListing) listing.keep_current_listing = true;
  else for (const l of C.langs) {
    listing[l] = { google_play: stores.play ? { title: C.title(l), short_description: C.short(l), full_description: C.full(l), category: C.cat.play } : undefined,
      app_store: stores.apple ? { name: C.title(l), subtitle: C.ios(l).subtitle, promotional_text: C.ios(l).promo, keywords: C.ios(l).keywords, description: C.full(l), category: C.cat.apple } : undefined };
  }
  const r = Gen.rating(A, L);
  return {
    project_id: st.id, summary: msg(L, 'generated', { n: files.length }) + (g ? '' : ' ' + msg(L, 'noGraphics')),
    store_stage: Object.fromEntries(Flow.storesOf(A).map(k => [STORE_NAME[k], Flow.stageOf(st.dec, k)])), whats_new: Flow.hasListing(A, st.dec) ? Object.fromEntries(C.langs.map(l => [l, Flow.WHATS_NEW[l] || Flow.WHATS_NEW.en])) : undefined,
    folder, zip: zipPath, zip_bytes: zipBuf.length, files: files.map(f => f.path), stores: Object.keys(stores).filter(k => stores[k]).map(k => STORE_NAME[k]),
    listing, data_safety: Gen.dataSafety(A, L, Flow.privacyOpts(A, st.dec)).rows.map(x => ({ play: x.playType, apple: x.appleType, collected: x.collected, shared: x.shared, optional: x.optional, linked: x.linked, tracking: x.tracking, purposes: x.purposes })),
    content_rating: { play: r.result.play, apple: r.result.apple, answers: r.qa.map(([q, a]) => ({ q, a })) },
    applied_code_fixes: Flow.appliedFixes(A, st.dec, L).map(([, v]) => v.file),
    app_review_notes: stores.apple && A.ios ? withLearnedNotes(Flow.reviewNotes(A, st.dec, C.langs[0]), rel) : undefined,
    learned_lessons: rel.length ? rel : undefined,
    app_privacy_tracking: stores.apple && A.ios ? (Flow.trackingOn(A, st.dec) ? 'Yes, we track (ATT prompt + tracking domains must match)' : 'No, we do not track') : undefined,
    note_privacy_hosting: t('as.host'),
    next: 'rocketlauncher_submission_guide',
    _zipBase64: zipBuf.toString('base64')
  };
}

/* ---------- 6. 제출 안내 + 승인 ---------- */
function storeCheck(st, store, L) {
  if (!['play', 'apple'].includes(store)) throw new UserError('store must be play | apple', 'badStore');
  if (!Flow.stores(st.A, st.dec)[store]) throw new UserError(msg(L, 'notChosenStore', { store: STORE_NAME[store] }), 'notChosenStore');
}
export function guide(st, store, lang) {
  const L = normLang(lang || st.lang), t = T(L);
  const stage = Flow.stageOf(st.dec, store);
  /* In review / rejected: the guide is about waiting or fixing, so it does not wait for listing choices (recommended values fill the gaps). */
  /* 0.2.6: the guide also works with partial decisions. Open choices are shown with their recommended values and listed in `undecided`;
     the final submit step stays locked until every decision is made and the user approves (rocketlauncher_approve still requires all). */
  storeCheck(st, store, L);
  const { dec, undecided } = withRecommended(st);
  const partial = undecided.length > 0 && !(stage === 'in_review' || stage === 'rejected');
  const approved = !!st.approved[store] && !partial, R = st.review[store] || {};
  const raw = Flow.guide(st.A, dec, L, store, t);
  const msgStep = raw.find(s => s.id === 'r-message');
  if (msgStep) msgStep.fields = R.plan ? [[t('f.reason'), R.plan.reason], ...R.plan.fix_plan.map((x, k) => [`${k + 1}`, x]), ...(R.plan.reply ? [[t('g.r-reply.t'), R.plan.reply]] : [])] : [['rocketlauncher_report_review', 'event=rejected · store=' + store + ' · rejection_text']];
  const steps = raw.map((s, k) => {
    const locked = s.final && !approved;
    return { n: k + 1, id: s.id, title: t('g.' + s.id + '.t'), what: t('g.' + s.id + '.d'), how: t('g.' + s.id + '.how').split('|').filter(x => x && !x.startsWith('g.')),
      final: !!s.final || undefined, locked: locked || undefined, fields: locked ? [] : s.fields.map(([label, value]) => ({ label, value: String(value) })) };
  });
  try {
    const g = RL.guideStep(st, L), fin = steps.findIndex(s => s.final);
    /* only when there is something to submit (not while waiting in review) */
    if (fin >= 0) steps.splice(fin, 0, { n: 0, id: g.id, title: g.title, what: g.detail, how: g.tools, status: g.status, fields: g.items.map((x, k) => ({ label: String(k + 1), value: x })) });
    steps.forEach((s, k) => { s.n = k + 1; });
  } catch { /* release checks never block the guide */ }
  const rel = relevantLessons(st.A, { [store]: true }, L).filter(r => r.store === store);
  const rv = steps.find(s => s.id === 'a-review'); const nf = rv && rv.fields.find(f => f.label === t('f.reviewNotes')); if (nf) nf.value = withLearnedNotes(nf.value, rel);
  if (rel.length) {
    const fin = steps.findIndex(s => s.final); const at = fin < 0 ? steps.length : fin;
    steps.splice(at, 0, { n: 0, id: 'learned-checks', title: Lessons.tx(L, 'step'), what: Lessons.tx(L, 'stepD'), how: [],
      fields: rel.map(r => ({ label: `${r.from ? '[' + r.from + '] ' : ''}${r.codes.length ? r.codes.join(', ') + ' · ' : ''}${r.title || r.builtin}${r.times_seen ? ' (' + Lessons.tx(L, 'seen', { n: r.times_seen }) + ')' : ''}`, value: [r.check || r.why, r.passed_note].filter(Boolean).join(' ') })) });
    steps.forEach((s, k) => { s.n = k + 1; });
  }
  return { project_id: st.id, store: STORE_NAME[store], approved, materials: st.generated ? { folder: st.generated.folder, zip: st.generated.zip } : null,
    note: (partial ? msg(L, 'guidePartial', { n: undecided.length, keys: [...new Set(undecided)].join(', ') }) + ' ' : '') + (approved ? msg(L, 'guideUnlocked') : msg(L, 'guideLocked')),
    undecided: partial ? [...new Set(undecided)] : undefined, steps, learned_lessons: rel.length ? rel : undefined };
}
export function approve(st, store, userWords, lang) {
  const L = normLang(lang || st.lang); storeCheck(st, store, L);
  /* the user approves what the guide showed: open decisions are saved with the recommended values that were shown */
  const { dec, undecided } = withRecommended(st);
  if (undecided.length) { st.dec = dec; st.auto = [...new Set([...(st.auto || []), ...undecided])]; }
  st.approved[store] = { at: new Date().toISOString(), user_words: String(userWords || '').slice(0, 300), filled_with_recommended: undecided.length ? undecided : undefined }; save(st);
  const g = guide(st, store, L);
  return { project_id: st.id, store: STORE_NAME[store], approved: true, message: msg(L, 'approved', { store: STORE_NAME[store] }), filled_with_recommended: undecided.length ? undecided : undefined, final_step: g.steps[g.steps.length - 1], auto_submit: false };
}

/* ---------- 7. 심사 결과 ---------- */
export function review(st, { store, event, rejection_text }, lang) {
  const L = normLang(lang || st.lang), t = T(L); storeCheck(st, store, L);
  const R = st.review[store] || { status: 'none', round: 0 }; const S = STORE_NAME[store];
  let out = { project_id: st.id, store: S };
  if (event === 'submitted' || event === 'resubmitted') {
    if (!st.approved[store]) throw new UserError(msg(L, 'needApproval'), 'needApproval');
    st.review[store] = { status: 'in_review', round: (R.round || 0) + 1, fixed: event === 'resubmitted' ? R.rid : undefined };
    out = { ...out, status: 'in_review', round: st.review[store].round, message: msg(L, 'inReview', { store: S }) };
  } else if (event === 'rejected') {
    if (!rejection_text) {
      const sample = st.sample ? (Gen.REJECTIONS.find(r => r.store === store && r.demo) || Gen.REJECTIONS.find(r => r.store === store) || {}).sample : undefined;
      st.review[store] = { ...R, status: 'rejected' };
      out = { ...out, status: 'rejected', message: msg(L, 'pasteRejection'), sample_message_for_demo: sample };
    } else {
      const rj = Lessons.matchKnown(rejection_text, store);
      const infoNeeded = store === 'apple' && /information needed/i.test(rejection_text) ? msg(L, 'infoNeeded') : undefined;
      /* Learn automatically: a known reason only counts an occurrence; an unknown one becomes a new generalized lesson on this machine. */
      const learnFn = db => Lessons.learn(db, rejection_text, store, rj ? rj.id : null);
      const lr = st.sample ? learnFn(Lessons.empty()) : withLessons(learnFn);   // the built-in demo never writes to the user's lessons
      const les = lr && lr.lesson;
      if (les && !st.sample) { st.lessonIds = st.lessonIds || {}; const a = st.lessonIds[store] || []; if (!a.includes(les.id)) a.push(les.id); st.lessonIds[store] = a; }
      /* Anonymized event to the configured lessons API in the background (store + codes + fixed advice id only). The demo never sends. Skipped when the API URL is empty. */
      const sharedPayload = les && !st.sample ? shareLesson(les, 'rejected') : null;
      if (!rj && les) {
        st.review[store] = { ...R, status: 'fixing', text: rejection_text, lesson: les.id, plan: { reason: les.title, fix_plan: [].concat(Lessons.planFor(les, L) || []), reply: Lessons.replyFor(les, appName(st, 'en')) } };
        out = { ...out, status: 'fixing', matched: 'learned', information_needed: infoNeeded, reason: les.title, why: les.advice, fix_plan: Lessons.planFor(les, L), auto_reply: false,
          reply_to_reviewer: Lessons.replyFor(les, appName(st, 'en')), lesson: { ...Lessons.compact(les), created: lr.created, saved: !st.sample }, message: msg(L, 'learnedRejection'),
          next: t('rv.approveFix.d') + ' → rocketlauncher_report_review event=resubmitted' };
      } else if (!rj) { st.review[store] = { ...R, status: 'rejected', text: rejection_text }; out = { ...out, status: 'rejected', matched: false, information_needed: infoNeeded, message: msg(L, 'unknownRejection') }; }
      else {
        st.review[store] = { ...R, status: 'fixing', text: rejection_text, rid: rj.id, plan: { reason: t('rj.' + rj.id + '.t'), fix_plan: [].concat(rj.plan[L] || rj.plan.en || []), reply: rj.reply(appName(st, 'en')) } };
        const p = rj.id === 'play-photo' ? Gen.patches(st.A, L)['patch-manifest-photo'] : null;
        out = { ...out, status: 'fixing', matched: true, information_needed: infoNeeded, reason: t('rj.' + rj.id + '.t'), why: t('rj.' + rj.id + '.w'), fix_plan: rj.plan[L] || rj.plan.en, auto_reply: false,
          reply_to_reviewer: rj.reply(appName(st, 'en')), code_fix: p ? { file: p.file, diff: p.diff } : undefined,
          lesson: les ? { ...Lessons.compact(les), note: msg(L, 'builtinRecorded') } : undefined,
          next: t('rv.approveFix.d') + ' → rocketlauncher_report_review event=resubmitted' };
      }
      if (out.lesson) out.lesson.shared = sharedPayload || false;
    }
  } else if (event === 'approved') {
    st.review[store] = { ...R, status: 'live', liveAt: new Date().toISOString() };
    const chosen = Object.entries(Flow.stores(st.A, st.dec)).filter(([, v]) => v).map(([k]) => k);
    const allLive = chosen.every(k => st.review[k] && st.review[k].status === 'live');
    if (allLive) st.done = new Date().toISOString();
    /* A lesson's checks were part of a later approval: count once per project and store. */
    const pend = ((st.lessonIds || {})[store] || []).filter(id => !((st.lessonsPassed || {})[store] || []).includes(id));
    const pr = pend.length ? withLessons(db => Lessons.recordPass(db, pend)) : null;
    if (pr) { st.lessonsPassed = st.lessonsPassed || {}; st.lessonsPassed[store] = [...((st.lessonsPassed[store]) || []), ...pend]; }
    if (pr && !st.sample) pr.lessons.forEach(x => shareLesson(x, 'passed'));   // community pass count: codes + advice id only, no project identity
    out = { ...out, status: 'live', message: allLive ? msg(L, 'allLive', { url: CFG.feedbackUrl }) : msg(L, 'live', { store: S }), all_launched: allLive,
      remaining_stores: chosen.filter(k => !(st.review[k] && st.review[k].status === 'live')).map(k => STORE_NAME[k]),
      lessons_confirmed: pr && pr.lessons.length ? pr.lessons.map(Lessons.compact) : undefined, lessons_note: pr && pr.lessons.length ? msg(L, 'lessonsPassed') + ' ' + Lessons.tx(L, 'passed') : undefined };
  } else throw new UserError('event must be submitted | rejected | resubmitted | approved', 'badEvent');
  save(st);
  return out;
}

/* ---------- 상태 ---------- */
function stepOf(st, L) {
  const open = Flow.decisions(st.A, st.dec).filter(d => st.dec[d.key] === undefined).length;
  const stores = Object.entries(Flow.stores(st.A, st.dec)).filter(([, v]) => v).map(([k]) => k);
  if (st.done) return { step: 'done', label: msg(L, 'stepDone'), next: null };
  const us = undecidedStages(st);
  if (us.length) return { step: 'stage', label: msg(L, 'stepStage'), next: 'rocketlauncher_decide', open_keys: us.map(k => 'stage:' + k), note: stageNext(st, L) };
  const rj = stores.filter(k => st.review[k] && st.review[k].status === 'rejected' && !st.review[k].text);
  if (rj.length) return { step: 'rejected', label: msg(L, 'stepRejected'), next: 'rocketlauncher_report_review', stores: rj.map(k => STORE_NAME[k]), note: stageNext(st, L) };
  const ir = stores.filter(k => st.review[k] && st.review[k].external && st.review[k].status === 'in_review' && st.dec['binary:' + k] !== 'new_build');
  if (ir.length && ir.length === stores.length) return { step: 'in_review', label: msg(L, 'stepInReview'), next: 'rocketlauncher_report_review', guide: 'rocketlauncher_submission_guide', stores: ir.map(k => STORE_NAME[k]), note: stageNext(st, L) };
  if (open) return { step: 'decide', label: msg(L, 'stepDecide'), next: 'rocketlauncher_get_decisions', open_decisions: open };
  if (!st.generated) return { step: 'generate', label: msg(L, 'stepGenerate'), next: 'rocketlauncher_generate_store_materials' };
  const notApproved = stores.filter(k => !st.approved[k]);
  const notSent = stores.filter(k => !st.review[k] || st.review[k].status === 'none');
  if (notApproved.length || notSent.length) return { step: 'submit', label: msg(L, 'stepSubmit'), next: 'rocketlauncher_submission_guide', stores_waiting_approval: notApproved.map(k => STORE_NAME[k]) };
  return { step: 'review', label: msg(L, 'stepReview'), next: 'rocketlauncher_report_review', review: Object.fromEntries(stores.map(k => [STORE_NAME[k], (st.review[k] || {}).status])) };
}
export function status(id, lang) {
  const L = normLang(lang);
  if (id) { const st = load(id, L); return { project_id: st.id, app: appName(st, L), readiness: st.A.readiness, ...stepOf(st, L), materials: st.generated, approvals: st.approved, review: st.review, lessons: listLessons() }; }
  let ids = []; try { ids = fs.readdirSync(PROJ); } catch { }
  const list = ids.map(i => { try { const st = load(i, L); return { project_id: st.id, app: appName(st, L), updated: st.updatedAt, ...stepOf(st, L) }; } catch { return null; } }).filter(Boolean)
    .sort((a, b) => String(b.updated).localeCompare(String(a.updated)));
  return { projects: list, data_dir: HOME, lessons: listLessons() };
}

/* Remove one learned lesson from this machine (lessons.json and the export). Project state is not touched. */

const KIND_OK = new Set(['function_name','http_delete','i18n','ui_text','query_string','wrapper_fetch','geolocation_plugin','same_file','co_occur','sdk_api','user_report','device_only']);
function cleanKinds(arr) {
  return [...new Set((arr || []).filter(k => typeof k === 'string' && KIND_OK.has(k)))].slice(0, 8);
}
export function reportCorrection(st, { check_id, actual, evidence, wrong_verdict, pattern_kinds }, lang) {
  const L = normLang(lang || st.lang);
  const allowed = RL.CORRECTION_CHECKS[check_id];
  if (!allowed) throw new UserError('check_id must be one of ' + Object.keys(RL.CORRECTION_CHECKS).join(', '), 'badValue');
  if (!allowed.includes(actual)) throw new UserError('actual must be one of ' + allowed.join(', '), 'badValue');
  const wrong = (wrong_verdict && allowed.includes(wrong_verdict)) ? wrong_verdict : RL.inferredVerdict(st, check_id);
  const kinds = cleanKinds(pattern_kinds && pattern_kinds.length ? pattern_kinds : RL.patternKindsOf(st, check_id));
  if (!kinds.length) kinds.push('user_report');
  st.corrections = st.corrections || {};
  st.corrections[check_id] = { actual, wrong, at: new Date().toISOString(), evidence: String(evidence || '').slice(0, 200), kinds };
  RL.applyCorrections(st);
  save(st);
  const sharedPayload = !st.sample ? shareCorrection({
    check_id, wrong_verdict: wrong, corrected_verdict: actual,
    framework: String((st.A && st.A.framework) || 'unknown').slice(0, 32),
    language: RL.langKindOf(st),
    pattern_kinds: kinds
  }) : null;
  const rep = report(st, L);
  return {
    project_id: st.id, check_id, previous: wrong, actual, applied: true,
    readiness: st.A.readiness, shared: sharedPayload || false,
    message: 'This check is overridden for this app. Readiness was recalculated.',
    issues: rep.issues, release_checks: rep.release_checks
  };
}

export function forgetLesson(id, lang) {
  const L = normLang(lang);
  const r = withLessons(db => Lessons.forget(db, String(id || '')));
  if (!r || !r.removed) throw new UserError(msg(L, 'lessonNotFound', { id }), 'lessonNotFound');
  return { removed: id, message: msg(L, 'lessonForgotten', { id }), lessons: listLessons() };
}

/* ---------- 0.2.0 release tools ---------- */
const needAndroid = (st, L) => { if (!st.A.android) throw new UserError(RL_noAndroid(L), 'noAndroid'); };
function RL_noAndroid(L) { return RL.policyAudit({ A: { android: null } }, L).summary; }
const listProjects = () => { try { return fs.readdirSync(PROJ).filter(idOk); } catch { return []; } };
export async function release(tool, id, args = {}, lang) {
  const st = load(id, lang), L = normLang(lang || args.lang || st.lang);
  switch (tool) {
    case 'requirements': return { project_id: id, ...RL.requirements(st, L) };
    case 'privacy': return { project_id: id, ...RL.privacyCheck(st, L) };
    case 'policy': return { project_id: id, ...RL.policyAudit(st, L) };
    case 'notes': return { project_id: id, ...RL.reviewerNotes(st, L, args) };
    case 'deletion': return { project_id: id, ...RL.deletionCheck(st, L) };
    case 'countries': return { project_id: id, ...RL.countryCheck(st, L, args) };
    case 'closed_test': {
      needAndroid(st, L);
      const a = args.action || 'status';
      if (a === 'record') {
        let n; try { n = RL.closedTestRecord(st, args); } catch (e) { throw new UserError(e.message, 'badValue'); }
        save(st); return { project_id: id, saved: RL.closedTestStatus(st, L).title, message: (await import('./release-i18n.mjs')).rx(L, 'ct.recorded', { n }), ...RL.closedTestStatus(st, L) };
      }
      if (a === 'application_draft') return { project_id: id, ...RL.closedTestDraft(st, L) };
      if (a === 'recruit_copy') return { project_id: id, messages: RL.recruitCopy(st, args.opt_in_link), tip: 'For LINE, add ?openExternalBrowser=1 to the link (or share the link to your own web page with an "Open in Chrome" button). Field reports say the opt-in may fail inside LINE / Facebook / Instagram browsers; Google does not document this.' };
      if (a === 'check_optin_page') return { project_id: id, ...(await optinPage(st, args)) };
      if (a === 'status') { if (args.account_type) { st.closedTest = st.closedTest || { testers: {}, feedback: [] }; st.closedTest.account_type = args.account_type; save(st); } return { project_id: id, ...RL.closedTestStatus(st, L) }; }
      throw new UserError('action must be status | record | application_draft | recruit_copy | check_optin_page', 'badValue');
    }
    case 'move': {
      if (args.key_backup_location) { try { RL.moveRecord(st, args); } catch (e) { throw new UserError(e.message, 'badValue'); } save(st); }
      return { project_id: id, ...RL.movePlan(st, L, args), key_backup_location: st.move && st.move.key_backup_location || undefined };
    }
    case 'version': {
      const others = (args.other_project_ids || []).filter(x => x !== id).map(x => { try { return load(x, L); } catch { return null; } }).filter(Boolean);
      const r = await RL.versionSync(st, L, args, others); save(st);
      return { project_id: id, ...r, other_projects_on_this_computer: others.length ? undefined : listProjects().filter(x => x !== id).slice(0, 20) };
    }
    default: throw new UserError('unknown release tool ' + tool, 'badValue');
  }
}
async function optinPage(st, { url, file, html }) {
  if (html) return RL.optinReport(String(html).slice(0, 500000), 'html');
  if (url) {
    if (!/^https:\/\//i.test(url)) throw new UserError('url must start with https://', 'badValue');
    let body; try { const r = await fetch(url, { signal: AbortSignal.timeout(10000), headers: { 'User-Agent': 'Rocket-Launcher-optin-check' } }); body = (await r.text()).slice(0, 500000); } catch (e) { throw new UserError('Could not open the page: ' + e.message, 'fetch'); }
    return RL.optinReport(body, url);
  }
  const pages = ((st.X && st.X.optinPages) || []).filter(p => !file || p.path === file);
  if (pages.length) return { checked: 'tester pages found in the project', pages: pages.map(p => RL.optinReport(p, p.path)) };
  return { checked: null, note: 'Pass url (your public tester page) or html. No tester page was found in the project.' };
}
export function removeGuide(store, lang) { return RL.removeGuide(normLang(lang), store); }
