import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { createRef, useState } from 'react';
import { render, screen, act, cleanup } from '@testing-library/react';

vi.mock('@/integrations/supabase/client', () => {
  const channel: any = { on: () => channel, subscribe: () => channel, track: async () => {}, untrack: () => {}, presenceState: () => ({}) };
  return { supabase: { channel: () => channel, removeChannel: () => {} } };
});

import { RoundChatDrawer, type RoundChatDrawerHandle } from '@/components/ai-dm/RoundChatDrawer';
import { DEFAULT_ROUND_STYLE, type RoundChatMessage } from '@/hooks/use-round-chat';

beforeAll(() => {
  Element.prototype.scrollTo = function scrollTo() {} as any;
  Element.prototype.scrollIntoView = function scrollIntoView() {} as any;
});
afterEach(() => cleanup());

const ME = 'rider-user';
const line = (over: Partial<RoundChatMessage>): RoundChatMessage => ({
  id: 'aaaaaaaa-0000-4000-8000-000000000001', party_id: 'solo', user_id: ME, character_name: 'Kylar', content: 'Do you know when evening formation is?',
  in_character: true, round_id: 'solo-live-table', consumed: false, selected: false, created_at: '2026-11-18T12:00:01Z', npc_id: null, ...over,
});

function Harness({ oneChat, messages, handle }: { oneChat: boolean; messages: RoundChatMessage[]; handle: React.RefObject<RoundChatDrawerHandle> }) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  return (
    <div>
      <div data-testid="story">
        <p>The DM's last post.</p>
        <div ref={setHost} data-testid="feed-host" />
      </div>
      <div data-testid="dock">
        <RoundChatDrawer
          ref={handle}
          messages={messages}
          reactions={[]}
          currentUserId={ME}
          characterName="Kylar"
          style={{ ...DEFAULT_ROUND_STYLE, mode: 'live' }}
          progress={{ current: 0, waiting: 1, met: false }}
          sending={false}
          isGenerating={false}
          isHost
          onSend={async () => true}
          onToggleReaction={() => {}}
          onDeleteMessage={() => {}}
          onToggleSelected={() => {}}
          onSelectAll={() => {}}
          onClearSelection={() => {}}
          onSendToDMNow={() => {}}
          presenceIds={new Set([ME])}
          presenceReady
          readReceiptsLoaded
          npcThinking={[{ key: 't1', npcId: 'npc-1', name: 'Ridoc', messageId: 'x', kind: 'answer' }]}
          onClearAll={() => {}}
          {...(oneChat ? { storyFeedHost: host } : {})}
        />
      </div>
    </div>
  );
}

describe('RoundChatDrawer solo one-chat (storyFeedHost)', () => {
  it('draws the table lines and the thinking row inside the story, keeps the composer in the dock, and has no banner or full-screen layer', () => {
    const handle = createRef<RoundChatDrawerHandle>();
    render(<Harness oneChat messages={[line({})]} handle={handle} />);
    const host = screen.getByTestId('feed-host');
    const dock = screen.getByTestId('dock');
    expect(host.textContent).toContain('Do you know when evening formation is?');
    expect(host.textContent).toContain('Ridoc');
    expect(dock.textContent).not.toContain('Do you know when evening formation is?');
    expect(dock.querySelector('textarea, input[type="text"]')).toBeTruthy();
    expect(screen.queryByLabelText('Return to story: close the Live DM Table')).toBeNull();
    expect(screen.queryByLabelText('Open the Live DM Table')).toBeNull();
    expect(dock.innerHTML).not.toContain('fixed inset-0');
    expect(screen.queryByText('Clear chat for everyone')).toBeNull();
  });

  it('cannot be closed: close() leaves the composer and the lines where they are', () => {
    const handle = createRef<RoundChatDrawerHandle>();
    render(<Harness oneChat messages={[line({})]} handle={handle} />);
    act(() => { handle.current?.close(); });
    expect(screen.getByTestId('feed-host').textContent).toContain('Do you know when evening formation is?');
    expect(screen.getByTestId('dock').querySelector('textarea, input[type="text"]')).toBeTruthy();
    expect(screen.queryByLabelText('Open the Live DM Table')).toBeNull();
  });

  it('shows no empty-table hint in the story when there are no lines', () => {
    const handle = createRef<RoundChatDrawerHandle>();
    render(<Harness oneChat messages={[]} handle={handle} />);
    expect(screen.queryByText('Live table is open')).toBeNull();
  });

  it('without storyFeedHost nothing changes: the table starts closed behind PLAY and opens full screen with its own list', () => {
    const handle = createRef<RoundChatDrawerHandle>();
    render(<Harness oneChat={false} messages={[line({})]} handle={handle} />);
    expect(screen.getByLabelText('Open the Live DM Table')).toBeTruthy();
    expect(screen.getByTestId('feed-host').textContent).toBe('');
    act(() => { handle.current?.open(); });
    expect(screen.getByLabelText('Return to story: close the Live DM Table')).toBeTruthy();
    expect(screen.getByTestId('dock').innerHTML).toContain('fixed inset-0');
    expect(screen.getByTestId('dock').textContent).toContain('Do you know when evening formation is?');
    expect(screen.getByText('Clear chat for everyone')).toBeTruthy();
    act(() => { handle.current?.close(); });
    expect(screen.getByLabelText('Open the Live DM Table')).toBeTruthy();
  });
});
