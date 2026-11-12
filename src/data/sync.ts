// SyncedAdapter: offline-first storage. Every read/write hits IndexedDB (LocalAdapter); every write is also
// queued in an outbox and pushed to Supabase when signed in + online. Pull merges server rows back:
// attempts are a union (by UUIDv7 id); mocks, cards, settings and kv are last-write-wins on updated_at.
import { createStore, del, entries, set, clear } from 'idb-keyval';
import type { Attempt, CardState, MockRecord, Settings } from '../core/types';
import { DEFAULT_SETTINGS, LocalAdapter, type BackupFile, type StorageAdapter } from './storage';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as defaultClient } from './supabase';

type Table = 'attempts' | 'mocks' | 'srs_cards' | 'profiles' | 'kv';
interface OutboxItem { table: Table; row: Record<string, unknown> }

export interface SyncStatus {
  state: 'off' | 'signed-out' | 'idle' | 'syncing' | 'offline' | 'error';
  pending: number;
  lastSync: string | null;
  error: string | null;
}

const ON_CONFLICT: Record<Exclude<Table, 'attempts'>, string> = { mocks: 'user_id,key', srs_cards: 'user_id,card_id', profiles: 'user_id', kv: 'user_id,key' };
const META = { user: '__sync_user', cursor: '__sync_attempts_cursor', settingsTs: '__sync_settings_ts', last: '__sync_last' } as const;
const kvTs = (k: string) => `__sync_kv_ts:${k}`;
const isMeta = (k: string) => k.startsWith('__sync');

// ---------------------------------------------------------------- row mapping (camelCase ⇄ snake_case)
const attemptRow = (a: Attempt) => ({
  id: a.id, question_id: a.questionId, rev: a.rev, topic: a.topic, type: a.type, level: a.level, chosen: a.chosen,
  correct: a.correct, ms: a.ms, mode: a.mode, mock_key: a.mockKey ?? null, answered_at: a.at,
});
const attemptFrom = (r: Record<string, unknown>): Attempt => ({
  id: r.id as string, questionId: r.question_id as string, rev: r.rev as number, topic: r.topic as string, type: r.type as string,
  level: r.level as Attempt['level'], chosen: r.chosen as number | null, correct: r.correct as boolean, ms: r.ms as number,
  mode: r.mode as Attempt['mode'], mockKey: (r.mock_key as string) ?? undefined, at: new Date(r.answered_at as string).toISOString(),
});
const mockRow = (m: MockRecord) => ({ key: m.key, exam: m.exam, status: m.status, record: m, updated_at: m.updatedAt });
const cardRow = (c: CardState) => ({ card_id: c.id, state: { due: c.due, interval: c.interval, ease: c.ease, reps: c.reps, lapses: c.lapses }, updated_at: c.updatedAt });
const cardFrom = (r: Record<string, unknown>): CardState => ({ id: r.card_id as string, ...(r.state as Omit<CardState, 'id' | 'updatedAt'>), updatedAt: new Date(r.updated_at as string).toISOString() });
const pkOf = (t: Table, row: Record<string, unknown>) => (t === 'attempts' ? row.id : t === 'mocks' || t === 'kv' ? row.key : t === 'srs_cards' ? row.card_id : 'me') as string;
const newer = (a: string | undefined | null, b: string | undefined | null) => !!a && (!b || Date.parse(a) > Date.parse(b));

export class SyncedAdapter implements StorageAdapter {
  private outbox: ReturnType<typeof createStore>;
  private sb: SupabaseClient | null;
  private timer: number | undefined;
  private running: Promise<boolean> | null = null;
  private listeners = new Set<(s: SyncStatus) => void>();
  /** Called after a pull changed local data, so the app can reload its in-memory state. */
  onPulled: (() => void) | null = null;
  status: SyncStatus;

