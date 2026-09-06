"use client";
import { usePathname } from "next/navigation";
import { useLocale } from "./localize";
import { localizedHref, ROUTES } from "@/lib/i18n/translate";

export function LanguageSwitcher() {
  const locale = useLocale(); const pathname = usePathname();
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const path = base && pathname.startsWith(base + "/") ? pathname.slice(base.length) : pathname;
  const route = path.replace(/^\/en(?=\/|$)/, "").replace(/^\//, "").replace(/\/$/, "");
  const destination = (ROUTES as readonly string[]).includes(route) ? path : "/";
  return <nav className="language-switcher" aria-label={locale === "sv" ? "Språk" : "Language"}>
    <a data-language-switch="true" href={`${base}${localizedHref(destination, "sv")}`} hrefLang="sv" lang="sv" aria-current={locale === "sv" ? "page" : undefined}>Svenska</a>
    <span aria-hidden="true">/</span>
    <a data-language-switch="true" href={`${base}${localizedHref(destination, "en")}`} hrefLang="en" lang="en" aria-current={locale === "en" ? "page" : undefined}>English</a>
  </nav>;
}
