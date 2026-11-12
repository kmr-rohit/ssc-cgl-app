// In-memory app state backed by a StorageAdapter. Views read `app.*` and call the actions below.
import type { Attempt, CardState, MockRecord, Settings } from '../core/types';
import { DEFAULT_SETTINGS, LocalAdapter, type StorageAdapter, type BackupFile } from '../data/storage';
import { topicStats, type TopicStat } from '../core/analysis';
import { newCard, review, type Grade } from '../core/srs';

type Listener = () => void;

class AppState {
  db: StorageAdapter = new LocalAdapter();
  settings: Settings = { ...DEFAULT_SETTINGS };
  attempts: Attempt[] = [];
  mocks = new Map<string, MockRecord>();
  cards = new Map<string, CardState>();
  private statsCache: Record<string, TopicStat> | null = null;
  private listeners = new Set<Listener>();

  async init(db?: StorageAdapter) {
    if (db) this.db = db;
    const [s, a, m, c] = await Promise.all([this.db.getSettings(), this.db.listAttempts(), this.db.listMocks(), this.db.listCards()]);
    this.settings = s; this.attempts = a;
    this.mocks = new Map(m.map((x) => [x.key, x]));
    this.cards = new Map(c.map((x) => [x.id, x]));
    this.statsCache = null;
  }

  onChange(fn: Listener) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  private emit() { this.listeners.forEach((f) => f()); }

  get stats() { return (this.statsCache ??= topicStats(this.attempts)); }

  async addAttempts(list: Attempt[]) {
    if (!list.length) return;
    this.attempts.push(...list);
    this.statsCache = null;
    await this.db.addAttempts(list);
    this.emit();
  }

  async saveMock(m: MockRecord) {
    m.updatedAt = new Date().toISOString();
    this.mocks.set(m.key, m);
    await this.db.saveMock(structuredClone(m));
  }
  async deleteMock(key: string) { this.mocks.delete(key); await this.db.deleteMock(key); this.emit(); }

  async saveSettings(patch: Partial<Settings>) {
    this.settings = { ...this.settings, ...patch };
    await this.db.saveSettings(this.settings);
    this.emit();
  }

  async gradeCard(id: string, g: Grade) {
    const c = review(this.cards.get(id) ?? newCard(id), g);
    this.cards.set(id, c);
    await this.db.saveCards([c]);
  }

  exportAll() { return this.db.exportAll(); }
  async importAll(b: BackupFile) { await this.db.importAll(b); await this.init(); this.emit(); }
  async wipe() { await this.db.wipe(); await this.init(); this.emit(); }
}

export const app = new AppState();
