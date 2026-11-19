import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SoloQuestCards } from '@/components/empyrean/SoloQuestCards';
import type { QuestCard, QuestCardView } from '@/lib/empyrean-quest-hub';
import type { Quest } from '@/lib/quests';

const at = '2026-11-18T12:00:00.000Z';
const quest: Quest = {
  key: 'lost-journal', status: 'offered', title: 'Find the Lost Journal', category: 'academics', challengeRating: 'moderate',
  description: 'Somewhere in the Archives.', xpReward: 150, goldReward: 20,
  stages: [{ id: 's0', text: 'Ask the scribes', done: false }],
};
const card = (over: Partial<QuestCard>): QuestCard => ({ messageId: 'm1', questKey: 'lost-journal', kind: 'offered', title: 'Find the Lost Journal', at, ...over });

describe('SoloQuestCards', () => {
  afterEach(() => cleanup());

  it('draws nothing without cards', () => {
    const { container } = render(<SoloQuestCards views={[]} onAccept={vi.fn()} onDecline={vi.fn()} onOpenHub={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });

  it('an offer shows the quest and its Accept and Decline call back with the quest key', () => {
    const onAccept = vi.fn();
    const onDecline = vi.fn();
    const views: QuestCardView[] = [{ card: card({}), state: 'offer', quest }];
    render(<SoloQuestCards views={views} onAccept={onAccept} onDecline={onDecline} onOpenHub={vi.fn()} />);
    expect(screen.getByText('Find the Lost Journal')).toBeTruthy();
    expect(screen.getByText('First: Ask the scribes')).toBeTruthy();
    expect(screen.getByText('150 XP')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Accept the quest Find the Lost Journal'));
    fireEvent.click(screen.getByLabelText('Decline the quest Find the Lost Journal'));
    expect(onAccept).toHaveBeenCalledWith('lost-journal');
    expect(onDecline).toHaveBeenCalledWith('lost-journal');
  });

  it('Accept shows that the quest is being prepared while its GM guide is written; Decline still works', () => {

    const onAccept = vi.fn();

    const onDecline = vi.fn();

    const views: QuestCardView[] = [{ card: card({}), state: 'offer', quest }];

    render(<SoloQuestCards views={views} preparing={['lost-journal']} onAccept={onAccept} onDecline={onDecline} onOpenHub={vi.fn()} />);

    const accept = screen.getByLabelText('Accept the quest Find the Lost Journal') as HTMLButtonElement;

    expect(accept.disabled).toBe(true);

    expect(accept.textContent).toContain('Preparing your quest');

    fireEvent.click(accept);

    expect(onAccept).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('Decline the quest Find the Lost Journal'));

    expect(onDecline).toHaveBeenCalledWith('lost-journal');

  });



  it('Accept waits while the DM is writing; Decline does not', () => {
    const views: QuestCardView[] = [{ card: card({}), state: 'offer', quest }];
    render(<SoloQuestCards views={views} busy onAccept={vi.fn()} onDecline={vi.fn()} onOpenHub={vi.fn()} />);
    expect((screen.getByLabelText('Accept the quest Find the Lost Journal') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText('Decline the quest Find the Lost Journal') as HTMLButtonElement).disabled).toBe(false);
  });

  it('accepted, completed and failed cards open the Quest Hub and show what was paid', () => {
    const onOpenHub = vi.fn();
    const views: QuestCardView[] = [
      { card: card({}), state: 'accepted', quest: { ...quest, status: 'active' } },
      { card: card({ questKey: 'study', kind: 'completed', title: 'Study', xp: 300, gold: 20, points: 2 }), state: 'completed' },
      { card: card({ questKey: 'patrol', kind: 'failed', title: 'Patrol' }), state: 'failed' },
    ];
    render(<SoloQuestCards views={views} onAccept={vi.fn()} onDecline={vi.fn()} onOpenHub={onOpenHub} />);
    expect(screen.getByText('300 XP · 20 gold · +2 standing')).toBeTruthy();
    expect(screen.queryByLabelText('Accept the quest Find the Lost Journal')).toBeNull();
    fireEvent.click(screen.getByLabelText('Quest accepted: Find the Lost Journal. Open the Quest Hub'));
    fireEvent.click(screen.getByLabelText('Quest complete: Study. Open the Quest Hub'));
    fireEvent.click(screen.getByLabelText('Quest failed: Patrol. Open the Quest Hub'));
    expect(onOpenHub).toHaveBeenCalledTimes(3);
  });
});
