import { expect, it } from 'vitest';
import { FUNNEL_EVENT_NAMES } from '@lifeguessr/types';
import { buildFunnelReport, eventBit, maskOf } from './events';
it('keeps events above bit 31 distinct and preserves the whole funnel', () => {
  expect(FUNNEL_EVENT_NAMES.length).toBeGreaterThan(32);
  expect(new Set(FUNNEL_EVENT_NAMES.map(eventBit)).size).toBe(
    FUNNEL_EVENT_NAMES.length,
  );
  const last = FUNNEL_EVENT_NAMES.at(-1)!;
  const report = buildFunnelReport(
    { from: new Date('2026-01-01'), to: new Date('2026-01-02') },
    [{ mask: maskOf(['play_started', last, last]), users: 1 }],
    { guesses: 0, cluesOpened: 0, blind: 0 },
  );
  expect(report.events.play_started).toBe(1);
  expect(report.events[last]).toBe(1);
  expect(report.events.home_guessed).toBe(0);
});
