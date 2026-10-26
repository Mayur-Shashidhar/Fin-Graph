import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['@electric-sql/pglite'],
  outputFileTracingExcludes: { '/*': ['./.data/**/*', './.env*'] },
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
