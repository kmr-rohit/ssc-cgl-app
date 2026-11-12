// Quantitative Aptitude generators. Every answer is computed; parameters are chosen so answers stay exam-friendly.
import { gcd, lcm, fmt } from '../core/rng';
import type { Generator } from '../core/types';
import { def, numQ, strQ, frQ, modpow, num, rs, F, Fr, lin, sup, C } from './util';

const pc = (x: number) => `${fmt(x)}%`;
const pcF = (x: Fr) => `${x.mixed()}%`;
const TRIPLES: [number, number, number][] = [[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17], [9, 12, 15], [7, 24, 25], [12, 16, 20], [20, 21, 29], [9, 40, 41], [15, 20, 25]];

function cycleNote(b: number, e: number): string {
  const d = b % 10;
  const cyc: number[] = [];
  let x = d;
  do { cyc.push(x); x = (x * d) % 10; } while (x !== d && cyc.length < 4);
  const len = cyc.length;
  const k = e % len;
  return `Unit digit of ${b} is ${d}; its powers cycle ${cyc.join(', ')} (length ${len}). ${e} mod ${len} = ${k}${k === 0 ? ` → take ${len}` : ''} → unit digit of ${sup(b, e)} is <b>${cyc[(k + len - 1) % len]}</b>.`;
}

