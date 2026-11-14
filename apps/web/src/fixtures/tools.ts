// Re-export only: the micro-tool fixtures (packages/data/fixtures/tools.ts): the sample statement's
// items and its golden subscription audit. Not part of '@/fixtures', so the barrel in every browser
// chunk stays small.
export * from '@lifeguessr/data/fixtures/tools';
