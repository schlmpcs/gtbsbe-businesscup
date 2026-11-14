import type { AvatarPayload } from '@lifeguessr/types';
import type { AvatarRepository, AvatarRow } from './avatars';
import type { Db } from './postgres';
type Row = {
  avatar_id: string;
  owner_key: string;
  payload: AvatarPayload;
  published_on: string;
  expires_on: string;
};
const columns =
  'avatar_id, owner_key, payload, published_on::text, expires_on::text';
const decode = (row: Row): AvatarRow => ({
  avatarId: row.avatar_id,
  ownerKey: row.owner_key,
  payload: row.payload,
  publishedOn: row.published_on,
  expiresOn: row.expires_on,
});
/** Atomic upsert keeps public IDs stable across republishes; expiry sweep shares its transaction. */
export function createPostgresAvatarRepository(db: Db): AvatarRepository {
  return {
    upsert: async (row, today) =>
      db.transaction(async (tx) => {
        await tx.query('DELETE FROM avatars WHERE expires_on < $1::date', [
          today,
        ]);
        const result = await tx.query<Row>(
          `INSERT INTO avatars (avatar_id,owner_key,payload,stamp,published_on,expires_on)
    VALUES ($1,$2,$3::jsonb,$4,$5::date,$6::date) ON CONFLICT (owner_key) DO UPDATE SET
    payload=excluded.payload,stamp=excluded.stamp,expires_on=excluded.expires_on,updated_at=now() RETURNING ${columns}`,
          [
            row.avatarId,
            row.ownerKey,
            JSON.stringify(row.payload),
            row.payload.stamp,
            row.publishedOn,
            row.expiresOn,
          ],
        );
        const saved = decode(result.rows[0]!);
        return { row: saved, republish: saved.avatarId !== row.avatarId };
      }),
    async remove(key) {
      const result = await db.query('DELETE FROM avatars WHERE owner_key=$1', [
        key,
      ]);
      return !!result.rowCount;
    },
    read: async (key, today, expiresOn) =>
      db.transaction(async (tx) => {
        await tx.query('DELETE FROM avatars WHERE expires_on < $1::date', [
          today,
        ]);
        const result = await tx.query<Row>(
          `UPDATE avatars SET expires_on=$2::date,updated_at=now() WHERE owner_key=$1 RETURNING ${columns}`,
          [key, expiresOn],
        );
        return result.rows[0] ? decode(result.rows[0]) : null;
      }),
    async live(today) {
      const result = await db.query<Row>(
        `SELECT ${columns} FROM avatars WHERE expires_on >= $1::date ORDER BY avatar_id`,
        [today],
      );
      return result.rows.map(decode);
    },
  };
}
