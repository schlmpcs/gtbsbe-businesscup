// View-model types for What if? (/what-if) and the TwoFuturesHero. The ui/ files import only these.
// Every number here comes from @lifeguessr/engine (compareFutures, rules forecast); the UI scales
// them to coordinates and formats them, nothing more.
import type { AreaData, CostCategory, KidAge, Money, Rate } from '@lifeguessr/types';
import type { VMError } from '@/lib/model/types';

export type { VMError };
export type Letter = 'A' | 'B';
export type WhatIfTerm = CostCategory | 'income';
export type Tier = AreaData['tier'];

/** One fact chip on a choice card. The UI maps `kind` to copy. */
export type ChoiceFactVM =
  | { kind: 'price'; amount: Money }
  | { kind: 'loan'; apr: Rate; termMonths: number; monthly: Money }
  | { kind: 'down'; amount: Money }
  | { kind: 'payWith'; way: 'cash' | 'card' }
  | { kind: 'recurring'; amount: Money; per: 'monthly' | 'yearly' }
  | { kind: 'place'; metro: string; tier: Tier; zip: string }
  | { kind: 'kid'; age: KidAge; inMonths: number; childcare: Money | null }
  | { kind: 'income'; monthlyDelta: Money; grossYearly: Money | null }
  | { kind: 'rent'; monthly: Money }
  | { kind: 'payDebt'; amount: Money | null }
  | { kind: 'keep' }
  | { kind: 'asItIs' }
  | { kind: 'afford'; verdict: 'fits' | 'wait' | 'no'; waitMonths: number | null };

export type ChoiceVM = {
  letter: Letter;
  /** Card title (from copy for presets; built from the change for your own what-if). */
  title: string;
  /** Art id in /public/art/what-if (null = no art). */
  art: string | null;
  facts: ChoiceFactVM[];
  /** Some number on this card is an estimate (illustrative loan terms, area averages). */
  estimate: boolean;
};

export type ChartPointVM = { month: number; low: Money; mid: Money; high: Money };

export type ChartSideVM = {
  letter: Letter;
  /** Net worth by month, today's dollars (month 0 = today). */
  points: ChartPointVM[];
  /** Points at month 0, 12, …, 120 (the scrubber reads these by index). */
  yearly: ChartPointVM[];
  end: ChartPointVM;
  verdict: 'onTrack' | 'withinRange' | 'behind' | null;
};

export type ChartVM = {
  years: number;
  A: ChartSideVM;
  B: ChartSideVM;
  /** y-axis bounds (covers both bands, the goal and zero) and its tick values. */
  domain: { min: Money; max: Money };
  ticks: Money[];
  goal: { target: Money; years: number } | null;
  /** Changes that start later (e.g. "a baby in 2 years"): a tick at that month. */
  markers: { letter: Letter; month: number }[];
  /** Changes on each re-render key: the UI replays the draw animation when it changes. */
  key: string;
};

export type ResultVM = {
  winner: Letter | null;
  /** |B − A| at the horizon (today's dollars). */
  aheadBy: Money;
  /** The calendar year at the horizon. */
  endYear: number;
  decidedBy: { term: WhatIfTerm; winner: Letter; gap: Money } | null;
  /** Monthly change vs the plan as it is, by term, for each side (the bars). */
  bars: { term: WhatIfTerm; A: Money; B: Money }[];
  /** 'left' when every bar is a cost (no savings to draw left of the axis). */
  barAxis: 'left' | 'center';
  /** Largest |value| among the bars (to scale them). */
  barMax: Money;
};

export type ConfirmVM = {
  kind: 'purchase' | 'loan' | 'move' | 'kid' | 'income' | 'rent' | 'payDebt';
  facts: ChoiceFactVM[];
  /** A place we mapped to one of our ZIPs ("Austin" → 78704). */
  place: { metro: string; zip: string; tier: Tier } | null;
  /** A gross yearly raise turned into take-home (engine estimate). */
  raise: { grossYearly: Money; monthlyDelta: Money } | null;
  /** The sentence gave no start: the change starts now. */
  noTiming: boolean;
  inferred: string[];
  parsedBy: 'ai' | 'rules';
};

export type AskVM = {
  text: string;
  status: 'idle' | 'parsing' | 'confirming' | 'error';
  confirm: ConfirmVM | null;
  error: VMError | null;
  /** For a place we have no data for: the metros we do have. */
  metros: string[];
  setText: (text: string) => void;
  submit: () => void;
  putIn: (letter: Letter) => void;
  cancel: () => void;
};

export type PresetVM = { id: string; selected: boolean };

export type SavedVM = { id: string; titleA: string; titleB: string; savedAt: string };

export type WhatIfVM = {
  status: 'loading' | 'ready' | 'error';
  error: VMError | null;
  presets: PresetVM[];
  selectPreset: (id: string) => void;
  A: ChoiceVM;
  B: ChoiceVM;
  chart: ChartVM | null;
  result: ResultVM | null;
  ask: AskVM;
  /** Focus the text field for one side ("Change"). */
  editTarget: Letter | null;
  edit: (letter: Letter) => void;
  /** The profile has no area we know: costs use this metro. */
  homeAssumed: string | null;
  isSample: boolean;
  /** Pro gate for saving. */
  saveLocked: boolean;
  proHref: string;
  saved: boolean;
  save: () => void;
  savedChoices: SavedVM[];
  openSaved: (id: string) => void;
  removeSaved: (id: string) => void;
  tryAnother: () => void;
};

export type TwoFuturesHeroVM = {
  presetId: string;
  A: ChoiceVM;
  B: ChoiceVM;
  chart: ChartVM;
  result: ResultVM;
  /** Index of the preset on screen and how many there are (the dots). */
  index: number;
  count: number;
  select: (index: number) => void;
  href: string;
};
