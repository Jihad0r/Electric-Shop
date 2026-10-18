"use client";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import CartBadge from "@/components/CartBadge";
import Logo from "@/components/Logo";
import LogoutButton from "@/components/LogoutButton";
import { CATEGORY_META, STORE_NAME } from "@/lib/store";

type Me = { id: string; name: string; email: string; role: "user" | "admin" };

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/laptops", label: CATEGORY_META.laptops.label },
  { href: "/phones", label: CATEGORY_META.phones.label },
  { href: "/tablets", label: CATEGORY_META.tablets.label },
  { href: "/accessories", label: CATEGORY_META.accessories.label },
  { href: "/others", label: CATEGORY_META.others.label },
];

const iconButton =
  "flex h-9 w-9 items-center justify-center rounded-lg text-slate-200 transition hover:bg-white/10 hover:text-white";

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const SearchIcon = () => (
  <Svg>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </Svg>
);
const UserIcon = () => (
  <Svg>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </Svg>
);
const CartIcon = () => (
  <Svg>
    <circle cx="9" cy="20" r="1.5" />
    <circle cx="18" cy="20" r="1.5" />
    <path d="M3 4h2.5l2.2 11h10.6L21 8H6.2" />
  </Svg>
);

function SearchBox({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = query.trim();
    if (q) router.push(`/products?search=${encodeURIComponent(q)}`);
  };

  return (
    <form onSubmit={handleSubmit} role="search" className={`relative ${className}`}>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search for products..."
        aria-label="Search for products"
        className="w-full rounded-lg border border-white/10 bg-ink-800/70 py-2 pl-3 pr-10 text-base text-slate-100 placeholder-slate-500 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 sm:text-sm"
      />
      <button
        type="submit"
        aria-label="Search"
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 hover:text-white"
      >
        <SearchIcon />
      </button>
    </form>
  );
}

export default function StoreNav() {
  const pathname = usePathname();
  // undefined = still checking, null = logged out
  const [user, setUser] = useState<Me | null | undefined>(undefined);
  const [accountOpen, setAccountOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        const data = res.ok ? ((await res.json()) as Me) : null;
        if (!cancelled) setUser(data);
      } catch {
        if (!cancelled) setUser(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Close the account menu on an outside click, and both menus on Escape
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAccountOpen(false);
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const linkClass = (active: boolean) =>
    `block whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
      active ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"
    }`;

  const menuItem =
    "block rounded-lg px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10 hover:text-white";

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink-950/90 backdrop-blur">
      {/* One row: logo, links, search, account, cart */}
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:gap-5 lg:px-8">
        {/* Brand */}
        <Link
          href="/"
          onClick={() => setMenuOpen(false)}
          className="flex shrink-0 items-center gap-2"
        >
          <Logo className="h-7 w-7 text-brand-400" />
          <span className="text-lg font-bold text-white">{STORE_NAME}</span>
        </Link>

        {/* Links (large screens) */}
        <nav aria-label="Main" className="hidden shrink-0 lg:block">
          <ul className="flex items-center gap-0.5">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={isActive(link.href) ? "page" : undefined}
                  className={linkClass(isActive(link.href))}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Search (tablets and up) */}
        <SearchBox className="hidden min-w-0 flex-1 md:mx-auto md:block md:max-w-xl" />

        {/* Account, cart and menu button */}
        <div className="ml-auto flex shrink-0 items-center gap-1 md:ml-0">
          {user === undefined ? (
            <div className="h-9 w-9 animate-pulse rounded-lg bg-white/10" />
          ) : user ? (
            <div ref={accountRef} className="relative">
              <button
                type="button"
                onClick={() => setAccountOpen((o) => !o)}
                aria-label="Account menu"
                aria-expanded={accountOpen}
                className={iconButton}
              >
                <UserIcon />
              </button>

              {accountOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl bg-ink-800 p-2 shadow-xl ring-1 ring-white/10">
                  <div className="border-b border-white/10 px-3 pb-2 pt-1">
                    <p className="truncate text-sm font-medium text-white">{user.name}</p>
                    <p className="truncate text-xs text-slate-400">{user.email}</p>
                  </div>
                  <div className="pt-2">
                    <Link
                      href="/account/orders"
                      onClick={() => setAccountOpen(false)}
                      className={menuItem}
                    >
                      My orders
                    </Link>
                    {user.role === "admin" && (
                      <Link href="/admin" onClick={() => setAccountOpen(false)} className={menuItem}>
                        Admin dashboard
                      </Link>
                    )}
                    <LogoutButton
                      className={`w-full text-left ${menuItem}`}
                      redirectTo="/"
                      onLoggedOut={() => {
                        setUser(null);
                        setAccountOpen(false);
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link href="/login" aria-label="Log in" className={iconButton}>
                <UserIcon />
              </Link>
              <Link
                href="/signup"
                className="hidden rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand-700 sm:block"
              >
                Sign up
              </Link>
            </>
          )}

          <Link href="/cart" aria-label="Cart" className={`relative ${iconButton}`}>
            <CartIcon />
            <CartBadge />
          </Link>

          {/* Menu button: the links live here on phones and tablets */}
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="store-menu"
            className={`${iconButton} lg:hidden`}
          >
            <Svg>{menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}</Svg>
          </button>
        </div>
      </div>

      {/* Search (phones): a thin row under the main bar */}
      <div className="px-4 pb-3 md:hidden">
        <SearchBox />
      </div>

      {/* Links menu (phones and tablets) */}
      {menuOpen && (
        <nav id="store-menu" aria-label="Main" className="border-t border-white/10 lg:hidden">
          <ul className="mx-auto grid max-w-7xl grid-cols-2 gap-1 px-4 py-3 sm:grid-cols-3 sm:px-6">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  aria-current={isActive(link.href) ? "page" : undefined}
                  className={linkClass(isActive(link.href))}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}