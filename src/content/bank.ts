// Question bank: lazy-loads per-topic content from /content (built by tools/build-content.ts),
// mixes curated and generated questions, builds practice sets and mocks.
import { EXAMS, TOPIC_MAP, topicsOf } from '../core/syllabus';
import { Rng } from '../core/rng';
import type { ExamId, Level, Manifest, MockRecord, MockSectionState, Question, SubjectId, TopicContent } from '../core/types';
import { GEN_VERSION, generateQuestion, generatorsFor } from '../gen';

const BASE = `${import.meta.env?.BASE_URL ?? '/'}content/`;
let manifest: Manifest | null = null;
const topics = new Map<string, TopicContent>();
const inflight = new Map<string, Promise<TopicContent | null>>();
const byId = new Map<string, Question>();

export async function loadManifest(): Promise<Manifest> {
  if (manifest) return manifest;
  const r = await fetch(`${BASE}manifest.json`, { cache: 'no-cache' });
  if (!r.ok) throw new Error('Content manifest not found. Run "npm run content:build".');
  manifest = (await r.json()) as Manifest;
  return manifest;
}
export const getManifest = () => manifest;
export const assetUrl = (p: string) => `${BASE}assets/${p}`;

export function loadTopic(id: string): Promise<TopicContent | null> {
  if (topics.has(id)) return Promise.resolve(topics.get(id)!);
  if (inflight.has(id)) return inflight.get(id)!;
  const p = (async () => {
    const m = await loadManifest();
    const entry = m.topics[id];
    if (!entry) return null;
    const r = await fetch(BASE + entry.file);
    if (!r.ok) throw new Error(`Could not load ${id}`);
    const c = (await r.json()) as TopicContent;
    topics.set(id, c);
    c.questions.forEach((q) => byId.set(q.id, q));
    return c;
  })().finally(() => inflight.delete(id));
  inflight.set(id, p);
  return p;
}
export const getTopic = (id: string) => topics.get(id) ?? null;
export const loadSubject = (s: SubjectId) => Promise.all(topicsOf(s).map((t) => loadTopic(t.id)));

export const hasGenerator = (topic: string) => generatorsFor(topic).length > 0;

/** Topic id of a question id without loading anything. */
export function topicOfId(id: string): string {
  if (id.startsWith('gen:')) return id.split(':')[1];
  return id.replace(/-\d+$/, '');
}

/** Lookup by id; generated ids are rebuilt from their seed when not cached. */
export function lookup(id: string): Question | undefined {
  const hit = byId.get(id);
  if (hit) return hit;
  if (id.startsWith('gen:')) {
    const [, topic, type, level, ...seed] = id.split(':');
    const g = generatorsFor(topic).find((x) => x.type === type);
    if (!g) return undefined;
    const q = generateQuestion(g, seed.join(':'), Number(level) as Level);
    byId.set(id, q);
    return q;
  }
  return undefined;
}
export const remember = (q: Question) => byId.set(q.id, q);

export function passageOf(q: Question) {
  if (!q.passageId) return null;
  return topics.get(q.topic)?.passages?.find((p) => p.id === q.passageId) ?? null;
}

// ------------------------------------------------------------------ practice

export interface PracticeOpts { level: Level | 0; type?: string; n: number; seed: string; exclude?: Set<string> }

export async function practiceSet(topic: string, o: PracticeOpts): Promise<Question[]> {
  const c = await loadTopic(topic);
  const rng = new Rng(o.seed);
  const okLevel = (l: Level) => o.level === 0 || l === o.level;
  const curated = rng.shuffle((c?.questions ?? []).filter((q) => okLevel(q.level) && (!o.type || q.type === o.type) && !o.exclude?.has(q.id)));
  // passage questions stay together and in order
  const out: Question[] = [];
  const usedPassages = new Set<string>();
  for (const q of curated) {
    if (out.length >= o.n) break;
    if (q.passageId) {
      if (usedPassages.has(q.passageId)) continue;
      usedPassages.add(q.passageId);
      out.push(...(c?.questions ?? []).filter((x) => x.passageId === q.passageId));
    } else out.push(q);
  }
  const gens = generatorsFor(topic).filter((g) => !o.type || g.type === o.type);
  for (let i = 0; out.length < o.n && gens.length && i < o.n * 4; i++) {
    const g = rng.pick(gens);
    const lv = (o.level || rng.pick(g.levels)) as Level;
    if (!g.levels.includes(lv)) continue;
    const q = generateQuestion(g, `${o.seed}-${i}`, lv);
    remember(q);
    out.push(q);
  }
  return out;
}

export function typesOf(topic: string): { type: string; name: string; curated: number; generated: boolean }[] {
  const c = topics.get(topic);
  const map = new Map<string, { type: string; name: string; curated: number; generated: boolean }>();
  for (const v of c?.notes.varieties ?? []) map.set(v.type, { type: v.type, name: v.name, curated: 0, generated: false });
  for (const q of c?.questions ?? []) {
    const e = map.get(q.type) ?? { type: q.type, name: q.type.replace(/-/g, ' '), curated: 0, generated: false };
    e.curated++; map.set(q.type, e);
  }
  for (const g of generatorsFor(topic)) {
    const e = map.get(g.type) ?? { type: g.type, name: g.name, curated: 0, generated: false };
    e.generated = true; map.set(g.type, e);
  }
  return [...map.values()];
}

