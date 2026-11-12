# CGL Prep: TODO

Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked (reason inline) · **(owner)** means a human must do it
Rules: work top-down within the current milestone. One task per branch/PR. Tick the box in the same PR that completes it.

---

## M0 + M1: Local web app on the new architecture (fresh build, owner chose local-only, no git)
- [x] Node 22 installed (Homebrew, keg-only)
- [x] Vite + TypeScript + lit-html scaffold (fresh code; `reference/` used for ideas only)
- [x] Shared schema `src/core/types.ts`; syllabus/weightage `src/core/syllabus.ts`
- [x] Content pipeline: `content-src/**.json` → validator → `public/content/manifest.json` + per-topic hashed JSON + assets
- [x] Test content for all 80 topics, with SVG figures (subagents; `source: "test-data"`)
- [x] Deterministic generators + property tests (`src/gen`)
- [x] `StorageAdapter` + IndexedDB `LocalAdapter` (append-only attempts, per-row mocks, per-card SRS)
- [x] Lazy topic loading; mocks load only the subjects they need
- [x] All views on lit-html; content HTML sanitised with DOMPurify
- [x] Views: Today, Syllabus, Topic (learn / practice / formulas), Practice (learn & test), Mocks, SSC-style Exam, Result, Analysis, Revise (SRS), Settings (backup/restore/reset, theme)
- [x] Mock stores generated questions as a snapshot; `GEN_VERSION` recorded
- [x] Score estimate shown as a band with an "estimate" label
- [x] Self-hosted fonts; service worker + web manifest (production build)
- [x] Unit tests (core) + Playwright smoke tests (desktop + phone)
- [ ] `GEN_VERSION` golden test (fails if generator output changes without a bump)
- [ ] ESLint + Prettier
- [ ] Perf budget check (initial JS < 200 KB gzip; Lighthouse mobile ≥ 85)
- [ ] Accessibility pass (keyboard nav in exam palette, focus order, dark-mode contrast)
- [ ] "Update available" toast when the service worker finds new content
- [ ] Re-verify syllabus pattern and reference cut-off against the official ssc.gov.in 2026 notice
- [x] Formula sheets (per-topic + computed tables, printable) and week-by-week study plan (balanced, weak-aware, revision-due list, "This week" on Today)
- [ ] Port remaining features as flags: current-affairs notebook, resources (video links + link checker), typing test (desktop only), exam-info page, weak-topic / retry / speed-drill mock types
- [ ] AI features (doubt box, make-questions, coach): **skipped for now (owner, 2026-11-12)**; will go through the M2 server proxy
- [ ] **(owner)** Send the original local folder (`server.js`, `tools/*`), for reference only
- [ ] Later, when the owner enables version control: git init, CI (typecheck, unit, content validate, build, e2e)

## UX pass (student-first), 2026-11-12
- [x] 5 tabs: Today · Roadmap · Study · Mocks · Progress; Profile via avatar (top bar) / rail badge
- [x] Mobile top bar with page title + Back (works in installed PWA without browser chrome)
- [x] First-run setup (exam, date, hours, name) → roadmap
- [x] Today = self-ticking checklist (roadmap topic, past mistakes, flashcards, mock on scheduled days) + Resume + countdown
- [x] My mistakes (latest attempt wrong/skipped; retry; per-subject filter); Study hub tiles (flashcards, formulas, mistakes)
- [x] Installable web app: PNG icons (incl. iOS apple-touch-icon, maskable), iOS meta tags, full offline precache stamped per build, install button (Android/desktop) + Add to Home Screen steps (iOS), update bar (never mid-mock)
- [ ] P1: mark topic done / "studied at coaching" → feeds roadmap
- [ ] P1: topic search in Study
- [ ] P1: bookmark questions
- [ ] P2: Hindi, daily reminder notifications (Android), AI doubt box

## M2: Accounts, sync, AI proxy
- [!] Blocked on D1, D2, D3 (see TECHNICAL_DESIGN §9)
- [ ] **(owner)** Create a Supabase project (ap-south-1) and give MCP/CLI access
- [ ] SQL migrations for the tables in design §3.3, with RLS policies
- [ ] RLS tests (user A can't read or write user B), run in CI against a local Supabase
- [ ] Auth: Google + email OTP on web
- [ ] `SupabaseAdapter` implementing `StorageAdapter`; outbox sync with retry/backoff; conflict rules per table
- [ ] First-login import of local progress into the account
- [ ] Edge Function `ai-doubt` (streaming, canonical question loaded server-side, quota)
- [ ] Edge Function `ai-generate` (structured output, validation, sanitisation, quota)
- [ ] Edge Function `ai-coach` (weekly limit)
- [ ] `ai_usage` metering, global monthly spend cap, `AI_ENABLED` kill switch
- [ ] Small eval: 50 real doubts across models before choosing a cheaper model (owner decides)
- [ ] Data export (JSON) and account deletion (Edge Function plus UI)
- [ ] Remove LAN server mode from the product build (keep `npm run dev`)

## M3: Public web beta
- [ ] **(owner)** Domain, and a Cloudflare (or Vercel) account
- [ ] Deploy pipeline: PR previews; `main` → staging; tag → production
- [ ] Sentry (web), with source maps uploaded in CI
- [ ] Privacy-respecting analytics (opt-in), with key events: signup, first mock, D7 retention
- [ ] "Report a mistake" on every question → `content_reports`, plus an admin review query
- [ ] **(owner)** Privacy policy, terms, grievance contact (DPDP)
- [ ] **(owner/SME)** GA and English answer-key review: at least the top 20 topics by weightage
- [ ] Remote content update: the client checks the manifest version and downloads only changed topics
- [ ] Beta with 20–50 aspirants; feedback form; triage in GitHub issues

## M4: Android
- [ ] **(owner)** Install Android Studio and JDK 21; a physical low-end Android device with USB debugging on
- [ ] **(owner)** Google Play Console account; create the app; upload signing key (Play App Signing)
- [ ] Capacitor init; Android platform; bundle content in the APK
- [ ] `platform.ts` native implementations (notifications, share, haptics, back button, external links)
- [ ] Native Google sign-in
- [ ] Revision reminders and streak notifications (local)
- [ ] Release build in CI (AAB), versionCode from tag
- [ ] Play internal testing → closed testing (Play requires a set number of testers for a period for new personal accounts; check current rules) → production
- [ ] Data-safety form, content rating, store listing (screenshots, description)

## M5: iOS
- [ ] **(owner)** Install full Xcode (only Command Line Tools are present now); Apple Developer Program; an iPhone
- [ ] iOS platform; Sign in with Apple; privacy manifest
- [ ] Store-review hardening for guideline 4.2 (offline, notifications, native share)
- [ ] TestFlight → App Store review

## M6: Content operations
- [ ] Monthly current-affairs pipeline: AI draft → owner/SME approve → content release
- [ ] Hindi schema plus pilot topics (if D4)
- [ ] Coverage audit (`tools/audit.mjs` port) as a CI report
- [ ] Weekly link-check and auto-issue for dead resources

---

## Decisions log
| Date | ID | Decision | By |
|---|---|---|---|
| | | | |
