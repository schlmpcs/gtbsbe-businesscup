// The real engine, data and event sender the overpaying check runs on. The only file that binds the
// model to the app, so the model itself can be tested with fakes (testUtils.ts).
//
// Two entries are not bound yet and the model copes without them (a "not implemented" result, no
// metro picker): `check` (overpayingCheck from @lifeguessr/engine, issue #86) and `metros` (coveredMetros
// and areaForMetro from @lifeguessr/data/areas, issue #86). Bind them here when they are in this branch.
import { areaData } from '@lifeguessr/data/areas';
import { areaForZip } from '@/lib/areas';
import { track } from '@/lib/events';
import type { OverpayingDeps } from './types';

export const defaultOverpayingDeps: OverpayingDeps = {
  areas: { forZip: areaForZip, zipCount: areaData.length },
  track,
};
