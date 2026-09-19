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
  removeNarrationOverride,
  loadNarrationOverrides,
  mergeNarrationOverrides,
  isSelfRecordedVoice,
  SELF_RECORDED_VOICE_ID,
  type NarrationSegment,
  type NarrationOverride,
  loadStudioState,
  loadDisplacedVoices,
  saveDisplacedVoice,
  clearDisplacedVoice,
} from '@/lib/tts-utils';

import { toast } from 'sonner';
import { duckMusicForNarration, restoreMusicAfterNarration } from '@/lib/narrationDucking';
import { beginNarrationFocus, endNarrationFocus, getNarrationAudio } from '@/lib/audioFocus';
import {
  cacheClip,
  clearOfflineClips,
  clipKey,
  listCachedClips,
  offlineCacheSize,
  removeCachedClip,
  resolvePlaybackUrl,
} from '@/lib/narrationOfflineCache';
import { buildMessageAudioBlob, narrationFileName, saveAudioFile } from '@/lib/narrationDownload';



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

/** Exact clip identity returned after a microphone take is saved. */
export interface RecordedClipResult {
  part: NarrationPart;
  row: MessageAudioRow;
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
  /**
   * Voices ONLY a highlighted passage, in the chosen voice. The rest of the
   * message is never sent to Speechify.
   */
  generateSegment: (
    messageId: string,
    content: string,
    passage: string,
    voiceId: string,
    label?: string,
  ) => Promise<void>;
  play: (messageId: string, part?: NarrationPart, rate?: number) => void;
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
  recordSegment: (messageId: string, content: string, passage: string, blob: Blob, label?: string, hint?: NarrationSegment) => Promise<RecordedClipResult>;
  /** Swaps a self-recorded piece back to the Speechify take it covered. */
  revertToCastVoice: (messageId: string, part: NarrationPart) => Promise<void>;
  /** Publishes this device's passage voice picks for a message to the party. */
  sharePassageVoices: (messageId: string) => Promise<void>;
  /** Re-uploads a previously deleted clip (used by Narration Studio's undo). */
  restoreClip: (messageId: string, part: NarrationPart, blob: Blob, voiceId: string) => Promise<void>;
  hasSpeechifyKey: boolean;
  /** How many saved clips are stored on this device for offline play. */
  offlineCount: number;
  /** Total saved clips in the campaign. */
  totalClips: number;
  /** Bytes used by downloaded clips. */
  offlineBytes: number;
  /** True while a bulk download is running, with progress. */
  offlineSaving: boolean;
  offlineProgress: { done: number; total: number } | null;
  /** Downloads every saved clip in the campaign to this device. */
  downloadAllOffline: () => Promise<void>;
  /** Downloads just the clips belonging to one DM message. */
  downloadMessageOffline: (messageId: string) => Promise<void>;
  /** Joins a message's clips into one MP3 and saves it to the device. */
  downloadMessageFile: (messageId: string, content?: string) => Promise<void>;
  /** Message currently being packaged for download, with clip progress. */
  downloadingMessageId: string | null;
  downloadProgress: { done: number; total: number } | null;
  /** Which message ids are fully downloaded on this device. */
  offlineMessageIds: string[];
  /** Removes every downloaded clip from this device. */
  clearOffline: () => Promise<void>;
}


const NARRATION_BUCKET = 'party-chat-audio';

