// Vite/Vitest `?raw` imports (file contents as a string), for tests: the sample statement CSV can be
// read this way in a jsdom test, where `@lifeguessr/data/fixtures/node` cannot build file paths.
declare module '*?raw' {
  const content: string;
  export default content;
}
