import type { AvatarRepository, AvatarRow } from './avatars';
/** Atomic synchronous updates between awaits, with copies at the persistence boundary. */
export function createMemoryAvatarRepository(): AvatarRepository {
  const rows = new Map<string, AvatarRow>();
  const purge = (today: string) => {
    for (const [key, row] of rows) if (row.expiresOn < today) rows.delete(key);
  };
  return {
    async upsert(row, today) {
      purge(today);
      const saved = rows.get(row.ownerKey);
      const next = saved
        ? { ...row, avatarId: saved.avatarId, publishedOn: saved.publishedOn }
        : row;
      rows.set(row.ownerKey, structuredClone(next));
      return { row: structuredClone(next), republish: !!saved };
    },
    async remove(key) {
      return rows.delete(key);
    },
    async read(key, today, expiresOn) {
      purge(today);
      const row = rows.get(key);
      if (!row) return null;
      row.expiresOn = expiresOn;
      return structuredClone(row);
    },
    async live(today) {
      return [...rows.values()]
        .filter((row) => row.expiresOn >= today)
        .map((row) => structuredClone(row));
    },
  };
}
