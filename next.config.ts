import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ryrtxiyqfuxlxclbcdaj.supabase.co',
      },
    ],
  },
};

export default nextConfig;
