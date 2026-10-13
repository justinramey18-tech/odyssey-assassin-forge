import { describe, it, expect, beforeEach } from 'vitest';
import { readPartyChatCache, writePartyChatCache, clearPartyChatCache } from '../party-chat-cache';

// The phone keeps the party's recent chat so opening the app shows the
// conversation instantly while fresh messages load behind it.

describe('party chat cache', () => {
  beforeEach(() => localStorage.clear());

  const msg = (id: string, content = `line ${id}`) => ({ id, role: 'user', content });

  it('returns an empty list when nothing is cached', () => {
    expect(readPartyChatCache('party-1')).toEqual([]);
  });

  it('round-trips cached messages for the same party', () => {
    writePartyChatCache('party-1', [msg('a'), msg('b')]);
    const cached = readPartyChatCache('party-1');
    expect(cached.map((m) => m.id)).toEqual(['a', 'b']);
  });

  it('keeps each party’s cache separate', () => {
    writePartyChatCache('party-1', [msg('a')]);
    writePartyChatCache('party-2', [msg('z')]);
    expect(readPartyChatCache('party-1')[0]?.id).toBe('a');
    expect(readPartyChatCache('party-2')[0]?.id).toBe('z');
  });

  it('keeps only the newest 60 messages', () => {
    const many = Array.from({ length: 80 }, (_, i) => msg(`m${i}`));
    writePartyChatCache('party-1', many);
    const cached = readPartyChatCache('party-1');
    expect(cached).toHaveLength(60);
    expect(cached[0]?.id).toBe('m20');
    expect(cached[59]?.id).toBe('m79');
  });

  it('drops malformed entries instead of failing', () => {
    localStorage.setItem('odyssey-party-chat-cache::party-1', JSON.stringify([msg('ok'), { nope: 1 }, null]));
    expect(readPartyChatCache('party-1').map((m) => m.id)).toEqual(['ok']);
  });

  it('clear removes the party’s cache', () => {
    writePartyChatCache('party-1', [msg('a')]);
    clearPartyChatCache('party-1');
    expect(readPartyChatCache('party-1')).toEqual([]);
  });
});
