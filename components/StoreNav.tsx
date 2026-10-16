"use client";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import LogoutButton from "@/components/LogoutButton";
import { CATEGORY_META, STORE_NAME } from "@/lib/store";

type Me = { id: string; name: string; email: string; role: "user" | "admin" };

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/products?category=laptops", label: CATEGORY_META.laptops.label },
  { href: "/products?category=phones", label: CATEGORY_META.phones.label },
  { href: "/products?category=tablets", label: CATEGORY_META.tablets.label },
  { href: "/products?category=accessories", label: CATEGORY_META.accessories.label },
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  // Close the account menu on outside click or Escape
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const menuItem =
    "block rounded-lg px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10 hover:text-white";

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:gap-6 sm:px-6 lg:px-8">
        {/* Brand */}
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <Logo className="h-7 w-7 text-brand-400" />
          <span className="text-lg font-bold text-white">{STORE_NAME}</span>
        </Link>

        {/* Search (tablet and up) */}
        <SearchBox className="hidden flex-1 md:mx-auto md:block md:max-w-xl" />

        {/* Account and cart */}
        <div className="ml-auto flex items-center gap-1 md:ml-0">
          {user === undefined ? (
            <div className="h-9 w-9 animate-pulse rounded-lg bg-white/10" />
          ) : user ? (
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                aria-label="Account menu"
                aria-expanded={menuOpen}
                className={iconButton}
              >
                <UserIcon />
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl bg-ink-800 p-2 shadow-xl ring-1 ring-white/10">
                  <div className="border-b border-white/10 px-3 pb-2 pt-1">
                    <p className="truncate text-sm font-medium text-white">{user.name}</p>
                    <p className="truncate text-xs text-slate-400">{user.email}</p>
                  </div>
                  <div className="pt-2">
                    <Link
                      href="/account/orders"
                      onClick={() => setMenuOpen(false)}
                      className={menuItem}
                    >
                      My orders
                    </Link>
                    {user.role === "admin" && (
                      <Link href="/admin" onClick={() => setMenuOpen(false)} className={menuItem}>
                        Admin dashboard
                      </Link>
                    )}
                    <LogoutButton
                      className={`w-full text-left ${menuItem}`}
                      redirectTo="/"
                      onLoggedOut={() => {
                        setUser(null);
                        setMenuOpen(false);
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

          <Link href="/cart" aria-label="Cart" className={iconButton}>
            <CartIcon />
          </Link>
        </div>
      </div>

      {/* Search (phones) */}
      <div className="px-4 pb-3 md:hidden">
        <SearchBox />
      </div>

      {/* Category links: a swipeable row on phones */}
      <nav aria-label="Main" className="border-t border-white/5">
        <ul className="mx-auto flex max-w-7xl gap-1 overflow-x-auto whitespace-nowrap px-4 py-2 sm:px-6 lg:px-8">
          {LINKS.map((link) => {
            const active = link.href === "/" && pathname === "/";
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`block rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    active
                      ? "bg-white/10 text-white"
                      : "text-slate-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}