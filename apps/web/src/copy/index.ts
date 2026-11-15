// All user-facing strings, importable as `@/copy`. One file per feature so parallel work doesn't
// collide; add strings to your feature's file, not here.
import { accounts } from './accounts';
import { afford } from './afford';
import { ai } from './ai';
import { budget } from './budget';
import { cashflow } from './cashflow';
import { common } from './common';
import { dashboard } from './dashboard';
import { duel } from './duel';
import { forecast } from './forecast';
import { game } from './game';
import { goals } from './goals';
import { kitShowcase } from './kitShowcase';
import { ladder } from './ladder';
import { loan } from './loan';
import { mocks } from './mocks';
import { overpaying } from './overpaying';
import { planner } from './planner';
import { pro } from './pro';
import { recurring } from './recurring';
import { renewals } from './renewals';
import { subscriptions } from './subscriptions';
import { tools } from './tools';
import { transactions } from './transactions';
import { upload } from './upload';

export {
  accounts, afford, ai, budget, cashflow, common, dashboard, duel, forecast, game, goals, kitShowcase, ladder, loan, mocks,
  overpaying, planner, pro, recurring, renewals, subscriptions, tools, transactions, upload,
};

export const copy = {
  common, game, duel, ladder, forecast, afford, loan, upload, mocks, overpaying, pro, tools, ai, kitShowcase, renewals, subscriptions,
  planner, dashboard, accounts, transactions, cashflow, budget, recurring, goals,
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
export { together } from './together';
export { plan } from './plan';
export { lifeline } from './lifeline';
export { onboarding } from './onboarding';
