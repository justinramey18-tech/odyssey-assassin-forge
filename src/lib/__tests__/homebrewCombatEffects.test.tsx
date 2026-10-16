import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HomebrewSpellCreateSheet } from '@/components/magic/HomebrewSpellCreateSheet';
import { createDefaultHomebrewSpell } from '@/lib/spellCustomization/utils';
import type { HomebrewSpell } from '@/lib/spellCustomization/types';

vi.mock('@/lib/api-keys', () => ({ getEverywhereKey: () => null }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const saved = () => ({
  ...createDefaultHomebrewSpell(), name: 'Shield Ward', description: 'A protective ward.',
  rowGuides: { '1': 'Keep this private rule.' },
  combatEffects: [{ kind: 'ac_bonus', amount: 2, durationSeconds: 60 }],
  futureField: { keep: true },
}) as HomebrewSpell & { futureField: { keep: boolean } };

describe('homebrew support edit round trips', () => {
  it('loads a newly selected spell and preserves buff and unknown fields on update', () => {
    const onSave = vi.fn();
    const props = { onSave, onClose: vi.fn() };
    const { rerender } = render(<HomebrewSpellCreateSheet {...props} isOpen={false} />);
    const original = saved();
    rerender(<HomebrewSpellCreateSheet {...props} isOpen editSpell={original} />);
    fireEvent.click(screen.getByRole('button', { name: 'Update Spell' }));
    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave.mock.calls[0][0]).toMatchObject({ name: 'Shield Ward', rowGuides: original.rowGuides, combatEffects: original.combatEffects, futureField: original.futureField });
  });
  it('blocks saving malformed support metadata', () => {
    const onSave = vi.fn();
    const original = saved();
    original.combatEffects = [{ kind: 'ac_bonus', amount: NaN, durationSeconds: 60 }];
    render(<HomebrewSpellCreateSheet isOpen onSave={onSave} onClose={vi.fn()} editSpell={original} />);
    fireEvent.click(screen.getByRole('button', { name: 'Update Spell' }));
    expect(onSave).not.toHaveBeenCalled();
  });
  it('ignores AI-provided effects while preserving manually configured effects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ result: JSON.stringify({ name: 'Generated Ward', combatEffects: [{ kind: 'attack_bonus', amount: 20, durationSeconds: 600 }] }) }) }));
    const onSave = vi.fn();
    const original = saved();
    render(<HomebrewSpellCreateSheet isOpen onSave={onSave} onClose={vi.fn()} editSpell={original} />);
    fireEvent.click(screen.getByRole('button', { name: 'AI Generate' }));
    await waitFor(() => expect(screen.getByDisplayValue('Generated Ward')).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: 'Update Spell' }));
    expect(onSave.mock.calls[0][0].combatEffects).toEqual(original.combatEffects);
  });
});