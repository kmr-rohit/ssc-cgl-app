// Question bank: lazy-loads per-topic content from /content (built by tools/build-content.ts),
// mixes curated and generated questions, builds practice sets and mocks.
import { EXAMS, TOPIC_MAP, topicsOf } from '../core/syllabus';
import { Rng } from '../core/rng';
import type { ExamId, Level, Manifest, MockRecord, MockRules, MockSectionState, Question, SubjectId, TopicContent } from '../core/types';
import { GEN_VERSION, generateQuestion, generatorsFor } from '../gen';
import { getPyqManifest, loadPaper, loadPyqManifest, loadPyqTopic, pyqTopicOf, registerPyqSink } from './pyq';

const BASE = `${import.meta.env?.BASE_URL ?? '/'}content/`;
let manifest: Manifest | null = null;
const topics = new Map<string, TopicContent>();
const inflight = new Map<string, Promise<TopicContent | null>>();
const byId = new Map<string, Question>();
registerPyqSink((q) => byId.set(q.id, q));

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
  if (id.startsWith('gen:') || id.startsWith('pyq:')) return id.split(':')[1];
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

/** Make sure every id can be looked up: loads our topic files and past-paper topic pages as needed. */
export async function ensureQuestions(ids: string[]) {
  const missing = ids.filter((id) => !byId.has(id) && !id.startsWith('gen:'));
  const curated = new Set(missing.filter((id) => !id.startsWith('pyq:')).map(topicOfId));
  const pyq = new Set(await Promise.all(missing.filter((id) => id.startsWith('pyq:')).map(pyqTopicOf)));
  await Promise.all([...[...curated].filter((t) => TOPIC_MAP[t]).map(loadTopic), ...[...pyq].map(loadPyqTopic)]);
}

export function passageOf(q: Question) {
  if (!q.passageId) return null;
  return topics.get(q.topic)?.passages?.find((p) => p.id === q.passageId) ?? null;
}

// ------------------------------------------------------------------ practice

export type QuestionSource = 'all' | 'pyq' | 'practice';
export interface PracticeOpts { level: Level | 0; type?: string; n: number; seed: string; exclude?: Set<string>; source?: QuestionSource }

