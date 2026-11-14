import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

// Only the Docker build (deploy/Dockerfile) sets this. A standalone build writes a self-contained
// server to `.next/standalone`, and `next start` does not work on it, so dev, CI and e2e keep the
// normal build.
const standalone = process.env.BUILD_STANDALONE === '1';

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source; Next compiles them.
  transpilePackages: ['@lifeguessr/types', '@lifeguessr/engine', '@lifeguessr/data'],
  poweredByHeader: false,
  ...(standalone && {
    output: 'standalone' as const,
    // The workspace packages and the pnpm store sit above apps/web, so file tracing starts at the
    // repo root. The server then lands at `.next/standalone/apps/web/server.js`.
    outputFileTracingRoot: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'),
    // The share card reads its brand font at run time (src/server/game/shareCard.tsx FONT_DIR);
    // a file read by path is not traced on its own. Without it the card falls back to the
    // default font.
    outputFileTracingIncludes: {
      '/api/share': ['./node_modules/@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-{400,800}-normal.woff'],
    },
  }),
};

export default nextConfig;
