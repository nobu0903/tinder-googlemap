import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://meshidoko.com";
  const now = new Date();

  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/lp`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/explore`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/pro`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];
}
