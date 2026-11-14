// Voice input through the browser's Web Speech API (SpeechRecognition / webkitSpeechRecognition).
// The browser turns speech into text; the text then goes through the same parser as typing.
// Unsupported browsers (Firefox, most in-app browsers) report `supported: false` and the UI hides the mic.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

type RecognitionResultEvent = { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }> };
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onerror: ((e: unknown) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type RecognitionCtor = new () => Recognition;

/** The browser's SpeechRecognition constructor, or null. */
export function speechRecognitionCtor(w: unknown = typeof window === 'undefined' ? undefined : window): RecognitionCtor | null {
  if (!w) return null;
  const g = w as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return g.SpeechRecognition ?? g.webkitSpeechRecognition ?? null;
}

const noSubscribe = () => () => {};

export function useSpeechInput(onText: (text: string) => void) {
  // Server render and hydration say "unsupported"; the client then reads the real answer.
  const supported = useSyncExternalStore(noSubscribe, () => speechRecognitionCtor() !== null, () => false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState(false);
  const rec = useRef<Recognition | null>(null);
  const latest = useRef(onText);
  useEffect(() => {
    latest.current = onText;
  });
  useEffect(() => () => rec.current?.abort(), []);

  const toggle = useCallback(() => {
    if (rec.current) {
      rec.current.stop();
      return;
    }
    const Ctor = speechRecognitionCtor();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en-US';
    r.interimResults = false;
    r.continuous = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      const text = Array.from(e.results, (res) => res[0]?.transcript ?? '').join(' ').trim();
      if (text) latest.current(text);
    };
    r.onerror = () => setError(true);
    r.onend = () => {
      rec.current = null;
      setListening(false);
    };
    setError(false);
    rec.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      rec.current = null;
      setError(true);
    }
  }, []);

  return { supported, listening, error, toggle };
}
