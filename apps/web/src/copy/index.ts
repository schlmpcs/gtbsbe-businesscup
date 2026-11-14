// All user-facing strings, importable as `@/copy`. One file per feature so parallel work doesn't
// collide; add strings to your feature's file, not here.
import { afford } from './afford';
import { ai } from './ai';
import { common } from './common';
import { duel } from './duel';
import { forecast } from './forecast';
import { game } from './game';
import { kitShowcase } from './kitShowcase';
import { ladder } from './ladder';
import { loan } from './loan';
import { mocks } from './mocks';
import { overpaying } from './overpaying';
import { pro } from './pro';
import { renewals } from './renewals';
import { subscriptions } from './subscriptions';
import { tools } from './tools';
import { upload } from './upload';

export { afford, ai, common, duel, forecast, game, kitShowcase, ladder, loan, mocks, overpaying, pro, renewals, subscriptions, tools, upload };

export const copy = {
  common, game, duel, ladder, forecast, afford, loan, upload, mocks, overpaying, pro, tools, ai, kitShowcase, renewals, subscriptions,
} as const;

/** Every screen title by screen ID (S1–S15, S21, S23), merged from the feature files. */
export const screenTitles = {
  ...forecast.screens,
  ...game.screens,
  ...ladder.screens,
  ...upload.screens,
  ...afford.screens,
  ...loan.screens,
  ...mocks.screens,
  ...subscriptions.screens,
  ...overpaying.screens,
} as const;

export type ScreenId = keyof typeof screenTitles;
export { goal } from './goal';
export { avatar } from './avatar';
export { yearsPhrase } from './ai';
export { lifeEvents } from './lifeEvents';
export { cushion } from './cushion';
export { workTime } from './workTime';
export { spend, type SpendPresetId } from './spend';
export { bills } from './bills';
