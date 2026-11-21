/* Rocket Launcher MCP — 도구 정의. 설명은 호스트 AI 가 언제·어떻게 부를지 알 수 있게 쓴다. */
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as E from './engine.mjs';
import { CFG } from './runtime.mjs';
import { ensureShared } from './shared.mjs';

export const VERSION = '0.2.7';

export const INSTRUCTIONS = `Rocket Launcher helps people who already built an Android and/or iOS app with AI get it published on Google Play and the App Store, and stops at launch. It works at every store stage: a first submit, an app already uploaded and waiting in review, a rejected app, and an update of an app that is already live.
How to use it:
1. When the user says their app is finished, is in review, was rejected or needs an update, call rocketlauncher_connect_app ONCE with a public GitHub URL, a local folder/ZIP path, or source=sample for a demo. Never ask the user for tokens, passwords or store metadata forms.
1a. Store stage comes first and is required for each store: not_submitted (first submit), in_review (uploaded, waiting), rejected, or live (update). Pass store_stage on connect if the user already said it; otherwise ask, and record it with rocketlauncher_decide key stage:play / stage:apple. The report's store_stage shows hints (store links, fastlane metadata, version numbers) and a recommendation; hints are only hints, never assume a first launch. In review: nothing to submit, no new app record and no new build unless the user chooses binary:<store>=new_build (replacing a build can withdraw or delay the review); help them wait, prepare a reply draft for Information Needed and fix metadata. Rejected: the next step is pasting the store's message into rocketlauncher_report_review; then follow the fix plan and the resubmit guide. Live: an update, so no closed testing; keep the live listing (the "keep" option), and the guide covers the new version and "What's new".
2. Show the analysis in plain words, then call rocketlauncher_get_decisions and present each decision's options to the user. The user only picks, approves or rejects. Show the recommended option first.
3. Call rocketlauncher_decide ONLY with values the user actually chose in this conversation. Use accept_all_recommended=true only if the user explicitly says to accept all recommendations.
4. Call rocketlauncher_generate_store_materials, then rocketlauncher_submission_guide for each store and walk the user through the console steps.
5. The final submit step stays locked until the user explicitly approves; then call rocketlauncher_approve_submission. Rocket Launcher never submits to any store itself: the user presses the submit button in Play Console / App Store Connect.
6. When the user reports the review result, call rocketlauncher_report_review (submitted / rejected with the store's message / resubmitted / approved). When every chosen store is live, the job is done. In App Store Connect an "Information Needed" request also shows as Rejected; it asks for a reply, not always a new build. Never reply to Apple or Google yourself: draft the reply and let the user send it.
7. Reported review results are learned automatically: an unknown rejection becomes a generalized lesson (store, guideline/ITMS codes, short advice from a fixed table) saved on this computer, and known ones are counted. To improve checks for every user, when a lessons API is configured (js/config.js lessonsApiUrl, or the ROCKETLAUNCHER_LESSONS_API environment variable) each real (non-demo) learned result also sends an anonymized event to that lessons API containing only the store, guideline/ITMS/Play policy codes and a fixed advice id (field lesson.shared shows the exact payload); the store message, app name, bundle/package id, project id, e-mail and any free text are never sent. The aggregated feed from other users is fetched and cached on this computer. Reports, choices, submission guides and review notes show relevant lessons as warnings or pre-submit checks (field learned_lessons): source "local" = from the user's own reviews, "shared" = from other Rocket Launcher users' reviews; tell the user which is which. Lessons never become must-fix items and never override the default checks (for example they never mean "add ATT because of ads"). If the lessons API is not configured or cannot be reached, everything still works locally. An explicitly empty ROCKETLAUNCHER_LESSONS_API disables the shared feed (lessons stay on this computer); if the variable is omitted, lessonsApiUrl in js/config.js is used. rocketlauncher_status lists the local lessons; rocketlauncher_forget_lesson removes one if the user asks.
8. Release checks (0.2.0, free, offline except where noted, no API keys): rocketlauncher_get_report includes release_checks and the submission guide has a "Release checks" step. Details: rocketlauncher_check_requirements (store deadlines from a dated table with official sources), rocketlauncher_privacy_check (Data safety / App Privacy / PrivacyInfo.xcprivacy / permission texts consistency + drafts), rocketlauncher_play_policy_audit (Google's Apache-2.0 Play Policy Insights rules, bundled), rocketlauncher_reviewer_notes, rocketlauncher_account_deletion_check, rocketlauncher_closed_test (12 testers × 14 days for new personal Play accounts), rocketlauncher_version_sync, rocketlauncher_country_check, rocketlauncher_move_app_plan and rocketlauncher_remove_app_guide. These only advise: never unpublish, delete, transfer, create accounts, change permissions or apply for production yourself; the account owner does that in the console after choosing. For moving an app, present both paths (transfer / new registration) neutrally and let the user choose; never default to one. Never ask for or store passwords, keys or tokens; for the signing key only the place where its backup is kept. If a check was wrong, call rocketlauncher_report_correction with the check id, the correct verdict and a short evidence note (file and line). That overrides the check for this app and, when a lessons API is configured, sends an anonymized record (check id and verdicts only — never code, names or paths). An empty lessons API URL keeps the report on this computer.
App Store review rules the analysis follows (explain them in plain words when they come up):
- Tracking, ATT, PrivacyInfo.xcprivacy, the App Privacy form and real behavior must match from the first submit. Default for apps with ads: no ATT prompt or NSUserTrackingUsageDescription, NSPrivacyTracking=false with no tracking domains, every ad request non-personalized (npa=1), App Privacy "No, we do not track". Never suggest adding ATT just because the app shows ads. Keep an already fully aligned tracking setup, but never leave a mixed one.
- Core features should work without login (5.1.1(v)); third-party login on iOS needs Sign in with Apple; accounts need in-app and web deletion; the Support URL must show a contact method; ads are mentioned only in the privacy policy; no "free" or other brands' names in subtitle/keywords; review notes for user-supplied API keys say there is no IAP and the developer does not sell keys, with a review-only key the user attaches (never put real keys anywhere).
Reply to the user in their language. Tool texts come in five languages via the lang argument: en (English, the default), ko (Korean), th (Thai), zh (Simplified Chinese) and hi (Hindi). Pass the user's language as lang; when lang is omitted, texts are in English. Store listings for the user's app default to English (the recommended choice); Korean, Thai, Chinese and Hindi listings can be added if the user picks them. Free to use; feedback: ${CFG.feedbackUrl}.`;

