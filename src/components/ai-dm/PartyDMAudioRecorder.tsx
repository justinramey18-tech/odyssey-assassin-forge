import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Mic, RotateCcw, Send, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { toast } from 'sonner';

interface PartyDMAudioRecorderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (file: File) => Promise<void>;
  isUploading?: boolean;
  /** Highlighted passage to read aloud, shown on-screen while recording. */
  scriptText?: string;
}

type RecorderState = 'idle' | 'recording' | 'recorded';

function getSupportedAudioMimeType(): string {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return '';
  }

  const candidates = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
}

function getAudioExtension(mimeType: string): string {
  if (mimeType.includes('mp4')) return 'm4a';
  if (mimeType.includes('mpeg')) return 'mp3';
  return 'webm';
}

function formatElapsed(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function PartyDMAudioRecorder({ open, onOpenChange, onSubmit, isUploading = false, scriptText }: PartyDMAudioRecorderProps) {
  const [recorderState, setRecorderState] = useState<RecorderState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ignoreNextStopRef = useRef(false);
  const mimeTypeRef = useRef('');

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const resetRecorder = useCallback(() => {
    ignoreNextStopRef.current = true;
    clearTimer();

    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    mediaRecorderRef.current = null;
    stopStream();
    chunksRef.current = [];
    mimeTypeRef.current = '';
    setElapsed(0);
    setRecorderState('idle');
    setRecordedBlob(null);
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  }, [clearTimer, stopStream]);

  useEffect(() => {
    if (!open && (recorderState !== 'idle' || previewUrl || recordedBlob)) {
      resetRecorder();
    }
  }, [open, previewUrl, recordedBlob, recorderState, resetRecorder]);

  useEffect(() => {
    return () => {
      clearTimer();
      stopStream();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [clearTimer, previewUrl, stopStream]);

  const startRecording = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast.error('Audio recording is not supported on this device');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      const mimeType = getSupportedAudioMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      streamRef.current = stream;
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      mimeTypeRef.current = mimeType || recorder.mimeType || 'audio/webm';
      ignoreNextStopRef.current = false;

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      setRecordedBlob(null);
      setElapsed(0);
      setRecorderState('recording');

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        clearTimer();
        stopStream();

        if (ignoreNextStopRef.current) {
          ignoreNextStopRef.current = false;
          chunksRef.current = [];
          return;
        }

        const nextBlob = new Blob(chunksRef.current, {
          type: recorder.mimeType || mimeTypeRef.current || 'audio/webm',
        });

        if (nextBlob.size === 0) {
          setRecorderState('idle');
          toast.error('Recording failed — please try again');
          return;
        }

        const url = URL.createObjectURL(nextBlob);
        setRecordedBlob(nextBlob);
        setPreviewUrl(url);
        setRecorderState('recorded');
      };

      recorder.start(250);
      timerRef.current = setInterval(() => {
        setElapsed((current) => {
          const next = current + 1;
          if (next >= 60 && recorder.state === 'recording') {
            recorder.stop();
          }
          return next;
        });
      }, 1000);
    } catch {
      toast.error('Microphone access denied');
    }
  }, [clearTimer, previewUrl, stopStream]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const handleSend = useCallback(async () => {
    if (!recordedBlob) return;

    const mimeType = recordedBlob.type || mimeTypeRef.current || 'audio/webm';
    const extension = getAudioExtension(mimeType);
    const file = new File([recordedBlob], `party-dm-audio-${Date.now()}.${extension}`, {
      type: mimeType,
    });

    await onSubmit(file);
    resetRecorder();
    onOpenChange(false);
  }, [onOpenChange, onSubmit, recordedBlob, resetRecorder]);

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen && !isUploading) {
        resetRecorder();
      }
      if (!isUploading) {
        onOpenChange(nextOpen);
      }
    }}>
      <SheetContent side="bottom" className="max-h-[85vh] rounded-t-3xl px-0">
        <SheetHeader className="px-4 pb-2">
          <SheetTitle>Record Audio</SheetTitle>
          <SheetDescription>Record inside the app so your chat stays active on mobile.</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-4">
          <div className="rounded-2xl border border-border bg-card p-4 text-center">
            <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full border border-border bg-secondary">
              {recorderState === 'recording' ? (
                <div className="flex h-5 w-5 rounded-full bg-destructive animate-pulse" />
              ) : (
                <Mic className="h-8 w-8 text-primary" />
              )}
            </div>

            <p className="text-sm font-medium text-foreground">
              {recorderState === 'recording' ? 'Recording…' : recorderState === 'recorded' ? 'Preview your clip' : 'Ready to record'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Up to 60 seconds • sent as an inline audio message</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{formatElapsed(elapsed)}</p>
          </div>

          {previewUrl && (
            <div className="rounded-2xl border border-border bg-card p-3">
              <audio src={previewUrl} controls preload="metadata" className="w-full" />
            </div>
          )}

          <div className="flex gap-3">
            {recorderState !== 'recording' ? (
              <Button type="button" className="min-h-12 flex-1 gap-2" onClick={startRecording} disabled={isUploading}>
                <Mic className="h-4 w-4" />
                {recorderState === 'recorded' ? 'Record Again' : 'Start Recording'}
              </Button>
            ) : (
              <Button type="button" className="min-h-12 flex-1 gap-2" onClick={stopRecording} disabled={isUploading}>
                <Square className="h-4 w-4" />
                Stop Recording
              </Button>
            )}
          </div>
        </div>

        <SheetFooter className="border-t border-border px-4 pb-4 pt-3">
          {recorderState === 'recorded' ? (
            <div className="flex w-full gap-3">
              <Button type="button" variant="outline" className="min-h-12 flex-1 gap-2" onClick={resetRecorder} disabled={isUploading}>
                <RotateCcw className="h-4 w-4" />
                Discard
              </Button>
              <Button type="button" className="min-h-12 flex-1 gap-2" onClick={handleSend} disabled={isUploading || !recordedBlob}>
                {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send Audio
              </Button>
            </div>
          ) : (
            <Button type="button" variant="outline" className="min-h-12 w-full" onClick={() => onOpenChange(false)} disabled={isUploading}>
              Cancel
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
