import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mapTopic } from './mapping';
import { TOPIC_MAP } from '../src/core/syllabus';
import type { Question } from '../src/core/types';

describe('topic mapping', () => {
  const m = (subject: string, chapter: string, concept = '', question = '') => mapTopic({ subject, chapter, concept, question });
  it('maps chapters and splits broad ones by concept', () => {
    expect(m('MATH', 'mensuration-3d')).toEqual({ topic: 'q-mensuration' });
    expect(m('MATH', 'number-system', 'lcm-of-fractions')).toEqual({ topic: 'q-hcf-lcm' });
    expect(m('REAS', 'non-verbal-reasoning', 'cube-dice-opposite')).toEqual({ topic: 'r-dice' });
    expect(m('REAS', 'puzzle-subtypes-not-to-miss', 'sign-interchange-equation')).toEqual({ topic: 'r-math-ops' });
    expect(m('ENG', 'vocabulary', 'unclassified-x', 'Select the most appropriate ANTONYM of the given word')).toEqual({ topic: 'e-antonyms' });
    expect(m('ENG', 'grammar', 'sentence-conversion-x', 'Select the option that expresses the given sentence in indirect speech')).toEqual({ topic: 'e-narration' });
  });
  it('excludes questions whose passage is missing from the source', () => {
    expect(m('ENG', 'cloze-test').topic).toBeNull();
    expect(m('ENG', 'verbal-ability', 'reading-comprehension-x').topic).toBeNull();
  });
});

// Checks the published bank itself (skips if the pipeline hasn't been run).
const OUT = join(__dirname, '..', 'public', 'pyq');
describe.skipIf(!existsSync(join(OUT, 'manifest.json')))('published bank', () => {
  const manifest = JSON.parse(readFileSync(join(OUT, 'manifest.json'), 'utf8'));
  const all: Question[] = Object.values(manifest.topics as Record<string, { pages: string[] }>)
    .flatMap((t) => t.pages.flatMap((f) => JSON.parse(readFileSync(join(OUT, f), 'utf8')) as Question[]));

  it('has the expected size and only known topics', () => {
    expect(all.length).toBe(manifest.counts.questions);
    expect(all.length).toBeGreaterThan(20000);
    for (const t of Object.keys(manifest.topics)) expect(TOPIC_MAP[t], t).toBeTruthy();
  });

  it('every question is well-formed', () => {
    const ids = new Set<string>();
    for (const q of all) {
      expect(q.id).toMatch(/^pyq:[a-z0-9-]+:[a-f0-9]{24}$/);
      expect(ids.has(q.id)).toBe(false); ids.add(q.id);
      expect(q.options).toHaveLength(4);
      expect(q.answer).toBeGreaterThanOrEqual(0); expect(q.answer).toBeLessThan(4);
      expect(q.solution.length).toBeGreaterThan(5);
      expect(q.source).toBe('pyq');
    }
  });

  it('every referenced image exists and no remote URLs remain', () => {
    const html = all.flatMap((q) => [q.q, q.solution, ...q.options]).join('\n');
    expect(html).not.toMatch(/https?:\/\/(cdn\.repeatermock|ssc\.digialm)/);
    const srcs = new Set([...html.matchAll(/src="(\/pyq\/img\/[a-f0-9]{16}\.webp)"/g)].map((m) => m[1]));
    expect(srcs.size).toBeGreaterThan(1000);
    for (const s of srcs) expect(existsSync(join(OUT, '..', s)), s).toBe(true);
  });

  it('papers reference only published questions', () => {
    const known = new Set(all.map((q) => q.id));
    for (const p of manifest.papers.slice(0, 40)) {
      const paper = JSON.parse(readFileSync(join(OUT, p.file), 'utf8'));
      for (const s of paper.sections) for (const id of s.questionIds) expect(known.has(id), id).toBe(true);
    }
  });
});
