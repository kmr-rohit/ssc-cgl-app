import { describe, expect, it, vi } from 'vitest';

// the views' pure helpers, without the DOM-bound modules around them (tests run in node)
vi.mock('../ui/html', () => ({ pct: (x: number) => `${Math.round(x * 100)}%`, fmtMs: () => '', rich: (x: string) => x, img: () => null, niceDate: (x: string) => x }));
vi.mock('../ui/components', () => ({}));
vi.mock('../app/state', () => ({ app: {} }));
vi.mock('../app/router', () => ({}));
const QS: Record<string, object> = {
  q1: { id: 'q1', q: 'See <div class="fig"><img src="/pyq/img/a.png" alt=""></div>', options: ['1', '<img src="/pyq/img/b.png">', '3', '4'], solution: 'x', img: 'fig/c.svg', optionImgs: undefined },
  q2: { id: 'q2', q: 'plain', options: ['a', 'b', 'c', 'd'], solution: '<img class="x" src="/pyq/img/a.png">', optionImgs: ['o1.png', 'o2.png', 'o3.png', 'o4.png'] },
};
vi.mock('../content/bank', () => ({ lookup: (id: string) => QS[id], passageOf: () => null, assetUrl: (p: string) => `/content/assets/${p}` }));
vi.mock('../data/storage', () => ({}));
import { mockImageUrls, paletteCounts } from './exam';
import type { MockRecord } from '../core/types';
import { accuracyNote, resultSentence } from './practice';
import { frontText } from './revise';

describe('exam palette', () => {
  it('puts every question in exactly one SSC legend group', () => {
    const s = { answers: [0, null, null, 2, null], marked: [false, true, false, true, false], visited: [true, true, true, true, false] };
    const n = paletteCounts(s);
    expect(n).toEqual({ a: 1, m: 1, v: 1, am: 1, '': 1 });
    expect(Object.values(n).reduce((x, y) => x + y, 0)).toBe(5);
  });
});

describe('practice result', () => {
  it('states the result once, in words', () => {
    expect(resultSentence(2, 1, 2)).toBe('2 of 5 right, 1 wrong, 2 skipped');
    expect(resultSentence(5, 0, 0)).toBe('5 of 5 right');
    expect(accuracyNote(2, 1, 2)).toBe('Of the 3 you answered, 67% were right. ');
    expect(accuracyNote(2, 1, 0)).toBe('');
  });
});

describe('flashcards', () => {
  it('words antonym fronts instead of an arrow', () => {
    expect(frontText('Generous ↔ ?')).toBe('The opposite of Generous');
    expect(frontText('Plain card')).toBe('Plain card');
  });
});

describe('mock figures', () => {
  it('lists every image a mock uses, once', () => {
    const m = { sections: [{ questionIds: ['q1', 'q2', 'missing'] }] } as unknown as MockRecord;
    expect(mockImageUrls(m).sort()).toEqual(['/content/assets/fig/c.svg', '/content/assets/o1.png', '/content/assets/o2.png', '/content/assets/o3.png', '/content/assets/o4.png', '/pyq/img/a.png', '/pyq/img/b.png']);
  });
});
