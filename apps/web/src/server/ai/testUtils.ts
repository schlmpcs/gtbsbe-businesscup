// Test helpers for the /api/ai/* route tests. No real API calls: the tests replace the
// Anthropic SDK module with a class whose messages.create is a vi.fn.
import { rulesBundle } from '@lifeguessr/engine';
import type { Forecast, ProfilePatch, YearAnchor } from '@lifeguessr/types';
import type { ForecastRequest } from './schemas';

/** A Messages API response with a (hidden) thinking block before the text, like Haiku 5.5 sends. */
export function reply(text: string, stopReason: string = 'end_turn') {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-haiku-5-5',
    content: [
      { type: 'thinking', thinking: '', signature: 'sig' },
      { type: 'text', text, citations: null },
    ],
    stop_reason: stopReason,
    stop_sequence: null,
    stop_details: null,
    usage: { input_tokens: 1, output_tokens: 1 },
  };
}

let ipCounter = 0;

/** A POST request to a route; each call gets a fresh IP unless one is given. */
export function postRequest(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Request {
  ipCounter += 1;
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.0.0.${ipCounter % 250}`, ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

// ----- /api/ai/forecast ----------------------------------------------------------------------

/** Two candidate moves on the demo profile, with real effects (about +$8K and +$22K at year 10). */
export const DEMO_SCENARIOS: { id: string; patch: ProfilePatch }[] = [
  { id: 'pay-card', patch: { debts: [{ id: 'card-1', extraPayment: 300 }] } },
  { id: 'cut-eating', patch: { spending: { eatingOut: 200 } } },
];

export type WireForecast = { id: string; anchors: YearAnchor[] };

/** The yearly anchors (end of years 1..10) of a forecast: what the model is asked to return. */
export const anchorsOf = (f: Forecast): YearAnchor[] =>
  Array.from({ length: 10 }, (_, i) => {
    const { low, mid, high } = f.points[(i + 1) * 12]!;
    return { year: i + 1, low, mid, high };
  });

/** What a good model would say: the rules forecast of every id, as yearly anchors, so it passes the checks. */
export function goodAnswer(req: Pick<ForecastRequest, 'profile' | 'scenarios' | 'rates'>): WireForecast[] {
  const rules = rulesBundle(req.profile, req.scenarios, req.rates);
  return [
    { id: 'base', anchors: anchorsOf(rules.base) },
    ...req.scenarios.map((s) => ({ id: s.id, anchors: anchorsOf(rules.scenarios[s.id]!) })),
  ];
}

/** A model response carrying these forecasts as its JSON answer. */
export const forecastReply = (forecasts: WireForecast[]) => reply(JSON.stringify({ forecasts }));

/** A model response with the good answer for the request. */
export const goodReply = (req: Pick<ForecastRequest, 'profile' | 'scenarios' | 'rates'>) => forecastReply(goodAnswer(req));
