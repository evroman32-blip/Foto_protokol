import type { NextConfig } from 'next';

function apiOrigin(): string {
  const raw = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001')
    .replace(/[\u0000-\u001F]+/g, '')
    .trim()
    .replace(/\/+$/, '');
  try {
    const url = new URL(raw);
    if (url.hostname === 'localhost') url.hostname = '127.0.0.1';
    return url.origin;
  } catch {
    return 'http://127.0.0.1:3001';
  }
}

const nextConfig: NextConfig = {
  transpilePackages: ['@mandarin/contracts', 'three'],
  reactStrictMode: false,
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    middlewareClientMaxBodySize: '200mb',
    proxyTimeout: 300_000,
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiOrigin()}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
