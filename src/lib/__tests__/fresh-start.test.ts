import { describe, it, expect } from 'vitest';
import { applyPendingSwitch, writePendingSwitch } from '@/lib/account-space';
import { FRESH_START_ID, FRESH_START_KEY, runFreshStart } from '@/lib/fresh-start';

function memoryStorage(entries: Record<string, string>) {
  const m = new Map(Object.entries(entries));
  return {
    get length() { return m.size; },
    key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { m.set(k, String(v)); },
    removeItem: (k: string) => { m.delete(k); },
    dump: () => Object.fromEntries(m),
  };
}

describe('fresh start (hard reset)', () => {
  it('keeps the login, API keys and device switches; clears everything else', () => {
    const s = memoryStorage({
      'sb-abc-auth-token': '{"access_token":"x"}',
      'sb-abc-auth-token-code-verifier': 'v',
      'dnd-anthropic-api-key': 'k1',
      'dnd-venice-api-key': 'k2',
      'dnd-use-claude-everywhere': 'true',
      'dnd-skip-feature-voice': 'true',
      'dnd-separate-empyrean-account': 'true',
      'odyssey-space': 'odyssey',
      'odyssey-active-cloud-save-id': 'save-1',
      'odyssey-spellcasting::save-1': '{}',
      'empyrean-dragon-bond-state::save-1': '{}',
      'odyssey-shop': '{"shopGold":900}',
      'dnd-character-gender': 'f',
      'odyssey-app-mode': 'party',
    });
    const r = runFreshStart(s);
    expect(r.ran).toBe(true);
    expect(r.removed).toBe(6);
    expect(Object.keys(s.dump()).sort()).toEqual([
      'dnd-anthropic-api-key', 'dnd-separate-empyrean-account', 'dnd-skip-feature-voice', 'dnd-use-claude-everywhere',
      'dnd-venice-api-key', FRESH_START_KEY, 'odyssey-space', 'sb-abc-auth-token', 'sb-abc-auth-token-code-verifier',
    ].sort());
    expect(s.getItem(FRESH_START_KEY)).toBe(FRESH_START_ID);
  });

  it('keeps a parked Empyrean login but clears the parked game data (D-28)', () => {
    const s = memoryStorage({
      'odyssey-space:empyrean:sb-abc-auth-token': 'login',
      'odyssey-space:empyrean:empyrean-dm-config::save-9': '{}',
      'odyssey-space:empyrean:odyssey-active-cloud-save-id': 'save-9',
      'odyssey-space:empyrean:dnd-openai-api-key': 'k',
    });
    runFreshStart(s);
    expect(Object.keys(s.dump()).sort()).toEqual([
      FRESH_START_KEY, 'odyssey-space:empyrean:dnd-openai-api-key', 'odyssey-space:empyrean:sb-abc-auth-token',
    ].sort());
  });

  it('runs once per id, and clears session storage when it runs', () => {
    let cleared = 0;
    const session = { clear: () => { cleared += 1; } };
    const s = memoryStorage({ 'odyssey-shop': '{}' });
    expect(runFreshStart(s, session).ran).toBe(true);
    s.setItem('odyssey-shop', '{"new":"character"}');
    expect(runFreshStart(s, session)).toEqual({ ran: false, removed: 0, kept: 0 });
    expect(s.getItem('odyssey-shop')).toBe('{"new":"character"}');
    expect(cleared).toBe(1);
  });
});

describe('fresh start across account switches', () => {
  it('does not reset newly created data when switching to Empyrean and back', () => {
    const s = memoryStorage({ 'sb-abc-auth-token': 'main-login' });
    let cleared = 0;
    const session = { clear: () => { cleared += 1; } };
    runFreshStart(s, session);
    s.setItem('odyssey-shop', '{"new":"odyssey"}');
    writePendingSwitch({ to: 'empyrean', at: 1000 }, s);
    expect(applyPendingSwitch(s, 1000).switched).toBe(true);
    s.setItem('sb-abc-auth-token', 'rider-login');
    s.setItem('odyssey-shop', '{"new":"empyrean"}');
    expect(runFreshStart(s, session).ran).toBe(false);
    expect(s.getItem('odyssey-shop')).toBe('{"new":"empyrean"}');
    writePendingSwitch({ to: 'odyssey', at: 1001 }, s);
    expect(applyPendingSwitch(s, 1001).switched).toBe(true);
    expect(runFreshStart(s, session).ran).toBe(false);
    expect(s.getItem('odyssey-shop')).toBe('{"new":"odyssey"}');
    expect(s.getItem('sb-abc-auth-token')).toBe('main-login');
    expect(s.getItem('odyssey-space:empyrean:odyssey-shop')).toBe('{"new":"empyrean"}');
    expect(s.getItem('odyssey-space:empyrean:sb-abc-auth-token')).toBe('rider-login');
    expect(cleared).toBe(1);
  });
});
