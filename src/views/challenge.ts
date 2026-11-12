// A friend opens #/c/CODE: see who challenged them, take the same paper, then the leaderboard.
import { html, render, nothing } from 'lit-html';
import { EXAMS, SUBJECTS } from '../core/syllabus';
import type { MockRecord } from '../core/types';
import { app } from '../app/state';
import { auth, setReturnTo } from '../app/auth';
import { go, toast } from '../app/router';
import { challengeLink, createChallenge, getChallenge, getScores, isChallengeCode, mockFromChallenge, postScore, revealChallengeKey, type ChallengeScore } from '../data/challenges';
import { fmtMs } from '../ui/html';
import { promptDialog } from '../ui/components';

const fmt = (x: number) => x.toFixed(1).replace(/\.0$/, '');

/** The name friends see. Asks once, then remembers it in settings. */
export async function displayName(): Promise<string | null> {
  if (app.settings.name.trim()) return app.settings.name.trim();
  // never prefill from the email: the part before @ is often a full name or a phone number
  const name = await promptDialog('Your name, as friends will see it', '', 'Continue');
  if (name) await app.saveSettings({ name: name.slice(0, 40) });
  return name;
}

export const leaderboard = (rows: ChallengeScore[]) => html`<ol class="leaderboard">
  ${rows.map((r, i) => html`<li class=${r.is_me ? 'me' : ''}>
    <span class="rank">${i + 1}</span>
    <span class="who">${r.display_name}${r.is_me ? ' (you)' : ''}</span>
    <span class="pts"><b>${fmt(r.score)}</b> / ${fmt(r.max_score)}</span>
    <span class="small muted">${r.correct} right, ${r.wrong} wrong, ${fmtMs(r.time_ms)}</span>
  </li>`)}
</ol>`;

/** Share sheet on phones, copy elsewhere. */
export async function shareChallenge(code: string, title: string) {
  const url = challengeLink(code);
  const text = `I challenge you to "${title}" on CGL Prep. Same questions, let's compare scores. Code ${code}`;
  if (navigator.share) { try { await navigator.share({ title: 'CGL Prep challenge', text, url }); return; } catch { /* cancelled: fall back to copy */ } }
  try { await navigator.clipboard.writeText(`${text}\n${url}`); toast('Link copied. Paste it to your friends.'); }
  catch { toast(url); }
}

/** Result-screen panel: create a challenge from this mock, or show the leaderboard if it already is one. */
export function challengePanel(m: MockRecord, redraw: () => void) {
  if (!auth.enabled) return nothing;
  if (!auth.user) return html`<section class="paper challenge-panel"><h2>Challenge a friend</h2>
    <p>Send friends this exact paper and compare scores. You need to be signed in.</p>
    <a class="btn" href="#/account" @click=${() => setReturnTo(`#/result/${encodeURIComponent(m.key)}`)}>Sign in to challenge</a></section>`;
  if (!m.challenge) return html`<section class="paper challenge-panel"><h2>Challenge a friend</h2>
    <p>Send friends this exact paper, same questions and rules. Everyone's first attempt goes on the leaderboard.</p>
    <button class="btn primary" @click=${async () => {
      const name = await displayName(); if (!name) return;
      try {
        const code = await createChallenge(m, name);
        m.challenge = code; m.challengeOwner = true;
        await app.saveMock(m);
        await postScore(m, name).then(() => { m.challengePosted = true; return app.saveMock(m); }).catch(() => {});
        await shareChallenge(code, m.title ?? EXAMS[m.exam].name);
        redraw();
      } catch (e) { toast((e as Error).message); }
    }}>Create a challenge</button></section>`;
  return html`<section class="paper challenge-panel" id="challenge">
    <div class="spread"><h2>Challenge ${m.challenge}</h2><button class="btn sm" @click=${() => shareChallenge(m.challenge!, m.title ?? EXAMS[m.exam].name)}>Share again</button></div>
    <div class="board" data-code=${m.challenge}><p class="muted small">Loading scores…</p></div>
  </section>`;
}

/** Fill a rendered challenge panel's leaderboard (and post my score if it hasn't gone yet). */
export async function hydrateChallengePanel(root: HTMLElement, m: MockRecord) {
  const box = root.querySelector<HTMLElement>('.challenge-panel .board');
  if (!box || !m.challenge || !auth.user) return;
  try {
    if (!m.challengePosted && m.status === 'submitted') {
      await postScore(m, app.settings.name.trim() || 'Friend');
      m.challengePosted = true;
      await revealChallengeKey(m).catch(() => false);
      await app.saveMock(m);
    } else if (await revealChallengeKey(m).catch(() => false)) await app.saveMock(m);
    const rows = await getScores(m.challenge);
    render(rows.length ? leaderboard(rows) : html`<p class="muted small">No scores yet.</p>`, box);
  } catch (e) { render(html`<p class="muted small">${(e as Error).message}</p>`, box); }
}

