// "Your number" view-models (S1 sample card, S10 hero): every number is the engine's, on fixtures.
import { forecast, goalStatus, rankMoves, simulate } from '@lifeguessr/engine';
import { describe, expect, it } from 'vitest';
import { compareSelfGuess } from '@/features/ladder/model/useGuessYourself';
import { cloneProfileDemo, profileDemo } from '@/fixtures';
import { areaRates } from '@/lib/model/profile';
import { SAMPLE_GOAL, SAMPLE_MOVES_SHOWN, sampleLife, yearIn, yourNumber } from './yourNumber';

const NOW = new Date(2026, 10, 14);
const rates = areaRates(profileDemo);

describe('sampleLife (S1 sample card)', () => {
  const vm = sampleLife(profileDemo, NOW);

  it('takes the 10-year number from the rules forecast in today’s dollars, with its range', () => {
    const f = forecast(profileDemo, 10, { todaysDollars: true, rates });
    expect(vm.in10y).toEqual(f.in10y);
    expect(vm.in10y.low).toBeLessThan(vm.in10y.high); // the demo profile has estimates
    expect(vm.isEstimate).toBe(true);
    expect(vm.year).toBe(2036);
  });

  it('takes net worth today from the simulation (cash + retirement − debts)', () => {
    expect(vm.today).toBe(simulate(profileDemo, 0).path[0]!.netWorth);
    expect(vm.today).toBeCloseTo(3800 + 14500 - 6400 - 17800, 6);
    expect(vm.todayIsEstimate).toBe(true); // retirement is an estimate in the fixture
  });

  it('prices her month the way S5/S7 do: this month’s spending + debt payments', () => {
    const own = compareSelfGuess(0, profileDemo, 'demo');
    expect(vm.month).toEqual({ value: own.estimate, isEstimate: own.isEstimate });
    const m = simulate(profileDemo, 1, { rates }).path[1]!;
    expect(vm.month.value).toBe(m.spending + m.debtPayments);
    expect(vm.takeHome).toEqual(profileDemo.takeHomePay);
    expect(vm.age).toBe(32);
  });

  it('measures the $200k goal with goalStatus', () => {
    const s = goalStatus(profileDemo, SAMPLE_GOAL, { rates });
    expect(vm.goal).toEqual({
      target: 200_000, years: 10, year: 2036, verdict: s.verdict, gap: s.gap, progress: s.progress, projected: s.projected,
    });
  });

  it('lists the top 2 moves by effect10y from rankMoves', () => {
    const ranked = rankMoves(profileDemo, { rates });
    expect(vm.moves).toHaveLength(SAMPLE_MOVES_SHOWN);
    expect(vm.moves.map((m) => [m.id, m.effect10y])).toEqual(ranked.slice(0, 2).map((m) => [m.id, m.effect10y]));
    expect(vm.moves[0]!.effect10y).toBeGreaterThanOrEqual(vm.moves[1]!.effect10y);
  });

  it('changes when the profile changes (nothing typed in)', () => {
    const richer = cloneProfileDemo();
    richer.cash = { value: 50_000, isEstimate: false };
    const other = sampleLife(richer, NOW);
    expect(other.today - vm.today).toBeCloseTo(50_000 - 3800, 6);
    expect(other.in10y.mid).toBeGreaterThan(vm.in10y.mid);
  });
});

describe('yourNumber (S10 hero)', () => {
  it('has no goal block without a goal', () => {
    expect(yourNumber(profileDemo, null, NOW).goal).toBeNull();
  });

  it('puts the goal’s horizon year on it and reads the gap from goalStatus at that horizon', () => {
    const goal = { target: 50_000, years: 5 };
    const vm = yourNumber(profileDemo, goal, NOW);
    const s = goalStatus(profileDemo, goal, { rates });
    expect(vm.goal?.year).toBe(2031);
    expect(vm.goal?.gap).toBe(s.gap);
    expect(vm.goal?.verdict).toBe(s.verdict);
  });

  it('has no range for a profile without estimates', () => {
    const exact = JSON.parse(JSON.stringify(profileDemo).replaceAll('"isEstimate":true', '"isEstimate":false'));
    const vm = yourNumber(exact, null, NOW);
    expect(vm.isEstimate).toBe(false);
    expect(vm.in10y.low).toBe(vm.in10y.mid);
    expect(vm.in10y.high).toBe(vm.in10y.mid);
  });

  it('counts years from the given date', () => {
    expect(yearIn(10, new Date(2030, 0, 1))).toBe(2040);
  });
});
