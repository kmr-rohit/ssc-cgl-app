// Previous-year question bank (built by pipeline/build-pyq.ts into /pyq). Loaded lazily:
// a topic's pages only when practice or review needs them, a paper only when it is opened.
import type { Question, SubjectId } from '../core/types';

const BASE = `${import.meta.env?.BASE_URL ?? '/'}pyq/`;

export interface PyqPaperInfo { id: string; title: string; tier: 'pre' | 'mains'; year: number; date: string; shift: string | null; minutes: number; available: number; total: number; file: string }
export interface PyqManifest {
  version: string;
  counts: { questions: number; papers: number };
  topics: Record<string, { pages: string[]; count: number; types: Record<string, string> }>;
  papers: PyqPaperInfo[];
  weightage: Record<string, { pre: number; mains: number }>;
  /** topic → ids of questions moved there from the topic their id names (the source misfiled them) */
  moved?: Record<string, string[]>;
}
export interface PyqPaper {
  id: string; title: string; tier: 'pre' | 'mains'; year: number; date: string; shift: string | null; minutes: number;
  sections: { subject: SubjectId; questionIds: string[]; missing: number; total: number }[];
  questions: Question[];
}

let manifest: PyqManifest | null = null;
let manifestP: Promise<PyqManifest | null> | null = null;
const topicCache = new Map<string, Promise<Question[]>>();
const paperCache = new Map<string, Promise<PyqPaper>>();
let onLoaded: (q: Question) => void = () => {};

/** bank.ts registers its id index here so loaded questions become available to lookup(). */
export const registerPyqSink = (f: (q: Question) => void) => { onLoaded = f; };

export function loadPyqManifest(): Promise<PyqManifest | null> {
  return (manifestP ??= fetch(`${BASE}manifest.json`, { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null))
    .then((m) => (manifest = m))
    .catch(() => null));
}
export const getPyqManifest = () => manifest;

let movedIndex: Map<string, string> | null = null;
/** Topic whose pages hold a past-paper question. Ids keep the topic they were first filed under, even after a move. */
export async function pyqTopicOf(id: string): Promise<string> {
  const m = await loadPyqManifest();
  if (!movedIndex && m) { // built once the manifest is in; offline, ids fall back to their own topic
    movedIndex = new Map();
    for (const [topic, ids] of Object.entries(m.moved ?? {})) for (const x of ids) movedIndex.set(x, topic);
  }
  return movedIndex?.get(id) ?? id.split(':')[1];
}
export const pyqCount = (topic: string) => manifest?.topics[topic]?.count ?? 0;

export function loadPyqTopic(topic: string): Promise<Question[]> {
  let p = topicCache.get(topic);
  if (!p) {
    p = (async () => {
      const m = await loadPyqManifest();
      const entry = m?.topics[topic];
      if (!entry) return [];
      const pages = await Promise.all(entry.pages.map((f) => fetch(BASE + f).then((r) => {
        if (!r.ok) throw new Error(`Could not load past-paper questions for ${topic}`);
        return r.json() as Promise<Question[]>;
      })));
      const qs = pages.flat();
      qs.forEach((q) => onLoaded(q));
      return qs;
    })();
    p.catch(() => topicCache.delete(topic));
    topicCache.set(topic, p);
  }
  return p;
}

export function loadPaper(id: string): Promise<PyqPaper> {
  let p = paperCache.get(id);
  if (!p) {
    p = (async () => {
      const m = await loadPyqManifest();
      const info = m?.papers.find((x) => x.id === id);
      if (!info) throw new Error('That past paper is not available.');
      const r = await fetch(BASE + info.file);
      if (!r.ok) throw new Error('Could not load the past paper. Check your connection.');
      const paper = (await r.json()) as PyqPaper;
      paper.questions.forEach((q) => onLoaded(q));
      return paper;
    })();
    p.catch(() => paperCache.delete(id));
    paperCache.set(id, p);
  }
  return p;
}

