// Mock scoring, pure functions.
import { EXAMS } from './syllabus';
import type { ExamId, MockRules, MockScore, MockSectionState, Question } from './types';

/** Qualifying sections are scored but left out of the total. Custom papers (they carry rules) have none. */
export const isQualifying = (exam: ExamId, subject: string, rules?: MockRules) =>
  !rules && !!EXAMS[exam].sections.find((x) => x.subject === subject)?.qualifying;

export function scoreSections(exam: ExamId, sections: MockSectionState[], lookup: (id: string) => Question | undefined, rules?: MockRules): MockScore {
  const e = { ...EXAMS[exam], ...(rules ? { marks: rules.marks, negative: rules.negative } : {}) };
  const out: MockScore = { total: 0, max: 0, sections: [] };
  for (const s of sections) {
    let correct = 0, wrong = 0, skipped = 0;
    s.questionIds.forEach((id, i) => {
      const a = s.answers[i];
      if (a === null || a === undefined) skipped++;
      else if (lookup(id)?.answer === a) correct++;
      else wrong++;
    });
    const score = correct * e.marks - wrong * e.negative;
    const max = s.questionIds.length * e.marks;
    out.sections.push({ subject: s.subject, correct, wrong, skipped, score, max });
    if (!isQualifying(exam, s.subject, rules)) { out.total += score; out.max += max; }
  }
  return out;
}

export const accuracy = (correct: number, wrong: number) => (correct + wrong ? correct / (correct + wrong) : 0);
