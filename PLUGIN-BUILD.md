# Rocket Launcher — plugin and npm package build

```bash
cd mcp && npm install && npm test && npm run bundle
cd .. && bash tools/build_plugin.sh
```

Results:

- `plugin-package/rocketlauncher/` — Cursor / Claude plugin folder
- `plugin-package/rocket-launcher-plugin-0.1.0.zip`
- `plugin-package/npm/rocket-launcher-mcp/` — npm package (`npx -y rocket-launcher-mcp`)
- `plugin-package/npm/rocket-launcher-mcp-0.1.0.tgz`

The shared lessons API URL (`js/config.js` `lessonsApiUrl`, overridable with `ROCKETLAUNCHER_LESSONS_API`) must be filled in with the owner’s own server **before** `npm publish`. Do not publish while it is empty.
