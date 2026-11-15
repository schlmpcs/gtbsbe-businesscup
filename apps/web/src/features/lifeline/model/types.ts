// View-model of the home "Life line" hero (useLifeLine). The contract with lifeline/ui/*, which may import
// only this file, @/ui-kit/** and @/copy (lint-enforced). Every number arrives formatted; raw numbers are
// kept only where the chart or the slider needs them. The UI never computes a money value.

export type LifeLineTone = 'good' | 'bad' | 'neutral';

export type LifeLineKpiVM = {
  id: 'atRetirement' | 'chance' | 'runsOut';
  label: string;
  /** "$1.24M", "83%", "Never", "at 35"; null while measuring. */
  value: string | null;
  /** The plan's value before the drag ("$698k"), null when nothing moved. */
  was: string | null;
  /** "▲ $542k", "+42 pts", "fixed"; null when nothing moved or no change. */
  delta: string | null;
  tone: LifeLineTone;
  /** Chance only: 0–100 for the ring, null while measuring. */
  gaugePct?: number | null;
  /** Shown instead of the value while the Monte Carlo runs ("Measuring…") or when it failed. */
  note?: string | null;
};

export type LifeLinePoint = { age: number; netWorth: number };

export type LifeLineChartVM = {
  title: string;
  ariaLabel: string;
  /** Net worth per year of age with the event at the picked year. */
  selected: LifeLinePoint[];
  /** The same with the event where the plan has it; null when the picked year is the plan's. */
  before: LifeLinePoint[] | null;
  /** p10–p90 of the Monte Carlo paths for the picked year; null while measuring. */
  band: { age: number; p10: number; p90: number }[] | null;
  /** Domain the UI scales to: ages and net worth (raw dollars). */
  ageDomain: [number, number];
  valueDomain: [number, number];
  xTicks: { age: number; label: string }[];
  yTicks: { value: number; label: string }[];
  markers: { id: string; age: number; label: string; icon: 'home' | 'kid' | 'beach' | 'other'; tone: 'primary' | 'violet' | 'positive' }[];
  /** The callout at retirement on the picked line, and the "was" callout on the before line. */
  retireCallout: { age: number; netWorth: number; label: string } | null;
  beforeCallout: { age: number; netWorth: number; label: string } | null;
  /** Where the before line (or, without one, the picked line) runs out of money. */
  runsOut: { age: number; label: string; line: 'selected' | 'before' } | null;
  /** Where the slider's ghost (the plan's year) and the picked year sit, for the "you dragged it" arrow. */
  dragged: { fromAge: number; toAge: number } | null;
  legend: { selected: string; before: string | null; band: string };
};

export type LifeLineSliderVM = {
  eyebrow: string;
  title: string;
  /** ", not 35" when the picked year differs from the plan's. */
  titleNot: string | null;
  label: string;
  /** Ages. */
  min: number;
  max: number;
  value: number;
  /** The plan's age (the ghost knob). */
  base: number;
  ticks: number[];
  formatValue: (age: number) => string;
  facts: { label: string; tone: 'good' | 'plain' }[];
  isEstimate: boolean;
  estimateNote: string;
};

export type LifeLineVM =
  | { status: 'loading' }
  | {
      status: 'ready';
      sticker: string;
      headline: { lead: string; payoff: string | null; payoffTone: LifeLineTone };
      sub: string;
      kpis: LifeLineKpiVM[];
      chart: LifeLineChartVM;
      slider: LifeLineSliderVM;
      house: { art: 'home-large' | 'house-build'; label: string; tone: 'good' | 'bad' };
      apply: { label: string; done: boolean };
      disclaimer: string;
      setAge: (age: number) => void;
      applyToPlan: () => void;
    };
