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

/** Curated/generated/past-paper content HTML (inline SVG figures from generators, past-paper figure images). */
export function rich(s: string | undefined | null): TemplateResult {
  const clean = DOMPurify.sanitize(String(s ?? ''), {
    ALLOWED_TAGS: [...CONTENT_TAGS, ...SVG_TAGS, 'img'],
    ALLOWED_ATTR: ['class', 'colspan', 'rowspan', 'viewBox', 'width', 'height', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'd', 'points',
      'fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'font-size', 'font-family', 'font-weight', 'text-anchor', 'dominant-baseline', 'transform', 'marker-end', 'id',
      'refX', 'refY', 'markerWidth', 'markerHeight', 'orient', 'xmlns', 'src', 'alt'],
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
