import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SoloFightSetupSheet } from '@/components/empyrean/SoloFightSetupSheet';
afterEach(cleanup);
describe('named solo sparring', () => {
  it('starts the selected squadmate nonlethally on the mat without a dragon', () => {
    const start = vi.fn();
    render(<SoloFightSetupSheet mode="spar" onOpenChange={vi.fn()} bonded dragonName="Gwyn" flying={false} busy={false} onStart={start} preset={{ foeKind: 'cadet', foeName: 'Dain Aetos', challenge: 'hard' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Step onto the mat' }));
    expect(start).toHaveBeenCalledExactlyOnceWith({ foeKind: 'cadet', foeName: 'Dain Aetos', count: 1, challenge: 'hard', lethal: false, arena: 'mat' });
  });
});