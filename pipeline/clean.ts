// Text cleanup shared by pipeline stages.

const DEVANAGARI = /[ऀ-ॿ]/g;
const devanagariShare = (s: string) => (s.match(DEVANAGARI)?.length ?? 0) / Math.max(1, s.replace(/\s/g, '').length);

/**
 * The scraped source sometimes holds a whole page payload in a text field: several versions of the same text
 * separated by markers like "\n\n13b:T111b,\n" (often Hindi first, then English), and trailing app data starting
 * like 'e:["$","$L2d",…'. Keep the longest mostly-English version, drop the rest.
 */
export function cleanSourceText(raw: string | null | undefined): string {
  let s = String(raw ?? '');
  s = s.replace(/\n+\s*[0-9a-f]{1,4}:\[\s*"\$[\s\S]*$/, '');               // trailing app data
  const parts = s.split(/(?:^|\n+)\s*[0-9a-f]{1,4}:T[0-9a-f]+,\s*/)
    // a marker glued onto text (no line break) can't be separated safely: cut there; the stage that repairs
    // truncated solutions then rewrites it
    .map((p) => p.replace(/[0-9a-f]{1,4}:T[0-9a-f]{3,},[\s\S]*$/, '').trim()).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? '';
  const english = parts.filter((p) => devanagariShare(p) < 0.15);
  return (english.length ? english : parts).sort((a, b) => b.length - a.length)[0];
}

/** Plain text of an HTML/markdown-ish string. */
export const plainText = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/\*\*|__/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

/** A solution that stops mid-word (cut off in the source), or is too thin to teach anything. */
export function solutionNeedsWork(cleaned: string): 'truncated' | 'short' | null {
  const p = plainText(cleaned.replace(/\[IMAGE:[^\]]*\]?/g, ''));
  if (p.length < 80) return 'short';
  const end = p.slice(-40);
  if (/[A-Za-z]{2,}$/.test(end) && !/(answer|correct|option [1-4a-d]|hence|true|false|statement|both|neither|none|all)$/i.test(end)) return 'truncated';
  if (/[,(:\-–]$/.test(end)) return 'truncated';
  return null;
}
