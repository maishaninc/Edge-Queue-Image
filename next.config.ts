import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pg (node-postgres) must run on the Node.js runtime, not be bundled.
  serverExternalPackages: ["pg"],
  eslint: {
    // Lint is run separately via `npm run lint`; don't block production builds.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
