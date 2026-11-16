# Connecting Rocket Launcher (Grok Bot · Claude · Cursor · Gemini CLI · other MCP apps)

Rocket Launcher runs as **one MCP server**. Connect it once to an AI such as Grok Bot, Claude, Cursor or Gemini CLI, and the user never has to open a website. They just tell the AI:

> "Help me launch my app with Rocket Launcher: https://github.com/me/my-app"
> "Show me Rocket Launcher with the sample app"

From then on the user only **picks, approves or rejects** the options the AI shows. Store submission is pressed by the user in the console after they approve; Rocket Launcher never submits anything by itself.

- Homepage: https://jaetaekoh.github.io/RocketLauncher/
- Web version: https://jaetaekoh.github.io/RocketLauncher/app/
- Contact: https://github.com/JaeTaekOh/RocketLauncher/issues · Free · No API keys or tokens
- Languages: tool texts in English (default), Korean, Thai, Simplified Chinese and Hindi via the `lang` argument (`en`, `ko`, `th`, `zh`, `hi`); store listings default to English
- Source: https://github.com/JaeTaekOh/RocketLauncher (MIT)
- npm package: [`rocket-launcher-mcp`](https://www.npmjs.com/package/rocket-launcher-mcp), run with `npx -y rocket-launcher-mcp`
- Requires: Node.js 20 or newer

There are two ways to use Rocket Launcher: connect this MCP server to Grok Bot, Claude, Cursor, or Gemini CLI (this page), or open the [web version](https://jaetaekoh.github.io/RocketLauncher/app/) in a browser with no install. A shorter connect guide is also on the [homepage](https://jaetaekoh.github.io/RocketLauncher/).

✅ = connection verified on a real client for this flow. 📄 = based on official docs only, not clicked through.

---

## Install

**Standard config** (works in most MCP clients):

```json
{
  "mcpServers": {
    "rocket-launcher": {
      "command": "npx",
      "args": ["-y", "rocket-launcher-mcp"]
    }
  }
}
```

That runs the [`rocket-launcher-mcp`](https://www.npmjs.com/package/rocket-launcher-mcp) package on Node.js 20 or later.

<details>
<summary>From a clone (alternative)</summary>

```bash
git clone https://github.com/JaeTaekOh/RocketLauncher.git
cd RocketLauncher/mcp
npm install
```

Replace `/ABS/PATH/TO/RocketLauncher` with the real path of your clone:

```json
{
  "mcpServers": {
    "rocket-launcher": {
      "command": "node",
      "args": ["/ABS/PATH/TO/RocketLauncher/mcp/server.mjs"]
    }
  }
}
```

</details>

---

## 1. Grok Bot

### 1-1. Add it as a "Command" server 📄

**Option A: ask your Bot**
> "Add an MCP server. Name Rocket Launcher, command `npx`, arguments `-y rocket-launcher-mcp`"

**Option B: in the desktop app**
1. Open **Connect apps** in the left sidebar.
2. Click **Add a custom connector** at the bottom.
3. Name: `Rocket Launcher`
4. Type: **Command**
5. Command: `npx`
6. Arguments: `-y rocket-launcher-mcp`
7. Click **Add plugin**.
8. From the next message on, the Bot can use the `rocketlauncher_…` tools.

Source: [Use the computer and apps](https://docs.x.ai/grok-bot/computer-and-apps): a Bot can add an MCP server that is not in the catalog by URL or by a command run on the Bot's computer, choosing Remote HTTPS or Command under Add a custom connector.

### 1-2. Remote HTTPS 📄 (not available yet)

Grok Bot also accepts MCP servers at a public HTTPS address. Rocket Launcher has an HTTP mode (`--http`), but no public HTTPS deployment exists. A local address (`http://127.0.0.1`) cannot be used by Grok Bot, because it connects from the cloud.

### 1-3. Marketplace listing (not submitted)

A marketplace listing needs a homepage and a contact email. The homepage is https://jaetaekoh.github.io/RocketLauncher/ and contact is GitHub issues.

| Item | What we found | Source |
|---|---|---|
| Channel 1 | SpaceXAI form `x.ai/bot/marketplace/submit-a-plugin`: submit a plugin or MCP server to be distributed to Grok, Grok Bot and Cursor users after review | The form page |
| Channel 2 | Cursor Marketplace `cursor.com/marketplace/publish`: submit a **public Git repository**, reviewed by the Cursor team | [Cursor Plugins reference](https://cursor.com/docs/reference/plugins) |
| Package format | Cursor Plugin: `.cursor-plugin/plugin.json` (required `name`) + `mcp.json` + `skills/` | Cursor docs |
| Terms | Submitting means agreeing to the Cursor Marketplace Publisher Terms | [Publisher Terms](https://cursor.com/marketplace-publisher-terms) |

---

## 2. Claude ✅ (verified in Claude Code for this style of server)

### Claude Code (terminal)
```bash
claude mcp add rocket-launcher -- npx -y rocket-launcher-mcp
claude mcp list        # → rocket-launcher: ... ✔ Connected
```
Local HTTP mode:
```bash
npx -y rocket-launcher-mcp --http          # http://127.0.0.1:5181/mcp
claude mcp add --transport http rocket-launcher-http http://127.0.0.1:5181/mcp
```

**As a local plugin:** `claude --plugin-dir plugin-package/rocketlauncher` after `bash tools/build_plugin.sh`.

### Claude Desktop 📄
Settings → Developer → **Edit Config** opens `claude_desktop_config.json`. Add the standard config above, then fully quit and reopen the app.

File location: macOS `~/Library/Application Support/Claude/claude_desktop_config.json`, Windows `%APPDATA%\Claude\claude_desktop_config.json`.
Source: [MCP docs](https://modelcontextprotocol.io/docs/develop/connect-local-servers).

---

## 3. Cursor ✅ (verified in Cursor CLI for this style of server)

Project `.cursor/mcp.json` or `~/.cursor/mcp.json`: use the standard config above.

With the Cursor CLI, `mcp enable rocket-launcher` → `mcp list` should show the server as ready and `mcp list-tools rocket-launcher` should list the tools. HTTP mode (`"url": "http://127.0.0.1:5181/mcp"`) is also supported.
Cursor IDE asks you to approve the server the first time.

---

## 4. Gemini CLI 📄

`~/.gemini/settings.json` (all projects) or `.gemini/settings.json` (one project): use the standard config above.

Restart Gemini CLI and run `/mcp` to see the tools. Source: [Gemini CLI MCP servers](https://geminicli.com/docs/tools/mcp-server/).

---

## 5. Other MCP apps ✅

- **stdio:** command `npx -y rocket-launcher-mcp` (or `node mcp/server.mjs` from a checkout). Example with the MCP Inspector CLI:
  ```bash
  npx @modelcontextprotocol/inspector --cli npx -y rocket-launcher-mcp --method tools/list
  ```
- **Streamable HTTP:** `npx -y rocket-launcher-mcp --http [--port 5181] [--host 127.0.0.1]` → endpoint `http://127.0.0.1:5181/mcp` (POST, stateless).
  - Host and Origin headers are checked; other Origins get 403.
  - In HTTP mode, reading paths on the server's disk (`source: "path"`) is off by default (turn on with `ROCKETLAUNCHER_ALLOW_PATH=1`), and the result ZIP is returned inline.

From a checkout you can also run:

```bash
cd mcp && npm start          # stdio
npm run http                 # http://127.0.0.1:5181/mcp
npm test                     # automated tests
```

## Environment variables

| Name | Default | Meaning |
| --- | --- | --- |
| `ROCKETLAUNCHER_HOME` | `~/.rocketlauncher` | Folder for progress and generated materials |
| `ROCKETLAUNCHER_ALLOW_PATH` | on for stdio / off for HTTP | Allow connecting local folders and ZIPs |
| `ROCKETLAUNCHER_ALLOWED_ORIGINS` | none | Origins allowed in HTTP mode (comma separated) |
| `ROCKETLAUNCHER_ALLOWED_HOSTS` | localhost port | Hosts allowed in HTTP mode |
| `ROCKETLAUNCHER_LESSONS_API` | `lessonsApiUrl` in `js/config.js` (`https://rocket-launcher-lessons.prezentree.workers.dev/api/lessons`) | Shared review-lessons API base URL. Set it to an empty value to keep lessons only on this computer. If the variable is omitted, the default URL is used. |

Tool texts come in `en` (default), `ko`, `th`, `zh` (Simplified Chinese) and `hi` (Hindi). The AI passes the user's language as the optional `lang` argument on each call; when it is left out, texts are in English. Store listings for the user's app default to English (`langs: ["en"]`, recommended); Korean, Thai, Chinese and Hindi listings can be added if the user picks them.

## Example conversation

1. User: "My app is done. Help me launch it with Rocket Launcher. github.com/me/myapp"
2. The AI calls `rocketlauncher_connect_app` and says: "Launch readiness is 35%. There are 5 must-fix items."
3. The AI calls `rocketlauncher_get_decisions` and asks: "For the store name: ① SnapLedger ② SnapLedger - Budget tracker. Which one?" Icons and feature graphics are shown as images via `rocketlauncher_preview_graphics`.
4. User: "Number 2. Recommended for the rest." → `rocketlauncher_decide`
5. The AI makes the store text, policies, form answers, graphics and ZIP with `rocketlauncher_generate_store_materials`.
6. The AI walks through Play Console with `rocketlauncher_submission_guide`, giving the value to paste at each step. The final step is locked.
7. User: "OK, I'll submit." → `rocketlauncher_approve_submission`. The user presses the submit button in the console.
8. User: "Apple rejected it. (pastes message)" → `rocketlauncher_report_review` returns a fix plan and a reply.
9. User: "Both are live!" → Launched. Rocket Launcher's job ends here.
