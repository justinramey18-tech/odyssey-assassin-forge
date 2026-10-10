import { describe, it, expect, vi, beforeAll } from 'vitest';
import { createRef } from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';

vi.mock('@/integrations/supabase/client', () => {
  const channel: any = { on: () => channel, subscribe: () => channel, track: async () => {}, untrack: () => {}, presenceState: () => ({}) };
  return { supabase: { channel: () => channel, removeChannel: () => {} } };
});

import { RoundChatDrawer, type RoundChatDrawerHandle } from '@/components/ai-dm/RoundChatDrawer';
import { DEFAULT_ROUND_STYLE, type RoundChatMessage } from '@/hooks/use-round-chat';

beforeAll(() => {
  // jsdom has no layout: give the feed something to scroll.
  Element.prototype.scrollTo = function scrollTo() {} as any;
  Element.prototype.scrollIntoView = function scrollIntoView() {} as any;
});

const HOST = 'host-user';
const KAEL = 'kael-user';
const P1 = 'aaaaaaaa-0000-4000-8000-000000000001';
const G1 = 'aaaaaaaa-0000-4000-8000-000000000002';

const msg = (over: Partial<RoundChatMessage>): RoundChatMessage => ({
  id: P1, party_id: 'party', user_id: KAEL, character_name: 'Kaelen', content: 'Where is the pup?',
  in_character: true, round_id: 'round', consumed: false, selected: false, created_at: '2026-10-10T12:00:01Z', npc_id: null, ...over,
});

const messages: RoundChatMessage[] = [
  msg({}),
  msg({ id: G1, user_id: HOST, character_name: 'Grukk', npc_id: 'npc-grukk', content: `[reply:${P1}]\n*spits* Not telling.`, created_at: '2026-10-10T12:00:02Z' }),
];

const npcs = [
  { id: 'npc-grukk', name: 'Grukk', portrait_url: null, on_stage: true, archived: false },
  { id: 'npc-mira', name: 'Mira', portrait_url: null, on_stage: true, archived: false },
  { id: 'npc-ollie', name: 'Ollie', portrait_url: null, on_stage: false, archived: false },
];

function open(props: Partial<React.ComponentProps<typeof RoundChatDrawer>> = {}) {
  const ref = createRef<RoundChatDrawerHandle>();
  const onSend = vi.fn(async () => true);
  const onSendToNpcs = vi.fn(async () => true);
  const onSpeakAsNpc = vi.fn(async () => true);
  const onRegenerateNpcLine = vi.fn();
  const utils = render(
    <RoundChatDrawer
      ref={ref}
      partyId="party"
      messages={messages}
      reactions={[]}
      currentUserId={KAEL}
      characterName="Kaelen"
      style={{ ...DEFAULT_ROUND_STYLE, mode: 'live' }}
      progress={{ current: 0, waiting: 2, met: false }}
      sending={false}
      isGenerating={false}
      isHost={false}
      onSend={onSend}
      onToggleReaction={() => {}}
      onDeleteMessage={() => {}}
      onToggleSelected={() => {}}
      onSelectAll={() => {}}
      onClearSelection={() => {}}
      onSendToDMNow={() => {}}
      npcs={npcs}
      npcThinking={[]}
      onSendToNpcs={onSendToNpcs}
      {...props}
    />,
  );
  act(() => { ref.current?.open(); });
  return { ...utils, onSend, onSendToNpcs, onSpeakAsNpc, onRegenerateNpcLine };
}

const box = () => screen.getByRole('textbox') as HTMLTextAreaElement;
const send = () => fireEvent.click(screen.getByRole('button', { name: 'Send round chat message' }));

