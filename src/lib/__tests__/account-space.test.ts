import { describe, it, expect } from 'vitest';
import {
  EMPYREAN_AUTH_PATH,
  PENDING_MAX_AGE_MS,
  SEPARATE_EMPYREAN_KEY,
  SPACE_ERROR_KEY,
  SPACE_KEY,
  SPACE_PENDING_KEY,
  applyPendingSwitch,
  currentSpace,
  hasLiveLogin,
  hasParkedLogin,
  isDeviceKey,
  parkKey,
  readPendingSwitch,
  setSeparateEmpyrean,
  shouldEnterEmpyreanSeparately,
  takeSwitchError,
  writePendingSwitch,
  type KV,
} from '@/lib/account-space';

/** In-memory Storage with an optional size limit (characters of keys + values), like a phone's. */
class FakeStorage implements KV {
  private m = new Map<string, string>();
  constructor(private limit = Infinity, init: Record<string, string> = {}) {
    for (const [k, v] of Object.entries(init)) this.m.set(k, v);
  }
  get length() { return this.m.size; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) {
    const size = [...this.m].reduce((n, [a, b]) => n + (a === k ? 0 : a.length + b.length), 0) + k.length + v.length;
    if (size > this.limit) throw new Error('QuotaExceededError');
    this.m.set(k, String(v));
  }
  dump() { return Object.fromEntries(this.m); }
}

const AUTH = 'sb-abc123-auth-token';
const NOW = 1_700_000_000_000;

function odysseyPhone() {
  return new FakeStorage(Infinity, {
    [AUTH]: '{"user":"main"}',
    'odyssey-active-cloud-save-id': 'save-main',
    'odyssey-hp-state::save-main': '{"hp":30}',
    'odyssey-dm-game-state': '{"main":true}',
    'dnd-anthropic-api-key': 'sk-device',
    'dnd-character-race::save-main': 'elf',
    [SEPARATE_EMPYREAN_KEY]: 'true',
  });
}

describe('keys and flags', () => {
  it('keeps API keys, AI preferences and the bookkeeping keys device-wide', () => {
    expect(isDeviceKey('dnd-anthropic-api-key')).toBe(true);
    expect(isDeviceKey(SEPARATE_EMPYREAN_KEY)).toBe(true);
    expect(isDeviceKey(SPACE_KEY)).toBe(true);
    expect(isDeviceKey(parkKey('odyssey', 'x'))).toBe(true);
    expect(isDeviceKey(AUTH)).toBe(false);
    expect(isDeviceKey('dnd-use-claude-everywhere')).toBe(true);
    expect(isDeviceKey('dnd-skip-feature-sfx')).toBe(true);
    // Character data that happens to start with "dnd-" belongs to a space.
    expect(isDeviceKey('dnd-character-gender')).toBe(false);
    expect(isDeviceKey('dnd-character-gender::save-1')).toBe(false);
    expect(isDeviceKey('dnd-anthropic-api-key::save-1')).toBe(false);
    expect(isDeviceKey('dnd-ai-dm-session')).toBe(false);
    expect(isDeviceKey('odyssey-active-cloud-save-id')).toBe(false);
  });

  it('only switches separately when the option is on and the phone is in Odyssey', () => {
    const s = new FakeStorage();
    expect(shouldEnterEmpyreanSeparately(s)).toBe(false);
    setSeparateEmpyrean(true, s);
    expect(shouldEnterEmpyreanSeparately(s)).toBe(true);
    s.setItem(SPACE_KEY, 'empyrean');
    expect(shouldEnterEmpyreanSeparately(s)).toBe(false);
    setSeparateEmpyrean(false, s);
    expect(s.getItem(SEPARATE_EMPYREAN_KEY)).toBeNull();
  });

  it('ignores a pending switch that is stale, malformed or points off-site', () => {
    const s = new FakeStorage();
    writePendingSwitch({ to: 'empyrean', at: NOW - PENDING_MAX_AGE_MS - 1 }, s);
    expect(readPendingSwitch(s, NOW)).toBeNull();
    s.setItem(SPACE_PENDING_KEY, '{"to":"mars","at":' + NOW + '}');
    expect(readPendingSwitch(s, NOW)).toBeNull();
    writePendingSwitch({ to: 'empyrean', at: NOW, returnTo: '//evil.example', carry: ['dnd-anthropic-api-key', 'ok'] }, s);
    expect(readPendingSwitch(s, NOW)).toEqual({ to: 'empyrean', at: NOW, returnTo: undefined, carry: ['ok'] });
  });
});

