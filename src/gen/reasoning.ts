// Reasoning generators. All answers computed; figures are inline SVG in the `svg` field.
import type { Rng } from '../core/rng';
import { fmt } from '../core/rng';
import type { GeneratedBody, Generator } from '../core/types';
import { def, numQ, strQ, ordinal, C } from './util';

const LET = (i: number) => String.fromCharCode(65 + (((i % 26) + 26) % 26));
const POS = (ch: string) => ch.charCodeAt(0) - 65;

function seriesQ(r: Rng, terms: number[], hide: number, solution: string, ds: number[]): GeneratedBody {
  const ans = terms[hide];
  const shown = terms.map((t, i) => (i === hide ? '?' : String(t))).join(', ');
  return numQ(r, `Find the missing term in the series: ${shown}`, ans, ds, solution, { allowNonPositive: true });
}

const WORDS = ['MOTHER', 'FATHER', 'SISTER', 'GARDEN', 'PENCIL', 'MARKET', 'BRIGHT', 'FLOWER', 'SCHOOL', 'TRAVEL', 'WINTER', 'SUMMER', 'PLANET', 'ORANGE', 'BUTTER',
  'CANDLE', 'DOCTOR', 'BRANCH', 'FOREST', 'SILVER', 'TEMPLE', 'POCKET', 'CLOUDS', 'STREAM', 'BOTTLE', 'MIRROR', 'NATION', 'PARENT', 'COUSIN', 'BREATH',
  'COLD', 'WARM', 'BOOK', 'LAMP', 'RIVER', 'TABLE', 'CHAIR', 'HOUSE', 'PLANT', 'MANGO', 'TIGER', 'EAGLE', 'STONE', 'LIGHT', 'WATER'];

const DICT = ['abandon', 'ability', 'absence', 'academy', 'accept', 'account', 'achieve', 'acquire', 'address', 'advance', 'balance', 'banner', 'barrier', 'battery', 'beacon',
  'benefit', 'border', 'bottle', 'cabinet', 'calcium', 'campus', 'capital', 'captain', 'carbon', 'cascade', 'castle', 'catalog', 'ceiling', 'central', 'channel', 'chapter',
  'charter', 'chimney', 'circle', 'citizen', 'climate', 'cluster', 'compact', 'compare', 'compass', 'compete', 'complex', 'concert', 'conduct', 'confirm', 'connect', 'consent',
  'content', 'control', 'convert', 'courage', 'cradle', 'crystal', 'culture', 'current', 'custom', 'decade', 'decimal', 'declare', 'defence', 'deliver', 'density', 'deposit',
  'desert', 'design', 'destiny', 'develop', 'diamond', 'digital', 'display', 'distant', 'divide', 'dolphin', 'domain', 'eager', 'eagle', 'economy', 'edition', 'educate',
  'element', 'elevate', 'embrace', 'emerald', 'empire', 'enable', 'energy', 'engine', 'enhance', 'episode', 'equator', 'erosion', 'essence', 'exhibit', 'expand', 'export',
  'fabric', 'factory', 'fashion', 'feather', 'festival', 'fiction', 'finance', 'fortune', 'forward', 'fossil', 'freedom', 'gallery', 'garment', 'general', 'genuine', 'glacier',
  'gravity', 'harvest', 'heritage', 'horizon', 'imagine', 'impact', 'import', 'improve', 'include', 'income', 'insight', 'inspire', 'journal', 'journey', 'justice', 'kingdom',
  'kitchen', 'ladder', 'landing', 'lantern', 'lateral', 'leader', 'leather', 'liberty', 'library', 'machine', 'magnet', 'manage', 'mansion', 'margin', 'market', 'marvel',
  'measure', 'medium', 'mention', 'message', 'mineral', 'mission', 'mixture', 'monitor', 'morning', 'motion', 'museum', 'natural', 'network', 'neutral', 'nothing', 'nucleus',
  'number', 'object', 'observe', 'obtain', 'opinion', 'orbit', 'organic', 'outline', 'package', 'painter', 'parade', 'partner', 'passage', 'patient', 'pattern', 'perfect',
  'permit', 'picture', 'pioneer', 'planet', 'plastic', 'popular', 'portion', 'prepare', 'present', 'prevent', 'primary', 'printer', 'problem', 'process', 'produce', 'product',
  'program', 'project', 'promise', 'protect', 'provide', 'quality', 'quarter', 'radical', 'railway', 'rainbow', 'reflect', 'reform', 'region', 'release', 'remain', 'replace',
  'request', 'reserve', 'resolve', 'respect', 'restore', 'revenue', 'reverse', 'routine', 'sample', 'scatter', 'scholar', 'science', 'section', 'segment', 'service', 'session',
  'shelter', 'silence', 'similar', 'society', 'soldier', 'station', 'storage', 'stomach', 'strange', 'student', 'subject', 'success', 'summary', 'support', 'surface', 'system',
  'teacher', 'texture', 'theatre', 'thunder', 'tourist', 'traffic', 'transit', 'trouble', 'uniform', 'unique', 'utility', 'vacancy', 'variety', 'vehicle', 'venture', 'version',
  'village', 'vintage', 'virtue', 'volcano', 'weather', 'welfare', 'western', 'witness', 'wonder', 'yellow', 'zenith'];
const PREFIX2 = [...new Set(DICT.map((w) => w.slice(0, 2)))].filter((p) => DICT.filter((w) => w.startsWith(p)).length >= 5);
const PREFIX1 = [...new Set(DICT.map((w) => w[0]))].filter((p) => DICT.filter((w) => w.startsWith(p)).length >= 5);

