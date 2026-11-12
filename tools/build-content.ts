// Validates content-src/**/<topic>.json and compiles it to public/content/{manifest.json, topics/<id>.<hash>.json, assets/**}.
// Usage: tsx tools/build-content.ts [--check]   (--check validates only, writes nothing)
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync, cpSync } from 'node:fs';
import { join, relative } from 'node:path';
import { TOPIC_MAP } from '../src/core/syllabus';
import type { Manifest, TopicContent } from '../src/core/types';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'content-src');
const ASSETS = join(SRC, 'assets');
const OUT = join(ROOT, 'public', 'content');
const CHECK = process.argv.includes('--check');

const ALLOWED_TAGS = new Set(['b', 'i', 'em', 'strong', 'u', 'br', 'p', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'sub', 'sup', 'span', 'code', 'small', 'mark', 'div']);

export interface Problem { file: string; where: string; msg: string }

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? (p === ASSETS ? [] : walk(p)) : p.endsWith('.json') ? [p] : [];
  });
}

function checkHtml(html: string, where: string, file: string, out: Problem[]) {
  if (typeof html !== 'string') { out.push({ file, where, msg: 'expected string' }); return; }
  for (const m of html.matchAll(/<\/?([a-zA-Z0-9]+)([^>]*)>/g)) {
    const tag = m[1].toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) out.push({ file, where, msg: `HTML tag <${tag}> not allowed` });
    if (/\son\w+\s*=|javascript:|style\s*=/i.test(m[2])) out.push({ file, where, msg: 'event handler / style / javascript: attribute not allowed' });
  }
}

function checkAsset(path: string | undefined, where: string, file: string, out: Problem[]) {
  if (!path) return;
  if (!existsSync(join(ASSETS, path))) out.push({ file, where, msg: `missing asset content-src/assets/${path}` });
}

export function validateTopic(c: TopicContent, file: string, globalIds: Map<string, string>): Problem[] {
  const out: Problem[] = [];
  const P = (where: string, msg: string) => out.push({ file, where, msg });
  if (!TOPIC_MAP[c.topic]) P('topic', `unknown topic id "${c.topic}"`);
  const n = c.notes;
  if (!n || !n.summary) P('notes.summary', 'missing');
  else {
    checkHtml(n.summary, 'notes.summary', file, out);
    (n.concepts || []).forEach((s, i) => { if (!s.title || !s.body) P(`notes.concepts[${i}]`, 'title and body required'); checkHtml(s.body, `notes.concepts[${i}].body`, file, out); checkAsset(s.img, `notes.concepts[${i}].img`, file, out); });
    (n.varieties || []).forEach((v, i) => {
      if (!v.type || !v.name || !v.how || !v.example?.q || !v.example?.steps?.length || !v.example?.answer) P(`notes.varieties[${i}]`, 'type, name, how, example{q,steps,answer} required');
      checkAsset(v.example?.img, `notes.varieties[${i}].example.img`, file, out);
    });
    if (!Array.isArray(n.tips)) P('notes.tips', 'array required');
    if (!Array.isArray(n.traps)) P('notes.traps', 'array required');
  }
  const passages = new Set((c.passages || []).map((p) => p.id));
  (c.passages || []).forEach((p, i) => { if (!p.id || !p.text) P(`passages[${i}]`, 'id and text required'); checkHtml(p.text, `passages[${i}].text`, file, out); checkAsset(p.img, `passages[${i}].img`, file, out); });
  const types = new Set((n?.varieties || []).map((v) => v.type));
  (c.questions || []).forEach((q, i) => {
    const w = `questions[${i}] (${q.id})`;
    if (!q.id) P(w, 'id required');
    else if (globalIds.has(q.id)) P(w, `duplicate id (also in ${globalIds.get(q.id)})`);
    else globalIds.set(q.id, file);
    if (q.topic !== c.topic) P(w, `topic "${q.topic}" != file topic "${c.topic}"`);
    if (!Number.isInteger(q.rev) || q.rev < 1) P(w, 'rev must be integer ≥ 1');
    if (![1, 2, 3].includes(q.level)) P(w, 'level must be 1, 2 or 3');
    if (!q.type) P(w, 'type required');
    else if (types.size && !types.has(q.type)) P(w, `type "${q.type}" has no matching notes.varieties entry`);
    if (!q.q) P(w, 'q required');
    if (!Array.isArray(q.options) || q.options.length !== 4) P(w, 'exactly 4 options required');
    else {
      const norm = q.options.map((o) => String(o).trim().toLowerCase());
      if (new Set(norm).size !== 4) P(w, 'options must be unique');
      if (norm.some((o) => !o && !q.optionImgs)) P(w, 'empty option');
    }
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) P(w, 'answer must be 0..3');
    if (!q.solution || String(q.solution).trim().length < 10) P(w, 'solution required (≥ 10 chars)');
    if (q.passageId && !passages.has(q.passageId)) P(w, `passageId "${q.passageId}" not in passages`);
    if (!['curated', 'test-data'].includes(q.source)) P(w, 'source must be curated or test-data');
    if (q.optionImgs && q.optionImgs.length !== 4) P(w, 'optionImgs must have 4 entries');
    for (const k of ['q', 'solution'] as const) checkHtml(q[k], `${w}.${k}`, file, out);
    q.options?.forEach((o, j) => checkHtml(o, `${w}.options[${j}]`, file, out));
    checkAsset(q.img, `${w}.img`, file, out);
    q.optionImgs?.forEach((p, j) => checkAsset(p, `${w}.optionImgs[${j}]`, file, out));
  });
  const fc = new Set<string>();
  (c.flashcards || []).forEach((f, i) => {
    if (!f.id || !f.front || !f.back || !f.deck) P(`flashcards[${i}]`, 'id, front, back, deck required');
    if (fc.has(f.id)) P(`flashcards[${i}]`, `duplicate flashcard id ${f.id}`);
    fc.add(f.id);
  });
  return out;
}

