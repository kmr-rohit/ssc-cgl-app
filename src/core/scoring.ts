// Mock scoring, pure functions.
import { EXAMS } from './syllabus';
import type { ExamId, MockScore, MockSectionState, Question } from './types';

export function scoreSections(exam: ExamId, sections: MockSectionState[], lookup: (id: string) => Question | undefined): MockScore {
  const e = EXAMS[exam];
  const out: MockScore = { total: 0, max: 0, sections: [] };
  for (const s of sections) {
    const def = e.sections.find((x) => x.subject === s.subject);
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
    if (!def?.qualifying) { out.total += score; out.max += max; }
  }
  return out;
}

export const accuracy = (correct: number, wrong: number) => (correct + wrong ? correct / (correct + wrong) : 0);
