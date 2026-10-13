import { beforeEach, describe, expect, it } from 'vitest';
import { liveTableCacheKey, readLiveTableCache, reconcileTableLines, writeLiveTableCache } from '../live-table-cache';
import type { RoundChatMessage } from '@/hooks/use-round-chat';

const line = (id: string, seconds = 1): RoundChatMessage => ({
  id, party_id: 'party', user_id: 'player', character_name: 'Xeyle', content: `line ${id}`,
  round_id: 'round', in_character: true, consumed: false, selected: false,
  created_at: `2026-10-13T00:00:${String(seconds).padStart(2, '0')}Z`,
});
beforeEach(() => localStorage.clear());

describe('Live Table device cache', () => {
  it('separates accounts and parties', () => {
    writeLiveTableCache(liveTableCacheKey('a', 'party'), [line('one')]);
    expect(readLiveTableCache(liveTableCacheKey('a', 'party'))).toEqual([line('one')]);
    expect(readLiveTableCache(liveTableCacheKey('b', 'party'))).toEqual([]);
    expect(readLiveTableCache(liveTableCacheKey('a', 'other'))).toEqual([]);
    expect(readLiveTableCache(liveTableCacheKey(undefined, 'party'))).toEqual([]);
  });
  it('keeps the newest 60 complete lines in reading order', () => {
    const rows = Array.from({ length: 70 }, (_, i) => ({ ...line(String(i)), created_at: new Date(1760313600000 + i * 1000).toISOString() }));
    rows[69].content = 'x'.repeat(5000);
    const key = liveTableCacheKey('a', 'party');
    writeLiveTableCache(key, rows.reverse());
    const saved = readLiveTableCache(key);
    expect(saved).toHaveLength(60);
    expect(saved[0].id).toBe('10');
    expect(saved[59].content).toHaveLength(5000);
  });
  it('rejects damaged cached rows', () => {
    const key = liveTableCacheKey('a', 'party');
    if (!key) throw new Error('Missing test key');
    localStorage.setItem(key, JSON.stringify([line('ok'), { ...line('bad'), created_at: 'bad' }, { ...line('wrong'), party_id: 'other' }]));
    expect(readLiveTableCache(key).map(m => m.id)).toEqual(['ok']);
  });
  it('drops stale and deleted cache rows after a successful server read', () => {
    const before = [line('old'), line('keep')];
    expect(reconcileTableLines([{ ...line('keep'), selected: true }], before, before)).toEqual([{ ...line('keep'), selected: true }]);
    expect(reconcileTableLines([], before, before)).toEqual([]);
  });
  it('keeps arrivals and edits during refresh without restoring live deletions', () => {
    const before = [line('deleted'), line('edited', 2)];
    const edit = { ...before[1], content: 'updated' };
    const arrival = line('arrived', 3);
    expect(reconcileTableLines(before, before, [arrival, edit])).toEqual([edit, arrival]);
  });
});