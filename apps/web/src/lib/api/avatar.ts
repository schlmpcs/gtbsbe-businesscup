import {
  AvatarOwnerResponseSchema,
  AvatarPreviewResponseSchema,
} from '@lifeguessr/types';
import { postJson, ApiError } from './http';
/** Owner-only calls carry the anonymous ID in headers/body, never in URLs. */
export const avatarStatus = (anonId: string) =>
  postJson('/api/avatar/status', { anonId }, AvatarOwnerResponseSchema, {
    anonId,
  });
export const avatarPreview = (anonId: string) =>
  postJson('/api/avatar/preview', { anonId }, AvatarPreviewResponseSchema, {
    anonId,
  });
export const avatarPublish = (anonId: string, previewToken: string) =>
  postJson(
    '/api/avatar',
    { anonId, consent: true, previewToken },
    AvatarOwnerResponseSchema,
    { anonId },
  );
export async function avatarUnpublish(anonId: string) {
  const response = await fetch('/api/avatar', {
    method: 'DELETE',
    headers: { 'x-anon-id': anonId },
  });
  if (!response.ok)
    throw new ApiError('Could not unpublish avatar', response.status);
  return AvatarOwnerResponseSchema.parse(await response.json());
}
