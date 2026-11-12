// Generator registry. Questions built here are trusted, runtime-generated content:
// `q` may contain inline SVG wrapped in <div class="fig">…</div>, so views must render generated
// questions (source === 'generated') via the trusted-generated path, not through the curated-HTML sanitiser
// (or with a sanitiser config that allows the SVG subset: svg line polyline polygon circle text).
import { Rng } from '../core/rng';
import type { Generator, Level, Question } from '../core/types';
import { QUANT_GENERATORS } from './quant';
import { REASONING_GENERATORS } from './reasoning';

export const GEN_VERSION = 1;

export const GENERATORS: Generator[] = [...QUANT_GENERATORS, ...REASONING_GENERATORS];

export const generatorsFor = (topic: string): Generator[] => GENERATORS.filter((g) => g.topic === topic);

export const typesFor = (topic: string): string[] => [...new Set(generatorsFor(topic).map((g) => g.type))];

export const findGenerator = (topic: string, type: string): Generator | undefined =>
  GENERATORS.find((g) => g.topic === topic && g.type === type);

export const genId = (gen: Generator, level: Level, seed: string) => `gen:${gen.topic}:${gen.type}:${level}:${seed}`;

/** Build a full Question. Pure: same (gen, seed, level) → identical question. */
export function generateQuestion(gen: Generator, seed: string, level: Level): Question {
  const id = genId(gen, level, seed);
  const body = gen.make(new Rng(id), level);
  const q = body.svg ? `${body.q}<div class="fig">${body.svg}</div>` : body.q;
  return {
    id,
    rev: 1,
    topic: gen.topic,
    type: gen.type,
    level,
    q,
    ...(body.img ? { img: body.img } : {}),
    options: body.options,
    answer: body.answer,
    solution: body.solution,
    source: 'generated',
  };
}

/** Rebuild a generated question from its id (inverse of genId); undefined if unknown. */
export function questionFromId(id: string): Question | undefined {
  const m = /^gen:([^:]+):([^:]+):([123]):(.*)$/.exec(id);
  if (!m) return undefined;
  const gen = findGenerator(m[1], m[2]);
  const level = Number(m[3]) as Level;
  if (!gen || !gen.levels.includes(level)) return undefined;
  return generateQuestion(gen, m[4], level);
}
