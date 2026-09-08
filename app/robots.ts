import type { MetadataRoute } from "next";
import { PUBLIC_SITE_URL } from "@/lib/brand";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/insights/"] },
    sitemap: new URL("sitemap.xml", PUBLIC_SITE_URL).href,
  };
}
