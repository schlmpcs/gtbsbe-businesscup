// The anonymous id: crypto.randomUUID() kept in localStorage. It keys the saved profile, so it is
// sent only in a request header or body, never in a URL (share links use a separate resultId).
import { readStorage, writeStorage } from '@/lib/safeStorage';

export const ANON_ID_KEY = 'lifeguessr.anonId';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Id for this tab when storage is blocked, so one visit still has a stable id. */
let memoryId: string | null = null;

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // Very old browsers only: RFC 4122 v4 from getRandomValues.
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** This browser's anonymous id, created on first use. Browser only. */
export function getAnonId(): string {
  const stored = readStorage(ANON_ID_KEY);
  if (stored && UUID.test(stored)) return stored;
  const id = memoryId ?? newId();
  memoryId = id;
  writeStorage(ANON_ID_KEY, id);
  return id;
}
