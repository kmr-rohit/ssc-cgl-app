# CGL Prep: Technical Design

Status: draft v0.1 · 2026-11-12 · Owner: project owner (product), Claude Code (engineering)
Delivery order: **Web (PWA) → Android → iOS**

---

## 1. Where we are today

The only code in hand is the claude.ai artifact snapshot (`reference/artifact-v1/`, 49 files, about 3.3 MB). It is a vanilla-JS single-page app with no build step.

| Area | What exists | Size |
|---|---|---|
| Syllabus | `data/syllabus.js`: 6 subjects, 80 topics, Tier 1, Tier 2 and Paper 2 patterns | 12 KB |
| Curated content | `content/*.js`: notes plus about 2,800 hand-written MCQs (GA humanities uses a tuple format and wasn't counted) | 2.7 MB |
| Generators | `js/gen/*`: seeded (mulberry32) generators for Quant, Reasoning, DI, vocab, figures | 160 KB |
| App | `js/app.js` (hash router, 539 lines) plus about 15 view modules that build HTML strings into `innerHTML` (49 places) | 300 KB |
| Storage | `js/store.js`: three backends (local Node server, claude.ai `window.claude` db, localStorage) | — |
| AI | `askAI` / `askAIJSON` / `askCoach`: claude.ai `sample` capability when hosted, the local server's API key otherwise | — |
| Reference data | cut-offs, posts, DEST/CKT rules, YouTube links, formulas, typing passages | 250 KB |

**Missing from the snapshot**, though the README lists them: `server.js`, `tools/validate.mjs`, `tools/audit.mjs`, `tools/verify_quant.py`, `start-*.sh/.bat`, `public/hosted.html`. These are needed (see `RESOURCES_NEEDED.md`).

---

## 2. Design flaws and risks

Ordered by how much damage each would do if left alone.

### 2.1 The product isn't defined: personal tool or public app?
The README describes a **single-user laptop app** with LAN sharing. Shipping to the Play Store and App Store makes it a **multi-tenant product**, which needs accounts, a hosted backend, AI cost control, privacy compliance and support. Those are different products with very different costs. **Decision D1 (§9) blocks phase 2.**

### 2.2 The storage and AI layers can't leave claude.ai
`store.js` and the AI calls depend on `window.claude.use('db' | 'user' | 'sample' | 'downloads')`. Those exist only inside a claude.ai artifact. In the hosted artifact, the AI is billed to each **viewer's** claude.ai account, and every friend you share it with must be signed in to claude.ai. None of this carries over to a website or a mobile app. We need our own **auth, database and AI proxy**.

### 2.3 The LAN server has no auth
`node server.js` serves `/api/state`, wipe and restore to anyone on the Wi-Fi: hostel networks, cafés, a roommate. That's acceptable for a personal tool and not for anything else. **Recommendation:** drop LAN mode from the product and replace it with real accounts and sync. It can stay as a dev or offline convenience.

### 2.4 AI keys and cost
- An API key can't ship in a web bundle or APK. Every AI call must go through a server proxy with per-user quotas, rate limits and a monthly spend cap.
- AI features in the README: doubt box, question generation from transcripts, "10 more" questions per type, AI coach. Without quotas, one user pasting long transcripts in a loop can run up a large bill.
- AI-generated questions shown to users must be validated: the schema checked, exactly one correct option, and HTML sanitised (see 2.6).

### 2.5 Content correctness is the product, and it isn't verified at scale
- About 2,800 curated questions were written with AI help. Only Quant claims machine verification (`verify_quant.py`). GA, English, Computer and Statistics answer keys are unverified. **One wrong answer key in a mock costs a user's trust more than any missing feature.**
- Exam facts (cut-offs, posts, pattern) are sourced partly from coaching blogs and a third-party PDF mirror (`assamjobalerts.com`), not the official ssc.gov.in notice.
- YouTube titles and channels in `resources_*.js` are marked unverified in their own comments. Links will rot.
- **Needed:** a validator in CI, a human subject-matter review pass for GA and English, a "Report a mistake" button on every question that feeds a review queue, and a content version so fixes reach users without an app release.

### 2.6 XSS through `innerHTML`
The views build HTML strings and assign them to `innerHTML` in 49 places. Curated content is trusted, but **AI output** ("make questions from a video", "10 more questions") and **user input** (current-affairs notebook, doubt text) also flow into these templates. `esc()` exists but has to be remembered at every call site. Inside a Capacitor WebView, an XSS can reach native plugins. **Fix:** move views to `lit-html`, which escapes by default and is about 5 KB, and adopts incrementally because the existing code already uses template strings. Sanitise any HTML-bearing AI output with DOMPurify.

### 2.7 Startup cost on low-end Android
`loadBank()` imports **all 16 content files (about 2.7 MB of JS)** at startup, before the first screen. On a ₹8–12k Android phone on patchy 4G (the core CGL audience), that means several seconds of download and parse. **Fix:** compile content to per-topic JSON at build time, load a small manifest at boot, lazy-load topics, and cache offline with a service worker or the native bundle. Budget: first meaningful screen in under 2.5 s on a Moto G-class device over Fast 3G.

### 2.8 Sync model: full state blobs and growing data
- The localStorage mirror rewrites the **whole state** (all attempts ever) on every answer. This gets slow and eventually hits the roughly 5 MB quota.
- Mocks store their **full generated question sections** per user, which duplicates data the deterministic generators could rebuild from a seed.
- The cloud store does **N sequential deletes** to wipe data.
- **Fix:** IndexedDB on the device; append-only `attempts` events with client UUIDs (idempotent sync); last-write-wins rows for settings, SRS cards and in-progress mocks; store a mock as `seed + generator_version` and keep a snapshot only when the generator version changes.

### 2.9 No tests, types, build or CI
None of these exist, and generators are where silent bugs live: duplicate options, a correct answer that isn't among the options, NaN, non-terminating decimals. **Fix:** Vite + TypeScript (`allowJs`, converting gradually), Vitest property tests that run each generator about 1,000 times per level, Playwright end-to-end tests for the mock flow, and GitHub Actions.

### 2.10 Score prediction can mislead
SSC Tier 1 cut-offs are **normalised** across shifts. Our mocks are self-generated, with uncalibrated difficulty. Putting a "predicted score" next to a normalised cut-off implies a precision we don't have. **Fix:** show a band, label it as an estimate, and calibrate later with real user outcomes, if any are ever collected and the user consents.

### 2.11 Feature sprawl before users
The README lists about 25 features. Each one is surface area to test across three platforms. **Recommendation:** launch an MVP of syllabus and notes, practice, daily mocks, analysis, flashcards, sync and the doubt box. Put the rest behind flags. In particular:
- **The typing test (DEST)** makes no sense on a phone (the real test uses a physical keyboard). Hide it on touch-only devices.
- **In-notes YouTube embeds** are fine (official embed), but on iOS they're a review risk if they look like the app's core value. Keep the app's own content primary.

### 2.12 Hindi
CGL is offered in Hindi and English, and a large share of aspirants prefer Hindi or bilingual material. The app is English-only. This is not a launch blocker but limits the market. Plan an i18n-ready content schema now (`{en, hi}` fields), even if only English ships. **Decision D4.**

### 2.13 Store-review risks
- **Apple 4.2 (minimum functionality):** a thin WebView wrapper can be rejected. Mitigations: offline content, local notifications for revision reminders, haptics, native share, Sign in with Apple.
- **Apple 4.8:** if Google sign-in is offered, an equivalent privacy-preserving option (Sign in with Apple) is required.
- **Both stores:** account deletion from inside the app is required, plus a privacy policy, data-safety forms, and an age rating.
- **India DPDP Act 2023:** consent notice, data-principal rights (access, erase), and a grievance contact.

### 2.14 Content staleness
Current affairs (about 3–5 of 25 GA questions in Tier 1) goes stale monthly, and the exam pattern changes almost every cycle. **Fix:** remote content updates without an app release, and a monthly current-affairs pipeline (AI-drafted, human-approved). **Decision D5.**

---

## 3. Target architecture

```
                ┌─────────────────────────── clients ───────────────────────────┐
                │  Web PWA (Cloudflare Pages)   Android (Capacitor)   iOS (Capacitor) │
                │  same TS/lit-html codebase · IndexedDB · service worker / bundled content │
                └──────────────┬───────────────────────┬────────────────────────────┘
                               │ HTTPS (JWT)            │ static, CDN-cached
                  ┌────────────▼───────────┐   ┌────────▼──────────────────┐
                  │ Supabase (ap-south-1)  │   │ Content CDN               │
                  │  Auth: Google, email OTP,│   │ manifest.json (version)   │
                  │        Apple            │   │ topics/<id>.<hash>.json   │
                  │  Postgres + RLS         │   └───────────────────────────┘
                  │  Edge Functions:        │
                  │   /ai/doubt  /ai/generate│──► Anthropic API (key in function secrets)
                  │   /ai/coach  /report     │
                  │   /account/delete        │
                  └─────────────────────────┘
          Observability: Sentry (errors, all clients) · PostHog or Plausible (product analytics, opt-in)
```

### 3.1 Client
- **Language:** TypeScript, built by Vite. Existing `.js` modules are imported as-is (`allowJs`) and converted file by file, starting with `store`, `bank` and the generators.
- **Rendering:** `lit-html` templates, migrated view by view. Keep the hash router: it works in Capacitor without server rewrites.
- **Styling:** keep `app.css` and the "aspirant's register" design. Self-host the Archivo and Atkinson fonts so the app works offline and doesn't send requests to Google from the app.
- **Storage:** IndexedDB via `idb-keyval` (or Dexie if queries grow), with an outbox queue for sync.
- **Offline:** a service worker (Workbox) on web; on mobile the content is bundled in the binary and newer versions are fetched from the CDN.
- **Platform adapter:** `platform.ts` exposes `notify`, `share`, `haptics`, `secureStorage` and `openExternal`. It is implemented separately for web and Capacitor so views never import Capacitor directly.

### 3.2 Content pipeline
```
content-src/*.js (authoring format, today's files)
   └─ tools/build-content.ts ─► validate (schema, 1 correct option, unique options, no empty solution,
                                 HTML whitelist, ids unique, topic exists in syllabus)
                              ─► dist/content/manifest.json  {version, topics:{id:{hash,bytes,counts}}}
                              ─► dist/content/topics/<id>.<hash>.json
```
- Question IDs are **stable forever**, because attempts reference them. A wrong question is never edited in place: it gets a `rev` field, and attempts record `rev`.
- `generator_version` is a constant per generator file, bumped whenever its output for a given seed changes.
- Schema (normalised): `{id, rev, topic, type, level, q, options[4], answer, solution, tags[], source:'curated'|'ai-reviewed', reviewed_by?, lang:'en'}`.

### 3.3 Backend (Supabase)
Supabase is chosen because Postgres, Auth, RLS, Edge Functions and storage come in one product, it has a Mumbai region, its free tier covers beta, and it has an MCP server that lets Claude work with less supervision. The alternative is Firebase; Supabase wins on SQL analytics and portability.

Tables (all with RLS `user_id = auth.uid()`):

| Table | Key columns | Sync rule |
|---|---|---|
| `profiles` | user_id PK, name, target, exam_date, daily_hours, settings jsonb, updated_at | LWW |
| `attempts` | id uuid PK (client), user_id, question_id, rev, topic, type, level, correct, chosen, ms, mode, mock_key?, created_at | append-only, idempotent insert |
| `mocks` | (user_id, key) PK, kind, seed, gen_version, state jsonb (answers, marks, timers), status, score jsonb, updated_at | LWW per row |
| `mock_snapshots` | (user_id, key) PK, sections jsonb | written only when gen_version differs |
| `srs_cards` | (user_id, card_id) PK, ease, interval, due, reps, updated_at | LWW per card |
| `notes_ca` | id uuid, user_id, body, created_at | LWW |
| `kv` | (user_id, key) PK, value jsonb | LWW (escape hatch, keep small) |
| `ai_usage` | user_id, day, feature, calls, in_tokens, out_tokens | server-only |
| `content_reports` | id, user_id, question_id, rev, reason, note, status | insert-only for users |

Edge Functions: `ai-doubt`, `ai-generate`, `ai-coach`, `report-question`, `delete-account`, `export-data`.

### 3.4 AI layer
- All calls go **server-side only**, through the official Anthropic TypeScript SDK (`npm:@anthropic-ai/sdk` in Deno Edge Functions), with streaming for doubt and coach replies.
- **Model:** default `claude-opus-5-5` for all three features. Cheaper options are `claude-sonnet-5-5` for generation and `claude-haiku-5-5` for the high-volume doubt box. **Choosing a cheaper model is your call (D3).** Decide after a small eval of about 50 real doubts compared side by side.
- **Prompt caching:** put a stable system prompt (teacher persona, output rules, SSC conventions) first with `cache_control`, and the per-question content after it.
- **Structured output:** question generation uses `output_config.format` with a JSON schema, then server-side validation (4 options, one answer, sanitised HTML). Rejected items are dropped and are never shown.
- **Quotas:** per-user daily caps per feature (for example 20 doubts, 3 generations, 1 coach call per week on the free tier), a global monthly spend alarm, and a kill-switch flag.
- **Refusals and errors:** check `stop_reason` and map errors to friendly messages, as `store.js` does today.

### 3.5 Mobile (Capacitor)
- One codebase: `npx cap add android`, then `ios`. Plugins: `@capacitor/local-notifications` (revision reminders, streaks), `@capacitor/share`, `@capacitor/haptics`, `@capacitor/app` (back button), `@capacitor/preferences`, and a social-login plugin for Google and Apple.
- Content is bundled in the binary, so the first launch works offline.
- **Android first.** Target API level per current Play requirements. Keep the app small (aim under 15 MB). Test on a low-end device.
- **iOS last.** Requires Sign in with Apple, ATT is not needed if there's no tracking, and a privacy manifest.
- **Why not React Native or Flutter?** They would mean rewriting about 4,700 lines of UI and logic for no user-visible gain. The content is HTML with SVG figures, which a WebView renders natively. If performance becomes an issue, revisit after real-device profiling.

### 3.6 Security and privacy
- RLS on every table, with a test per table proving cross-user reads fail.
- Strict CSP: allow YouTube-nocookie frames, our Supabase host and our CDN only, with no inline scripts after the Vite build.
- DOMPurify on all AI and user HTML; `lit-html` escaping everywhere else.
- Collect minimal PII (email and name). No contacts, no location.
- In-app account deletion and data export (JSON), which also covers the old "backup/restore" feature.

### 3.7 Quality gates (CI on every PR)
`typecheck → lint → unit (Vitest, generator property tests) → content validate → build → Playwright e2e (practice + full Tier 1 mock + resume) → bundle-size budget → Lighthouse (PWA, perf ≥ 85 mobile)`.

---

## 4. Key flows

**Daily mock:** `key = tier1-YYYY-MM-DD`, `seed = hash(key)`. Built client-side from curated and generated questions with the current `gen_version`. Progress autosaves to IndexedDB every answer, and the outbox syncs the `mocks` row (debounced). Submitting computes the score, writes attempts in bulk, and flags the mock for review.

**Offline answer:** the attempt goes to IndexedDB and the outbox. On reconnect, it's a bulk `upsert` by uuid, so retries are safe.

**Doubt:** the client sends a POST to `/ai-doubt` with `{question_id, rev, user_text}`. The server loads the canonical question by id, so the client can't inject a fake question or answer, checks the quota, and streams the reply back.

---

## 5. Milestones (detail in `TODO.md`)

| # | Milestone | Exit criteria |
|---|---|---|
| M0 | Foundation | git repo, Vite+TS builds the current app unchanged, CI green, generator property tests |
| M1 | Hardened web, local-only | content split and lazy-loaded, lit-html on all views that touch user or AI text, IndexedDB, PWA offline, perf budget met |
| M2 | Accounts and sync | Supabase schema + RLS tests, auth, outbox sync, export/delete, AI proxy with quotas |
| M3 | Public web beta | domain, Sentry, analytics, privacy policy and terms, report-a-mistake, 20–50 beta users |
| M4 | Android | Capacitor shell, notifications, Play internal, then closed testing, then production |
| M5 | iOS | Sign in with Apple, TestFlight, App Store review |
| M6 | Content ops | GA/English SME review complete, monthly current-affairs pipeline, Hindi (if D4) |

## 6. Non-goals (for now)
Payments, social features or leaderboards, live classes, a teacher dashboard, and a DEST typing test on mobile.

## 7. Open questions → see §9 decisions

## 8. Glossary
PYQ: previous-year question · DEST: Data Entry Speed Test · CKT: Computer Knowledge Test · SRS: spaced repetition · RLS: Postgres row-level security · LWW: last-write-wins.

## 9. Decisions needed from the owner

| ID | Decision | Recommendation | Blocks |
|---|---|---|---|
| ✅ | **Decided 2026-11-12:** backend = **Supabase** (Mumbai); auth = **Google + email OTP** (no phone OTP: India DLT/SMS cost); hosting = **Vercel** at `ssccgl.kmrrohit.space`; content = static hashed JSON/SVG deployed with the app (author-in-DB later); exam mode = fullscreen + leave-tab **warnings only**, counted in results; AI skipped for now | — | — |
| D1 | Personal tool, or public product? Free, or paid? | Public. Free core, with AI features behind a quota (paid tier later) | M2 |
| D2 | Backend vendor | Supabase, Mumbai region | M2 |
| D3 | AI model per feature, and the monthly AI budget | Start on `claude-opus-5-5`, evaluate cheaper models, set a hard monthly cap | M2 |
| D4 | Hindi at launch? | Schema ready now, content later | M6 |
| D5 | Who reviews GA and English answer keys? | A paid SME reviewer, part-time | M3 |
| D6 | App name, domain, brand | Check "CGL Prep" for trademark and store-name collisions | M3 |
| D7 | Keep the claude.ai artifact alive for current users? | Keep it frozen as a demo; no new work there | — |
