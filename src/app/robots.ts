import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/", "/pro", "/waitlist", "/guide"],
    },
    sitemap: "https://meshidoko.com/sitemap.xml",
    host: "https://meshidoko.com",
  };
}
