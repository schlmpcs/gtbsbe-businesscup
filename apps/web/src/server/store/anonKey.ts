import { createHash } from 'node:crypto';

/**
 * The key every store table uses for an anonymous id: sha256(anonId) in hex. The raw id works like
 * a password for the saved profile (whoever has it can load it), so no table holds it; a leaked
 * database row cannot be turned back into a working id. Same hash as the Pro file store used.
 */
export function anonKey(anonId: string): string {
  return createHash('sha256').update(anonId).digest('hex');
}
