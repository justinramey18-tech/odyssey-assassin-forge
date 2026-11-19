import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { EmpyreanQuestHub } from '@/components/empyrean/EmpyreanQuestHub';

import { emptyHubState } from '@/lib/empyrean-quest-hub';

import type { EmpyreanQuests } from '@/hooks/use-empyrean-quests';

import type { Quest } from '@/lib/quests';



const offered: Quest = { key: 'ledger', status: 'offered', title: 'The Missing Ledger', category: 'academics', challengeRating: 'moderate', stages: [{ id: 'a', text: 'Find the scribe', done: false }] };

const active: Quest = { key: 'study', status: 'active', title: 'Study Hard', category: 'academics', challengeRating: 'easy', stages: [{ id: 's0', text: 'Read', done: false }, { id: 's1', text: 'Recite', done: false }] };



function api(over: Partial<EmpyreanQuests>): EmpyreanQuests {

  return {

    quests: [offered, active], worldState: [], hub: emptyHubState(), cards: [], current: active, strainCeiling: 8, seeking: null,

    getActiveQuests: () => [active], applyExtraction: vi.fn(), recordWorldState: vi.fn(), accept: vi.fn(), decline: vi.fn(),

    guidedKeys: [], preparing: [], prepareGuide: vi.fn(), applyQuestTags: vi.fn(), moveCategory: vi.fn(), seek: vi.fn(),

    ...over,

  } as EmpyreanQuests;

}



describe('EmpyreanQuestHub GM guides', () => {

  // jsdom has no scrollIntoView; the hub scrolls its category chip into view when it opens.

  beforeAll(() => { Element.prototype.scrollIntoView = vi.fn(); });

  afterEach(() => cleanup());



  it('an active quest without a guide offers to write one; with a guide it shows the chip and never the guide', () => {

    const prepareGuide = vi.fn();

    const first = render(<EmpyreanQuestHub open onClose={vi.fn()} api={api({ prepareGuide })} startCategory="academics" />);

    fireEvent.click(screen.getByText('Write a GM guide for the DM'));

    expect(prepareGuide).toHaveBeenCalledWith('study');

    expect(screen.queryByText('GM guide')).toBeNull();

    first.unmount();

    render(<EmpyreanQuestHub open onClose={vi.fn()} api={api({ guidedKeys: ['study'] })} startCategory="academics" />);

    expect(screen.getByText('GM guide')).toBeTruthy();

    expect(screen.queryByText('Write a GM guide for the DM')).toBeNull();

  });



  it('shows the work in progress on Accept and on the guide button', () => {

    const accept = vi.fn();

    render(<EmpyreanQuestHub open onClose={vi.fn()} api={api({ preparing: ['ledger', 'study'], accept })} startCategory="academics" />);

    const btn = screen.getByText('Preparing your quest…').closest('button') as HTMLButtonElement;

    expect(btn.disabled).toBe(true);

    fireEvent.click(btn);

    expect(accept).not.toHaveBeenCalled();

    expect((screen.getByText('Writing the GM guide…').closest('button') as HTMLButtonElement).disabled).toBe(true);

  });

});
