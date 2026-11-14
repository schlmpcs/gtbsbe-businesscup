// Vite/Vitest `?raw` imports (file contents as a string). Tests only: the engine itself never
// reads files. Used to load the sample bank statement fixture without Node's fs.
declare module '*?raw' {
  const content: string;
  export default content;
}
