// Free text → /api/ai/parse → show the parsed values → apply only after the user confirms.
import { useCallback, useEffect, useRef, useState } from 'react';
import { isEmptyParse, parseText, type ParseKind, type ParseOptions, type ParseResult, type ParseValueOf } from '@/lib/api/aiParse';
import { getAnonId } from '@/state/anonId';
import { toVMError } from './errors';
import type { ParseConfirmVM, VMError } from './types';

/** The text parser (swappable in tests). */
export type ParseFn = <K extends ParseKind>(kind: K, text: string, opts: ParseOptions) => Promise<ParseResult<K>>;

export function useParseConfirm<K extends ParseKind>(
  kind: K,
  onConfirm: (value: ParseValueOf[K]) => void,
  opts: { parse?: ParseFn; debts?: ParseOptions['debts'] } = {},
): ParseConfirmVM<ParseValueOf[K]> {
  const parse = opts.parse ?? parseText;
  const [text, setText] = useState('');
  const [status, setStatus] = useState<ParseConfirmVM<ParseValueOf[K]>['status']>('idle');
  const [parsed, setParsed] = useState<ParseResult<K> | null>(null);
  const [error, setError] = useState<VMError | null>(null);
  const abort = useRef<AbortController | null>(null);
  const latest = useRef({ onConfirm, debts: opts.debts });
  useEffect(() => {
    latest.current = { onConfirm, debts: opts.debts };
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
    parse(kind, trimmed, { anonId: getAnonId(), signal: controller.signal, debts: latest.current.debts }).then(
      (result) => {
        if (controller.signal.aborted) return;
        if (isEmptyParse(kind, result.value)) {
          setError({ kind: 'nothingFound' });
          setStatus('error');
          return;
        }
        setParsed(result);
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
    latest.current.onConfirm(parsed.value);
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

  return {
    text, status, error, setText, submit, confirm, cancel,
    parsed: parsed?.value ?? null,
    inferred: parsed?.inferred ?? [],
  };
}
