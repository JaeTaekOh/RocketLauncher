# Rocket Launcher

**From "my app is done" to "launched" on Google Play and the App Store — first submit, waiting in review, rejected, or a live app update. You only pick and approve.**
Free · no API keys · English (default) + 한국어 · ภาษาไทย · 中文 · हिन्दी · feedback: https://github.com/JaeTaekOh/rocketlauncher/issues

Rocket Launcher is an MCP server (plus a skill) for people who built an Android and/or iOS app with AI. Connect the app once, and your AI assistant can:

- find what blocks store review (target SDK, permissions, missing privacy policy, account deletion, iOS privacy manifest, empty permission texts, ads ID, closed-test rule…)
- prepare code fixes as a diff, so you choose to apply or skip each one
- write store listings (title, short and full description, App Store subtitle, keywords, promo text) in English by default; Korean, Thai, Simplified Chinese or Hindi listings for your app can be added if you pick them
- write a privacy policy and an account-deletion page that match what the app really uses
- answer Google Play Data safety, Apple App Privacy and the IARC content-rating questionnaire
- make store graphics: 512×512 icon, 1024×500 feature graphic, 1080×1920 screenshots
- guide Play Console and App Store Connect step by step, with the value for every field
- turn a rejection message into a fix plan and a reply to the reviewer

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

## Try it

Ask your assistant: *"Use Rocket Launcher with the sample app."* or *"My app is finished: https://github.com/you/your-app. Help me launch it with Rocket Launcher."*

## Requirements and data

- Node.js 20 or later. The server runs on the computer of the AI client (stdio).
- App files are read only on that computer. Public GitHub repos are read through the GitHub public API. Apart from the optional anonymized review-lesson record below, nothing is uploaded. No telemetry, no accounts.
- Progress is saved in `~/.rocketlauncher` (change it with `ROCKETLAUNCHER_HOME`).
- Review results you report are learned locally: an unknown rejection becomes a generalized lesson in `~/.rocketlauncher/lessons.json` (no original store message, app names or emails) and is reused as warnings, pre-submit checks and review-note lines for your later apps. When a lessons API is configured (`lessonsApiUrl` or `ROCKETLAUNCHER_LESSONS_API`), an anonymized record (store, guideline / ITMS / Play policy codes, a fixed advice id; never the store message, app name or ids) is sent there, and other users' combined lessons are shown as "From other reviews" reminders. The demo never sends; if the API is unset or unreachable, the plugin works normally on this computer only.
- Graphics need the optional `@napi-rs/canvas` package. Run `npm install` in `mcp/` to turn graphics on. Without it, everything else still works.

- Languages: tool texts come in English (default), Korean, Thai, Simplified Chinese and Hindi (`lang`: `en`, `ko`, `th`, `zh`, `hi`); without `lang` they are in English. Store listings default to English.

See PRIVACY.md. Source: https://github.com/JaeTaekOh/rocketlauncher · MIT License (see LICENSE).
