import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Turbopack's production scope hoisting mis-orders zod v4's internal
    // module cycle ("Cannot access 'X' before initialization" while
    // collecting page data for API routes that build schemas at import
    // time). Disable it until the upstream fix lands.
    turbopackScopeHoisting: false,
  },
};

export default nextConfig;
