# Changelog

## 0.2.5

The simulation corpus grew from 39 to 100 small synthetic apps (`mcp/test/sim/`, about 200 KB on disk; large model files are created at run time as sparse files). On all 100 apps, 0.2.4 got 526 of 574 checks right, and 3 apps (Unity and Godot) could not be connected at all, so 31 more checks never ran. 0.2.5 gets all 605 checks right.

- **More project types.** Unity (`ProjectSettings.asset`: ids, version, version code, SDK levels; target SDK 0 means "highest installed" and is reported as unread), Godot 4 (`export_presets.cfg` Android and iOS presets), .NET MAUI (`.csproj` ApplicationId / versions, `Platforms/Android` manifest, NuGet packages) and NativeScript (`nativescript.config.ts`, `App_Resources/Android/app.gradle`). In a monorepo, the app's `package.json` and `app.json` are used (the ones with mobile framework dependencies) instead of the workspace root. Unity and Godot count as engines that ship native libraries in the 16 KB page-size check.
- **Android build files.** The app id, versions and SDK levels come from `defaultConfig`, so a product flavor listed earlier with its own `applicationId` is no longer reported as the app. Flavor and build-type dependencies (`freeImplementation`, `"paidImplementation"(…)`) now count, but debug and test ones do not. Permissions and services in local library modules (`com.android.library`) are merged, as the Android build does. `targetSdkVersion project.targetSdkVersion.toInteger()` is resolved from `gradle.properties`. `<uses-sdk>` in the manifest is used when no Gradle module sets SDK levels (MAUI, old projects).
- **iOS targets.** When a project has a widget, app extension or watch app, the app's own `Info.plist` and bundle id are used, not the extension's. HealthKit now needs `NSHealthShareUsageDescription` / `NSHealthUpdateUsageDescription`, like camera and location.
- **Store stage.** A saved rejection message in the project (for example `docs/app-review/rejection.md` with an App Review guideline, or a Play Console policy e-mail) suggests "rejected" for that store, and you are still asked to confirm. Fastlane listings in languages outside the five UI languages, such as Arabic, Hebrew or Persian, now count as listings.
- **New checks.**
  - Ads without a consent SDK (Google UMP or an IAB TCF CMP).
  - Auto-renewing subscriptions without a Terms of Use / EULA link. One-time products are not affected.
  - Personal loan apps. A loan or mortgage calculator does not count.
  - Gambling and betting.
  - VPN apps (Android `VpnService`, iOS Network Extension).
  - Social or AI chat content without a way to report or block it.
  - Foreground services without `foregroundServiceType` or the matching `FOREGROUND_SERVICE_<TYPE>` permission (targetSdk 34+).
  - `USE_EXACT_ALARM` in an app that is not an alarm clock or calendar.
  - Accessibility services.
  - Health Connect permissions.
  - Attribution SDKs on iOS (AppsFlyer, Adjust, Branch, Kochava, Singular) when the app declares no tracking.
  - Large files of 150 MB or more in the Android base module. Play Asset Delivery packs do not count.
- **Messy files.** Text files saved as UTF-16 (with a BOM) or in Latin-1 are decoded correctly, and a UTF-8 BOM is removed.
- **Categories.** New category: Weather. Scanners, PDF tools, VPNs, launchers and measuring tools count as Tools, and ticket marketplaces count as Shopping.

Known limitations:
- Policy areas such as loans, gambling, children and AI chat are detected from keywords in the app name, README and listing copy.
- A rejection note is read only if its file name or folder says so (reject, app-review, review-notes, resolution-center), and an old note still suggests "rejected" until you confirm the stage.
- The foreground service check sees services declared in the app and in local library modules, but not those merged in from remote AAR dependencies.
- The Android 13 notification permission is not checked, because libraries often merge it in.
- The large-file check adds up file sizes before compression.
- Unity Android settings in `Assets/Plugins/Android` overrides, and Godot settings stored only in `.godot/` caches, are not read.

## 0.2.4

Checked against a new simulation corpus: 39 small synthetic apps with known correct answers (`mcp/test/sim/`, `npm run sim`, part of `npm test`). Version 0.2.3 got 273 of 332 checks right on it, and 3 of the apps could not be connected at all. 0.2.4 gets all 366 right.