export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const MDAYS = (y: number) => [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const dow = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d)).getUTCDay();

const isPrime = (n: number) => { if (n < 2) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; };

/** Evaluate with BODMAS; returns null if a division is not exact. ops are real operators. */
function evalBodmas(nums: number[], ops: string[]): number | null {
  const terms = [nums[0]];
  const add: string[] = [];
  for (let i = 0; i < ops.length; i++) {
    const o = ops[i], v = nums[i + 1];
    const last = terms.length - 1;
    if (o === '×') terms[last] *= v;
    else if (o === '÷') { if (v === 0 || terms[last] % v !== 0) return null; terms[last] /= v; }
    else { add.push(o); terms.push(v); }
  }
  let res = terms[0];
  for (let i = 0; i < add.length; i++) res = add[i] === '+' ? res + terms[i + 1] : res - terms[i + 1];
  return res;
}
function evalLeft(nums: number[], ops: string[]): number | null {
  let v = nums[0];
  for (let i = 0; i < ops.length; i++) {
    const n = nums[i + 1];
    if (ops[i] === '+') v += n; else if (ops[i] === '−') v -= n; else if (ops[i] === '×') v *= n;
    else { if (v % n !== 0) return null; v /= n; }
  }
  return v;
}

const DIRV: Record<string, [number, number]> = { North: [0, 1], East: [1, 0], South: [0, -1], West: [-1, 0] };
const DIR4 = ['North', 'East', 'South', 'West'];
const DIR8 = ['North', 'South', 'East', 'West', 'North-East', 'North-West', 'South-East', 'South-West'];

function pathSvg(pts: [number, number][]): string {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const span = Math.max(maxX - minX, maxY - minY, 1);
  const S = 180 / span, pad = 30;
  const P = ([x, y]: [number, number]) => [pad + (x - minX) * S, pad + (maxY - y) * S].map((v) => Math.round(v * 10) / 10) as [number, number];
  const sp = pts.map(P);
  const W = Math.round(pad * 2 + (maxX - minX) * S + 30), H = Math.round(pad * 2 + (maxY - minY) * S);
  const [sx, sy] = sp[0], [ex, ey] = sp[sp.length - 1];
  return `<svg class="figure" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Path walked" fill="none" stroke="currentColor" stroke-width="2">`
    + `<polyline points="${sp.map((p) => p.join(',')).join(' ')}" stroke-dasharray="6 4"/>`
    + `<circle cx="${sx}" cy="${sy}" r="4" fill="currentColor"/><text x="${sx + 6}" y="${sy - 6}" fill="currentColor" stroke="none" font-size="13">A</text>`
    + `<circle cx="${ex}" cy="${ey}" r="4"/><text x="${ex + 6}" y="${ey - 6}" fill="currentColor" stroke="none" font-size="13">B</text>`
    + `<line x1="${W - 14}" y1="26" x2="${W - 14}" y2="6"/><polyline points="${W - 18},12 ${W - 14},6 ${W - 10},12"/><text x="${W - 18}" y="40" fill="currentColor" stroke="none" font-size="11">N</text>`
    + `</svg>`;
}

/** Fan triangle with p interior rays from the apex and q horizontal cross-lines. Count = C(p+2, 2) × (q+1). */
export function triangleFigure(p: number, q: number): { svg: string; count: number } {
  const A = [130, 15], B = [15, 205], Cc = [245, 205];
  const L = (x1: number, y1: number, x2: number, y2: number) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  let lines = L(A[0], A[1], B[0], B[1]) + L(A[0], A[1], Cc[0], Cc[1]) + L(B[0], B[1], Cc[0], Cc[1]);
  for (let i = 1; i <= p; i++) { const x = B[0] + ((Cc[0] - B[0]) * i) / (p + 1); lines += L(A[0], A[1], Math.round(x * 100) / 100, B[1]); }
  for (let j = 1; j <= q; j++) {
    const t = j / (q + 1);
    const y = A[1] + (B[1] - A[1]) * t, xl = A[0] + (B[0] - A[0]) * t, xr = A[0] + (Cc[0] - A[0]) * t;
    const R = (v: number) => Math.round(v * 100) / 100;
    lines += L(R(xl), R(y), R(xr), R(y));
  }
  const svg = `<svg class="figure" viewBox="0 0 260 220" width="260" height="220" role="img" aria-label="Triangle figure" fill="none" stroke="currentColor" stroke-width="2">${lines}</svg>`;
  return { svg, count: C(p + 2, 2) * (q + 1) };
}

