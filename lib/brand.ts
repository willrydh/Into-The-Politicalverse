import type { Locale } from "./i18n/messages";

export const BRAND_NAME = "Into the Politicalverse";
export const PUBLIC_SITE_URL = "https://willrydh.github.io/Into-The-Politicalverse/";
export const BRAND_DIRECTORY = "brand/crown-2026";

export function brandAsset(file: string, basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "") {
  return `${basePath}/${BRAND_DIRECTORY}/${file}`;
}

export function brandManifestPath(locale: Locale, basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "") {
  return `${basePath}/${locale === "en" ? "en/" : ""}manifest.webmanifest`;
}

export const BRAND_ICONS = [
  { file: "politicalverse-logo.svg", sizes: "any", type: "image/svg+xml" },
  ...[16, 32, 48].map(size => ({ file: `favicon-${size}.png`, sizes: `${size}x${size}`, type: "image/png" })),
];

export const BRAND_DESCRIPTION = {
  sv: "Svensk valprognos med öppna mätdata, mandatintervall, regeringsvägar, officiell valhistorik och synlig metod.",
  en: "Swedish election forecasts with open polling data, seat intervals, government context, official results and transparent methodology.",
};
