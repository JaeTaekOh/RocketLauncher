# Simulation corpus

`fixtures/` holds small synthetic app projects (no real SDKs, no `node_modules`, tiny generated PNG icons). Each folder is one app
plus `expected.json` with the correct answers. `run-sim.mjs` connects every fixture through the real MCP code path
(`engine.connect` → analyzer, icon check, store stage, release checks; Data safety rows from `engine.release('privacy')`),
offline (`ROCKETLAUNCHER_VERIFY_URLS=0`, shared lessons pointed at a dead local port, temporary data folder), and prints a scorecard.

```
npm run sim                     # from mcp/ (also part of npm test)
node test/sim/run-sim.mjs --only cordova --verbose
node test/sim/run-sim.mjs --json scorecard.json
node test/sim/run-sim.mjs --actual actual.json   # everything the tool reported, per fixture
```

## expected.json fields (all optional; only the given ones are checked)

| field | compared with |
| --- | --- |
| `error` | connect error code (`noapp`), or none |
| `name`, `framework`, `platforms`, `package`, `version`, `versionCode`, `targetSdk` | app facts |
| `category` | first suggested category |
| `stage.play` / `stage.apple` | recommended store stage (`unknown` = ask the user) |
| `ads`, `ads_hint`, `iap`, `sdk.<flag>` | SDK detection |
| `data_safety` | Data safety row ids (`name`, `email`, `uid`, `ugc`, `fin`, `loc`, `usage`, `crash`, `diag`, `adid`) |
| `privacy_url`, `privacy_conflict`, `privacy_weak` | privacy policy URL choice |
| `icon.found`, `icon.ios_blank`, `icon.android_blank`, `icon.mismatch` | icon pixel checks |
| `app_langs`, `listing_langs.play` / `.apple` | in-app languages, fastlane listing languages |
| `requirements.<id>` | severity of a release requirement row (`block`, `warn`, `ok`, …) from `engine.release('requirements')` |
| `issues_present`, `issues_absent` | issue ids that must / must not be raised |
| `extra` | 0.2.6 checks: `screenshots`, `feature_graphic`, `feature_rec`, `prepared_title`, `prepared_default_lang`, `rec_langs`, `title_rec_label`, `category_source`, `deletion_url`, `deletion_path`, `deletion_note_placeholder`, `built_target`, `binaries`, `form_factors`, `form_factors_rec`, `privacy_stale`, `removed_permissions`, `guide_partial`, `guide_default_lang`, `guide_form_factors`, `guide_deletion_url`, `closed_test_value`. A value, or `{ "match": "regex", "no_match": "regex" }` for text |
| `_sparse` | `{ "<path>": <bytes> }`: large files created at run time as sparse files in a temporary copy (model / asset size checks), so nothing big is committed |

The runner also checks that every issue id the corpus produces, and every framework label, has texts in en / ko / th / zh / hi.

`known-limitations.json` maps `"<fixture>:<field>"` (or `"*:<field>"`) to a reason. Listed mismatches are reported but do not fail the run.
It is empty: every check passes. Limitations that are not covered by a failing check are listed in the CHANGELOG (0.2.4, 0.2.5, 0.2.6).

Scorecards: `scorecard-0.2.3-baseline.json` (first 39 apps on 0.2.3), `scorecard-0.2.4.json` (39 apps on 0.2.4), `scorecard-0.2.4-baseline-100.json` (all 100 apps on 0.2.4, before the 0.2.5 fixes) `scorecard-0.2.5.json` (all 100 apps on 0.2.5) and `scorecard-0.2.6.json` (104 apps on 0.2.6).

Fixtures 101-104 are trimmed, anonymized copies of the layouts of two real launches (a Capacitor staff app and a Korean fuel-price app with Android Auto). The real projects themselves are checked in place, read-only, by `test/real-projects.mjs` when they are on the computer (skipped otherwise).
