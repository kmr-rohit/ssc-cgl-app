// Source chapter/concept → our syllabus topic id. Reviewable in one place.
// Rules are tried in order; the first whose `when` matches wins. `null` topic = exclude (reason given).

export interface Src { subject: string; chapter: string; concept: string; question: string }
export type MapResult = { topic: string } | { topic: null; reason: string };

const has = (s: string, ...words: string[]) => words.some((w) => s.includes(w));

const CHAPTER: Record<string, Record<string, string>> = {
  MATH: {
    geometry: 'q-geometry', trigonometry: 'q-trigonometry', 'data-interpretation': 'q-di',
    'mensuration-2d': 'q-mensuration', 'mensuration-3d': 'q-mensuration', algebra: 'q-algebra',
    'profit-and-loss': 'q-profit-loss', 'time-and-work': 'q-time-work', 'number-system': 'q-number-system',
    'time-and-distance': 'q-tsd', simplification: 'q-simplification', proportion: 'q-ratio', partnership: 'q-ratio',
    age: 'q-ratio', percentage: 'q-percentage', average: 'q-average', 'simple-interest': 'q-si-ci',
    'compound-interest': 'q-si-ci', 'mixture-and-alligation': 'q-mixture', 'elementary-statistics': 'q-statistics',
    statistics: 'q-statistics', probability: 'q-probability', 'coordinate-geometry': 'q-coordinate',
    'quantitative-aptitude': 'q-simplification',
  },
  REAS: {
    series: 'r-series', analogy: 'r-analogy', 'coding-decoding': 'r-coding', 'classification-odd-one-out': 'r-classification',
    'blood-relations': 'r-blood-relations', 'alphabet-test': 'r-word-order', 'logical-statement-questions': 'r-statement',
    'similarity-and-differences': 'r-classification', 'miscellaneous-other-possibilities': 'r-intelligence',
    'seating-arrangement': 'r-seating', 'clock-and-calendar': 'r-calendar-clock', calendar: 'r-calendar-clock',
    'mathematical-operations': 'r-math-ops', 'number-digit-operations': 'r-math-ops', 'missing-number': 'r-math-ops',
    'ranking-order': 'r-order-ranking', 'direction-sense': 'r-direction', syllogism: 'r-syllogism',
    'cause-and-effect': 'r-statement', 'figure-counting': 'r-nonverbal', 'water-image': 'r-nonverbal',
  },
  ENG: { 'voice-change': 'e-voice', 'para-jumble': 'e-parajumbles', narration: 'e-narration' },
  GK: {
    'art-and-culture': 'g-culture', 'indian-polity-and-constitution': 'g-polity', 'indian-economy': 'g-economy',
    'government-schemes-and-welfare-static-semi-static': 'g-economy', 'sports-static-gk': 'g-static', 'awards-static': 'g-static',
    'books-and-authors-static': 'g-static', 'static-gk': 'g-static', 'important-indian-institutions': 'g-static',
    'other-edge-cases-possible-ssc-gk-gs-questions': 'g-static', 'indian-geography': 'g-geography', 'world-geography': 'g-geography',
    'indian-climate': 'g-geography', 'indian-rivers': 'g-geography', oceanography: 'g-geography', agriculture: 'g-geography',
    'modern-indian-history': 'g-history', 'medieval-indian-history': 'g-history', 'ancient-indian-history': 'g-history',
    'current-affairs': 'g-current', 'general-science-biology': 'g-biology', 'general-science-chemistry': 'g-chemistry',
    'general-science-physics': 'g-physics', 'general-science': 'g-scitech', 'science-in-everyday-life': 'g-scitech',
    'computer-technology-overlap': 'g-scitech', 'environment-and-ecology': 'g-environment',
  },
  COMPUTER: {
    'internet-and-networking': 'c-internet', 'ms-office': 'c-office', 'computer-hardware': 'c-fundamentals',
    'computer-fundamentals': 'c-fundamentals', 'operating-systems': 'c-software', 'computer-software': 'c-software',
  },
};

