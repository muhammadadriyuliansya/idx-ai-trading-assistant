import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Allow HMR from 127.0.0.1 (Next.js 16 blocks it by default since
  // it's technically a different origin from localhost).
  allowedDevOrigins: ["127.0.0.1", "localhost"],

  // yahoo-finance2 is a big Node-only dep with dynamic imports.
  // Mark it external so Next doesn't try to bundle it into the server output,
  // which both speeds up build and avoids runtime resolution issues.
  serverExternalPackages: ["yahoo-finance2"],

  compiler: {
    // Strip console calls in production builds, but keep warn/error so
    // we still surface Yahoo / news failures.
    removeConsole:
      process.env.NODE_ENV === "production"
        ? { exclude: ["error", "warn"] }
        : false,
  },

  experimental: {
    // Next 16: larger package imports (lucide, framer-motion) benefit from
    // optimized tree-shaking on the server too.
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
};

export default nextConfig;