function main() {
  const files = walk(SRC);
  const problems: Problem[] = [];
  const ids = new Map<string, string>();
  const topics: { c: TopicContent; file: string }[] = [];
  const seenTopics = new Map<string, string>();
  for (const f of files) {
    const rel = relative(ROOT, f);
    let c: TopicContent;
    try { c = JSON.parse(readFileSync(f, 'utf8')); } catch (e) { problems.push({ file: rel, where: '-', msg: `invalid JSON: ${(e as Error).message}` }); continue; }
    if (seenTopics.has(c.topic)) problems.push({ file: rel, where: 'topic', msg: `topic also defined in ${seenTopics.get(c.topic)}` });
    seenTopics.set(c.topic, rel);
    problems.push(...validateTopic(c, rel, ids));
    topics.push({ c, file: rel });
  }
  if (problems.length) {
    for (const p of problems) console.error(`✗ ${p.file} :: ${p.where} :: ${p.msg}`);
    console.error(`\n${problems.length} problem(s) in ${files.length} file(s).`);
    process.exit(1);
  }
  const qCount = topics.reduce((a, t) => a + t.c.questions.length, 0);
  console.log(`✓ ${files.length} topic file(s), ${qCount} questions valid.`);
  if (CHECK) return;

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(join(OUT, 'topics'), { recursive: true });
  const manifest: Manifest = { version: '', builtAt: new Date().toISOString(), topics: {} };
  const all = createHash('sha256');
  for (const { c } of topics.sort((a, b) => a.c.topic.localeCompare(b.c.topic))) {
    const body = JSON.stringify(c);
    const hash = createHash('sha256').update(body).digest('hex').slice(0, 10);
    all.update(hash);
    const file = `topics/${c.topic}.${hash}.json`;
    writeFileSync(join(OUT, file), body);
    const byLevel: [number, number, number] = [0, 0, 0];
    c.questions.forEach((q) => byLevel[q.level - 1]++);
    manifest.topics[c.topic] = {
      file, bytes: Buffer.byteLength(body), questions: c.questions.length, byLevel,
      types: [...new Set(c.questions.map((q) => q.type))], flashcards: c.flashcards?.length || 0,
    };
  }
  manifest.version = all.digest('hex').slice(0, 12);
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
  if (existsSync(ASSETS)) cpSync(ASSETS, join(OUT, 'assets'), { recursive: true });
  console.log(`→ public/content (version ${manifest.version})`);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop()!)) main();
