// @vitest-environment jsdom
// Cash Flow on the fixture ledger (2026-07-01 to 2026-11-12). No network.
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetFixtureStores } from '@/features/dashboard/model/resetFixtureStores';
import { useTransactionsStore } from '@/features/transactions/model/transactionsStore';
import { useCashFlow } from './useCashFlow';

const TODAY = '2026-11-15';
beforeEach(resetFixtureStores);

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
    expect(links.find((l) => l.source === 'income')!.value).toBe(24000);
  });

  it('is empty without transactions', () => {
    useTransactionsStore.setState({ transactions: [] });
    const { result } = renderHook(() => useCashFlow({ today: TODAY }));
    expect(result.current.empty).toBe(true);
    expect(result.current.kpis[3]).toMatchObject({ id: 'savingsRate', value: null });
  });
});
