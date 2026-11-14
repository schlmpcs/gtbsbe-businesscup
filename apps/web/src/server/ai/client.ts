// Server-only: the one LLM client (docs/ARCHITECTURE.md → Default stack). Never import this from
// client components; the key is read from the server environment.
//
// Data policy: the provider has no per-request "don't retain" flag to set here. Zero data
// retention is an arrangement on the Anthropic organization/workspace that owns
// ANTHROPIC_API_KEY, and the Messages API (the only endpoint we call) is eligible for it. We
// don't use features outside it (no message threads, batches or Files API). Enable it on the
// account; nothing in this code changes when it is on.
//
// Prompt caching: our system prompts are a few hundred tokens, below the minimum cacheable
// prefix, so we don't set cache_control.
import Anthropic from '@anthropic-ai/sdk';

export const DEFAULT_MODEL = 'claude-haiku-5-5';

/** The subset of the SDK client we use; tests replace the SDK module, not this type. */
export type LlmClient = Pick<Anthropic, 'messages'>;

let cached: { key: string; client: LlmClient } | null = null;

/** The configured client, or null when ANTHROPIC_API_KEY is unset (the app must work without it). */
export function getLlmClient(): LlmClient | null {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return null;
  if (cached?.key !== key) {
    cached = {
      key,
      // One SDK-level retry for 429/5xx/connection errors. Our own validation retry is separate.
      client: new Anthropic({ apiKey: key, maxRetries: 1, timeout: 20_000 }),
    };
  }
  return cached.client;
}

export function llmModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
}

/** Prompts and responses are logged in development only (docs/ENGINEERING.md → AI usage rules). */
export function devLog(scope: string, label: string, data: unknown): void {
  if (process.env.NODE_ENV !== 'development') return;
  console.debug(`[${scope}] ${label}`, typeof data === 'string' ? data : JSON.stringify(data, null, 2));
}

/** Concatenated text blocks of a response (thinking blocks may come first, so read by type). */
export function responseText(message: Anthropic.Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();
}
