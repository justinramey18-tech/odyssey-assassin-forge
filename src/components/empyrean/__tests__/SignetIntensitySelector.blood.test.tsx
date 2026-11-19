import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SignetIntensitySelector } from '@/components/empyrean/SignetIntensitySelector';

const button = (n: number) => screen.getAllByRole('button').find(b => (b.textContent || '').replace(/-\d+$/, '') === String(n)) as HTMLButtonElement;

describe('signet intensity picker: Lifeblood', () => {
  afterEach(() => cleanup());

  it('without Lifeblood, nothing over the room left can be picked (as before)', () => {
    render(<SignetIntensitySelector currentBurnout={6} maxBurnout={8} selected={null} onSelect={vi.fn()} onCancel={vi.fn()} />);
    expect(button(2).disabled).toBe(false);
    expect(button(3).disabled).toBe(true);
    expect(screen.queryByText(/in blood/)).toBeNull();
  });

  it('with Lifeblood, a bigger channel can be picked and shows its price in HP', () => {
    const onSelect = vi.fn();
    render(<SignetIntensitySelector currentBurnout={6} maxBurnout={8} selected={null} onSelect={onSelect} onCancel={vi.fn()} bloodPrice={4} currentHP={30} />);
    expect(button(2).textContent).toBe('2');
    expect(button(3).disabled).toBe(false);
    expect(button(3).textContent).toBe('3-4');
    expect(button(5).textContent).toBe('5-12');
    expect(screen.getByText(/each point costs up to 4 HP in blood/)).toBeTruthy();
    fireEvent.click(button(4));
    expect(onSelect).toHaveBeenCalledWith(4);
  });

  it('a channel that would take the last HP stays locked', () => {
    render(<SignetIntensitySelector currentBurnout={6} maxBurnout={8} selected={null} onSelect={vi.fn()} onCancel={vi.fn()} bloodPrice={4} currentHP={9} />);
    expect(button(4).disabled).toBe(false);
    expect(button(5).disabled).toBe(true);
  });

  it('at the limit nothing can be picked, with or without Lifeblood', () => {
    render(<SignetIntensitySelector currentBurnout={8} maxBurnout={8} selected={null} onSelect={vi.fn()} onCancel={vi.fn()} bloodPrice={2} currentHP={30} />);
    expect(button(1).disabled).toBe(true);
    expect(screen.getByText(/too burned out/)).toBeTruthy();
  });

  it('warns when the chosen channel is paid partly in blood', () => {
    render(<SignetIntensitySelector currentBurnout={6} maxBurnout={8} selected={4} onSelect={vi.fn()} onCancel={vi.fn()} bloodPrice={3} currentHP={30} />);
    expect(screen.getByText(/paid partly in blood: up to 6 HP/)).toBeTruthy();
  });
});
