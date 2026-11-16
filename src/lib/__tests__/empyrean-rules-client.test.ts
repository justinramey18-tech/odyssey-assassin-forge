import { describe, it, expect, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: vi.fn() } } }));
import { supabase } from '@/integrations/supabase/client';
import { buildGameFacts, callRules, checkRisk, signetStrainCost } from '@/lib/empyrean-rules-client';
import { signetStrainCost as serverCost } from '../../../supabase/functions/empyrean-rules/rules';

const ctx = { campaignId: 'c', riderKey: 'local', bonded: false };

describe('rules client', () => {
  it('charges the same strain as the server at every rank and intensity', () => {
    for (let rank = 0; rank <= 4; rank++) for (let i = 1; i <= 8; i++) expect(signetStrainCost(i, rank)).toBe(serverCost(i, rank));
  });
  it('reads the risk of a check from its wording', () => {
    expect(checkRisk('Channel your signet to hold the shadow (DC 15)')).toBe('signet');
    expect(checkRisk('Dexterity (Acrobatics) to cross the Parapet')).toBe('physical');
    expect(checkRisk('Wisdom (Insight): is he lying?')).toBe('mental');
  });
  it('builds one facts block, or nothing when the engine is off', () => {
    expect(buildGameFacts('', '')).toBe('');
    const block = buildGameFacts('Time: Day 2, 10:00', "RIDER'S AREA: The Continent > Basgiath");
    expect(block).toContain('## GAME FACTS (from the app, binding)');
    expect(block.indexOf('Time: Day 2')).toBeLessThan(block.indexOf("RIDER'S AREA"));
    expect(buildGameFacts('Time: Day 2, 10:00', null)).not.toContain('undefined');
  });
  it('treats an unreachable or malformed server as "engine off"', async () => {
    const invoke = supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>;
    invoke.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });
    expect(await callRules('state', ctx)).toBeNull();
    invoke.mockResolvedValueOnce({ data: { error: 'Sign in required.' }, error: null });
    expect(await callRules('state', ctx)).toBeNull();
    invoke.mockRejectedValueOnce(new Error('offline'));
    expect(await callRules('state', ctx)).toBeNull();
    invoke.mockResolvedValueOnce({ data: { ok: true, version: 3, inbox: [] }, error: null });
    expect((await callRules('rest', ctx, { kind: 'short' }))?.version).toBe(3);
    expect(invoke).toHaveBeenLastCalledWith('empyrean-rules', { body: { action: 'rest', campaignId: 'c', riderKey: 'local', bonded: false, kind: 'short' } });
  });
});
