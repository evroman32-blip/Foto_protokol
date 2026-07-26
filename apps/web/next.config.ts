import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@mandarin/contracts', 'three'],
  // false: Strict Mode дважды монтирует Three.js и ломает WebGL во встроенном браузере
  reactStrictMode: false,
};

export default nextConfig;
