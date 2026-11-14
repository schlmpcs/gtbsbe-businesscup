// @vitest-environment jsdom
import { TOGETHER_TTL_DAYS, type TogetherPartner } from '@lifeguessr/types';
import { beforeEach, describe, expect, it } from 'vitest';
import { togetherPartnerSample } from '@/fixtures';
import { createFixtureTogetherClient, decodePlanHash, encodePlan, rememberRole, roleIn } from './client';

const partner = (nickname?: string): TogetherPartner => ({ ...(structuredClone(togetherPartnerSample) as TogetherPartner), nickname });
const NOW = Date.parse('2026-11-14T12:00:00Z');

beforeEach(() => localStorage.clear());

describe('fixture together client', () => {
  it('creates a plan with a random 22-character id that expires after the TTL', async () => {
    const client = createFixtureTogetherClient(() => NOW);
    const plan = await client.create(partner('Jo'), null);
    expect(plan.id).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(Date.parse(plan.expiresAt) - NOW).toBe(TOGETHER_TTL_DAYS * 86_400_000);
    expect((await client.create(partner(), null)).id).not.toBe(plan.id);
  });

  it('carries the plan in the link fragment, so another browser can open it', async () => {
    const mine = createFixtureTogetherClient(() => NOW);
    const plan = await mine.create(partner('Zoë'), { target: 30_000, years: 3 });
    const path = mine.sharePath(plan);
    expect(path.startsWith(`/together/${plan.id}#plan=`)).toBe(true);
    const hash = path.slice(path.indexOf('#'));
    expect(decodePlanHash(hash, plan.id)).toEqual(plan);
    expect(decodePlanHash(hash, 'BBBBBBBBBBBBBBBBBBBBBB')).toBeNull();
    expect(decodePlanHash('#plan=not-base64!', plan.id)).toBeNull();

    localStorage.clear(); // the partner's browser
    const theirs = createFixtureTogetherClient(() => NOW);
    const opened = await theirs.load(plan.id, hash);
    expect(opened).toEqual(plan);
    const both = await theirs.setPartner2(opened!, partner('Alex'), undefined);
    expect(both.partner2?.nickname).toBe('Alex');
    expect(both.goal).toEqual({ target: 30_000, years: 3 });
    // A reload with the old link keeps partner 2 from this browser.
    expect((await theirs.load(plan.id, hash))?.partner2?.nickname).toBe('Alex');
    expect(decodePlanHash(`#plan=${encodePlan(both)}`, plan.id)).toEqual(both);
  });

  it('answers null for an expired or unknown plan', async () => {
    const client = createFixtureTogetherClient(() => NOW);
    const plan = await client.create(partner(), null);
    const later = createFixtureTogetherClient(() => NOW + TOGETHER_TTL_DAYS * 86_400_000);
    expect(await later.load(plan.id, '')).toBeNull();
    expect(await client.load('CCCCCCCCCCCCCCCCCCCCCC', '')).toBeNull();
  });

  it('remembers which partner this browser is', () => {
    expect(roleIn('x')).toBe('partner2');
    rememberRole('x', 'partner1');
    expect(roleIn('x')).toBe('partner1');
    localStorage.setItem('lifeguessr.together.roles', 'not json');
    expect(roleIn('x')).toBe('partner2');
  });
});
