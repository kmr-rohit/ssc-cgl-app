// Shared types. This file is the contract between content authoring, generators, storage and views.

export type SubjectId = 'quant' | 'reasoning' | 'english' | 'ga' | 'computer' | 'statistics';
export type Level = 1 | 2 | 3;
export type ExamId = 'pre' | 'mains' | 'stats';

/**
 * One MCQ. HTML is allowed in q / options / solution, restricted to:
 * b i em strong u br p ul ol li table thead tbody tr th td sub sup span code small.
 * Images: `img` (question figure) and `optionImgs` (one per option) are paths relative to /content/assets/.
 */
export interface Question {
  id: string;            // stable forever. Curated: "<topic>-<nnn>", generated: "gen:<topic>:<type>:<level>:<seed>"
  rev: number;           // bump when the question is corrected
  topic: string;
  type: string;          // question variety slug, e.g. "successive-change"
  level: Level;
  q: string;
  img?: string;
  options: string[];     // exactly 4, unique
  optionImgs?: string[];
  answer: number;        // 0..3
  solution: string;      // non-empty, step-by-step
  passageId?: string;    // RC / cloze / DI set
  source: 'curated' | 'generated' | 'test-data' | 'pyq';
  /** Previous-year question: every past paper (shift) it appeared in. */
  pyq?: { asked: PyqAsked[] };
  tags?: string[];
}

export interface PyqAsked { tier: 'pre' | 'mains'; year: number; date: string; shift: string | null; paper: string }

export interface Passage {
  id: string;
  title?: string;
  text: string;          // HTML
  img?: string;
}

export interface NoteSection {
  title: string;
  body: string;          // HTML
  img?: string;
}

export interface Variety {
  type: string;          // matches Question.type
  name: string;
  how: string;           // HTML, short method
  example: { q: string; steps: string[]; answer: string; img?: string };
}

export interface Flashcard {
  id: string;            // stable
  front: string;
  back: string;
  deck: string;          // e.g. "vocab", "idioms", "ga-facts", "computer", "formulas"
}

export interface TopicContent {
  topic: string;
  notes: {
    summary: string;
    concepts: NoteSection[];
    varieties: Variety[];
    tips: string[];
    traps: string[];
  };
  formulas?: { name: string; expr: string }[];
  passages?: Passage[];
  questions: Question[];
  flashcards?: Flashcard[];
}

export interface ManifestTopic {
  file: string;          // e.g. "topics/q-percentage.3f9a1c.json"
  bytes: number;
  questions: number;
  byLevel: [number, number, number];
  types: string[];
  flashcards: number;
}

export interface Manifest {
  version: string;       // content hash
  builtAt: string;
  topics: Record<string, ManifestTopic>;
}

/** A generator produces one question body for a seed + level. Must be pure and deterministic. */
export interface GeneratedBody {
  q: string;
  img?: string;          // inline SVG is NOT allowed here; use svg field
  svg?: string;          // inline SVG markup for figures built at runtime
  options: string[];
  answer: number;
  solution: string;
}

export interface Generator {
  topic: string;
  type: string;
  name: string;
  levels: Level[];
  make(rng: import('./rng').Rng, level: Level): GeneratedBody;
}

// ---------------------------------------------------------------- user data

export interface Attempt {
  id: string;            // client uuid
  questionId: string;
  rev: number;
  topic: string;
  type: string;
  level: Level;
  chosen: number | null; // null = skipped
  correct: boolean;
  ms: number;
  mode: 'learn' | 'test' | 'mock';
  mockKey?: string;
  at: string;            // ISO
}

export type MockStatus = 'not-started' | 'in-progress' | 'submitted';

export interface MockSectionState {
  subject: SubjectId;
  questionIds: string[];
  answers: (number | null)[];
  marked: boolean[];
  visited: boolean[];
  msSpent: number[];
  remainingMs: number;
  allottedMs?: number;   // time the section was given at the start (challenges reuse it)
  done: boolean;
}

/** How a mock is run. Absent = the real exam (sectional timers, locked sections, exam marking, answers at the end). */
export interface MockRules {
  timing: 'exam' | 'none' | 'perq';   // exam pace; no time limit; or seconds per question
  perQSec?: number;
  sectionMode: 'locked' | 'free';     // locked = SSC style; free = move between sections, one clock
  marks: number;
  negative: number;
  feedback: 'end' | 'instant';        // instant = see the answer right after choosing
}

export interface MockRecord {
  key: string;           // e.g. "pre-2026-11-12" or "sec-quant-1731400000"
  exam: ExamId;
  kind: 'daily' | 'sectional' | 'custom';
  title?: string;        // custom mocks and challenges
  rules?: MockRules;
  clockMs?: number;      // free sections: time left overall; no timer: time used
  challenge?: string;    // challenge code this mock belongs to
  challengeOwner?: boolean;
  challengePosted?: boolean; // my score reached the leaderboard
  seed: string;
  genVersion: number;
  status: MockStatus;
  current: { section: number; index: number };
  sections: MockSectionState[];
  snapshot?: Record<string, Question>; // generated questions frozen at build time
  startedAt?: string;
  submittedAt?: string;
  score?: MockScore;
  integrity?: { leaves: number; awayMs: number; fsExits: number };
  updatedAt: string;
}

export interface MockScore {
  total: number;
  max: number;
  sections: { subject: SubjectId; correct: number; wrong: number; skipped: number; score: number; max: number }[];
}

export interface CardState {
  id: string;
  due: string;           // ISO date
  interval: number;      // days
  ease: number;
  reps: number;
  lapses: number;
  updatedAt: string;
}

export interface Settings {
  name: string;
  target: ExamId;
  examDate: string | null;
  dailyHours: number;
  theme: 'auto' | 'light' | 'dark';
  paper2: boolean;
  newWordsPerDay: number;
  examMode: boolean;     // fullscreen + leave-tab warnings during full mocks
  onboarded: boolean;    // finished the first-run setup
  toured: boolean;       // saw (or skipped) the guided app tour
}
