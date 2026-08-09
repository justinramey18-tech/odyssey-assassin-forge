import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { loadApiKey } from '@/lib/api-keys';
import {
  stripMarkdownForTTS,
  splitTextForStitching,
  loadNarrationSpeed,
  loadSpeechifyVoiceId,
} from '@/lib/tts-utils';
import { toast } from 'sonner';

export interface MessageAudioRow {
  message_id: string;
  audio_url: string;
  voice_id: string | null;
  created_by: string;
  created_by_name: string | null;
}

interface UseMessageNarrationReturn {
  audioByMessage: Record<string, MessageAudioRow>;
  generatingId: string | null;
  playingId: string | null;
  generate: (messageId: string, text: string) => Promise<void>;
  play: (messageId: string) => void;
  stop: () => void;
  remove: (messageId: string) => Promise<void>;
  hasSpeechifyKey: boolean;
}

/**
 * Per-message narration for party DM messages.
 * Generated audio is uploaded to the shared party bucket and recorded in
 * party_message_audio so every player gets a play button on the same message.
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

  const hasSpeechifyKey = !!loadApiKey('speechify');

  // ── Load + live-sync saved narrations ──
  useEffect(() => {
    if (!partyId) return;
    let cancelled = false;

    (async () => {
      const { data } = await (supabase.from('party_message_audio') as any)
        .select('message_id, audio_url, voice_id, created_by, created_by_name')
        .eq('party_id', partyId);
      if (cancelled || !data) return;
      const map: Record<string, MessageAudioRow> = {};
      for (const row of data as MessageAudioRow[]) map[row.message_id] = row;
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
              delete next[old.message_id as string];
              return next;
            });
            return;
          }
          const row = payload.new as MessageAudioRow;
          if (!row?.message_id) return;
          setAudioByMessage((prev) => ({ ...prev, [row.message_id]: row }));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [partyId]);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingId(null);
  }, []);

  useEffect(() => () => { if (audioRef.current) audioRef.current.pause(); }, []);

  const play = useCallback((messageId: string) => {
    const row = audioByMessage[messageId];
    if (!row) return;
    if (playingId === messageId) {
      stop();
      return;
    }
    stop();
    const audio = new Audio(row.audio_url);
    audio.playbackRate = loadNarrationSpeed();
    audio.onended = () => { audioRef.current = null; setPlayingId(null); };
    audio.onerror = () => { toast.error('Could not play narration'); audioRef.current = null; setPlayingId(null); };
    audioRef.current = audio;
    setPlayingId(messageId);
    audio.play().catch(() => { setPlayingId(null); });
  }, [audioByMessage, playingId, stop]);

  const generate = useCallback(async (messageId: string, rawText: string) => {
    if (!partyId) return;
    const apiKey = loadApiKey('speechify');
    if (!apiKey) {
      toast.error('No Speechify API key', { description: 'Add one in Settings → API Keys.' });
      return;
    }
    if (generatingId) return;

    setGeneratingId(messageId);
    try {
      const clean = stripMarkdownForTTS(rawText);
      if (!clean.trim()) throw new Error('Nothing to narrate in this message.');
      const chunks = splitTextForStitching(clean, 5000);
      const voiceId = loadSpeechifyVoiceId();
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
      const path = `${partyId}/narration/${messageId}.mp3`;
      const { error: uploadError } = await supabase.storage
        .from('party-chat-audio')
        .upload(path, finalBlob, { contentType: 'audio/mpeg', upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('party-chat-audio').getPublicUrl(path);
      const audioUrl = urlData.publicUrl;

      const row = {
        party_id: partyId,
        message_id: messageId,
        audio_url: audioUrl,
        voice_id: voiceId,
        provider: 'speechify',
        created_by: currentUserId,
        created_by_name: currentUserName || null,
      };
      const { error: insertError } = await (supabase.from('party_message_audio') as any)
        .upsert(row, { onConflict: 'message_id' });
      if (insertError) throw insertError;

      setAudioByMessage((prev) => ({
        ...prev,
        [messageId]: {
          message_id: messageId,
          audio_url: audioUrl,
          voice_id: voiceId,
          created_by: currentUserId || '',
          created_by_name: currentUserName || null,
        },
      }));
      toast.success('Narration saved for the party');
    } catch (error) {
      console.error('[MessageNarration] generate failed:', error);
      toast.error(error instanceof Error ? error.message : 'Narration failed');
    } finally {
      setGeneratingId(null);
    }
  }, [partyId, currentUserId, currentUserName, generatingId]);

  const remove = useCallback(async (messageId: string) => {
    if (!partyId) return;
    if (playingId === messageId) stop();
    const { error } = await (supabase.from('party_message_audio') as any)
      .delete()
      .eq('party_id', partyId)
      .eq('message_id', messageId);
    if (error) {
      toast.error('Could not remove narration');
      return;
    }
    await supabase.storage.from('party-chat-audio').remove([`${partyId}/narration/${messageId}.mp3`]);
    setAudioByMessage((prev) => {
      const next = { ...prev };
      delete next[messageId];
      return next;
    });
  }, [partyId, playingId, stop]);

  return { audioByMessage, generatingId, playingId, generate, play, stop, remove, hasSpeechifyKey };
}
