import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pg is a native-ish dependency; keep it server-only (never bundled to the client).
  serverExternalPackages: ["pg"],
};

export default nextConfig;
