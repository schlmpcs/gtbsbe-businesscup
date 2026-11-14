// Pure, with no server-only imports: the server's cache key (server/ai/forecastCache.ts) and the
// client's request key (features/forecast/model/forecastAnswer.ts) both come from it, so the two
// sides agree on what "the same data" means.

/** `JSON.stringify` of `value` with sorted object keys; `undefined` for what JSON has no text for. */
function encode(value: unknown): string | undefined {
  if (Array.isArray(value)) return `[${value.map((v) => encode(v) ?? 'null').join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    const members: string[] = [];
    for (const key of Object.keys(object).sort()) {
      const member = encode(object[key]);
      if (member !== undefined) members.push(`${JSON.stringify(key)}:${member}`);
    }
    return `{${members.join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * JSON with the keys of every object sorted, so the text depends on the data and not on the order
 * the keys were written in. Arrays keep their order. As in `JSON.stringify`, an `undefined` member
 * is left out (so an absent field and an `undefined` one read the same) and an `undefined` array
 * item is `null`. A bare `undefined`, which has no JSON text, reads as `null`.
 */
export function canonicalJson(value: unknown): string {
  return encode(value) ?? 'null';
}