  constructor(readonly local = new LocalAdapter(), client: SupabaseClient | null = defaultClient, outboxName = 'cglprep-outbox') {
    this.sb = client;
    this.outbox = createStore(outboxName, 'kv');
    this.status = { state: client ? 'signed-out' : 'off', pending: 0, lastSync: null, error: null };
    if (!client || typeof window === 'undefined') return;
    window.addEventListener('online', () => this.schedule(0));
    window.addEventListener('offline', () => this.setStatus({ state: 'offline' }));
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.schedule(0); });
    window.setInterval(() => this.schedule(0), 60_000);
    this.countPending();
    this.local.getKV<string>(META.last).then((v) => this.setStatus({ lastSync: v ?? null }));
  }

  onStatus(fn: (s: SyncStatus) => void) { this.listeners.add(fn); fn(this.status); return () => this.listeners.delete(fn); }
  private setStatus(p: Partial<SyncStatus>) { this.status = { ...this.status, ...p }; this.listeners.forEach((f) => f(this.status)); }
  private async countPending() { this.setStatus({ pending: (await entries(this.outbox)).length }); }

  // ---------------------------------------------------------------- StorageAdapter (reads → local)
  async getSettings() { return this.local.getSettings(); }
  async listAttempts() { return this.local.listAttempts(); }
  async listMocks() { return this.local.listMocks(); }
  async listCards() { return this.local.listCards(); }
  getKV<T>(key: string) { return this.local.getKV<T>(key); }
  exportAll() { return this.local.exportAll(); }

  // ---------------------------------------------------------------- writes → local + outbox
  async saveSettings(s: Settings) {
    const ts = new Date().toISOString();
    await this.local.saveSettings(s);
    await this.local.setKV(META.settingsTs, ts);
    await this.enqueue([{ table: 'profiles', row: { settings: s, updated_at: ts } }]);
  }
  async addAttempts(a: Attempt[]) { await this.local.addAttempts(a); await this.enqueue(a.map((x) => ({ table: 'attempts' as const, row: attemptRow(x) }))); }
  async saveMock(m: MockRecord) { await this.local.saveMock(m); await this.enqueue([{ table: 'mocks', row: mockRow(m) }]); }
  async deleteMock(key: string) {
    await this.local.deleteMock(key);
    await del(`mocks|${key}`, this.outbox);
    const uid = await this.userId();
    if (uid) await this.sb!.from('mocks').delete().eq('user_id', uid).eq('key', key);
  }
  async saveCards(c: CardState[]) { await this.local.saveCards(c); await this.enqueue(c.map((x) => ({ table: 'srs_cards' as const, row: cardRow(x) }))); }
  async setKV(key: string, value: unknown) {
    await this.local.setKV(key, value);
    if (isMeta(key)) return;
    const ts = new Date().toISOString();
    await this.local.setKV(kvTs(key), ts);
    await this.enqueue([{ table: 'kv', row: { key, value, updated_at: ts } }]);
  }
  async importAll(b: BackupFile) {
    const user = await this.local.getKV<string>(META.user);
    await this.local.importAll(b);
    if (user) await this.local.setKV(META.user, user);
    await this.enqueueEverything();
  }
  /** Deletes progress on this device and (when signed in) on the server. */
  async wipe() {
    const uid = await this.userId();
    if (uid) {
      for (const t of ['attempts', 'mocks', 'srs_cards', 'kv', 'profiles'] as const) {
        const { error } = await this.sb!.from(t).delete().eq('user_id', uid);
        if (error) throw new Error('Could not delete progress on the server. Check your connection and try again.');
      }
    }
    await clear(this.outbox);
    await this.local.wipe();
    if (uid) await this.local.setKV(META.user, uid);
    await this.countPending();
  }

  // ---------------------------------------------------------------- outbox
  private async enqueue(items: OutboxItem[]) {
    if (!this.sb || !items.length) return;
    await Promise.all(items.map((it) => set(`${it.table}|${pkOf(it.table, it.row)}`, it, this.outbox)));
    await this.countPending();
    this.schedule();
  }
  private async enqueueEverything() {
    const [s, a, m, c] = await Promise.all([this.local.getSettings(), this.local.listAttempts(), this.local.listMocks(), this.local.listCards()]);
    // only upload settings this device actually changed; untouched defaults must never overwrite the account's settings
    const ts = await this.local.getKV<string>(META.settingsTs);
    await this.enqueue([
      ...(ts ? [{ table: 'profiles' as const, row: { settings: s, updated_at: ts } }] : []),
      ...a.map((x) => ({ table: 'attempts' as const, row: attemptRow(x) })),
      ...m.map((x) => ({ table: 'mocks' as const, row: mockRow(x) })),
      ...c.map((x) => ({ table: 'srs_cards' as const, row: cardRow(x) })),
    ]);
  }

  schedule(delay = 1500) {
    if (!this.sb || typeof window === 'undefined') return;
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => { this.sync(); }, delay);
  }

  private async userId(): Promise<string | null> {
    if (!this.sb) return null;
    const { data } = await this.sb.auth.getSession();
    return data.session?.user.id ?? null;
  }

  /** Push the outbox, then pull server changes. Returns true when local data changed. */
  sync(): Promise<boolean> {
    if (this.running) return this.running;
    this.running = (async () => {
      if (!this.sb) return false;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) { this.setStatus({ state: 'offline' }); return false; }
      const uid = await this.userId();
      if (!uid) { this.setStatus({ state: 'signed-out' }); return false; }
      this.setStatus({ state: 'syncing', error: null });
      try {
        await this.flush();
        const changed = await this.pull();
        const now = new Date().toISOString();
        await this.local.setKV(META.last, now);
        this.setStatus({ state: 'idle', lastSync: now });
        if (changed) this.onPulled?.();
        return changed;
      } catch (e) {
        console.warn('sync failed', e);
        this.setStatus({ state: typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'error', error: (e as Error).message });
        return false;
      } finally {
        await this.countPending();
      }
    })().finally(() => { this.running = null; });
    return this.running;
  }

  private async flush() {
    const items = await entries<string, OutboxItem>(this.outbox);
    const byTable = new Map<Table, [string, OutboxItem][]>();
    for (const e of items) byTable.set(e[1].table, [...(byTable.get(e[1].table) ?? []), e]);
    // profiles first so settings arrive before data; attempts in large batches
    for (const t of ['profiles', 'mocks', 'srs_cards', 'kv', 'attempts'] as const) {
      const list = byTable.get(t) ?? [];
      const size = t === 'attempts' ? 500 : 100;
      for (let i = 0; i < list.length; i += size) {
        const chunk = list.slice(i, i + size);
        const rows = chunk.map(([, it]) => it.row);
        const q = t === 'attempts'
          ? this.sb!.from(t).upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
          : this.sb!.from(t).upsert(rows, { onConflict: ON_CONFLICT[t] });
        const { error } = await q;
        if (error) throw new Error(`Upload failed (${t}): ${error.message}`);
        // remove only items that weren't changed again while uploading
        const now = new Map(await entries<string, OutboxItem>(this.outbox));
        await Promise.all(chunk.filter(([k, it]) => JSON.stringify(now.get(k)) === JSON.stringify(it)).map(([k]) => del(k, this.outbox)));
      }
    }
  }

  private async pull(): Promise<boolean> {
    let changed = false;
    // settings
    const { data: prof, error: pe } = await this.sb!.from('profiles').select('settings, updated_at').maybeSingle();
    if (pe) throw new Error(pe.message);
    if (prof && newer(prof.updated_at, await this.local.getKV<string>(META.settingsTs))) {
      await this.local.saveSettings({ ...DEFAULT_SETTINGS, ...(prof.settings as Settings) });
      await this.local.setKV(META.settingsTs, prof.updated_at);
      changed = true;
    }
    // mocks
    const localMocks = new Map((await this.local.listMocks()).map((m) => [m.key, m]));
    for (const r of await this.all('mocks', 'key, record, updated_at', 'key')) {
      const mine = localMocks.get(r.key as string);
      if (!mine || newer(r.updated_at as string, mine.updatedAt)) {
        await this.local.saveMock({ ...(r.record as MockRecord), updatedAt: new Date(r.updated_at as string).toISOString() });
        changed = true;
      }
    }
    // flashcards
    const localCards = new Map((await this.local.listCards()).map((c) => [c.id, c]));
    const cards: CardState[] = [];
    for (const r of await this.all('srs_cards', 'card_id, state, updated_at', 'card_id')) {
      const mine = localCards.get(r.card_id as string);
      if (!mine || newer(r.updated_at as string, mine.updatedAt)) cards.push(cardFrom(r));
    }
    if (cards.length) { await this.local.saveCards(cards); changed = true; }
    // kv
    for (const r of await this.all('kv', 'key, value, updated_at', 'key')) {
      if (newer(r.updated_at as string, await this.local.getKV<string>(kvTs(r.key as string)))) {
        await this.local.setKV(r.key as string, r.value);
        await this.local.setKV(kvTs(r.key as string), r.updated_at);
        changed = true;
      }
    }
    // attempts: incremental by server created_at
    const cursor = (await this.local.getKV<string>(META.cursor)) ?? '1970-01-01T00:00:00Z';
    const known = new Set((await this.local.listAttempts()).map((a) => a.id));
    let maxSeen = cursor;
    for (let from = 0; ; from += 1000) {
      const { data, error } = await this.sb!.from('attempts')
        .select('id, question_id, rev, topic, type, level, chosen, correct, ms, mode, mock_key, answered_at, created_at')
        .gt('created_at', cursor).order('created_at').order('id').range(from, from + 999);
      if (error) throw new Error(error.message);
      const fresh = (data ?? []).filter((r) => !known.has(r.id as string)).map(attemptFrom);
      if (fresh.length) { await this.local.addAttempts(fresh); changed = true; }
      for (const r of data ?? []) if ((r.created_at as string) > maxSeen) maxSeen = r.created_at as string;
      if (!data || data.length < 1000) break;
    }
    await this.local.setKV(META.cursor, maxSeen);
    return changed;
  }

  private async all(table: Table, cols: string, order: string) {
    const out: Record<string, unknown>[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await this.sb!.from(table).select(cols).order(order).range(from, from + 999);
      if (error) throw new Error(error.message);
      out.push(...((data ?? []) as unknown as Record<string, unknown>[]));
      if (!data || data.length < 1000) return out;
    }
  }

  // ---------------------------------------------------------------- account lifecycle
  /**
   * Call after sign-in. First sign-in on this device: upload the local progress (import).
   * Different account than last time: this device's data belonged to the other account (already on the server), so clear it first.
   */
  async attach(userId: string) {
    const prev = await this.local.getKV<string>(META.user);
    if (prev && prev !== userId) {
      await clear(this.outbox);
      await this.local.wipe();
    }
    await this.local.setKV(META.user, userId);
    if (!prev) await this.enqueueEverything();
    return this.sync();
  }

  /** Upload what's pending before signing out. Returns false if something could not be uploaded. */
  async beforeSignOut(): Promise<boolean> {
    await this.sync();
    return (await entries(this.outbox)).length === 0;
  }
}
