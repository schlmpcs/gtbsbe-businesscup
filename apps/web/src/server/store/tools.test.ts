import { TEST_STORE_URL, testPostgresStore } from './testUtils';
import { randomUUID } from 'node:crypto';
import {
  EventsRequestSchema,
  FunnelReportSchema,
  type FunnelEvent,
} from '@lifeguessr/types';
import { expect, it } from 'vitest';
import { createMemoryEventStore } from './events.memory';
import { lastDays } from './events';
const ev = (event: FunnelEvent) => ({ ...event, id: randomUUID() });
it('counts distinct opens and completions, including their intersection', async () => {
  const store = createMemoryEventStore();
  const a = randomUUID(),
    b = randomUUID(),
    c = randomUUID();
  await store.record(a, [
    ev({ name: 'tool_opened', props: { tool: 'subscriptions' } }),
    ev({ name: 'tool_opened', props: { tool: 'subscriptions' } }),
    ev({ name: 'subs_revealed', props: { miss: 'over2' } }),
  ]);
  await store.record(b, [
    ev({ name: 'tool_opened', props: { tool: 'subscriptions' } }),
  ]);
  await store.record(c, [
    ev({ name: 'subs_revealed', props: { miss: 'under0.5' } }),
    ev({ name: 'tool_opened', props: { tool: 'payoff' } }),
  ]);
  const report = await store.funnel(lastDays(1));
  expect(report.tools).toEqual({
    opened: { subscriptions: 2, overpaying: 0, payoff: 1 },
    completed: { subscriptions: 2, overpaying: 0, payoff: 0 },
    rates: { subscriptions: 0.5, overpaying: null, payoff: 0 },
  });
  expect(FunnelReportSchema.safeParse(report).success).toBe(true);
  const empty = await createMemoryEventStore().funnel(lastDays(1));
  expect(empty.tools.rates).toEqual({
    subscriptions: null,
    overpaying: null,
    payoff: null,
  });
});
it('accepts new events and refuses amounts or arbitrary strings in props', () => {
  for (const event of [
    { name: 'tool_opened', props: { tool: 'subscriptions' } },
    { name: 'subs_started', props: { path: 'statement' } },
    { name: 'subs_revealed', props: { miss: 'over2' } },
    { name: 'subs_flagged', props: { count: 2 } },
    { name: 'subs_cancel_marked', props: { count: 1 } },
    { name: 'renewals_exported' },
    { name: 'overpaying_checked', props: { lines: 4, above: 2 } },
    { name: 'payoff_planned', props: { method: 'avalanche' } },
  ]) {
    const body = {
      anonId: randomUUID(),
      events: [{ ...event, id: randomUUID() }],
    };
    expect(EventsRequestSchema.safeParse(body).success).toBe(true);
    expect(
      EventsRequestSchema.safeParse({
        ...body,
        events: [{ ...body.events[0], props: { ...event.props, amount: 50 } }],
      }).success,
    ).toBe(false);
  }
  expect(
    EventsRequestSchema.safeParse({
      anonId: randomUUID(),
      events: [
        {
          id: randomUUID(),
          name: 'tool_opened',
          props: { tool: 'private label' },
        },
      ],
    }).success,
  ).toBe(false);
});

it.skipIf(!TEST_STORE_URL)(
  'reports the same per-tool counts in Postgres',
  async () => {
    const harness = testPostgresStore();
    try {
      const store = harness.store.events,
        a = randomUUID(),
        b = randomUUID();
      await store.record(a, [
        ev({ name: 'tool_opened', props: { tool: 'overpaying' } }),
        ev({ name: 'tool_opened', props: { tool: 'overpaying' } }),
        ev({ name: 'overpaying_checked', props: { lines: 4, above: 2 } }),
      ]);
      await store.record(b, [
        ev({ name: 'tool_opened', props: { tool: 'overpaying' } }),
      ]);
      const report = await store.funnel(lastDays(1));
      expect(report.tools.opened.overpaying).toBe(2);
      expect(report.tools.completed.overpaying).toBe(1);
      expect(report.tools.rates.overpaying).toBe(0.5);
    } finally {
      await harness.cleanup();
    }
  },
);
