import { readStorage, writeStorage, removeStorage } from '@/lib/safeStorage';
const KEY = 'lifeguessr.avatar.published';
/** A discovery hint only; the server is always authoritative about published state. */
export const hasPublishedAvatarHint = () => readStorage(KEY) === 'true';
export function rememberAvatarPublished(published: boolean): void {
  if (published) writeStorage(KEY, 'true');
  else removeStorage(KEY);
}
