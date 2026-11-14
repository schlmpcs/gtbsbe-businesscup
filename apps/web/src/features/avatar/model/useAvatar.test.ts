import { coarsenAvatar } from '@lifeguessr/engine';
import { cloneProfileDemo } from '@lifeguessr/data/fixtures';
import { getArea } from '@lifeguessr/data/areas';
import type * as Http from '@/lib/api/http';
// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import fixture from '@lifeguessr/data/fixtures/avatar.sample.json';
import { AvatarOwnerSchema, AvatarPreviewSchema } from '@lifeguessr/types';
import { resetClientState, flush } from '@/test/clientState';
import { useAppStore } from '@/state';
import { useAvatar } from './useAvatar';
import { rememberAvatarPublished } from './cache';
const mocks = vi.hoisted(() => ({
  status: vi.fn(),
  preview: vi.fn(),
  publish: vi.fn(),
  remove: vi.fn(),
  post: vi.fn(),
}));
vi.mock('@/lib/api/avatar', () => ({
  avatarStatus: mocks.status,
  avatarPreview: mocks.preview,
  avatarPublish: mocks.publish,
  avatarUnpublish: mocks.remove,
}));
vi.mock('@/lib/api/http', async (original) => ({
  ...(await original<typeof Http>()),
  postJson: mocks.post,
}));
const preview = AvatarPreviewSchema.parse(fixture.preview),
  published = AvatarOwnerSchema.parse(fixture.published);
beforeEach(() => {
  resetClientState();
  vi.clearAllMocks();
  mocks.status.mockResolvedValue({
    status: { state: 'none' },
    published: null,
  });
  mocks.preview.mockResolvedValue({ preview, token: 'a'.repeat(64) });
  mocks.post.mockResolvedValue({});
  mocks.publish.mockResolvedValue(published);
  mocks.remove.mockResolvedValue({
    status: { state: 'none' },
    published: null,
  });
});
it('requires a fetched preview and new consent, invalidates it on profile edits, then deletes in one call', async () => {
  const { result } = renderHook(() => useAvatar(true));
  await waitFor(() => expect(result.current.owner.status).toBe('ready'));
  expect(result.current.consentChecked).toBe(false);
  expect(result.current.canPublish).toBe(false);
  await act(async () => {
    await result.current.loadPreview();
  });
  act(() => result.current.setConsent(true));
  expect(result.current.canPublish).toBe(true);
  await act(async () => {
    await result.current.publish();
  });
  expect(mocks.publish).toHaveBeenCalledWith(
    expect.any(String),
    'a'.repeat(64),
  );
  expect(result.current.consentChecked).toBe(false);
  act(() =>
    result.current.setFacts({ hasCar: true, kids: 2, householdAdults: 2 }),
  );
  expect(result.current.canPublish).toBe(false);
  expect(useAppStore.getState().profile.household?.kids).toBe(2);
  await act(async () => {
    await result.current.unpublish();
  });
  expect(mocks.remove).toHaveBeenCalledOnce();
});
it('keeps management available when the opt-in flag is off and ignores delayed status after deletion', async () => {
  rememberAvatarPublished(true);
  let resolve!: (value: typeof published) => void;
  mocks.status.mockImplementation(
    () =>
      new Promise<typeof published>((done) => {
        resolve = done;
      }),
  );
  const { result } = renderHook(() => useAvatar(false));
  await waitFor(() => expect(mocks.status).toHaveBeenCalledOnce());
  await act(async () => {
    await result.current.unpublish();
  });
  resolve(published);
  await flush();
  expect(result.current.owner).toMatchObject({
    status: 'ready',
    data: { status: { state: 'none' } },
  });
});
it('rejects unknown keys and malformed public fixture values', () => {
  expect(
    AvatarPreviewSchema.safeParse({ ...fixture.preview, privateName: 'name' })
      .success,
  ).toBe(false);
  expect(
    AvatarOwnerSchema.safeParse({
      ...fixture.published,
      published: { ...fixture.published.published, monthlyCost: -1 },
    }).success,
  ).toBe(false);
});

it('keeps the public preview fixture tied to the canonical demo profile', () => {
  const profile = cloneProfileDemo();
  expect(coarsenAvatar(profile, getArea(profile.zip!), 'selfReported')).toEqual(
    preview,
  );
});
