# Simulation corpus

`fixtures/` holds small synthetic app projects (no real SDKs, no `node_modules`, tiny generated PNG icons). Each folder is one app
plus `expected.json` with the correct answers. `run-sim.mjs` connects every fixture through the real MCP code path
(`engine.connect` → analyzer, icon check, store stage, release checks; Data safety rows from `engine.release('privacy')`),
offline (`ROCKETLAUNCHER_VERIFY_URLS=0`, shared lessons pointed at a dead local port, temporary data folder), and prints a scorecard.

```
npm run sim                     # from mcp/ (also part of npm test)
node test/sim/run-sim.mjs --only cordova --verbose
node test/sim/run-sim.mjs --json scorecard.json
```

## expected.json fields (all optional; only the given ones are checked)

| field | compared with |
| --- | --- |
| `error` | connect error code (`noapp`), or none |
| `framework`, `platforms`, `package`, `version`, `versionCode`, `targetSdk` | app facts |
| `category` | first suggested category |
| `stage.play` / `stage.apple` | recommended store stage (`unknown` = ask the user) |
| `ads`, `ads_hint`, `iap`, `sdk.<flag>` | SDK detection |
| `data_safety` | Data safety row ids (`name`, `email`, `uid`, `ugc`, `fin`, `loc`, `usage`, `crash`, `diag`, `adid`) |
| `privacy_url`, `privacy_conflict`, `privacy_weak` | privacy policy URL choice |
| `icon.found`, `icon.ios_blank`, `icon.android_blank`, `icon.mismatch` | icon pixel checks |
| `app_langs`, `listing_langs.play` / `.apple` | in-app languages, fastlane listing languages |
| `issues_present`, `issues_absent` | issue ids that must / must not be raised |

The runner also checks that every issue id the corpus produces, and every framework label, has texts in en / ko / th / zh / hi.

`known-limitations.json` maps `"<fixture>:<field>"` (or `"*:<field>"`) to a reason. Listed mismatches are reported but do not fail the run.
It is empty: every check passes. Limitations that are not covered by a failing check are listed in the CHANGELOG (0.2.4).

`scorecard-0.2.3-baseline.json` is the first run of this corpus against 0.2.3 (before the fixes); `scorecard-0.2.4.json` is the final run.
