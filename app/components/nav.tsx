"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Research desk" },
  { href: "/syndicates", label: "Syndicates" },
  { href: "/market", label: "Market" },
];

/** Sticky global navigation across the three sections of the platform. */
export function Nav() {
  const path = usePathname();
  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <header className="nav">
      <div className="nav-in">
        <Link href="/" className="brand">
          <span className="brand-mark" aria-hidden>▦</span> Ask the Market
        </Link>
        <nav className="nav-links" aria-label="Primary">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={`nav-link${isActive(l.href) ? " on" : ""}`} aria-current={isActive(l.href) ? "page" : undefined}>
              {l.label}
            </Link>
          ))}
        </nav>
        <span className="nav-badge" title="Amazon Aurora PostgreSQL">Aurora · live</span>
      </div>
    </header>
  );
}
