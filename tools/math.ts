// LaTeX → HTML at build time (KaTeX), so phones download no maths library and it works offline.
// Supported delimiters: \( … \) and $ … $ inline; \[ … \] and $$ … $$ on their own line.
// A single-$ span counts as maths only if it looks like it ($5 and $10 stays text).
// Anything KaTeX can't parse is left as the original text, and counted in `mathStats.failed`.
import katex from 'katex';

export const mathStats = { rendered: 0, fractions: 0, stripped: 0, failed: 0, failures: [] as string[] };

// ---- plain-text fractions in the past-paper source: "(3)/(10)", "283(1)/(2)", "(58²-25²)/(46²-37²)", "(sin theta)/(x)"
// Only simple pieces are converted (numbers, letters, a few known words, + - × ² ³ √); anything else stays as written.
/** A whole number glued to (or one space before) a proper fraction: a mixed number. */
const MIXED = /(?<![\w.)])(\d{1,6}) ?\((\d{1,4})\)\/\((\d{1,4})\)(?![\w(])/g;
const FRACTION = /\(([^()<>&;{}\\\n]{1,40})\)\/\(([^()<>&;{}\\\n]{1,40})\)/g;
const SUP: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-', 'ⁿ': 'n' };
const WORDS: Record<string, string> = { sin: '\\sin', cos: '\\cos', tan: '\\tan', cot: '\\cot', sec: '\\sec', cosec: '\\operatorname{cosec}', theta: '\\theta', alpha: '\\alpha', beta: '\\beta', pi: '\\pi', times: '\\times', sqrt: '' };
// ---- LaTeX whose backslashes were stripped upstream: "sqrt{8 + sqrt{1681}}", "{{{a}}^{2}}", "frac{3}{4}", "2 times 3"
const CMDS = 'sqrt|dfrac|tfrac|frac|times|div|theta|alpha|beta|pi|sin|cos|tan|cot|sec|cosec|circ|overline|Rightarrow|Leftrightarrow|left|right|text|rm|mathrm|cdot|pm|angle|triangle|degree';
const ATOM_START = new RegExp(`(?<![A-Za-z\\\\])(?:${'sqrt|dfrac|tfrac|frac|overline'})\\s*(?:\\[[^\\]]{1,5}\\])?\\{|\\{\\{|[A-Za-z0-9)\\]}]\\^\\{`, 'g');
/** End index (exclusive) of the balanced {…} group starting at i, or -1. */
function group(s: string, i: number): number {
  if (s[i] !== '{') return -1;
  let d = 0;
  for (let k = i; k < s.length && k < i + 400; k++) { if (s[k] === '{') d++; else if (s[k] === '}' && --d === 0) return k + 1; }
  return -1;
}
/** Find stripped-LaTeX runs; return [start, end) spans. */
function strippedTexSpans(s: string): [number, number][] {
  const spans: [number, number][] = [];
  ATOM_START.lastIndex = 0;
  for (let m: RegExpExecArray | null; (m = ATOM_START.exec(s)); ) {
    let start = m.index;
    if (/\^\{$/.test(m[0])) { start = m.index + 1; while (start > 0 && /[A-Za-z0-9.]/.test(s[start - 1])) start--; if (s[m.index] === ')' || s[m.index] === ']' || s[m.index] === '}') start = m.index + 1; }
    if (spans.length && start < spans[spans.length - 1][1]) continue;
    let k = start;
    // consume tokens: base characters, commands, [n], balanced groups, ^ and _
    for (let guard = 0; k < s.length && guard < 60; guard++) {
      const rest = s.slice(k);
      const cmd = rest.match(new RegExp(`^(?:${CMDS})(?=[{\\[\\s^_])`));
      if (s[k] === '{') { const e = group(s, k); if (e < 0) { k = -1; break; } k = e; }
      else if (cmd) k += cmd[0].length + (rest[cmd[0].length] === ' ' && rest[cmd[0].length + 1] === '{' ? 1 : 0);
      else if (s[k] === '[' && /^\[[^\]]{1,5}\]\{/.test(rest)) k = s.indexOf(']', k) + 1;
      else if (s[k] === '^' || s[k] === '_') k++;
      else if (k === start && /[A-Za-z0-9.]/.test(s[k])) k++;
      else if (/[A-Za-z0-9.]/.test(s[k]) && /[A-Za-z0-9.]/.test(s[k - 1]) && k < m.index + m[0].length) k++;
      else break;
    }
    if (k > start + 2) spans.push([start, k]);
  }
  return spans;
}
const SUPS = /[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g;
function strippedToTex(raw: string): string | null {
  const opens = (raw.match(/\(/g) ?? []).length, closes = (raw.match(/\)/g) ?? []).length;
  if (opens !== closes) return null; // garbled mixes like "frac{1)/(x)": leave as written
  return raw.replace(new RegExp(`(?<![A-Za-z\\\\])(${CMDS})(?![A-Za-z])`, 'g'), '\\$1').replace(/\\degree/g, '^{\\circ}')
    .replace(SUPS, (m) => `^{${[...m].map((c) => SUP[c]).join('')}}`).replace(/[×]/g, '\\times ').replace(/÷/g, '\\div ').replace(/√/g, '\\surd ');
}
/** Number-word operators outside any maths: "2 times 3" → "2 × 3"; "⇒" for the stripped arrow. */
function strippedOperators(s: string): string {
  return s.replace(/(?<=[\d)}²³]\s?)\btimes\b(?=\s?[\d({√])/g, '×').replace(/(?<=[\d)}²³]\s?)\bdiv\b(?=\s?[\d({√])/g, '÷')
    .replace(/(?<![A-Za-z\\])Rightarrow\b/g, '⇒').replace(/(?<![A-Za-z\\])Leftrightarrow\b/g, '⇔');
}

/** One side of a plain-text fraction as TeX, or null when it is not simple enough to convert safely. */
function slashPart(raw: string): string | null {
  let s = raw.trim().replace(/[−–]/g, '-').replace(/[×*]/g, ' \\times ').replace(/·/g, ' \\cdot ').replace(/π/g, ' \\pi ').replace(/θ/g, ' \\theta ');
  if (!s || !/[0-9A-Za-z]/.test(s)) return null;
  for (const w of s.match(/[A-Za-z]{2,}/g) ?? []) if (!(w.toLowerCase() in WORDS) && w.length > 3) return null; // a word, not maths
  s = s.replace(/[A-Za-z]{2,}/g, (w) => (w.toLowerCase() in WORDS ? `${WORDS[w.toLowerCase()]} ` : w));
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻ⁿ]+/g, (m) => `^{${[...m].map((c) => SUP[c]).join('')}}`);
  s = s.replace(/√\s*(\d+(?:\.\d+)?|[A-Za-z])/g, '\\sqrt{$1}').replace(/ \\sqrt\s*(\d+|[A-Za-z])/g, ' \\sqrt{$1}');
  if (/√/.test(s) || !/^[\w\s.+\-=^{}\\]+$/.test(s)) return null;
  return s;
}

const PATTERNS: { re: RegExp; display: boolean }[] = [
  { re: /\\\[([\s\S]+?)\\\]/g, display: true },
  { re: /\$\$([\s\S]+?)\$\$/g, display: true },
  { re: /\\\(([\s\S]+?)\\\)/g, display: false },
  { re: /\$([^$\n]{1,400}?)\$/g, display: false },
];
const looksLikeMath = (tex: string) => /[\\^_{}]/.test(tex) || /^[\sA-Za-z0-9+\-*/=().,<>|]+$/.test(tex) && /[=+\-*/^]/.test(tex) && !/\s{2,}/.test(tex);
const escapeText = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// the source sometimes stores maths with HTML entities; KaTeX needs the characters
const decode = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/<br\s*\/?>/gi, ' ');

