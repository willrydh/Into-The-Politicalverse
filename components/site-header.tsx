"use client";
import { useEffect, useRef, useState } from "react";
import { Localize, useLocale } from "@/components/localize";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LanguageSwitcher } from "./language-switcher";
import { SearchTrigger } from "./search/search-trigger";
import { ThemeToggle } from "./theme-toggle";
import { useSiteLocation } from "./site-location";
import { useScrollHeader } from "./use-scroll-header";
import { navigateLocalQuery, useLocalQuery } from "./maps/local-url";
import { SiteBrand } from "./site-brand";

const NAVIGATION = [
  { href: "/", label: "Start" },
  { href: "/valnatt", label: "Valnatt" },
  { href: "/forecasts", label: "Prognos" },
  { href: "/charts", label: "Grafer" },
  { href: "/parties", label: "Partier" },
  { href: "/maps", label: "Karta" },
  { href: "/elections", label: "Val" },
  { href: "/rankings", label: "Topplistor" },
  { href: "/indicators", label: "Indikatorer" },
  { href: "/simulator", label: "Simulator" },
];

function NavigationIcon({ href }: { href: string }) {
  const paths: Record<string, string> = {
    "/": "m3 10 9-7 9 7v11h-6v-8H9v8H3Z",
    "/valnatt": "M12 3a9 9 0 1 0 9 9M12 3v9l6 3M16 3h5v5",
    "/forecasts": "M3 18 9 12l4 3 8-11M15 4h6v6",
    "/charts": "M4 21V12M12 21V7M20 21V3",
    "/parties": "M5 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6M1 21v-6a4 4 0 0 1 8 0v6M15 21v-6a4 4 0 0 1 8 0v6",
    "/maps": "m2 5 6-3 8 3 6-3v17l-6 3-8-3-6 3ZM8 2v17M16 5v17",
    "/elections": "M4 7h16v14H4ZM8 3l3 3 6-5M8 11h8",
    "/indicators": "M3 7h18M3 17h18M8 3v8M16 13v8",
    "/simulator": "M9 2h6M10 2v7L4 20h16L14 9V2M7 15h10",
    "/sources": "M5 3h11l4 4v14H5ZM15 3v5h5M8 12h9M8 16h9",
    "/search": "M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14M15 15l6 6",
  };
  return <svg className="primary-nav__icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[href] ?? paths["/charts"]} /></svg>;
}

export function SiteHeader() {
  const rawPathname = usePathname();
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const path = base && rawPathname.startsWith(base + "/") ? rawPathname.slice(base.length) : rawPathname;
  const pathname = path.replace(/^\/en(?=\/|$)/, "").replace(/\/$/, "") || "/";
  const locale = useLocale();
  const query = useLocalQuery();
  const location = useSiteLocation();
  const [openOnPath, setOpenOnPath] = useState<string | null>(null);
  const menuOpen = openOnPath === rawPathname;
  const menuButton = useRef<HTMLButtonElement>(null);
  const headerRef = useScrollHeader(rawPathname, menuOpen);
  useEffect(() => {
    if (!menuOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !headerRef.current?.contains(event.target)) setOpenOnPath(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenOnPath(null);
        menuButton.current?.focus({ preventScroll: true });
      }
    };
    const desktop = window.matchMedia("(min-width: 981px)");
    const resize = () => { if (desktop.matches) setOpenOnPath(null); };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    desktop.addEventListener("change", resize);
    return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", escape); desktop.removeEventListener("change", resize); };
  }, [menuOpen, headerRef]);
  const navigationRef = useRef<HTMLElement>(null);
  const page = [...NAVIGATION, { href: "/privacy", label: locale === "sv" ? "Integritet" : "Privacy" }, { href: "/people", label: locale === "sv" ? "Kandidatprofiler" : "Candidate profiles" }, { href: "/search", label: locale === "sv" ? "Sök" : "Search" }, { href: "/overview", label: locale === "sv" ? "Översikt" : "Overview" }, { href: "/sources", label: "Datakällor" }, { href: "/press", label: "Press" }].find(item => item.href === pathname);
  const detail = location?.route === pathname && location.query === query ? location.crumbs : [];
  const crumbs = [{ label: "Start", href: "/" }, ...(page && pathname !== "/" ? [page] : []), ...detail];
  useEffect(() => {
    const nav = navigationRef.current;
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !active) return;
    const revealCurrent = () => nav.scrollTo({ left: active.offsetLeft - nav.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2, behavior: "instant" });
    revealCurrent();
    const observer = new ResizeObserver(revealCurrent);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [pathname]);

  return <Localize>{(<>
    <div className="site-header-positioner" ref={headerRef}>
    <div className="site-header" data-menu-open={menuOpen}>
      <header>
      <div className="site-header__utility">
        <div className="site-header__utility-inner">
          <SiteBrand />
          <SearchTrigger />
          <ThemeToggle />
          <LanguageSwitcher />
          <button ref={menuButton} className="header-menu-button" type="button" aria-expanded={menuOpen} aria-controls="site-navigation" onClick={() => setOpenOnPath(menuOpen ? null : rawPathname)}>{menuOpen ? (locale === "sv" ? "Stäng" : "Close") : (locale === "sv" ? "Meny" : "Menu")}</button>
        </div>
      </div>
      <div className="site-header__navigation" id="site-navigation">
        <div className="site-header__navigation-inner">
          <nav className="primary-nav" aria-label="Huvudnavigation" ref={navigationRef}>
            <Link className="primary-nav__link primary-nav__mobile-only" href="/search/" onClick={() => setOpenOnPath(null)}><NavigationIcon href="/search" /><span>{locale === "sv" ? "Sök på hela sajten" : "Search the entire site"}</span></Link>
            {NAVIGATION.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link key={item.href} href={item.href} onClick={() => setOpenOnPath(null)} aria-current={active ? "page" : undefined} className={active ? "primary-nav__link is-active" : "primary-nav__link"}>
                  <NavigationIcon href={item.href} /><span>{item.label}</span>
                </Link>
              );
            })}
            <Link className="primary-nav__link primary-nav__mobile-only" href="/sources/" onClick={() => setOpenOnPath(null)}><NavigationIcon href="/sources" /><span>{locale === "sv" ? "Datakällor" : "Data sources"}</span></Link>
          </nav>
          <div className="header-cycle"><span>Sverige</span><strong>Valet 2026</strong></div>
        </div>
      </div>
      </header>
    </div>
      <div className="site-location">
        <div className="site-location__inner">
          <span className="site-location__label">{locale === "sv" ? "Du är här" : "You are here"}</span>
          <nav aria-label={locale === "sv" ? "Brödsmulor" : "Breadcrumbs"}>
            <ol>{crumbs.map((crumb, i) => <li key={`${i}:${crumb.href}`}>
              {i > 0 && <span className="site-location__separator" aria-hidden="true">›</span>}
              {i === crumbs.length - 1 ? <strong aria-current="location">{crumb.label}</strong> : <Link href={crumb.href} onClick={event => {
                if (pathname !== "/maps" || !crumb.href.startsWith("/maps?") || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
                event.preventDefault();
                navigateLocalQuery(crumb.href.slice(5));
                requestAnimationFrame(() => document.querySelector(".local-workspace")?.scrollIntoView({ block: "start" }));
              }}>{crumb.label}</Link>}
            </li>)}</ol>
          </nav>
        </div>
      </div>
    </div>
  </>)}</Localize>;
}
