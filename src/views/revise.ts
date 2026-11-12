import { html, render, nothing } from 'lit-html';
import { dayKey, isDue, type Grade } from '../core/srs';
import type { Flashcard } from '../core/types';
import { app } from '../app/state';
import { getManifest, loadTopic } from '../content/bank';
import { rich } from '../ui/html';
import { setTitle } from '../app/router';

const DECK_NAMES: Record<string, string> = {
  vocab: 'Vocabulary', idioms: 'Idioms & phrases', oneword: 'One-word substitution', spelling: 'Spellings',
  'ga-facts': 'GA facts', computer: 'Computer', formulas: 'Formulas', reasoning: 'Reasoning tricks', grammar: 'Grammar rules',
};

/** Antonym cards are authored as "Generous ↔ ?". Show them as words until the content is rewritten at the source. */
export const frontText = (front: string) => front.replace(/^(.+?)\s*↔\s*\?\s*$/, 'The opposite of $1');

async function allCards(): Promise<Flashcard[]> {
  const m = getManifest();
  if (!m) return [];
  const ids = Object.entries(m.topics).filter(([, t]) => t.flashcards > 0).map(([id]) => id);
  const topics = await Promise.all(ids.map(loadTopic));
  return topics.flatMap((t) => t?.flashcards ?? []);
}

export default async function revise(el: HTMLElement, [deckArg]: string[]) {
  render(html`<div class="page"><p class="muted">Loading cards…</p></div>`, el);
  const cards = await allCards();
  const decks = [...new Set(cards.map((c) => c.deck))];
  const today = dayKey();

  const split = (deck: string) => {
    const inDeck = cards.filter((c) => c.deck === deck);
    const due = inDeck.filter((c) => app.cards.has(c.id) && isDue(app.cards.get(c.id)!, today));
    const fresh = inDeck.filter((c) => !app.cards.has(c.id)).slice(0, Math.max(0, app.settings.newWordsPerDay));
    return { due, fresh };
  };
  const queueFor = (deck: string) => { const { due, fresh } = split(deck); return [...due, ...fresh]; };
  // new cards (never seen) and due reviews are different jobs: say which
  const deckStatus = (deck: string) => {
    const { due, fresh } = split(deck);
    const parts = [...(due.length ? [`${due.length} to review`] : []), ...(fresh.length ? [`${fresh.length} new card${fresh.length === 1 ? '' : 's'}`] : [])];
    return parts.length ? html`<b>${parts.join(' and ')}</b>` : html`<span class="muted">All done for today</span>`;
  };

  if (!deckArg) {
    render(html`<div class="page">
      <h1>Revise</h1>
      <a class="ticket" href="#/formulas" style="display:block;text-decoration:none;color:inherit;margin-bottom:1rem"><div class="kicker">Formula sheets</div><b>One page per topic + squares, cubes, fractions, trig tables</b></a>
      <p class="muted">Flashcards with spaced repetition: cards you find hard come back sooner. Up to ${app.settings.newWordsPerDay} new cards per deck per day.</p>
      ${decks.length ? html`<div class="grid">${decks.map((d) => {
        const total = cards.filter((c) => c.deck === d).length;
        const learnt = cards.filter((c) => c.deck === d && (app.cards.get(c.id)?.reps ?? 0) > 0).length;
        return html`<a class="card" href="#/revise/${encodeURIComponent(d)}">
          <div class="kicker">${learnt} of ${total} learnt</div>
          <h3>${DECK_NAMES[d] ?? d}</h3>
          <div>${deckStatus(d)}</div></a>`;
      })}</div>` : html`<p class="muted">No flashcards yet.</p>`}
    </div>`, el);
    return;
  }

  setTitle(DECK_NAMES[deckArg] ?? 'Flashcards');
  const queue = queueFor(deckArg);
  let i = 0, flipped = false, done = 0, busy = false;
  const grade = async (g: Grade) => {
    const card = queue[i];
    if (busy || !card) return; // a double tap must not grade the same card twice
    busy = true;
    try { await app.gradeCard(card.id, g); } finally { busy = false; }
    done++;
    if (g === 0) queue.push(card); // see it again this session
    i++; flipped = false; draw();
  };
  const onKey = (e: KeyboardEvent) => {
    if (i >= queue.length) return;
    if (e.key === ' ') { e.preventDefault(); flipped = !flipped; draw(); }
    else if (flipped && '1234'.includes(e.key)) grade((Number(e.key) - 1) as Grade);
  };
  const draw = () => {
    const c = queue[i];
    render(html`<div class="page" style="max-width:640px">
      <p class="small"><a href="#/revise">All decks</a></p>
      <h1>${DECK_NAMES[deckArg] ?? deckArg}</h1>
      ${!c ? html`<div class="paper"><h2>Deck done</h2><p>${done} card${done === 1 ? '' : 's'} reviewed. Come back tomorrow for the next batch.</p><a class="btn" href="#/revise">Back to decks</a></div>` : html`
        <div class="small muted">${i + 1} of ${queue.length}${app.cards.has(c.id) ? '' : ', a new card'}</div>
        <button class="paper flash" style="width:100%;border:0" @click=${() => { flipped = !flipped; draw(); }} aria-label="Flip card">
          <div><div>${rich(frontText(c.front))}</div>${flipped ? html`<div class="back">${rich(c.back)}</div>` : html`<div class="small muted" style="margin-top:1rem"><span class="touch-hint">Tap to see the answer</span><span class="kbd-hint">Click or press space to see the answer</span></div>`}</div>
        </button>
        ${flipped ? html`<div class="row" style="justify-content:center;margin-top:1rem">
          <button class="btn danger" @click=${() => grade(0)}>Again <span class="small kbd-hint">1</span></button>
          <button class="btn" @click=${() => grade(1)}>Hard <span class="small kbd-hint">2</span></button>
          <button class="btn primary" @click=${() => grade(2)}>Good <span class="small kbd-hint">3</span></button>
          <button class="btn" @click=${() => grade(3)}>Easy <span class="small kbd-hint">4</span></button></div>` : nothing}`}
    </div>`, el);
  };
  document.addEventListener('keydown', onKey);
  draw();
  return () => document.removeEventListener('keydown', onKey);
}
