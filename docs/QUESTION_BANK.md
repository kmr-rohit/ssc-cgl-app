# Previous-year question bank

Source: the `SSC-CGL` folder of `akarohitmishra/repeatermock-subjectwise-db` (pinned commit in `pipeline/.cache/raw/SOURCE_SHA`).
No license on the source and it appears scraped from a commercial test series; the owner chose to use questions, answer keys
and solutions as-is for now (2026-11-12). The raw download is git-ignored and never committed.

## Run it
```bash
npm run pyq:build          # = tsx pipeline/build-pyq.ts  (add --no-images for a quick text-only run)
npx vitest run pipeline    # mapping + checks over every published question
```
First run downloads ~70 MB of JSONL and ~13k images into `pipeline/.cache/` (cached; later runs only re-convert).

## Stages (`pipeline/build-pyq.ts`)
| Stage | What it does |
|---|---|
| Normalise | Our `Question` schema; ids `pyq:<topic>:<source qid>` (stable forever); safe HTML (whitelist, light markdown); short or empty solutions get "The correct answer is option X." |
| Map | Source chapter/concept → our 80 topics (`pipeline/mapping.ts`, one reviewable table) |
| Exclude | Cloze and comprehension (passage missing in source), data interpretation without its table/chart, malformed items. Counts in `pipeline/.cache/report.json` |
| Dedupe | Same question across shifts → one question with every `asked` occurrence |
| Images | Downloaded once, WebP q55 ≤800 px, named by URL hash; decorative icons (reused in 5+ solutions) dropped; truncated/broken image fragments removed; unreferenced files pruned |
| Papers | Every past shift rebuilt in exam order (used as the question pool for mocks) |
| Publish | `public/pyq/manifest.json` + `topics/<topic>-<page>.<hash>.json` (250/page) + `papers/<id>.<hash>.json` + `img/` |

## Numbers (pinned commit 157773c)
25,400 raw → 23,790 published (1,068 cloze + 254 comprehension + 241 data interpretation + 15 malformed excluded; 32 repeats merged); 250 papers; 12,934 images (67 MB). Bank total ≈ 135 MB.

## How the app uses it
- Not shown as its own section. Daily and sectional mocks draw from 4 past papers of that tier (chosen by the mock's seed); our own and generated questions fill gaps (mostly English cloze/comprehension).
- Topic practice mixes bank questions with our practice set.
- Loaded lazily: the manifest at start-up; topic pages when practice needs them; paper files when a mock is built. The offline cache never pre-downloads `/pyq/`; files are cached as they are used.

## Known gaps / next
- Cloze and reading comprehension need their passages: source doesn't have them.
- No official-key cross-check: SSC publishes final keys with papers but behind time-limited candidate logins (no machine-readable archive). Plan: "Report a mistake" on every question.
- `manifest.weightage` (real average questions per paper by topic) is computed but not yet used for the syllabus weight text or mock allocation.
