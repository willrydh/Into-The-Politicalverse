"use client";
import { usePathname } from "next/navigation";
import { useLocale } from "./localize";
import { localizedHref, ROUTES } from "@/lib/i18n/translate";
import { useLocalQuery } from "@/components/maps/local-url";

export function LanguageSwitcher() {
  const locale = useLocale(); const pathname = usePathname();
  const query = useLocalQuery();
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const path = base && pathname.startsWith(base + "/") ? pathname.slice(base.length) : pathname;
  const route = path.replace(/^\/en(?=\/|$)/, "").replace(/^\//, "").replace(/\/$/, "");
  const destination = (ROUTES as readonly string[]).includes(route) ? path : "/";
  return <nav className="language-switcher" aria-label={locale === "sv" ? "Språk" : "Language"}>
    <a data-language-switch="true" href={`${base}${localizedHref(destination, "sv")}${["maps", "search", "parties"].includes(route) ? query : ""}`} hrefLang="sv" lang="sv" aria-label="Svenska" aria-current={locale === "sv" ? "page" : undefined}><span className="language-switcher__full">Svenska</span><span className="language-switcher__short" aria-hidden="true">SV</span></a>
    <span aria-hidden="true">/</span>
    <a data-language-switch="true" href={`${base}${localizedHref(destination, "en")}${["maps", "search", "parties"].includes(route) ? query : ""}`} hrefLang="en" lang="en" aria-label="English" aria-current={locale === "en" ? "page" : undefined}><span className="language-switcher__full">English</span><span className="language-switcher__short" aria-hidden="true">EN</span></a>
  </nav>;
}
