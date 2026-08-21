"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAVIGATION = [
  { href: "/", label: "Overview" },
  { href: "/charts", label: "Charts" },
  { href: "/parties", label: "Parties" },
  { href: "/maps", label: "Maps" },
  { href: "/elections", label: "Elections" },
  { href: "/indicators", label: "Indicators" },
  { href: "/simulator", label: "Simulator" },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="site-header">
      <div className="site-header__utility">
        <div className="site-header__utility-inner">
          <Link className="wordmark" href="/" aria-label="Into the Politicalverse home">
            <span className="wordmark__mark" aria-hidden="true"><span>PV</span></span>
            <span className="wordmark__text"><small>Into the</small><strong>Politicalverse</strong></span>
          </Link>
          <div className="header-status" aria-label="Product status">
            <span className="status-dot" />
            Independent election analysis
          </div>
        </div>
      </div>
      <div className="site-header__navigation">
        <div className="site-header__navigation-inner">
          <nav className="primary-nav" aria-label="Primary navigation">
            {NAVIGATION.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href} className={active ? "primary-nav__link is-active" : "primary-nav__link"}>
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="header-cycle"><span>Sweden</span><strong>Election 2026</strong></div>
        </div>
      </div>
    </header>
  );
}
