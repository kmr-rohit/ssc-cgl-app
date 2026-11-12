# CGL Prep (local build)

SSC CGL preparation app: syllabus by weightage, notes, practice (learn/test), daily SSC-style mocks, analysis and flashcards. This is a web app (PWA) built so the same code can later be wrapped for Android and iOS.

## Run it
```bash
export PATH=/opt/homebrew/opt/node@22/bin:$PATH   # Node 22 (Homebrew, keg-only)
npm install
npm run dev            # http://localhost:5173 (also printed with a LAN address for your phone)
```

## Useful commands
| Command | What it does |
|---|---|
| `npm run content:validate` | Checks every `content-src/**/*.json` (schema, 4 unique options, answer index, assets exist, allowed HTML) |
| `npm run content:build` | Compiles content to `public/content/` (manifest + per-topic hashed JSON + assets) |
| `npm test` | Unit tests (core logic, generator property tests) |
| `npm run e2e` | Browser smoke tests (desktop + phone viewport) |
| `npm run build && npm run preview` | Production build with offline service worker |

## Where things live
See `CLAUDE.md` (layout and rules), `docs/TECHNICAL_DESIGN.md` (architecture and decisions), `docs/TODO.md` (work queue).

## Data
Progress is stored in this browser's IndexedDB. Settings → Download backup / Restore moves it between devices. No account or server yet (that's milestone M2).

## Content status
All questions are **test data** (`source: "test-data"`), written with AI help and machine-checked where numeric, but **not yet reviewed by a subject expert**.
