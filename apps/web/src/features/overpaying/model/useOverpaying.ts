// S23 Overpaying check (/tools/overpaying): ZIP, household and up to four monthly amounts, each set
// against the typical range for the area (engine overpayingCheck), with the gap per year and the
// 10-year effect. Cold-first: it needs only a ZIP and one amount; a profile of the person's own
// fills what it can. Recomputed on every change, in the browser, with no network. Never changes the
// profile: the inputs live here and, when `onStore` is given, in the store's `tools.overpaying`.
import type { Profile } from '@lifeguessr/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SCREEN_ROUTES } from '@/lib/screens';
import { useAppReady } from '@/state';
import { computeOverpaying } from './compute';
import { defaultOverpayingDeps } from './deps';
import {
  ADULTS_MAX, BEDROOMS_MAX, KID_AGES, KIDS_PER_BAND_MAX, clampAdults, clampBedrooms, clampKidCount, initialDraft, sameZip, toToolState, type Draft,
} from './inputs';
import type {
  AreaTier, BenchmarkLine, KidAge, MetroPickerVM, Money, OverpayingOptions, OverpayingVM, PrefillVM,
} from './types';

/**
 * How long the inputs must stay as they are before a shown result counts as a check. Typing "3000"
 * goes through 3, 30, 300; the event should say one check was made, not four.
 */
export const CHECKED_EVENT_SETTLE_MS = 1_000;

const FALLBACK_TIER: AreaTier = 'mid';

