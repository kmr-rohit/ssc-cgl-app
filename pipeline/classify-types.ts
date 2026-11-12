// Classify every bank question into one of its topic's question types (pipeline/taxonomy/<topic>.json).
//   1. free: the source's fine-grained concept maps to a type (taxonomy `concepts`)
//   2. local model (Ollama) for the rest, reply validated against the type list (else "other")
// Cache: pipeline/.cache/types.jsonl, keyed by question + taxonomy version + model (reruns are instant).
// Usage: npx tsx pipeline/classify-types.ts [--topic q-mensuration] [--limit 200] [--eval 40] [--parallel 4]
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mapTopic } from './mapping';
import { chat, MODEL, pool } from './llm';
import { cleanSourceText, plainText } from './clean';
import { TOPIC_MAP } from '../src/core/syllabus';
import { loadMoves } from './reroute-topics';

const ROOT = new URL('..', import.meta.url).pathname;
const RAW = join(ROOT, 'pipeline/.cache/raw');
const TAX = join(ROOT, 'pipeline/taxonomy');
const CACHE = join(ROOT, 'pipeline/.cache/types.jsonl');
const arg = (k: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const ONLY = arg('--topic');
const LIMIT = Number(arg('--limit') ?? Infinity);
const EVAL = Number(arg('--eval') ?? 0);
const PARALLEL = Number(arg('--parallel') ?? 4);

export interface TaxType { type: string; name: string; description: string; concepts?: string[] }
export interface Taxonomy { topic: string; types: TaxType[] }
export interface TypeRecord { qid: string; topic: string; type: string; method: 'concept' | 'model' | 'fallback'; key: string }

export function loadTaxonomies(): Map<string, Taxonomy> {
  const m = new Map<string, Taxonomy>();
  if (!existsSync(TAX)) return m;
  for (const f of readdirSync(TAX).filter((x) => x.endsWith('.json'))) {
    const t = JSON.parse(readFileSync(join(TAX, f), 'utf8')) as Taxonomy;
    if (t.topic && t.types?.length) m.set(t.topic, t);
  }
  return m;
}
export const taxKey = (t: Taxonomy) => createHash('sha256').update(JSON.stringify(t.types.map((x) => [x.type, x.name, x.description]))).digest('hex').slice(0, 10);

export function loadTypeCache(): Map<string, TypeRecord> {
  const m = new Map<string, TypeRecord>();
  if (existsSync(CACHE)) for (const l of readFileSync(CACHE, 'utf8').split('\n')) if (l.trim()) { const r = JSON.parse(l) as TypeRecord; m.set(`${r.qid}|${r.key}`, r); }
  return m;
}

const SYSTEM = 'You label SSC CGL exam questions by question type. Reply with exactly one label from the list and nothing else.';
function prompt(t: Taxonomy, question: string, options: string[]) {
  const labels = [...t.types.map((x) => `- ${x.type}: ${x.name}. ${x.description}`), '- other: none of the above'].join('\n');
  return `Topic: ${TOPIC_MAP[t.topic]?.name ?? t.topic}\nLabels:\n${labels}\n\nQuestion: ${question.slice(0, 1400)}\nOptions: ${options.map((o, i) => `(${'abcd'[i]}) ${o.slice(0, 120)}`).join('  ')}\n\nLabel:`;
}
function parse(reply: string, t: Taxonomy): string | null {
  const r = reply.toLowerCase().replace(/[`*"'.\s]+$/g, '').replace(/^[`*"'\s-]+/, '');
  const slugs = [...t.types.map((x) => x.type), 'other'];
  if (slugs.includes(r)) return r;
  const found = slugs.filter((s) => r.includes(s));
  return found.length === 1 ? found[0] : null;
}

async function classifyWithModel(t: Taxonomy, q: string, opts: string[]): Promise<{ type: string; method: 'model' | 'fallback' }> {
  const first = parse(await chat(prompt(t, q, opts), { system: SYSTEM, maxTokens: 16 }), t);
  if (first) return { type: first, method: 'model' };
  const second = parse(await chat(`${prompt(t, q, opts)}\n(Reply with only one label exactly as written above.)`, { system: SYSTEM, maxTokens: 16 }), t);
  return second ? { type: second, method: 'model' } : { type: 'other', method: 'fallback' };
}

async function main() {
  const tax = loadTaxonomies();
  const cache = loadTypeCache();
  const moves = loadMoves();
  const conceptType = new Map<string, Map<string, string>>(); // topic -> concept -> type
  for (const [topic, t] of tax) conceptType.set(topic, new Map(t.types.flatMap((x) => (x.concepts ?? []).map((c) => [c, x.type] as [string, string]))));

  interface Job { qid: string; topic: string; question: string; options: string[]; concept: string }
  const jobs: Job[] = [];
  for (const f of readdirSync(RAW).filter((x) => x.endsWith('.jsonl'))) {
    for (const line of readFileSync(join(RAW, f), 'utf8').split('\n')) {
      if (!line.trim()) continue;
      const r = JSON.parse(line);
      const m = mapTopic({ subject: r.subject, chapter: r.chapter, concept: r.concept ?? '', question: r.question });
      const topic = (m.topic && moves.get(r.qid)) || m.topic;
      if (!topic || !tax.has(topic) || (ONLY && topic !== ONLY)) continue;
      // a moved question's source concept belongs to its old topic: only the model may type it
      jobs.push({ qid: r.qid, topic, concept: topic === m.topic ? r.concept ?? '' : '', question: plainText(cleanSourceText(r.question).replace(/\[IMAGE:[^\]]*\]?/g, '[figure]')), options: r.options.map((o: { text: string }) => plainText(o.text.replace(/\[IMAGE:[^\]]*\]?/g, '[figure]'))) });
    }
  }

  // ---- evaluation: how often does the model agree with the free concept label?
  if (EVAL) {
    const byTopic = new Map<string, Job[]>();
    for (const j of jobs) if (conceptType.get(j.topic)?.has(j.concept)) byTopic.set(j.topic, [...(byTopic.get(j.topic) ?? []), j]);
    let agree = 0, total = 0;
    const misses: string[] = [];
    const sample = [...byTopic].flatMap(([, js]) => js.sort(() => 0.5 - Math.random()).slice(0, EVAL));
    await pool(sample, PARALLEL, async (j) => {
      const want = conceptType.get(j.topic)!.get(j.concept)!;
      const got = (await classifyWithModel(tax.get(j.topic)!, j.question, j.options)).type;
      total++; if (got === want) agree++; else if (misses.length < 25) misses.push(`${j.topic}: want ${want}, got ${got} | ${j.question.slice(0, 90)}`);
    }, 100, 'eval');
    console.log(`\nmodel agrees with concept labels on ${agree}/${total} (${Math.round((agree / total) * 100)}%)`);
    console.log(misses.join('\n'));
    return;
  }

  let free = 0, cached = 0;
  const todo: Job[] = [];
  for (const j of jobs) {
    const t = tax.get(j.topic)!;
    const key = `${taxKey(t)}|${MODEL}`;
    if (cache.has(`${j.qid}|${key}`)) { cached++; continue; }
    const ct = conceptType.get(j.topic)!.get(j.concept);
    if (ct) {
      const rec: TypeRecord = { qid: j.qid, topic: j.topic, type: ct, method: 'concept', key };
      appendFileSync(CACHE, JSON.stringify(rec) + '\n'); free++;
    } else todo.push(j);
  }
  const run = todo.slice(0, LIMIT);
  console.log(`${jobs.length} questions in ${new Set(jobs.map((j) => j.topic)).size} topics: ${cached} cached, ${free} by concept, ${run.length} for ${MODEL}${todo.length > run.length ? ` (${todo.length - run.length} left for later)` : ''}`);
  const tally: Record<string, number> = {};
  await pool(run, PARALLEL, async (j) => {
    const t = tax.get(j.topic)!;
    const r = await classifyWithModel(t, j.question, j.options);
    tally[r.method] = (tally[r.method] ?? 0) + 1;
    appendFileSync(CACHE, JSON.stringify({ qid: j.qid, topic: j.topic, type: r.type, method: r.method, key: `${taxKey(t)}|${MODEL}` } satisfies TypeRecord) + '\n');
  }, 250, 'classify');
  console.log('done', tally);
}

if (process.argv[1]?.endsWith('classify-types.ts')) main();
