// Test helper: a `fetch` that answers the game routes (T5, and the duel's DU3–DU5 and DU8) with their real
// handlers in-process, so the browser's API game and duel clients can be tested end to end against
// the server code without a running Next.js. Every other URL is a 404, like a route that does not exist.
import { GET as getDaily } from '../../app/api/daily/route';
import { GET as getChallenge } from '../../app/api/daily/challenge/route';
import { POST as postClue } from '../../app/api/daily/clue/route';
import { POST as postGuess } from '../../app/api/daily/guess/route';
import { POST as postHint } from '../../app/api/daily/hint/route';
import { POST as postPick } from '../../app/api/daily/pick/route';
import { GET as getLeaderboard } from '../../app/api/leaderboard/route';
import { GET as getShare } from '../../app/api/share/route';

type Handler = (req: Request) => Promise<Response>;

const ROUTES: Record<string, { GET?: Handler; POST?: Handler }> = {
  '/api/daily': { GET: getDaily },
  '/api/daily/challenge': { GET: getChallenge },
  '/api/daily/clue': { POST: postClue },
  '/api/daily/guess': { POST: postGuess },
  '/api/daily/hint': { POST: postHint },
  '/api/daily/pick': { POST: postPick },
  '/api/leaderboard': { GET: getLeaderboard },
  '/api/share': { GET: getShare },
};

/** Every request made through it, for assertions (method, path, x-anon-id, JSON body). */
export type RouteCall = { method: string; path: string; anonId: string | null; body: unknown };

export function createRouteFetch(): { fetch: typeof fetch; calls: RouteCall[] } {
  const calls: RouteCall[] = [];
  const routeFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const req = new Request(new URL(String(input), 'http://localhost'), init);
    const { pathname } = new URL(req.url);
    const text = req.method === 'POST' ? await req.clone().text() : '';
    calls.push({ method: req.method, path: pathname, anonId: req.headers.get('x-anon-id'), body: text ? JSON.parse(text) : null });
    const handler = ROUTES[pathname]?.[req.method as 'GET' | 'POST'];
    return handler ? handler(req) : new Response('not found', { status: 404 });
  };
  return { fetch: routeFetch as typeof fetch, calls };
}
