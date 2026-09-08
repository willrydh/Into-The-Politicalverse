import type { MetadataRoute } from "next";
import { PUBLIC_PAGES, publicPageUrl } from "@/lib/page-metadata";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PAGES.flatMap(path => (["sv", "en"] as const).map(locale => ({
    url: publicPageUrl(path, locale),
    alternates: { languages: { sv: publicPageUrl(path), en: publicPageUrl(path, "en") } },
  })));
}
