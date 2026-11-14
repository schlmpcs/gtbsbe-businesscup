import { game as t } from '@/copy';
import type { VMError } from '../model/types';

/** The sentence shown for a view-model error. */
export function errorText(error: VMError): string {
  return t.errors.byKind[error.kind];
}
