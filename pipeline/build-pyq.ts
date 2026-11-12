// Previous-year question bank pipeline.
//   raw JSONL (pinned source commit, pipeline/.cache/raw, git-ignored)
//   → normalise (our Question schema, safe HTML, images) → map to syllabus topics → dedupe ("asked N times")
//   → images (download once, WebP, content-addressed) → papers (exact past shifts) → publish public/pyq/
// Usage: npx tsx pipeline/build-pyq.ts [--no-images]
// Re-runnable: downloads and image conversions are cached; output is fully regenerated.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { mapTopic } from './mapping';
import { TOPIC_MAP } from '../src/core/syllabus';
import type { Question, SubjectId } from '../src/core/types';

const ROOT = new URL('..', import.meta.url).pathname;
const RAW = join(ROOT, 'pipeline/.cache/raw');
const IMG_RAW = join(ROOT, 'pipeline/.cache/img-raw');
const OUT = join(ROOT, 'public/pyq');
const REPORT = join(ROOT, 'pipeline/.cache/report.json');
const NO_IMAGES = process.argv.includes('--no-images');
const PAGE = 250;
const IMG_HOSTS = ['cdn.repeatermock.com', 'ssc.digialm.com'];

interface Raw {
  qid: string; year: number; paper: string; subject: string; question: string; options: { label: string; text: string }[];
  solution: string | null; correct: string; source_concept: string; chapter: string; concept: string; n: number;
  held_on?: string; shift?: string | null; tier: 'pre' | 'mains'; paper_meta: { title: string; test_id: string; duration_min: number };
}

const SUBJECT: Record<string, SubjectId> = { MATH: 'quant', REAS: 'reasoning', ENG: 'english', GK: 'ga', COMPUTER: 'computer' };
const ORDER: Record<'pre' | 'mains', SubjectId[]> = { pre: ['reasoning', 'ga', 'quant', 'english'], mains: ['quant', 'reasoning', 'english', 'ga', 'computer'] };
const slug = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'general';
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

