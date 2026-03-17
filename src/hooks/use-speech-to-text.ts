import { useState, useCallback, useRef, useEffect } from 'react';

interface UseSpeechToTextOptions {
  onTranscript: (text: string) => void;
  lang?: string;
}

const SpeechRecognitionAPI =
  typeof window !== 'undefined'
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;

export function useSpeechToText({ onTranscript, lang = 'en-US' }: UseSpeechToTextOptions) {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const recognitionRef = useRef<any>(null);
  const wantListeningRef = useRef(false);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  const isSupported = !!SpeechRecognitionAPI;

  useEffect(() => {
    return () => {
      wantListeningRef.current = false;
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
        recognitionRef.current = null;
      }
    };
  }, []);

  const stop = useCallback(() => {
    wantListeningRef.current = false;
    setIsListening(false);
    setInterimText('');
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
  }, []);

  const start = useCallback(() => {
    if (!SpeechRecognitionAPI) return;

    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = lang;
    recognitionRef.current = recognition;
    wantListeningRef.current = true;

    recognition.onresult = (event: any) => {
      // In single-shot mode there's typically one result at index 0
      const result = event.results[0];
      if (!result) return;

      if (result.isFinal) {
        const text = result[0].transcript.trim();
        if (text) {
          onTranscriptRef.current(text);
        }
        setInterimText('');
      } else {
        setInterimText(result[0].transcript);
      }
    };

    recognition.onend = () => {
      if (wantListeningRef.current) {
        // Small delay before restarting to avoid picking up the same audio
        setTimeout(() => {
          if (wantListeningRef.current && recognitionRef.current === recognition) {
            try { recognition.start(); } catch {}
          }
        }, 100);
      } else {
        setIsListening(false);
        setInterimText('');
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        wantListeningRef.current = false;
        setIsListening(false);
        setInterimText('');
      }
      // For 'no-speech' or 'aborted', onend will handle restart
    };

    try {
      recognition.start();
      setIsListening(true);
    } catch {
      wantListeningRef.current = false;
      setIsListening(false);
    }
  }, [lang]);

  const toggle = useCallback(() => {
    if (isListening) {
      stop();
    } else {
      start();
    }
  }, [isListening, start, stop]);

  return { isListening, isSupported, interimText, start, stop, toggle };
}
