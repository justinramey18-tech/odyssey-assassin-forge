// Host Map Setup Assistant chat. Proposals change only the staged pack copy;
// it has no way to install the map or tick guide boxes.

import { useEffect, useRef, useState } from 'react';
import { Bot, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { loadApiKey } from '@/lib/api-keys';
import type { CampaignMapState } from '@/lib/campaign-map';
import type { MapPackGuide } from '@/lib/campaign-map-pack';
import { applyStagedOperations, stagedPackForAssistant, type StagedResult } from '@/lib/campaign-map-pack-ops';

const TOUCH = { touchAction: 'manipulation' as const };
type Msg = { role: 'user' | 'assistant'; content: string; note?: string };

export function MapSetupChat({ state, guides, imageWidth, imageHeight, packName, packDescription, onStaged }: {
  state: CampaignMapState;
  guides: MapPackGuide[];
  imageWidth: number;
  imageHeight: number;
  packName?: string;
  packDescription?: string;
  onStaged: (r: StagedResult) => void;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }); }, [msgs.length]);

  const someName = state.locations.find(l => !l.discovered)?.name;
  const starters = ['Explain this pack', 'Set Standard travel speed', someName ? `Make ${someName} discovered` : 'Which places can players see?', 'Check for logistical problems'];

  const send = async (content: string) => {
    const c = content.trim();
    if (!c || busy) return;
    const next = [...msgs, { role: 'user' as const, content: c }];
    setMsgs(next); setText(''); setBusy(true);
    try {
      const key = loadApiKey('anthropic');
      const { data, error } = await supabase.functions.invoke('campaign-map-assistant', {
        body: {
          messages: next.map(m => ({ role: m.role, content: m.content })),
          pack: stagedPackForAssistant(state, guides, { name: packName, description: packDescription, imageWidth, imageHeight }),
          ...(key ? { user_api_key: key } : {}),
        },
      });
      let errMsg: string | null = null;
      if (error) {
        try { errMsg = (await (error as { context?: Response }).context?.json())?.error ?? null; } catch { /* ignore */ }
        errMsg = errMsg || 'The assistant could not answer. The preview and install still work.';
      }
      if (errMsg || !data) { setMsgs(m => [...m, { role: 'assistant', content: errMsg ?? 'No answer.' }]); return; }
      const reply = String((data as { reply?: string }).reply ?? '');
      const ops = (data as { operations?: unknown[] }).operations ?? [];
      let note: string | undefined;
      if (Array.isArray(ops) && ops.length) {
        const r = applyStagedOperations(state, guides, ops, imageWidth, imageHeight);
        if (r.applied.length) onStaged(r);
        const parts: string[] = [];
        if (r.applied.length) parts.push(`Staged: ${r.applied.join(', ')}`);
        if (r.rejected.length) parts.push(`Not applied: ${r.rejected.map(x => `${x.label} — ${x.reason}`).join('; ')}`);
        note = parts.join('\n');
      }
      setMsgs(m => [...m, { role: 'assistant', content: reply, note }]);
    } finally { setBusy(false); }
  };

  return (
    <div className="rounded-lg border border-white/10 p-2.5 space-y-2" data-vaul-no-drag>
      <p className="text-[12px] text-white/80 font-semibold flex items-center gap-1.5"><Bot className="w-4 h-4 text-amber-300" />Map Setup Assistant</p>
      <p className="text-[11px] text-white/45">Changes it suggests apply only to this preview. You still install with the button below.</p>
      {msgs.length > 0 && (
        <div className="max-h-[40vh] overflow-y-auto overflow-x-hidden space-y-2">
          {msgs.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'ml-6 rounded-lg bg-amber-500/15 px-2.5 py-1.5' : 'mr-6 rounded-lg bg-white/5 px-2.5 py-1.5'}>
              <p className="text-[12px] text-white/85 whitespace-pre-wrap break-words">{m.content}</p>
              {m.note && <p className="mt-1 text-[11px] text-violet-200/80 whitespace-pre-wrap break-words">{m.note}</p>}
            </div>
          ))}
          {busy && <p className="text-[11px] text-white/40">Thinking…</p>}
          <div ref={endRef} />
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        {starters.map(s => (
          <Button key={s} size="sm" variant="outline" disabled={busy} className="min-h-[44px] justify-start text-left whitespace-normal h-auto" style={TOUCH} onClick={() => void send(s)}>{s}</Button>
        ))}
      </div>
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <Textarea value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} placeholder="Ask about or change the staged map…" className="min-h-[52px] text-[13px]" />
          <p className="text-[10px] text-white/40 text-right">{text.length}/1000</p>
        </div>
        <Button disabled={busy || !text.trim()} className="min-h-[48px] min-w-[48px]" style={TOUCH} onClick={() => void send(text)} aria-label="Send"><Send className="w-4 h-4" /></Button>
      </div>
    </div>
  );
}
