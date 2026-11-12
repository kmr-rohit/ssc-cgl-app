// Shared helpers for generators. Pure functions only.
import { Rng, mcq, fmt, gcd } from '../core/rng';
import type { GeneratedBody, Generator, Level } from '../core/types';

export const ALL: Level[] = [1, 2, 3];

export function def(
  topic: string,
  type: string,
  name: string,
  make: (r: Rng, L: Level) => GeneratedBody,
  levels: Level[] = ALL,
): Generator {
  return { topic, type, name, levels, make };
}

/** b^e mod m for small m. */
export function modpow(b: number, e: number, m: number): number {
  let r = 1 % m;
  let B = b % m;
  let E = e;
  while (E > 0) {
    if (E % 2 === 1) r = (r * B) % m;
    B = (B * B) % m;
    E = Math.floor(E / 2);
  }
  return r;
}

/** Indian digit grouping for integers, fmt() otherwise. */
export function num(x: number): string {
  if (!Number.isInteger(x)) return fmt(x);
  const neg = x < 0;
  const s = String(Math.abs(x));
  if (s.length <= 3) return (neg ? '−' : '') + s;
  const last = s.slice(-3);
  let rest = s.slice(0, -3);
  const parts: string[] = [];
  while (rest.length > 2) { parts.unshift(rest.slice(-2)); rest = rest.slice(0, -2); }
  if (rest) parts.unshift(rest);
  return (neg ? '−' : '') + parts.join(',') + ',' + last;
}
export const rs = (x: number) => `₹${num(x)}`;
export const signed = (x: number) => (x < 0 ? `− ${Math.abs(x)}` : `+ ${x}`);

/** Exact fraction. */
export class Fr {
  n: number;
  d: number;
  constructor(n: number, d = 1) {
    if (d === 0) throw new Error('zero denominator');
    if (d < 0) { n = -n; d = -d; }
    const g = gcd(n, d) || 1;
    this.n = n / g;
    this.d = d / g;
  }
  static of(x: Fr | number): Fr { return x instanceof Fr ? x : new Fr(x); }
  add(o: Fr | number) { const b = Fr.of(o); return new Fr(this.n * b.d + b.n * this.d, this.d * b.d); }
  sub(o: Fr | number) { const b = Fr.of(o); return new Fr(this.n * b.d - b.n * this.d, this.d * b.d); }
  mul(o: Fr | number) { const b = Fr.of(o); return new Fr(this.n * b.n, this.d * b.d); }
  div(o: Fr | number) { const b = Fr.of(o); return new Fr(this.n * b.d, this.d * b.n); }
  abs() { return new Fr(Math.abs(this.n), this.d); }
  eq(o: Fr | number) { const b = Fr.of(o); return this.n === b.n && this.d === b.d; }
  get value() { return this.n / this.d; }
  get isInt() { return this.d === 1; }
  /** "7/3" */
  toString() { return this.d === 1 ? String(this.n) : `${this.n}/${this.d}`; }
  /** "2 1/3" */
  mixed() {
    if (this.d === 1) return String(this.n);
    const sgn = this.n < 0 ? '−' : '';
    const a = Math.abs(this.n);
    const w = Math.floor(a / this.d);
    const rem = a % this.d;
    return sgn + (w ? `${w} ${rem}/${this.d}` : `${rem}/${this.d}`);
  }
}
export const F = (n: number, d = 1) => new Fr(n, d);

export interface NumOpts {
  f?: (x: number) => string;
  fb?: (i: number) => number;
  step?: number;
  svg?: string;
  /** allow distractors ≤ 0 even though answer is positive */
  allowNonPositive?: boolean;
}

/** Numeric MCQ. Distractors that are non-finite, equal to the answer, or (for positive answers) ≤ 0 are dropped. */
export function numQ(r: Rng, q: string, ans: number, ds: number[], solution: string, o: NumOpts = {}): GeneratedBody {
  const f = o.f ?? ((x: number) => fmt(x));
  const step = o.step ?? 1;
  const ok = (x: number) => Number.isFinite(x) && (o.allowNonPositive || ans <= 0 || x > 0) && (!Number.isInteger(ans) || Number.isInteger(x));
  const fb = o.fb ?? ((i: number) => {
    const k = i % 2 ? (i + 1) / 2 : -i / 2;
    const v = ans + k * step;
    return ok(v) ? v : ans + (i + 3) * step;
  });
  const { options, answer } = mcq(r, f(ans), ds.filter(ok).map(f), (i) => f(fb(i)));
  return { q, options, answer, solution, ...(o.svg ? { svg: o.svg } : {}) };
}

/** String MCQ. */
export function strQ(r: Rng, q: string, ans: string, ds: string[], solution: string, fb: (i: number) => string, svg?: string): GeneratedBody {
  const { options, answer } = mcq(r, ans, ds, fb);
  return { q, options, answer, solution, ...(svg ? { svg } : {}) };
}

/** Fraction MCQ (options shown as mixed or improper fractions). */
export function frQ(r: Rng, q: string, ans: Fr, ds: Fr[], solution: string, show: (x: Fr) => string = (x) => x.toString(), unit = ''): GeneratedBody {
  const s = (x: Fr) => show(x) + unit;
  const fb = (i: number) => {
    const k = i % 2 ? (i + 1) / 2 : -i / 2;
    let c = ans.add(F(k, ans.d));
    if (ans.value > 0 && c.value <= 0) c = ans.add(F(i + 2, ans.d));
    return s(c);
  };
  return strQ(r, q, s(ans), ds.filter((x) => ans.value <= 0 || x.value > 0).map(s), solution, fb);
}

export const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

/** Linear expression "3x − 5". */
export function lin(p: number, q: number, v = 'x'): string {
  const a = p === 1 ? v : p === -1 ? `−${v}` : `${p}${v}`;
  return q === 0 ? a : `${a} ${q < 0 ? '−' : '+'} ${Math.abs(q)}`;
}

export const sup = (b: number | string, e: number | string) => `${b}<sup>${e}</sup>`;

export const C = (n: number, k: number): number => {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return Math.round(r);
};
