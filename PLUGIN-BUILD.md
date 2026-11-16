# Rocket Launcher — plugin and npm package build

```bash
cd mcp && npm install && npm test && npm run bundle
cd .. && bash tools/build_plugin.sh
```

Results:

- `plugin-package/rocketlauncher/` — Cursor / Claude plugin folder
- `plugin-package/rocket-launcher-plugin-0.2.0.zip`
- `plugin-package/npm/rocket-launcher-mcp/` — npm package (`npx -y rocket-launcher-mcp`)
- `plugin-package/npm/rocket-launcher-mcp-0.2.0.tgz`

The shared lessons API URL (`js/config.js` `lessonsApiUrl`, default `https://rocket-launcher-lessons.prezentree.workers.dev/api/lessons`, overridable with `ROCKETLAUNCHER_LESSONS_API`) is set on the owner’s Cloudflare Worker. Do not `npm publish` until the owner asks.
