// All user-facing strings, importable as `@/copy`. One file per feature so parallel work doesn't
// collide; add strings to your feature's file, not here.
import { afford } from './afford';
import { common } from './common';
import { forecast } from './forecast';
import { game } from './game';
import { ladder } from './ladder';
import { loan } from './loan';
import { mocks } from './mocks';
import { upload } from './upload';

export { afford, common, forecast, game, ladder, loan, mocks, upload };

export const copy = { common, game, ladder, forecast, afford, loan, upload, mocks } as const;

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
