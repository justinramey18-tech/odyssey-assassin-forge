import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { loadApiKey } from '@/lib/api-keys';
import {
  stripMarkdownForTTS,
  splitTextForStitching,
  loadNarrationSpeed,
  loadSpeechifyVoiceId,
  loadSpeechifyDMVoiceId,
} from '@/lib/tts-utils';
import { toast } from 'sonner';

/** Which half of a DM response a clip belongs to. */
export type NarrationPart = 'story' | 'table';

export interface MessageAudioRow {
  message_id: string;
  part: NarrationPart;
  audio_url: string;
  voice_id: string | null;
  created_by: string;
  created_by_name: string | null;
}

export const narrationKey = (messageId: string, part: NarrationPart = 'story') => `${messageId}:${part}`;

interface UseMessageNarrationReturn {
  /** Keyed by `${messageId}:${part}`. */
  audioByMessage: Record<string, MessageAudioRow>;
  generatingId: string | null;
  playingId: string | null;
  generate: (messageId: string, text: string, part?: NarrationPart) => Promise<void>;
  play: (messageId: string, part?: NarrationPart) => void;
  playAll: (messageId: string) => void;
  stop: () => void;
  remove: (messageId: string, part?: NarrationPart) => Promise<void>;
  hasSpeechifyKey: boolean;
}

/**
 * Per-message narration for party DM messages.
 * Generated audio is uploaded to the shared party bucket and recorded in
 * party_message_audio so every player gets a play button on the same message.
 * Each message can hold two clips: the DM's table-talk aside and the story.
 */