export function mapTopic(s: Src): MapResult {
  const c = s.concept, q = s.question.toLowerCase();
  // ---- questions whose passage/data isn't in the source: unusable on their own
  if (s.chapter === 'cloze-test') return { topic: null, reason: 'cloze passage missing in source' };
  if (s.chapter === 'comprehension' || c.startsWith('reading-comprehension')) return { topic: null, reason: 'comprehension passage missing in source' };

  // ---- broad chapters split by concept
  if (s.subject === 'MATH' && s.chapter === 'number-system' && has(c, 'hcf', 'lcm')) return { topic: 'q-hcf-lcm' };
  if (s.subject === 'REAS' && s.chapter === 'non-verbal-reasoning') {
    if (has(c, 'cube', 'dice', 'spatial')) return { topic: 'r-dice' };
    if (has(c, 'embedded', 'figure-series')) return { topic: 'r-figural' };
    return { topic: 'r-nonverbal' };
  }
  if (s.subject === 'REAS' && s.chapter === 'puzzle-subtypes-not-to-miss') {
    if (has(c, 'sign-interchange', 'equation')) return { topic: 'r-math-ops' };
    return { topic: 'r-seating' };
  }
  if (s.subject === 'REAS' && s.chapter === 'logical-reasoning') {
    if (c.startsWith('syllogism')) return { topic: 'r-syllogism' };
    if (has(c, 'venn')) return { topic: 'r-venn' };
    if (has(c, 'letter-cluster')) return { topic: 'r-classification' };
    return { topic: 'r-statement' };
  }
  if (s.subject === 'ENG' && s.chapter === 'vocabulary') {
    if (c.startsWith('antonym')) return { topic: 'e-antonyms' };
    if (c.startsWith('synonym')) return { topic: 'e-synonyms' };
    if (c.startsWith('one-word')) return { topic: 'e-oneword' };
    if (c.startsWith('spelling')) return { topic: 'e-spelling' };
    if (c.startsWith('idioms')) return { topic: 'e-idioms' };
    if (c.startsWith('homonym')) return { topic: 'e-fillers' };
    // unclassified: read the instruction line
    if (has(q, 'opposite', 'antonym')) return { topic: 'e-antonyms' };
    if (has(q, 'synonym', 'similar in meaning', 'same meaning')) return { topic: 'e-synonyms' };
    if (has(q, 'one word', 'one-word')) return { topic: 'e-oneword' };
    if (has(q, 'spelt', 'spelling', 'misspelt')) return { topic: 'e-spelling' };
    if (has(q, 'idiom', 'phrase')) return { topic: 'e-idioms' };
    if (has(q, 'blank')) return { topic: 'e-fillers' };
    return { topic: 'e-synonyms' };
  }
  if (s.subject === 'ENG' && s.chapter === 'grammar') {
    if (c.startsWith('error')) return { topic: 'e-error' };
    if (c.startsWith('sentence-improvement')) return { topic: 'e-improvement' };
    if (c.startsWith('sentence-conversion')) return { topic: has(q, 'direct', 'indirect', 'narration', 'speech') ? 'e-narration' : 'e-voice' };
    return { topic: 'e-fillers' };
  }
  if (s.subject === 'ENG' && s.chapter === 'verbal-ability') {
    if (has(c, 'para-jumble')) return { topic: 'e-parajumbles' };
    if (has(c, 'idioms')) return { topic: 'e-idioms' };
    if (has(c, 'synonym')) return { topic: 'e-synonyms' };
    return { topic: null, reason: 'unmapped verbal-ability concept' };
  }

  const t = CHAPTER[s.subject]?.[s.chapter];
  return t ? { topic: t } : { topic: null, reason: `no mapping for ${s.subject}/${s.chapter}` };
}
