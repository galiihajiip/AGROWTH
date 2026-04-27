/**
 * Next.js configuration untuk AGROWTH frontend.
 *
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,

  // Build "standalone" untuk Docker multi-stage: hanya tracing artefak
  // yang dibutuhkan runtime yang di-copy ke image final (~80 MB vs >500 MB).
  // Dokumentasi: https://nextjs.org/docs/app/api-reference/config/next-config-js/output
  output: "standalone",

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
