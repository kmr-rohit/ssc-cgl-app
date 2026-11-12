# What I need from you

Ordered by when it blocks work. Tick each item as you provide it.

## Now (blocks M0)
- [ ] **The original local folder**: `server.js`, `tools/validate.mjs`, `tools/audit.mjs`, `tools/verify_quant.py`, start scripts, `public/hosted.html`. The claude.ai artifact only has the browser files. Drop the folder into `reference/local-v1/`.
- [ ] **Node.js 22 LTS**: `brew install node@22` (Node isn't installed on this Mac right now).
- [ ] **GitHub**: create a private repo and run `! gh auth login` here, or connect the GitHub MCP.
- [ ] **Answers to decisions D1–D7** in `docs/TECHNICAL_DESIGN.md` §9 (at least D1).

## Before M2 (accounts and AI)
- [ ] **Supabase**: an account plus a project in **ap-south-1 (Mumbai)**, with a personal access token for the Supabase MCP. Start with a separate *staging* project; add production later.
- [ ] **Anthropic API key** in its own Console workspace with a **monthly spend limit** set. It goes into Supabase function secrets only, never into the repo or chat.
- [ ] **Google Cloud OAuth client** (web) for Google sign-in.

## Before M3 (public web beta)
- [ ] Domain name
- [ ] Cloudflare account (Pages hosting) or Vercel
- [ ] Sentry account (free tier is fine)
- [ ] Privacy policy, terms, grievance-officer contact (I can draft them; you own and publish them)
- [ ] **A subject-matter reviewer** for GA and English answer keys (a person, not AI)
- [ ] 20–50 beta testers (real CGL aspirants)

## Before M4 (Android)
- [ ] Android Studio + JDK 21 (no Java runtime installed now)
- [ ] Google Play Console developer account (one-time fee)
- [ ] A **low-end** Android phone with USB debugging (the target audience's device)

## Before M5 (iOS)
- [ ] Full **Xcode** from the App Store (only Command Line Tools are installed now)
- [ ] Apple Developer Program membership (annual fee)
- [ ] An iPhone for testing

---

## MCP servers to connect (in priority order)
| MCP | Why | When |
|---|---|---|
| **GitHub** (`github/github-mcp-server`) or just `gh` CLI auth | PRs, issues, CI status without you relaying | M0 |
| **Playwright** (`microsoft/playwright-mcp`) | I drive a real browser to test the UI and mock flow myself | M0 |
| **Context7** (`upstash/context7`) | Current docs for Vite, lit, Capacitor, Supabase | M0 |
| **Supabase** (`supabase-community/supabase-mcp`), scoped to the **staging** project | migrations, SQL, logs, Edge Function deploys | M2 |
| **Sentry** | read production errors and triage | M3 |
| **Cloudflare** (or Vercel) | deploys, DNS, preview URLs | M3 |

Already available in this session: Claude in Chrome (browser automation), the `run`, `code-review`, `security-review` and `simplify` skills, and the `claude-api` skill.

For mobile, plain CLIs (`adb`, `xcrun simctl`, `npx cap`) work better than any MCP I know of. You only need the toolchains installed.

## Skills
I'll write these as **project skills** in `.claude/skills/` as each workflow first comes up:
- `content-check`: validate, build, coverage report, and a summary of failures
- `release-web`: staging deploy, smoke test, production after your OK
- `release-android`: AAB build, upload to the internal track
- `add-topic-content`: authoring checklist for new questions and notes (schema, review, rev bump)

## Permissions (for low supervision)
After Node is installed, I'll add a project `.claude/settings.json` allowlist for routine commands (npm, vitest, playwright, git branch/commit/push of feature branches). Production deploys, migrations on production, and store uploads stay "ask".
