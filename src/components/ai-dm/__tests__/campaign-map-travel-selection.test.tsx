import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { PartyCampaignMapApi } from '@/hooks/use-party-campaign-map';
import { calibrationFromMapWidth, sanitizeCampaignMapState, type TravelPace } from '@/lib/campaign-map';
vi.mock('../MapPackAssistant', () => ({ MapPackAssistant: () => null }));
vi.mock('../AreaMapEditor', () => ({ AreaMapEditor: () => null }));
vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  SheetDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
}));
vi.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: { children: ReactNode; value: string; onValueChange: (v: string) => void }) => <select aria-label="Travel choice" value={value} onChange={e => onValueChange(e.target.value)}>{children}</select>,
  SelectTrigger: () => null, SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => <option value={value}>{children}</option>,
}));
import { CampaignMapPanel } from '../CampaignMapPanel';
afterEach(cleanup);
function setup(city = false) {
  const state = sanitizeCampaignMapState({ imageUrl: '/map.jpg', imageNaturalWidth: 1000, imageNaturalHeight: 500,
    mapCalibration: calibrationFromMapWidth(1000, 500, 80), currentLocationId: 'a', travelScale: city ? 'city' : 'overland',
    locations: [{ id: 'a', name: 'Start', x: 0, y: 0, discovered: true }, { id: 'b', name: 'Roadless peak', x: 1, y: 0, discovered: true }], routes: [] });
  const startJourney = vi.fn(async () => ({ ok: false, error: 'Travel preparation unavailable.' }));
  const map = { rawState: state, canWrite: true, loading: false, startJourney,
    getViewState: () => ({ state, position: { x: 0, y: 0 }, campaignMinute: 0 }) } as unknown as PartyCampaignMapApi;
  render(<CampaignMapPanel open onOpenChange={() => {}} map={map} />);
  return { startJourney, state };
}
describe('campaign map travel selection', () => {
  it('offers all five overland methods, reaches a roadless destination by flight, and forwards flying unchanged', async () => {
    const { startJourney, state } = setup();
    const choice = screen.getByRole('combobox', { name: 'Travel choice' });
    expect(Array.from(choice.querySelectorAll('option')).map(o => o.value)).toEqual(['slow', 'normal', 'fast', 'horseback', 'flying']);
    expect(screen.queryByRole('button', { name: /Roadless peak/ })).toBeNull();
    fireEvent.change(choice, { target: { value: 'flying' satisfies TravelPace } });
    fireEvent.click(screen.getByRole('button', { name: /Roadless peak/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Begin Journey' }));
    await waitFor(() => expect(startJourney).toHaveBeenCalledWith('b', 'flying'));
    expect(state.currentLocationId).toBe('a');
    expect(state.routes).toEqual([]);
  });
  it('city offers only the original three walking choices', () => {
    setup(true);
    expect(Array.from(screen.getByRole('combobox').querySelectorAll('option')).map(o => o.value)).toEqual(['slow', 'normal', 'fast']);
  });
});