// SSC CGL exam patterns, subjects and topics with weightage (expected questions per paper, PYQ trend).
import type { ExamId, SubjectId } from './types';

export interface ExamSection { subject: SubjectId; count: number; minutes: number; label?: string; qualifying?: boolean }
export interface Exam { id: ExamId; name: string; short: string; sections: ExamSection[]; marks: number; negative: number; note: string }

export const EXAMS: Record<ExamId, Exam> = {
  pre: {
    id: 'pre', name: 'Tier 1 (Pre)', short: 'Tier 1',
    sections: [
      { subject: 'reasoning', count: 25, minutes: 15 },
      { subject: 'ga', count: 25, minutes: 15 },
      { subject: 'quant', count: 25, minutes: 15 },
      { subject: 'english', count: 25, minutes: 15 },
    ],
    marks: 2, negative: 0.5,
    note: '100 questions · 200 marks · 60 min · 15 min per section · −0.50 per wrong answer.',
  },
  mains: {
    id: 'mains', name: 'Tier 2 Paper 1 (Mains)', short: 'Tier 2',
    sections: [
      { subject: 'quant', count: 30, minutes: 30, label: 'Section I · Mathematical Abilities' },
      { subject: 'reasoning', count: 30, minutes: 30, label: 'Section I · Reasoning & General Intelligence' },
      { subject: 'english', count: 45, minutes: 40, label: 'Section II · English Language & Comprehension' },
      { subject: 'ga', count: 25, minutes: 20, label: 'Section II · General Awareness' },
      { subject: 'computer', count: 20, minutes: 15, label: 'Section III · Computer Knowledge (qualifying)', qualifying: true },
    ],
    marks: 3, negative: 1,
    note: '150 questions · sectional timing · +3 / −1. Computer Knowledge is qualifying. DEST not included.',
  },
  stats: {
    id: 'stats', name: 'Tier 2 Paper 2 (Statistics)', short: 'Paper 2',
    sections: [{ subject: 'statistics', count: 100, minutes: 120, label: 'Paper 2: Statistics (JSO)' }],
    marks: 2, negative: 0.5,
    note: '100 questions · 200 marks · 2 hours · −0.50 per wrong answer. JSO / SI Gr. II only.',
  },
};

export interface Subject { id: SubjectId; name: string; short: string; mainsOnly?: boolean; paper2?: boolean }
export const SUBJECTS: Record<SubjectId, Subject> = {
  quant: { id: 'quant', name: 'Quantitative Aptitude', short: 'Quant' },
  reasoning: { id: 'reasoning', name: 'General Intelligence & Reasoning', short: 'Reasoning' },
  english: { id: 'english', name: 'English Comprehension', short: 'English' },
  ga: { id: 'ga', name: 'General Awareness', short: 'GA' },
  computer: { id: 'computer', name: 'Computer Knowledge', short: 'Computer', mainsOnly: true },
  statistics: { id: 'statistics', name: 'Statistics (Paper 2)', short: 'Statistics', mainsOnly: true, paper2: true },
};
export const SUBJECT_ORDER: SubjectId[] = ['quant', 'reasoning', 'english', 'ga', 'computer', 'statistics'];

export type Range = [number, number];
export interface Topic { id: string; subject: SubjectId; section: string; name: string; pre: Range; mains: Range; stats: Range }
const T = (id: string, subject: SubjectId, section: string, name: string, pre: Range, mains: Range, stats: Range = [0, 0]): Topic =>
  ({ id, subject, section, name, pre, mains, stats });

