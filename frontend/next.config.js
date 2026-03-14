/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Proxy backend API calls through Next.js server to inject API key
  async rewrites() {
    return [
      {
        source:      "/api/backend/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/:path*`,
      },
    ];
  },
  async headers() {
    return [];
  },
};

module.exports = nextConfig;
