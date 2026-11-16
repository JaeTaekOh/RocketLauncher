# Rocket Launcher

A free web tool and MCP server that helps people who built an Android or iOS app with AI get it all the way to **launched on the stores**: a first submit, an app waiting in review, a rejected app, or an update of a live app.
You give one input. Connect the app (a public GitHub URL, a ZIP, or a folder) and from then on you only **pick, approve or reject**.
Nothing is submitted to a store automatically. The final step unlocks only after you approve.

The interface and the MCP tool texts come in five languages: English (`en`, the default), Korean (`ko`), Thai (`th`), Simplified Chinese (`zh`) and Hindi (`hi`). The web app always opens in English (it does not follow the browser or device language); pick another language from the globe button in the header on any screen, and that choice is remembered on this browser. The docs are in English.

## Any store stage

Rocket Launcher is for apps at every stage, per store: **not submitted yet** (first submit), **in review** (uploaded, waiting), **rejected**, and **live** (an update). The stage is the first, required choice for each store; hints in the project (Play / App Store links, fastlane metadata, version numbers) only recommend one and never force a first launch.

- In review: nothing to submit and no new app record. Replacing the build can withdraw or delay the review, so a new build is offered only if you choose it. You get help to wait, a reply draft for "Information Needed" (you send it) and metadata-only fixes.
- Rejected: paste the store's message first (`rocketlauncher_report_review`); you get a fix plan, a reply draft and a resubmit guide, using built-in checks plus lessons learned on this computer (and, when a lessons API is configured, lessons from other users).
- Live: an update. No closed test; the live listing (name, descriptions, category, languages, graphics, privacy URL) is kept, and the guide covers the new version and "What's new". Technical checks still run.

## Use it from your AI (MCP · Grok Bot · Claude · Cursor)

You can also skip the website and tell your AI: "Help me launch my app with Rocket Launcher". The MCP server lives in `mcp/` and is intended to be published on npm as [`rocket-launcher-mcp`](https://www.npmjs.com/package/rocket-launcher-mcp) (`npx -y rocket-launcher-mcp`). Connection steps are in [PLUGIN.md](PLUGIN.md).

```bash
cd mcp && npm start      # stdio
npm test                 # automated tests
```

## Run the web app

```bash
npm start            # = node server.mjs
# open http://127.0.0.1:5180/ in a browser
```

- Node 18 or newer. Nothing to install.
- Change the port with `PORT=8080 npm start`.
- Opening `index.html` directly (file://) also works for the built-in sample and ZIP/folder connections. Public GitHub connections call the GitHub API from the browser and fall back to the local server's `/gh` proxy when blocked.

## Flow

1. Home: connect an app (GitHub URL / ZIP / folder) or **try the sample**
2. Analyze: launch readiness, must-fix / recommended / good to know
3. Decide: on each card, pick one of the AI-made options, or approve / reject
4. Store assets: name and descriptions (English by default and recommended; Korean, Thai, Simplified Chinese or Hindi listings can be added for your app if you want), icon, feature graphic, screenshots, privacy policy, Data safety / App Privacy, content rating (IARC) answers
5. Submit guide: step-by-step copy buttons for Play Console / App Store Connect; the final step unlocks only after approval
6. Review: approved or rejected. Pick the rejection reason to get a fix plan and a reply to the reviewer
7. Live

## Folders

| Path | Contents |
|---|---|
| `index.html`, `privacy.html` | App screens, this tool's privacy policy |
| `css/` | Design (styles.css), shared motion, self-hosted font definitions |
| `js/` | config, i18n (five languages), zip, sources, analyzer, generator, graphics, app |
| `js/flow.js` | Flow rules shared by the web app and the MCP server |
| `sample/snapledger/` | Built-in sample app source (SnapLedger) |
| `tools/` | Sample data build, sample images, screenshot automation, plugin build |
| `sample-output/` | Example ZIP you get after finishing the sample |
| `mcp/` | MCP server (for Grok Bot, Claude, Cursor) |
| `workers/lessons/` | Cloudflare Worker for the shared, anonymized review-lessons API (live on the owner's account) |
| `plugin-src/` | Plugin source (`bash tools/build_plugin.sh` writes `plugin-package/`) |

## Settings

`js/config.js`

- `feedbackUrl`: where the feedback button points (GitHub issues until a dedicated site exists)
- `showAdSlotPlaceholder`: ad space placeholder (not a real ad). Set `false` to hide it
- `lessonsApiUrl`: base URL of the shared review-lessons API (`https://rocket-launcher-lessons.prezentree.workers.dev/api/lessons`). The MCP server can also override it with `ROCKETLAUNCHER_LESSONS_API`. When empty or unreachable, learning stays on this device only.

## Rebuild the sample / recapture screens

```bash
npm run sample   # sample/snapledger → js/sample-data.js
npm run shots    # needs the server running; updates preview screenshots
```

## Principles

- Free, static files only, never asks for API keys or tokens
- App files are read only on this device and uploaded nowhere (progress is saved only in this browser's localStorage, or in `~/.rocketlauncher` for the MCP server)
- Shared review lessons: when a lessons API is configured, a real pasted store result sends only `{store, codes, advice_id, event}` so everyone gets better checks; never the store message, app name, ids or free text. The demo never sends. If the API is unset or down, everything still works locally. See `privacy.html`.
- Nothing after launch

## License

MIT (see LICENSE). © Prezentree. Feedback: https://github.com/JaeTaekOh/rocketlauncher/issues
