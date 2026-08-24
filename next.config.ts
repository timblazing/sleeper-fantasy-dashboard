import type { NextConfig } from "next";
const nextConfig: NextConfig = { output: "standalone", turbopack: { root: process.cwd() }, images: { remotePatterns: [{ protocol: "https", hostname: "sleepercdn.com", pathname: "/avatars/**" }] }, devIndicators: false };
export default nextConfig;
