import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pg (node-postgres) must run on the Node.js runtime, not be bundled.
  serverExternalPackages: ["pg"],
};

export default nextConfig;
