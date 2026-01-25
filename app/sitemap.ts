import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://cursor-forum.trynia.ai",
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
  ];
}