export async function practiceSet(topic: string, o: PracticeOpts): Promise<Question[]> {
  const source = o.source ?? 'all';
  const [c, pyq] = await Promise.all([loadTopic(topic), source === 'practice' ? Promise.resolve([] as Question[]) : loadPyqTopic(topic)]);
  const rng = new Rng(o.seed);
  // past-paper questions are exam level: they count for every level filter except Beginner
  const okLevel = (q: Question) => o.level === 0 || q.level === o.level || (q.source === 'pyq' && o.level !== 1);
  const ours = source === 'pyq' ? [] : (c?.questions ?? []);
  const curated = rng.shuffle([...ours, ...pyq].filter((q) => okLevel(q) && (!o.type || q.type === o.type) && !o.exclude?.has(q.id)));
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
  const gens = source === 'pyq' ? [] : generatorsFor(topic).filter((g) => !o.type || g.type === o.type);
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

export interface TypeInfo { type: string; name: string; curated: number; pyq: number; generated: boolean }
/** Question types of a topic: our notes' varieties, our questions, past-paper questions (pass them in) and generators. */
export function typesOf(topic: string, pyq: Question[] = []): TypeInfo[] {
  const c = topics.get(topic);
  const names = getPyqManifest()?.topics[topic]?.types ?? {};
  const map = new Map<string, TypeInfo>();
  const get = (type: string, name?: string) => {
    let e = map.get(type);
    if (!e) { e = { type, name: name ?? names[type] ?? type.replace(/-/g, ' '), curated: 0, pyq: 0, generated: false }; map.set(type, e); }
    return e;
  };
  for (const v of c?.notes.varieties ?? []) get(v.type, v.name);
  for (const q of c?.questions ?? []) get(q.type).curated++;
  for (const q of pyq) get(q.type).pyq++;
  for (const g of generatorsFor(topic)) get(g.type, g.name).generated = true;
  return [...map.values()].sort((a, b) => (b.pyq + b.curated) - (a.pyq + a.curated));
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

export interface SectionOpts {
  topics?: string[] | null;            // only these topics
  weights?: Record<string, number>;    // topic weight override (weak topics, equal spread)
  exclude?: Set<string>;               // question ids to skip (already seen)
}

export async function buildSection(exam: ExamId, subject: SubjectId, count: number, rng: Rng, snapshot: Record<string, Question>, pyqPool: Question[] = [], opts: SectionOpts = {}): Promise<string[]> {
  await loadSubject(subject);
  const key = weightKey(exam);
  const list = topicsOf(subject)
    .filter((t) => !opts.topics?.length || opts.topics.includes(t.id))
    .map((t) => ({ id: t.id, w: opts.weights?.[t.id] ?? ((t[key][0] + t[key][1]) / 2 || (exam === 'stats' ? 0 : 0.25)) }));
  const alloc = allocate(list, count);
  const groups: Question[][] = [];
  const taken = new Set<string>();
  const skip = (id: string) => taken.has(id) || !!opts.exclude?.has(id);
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
    // real past-paper questions first
    for (const q of rng.shuffle(pyqPool.filter((x) => x.topic === id))) {
      if (need <= 0) break;
      if (skip(q.id)) continue;
      taken.add(q.id); snapshot[q.id] = q; groups.push([q]); need--;
    }
    if (!need) continue;
    const c = topics.get(id);
    const pool = rng.shuffle(c?.questions ?? []);
    const hasGen = generatorsFor(id).length > 0;
    // with a generator, about half curated and half generated
    let curatedTarget = hasGen ? Math.ceil(need / 2) : need;
    for (const q of pool) {
      if (curatedTarget <= 0 || skip(q.id)) continue;
      if (q.passageId) {
        const g = c!.questions.filter((x) => x.passageId === q.passageId);
        if (g.length > need) continue;
        g.forEach((x) => taken.add(x.id));
        groups.push(g); need -= g.length; curatedTarget -= g.length;
      } else { taken.add(q.id); groups.push([q]); need--; curatedTarget--; }
    }
    if (need > 0) need -= genFill(id, need);
    if (need > 0) shortage += need;
  }
  // fill any shortage from anything left in the subject
  if (shortage > 0) {
    for (const q of rng.shuffle(pyqPool.filter((x) => !skip(x.id) && list.some((t) => t.id === x.topic)))) { if (shortage <= 0) break; taken.add(q.id); snapshot[q.id] = q; groups.push([q]); shortage--; }
    const rest = rng.shuffle(list.flatMap((t) => (topics.get(t.id)?.questions ?? []).filter((q) => !skip(q.id) && !q.passageId)));
    for (const q of rest) { if (shortage <= 0) break; taken.add(q.id); groups.push([q]); shortage--; }
    for (const t of rng.shuffle(list)) { if (shortage <= 0) break; shortage -= genFill(t.id, shortage); }
  }
  // SSC shows passages as blocks; keep groups intact, shuffle group order
  return rng.shuffle(groups).flat().slice(0, Math.max(count, 0)).map((q) => q.id);
}

export interface MockSpec { exam: ExamId; kind: MockRecord['kind']; key: string; seed: string; subjects?: SubjectId[]; usePyq?: boolean }

export async function buildMock(spec: MockSpec): Promise<MockRecord> {
  const e = EXAMS[spec.exam];
  const rng = new Rng(spec.seed);
  const snapshot: Record<string, Question> = {};
  const sections: MockSectionState[] = [];
  // Tier 1 / Tier 2 mocks draw from 4 real past papers of that tier (chosen by the seed), then our bank fills gaps
  let pool: Question[] = [];
  if (spec.usePyq !== false && spec.exam !== 'stats') {
    const m = await loadPyqManifest();
    const papers = (m?.papers ?? []).filter((p) => p.tier === spec.exam);
    if (papers.length) {
      const chosen = await Promise.all(rng.sample(papers, Math.min(4, papers.length)).map((p) => loadPaper(p.id).catch(() => null)));
      const seen = new Set<string>();
      pool = chosen.flatMap((p) => p?.questions ?? []).filter((q) => !seen.has(q.id) && seen.add(q.id));
    }
  }
  for (const s of e.sections) {
    if (spec.subjects && !spec.subjects.includes(s.subject)) continue;
    const subjPool = pool.filter((q) => TOPIC_MAP[q.topic]?.subject === s.subject);
    const ids = await buildSection(spec.exam, s.subject, s.count, rng, snapshot, subjPool);
    sections.push({
      subject: s.subject, questionIds: ids, answers: ids.map(() => null), marked: ids.map(() => false),
      visited: ids.map(() => false), msSpent: ids.map(() => 0), remainingMs: s.minutes * 60_000, allottedMs: s.minutes * 60_000, done: false,
    });
  }
  return {
    key: spec.key, exam: spec.exam, kind: spec.kind, seed: spec.seed, genVersion: GEN_VERSION, status: 'not-started',
    current: { section: 0, index: 0 }, sections, snapshot, updatedAt: new Date().toISOString(),
  };
}

// ------------------------------------------------------------------ custom mocks (mock builder)

export interface BuilderSection { subject: SubjectId; count: number; topics: string[] | null }
export interface BuilderSpec {
  paper: ExamId | 'custom';
  sections: BuilderSection[];
  source: 'all' | 'unseen' | 'mistakes';
  weighting: 'exam' | 'weak' | 'equal';
  rules: MockRules;
  title: string;
}
export interface BuildContext { seen: Set<string>; mistakes: string[]; weakWeights: Record<string, number> }

/** Which paper's weightage, timing and section label a subject uses inside a custom paper. */
export const baseExamFor = (subject: SubjectId, paper: BuilderSpec['paper']): ExamId =>
  paper !== 'custom' ? paper : subject === 'statistics' ? 'stats' : subject === 'computer' ? 'mains' : 'pre';

export async function buildCustomMock(spec: BuilderSpec, key: string, ctx: BuildContext): Promise<MockRecord> {
  const rng = new Rng(key);
  const snapshot: Record<string, Question> = {};
  const sections: MockSectionState[] = [];
  const mk = (subject: SubjectId, ids: string[], minutes: number): MockSectionState => ({
    subject, questionIds: ids, answers: ids.map(() => null), marked: ids.map(() => false), visited: ids.map(() => false),
    msSpent: ids.map(() => 0), remainingMs: Math.round(minutes * 60_000), allottedMs: Math.round(minutes * 60_000), done: false,
  });
  if (spec.source === 'mistakes') await ensureQuestions(ctx.mistakes);
  for (const s of spec.sections) {
    if (s.count <= 0) continue;
    const exam = baseExamFor(s.subject, spec.paper);
    const def = EXAMS[exam].sections.find((x) => x.subject === s.subject) ?? EXAMS[exam].sections[0];
    let ids: string[];
    if (spec.source === 'mistakes') {
      const mine = ctx.mistakes.map((id) => lookup(id)).filter((q): q is Question => !!q && TOPIC_MAP[q.topic]?.subject === s.subject && (!s.topics?.length || s.topics.includes(q.topic)));
      ids = rng.sample(mine, Math.min(s.count, mine.length)).map((q) => { snapshot[q.id] = q; return q.id; });
    } else {
      // pool from 4 past papers of the base exam, as daily mocks do
      let pool: Question[] = [];
      const m = exam === 'stats' ? null : await loadPyqManifest();
      const papers = (m?.papers ?? []).filter((p) => p.tier === exam);
      if (papers.length) {
        const chosen = await Promise.all(rng.sample(papers, Math.min(4, papers.length)).map((p) => loadPaper(p.id).catch(() => null)));
        pool = chosen.flatMap((p) => p?.questions ?? []).filter((q) => TOPIC_MAP[q.topic]?.subject === s.subject);
      }
      const weights = spec.weighting === 'equal' ? Object.fromEntries(topicsOf(s.subject).map((t) => [t.id, 1]))
        : spec.weighting === 'weak' ? ctx.weakWeights : undefined;
      ids = await buildSection(exam, s.subject, s.count, rng, snapshot, pool, {
        topics: s.topics, weights, exclude: spec.source === 'unseen' ? ctx.seen : undefined,
      });
    }
    if (!ids.length) continue;
    const r = spec.rules;
    const minutes = r.timing === 'perq' ? (ids.length * (r.perQSec ?? 36)) / 60 : (def.minutes / def.count) * ids.length;
    sections.push(mk(s.subject, ids, minutes));
  }
  if (!sections.length) throw new Error(spec.source === 'mistakes' ? 'No mistakes match these sections yet. Practise a little first, or choose "All questions".' : 'No questions match. Choose more topics or sections.');
  return {
    key, exam: spec.paper === 'custom' ? baseExamFor(spec.sections[0].subject, 'custom') : spec.paper, kind: 'custom', seed: key, genVersion: GEN_VERSION,
    status: 'not-started', title: spec.title, rules: spec.rules, current: { section: 0, index: 0 }, sections, snapshot, updatedAt: new Date().toISOString(),
  };
}

/** Make every question of a stored mock available to lookup(). */
export async function hydrateMock(m: MockRecord) {
  for (const q of Object.values(m.snapshot ?? {})) remember(q);
  await ensureQuestions(m.sections.flatMap((s) => s.questionIds));
}
