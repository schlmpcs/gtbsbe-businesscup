// What if? (/what-if): two scenarios on the store profile (the sample life until the user adds
// theirs) → engine compareFutures (rules forecast) → choice cards, the two-line chart and the
// result. A typed "What if…" goes through /api/ai/parse (kind 'scenario'); the user confirms the
// parsed change and drops it into A or B. Saving a choice is Pro (local store, slice `whatIfs`).
// No funnel event: the event list is full, and none of the existing ones fits.
import { coveredMetros } from '@lifeguessr/data/areas';
import type { ScenarioChange } from '@lifeguessr/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { parseScenarioText, type ScenarioParseOptions, type ScenarioParseResult } from '@/lib/api/aiParse';
import { runEngine, toVMError } from '@/lib/model/errors';
import { SCREEN_ROUTES } from '@/lib/screens';
import { getAnonId, isSampleActive, useAppReady, useAppStore, usePro } from '@/state';
import type { AskVM, Letter, VMError, WhatIfVM } from './types';
import {
  PRESETS, chartVM, choiceVM, compare, confirmVM, customTitle, homeAreaOf, presetSides, resultVM, type Side,
} from './whatIfVm';

/** The text parser (swappable in tests). */
export type ScenarioParseFn = (text: string, opts: ScenarioParseOptions) => Promise<ScenarioParseResult>;

export type UseWhatIfOptions = { parse?: ScenarioParseFn; initialPreset?: string; now?: () => Date };

export function useWhatIf(opts: UseWhatIfOptions = {}): WhatIfVM {
  const ready = useAppReady();
  const profile = useAppStore((s) => s.profile);
  const goal = useAppStore((s) => s.goal);
  const isSample = useAppStore(isSampleActive);
  const whatIfs = useAppStore((s) => s.whatIfs);
  const saveWhatIf = useAppStore((s) => s.saveWhatIf);
  const removeWhatIf = useAppStore((s) => s.removeWhatIf);
  const saveLocked = !usePro().isPro;
  const parse = opts.parse ?? parseScenarioText;

  const [presetId, setPresetId] = useState<string | null>(opts.initialPreset ?? PRESETS[0]!.id);
  const [custom, setCustom] = useState<{ A: Side; B: Side } | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<Letter | null>(null);

  const sides = useMemo(() => {
    if (custom) return custom;
    const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0]!;
    return presetSides(preset, profile);
  }, [custom, presetId, profile]);

  const computed = useMemo(
    () => runEngine(() => compare(profile, sides.A.scenario, sides.B.scenario, goal)),
    [profile, sides, goal],
  );
  const cmp = computed.status === 'ready' ? computed.data : null;
  const year = (opts.now ?? (() => new Date()))().getFullYear();

  const selectPreset = useCallback((id: string) => {
    setPresetId(id);
    setCustom(null);
    setSavedId(null);
  }, []);

  // ----- "What if…" text → confirm → put in A or B ---------------------------------------------
  const [text, setText] = useState('');
  const [status, setStatus] = useState<AskVM['status']>('idle');
  const [parsed, setParsed] = useState<ScenarioParseResult | null>(null);
  const [error, setError] = useState<VMError | null>(null);
  const abort = useRef<AbortController | null>(null);
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
    parse(trimmed, { anonId: getAnonId(), signal: controller.signal, homeZip: homeAreaOf(profile).area.zip }).then(
      (r) => {
        if (controller.signal.aborted) return;
        setParsed(r);
        setStatus('confirming');
      },
      (err: unknown) => {
        if (controller.signal.aborted) return;
        setError(toVMError(err));
        setStatus('error');
      },
    );
  }, [parse, profile, status, text]);

  const putIn = useCallback((letter: Letter) => {
    if (!parsed) return;
    const change: ScenarioChange = parsed.value;
    setCustom((prev) => {
      const base = prev ?? sides;
      const side = base[letter];
      const changes = [...side.scenario.changes, change].slice(-8);
      const title = customTitle([change], side.scenario.changes.length > 0 ? side.title : '');
      const next: Side = { scenario: { label: title.slice(0, 80), changes }, title, art: side.art, presetId: null, estimate: true };
      return { ...base, [letter]: next };
    });
    setSavedId(null);
    setParsed(null);
    setText('');
    setStatus('idle');
    setEditTarget(null);
  }, [parsed, sides]);

  const cancel = useCallback(() => {
    abort.current?.abort();
    setParsed(null);
    setError(null);
    setStatus('idle');
  }, []);

  const metros = useMemo(() => coveredMetros().map((m) => m.metro.replace(/, [A-Z]{2}$/, '')), []);

  const ask: AskVM = {
    text, status, error, metros, setText, submit, putIn, cancel,
    confirm: parsed ? confirmVM(parsed.value, parsed.inferred, parsed.parsedBy, profile) : null,
  };

  // ----- save (Pro) ----------------------------------------------------------------------------
  const save = useCallback(() => {
    if (saveLocked || savedId) return;
    setSavedId(saveWhatIf({ A: sides.A.scenario, B: sides.B.scenario, presetId: custom ? null : presetId }));
  }, [custom, presetId, saveLocked, saveWhatIf, savedId, sides]);

  const openSaved = useCallback((id: string) => {
    const w = useAppStore.getState().whatIfs.find((x) => x.id === id);
    if (!w) return;
    if (w.presetId && PRESETS.some((p) => p.id === w.presetId)) {
      selectPreset(w.presetId);
      return;
    }
    const side = (s: typeof w.A): Side => ({ scenario: s, title: s.label, art: null, presetId: null, estimate: true });
    setCustom({ A: side(w.A), B: side(w.B) });
    setSavedId(id);
  }, [selectPreset]);

  const tryAnother = useCallback(() => {
    const i = PRESETS.findIndex((p) => p.id === presetId);
    selectPreset(PRESETS[(i + 1) % PRESETS.length]!.id);
    setEditTarget('A');
  }, [presetId, selectPreset]);

  return {
    status: !ready ? 'loading' : computed.status === 'error' ? 'error' : 'ready',
    error: computed.status === 'error' ? computed.error : null,
    presets: PRESETS.map((p) => ({ id: p.id, selected: !custom && p.id === presetId })),
    selectPreset,
    A: choiceVM('A', sides.A, profile, cmp?.A ?? null),
    B: choiceVM('B', sides.B, profile, cmp?.B ?? null),
    chart: cmp ? chartVM(cmp, sides.A.scenario, sides.B.scenario, goal) : null,
    result: cmp ? resultVM(cmp, year) : null,
    ask,
    editTarget,
    edit: setEditTarget,
    homeAssumed: homeAreaOf(profile).assumed ? homeAreaOf(profile).area.metro : null,
    isSample,
    saveLocked,
    proHref: SCREEN_ROUTES.S15,
    saved: savedId !== null,
    save,
    savedChoices: whatIfs.map((w) => ({
      id: w.id, titleA: w.A.label, titleB: w.B.label, savedAt: w.savedAt,
    })).reverse(),
    openSaved,
    removeSaved: removeWhatIf,
    tryAnother,
  };
}

