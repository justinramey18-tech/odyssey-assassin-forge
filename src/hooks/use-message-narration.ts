import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { loadApiKey } from '@/lib/api-keys';
import {
  stripMarkdownForTTS,
  splitTextForStitching,
  loadNarrationSpeed,
  loadSpeechifyVoiceId,
  loadSpeechifyDMVoiceId,
  splitDMResponseParts,
  splitStorySegments,
  segmentKey,
  voiceForSpeaker,
  addNarrationOverride,
  loadNarrationOverrides,
  mergeNarrationOverrides,
  isSelfRecordedVoice,
  SELF_RECORDED_VOICE_ID,
  type NarrationSegment,
  type NarrationOverride,
} from '@/lib/tts-utils';

import { toast } from 'sonner';
import { duckMusicForNarration, restoreMusicAfterNarration } from '@/lib/narrationDucking';
import { beginNarrationFocus, endNarrationFocus, getNarrationAudio } from '@/lib/audioFocus';


/**
 * Which clip of a DM response this audio belongs to.
 * 'table' = the DM's out-of-character aside, 'story' = the whole story read in
 * one voice, 'seg-<n>' = one speaker-tagged (or narrator) chunk of the story.
 */
export type NarrationPart = string;

/** Legacy index-based id, kept so old saved clips still resolve. */
export const segmentPart = (index: number) => `seg-${index}`;

export interface MessageAudioRow {
  message_id: string;
  part: NarrationPart;
  audio_url: string;
  voice_id: string | null;
  created_by: string;
  created_by_name: string | null;
}

export const narrationKey = (messageId: string, part: NarrationPart = 'story') => `${messageId}:${part}`;

export interface CastProgress {
  messageId: string;
  done: number;
  total: number;
  speaker: string | null;
}

interface UseMessageNarrationReturn {
  /** Keyed by `${messageId}:${part}`. */
  audioByMessage: Record<string, MessageAudioRow>;
  generatingId: string | null;
  playingId: string | null;
  castProgress: CastProgress | null;
  /** Name of the speaker whose clip is playing right now, if known. */
  speakingName: string | null;
  generate: (messageId: string, text: string, part?: NarrationPart) => Promise<void>;
  /** Generates the DM aside plus one clip per story segment, in cast voices. */
  generateCast: (messageId: string, content: string) => Promise<void>;
  play: (messageId: string, part?: NarrationPart) => void;
  /** Plays the DM aside, then every story segment in story order. */
  playAll: (messageId: string, content?: string) => void;
  stop: () => void;
  remove: (messageId: string, part?: NarrationPart) => Promise<void>;
  /** Deletes every clip saved for a message. */
  removeAll: (messageId: string) => Promise<void>;
  /**
   * Saves a mic recording for a highlighted passage of a DM message.
   * The passage becomes its own segment, so Play all uses the recording there.
   */
  recordSegment: (messageId: string, content: string, passage: string, blob: Blob, label?: string) => Promise<void>;
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
  const [castProgress, setCastProgress] = useState<CastProgress | null>(null);
  const [speakingName, setSpeakingName] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<Array<{ key: string; url: string; speaker?: string | null }>>([]);
  const audioMapRef = useRef<Record<string, MessageAudioRow>>({});
  audioMapRef.current = audioByMessage;

  const hasSpeechifyKey = !!loadApiKey('speechify');