- **More project types.** Cordova projects are read from `config.xml`, so the `platforms/` folder no longer has to be committed (id, version, `android-versionCode`, SDK preferences, platforms). Kotlin Multiplatform apps are recognized, including an Android module such as `composeApp/` whose plugin comes from the version catalog. Bubblewrap Trusted Web Activities are recognized from `twa-manifest.json`. An Expo app with a plain `app.json` (no `android` / `ios` block) or only a dynamic `app.config.js` now connects for both stores.
- **Versions and SDK levels.** Flutter version and build number come from `pubspec.yaml` (Gradle `flutter.versionName` / `flutterVersionCode` and Xcode `$(FLUTTER_BUILD_NAME)` were reported as text before). An Expo version comes from `app.json` before `package.json`, and an Expo targetSdk set with `expo-build-properties` is read. Commented-out Gradle lines no longer count, for example `// targetSdk 33` above the real value.
- **Icons.** A flat two-color icon, such as a white glyph on a solid background, is artwork and no longer "blank". A new warning flags an App Store icon with transparent pixels, which App Store Connect rejects (ITMS-90717).
- **SDK detection.** Comments in code, `pubspec.yaml` and the Podfile no longer count, so a commented-out ads, analytics or crash SDK is not reported. In-app purchases now come from real declarations, such as Play Billing, StoreKit (`import StoreKit`, `Product.products`) and IAP plugins, instead of any "billing" or "purchases" word. A `billingAddress` field is not IAP, and native StoreKit 2 apps are now found. Plain Realm is an on-device database, so only Realm Sync counts as cloud data. Supabase counts as sign-in only when its auth API is used.
- **iOS purpose strings.** Location, contacts and microphone are now checked like the camera, based on what the iOS app itself uses (cross-platform plugins, iOS or web code). An Android-only permission no longer requires an iOS string. Expo apps without an `ios/` folder are skipped, because Expo adds default strings for its modules. The Info.plist patch now adds missing keys, not only empty ones.
- **Children's apps.** A new warning appears when an app aimed at children uses ads or analytics. It covers the Google Play Families policy and the App Store Kids category rules.
- **Categories.** New categories: Music & Audio / Music and Social / Social Networking. Translators and dictionaries count as Tools (a translator mentioning "menu" was suggested as Food).
- **Privacy URL.** A policy hosted on GitHub Pages, Google Sites, Notion, Firebase Hosting, Cloudflare Pages, Netlify or Vercel is now accepted (`*.github.io` and `sites.google.com` were dropped as third-party sites). A policy page only in an archived `old-site/` folder no longer counts as having a policy.
- **Languages.** In-app languages also come from `locales/*.json` / `i18n/*.json` files and `*.lproj` folders. Flutter `app_zh_Hans.arb` counts as `zh`.

Known limitations: `app.config.js` is read for plain literals only, so values computed at build time are not seen. Store metadata or a store link in the repo still suggests "live", but you are always asked to confirm. Category and children's-app detection rely on keywords in the app name and README. Any cloud database is drafted as "user-generated content" in Data safety, even when the app only reads public data. The transparent-icon check sees transparent pixels, not a fully opaque alpha channel. Cordova permissions are not read without a generated `platforms/` folder.

## 0.2.3

- **Icons.** The iOS 1024 App Store icon and the Android launcher icon are now read pixel by pixel. A blank, single-color or near-uniform icon gets a warning (a found file is no longer enough to pass), and an iOS icon that does not look like the Android icon is flagged. Store graphics are built from the icon with artwork. Pixels are read with a small built-in PNG decoder, or with the optional graphics package for other formats.
- **Ads.** An ad SDK counts only when it is really declared: Gradle or version-catalog dependencies, package.json, pubspec, Podfile or Package.swift, installed Capacitor / Cordova plugins, the AndroidManifest ads `APPLICATION_ID` meta-data or Info.plist `GADApplicationIdentifier`. A name that appears only in app code (a config placeholder, a bundled or minified script) is shown as an info-level hint and no longer triggers the "contains ads" or ATT / non-personalized-ads warnings.
- **Category.** New Maps & Navigation (Play) / Navigation (App Store) category. Fuel, gas station, map, route and parking apps are recognized in English, Korean, Thai, Chinese and Hindi. The app name and README title weigh more, words like "App Store" no longer count as shopping, and the second suggestion is a related category instead of always Productivity.
- **Privacy policy URL.** Sources are ranked: `rocketlauncher.json`, store metadata (fastlane), app config (app.json, Info.plist, strings, config scripts), then the README. Archived, old, backup and build folders are skipped. A URL seen only in a loose website page is listed for you to confirm instead of being used, URLs that disagree are all listed with a warning, and the chosen URL is checked with a short HEAD request (never fatal; `ROCKETLAUNCHER_VERIFY_URLS=0` turns it off).
- **Store stage.** With no store hints the stage is now "unknown — please confirm" instead of "not submitted", and "accept all recommended" never picks an unknown stage. A stage recorded in `rocketlauncher.json` (including App Store Connect / Play Console state names) is used as recorded, a stage already chosen for the project is the recommendation, and an earlier Rocket Launcher project for the same app on this computer that is in review, rejected or live is offered as the recommendation for you to confirm.
- New optional project file `rocketlauncher.json` (`privacy_url`, `support_url`, `category`, `store_stage`, `app_store_state`, `play_state`).

## 0.2.2

- Broader account-deletion and location-sharing detection, including Capacitor / Cordova / Ionic web assets, i18n keys, HTTP DELETE helpers, and lat/lng query strings passed to wrapper fetch functions. Uncertain findings are marked for confirmation instead of counted as a pass.
- Privacy checks now detect Firebase Auth and Firestore in web JavaScript (name, email, user IDs, and synced user content).
- New tool `rocketlauncher_report_correction`: override a wrong check for the connected app, recalculate readiness, and optionally send an anonymized record (check id and verdicts only) to the shared lessons API. A token-protected `/admin` view on the lessons Worker shows stacked correction counts.

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
