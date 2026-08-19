import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Server Actions default to a 1MB request body — too small for photo
    // uploads (portrait/pied/autres/selfie submitted together from a form).
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
