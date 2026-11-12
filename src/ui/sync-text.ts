import type { SyncStatus } from '../data/sync';

export const syncText = (s: SyncStatus) =>
  s.state === 'syncing' ? 'Syncing…'
  : s.state === 'offline' ? `Offline${s.pending ? `. ${s.pending} change${s.pending === 1 ? '' : 's'} waiting to sync` : ''}`
  : s.state === 'error' ? 'Sync problem. It will try again.'
  : s.state === 'idle' ? (s.pending ? `${s.pending} change${s.pending === 1 ? '' : 's'} waiting` : `Synced${s.lastSync ? ` ${new Date(s.lastSync).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : ''}`)
  : '';

