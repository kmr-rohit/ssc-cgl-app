import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { LocalAdapter } from './storage';

describe('backup files', () => {
  it('never carry internal sync keys out of or into a device', async () => {
    const a = new LocalAdapter(`unit-a-${Date.now()}`);
    await a.setKV('__sync_user', 'user-a');
    await a.setKV('__sync_kv_ts:streak', '2026-11-12T00:00:00.000Z');
    await a.setKV('streak', 5);
    const file = await a.exportAll();
    expect(file.kv).toEqual({ streak: 5 });

    const b = new LocalAdapter(`unit-b-${Date.now()}`);
    await b.importAll({ ...file, kv: { ...file.kv, __sync_user: 'user-a', __sync_attempts_cursor: '2026-01-01' } });
    expect(await b.getKV('streak')).toBe(5);
    expect(await b.getKV('__sync_user')).toBeUndefined();
    expect(await b.getKV('__sync_attempts_cursor')).toBeUndefined();
  });
});
