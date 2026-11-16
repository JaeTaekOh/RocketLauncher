# Rocket Launcher shared lessons API (Cloudflare Worker template)

Deploy this Worker on the project owner’s Cloudflare account, then set `js/config.js` `lessonsApiUrl` (and/or the `ROCKETLAUNCHER_LESSONS_API` environment variable) to the public URL, for example `https://<your-host>/api/lessons`. Leave that URL empty until the server is live.

- `POST` — body must be exactly `{ "v": 1, "event": "rejected" | "passed", "store": "apple" | "play", "codes": [...], "advice_id": "..." }`
  (`v` and `event` optional). `codes`: App Review guideline numbers (`5.1.1(v)`), `ITMS-#####`, or a fixed Google Play policy id.
  `advice_id`: a key of the fixed table (`src/table.js`, generated from `js/lessons.js`). Any other field, free text, or body over 2 KB is rejected.
  Rate limit: 30 posts per hour per salted IP hash (KV key expires after 1 hour). Returns `202`.
- `GET` — `{ lessons: [{ store, codes, advice_id, title, advice, count, passed, last_seen }] }`, titles / advice only from the fixed table.
  Cached (`Cache-Control: public, max-age=900`). `?test=1` shows only the test-only rows (`advice_id: "test"`), which never appear in the public feed.
- Storage: one KV namespace (`LESSONS`), key `feed:v1` = aggregate rows (store + advice id + codes → count / passed / first / last day). No per-user rows, no IPs, no bodies.
- CORS: `http://localhost` and `http://127.0.0.1` are allowed for local development. Set the `CORS_ORIGINS` Worker secret or var (comma-separated https origins) when the web app has a public host.

## Build and test
```bash
node workers/lessons/build-table.mjs        # after changing js/lessons.js tables
node workers/lessons/test/worker.test.mjs   # local tests with an in-memory KV
```

## Deploy
Create a KV namespace and a Worker named `rocket-launcher-lessons` on the owner’s Cloudflare account (free tier is enough). Bind KV as `LESSONS`, set the route or `workers.dev` URL to serve `/api/lessons`, and put that public URL into `lessonsApiUrl` / `ROCKETLAUNCHER_LESSONS_API` before publishing the npm package. Do not attach this Worker to a third-party or previous-product zone.
