// StorageAdapter: the only way views/services touch persistence.
// Today: IndexedDB on this device (LocalAdapter). Later: a SupabaseAdapter with an outbox (see TECHNICAL_DESIGN §3.3).
import { createStore, del, entries, get, set, setMany, clear, type UseStore } from 'idb-keyval';
import type { Attempt, CardState, MockRecord, Settings } from '../core/types';

export const DEFAULT_SETTINGS: Settings = {
  name: '', target: 'pre', examDate: null, dailyHours: 3, theme: 'auto', paper2: false, newWordsPerDay: 10, examMode: true,
};

export interface BackupFile {
  app: 'cgl-prep'; schema: 1; exportedAt: string;
  settings: Settings; attempts: Attempt[]; mocks: MockRecord[]; cards: CardState[]; kv: Record<string, unknown>;
}

export interface StorageAdapter {
  getSettings(): Promise<Settings>;
  saveSettings(s: Settings): Promise<void>;
  listAttempts(): Promise<Attempt[]>;
  addAttempts(a: Attempt[]): Promise<void>;
  listMocks(): Promise<MockRecord[]>;
  saveMock(m: MockRecord): Promise<void>;
  deleteMock(key: string): Promise<void>;
  listCards(): Promise<CardState[]>;
  saveCards(c: CardState[]): Promise<void>;
  getKV<T>(key: string): Promise<T | undefined>;
  setKV(key: string, value: unknown): Promise<void>;
  exportAll(): Promise<BackupFile>;
  importAll(b: BackupFile): Promise<void>;
  wipe(): Promise<void>;
}

/** IndexedDB, one database per collection (idb-keyval keeps one object store per DB). */
export class LocalAdapter implements StorageAdapter {
  private s: Record<'settings' | 'attempts' | 'mocks' | 'cards' | 'kv', UseStore>;
  constructor(prefix = 'cglprep') {
    const mk = (n: string) => createStore(`${prefix}-${n}`, 'kv');
    this.s = { settings: mk('settings'), attempts: mk('attempts'), mocks: mk('mocks'), cards: mk('cards'), kv: mk('kv') };
  }
  async getSettings() { return { ...DEFAULT_SETTINGS, ...((await get<Settings>('settings', this.s.settings)) || {}) }; }
  saveSettings(st: Settings) { return set('settings', st, this.s.settings); }
  async listAttempts() {
    const all = (await entries<string, Attempt>(this.s.attempts)).map(([, v]) => v);
    return all.sort((a, b) => a.at.localeCompare(b.at));
  }
  addAttempts(a: Attempt[]) { return setMany(a.map((x) => [x.id, x]), this.s.attempts); }
  async listMocks() { return (await entries<string, MockRecord>(this.s.mocks)).map(([, v]) => v); }
  saveMock(m: MockRecord) { return set(m.key, m, this.s.mocks); }
  deleteMock(key: string) { return del(key, this.s.mocks); }
  async listCards() { return (await entries<string, CardState>(this.s.cards)).map(([, v]) => v); }
  saveCards(c: CardState[]) { return setMany(c.map((x) => [x.id, x]), this.s.cards); }
  getKV<T>(key: string) { return get<T>(key, this.s.kv); }
  setKV(key: string, value: unknown) { return set(key, value, this.s.kv); }
  async exportAll(): Promise<BackupFile> {
    return {
      app: 'cgl-prep', schema: 1, exportedAt: new Date().toISOString(),
      settings: await this.getSettings(), attempts: await this.listAttempts(), mocks: await this.listMocks(),
      cards: await this.listCards(), kv: Object.fromEntries(await entries<string, unknown>(this.s.kv)),
    };
  }
  async importAll(b: BackupFile) {
    if (b?.app !== 'cgl-prep' || b.schema !== 1) throw new Error('This is not a CGL Prep backup file.');
    await this.wipe();
    await this.saveSettings({ ...DEFAULT_SETTINGS, ...b.settings });
    await this.addAttempts(b.attempts || []);
    for (const m of b.mocks || []) await this.saveMock(m);
    await this.saveCards(b.cards || []);
    await setMany(Object.entries(b.kv || {}), this.s.kv);
  }
  async wipe() { await Promise.all(Object.values(this.s).map((st) => clear(st))); }
}

/** UUIDv7: time-ordered, so server inserts stay sequential and ids sort by creation time. */
export function uid(now = Date.now()): string {
  const b = new Uint8Array(16);
  globalThis.crypto.getRandomValues(b);
  let t = now;
  for (let i = 5; i >= 0; i--) { b[i] = t % 256; t = Math.floor(t / 256); }
  b[6] = (b[6] & 0x0f) | 0x70; // version 7
  b[8] = (b[8] & 0x3f) | 0x80; // RFC 4122 variant
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
