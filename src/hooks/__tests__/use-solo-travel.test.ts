import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSoloTravel, type TravelMap } from '@/hooks/use-solo-travel';

function fakeMap(activeMapId: string, over: Partial<TravelMap> = {}): TravelMap {
  return {
    activeMapId,
    startJourney: vi.fn(async () => ({ ok: true })),
    enterChildMap: vi.fn(async () => ({ ok: true })),
    exitToParentMap: vi.fn(async () => ({ ok: true })),
    moveWithinLocalMap: vi.fn(async () => ({ ok: true })),
    ...over,
  };
}

describe('useSoloTravel', () => {
  it('each kind of trip calls the matching map function', async () => {
    const map = fakeMap('child');
    const { result } = renderHook(() => useSoloTravel(map));
    await act(async () => { expect(await result.current.go({ kind: 'move', locationId: 'mat', name: 'The Mat' })).toEqual({ ok: true }); });
    expect(map.moveWithinLocalMap).toHaveBeenCalledWith('mat');
    await act(async () => { await result.current.go({ kind: 'enter', childMapId: 'c2', name: 'Archives' }); });
    expect(map.enterChildMap).toHaveBeenCalledWith('c2');
    await act(async () => { await result.current.go({ kind: 'leave', parentMapId: 'root', name: 'The Continent' }); });
    expect(map.exitToParentMap).toHaveBeenCalledTimes(1);
    await act(async () => { await result.current.go({ kind: 'journey', locationId: 'montserrat', name: 'Montserrat' }, 'flying'); });
    expect(map.startJourney).toHaveBeenCalledWith('montserrat', 'flying');
  });

  it('a place on the map above: leaves first, and starts the journey only once the map shows the rider outside', async () => {
    const start = vi.fn(async () => ({ ok: true }));
    const exit = vi.fn(async () => ({ ok: true }));
    const { result, rerender } = renderHook((p: { active: string }) => useSoloTravel(fakeMap(p.active, { startJourney: start, exitToParentMap: exit })), { initialProps: { active: 'child' } });
    let outcome: unknown = null;
    let pending: Promise<void> = Promise.resolve();
    await act(async () => {
      pending = result.current.go({ kind: 'leave-journey', parentMapId: 'root', locationId: 'samara', name: 'Samara' }, 'normal').then(r => { outcome = r; });
      await new Promise(r => setTimeout(r, 10));
    });
    expect(exit).toHaveBeenCalledTimes(1);
    expect(start).not.toHaveBeenCalled();
    expect(result.current.busy).toBe(true);
    rerender({ active: 'root' });
    await act(async () => { await pending; });
    expect(start).toHaveBeenCalledWith('samara', 'normal');
    expect(outcome).toEqual({ ok: true });
    expect(result.current.busy).toBe(false);
  });

  it('reports a failed step, never starts a journey after a failed exit, and gives up if the map never catches up', async () => {
    const start = vi.fn(async () => ({ ok: true }));
    const stuck = renderHook(() => useSoloTravel(fakeMap('child', { startJourney: start, exitToParentMap: vi.fn(async () => ({ ok: false, error: 'Finish or stop the travel first.' })) })));
    await act(async () => { expect(await stuck.result.current.go({ kind: 'leave-journey', parentMapId: 'root', locationId: 'samara', name: 'Samara' })).toEqual({ ok: false, error: 'Finish or stop the travel first.' }); });
    expect(start).not.toHaveBeenCalled();

    const slow = renderHook(() => useSoloTravel(fakeMap('child', { startJourney: start }), 30));
    await act(async () => {
      const r = await slow.result.current.go({ kind: 'leave-journey', parentMapId: 'root', locationId: 'samara', name: 'Samara' });
      expect(r.ok).toBe(false);
    });
    expect(start).not.toHaveBeenCalled();

    const noRoad = renderHook(() => useSoloTravel(fakeMap('root', { startJourney: vi.fn(async () => ({ ok: false, error: "There's no known road there yet." })) })));
    await act(async () => { expect(await noRoad.result.current.go({ kind: 'journey', locationId: 'x', name: 'X' })).toEqual({ ok: false, error: "There's no known road there yet." }); });
  });
});