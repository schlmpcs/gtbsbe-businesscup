// Re-export only: the fixture duel's cards (packages/data/fixtures/duelCards.ts). Not part of
// '@/fixtures' or '@/fixtures/cards', so a duel API build (NEXT_PUBLIC_DUEL_SOURCE=api) ships none
// of them; the ESLint rule in eslint.config.mjs lets only the fixture duel client import it.
export * from '@lifeguessr/data/fixtures/duelCards';