// ------------------------------------------------------------------ mocks

const weightKey = (exam: ExamId) => (exam === 'pre' ? 'pre' : exam === 'mains' ? 'mains' : 'stats') as 'pre' | 'mains' | 'stats';

/** Largest-remainder allocation of `count` questions across topics by weight. */
export function allocate(weights: { id: string; w: number }[], count: number): Record<string, number> {
  const total = weights.reduce((a, x) => a + x.w, 0) || 1;
  const raw = weights.map((x) => ({ id: x.id, exact: (x.w / total) * count }));
  const out: Record<string, number> = {};
  let used = 0;
  for (const r of raw) { out[r.id] = Math.floor(r.exact); used += out[r.id]; }
  raw.sort((a, b) => (b.exact % 1) - (a.exact % 1));
  for (let i = 0; used < count && raw.length; i++, used++) out[raw[i % raw.length].id]++;
  return out;
}

export async function buildSection(exam: ExamId, subject: SubjectId, count: number, rng: Rng, snapshot: Record<string, Question>): Promise<string[]> {
  await loadSubject(subject);
  const key = weightKey(exam);
  const list = topicsOf(subject).map((t) => ({ id: t.id, w: (t[key][0] + t[key][1]) / 2 || (exam === 'stats' ? 0 : 0.25) }));
  const alloc = allocate(list, count);
  const groups: Question[][] = [];
  const taken = new Set<string>();
  let shortage = 0;
  const genFill = (topic: string, n: number) => {
    const gens = generatorsFor(topic);
    let made = 0;
    for (let i = 0; made < n && gens.length && i < n * 6; i++) {
      const g = rng.pick(gens);
      const lv = rng.pick(g.levels);
      const q = generateQuestion(g, `${rng.int(0, 1e9)}`, lv);
      if (taken.has(q.id)) continue;
      taken.add(q.id); snapshot[q.id] = q; remember(q); groups.push([q]); made++;
    }
    return made;
  };
  for (const { id } of list) {
    let need = alloc[id];
    if (!need) continue;
    const c = topics.get(id);
    const pool = rng.shuffle(c?.questions ?? []);
    const hasGen = generatorsFor(id).length > 0;
    // with a generator, about half curated and half generated
    let curatedTarget = hasGen ? Math.ceil(need / 2) : need;
    for (const q of pool) {
      if (curatedTarget <= 0 || taken.has(q.id)) continue;
      if (q.passageId) {
        const g = c!.questions.filter((x) => x.passageId === q.passageId);
        if (g.length > need + 1) continue;
        g.forEach((x) => taken.add(x.id));
        groups.push(g); need -= g.length; curatedTarget -= g.length;
      } else { taken.add(q.id); groups.push([q]); need--; curatedTarget--; }
    }
    if (need > 0) need -= genFill(id, need);
    if (need > 0) shortage += need;
  }
  // fill any shortage from anything left in the subject
  if (shortage > 0) {
    const rest = rng.shuffle(topicsOf(subject).flatMap((t) => (topics.get(t.id)?.questions ?? []).filter((q) => !taken.has(q.id) && !q.passageId)));
    for (const q of rest) { if (shortage <= 0) break; taken.add(q.id); groups.push([q]); shortage--; }
    for (const t of rng.shuffle(topicsOf(subject))) { if (shortage <= 0) break; shortage -= genFill(t.id, shortage); }
  }
  // SSC shows passages as blocks; keep groups intact, shuffle group order
  return rng.shuffle(groups).flat().slice(0, Math.max(count, 0)).map((q) => q.id);
}

export interface MockSpec { exam: ExamId; kind: MockRecord['kind']; key: string; seed: string; subjects?: SubjectId[] }

export async function buildMock(spec: MockSpec): Promise<MockRecord> {
  const e = EXAMS[spec.exam];
  const rng = new Rng(spec.seed);
  const snapshot: Record<string, Question> = {};
  const sections: MockSectionState[] = [];
  for (const s of e.sections) {
    if (spec.subjects && !spec.subjects.includes(s.subject)) continue;
    const ids = await buildSection(spec.exam, s.subject, s.count, rng, snapshot);
    sections.push({
      subject: s.subject, questionIds: ids, answers: ids.map(() => null), marked: ids.map(() => false),
      visited: ids.map(() => false), msSpent: ids.map(() => 0), remainingMs: s.minutes * 60_000, done: false,
    });
  }
  return {
    key: spec.key, exam: spec.exam, kind: spec.kind, seed: spec.seed, genVersion: GEN_VERSION, status: 'not-started',
    current: { section: 0, index: 0 }, sections, snapshot, updatedAt: new Date().toISOString(),
  };
}

/** Make every question of a stored mock available to lookup(). */
export async function hydrateMock(m: MockRecord) {
  for (const q of Object.values(m.snapshot ?? {})) remember(q);
  const need = new Set(m.sections.flatMap((s) => s.questionIds).filter((id) => !byId.has(id)).map(topicOfId));
  await Promise.all([...need].filter((t) => TOPIC_MAP[t]).map(loadTopic));
}