export const TOPICS: Topic[] = [
  T('q-number-system', 'quant', 'Arithmetic', 'Number System', [1, 2], [2, 3]),
  T('q-hcf-lcm', 'quant', 'Arithmetic', 'HCF & LCM', [0, 1], [0, 1]),
  T('q-simplification', 'quant', 'Arithmetic', 'Simplification, Surds & Indices', [1, 2], [1, 2]),
  T('q-percentage', 'quant', 'Arithmetic', 'Percentage', [1, 2], [1, 3]),
  T('q-profit-loss', 'quant', 'Arithmetic', 'Profit, Loss & Discount', [1, 3], [2, 3]),
  T('q-si-ci', 'quant', 'Arithmetic', 'Simple & Compound Interest', [1, 2], [1, 2]),
  T('q-ratio', 'quant', 'Arithmetic', 'Ratio, Proportion & Partnership', [1, 2], [1, 2]),
  T('q-mixture', 'quant', 'Arithmetic', 'Mixture & Alligation', [0, 1], [0, 2]),
  T('q-average', 'quant', 'Arithmetic', 'Average', [1, 1], [1, 2]),
  T('q-time-work', 'quant', 'Arithmetic', 'Time & Work, Pipes & Cisterns', [1, 2], [1, 2]),
  T('q-tsd', 'quant', 'Arithmetic', 'Time, Speed & Distance', [1, 2], [1, 2]),
  T('q-algebra', 'quant', 'Advanced Maths', 'Algebra', [2, 3], [2, 4]),
  T('q-geometry', 'quant', 'Advanced Maths', 'Geometry', [2, 4], [3, 5]),
  T('q-mensuration', 'quant', 'Advanced Maths', 'Mensuration (2D & 3D)', [2, 3], [2, 4]),
  T('q-trigonometry', 'quant', 'Advanced Maths', 'Trigonometry, Heights & Distances', [2, 3], [2, 4]),
  T('q-coordinate', 'quant', 'Advanced Maths', 'Coordinate Geometry', [0, 1], [1, 1]),
  T('q-di', 'quant', 'Data & Statistics', 'Data Interpretation', [2, 4], [3, 5]),
  T('q-statistics', 'quant', 'Data & Statistics', 'Statistics (Mean, Median, Mode)', [0, 1], [1, 2]),
  T('q-probability', 'quant', 'Data & Statistics', 'Probability', [0, 0], [0, 1]),

  T('r-analogy', 'reasoning', 'Verbal Reasoning', 'Analogy', [2, 3], [2, 3]),
  T('r-classification', 'reasoning', 'Verbal Reasoning', 'Classification (Odd One Out)', [2, 3], [2, 3]),
  T('r-series', 'reasoning', 'Verbal Reasoning', 'Number & Alphanumeric Series', [2, 3], [2, 4]),
  T('r-coding', 'reasoning', 'Verbal Reasoning', 'Coding-Decoding', [2, 3], [2, 3]),
  T('r-math-ops', 'reasoning', 'Verbal Reasoning', 'Mathematical Operations & Missing Number', [2, 3], [2, 3]),
  T('r-word-order', 'reasoning', 'Verbal Reasoning', 'Dictionary Order & Word Formation', [1, 1], [0, 1]),
  T('r-matching', 'reasoning', 'Verbal Reasoning', 'Indexing, Address & Date Matching', [0, 1], [0, 1]),
  T('r-blood-relations', 'reasoning', 'Logical Reasoning', 'Blood Relations', [1, 1], [1, 2]),
  T('r-direction', 'reasoning', 'Logical Reasoning', 'Direction & Distance', [0, 1], [1, 1]),
  T('r-order-ranking', 'reasoning', 'Logical Reasoning', 'Order & Ranking', [0, 1], [0, 1]),
  T('r-seating', 'reasoning', 'Logical Reasoning', 'Seating Arrangement & Puzzles', [1, 2], [1, 3]),
  T('r-syllogism', 'reasoning', 'Logical Reasoning', 'Syllogism', [1, 1], [1, 2]),
  T('r-venn', 'reasoning', 'Logical Reasoning', 'Venn Diagrams', [1, 1], [1, 1]),
  T('r-statement', 'reasoning', 'Logical Reasoning', 'Statement & Conclusion / Assumption', [0, 1], [1, 2]),
  T('r-calendar-clock', 'reasoning', 'Logical Reasoning', 'Calendar & Clock', [0, 1], [0, 1]),
  T('r-intelligence', 'reasoning', 'Logical Reasoning', 'Critical Thinking, Emotional & Social Intelligence', [0, 1], [1, 1]),
  T('r-dice', 'reasoning', 'Non-Verbal Reasoning', 'Dice & Cubes', [0, 1], [1, 1]),
  T('r-nonverbal', 'reasoning', 'Non-Verbal Reasoning', 'Figure Counting, Mirror & Water Image, Paper Folding', [1, 2], [1, 2]),
  T('r-figural', 'reasoning', 'Non-Verbal Reasoning', 'Figural Series, Analogy & Embedded Figures', [1, 2], [1, 2]),

  T('e-rc', 'english', 'Comprehension', 'Reading Comprehension', [0, 5], [10, 15]),
  T('e-cloze', 'english', 'Comprehension', 'Cloze Test', [5, 5], [5, 7]),
  T('e-error', 'english', 'Grammar', 'Error Spotting', [2, 3], [3, 4]),
  T('e-fillers', 'english', 'Grammar', 'Fill in the Blanks', [2, 3], [3, 4]),
  T('e-improvement', 'english', 'Grammar', 'Sentence Improvement', [1, 2], [2, 3]),
  T('e-voice', 'english', 'Grammar', 'Active & Passive Voice', [0, 2], [2, 3]),
  T('e-narration', 'english', 'Grammar', 'Direct & Indirect Speech', [0, 2], [2, 3]),
  T('e-parajumbles', 'english', 'Grammar', 'Sentence Rearrangement', [1, 2], [2, 3]),
  T('e-synonyms', 'english', 'Vocabulary', 'Synonyms', [1, 2], [2, 3]),
  T('e-antonyms', 'english', 'Vocabulary', 'Antonyms', [1, 2], [2, 3]),
  T('e-idioms', 'english', 'Vocabulary', 'Idioms & Phrases', [1, 2], [2, 3]),
  T('e-oneword', 'english', 'Vocabulary', 'One Word Substitution', [1, 2], [2, 3]),
  T('e-spelling', 'english', 'Vocabulary', 'Spelling Correction', [1, 2], [1, 3]),

  T('g-history', 'ga', 'Static GK', 'History', [3, 4], [3, 4]),
  T('g-culture', 'ga', 'Static GK', 'Art & Culture', [1, 2], [1, 2]),
  T('g-polity', 'ga', 'Static GK', 'Indian Polity & Constitution', [2, 3], [2, 3]),
  T('g-geography', 'ga', 'Static GK', 'Geography (India & World)', [2, 3], [2, 3]),
  T('g-economy', 'ga', 'Static GK', 'Indian Economy', [1, 2], [1, 2]),
  T('g-static', 'ga', 'Static GK', 'Static GK (Sports, Awards, Books, Days)', [2, 3], [2, 3]),
  T('g-physics', 'ga', 'General Science', 'Physics', [1, 2], [1, 2]),
  T('g-chemistry', 'ga', 'General Science', 'Chemistry', [1, 2], [1, 2]),
  T('g-biology', 'ga', 'General Science', 'Biology', [2, 3], [2, 3]),
  T('g-environment', 'ga', 'General Science', 'Environment & Ecology', [1, 1], [1, 1]),
  T('g-scitech', 'ga', 'General Science', 'Science & Technology', [1, 2], [1, 2]),
  T('g-current', 'ga', 'Current Affairs', 'Current Affairs', [2, 4], [2, 4]),

  T('c-fundamentals', 'computer', 'Computer Knowledge', 'Fundamentals, Hardware & Memory', [0, 0], [4, 6]),
  T('c-software', 'computer', 'Computer Knowledge', 'Software & Operating Systems', [0, 0], [2, 4]),
  T('c-office', 'computer', 'Computer Knowledge', 'MS Office', [0, 0], [4, 6]),
  T('c-internet', 'computer', 'Computer Knowledge', 'Internet, Email & Networking', [0, 0], [4, 5]),
  T('c-security', 'computer', 'Computer Knowledge', 'Computer Security', [0, 0], [2, 3]),

  T('st-data', 'statistics', 'Descriptive Statistics', 'Collection, Classification & Presentation of Data', [0, 0], [0, 0], [6, 10]),
  T('st-central', 'statistics', 'Descriptive Statistics', 'Measures of Central Tendency', [0, 0], [0, 0], [8, 12]),
  T('st-dispersion', 'statistics', 'Descriptive Statistics', 'Measures of Dispersion', [0, 0], [0, 0], [8, 12]),
  T('st-moments', 'statistics', 'Descriptive Statistics', 'Moments, Skewness & Kurtosis', [0, 0], [0, 0], [6, 10]),
  T('st-correlation', 'statistics', 'Descriptive Statistics', 'Correlation & Regression', [0, 0], [0, 0], [8, 12]),
  T('st-probability', 'statistics', 'Probability', 'Probability Theory', [0, 0], [0, 0], [8, 12]),
  T('st-random', 'statistics', 'Probability', 'Random Variables & Distributions', [0, 0], [0, 0], [8, 12]),
  T('st-sampling', 'statistics', 'Inference', 'Sampling Theory', [0, 0], [0, 0], [6, 10]),
  T('st-inference', 'statistics', 'Inference', 'Estimation & Hypothesis Testing', [0, 0], [0, 0], [6, 10]),
  T('st-anova', 'statistics', 'Inference', 'Analysis of Variance', [0, 0], [0, 0], [4, 8]),
  T('st-timeseries', 'statistics', 'Applied Statistics', 'Time Series Analysis', [0, 0], [0, 0], [6, 10]),
  T('st-index', 'statistics', 'Applied Statistics', 'Index Numbers', [0, 0], [0, 0], [6, 10]),
];

