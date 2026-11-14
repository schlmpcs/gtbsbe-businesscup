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
import { pro } from './pro';
import { upload } from './upload';

export { afford, ai, common, duel, forecast, game, kitShowcase, ladder, loan, mocks, pro, upload };

export const copy = { common, game, duel, ladder, forecast, afford, loan, upload, mocks, pro, ai, kitShowcase } as const;

/** Every screen title by screen ID (S1–S15), merged from the feature files. */
export const screenTitles = {
  ...forecast.screens,
  ...game.screens,
  ...ladder.screens,
  ...upload.screens,
  ...afford.screens,
  ...loan.screens,
  ...mocks.screens,
} as const;

export type ScreenId = keyof typeof screenTitles;
export { goal } from './goal';
export { avatar } from './avatar';