export const REASONING_GENERATORS: Generator[] = [
  // ------------------------------------------------------------ Series
  def('r-series', 'series-ap', 'Number series: arithmetic progression', (r, L) => {
    const a = L === 3 ? r.int(100, 400) : r.int(2, 50);
    const d = (L === 1 ? r.int(2, 9) : L === 2 ? r.int(6, 15) : r.int(11, 29)) * (L >= 2 && r.chance(0.4) ? -1 : 1);
    const terms = Array.from({ length: 6 }, (_, i) => a + i * d);
    const hide = L === 1 ? 5 : r.int(1, 5);
    return seriesQ(r, terms, hide, `Constant difference of ${d > 0 ? '+' : '−'}${Math.abs(d)} between consecutive terms.<br>Missing term = <b>${terms[hide]}</b>.`,
      [terms[hide] + d, terms[hide] - 1, terms[hide] + 1, terms[hide] + 2 * d, terms[hide] - d + 2]);
  }),
  def('r-series', 'series-gp', 'Number series: multiply / multiply-and-add', (r, L) => {
    if (L === 1) {
      const a = r.int(1, 5), k = r.pick([2, 3]);
      const terms = Array.from({ length: 6 }, (_, i) => a * k ** i);
      return seriesQ(r, terms, 5, `Each term is ×${k} the previous one.<br>${terms[4]} × ${k} = <b>${terms[5]}</b>.`, [terms[5] + k, terms[4] * (k + 1), terms[4] + terms[3], terms[5] - a]);
    }
    if (L === 2) {
      const k = r.pick([2, 3]), c = r.pick([-3, -2, -1, 1, 2, 3]);
      const a = r.int(Math.max(1, 1 - c), 9);
      const terms = [a];
      for (let i = 1; i < 6; i++) terms.push(terms[i - 1] * k + c);
      const hide = r.int(3, 5);
      return seriesQ(r, terms, hide, `Pattern: ×${k} then ${c > 0 ? '+' : '−'}${Math.abs(c)}.<br>${terms[hide - 1]} × ${k} ${c > 0 ? '+' : '−'} ${Math.abs(c)} = <b>${terms[hide]}</b>.`,
        [terms[hide - 1] * k, terms[hide - 1] * k - c, terms[hide] + k, terms[hide - 1] * (k + 1)]);
    }
    const a = r.int(1, 6), start = r.int(1, 2);
    const terms = [a];
    for (let i = 0; i < 5; i++) terms.push(terms[i] * (start + i));
    const hide = r.int(3, 5);
    return seriesQ(r, terms, hide, `Multipliers increase by 1: ×${start}, ×${start + 1}, ×${start + 2}, ×${start + 3}, ×${start + 4}.<br>Missing term = ${terms[hide - 1]} × ${start + hide - 1} = <b>${terms[hide]}</b>.`,
      [terms[hide - 1] * (start + hide), terms[hide - 1] * (start + hide - 2), terms[hide] + terms[hide - 1], terms[hide] - a]);
  }),
  def('r-series', 'series-squares', 'Number series: squares & cubes', (r, L) => {
    const n0 = r.int(2, L === 1 ? 9 : 12);
    const kinds: [string, (n: number) => number][] = L === 1
      ? [['n²', (n) => n * n]]
      : L === 2 ? [['n² + 1', (n) => n * n + 1], ['n² − 1', (n) => n * n - 1], ['n³', (n) => n ** 3], ['n² + n', (n) => n * n + n]]
        : [['n³ + 1', (n) => n ** 3 + 1], ['n³ − n', (n) => n ** 3 - n], ['n² + 2n', (n) => n * n + 2 * n], ['(prime)²', (n) => n * n]];
    const [name, f] = r.pick(kinds);
    const base = name === '(prime)²' ? [2, 3, 5, 7, 11, 13, 17, 19, 23].slice(r.int(0, 3), undefined).slice(0, 6) : Array.from({ length: 6 }, (_, i) => n0 + i);
    const terms = base.map(f);
    const hide = L === 1 ? 5 : r.int(2, 5);
    const ans = terms[hide];
    const n = base[hide];
    return seriesQ(r, terms, hide, `Terms follow ${name === '(prime)²' ? 'squares of consecutive primes' : `n ↦ ${name}`} for n = ${base.join(', ')}.<br>n = ${n} → <b>${ans}</b>.`,
      [f(n + 1), f(n - 1), ans + 1, ans - 2, n * n === ans ? ans + 2 * n : n * n]);
  }),
  def('r-series', 'series-mixed-diff', 'Number series: changing differences', (r, L) => {
    const a = r.int(2, 30);
    const terms = [a];
    let how: string;
    if (L === 1) {
      const d0 = r.int(1, 5), s = r.int(1, 3);
      for (let i = 0; i < 5; i++) terms.push(terms[i] + d0 + i * s);
      how = `Differences increase by ${s}: ${terms.slice(1).map((t, i) => `+${t - terms[i]}`).join(', ')}.`;
    } else if (L === 2) {
      const kind = r.pick(['squares', 'primes', 'alt']);
      if (kind === 'squares') { const k = r.int(1, 3); for (let i = 0; i < 5; i++) terms.push(terms[i] + (k + i) ** 2); how = `Differences are consecutive squares: ${terms.slice(1).map((t, i) => `+${t - terms[i]}`).join(', ')}.`; }
      else if (kind === 'primes') { const P = [2, 3, 5, 7, 11, 13, 17]; const k = r.int(0, 2); for (let i = 0; i < 5; i++) terms.push(terms[i] + P[k + i]); how = `Differences are consecutive primes: ${terms.slice(1).map((t, i) => `+${t - terms[i]}`).join(', ')}.`; }
      else { const p = r.int(5, 12), m = r.int(1, p - 2); terms[0] = r.int(10, 40); for (let i = 0; i < 5; i++) terms.push(terms[i] + (i % 2 ? -m : p)); how = `Alternating +${p}, −${m}.`; }
    } else {
      const k = r.pick([2, 3]), c = r.int(1, 6);
      terms[0] = r.int(2, 9);
      for (let i = 0; i < 5; i++) terms.push(i % 2 === 0 ? terms[i] * k : terms[i] + c);
      how = `Alternating operations: ×${k}, +${c}, ×${k}, +${c}, …`;
    }
    const hide = L === 1 ? 5 : r.int(2, 5);
    return seriesQ(r, terms, hide, `${how}<br>Missing term = <b>${terms[hide]}</b>.`,
      [terms[hide] + 1, terms[hide] - 2, terms[hide] + (terms[hide] - terms[hide - 1]), 2 * terms[hide - 1] - terms[hide - 2] || terms[hide] + 3]);
  }),
  def('r-series', 'letter-series', 'Letter series', (r, L) => {
    if (L === 1) {
      const k = r.int(2, 4), s = r.int(0, 25 - 5 * k);
      const t = Array.from({ length: 6 }, (_, i) => LET(s + i * k));
      return strQ(r, `Find the next term: ${t.slice(0, 5).join(', ')}, ?`, t[5], [LET(s + 5 * k + 1), LET(s + 5 * k - 1), LET(s + 6 * k), LET(s + 4 * k + 1)],
        `Each letter moves +${k} (${t.slice(0, 5).map((c) => `${c}=${POS(c) + 1}`).join(', ')}).<br>${t[4]} + ${k} = <b>${t[5]}</b>.`, (i) => LET(s + 5 * k + i + 1));
    }
    if (L === 2) {
      const k1 = r.int(1, 3), k2 = r.int(1, 3), s1 = r.int(0, 8), s2 = r.int(17, 25);
      const term = (i: number) => LET(s1 + i * k1) + LET(s2 - i * k2);
      const t = Array.from({ length: 5 }, (_, i) => term(i));
      return strQ(r, `Find the next term: ${t.slice(0, 4).join(', ')}, ?`, t[4],
        [LET(s1 + 4 * k1) + LET(s2 - 4 * k2 + 1), LET(s1 + 4 * k1 + 1) + LET(s2 - 4 * k2), LET(s2 - 4 * k2) + LET(s1 + 4 * k1), LET(s1 + 3 * k1) + LET(s2 - 4 * k2)],
        `First letters move +${k1}: ${t.map((x) => x[0]).slice(0, 4).join(' ')} → ${t[4][0]}.<br>Second letters move −${k2}: ${t.map((x) => x[1]).slice(0, 4).join(' ')} → ${t[4][1]}.<br>Answer: <b>${t[4]}</b>.`,
        (i) => LET(s1 + 4 * k1 + i) + LET(s2 - 4 * k2 - i));
    }
    const s = r.int(0, 8), inc0 = r.int(1, 2);
    const pos = [s];
    for (let i = 0; i < 5; i++) pos.push(pos[i] + inc0 + i);
    const t = pos.map(LET);
    return strQ(r, `Find the next term: ${t.slice(0, 5).join(', ')}, ?`, t[5], [LET(pos[5] + 1), LET(pos[5] - 1), LET(pos[4] + inc0 + 3), LET(pos[5] + 2)],
      `Gaps increase by 1: ${pos.slice(1).map((p, i) => `+${p - pos[i]}`).join(', ')}.<br>${t[4]} + ${pos[5] - pos[4]} = <b>${t[5]}</b>.`, (i) => LET(pos[5] + i + 2));
  }),
  def('r-series', 'alphanumeric', 'Alphanumeric series', (r, L) => {
    const k1 = r.int(1, 3), k2 = r.int(1, L === 1 ? 3 : 6) * (L === 3 && r.chance(0.5) ? -1 : 1), k3 = r.int(1, 3) * (L >= 2 ? -1 : 1);
    const s1 = r.int(0, 10), n0 = r.int(1, 20) + (k2 < 0 ? 40 : 0), s3 = L >= 2 ? r.int(15, 25) : r.int(2, 12);
    const term = (i: number, dl = 0, dn = 0, dr = 0) => `${LET(s1 + i * k1 + dl)}${n0 + i * k2 + dn}${LET(s3 + i * k3 + dr)}`;
    const t = Array.from({ length: 5 }, (_, i) => term(i));
    return strQ(r, `Find the next term: ${t.slice(0, 4).join(', ')}, ?`, t[4], [term(4, 1), term(4, 0, 1), term(4, 0, 0, 1), term(4, -1, k2), term(3, 0, 0, 0)],
      `Track each part separately.<br>First letter: ${k1 > 0 ? '+' : ''}${k1} each time; number: ${k2 > 0 ? '+' : ''}${k2}; last letter: ${k3 > 0 ? '+' : ''}${k3}.<br>Next = <b>${t[4]}</b>.`,
      (i) => term(4, i, -i));
  }),

  // ------------------------------------------------------------ Coding
  def('r-coding', 'shift-cipher', 'Letter shift coding', (r, L) => {
    const [w1, w2] = r.sample(WORDS, 2);
    let rule: (ch: string, i: number) => string;
    let desc: string;
    if (L === 1) { const k = r.int(1, 3); rule = (c) => LET(POS(c) + k); desc = `every letter is moved +${k}`; }
    else if (L === 2) { const k = r.int(1, 4) * (r.chance(0.5) ? -1 : 1); rule = (c) => LET(POS(c) + k); desc = `every letter is moved ${k > 0 ? '+' : '−'}${Math.abs(k)}`; }
    else if (r.chance(0.5)) { const k = r.int(1, 3); rule = (c, i) => LET(POS(c) + (i % 2 ? -k : k)); desc = `letters at odd positions move +${k}, at even positions −${k}`; }
    else { rule = (c, i) => LET(POS(c) + i + 1); desc = `the n-th letter moves +n (+1, +2, +3, …)`; }
    const enc = (w: string) => [...w].map(rule).join('');
    const ans = enc(w2);
    const plus1 = (w: string) => [...w].map((c) => LET(POS(c) + 1)).join('');
    return strQ(r, `In a certain code language, ${w1} is written as ${enc(w1)}. How is ${w2} written in that code?`, ans,
      [[...ans].reverse().join(''), plus1(ans), [...w2].map((c, i) => rule(c, i + 1)).join(''), [...w2].map((c) => LET(POS(c) - (POS(rule(c, 0)) - POS(c)))).join('')],
      `Compare ${w1} → ${enc(w1)} letter by letter: ${desc}.<br>Apply to ${w2}: ${[...w2].map((c, i) => `${c}→${rule(c, i)}`).join(', ')}.<br>Code = <b>${ans}</b>.`,
      (i) => [...ans].map((c, j) => (j === i % ans.length ? LET(POS(c) + 1 + Math.floor(i / ans.length)) : c)).join(''));
  }),
  def('r-coding', 'reverse-coding', 'Reverse / opposite-letter coding', (r, L) => {
    const [w1, w2] = r.sample(WORDS, 2);
    const rev = (w: string) => [...w].reverse().join('');
    const shift = (w: string, k: number) => [...w].map((c) => LET(POS(c) + k)).join('');
    const opp = (w: string) => [...w].map((c) => LET(25 - POS(c))).join('');
    let enc: (w: string) => string, desc: string;
    if (L === 1) { enc = rev; desc = 'the word is written in reverse order'; }
    else if (L === 2) { const k = r.pick([1, -1, 2]); enc = (w) => shift(rev(w), k); desc = `the word is reversed and each letter moved ${k > 0 ? '+' : '−'}${Math.abs(k)}`; }
    else { enc = opp; desc = 'each letter is replaced by its opposite (A↔Z, B↔Y, …; position p ↔ 27 − p)'; }
    const ans = enc(w2);
    return strQ(r, `In a certain code language, ${w1} is written as ${enc(w1)}. How is ${w2} written in that code?`, ans,
      [rev(w2), shift(ans, 1), rev(ans), shift(rev(w2), -1), opp(rev(w2))],
      `${w1} → ${enc(w1)}: ${desc}.<br>So ${w2} → <b>${ans}</b>.`,
      (i) => [...ans].map((c, j) => (j === i % ans.length ? LET(POS(c) + 1 + Math.floor(i / ans.length)) : c)).join(''));
  }),

  // ------------------------------------------------------------ Analogy
  def('r-analogy', 'number-pair', 'Number pair analogy', (r, L) => {
    const fns: [string, (n: number) => number][] = [
      ['n² + 1', (n) => n * n + 1], ['n² − 1', (n) => n * n - 1], ['n³', (n) => n ** 3], ['n × (n + 1)', (n) => n * (n + 1)],
      ['2n + 3', (n) => 2 * n + 3], ['3n − 2', (n) => 3 * n - 2], ['n³ + 1', (n) => n ** 3 + 1], ['n² + n + 1', (n) => n * n + n + 1],
      ['n² × 2', (n) => 2 * n * n], ['n³ − n', (n) => n ** 3 - n], ['(n + 2)²', (n) => (n + 2) ** 2],
    ];
    const pool = L === 1 ? fns.slice(0, 6) : L === 2 ? fns.slice(0, 9) : fns.slice(3);
    for (;;) {
      const [name, f] = r.pick(pool);
      const a = r.int(2, L === 1 ? 9 : 12), b = r.int(2, L === 1 ? 9 : 14);
      if (a === b) continue;
      // reject if another rule also maps a → f(a) but gives a different answer for b
      if (fns.some(([, g]) => g(a) === f(a) && g(b) !== f(b))) continue;
      const ans = f(b);
      return numQ(r, `Select the number that completes the analogy: ${a} : ${f(a)} :: ${b} : ?`, ans,
        [...fns.map(([, g]) => g(b)), ans + 1, ans - 1], `Rule: n → ${name}. Check: ${a} → ${f(a)} ✓.<br>${b} → <b>${ans}</b>.`);
    }
  }),

  // ------------------------------------------------------------ Classification
  def('r-classification', 'odd-number', 'Odd number out', (r, L) => {
    const props: [string, (n: number) => boolean, (r: Rng) => number, (r: Rng) => number][] = [
      ['perfect squares', (n) => Number.isInteger(Math.sqrt(n)), (q) => q.int(4, 30) ** 2, (q) => q.int(4, 30) ** 2 + q.pick([-1, 1, 2])],
      ['prime numbers', isPrime, (q) => { let x; do x = q.int(11, 97); while (!isPrime(x)); return x; }, (q) => q.pick([21, 27, 33, 39, 49, 51, 57, 63, 69, 77, 81, 87, 91, 93])],
      ['multiples of 7', (n) => n % 7 === 0, (q) => 7 * q.int(3, 20), (q) => 7 * q.int(3, 20) + q.pick([1, 2, 3, 4])],
      ['perfect cubes', (n) => Number.isInteger(Math.round(Math.cbrt(n))) && Math.round(Math.cbrt(n)) ** 3 === n, (q) => q.int(2, 12) ** 3, (q) => q.int(3, 12) ** 3 + q.pick([-1, 1])],
      ['multiples of 13', (n) => n % 13 === 0, (q) => 13 * q.int(3, 15), (q) => 13 * q.int(3, 15) + q.pick([1, 2, 3, 4])],
      ['of the form n² + 1', (n) => Number.isInteger(Math.sqrt(n - 1)), (q) => q.int(3, 20) ** 2 + 1, (q) => q.int(3, 20) ** 2 + 3],
    ];
    const [name, has, yes, no] = r.pick(L === 1 ? props.slice(0, 3) : L === 2 ? props.slice(0, 5) : props.slice(1));
    const set = new Set<number>();
    while (set.size < 3) set.add(yes(r));
    let odd = no(r);
    while (has(odd) || set.has(odd)) odd = no(r);
    const ds = [...set].map(String);
    return strQ(r, `Select the number that does NOT belong to the group.`, String(odd), ds,
      `${ds.join(', ')} are all ${name}.<br><b>${odd}</b> is not, so it is the odd one out.`, () => String(yes(r)));
  }),

  // ------------------------------------------------------------ Math operations
  def('r-math-ops', 'symbol-substitution', 'Symbol substitution (BODMAS)', (r, L) => {
    const SYM = ['+', '−', '×', '÷'];
    for (let t = 0; ; t++) {
      let perm: string[];
      do perm = r.shuffle(SYM); while (perm.some((p, i) => p === SYM[i]));
      const map: Record<string, string> = Object.fromEntries(SYM.map((s, i) => [s, perm[i]]));
      const nOps = L === 1 ? 3 : 4;
      const shown = Array.from({ length: nOps }, () => r.pick(SYM));
      const real = shown.map((s) => map[s]);
      const nums = Array.from({ length: nOps + 1 }, () => r.int(2, L === 3 ? 30 : 15));
      // make divisions exact by making the dividend a multiple
      for (let i = 0; i < nOps; i++) if (real[i] === '÷') nums[i] = nums[i + 1] * r.int(1, 6);
      const ans = evalBodmas(nums, real);
      if (ans === null || Math.abs(ans) > 999 || (L < 3 && ans < 0)) { if (t < 500) continue; }
      if (ans === null) continue;
      const expr = nums.map((n, i) => (i ? ` ${shown[i - 1]} ` : '') + n).join('');
      const realExpr = nums.map((n, i) => (i ? ` ${real[i - 1]} ` : '') + n).join('');
      const legend = SYM.map((s) => `'${s}' means '${map[s]}'`).join(', ');
      return numQ(r, `If ${legend}, then what is the value of:<br>${expr} = ?`, ans,
        [evalLeft(nums, real) ?? ans + 7, evalBodmas(nums, shown) ?? ans - 5, ans + 2, ans - 3, -ans],
        `Replace symbols: ${realExpr}.<br>Apply BODMAS (÷ and × before + and −) → <b>${ans}</b>.`, { allowNonPositive: true });
    }
  }),

  // ------------------------------------------------------------ Direction
  def('r-direction', 'walk-path', 'Direction & distance (walk path)', (r, L) => {
    const name = r.pick(['Ravi', 'Meena', 'Arjun', 'Pooja', 'Kabir', 'Sana']);
    for (;;) {
      const steps = L === 1 ? 2 : L === 2 ? 3 : 4;
      let d = r.int(0, 3), x = 0, y = 0;
      const pts: [number, number][] = [[0, 0]];
      const parts: string[] = [];
      for (let i = 0; i < steps; i++) {
        let turnTxt = '';
        if (i > 0) { const turn = r.pick(['right', 'left']); d = (d + (turn === 'right' ? 1 : 3)) % 4; turnTxt = `turns ${turn} and walks `; }
        const dist = r.int(2, 12) * (L === 3 ? 5 : 1);
        x += DIRV[DIR4[d]][0] * dist; y += DIRV[DIR4[d]][1] * dist;
        pts.push([x, y]);
        parts.push(i === 0 ? `walks ${dist} m towards ${DIR4[d]}` : `${turnTxt}${dist} m`);
      }
      const D = Math.sqrt(x * x + y * y);
      if (!Number.isInteger(D) || D === 0) continue;
      const dir = (y > 0 ? 'North' : y < 0 ? 'South' : '') + (x > 0 ? (y ? '-East' : 'East') : x < 0 ? (y ? '-West' : 'West') : '');
      const text = parts.slice(0, -1).join(', then ') + (parts.length > 1 ? `, and finally ${parts[parts.length - 1]}` : '');
      const svg = pathSvg(pts);
      const net = `Net displacement: ${Math.abs(x)} m ${x >= 0 ? 'East' : 'West'}, ${Math.abs(y)} m ${y >= 0 ? 'North' : 'South'}.`;
      const ans = `${D} m, ${dir}`;
      const total = pts.slice(1).reduce((s, p, i) => s + Math.abs(p[0] - pts[i][0]) + Math.abs(p[1] - pts[i][1]), 0);
      const others = DIR8.filter((v) => v !== dir);
      return strQ(r, `${name} starts from point A, ${text}, reaching point B. How far and in which direction is B from A?`, ans,
        [`${D} m, ${r.pick(others)}`, `${Math.abs(x) + Math.abs(y)} m, ${dir}`, `${total} m, ${dir}`, `${D} m, ${others[0]}`, `${D + 5} m, ${dir}`],
        `Track coordinates (East = +x, North = +y). ${net}<br>Distance = √(${x * x} + ${y * y}) = ${D} m; direction = ${dir}.<br>Answer: <b>${ans}</b>.`,
        (i) => `${D + i} m, ${others[i % others.length]}`, svg);
    }
  }),

  // ------------------------------------------------------------ Order & ranking
  def('r-order-ranking', 'rank-position', 'Order & ranking', (r, L) => {
    const nm = r.pick(['Ravi', 'Meena', 'Arjun', 'Pooja']);
    if (L === 1) {
      const a = r.int(5, 25), b = r.int(5, 25);
      const n = a + b - 1;
      return numQ(r, `In a row of students, ${nm} is ${ordinal(a)} from the left end and ${ordinal(b)} from the right end. How many students are there in the row?`, n,
        [a + b, a + b + 1, a + b - 2], `Total = left position + right position − 1 = ${a} + ${b} − 1 = <b>${n}</b>.`);
    }
    if (L === 2) {
      const n = r.int(25, 60), a = r.int(5, n - 5);
      return strQ(r, `In a class of ${n} students, ${nm}'s rank is ${ordinal(a)} from the top. What is ${nm}'s rank from the bottom?`, ordinal(n - a + 1),
        [ordinal(n - a), ordinal(n - a + 2), ordinal(n - a - 1)], `Rank from bottom = total − rank from top + 1 = ${n} − ${a} + 1 = <b>${ordinal(n - a + 1)}</b>.`,
        (i) => ordinal(n - a + 2 + i));
    }
    const a = r.int(8, 20), b = r.int(8, 20), k = r.int(2, 6);
    const total = a + k + b - 1;
    return numQ(r, `In a row, A is ${ordinal(a)} from the left and B is ${ordinal(b)} from the right. When they interchange their positions, A becomes ${ordinal(a + k)} from the left. How many people are there in the row?`,
      total, [total + 1, total - 1, a + b + k, a + b - 1],
      `After interchanging, A stands at B's old place: ${ordinal(b)} from the right and ${ordinal(a + k)} from the left.<br>Total = ${a + k} + ${b} − 1 = <b>${total}</b>.`);
  }),

  // ------------------------------------------------------------ Calendar & clock
  def('r-calendar-clock', 'calendar-day', 'Day of the week', (r, L) => {
    const fmtD = (y: number, m: number, d: number) => `${d} ${MONTHS[m]} ${y}`;
    if (L === 1) {
      const y = r.int(1995, 2035), m = r.int(1, 11), d = r.int(1, MDAYS(y)[m]);
      const d1 = dow(y, 0, 1), d2 = dow(y, m, d);
      const days = MDAYS(y).slice(0, m).reduce((a, b) => a + b, 0) + d - 1;
      return strQ(r, `If 1 January ${y} was a ${DAYS[d1]}, what day of the week was ${fmtD(y, m, d)}?`, DAYS[d2], DAYS.filter((x) => x !== DAYS[d2]),
        `${y} is ${isLeap(y) ? '' : 'not '}a leap year. Days after 1 January = ${MDAYS(y).slice(0, m).join(' + ')} + ${d - 1} = ${days}.<br>${days} mod 7 = ${days % 7} odd days → ${DAYS[d1]} + ${days % 7} = <b>${DAYS[d2]}</b>.`,
        (i) => DAYS[i % 7]);
    }
    if (L === 2) {
      const y1 = r.int(1995, 2030), gap = r.int(1, 6), m = r.int(0, 11), d = r.int(1, 28);
      const d1 = dow(y1, m, d), d2 = dow(y1 + gap, m, d);
      const steps: string[] = [];
      let shift = 0;
      for (let y = y1; y < y1 + gap; y++) {
        const leapIn = m <= 1 ? isLeap(y) : isLeap(y + 1);
        shift += leapIn ? 2 : 1;
        steps.push(`${y}→${y + 1}: +${leapIn ? 2 : 1}${leapIn ? ` (29 Feb ${m <= 1 ? y : y + 1} in between)` : ''}`);
      }
      return strQ(r, `If ${fmtD(y1, m, d)} was a ${DAYS[d1]}, what day of the week was ${fmtD(y1 + gap, m, d)}?`, DAYS[d2], DAYS.filter((x) => x !== DAYS[d2]),
        `Each year adds 1 odd day; a year whose span contains 29 February adds 2.<br>${steps.join('; ')}.<br>Total shift = ${shift} → ${shift % 7} → ${DAYS[d1]} + ${shift % 7} = <b>${DAYS[d2]}</b>.`,
        (i) => DAYS[i % 7]);
    }
    const y = r.int(1901, 2099), m = r.int(0, 11), d = r.int(1, MDAYS(y)[m]);
    const N = y - 1, c = Math.floor(N / 100) % 4, yy = N % 100;
    const cOdd = [0, 5, 3, 1][c];
    const yOdd = (yy + Math.floor(yy / 4)) % 7;
    const doy = MDAYS(y).slice(0, m).reduce((a, b) => a + b, 0) + d;
    const tot = (cOdd + yOdd + doy) % 7;
    const ans = DAYS[dow(y, m, d)];
    return strQ(r, `What day of the week was ${fmtD(y, m, d)}?`, ans, DAYS.filter((x) => x !== ans),
      `Odd-days method (0 = Sunday, 1 = Monday, …).<br>Completed years = ${N} = ${Math.floor(N / 100) * 100} + ${yy}.<br>${Math.floor(N / 100) * 100} years → ${cOdd} odd days (400k → 0, 100 → 5, 200 → 3, 300 → 1).<br>${yy} years: ${yy} + ${Math.floor(yy / 4)} leap = ${yy + Math.floor(yy / 4)} → ${yOdd} odd days.<br>Days of ${y} up to the date = ${doy} → ${doy % 7} odd days.<br>Total = ${cOdd} + ${yOdd} + ${doy % 7} = ${cOdd + yOdd + (doy % 7)} → ${tot} → <b>${DAYS[tot]}</b>.`,
      (i) => DAYS[i % 7]);
  }),
  def('r-calendar-clock', 'clock-angle', 'Angle between clock hands', (r, L) => {
    const h = r.int(1, 12);
    const mi = L === 1 ? r.pick([0, 15, 30, 45]) : L === 2 ? r.int(1, 11) * 5 : r.int(1, 59);
    const raw = Math.abs(30 * (h % 12) - 5.5 * mi);
    const ang = raw > 180 ? 360 - raw : raw;
    const naive = Math.abs(30 * (h % 12) - 6 * mi) % 360;
    const f = (x: number) => `${fmt(x)}°`;
    return numQ(r, `What is the (smaller) angle between the hour hand and the minute hand of a clock at ${h}:${String(mi).padStart(2, '0')}?`, ang,
      [naive > 180 ? 360 - naive : naive, 360 - ang, ang + 10, ang + 2.5, Math.abs(ang - 15)],
      `Angle = |30H − 5.5M| = |30 × ${h % 12} − 5.5 × ${mi}| = ${fmt(raw)}°${raw > 180 ? `; smaller angle = 360° − ${fmt(raw)}° = <b>${f(ang)}</b>` : ` → <b>${f(ang)}</b>`}.<br>(The hour hand moves 0.5° per minute, so it is not exactly on the hour mark.)`,
      { f, step: 5, allowNonPositive: true, fb: (i) => (ang + 7.5 * i) % 180 });
  }),

  // ------------------------------------------------------------ Dictionary order
  def('r-word-order', 'dictionary-order', 'Dictionary order', (r, L) => {
    const pool = L === 1 ? DICT : L === 2 ? DICT.filter((w) => w[0] === r.pick(PREFIX1)) : (() => { const p = r.pick(PREFIX2); return DICT.filter((w) => w.startsWith(p)); })();
    const words = r.sample(pool, 5);
    const sorted = words.slice().sort();
    const order = sorted.map((w) => words.indexOf(w) + 1).join(', ');
    const cap = (w: string) => w[0].toUpperCase() + w.slice(1);
    const list = words.map((w, i) => `${i + 1}. ${cap(w)}`).join('<br>');
    const variants: string[] = [];
    const o = order.split(', ');
    variants.push([o[1], o[0], ...o.slice(2)].join(', '), [...o.slice(0, 3), o[4], o[3]].join(', '), [...o].reverse().join(', '));
    return strQ(r, `Arrange the following words in the order in which they appear in an English dictionary.<br>${list}`, order, variants,
      `Compare letter by letter until the first difference: ${sorted.map(cap).join(' → ')}.<br>Order: <b>${order}</b>.`,
      (i) => { const s = r.shuffle(o); return i > 0 ? s.join(', ') : o.join(', '); });
  }),

  // ------------------------------------------------------------ Mirror image (text)
  def('r-nonverbal', 'mirror-image', 'Mirror image of a string', (r, L) => {
    const SYMM = [...'AHIMOTUVWXY8'];
    const len = L === 1 ? 4 : L === 2 ? 6 : 8;
    let s = '';
    do s = Array.from({ length: len }, () => r.pick(SYMM)).join(''); while (s === [...s].reverse().join('') || new Set(s).size < 3);
    const ans = [...s].reverse().join('');
    const swap = (x: string, i: number) => { const a = [...x]; [a[i], a[i + 1]] = [a[i + 1], a[i]]; return a.join(''); };
    return strQ(r, `A vertical mirror is placed to the right of the string <b>${s}</b>. Which option shows its mirror image? (Each character in the string looks the same when flipped left-to-right.)`, ans,
      [s, swap(ans, 0), swap(ans, len - 2), ans.slice(len / 2) + ans.slice(0, len / 2), swap(s, 1)],
      `A vertical mirror reverses left and right, so the order of characters is reversed, and each character is flipped.<br>Every character here (${[...new Set(s)].join(', ')}) is symmetric about a vertical axis, so only the order changes.<br>Mirror image: <b>${ans}</b>.`,
      (i) => swap(ans, i % (len - 1)));
  }),
  def('r-nonverbal', 'triangle-count', 'Counting triangles', (r, L) => {
    const p = L === 1 ? r.int(1, 2) : L === 2 ? r.int(2, 3) : r.int(3, 4);
    const q = L === 1 ? r.int(0, 1) : L === 2 ? r.int(1, 2) : r.int(2, 3);
    const { svg, count } = triangleFigure(p, q);
    const rays = p + 2, pairs = C(rays, 2);
    return numQ(r, `How many triangles are there in the given figure?`, count, [count - 1, count + 2, count + q + 1, rays * (q + 1), pairs + q],
      `Every triangle has the apex as one vertex and its base on a horizontal line (${q + 1} including the base).<br>Lines from the apex = ${rays}; any 2 of them form a triangle with a horizontal: C(${rays}, 2) = ${pairs}.<br>Total = ${pairs} × ${q + 1} = <b>${count}</b>.`,
      { svg });
  }),
];