export const TOPIC_MAP: Record<string, Topic> = Object.fromEntries(TOPICS.map((t) => [t.id, t]));
export const topicsOf = (s: SubjectId) => TOPICS.filter((t) => t.subject === s);

export function sectionsOf(s: SubjectId): { name: string; topics: Topic[] }[] {
  const out: { name: string; topics: Topic[] }[] = [];
  for (const t of topicsOf(s)) {
    let sec = out.find((x) => x.name === t.section);
    if (!sec) out.push((sec = { name: t.section, topics: [] }));
    sec.topics.push(t);
  }
  return out;
}

const avg = (r: Range) => (r[0] + r[1]) / 2;
const MAINS_SIZE: Record<SubjectId, number> = { quant: 30, reasoning: 30, english: 45, ga: 25, computer: 20, statistics: 100 };
export type Priority = 'high' | 'medium' | 'low';
export function topicPriority(t: Topic): Priority {
  const s = Math.max(avg(t.pre) / 25, avg(t.mains) / MAINS_SIZE[t.subject], avg(t.stats) / 100);
  return s >= 0.09 ? 'high' : s >= 0.045 ? 'medium' : 'low';
}

export const LEVELS = [
  { id: 1 as const, name: 'Beginner' },
  { id: 2 as const, name: 'Intermediate' },
  { id: 3 as const, name: 'Advanced' },
];
