import * as JSZip from 'jszip';
import { supabase } from '@/integrations/supabase/client';

interface ExportMemberLookup {
  [userId: string]: string;
}

function stripHiddenTags(content: string): string {
  if (!content) return '';
  return content
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\[\[[\s\S]*?\]\]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function fmtTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export async function exportPartyStory(
  partyId: string,
  partyLabel: string,
  members: Array<{ user_id: string; character_name: string }>
): Promise<void> {
  const pageSize = 1000;
  let from = 0;
  let all: any[] = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await (supabase.from('party_dm_messages') as any)
      .select('*')
      .eq('party_id', partyId)
      .order('created_at', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  if (all.length === 0) {
    throw new Error('No messages to export yet.');
  }

  const lookup: ExportMemberLookup = {};
  for (const m of members) lookup[m.user_id] = m.character_name;

  const lines: string[] = [];
  lines.push(`# ${partyLabel || 'Party Campaign'} — Full Transcript`);
  lines.push('');
  lines.push(`Exported: ${fmtTimestamp(new Date().toISOString())}`);
  lines.push(`Total messages: ${all.length}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const msg of all) {
    const ts = fmtTimestamp(msg.created_at);
    let speaker: string;
    if (msg.role === 'assistant') {
      speaker = 'DM';
    } else if (msg.role === 'user') {
      speaker = msg.character_name || lookup[msg.sender_user_id] || 'Player';
    } else {
      speaker = msg.role || 'System';
    }
    const teamTag = msg.team && !String(msg.team).startsWith('whisper:') ? ` [${msg.team}]` : '';
    const whisperTag = msg.team && String(msg.team).startsWith('whisper:') ? ' [whisper]' : '';
    const cleaned = stripHiddenTags(msg.content || '');
    if (!cleaned) continue;
    lines.push(`### ${speaker}${teamTag}${whisperTag}  ·  ${ts}`);
    lines.push('');
    lines.push(cleaned);
    lines.push('');
  }

  const markdown = lines.join('\n');
  const rawJson = JSON.stringify(all, null, 2);

  const zip = new (JSZip as any)();
  const safeLabel = (partyLabel || 'campaign').replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 40) || 'campaign';
  zip.file(`${safeLabel}-transcript.md`, markdown);
  zip.file(`${safeLabel}-messages.json`, rawJson);

  const blob = await zip.generateAsync({ type: 'blob' });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeLabel}-story.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
