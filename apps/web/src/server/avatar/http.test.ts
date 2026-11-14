import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cloneProfileDemo } from '@lifeguessr/data/fixtures';
import { createMemoryStore, setStoreForTests } from '@/server/store';
import { avatarRequest, avatarRateLimiter, type AvatarAction } from './http';
const store = createMemoryStore();
const request = (action: AvatarAction, body: unknown, id?: string) =>
  avatarRequest(
    new Request('http://localhost/api/avatar', {
      method: action === 'unpublish' ? 'DELETE' : 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': randomUUID(),
        ...(id && { 'x-anon-id': id }),
      },
      body: JSON.stringify(body),
    }),
    action,
  );
beforeEach(() => {
  setStoreForTests(store);
  avatarRateLimiter.reset();
  vi.stubEnv('AVATARS_ENABLED', 'true');
});
afterEach(() => {
  setStoreForTests(null);
  vi.unstubAllEnvs();
});
const seed = async () => {
  const id = randomUUID();
  await store.sessions.save(
    id,
    { profile: cloneProfileDemo() },
    { mayAddToWishlist: false },
  );
  return id;
};
it('requires literal consent, server data, matching auth and a fresh preview revision', async () => {
  const id = await seed(),
    draft = await (await request('preview', { anonId: id }, id)).json();
  for (const body of [
    { anonId: id },
    { anonId: id, consent: false, previewToken: draft.token },
    {
      anonId: id,
      consent: true,
      previewToken: draft.token,
      stamp: 'statementVerified',
    },
    { anonId: id, consent: true, previewToken: draft.token, netWorth: 1000 },
  ])
    expect((await request('publish', body, id)).status).toBe(400);
  expect(
    (
      await request(
        'publish',
        { anonId: id, consent: true, previewToken: draft.token },
        randomUUID(),
      )
    ).status,
  ).toBe(400);
  const response = await request(
    'publish',
    { anonId: id, consent: true, previewToken: draft.token },
    id,
  );
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.published.stamp).toBe('selfReported');
  expect(JSON.stringify(body)).not.toMatch(/owner_key|ownerKey|zip|county/);
  expect((await request('preview', { anonId: randomUUID() })).status).toBe(409);
});
it('limits publishing but never limits or flag-gates deletion', async () => {
  const id = await seed(),
    draft = await (await request('preview', { anonId: id })).json();
  for (let i = 0; i < 5; i++)
    expect(
      (
        await request('publish', {
          anonId: id,
          consent: true,
          previewToken: draft.token,
        })
      ).status,
    ).toBe(200);
  expect(
    (
      await request('publish', {
        anonId: id,
        consent: true,
        previewToken: draft.token,
      })
    ).status,
  ).toBe(429);
  vi.stubEnv('AVATARS_ENABLED', 'false');
  expect((await request('preview', { anonId: id })).status).toBe(404);
  for (let i = 0; i < 10; i++)
    expect((await request('unpublish', { anonId: id })).status).toBe(200);
  expect((await request('status', { anonId: id })).status).toBe(200);
});
it('records server-side publication events without financial or identifying props', async () => {
  const id = await seed(),
    draft = await (await request('preview', { anonId: id })).json();
  await request('publish', {
    anonId: id,
    consent: true,
    previewToken: draft.token,
  });
  await request('unpublish', { anonId: id });
  const report = await store.events.funnel({
    from: new Date(Date.now() - 60000),
    to: new Date(Date.now() + 1000),
  });
  expect(report.events.avatar_published).toBeGreaterThanOrEqual(1);
  expect(report.events.avatar_unpublished).toBeGreaterThanOrEqual(1);
  expect(report.events.play_started).toBe(0);
});
