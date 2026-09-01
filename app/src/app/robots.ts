import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/login", "/purchase", "/app-install"],
      disallow: ["/admin", "/commercial-admin", "/dashboard", "/onboarding", "/api"],
    },
    sitemap: "https://aiyaworkspace.com/sitemap.xml",
  };
}
