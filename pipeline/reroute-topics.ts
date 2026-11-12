// Move past-paper questions the source filed under the wrong topic (a coding question under seating, LCM under number
// system). Candidates are the questions classify-types labelled "other" in their topic. The local model picks the right
// topic from the whole syllabus; the reply must be a known topic id, else the question stays where it was.
// Cache: pipeline/.cache/topics.jsonl. Question ids never change; build-pyq writes the question into its new topic and
// records the move in the manifest so old ids still resolve.
// Usage: npx tsx pipeline/reroute-topics.ts [--parallel 4]   then rerun classify-types.ts (types in the new topics)
import { appendFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mapTopic } from './mapping';
import { chat, MODEL, pool } from './llm';
import { cleanSourceText, plainText } from './clean';
import { loadTaxonomies, loadTypeCache, taxKey } from './classify-types';
import { SUBJECTS, TOPICS } from '../src/core/syllabus';

const ROOT = new URL('..', import.meta.url).pathname;
const RAW = join(ROOT, 'pipeline/.cache/raw');
const CACHE = join(ROOT, 'pipeline/.cache/topics.jsonl');
const V = 'v1';
const arg = (k: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const PARALLEL = Number(arg('--parallel') ?? 4);

export interface MoveRecord { qid: string; from: string; to: string; model: string; v: string }
/** qid → topic for every question that moves (records that keep their topic are cached too, so reruns skip them). */
export function loadMoves(): Map<string, string> {
  const m = new Map<string, string>();
  if (existsSync(CACHE)) for (const l of readFileSync(CACHE, 'utf8').split('\n')) if (l.trim()) { const r = JSON.parse(l) as MoveRecord; if (r.to !== r.from) m.set(r.qid, r.to); else m.delete(r.qid); }
  return m;
}

const SYSTEM = 'You sort SSC CGL exam questions into syllabus topics. Reply with exactly one topic id from the list and nothing else.';
// Paper 2 statistics topics are left out: a Tier 1 maths question must not move into Paper 2
const CANDIDATES = TOPICS.filter((t) => t.subject !== 'statistics');
const subjectName = (id: string) => (SUBJECTS as Record<string, { name: string }>)[id]?.name ?? id;
const TOPIC_LIST = CANDIDATES.map((t) => `- ${t.id}: ${t.name} (${subjectName(t.subject)})`).join('\n');
const prompt = (q: string, opts: string[], from: string) =>
  `Topics:\n${TOPIC_LIST}\n\nThe source filed this question under "${from}", which may be wrong.\nQuestion: ${q.slice(0, 1200)}\nOptions: ${opts.map((o, i) => `(${'abcd'[i]}) ${o.slice(0, 100)}`).join('  ')}\n\nTopic id:`;
const parse = (reply: string) => {
  const r = reply.trim().toLowerCase().replace(/[`*"'.\s]+$/g, '').replace(/^[`*"'\s-]+/, '');
  return CANDIDATES.some((t) => t.id === r) ? r : null;
};

async function main() {
  const tax = loadTaxonomies();
  const types = loadTypeCache();
  const done = new Set<string>();
  if (existsSync(CACHE)) for (const l of readFileSync(CACHE, 'utf8').split('\n')) if (l.trim()) { const r = JSON.parse(l) as MoveRecord; if (r.model === MODEL && r.v === V) done.add(r.qid); }
  interface Job { qid: string; from: string; q: string; opts: string[] }
  const jobs: Job[] = [];
  for (const f of readdirSync(RAW).filter((x) => x.endsWith('.jsonl'))) {
    for (const line of readFileSync(join(RAW, f), 'utf8').split('\n')) {
      if (!line.trim()) continue;
      const r = JSON.parse(line);
      const m = mapTopic({ subject: r.subject, chapter: r.chapter, concept: r.concept ?? '', question: r.question });
      const t = m.topic && tax.get(m.topic);
      if (!t || done.has(r.qid)) continue;
      if (types.get(`${r.qid}|${taxKey(t)}|${MODEL}`)?.type !== 'other') continue;
      jobs.push({ qid: r.qid, from: m.topic!, q: plainText(cleanSourceText(r.question).replace(/\[IMAGE:[^\]]*\]?/g, '[figure]')), opts: r.options.map((o: { text: string }) => plainText(o.text.replace(/\[IMAGE:[^\]]*\]?/g, '[figure]'))) });
    }
  }
  console.log(`${jobs.length} questions labelled "other" to re-check with ${MODEL}`);
  const moved: Record<string, number> = {};
  let stay = 0;
  await pool(jobs, PARALLEL, async (j) => {
    const to = parse(await chat(prompt(j.q, j.opts, j.from), { system: SYSTEM, maxTokens: 16 })) ?? j.from;
    appendFileSync(CACHE, JSON.stringify({ qid: j.qid, from: j.from, to, model: MODEL, v: V } satisfies MoveRecord) + '\n');
    if (to === j.from) stay++; else moved[`${j.from} > ${to}`] = (moved[`${j.from} > ${to}`] ?? 0) + 1;
  }, 200, 'reroute');
  console.log(`kept in place: ${stay}`);
  console.log(Object.entries(moved).sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, v]) => `  ${v}  ${k}`).join('\n'));
}

if (process.argv[1]?.endsWith('reroute-topics.ts')) main();
