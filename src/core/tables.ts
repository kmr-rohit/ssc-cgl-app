// Reference tables computed in code (correct by construction).
import { gcd } from './rng';

export const squares = (from = 1, to = 50) => Array.from({ length: to - from + 1 }, (_, i) => ({ n: from + i, v: (from + i) ** 2 }));
export const cubes = (from = 1, to = 25) => Array.from({ length: to - from + 1 }, (_, i) => ({ n: from + i, v: (from + i) ** 3 }));
export const multiplication = (from = 11, to = 20) =>
  Array.from({ length: to - from + 1 }, (_, i) => ({ n: from + i, row: Array.from({ length: 10 }, (_, k) => (from + i) * (k + 1)) }));

const pctText = (num: number, den: number) => {
  const whole = Math.floor((100 * num) / den);
  const rem = (100 * num) % den;
  if (!rem) return `${whole}%`;
  const g = gcd(rem, den);
  return `${whole} ${rem / g}/${den / g}%`;
};
/** 1/n and a few common fractions as percentages, exact (mixed-number form). */
export const fractionPercent = () => {
  const rows: { frac: string; pct: string; dec: string }[] = [];
  for (let n = 2; n <= 20; n++) rows.push({ frac: `1/${n}`, pct: pctText(1, n), dec: String(Math.round((1 / n) * 10000) / 10000) });
  for (const [a, b] of [[2, 3], [3, 4], [2, 5], [3, 5], [4, 5], [3, 8], [5, 8], [7, 8], [5, 6], [2, 7], [3, 7]])
    rows.push({ frac: `${a}/${b}`, pct: pctText(a, b), dec: String(Math.round((a / b) * 10000) / 10000) });
  return rows;
};

export const powersOf2 = () => Array.from({ length: 12 }, (_, i) => ({ n: i + 1, v: 2 ** (i + 1) }));

/** sin/cos/tan for standard angles as display strings. */
export const trigTable = [
  { f: 'sin', v: ['0', '1/2', '1/√2', '√3/2', '1'] },
  { f: 'cos', v: ['1', '√3/2', '1/√2', '1/2', '0'] },
  { f: 'tan', v: ['0', '1/√3', '1', '√3', 'not defined'] },
  { f: 'cot', v: ['not defined', '√3', '1', '1/√3', '0'] },
  { f: 'sec', v: ['1', '2/√3', '√2', '2', 'not defined'] },
  { f: 'cosec', v: ['not defined', '2', '√2', '2/√3', '1'] },
];
export const TRIG_ANGLES = ['0°', '30°', '45°', '60°', '90°'];

/** Letter positions A=1 … Z=26 with reverse (Z=1) — reasoning coding. */
export const alphabet = () => Array.from({ length: 26 }, (_, i) => ({ l: String.fromCharCode(65 + i), pos: i + 1, rev: 26 - i }));
