import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StrainMeter } from '@/components/empyrean/meters/StrainMeter';
import { SignetManagementDrawer } from '@/components/empyrean/SignetManagementDrawer';

afterEach(() => cleanup());

describe('Signet Strain controls', () => {
  it('the meter shows − only when a handler is given; + stays', () => {
    const { rerender } = render(<StrainMeter level={3} max={8} onUp={vi.fn()} />);
    expect(screen.queryByLabelText('Lower Signet Strain')).toBeNull();
    expect(screen.getByLabelText('Raise Signet Strain')).toBeTruthy();
    expect(screen.getByText('3/8')).toBeTruthy();
    rerender(<StrainMeter level={3} max={8} onUp={vi.fn()} onDown={vi.fn()} />);
    expect(screen.getByLabelText('Lower Signet Strain')).toBeTruthy();
  });

  it('the signet sheet hides Reset Strain without a handler; Ground Yourself stays', () => {
    const { rerender } = render(
      <SignetManagementDrawer open onOpenChange={vi.fn()} signetType="Lightning Wielder" burnoutLevel={4} maxBurnout={8} onGroundYourself={vi.fn()} />,
    );
    expect(screen.queryByText('Reset Strain')).toBeNull();
    expect(screen.getByText('Ground Yourself')).toBeTruthy();
    rerender(
      <SignetManagementDrawer open onOpenChange={vi.fn()} signetType="Lightning Wielder" burnoutLevel={4} maxBurnout={8} onGroundYourself={vi.fn()} onResetStrain={vi.fn()} />,
    );
    expect(screen.getByText('Reset Strain')).toBeTruthy();
  });
});
