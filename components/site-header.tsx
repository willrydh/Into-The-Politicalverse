"use client";
import { useEffect, useRef } from "react";
import { Localize, useLocale } from "@/components/localize";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LanguageSwitcher } from "./language-switcher";
import { SearchTrigger } from "./search/search-trigger";
import { ThemeToggle } from "./theme-toggle";
import { useSiteLocation } from "./site-location";
import { useScrollHeader } from "./use-scroll-header";
import { navigateLocalQuery, useLocalQuery } from "./maps/local-url";

const NAVIGATION = [
  { href: "/", label: "Start" },
  { href: "/valnatt", label: "Valnatt" },
  { href: "/forecasts", label: "Prognos" },
  { href: "/charts", label: "Grafer" },
  { href: "/parties", label: "Partier" },
  { href: "/maps", label: "Karta" },
  { href: "/elections", label: "Val" },
  { href: "/indicators", label: "Indikatorer" },
  { href: "/simulator", label: "Simulator" },
];

export function SiteHeader() {
  const rawPathname = usePathname();
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const path = base && rawPathname.startsWith(base + "/") ? rawPathname.slice(base.length) : rawPathname;
  const pathname = path.replace(/^\/en(?=\/|$)/, "").replace(/\/$/, "") || "/";
  const locale = useLocale();
  const query = useLocalQuery();
  const location = useSiteLocation();
  const headerRef = useScrollHeader(rawPathname);
  const navigationRef = useRef<HTMLElement>(null);
  const page = [...NAVIGATION, { href: "/search", label: locale === "sv" ? "Sök" : "Search" }, { href: "/overview", label: locale === "sv" ? "Översikt" : "Overview" }, { href: "/sources", label: "Datakällor" }].find(item => item.href === pathname);
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

  return <Localize>{(
    <header className="site-header" ref={headerRef}>
      <div className="site-header__utility">
        <div className="site-header__utility-inner">
          <Link className="wordmark" href="/" aria-label="Into the Politicalverse, startsida">
            <span className="wordmark__mark" aria-hidden="true"><span>PV</span></span>
            <span className="wordmark__text"><small>Into the</small><strong>Politicalverse</strong></span>
          </Link>
          <SearchTrigger />
          <ThemeToggle />
          <LanguageSwitcher />
        </div>
      </div>
      <div className="site-header__navigation">
        <div className="site-header__navigation-inner">
          <nav className="primary-nav" aria-label="Huvudnavigation" ref={navigationRef}>
            {NAVIGATION.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={active ? "primary-nav__link is-active" : "primary-nav__link"}>
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="header-cycle"><span>Sverige</span><strong>Valet 2026</strong></div>
        </div>
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
    </header>
  )}</Localize>;
}
