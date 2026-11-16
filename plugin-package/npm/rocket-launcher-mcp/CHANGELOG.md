# Changelog

## 0.2.1

Listing metadata only; no tool or behavior changes.

- npm package now carries `mcpName` (`io.github.JaeTaekOh/rocket-launcher`) so it can be listed in the official MCP Registry (`server.json` in the repo).
- `glama.json` and a `Dockerfile` for MCP directory listings.

## 0.2.0

Release checks before you submit. All free, no API keys, nothing is submitted or deleted for you.

- `rocketlauncher_check_requirements`: store technical requirements with dates (target API 36, 16 KB page size from the native `.so` alignment, app registration / developer verification, trader status, Xcode 26, minimum iOS, required-reason APIs, export compliance, new age-rating questions, account deletion). Rules live in one table, `data/store-requirements.json`, each with its official source and the date it was verified. Where sources disagree (16 KB pages) the earliest date is used.
- `rocketlauncher_privacy_check`: Data safety, App Privacy, PrivacyInfo.xcprivacy, permissions, purpose strings and privacy policy cross-checked (location, ATT, photos, required-reason APIs) plus drafts for each.
- `rocketlauncher_play_policy_audit`: quick Google Play policy scan with Google's open-source Play Policy Insights rules (Apache-2.0, bundled under `vendor/` with LICENSE and NOTICE) and the offline full audit.
- `rocketlauncher_reviewer_notes`: App Review notes and Play App access drafts (placeholders only, never passwords).
- `rocketlauncher_account_deletion_check`: in-app and web deletion paths.
- `rocketlauncher_closed_test`: 12 testers × 14 days tracker for new personal Play accounts (a tester who leaves restarts their 14 days), production-access application draft, tester invitations in five languages, tester page check for in-app browsers.
- `rocketlauncher_version_sync`: version / build numbers across platforms and related apps, Apple's 1.2 = 1.2.0 rule, force-update safety.
- `rocketlauncher_country_check`: Korea (location-based service report, App Store seller info for Korea-based developers, GRAC), EU DSA trader status, Thailand PDPA and developer verification.
- `rocketlauncher_move_app_plan`: moving an app to another developer account, with both paths (transfer / new registration) shown neutrally; AdMob only if the app shows ads; records only where the signing key backup is kept.
- `rocketlauncher_remove_app_guide`: unpublish / delete steps and conditions for both stores.
- `rocketlauncher_get_report` now includes `release_checks`; the submission guide has a "Release checks" step before the final submit.
- Play help links that no longer resolve were replaced or removed.

## 0.1.0

- First Rocket Launcher release: MCP tools to connect an already-built app, report readiness, present decisions, record choices, preview graphics, generate store materials, walk through a submission guide, record approval (never auto-submit), report review results, show status, and forget a learned lesson.
- Works at every store stage, per store: `not_submitted` (first submit), `in_review`, `rejected` and `live` (update).
- Learns from store review results on this computer (generalized lessons, never raw store messages).
- Optional shared review lessons: when a lessons API is configured (`lessonsApiUrl` / `ROCKETLAUNCHER_LESSONS_API`), anonymized codes are sent and an aggregated feed can be shown as "From other reviews". If the URL is empty or the server is unreachable, everything still works locally. The built-in demo never sends.
- Five languages for tool and UI texts: English (default), Korean, Thai, Simplified Chinese and Hindi. Store listings default to English.
- App Store review lessons built into analysis, choices, generated files and the submission guide (tracking/ATT alignment, login, Sign in with Apple, support URL, metadata, and related checks).
