import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rng';
import { TOPIC_MAP } from '../core/syllabus';
import type { Generator } from '../core/types';
import { GENERATORS, GEN_VERSION, generateQuestion, generatorsFor, questionFromId, typesFor } from './index';
import { DAYS, MONTHS } from './reasoning';

const SEEDS = 300;
const BAD = /NaN|undefined|Infinity|null|\[object/;
const answerText = (q: { options: string[]; answer: number }) => q.options[q.answer];
const find = (topic: string, type: string) => GENERATORS.find((g) => g.topic === topic && g.type === type)!;

function* all(gen: Generator, n = SEEDS) {
  for (const level of gen.levels) for (let s = 0; s < n; s++) yield { level, seed: `s${s}`, q: generateQuestion(gen, `s${s}`, level) };
}

describe('registry', () => {
  it('has enough generators', () => {
    expect(GEN_VERSION).toBe(1);
    expect(GENERATORS.filter((g) => g.topic.startsWith('q-')).length).toBeGreaterThanOrEqual(30);
    expect(GENERATORS.filter((g) => g.topic.startsWith('r-')).length).toBeGreaterThanOrEqual(15);
  });
  it('topics exist, types are kebab-case and unique per topic', () => {
    const seen = new Set<string>();
    for (const g of GENERATORS) {
      expect(TOPIC_MAP[g.topic], g.topic).toBeTruthy();
      expect(g.type).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      const k = `${g.topic}:${g.type}`;
      expect(seen.has(k), k).toBe(false);
      seen.add(k);
      expect(g.levels.length).toBeGreaterThan(0);
    }
  });
  it('generatorsFor / typesFor / questionFromId', () => {
    expect(generatorsFor('q-percentage').length).toBeGreaterThan(1);
    expect(typesFor('q-percentage')).toContain('successive-change');
    const q = generateQuestion(find('q-si-ci', 'ci-two-years'), 'abc', 2);
    expect(q.id).toBe('gen:q-si-ci:ci-two-years:2:abc');
    expect(q.rev).toBe(1);
    expect(q.source).toBe('generated');
    expect(questionFromId(q.id)).toEqual(q);
    expect(questionFromId('gen:nope:x:1:a')).toBeUndefined();
  });
});

describe.each(GENERATORS.map((g) => [`${g.topic}/${g.type}`, g] as const))('%s', (_name, gen) => {
  it(`valid MCQs for ${SEEDS} seeds × each level, deterministic`, () => {
    for (const { level, seed, q } of all(gen)) {
      const ctx = `${q.id}`;
      expect(q.options.length, ctx).toBe(4);
      expect(new Set(q.options).size, ctx + ' ' + q.options.join(' | ')).toBe(4);
      expect(Number.isInteger(q.answer) && q.answer >= 0 && q.answer <= 3, ctx).toBe(true);
      for (const o of q.options) {
        expect(o.trim().length, ctx).toBeGreaterThan(0);
        expect(BAD.test(o), `${ctx} option "${o}"`).toBe(false);
      }
      expect(q.q.trim().length).toBeGreaterThan(0);
      expect(q.solution.trim().length).toBeGreaterThan(0);
      expect(BAD.test(q.q), `${ctx} q: ${q.q}`).toBe(false);
      expect(BAD.test(q.solution), `${ctx} sol: ${q.solution}`).toBe(false);
      expect(q.level).toBe(level);
      const again = generateQuestion(gen, seed, level);
      expect(again).toEqual(q);
    }
  });
});

// ----------------------------------------------------------- independent re-computation
const bmodpow = (b: bigint, e: bigint, m: bigint) => {
  let r = 1n;
  b %= m;
  while (e > 0n) { if (e & 1n) r = (r * b) % m; b = (b * b) % m; e >>= 1n; }
  return r;
};

describe('independent answer checks', () => {
  it('unit digit', () => {
    for (const { q } of all(find('q-number-system', 'unit-digit'), 100)) {
      const pw = [...q.q.matchAll(/(\d+)<sup>(\d+)<\/sup>/g)].map((m) => bmodpow(BigInt(m[1]), BigInt(m[2]), 10n));
      expect(pw.length).toBeGreaterThan(0);
      const ud = pw.reduce((a, b) => (a * b) % 10n, 1n);
      expect(answerText(q), q.id).toBe(String(ud));
    }
  });
  it('remainder of a power', () => {
    for (const { q } of all(find('q-number-system', 'remainder-power'), 100)) {
      const m = /(\d+)<sup>(\d+)<\/sup> is divided by (\d+)/.exec(q.q)!;
      expect(answerText(q)).toBe(String(bmodpow(BigInt(m[1]), BigInt(m[2]), BigInt(m[3]))));
    }
  });
  it('trailing zeros (via BigInt factorial)', () => {
    for (const { q } of all(find('q-number-system', 'trailing-zeros'), 20)) {
      const n = Number(/(\d+)!/.exec(q.q)![1]);
      let f = 1n;
      for (let i = 2n; i <= BigInt(n); i++) f *= i;
      const zeros = f.toString().length - f.toString().replace(/0+$/, '').length;
      expect(answerText(q)).toBe(String(zeros));
    }
  });
  it('clock angle', () => {
    for (const { q } of all(find('r-calendar-clock', 'clock-angle'), 100)) {
      const [, h, m] = /(\d{1,2}):(\d{2})/.exec(q.q)!.map(Number);
      // independent: hour hand degrees from 12, minute hand degrees from 12
      const hh = ((h % 12) * 60 + m) * 0.5, mm = m * 6;
      let d = Math.abs(hh - mm) % 360;
      if (d > 180) d = 360 - d;
      expect(answerText(q), q.q).toBe(`${Math.round(d * 100) / 100}°`);
    }
  });
  it('calendar day', () => {
    const re = new RegExp(`(\\d{1,2}) (${MONTHS.join('|')}) (\\d{4})`, 'g');
    for (const { q } of all(find('r-calendar-clock', 'calendar-day'), 100)) {
      const ms = [...q.q.matchAll(re)];
      const last = ms[ms.length - 1];
      const dt = new Date(`${last[3]}-${String(MONTHS.indexOf(last[2]) + 1).padStart(2, '0')}-${last[1].padStart(2, '0')}T12:00:00Z`);
      expect(answerText(q), q.q).toBe(DAYS[dt.getUTCDay()]);
    }
  });
  it('distance between points', () => {
    for (const { q } of all(find('q-coordinate', 'distance'), 50)) {
      const p = [...q.q.matchAll(/\((-?\d+), (-?\d+)\)/g)].map((m) => [Number(m[1]), Number(m[2])]);
      expect(answerText(q)).toBe(`${Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1])} units`);
    }
  });
  it('triangle count (brute force on the SVG)', () => {
    for (const { q } of all(find('r-nonverbal', 'triangle-count'), 30)) {
      const segs = [...q.q.matchAll(/<line x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)"\/>/g)].map((m) => m.slice(1, 5).map(Number));
      expect(answerText(q), q.id).toBe(String(bruteTriangles(segs)));
    }
  });
  it('rng sanity', () => {
    expect(new Rng('x').next()).toBe(new Rng('x').next());
  });
});

function bruteTriangles(segs: number[][]): number {
  const EPS = 1e-6;
  const pts: [number, number][] = [];
  const addPt = (x: number, y: number) => { if (!pts.some((p) => Math.abs(p[0] - x) < 0.05 && Math.abs(p[1] - y) < 0.05)) pts.push([x, y]); };
  for (const s of segs) { addPt(s[0], s[1]); addPt(s[2], s[3]); }
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
    const [x1, y1, x2, y2] = segs[i], [x3, y3, x4, y4] = segs[j];
    const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(den) < EPS) continue;
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / den;
    if (t > -EPS && t < 1 + EPS && u > -EPS && u < 1 + EPS) addPt(x1 + t * (x2 - x1), y1 + t * (y2 - y1));
  }
  const onSeg = (p: [number, number], s: number[]) => {
    const [x1, y1, x2, y2] = s;
    const cross = (x2 - x1) * (p[1] - y1) - (y2 - y1) * (p[0] - x1);
    if (Math.abs(cross) > 1e-2 * Math.hypot(x2 - x1, y2 - y1)) return false;
    return p[0] >= Math.min(x1, x2) - 1e-3 && p[0] <= Math.max(x1, x2) + 1e-3 && p[1] >= Math.min(y1, y2) - 1e-3 && p[1] <= Math.max(y1, y2) + 1e-3;
  };
  const joined = (a: [number, number], b: [number, number]) => segs.some((s) => onSeg(a, s) && onSeg(b, s));
  let n = 0;
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) for (let k = j + 1; k < pts.length; k++) {
    const [a, b, c] = [pts[i], pts[j], pts[k]];
    const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (Math.abs(area) < 1) continue;
    if (joined(a, b) && joined(b, c) && joined(a, c)) n++;
  }
  return n;
}