// ------------------------------------------------------------------ text → safe HTML
const ALLOWED = 'b|i|em|strong|u|br|p|ul|ol|li|table|thead|tbody|tr|th|td|sub|sup|span|code|small|mark|div|svg|g|path|line|rect|circle|ellipse|polygon|polyline|text|tspan';
const imgUrls = new Set<string>();
// Decorative icons ("Key Points", "Additional Information" banners) are the same image reused across many solutions.
// Real diagrams are unique to a question. Anything reused in 5+ different solutions is dropped as decoration.
const ICONS = (() => {
  const seen = new Map<string, Set<string>>();
  for (const f of readdirSync(join(new URL('..', import.meta.url).pathname, 'pipeline/.cache/raw')).filter((x) => x.endsWith('.jsonl'))) {
    for (const line of readFileSync(join(new URL('..', import.meta.url).pathname, 'pipeline/.cache/raw', f), 'utf8').split('\n')) {
      if (!line.trim()) continue;
      const r = JSON.parse(line) as { qid: string; solution: string | null };
      for (const m of String(r.solution ?? '').matchAll(/https?:\/\/[^\s"'\]]+/g)) {
        const set = seen.get(m[0]) ?? new Set<string>(); set.add(r.qid); seen.set(m[0], set);
      }
    }
  }
  return new Set([...seen].filter(([, qs]) => qs.size >= 5).map(([u]) => u));
})();
const imgPath = (url: string) => `/pyq/img/${sha(url).slice(0, 16)}.webp`;

function toHtml(src: string | null | undefined): string {
  let s = String(src ?? '');
  // image markers → placeholders (restored after escaping)
  const imgs: string[] = [];
  // the URL may be split across lines in the source: join it back together
  s = s.replace(/\[IMAGE:\s*([^\]]+?)\]/g, (_, rawUrl: string) => {
    const url = rawUrl.replace(/\s+/g, '');
    const host = (() => { try { return new URL(url).host; } catch { return ''; } })();
    if (!IMG_HOSTS.includes(host) || ICONS.has(url)) return '';
    imgUrls.add(url); imgs.push(url);
    return `\u0000IMG${imgs.length - 1}\u0000`;
  });
  // an [IMAGE: … marker cut off by truncated source text: drop the fragment
  s = s.replace(/\[IMAGE:[^\]]*$/, '');
  // existing <img src=...> tags (rare) → placeholders too
  // <img src=...> tags (also unclosed ones the source sometimes has) → placeholders, icons dropped
  s = s.replace(/<img\b[^>]*?src=["']([^"']+)["'][^>]*>?/gi, (_, url: string) => {
    const host = (() => { try { return new URL(url).host; } catch { return ''; } })();
    if (!IMG_HOSTS.includes(host) || ICONS.has(url)) return '';
    imgUrls.add(url); imgs.push(url); return `\u0000IMG${imgs.length - 1}\u0000`;
  });
  // anything img-like left is malformed (e.g. the source text was truncated mid-URL): remove it
  s = s.replace(/<img\b[^>]*>?/gi, '');
  // drop attributes on allowed tags except a few SVG geometry ones; drop styles/classes/handlers everywhere
  s = s.replace(/<(\/?)([a-zA-Z0-9]+)([^>]*)>/g, (m, close: string, tag: string, attrs: string) => {
    const t = tag.toLowerCase();
    if (!new RegExp(`^(${ALLOWED})$`).test(t)) return '';
    if (close) return `</${t}>`;
    const keep = /^(svg|g|path|line|rect|circle|ellipse|polygon|polyline|text|tspan)$/.test(t)
      ? (attrs.match(/\s(viewBox|width|height|x|y|x1|y1|x2|y2|cx|cy|r|rx|ry|d|points|fill|stroke|stroke-width|transform|text-anchor|font-size)="[^"]*"/g) ?? []).join('')
      : '';
    return `<${t}${keep}>`;
  });
  // any remaining "<" that isn't a tag we kept (e.g. "a < b", broken fragments like "<stro") → escaped
  s = s.replace(new RegExp(`<(?!/?(${ALLOWED})\\b)`, 'gi'), '&lt;');
  // light markdown used by the source
  s = s.replace(/\*\*([\s\S]+?)\*\*/g, '<b>$1</b>').replace(/__([^_\n]+?)__/g, '<b>$1</b>').replace(/\*\*|__/g, '');
  s = s.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().replace(/\n/g, '<br>');
  s = s.replace(/\u0000IMG(\d+)\u0000/g, (_, i: string) => `<img src="${imgPath(imgs[Number(i)])}" alt="Figure">`);
  return s;
}
const plain = (html: string) => html.replace(/<img[^>]*src="([^"]+)"[^>]*>/g, ' [$1] ').replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/\s+/g, ' ').trim().toLowerCase();

// ------------------------------------------------------------------ load + normalise + map
const report = { source: '', total: 0, excluded: {} as Record<string, number>, mapped: {} as Record<string, number>, duplicates: 0, images: { referenced: 0, converted: 0, failed: [] as string[] }, papers: 0 };
const inc = (o: Record<string, number>, k: string) => { o[k] = (o[k] ?? 0) + 1; };

interface Item { q: Question; raw: Raw; key: string }
const items: Item[] = [];
report.source = readFileSync(join(RAW, 'SOURCE_SHA'), 'utf8').trim();

for (const f of readdirSync(RAW).filter((x) => x.endsWith('.jsonl')).sort()) {
  for (const line of readFileSync(join(RAW, f), 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const r = JSON.parse(line) as Raw;
    report.total++;
    const m = mapTopic({ subject: r.subject, chapter: r.chapter, concept: r.concept ?? '', question: r.question });
    if (!m.topic) { inc(report.excluded, m.reason); continue; }
    if (!TOPIC_MAP[m.topic]) { inc(report.excluded, `unknown topic ${m.topic}`); continue; }
    if (m.topic === 'q-di' && !/\[IMAGE:|<table/i.test(r.question) && r.question.length <= 400) { inc(report.excluded, 'data-interpretation table/chart missing in source'); continue; }
    if (r.options.length !== 4) { inc(report.excluded, 'not 4 options'); continue; }
    const answer = r.options.findIndex((o) => o.label === r.correct);
    if (answer < 0) { inc(report.excluded, 'answer key not among options'); continue; }
    const options = r.options.map((o) => toHtml(o.text));
    if (new Set(options.map(plain)).size !== 4) { inc(report.excluded, 'duplicate options'); continue; }
    const qHtml = toHtml(r.question);
    if (!plain(qHtml)) { inc(report.excluded, 'empty question'); continue; }
    const solHtml = toHtml(r.solution);
    const solution = plain(solHtml).length >= 10 ? solHtml : `The correct answer is option ${String.fromCharCode(65 + answer)}.${solHtml ? `<br>${solHtml}` : ''}`;
    const q: Question = {
      id: `pyq:${m.topic}:${r.qid}`, rev: 1, topic: m.topic, type: slug(r.source_concept || r.chapter), level: 2,
      q: qHtml, options, answer, solution, source: 'pyq',
      pyq: { asked: [{ tier: r.tier, year: r.year, date: r.held_on ?? '', shift: r.shift ?? null, paper: r.paper_meta.test_id }] },
    };
    inc(report.mapped, m.topic);
    items.push({ q, raw: r, key: sha(plain(qHtml) + '|' + options.map(plain).sort().join('|')) });
  }
}

// ------------------------------------------------------------------ dedupe: same question in several shifts → one question, asked N times
const canonical = new Map<string, Item>();
const idOf = new Map<string, string>(); // raw qid → canonical question id
const byDate = (a: Item, b: Item) => a.raw.year - b.raw.year || Date.parse(a.raw.held_on ?? '') - Date.parse(b.raw.held_on ?? '');
for (const it of [...items].sort(byDate)) {
  const c = canonical.get(it.key);
  if (!c) { canonical.set(it.key, it); idOf.set(it.raw.qid, it.q.id); continue; }
  c.q.pyq!.asked.push(...it.q.pyq!.asked);
  idOf.set(it.raw.qid, c.q.id);
  report.duplicates++;
}
const questions = [...canonical.values()].map((x) => x.q);

// ------------------------------------------------------------------ images: download once, convert to WebP, name by URL hash
async function images() {
  mkdirSync(IMG_RAW, { recursive: true });
  mkdirSync(join(OUT, 'img'), { recursive: true });
  const urls = [...imgUrls];
  report.images.referenced = urls.length;
  let i = 0;
  const worker = async () => {
    while (i < urls.length) {
      const url = urls[i++];
      const rawFile = join(IMG_RAW, sha(url).slice(0, 24));
      const out = join(ROOT, 'public', imgPath(url));
      try {
        if (!existsSync(rawFile)) {
          const r = await fetch(url, { headers: { 'User-Agent': 'cgl-prep-pipeline' } });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          writeFileSync(rawFile, Buffer.from(await r.arrayBuffer()));
        }
        await sharp(readFileSync(rawFile)).flatten({ background: '#ffffff' }).resize({ width: 800, withoutEnlargement: true }).webp({ quality: 55, effort: 6 }).toFile(out);
        report.images.converted++;
      } catch (e) { report.images.failed.push(`${url} (${(e as Error).message})`); }
      if ((report.images.converted + report.images.failed.length) % 500 === 0) console.log(`  images ${report.images.converted + report.images.failed.length}/${urls.length}`);
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  // prune images no question references any more (e.g. icons dropped in a later run)
  const keep = new Set(urls.map((u) => imgPath(u).split('/').pop()));
  let pruned = 0;
  for (const f of readdirSync(join(OUT, 'img'))) if (!keep.has(f)) { rmSync(join(OUT, 'img', f)); pruned++; }
  if (pruned) console.log(`  pruned ${pruned} unreferenced images`);
}

// ------------------------------------------------------------------ papers: rebuild every past shift in exam order
interface PaperFile {
  id: string; title: string; tier: 'pre' | 'mains'; year: number; date: string; shift: string | null; minutes: number;
  sections: { subject: SubjectId; questionIds: string[]; missing: number; total: number }[];
  questions: Question[];
}
function papers(): PaperFile[] {
  const byPaper = new Map<string, Raw[]>();
  const kept = new Set(items.map((x) => x.raw.qid));
  const allRaw: Raw[] = [];
  for (const f of readdirSync(RAW).filter((x) => x.endsWith('.jsonl'))) for (const l of readFileSync(join(RAW, f), 'utf8').split('\n')) if (l.trim()) allRaw.push(JSON.parse(l));
  for (const r of allRaw) byPaper.set(r.paper_meta.test_id, [...(byPaper.get(r.paper_meta.test_id) ?? []), r]);
  const qById = new Map(questions.map((q) => [q.id, q]));
  const out: PaperFile[] = [];
  for (const [pid, rs] of byPaper) {
    const r0 = rs[0];
    const tier = r0.tier;
    const sections = ORDER[tier].map((subject) => {
      const inSec = rs.filter((r) => SUBJECT[r.subject] === subject).sort((a, b) => a.n - b.n);
      const ids = inSec.filter((r) => kept.has(r.qid)).map((r) => idOf.get(r.qid)!).filter(Boolean);
      return { subject, questionIds: [...new Set(ids)], missing: inSec.length - new Set(ids).size, total: inSec.length };
    }).filter((s) => s.total > 0);
    const ids = new Set(sections.flatMap((s) => s.questionIds));
    out.push({
      id: `cgl-${tier}-${slug(r0.held_on ?? String(r0.year))}${r0.shift ? `-s${r0.shift}` : ''}-${pid.slice(-4)}`,
      title: r0.paper_meta.title.replace(/\s*\(Held On\s*:?/i, ', held on ').replace(/\)\s*$/, ''),
      tier, year: r0.year, date: r0.held_on ?? '', shift: r0.shift ?? null, minutes: r0.paper_meta.duration_min,
      sections, questions: [...ids].map((id) => qById.get(id)!).filter(Boolean),
    });
  }
  return out.sort((a, b) => Date.parse(b.date) - Date.parse(a.date) || a.id.localeCompare(b.id));
}

// ------------------------------------------------------------------ publish
async function main() {
  console.log(`source ${report.source.slice(0, 10)}: ${report.total} raw → ${items.length} usable → ${questions.length} unique`);
  if (!NO_IMAGES) { console.log(`images: ${imgUrls.size} referenced`); await images(); }

  // keep converted images; replace everything else
  for (const d of ['topics', 'papers']) rmSync(join(OUT, d), { recursive: true, force: true });
  mkdirSync(join(OUT, 'topics'), { recursive: true });
  mkdirSync(join(OUT, 'papers'), { recursive: true });

  const manifest = {
    version: '', builtAt: new Date().toISOString(), source: { repo: 'akarohitmishra/repeatermock-subjectwise-db', commit: report.source },
    counts: { questions: questions.length, papers: 0 },
    topics: {} as Record<string, { pages: string[]; count: number; types: Record<string, string> }>,
    papers: [] as { id: string; title: string; tier: string; year: number; date: string; shift: string | null; minutes: number; available: number; total: number; file: string }[],
    weightage: {} as Record<string, { pre: number; mains: number }>,
  };
  const all = createHash('sha256');
  const write = (rel: string, data: unknown) => {
    const body = JSON.stringify(data);
    const h = sha(body).slice(0, 10);
    const file = rel.replace(/\.json$/, `.${h}.json`);
    writeFileSync(join(OUT, file), body);
    all.update(h);
    return file;
  };

  const byTopic = new Map<string, Question[]>();
  for (const q of questions) byTopic.set(q.topic, [...(byTopic.get(q.topic) ?? []), q]);
  const typeNames = new Map(items.map((x) => [x.q.type, x.raw.source_concept || x.raw.chapter]));
  for (const [topic, qs] of [...byTopic].sort()) {
    const pages: string[] = [];
    for (let i = 0; i < qs.length; i += PAGE) pages.push(write(`topics/${topic}-${i / PAGE + 1}.json`, qs.slice(i, i + PAGE)));
    const types: Record<string, string> = {};
    for (const q of qs) types[q.type] = typeNames.get(q.type) ?? q.type;
    manifest.topics[topic] = { pages, count: qs.length, types };
  }

  const ps = papers();
  for (const p of ps) {
    const file = write(`papers/${p.id}.json`, p);
    manifest.papers.push({ id: p.id, title: p.title, tier: p.tier, year: p.year, date: p.date, shift: p.shift, minutes: p.minutes,
      available: p.sections.reduce((a, s) => a + s.questionIds.length, 0), total: p.sections.reduce((a, s) => a + s.total, 0), file });
  }
  manifest.counts.papers = ps.length;
  report.papers = ps.length;

  // real weightage: average questions per paper by topic (from the papers, before exclusions)
  for (const tier of ['pre', 'mains'] as const) {
    const tp = ps.filter((p) => p.tier === tier);
    const counts: Record<string, number> = {};
    for (const p of tp) for (const q of p.questions) counts[q.topic] = (counts[q.topic] ?? 0) + 1;
    for (const [t, c] of Object.entries(counts)) (manifest.weightage[t] ??= { pre: 0, mains: 0 })[tier] = Math.round((c / tp.length) * 10) / 10;
  }

  manifest.version = all.digest('hex').slice(0, 12);
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest));
  writeFileSync(REPORT, JSON.stringify(report, null, 1));
  console.log(`published ${questions.length} questions, ${ps.length} papers → public/pyq (version ${manifest.version})`);
  console.log('excluded:', report.excluded);
  console.log(`duplicates merged: ${report.duplicates}; images converted ${report.images.converted}, failed ${report.images.failed.length}`);
}
main();
