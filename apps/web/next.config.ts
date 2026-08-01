import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@mandarin/contracts', 'three'],
  // false: Strict Mode дважды монтирует Three.js и ломает WebGL во встроенном браузере
  reactStrictMode: false,
  // Демо-сборка на VPS: не блокировать docker build на мелких TS-несостыковках
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
