# Rocket Launcher

**From "my app is done" to "launched" on Google Play and the App Store — first submit, waiting in review, rejected, or a live app update. You only pick and approve.**
Free · no API keys · English (default) + 한국어 · ภาษาไทย · 中文 · हिन्दी · feedback: https://github.com/JaeTaekOh/RocketLauncher/issues

## Two ways to use it

- **Connect the MCP server** to Grok Bot, Claude, Cursor, or Gemini CLI. Step-by-step instructions are on the [connect page](https://jaetaekoh.github.io/RocketLauncher/). The usual install is `npx -y rocket-launcher-mcp`.
- **Use the web version** in your browser, with no install: [jaetaekoh.github.io/RocketLauncher/app](https://jaetaekoh.github.io/RocketLauncher/app/).

Rocket Launcher is an MCP server (plus a skill) for people who built an Android and/or iOS app with AI. Connect the app once, and your AI assistant can:

- find what blocks store review (target SDK, permissions, missing privacy policy, account deletion, iOS privacy manifest, empty permission texts, ads ID, closed-test rule…)
- prepare code fixes as a diff, so you choose to apply or skip each one
- write store listings (title, short and full description, App Store subtitle, keywords, promo text) in English by default; Korean, Thai, Simplified Chinese or Hindi listings for your app can be added if you pick them
- write a privacy policy and an account-deletion page that match what the app really uses
- answer Google Play Data safety, Apple App Privacy and the IARC content-rating questionnaire
- make store graphics: 512×512 icon, 1024×500 feature graphic, 1080×1920 screenshots
- guide Play Console and App Store Connect step by step, with the value for every field
- turn a rejection message into a fix plan and a reply to the reviewer
- run release checks before you submit: store deadlines with official sources, privacy consistency, Google Play policy scan, account deletion, closed-test tracking, version numbers, country rules

**Nothing is submitted automatically.** The final step unlocks only after you approve, and you press the store's submit button yourself.

## Any store stage

Rocket Launcher is for apps at every stage, per store: **not submitted yet** (first submit), **in review** (uploaded, waiting), **rejected**, and **live** (an update). The stage is the first, required choice for each store; hints in the project (Play / App Store links, fastlane metadata, version numbers) only recommend one and never force a first launch.

- In review: nothing to submit and no new app record. Replacing the build can withdraw or delay the review, so a new build is offered only if you choose it. You get help to wait, a reply draft for "Information Needed" (you send it) and metadata-only fixes.
- Rejected: paste the store's message first (`rocketlauncher_report_review`); you get a fix plan, a reply draft and a resubmit guide, using the local and (when configured) shared review lessons.
- Live: an update. No closed test; the live listing (name, descriptions, category, languages, graphics, privacy URL) is kept, and the guide covers the new version and "What's new". Technical checks still run.

## Tools

| Tool | What it does |
|---|---|
| `rocketlauncher_connect_app` | Connect once (public GitHub URL, local folder/ZIP, or the built-in sample) and analyze |
| `rocketlauncher_get_report` | Readiness score and issues in plain language |
| `rocketlauncher_get_decisions` | Choices with ready-made options and a recommendation |
| `rocketlauncher_decide` | Record what the user picked |
| `rocketlauncher_preview_graphics` | Show icon / feature graphic / screenshot options |
| `rocketlauncher_generate_store_materials` | Build the full launch kit (folder + ZIP) |
| `rocketlauncher_submission_guide` | Console steps per store; final step locked until approval |
| `rocketlauncher_approve_submission` | Record the user's explicit approval (does not submit) |
| `rocketlauncher_report_review` | submitted / rejected / resubmitted / approved |
| `rocketlauncher_status` | Where am I, what's next, and the review lessons learned on this computer |
| `rocketlauncher_forget_lesson` | Remove one learned review lesson (only when the user asks) |
| `rocketlauncher_check_requirements` | Store technical requirements and deadlines (target API, 16 KB pages, Xcode / iOS SDK, required-reason APIs, age-rating questions…), each with its official source and verified date |
| `rocketlauncher_privacy_check` | Data safety / App Privacy / PrivacyInfo.xcprivacy / permission texts / privacy policy consistency, plus drafts |
| `rocketlauncher_play_policy_audit` | Quick Google Play policy scan with Google's open-source Play Policy Insights rules, plus the offline full audit |
| `rocketlauncher_reviewer_notes` | Notes for App Review and Play App access (placeholders, never passwords) |
| `rocketlauncher_account_deletion_check` | In-app and web account deletion paths |
| `rocketlauncher_closed_test` | 12 testers × 14 days tracker, production-access draft, tester invitations, tester page check |
| `rocketlauncher_version_sync` | Version / build numbers across platforms and related apps, force-update safety |
| `rocketlauncher_country_check` | Korea, EU and Thailand rules that apply to the app |
| `rocketlauncher_move_app_plan` | Moving an app to another developer account: transfer or new registration, shown side by side |
| `rocketlauncher_remove_app_guide` | How to unpublish or delete an app on each store (guide only) |

## Set up

Node.js 20+. The usual install is the npm package [`rocket-launcher-mcp`](https://www.npmjs.com/package/rocket-launcher-mcp).

**Claude Code**
```bash
claude mcp add rocket-launcher -- npx -y rocket-launcher-mcp
```

**Claude Desktop** (`claude_desktop_config.json`), **Cursor** (`~/.cursor/mcp.json` or `.cursor/mcp.json`), and **Gemini CLI** (`~/.gemini/settings.json`, or `.gemini/settings.json` in a project):

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

In Gemini CLI, restart and run `/mcp` to see the tools. Connection details for every client are in PLUGIN.md in the source repository. Homepage: https://jaetaekoh.github.io/RocketLauncher/

<details>
<summary>From a clone (alternative)</summary>

```bash
git clone https://github.com/JaeTaekOh/RocketLauncher.git
cd RocketLauncher/mcp && npm install
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

## Try it

Ask your assistant: *"Use Rocket Launcher with the sample app."* or *"My app is finished: https://github.com/you/your-app. Help me launch it with Rocket Launcher."*

## Requirements and data

- Node.js 20 or later. The server runs on the computer of the AI client (stdio).
- App files are read only on that computer. Public GitHub repos are read through the GitHub public API. Apart from the optional anonymized review-lesson record below, nothing is uploaded. No telemetry, no accounts.
- Store rules are in `data/store-requirements.json` (official source and verified date for every rule). The only network calls in the release checks are an optional public App Store lookup (`rocketlauncher_version_sync` with `check_store`) and an optional tester page you ask it to open.
- Progress is saved in `~/.rocketlauncher` (change it with `ROCKETLAUNCHER_HOME`).
- Review results you report are learned locally: an unknown rejection becomes a generalized lesson in `~/.rocketlauncher/lessons.json` (no original store message, app names or emails) and is reused as warnings, pre-submit checks and review-note lines for your later apps. When a lessons API is configured (`lessonsApiUrl` or `ROCKETLAUNCHER_LESSONS_API`), an anonymized record (store, guideline / ITMS / Play policy codes, a fixed advice id; never the store message, app name or ids) is sent there, and other users' combined lessons are shown as "From other reviews" reminders. The demo never sends. Set `ROCKETLAUNCHER_LESSONS_API` to an empty value to keep lessons only on this computer; if the variable is omitted, `lessonsApiUrl` in `js/config.js` is used. If the API is empty or unreachable, the plugin works normally on this computer only.
- Graphics need the optional `@napi-rs/canvas` package. Run `npm install` in `mcp/` to turn graphics on. Without it, everything else still works.

- Languages: tool texts come in English (default), Korean, Thai, Simplified Chinese and Hindi (`lang`: `en`, `ko`, `th`, `zh`, `hi`); without `lang` they are in English. Store listings default to English.

## Third-party notice

`vendor/play-policy-insights/` is Google's Play Policy Insights skill from https://github.com/android/skills (Apache License 2.0, © Google LLC / The Android Open Source Project), included unmodified with its `LICENSE.txt` and a `NOTICE`. Rocket Launcher reads its rule files for the quick scan and points to its `SKILL.md` for the full offline audit.

See PRIVACY.md. Source: https://github.com/JaeTaekOh/RocketLauncher · MIT License (see LICENSE). © Prezentree