const lang = z.enum(['en', 'ko', 'th', 'zh', 'hi']).optional().describe('Language for texts in the result: en (default), ko, th, zh (Simplified Chinese), hi (Hindi). Pass the user\'s language.');
const pid = z.string().describe('project_id returned by rocketlauncher_connect_app');
const store = z.enum(['play', 'apple']).describe('play = Google Play, apple = App Store');

const json = o => JSON.stringify(o, (k, v) => (k.startsWith('_') ? undefined : v), 2);
const ok = (o, extra = []) => ({ content: [{ type: 'text', text: json(o) }, ...extra] });
const fail = e => ({ isError: true, content: [{ type: 'text', text: (e && e.message) || String(e) }] });
const wrap = fn => async (args) => { try { return await fn(args || {}); } catch (e) { if (!(e instanceof E.UserError)) console.error('[rocketlauncher]', e); return fail(e); } };

export function createServer({ allowPath = true, inlineZip = false } = {}) {
  const server = new McpServer({ name: 'rocket-launcher', title: 'Rocket Launcher', version: VERSION }, { instructions: INSTRUCTIONS });
  const RO = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
  const W = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };

  server.registerTool('rocketlauncher_connect_app', {
    title: 'Connect an app (start launch help)',
    description: 'Start here when the user has finished building an Android or iOS app and wants to publish it, or asks for Play Store / App Store help with an app that is waiting in review, was rejected, or is live and needs an update. Connects the app project once and analyzes it (manifest, Gradle, Info.plist, strings, README, icons, screenshots) for store-review problems and launch readiness. No tokens or forms. source: "github" (public repo URL), "path" (a project folder or .zip on the machine running this server), or "sample" (built-in demo app SnapLedger). Returns project_id used by every other Rocket Launcher tool.',
    inputSchema: {
      source: z.enum(['github', 'path', 'sample']).describe('Where the app comes from'),
      github_url: z.string().optional().describe('Public GitHub repo URL, e.g. https://github.com/owner/repo (optionally /tree/branch/subfolder). Required when source=github'),
      path: z.string().optional().describe('Absolute path to the project folder or a .zip of it, on the computer running this MCP server. Required when source=path'),
      store_stage: z.union([z.enum(['not_submitted', 'in_review', 'rejected', 'live']), z.object({ play: z.enum(['not_submitted', 'in_review', 'rejected', 'live']).optional(), apple: z.enum(['not_submitted', 'in_review', 'rejected', 'live']).optional() })]).optional()
        .describe('Where the app is now, only if the user said so: one stage for every store, or per store {play, apple}. not_submitted = first submit, in_review = uploaded and waiting, rejected = rejected, live = already published (this is an update). If omitted, ask the user (decision key stage:<store>).'),
      lang
    },
    annotations: { ...W, openWorldHint: true }
  }, wrap(async a => { await ensureShared(); return ok((await E.connect(a, { allowPath })).report); }));

  server.registerTool('rocketlauncher_get_report', {
    title: 'Show the analysis report',
    description: 'Show the analysis of a connected app again: launch readiness, every issue that can block store review with a plain-language reason, and what Rocket Launcher can fix.',
    inputSchema: { project_id: pid, lang }, annotations: { ...RO, openWorldHint: true }
  }, wrap(async a => { await ensureShared(); return ok(E.report(E.load(a.project_id, a.lang), a.lang)); }));

  server.registerTool('rocketlauncher_get_decisions', {
    title: 'List choices for the user',
    description: 'List what the user needs to decide, each with ready-made options and a recommended one: the store stage per store (stage:play / stage:apple, required, asked first; binary:<store> when in review), code fixes to apply or skip, which stores, store title, short description, tone, category, store languages, icon, feature graphic, screenshots, privacy policy, Data safety / App Privacy answers, content rating answers and release track. Present these to the user as simple choices; the user does not type metadata. Use only_open=true to see just the undecided ones.',
    inputSchema: { project_id: pid, only_open: z.boolean().optional().describe('Only undecided items (default true)'), lang }, annotations: { ...RO, openWorldHint: true }
  }, wrap(async a => { await ensureShared(); return ok(E.decisions(E.load(a.project_id, a.lang), a.lang, a.only_open !== false)); }));

  server.registerTool('rocketlauncher_decide', {
    title: 'Record the user\'s choices',
    description: 'Record choices the user made. Pass each as {key, value} using the key and an option value from rocketlauncher_get_decisions. Only send what the user actually picked or approved. A stage with hints of an existing store listing is never filled by accept_all_recommended; ask the user. Value "keep" keeps a live listing value. Set accept_all_recommended=true only when the user explicitly said to accept all recommendations; it fills every undecided item with the recommended option. Changing a decision clears earlier submission approvals and generated files.',
    inputSchema: {
      project_id: pid,
      choices: z.array(z.object({ key: z.string(), value: z.union([z.string(), z.number(), z.array(z.string())]) })).optional().describe('e.g. [{"key":"title","value":1},{"key":"fix:targetSdk","value":"apply"},{"key":"langs","value":["en","ko"]}]'),
      accept_all_recommended: z.boolean().optional(),
      lang
    }, annotations: W
  }, wrap(async a => ok(E.decide(E.load(a.project_id, a.lang), a, a.lang))));

  server.registerTool('rocketlauncher_preview_graphics', {
    title: 'Show icon / feature graphic / screenshot options',
    description: 'Render the store graphics so the user can pick: kind=icons (3 icon options, 512×512), feature (3 Google Play feature graphics, 1024×500, using the chosen title and icon), screenshots (store screenshots 1080×1920 made from the app\'s own screenshots). Returns the images and the saved file paths.',
    inputSchema: { project_id: pid, kind: z.enum(['icons', 'feature', 'screenshots']), lang }, annotations: RO
  }, wrap(async a => {
    const r = await E.preview(E.load(a.project_id, a.lang), a.kind, a.lang);
    return ok({ note: r.note, images: r.images.map(i => ({ label: i.label, file: i.file })) }, r.images.map(i => ({ type: 'image', data: i.data, mimeType: 'image/png' })));
  }));

  server.registerTool('rocketlauncher_generate_store_materials', {
    title: 'Make all store materials',
    description: 'Create the full launch kit. Open decisions are filled with their recommended values for this run and listed in `undecided` (confirm them with the user). What the project already prepared is used as is: store listing text and default language (play/, fastlane, listing drafts, rocketlauncher.json), the store icon, feature graphic and screenshots. Contents: store listing text per chosen language, privacy policy and account-deletion pages, Data safety CSV and App Privacy answers, content-rating answers, PrivacyInfo.xcprivacy, code-fix diff for the approved fixes, icon, feature graphic and screenshots. Saves a folder and a ZIP and returns the texts so you can show them.',
    inputSchema: { project_id: pid, output_dir: z.string().optional().describe('Optional folder to save into (local stdio use only). Default: ~/.rocketlauncher/projects/<id>/store-materials'), lang }, annotations: { ...W, openWorldHint: true }
  }, wrap(async a => {
    await ensureShared();
    const r = await E.generate(E.load(a.project_id, a.lang), a, { allowPath });
    const extra = inlineZip ? [{ type: 'resource', resource: { uri: `rocketlauncher://${r.project_id}/store-materials.zip`, mimeType: 'application/zip', blob: r._zipBase64 } }] : [];
    return ok(r, extra);
  }));

  server.registerTool('rocketlauncher_submission_guide', {
    title: 'Step-by-step console guide',
    description: 'Plain-language, step-by-step guide for Google Play Console (store=play) or App Store Connect (store=apple) with the exact value to paste into every field. The guide follows the store stage: first submit, waiting in review (wait, Information Needed reply draft, metadata-only fixes, no new build unless chosen), rejected (fix plan and resubmit) or live (new version, What\'s new, listing kept). Works before every decision is made: open ones are shown with their recommended values and listed in `undecided`. The final submit step stays locked until the user approves with rocketlauncher_approve_submission.',
    inputSchema: { project_id: pid, store, lang }, annotations: { ...RO, openWorldHint: true }
  }, wrap(async a => { await ensureShared(); return ok(E.guide(E.load(a.project_id, a.lang), a.store, a.lang)); }));

  server.registerTool('rocketlauncher_approve_submission', {
    title: 'Record the user\'s approval to submit',
    description: 'Call only after the user explicitly approves submitting this app to the given store in this conversation (for example "yes, submit it"). Unlocks the final step of the guide. This does NOT submit anything: the user presses the submit button in the store console themselves. Pass the user\'s own words in user_confirmation.',
    inputSchema: { project_id: pid, store, user_confirmation: z.string().min(1).describe('The user\'s approval in their own words'), lang }, annotations: W
  }, wrap(async a => ok(E.approve(E.load(a.project_id, a.lang), a.store, a.user_confirmation, a.lang))));

  server.registerTool('rocketlauncher_report_review', {
    title: 'Report a store review result',
    description: 'Record what happened at the store, as told by the user: event=submitted (user pressed submit), rejected (include the store\'s rejection message in rejection_text to get a fix plan and a reply to the reviewer), resubmitted (after the user approved the fix and resubmitted), approved (the app is live). A rejection is learned automatically on this computer: a known reason returns the built-in fix plan, an unknown one is saved as a generalized lesson (no raw message stored in the lessons file) and returns a plan from it; an approval records that the learned checks were part of a later approval. For real (non-demo) projects, when a lessons API is configured, an anonymized event (store, guideline/ITMS/policy codes, fixed advice id; never the message, app name or ids) is sent to that API in the background so every user gets better checks (lesson.shared shows it); if the API is unset or a request fails, the result is unchanged. Rocket Launcher never replies to the store. When every chosen store is live, Rocket Launcher\'s job is finished.',
    inputSchema: { project_id: pid, store, event: z.enum(['submitted', 'rejected', 'resubmitted', 'approved']), rejection_text: z.string().optional(), lang }, annotations: { ...W, openWorldHint: true }
  }, wrap(async a => ok(E.review(E.load(a.project_id, a.lang), a, a.lang))));

  server.registerTool('rocketlauncher_status', {
    title: 'Where am I?',
    description: 'Show the current step and the next action for a project, or list all Rocket Launcher projects when project_id is omitted. Use it to resume launch help in a new conversation. Also lists the review lessons learned on this computer (lessons: id, store, codes, title, times_seen, times_passed_after).',
    inputSchema: { project_id: z.string().optional(), lang }, annotations: RO
  }, wrap(async a => ok(E.status(a.project_id, a.lang))));

  server.registerTool('rocketlauncher_forget_lesson', {
    title: 'Forget a learned review lesson',
    description: 'Remove one review lesson that Rocket Launcher learned on this computer from earlier store results, only when the user asks to drop it. Pass lesson_id from the lessons list of rocketlauncher_status. Removes it from ~/.rocketlauncher/lessons.json and the anonymized export; projects are not changed.',
    inputSchema: { lesson_id: z.string().min(1).describe('id from rocketlauncher_status lessons'), lang }, annotations: { ...W, destructiveHint: true, idempotentHint: true }
  }, wrap(async a => ok(E.forgetLesson(a.lesson_id, a.lang))));

  const rt = (tool) => wrap(async a => { await ensureShared(); return ok(await E.release(tool, a.project_id, a, a.lang)); });
  server.registerTool('rocketlauncher_check_requirements', {
    title: 'Store requirements and deadlines',
    description: 'Check the connected app against current Google Play and App Store technical requirements with dates: target API level, 16 KB page size (reads native .so alignment), app registration / developer verification, trader status, Xcode / SDK version, minimum iOS, required-reason APIs in PrivacyInfo.xcprivacy, export compliance, new age-rating questions, account deletion. Every row has the official source URL and the date the rule was verified. Where sources disagree it uses the earliest date. Read-only, offline.',
    inputSchema: { project_id: pid, lang }, annotations: RO
  }, rt('requirements'));

  server.registerTool('rocketlauncher_privacy_check', {
    title: 'Privacy consistency check + drafts',
    description: 'Cross-check Data safety, App Privacy, PrivacyInfo.xcprivacy, permissions, iOS purpose strings and the privacy policy against the code: location (precise / background / sent vs on-device), ATT and tracking, photos, required-reason APIs, and data types Google\'s scanner patterns detect. Returns mismatches with fixes plus drafts: Data safety rows, App Privacy answers, required-reason entries and a full PrivacyInfo.xcprivacy. Read-only, offline.',
    inputSchema: { project_id: pid, lang }, annotations: RO
  }, rt('privacy'));

  server.registerTool('rocketlauncher_play_policy_audit', {
    title: 'Google Play policy audit (Play Policy Insights)',
    description: 'Quick Google Play policy scan using Google\'s open-source Play Policy Insights rules (Apache-2.0, bundled with attribution): finds policy signals (sensitive permissions, account / login, data types) and lists the Play policies to review with links. Also returns how to run Google\'s full offline audit skill (bundled SKILL.md, Python 3). Read-only, offline, free.',
    inputSchema: { project_id: pid, lang }, annotations: RO
  }, rt('policy'));

  server.registerTool('rocketlauncher_reviewer_notes', {
    title: 'Notes for store reviewers',
    description: 'Draft App Review notes (App Store) and App access + notes (Google Play) in English: what the app does, why each permission is used, what reviewers outside the service area see, account deletion path, no hidden features (2.5.19). Placeholders like [review account] stay placeholders: never put real passwords in chat; the user types them only in the console.',
    inputSchema: { project_id: pid, default_location: z.string().max(120).optional().describe('What the app shows when location is denied or the reviewer is outside the service area, e.g. "Bangkok"'), demo_account: z.enum(['needed', 'not_needed']).optional().describe('Whether reviewers need a sign-in to reach every feature'), extra: z.string().max(1500).optional().describe('Anything else the reviewer should know'), lang }, annotations: RO
  }, rt('notes'));

  server.registerTool('rocketlauncher_account_deletion_check', {
    title: 'Account deletion check',
    description: 'If the app has sign-up / login, check that it offers account deletion inside the app (App Store 5.1.1(v), Google Play) and a web deletion page / URL (Google Play), and that the privacy policy covers deletion and retention. Returns what is missing, a review-note line and where to paste the URL in Play Console. Read-only.',
    inputSchema: { project_id: pid, lang }, annotations: RO
  }, rt('deletion'));

  server.registerTool('rocketlauncher_report_correction', {
    title: 'Report a wrong check',
    description: 'Record that a Rocket Launcher check was wrong for this connected app (for example account deletion was marked missing but exists, or location was marked on-device only but is sent to a server). Immediately overrides that check for this app, recalculates readiness, and — when a lessons API is configured — sends an anonymized record (check id, wrong and corrected verdicts, framework, language, pattern kinds; never code, app names, paths or evidence text). If the lessons API URL is empty, the override stays on this computer only. Pass evidence as a short file:line note for local use; it is not shared.',
    inputSchema: {
      project_id: pid,
      check_id: z.enum(['account_deletion', 'location_sharing', 'auth', 'cloud_db']).describe('Which check was wrong'),
      actual: z.enum(['present', 'missing', 'server', 'device']).describe('The correct verdict: present/missing for account_deletion, auth and cloud_db; server/device for location_sharing'),
      evidence: z.string().max(200).optional().describe('Short local note such as file:line. Stored on this computer only, never sent'),
      wrong_verdict: z.enum(['present', 'missing', 'server', 'device']).optional().describe('What the checker said; inferred if omitted'),
      pattern_kinds: z.array(z.enum(['function_name','http_delete','i18n','ui_text','query_string','wrapper_fetch','geolocation_plugin','same_file','co_occur','sdk_api','user_report','device_only'])).max(8).optional(),
      lang
    },
    annotations: { ...W, idempotentHint: true }
  }, wrap(async a => ok(E.reportCorrection(E.load(a.project_id, a.lang), a, a.lang))));

  server.registerTool('rocketlauncher_closed_test', {
    title: 'Closed test tracker (12 testers × 14 days)',
    description: 'Track Google Play\'s closed test for new personal developer accounts: at least 12 testers opted in for 14 days in a row before applying for production. action=status (count and earliest apply date), record (save testers as {label, opted_in, opted_out} with YYYY-MM-DD dates; a tester who opted out restarts their 14 days; plus optional feedback notes; nicknames only, never e-mails), application_draft (draft answers for "Apply for production"; the user submits it), recruit_copy (tester invitation texts in en/ko/th/zh/hi), check_optin_page (checks a tester web page for the Play opt-in link, in-app-browser escape and the 14-day notice). Stored only on this computer.',
    inputSchema: { project_id: pid, action: z.enum(['status', 'record', 'application_draft', 'recruit_copy', 'check_optin_page']).optional().describe('Default status'),
      account_type: z.enum(['personal_new', 'personal_old', 'organization']).optional().describe('personal_new = personal account created after 2023-11-13 (the rule applies)'),
      testers: z.array(z.object({ label: z.string().min(1).max(60).describe('Nickname or initials'), opted_in: z.string().optional().describe('YYYY-MM-DD'), opted_out: z.string().optional().describe('YYYY-MM-DD'), remove: z.boolean().optional() })).max(200).optional(),
      feedback: z.array(z.object({ date: z.string().optional(), text: z.string().max(500), from: z.string().max(60).optional() })).max(50).optional(),
      opt_in_link: z.string().max(300).optional().describe('For recruit_copy'),
      url: z.string().max(500).optional().describe('For check_optin_page: public https page to check'), html: z.string().max(500000).optional(), file: z.string().optional().describe('For check_optin_page: a page path inside the project'),
      lang }, annotations: { ...W, idempotentHint: true, openWorldHint: true }
  }, rt('closed_test'));

  server.registerTool('rocketlauncher_version_sync', {
    title: 'Version and build numbers',
    description: 'Check version names and build numbers across Android, iOS and related apps (e.g. country variants connected on this computer): mismatches, numbers already used (Apple treats 1.2 and 1.2.0 as the same), versionCode must grow, and a suggested next version. Force-update safety: warns when the server\'s minimum / latest version is higher than what the store shows (check_store=true does a free public App Store lookup). Saves used numbers on this computer.',
    inputSchema: { project_id: pid, other_project_ids: z.array(z.string()).max(20).optional().describe('Related Rocket Launcher projects to keep in sync'),
      used_versions: z.array(z.string()).max(200).optional().describe('Version names already released or uploaded'), used_version_codes: z.array(z.number().int()).max(200).optional(),
      planned_version: z.string().optional(), server_min_version: z.string().optional().describe('Force-update minimum version the server will return'), server_latest_version: z.string().optional(),
      store_visible: z.string().optional().describe('Version users can download now'), check_store: z.boolean().optional().describe('Look up the App Store version (public, free)'), country: z.string().length(2).optional(), lang },
    annotations: { ...W, idempotentHint: true, openWorldHint: true }
  }, rt('version'));

  server.registerTool('rocketlauncher_country_check', {
    title: 'Country rules',
    description: 'Country-specific rules that apply to the app, with official sources: Korea (location-based service report when location is sent to a server, App Store seller info for Korea-based developers, GRAC ratings), EU (DSA trader status on both stores), Thailand (PDPA privacy notice, developer verification). Legal summaries only, not legal advice.',
    inputSchema: { project_id: pid, countries: z.array(z.enum(['KR', 'EU', 'TH'])).optional().describe('Default all'), developer_country: z.string().length(2).optional().describe('Where the developer is based, e.g. KR, TH'), lang }, annotations: RO
  }, rt('countries'));

  server.registerTool('rocketlauncher_move_app_plan', {
    title: 'Plan moving an app to another developer account',
    description: 'Plan moving an app to another developer account. Two paths, shown neutrally (neither is the default): path=transfer (keeps package, users and reviews; Play needs both accounts\' registration transaction IDs; Firebase / AdMob / Analytics must be relinked) or path=new_registration (new package / bundle ID, new signing key, new Firebase project, closed test 12×14 for new personal Play accounts, store listing recreated; AdMob only if the app shows ads). Without path it compares both so the user can choose. key_backup_location saves only WHERE the signing key backup is kept (values that look like secrets are refused). Plans only: never transfers, deletes or creates anything.',
    inputSchema: { project_id: pid, path: z.enum(['transfer', 'new_registration']).optional().describe('Only after the user chose'), has_ads: z.boolean().optional().describe('Default: detected from the code'),
      account_type: z.enum(['personal_new', 'personal_old', 'organization']).optional().describe('The receiving Play account'), stores: z.array(z.enum(['play', 'apple'])).optional(),
      key_backup_location: z.string().max(200).optional().describe('Where the signing key backup is kept, e.g. "password manager vault: Android keys". Never the key or passwords'), lang },
    annotations: { ...W, idempotentHint: true }
  }, rt('move'));

  server.registerTool('rocketlauncher_remove_app_guide', {
    title: 'Unpublish or delete an app (guide)',
    description: 'Step-by-step guide to unpublish or delete an app on Google Play and the App Store, with the conditions (Play: fewer than 1,000 active devices, transaction ID format, 7-day restore, package name reuse only with zero installs; Apple: remove from sale first, states that block removal, name / SKU / bundle ID consequences). Guide only: Rocket Launcher never removes anything.',
    inputSchema: { store: z.enum(['play', 'apple']).optional().describe('Default both'), lang }, annotations: RO
  }, wrap(async a => ok(E.removeGuide(a.store, a.lang))));

  server.registerPrompt('launch_my_app', {
    title: 'Launch my app with Rocket Launcher',
    description: 'Start the Rocket Launcher flow for an app the user already built: first submit, waiting in review, rejected, or a live app update.',
    argsSchema: { app: z.string().optional().describe('Public GitHub URL or local path of the app (leave empty for the demo)') }
  }, ({ app }) => ({ messages: [{ role: 'user', content: { type: 'text', text: `Use Rocket Launcher to get my app ready for Google Play / App Store launch${app ? `: ${app}` : ' (use the built-in sample if I have nothing to connect yet)'}. I only want to pick and approve; do not submit anything without my approval.` } }] }));

  return server;
}