export function renderTex(tex: string, display: boolean): string | null {
  try {
    // digit groups ("87,500", "1,56,250") keep a tight comma; inline maths uses display size so fractions stay readable on phones
    const src = decode(tex).trim().replace(/(\d),(?=\d)/g, '$1{,}');
    return katex.renderToString(display ? src : `\\displaystyle ${src}`, { displayMode: display, output: 'html', throwOnError: true, strict: 'ignore', trust: false });
  } catch (e) {
    mathStats.failed++;
    if (mathStats.failures.length < 30) mathStats.failures.push(`${tex.slice(0, 80)} | ${(e as Error).message.slice(0, 80)}`);
    return null;
  }
}

/**
 * Pull maths out of `s` before other processing (escaping, markdown) can damage it.
 * Returns the text with placeholders, and `restore` to put the rendered HTML back afterwards.
 */
export function extractMath(s: string, o: { fractions?: boolean } = {}): { text: string; restore: (html: string) => string } {
  const out: string[] = [];
  let text = s;
  for (const { re, display } of PATTERNS) {
    text = text.replace(re, (whole: string, tex: string) => {
      if (!display && whole.startsWith('$') && !looksLikeMath(tex)) return whole;
      const r = renderTex(tex, display);
      if (r === null) { out.push(escapeText(tex)); } else { out.push(r); mathStats.rendered++; }
      return `\u0001M${out.length - 1}\u0001`;
    });
  }
  if (o.fractions) {
    // runs after the delimited maths above, so it never touches LaTeX that is already there
    // 1. LaTeX that lost its backslashes
    let rebuilt = '', last = 0;
    for (const [a, b] of strippedTexSpans(text)) {
      const tex = strippedToTex(text.slice(a, b));
      const r = tex === null ? null : renderTex(tex, false);
      rebuilt += text.slice(last, a);
      if (r === null) rebuilt += text.slice(a, b); else { out.push(r); mathStats.stripped++; rebuilt += `\u0001M${out.length - 1}\u0001`; }
      last = b;
    }
    text = strippedOperators(rebuilt + text.slice(last))
      // unbalanced leftovers around repaired maths ("( {{a² + b²} )"); single braces elsewhere may be set notation, so they stay
      .replace(/[{}]*(\u0001M\d+\u0001)[{}]*/g, '$1').replace(/\{\{+|\}\}+/g, '');
    // 2. plain-text fractions
    text = text.replace(MIXED, (whole: string, n: string, a: string, b: string) => {
      if (Number(a) >= Number(b) || Number(b) === 0) return whole; // "3(10)/(3)" may be a product: leave it
      const r = renderTex(`${n}\\tfrac{${a}}{${b}}`, false);
      if (r === null) return whole;
      out.push(r); mathStats.fractions++;
      return `\u0001M${out.length - 1}\u0001`;
    });
    text = text.replace(FRACTION, (whole: string, a: string, b: string, at: number, all: string) => {
      // a digit right before a numeric fraction would read as a mixed number: only MIXED may decide that
      if (/\d ?$/.test(all.slice(Math.max(0, at - 2), at)) && /^\s*[\d.]+\s*$/.test(a) && /^\s*[\d.]+\s*$/.test(b)) return whole;
      const ta = slashPart(a), tb = slashPart(b);
      if (ta === null || tb === null) return whole;
      const r = renderTex(`\\frac{${ta}}{${tb}}`, false);
      if (r === null) return whole;
      out.push(r); mathStats.fractions++;
      return `\u0001M${out.length - 1}\u0001`;
    });
  }
  return { text, restore: (h: string) => h.replace(/\u0001M(\d+)\u0001/g, (_, i: string) => out[Number(i)]) };
}

/** Render maths inside an HTML string that needs no other processing (curated content). */
export function renderMathIn(html: string): string {
  if (!/\\\(|\\\[|\$/.test(html)) return html;
  const { text, restore } = extractMath(html);
  return restore(text);
}

/** Apply renderMathIn to every string inside a JSON-like value. */
export function renderMathDeep<T>(v: T): T {
  if (typeof v === 'string') return renderMathIn(v) as T;
  if (Array.isArray(v)) return v.map(renderMathDeep) as T;
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, renderMathDeep(x)])) as T;
  return v;
}
