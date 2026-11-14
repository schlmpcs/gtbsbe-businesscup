// The real engine, data and event senders the overpaying check runs on. The only file that binds the
// model to the app, so the model itself can be tested with fakes (testUtils.ts).
import { areaData, areaForMetro, coveredMetros } from '@lifeguessr/data/areas';
import { overpayingCheck } from '@lifeguessr/engine';
import { areaForZip } from '@/lib/areas';
import { track, trackTool } from '@/lib/events';
import type { OverpayingDeps } from './types';

export const defaultOverpayingDeps: OverpayingDeps = {
  areas: { forZip: areaForZip, zipCount: areaData.length },
  check: overpayingCheck,
  metros: { list: coveredMetros, forMetro: areaForMetro },
  track,
  trackTool,
};
