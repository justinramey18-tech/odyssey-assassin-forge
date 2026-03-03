import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, Square, Play, Pause, Upload, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { loadApiKey } from '@/lib/api-keys';
import { supabase } from '@/integrations/supabase/client';

interface SpeechifyVoiceClonerProps {
  onCloneSuccess: () => void;
}

type CloneState = 'idle' | 'recording' | 'recorded' | 'uploading' | 'done';

export function SpeechifyVoiceCloner({ onCloneSuccess }: SpeechifyVoiceClonerProps) {
  const [state, setState] = useState<CloneState>('idle');
  const [voiceName, setVoiceName] = useState('');
  const [consent, setConsent] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      if (previewAudioRef.current) previewAudioRef.current.pause();
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        blobRef.current = blob;

        // Create preview URL
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = URL.createObjectURL(blob);

        setState('recorded');
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setState('recording');
      setElapsed(0);

      timerRef.current = setInterval(() => {
        setElapsed((prev) => {
          const next = prev + 1;
          // Auto-stop at 30s
          if (next >= 30) {
            recorder.stop();
            if (timerRef.current) clearInterval(timerRef.current);
          }
          return next;
        });
      }, 1000);
    } catch {
      toast.error('Microphone access denied');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const togglePreview = useCallback(() => {
    if (!previewUrlRef.current) return;

    if (isPreviewPlaying && previewAudioRef.current) {
      previewAudioRef.current.pause();
      setIsPreviewPlaying(false);
      return;
    }

    const audio = new Audio(previewUrlRef.current);
    previewAudioRef.current = audio;
    audio.onended = () => setIsPreviewPlaying(false);
    audio.play();
    setIsPreviewPlaying(true);
  }, [isPreviewPlaying]);

  const resetRecording = useCallback(() => {
    if (previewAudioRef.current) previewAudioRef.current.pause();
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    blobRef.current = null;
    setIsPreviewPlaying(false);
    setElapsed(0);
    setState('idle');
  }, []);

  const handleClone = useCallback(async () => {
    const apiKey = loadApiKey('speechify');
    if (!apiKey) { toast.error('Add your Speechify API key first'); return; }
    if (!voiceName.trim()) { toast.error('Enter a voice name'); return; }
    if (!consent) { toast.error('You must confirm consent'); return; }
    if (!blobRef.current) { toast.error('No recording found'); return; }

    setState('uploading');

    try {
      const formData = new FormData();
      formData.append('user_api_key', apiKey);
      formData.append('name', voiceName.trim());
      formData.append('consent', JSON.stringify({
        fullName: voiceName.trim(),
        email: 'user@app.local',
      }));
      formData.append('sample', blobRef.current, 'recording.webm');

      // Use direct fetch since supabase.functions.invoke doesn't support FormData well
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/speechify-clone-voice`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Clone failed' }));
        throw new Error(err.error || `Clone failed: ${response.status}`);
      }

      setState('done');
      toast.success(`Voice "${voiceName}" cloned successfully!`);

      // Auto-refresh voice list
      onCloneSuccess();

      // Reset after a short delay
      setTimeout(() => {
        resetRecording();
        setVoiceName('');
        setConsent(false);
      }, 2000);
    } catch (err: any) {
      console.error('Clone error:', err);
      toast.error(err.message || 'Voice cloning failed');
      setState('recorded');
    }
  }, [voiceName, consent, onCloneSuccess, resetRecording]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="space-y-3 rounded-lg border border-border/30 bg-muted/5 p-3">
      <p className="text-[10px] font-medium text-primary uppercase tracking-wider">
        Clone Your Voice
      </p>
      <p className="text-[10px] text-muted-foreground leading-relaxed">
        Record 10–30 seconds of clear speech. Speak naturally — read a paragraph or describe your day.
      </p>

      {/* Voice name */}
      <Input
        placeholder="Voice name (e.g. My Voice)"
        className="h-7 text-xs"
        value={voiceName}
        onChange={(e) => setVoiceName(e.target.value)}
        maxLength={50}
        disabled={state === 'uploading' || state === 'done'}
      />

      {/* Recording controls */}
      <div className="flex items-center gap-2">
        {state === 'idle' && (
          <Button size="sm" variant="outline" className="gap-1.5 flex-1" onClick={startRecording}>
            <Mic className="w-3.5 h-3.5 text-red-400" />
            Start Recording
          </Button>
        )}

        {state === 'recording' && (
          <>
            <Button size="sm" variant="destructive" className="gap-1.5 flex-1" onClick={stopRecording}>
              <Square className="w-3 h-3" />
              Stop
            </Button>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-mono text-foreground">{formatTime(elapsed)}</span>
            </div>
          </>
        )}

        {(state === 'recorded' || state === 'uploading' || state === 'done') && (
          <>
            <Button
              size="sm"
              variant="ghost"
              className="gap-1 px-2"
              onClick={togglePreview}
              disabled={state === 'uploading'}
            >
              {isPreviewPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span className="text-xs">{formatTime(elapsed)}</span>
            </Button>
            <Button size="sm" variant="ghost" className="text-xs px-2" onClick={resetRecording} disabled={state === 'uploading'}>
              Re-record
            </Button>
          </>
        )}
      </div>

      {/* Minimum duration warning */}
      {state === 'recorded' && elapsed < 10 && (
        <p className="text-[10px] text-amber-400">⚠ Recording is short ({elapsed}s). 10–30s recommended for best quality.</p>
      )}

      {/* Consent checkbox */}
      {(state === 'recorded' || state === 'uploading' || state === 'done') && (
        <label className="flex items-start gap-2 cursor-pointer">
          <Checkbox
            checked={consent}
            onCheckedChange={(v) => setConsent(v === true)}
            disabled={state === 'uploading' || state === 'done'}
            className="mt-0.5"
          />
          <span className="text-[10px] text-muted-foreground leading-relaxed">
            I confirm this voice belongs to me or I have permission to clone it.
          </span>
        </label>
      )}

      {/* Submit */}
      {state === 'recorded' && (
        <Button
          size="sm"
          className="w-full gap-1.5"
          onClick={handleClone}
          disabled={!voiceName.trim() || !consent}
        >
          <Upload className="w-3.5 h-3.5" />
          Clone Voice
        </Button>
      )}

      {state === 'uploading' && (
        <Button size="sm" className="w-full gap-1.5" disabled>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Cloning…
        </Button>
      )}

      {state === 'done' && (
        <div className="flex items-center justify-center gap-1.5 py-1 text-xs text-green-400">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Voice cloned!
        </div>
      )}
    </div>
  );
}
