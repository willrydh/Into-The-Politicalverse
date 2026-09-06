"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "../localize";
import { localizedHref } from "@/lib/i18n/translate";

export function SearchIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg>;
}
export function SearchTrigger() {
  const locale = useLocale(); const router = useRouter();
  const label = locale === "sv" ? "Sök på hela sajten" : "Search the entire site";
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "k" && !event.isComposing) {
        event.preventDefault();
        const input = document.getElementById("universal-search-input") as HTMLInputElement | null;
        if (input) { input.focus(); input.select(); input.scrollIntoView({ block: "center" }); }
        else router.push(localizedHref("/search/", locale));
      }
    };
    window.addEventListener("keydown", shortcut); return () => window.removeEventListener("keydown", shortcut);
  }, [locale, router]);
  return <Link href={localizedHref("/search/", locale)} className="header-search" aria-label={label} aria-keyshortcuts="Meta+K Control+K"><SearchIcon /><span>{locale === "sv" ? "Sök allt" : "Search everything"}</span><kbd>⌘ / Ctrl K</kbd></Link>;
}
