"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";
import { CATEGORY_META, STORE_NAME } from "@/lib/store";
import { CATEGORIES } from "@/types/product";

type Me = { id: string; name: string; email: string; role: "user" | "admin" };

const MAIN_LINKS = [
  { href: "/", label: "Home", exact: true },
  { href: "/products", label: "Shop", exact: false },
];

const CATEGORY_LINKS = CATEGORIES.filter((c) => c !== "others").map((c) => ({
  href: `/products?category=${c}`,
  label: CATEGORY_META[c].label,
}));

const logoutSmall =
  "rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60";
const logoutFull =
  "w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60";

export default function StoreNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // undefined = still checking, null = logged out
  const [user, setUser] = useState<Me | null | undefined>(undefined);

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

  // Close the mobile menu with the Escape key
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const isActive = (link: (typeof MAIN_LINKS)[number]) =>
    link.exact ? pathname === link.href : pathname.startsWith(link.href);

  const linkClass = (active: boolean) =>
    `rounded-lg px-3 py-2 text-sm font-medium transition ${
      active ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
    }`;

  const handleLoggedOut = () => {
    setUser(null);
    setOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur">
      <nav
        aria-label="Main"
        className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8"
      >
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-base font-bold text-white">
            {STORE_NAME.charAt(0)}
          </span>
          <span className="text-lg font-bold text-gray-900">{STORE_NAME}</span>
        </Link>

        {/* Desktop links */}
        <ul className="hidden items-center gap-1 md:flex">
          {MAIN_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={isActive(link) ? "page" : undefined}
                className={linkClass(isActive(link))}
              >
                {link.label}
              </Link>
            </li>
          ))}
          {CATEGORY_LINKS.map((link) => (
            <li key={link.href} className="hidden lg:block">
              <Link href={link.href} className={linkClass(false)}>
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Desktop account area */}
        <div className="hidden items-center gap-2 md:flex">
          {user === undefined ? (
            <div className="h-9 w-32 animate-pulse rounded-lg bg-gray-100" />
          ) : user ? (
            <>
              <span className="hidden max-w-[10rem] truncate text-sm text-gray-600 lg:inline">
                Hi, {user.name.split(" ")[0]}
              </span>
              {user.role === "admin" && (
                <Link
                  href="/admin/products"
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-blue-600 transition hover:bg-blue-50"
                >
                  Dashboard
                </Link>
              )}
              <LogoutButton className={logoutSmall} redirectTo="/" onLoggedOut={handleLoggedOut} />
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                Sign up
              </Link>
            </>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="store-mobile-menu"
          className="rounded-lg p-2 text-gray-700 transition hover:bg-gray-100 md:hidden"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div id="store-mobile-menu" className="border-t border-gray-200 bg-white md:hidden">
          <ul className="space-y-1 px-4 py-3 sm:px-6">
            {MAIN_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  aria-current={isActive(link) ? "page" : undefined}
                  className={`block ${linkClass(isActive(link))}`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
            {CATEGORY_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={`block ${linkClass(false)}`}
                >
                  {link.label}
                </Link>
              </li>
            ))}

            <li className="space-y-2 border-t border-gray-100 pt-3">
              {user === undefined ? (
                <div className="h-10 animate-pulse rounded-lg bg-gray-100" />
              ) : user ? (
                <>
                  <p className="px-3 text-sm text-gray-600">Signed in as {user.name}</p>
                  {user.role === "admin" && (
                    <Link
                      href="/admin/products"
                      onClick={() => setOpen(false)}
                      className="block rounded-lg px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
                    >
                      Dashboard
                    </Link>
                  )}
                  <LogoutButton className={logoutFull} redirectTo="/" onLoggedOut={handleLoggedOut} />
                </>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="rounded-lg border border-gray-300 py-2.5 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Log in
                  </Link>
                  <Link
                    href="/signup"
                    onClick={() => setOpen(false)}
                    className="rounded-lg bg-blue-600 py-2.5 text-center text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Sign up
                  </Link>
                </div>
              )}
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}