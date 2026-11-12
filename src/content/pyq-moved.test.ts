import { afterEach, describe, expect, it, vi } from 'vitest';

describe('past-paper questions moved to a corrected topic', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
  it('resolves an old id to the topic that now holds it, and leaves others alone', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ version: 'x', counts: { questions: 0, papers: 0 }, topics: {}, papers: [], weightage: {}, moved: { 'r-coding': ['pyq:r-seating:abc'] } }))));
    const { pyqTopicOf } = await import('./pyq');
    expect(await pyqTopicOf('pyq:r-seating:abc')).toBe('r-coding');
    expect(await pyqTopicOf('pyq:r-seating:def')).toBe('r-seating');
  });
  it('falls back to the id when the manifest is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const { pyqTopicOf } = await import('./pyq');
    expect(await pyqTopicOf('pyq:q-ratio:zzz')).toBe('q-ratio');
  });
});

describe('past-paper manifest loading', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
  it('retries after a failed load instead of caching the failure', async () => {
    const ok = { version: 'x', counts: { questions: 0, papers: 0 }, topics: {}, papers: [], weightage: {} };
    const f = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockImplementation(async () => new Response(JSON.stringify(ok)));
    vi.stubGlobal('fetch', f);
    const { loadPyqManifest } = await import('./pyq');
    expect(await loadPyqManifest()).toBeNull();
    expect(await loadPyqManifest()).toBeNull();
    expect((await loadPyqManifest())?.version).toBe('x');
    expect(await loadPyqManifest()).not.toBeNull();
    expect(f).toHaveBeenCalledTimes(3); // a good manifest is cached
  });
});
