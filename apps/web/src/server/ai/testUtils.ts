// Test helpers for the /api/ai/* route tests. No real API calls: the tests replace the
// Anthropic SDK module with a class whose messages.create is a vi.fn.

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
