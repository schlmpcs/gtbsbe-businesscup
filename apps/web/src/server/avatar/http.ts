import { z } from 'zod';
import {
  AnonIdSchema,
  AvatarOwnerResponseSchema,
  AvatarPreviewResponseSchema,
} from '@lifeguessr/types';
import { json, readJsonBody } from '@/server/ai/http';
import { clientIp, readAnonIdHeader } from '@/server/game/http';
import { playDate } from '@/server/game/daily';
import { createRateLimiter } from '@/server/rateLimit';
import { getStore } from '@/server/store';
import { AvatarError } from '@/server/store/avatars';
import { storeErrorResponse } from '@/server/store/http';
import { recordServerEvent } from '@/server/events/http';
export const avatarRateLimiter = createRateLimiter();
const BODY_BYTES = 2048;
const HOUR_MS = 3_600_000;
const LIMITS = {
  publish: { anon: 5, ip: 20 },
  preview: { anon: 60, ip: 120 },
  status: { anon: 60, ip: 120 },
} as const;
/** Server-side flag; removal works even after publishing is disabled. */
export const avatarsEnabled = () => process.env.AVATARS_ENABLED === 'true';
const error = (status: number, code: string, fields?: unknown) =>
  json(
    { ok: false, error: { code, ...(fields !== undefined ? { fields } : {}) } },
    status,
  );
export type AvatarAction = 'publish' | 'preview' | 'status' | 'unpublish';
export async function avatarRequest(
  req: Request,
  action: AvatarAction,
): Promise<Response> {
  if ((action === 'publish' || action === 'preview') && !avatarsEnabled())
    return error(404, 'disabled');
  const header = readAnonIdHeader(req);
  if ('response' in header) return header.response;
  const schema =
    action === 'publish'
      ? z.strictObject({
          anonId: AnonIdSchema,
          consent: z.literal(true),
          previewToken: z.string().regex(/^[0-9a-f]{64}$/),
        })
      : z.strictObject({ anonId: AnonIdSchema.optional() });
  // DELETE supports an empty body and header auth, so privacy removal stays a single request.
  const body =
    action === 'unpublish' && !req.headers.get('content-type')
      ? { data: { anonId: header.anonId ?? undefined } }
      : await readJsonBody(req, schema, BODY_BYTES);
  if ('response' in body) return body.response;
  const anonId = body.data.anonId ?? header.anonId;
  if (!anonId || (header.anonId && header.anonId !== anonId))
    return error(400, 'bad_request');
  if (action !== 'unpublish') {
    const limit = LIMITS[action];
    const result = avatarRateLimiter.check([
      {
        key: `${action}:anon:${anonId}`,
        rule: { limit: limit.anon, windowMs: HOUR_MS },
      },
      {
        key: `${action}:ip:${clientIp(req)}`,
        rule: { limit: limit.ip, windowMs: HOUR_MS },
      },
    ]);
    if (!result.ok)
      return json({ ok: false, error: { code: 'rate_limited' } }, 429, {
        'Retry-After': String(result.retryAfterSeconds),
      });
  }
  try {
    const { avatars } = getStore(),
      today = playDate();
    if (action === 'preview')
      return json(
        AvatarPreviewResponseSchema.parse({
          ok: true,
          ...(await avatars.preview(anonId)),
        }),
      );
    if (action === 'unpublish') {
      const removed = await avatars.unpublish(anonId);
      if (removed)
        await recordServerEvent(anonId, { name: 'avatar_unpublished' });
      return json(
        AvatarOwnerResponseSchema.parse({
          ok: true,
          status: { state: 'none' },
          published: null,
        }),
      );
    }
    if (action === 'publish') {
      const { republish, ...owner } = await avatars.publish(
        anonId,
        today,
        'previewToken' in body.data ? String(body.data.previewToken) : '',
      );
      if (owner.status.state === 'published')
        await recordServerEvent(anonId, {
          name: 'avatar_published',
          props: { stamp: owner.status.stamp, republish },
        });
      return json(AvatarOwnerResponseSchema.parse({ ok: true, ...owner }));
    }
    return json(
      AvatarOwnerResponseSchema.parse({
        ok: true,
        ...(await avatars.status(anonId, today)),
      }),
    );
  } catch (err) {
    if (err instanceof AvatarError)
      return error(
        err.code === 'no_session' || err.code === 'stale_preview' ? 409 : 422,
        err.code,
        err.fields,
      );
    return storeErrorResponse(err, 'avatar');
  }
}
