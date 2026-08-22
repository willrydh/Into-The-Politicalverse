"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAVIGATION = [
  { href: "/", label: "Start" },
  { href: "/forecasts", label: "Prognos" },
  { href: "/charts", label: "Grafer" },
  { href: "/parties", label: "Partier" },
  { href: "/maps", label: "Karta" },
  { href: "/elections", label: "Val" },
  { href: "/indicators", label: "Indikatorer" },
  { href: "/simulator", label: "Simulator" },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="site-header">
      <div className="site-header__utility">
        <div className="site-header__utility-inner">
          <Link className="wordmark" href="/" aria-label="Into the Politicalverse, startsida">
            <span className="wordmark__mark" aria-hidden="true"><span>PV</span></span>
            <span className="wordmark__text"><small>Into the</small><strong>Politicalverse</strong></span>
          </Link>
          <div className="header-status" aria-label="Produktstatus">
            <span className="status-dot" />
            Oberoende valanalys · öppna källor
          </div>
        </div>
      </div>
      <div className="site-header__navigation">
        <div className="site-header__navigation-inner">
          <nav className="primary-nav" aria-label="Huvudnavigation">
            {NAVIGATION.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href} className={active ? "primary-nav__link is-active" : "primary-nav__link"}>
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="header-cycle"><span>Sverige</span><strong>Valet 2026</strong></div>
        </div>
      </div>
    </header>
  );
}