  // ── Party-shared highlight overrides (so recorded passages split the same
  //    way on every device, and everyone hears the recording in Play all) ──
  const applySharedOverrides = useCallback((rows: Array<{ state_data: any }>) => {
    let changed = false;
    for (const row of rows) {
      const messages = row?.state_data?.messages;
      if (!messages || typeof messages !== 'object') continue;
      for (const [messageId, list] of Object.entries(messages)) {
        if (!Array.isArray(list)) continue;
        if (mergeNarrationOverrides(messageId, list as NarrationOverride[])) changed = true;
      }
    }
    if (changed && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('odyssey-narration-overrides'));
    }
  }, []);

  useEffect(() => {
    if (!partyId) return;
    let cancelled = false;

    (async () => {
      const { data } = await (supabase.from('party_shared_state') as any)
        .select('state_data')
        .eq('party_id', partyId)
        .eq('state_type', 'narration_overrides');
      if (cancelled || !data) return;
      applySharedOverrides(data);
    })();

    const channel = supabase
      .channel(`party-narration-overrides-${partyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'party_shared_state', filter: `party_id=eq.${partyId}` },
        (payload) => {
          const row = payload.new as { state_type?: string; state_data?: any };
          if (!row || row.state_type !== 'narration_overrides') return;
          applySharedOverrides([row as { state_data: any }]);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [partyId, applySharedOverrides]);

  /** Publishes this device's overrides for a message to the rest of the party. */
  const publishOverrides = useCallback(async (messageId: string) => {
    if (!partyId || !currentUserId) return;
    try {
      const { data: existing } = await (supabase.from('party_shared_state') as any)
        .select('id, state_data')
        .eq('party_id', partyId)
        .eq('user_id', currentUserId)
        .eq('state_type', 'narration_overrides')
        .maybeSingle();

      const messages = { ...(existing?.state_data?.messages || {}) };
      messages[messageId] = loadNarrationOverrides(messageId);

      if (existing?.id) {
        await (supabase.from('party_shared_state') as any)
          .update({ state_data: { messages } })
          .eq('id', existing.id);
      } else {
        await (supabase.from('party_shared_state') as any).insert({
          party_id: partyId,
          user_id: currentUserId,
          state_type: 'narration_overrides',
          state_data: { messages },
        });
      }
    } catch (error) {
      console.warn('[MessageNarration] could not share passage voices:', error);
    }
  }, [partyId, currentUserId]);

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
        map[narrationKey(row.message_id, row.part || 'story')] = row;
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
              delete next[narrationKey(old.message_id as string, old.part || 'story')];
              return next;
            });
            return;
          }
          const row = payload.new as MessageAudioRow;
          if (!row?.message_id) return;
          setAudioByMessage((prev) => ({
            ...prev,
            [narrationKey(row.message_id, row.part || 'story')]: row,
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
    setSpeakingName(null);
    void restoreMusicAfterNarration();
    void endNarrationFocus();
  }, []);

  useEffect(() => () => {
    if (audioRef.current) audioRef.current.pause();
    void restoreMusicAfterNarration();
    void endNarrationFocus();
  }, []);

  /** Plays the queue head, then advances. */
  const runQueue = useCallback(() => {
    const next = queueRef.current.shift();
    if (!next) {
      audioRef.current = null;
      setPlayingId(null);
      setSpeakingName(null);
      void restoreMusicAfterNarration();
      void endNarrationFocus();
      return;
    }
    void duckMusicForNarration();
    // One shared, mix-friendly player for every clip so the phone doesn't grab
    // the speaker afresh on each segment and stop the music.
    const audio = getNarrationAudio();
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
    audio.src = next.url;
    audio.playbackRate = loadNarrationSpeed();
    audio.onended = () => runQueue();
    audio.onerror = () => {
      toast.error('Could not play narration');
      queueRef.current = [];
      audioRef.current = null;
      setPlayingId(null);
      setSpeakingName(null);
      void restoreMusicAfterNarration();
      void endNarrationFocus();
    };
    audioRef.current = audio;
    setPlayingId(next.key);
    setSpeakingName(next.speaker ?? null);
    void beginNarrationFocus().finally(() => {
      audio.play().catch(() => {
        queueRef.current = [];
        setPlayingId(null);
        setSpeakingName(null);
        void restoreMusicAfterNarration();
        void endNarrationFocus();
      });
    });
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

  /** DM aside first, then the story — segment by segment when cast clips exist. */
  const playAll = useCallback((messageId: string, content?: string) => {
    const queue: Array<{ key: string; url: string; speaker?: string | null }> = [];
    const tableRow = audioByMessage[narrationKey(messageId, 'table')];
    if (tableRow) queue.push({ key: narrationKey(messageId, 'table'), url: tableRow.audio_url, speaker: 'DM' });

    const segments = content ? splitStorySegments(splitDMResponseParts(content).story, messageId) : [];
    let addedSegments = 0;
    segments.forEach((seg, i) => {
      const part = segmentKey(seg);
      const row = audioByMessage[narrationKey(messageId, part)]
        || audioByMessage[narrationKey(messageId, segmentPart(i))];
      if (row) {
        queue.push({ key: narrationKey(messageId, row.part || part), url: row.audio_url, speaker: seg.speaker });
        addedSegments++;
      }
    });

    if (addedSegments === 0) {
      const storyRow = audioByMessage[narrationKey(messageId, 'story')];
      if (storyRow) queue.push({ key: narrationKey(messageId, 'story'), url: storyRow.audio_url, speaker: null });
    }

    if (queue.length === 0) return;
    if (playingId && playingId.startsWith(`${messageId}:`)) { stop(); return; }
    stop();
    queueRef.current = queue;
    runQueue();
  }, [audioByMessage, playingId, stop, runQueue]);

  // ── Synthesis helpers ──

  const synthesize = useCallback(async (text: string, voiceId: string, apiKey: string): Promise<Blob> => {
    const clean = stripMarkdownForTTS(text);
    if (!clean.trim()) throw new Error('Nothing to narrate.');
    const chunks = splitTextForStitching(clean, 5000);
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
    return new Blob(blobs, { type: 'audio/mpeg' });
  }, []);

  const storeClip = useCallback(async (
    messageId: string,
    part: NarrationPart,
    blob: Blob,
    voiceId: string,
  ) => {
    const path = `${partyId}/narration/${messageId}-${part}.mp3`;
    const { error: uploadError } = await supabase.storage
      .from('party-chat-audio')
      .upload(path, blob, { contentType: 'audio/mpeg', upsert: true });
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
      [narrationKey(messageId, part)]: {
        message_id: messageId,
        part,
        audio_url: audioUrl,
        voice_id: voiceId,
        created_by: currentUserId || '',
        created_by_name: currentUserName || null,
      },
    }));
  }, [partyId, currentUserId, currentUserName]);

  /**
   * Runs a full cast pass: the DM aside in the DM voice, then every story
   * segment in the voice assigned to its speaker (or hand-picked for it),
   * falling back to the narrator voice.
   */
  const castRun = useCallback(async (
    messageId: string,
    content: string,
    apiKey: string,
    opts?: { skipTable?: boolean },
  ) => {
    const { tableTalk, story } = splitDMResponseParts(content || '');
    const segments = splitStorySegments(story || content || '', messageId);
    const doTable = !opts?.skipTable && !!tableTalk.trim();
    const total = segments.length + (doTable ? 1 : 0);
    if (total === 0) return;

    setCastProgress({ messageId, done: 0, total, speaker: doTable ? 'DM' : segments[0]?.speaker ?? null });

    let done = 0;
    try {
      const hasClip = (part: string) => !!audioMapRef.current[narrationKey(messageId, part)];

      if (doTable && hasClip('table')) {
        done++;
        setCastProgress({ messageId, done, total, speaker: segments[0]?.speaker ?? null });
      } else if (doTable) {
        const dmVoice = loadSpeechifyDMVoiceId();
        const blob = await synthesize(tableTalk, dmVoice, apiKey);
        await storeClip(messageId, 'table', blob, dmVoice);
        done++;
        setCastProgress({ messageId, done, total, speaker: segments[0]?.speaker ?? null });
      }

      const narratorVoice = loadSpeechifyVoiceId();
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        setCastProgress({ messageId, done, total, speaker: seg.speaker });
        // Passages a player recorded themselves are never sent to Speechify.
        if (hasClip(segmentKey(seg)) || isSelfRecordedVoice(seg.voiceId)) {
          done++;
          setCastProgress({ messageId, done, total, speaker: segments[i + 1]?.speaker ?? null });
          continue;
        }

        const voiceId = seg.voiceId || (seg.speaker && voiceForSpeaker(seg.speaker)) || narratorVoice;
        const blob = await synthesize(seg.text, voiceId, apiKey);
        await storeClip(messageId, segmentKey(seg), blob, voiceId);
        done++;
        setCastProgress({ messageId, done, total, speaker: segments[i + 1]?.speaker ?? null });
      }
      toast.success(`Narration ready (${done} clip${done === 1 ? '' : 's'})`);
    } finally {
      setCastProgress(null);
    }
  }, [synthesize, storeClip]);

  const generate = useCallback(async (messageId: string, rawText: string, part: NarrationPart = 'story') => {
    if (!partyId) return;
    const apiKey = loadApiKey('speechify');
    if (!apiKey) {
      toast.error('No Speechify API key', { description: 'Add one in Settings → API Keys.' });
      return;
    }
    if (generatingId) return;

    // "Narrate story" splits itself into character voices whenever the passage
    // has assigned speakers or hand-picked voices.
    if (part === 'story') {
      const segments: NarrationSegment[] = splitStorySegments(rawText, messageId);
      const needsCast = segments.some((s) => s.voiceId || (s.speaker && voiceForSpeaker(s.speaker)));
      if (needsCast) {
        setGeneratingId(narrationKey(messageId, 'cast'));
        try {
          await castRun(messageId, rawText, apiKey, { skipTable: true });
        } catch (error) {
          console.error('[MessageNarration] story cast failed:', error);
          toast.error(error instanceof Error ? error.message : 'Narration failed');
        } finally {
          setGeneratingId(null);
        }
        return;
      }
    }

    const key = narrationKey(messageId, part);
    setGeneratingId(key);
    try {
      const voiceId = part === 'table' ? loadSpeechifyDMVoiceId() : loadSpeechifyVoiceId();
      const blob = await synthesize(rawText, voiceId, apiKey);
      await storeClip(messageId, part, blob, voiceId);
      toast.success(part === 'table' ? 'DM aside saved for the party' : 'Narration saved for the party');
    } catch (error) {
      console.error('[MessageNarration] generate failed:', error);
      toast.error(error instanceof Error ? error.message : 'Narration failed');
    } finally {
      setGeneratingId(null);
    }
  }, [partyId, generatingId, synthesize, storeClip, castRun]);

  const generateCast = useCallback(async (messageId: string, content: string) => {
    if (!partyId) return;
    const apiKey = loadApiKey('speechify');
    if (!apiKey) {
      toast.error('No Speechify API key', { description: 'Add one in Settings → API Keys.' });
      return;
    }
    if (generatingId) return;

    setGeneratingId(narrationKey(messageId, 'cast'));
    try {
      await castRun(messageId, content, apiKey);
    } catch (error) {
      console.error('[MessageNarration] cast failed:', error);
      toast.error(error instanceof Error ? error.message : 'Narration failed');
    } finally {
      setGeneratingId(null);
    }
  }, [partyId, generatingId, castRun]);


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
      .remove([
        `${partyId}/narration/${messageId}-${part}.mp3`,
        // legacy paths from before multi-clip narration
        `${partyId}/narration/${messageId}${part === 'table' ? '-table' : ''}.mp3`,
      ]);
    setAudioByMessage((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, [partyId, playingId, stop]);

  const removeAll = useCallback(async (messageId: string) => {
    if (!partyId) return;
    if (playingId && playingId.startsWith(`${messageId}:`)) stop();
    const { error } = await (supabase.from('party_message_audio') as any)
      .delete()
      .eq('party_id', partyId)
      .eq('message_id', messageId);
    if (error) {
      toast.error('Could not remove narration');
      return;
    }
    setAudioByMessage((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        if (key.startsWith(`${messageId}:`)) delete next[key];
      }
      return next;
    });
  }, [partyId, playingId, stop]);

  const recordSegment = useCallback(async (
    messageId: string,
    content: string,
    passage: string,
    blob: Blob,
    label?: string,
  ) => {
    if (!partyId) return;
    const text = (passage || '').trim();
    if (!text) {
      toast.error('Highlight a passage first');
      return;
    }

    try {
      // 1. Carve the passage out as its own segment, marked as a mic recording.
      addNarrationOverride(messageId, {
        text,
        voiceId: SELF_RECORDED_VOICE_ID,
        label: label || currentUserName || 'My voice',
      });

      // 2. Find the segment key everyone's client will compute for it.
      const { story } = splitDMResponseParts(content || '');
      const segments = splitStorySegments(story || content || '', messageId);
      const target = segments.find((s) => isSelfRecordedVoice(s.voiceId) && s.text.trim() === text)
        || segments.find((s) => isSelfRecordedVoice(s.voiceId) && text.includes(s.text.trim()));
      if (!target) {
        toast.error('Could not match that passage', { description: 'Try selecting a full sentence.' });
        return;
      }
      const part = segmentKey(target);

      // 3. Upload the clip and register it for the whole party.
      const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('mpeg') ? 'mp3' : 'webm';
      const path = `${partyId}/narration/${messageId}-${part}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('party-chat-audio')
        .upload(path, blob, { contentType: blob.type || 'audio/webm', upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('party-chat-audio').getPublicUrl(path);
      const audioUrl = `${urlData.publicUrl}?v=${Date.now()}`;

      const row = {
        party_id: partyId,
        message_id: messageId,
        part,
        audio_url: audioUrl,
        voice_id: SELF_RECORDED_VOICE_ID,
        provider: 'self',
        created_by: currentUserId,
        created_by_name: currentUserName || null,
      };
      const { error: insertError } = await (supabase.from('party_message_audio') as any)
        .upsert(row, { onConflict: 'message_id,part' });
      if (insertError) throw insertError;

      setAudioByMessage((prev) => ({
        ...prev,
        [narrationKey(messageId, part)]: {
          message_id: messageId,
          part,
          audio_url: audioUrl,
          voice_id: SELF_RECORDED_VOICE_ID,
          created_by: currentUserId || '',
          created_by_name: currentUserName || null,
        },
      }));

      // 4. Share the passage split so every player hears it in Play all.
      await publishOverrides(messageId);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('odyssey-narration-overrides'));
      }
      toast.success('Recording saved for that passage');
    } catch (error) {
      console.error('[MessageNarration] recording failed:', error);
      toast.error(error instanceof Error ? error.message : 'Could not save recording');
    }
  }, [partyId, currentUserId, currentUserName, publishOverrides]);

  return {

    audioByMessage,
    generatingId,
    playingId,
    castProgress,
    speakingName,
    generate,
    generateCast,
    play,
    playAll,
    stop,
    remove,
    removeAll,
    hasSpeechifyKey,
  };
}