export default async function challengeView(el: HTMLElement, [raw]: string[]) {
  const code = (raw ?? '').toUpperCase();
  if (!isChallengeCode(code)) { render(html`<div class="page"><h1>That code doesn't look right</h1><p>Challenge codes are 6 letters and numbers, like K7PQ2M.</p><a class="btn" href="#/mocks">Go to mocks</a></div>`, el); return; }
  await auth.ready;
  if (!auth.enabled) { render(html`<div class="page"><h1>Challenges need an account</h1><p class="muted">This build has no account service.</p></div>`, el); return; }
  if (!auth.user) {
    render(html`<div class="page" style="max-width:600px"><div class="ticket"><div class="kicker">Challenge ${code}</div>
      <h1>A friend has challenged you</h1>
      <p>Sign in to take the same paper and see how you compare. It takes a minute.</p>
      <a class="btn primary" href="#/account" @click=${() => setReturnTo(`#/c/${code}`)}>Sign in to take it</a></div></div>`, el);
    return;
  }
  render(html`<div class="page"><p class="muted">Loading challenge…</p></div>`, el);
  let c;
  try { c = await getChallenge(code); } catch (e) { render(html`<div class="page"><h1>Couldn't load the challenge</h1><p>${(e as Error).message}</p></div>`, el); return; }
  if (!c) { render(html`<div class="page"><h1>Challenge not found</h1><p>The code ${code} doesn't exist or has expired (challenges last 60 days).</p><a class="btn" href="#/mocks">Go to mocks</a></div>`, el); return; }

  const mine = app.mocks.get(`ch-${code}`) ?? (c.is_mine ? [...app.mocks.values()].find((x) => x.challenge === code) : undefined);
  const total = c.paper.sections.reduce((a, s) => a + s.questionIds.length, 0);
  const minutes = Math.round(c.paper.sections.reduce((a, s) => a + s.allottedMs, 0) / 60000);
  const rules = c.paper.rules;
  const start = async () => {
    const name = await displayName(); if (!name) return;
    let m;
    try { m = await mockFromChallenge(c); } catch (e) { toast((e as Error).message); return; }
    await app.saveMock(m);
    go(`#/exam/${encodeURIComponent(m.key)}`);
  };

  render(html`<div class="page" style="max-width:640px">
    <div class="ticket">
      <div class="kicker">Challenge ${code}</div>
      <h1>${c.title}</h1>
      <p>${c.is_mine ? 'Your challenge.' : `${c.creator_name} challenged you to this paper.`}</p>
      <dl>
        <dt>Questions</dt><dd>${total}, ${c.paper.sections.map((s) => SUBJECTS[s.subject]?.short ?? "?").join(', ')}</dd>
        <dt>Time</dt><dd>${rules?.timing === 'none' ? 'No time limit' : `${minutes} min`}</dd>
        <dt>Marking</dt><dd>+${rules?.marks ?? EXAMS[c.exam].marks}${(rules?.negative ?? EXAMS[c.exam].negative) ? ` / −${rules?.negative ?? EXAMS[c.exam].negative}` : ', no negative marking'}</dd>
      </dl>
      ${mine?.status === 'submitted'
        ? html`<a class="btn" href="#/result/${encodeURIComponent(mine.key)}">See your result</a>`
        : mine ? html`<a class="btn primary" href="#/exam/${encodeURIComponent(mine.key)}">${mine.status === 'in-progress' ? 'Resume' : 'Start'}</a>`
        : html`<button class="btn primary" @click=${start}>Take the challenge</button>`}
    </div>
    ${mine?.status === 'submitted' ? html`<section class="paper" style="margin-top:1rem"><h2>Leaderboard</h2><div class="board"><p class="muted small">Loading scores…</p></div></section>`
      : html`<p class="small muted" style="margin-top:1rem">You'll see everyone's scores after you finish. Only your first attempt counts.</p>`}
  </div>`, el);
  if (mine?.status === 'submitted') {
    const box = el.querySelector<HTMLElement>('.board')!;
    getScores(code).then((rows) => render(leaderboard(rows), box)).catch((e) => render(html`<p class="muted small">${(e as Error).message}</p>`, box));
  }
}
