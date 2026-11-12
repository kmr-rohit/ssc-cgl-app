# CLAUDE.md: CGL Prep

SSC CGL exam-prep app (Tier 1, Tier 2 Paper 1, Paper 2 Statistics). Delivery order: **Web PWA → Android → iOS**, one TypeScript codebase wrapped with Capacitor.

## Read first
- `docs/TECHNICAL_DESIGN.md`: architecture, known flaws, decisions (§9). Don't contradict it silently; propose an edit instead.
- `docs/TODO.md`: the work queue. Take the first unblocked `[ ]` item in the current milestone unless told otherwise.
- `reference/artifact-v1/`: read-only snapshot of the original claude.ai artifact. Never edit it.

## Layout
- `src/core/`: pure logic and the shared schema (`types.ts`, `syllabus.ts`, `rng.ts`, `scoring.ts`, `srs.ts`, `analysis.ts`)
- `src/gen/`: deterministic question generators (`GEN_VERSION` in `index.ts`)
- `src/content/bank.ts`: lazy topic loading, practice sets, mock building
- `src/data/storage.ts`: `StorageAdapter` (IndexedDB `LocalAdapter` now; Supabase later)
- `src/app/`: state, router, session hand-off · `src/views/`: one file per screen (lit-html) · `src/ui/`: components, sanitising helpers, CSS
- `content-src/<subject>/<topic>.json` + `content-src/assets/`: authoring content → `tools/build-content.ts` → `public/content/` (generated; don't edit)
- Later: `supabase/` (M2), `android/` `ios/` (M4/M5)

## Commands
- Dev server: `npm run dev` → http://localhost:5173 (also on the LAN)
- Test: `npm test` (Vitest)
- Content: `npm run content:validate` · `npm run content:build`
- Production build: `npm run build` then `npm run preview`
- Check everything: `npm run check` (typecheck + content validate + tests). **Run before calling work done.**

## Engineering rules
- **Content correctness beats features.** Never change a question `id`; bump `rev` instead. Every question has exactly 4 unique options, one `answer`, and a non-empty `solution`.
- Generators must be deterministic per seed. If output changes, bump that file's `GEN_VERSION`.
- No new `innerHTML` with interpolated data. Use lit-html templates. Sanitise AI or user HTML with DOMPurify.
- Views never import Capacitor or Supabase directly; go through `platform.ts` / `StorageAdapter`.
- AI calls only via Supabase Edge Functions using the official `@anthropic-ai/sdk`. Never put an API key in client code. Default model `claude-opus-5-5`; change it only when the owner says so.
- Mobile-first: test at 360 px width. Respect the perf budget in TECHNICAL_DESIGN §2.7.
- Design language: "the aspirant's register" (see the header of `src/ui/styles.css`). Rules:
  - Palette tokens only: desk, paper, ruling, ballpoint ink, pen blue (actions), red pen (attention, mistakes), stamp violet (verdicts), green only for correct. Light is the default theme; dark ("night study") is opt-in.
  - Type: Martel (headings), Mukta (body), Kalam handwriting **only** for red-pen notes (countdown, IMP, ticks). Never use Kalam for body text.
  - Avoid generic-UI tells: no ALL-CAPS eyebrow labels, no `·`-joined meta strings or `→` on buttons, no rows of stat tiles, no chip soup, no card shadows. Write plain sentences ("2 to 4 questions in Tier 1").
  - One primary action per screen. Empty states say what to do next and link to it.
- Small PRs: one TODO item per branch, named `m<N>/<short-slug>`.

## Current working mode (owner instruction, 2026-11-12)
- This is the owner's **work laptop**, which also has an office git identity. This repo uses the **personal** profile only: repo-local `user.email = rr7433446@gmail.com`, pushed via the `github-personal` SSH host alias. Never change global git config, never push anywhere except the personal remote, and check `git config user.email` before any commit.
- Commit and push only when the owner asks (e.g. "push"). No force-push, no history rewrites.
- Install commands (`brew`, `npm i`) may run without asking. Node 22 is keg-only: prefix shell commands with `export PATH=/opt/homebrew/opt/node@22/bin:$PATH`.
- Build the new architecture fresh; `reference/` is for ideas only.
- Test data is fine for now (`source: "test-data"`); flag anything that needs the owner's attention.
- Subagents may be used for parallel work.

## Autonomy: what you may do without asking
- Read and write code, tests, docs and config in this repo. Run local builds, tests and dev servers.
- (Later, once git is enabled) branches, commits and PRs per the TODO workflow.
- Apply migrations to **local or staging** Supabase. Deploy previews and staging.
- Tick TODO items; add newly discovered tasks to TODO.md under the right milestone.

## Always ask the owner first
- Production deploys, production DB migrations, and anything that deletes user data.
- Spending money (new paid services, raising AI limits), store submissions, publishing a release.
- Changing a §9 decision, the AI model, or the content of the exam pattern/cut-off data without an official source.
- Sending email or messages, or posting publicly anywhere.

## When stuck
Write the blocker into TODO.md as `[!] … (reason)` and move to the next unblocked item. Summarise blockers at the end of the session.
