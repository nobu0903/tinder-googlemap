import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Allow /api/photo?name=…&maxWidthPx=… through next/image (required for query strings).
    localPatterns: [
      {
        pathname: "/api/photo",
        // omit search → any query string allowed
      },
      {
        pathname: "/lp/**",
      },
      {
        pathname: "/ramens/**",
      },
      {
        pathname: "/favicon.png",
      },
    ],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "places.googleapis.com",
      },
    ],
  },
};

export default nextConfig;
