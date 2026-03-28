import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@repo/shared'],
  images: {
    // Домены аватарок OAuth-провайдеров — нужны для <Image> из next/image
    remotePatterns: [
      { hostname: 'avatars.githubusercontent.com' }, // GitHub
      { hostname: 'lh3.googleusercontent.com' }, // Google
      { hostname: 'avatars.yandex.net' }, // Яндекс
    ],
  },
};

export default nextConfig;
