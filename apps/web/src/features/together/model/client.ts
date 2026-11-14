// Where shared plans live, behind one interface:
// - 'api': the server (/api/together). The link is /together/<id>; the plan lives 30 days.
// - 'fixtures': this browser. The plan is kept in localStorage and carried in the share link's
//   #fragment (/together/<id>#plan=…), which browsers never send to a server, so a demo without a
//   database still works across two phones. After partner 2 adds their numbers, their link carries
//   both partners.
// Either way this browser remembers which partner it is in each plan (localStorage), and nothing
// else: no names, no anonymous id in the plan.
import {
  TOGETHER_TTL_DAYS, TogetherPlanSchema, TogetherResponseSchema,
  type Goal, type TogetherPartner, type TogetherPlan,
} from '@lifeguessr/types';
import { getJson, postJson, putJson } from '@/lib/api/http';
import { togetherSource, type TogetherSource } from '@/lib/config';
import { readStorage, writeStorage } from '@/lib/safeStorage';
import type { TogetherRole } from './types';

export interface TogetherClient {
  readonly source: TogetherSource;
  create(partner: TogetherPartner, goal: Goal | null): Promise<TogetherPlan>;
  /** The plan, or null when it does not exist or expired. `hash` is location.hash (fixture links). */
  load(id: string, hash: string): Promise<TogetherPlan | null>;
  setPartner2(plan: TogetherPlan, partner: TogetherPartner, goal: Goal | null | undefined): Promise<TogetherPlan>;
  /** The path to share (origin not included). */
  sharePath(plan: TogetherPlan): string;
}

const ROLES_KEY = 'lifeguessr.together.roles';
const PLAN_KEY = (id: string) => `lifeguessr.together.plan.${id}`;
const HASH_PREFIX = '#plan=';

export function roleIn(id: string): TogetherRole {
  return readRoles()[id] === 'partner1' ? 'partner1' : 'partner2';
}

function readRoles(): Record<string, unknown> {
  try {
    const roles: unknown = JSON.parse(readStorage(ROLES_KEY) ?? '{}');
    return roles && typeof roles === 'object' ? (roles as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function rememberRole(id: string, role: TogetherRole): void {
  const roles = readRoles();
  writeStorage(ROLES_KEY, JSON.stringify({ ...roles, [id]: role }));
}

// ----- fixture mode: the plan in the link --------------------------------------------------------

const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');

const fromBase64Url = (text: string) =>
  Uint8Array.from(atob(text.replaceAll('-', '+').replaceAll('_', '/')), (c) => c.charCodeAt(0));

export function encodePlan(plan: TogetherPlan): string {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(plan)));
}

/** The plan in a #plan=… fragment, if it is one and matches `id`; null otherwise. */
export function decodePlanHash(hash: string, id: string): TogetherPlan | null {
  if (!hash.startsWith(HASH_PREFIX)) return null;
  try {
    const parsed = TogetherPlanSchema.safeParse(JSON.parse(new TextDecoder().decode(fromBase64Url(hash.slice(HASH_PREFIX.length)))));
    return parsed.success && parsed.data.id === id ? parsed.data : null;
  } catch {
    return null;
  }
}

function newLocalId(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(16)));
}

const live = (plan: TogetherPlan | null, now: number) => (plan && Date.parse(plan.expiresAt) > now ? plan : null);

export function createFixtureTogetherClient(now: () => number = Date.now): TogetherClient {
  const save = (plan: TogetherPlan) => writeStorage(PLAN_KEY(plan.id), JSON.stringify(plan));
  const stored = (id: string): TogetherPlan | null => {
    try {
      const parsed = TogetherPlanSchema.safeParse(JSON.parse(readStorage(PLAN_KEY(id)) ?? 'null'));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  };
  return {
    source: 'fixtures',
    async create(partner, goal) {
      const created = new Date(now());
      const plan: TogetherPlan = {
        id: newLocalId(),
        partner1: TogetherPlanSchema.shape.partner1.parse(partner),
        partner2: null,
        goal,
        createdAt: created.toISOString(),
        expiresAt: new Date(created.getTime() + TOGETHER_TTL_DAYS * 86_400_000).toISOString(),
      };
      save(plan);
      return plan;
    },
    async load(id, hash) {
      const fromLink = live(decodePlanHash(hash, id), now());
      const fromHere = live(stored(id), now());
      // The link is the newest copy, unless this browser already holds partner 2 and the link does not.
      const plan = fromLink && !(fromHere?.partner2 && !fromLink.partner2) ? fromLink : fromHere;
      if (plan) save(plan);
      return plan;
    },
    async setPartner2(plan, partner, goal) {
      const next: TogetherPlan = {
        ...plan,
        partner2: TogetherPlanSchema.shape.partner1.parse(partner),
        goal: goal === undefined ? plan.goal : goal,
      };
      save(next);
      return next;
    },
    sharePath: (plan) => `/together/${plan.id}${HASH_PREFIX}${encodePlan(plan)}`,
  };
}

// ----- api mode ----------------------------------------------------------------------------------

export function createHttpTogetherClient(base = '/api/together'): TogetherClient {
  return {
    source: 'api',
    async create(partner, goal) {
      return (await postJson(base, { partner, goal }, TogetherResponseSchema)).plan;
    },
    async load(id) {
      try {
        return (await getJson(`${base}/${encodeURIComponent(id)}`, TogetherResponseSchema)).plan;
      } catch (err) {
        if ((err as { status?: number }).status === 404) return null;
        throw err;
      }
    },
    async setPartner2(plan, partner, goal) {
      const body = goal === undefined ? { partner } : { partner, goal };
      return (await putJson(`${base}/${encodeURIComponent(plan.id)}/partner`, body, TogetherResponseSchema)).plan;
    },
    sharePath: (plan) => `/together/${plan.id}`,
  };
}

export function createTogetherClient(source: TogetherSource = togetherSource()): TogetherClient {
  return source === 'api' ? createHttpTogetherClient() : createFixtureTogetherClient();
}