export function useMessageNarration(
  partyId?: string,
  currentUserId?: string,
  currentUserName?: string,
): UseMessageNarrationReturn {
  const [audioByMessage, setAudioByMessage] = useState<Record<string, MessageAudioRow>>({});
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<Array<{ key: string; url: string }>>([]);

  const hasSpeechifyKey = !!loadApiKey('speechify');

  // ── Load + live-sync saved narrations ──
  useEffect(() => {
    if (!partyId) return;
    let cancelled = false;

    (async () => {
      const { data } = await (supabase.from('party_message_audio') as any)
        .select('message_id, part, audio_url, voice_id, created_by, created_by_name')
        .eq('party_id', partyId);
      if (cancelled || !data) return;
      const map: Record<string, MessageAudioRow> = {};
      for (const row of data as MessageAudioRow[]) {
        map[narrationKey(row.message_id, (row.part as NarrationPart) || 'story')] = row;
      }
      setAudioByMessage(map);
    })();

    const channel = supabase
      .channel(`party-message-audio-${partyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'party_message_audio', filter: `party_id=eq.${partyId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const old = payload.old as Partial<MessageAudioRow>;
            if (!old?.message_id) return;
            setAudioByMessage((prev) => {
              const next = { ...prev };
              delete next[narrationKey(old.message_id as string, (old.part as NarrationPart) || 'story')];
              return next;
            });
            return;
          }
          const row = payload.new as MessageAudioRow;
          if (!row?.message_id) return;
          setAudioByMessage((prev) => ({
            ...prev,
            [narrationKey(row.message_id, (row.part as NarrationPart) || 'story')]: row,
          }));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [partyId]);

  const stop = useCallback(() => {
    queueRef.current = [];
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingId(null);
  }, []);

  useEffect(() => () => { if (audioRef.current) audioRef.current.pause(); }, []);

  /** Plays the queue head, then advances. */
  const runQueue = useCallback(() => {
    const next = queueRef.current.shift();
    if (!next) {
      audioRef.current = null;
      setPlayingId(null);
      return;
    }
    const audio = new Audio(next.url);
    audio.playbackRate = loadNarrationSpeed();
    audio.onended = () => runQueue();
    audio.onerror = () => {
      toast.error('Could not play narration');
      queueRef.current = [];
      audioRef.current = null;
      setPlayingId(null);
    };
    audioRef.current = audio;
    setPlayingId(next.key);
    audio.play().catch(() => { queueRef.current = []; setPlayingId(null); });
  }, []);

  const play = useCallback((messageId: string, part: NarrationPart = 'story') => {
    const key = narrationKey(messageId, part);
    const row = audioByMessage[key];
    if (!row) return;
    if (playingId === key) { stop(); return; }
    stop();
    queueRef.current = [{ key, url: row.audio_url }];
    runQueue();
  }, [audioByMessage, playingId, stop, runQueue]);

  /** DM aside first, then the story narration. */
  const playAll = useCallback((messageId: string) => {
    const tableRow = audioByMessage[narrationKey(messageId, 'table')];
    const storyRow = audioByMessage[narrationKey(messageId, 'story')];
    const queue: Array<{ key: string; url: string }> = [];
    if (tableRow) queue.push({ key: narrationKey(messageId, 'table'), url: tableRow.audio_url });
    if (storyRow) queue.push({ key: narrationKey(messageId, 'story'), url: storyRow.audio_url });
    if (queue.length === 0) return;
    if (playingId && playingId.startsWith(`${messageId}:`)) { stop(); return; }
    stop();
    queueRef.current = queue;
    runQueue();
  }, [audioByMessage, playingId, stop, runQueue]);

  const generate = useCallback(async (messageId: string, rawText: string, part: NarrationPart = 'story') => {
    if (!partyId) return;
    const apiKey = loadApiKey('speechify');
    if (!apiKey) {
      toast.error('No Speechify API key', { description: 'Add one in Settings → API Keys.' });
      return;
    }
    if (generatingId) return;

    const key = narrationKey(messageId, part);
    setGeneratingId(key);
    try {
      const clean = stripMarkdownForTTS(rawText);
      if (!clean.trim()) throw new Error('Nothing to narrate in this message.');
      const chunks = splitTextForStitching(clean, 5000);
      const voiceId = part === 'table' ? loadSpeechifyDMVoiceId() : loadSpeechifyVoiceId();
      const blobs: Blob[] = [];

      for (const chunk of chunks) {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/speechify-tts`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ text: chunk, voice_id: voiceId, user_api_key: apiKey, audio_format: 'mp3' }),
          },
        );
        if (!response.ok) {
          const err = await response.json().catch(() => ({ error: 'Narration failed' }));
          throw new Error(err.error || `Narration failed: ${response.status}`);
        }
        blobs.push(await response.blob());
      }

      const finalBlob = new Blob(blobs, { type: 'audio/mpeg' });
      const path = `${partyId}/narration/${messageId}${part === 'table' ? '-table' : ''}.mp3`;
      const { error: uploadError } = await supabase.storage
        .from('party-chat-audio')
        .upload(path, finalBlob, { contentType: 'audio/mpeg', upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('party-chat-audio').getPublicUrl(path);
      const audioUrl = `${urlData.publicUrl}?v=${Date.now()}`;

      const row = {
        party_id: partyId,
        message_id: messageId,
        part,
        audio_url: audioUrl,
        voice_id: voiceId,
        provider: 'speechify',
        created_by: currentUserId,
        created_by_name: currentUserName || null,
      };
      const { error: insertError } = await (supabase.from('party_message_audio') as any)
        .upsert(row, { onConflict: 'message_id,part' });
      if (insertError) throw insertError;

      setAudioByMessage((prev) => ({
        ...prev,
        [key]: {
          message_id: messageId,
          part,
          audio_url: audioUrl,
          voice_id: voiceId,
          created_by: currentUserId || '',
          created_by_name: currentUserName || null,
        },
      }));
      toast.success(part === 'table' ? 'DM aside saved for the party' : 'Narration saved for the party');
    } catch (error) {
      console.error('[MessageNarration] generate failed:', error);
      toast.error(error instanceof Error ? error.message : 'Narration failed');
    } finally {
      setGeneratingId(null);
    }
  }, [partyId, currentUserId, currentUserName, generatingId]);

  const remove = useCallback(async (messageId: string, part: NarrationPart = 'story') => {
    if (!partyId) return;
    const key = narrationKey(messageId, part);
    if (playingId === key) stop();
    const { error } = await (supabase.from('party_message_audio') as any)
      .delete()
      .eq('party_id', partyId)
      .eq('message_id', messageId)
      .eq('part', part);
    if (error) {
      toast.error('Could not remove narration');
      return;
    }
    await supabase.storage
      .from('party-chat-audio')
      .remove([`${partyId}/narration/${messageId}${part === 'table' ? '-table' : ''}.mp3`]);
    setAudioByMessage((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, [partyId, playingId, stop]);

  return { audioByMessage, generatingId, playingId, generate, play, playAll, stop, remove, hasSpeechifyKey };
}
