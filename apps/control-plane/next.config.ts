import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@webchain/protocol", "@webchain/asap-adapter"],
};

export default nextConfig;
