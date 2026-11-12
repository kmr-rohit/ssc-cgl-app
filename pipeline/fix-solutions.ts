// Rewrite solutions that are cut off, too thin or missing, with the local model.
// A rewrite is accepted only if the model's worked answer matches the answer key; otherwise the original stays and the
// question goes on a review list (pipeline/.cache/key-review.jsonl) — a cheap audit of answer keys.
// Figure questions are skipped (the model can't see images).
// Cache: pipeline/.cache/solutions.jsonl. Usage: npx tsx pipeline/fix-solutions.ts [--limit 200] [--parallel 3]
import { appendFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mapTopic } from './mapping';
import { chat, MODEL, pool } from './llm';
import { cleanSourceText, plainText, solutionNeedsWork } from './clean';

const ROOT = new URL('..', import.meta.url).pathname;
const RAW = join(ROOT, 'pipeline/.cache/raw');
const CACHE = join(ROOT, 'pipeline/.cache/solutions.jsonl');
const REVIEW = join(ROOT, 'pipeline/.cache/key-review.jsonl');
const PROMPT_VERSION = 'v2';
const arg = (k: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const LIMIT = Number(arg('--limit') ?? Infinity);
const PARALLEL = Number(arg('--parallel') ?? 3);

export interface SolutionRecord { qid: string; status: 'ok' | 'disagree'; text: string; model: string; v: string; reason: string }
export function loadSolutionCache(): Map<string, SolutionRecord> {
  const m = new Map<string, SolutionRecord>();
  if (existsSync(CACHE)) for (const l of readFileSync(CACHE, 'utf8').split('\n')) if (l.trim()) { const r = JSON.parse(l) as SolutionRecord; m.set(r.qid, r); }
  return m;
}

const SYSTEM = 'You are an experienced SSC CGL teacher. You write correct, clear, step-by-step solutions in simple English for Indian students.';
const L = ['A', 'B', 'C', 'D'];
function prompt(q: string, opts: string[], key: number, partial: string) {
  return `Question: ${q}
Options: ${opts.map((o, i) => `(${L[i]}) ${o}`).join('   ')}
The correct answer is (${L[key]}) ${opts[key]}.
${partial ? `An existing explanation (it may be cut off or incomplete): ${partial.slice(0, 1200)}\n` : ''}
Write a complete solution that reaches answer (${L[key]}). Structure:
**Method:** the fastest exam method as numbered steps, one per line.
**Explanation:** 2 to 4 short lines on the rule, formula, meaning or fact behind it.
**Why the others are wrong:** one short line per wrong option, only when it helps.
Rules: start directly with **Method:**, no introduction sentence. Under 200 words. No tables or # headings. Use **bold** only for key terms and the three labels.
Last line exactly: Answer: <letter>`;
}

async function main() {
  const cache = loadSolutionCache();
  interface Job { qid: string; q: string; opts: string[]; key: number; partial: string; reason: string }
  const jobs: Job[] = [];
  const counts: Record<string, number> = {};
  for (const f of readdirSync(RAW).filter((x) => x.endsWith('.jsonl'))) {
    for (const line of readFileSync(join(RAW, f), 'utf8').split('\n')) {
      if (!line.trim()) continue;
      const r = JSON.parse(line);
      const m = mapTopic({ subject: r.subject, chapter: r.chapter, concept: r.concept ?? '', question: r.question });
      if (!m.topic) continue;
      const sol = cleanSourceText(r.solution);
      const need = solutionNeedsWork(sol);
      if (!need) continue;
      const hasFigure = /\[IMAGE:|<img/i.test(r.question + JSON.stringify(r.options));
      counts[`${need}${hasFigure ? ' (figure, skipped)' : ''}`] = (counts[`${need}${hasFigure ? ' (figure, skipped)' : ''}`] ?? 0) + 1;
      if (hasFigure) continue;
      const c = cache.get(r.qid);
      if (c && c.v === PROMPT_VERSION && c.model === MODEL) continue;
      const key = r.options.findIndex((o: { label: string }) => o.label === r.correct);
      if (key < 0 || r.options.length !== 4) continue;
      jobs.push({ qid: r.qid, q: plainText(cleanSourceText(r.question)), opts: r.options.map((o: { text: string }) => plainText(o.text)), key, partial: plainText(sol.replace(/\[IMAGE:[^\]]*\]?/g, '')), reason: need });
    }
  }
  const run = jobs.slice(0, LIMIT);
  console.log('solutions needing work:', counts);
  console.log(`${run.length} to rewrite with ${MODEL}${jobs.length > run.length ? ` (${jobs.length - run.length} left for later)` : ''}`);
  const tally = { ok: 0, disagree: 0 };
  await pool(run, PARALLEL, async (j) => {
    let text = '', got = '';
    for (let attempt = 0; attempt < 2 && got !== L[j.key]; attempt++) {
      text = await chat(prompt(j.q, j.opts, j.key, attempt === 0 ? j.partial : ''), { system: SYSTEM, maxTokens: 560 });
      got = (text.match(/Answer:\s*\(?([A-D])\)?\s*$/i)?.[1] ?? '').toUpperCase();
    }
    const body = text.replace(/\n?Answer:\s*\(?[A-D]\)?\s*$/i, '').replace(/^(to solve|here is|here's|let's)[^\n]*\n+/i, '').trim();
    const ok = got === L[j.key] && body.length >= 60;
    const rec: SolutionRecord = { qid: j.qid, status: ok ? 'ok' : 'disagree', text: body, model: MODEL, v: PROMPT_VERSION, reason: j.reason };
    appendFileSync(CACHE, JSON.stringify(rec) + '\n');
    if (!ok) appendFileSync(REVIEW, JSON.stringify({ qid: j.qid, key: L[j.key], model: got || '?', q: j.q.slice(0, 200) }) + '\n');
    tally[ok ? 'ok' : 'disagree']++;
  }, 100, 'solutions');
  console.log('done', tally);
}

if (process.argv[1]?.endsWith('fix-solutions.ts')) main();
