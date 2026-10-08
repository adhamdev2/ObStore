import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },


  // Ensure that trailing slashes are handled consistently
  trailingSlash: true,
  // allowedDevOrigins: ['ob1.store'],
};

export default nextConfig;
