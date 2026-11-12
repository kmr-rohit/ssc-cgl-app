// Rendering helpers. All content HTML goes through DOMPurify before reaching the DOM.
import DOMPurify from 'dompurify';
import { html, type TemplateResult } from 'lit-html';
import { unsafeHTML } from 'lit-html/directives/unsafe-html.js';
import { assetUrl } from '../content/bank';

const CONTENT_TAGS = ['b', 'i', 'em', 'strong', 'u', 'br', 'p', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'sub', 'sup', 'span', 'code', 'small', 'mark', 'div'];
const SVG_TAGS = ['svg', 'g', 'path', 'line', 'rect', 'circle', 'ellipse', 'polygon', 'polyline', 'text', 'tspan', 'defs', 'marker', 'title'];

// Past-paper figures are the only images allowed inside content HTML, and only from our own /pyq/img/ folder.
DOMPurify.addHook('uponSanitizeElement', (node, data) => {
  if (data.tagName !== 'img') return;
  const src = (node as Element).getAttribute?.('src') ?? '';
  if (!/^\/pyq\/img\/[a-f0-9]{16}\.webp$/.test(src)) node.parentNode?.removeChild(node);
});

// Content can come from another user (a challenge paper), so layout attributes are narrowed to what our content uses:
// KaTeX's classes and its positioning styles. That rules out app classes or styles that could cover the screen.
const CLASS_OK = /^(katex[\w-]*|m[a-z]+|vlist[\w-]*|pstrut|frac-line|nulldelimiter|sizing|reset-size\d+|size\d+|svg-align|sqrt|hide-tail|delim[\w-]*|accent[\w-]*|overline[\w-]*|underline[\w-]*|hbox|op-[\w-]+|large-op|small-op|root|arraycolsep|col-align-\w|newline|text|enclosing|fbox|tag|fig|figure)$/;
const STYLE_PROPS = new Set(['height', 'width', 'min-width', 'vertical-align', 'top', 'bottom', 'left', 'right', 'margin-left', 'margin-right',
  'margin-top', 'margin-bottom', 'padding-left', 'padding-right', 'border-bottom-width', 'border-top-width', 'border-right-width', 'color']);
const STYLE_VALUE = /^-?[\w.%# ]{1,40}$/;               // no url(), calc(), expression(), quotes
const bigLength = (v: string) => { const m = v.match(/^(-?[\d.]+)(em|ex|px)?$/); return !!m && Math.abs(Number(m[1])) > (m[2] === 'px' ? 600 : 40); };
DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
  if (data.attrName === 'class') {
    data.attrValue = data.attrValue.split(/\s+/).filter((c) => CLASS_OK.test(c)).join(' ');
    if (!data.attrValue) data.keepAttr = false;
  } else if (data.attrName === 'style') {
    data.attrValue = data.attrValue.split(';').map((d) => d.trim()).filter((d) => {
      const i = d.indexOf(':');
      if (i < 0) return false;
      const prop = d.slice(0, i).trim().toLowerCase(), val = d.slice(i + 1).trim();
      return STYLE_PROPS.has(prop) && STYLE_VALUE.test(val) && !bigLength(val);
    }).join(';');
    if (!data.attrValue) data.keepAttr = false;
  } else if (data.attrName === 'id') data.keepAttr = false;  // ids in content could collide with the app's
});

/** Curated/generated/past-paper content HTML (inline SVG figures from generators, past-paper figure images). */
export function rich(s: string | undefined | null): TemplateResult {
  const clean = DOMPurify.sanitize(String(s ?? ''), {
    ALLOWED_TAGS: [...CONTENT_TAGS, ...SVG_TAGS, 'img'],
    ALLOWED_ATTR: ['class', 'colspan', 'rowspan', 'viewBox', 'width', 'height', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'd', 'points',
      'fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'font-size', 'font-family', 'font-weight', 'text-anchor', 'dominant-baseline', 'transform', 'marker-end', 'id',
      'refX', 'refY', 'markerWidth', 'markerHeight', 'orient', 'xmlns', 'src', 'alt',
      // KaTeX output (rendered at build time) positions glyphs with inline styles and draws roots with SVG
      'style', 'aria-hidden', 'preserveAspectRatio'],
  });
  return html`${unsafeHTML(clean)}`;
}

/** Untrusted text (user input, AI output): plain text only. */
export const text = (s: string) => html`${s}`;

export const img = (path: string | undefined, alt = 'Figure', cls = 'fig') =>
  path ? html`<img class=${cls} src=${assetUrl(path)} alt=${alt} loading="lazy" decoding="async" />` : null;

export const LETTERS = ['A', 'B', 'C', 'D'];
export const pct = (x: number) => `${Math.round(x * 100)}%`;
export const fmtMs = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
export const niceDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
