/**
 * Next.js configuration untuk AGROWTH frontend.
 *
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,

  // Backend API base URL — di-pass ke client lewat NEXT_PUBLIC_API_URL.
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
  },

  // Lewat-call ke backend FastAPI saat dev tanpa CORS preflight (opsional).
  async rewrites() {
    const target = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    return [
      {
        source: "/api/backend/:path*",
        destination: `${target}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
