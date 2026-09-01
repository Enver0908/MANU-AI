import type { MetadataRoute } from "next";

const CANONICAL_ORIGIN = "https://aiyaworkspace.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return ["/", "/login", "/purchase", "/app-install"].map((path) => ({
    url: `${CANONICAL_ORIGIN}${path}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: path === "/" ? 1 : 0.6,
  }));
}
