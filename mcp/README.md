# Rocket Launcher MCP server

- Run: `npm start` (stdio) · `npm run http` (http://127.0.0.1:5181/mcp) · `npm test`
- Single-file bundle: `npm run bundle` → `dist/rocket-launcher-mcp.mjs`
- How to connect: `../PLUGIN.md`
- The analysis and generation logic loads the web app's `../js/*.js` as-is (`lib/runtime.mjs`).
- Languages: the optional `lang` argument accepts `en` (default), `ko`, `th`, `zh` (Simplified Chinese) and `hi` (Hindi). Omitted → English. Store listings default to English; ko/th/zh/hi listings are optional.
- Release checks (0.2.0): `lib/release.mjs` (+ `lib/release-i18n.mjs`). Rules: `../data/store-requirements.json`. Google's Play Policy Insights (Apache-2.0): `../vendor/play-policy-insights/`. Tests: `test/release.mjs` (set `ROCKETLAUNCHER_TODAY=YYYY-MM-DD` to pin the date).
- Shared lessons API: `ROCKETLAUNCHER_LESSONS_API` or `lessonsApiUrl` in `js/config.js` (default `https://rocket-launcher-lessons.prezentree.workers.dev/api/lessons`).

© Prezentree
