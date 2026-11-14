export async function api<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const error = await response.json();
      message = error.error?.message || error.error || message;
    } catch {}
    throw new Error(String(message));
  }
  return response.json();
}

// Calculation requests/responses track the generated OpenAPI contract.
import type { paths } from "./generated-api";
type Calculation =
  "forecast" | "moves" | "afford" | "loans" | "month" | "apply-move" | "refine";
type Operation<K extends Calculation> = paths[`/api/calculate/${K}`]["post"];
type Input<K extends Calculation> =
  Operation<K>["requestBody"]["content"]["application/json"];
type Output<K extends Calculation> =
  Operation<K>["responses"][200]["content"]["application/json"];
export function calculate<K extends Calculation>(
  name: K,
  body: Input<K>,
  signal?: AbortSignal,
): Promise<Output<K>> {
  return api<Output<K>>(`calculate/${name}`, body, signal);
}
