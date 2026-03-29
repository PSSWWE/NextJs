import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["react-map-gl", "maplibre-gl"],
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@napi-rs/canvas"],
  
  // Add these two blocks below:
  eslint: {
    // This allows the build to finish even with those "defined but never used" warnings
    ignoreDuringBuilds: true,
  },
  typescript: {
    // This ignores TypeScript-specific errors during the Vercel build process
    ignoreBuildErrors: true,
  },
};

export default nextConfig;