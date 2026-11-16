# Changelog

## 0.1.0

- First Rocket Launcher release: MCP tools to connect an already-built app, report readiness, present decisions, record choices, preview graphics, generate store materials, walk through a submission guide, record approval (never auto-submit), report review results, show status, and forget a learned lesson.
- Works at every store stage, per store: `not_submitted` (first submit), `in_review`, `rejected` and `live` (update).
- Learns from store review results on this computer (generalized lessons, never raw store messages).
- Optional shared review lessons: when a lessons API is configured (`lessonsApiUrl` / `ROCKETLAUNCHER_LESSONS_API`), anonymized codes are sent and an aggregated feed can be shown as "From other reviews". If the URL is empty or the server is unreachable, everything still works locally. The built-in demo never sends.
- Five languages for tool and UI texts: English (default), Korean, Thai, Simplified Chinese and Hindi. Store listings default to English.
- App Store review lessons built into analysis, choices, generated files and the submission guide (tracking/ATT alignment, login, Sign in with Apple, support URL, metadata, and related checks).
