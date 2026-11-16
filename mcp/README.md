# Rocket Launcher MCP server

- Run: `npm start` (stdio) · `npm run http` (http://127.0.0.1:5181/mcp) · `npm test`
- Single-file bundle: `npm run bundle` → `dist/rocket-launcher-mcp.mjs`
- How to connect: `../PLUGIN.md`
- The analysis and generation logic loads the web app's `../js/*.js` as-is (`lib/runtime.mjs`).
- Languages: the optional `lang` argument accepts `en` (default), `ko`, `th`, `zh` (Simplified Chinese) and `hi` (Hindi). Omitted → English. Store listings default to English; ko/th/zh/hi listings are optional.
- Shared lessons API: `ROCKETLAUNCHER_LESSONS_API` or `lessonsApiUrl` in `js/config.js`. Leave empty until the new server URL is set.
