// Minimal local-model client (Ollama). Deterministic (temperature 0), thinking off, retries, bounded concurrency.
// Gemma 4 on this Ollama build has no structured output, so callers validate replies themselves.
export const MODEL = process.env.PIPELINE_MODEL ?? 'gemma4:26b-a4b';
const URL = process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434';

export interface ChatOpts { maxTokens?: number; system?: string }

export async function chat(prompt: string, o: ChatOpts = {}): Promise<string> {
  const body = {
    model: MODEL, stream: false, think: false,
    options: { temperature: 0, num_predict: o.maxTokens ?? 512 },
    messages: [...(o.system ? [{ role: 'system', content: o.system }] : []), { role: 'user', content: prompt }],
  };
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(`${URL}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(300_000) });
      if (!r.ok) throw new Error(`Ollama HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
      const j = (await r.json()) as { message?: { content?: string } };
      return (j.message?.content ?? '').trim();
    } catch (e) { last = e; await new Promise((res) => setTimeout(res, 1000 * (attempt + 1))); }
  }
  throw last;
}

/** Run `fn` over items with at most `n` in flight; reports progress every `every` items. */
export async function pool<T>(items: T[], n: number, fn: (x: T, i: number) => Promise<void>, every = 200, label = '') {
  let i = 0, done = 0;
  const started = Date.now();
  const worker = async () => {
    while (i < items.length) {
      const k = i++;
      await fn(items[k], k);
      done++;
      if (done % every === 0 || done === items.length) {
        const rate = done / ((Date.now() - started) / 1000);
        console.log(`  ${label} ${done}/${items.length} (${rate.toFixed(1)}/s, ~${Math.round((items.length - done) / rate / 60)} min left)`);
      }
    }
  };
  await Promise.all(Array.from({ length: n }, worker));
}
