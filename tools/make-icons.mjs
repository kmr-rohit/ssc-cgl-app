// Renders the app icon to PNGs (iOS ignores SVG icons). Run: node tools/make-icons.mjs
// Uses Playwright's Chromium, so no image libraries are needed.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = new URL('../public/icons/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

// The register page: paper sheet, red margin, OMR bubbles (one filled). `inset` shrinks the artwork for maskable safe zones.
const art = (inset = 0, rounded = false) => {
  const s = 1 - inset * 2, o = 512 * inset;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" ${rounded ? 'rx="96"' : ''} fill="#1f3a5f"/>
  <g transform="translate(${o} ${o}) scale(${s})">
    <rect x="112" y="84" width="288" height="344" rx="20" fill="#fbf7ec"/>
    <line x1="176" y1="84" x2="176" y2="428" stroke="#c9433e" stroke-width="10"/>
    <line x1="200" y1="150" x2="370" y2="150" stroke="#d9d3c3" stroke-width="8" stroke-linecap="round"/>
    <circle cx="232" cy="236" r="30" fill="none" stroke="#1f3a5f" stroke-width="12"/>
    <circle cx="320" cy="236" r="30" fill="none" stroke="#1f3a5f" stroke-width="12"/>
    <circle cx="232" cy="330" r="30" fill="#1f3a5f"/>
    <circle cx="320" cy="330" r="30" fill="none" stroke="#1f3a5f" stroke-width="12"/>
  </g></svg>`;
};

const targets = [
  { file: 'icon-192.png', size: 192, svg: art(0, true), transparent: true },
  { file: 'icon-512.png', size: 512, svg: art(0, true), transparent: true },
  { file: 'maskable-512.png', size: 512, svg: art(0.1), transparent: false },   // content inside the 80% safe zone
  { file: 'apple-touch-icon.png', size: 180, svg: art(0.04), transparent: false }, // iOS rounds corners itself; no transparency
  { file: 'favicon-32.png', size: 32, svg: art(0, true), transparent: true },
];

const b = await chromium.launch();
const p = await b.newPage();
for (const t of targets) {
  await p.setViewportSize({ width: t.size, height: t.size });
  await p.setContent(`<html><body style="margin:0;background:transparent">${t.svg.replace('width="512" height="512"', `width="${t.size}" height="${t.size}"`)}</body></html>`);
  await p.screenshot({ path: OUT + t.file, omitBackground: t.transparent, clip: { x: 0, y: 0, width: t.size, height: t.size } });
  console.log('wrote', 'public/icons/' + t.file);
}
// keep the SVG favicon in sync with the PNGs
await import('node:fs').then((fs) => fs.writeFileSync(new URL('../public/icon.svg', import.meta.url), art(0, true)));
await b.close();
