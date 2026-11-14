// Free text → /api/ai/parse → show the parsed values → apply only after the user confirms.
import { useCallback, useEffect, useRef, useState } from 'react';
import { isEmptyParse, parseText, type ParseKind, type ParseResultOf } from '@/lib/api/aiParse';
import { getAnonId } from '@/state/anonId';
import { toVMError } from './errors';
import type { ParseConfirmVM, VMError } from './types';

/** The text parser function (swappable in tests). */
export type ParseFn = <K extends ParseKind>(kind: K, text: string, opts: { anonId?: string; signal?: AbortSignal }) => Promise<ParseResultOf[K]>;

export function useParseConfirm<K extends ParseKind>(
  kind: K,
  onConfirm: (value: ParseResultOf[K]) => void,
  parse: ParseFn = parseText,
): ParseConfirmVM<ParseResultOf[K]> {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<ParseConfirmVM<ParseResultOf[K]>['status']>('idle');
  const [parsed, setParsed] = useState<ParseResultOf[K] | null>(null);
  const [error, setError] = useState<VMError | null>(null);
  const abort = useRef<AbortController | null>(null);
  const onConfirmRef = useRef(onConfirm);
  useEffect(() => {
    onConfirmRef.current = onConfirm;
  });
  useEffect(() => () => abort.current?.abort(), []);

  const submit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || status === 'parsing') return;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setStatus('parsing');
    setError(null);
    setParsed(null);
    parse(kind, trimmed, { anonId: getAnonId(), signal: controller.signal }).then(
      (value) => {
        if (controller.signal.aborted) return;
        if (isEmptyParse(kind, value)) {
          setError({ kind: 'nothingFound' });
          setStatus('error');
          return;
        }
        setParsed(value);
        setStatus('confirming');
      },
      (err: unknown) => {
        if (controller.signal.aborted) return;
        setError(toVMError(err));
        setStatus('error');
      },
    );
  }, [kind, parse, status, text]);

  const confirm = useCallback(() => {
    if (status !== 'confirming' || parsed === null) return;
    onConfirmRef.current(parsed);
    setParsed(null);
    setText('');
    setStatus('idle');
  }, [parsed, status]);

  const cancel = useCallback(() => {
    abort.current?.abort();
    setParsed(null);
    setError(null);
    setStatus('idle');
  }, []);

  return { text, status, parsed, error, setText, submit, confirm, cancel };
}
