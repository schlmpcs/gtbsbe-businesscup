// Re-export only: the sample life cards (packages/data/fixtures/cards.ts). Not part of '@/fixtures',
// so the game's fixture answers stay out of every browser chunk that doesn't ask for them; the
// ESLint rule in eslint.config.mjs lists the browser modules that may.
export * from '@lifeguessr/data/fixtures/cards';
