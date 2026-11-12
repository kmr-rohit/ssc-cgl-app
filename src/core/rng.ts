// Seeded randomness shared by generators and mock building. Deterministic: same seed → same sequence.

export function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export class Rng {
  private s: number;
  constructor(seed: string | number) {
    this.s = (typeof seed === 'string' ? hashStr(seed) : seed >>> 0) || 1;
  }
  /** float in [0, 1) — mulberry32 */
  next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  /** integer in [a, b] inclusive */
  int(a: number, b: number): number {
    return a + Math.floor(this.next() * (b - a + 1));
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  shuffle<T>(arr: readonly T[]): T[] {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  sample<T>(arr: readonly T[], n: number): T[] {
    return this.shuffle(arr).slice(0, n);
  }
  byLevel<T>(level: 1 | 2 | 3, l1: readonly T[], l2: readonly T[], l3: readonly T[]): T {
    return this.pick(level === 1 ? l1 : level === 2 ? l2 : l3);
  }
}

export const gcd = (a: number, b: number): number => {
  a = Math.abs(a); b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
};
export const lcm = (a: number, b: number): number => (a / gcd(a, b)) * b;

/**
 * Build 4 unique options with the correct one at a random index.
 * `distractors` may contain duplicates or the answer; they are filtered. Falls back to `fallback(i)` to fill.
 * Returns { options, answer }.
 */
export function mcq(
  rng: Rng,
  correct: string | number,
  distractors: (string | number)[],
  fallback: (i: number) => string | number,
): { options: string[]; answer: number } {
  const c = String(correct);
  const seen = new Set([c]);
  const wrong: string[] = [];
  for (const d of rng.shuffle(distractors)) {
    const s = String(d);
    if (!seen.has(s) && s !== 'NaN' && s !== 'undefined' && s !== 'Infinity') { seen.add(s); wrong.push(s); }
    if (wrong.length === 3) break;
  }
  for (let i = 1; wrong.length < 3 && i < 1000; i++) {
    const s = String(fallback(i));
    if (!seen.has(s)) { seen.add(s); wrong.push(s); }
  }
  const options = rng.shuffle([c, ...wrong]);
  return { options, answer: options.indexOf(c) };
}

/** Round to at most `d` decimals and drop trailing zeros. */
export const fmt = (x: number, d = 2): string => String(Math.round(x * 10 ** d) / 10 ** d);