export const QUANT_GENERATORS: Generator[] = [
  // ------------------------------------------------------------ Number system
  def('q-number-system', 'unit-digit', 'Unit digit of powers', (r, L) => {
    const b1 = r.byLevel(L, [2, 3, 7, 8], [3, 7, 8, 9, 13, 17], [17, 23, 27, 37, 43, 58]);
    const e1 = r.int(L === 1 ? 10 : 50, L === 1 ? 60 : L === 2 ? 200 : 999);
    const u1 = modpow(b1, e1, 10);
    const fb = (i: number) => (u1 + i * 3) % 10;
    if (L === 1) {
      return numQ(r, `What is the unit digit of ${sup(b1, e1)}?`, u1, [(u1 + 2) % 10, (u1 + 4) % 10, b1 % 10, e1 % 10],
        `Only the unit digit matters. ${cycleNote(b1, e1)}`, { fb, allowNonPositive: true });
    }
    const b2 = r.byLevel(L, [4, 6, 9], [4, 6, 9, 12, 14], [12, 14, 19, 24, 33]);
    const e2 = r.int(30, L === 3 ? 999 : 199);
    const u2 = modpow(b2, e2, 10);
    const ans = (u1 * u2) % 10;
    return numQ(r, `What is the unit digit of ${sup(b1, e1)} × ${sup(b2, e2)}?`, ans, [u1, u2, (u1 + u2) % 10, (ans + 5) % 10],
      `Work with unit digits only.<br>1. ${cycleNote(b1, e1)}<br>2. ${cycleNote(b2, e2)}<br>3. Product: ${u1} × ${u2} = ${u1 * u2} → unit digit <b>${ans}</b>.`,
      { fb, allowNonPositive: true });
  }),
  def('q-number-system', 'remainder-power', 'Remainder of a large power', (r, L) => {
    const m = r.byLevel(L, [5, 7], [7, 11, 13], [11, 13, 17, 19]);
    const b = r.int(2, Math.min(9, m - 1));
    const e = L === 1 ? r.int(10, 40) : L === 2 ? r.int(50, 200) : r.int(200, 999);
    const ans = modpow(b, e, m);
    const k = e % (m - 1);
    return numQ(r, `What is the remainder when ${sup(b, e)} is divided by ${m}?`, ans, [(ans + 1) % m, (ans + m - 1) % m, (ans + 2) % m, (ans + 3) % m],
      `${m} is prime and does not divide ${b}, so by Fermat ${sup(b, m - 1)} ≡ 1 (mod ${m}).<br>${e} = ${m - 1} × ${Math.floor(e / (m - 1))} + ${k}, so ${sup(b, e)} ≡ ${sup(b, k)} (mod ${m}).<br>${b ** k < 1e6 ? `${sup(b, k)} = ${b ** k}` : `Reduce ${sup(b, k)} step by step mod ${m}`} → remainder <b>${ans}</b>.`,
      { fb: (i) => (ans + i) % m, allowNonPositive: true });
  }),
  def('q-number-system', 'divisibility', 'Divisibility rules (missing digit)', (r, L) => {
    for (let t = 0; t < 100; t++) {
      const div = r.pick(L === 1 ? [3, 9] : L === 2 ? [9, 11] : [11, 11, 9]);
      const len = L === 3 ? 7 : 5;
      const digits = Array.from({ length: len }, () => r.int(1, 9));
      const k = r.int(1, len - 2);
      let found = -1;
      for (let d = 0; d <= 9; d++) {
        const ds = digits.slice(); ds[k] = d;
        if (Number(ds.join('')) % div === 0) { found = d; break; }
      }
      if (found < 0 || (t < 99 && found === 0 && r.chance(0.7))) continue;
      const shown = digits.map((d, i) => (i === k ? 'x' : d)).join('');
      let sol: string;
      if (div === 11) {
        const odd = digits.filter((_, i) => i % 2 === (len - 1) % 2 && i !== k).reduce((a, b) => a + b, 0);
        const even = digits.filter((_, i) => i % 2 !== (len - 1) % 2 && i !== k).reduce((a, b) => a + b, 0);
        const xOdd = k % 2 === (len - 1) % 2;
        sol = `Rule for 11: (sum of digits at odd places from the right) − (sum at even places) must be 0 or a multiple of 11.<br>Odd places: ${odd}${xOdd ? ' + x' : ''}; even places: ${even}${xOdd ? '' : ' + x'}.<br>Smallest x that makes the difference a multiple of 11 is <b>${found}</b>.`;
      } else {
        const s = digits.reduce((a, b, i) => (i === k ? a : a + b), 0);
        sol = `Rule for ${div}: the digit sum must be divisible by ${div}.<br>Known digit sum = ${s}, so ${s} + x must be a multiple of ${div}.<br>Smallest such x = <b>${found}</b> (sum ${s + found}).`;
      }
      return numQ(r, `What is the smallest digit x for which the number ${shown} is divisible by ${div}?`, found, [(found + 1) % 10, (found + 3) % 10, (found + 5) % 10, (found + 7) % 10],
        sol, { fb: (i) => (found + i * 2 + 1) % 10, allowNonPositive: true });
    }
    // unreachable in practice (9 always has a solution)
    return numQ(r, 'What is the smallest digit x for which 12x45 is divisible by 9?', 6, [3, 4, 7], 'Digit sum 12 + x must be a multiple of 9 → x = <b>6</b>.');
  }),
  def('q-number-system', 'trailing-zeros', 'Trailing zeros in a factorial', (r, L) => {
    const n = L === 1 ? r.int(20, 60) : L === 2 ? r.int(60, 150) : r.int(150, 999);
    const parts: string[] = [];
    let z = 0;
    for (let p = 5; p <= n; p *= 5) { const c = Math.floor(n / p); parts.push(`⌊${n}/${p}⌋ = ${c}`); z += c; }
    return numQ(r, `How many zeros are there at the end of ${n}! ?`, z, [Math.floor(n / 5), Math.floor(n / 10), z + 1, z - 1, z + 2],
      `Each trailing zero needs a pair 2 × 5; 5s are fewer, so count the 5s.<br>${parts.join(', ')}.<br>Total = <b>${z}</b>.`);
  }),
  def('q-number-system', 'factor-count', 'Number of factors', (r, L) => {
    const a = r.int(1, L === 1 ? 3 : 5), b = r.int(1, L === 1 ? 2 : 3), c = L === 1 ? 0 : r.int(1, 2);
    const N = 2 ** a * 3 ** b * 5 ** c;
    const ans = (a + 1) * (b + 1) * (c + 1);
    const pf = `${sup(2, a)} × ${sup(3, b)}` + (c ? ` × ${sup(5, c)}` : '');
    const askEven = L === 3 && r.chance(0.5);
    if (askEven) {
      const ev = a * (b + 1) * (c + 1);
      return numQ(r, `How many even factors does ${num(N)} have?`, ev, [ans, ans - ev, ev + b + 1, ev - 1],
        `${num(N)} = ${pf}.<br>An even factor must contain at least one 2, so the power of 2 can be 1…${a} (${a} choices).<br>Even factors = ${a} × (${b}+1) × (${c}+1) = <b>${ev}</b>.`);
    }
    return numQ(r, `How many factors (divisors) does ${num(N)} have?`, ans, [a * b * (c || 1), ans - 2, ans + 2, a + b + c + 1, ans * 2],
      `Prime factorise: ${num(N)} = ${pf}.<br>Number of factors = product of (power + 1) = (${a}+1)(${b}+1)${c ? `(${c}+1)` : ''} = <b>${ans}</b>.`);
  }),

  // ------------------------------------------------------------ HCF & LCM
  def('q-hcf-lcm', 'hcf-lcm-product', 'HCF × LCM = product', (r, L) => {
    const h = r.int(L === 1 ? 4 : 8, L === 3 ? 30 : 15);
    let a = 2, b = 3;
    do { a = r.int(2, 9); b = r.int(2, 9); } while (gcd(a, b) !== 1 || a === b);
    const x = h * a, y = h * b, l = h * a * b;
    return numQ(r, `The HCF and LCM of two numbers are ${h} and ${l} respectively. If one number is ${x}, find the other number.`, y,
      [l / h, x + h, y + h, (l / x) * 2, y - h],
      `Product of two numbers = HCF × LCM.<br>Other number = (${h} × ${l}) ÷ ${x} = ${h * l} ÷ ${x} = <b>${y}</b>.`);
  }),
  def('q-hcf-lcm', 'lcm-remainder', 'Least number leaving a remainder', (r, L) => {
    const set = r.byLevel(L, [[4, 6, 8], [6, 9, 12], [5, 10, 15], [3, 4, 6]], [[12, 15, 20], [8, 12, 18], [16, 24, 36], [10, 12, 15]], [[15, 20, 36, 48], [18, 27, 36, 45], [12, 16, 24, 30]]);
    const rem = r.int(1, Math.min(...set) - 1);
    const l = set.reduce(lcm);
    if (L === 3 && r.chance(0.5)) {
      // least 4-digit number
      const k = Math.ceil((1000 - rem) / l);
      const ans = k * l + rem;
      return numQ(r, `Find the least 4-digit number which, when divided by ${set.join(', ')}, leaves a remainder ${rem} in each case.`, ans, [ans - l, ans + l, k * l, ans + 1],
        `LCM(${set.join(', ')}) = ${l}.<br>Required number = (multiple of ${l}) + ${rem}.<br>Smallest multiple of ${l} with (multiple + ${rem}) ≥ 1000: ${l} × ${k} = ${k * l}.<br>Answer = ${k * l} + ${rem} = <b>${ans}</b>.`);
    }
    const ans = l + rem;
    return numQ(r, `Find the least number which, when divided by ${set.join(', ')}, leaves a remainder ${rem} in each case.`, ans, [l, l - rem, 2 * l + rem, l + rem + 1, l + rem - 1],
      `Number = LCM + remainder.<br>LCM(${set.join(', ')}) = ${l}.<br>Answer = ${l} + ${rem} = <b>${ans}</b>.`);
  }),
  def('q-hcf-lcm', 'bells-together', 'Bells / lights together (LCM)', (r, L) => {
    const set = r.byLevel(L, [[2, 3, 4], [4, 6, 8], [3, 5, 6], [6, 8, 12]], [[6, 8, 10], [9, 12, 15], [10, 15, 20], [12, 16, 18]], [[6, 8, 10, 12], [10, 12, 15, 20], [8, 9, 12, 18]]);
    const l = set.reduce(lcm);
    const unit = L === 1 ? 'minutes' : 'seconds';
    const startH = r.int(8, 11);
    if (L === 3) {
      const hours = r.pick([1, 2]);
      const times = Math.floor((hours * 3600) / l) + 1;
      return numQ(r, `${set.length} bells toll at intervals of ${set.join(', ')} seconds respectively. They start tolling together. How many times will they toll together in ${hours} hour${hours > 1 ? 's' : ''} (including the start)?`,
        times, [times - 1, times + 1, Math.floor((hours * 3600) / set.reduce((a, b) => a * b)) + 1, times * 2],
        `They toll together every LCM(${set.join(', ')}) = ${l} s.<br>In ${hours * 3600} s: ⌊${hours * 3600}/${l}⌋ = ${times - 1} times after the start.<br>Including the start: <b>${times}</b>.`);
    }
    return numQ(r, `${set.length} traffic lights change at intervals of ${set.join(', ')} ${unit} respectively. If they change together at ${startH}:00 a.m., after how many ${unit} will they next change together?`,
      l, [set.reduce((a, b) => a * b), l / 2, l * 2, set.reduce((a, b) => a + b)].filter((x) => Number.isInteger(x)),
      `They coincide after the LCM of the intervals.<br>LCM(${set.join(', ')}) = <b>${l} ${unit}</b>.`, { f: (x) => `${fmt(x)} ${unit}` });
  }),

  // ------------------------------------------------------------ Simplification
  def('q-simplification', 'bodmas', 'BODMAS simplification', (r, L) => {
    const a = r.int(10, 60), b = r.int(2, 12), c = r.int(2, 12), e = r.int(2, 9), k = r.int(2, 15);
    const d = e * k;
    if (L === 1) {
      const ans = a + b * c - k;
      return numQ(r, `Simplify: ${a} + ${b} × ${c} − ${d} ÷ ${e}`, ans, [(a + b) * c - k, a + b * c - d, ((a + b) * c - d) / e, a + b * (c - k)],
        `BODMAS: division and multiplication first.<br>${d} ÷ ${e} = ${k}; ${b} × ${c} = ${b * c}.<br>${a} + ${b * c} − ${k} = <b>${ans}</b>.`);
    }
    if (L === 2) {
      const f = r.int(2, 6);
      const ans = a - b + c * f * e - k;
      return numQ(r, `Simplify: ${a} − ${b} + ${c} × ${f} × ${e} − ${d} ÷ ${e}`, ans, [a - (b + c * f * e) - k, ans + 2 * b, ans + 2 * k, ans - c],
        `Do ÷ and × first: ${d} ÷ ${e} = ${k}; ${c} × ${f} × ${e} = ${c * f * e}.<br>Then left to right: ${a} − ${b} + ${c * f * e} − ${k} = <b>${ans}</b>.`);
    }
    const s = r.int(3, 9);
    const ans = a + (b + c) * e - s * s + k;
    return numQ(r, `Simplify: ${a} + (${b} + ${c}) × ${e} − ${s}² + ${d} ÷ ${e}`, ans, [a + b + c * e - s * s + k, ans + 2 * s, (a + b + c) * e - s * s + k, ans - k],
      `Brackets: ${b} + ${c} = ${b + c}. Orders: ${s}² = ${s * s}.<br>÷/×: ${b + c} × ${e} = ${(b + c) * e}; ${d} ÷ ${e} = ${k}.<br>${a} + ${(b + c) * e} − ${s * s} + ${k} = <b>${ans}</b>.`, { allowNonPositive: true });
  }),
  def('q-simplification', 'indices', 'Laws of indices', (r, L) => {
    if (L === 1) {
      const b = r.pick([2, 3, 5, 7]), m = r.int(2, 9), n = r.int(2, 9), k = r.int(1, m + n - 1);
      const x = m + n - k;
      return numQ(r, `If ${sup(b, m)} × ${sup(b, n)} ÷ ${sup(b, k)} = ${sup(b, 'x')}, find x.`, x, [m * n - k, m + n + k, x + 1, m * n / k],
        `Same base: add powers when multiplying, subtract when dividing.<br>x = ${m} + ${n} − ${k} = <b>${x}</b>.`, { allowNonPositive: true });
    }
    if (L === 2) {
      const b = r.pick([2, 3, 5]), m = r.int(2, 5), n = r.int(2, 4), k = r.int(1, 9);
      const x = m * n + k;
      return numQ(r, `If (${sup(b, m)})<sup>${n}</sup> × ${sup(b, k)} = ${sup(b, 'x')}, find x.`, x, [m + n + k, m ** n + k, x - 1, m * n * k],
        `(a<sup>m</sup>)<sup>n</sup> = a<sup>mn</sup>, so (${sup(b, m)})<sup>${n}</sup> = ${sup(b, m * n)}.<br>Multiply: powers add → x = ${m * n} + ${k} = <b>${x}</b>.`);
    }
    for (;;) {
      const k = r.pick([2, 3, 4]), p = r.int(1, 5), x = r.int(2, 9), s = r.int(-3, 4);
      if (p === k) continue;
      const q = k * x + k * s - p * x;
      if (Math.abs(q) > 25 || q === 0) continue;
      const big = 2 ** k;
      return numQ(r, `If ${sup(2, lin(p, q))} = ${sup(big, lin(1, s))}, find x.`, x, [x + 1, x - 1, -x, q, (k * s - q)],
        `Write ${big} = ${sup(2, k)}: right side = ${sup(2, `${k}(${lin(1, s)})`)} = ${sup(2, lin(k, k * s))}.<br>Equate powers: ${lin(p, q)} = ${lin(k, k * s)} → ${p - k}x = ${k * s - q} → x = <b>${x}</b>.`, { allowNonPositive: true });
    }
  }),

  // ------------------------------------------------------------ Percentage
  def('q-percentage', 'percent-basic', 'Percentage basics', (r, L) => {
    if (L === 1) {
      const p = r.pick([5, 10, 12.5, 15, 20, 25, 30, 37.5, 40, 60, 62.5, 75]);
      const A = 40 * r.int(2, 25);
      const ans = (A * p) / 100;
      return numQ(r, `What is ${p}% of ${A}?`, ans, [ans + 5, ans - 5, (A * (p + 5)) / 100, (A * p) / 10],
        `${p}% = ${F(p * 2, 200).toString()} as a fraction.<br>${A} × ${F(p * 2, 200).toString()} = <b>${fmt(ans)}</b>.`);
    }
    if (L === 2) {
      const p = r.pick([10, 20, 25, 40, 50, 60, 75, 80]), q = r.pick([10, 20, 25, 30, 40, 50, 60].filter((v) => v !== p));
      const A = 20 * r.int(2, 30);
      const B = (A * p) / q;
      return numQ(r, `If ${p}% of A = ${q}% of B and A = ${A}, find B.`, B, [(A * q) / p, B + 10, A, B * 2],
        `${p}/100 × A = ${q}/100 × B → B = A × ${p}/${q}.<br>B = ${A} × ${p}/${q} = <b>${fmt(B)}</b>.`);
    }
    const p = r.pick([10, 20, 25, 40, 50, 60]), x = 20 * r.int(5, 50);
    const up = r.chance(0.5);
    const N = (x * (100 + (up ? p : -p))) / 100;
    return numQ(r, `When a number is ${up ? 'increased' : 'decreased'} by ${p}%, it becomes ${fmt(N)}. Find the number.`, x,
      [up ? (N * (100 - p)) / 100 : (N * (100 + p)) / 100, N, x + 20, x - 20],
      `Number × ${up ? 100 + p : 100 - p}/100 = ${fmt(N)}.<br>Number = ${fmt(N)} × 100/${up ? 100 + p : 100 - p} = <b>${x}</b>.<br>(Trap: ${up ? 'subtracting' : 'adding'} ${p}% of ${fmt(N)} gives the wrong answer.)`);
  }),
  def('q-percentage', 'successive-change', 'Successive percentage change', (r, L) => {
    const changes: number[] = L === 3
      ? [r.pick([10, 20, 25]), -r.pick([10, 20]), r.pick([10, 20, 50])]
      : [r.pick([10, 20, 25, 30, 40, 50]) * (L === 1 ? 1 : r.pick([1, -1])), -r.pick([10, 20, 25, 30, 40])];
    let m = F(1);
    for (const c of changes) m = m.mul(F(100 + c, 100));
    const net = m.sub(1).mul(100).value;
    const show = (x: number) => (Math.abs(x) < 1e-9 ? 'No change' : `${fmt(Math.abs(x))}% ${x > 0 ? 'increase' : 'decrease'}`);
    const naive = changes.reduce((a, b) => a + b, 0);
    const desc = changes.map((c) => `${c > 0 ? 'increased' : 'decreased'} by ${Math.abs(c)}%`);
    const steps = changes.length === 2
      ? `Net = a + b + ab/100 with signs: ${changes[0]} + (${changes[1]}) + (${changes[0]} × ${changes[1]})/100 = ${fmt(net)}%.`
      : `Multiply factors: ${changes.map((c) => `${100 + c}/100`).join(' × ')} = ${m.toString()} → change = ${fmt(net)}%.`;
    return strQ(r, `The price of an item is ${desc.slice(0, -1).join(', then ')} and then ${desc[desc.length - 1]}. What is the net change in the price?`,
      show(net), [show(naive), show(-net), show(net + 1), show(net - 2), show(Math.abs(changes[0] * changes[1]) / 100)],
      `${steps}<br>So the result is a <b>${show(net)}</b>.`, (i) => show(net + i * 1.5));
  }),
  def('q-percentage', 'population', 'Population growth', (r, L) => {
    const rate = L === 3 ? r.pick([4, 5, 10, 20]) : r.pick([5, 10, 20]);
    const n = L === 3 ? 3 : 2;
    const den = (100 / gcd(100, rate)) ** n;
    const P = den * r.int(L === 1 ? 2 : 1, L === 3 ? 4 : 9) * (den < 1000 ? r.pick([10, 100]) : 1);
    const down = L === 2 && r.chance(0.5);
    const g = down ? 100 - rate : 100 + rate;
    const ans = (P * g ** n) / 100 ** n;
    const simple = P * (1 + (down ? -1 : 1) * (n * rate) / 100);
    return numQ(r, `The population of a town is ${num(P)}. It ${down ? 'decreases' : 'increases'} by ${rate}% every year. What will the population be after ${n} years?`,
      ans, [simple, (P * g ** (n - 1)) / 100 ** (n - 1), ans + P / 100, ans - rate * 10],
      `Population after n years = P × (1 ${down ? '−' : '+'} R/100)<sup>n</sup>.<br>= ${num(P)} × (${g}/100)<sup>${n}</sup> = ${num(P)} × ${F(g ** n, 100 ** n).toString()} = <b>${num(ans)}</b>.`, { f: num });
  }),
  def('q-percentage', 'price-consumption', 'Price rise vs consumption', (r, L) => {
    const p = r.byLevel(L, [20, 25, 50, 60], [10, 20, 25, 30, 40, 60], [12.5, 25, 37.5, 40, 50, 75]);
    const up = L === 1 || r.chance(0.7);
    const red = up ? F(p * 2, 200 + p * 2).mul(100) : F(p * 2, 200 - p * 2).mul(100);
    const dir = up ? 'reduce' : 'increase';
    return frQ(r, `The price of sugar ${up ? 'rises' : 'falls'} by ${p}%. By what percentage must a household ${dir} its consumption so that the expenditure stays the same?`,
      red, [F(p * 2, 2), F(p * 2, 200 - p * 2).mul(100), F(p * 2, 200 + p * 2).mul(100), red.add(5)].filter((x) => !x.eq(red)),
      `Expenditure = price × consumption is constant.<br>Required % = ${up ? 'R/(100 + R)' : 'R/(100 − R)'} × 100 = ${p}/${up ? 100 + p : 100 - p} × 100 = <b>${pcF(red)}</b>.`, pcF);
  }),

  // ------------------------------------------------------------ Profit & loss
  def('q-profit-loss', 'markup-discount', 'Mark-up and discount', (r, L) => {
    if (L === 3) {
      for (;;) {
        const d = r.pick([10, 20, 25, 40]), m = r.pick([20, 25, 40, 50, 60, 75, 80]);
        const g = ((100 + m) * (100 - d)) / 100 - 100;
        if (!Number.isInteger(g) || g <= 0) continue;
        return numQ(r, `A shopkeeper wants a profit of ${g}% after allowing a discount of ${d}%. By what percentage above cost price should he mark the goods?`,
          m, [g + d, ((100 + g) * (100 + d)) / 100 - 100, m - 5, m + 10],
          `MP/CP = (100 + gain)/(100 − discount) = ${100 + g}/${100 - d}.<br>MP = ${fmt(((100 + g) / (100 - d)) * 100)}% of CP → mark up by <b>${m}%</b>.`, { f: pc });
      }
    }
    const CP = 100 * r.int(2, 30), m = r.pick([20, 25, 30, 40, 50]), d = r.pick([10, 20, 25]);
    const MP = (CP * (100 + m)) / 100, SP = (MP * (100 - d)) / 100;
    if (L === 1) {
      return numQ(r, `An article costing ${rs(CP)} is marked ${m}% above cost price and sold at a discount of ${d}%. Find the selling price.`, SP,
        [MP, (CP * (100 + m - d)) / 100, CP + (CP * d) / 100, SP + 10 * d],
        `MP = ${rs(CP)} × ${100 + m}/100 = ${rs(MP)}.<br>SP = ${rs(MP)} × ${100 - d}/100 = <b>${rs(SP)}</b>.`, { f: rs });
    }
    const pr = ((100 + m) * (100 - d)) / 100 - 100;
    const show = (x: number) => (x >= 0 ? `${fmt(x)}% profit` : `${fmt(-x)}% loss`);
    return strQ(r, `A trader marks his goods ${m}% above cost price and allows a discount of ${d}%. What is his profit or loss percent?`, show(pr),
      [show(m - d), show(-pr), show(pr + 2), show(pr - 2.5)], `Net % = m − d − md/100 = ${m} − ${d} − ${(m * d) / 100} = ${fmt(pr)}.<br>Result: <b>${show(pr)}</b>.`,
      (i) => show(pr + i));
  }),
  def('q-profit-loss', 'successive-discount', 'Successive discounts', (r, L) => {
    let ds: number[] = [];
    let f = F(1);
    do {
      ds = L === 3 ? [r.pick([10, 20]), r.pick([10, 20, 25]), r.pick([5, 10, 20])] : [r.pick([10, 20, 25, 30, 40]), r.pick([5, 10, 20, 25])];
      f = F(1);
      for (const d of ds) f = f.mul(F(100 - d, 100));
    } while (!Number.isInteger(Math.round(f.value * 1e6) / 1e4));
    const single = F(1).sub(f).mul(100);
    if (L === 1) {
      const MP = 400 * r.int(1, 25);
      const SP = f.mul(MP).value;
      return numQ(r, `An article marked at ${rs(MP)} is sold after successive discounts of ${ds.join('% and ')}%. Find the selling price.`, SP,
        [(MP * (100 - ds[0] - ds[1])) / 100, (MP * (100 - ds[0])) / 100, SP + 20, SP - 40],
        `SP = ${rs(MP)} × ${100 - ds[0]}/100 × ${100 - ds[1]}/100 = <b>${rs(SP)}</b>.<br>(Successive discounts are applied one after the other, not added.)`, { f: rs });
    }
    const naive = ds.reduce((a, b) => a + b, 0);
    return numQ(r, `Successive discounts of ${ds.join('%, ')}% are equivalent to a single discount of:`, single.value,
      [naive, naive - 1, single.value + 2, single.value - 1.5],
      (ds.length === 2 ? `Single discount = a + b − ab/100 = ${ds[0]} + ${ds[1]} − ${(ds[0] * ds[1]) / 100} = <b>${fmt(single.value)}%</b>.`
        : `Remaining fraction = ${ds.map((d) => `${100 - d}/100`).join(' × ')} = ${fmt(f.value * 100)}%.<br>Single discount = 100 − ${fmt(f.value * 100)} = <b>${fmt(single.value)}%</b>.`), { f: pc });
  }),
  def('q-profit-loss', 'articles-cp-sp', 'CP of x articles = SP of y articles', (r, L) => {
    let a = 10, b = 8;
    let pct = F(0);
    do {
      a = r.int(L === 1 ? 10 : 12, L === 3 ? 40 : 25); b = r.int(Math.ceil(a * 0.6), a + 6);
      pct = F((a - b) * 100, b);
    } while (a === b || pct.d > (L === 1 ? 2 : L === 2 ? 4 : 9));
    const show = (x: Fr) => (x.value >= 0 ? `${x.mixed()}% profit` : `${x.abs().mixed()}% loss`);
    return strQ(r, `The cost price of ${a} articles is equal to the selling price of ${b} articles. Find the profit or loss percent.`, show(pct),
      [show(F((a - b) * 100, a)), show(pct.mul(-1)), show(F(Math.abs(a - b) * 100, a + b)), show(pct.add(pct.value > 0 ? 5 : -5))],
      `Let CP of 1 article = ₹1. CP of ${b} articles = ₹${b}, SP of ${b} articles = ₹${a}.<br>${a > b ? 'Profit' : 'Loss'} = ${Math.abs(a - b)} on ${b} → ${Math.abs(a - b)}/${b} × 100 = <b>${show(pct)}</b>.<br>(Divide by the SP-count, i.e. ${b}, not ${a}.)`,
      (i) => show(pct.add(pct.value > 0 ? i : -i)));
  }),

  // ------------------------------------------------------------ SI & CI
  def('q-si-ci', 'simple-interest', 'Simple interest', (r, L) => {
    if (L === 3) {
      const n = r.pick([4, 5, 8, 10, 20, 25]), times = r.pick([2, 3]);
      const R = ((times - 1) * 100) / n;
      return numQ(r, `A sum of money becomes ${times === 2 ? 'double' : 'three times'} itself in ${n} years at simple interest. What is the rate of interest per annum?`, R,
        [100 / n, (times * 100) / n, R * 2, R + 2.5],
        `Interest earned = ${times - 1} × P in ${n} years.<br>R = (SI × 100)/(P × T) = (${times - 1} × 100)/${n} = <b>${fmt(R)}%</b>.`, { f: pc });
    }
    const P = 100 * r.int(5, 100), R = r.pick(L === 1 ? [5, 10, 12, 15, 20] : [4, 6, 7.5, 8, 12.5]), T = r.int(2, 6);
    const SI = (P * R * T) / 100;
    if (L === 2 && r.chance(0.5)) {
      return numQ(r, `At what rate per annum will ${rs(P)} yield a simple interest of ${rs(SI)} in ${T} years?`, R, [R + 1, R * 2, (SI * 100) / P, R - 0.5],
        `R = (SI × 100)/(P × T) = (${num(SI)} × 100)/(${num(P)} × ${T}) = <b>${fmt(R)}%</b>.`, { f: pc });
    }
    return numQ(r, `Find the simple interest on ${rs(P)} at ${R}% per annum for ${T} years.`, SI, [P + SI, SI + (P * R) / 100, (P * R) / 100, SI - (P * R) / 100],
      `SI = P × R × T/100 = ${num(P)} × ${R} × ${T}/100 = <b>${rs(SI)}</b>.`, { f: rs });
  }),
  def('q-si-ci', 'ci-two-years', 'Compound interest (2/3 years)', (r, L) => {
    const R = r.pick(L === 1 ? [10, 20] : [5, 10, 15, 20]);
    const n = L === 3 ? 3 : 2;
    const den = (100 / gcd(100, R)) ** n;
    const P = den * r.int(1, 10) * (den <= 100 ? 100 : 1);
    const A = (P * (100 + R) ** n) / 100 ** n;
    const CI = A - P;
    const SI = (P * R * n) / 100;
    const pct = (((100 + R) ** n - 100 ** n) / 100 ** n) * 100;
    return numQ(r, `Find the compound interest on ${rs(P)} at ${R}% per annum for ${n} years, compounded annually.`, CI, [SI, A, CI + (P * R) / 100, CI - 10 * R],
      `Effective rate for ${n} years at ${R}%: ${n === 2 ? `${R} + ${R} + ${R}×${R}/100 = ${fmt(pct)}%` : `(1 + ${R}/100)<sup>3</sup> − 1 = ${fmt(pct)}%`}.<br>CI = ${fmt(pct)}% of ${rs(P)} = <b>${rs(CI)}</b>.`, { f: rs });
  }),
  def('q-si-ci', 'ci-si-difference', 'CI − SI difference', (r, L) => {
    const R = r.pick([4, 5, 10, 20]);
    const n = L === 3 ? 3 : 2;
    const unit = (100 / gcd(100, R)) ** 2 * (n === 3 ? 100 / gcd(100, R) : 1);
    const P = unit * r.int(1, 8) * (unit < 1000 ? 10 : 1);
    const diff = n === 2 ? (P * R * R) / 10000 : (P * R * R * (300 + R)) / 1000000;
    if (L === 2) {
      return numQ(r, `The difference between compound interest and simple interest on a sum for 2 years at ${R}% per annum is ${rs(diff)}. Find the sum.`, P,
        [(diff * 100) / R, P / 2, P + (P * R) / 100, P * 2], `For 2 years: D = P(R/100)².<br>P = D × (100/R)² = ${num(diff)} × ${(100 / R) ** 2} = <b>${rs(P)}</b>.`, { f: rs });
    }
    return numQ(r, `Find the difference between compound interest and simple interest on ${rs(P)} for ${n} years at ${R}% per annum.`, diff,
      [(P * R) / 100, n === 3 ? (P * R * R) / 10000 : diff * 2, diff + R, (P * R * R * 3) / 10000],
      n === 2 ? `For 2 years: D = P(R/100)² = ${num(P)} × (${R}/100)² = <b>${rs(diff)}</b>.`
        : `For 3 years: D = P(R/100)²(3 + R/100) = ${num(P)} × (${R}/100)² × (3 + ${R}/100) = <b>${rs(diff)}</b>.`, { f: rs });
  }),

  // ------------------------------------------------------------ Ratio
  def('q-ratio', 'ratio-divide', 'Dividing in a ratio', (r, L) => {
    if (L === 1) {
      const p = [r.int(1, 7), r.int(1, 7), r.int(1, 7)];
      const s = p[0] + p[1] + p[2], k = r.int(10, 200);
      const who = r.int(0, 2);
      const ans = p[who] * k;
      return numQ(r, `${rs(s * k)} is divided among A, B and C in the ratio ${p.join(' : ')}. What is ${'ABC'[who]}'s share?`, ans,
        [p[(who + 1) % 3] * k, p[(who + 2) % 3] * k, ans + k, (s * k) / 3],
        `Total parts = ${p.join(' + ')} = ${s}. One part = ${num(s * k)}/${s} = ${k}.<br>${'ABC'[who]}'s share = ${p[who]} × ${k} = <b>${rs(ans)}</b>.`, { f: rs });
    }
    if (L === 2) {
      for (;;) {
        const a = r.int(1, 7), b = r.int(2, 7), c = r.int(1, 7), d = r.int(1, 7);
        if (gcd(a, b) !== 1 || gcd(c, d) !== 1) continue;
        const l = lcm(b, c);
        const A = a * (l / b), B = l, Cc = d * (l / c);
        const g = gcd(gcd(A, B), Cc);
        const ans = `${A / g} : ${B / g} : ${Cc / g}`;
        return strQ(r, `If A : B = ${a} : ${b} and B : C = ${c} : ${d}, find A : B : C.`, ans,
          [`${a} : ${b} : ${d}`, `${a * c} : ${b * d} : ${b * c}`, `${a} : ${b * c} : ${d}`, `${Cc / g} : ${B / g} : ${A / g}`],
          `Make B common: LCM(${b}, ${c}) = ${l}.<br>A : B = ${A} : ${l}; B : C = ${l} : ${Cc}.<br>A : B : C = <b>${ans}</b>.`,
          (i) => `${A / g + i} : ${B / g} : ${Cc / g}`);
      }
    }
    for (;;) {
      const a = r.int(2, 9), b = r.int(2, 9), c = r.int(2, 9), d = r.int(2, 9);
      if (a === b || a * d === b * c || gcd(a, b) !== 1 || gcd(c, d) !== 1) continue;
      const db = b - a, dd = d - c;
      if (db === 0 || dd === 0 || Math.sign(db) !== Math.sign(dd)) continue;
      const g = gcd(Math.abs(db), Math.abs(dd));
      const t = r.int(1, 3) * 100;
      const k = (t * Math.abs(dd)) / g, m = (t * Math.abs(db)) / g;
      const S = a * k - c * m;
      if (S <= 0 || b * k - d * m !== S) continue;
      return numQ(r, `The incomes of A and B are in the ratio ${a} : ${b} and their expenditures are in the ratio ${c} : ${d}. If each saves ${rs(S)}, find A's income.`,
        a * k, [b * k, c * m, a * k + S, a * S],
        `Let incomes be ${a}x, ${b}x and expenditures ${c}y, ${d}y.<br>${a}x − ${c}y = ${b}x − ${d}y → ${Math.abs(db)}x = ${Math.abs(dd)}y.<br>Take x = ${k}, y = ${m}: saving = ${a * k} − ${c * m} = ${S} ✓.<br>A's income = ${a} × ${k} = <b>${rs(a * k)}</b>.`, { f: rs });
    }
  }),
  def('q-ratio', 'partnership', 'Partnership', (r, L) => {
    const x = 1000 * r.int(2, 20), y = 1000 * r.int(2, 20);
    const t1 = 12, t2 = L === 1 ? 12 : r.int(3, 11);
    const a = x * t1, b = y * t2;
    const g = gcd(a, b);
    const pa = a / g, pb = b / g;
    const share = r.int(2, 30) * (L === 3 ? 100 : 50);
    const P = (pa + pb) * share;
    const ansB = pb * share;
    return numQ(r, `A invests ${rs(x)} for the whole year and B invests ${rs(y)}${t2 < 12 ? ` after ${12 - t2} months` : ' for the whole year'}. Out of a total profit of ${rs(P)}, what is B's share?`,
      ansB, [pa * share, (P * y) / (x + y), ansB + share, P / 2],
      `Profit ∝ capital × time.<br>A : B = ${num(x)} × ${t1} : ${num(y)} × ${t2} = ${pa} : ${pb}.<br>B's share = ${num(P)} × ${pb}/${pa + pb} = <b>${rs(ansB)}</b>.`, { f: rs });
  }),

  // ------------------------------------------------------------ Mixture
  def('q-mixture', 'alligation', 'Rule of alligation', (r, L) => {
    for (;;) {
      const p1 = r.int(2, 9) * 10, p2 = p1 + r.int(2, 8) * 10, pm = r.int(p1 + 1, p2 - 1);
      if (L === 1 && pm % 5) continue;
      const a = p2 - pm, b = pm - p1;
      const g = gcd(a, b);
      if (a / g > 12 || b / g > 12) continue;
      if (L <= 2) {
        const Rt = (x: number, y: number) => `${x / gcd(x, y)} : ${y / gcd(x, y)}`;
        const ans = Rt(a, b);
        return strQ(r, `In what ratio must rice at ₹${p1}/kg be mixed with rice at ₹${p2}/kg so that the mixture is worth ₹${pm}/kg?`, ans,
          [Rt(b, a), Rt(p1, p2), Rt(a / g + 1, b / g), Rt(a / g, b / g + 1), Rt(p2 - p1, pm)],
          `Alligation: (dearer − mean) : (mean − cheaper).<br>(${p2} − ${pm}) : (${pm} − ${p1}) = ${a} : ${b} = <b>${ans}</b> (cheaper : dearer).`,
          (i) => Rt(a / g + i, b / g + 2 * i + 1));
      }
      const Q = (b / g) * r.int(2, 8);
      const ans = (Q * a) / b;
      return numQ(r, `How many kg of rice at ₹${p1}/kg must be mixed with ${Q} kg of rice at ₹${p2}/kg so that the mixture costs ₹${pm}/kg?`, ans,
        [(Q * b) / a, ans + b / g, Q, ans - 1],
        `Ratio cheaper : dearer = (${p2} − ${pm}) : (${pm} − ${p1}) = ${a / g} : ${b / g}.<br>Cheaper = ${Q} × ${a / g}/${b / g} = <b>${fmt(ans)} kg</b>.`, { f: (v) => `${fmt(v)} kg` });
    }
  }),
  def('q-mixture', 'replacement', 'Repeated replacement', (r, L) => {
    const n = L === 3 ? 3 : 2;
    const [a, b] = r.pick(L === 1 ? [[4, 5], [9, 10], [3, 4]] : [[4, 5], [3, 4], [9, 10], [7, 8], [2, 3]]);
    const s = r.int(1, 4);
    const V = b ** n * s, x = (V * (b - a)) / b;
    const ans = s * a ** n;
    return numQ(r, `A container has ${V} litres of milk. ${x} litres are removed and replaced with water. This is done ${n === 2 ? 'twice' : 'three times'} in all. How much milk is left?`,
      ans, [V - n * x, (V * a) / b, ans + x, V - ans],
      `Milk left = V × (1 − x/V)<sup>n</sup> = ${V} × (${a}/${b})<sup>${n}</sup> = <b>${ans} litres</b>.`, { f: (v) => `${fmt(v)} litres` });
  }),

  // ------------------------------------------------------------ Average
  def('q-average', 'new-member', 'Average after one joins/leaves', (r, L) => {
    const n = r.int(L === 1 ? 5 : 10, L === 3 ? 40 : 20), A = r.int(10, 18), d = r.int(1, L === 1 ? 3 : 5) * (L === 3 && r.chance(0.5) ? 0.5 : 1);
    const joins = L === 1 || r.chance(0.6);
    if (joins) {
      const val = A + d * (n + 1);
      return numQ(r, `The average age of ${n} students is ${A} years. When the teacher's age is included, the average increases by ${fmt(d)} year${d === 1 ? '' : 's'}. Find the teacher's age.`, val,
        [A + d * n, A + d, val + 1, (A + d) * 2], `New total − old total = teacher.<br>Teacher = new avg + n × increase = ${fmt(A + d)} + ${n} × ${fmt(d)} = <b>${fmt(val)} years</b>.`, { f: (v) => `${fmt(v)} years` });
    }
    const val = A + d * (n - 1);
    return numQ(r, `The average weight of ${n} people is ${A} kg. When one person leaves, the average decreases by ${fmt(d)} kg. Find the weight of the person who left.`, val,
      [A + d * n, A - d, val - d, val + 2], `Leaving person = old avg + (remaining count) × decrease.<br>= ${A} + ${n - 1} × ${fmt(d)} = <b>${fmt(val)} kg</b>.`, { f: (v) => `${fmt(v)} kg` });
  }),
  def('q-average', 'replacement', 'Average after replacement', (r, L) => {
    const n = r.int(L === 1 ? 4 : 8, L === 3 ? 25 : 12), old = r.int(40, 70), d = r.int(1, 4) * (L >= 2 ? r.pick([0.5, 1, 1.5]) : 1);
    const nw = old + n * d;
    return numQ(r, `The average weight of ${n} persons increases by ${fmt(d)} kg when a person weighing ${old} kg is replaced by a new person. Find the weight of the new person.`, nw,
      [old + d, old + (n + 1) * d, old + (n - 1) * d, nw + n], `Total increases by n × increase = ${n} × ${fmt(d)} = ${fmt(n * d)} kg.<br>New person = ${old} + ${fmt(n * d)} = <b>${fmt(nw)} kg</b>.`, { f: (v) => `${fmt(v)} kg` });
  }),

  // ------------------------------------------------------------ Time & work
  def('q-time-work', 'work-together', 'Working together', (r, L) => {
    if (L === 3) {
      for (;;) {
        const [a, b, c] = [r.int(6, 30), r.int(6, 30), r.int(6, 30)];
        const W = [a, b, c].reduce(lcm);
        if (W > 360 || a === b || b === c || a === c) continue;
        const eff = W / a + W / b + W / c;
        const t = F(W, eff);
        if (t.d > 9) continue;
        return frQ(r, `A, B and C can complete a work in ${a}, ${b} and ${c} days respectively. In how many days can they finish it working together?`, t,
          [F(a + b + c, 3), F(W, eff + 1), t.add(1), F(Math.min(a, b, c), 2)],
          `LCM method: total work = LCM(${a}, ${b}, ${c}) = ${W} units.<br>Efficiencies: ${W / a} + ${W / b} + ${W / c} = ${eff} units/day.<br>Time = ${W}/${eff} = <b>${t.mixed()} days</b>.`, (x) => x.mixed(), ' days');
      }
    }
    for (;;) {
      const a = r.int(4, 30), b = r.int(4, 30);
      if (a === b) continue;
      const t = F(a * b, a + b);
      if (t.d > (L === 1 ? 5 : 9)) continue;
      if (L === 2) {
        // A alone and together given, find B
        if (!t.isInt && t.d > 3) continue;
        return numQ(r, `A and B together can finish a work in ${t.mixed()} days. A alone can do it in ${a} days. In how many days can B alone finish it?`, b,
          [a - t.value, a + b, Math.abs(a - b), b + 2], `1/B = 1/(together) − 1/A = ${t.d}/${t.n} − 1/${a} = 1/${b}.<br>B alone: <b>${b} days</b>.`, { f: (v) => `${fmt(v)} days` });
      }
      return frQ(r, `A can do a piece of work in ${a} days and B can do it in ${b} days. In how many days will they finish it together?`, t,
        [F(a + b, 2), F(Math.abs(a - b)), t.add(1), F(a * b, a + b + 2)], `Together time = ab/(a + b) = ${a} × ${b}/(${a} + ${b}) = ${a * b}/${a + b} = <b>${t.mixed()} days</b>.`,
        (x) => x.mixed(), ' days');
    }
  }),
  def('q-time-work', 'pipes', 'Pipes & cisterns', (r, L) => {
    for (;;) {
      const a = r.int(2, 20), b = r.int(a + 1, 40);
      const t = F(a * b, b - a);
      if ((L === 1 && !t.isInt) || t.d > 5 || t.value > 60) continue;
      if (L === 3) {
        const c = r.int(2, 20);
        const l = [a, b, c].reduce(lcm);
        const net = l / a + l / c - l / b;
        if (net <= 0 || l > 240) continue;
        const T = F(l, net);
        if (T.d > 9) continue;
        return frQ(r, `Pipes A and B can fill a tank in ${a} h and ${c} h respectively, while pipe C can empty it in ${b} h. If all three are opened together, in how many hours will the tank be filled?`,
          T, [F(l, l / a + l / c + l / b), F(a * c, a + c), T.add(1), F(a + c, 2)],
          `Tank = LCM(${a}, ${c}, ${b}) = ${l} units.<br>Net rate = ${l / a} + ${l / c} − ${l / b} = ${net} units/h.<br>Time = ${l}/${net} = <b>${T.mixed()} h</b>.`, (x) => x.mixed(), ' h');
      }
      return frQ(r, `A pipe can fill a tank in ${a} hours and another pipe can empty it in ${b} hours. If both are opened together, in how many hours will the tank be full?`, t,
        [F(a * b, a + b), F(b - a), t.add(2), F(a + b, 2)], `Net filling per hour = 1/${a} − 1/${b} = ${b - a}/${a * b}.<br>Time = ${a} × ${b}/(${b} − ${a}) = <b>${t.mixed()} h</b>.`,
        (x) => x.mixed(), ' h');
    }
  }),

  // ------------------------------------------------------------ TSD
  def('q-tsd', 'average-speed', 'Average speed', (r, L) => {
    if (L === 3) {
      for (;;) {
        const [x, y, z] = [r.pick([10, 20, 30, 40, 60]), r.pick([12, 15, 20, 30, 60]), r.pick([20, 30, 40, 60])];
        if (x === y || y === z || x === z) continue;
        const avg = F(3 * x * y * z, x * y + y * z + z * x);
        if (avg.d > 11) continue;
        return frQ(r, `A person covers three equal distances at ${x} km/h, ${y} km/h and ${z} km/h. Find the average speed for the whole journey.`, avg,
          [F(x + y + z, 3), avg.add(2), F(2 * x * y, x + y), avg.sub(1)],
          `For three equal distances: average = 3xyz/(xy + yz + zx) = 3 × ${x} × ${y} × ${z}/(${x * y} + ${y * z} + ${z * x}) = <b>${avg.mixed()} km/h</b>.`, (v) => v.mixed(), ' km/h');
      }
    }
    for (;;) {
      const x = r.int(2, 12) * 5, y = r.int(2, 12) * 5;
      if (x === y) continue;
      const avg = F(2 * x * y, x + y);
      if (L === 1 && !avg.isInt) continue;
      return frQ(r, `A car goes from P to Q at ${x} km/h and returns at ${y} km/h. What is its average speed for the whole journey?`, avg,
        [F(x + y, 2), avg.add(3), F(x * y, x + y), avg.sub(2)],
        `Equal distances → average speed = 2xy/(x + y) (not the simple mean).<br>= 2 × ${x} × ${y}/(${x + y}) = <b>${avg.mixed()} km/h</b>.`, (v) => v.mixed(), ' km/h');
    }
  }),
  def('q-tsd', 'trains', 'Trains crossing', (r, L) => {
    const ms = (k: number) => (k * 5) / 18;
    if (L === 1) {
      const v = 18 * r.int(2, 5), t = r.int(6, 30), len = ms(v) * t;
      const plat = r.chance(0.5) ? ms(v) * r.int(5, 25) : 0;
      const T = (len + plat) / ms(v);
      if (!plat) {
        return numQ(r, `A train running at ${v} km/h crosses a pole in ${t} seconds. What is the length of the train?`, len, [v * t, len / 2, len + 50, (v * t) / 10],
          `Speed = ${v} × 5/18 = ${ms(v)} m/s.<br>Length = speed × time = ${ms(v)} × ${t} = <b>${len} m</b>.`, { f: (x) => `${fmt(x)} m` });
      }
      return numQ(r, `A ${len} m long train running at ${v} km/h crosses a platform ${plat} m long. How long does it take?`, T, [len / ms(v), plat / ms(v), T + 4, (len + plat) / v],
        `Distance = train + platform = ${len} + ${plat} = ${len + plat} m.<br>Speed = ${v} × 5/18 = ${ms(v)} m/s.<br>Time = ${len + plat}/${ms(v)} = <b>${fmt(T)} s</b>.`, { f: (x) => `${fmt(x)} s` });
    }
    for (;;) {
      const v1 = 18 * r.int(2, 6), v2 = 18 * r.int(1, 5);
      const opp = L === 2 || v1 === v2;
      const rel = opp ? ms(v1 + v2) : ms(Math.abs(v1 - v2));
      const t = r.int(5, 40);
      const tot = rel * t;
      if (tot < 120 || tot > 1000) continue;
      const l1 = 5 * r.int(10, tot / 5 - 10);
      const l2 = tot - l1;
      const other = opp ? Math.abs(v1 - v2) : v1 + v2;
      return numQ(r, `Two trains ${l1} m and ${l2} m long run ${opp ? 'in opposite directions' : 'in the same direction'} at ${v1} km/h and ${v2} km/h. How long will they take to cross each other completely?`, t,
        [other ? tot / ms(other) : t * 3, l1 / rel, t + 2, tot / ms(v1)],
        `Relative speed (${opp ? 'add' : 'subtract'}) = ${opp ? v1 + v2 : Math.abs(v1 - v2)} km/h = ${opp ? v1 + v2 : Math.abs(v1 - v2)} × 5/18 = ${rel} m/s.<br>Distance = sum of lengths = ${l1} + ${l2} = ${tot} m.<br>Time = ${tot}/${rel} = <b>${t} s</b>.`, { f: (x) => `${fmt(x)} s` });
    }
  }),
  def('q-tsd', 'boats-streams', 'Boats & streams', (r, L) => {
    for (;;) {
      const b = r.int(4, 20), s = r.int(1, 6);
      if (s >= b) continue;
      const t1 = r.int(2, 6), t2 = r.int(2, 6);
      const D1 = (b + s) * t1, D2 = (b - s) * t2;
      const askStream = L >= 2 && r.chance(0.5);
      if (L === 3) {
        // round trip: total time given for same distance
        const D = lcm(b + s, b - s) * r.int(1, 2);
        if (D > 200) continue;
        const T = D / (b + s) + D / (b - s);
        return numQ(r, `A boat's speed in still water is ${b} km/h and the stream flows at ${s} km/h. The boat goes ${D} km downstream and comes back. Find the total time taken.`, T,
          [(2 * D) / b, D / (b + s), T + 1, (2 * D) / (b + s)], `Downstream speed = ${b + s}, upstream = ${b - s} km/h.<br>Time = ${D}/${b + s} + ${D}/${b - s} = ${D / (b + s)} + ${D / (b - s)} = <b>${fmt(T)} h</b>.`,
          { f: (x) => `${fmt(x)} hours` });
      }
      const ans = askStream ? s : b;
      return numQ(r, `A boat covers ${D1} km downstream in ${t1} hours and ${D2} km upstream in ${t2} hours. Find the speed of the ${askStream ? 'stream' : 'boat in still water'}.`, ans,
        [askStream ? b : s, b + s, b - s, ans + 1], `Downstream speed = ${D1}/${t1} = ${b + s} km/h; upstream = ${D2}/${t2} = ${b - s} km/h.<br>${askStream ? `Stream = (${b + s} − ${b - s})/2` : `Boat = (${b + s} + ${b - s})/2`} = <b>${ans} km/h</b>.`,
        { f: (x) => `${fmt(x)} km/h` });
    }
  }),

  // ------------------------------------------------------------ Algebra
  def('q-algebra', 'x-plus-inverse', 'x + 1/x identities', (r, L) => {
    const k = r.int(2, L === 1 ? 6 : 9);
    const minus = L >= 2 && r.chance(0.4);
    const s = minus ? '−' : '+';
    if (L === 1) {
      const ans = k * k - 2;
      return numQ(r, `If x + 1/x = ${k}, find x² + 1/x².`, ans, [k * k, k * k + 2, 2 * k, ans - 1], `Square both sides: x² + 2 + 1/x² = ${k * k}.<br>x² + 1/x² = ${k * k} − 2 = <b>${ans}</b>.`);
    }
    if (L === 2) {
      const ans = minus ? k ** 3 + 3 * k : k ** 3 - 3 * k;
      return numQ(r, `If x ${s} 1/x = ${k}, find x³ ${s} 1/x³.`, ans, [k ** 3, minus ? k ** 3 - 3 * k : k ** 3 + 3 * k, k * k - 2, ans + k],
        `Identity: (x ${s} 1/x)³ = x³ ${s} 1/x³ ${s} 3(x ${s} 1/x).<br>x³ ${s} 1/x³ = ${k}³ ${minus ? '+' : '−'} 3 × ${k} = ${k ** 3} ${minus ? '+' : '−'} ${3 * k} = <b>${ans}</b>.`);
    }
    const sq = minus ? k * k + 2 : k * k - 2;
    const ans = sq * sq - 2;
    return numQ(r, `If x ${s} 1/x = ${k}, find x⁴ + 1/x⁴.`, ans, [sq * sq, k ** 4 - 2, sq * sq + 2, ans - 4],
      `Step 1: x² + 1/x² = ${k}² ${minus ? '+' : '−'} 2 = ${sq}.<br>Step 2: x⁴ + 1/x⁴ = ${sq}² − 2 = <b>${ans}</b>.`);
  }),
  def('q-algebra', 'cube-sum', 'a³ ± b³ and a² + b² + c²', (r, L) => {
    if (L === 3) {
      const a = r.int(-5, 9), b = r.int(1, 9), c = r.int(1, 9);
      const S = a + b + c, P = a * b + b * c + c * a;
      const ans = a * a + b * b + c * c;
      if (ans === S * S) return numQ(r, `If a + b + c = ${S} and ab + bc + ca = 0, find a² + b² + c².`, S * S, [S, 2 * S, S * S - 1], `a² + b² + c² = (a+b+c)² − 2(ab+bc+ca) = <b>${S * S}</b>.`);
      return numQ(r, `If a + b + c = ${S} and ab + bc + ca = ${P}, find a² + b² + c².`, ans, [S * S - P, S * S + 2 * P, S * S, ans + 2],
        `(a + b + c)² = a² + b² + c² + 2(ab + bc + ca).<br>a² + b² + c² = ${S}² − 2 × (${P}) = ${S * S} ${P >= 0 ? '−' : '+'} ${Math.abs(2 * P)} = <b>${ans}</b>.`, { allowNonPositive: true });
    }
    const a = r.int(2, 9), b = r.int(1, a - 1 || 1);
    const sum = L === 1 || r.chance(0.5);
    const p = a * b;
    if (sum) {
      const s = a + b, ans = s ** 3 - 3 * p * s;
      return numQ(r, `If a + b = ${s} and ab = ${p}, find a³ + b³.`, ans, [s ** 3, s ** 3 - p * s, s ** 3 + 3 * p * s, ans + s],
        `a³ + b³ = (a + b)³ − 3ab(a + b) = ${s}³ − 3 × ${p} × ${s} = ${s ** 3} − ${3 * p * s} = <b>${ans}</b>.`);
    }
    const d = a - b, ans = d ** 3 + 3 * p * d;
    return numQ(r, `If a − b = ${d} and ab = ${p}, find a³ − b³.`, ans, [d ** 3, d ** 3 - 3 * p * d, d ** 3 + p * d, ans + d],
      `a³ − b³ = (a − b)³ + 3ab(a − b) = ${d}³ + 3 × ${p} × ${d} = ${d ** 3} + ${3 * p * d} = <b>${ans}</b>.`, { allowNonPositive: true });
  }),

  // ------------------------------------------------------------ Geometry
  def('q-geometry', 'triangle-angles', 'Angles of a triangle', (r, L) => {
    for (;;) {
      const p = [r.int(1, 9), r.int(1, 9), r.int(1, 9)];
      const s = p[0] + p[1] + p[2];
      if (180 % s || new Set(p).size < 3) continue;
      const k = 180 / s;
      const ang = p.map((x) => x * k);
      const ask = L === 1 ? 'largest' : L === 2 ? 'smallest' : 'difference';
      const ans = ask === 'largest' ? Math.max(...ang) : ask === 'smallest' ? Math.min(...ang) : Math.max(...ang) - Math.min(...ang);
      const what = ask === 'difference' ? 'the difference between the largest and smallest angles' : `the ${ask} angle`;
      return numQ(r, `The angles of a triangle are in the ratio ${p.join(' : ')}. Find ${what}.`, ans, [...ang, ans + k, Math.max(...p) * 10],
        `Sum of angles = 180°. Total parts = ${s}, one part = 180/${s} = ${k}°.<br>Angles: ${ang.join('°, ')}°.<br>Answer: <b>${ans}°</b>.`, { f: (x) => `${fmt(x)}°` });
    }
  }),

  // ------------------------------------------------------------ Mensuration
  def('q-mensuration', 'circle', 'Circle area & circumference', (r, L) => {
    const rad = 7 * r.int(1, L === 1 ? 4 : 10);
    const A = (22 * rad * rad) / 7, Cc = (44 * rad) / 7;
    if (L === 1) {
      return numQ(r, `Find the area of a circle of radius ${rad} cm. (Use π = 22/7)`, A, [Cc, (22 * rad * rad * 2) / 7, A / 2, A + 22],
        `Area = πr² = 22/7 × ${rad} × ${rad} = <b>${A} cm²</b>.`, { f: (x) => `${fmt(x)} cm²` });
    }
    if (L === 2) {
      return numQ(r, `The circumference of a circle is ${Cc} cm. Find its area. (Use π = 22/7)`, A, [(22 * (2 * rad) ** 2) / 7, Cc * 2, A / 2, A + 44],
        `2πr = ${Cc} → r = ${Cc} × 7/44 = ${rad} cm.<br>Area = 22/7 × ${rad}² = <b>${A} cm²</b>.`, { f: (x) => `${fmt(x)} cm²` });
    }
    const p = r.pick([10, 20, 25, 50]);
    const inc = F((100 + p) ** 2, 100).sub(100);
    return numQ(r, `If the radius of a circle is increased by ${p}%, by what percent does its area increase?`, inc.value, [2 * p, p, inc.value + p, (p * p) / 100],
      `Area ∝ r². Successive change ${p}% and ${p}%: ${p} + ${p} + ${p}×${p}/100 = <b>${fmt(inc.value)}%</b>.`, { f: pc });
  }),
  def('q-mensuration', 'cylinder', 'Cylinder volume & surface', (r, L) => {
    const rad = 7 * r.int(1, 3), h = r.int(2, 20);
    const V = (22 * rad * rad * h) / 7, CSA = (44 * rad * h) / 7, TSA = (44 * rad * (rad + h)) / 7;
    if (L === 1) {
      return numQ(r, `Find the volume of a cylinder with radius ${rad} cm and height ${h} cm. (π = 22/7)`, V, [CSA, TSA, V / 2, (22 * rad * h) / 7],
        `V = πr²h = 22/7 × ${rad}² × ${h} = <b>${V} cm³</b>.`, { f: (x) => `${num(x)} cm³` });
    }
    if (L === 2) {
      return numQ(r, `Find the total surface area of a closed cylinder with radius ${rad} cm and height ${h} cm. (π = 22/7)`, TSA, [CSA, V, CSA + (22 * rad * rad) / 7, TSA + 44],
        `TSA = 2πr(r + h) = 2 × 22/7 × ${rad} × (${rad} + ${h}) = <b>${TSA} cm²</b>.`, { f: (x) => `${num(x)} cm²` });
    }
    return numQ(r, `The curved surface area of a cylinder is ${CSA} cm² and its height is ${h} cm. Find its volume. (π = 22/7)`, V, [CSA * h, TSA, V * 2, (V * 3) / 2],
      `2πrh = ${CSA} → r = ${CSA}/(2 × 22/7 × ${h}) = ${rad} cm.<br>V = πr²h = 22/7 × ${rad}² × ${h} = <b>${V} cm³</b>.`, { f: (x) => `${num(x)} cm³` });
  }),
  def('q-mensuration', 'cone', 'Cone volume & slant height', (r, L) => {
    for (;;) {
      const [p, q, hy] = r.pick([[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25]] as [number, number, number][]);
      const s = r.int(1, 7);
      const [rad, h] = r.chance(0.5) ? [p * s, q * s] : [q * s, p * s];
      const l = hy * s;
      if (rad % 7 || (rad * rad * h) % 21 || rad > 70) continue;
      const V = (22 * rad * rad * h) / 21, CSA = (22 * rad * l) / 7;
      if (L === 1) {
        return numQ(r, `Find the volume of a cone with radius ${rad} cm and height ${h} cm. (π = 22/7)`, V, [V * 3, CSA, V / 2, (22 * rad * h) / 21],
          `V = ⅓πr²h = ⅓ × 22/7 × ${rad}² × ${h} = <b>${num(V)} cm³</b>.`, { f: (x) => `${num(x)} cm³` });
      }
      return numQ(r, `A cone has radius ${rad} cm and height ${h} cm. Find its curved surface area. (π = 22/7)`, CSA, [(22 * rad * h) / 7, CSA + (22 * rad * rad) / 7, V, CSA / 2],
        `Slant height l = √(r² + h²) = √(${rad * rad} + ${h * h}) = ${l} cm.<br>CSA = πrl = 22/7 × ${rad} × ${l} = <b>${num(CSA)} cm²</b>.`, { f: (x) => `${num(x)} cm²` });
    }
  }),
  def('q-mensuration', 'cuboid', 'Cuboid volume, surface & diagonal', (r, L) => {
    if (L === 3) {
      const [a, b, c, d] = r.pick([[2, 3, 6, 7], [1, 4, 8, 9], [2, 6, 9, 11], [4, 4, 7, 9], [6, 6, 7, 11], [3, 4, 12, 13], [2, 10, 11, 15], [4, 8, 8, 12], [2, 5, 14, 15]] as number[][]);
      const s = r.int(1, 3);
      return numQ(r, `Find the length of the longest rod that can be placed in a room of dimensions ${a * s} m × ${b * s} m × ${c * s} m.`, d * s,
        [(a + b + c) * s, d * s + 1, Math.round(Math.sqrt((a * a + b * b) * s * s)) || d * s + 2, c * s],
        `Longest rod = body diagonal = √(l² + b² + h²) = √(${(a * s) ** 2} + ${(b * s) ** 2} + ${(c * s) ** 2}) = √${(d * s) ** 2} = <b>${d * s} m</b>.`, { f: (x) => `${fmt(x)} m` });
    }
    const l = r.int(3, 20), b = r.int(2, 15), h = r.int(2, 12);
    if (L === 1) {
      const V = l * b * h;
      return numQ(r, `Find the volume of a cuboid of length ${l} cm, breadth ${b} cm and height ${h} cm.`, V, [2 * (l * b + b * h + h * l), l + b + h, V + l, l * b],
        `V = l × b × h = ${l} × ${b} × ${h} = <b>${V} cm³</b>.`, { f: (x) => `${num(x)} cm³` });
    }
    const T = 2 * (l * b + b * h + h * l);
    return numQ(r, `Find the total surface area of a cuboid ${l} cm × ${b} cm × ${h} cm.`, T, [T / 2, l * b * h, T + 2 * l, 2 * h * (l + b)],
      `TSA = 2(lb + bh + hl) = 2(${l * b} + ${b * h} + ${h * l}) = <b>${T} cm²</b>.`, { f: (x) => `${num(x)} cm²` });
  }),

  // ------------------------------------------------------------ Trigonometry
  def('q-trigonometry', 'standard-values', 'Standard angle values', (r, L) => {
    const T: [string, Fr][] = [
      ['sin 30°', F(1, 2)], ['cos 60°', F(1, 2)], ['tan 45°', F(1)], ['sin² 45°', F(1, 2)], ['cos² 30°', F(3, 4)], ['tan² 60°', F(3)],
      ['sec² 45°', F(2)], ['cosec 30°', F(2)], ['cot² 30°', F(3)], ['sin 90°', F(1)], ['cos 0°', F(1)], ['tan² 30°', F(1, 3)],
      ['sin² 60°', F(3, 4)], ['cos² 45°', F(1, 2)], ['sec 60°', F(2)], ['cosec² 45°', F(2)], ['cot 45°', F(1)], ['sec² 30°', F(4, 3)],
    ];
    const k = L === 1 ? 2 : 3;
    const terms = r.sample(T, k);
    const coefs = terms.map(() => (L === 3 ? r.int(1, 4) : r.int(1, 2)));
    const ops = terms.slice(1).map(() => r.pick(L === 1 ? ['+'] : ['+', '+', '−']));
    let v = terms[0][1].mul(coefs[0]);
    for (let i = 1; i < k; i++) v = ops[i - 1] === '+' ? v.add(terms[i][1].mul(coefs[i])) : v.sub(terms[i][1].mul(coefs[i]));
    const show = (c: number, t: string) => (c === 1 ? t : `${c} ${t}`);
    const expr = terms.map((t, i) => (i ? ` ${ops[i - 1]} ` : '') + show(coefs[i], t[0])).join('');
    const subs = terms.map((t, i) => (i ? ` ${ops[i - 1]} ` : '') + (coefs[i] === 1 ? '' : `${coefs[i]} × `) + t[1].toString()).join('');
    return frQ(r, `Find the value of ${expr}.`, v, [v.add(F(1, 2)), v.sub(1), v.add(1), v.mul(2), terms.reduce((a, t) => a.add(t[1]), F(0))],
      `Substitute standard values: ${terms.map((t) => `${t[0]} = ${t[1].toString()}`).join(', ')}.<br>${subs} = <b>${v.toString()}</b>.`);
  }),
  def('q-trigonometry', 'identities', 'Trigonometric identities', (r, L) => {
    if (L === 1) {
      const k = r.int(2, 9);
      const ans = F(1, k);
      return frQ(r, `If sec θ + tan θ = ${k}, find sec θ − tan θ.`, ans, [F(k), F(k - 1), F(1, k + 1), F(k, 2), F(2, k)],
        `sec²θ − tan²θ = 1 → (sec θ + tan θ)(sec θ − tan θ) = 1.<br>sec θ − tan θ = <b>1/${k}</b>.`);
    }
    if (L === 2) {
      for (;;) {
        const a = r.int(1, 9), b = r.int(1, 9), p = r.int(1, 5), q = r.int(1, 5), s = r.int(1, 5), t = r.int(1, 5);
        if (gcd(a, b) !== 1 || s * a - t * b === 0 || a === b) continue;
        const ans = F(p * a + q * b, s * a - t * b);
        return frQ(r, `If tan θ = ${a}/${b}, find (${p === 1 ? '' : p}sin θ + ${q === 1 ? '' : q}cos θ)/(${s === 1 ? '' : s}sin θ − ${t === 1 ? '' : t}cos θ).`, ans,
          [F(p * b + q * a, s * b - t * a || 1), F(p * a - q * b || 1, s * a + t * b), ans.mul(-1), ans.add(1)],
          `Divide numerator and denominator by cos θ: (${p === 1 ? '' : p}tan θ + ${q})/(${s === 1 ? '' : s}tan θ − ${t}).<br>= (${p} × ${a}/${b} + ${q})/(${s} × ${a}/${b} − ${t}) = (${p * a + q * b})/(${s * a - t * b}) = <b>${ans.toString()}</b>.`);
      }
    }
    const [p, b, h] = r.pick(TRIPLES);
    const sw = r.chance(0.5);
    const [opp, adj] = sw ? [p, b] : [b, p];
    const g = gcd(opp, h);
    const sinT = F(opp, h), cosT = F(adj, h);
    const v = sinT.mul(cosT);
    return frQ(r, `If sin θ = ${opp / g}/${h / g} (θ acute), find sin θ · cos θ.`, v, [sinT, cosT, sinT.add(cosT), F(opp, adj), v.add(F(1, h))],
      `Make a right triangle: opposite ${opp / g}, hypotenuse ${h / g} → adjacent = √(${(h / g) ** 2} − ${(opp / g) ** 2}) = ${adj / g}.<br>cos θ = ${cosT.toString()}.<br>sin θ · cos θ = ${sinT.toString()} × ${cosT.toString()} = <b>${v.toString()}</b>.`);
  }),
  def('q-trigonometry', 'heights-distances', 'Heights & distances', (r, L) => {
    const d = r.int(2, 20) * 5;
    const ang = L === 1 ? 45 : r.pick([30, 60]);
    if (ang === 45) {
      return strQ(r, `From a point ${d} m away from the foot of a tower, the angle of elevation of its top is 45°. Find the height of the tower.`, `${d} m`,
        [`${d}√3 m`, `${d * 2} m`, `${d}/√3 m`, `${d / 5 * 4} m`], `tan 45° = h/${d} = 1 → h = <b>${d} m</b>.`, (i) => `${d + 5 * i} m`);
    }
    const ans = ang === 60 ? `${d}√3 m` : `${d}/√3 m`;
    const alt = ang === 60 ? `${d}/√3 m` : `${d}√3 m`;
    return strQ(r, `From a point ${d} m away from the foot of a tower, the angle of elevation of its top is ${ang}°. Find the height of the tower.`, ans,
      [alt, `${d} m`, `${d * 2} m`, `${d}√2 m`], `tan ${ang}° = h/${d} → h = ${d} × tan ${ang}° = ${d} × ${ang === 60 ? '√3' : '1/√3'} = <b>${ans}</b>.`,
      (i) => `${d + 5 * i}√3 m`);
  }),

  // ------------------------------------------------------------ Coordinate geometry
  def('q-coordinate', 'distance', 'Distance between points', (r, L) => {
    const [a, b, c] = r.pick(L === 1 ? TRIPLES.slice(0, 3) : TRIPLES);
    const x1 = r.int(-9, 9), y1 = r.int(-9, 9);
    const sx = r.pick([1, -1]), sy = r.pick([1, -1]);
    const x2 = x1 + sx * a, y2 = y1 + sy * b;
    const P = (x: number, y: number) => `(${x}, ${y})`;
    return numQ(r, `Find the distance between the points ${P(x1, y1)} and ${P(x2, y2)}.`, c, [a + b, c + 1, Math.abs(a - b) + c, c * 2 - a],
      `d = √[(x₂ − x₁)² + (y₂ − y₁)²] = √(${a}² + ${b}²) = √${c * c} = <b>${c}</b> units.`, { f: (x) => `${fmt(x)} units` });
  }),
  def('q-coordinate', 'section-formula', 'Section formula', (r, L) => {
    const m = r.int(1, L === 1 ? 1 : 4), n = r.int(1, L === 1 ? 1 : 4);
    const px = r.int(-8, 8), py = r.int(-8, 8), tx = r.int(-3, 3) || 2, ty = r.int(-3, 3) || -1;
    const x1 = px - m * tx, y1 = py - m * ty, x2 = px + n * tx, y2 = py + n * ty;
    const P = (x: number, y: number) => `(${x}, ${y})`;
    const ans = P(px, py);
    const wrong = (a: number, b: number) => P(Math.round((a * x2 + b * x1) / (a + b)), Math.round((a * y2 + b * y1) / (a + b)));
    const what = m === n ? 'the midpoint of the segment joining' : `the point dividing the segment joining`;
    return strQ(r, `Find ${what} A${P(x1, y1)} and B${P(x2, y2)}${m === n ? '' : ` internally in the ratio ${m} : ${n}`}.`, ans,
      [wrong(n, m), P(px + tx, py), P(py, px), P(x2 - x1, y2 - y1), P(-px, -py)],
      `Section formula: P = ((m x₂ + n x₁)/(m + n), (m y₂ + n y₁)/(m + n)).<br>x = (${m}×${x2} + ${n}×${x1})/${m + n} = ${px}; y = (${m}×${y2} + ${n}×${y1})/${m + n} = ${py}.<br>Point = <b>${ans}</b>.`,
      (i) => P(px + i, py - i));
  }),
  def('q-coordinate', 'slope', 'Slope of a line', (r, L) => {
    if (L === 3) {
      const a = r.int(1, 9) * r.pick([1, -1]), b = r.int(1, 9), c = r.int(1, 9) * r.pick([1, -1]);
      const m = F(-a, b);
      const perp = F(b, a);
      return frQ(r, `Find the slope of a line perpendicular to ${lin(a, 0)} + ${b === 1 ? '' : b}y ${c < 0 ? '−' : '+'} ${Math.abs(c)} = 0.`, perp, [m, F(a, b), perp.mul(-1), F(-b, Math.abs(a) + 1)],
        `Slope of ax + by + c = 0 is −a/b = ${m.toString()}.<br>Perpendicular slopes multiply to −1 → slope = <b>${perp.toString()}</b>.`);
    }
    for (;;) {
      const x1 = r.int(-6, 6), y1 = r.int(-6, 6), x2 = r.int(-6, 6), y2 = r.int(-6, 6);
      if (x1 === x2 || y1 === y2) continue;
      const m = F(y2 - y1, x2 - x1);
      if (L === 1 && !m.isInt) continue;
      return frQ(r, `Find the slope of the line passing through (${x1}, ${y1}) and (${x2}, ${y2}).`, m, [F(x2 - x1, y2 - y1), m.mul(-1), F(y2 + y1, x2 + x1 || 1), m.add(1)],
        `m = (y₂ − y₁)/(x₂ − x₁) = (${y2} − (${y1}))/(${x2} − (${x1})) = ${y2 - y1}/${x2 - x1} = <b>${m.toString()}</b>.`);
    }
  }),

  // ------------------------------------------------------------ Statistics
  def('q-statistics', 'mean-median-mode', 'Mean, median & mode', (r, L) => {
    const kind = r.pick(L === 1 ? ['mean', 'median'] : L === 2 ? ['mean', 'median', 'mode'] : ['empirical', 'mode', 'median']);
    if (kind === 'empirical') {
      const mean = r.int(20, 60), med = mean + r.int(-6, 6) || mean + 3;
      const mode = 3 * med - 2 * mean;
      return numQ(r, `For a moderately skewed distribution, mean = ${mean} and median = ${med}. Find the mode (empirical relation).`, mode, [2 * med - 3 * mean, 3 * mean - 2 * med, med, mode + 3],
        `Mode = 3 Median − 2 Mean = 3 × ${med} − 2 × ${mean} = <b>${mode}</b>.`, { allowNonPositive: true });
    }
    const n = L === 1 ? r.pick([5, 7]) : r.pick([6, 7, 8, 9]);
    const xs = Array.from({ length: n }, () => r.int(5, 60));
    if (kind === 'mode') {
      const m = r.int(5, 60);
      xs.length = 0;
      const pool = r.sample(Array.from({ length: 56 }, (_, i) => i + 5).filter((v) => v !== m), n - 3);
      xs.push(m, m, m, ...pool.slice(0, n - 3));
      if (n - 3 >= 2) xs[3] = xs[4] = pool[0];
      const data = r.shuffle(xs);
      return numQ(r, `Find the mode of: ${data.join(', ')}.`, m, [pool[0], Math.max(...data), Math.min(...data), data[Math.floor(n / 2)]],
        `Mode = most frequent value. ${m} occurs 3 times → mode = <b>${m}</b>.`);
    }
    if (kind === 'mean') {
      const s = xs.reduce((a, b) => a + b, 0);
      xs[n - 1] += (n - (s % n)) % n;
      const tot = xs.reduce((a, b) => a + b, 0);
      const mean = tot / n;
      return numQ(r, `Find the mean of: ${xs.join(', ')}.`, mean, [tot / (n - 1), mean + 1, [...xs].sort((a, b) => a - b)[Math.floor(n / 2)], mean - 2],
        `Sum = ${tot}; count = ${n}.<br>Mean = ${tot}/${n} = <b>${fmt(mean)}</b>.`);
    }
    const sorted = [...xs].sort((a, b) => a - b);
    const med = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
    return numQ(r, `Find the median of: ${xs.join(', ')}.`, med, [xs[Math.floor(n / 2)], sorted[Math.floor(n / 2) + 1], sorted[Math.floor(n / 2) - 1], xs.reduce((a, b) => a + b, 0) / n],
      `Arrange in order: ${sorted.join(', ')}.<br>${n % 2 ? `n = ${n} is odd → middle (${(n + 1) / 2}th) value` : `n = ${n} is even → mean of ${n / 2}th and ${n / 2 + 1}th values (${sorted[n / 2 - 1]}, ${sorted[n / 2]})`} = <b>${fmt(med)}</b>.`);
  }),

  // ------------------------------------------------------------ Probability
  def('q-probability', 'dice', 'Probability with dice', (r, L) => {
    const outcomes: [number, number][] = [];
    for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) outcomes.push([a, b]);
    const events: [string, (a: number, b: number) => boolean][] = [
      ['a doublet (same number on both)', (a, b) => a === b],
      ['a sum of 7', (a, b) => a + b === 7],
      ['a sum of 8', (a, b) => a + b === 8],
      ['a sum of 9', (a, b) => a + b === 9],
      ['a sum less than 5', (a, b) => a + b < 5],
      ['a sum greater than 9', (a, b) => a + b > 9],
      ['a product that is even', (a, b) => (a * b) % 2 === 0],
      ['a sum that is a prime number', (a, b) => [2, 3, 5, 7, 11].includes(a + b)],
      ['a sum that is a multiple of 3', (a, b) => (a + b) % 3 === 0],
      ['at least one six', (a, b) => a === 6 || b === 6],
      ['a product that is a perfect square', (a, b) => [1, 4, 9, 16, 25, 36].includes(a * b)],
    ];
    if (L === 1) {
      const kinds: [string, (x: number) => boolean][] = [['an even number', (x) => x % 2 === 0], ['a prime number', (x) => [2, 3, 5].includes(x)], ['a number greater than 4', (x) => x > 4], ['a multiple of 3', (x) => x % 3 === 0]];
      const [desc, f] = r.pick(kinds);
      const c = [1, 2, 3, 4, 5, 6].filter(f).length;
      const ans = F(c, 6);
      return frQ(r, `A fair die is thrown once. What is the probability of getting ${desc}?`, ans, [F(c + 1, 6), F(1, 6), F(c, 5), F(6 - c, 6)].filter((x) => x.value < 1),
        `Favourable outcomes: ${[1, 2, 3, 4, 5, 6].filter(f).join(', ')} → ${c} of 6.<br>P = ${c}/6 = <b>${ans.toString()}</b>.`);
    }
    const [desc, f] = r.pick(L === 2 ? events.slice(0, 7) : events.slice(4));
    const fav = outcomes.filter(([a, b]) => f(a, b));
    const ans = F(fav.length, 36);
    const list = fav.length <= 8 ? ` (${fav.map(([a, b]) => `(${a},${b})`).join(', ')})` : '';
    return frQ(r, `Two fair dice are thrown together. What is the probability of getting ${desc}?`, ans,
      [F(fav.length + 1, 36), F(36 - fav.length, 36), F(fav.length, 12), F(fav.length - 1 || 2, 36), F(fav.length + 2, 36)].filter((x) => x.value < 1),
      `Total outcomes = 6 × 6 = 36.<br>Favourable outcomes = ${fav.length}${list}.<br>P = ${fav.length}/36 = <b>${ans.toString()}</b>.`);
  }),
  def('q-probability', 'coins', 'Probability with coins', (r, L) => {
    const n = L === 1 ? 2 : L === 2 ? 3 : r.pick([3, 4]);
    const tot = 2 ** n;
    const kind = r.pick(['exact', 'atleast', 'atmost']);
    const k = r.int(1, n - 1);
    let fav: number, desc: string, how: string;
    if (kind === 'exact') { fav = C(n, k); desc = `exactly ${k} head${k > 1 ? 's' : ''}`; how = `C(${n}, ${k}) = ${fav}`; }
    else if (kind === 'atleast') {
      fav = 0; for (let i = k; i <= n; i++) fav += C(n, i);
      desc = `at least ${k} head${k > 1 ? 's' : ''}`; how = k === 1 ? `All outcomes except "no head": ${tot} − 1 = ${fav}` : `Σ C(${n}, i) for i = ${k}…${n} = ${fav}`;
    } else {
      fav = 0; for (let i = 0; i <= k; i++) fav += C(n, i);
      desc = `at most ${k} head${k > 1 ? 's' : ''}`; how = `Σ C(${n}, i) for i = 0…${k} = ${fav}`;
    }
    const ans = F(fav, tot);
    return frQ(r, `${n} fair coins are tossed together. What is the probability of getting ${desc}?`, ans,
      [F(C(n, k), tot), F(fav, tot * 2), F(tot - fav || 1, tot), F(k, n), ans.add(F(1, tot)), ans.sub(F(1, tot))].filter((x) => x.value < 1),
      `Total outcomes = 2<sup>${n}</sup> = ${tot}.<br>Favourable: ${how}.<br>P = ${fav}/${tot} = <b>${ans.toString()}</b>.`);
  }),
];