/** Bucket path of a saved clip, read from its public URL (host and ?v= dropped). */
function storagePathFromUrl(url?: string | null): string | null {
  if (!url) return null;
  const marker = `/object/public/${NARRATION_BUCKET}/`;
  const at = url.indexOf(marker);
  if (at === -1) return null;
  const path = url.slice(at + marker.length).split('?')[0];
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
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
  const playSeqRef = useRef(0);
  const queueRef = useRef<Array<{ key: string; url: string; speaker?: string | null; part?: string; rate?: number }>>([]);
  const audioMapRef = useRef<Record<string, MessageAudioRow>>({});
  audioMapRef.current = audioByMessage;

  // ── Offline (downloaded) clips ──
  const [cachedKeys, setCachedKeys] = useState<Set<string>>(new Set());
  const [offlineBytes, setOfflineBytes] = useState(0);
  const [offlineSaving, setOfflineSaving] = useState(false);
  const [offlineProgress, setOfflineProgress] = useState<{ done: number; total: number } | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<{ done: number; total: number } | null>(null);

  const refreshOffline = useCallback(async () => {
    const keys = await listCachedClips();
    setCachedKeys(new Set(keys));
    setOfflineBytes(await offlineCacheSize());
  }, []);

  useEffect(() => { void refreshOffline(); }, [refreshOffline]);

  /** Cheap re-read after a background cache write. */
  const bumpOffline = useCallback(() => { void refreshOffline(); }, [refreshOffline]);


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

    /** Pulls every saved clip for the party (paged — campaigns can hold thousands). */
    const loadAll = async () => {
      const pageSize = 1000;
      let from = 0;
      const map: Record<string, MessageAudioRow> = {};
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await (supabase.from('party_message_audio') as any)
          .select('message_id, part, audio_url, voice_id, created_by, created_by_name')
          .eq('party_id', partyId)
          .order('created_at', { ascending: true })
          .range(from, from + pageSize - 1);
        if (error || !data || data.length === 0) break;
        for (const row of data as MessageAudioRow[]) {
          map[narrationKey(row.message_id, row.part || 'story')] = row;
        }
        if (data.length < pageSize) break;
        from += pageSize;
      }
      if (cancelled) return;
      // Merge so realtime rows that arrived during the fetch aren't dropped
      setAudioByMessage((prev) => ({ ...map, ...prev }));
    };

    void loadAll();

    // Late joiners / backgrounded devices re-sync when they come back to the screen
    const onVisible = () => {
      if (document.visibilityState === 'visible') void loadAll();
    };
    document.addEventListener('visibilitychange', onVisible);


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
      document.removeEventListener('visibilitychange', onVisible);
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
    // Per-piece speed from the Narration Studio, otherwise the global narration speed.
    const rate = Number.isFinite(next.rate) ? (next.rate as number) : loadNarrationSpeed();
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
    const seq = ++playSeqRef.current;
    // Prefer the downloaded copy on this device — playback then survives a weak
    // or missing connection. Falls back to streaming when nothing is stored.
    void resolvePlaybackUrl(next.url).then((src) => {
      if (seq !== playSeqRef.current) return;
      audio.src = src;
      // Loading a clip resets playbackRate to defaultPlaybackRate, so the speed
      // must be applied AFTER src is set, and stored as the default too.
      audio.defaultPlaybackRate = rate;
      audio.playbackRate = rate;
      void beginNarrationFocus().finally(() => {
        audio.play().catch(() => {
          queueRef.current = [];
          setPlayingId(null);
          setSpeakingName(null);
          void restoreMusicAfterNarration();
          void endNarrationFocus();
        });
      });
      // Keep it for next time (no-op when already stored).
      if (src === next.url) void cacheClip(next.url).then((ok) => { if (ok) bumpOffline(); });
    });
  }, []);



  const play = useCallback((messageId: string, part: NarrationPart = 'story', rate?: number) => {
    const key = narrationKey(messageId, part);
    const row = audioByMessage[key];
    if (!row) return;
    if (playingId === key) { stop(); return; }
    stop();
    queueRef.current = [{ key, url: row.audio_url, part, rate }];
    runQueue();
  }, [audioByMessage, playingId, stop, runQueue]);

  /** The ordered clip list for a message: DM aside, then story segments. */
  const buildOrderedClips = useCallback((messageId: string, content?: string) => {
    const queue: Array<{ key: string; url: string; speaker?: string | null; part?: string; rate?: number }> = [];
    const map = audioMapRef.current;
    const tableRow = map[narrationKey(messageId, 'table')];
    if (tableRow) queue.push({ key: narrationKey(messageId, 'table'), url: tableRow.audio_url, speaker: 'DM', part: 'table' });

    const segments = content ? splitStorySegments(splitDMResponseParts(content).story, messageId) : [];
    let addedSegments = 0;
    segments.forEach((seg, i) => {
      const part = segmentKey(seg);
      const row = map[narrationKey(messageId, part)]
        || map[narrationKey(messageId, segmentPart(i))];
      if (row) {
        const resolvedPart = row.part || part;
        queue.push({ key: narrationKey(messageId, resolvedPart), url: row.audio_url, speaker: seg.speaker, part: resolvedPart });
        addedSegments++;
      }
    });

    if (addedSegments === 0) {
      const storyRow = map[narrationKey(messageId, 'story')];
      if (storyRow) queue.push({ key: narrationKey(messageId, 'story'), url: storyRow.audio_url, speaker: null, part: 'story' });
    }

    // Narration Studio customisations: per-piece speed, then custom order.
    // Both are playback-only - the written story and the audio never change.
    const studio = loadStudioState(messageId);
    if (studio.rates) {
      for (const item of queue) {
        const rate = item.part ? studio.rates[item.part] : undefined;
        if (Number.isFinite(rate)) item.rate = Math.min(2, Math.max(0.5, rate as number));
      }
    }
    if (studio.order && studio.order.length > 0) {
      const rank = new Map(studio.order.map((part, i) => [part, i]));
      queue
        .map((item, i) => ({ item, i }))
        .sort((a, b) => {
          const ra = a.item.part !== undefined && rank.has(a.item.part) ? rank.get(a.item.part)! : rank.size + a.i;
          const rb = b.item.part !== undefined && rank.has(b.item.part) ? rank.get(b.item.part)! : rank.size + b.i;
          return ra - rb;
        })
        .forEach(({ item }, i) => { queue[i] = item; });
    }
    return queue;
  }, []);

  // playAll now lives below castRun, because it calls it to fill narration gaps.

  /** Joins every clip for a message into one MP3 and saves it to the device. */
  const downloadMessageFile = useCallback(async (messageId: string, content?: string) => {
    const clips = buildOrderedClips(messageId, content);
    if (clips.length === 0) { toast.error('Nothing to download yet'); return; }
    setDownloadingId(messageId);
    setDownloadProgress({ done: 0, total: clips.length });
    try {
      const blob = await buildMessageAudioBlob(clips, (done, total) => setDownloadProgress({ done, total }));
      await saveAudioFile(blob, narrationFileName(messageId));
      await refreshOffline();
      toast.success('Narration saved to your device');
    } catch (error) {
      console.error('[MessageNarration] download failed:', error);
      toast.error(error instanceof Error ? error.message : 'Could not download this narration');
    } finally {
      setDownloadingId(null);
      setDownloadProgress(null);
    }
  }, [buildOrderedClips, refreshOffline]);


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

  /** Uploads a take to a brand-new file, so no cache can ever replay an older take. */
  const uploadClipFile = useCallback(async (
    messageId: string,
    part: NarrationPart,
    blob: Blob,
    ext: string,
    contentType: string,
  ): Promise<string> => {
    const path = `${partyId}/narration/${messageId}-${part}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from(NARRATION_BUCKET)
      .upload(path, blob, { contentType, upsert: false });
    if (error) throw error;
    const { data } = supabase.storage.from(NARRATION_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }, [partyId]);

  /** Best effort: deletes a replaced or deleted clip's file and this device's saved copy. Never throws. */
  const discardClipFile = useCallback(async (url?: string | null) => {
    if (!url) return;
    try {
      await removeCachedClip(url);
    } catch {
      /* ignore */
    }
    const path = storagePathFromUrl(url);
    if (!path) return;
    const { error } = await supabase.storage.from(NARRATION_BUCKET).remove([path]);
    if (error) console.warn('[MessageNarration] could not delete old clip file:', error);
  }, []);

  const storeClip = useCallback(async (
    messageId: string,
    part: NarrationPart,
    blob: Blob,
    voiceId: string,
  ) => {
    const key = narrationKey(messageId, part);
    // The clip this save replaces, so its file can be cleaned up afterwards.
    const previousUrl = audioMapRef.current[key]?.audio_url || null;
    // Speechify clips are MP3. An Undo restore of a mic take keeps its real format.
    const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('webm') ? 'webm' : 'mp3';
    const audioUrl = await uploadClipFile(messageId, part, blob, ext, blob.type || 'audio/mpeg');

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
    if (insertError) {
      void discardClipFile(audioUrl); // the new file was never used
      throw insertError;
    }

    const savedRow: MessageAudioRow = {
      message_id: messageId,
      part,
      audio_url: audioUrl,
      voice_id: voiceId,
      created_by: currentUserId || '',
      created_by_name: currentUserName || null,
    };
    setAudioByMessage((prev) => ({ ...prev, [key]: savedRow }));
    audioMapRef.current = { ...audioMapRef.current, [key]: savedRow };

    // The replaced take is gone for good: delete its file and this device's copy.
    if (previousUrl && previousUrl !== audioUrl) void discardClipFile(previousUrl);
  }, [partyId, currentUserId, currentUserName, uploadClipFile, discardClipFile]);

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
      let made = 0;
      let failed = 0;
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        setCastProgress({ messageId, done, total, speaker: seg.speaker });
        // Passages a player recorded themselves are never sent to Speechify.
        // Pieces with nothing speakable left are skipped, never synthesized.
        if (
          hasClip(segmentKey(seg))
          || isSelfRecordedVoice(seg.voiceId)
          || !stripMarkdownForTTS(seg.text || '').trim()
        ) {
          done++;
          setCastProgress({ messageId, done, total, speaker: segments[i + 1]?.speaker ?? null });
          continue;
        }

        const voiceId = seg.voiceId || (seg.speaker && voiceForSpeaker(seg.speaker)) || narratorVoice;
        try {
          const blob = await synthesize(seg.text, voiceId, apiKey);
          await storeClip(messageId, segmentKey(seg), blob, voiceId);
          made++;
        } catch (error) {
          // One bad passage must never throw away the whole run.
          console.warn('[MessageNarration] segment failed, continuing:', error);
          failed++;
        }
        done++;
        setCastProgress({ messageId, done, total, speaker: segments[i + 1]?.speaker ?? null });
      }
      if (failed > 0) {
        toast.warning(`Narration ready (${made} clip${made === 1 ? '' : 's'})`, {
          description: `${failed} passage${failed === 1 ? '' : 's'} could not be voiced.`,
        });
      } else {
        toast.success(`Narration ready (${made} clip${made === 1 ? '' : 's'})`);
      }
    } finally {
      setCastProgress(null);
    }
  }, [synthesize, storeClip]);

  /**
   * DM aside first, then the whole story in order.
   *
   * If SOME segments have clips and others do not - which is exactly what
   * happens once a passage is hand-picked on top of a narrated story -
   * buildOrderedClips would skip the gaps and play the picked voices back to
   * back with no narration between them. So fill the missing segments in
   * their proper voices first, then play the lot in story order.
   */
  const playAll = useCallback(async (messageId: string, content?: string) => {
    // Pressing it again while it is playing means Stop, and must never generate.
    if (playingId && playingId.startsWith(`${messageId}:`)) { stop(); return; }

    if (content) {
      const { story } = splitDMResponseParts(content);
      const segments = splitStorySegments(story || content, messageId);
      const map = audioMapRef.current;

      const voiced = segments.filter((seg, i) => !!(
        map[narrationKey(messageId, segmentKey(seg))]
        || map[narrationKey(messageId, segmentPart(i))]
      )).length;

      // Partly voiced: fill the gaps so the story plays end to end.
      if (segments.length > 0 && voiced > 0 && voiced < segments.length) {
        const apiKey = loadApiKey('speechify');
        if (!apiKey) {
          toast.error('No Speechify API key', { description: 'Add one in Settings -> API Keys.' });
          return;
        }
        setGeneratingId(narrationKey(messageId, 'cast'));
        try {
          // castRun skips every segment that already has a clip, so this only
          // voices the narration sitting between the hand-picked passages.
          await castRun(messageId, content, apiKey);
        } catch (error) {
          // Filling gaps is best-effort — still play whatever clips exist.
          console.error('[MessageNarration] filling narration gaps failed:', error);
        } finally {
          setGeneratingId(null);
        }
      }
    }

    const queue = buildOrderedClips(messageId, content);
    if (queue.length === 0) {
      toast.error('No narration audio to play yet');
      return;
    }
    stop();
    queueRef.current = queue;
    runQueue();
  }, [buildOrderedClips, playingId, stop, runQueue, castRun]);

  const generate = useCallback(async (messageId: string, rawText: string, part: NarrationPart = 'story') => {
    if (!partyId) throw new Error('Open a party before saving a recording');
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

  /**
   * Voices ONLY a highlighted passage. The passage is carved out as its own
   * segment in the chosen voice, and just that slice is synthesized - the
   * surrounding narration is never sent to Speechify.
   */
  const generateSegment = useCallback(async (
    messageId: string,
    content: string,
    passage: string,
    voiceId: string,
    label?: string,
  ) => {
    if (!partyId) return;
    const apiKey = loadApiKey('speechify');
    if (!apiKey) {
      toast.error('No Speechify API key', { description: 'Add one in Settings -> API Keys.' });
      return;
    }
    if (generatingId) return;

    const text = (passage || '').trim();
    if (!text) return;

    // 1. Carve the passage out as its own segment in the chosen voice.
    addNarrationOverride(messageId, { text, voiceId, label: label || undefined });

    // 2. Find the segment key every client will compute for it.
    const { story } = splitDMResponseParts(content || '');
    const segments = splitStorySegments(story || content || '', messageId);
    // Letters-and-digits comparison, so markdown never breaks the match, AND
    // so two passages in the same voice are told apart instead of the first
    // one silently winning both times.
    const loose = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    const wanted = loose(text);
    const mine = segments.filter((s) => s.manual && s.voiceId === voiceId);
    const target = mine.find((s) => s.text.trim() === text)
      || mine.find((s) => loose(s.text) === wanted)
      || mine.find((s) => loose(s.text).includes(wanted) || wanted.includes(loose(s.text)))
      || (mine.length === 1 ? mine[0] : undefined)
      || segments.find((s) => loose(s.text) === wanted);

    if (!target) {
      toast.error('Could not match that passage', { description: 'Try selecting a full sentence.' });
      return;
    }

    // 3. Synthesize ONLY that segment.
    const part = segmentKey(target);
    setGeneratingId(narrationKey(messageId, part));
    try {
      const blob = await synthesize(target.text, voiceId, apiKey);
      await storeClip(messageId, part, blob, voiceId);
      toast.success(label ? `Voiced in ${label}` : 'Passage voiced', {
        description: 'Only the highlighted words were sent to Speechify.',
      });
    } catch (error) {
      console.error('[MessageNarration] segment generate failed:', error);
      toast.error(error instanceof Error ? error.message : 'Narration failed');
    } finally {
      setGeneratingId(null);
    }
  }, [partyId, generatingId, synthesize, storeClip]);

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
    // Read the clip's real file before the row is gone.
    const existingUrl = audioMapRef.current[key]?.audio_url || null;
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

    // Delete the file this clip really uses (mic takes are .webm/.m4a), plus the
    // fixed file names used before every take got its own file.
    const paths = new Set<string>();
    const current = storagePathFromUrl(existingUrl);
    if (current) paths.add(current);
    for (const ext of ['mp3', 'webm', 'm4a']) {
      paths.add(`${partyId}/narration/${messageId}-${part}.${ext}`);
    }
    // Legacy whole-story file from before multi-clip narration (story part only).
    if (part === 'story') paths.add(`${partyId}/narration/${messageId}.mp3`);
    const { error: storageError } = await supabase.storage
      .from(NARRATION_BUCKET)
      .remove([...paths]);
    if (storageError) console.warn('[MessageNarration] could not delete narration file:', storageError);

    // Clear this device's saved copy so it can never be replayed.
    if (existingUrl) {
      try {
        await removeCachedClip(existingUrl);
      } catch {
        /* ignore */
      }
    }

    setAudioByMessage((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, [partyId, playingId, stop]);

  const removeAll = useCallback(async (messageId: string) => {
    if (!partyId) return;
    if (playingId && playingId.startsWith(`${messageId}:`)) stop();

    // Work out which files belong to this message BEFORE the rows are deleted,
    // otherwise there is nothing left to tell us what to clean up.
    const rows = Object.values(audioMapRef.current).filter((row) => row.message_id === messageId);
    const parts = rows.map((row) => row.part);

    const { error } = await (supabase.from('party_message_audio') as any)
      .delete()
      .eq('party_id', partyId)
      .eq('message_id', messageId);
    if (error) {
      toast.error('Could not remove narration');
      return;
    }

    // Delete the actual audio files. Without this the objects stay in the
    // bucket, and the next generation upserts over them.
    // Speechify clips are .mp3; mic recordings are .webm or .m4a.
    const paths: string[] = [];
    // Each clip's real file first (every take now has its own file name).
    for (const row of rows) {
      const path = storagePathFromUrl(row.audio_url);
      if (path) paths.push(path);
    }
    for (const part of parts) {
      for (const ext of ['mp3', 'webm', 'm4a']) {
        paths.push(`${partyId}/narration/${messageId}-${part}.${ext}`);
      }
    }
    // legacy path from before multi-clip narration
    paths.push(`${partyId}/narration/${messageId}.mp3`);

    if (paths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from(NARRATION_BUCKET)
        .remove(paths);
      if (storageError) {
        console.error('[MessageNarration] could not delete narration files:', storageError);
        toast.error('Rows cleared, but the audio files could not be deleted', {
          description: storageError.message,
        });
      }
    }

    // Clear this device's saved copies too.
    for (const row of rows) {
      try {
        await removeCachedClip(row.audio_url);
      } catch {
        /* ignore */
      }
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
    /**
     * The exact piece the caller (Narration Studio) tapped Record on. When
     * given we never guess: the recording lands on THAT piece. Text-only
     * matching is kept as the fallback for the old highlight flow.
     */
    hint?: NarrationSegment,
  ) => {
    if (!partyId) return;
    const loose = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    const text = ((hint?.text ?? passage) || '').trim();
    if (!text) {
      toast.error('Nothing to record over');
      return;
    }

    try {
      const { story } = splitDMResponseParts(content || '');

      // 0. Remember the voice this recording is covering, so it can be undone.
      const before = splitStorySegments(story || content || '', messageId);
      const wantedBefore = loose(text);
      const prevSeg = (hint && before.find((s) => segmentKey(s) === segmentKey(hint)))
        || before.find((s) => loose(s.text) === wantedBefore)
        || before.find((s) => loose(s.text).includes(wantedBefore) || wantedBefore.includes(loose(s.text)));
      const prevOverride = prevSeg
        ? loadNarrationOverrides(messageId).find((o) => loose(o.text) === loose(prevSeg.text)) || null
        : null;

      // 1. Remove any older overlapping assignment before carving this exact
      // piece out. applyOverrides is intentionally first-match-wins, so leaving
      // one behind can make the saved clip and the visible row disagree.
      for (const override of loadNarrationOverrides(messageId)) {
        const candidate = loose(override.text);
        if (candidate === wantedBefore || candidate.includes(wantedBefore) || wantedBefore.includes(candidate)) {
          removeNarrationOverride(messageId, override.text);
        }
      }

      // 2. Carve the passage out as its own segment, marked as a mic recording.
      addNarrationOverride(messageId, {
        text,
        voiceId: SELF_RECORDED_VOICE_ID,
        label: label || currentUserName || 'My voice',
      });

      // 3. Find the segment key everyone's client will compute for it.
      const segments = splitStorySegments(story || content || '', messageId);
      const wanted = loose(text);
      const mine = segments.filter((s) => isSelfRecordedVoice(s.voiceId));
      const target = mine.find((s) => s.text.trim() === text)
        || mine.find((s) => loose(s.text) === wanted)
        || mine.find((s) => loose(s.text).includes(wanted) || wanted.includes(loose(s.text)))
        // Last resort, and ONLY when there is no ambiguity: if this message has
        // exactly one recorded passage, it must be this one. With two or more
        // we refuse rather than risk overwriting the wrong recording.
        || (mine.length === 1 ? mine[0] : undefined);
      if (!target) {
        toast.error('Could not match that passage', { description: 'Try selecting a full sentence.' });
        throw new Error('Could not match that passage');
      }
      const part = segmentKey(target);
      // The take this recording replaces (if any), so its file can be cleaned up.
      const previousUrl = audioMapRef.current[narrationKey(messageId, part)]?.audio_url || null;

      // 4. Upload the clip and register it for the whole party.
      const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('mpeg') ? 'mp3' : 'webm';
      const audioUrl = await uploadClipFile(messageId, part, blob, ext, blob.type || 'audio/webm');

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
      if (insertError) {
        void discardClipFile(audioUrl); // the new file was never used
        throw insertError;
      }

      const savedRow: MessageAudioRow = {
        message_id: messageId,
        part,
        audio_url: audioUrl,
        voice_id: SELF_RECORDED_VOICE_ID,
        created_by: currentUserId || '',
        created_by_name: currentUserName || null,
      };
      setAudioByMessage((prev) => ({
        ...prev,
        [narrationKey(messageId, part)]: savedRow,
      }));
      audioMapRef.current = {
        ...audioMapRef.current,
        [narrationKey(messageId, part)]: savedRow,
      };
      // The old take is gone for good: delete its file and this device's saved copy.
      if (previousUrl && previousUrl !== audioUrl) void discardClipFile(previousUrl);

      // 3b. Remember the cast take this recording is covering. Nothing is
      // deleted, so "Revert to cast voice" can bring it straight back.
      if (prevSeg) {
        const previousPart = segmentKey(prevSeg);
        if (previousPart !== part) {
          saveDisplacedVoice(messageId, part, {
            overrideText: text,
            previousPart,
            previousVoiceId: prevSeg.voiceId || null,
            previousLabel: prevOverride?.label || prevSeg.speaker || null,
            previousOverride: prevOverride,
          });
        }
      }

      // 4. Share the passage split so every player hears it in Play all.
      await publishOverrides(messageId);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('odyssey-narration-overrides'));
      }
      return { part, row: savedRow };
    } catch (error) {
      console.error('[MessageNarration] recording failed:', error);
      toast.error(error instanceof Error ? error.message : 'Could not save recording');
      throw error;
    }
  }, [partyId, currentUserId, currentUserName, publishOverrides, uploadClipFile, discardClipFile]);

  /**
   * Swaps a self-recorded piece back to the Speechify take it covered.
   * Nothing is deleted either way - recording again restores the recording.
   */
  const revertToCastVoice = useCallback(async (messageId: string, part: NarrationPart) => {
    const info = loadDisplacedVoices(messageId)[part];
    if (!info) {
      toast.error('No cast voice saved for this piece');
      return;
    }
    removeNarrationOverride(messageId, info.overrideText);
    if (info.previousOverride) addNarrationOverride(messageId, info.previousOverride);
    clearDisplacedVoice(messageId, part);
    await publishOverrides(messageId);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('odyssey-narration-overrides'));
    }
    toast.success(info.previousLabel ? `Back to ${info.previousLabel}` : 'Back to the cast voice');
  }, [publishOverrides]);

  /** Shares this device's passage voice picks for a message with the party. */
  const sharePassageVoices = useCallback(async (messageId: string) => {
    await publishOverrides(messageId);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('odyssey-narration-overrides'));
    }
  }, [publishOverrides]);

  /** Re-uploads a deleted clip so the studio's undo can bring audio back. */
  const restoreClip = useCallback(async (
    messageId: string,
    part: NarrationPart,
    blob: Blob,
    voiceId: string,
  ) => {
    await storeClip(messageId, part, blob, voiceId);
  }, [storeClip]);

  // ── Downloading clips for offline play ──

  const allRows = Object.values(audioByMessage);

  const downloadRows = useCallback(async (rows: MessageAudioRow[]) => {
    const pending = rows.filter((r) => r.audio_url);
    if (pending.length === 0) return;
    setOfflineSaving(true);
    setOfflineProgress({ done: 0, total: pending.length });
    let failed = 0;
    for (let i = 0; i < pending.length; i++) {
      const ok = await cacheClip(pending[i].audio_url);
      if (!ok) failed++;
      setOfflineProgress({ done: i + 1, total: pending.length });
    }
    await refreshOffline();
    setOfflineSaving(false);
    setOfflineProgress(null);
    if (failed === 0) toast.success(`Saved ${pending.length} narration${pending.length === 1 ? '' : 's'} for offline play`);
    else if (failed < pending.length) toast.warning(`Saved ${pending.length - failed} of ${pending.length} — ${failed} need a better connection`);
    else toast.error('Could not download narrations — check your connection');
  }, [refreshOffline]);

  const downloadAllOffline = useCallback(async () => {
    await downloadRows(Object.values(audioMapRef.current));
  }, [downloadRows]);

  const downloadMessageOffline = useCallback(async (messageId: string) => {
    await downloadRows(Object.values(audioMapRef.current).filter((r) => r.message_id === messageId));
  }, [downloadRows]);

  const clearOffline = useCallback(async () => {
    await clearOfflineClips();
    await refreshOffline();
    toast.success('Downloaded narrations removed from this device');
  }, [refreshOffline]);

  const offlineCount = allRows.filter((r) => cachedKeys.has(clipKey(r.audio_url))).length;
  const offlineMessageIds = Array.from(
    new Set(
      Object.values(
        allRows.reduce<Record<string, MessageAudioRow[]>>((acc, r) => {
          (acc[r.message_id] ||= []).push(r);
          return acc;
        }, {}),
      )
        .filter((rows) => rows.every((r) => cachedKeys.has(clipKey(r.audio_url))))
        .map((rows) => rows[0].message_id),
    ),
  );

  return {

    audioByMessage,
    generatingId,
    playingId,
    castProgress,
    speakingName,
    generate,
    generateCast,
    generateSegment,
    play,
    playAll,
    stop,
    remove,
    removeAll,
    recordSegment,
    revertToCastVoice,
    sharePassageVoices,
    restoreClip,
    hasSpeechifyKey,
    offlineCount,
    totalClips: allRows.length,
    offlineBytes,
    offlineSaving,
    offlineProgress,
    downloadAllOffline,
    downloadMessageOffline,
    downloadMessageFile,
    downloadingMessageId: downloadingId,
    downloadProgress,
    offlineMessageIds,
    clearOffline,

  };

}
