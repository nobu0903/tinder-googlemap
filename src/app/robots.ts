import type { MetadataRoute } from "next";
import { ADMIN_UNLOCK_PATH } from "@/lib/admin/constants";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", ADMIN_UNLOCK_PATH, "/api/"],
    },
    sitemap: "https://meshidoko.com/sitemap.xml",
    host: "https://meshidoko.com",
  };
}
