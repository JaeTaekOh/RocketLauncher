# Rocket Launcher shared lessons API (Cloudflare Worker template)

This Worker is deployed on the project owner’s Cloudflare account. `js/config.js` `lessonsApiUrl` (and/or the `ROCKETLAUNCHER_LESSONS_API` environment variable) is set to `https://rocket-launcher-lessons.prezentree.workers.dev/api/lessons`.

- `POST` — body must be exactly `{ "v": 1, "event": "rejected" | "passed", "store": "apple" | "play", "codes": [...], "advice_id": "..." }`
  (`v` and `event` optional). `codes`: App Review guideline numbers (`5.1.1(v)`), `ITMS-#####`, or a fixed Google Play policy id.
  `advice_id`: a key of the fixed table (`src/table.js`, generated from `js/lessons.js`). Any other field, free text, or body over 2 KB is rejected.
  Rate limit: 30 posts per hour per salted IP hash (KV key expires after 1 hour). Returns `202`.
- `GET` — `{ lessons: [{ store, codes, advice_id, title, advice, count, passed, last_seen }] }`, titles / advice only from the fixed table.
  Cached (`Cache-Control: public, max-age=900`). `?test=1` shows only the test-only rows (`advice_id: "test"`), which never appear in the public feed.
- Storage: one KV namespace (`LESSONS`), key `feed:v1` = aggregate rows (store + advice id + codes → count / passed / first / last day). No per-user rows, no IPs, no bodies.
- CORS: `http://localhost` and `http://127.0.0.1` are allowed for local development. Set the `CORS_ORIGINS` Worker secret or var (comma-separated https origins) when the web app has a public host.
- `POST /api/corrections` — anonymized check-correction reports: `{ "v": 1, "check_id", "wrong_verdict", "corrected_verdict", "framework", "language", "pattern_kinds" }`. Allowlisted values only; no code, names, or paths. Same rate limit as lessons.
- `GET /admin` — token-protected HTML view (enter the `ADMIN_TOKEN` on the page). `GET /api/admin/stats` returns lesson and correction counts, the most common miscorrections, and the most recent 50 reports. Set the token with `wrangler secret put ADMIN_TOKEN`.

## Build and test
```bash
node workers/lessons/build-table.mjs        # after changing js/lessons.js tables
node workers/lessons/test/worker.test.mjs   # local tests with an in-memory KV
```

## Deploy
The Worker is named `rocket-launcher-lessons`, binds KV as `LESSONS`, and is served at the `workers.dev` URL above (`/api/lessons`, `/api/corrections`, `/admin`). Do not attach this Worker to a third-party or previous-product zone. Wrangler should be run with a local (gitignored) `node_modules` in this folder so it does not try to write a cache under a system `/node_modules` directory.

© Prezentree
