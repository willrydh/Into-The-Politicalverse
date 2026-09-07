import type { Metadata, MetadataRoute } from "next";
import type { Locale } from "./i18n/messages";
import { BRAND_DESCRIPTION, BRAND_DIRECTORY, BRAND_ICONS, BRAND_NAME, PUBLIC_SITE_URL, brandAsset, brandManifestPath } from "./brand";
import { pwaStatusBarStyle } from "./viewport";

export function brandMetadata(locale: Locale): Metadata {
  // Safari's compact share preview crops the Open Graph image to a square.
  // Use the supplied crown itself so the symbol cannot disappear off-center.
  const sharingIcon = {
    url: new URL(`${BRAND_DIRECTORY}/politicalverse-app-icon-1024.png`, PUBLIC_SITE_URL).href,
    width: 1024,
    height: 1024,
    type: "image/png",
    alt: locale === "sv" ? "Politicalverse – gul krona med nordiskt kors på blå bakgrund." : "Politicalverse – a yellow crown with a Nordic cross on a blue background.",
  };
  const wideImage = {
    url: new URL(`${BRAND_DIRECTORY}/opengraph-${locale}.png`, PUBLIC_SITE_URL).href,
    width: 1200,
    height: 630,
    type: "image/png",
    alt: locale === "sv" ? "Into the Politicalverse – kronan med nordiskt kors. Svensk valdata. Öppen analys." : "Into the Politicalverse – the crown with a Nordic cross. Swedish election data. Open analysis.",
  };
  return {
    metadataBase: new URL(PUBLIC_SITE_URL),
    applicationName: BRAND_NAME,
    description: BRAND_DESCRIPTION[locale],
    icons: {
      icon: BRAND_ICONS.map(({ file, ...icon }) => ({ url: brandAsset(file), ...icon })),
      shortcut: brandAsset("favicon.ico"),
      apple: { url: brandAsset("politicalverse-app-icon-180.png"), sizes: "180x180", type: "image/png" },
    },
    manifest: brandManifestPath(locale),
    appleWebApp: { capable: true, title: "Politicalverse", statusBarStyle: pwaStatusBarStyle },
    other: { "apple-mobile-web-app-capable": "yes" },
    // Next fills the sharing title/description from each page's final metadata.
    // Only the image and identity are shared, so an election link keeps its title.
    openGraph: { siteName: BRAND_NAME, type: "website", locale: locale === "sv" ? "sv_SE" : "en_GB", images: [sharingIcon] },
    twitter: { card: "summary_large_image", images: [wideImage] },
  };
}

export function brandManifest(locale: Locale, basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ""): MetadataRoute.Manifest {
  return {
    id: `${basePath}/`,
    name: BRAND_NAME,
    short_name: "Politicalverse",
    description: BRAND_DESCRIPTION[locale],
    lang: locale,
    start_url: `${basePath}/${locale === "en" ? "en/" : ""}`,
    scope: `${basePath}/`,
    display: "standalone",
    background_color: "#0c3d59",
    theme_color: "#0c3d59",
    icons: [
      ...[192, 512].map(size => ({ src: brandAsset(`politicalverse-app-icon-${size}.png`, basePath), sizes: `${size}x${size}`, type: "image/png", purpose: "any" as const })),
      { src: brandAsset("politicalverse-app-icon-maskable-512.png", basePath), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
