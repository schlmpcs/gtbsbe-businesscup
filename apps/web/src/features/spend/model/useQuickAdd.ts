// The daily log's input: one line (typed, spoken or a preset chip) → purchases in the app store.
//
// 1. The local parser (parseLine.ts) reads the line. When it reads every part (an amount and a known
//    word each), the purchases are saved at once, with Undo.
// 2. Otherwise the line goes to /api/ai/parse (kind 'spend'), which only maps words to a category
//    and copies amounts written in the text; where our parser found the amount, ours is kept. The
//    user confirms before anything is saved.
// 3. With the AI off or failing, the parts that have an amount are offered with the category we
//    found, or "pick one"; a part without an amount asks for one. Nothing is ever guessed.
import { SPEND_ITEM_CATEGORIES, type CostCategory, type SpendItem } from '@lifeguessr/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { spend as copy, type SpendPresetId } from '@/copy';
import { parseText, type ParseOptions, type ParseResult } from '@/lib/api/aiParse';
import { getAnonId } from '@/state/anonId';
import { useAppStore } from '@/state';
import { parseSpendLine, type SpendLineParse } from './parseLine';
import { SPEND_PRESETS } from './presets';
import type { QuickAddError, QuickAddVM, SpendDraftVM } from './types';
import { useSpeechInput } from './useSpeechInput';

/** The AI parser for the daily log (swappable in tests). */
export type SpendParseFn = (kind: 'spend', text: string, opts: ParseOptions) => Promise<ParseResult<'spend'>>;

/** Today on the local calendar as 'YYYY-MM-DD'. */
export function localDate(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * The AI's purchases, with the user's own amounts wherever our parser read one: when the AI returns
 * one purchase per part, a part's typed amount replaces the AI's.
 */
export function keepTypedAmounts(ai: SpendItem[], local: SpendLineParse): SpendItem[] {
  if (ai.length !== local.parts.length) return ai;
  return ai.map((item, i) => {
    const typed = local.parts[i]!.amount;
    return typed === undefined ? item : { ...item, amount: typed };
  });
}

/** The local fallback: every part needs an amount; a part with no known word gets "pick one" (other). */
export function localDrafts(local: SpendLineParse): { drafts: SpendDraftVM[] } | { error: QuickAddError } {
  const missing = local.parts.find((p) => p.amount === undefined);
  if (missing) return { error: { kind: 'noAmount', part: missing.label ?? missing.text } };
  return {
    drafts: local.parts.map((p, i) => ({
      key: `d${i}`,
      category: p.category ?? 'other',
      amount: p.amount!,
      ...(p.label ? { label: p.label } : {}),
      categoryGuessed: p.category === undefined,
    })),
  };
}

export function useQuickAdd(opts: { ready: boolean; now?: Date; parse?: SpendParseFn }): QuickAddVM {
  const parse = opts.parse ?? parseText;
  const addDailyEntries = useAppStore((s) => s.addDailyEntries);
  const removeDailyEntries = useAppStore((s) => s.removeDailyEntries);
  const [text, setText] = useState('');
  const [status, setStatus] = useState<QuickAddVM['status']>('idle');
  const [error, setError] = useState<QuickAddError | null>(null);
  const [drafts, setDrafts] = useState<SpendDraftVM[]>([]);
  const [draftSource, setDraftSource] = useState<QuickAddVM['draftSource']>(null);
  const [lastAdded, setLastAdded] = useState<{ ids: string[] } | null>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  const { ready, now } = opts;

  const save = useCallback(
    (items: SpendItem[]) => {
      if (items.length === 0) return;
      const ids = addDailyEntries(items, localDate(now));
      setLastAdded({ ids });
      setText('');
      setDrafts([]);
      setDraftSource(null);
      setError(null);
      setStatus('idle');
    },
    [addDailyEntries, now],
  );

  const fail = useCallback((e: QuickAddError) => {
    setError(e);
    setStatus('error');
  }, []);

  const submit = useCallback(() => {
    const line = text.trim();
    if (!ready || !line || status === 'parsing') return;
    const local = parseSpendLine(line);
    if (local.parts.length === 0) return fail({ kind: 'nothing' });
    if (local.unresolved.length === 0) return save(local.items);

    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setStatus('parsing');
    setError(null);
    const fallback = () => {
      const r = localDrafts(local);
      if ('error' in r) return fail(r.error);
      setDrafts(r.drafts);
      setDraftSource('local');
      setStatus('confirming');
    };
    parse('spend', line, { anonId: getAnonId(), signal: controller.signal }).then(
      (result) => {
        if (controller.signal.aborted) return;
        const items = keepTypedAmounts(result.value, local);
        if (items.length === 0) return fallback();
        setDrafts(items.map((it, i) => ({ key: `d${i}`, ...it, categoryGuessed: false })));
        setDraftSource('ai');
        setStatus('confirming');
      },
      () => {
        if (!controller.signal.aborted) fallback();
      },
    );
  }, [fail, parse, ready, save, status, text]);

  const confirm = useCallback(() => {
    if (status !== 'confirming') return;
    save(drafts.map(({ category, amount, label }) => ({ category, amount, ...(label ? { label } : {}) })));
  }, [drafts, save, status]);

  const cancel = useCallback(() => {
    abort.current?.abort();
    setDrafts([]);
    setDraftSource(null);
    setError(null);
    setStatus('idle');
  }, []);

  const setDraftCategory = useCallback((key: string, category: CostCategory) => {
    setDrafts((ds) => ds.map((d) => (d.key === key ? { ...d, category, categoryGuessed: false } : d)));
  }, []);

  const addPreset = useCallback(
    (id: SpendPresetId) => {
      const p = SPEND_PRESETS.find((x) => x.id === id);
      if (!ready || !p) return;
      setLastAdded({ ids: addDailyEntries([{ category: p.category, amount: p.amount, label: copy.presets.names[id] }], localDate(now)) });
    },
    [addDailyEntries, now, ready],
  );

  const undo = useCallback(() => {
    if (!lastAdded) return;
    removeDailyEntries(lastAdded.ids);
    setLastAdded(null);
  }, [lastAdded, removeDailyEntries]);

  // Speech fills the same text field (appended after what is there); the user then taps Add.
  const speech = useSpeechInput((said) => {
    setText((t) => (t.trim() ? `${t.trim()}, ${said}` : said));
    if (status === 'error') {
      setError(null);
      setStatus('idle');
    }
  });

  return {
    ready,
    text,
    setText: (t) => {
      setText(t);
      if (status === 'error') {
        setError(null);
        setStatus('idle');
      }
    },
    submit,
    status,
    error,
    draftSource,
    drafts,
    setDraftCategory,
    confirm,
    cancel,
    categories: SPEND_ITEM_CATEGORIES,
    presets: SPEND_PRESETS,
    addPreset,
    lastAdded: lastAdded ? { count: lastAdded.ids.length } : null,
    undo,
    speech,
  };
}
