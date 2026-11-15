// @vitest-environment jsdom
// Cash Flow on the fixture ledger (2026-07-01 to 2026-11-12). No network.
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FIXTURE_NOW, resetFixtureStores } from '@/features/dashboard/model/resetFixtureStores';
import { cashFlowSummary } from '@lifeguessr/engine';
import { transactionTotals } from '@/lib/model/transactions';
import { ledger } from '@/features/transactions/model/transactionsStore';
import { useCashFlow } from './useCashFlow';

const TODAY = '2026-11-15';
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FIXTURE_NOW);
  await resetFixtureStores();
});
afterEach(() => vi.useRealTimers());

describe('useCashFlow', () => {
  it('draws six months and the KPIs of the current one', () => {
    const { result } = renderHook(() => useCashFlow({ today: TODAY }));
    const vm = result.current;
    expect(vm.ready).toBe(true);
    expect(vm.empty).toBe(false);
    expect(vm.bars.map((b) => b.period.from)).toEqual(['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11']);
    expect(vm.bars[0]).toMatchObject({ income: 0, expenses: 0 }); // June: no lines
    expect(vm.bars[1]).toMatchObject({ income: 7200, expenses: expect.closeTo(4006.4, 2) }); // July: three pay lines
    expect(vm.bars[5]!.isCurrent).toBe(true);
    // November so far: income 2400, expenses 2544.96 -> savings -144.96, rate -144.96 / 2400.
    const [income, expenses, savings, rate] = vm.kpis;
    expect(income).toMatchObject({ id: 'income', value: 2400, previous: 4800 });
    expect(expenses!.value).toBeCloseTo(2544.96, 2);
    expect(expenses!.previous).toBeCloseTo(3948.01, 2); // October
    expect(savings!.value).toBeCloseTo(-144.96, 2);
    expect(rate!.value).toBeCloseTo(-144.96 / 2400, 10);
    // October's rate: (4800 - 3948.01) / 4800.
    expect(rate!.previous).toBeCloseTo(851.99 / 4800, 10);
  });

  it('breaks the month down by category and by group', () => {
    const { result } = renderHook(() => useCashFlow({ today: TODAY }));
    expect(result.current.breakdownRows[0]).toMatchObject({ kind: 'category', category: 'rentUtilities' });
    expect(result.current.breakdownRows[0]!.share).toBeCloseTo(1883.15 / 2544.96, 10);
    act(() => result.current.setBreakdown('group'));
    // Essentials: rent 1883.15 + groceries 169.47 + car 184.98 = 2237.60. Lifestyle: 160.56 + 57.96 + 88.84 = 307.36.
    expect(result.current.breakdownRows).toEqual([
      { kind: 'group', group: 'essentials', amount: expect.closeTo(2237.6, 2), share: expect.closeTo(2237.6 / 2544.96, 8) },
      { kind: 'group', group: 'lifestyle', amount: expect.closeTo(307.36, 2), share: expect.closeTo(307.36 / 2544.96, 8) },
    ]);
  });

  it('switches to quarters and years, and to the Sankey', () => {
    const { result } = renderHook(() => useCashFlow({ today: TODAY }));
    act(() => result.current.setPeriod('quarterly'));
    expect(result.current.bars).toHaveLength(4);
    expect(result.current.bars.map((b) => b.quarter)).toEqual([1, 2, 3, 4]);
    // Q3 (July to September): income 7200 + 4800 + 4800 = 16800; expenses 4006.40 + 3991.72 + 4630.88 = 12629.00.
    expect(result.current.bars[2]).toMatchObject({ income: 16800, expenses: expect.closeTo(12629, 2) });
    // Q4 so far (October, November): income 4800 + 2400 = 7200; expenses 3948.01 + 2544.96 = 6492.97.
    expect(result.current.bars[3]).toMatchObject({ income: 7200, expenses: expect.closeTo(6492.97, 2) });
    act(() => result.current.setPeriod('yearly'));
    expect(result.current.bars).toHaveLength(3);
    // 2026: income 24000, expenses 19121.97, savings 4878.03 (a Sankey link to "savings").
    expect(result.current.summary.savings).toBeCloseTo(4878.03, 2);
    act(() => result.current.setView('sankey'));
    expect(result.current.view).toBe('sankey');
    const { nodes, links } = result.current.summary.sankey;
    expect(nodes.map((n) => n.kind)).toContain('savings');
    expect(links.find((l) => l.target === 'savings')!.value).toBeCloseTo(4878.03, 2);
    expect(links.find((l) => l.target === 'income')!.value).toBe(24000); // the engine's pay -> income link
  });

  it('is the engine\'s cash flow summary of the stored lines', () => {
    const { result } = renderHook(() => useCashFlow({ today: TODAY }));
    const expected = cashFlowSummary(transactionTotals(ledger().list()), { from: '2026-11', to: '2026-11' });
    expect(result.current.summary).toEqual(expected);
    // November so far: pay 2400 in, 2544.96 out, so 2400 - 2544.96 = -144.96 comes from savings. The engine's Sankey:
    // pay -> income 2400, and the gap 144.96 flows fromSavings -> income so Income balances.
    const { nodes, links } = result.current.summary.sankey;
    expect(nodes.slice(0, 3)).toEqual([{ id: 'pay', kind: 'income' }, { id: 'fromSavings', kind: 'savings' }, { id: 'income', kind: 'total' }]);
    expect(links[0]).toEqual({ source: 'pay', target: 'income', value: 2400 });
    expect(links[1]!.source).toBe('fromSavings');
    expect(links[1]!.value).toBeCloseTo(144.96, 2);
  });

  it('gives each KPI its change against the previous period', () => {
    const { result } = renderHook(() => useCashFlow({ today: TODAY }));
    const [income, expenses, savings, rate] = result.current.kpis;
    expect(income!.change).toBe(2400 - 4800);
    expect(expenses!.change).toBeCloseTo(2544.96 - 3948.01, 2);
    expect(savings!.change).toBeCloseTo(-144.96 - 851.99, 2);
    expect(rate!.change).toBeCloseTo(-144.96 / 2400 - 851.99 / 4800, 10);
    // 2025 has no lines, so the year has nothing to compare with (not a change from $0).
    act(() => result.current.setPeriod('yearly'));
    expect(result.current.kpis.map((k) => [k.previous, k.change])).toEqual([[null, null], [null, null], [null, null], [null, null]]);
  });

  it('shapes the Sankey flow by category and by group', () => {
    const { result } = renderHook(() => useCashFlow({ today: TODAY }));
    const byCategory = result.current.flow;
    // November: pay 2400 plus 144.96 from savings = 2544.96 through Income, all of it spent.
    expect(byCategory.sources.map((s) => s.id)).toEqual(['pay', 'fromSavings']);
    expect(byCategory.total).toBeCloseTo(2544.96, 2);
    expect(byCategory.targets[0]).toMatchObject({ kind: 'category', id: 'rentUtilities', group: 'essentials', value: 1883.15 });
    expect(byCategory.targets.reduce((s, t) => s + t.value, 0)).toBeCloseTo(2544.96, 2);
    expect(byCategory.targets.some((t) => t.kind === 'savings')).toBe(false);

    act(() => result.current.setBreakdown('group'));
    expect(result.current.flow.targets).toEqual([
      { kind: 'group', id: 'essentials', group: 'essentials', value: 2237.6 },
      { kind: 'group', id: 'lifestyle', group: 'lifestyle', value: 307.36 },
    ]);

    act(() => result.current.setPeriod('yearly'));
    const year = result.current.flow;
    expect(year.sources).toEqual([{ id: 'pay', value: 24000 }]);
    expect(year.targets[year.targets.length - 1]).toMatchObject({ kind: 'savings', value: expect.closeTo(4878.03, 2) });
    expect(year.targets.reduce((s, t) => s + t.value, 0)).toBeCloseTo(24000, 2);
  });

  it('lists the latest lines of the period, transfers left out', () => {
    const { result } = renderHook(() => useCashFlow({ today: TODAY }));
    const { lines, lineCount } = result.current;
    expect(lines.length).toBe(Math.min(6, lineCount));
    expect(lineCount).toBeGreaterThan(lines.length);
    expect(lines.every((l) => l.date.startsWith('2026-11') && l.category !== 'transfer')).toBe(true);
    expect([...lines].sort((a, b) => (a.date < b.date ? 1 : -1)).map((l) => l.date)).toEqual(lines.map((l) => l.date));
  });

  it('is empty without transactions', async () => {
    await ledger().clear();
    const { result } = renderHook(() => useCashFlow({ today: TODAY }));
    expect(result.current.empty).toBe(true);
    expect(result.current.kpis[3]).toMatchObject({ id: 'savingsRate', value: null });
  });
});
