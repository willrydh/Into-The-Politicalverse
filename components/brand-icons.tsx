import type { Locale } from "@/lib/i18n/messages";
import { BRAND_ICONS, BRAND_NAME, brandAsset, brandManifestPath } from "@/lib/brand";
import { pwaStatusBarStyle } from "@/lib/viewport";

// The exported 404 page bypasses the language layouts and their Metadata API.
export function BrandIcons({ locale }: { locale: Locale }) {
  return <>
    <meta name="application-name" content={BRAND_NAME} />
    {BRAND_ICONS.map(({ file, ...icon }) => <link key={file} rel="icon" href={brandAsset(file)} {...icon} />)}
    <link rel="shortcut icon" href={brandAsset("favicon.ico")} />
    <link rel="apple-touch-icon" href={brandAsset("politicalverse-app-icon-180.png")} sizes="180x180" type="image/png" />
    <link rel="manifest" href={brandManifestPath(locale)} />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content={pwaStatusBarStyle} />
    <meta name="apple-mobile-web-app-title" content="Politicalverse" />
  </>;
}
