/** @type {import('next').NextConfig} */
const nextConfig = {
  // Optimize image loading to reduce aborted requests
  images: {
    minimumCacheTTL: 60,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    domains: ['localhost','deepnex-fashionex.onrender.com'],
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '5000',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'deepnex-fashionex.onrender.com',
        pathname: '/**',
      },
    ],
    unoptimized: true,
  },
  // Optimize static asset loading
   experimental: {
     optimizeCss: true,
     optimizeServerReact: true,
   },
   // Proxy configuration disabled as we're using direct backend URL
   async rewrites() {
     return [];
   },
};


export default nextConfig;
