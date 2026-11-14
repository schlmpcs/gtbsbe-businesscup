import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source; Next compiles them.
  transpilePackages: ['@lifeguessr/types', '@lifeguessr/engine', '@lifeguessr/data'],
  poweredByHeader: false,
};

export default nextConfig;
