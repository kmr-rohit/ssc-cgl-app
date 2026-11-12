// For each of our topics: the source's fine-grained concepts (with counts and a sample question each),
// as input for defining question types. Output: pipeline/.cache/concepts/<topic>.json (not committed).
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { mapTopic } from './mapping';

const ROOT = new URL('..', import.meta.url).pathname;
const RAW = join(ROOT, 'pipeline/.cache/raw');
const OUT = join(ROOT, 'pipeline/.cache/concepts');
mkdirSync(OUT, { recursive: true });
const by = new Map<string, Map<string, { n: number; label: string; samples: string[] }>>();
for (const f of readdirSync(RAW).filter((x) => x.endsWith('.jsonl'))) {
  for (const line of readFileSync(join(RAW, f), 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const r = JSON.parse(line);
    const m = mapTopic({ subject: r.subject, chapter: r.chapter, concept: r.concept ?? '', question: r.question });
    if (!m.topic) continue;
    const t = by.get(m.topic) ?? new Map(); by.set(m.topic, t);
    const c = t.get(r.concept) ?? { n: 0, label: r.source_concept, samples: [] }; t.set(r.concept, c);
    c.n++;
    if (c.samples.length < 2) c.samples.push(String(r.question).replace(/\[IMAGE:[^\]]*\]/g, '[figure]').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 220));
  }
}
for (const [topic, t] of by) {
  const concepts = [...t].map(([concept, v]) => ({ concept, sourceLabel: v.label, count: v.n, samples: v.samples })).sort((a, b) => b.count - a.count);
  writeFileSync(join(OUT, `${topic}.json`), JSON.stringify({ topic, total: concepts.reduce((a, c) => a + c.count, 0), concepts }, null, 1));
}
console.log(`wrote ${by.size} topic files`);