describe('applyPendingSwitch', () => {
  it('does nothing without a pending switch', () => {
    const s = odysseyPhone();
    const before = s.dump();
    expect(applyPendingSwitch(s, NOW)).toEqual({ switched: false, from: 'odyssey', to: 'odyssey' });
    expect(s.dump()).toEqual(before);
  });

  it('first switch to Empyrean parks everything of Odyssey, login included, and starts empty', () => {
    const s = odysseyPhone();
    writePendingSwitch({ to: 'empyrean', at: NOW, returnTo: '/' }, s);
    const r = applyPendingSwitch(s, NOW);
    expect(r).toMatchObject({ switched: true, from: 'odyssey', to: 'empyrean', returnTo: '/', moved: { parked: 5, restored: 0 } });
    expect(currentSpace(s)).toBe('empyrean');
    expect(hasLiveLogin(s)).toBe(false);
    expect(hasParkedLogin('odyssey', s)).toBe(true);
    expect(s.getItem('odyssey-hp-state::save-main')).toBeNull();
    expect(s.getItem(parkKey('odyssey', 'odyssey-hp-state::save-main'))).toBe('{"hp":30}');
    expect(s.getItem('dnd-anthropic-api-key')).toBe('sk-device');
    expect(s.getItem(SPACE_PENDING_KEY)).toBeNull();
    // The boot step would now open the Empyrean sign-in page.
    expect(EMPYREAN_AUTH_PATH).toBe('/empyrean-auth');
  });

  it('round trip: each space gets exactly its own data and login back', () => {
    const s = odysseyPhone();
    writePendingSwitch({ to: 'empyrean', at: NOW }, s);
    applyPendingSwitch(s, NOW);
    // Signed in to Empyrean, played a bit.
    s.setItem(AUTH, '{"user":"rider"}');
    s.setItem('odyssey-active-cloud-save-id', 'save-rider');
    s.setItem('odyssey-dm-game-state', '{"rider":true}');

    writePendingSwitch({ to: 'odyssey', at: NOW }, s);
    expect(applyPendingSwitch(s, NOW)).toMatchObject({ switched: true, from: 'empyrean', to: 'odyssey' });
    expect(currentSpace(s)).toBe('odyssey');
    expect(s.getItem(SPACE_KEY)).toBeNull();
    expect(s.getItem(AUTH)).toBe('{"user":"main"}');
    expect(s.getItem('odyssey-active-cloud-save-id')).toBe('save-main');
    expect(s.getItem('odyssey-dm-game-state')).toBe('{"main":true}');
    expect(s.getItem('odyssey-hp-state::save-main')).toBe('{"hp":30}');
    expect(s.getItem(parkKey('empyrean', AUTH))).toBe('{"user":"rider"}');

    writePendingSwitch({ to: 'empyrean', at: NOW }, s);
    applyPendingSwitch(s, NOW);
    expect(s.getItem(AUTH)).toBe('{"user":"rider"}');
    expect(s.getItem('odyssey-dm-game-state')).toBe('{"rider":true}');
    expect(s.getItem('odyssey-hp-state::save-main')).toBeNull();
  });

  it('carried keys move with the player instead of being parked', () => {
    const s = odysseyPhone();
    s.setItem('odyssey-ai-creation-draft', '{"buildData":{"empyrean":{}}}');
    writePendingSwitch({ to: 'empyrean', at: NOW, carry: ['odyssey-ai-creation-draft'], returnTo: '/ai-create' }, s);
    const r = applyPendingSwitch(s, NOW);
    expect(r.returnTo).toBe('/ai-create');
    expect(s.getItem('odyssey-ai-creation-draft')).toBe('{"buildData":{"empyrean":{}}}');
    expect(s.getItem(parkKey('odyssey', 'odyssey-ai-creation-draft'))).toBeNull();
  });

  it('a switch to the space you are already in only clears the pending note', () => {
    const s = odysseyPhone();
    writePendingSwitch({ to: 'odyssey', at: NOW, returnTo: '/roster' }, s);
    expect(applyPendingSwitch(s, NOW)).toEqual({ switched: false, from: 'odyssey', to: 'odyssey', returnTo: '/roster' });
    expect(s.getItem(SPACE_PENDING_KEY)).toBeNull();
    expect(s.getItem(AUTH)).toBe('{"user":"main"}');
  });

  it('on a full phone it moves everything back, stays put and reports why', () => {
    const base = odysseyPhone().dump();
    const used = Object.entries(base).reduce((n, [k, v]) => n + k.length + v.length, 0);
    // Room for the pending note, but not for the longer parked key names (5 keys × 22 characters).
    const pendingSize = SPACE_PENDING_KEY.length + JSON.stringify({ to: 'empyrean', at: NOW }).length;
    const s = new FakeStorage(used + pendingSize + 30, base);
    writePendingSwitch({ to: 'empyrean', at: NOW }, s);
    const r = applyPendingSwitch(s, NOW);
    expect(r.switched).toBe(false);
    expect(r.error).toMatch(/Couldn't switch accounts/);
    expect(currentSpace(s)).toBe('odyssey');
    for (const [k, v] of Object.entries(base)) expect(s.getItem(k)).toBe(v);
    expect(takeSwitchError(s)).toMatch(/Couldn't switch/);
    expect(takeSwitchError(s)).toBeNull();
  });
});