describe('Live Table with NPCs', () => {
  it("shows the NPC's line as the NPC's, with a badge, never as the host's", () => {
    open();
    expect(screen.getAllByText('Grukk').length).toBeGreaterThan(0);
    expect(screen.getByText('NPC')).toBeInTheDocument();
    expect(screen.getByText('*spits* Not telling.')).toBeInTheDocument();
  });

  it('offers Talk to chips for NPCs on stage only', () => {
    open();
    expect(screen.getByRole('button', { name: 'Talk to Grukk' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Talk to Mira' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Talk to Ollie' })).toBeNull();
  });

  it('a picked chip makes the NPC answer, and stays picked for the next line', async () => {
    const { onSendToNpcs, onSend } = open();
    fireEvent.click(screen.getByRole('button', { name: 'Talk to Mira' }));
    fireEvent.change(box(), { target: { value: 'Have you seen the pup?' } });
    expect(screen.getByText(/Mira will answer/)).toBeInTheDocument();
    await act(async () => { send(); });
    expect(onSendToNpcs).toHaveBeenCalledWith('Have you seen the pup?', ['npc-mira']);
    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Talk to Mira' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('an @mention wins over the chips', async () => {
    const { onSendToNpcs } = open();
    fireEvent.click(screen.getByRole('button', { name: 'Talk to Mira' }));
    fireEvent.change(box(), { target: { value: '@Grukk you again?' } });
    expect(screen.getByText(/Grukk will answer/)).toBeInTheDocument();
    await act(async () => { send(); });
    expect(onSendToNpcs).toHaveBeenCalledWith('@Grukk you again?', ['npc-grukk']);
  });

  it('with no NPC picked, a line posts as before', async () => {
    const { onSendToNpcs, onSend } = open();
    fireEvent.change(box(), { target: { value: 'I check the well.' } });
    await act(async () => { send(); });
    expect(onSend).toHaveBeenCalledWith('I check the well.', true);
    expect(onSendToNpcs).not.toHaveBeenCalled();
  });

  it('a line that fails to post goes back in the box', async () => {
    const { onSend } = open({ onSend: vi.fn(async () => false) });
    fireEvent.change(box(), { target: { value: 'Do not lose me.' } });
    await act(async () => { send(); });
    expect(box().value).toBe('Do not lose me.');
    void onSend;
  });

  it('shows who is thinking', () => {
    open({ npcThinking: [{ key: 'k', npcId: 'npc-grukk', name: 'Grukk', messageId: P1, kind: 'answer' }] });
    expect(screen.getByText('Grukk is thinking…')).toBeInTheDocument();
  });

  it('players never see Speak as', () => {
    open();
    expect(screen.queryByRole('button', { name: /Talking to NPCs/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Speak as Grukk/ })).toBeNull();
  });

  it('the host can speak as an NPC', async () => {
    const onSpeakAsNpc = vi.fn(async () => true);
    const { onSend, onSendToNpcs } = open({ currentUserId: HOST, canManageNpcs: true, onSpeakAsNpc });
    fireEvent.click(screen.getByRole('button', { name: /Talking to NPCs/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Speak as Grukk' }));
    expect(screen.getByText('You are speaking as Grukk.')).toBeInTheDocument();
    fireEvent.change(box(), { target: { value: 'Back off.' } });
    await act(async () => { send(); });
    expect(onSpeakAsNpc).toHaveBeenCalledWith('Back off.', 'npc-grukk');
    expect(onSend).not.toHaveBeenCalled();
    expect(onSendToNpcs).not.toHaveBeenCalled();
  });

  it('the host can ask an NPC for a new answer', () => {
    const onRegenerateNpcLine = vi.fn();
    open({ currentUserId: HOST, canManageNpcs: true, onRegenerateNpcLine });
    fireEvent.click(screen.getByText('*spits* Not telling.'));
    fireEvent.click(screen.getByRole('button', { name: 'Ask Grukk for a new answer' }));
    expect(onRegenerateNpcLine).toHaveBeenCalledWith(G1, 'npc-grukk');
  });

  it('a player can not regenerate, edit or delete an NPC line', () => {
    open();
    fireEvent.click(screen.getByText('*spits* Not telling.'));
    expect(screen.queryByRole('button', { name: /new answer/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit message' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete message' })).toBeNull();
  });
});
