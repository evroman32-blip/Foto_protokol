import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@mandarin/contracts', 'three'],
  reactStrictMode: true,
};

export default nextConfig;
