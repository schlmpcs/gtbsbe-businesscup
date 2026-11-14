import { pro as copy } from '@/copy';
import type { PaywallError } from '../model/types';

/** The sentence for a paywall error. */
export function errorText(error: PaywallError): string {
  if (error.key === 'rateLimited' && error.retryAfterSeconds !== null) return copy.errors.rateLimitedFor(error.retryAfterSeconds);
  return copy.errors[error.key];
}