export function useOverpaying(profile: Profile | null, opts: OverpayingOptions = {}): OverpayingVM {
  const { streamer = false, stored, onStore } = opts;
  const deps = opts.deps ?? defaultOverpayingDeps;
  const ready = useAppReady();

  // What the form starts as; once the person changes anything, their draft replaces it whole.
  const initial = useMemo(() => initialDraft(profile, stored), [profile, stored]);
  // What the profile alone gives. Where a value came from is judged against this, never against the saved
  // inputs: those change on every edit (the store round trip) and would otherwise erase the labels.
  const fromProfile = useMemo(() => initialDraft(profile, undefined), [profile]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const current = draft ?? initial.draft;
  const edit = useCallback((change: (d: Draft) => Draft) => setDraft((prev) => change(prev ?? initial.draft)), [initial]);

  const { metros } = deps;
  const metroOptions = useMemo(() => metros.list(), [metros]);

  const computed = useMemo(
    () =>
      ready && !streamer
        ? computeOverpaying({ inputs: current.inputs, metro: { metro: current.metro, tier: current.tier }, profile, deps })
        : null,
    [ready, streamer, current, profile, deps],
  );

  // ----- setters -----
  // A metro is chosen for the ZIP that had none; a different ZIP is asked again.
  const setZip = useCallback(
    (zip: string) =>
      edit((d) => ({ ...d, inputs: { ...d.inputs, zip }, ...(sameZip(d.inputs.zip, zip) ? {} : { metro: null, tier: null }) })),
    [edit],
  );
  const setBedrooms = useCallback(
    (n: number) => edit((d) => ({ ...d, householdEntered: true, inputs: { ...d.inputs, bedrooms: clampBedrooms(n) } })),
    [edit],
  );
  const setAdults = useCallback(
    (n: number) => edit((d) => ({ ...d, householdEntered: true, inputs: { ...d.inputs, adults: clampAdults(n) } })),
    [edit],
  );
  const setKidCount = useCallback(
    (age: KidAge, n: number) =>
      edit((d) => ({ ...d, householdEntered: true, inputs: { ...d.inputs, kids: { ...d.inputs.kids, [age]: clampKidCount(n) } } })),
    [edit],
  );
  const setAmount = useCallback(
    (line: BenchmarkLine, amount: Money | null) => edit((d) => ({ ...d, inputs: { ...d.inputs, amounts: { ...d.inputs.amounts, [line]: amount } } })),
    [edit],
  );
  const setMetro = useCallback(
    (metro: string | null) =>
      edit((d) => {
        if (metro === null) return { ...d, metro: null, tier: null };
        const tiers = metroOptions.find((m) => m.metro === metro)?.tiers ?? [];
        const tier = d.tier && tiers.includes(d.tier) ? d.tier : tiers.includes(FALLBACK_TIER) ? FALLBACK_TIER : (tiers[0] ?? null);
        return { ...d, metro, tier };
      }),
    [edit, metroOptions],
  );
  const setTier = useCallback((tier: AreaTier) => edit((d) => ({ ...d, tier })), [edit]);

  // ----- the last inputs: kept after the person's own changes only (prefill alone is not "typed") -----
  const onStoreRef = useRef(onStore);
  useEffect(() => {
    onStoreRef.current = onStore;
  });
  const savedRef = useRef<string | null>(null);
  useEffect(() => {
    if (draft === null) return;
    const state = toToolState(draft);
    const key = JSON.stringify(state);
    if (savedRef.current === key) return;
    savedRef.current = key;
    try {
      onStoreRef.current?.(state);
    } catch {
      // Keeping the inputs is a convenience; a full or blocked storage must not break the screen.
    }
  }, [draft]);

  // ----- events: enums and counts only, never an amount, a ZIP or a place -----
  const { track, trackTool } = deps;
  const shown = ready && !streamer;
  useEffect(() => {
    if (shown) trackTool('overpaying');
  }, [shown, trackTool]);

  const reported = useRef(new Set<string>());
  const readyResult = computed?.result?.status === 'ready' ? computed.result.data : null;
  const signature = readyResult ? computed!.signature : null;
  const lines = readyResult?.summary.compared ?? 0;
  const above = readyResult?.summary.above ?? 0;
  useEffect(() => {
    // A check that compared no line (everything skipped) is not a check.
    if (signature === null || lines === 0 || reported.current.has(signature)) return;
    const timer = setTimeout(() => {
      reported.current.add(signature);
      track({ name: 'overpaying_checked', props: { lines, above } });
    }, CHECKED_EVENT_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [signature, lines, above, track]);

  // ----- what the screen gets -----
  const prefill: PrefillVM = {
    zip: fromProfile.prefill.zip && current.inputs.zip === fromProfile.draft.inputs.zip,
    amounts: {
      rent: null, carInsurance: null, groceries: null, childcare: null,
    },
  };
  for (const line of Object.keys(prefill.amounts) as BenchmarkLine[]) {
    const from = fromProfile.prefill.amounts[line];
    if (from !== null && current.inputs.amounts[line] === fromProfile.draft.inputs.amounts[line]) prefill.amounts[line] = from;
  }

  const coverage = computed?.coverage ?? { kind: 'empty' as const };
  const metroPicker: MetroPickerVM | null =
    coverage.kind === 'none' || coverage.kind === 'metro'
      ? {
          options: metroOptions,
          metro: current.metro,
          tier: current.tier,
          tiers: metroOptions.find((m) => m.metro === current.metro)?.tiers ?? [],
          setMetro,
          setTier,
        }
      : null;

  return {
    status: ready ? 'ready' : 'loading',
    hidden: streamer,
    inputs: current.inputs,
    setZip,
    setBedrooms,
    setAdults,
    setKidCount,
    setAmount,
    limits: { kidsPerBand: KIDS_PER_BAND_MAX, bedrooms: BEDROOMS_MAX, adults: ADULTS_MAX },
    prefill,
    household: {
      source: current.householdEntered ? 'entered' : 'default',
      bedrooms: current.inputs.bedrooms,
      adults: current.inputs.adults,
      kids: KID_AGES.reduce((sum, age) => sum + current.inputs.kids[age], 0),
    },
    coverageCounts: { zips: deps.areas.zipCount, metros: metroOptions.length },
    coverage,
    metroPicker,
    invalidFields: computed?.invalidFields ?? [],
    needs: computed?.needs ?? null,
    result: computed?.result ?? null,
    playHref: SCREEN_ROUTES.S4,
    profileHref: SCREEN_ROUTES.S8,
  };
}
