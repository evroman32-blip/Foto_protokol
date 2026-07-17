import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@mandarin/contracts'],
  reactStrictMode: true,
};

export default nextConfig;
