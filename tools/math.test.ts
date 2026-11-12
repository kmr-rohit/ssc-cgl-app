import { describe, expect, it } from 'vitest';
import { extractMath, renderMathDeep, renderMathIn } from './math';

describe('build-time maths rendering', () => {
  it('renders \\( \\) and $ $ inline, \\[ \\] and $$ $$ as display', () => {
    expect(renderMathIn('x = \\(\\frac{1}{2}\\)')).toContain('class="katex"');
    expect(renderMathIn('so $\\tan 60^\\circ = \\sqrt{3}$ here')).toContain('class="katex"');
    expect(renderMathIn('\\[a^2 + b^2\\]')).toContain('katex-display');
    expect(renderMathIn('$$a^2$$')).toContain('katex-display');
  });

  it('leaves currency and plain text alone', () => {
    expect(renderMathIn('costs $5 and $10 each')).toBe('costs $5 and $10 each');
    expect(renderMathIn('no maths here')).toBe('no maths here');
  });

  it('keeps unparseable maths as escaped text instead of an error box', () => {
    const out = renderMathIn('bad \\(\\frac{1}{\\)');
    expect(out).not.toContain('katex-error');
    expect(out).toContain('\\frac{1}{');
  });

  it('protects maths from later processing via placeholders', () => {
    const { text, restore } = extractMath('a < b and \\(x < y\\)');
    expect(text).not.toContain('x < y');
    const html = restore(text.replace(/</g, '&lt;'));
    expect(html).toContain('a &lt; b');
    expect(html).toContain('class="katex"');
  });

  it('walks nested content', () => {
    const out = renderMathDeep({ notes: { tips: ['\\(x^2\\)'] }, n: 3 });
    expect(out.notes.tips[0]).toContain('class="katex"');
    expect(out.n).toBe(3);
  });
});

describe('readability tweaks', () => {
  it('keeps Indian digit grouping tight and inline fractions full size', () => {
    const out = renderMathIn('\\(1,56,250\\)');
    expect(out).not.toMatch(/mspace/); // KaTeX puts a thin space after a bare comma
    expect(renderMathIn('\\(\\frac{1}{3}\\)')).toContain('mfrac');
  });
});

describe('plain-text fractions from the past-paper source', () => {
  const f = (s: string) => { const { text, restore } = extractMath(s, { fractions: true }); return restore(text); };
  it('converts numeric, mixed and simple algebraic fractions', () => {
    expect(f('If (3)/(10) of A')).toContain('mfrac');
    expect(f('283(1)/(2) π cm³')).toContain('mfrac');
    expect(f('5 (1)/(3)%')).toContain('mfrac');
    expect(f('x + (1)/(x) = 4')).toContain('mfrac');
    expect(f('A=(58²-25²)/(46²-37²)')).toContain('mfrac');
    expect(f('(sin theta)/(x)')).toContain('mfrac');
  });
  it('leaves words, broken braces and ambiguous products alone', () => {
    expect(f('(Difference in SI)/(Time)')).toBe('(Difference in SI)/(Time)');
    expect(f('(1)/(2 sqrt{3)}')).toBe('(1)/(2 sqrt{3)}');
    expect(f('3(10)/(3)')).not.toMatch(/^3<span/);
  });
  it('is off unless asked for', () => {
    expect(renderMathIn('(1)/(2)')).toBe('(1)/(2)');
  });
});

describe('LaTeX that lost its backslashes', () => {
  const f = (s: string) => { const { text, restore } = extractMath(s, { fractions: true }); return restore(text); };
  it('repairs sqrt, frac and brace-wrapped powers', () => {
    expect(f('expression.sqrt{8 + sqrt{1681}} is')).toMatch(/^expression\.<span class="katex">.*sqrt.*<\/span> is$/s);
    expect(f('value frac{3}{4} of')).toContain('mfrac');
    expect(f('( {{{{a}}^{2}} + {{{b}}^{2}} )')).not.toContain('{{');
  });
  it('turns operator words into symbols only between numbers', () => {
    expect(f('7 times 7 div 5 Rightarrow x')).toBe('7 × 7 ÷ 5 ⇒ x');
    expect(f('13 appears 2 times, 15 appears 3 times.')).toBe('13 appears 2 times, 15 appears 3 times.');
  });
  it('leaves garbled mixes alone', () => {
    expect(f('((x³+frac{1)/(x))}{x²+1}')).toContain('frac{1)');
  });
});
