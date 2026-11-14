import { randomBytes, createHash } from 'node:crypto';
import { findArea } from '@lifeguessr/data/areas';
import { coarsenAvatar, withoutEvents } from '@lifeguessr/engine';
import {
  AvatarPublicSchema,
  AVATAR_MIN_POOL,
  AVATAR_TTL_DAYS,
  type AvatarOwner,
  type AvatarPayload,
  type AvatarPreview,
  type AvatarPublic,
} from '@lifeguessr/types';
import { anonKey } from './anonKey';
import { canonicalJson, type SessionStore } from './sessions';
export type AvatarRow = {
  avatarId: string;
  ownerKey: string;
  payload: AvatarPayload;
  publishedOn: string;
  expiresOn: string;
};
/** Internal persistence boundary. Owner keys never cross the service boundary. */
export interface AvatarRepository {
  upsert(
    row: AvatarRow,
    today: string,
  ): Promise<{ row: AvatarRow; republish: boolean }>;
  remove(ownerKey: string): Promise<boolean>;
  read(
    ownerKey: string,
    today: string,
    expiresOn: string,
  ): Promise<AvatarRow | null>;
  live(today: string): Promise<AvatarRow[]>;
}
export class AvatarError extends Error {
  constructor(
    readonly code:
      | 'no_session'
      | 'no_metro'
      | 'out_of_bounds'
      | 'stale_preview',
    readonly fields: AvatarPreview['outOfBounds'] = [],
  ) {
    super(code);
  }
}
export interface AvatarStore {
  preview(anonId: string): Promise<{ preview: AvatarPreview; token: string }>;
  publish(
    anonId: string,
    today: string,
    token: string,
  ): Promise<AvatarOwner & { republish: boolean }>;
  unpublish(anonId: string): Promise<boolean>;
  status(anonId: string, today: string): Promise<AvatarOwner>;
  poolFor(today: string, excludeOwnerKey?: string): Promise<AvatarPublic[]>;
}
/** Calendar-day expiry, independent of the server timezone and daylight saving time. */
export function avatarExpiresOn(today: string): string {
  const date = new Date(`${today}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(today) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== today
  )
    throw new RangeError('Invalid avatar date');
  date.setUTCDate(date.getUTCDate() + AVATAR_TTL_DAYS);
  return date.toISOString().slice(0, 10);
}
function owner(row: AvatarRow | null): AvatarOwner {
  return row
    ? {
        status: {
          state: 'published',
          publishedOn: row.publishedOn,
          expiresOn: row.expiresOn,
          stamp: row.payload.stamp,
        },
        published: AvatarPublicSchema.parse({
          ...row.payload,
          avatarId: row.avatarId,
        }),
      }
    : { status: { state: 'none' }, published: null };
}
/** Shared domain rules: build on server-held session data, always self-reported until a trustworthy verification source exists. */
export function createAvatarStore(
  repo: AvatarRepository,
  sessions: SessionStore,
): AvatarStore {
  const preview = async (anonId: string) => {
    const { profile } = await sessions.load(anonId);
    if (!profile) throw new AvatarError('no_session');
    // Today's values only: the server never stamps `asOf` or applies life events.
    const result = coarsenAvatar(
      withoutEvents(profile),
      findArea(profile.zip),
      'selfReported',
    );
    return {
      preview: result,
      token: createHash('sha256')
        .update(canonicalJson(result.payload))
        .digest('hex'),
    };
  };
  return {
    preview,
    async publish(anonId, today, token) {
      const expiresOn = avatarExpiresOn(today),
        draft = await preview(anonId);
      if (draft.token !== token) throw new AvatarError('stale_preview');
      const result = draft.preview;
      if (result.outOfBounds.length)
        throw new AvatarError(
          result.outOfBounds.some((v) => v.field === 'metro')
            ? 'no_metro'
            : 'out_of_bounds',
          result.outOfBounds,
        );
      const row: AvatarRow = {
        avatarId: randomBytes(16).toString('base64url'),
        ownerKey: anonKey(anonId),
        payload: result.payload,
        publishedOn: today,
        expiresOn,
      };
      const saved = await repo.upsert(row, today);
      return { ...owner(saved.row), republish: saved.republish };
    },
    unpublish: (anonId) => repo.remove(anonKey(anonId)),
    async status(anonId, today) {
      return owner(
        await repo.read(anonKey(anonId), today, avatarExpiresOn(today)),
      );
    },
    async poolFor(today, excludeOwnerKey) {
      avatarExpiresOn(today);
      const rows = await repo.live(today);
      if (rows.length < AVATAR_MIN_POOL) return [];
      return rows
        .filter((row) => row.ownerKey !== excludeOwnerKey)
        .map((row) =>
          AvatarPublicSchema.parse({ ...row.payload, avatarId: row.avatarId }),
        );
    },
  };
}
