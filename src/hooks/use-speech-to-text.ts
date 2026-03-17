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
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;
    recognitionRef.current = recognition;
    wantListeningRef.current = true;

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const text = result[0].transcript.trim();
          if (text) {
            onTranscriptRef.current(text);
          }
          setInterimText('');
        } else {
          interim += result[0].transcript;
        }
      }
      if (interim) {
        setInterimText(interim);
      }
    };

    recognition.onend = () => {
      if (wantListeningRef.current) {
        try { recognition.start(); } catch {}
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
